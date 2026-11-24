// The Raw Portal reminder and notification engine.
// mode "inbox": a new in-app notification was created; send it to that person's phones.
// mode "tick":  runs every 5 minutes (pg_cron). Deadline reminders, overdue prompts, escalations, daily and weekly briefings.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

type Doc = { collection: string; id: string; data: Record<string, any> };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
const H = 3600 * 1000;

Deno.serve(async (req: Request) => {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: cfg } = await admin.from("app_config").select("key,value");
  const c = Object.fromEntries((cfg || []).map((r: { key: string; value: string }) => [r.key, r.value]));
  if (!c.cron_secret || req.headers.get("x-cron-secret") !== c.cron_secret) return json({ error: "forbidden" }, 403);
  webpush.setVapidDetails(c.vapid_subject, c.vapid_public, c.vapid_private);
  let body: Record<string, any> = {};
  try { body = await req.json(); } catch { /* empty */ }

  async function push(to: string, title: string, text: string, url: string) {
    const { data: subs } = await admin.from("push_subscriptions").select("endpoint,p256dh,auth").eq("email", to);
    let n = 0;
    for (const s of subs || []) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title, body: text, url }), { TTL: 60 * 60 * 12, urgency: "high" });
        n++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        else console.error("push failed", code);
      }
    }
    return n;
  }
  async function notify(to: string, title: string, text: string, ref: string, kind: string) {
    const id = crypto.randomUUID();
    await admin.from("docs").insert({ collection: "inbox", id, data: { to, title, body: text, ref, kind, at: new Date().toISOString(), read: false, pushed: true, by: "engine" } });
    return push(to, title, text, ref ? "#open/" + ref : "#home");
  }

  if (body.mode === "inbox" && body.id) {
    const { data: row } = await admin.from("docs").select("data").eq("collection", "inbox").eq("id", body.id).maybeSingle();
    const d = row?.data;
    if (!d || d.pushed === true || !d.to) return json({ skipped: true });
    await admin.from("docs").update({ data: { ...d, pushed: true } }).eq("collection", "inbox").eq("id", body.id);
    const n = await push(d.to, d.title || "The Raw Portal", d.body || "", d.ref ? "#open/" + d.ref : "#home");
    return json({ pushed: n });
  }

  // ---- tick ----
  const now = Date.now();
  const all: Doc[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from("docs").select("collection,id,data").in("collection", ["tasks", "settings"]).range(from, from + 999);
    if (error) return json({ error: error.message }, 500);
    all.push(...(data as Doc[]));
    if (!data || data.length < 1000) break;
  }
  const settings = all.find(d => d.collection === "settings" && d.id === "main")?.data || {};
  const tasks = all.filter(d => d.collection === "tasks");
  const { data: members } = await admin.from("allowed_emails").select("email,name,tz,briefing,is_admin,access");
  const nameOf = (e: string) => (members || []).find((m: any) => m.email === e)?.name || (e || "").split("@")[0];
  const escalateTo: string[] = (Array.isArray(settings.escalate) && settings.escalate.length ? settings.escalate : (members || []).filter((m: any) => m.is_admin).map((m: any) => m.email));

  // which reminders were already sent
  const groups: { keys: string[]; send: () => Promise<number> }[] = [];

  for (const t of tasks) {
    const d = t.data || {};
    if (d.status === "done" || !d.due || !d.owner) continue;
    if (d.blocked) continue;
    const due = Date.parse(d.due);
    if (isNaN(due)) continue;
    const offs: number[] = Array.isArray(d.reminders) ? d.reminders.map(Number).filter((x: number) => x >= 0) : [72, 24, 3, 0];
    const ref = "tasks/" + t.id;
    const passed = offs.filter(h => now >= due - h * H).sort((a, b) => a - b);
    if (passed.length && now < due + 2 * H) {
      const keys = passed.map(h => `rem:${t.id}:${d.due}:${h}`);
      const h = passed[0];
      const when = h === 0 ? "is due now" : h < 24 ? `is due in ${h} hours` : `is due in ${Math.round(h / 24)} days`;
      const title = d.status === "external" ? "Follow-up due" : d.status === "approval" ? "Approval needed" : d.status === "payment" ? "Payment action due" : "Reminder";
      groups.push({ keys, send: () => notify(d.owner, title, `${d.title} ${when}.`, ref, "reminder") });
    }
    if (offs.length && now >= due + 24 * H) {
      const n = Math.floor((now - due) / (24 * H));
      groups.push({ keys: [`od:${t.id}:${d.due}:${n}`], send: () => notify(d.owner, "Overdue", `${d.title} is overdue by ${n} day${n === 1 ? "" : "s"}. Seeing a reminder does not complete the task.`, ref, "overdue") });
    }
    if ((d.priority === "critical" || d.escalate === true) && now > due + H) {
      const key = `esc:${t.id}:${d.due}`;
      const people = escalateTo.filter(e => e && e !== d.owner);
      if (people.length) groups.push({ keys: [key], send: async () => { let n = 0; for (const p of people) n += await notify(p, "Escalation", `${d.priority === "critical" ? "Critical" : "Important"} task overdue: ${d.title} (owner: ${nameOf(d.owner)}).`, ref, "escalation"); return n; } });
    }
  }

  // briefings
  const briefHour = Number(settings.briefHour ?? 7);
  for (const m of members || []) {
    if (!m.briefing) continue;
    const tz = m.tz || settings.tz || "Asia/Bangkok";
    let parts: Record<string, string> = {};
    try { parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", weekday: "short" }).formatToParts(new Date(now)).map(p => [p.type, p.value])); } catch { continue; }
    const localDate = `${parts.year}-${parts.month}-${parts.day}`;
    if (Number(parts.hour) < briefHour) continue;
    const mine = tasks.map(t => ({ id: t.id, ...t.data })).filter((d: any) => d.status !== "done" && !d.blocked);
    const endToday = now + 18 * H;
    const own = mine.filter((d: any) => d.owner === m.email);
    const overdue = own.filter((d: any) => d.due && Date.parse(d.due) < now).length;
    const today = own.filter((d: any) => d.due && Date.parse(d.due) >= now && Date.parse(d.due) < endToday).length;
    const approvals = own.filter((d: any) => d.status === "approval").length;
    const payments = own.filter((d: any) => d.status === "payment").length;
    const waiting = mine.filter((d: any) => d.by === m.email && d.owner !== m.email && d.due && Date.parse(d.due) < endToday).length;
    const teamOverdue = mine.filter((d: any) => d.due && Date.parse(d.due) < now).length;
    const bits = [`${today} due today`, `${overdue} overdue`];
    if (approvals) bits.push(`${approvals} approval${approvals === 1 ? "" : "s"}`);
    if (payments) bits.push(`${payments} payment${payments === 1 ? "" : "s"}`);
    if (waiting) bits.push(`${waiting} to chase`);
    if (m.access === "full") bits.push(`team overdue: ${teamOverdue}`);
    groups.push({ keys: [`brief:${m.email}:${localDate}`], send: () => notify(m.email, "Your daily briefing", bits.join(", ") + ".", "briefing/today", "briefing") });
    if (parts.weekday === "Mon") groups.push({ keys: [`week:${m.email}:${localDate}`], send: () => notify(m.email, "Weekly management summary", "Last week's money, progress and open items are ready.", "briefing/week", "briefing") });
  }

  // send only what has not been sent before
  const allKeys = groups.flatMap(g => g.keys);
  const sent = new Set<string>();
  for (let i = 0; i < allKeys.length; i += 500) {
    const { data } = await admin.from("sent_log").select("key").in("key", allKeys.slice(i, i + 500));
    (data || []).forEach((r: { key: string }) => sent.add(r.key));
  }
  let notices = 0, pushed = 0;
  for (const g of groups) {
    const fresh = g.keys.filter(k => !sent.has(k));
    if (!fresh.length) continue;
    const { error } = await admin.from("sent_log").insert(fresh.map(key => ({ key })));
    if (error) continue; // another run got there first
    fresh.forEach(k => sent.add(k));
    notices++;
    pushed += await g.send();
  }
  if (new Date(now).getUTCMinutes() < 5) {
    await admin.from("sent_log").delete().lt("sent_at", new Date(now - 90 * 24 * H).toISOString());
    await admin.from("docs").delete().eq("collection", "inbox").lt("updated_at", new Date(now - 60 * 24 * H).toISOString());
  }
  return json({ tasks: tasks.length, notices, pushed });
});
