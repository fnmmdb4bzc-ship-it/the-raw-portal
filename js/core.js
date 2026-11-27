/* The Raw Portal: core helpers, data and permissions. Loaded first; everything here is shared by the other files. */
'use strict';
const SUPABASE_URL = 'https://qbpqaaqjgwgsszclenvl.supabase.co';
// Public key: meant to be visible in a web page. The database rules are what protect the data.
const SUPABASE_KEY = 'sb_publishable_m8tnkhKUkHTp3r0sahR4Pw_5P2Kjmne';
const VAPID_PUBLIC = 'BGIDFxAX_n_opNgUjzuIgDHKc288I4KyfRke38mOkJzb1kVh9H4EIBWQJgPOevrSnk0xIJ8uwDKUny9Vsw8VD60';

/* ---------- small helpers ---------- */
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const ym = d => d.getFullYear() + '-' + pad(d.getMonth() + 1);
const parseD = s => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const TODAY = () => ymd(new Date());
const H = 36e5, DAY = 864e5;
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const by = (k, dir = 1) => (a, b) => ((a[k] || '') > (b[k] || '') ? 1 : (a[k] || '') < (b[k] || '') ? -1 : 0) * dir;
const uniq = a => [...new Set(a.filter(Boolean))];
const icon = (n, cls) => '<svg class="i' + (cls ? ' ' + cls : '') + '"><use href="#i-' + n + '"/></svg>';

// dates: deadlines are stored as exact moments (ISO) and shown in each person's own time zone
const fmtD = s => s ? parseD(s).toLocaleDateString('en-GB', {weekday:'short', day:'numeric', month:'short', year:'numeric'}) : '';
const fmtDs = s => s ? parseD(s).toLocaleDateString('en-GB', {day:'numeric', month:'short'}) : '';
function fmtDT(iso, short){
  if(!iso) return '';
  const d = new Date(iso); if(isNaN(d)) return '';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  const day = d.toLocaleDateString('en-GB', short ? {weekday:'short', day:'numeric', month:'short'} : {weekday:'short', day:'numeric', month:'short', year: sameYear ? undefined : 'numeric'});
  return day + ', ' + d.toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'});
}
const ymLabel = s => parseD(s + '-01').toLocaleDateString('en-GB', {month:'long', year:'numeric'});
const toLocalInput = iso => { if(!iso) return ''; const d = new Date(iso); if(isNaN(d)) return ''; return ymd(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const fromLocalInput = v => { if(!v) return ''; const d = new Date(v); return isNaN(d) ? '' : d.toISOString(); };
const dayEnd = (dateStr, hh = 17) => { const d = parseD(dateStr); d.setHours(hh, 0, 0, 0); return d.toISOString(); };
const isoPlus = (iso, days) => new Date(new Date(iso || Date.now()).getTime() + days * DAY).toISOString();
const msLeft = iso => iso ? new Date(iso).getTime() - Date.now() : Infinity;
function relDue(iso){
  if(!iso) return '';
  const ms = msLeft(iso), a = Math.abs(ms);
  const t = a < H ? Math.max(1, Math.round(a / 6e4)) + ' min' : a < 2 * DAY ? Math.round(a / H) + ' h' : Math.round(a / DAY) + ' days';
  return ms < 0 ? t + ' overdue' : 'in ' + t;
}
const daysTo = s => Math.round((parseD(s) - parseD(TODAY())) / DAY);
function addMonths(dateStr, n){ const d = parseD(dateStr), day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); return ymd(d); }
function nextDate(dateStr, every){
  if(every === 'daily'){ const d = parseD(dateStr); d.setDate(d.getDate() + 1); return ymd(d); }
  if(every === 'weekly'){ const d = parseD(dateStr); d.setDate(d.getDate() + 7); return ymd(d); }
  if(every === 'monthly') return addMonths(dateStr, 1);
  if(every === 'quarterly') return addMonths(dateStr, 3);
  if(every === 'yearly') return addMonths(dateStr, 12);
  return dateStr;
}

// money: kept per currency, never converted
function money(n, cur){
  const v = Number(n) || 0;
  try { return new Intl.NumberFormat('en-GB', {style:'currency', currency: cur || 'GBP', maximumFractionDigits: cur === 'THB' ? 0 : 2}).format(v); }
  catch(e){ return (cur || '') + ' ' + v.toFixed(2); }
}
function parseAmount(v){
  let s = String(v == null ? '' : v).replace(/[£฿$€R\s ]|THB|GBP/gi, '');
  if(!s) return NaN;
  const c = s.lastIndexOf(','), d = s.lastIndexOf('.');
  if(c > -1 && d > -1) s = c > d ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if(c > -1) s = /,\d{3}$/.test(s) && s.split(',').length > 1 && !/,\d{1,2}$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  return /^-?\d*\.?\d+$/.test(s) ? Math.round(parseFloat(s) * 100) / 100 : NaN;
}
const sumBy = (rows, f = r => r.amount) => { const o = {}; rows.forEach(r => { const c = r.currency || 'GBP'; o[c] = (o[c] || 0) + (Number(f(r)) || 0); }); return o; };
const moneyMap = m => { const ks = Object.keys(m).filter(k => Math.abs(m[k]) > 0.004); return ks.length ? ks.map(k => money(m[k], k)).join(' + ') : money(0, cfg().currencies[0]); };

let toastT;
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 3800); }

/* ---------- settings with sensible starting values (all editable under Team and settings) ---------- */
const MODULES = [
  ['finance','Finance'], ['marketing','Marketing'], ['customers','Customers'], ['suppliers','Suppliers and stock'],
  ['bizdev','Partnerships'], ['legal','Legal and compliance'], ['general','General tasks'], ['calendar','Calendar events'],
  ['docs','Documents'], ['details','Contacts and details'], ['more','More (notes, ideas, photos, trips, lists, countdowns)']
];
const DEFAULTS = {
  name: 'The Raw Portal',
  notice: '',
  brands: [{name:'RAW Group', color:'#ef4b3a'}, {name:'Nutrients', color:'#f5a530'}, {name:'Combat', color:'#98a32b'}, {name:'Recovery', color:'#25a0b0'}],
  currencies: ['GBP', 'THB'],
  accounts: ['UK account', 'Thai account'],
  entities: ['UK company', 'Thai company'],
  finCats: ['Stock and product', 'Packaging', 'Shipping and freight', 'Marketing', 'Legal and professional', 'Visas and permits', 'Staff', 'Rent and utilities', 'Software', 'Travel', 'Bank fees', 'Sales', 'Other'],
  legalTypes: ['Company registration', 'Work permit', 'Visa', 'Business licence', 'Product registration', 'Insurance', 'Contract', 'Lease', 'Tax and accounting', 'Regulatory submission', 'Intellectual property', 'Other'],
  custTypes: ['Supplement retailer', 'Distributor', 'Gym', 'Clinic', 'Online', 'Other stockist'],
  folders: ['Contracts', 'Invoices and quotes', 'Proof of payment', 'Certificates and compliance', 'Marketing', 'Product', 'Other'],
  lists: ['Stock and supplies', 'Office', 'Events', 'Other'],
  roles: {},
  escalate: [],
  reconLead: 5,
  briefHour: 7,
  tz: 'Asia/Bangkok'
};
const ROLES = [
  ['stacey', 'Management and approvals', 'Stacey'],
  ['charlie', 'Operations and follow-ups', 'Charlie'],
  ['rhiannon', 'Accounts and payments', 'Rhiannon'],
  ['dale', 'Financial oversight', 'Dale']
];

/* ---------- state ---------- */
let sb = null, me = null, M = [], MEMBERS = [], D = {}, chan = null, loaded = false;
// People without a login yet: they can be made responsible or collaborators, and get access later
const isProfile = e => typeof e === 'string' && e.startsWith('p:');
function mergePeople(){
  const profs = Object.entries(D.team || {}).map(([id, d]) => Object.assign({}, d, {email:'p:' + id, profile:true, access:'none', is_admin:false})).sort(by('name'));
  M = MEMBERS.concat(profs);
  if(me) me = MEMBERS.find(x => x.email === me.email) || me;
}
const ui = { route:'home', sub:'', brand:'all', calMonth: ym(new Date()), calDay: TODAY(), calF:{who:'', mod:'', pri:''}, taskF:{who:'', status:'open', mod:'', pri:''},
  finPeriod:'week', finMonth: ym(new Date()), mineView:'due', briefTab:'today', ideaSort:'top', photoLimit:30, listFilter:'all', docFilter:'all', openIdea:null, open:null };

const list = col => Object.entries(D[col] || {}).map(([id, d]) => Object.assign({}, d, {id}));
const get = (col, id) => (D[col] || {})[id] ? Object.assign({}, D[col][id], {id}) : null;
function cfg(){
  const s = Object.assign({}, DEFAULTS, (D.settings || {}).main || {});
  ['brands','currencies','accounts','entities','finCats','legalTypes','custTypes','folders','lists'].forEach(k => { if(!Array.isArray(s[k]) || !s[k].length) s[k] = DEFAULTS[k]; });
  return s;
}
const member = e => M.find(m => m.email === e);
function nameOf(e){
  if(!e) return 'Nobody yet';
  if(e === 'all') return 'Everyone';
  const m = member(e); return m ? (m.name || e.split('@')[0]) : e.split('@')[0];
}
const firstName = e => nameOf(e).split(' ')[0];
const initials = e => { const n = nameOf(e).trim().split(/\s+/); return ((n[0] || '?')[0] + (n[1] ? n[1][0] : '')).toUpperCase(); };
const avatar = (e, sm) => '<span class="av' + (sm ? ' sm' : '') + '" title="' + esc(nameOf(e)) + '">' + esc(initials(e)) + '</span>';
const brandColor = n => ((cfg().brands.find(b => b.name === n) || {}).color) || 'var(--faint)';
const brandTag = n => n ? '<span class="brand" style="--c:' + esc(brandColor(n)) + '">' + esc(n) + '</span>' : '';

// who does what in the workflows: chosen under settings, otherwise matched by first name
function roleEmail(key){
  const s = cfg().roles || {};
  if(s[key] && member(s[key])) return s[key];
  const want = (ROLES.find(r => r[0] === key) || [])[2] || key;
  const m = M.find(x => (x.name || '').toLowerCase().split(' ')[0] === want.toLowerCase()) || M.find(x => x.email.toLowerCase().startsWith(want.toLowerCase()));
  if(m) return m.email;
  const adm = MEMBERS.find(x => x.is_admin);
  return adm ? adm.email : (me ? me.email : '');
}

/* ---------- permissions (the database enforces the same rules) ---------- */
const isFull = () => !!me && me.access === 'full';
const isAdmin = () => !!me && me.is_admin;
function level(mod){
  if(!me) return 'none';
  if(me.access === 'full') return 'edit';
  return (me.perms || {})[mod] || 'none';
}
const canView = mod => level(mod) !== 'none';
const canEdit = mod => level(mod) === 'edit';
const inBrand = r => ui.brand === 'all' || !r.brand || r.brand === ui.brand;

/* ---------- data ---------- */
async function loadAll(){
  const out = {}; let from = 0;
  for(;;){
    const {data, error} = await sb.from('docs').select('collection,id,data').range(from, from + 999);
    if(error) throw error;
    data.forEach(r => { (out[r.collection] = out[r.collection] || {})[r.id] = r.data; });
    if(data.length < 1000) break; from += 1000;
  }
  D = out; loaded = true; mergePeople();
}
async function loadMembers(){
  const {data, error} = await sb.from('allowed_emails').select('*').order('name');
  if(error) throw error;
  MEMBERS = data || [];
  mergePeople();
  return M;
}
function subscribe(){
  if(chan) sb.removeChannel(chan);
  chan = sb.channel('raw-portal')
    .on('postgres_changes', {event:'*', schema:'public', table:'docs'}, p => {
      if(p.eventType === 'DELETE'){ const o = p.old || {}; if(o.collection && D[o.collection]) delete D[o.collection][o.id]; else loadAll().then(schedule).catch(() => {}); }
      else { const n = p.new; (D[n.collection] = D[n.collection] || {})[n.id] = n.data; }
      if((p.new || p.old || {}).collection === 'team' || !(p.new || p.old || {}).collection) mergePeople();
      schedule();
    })
    .on('postgres_changes', {event:'*', schema:'public', table:'allowed_emails'}, () => { loadMembers().then(schedule).catch(() => {}); })
    .subscribe();
}

// The screen changes first, the save happens in the background.
// Writes still on their way to the database, so linked notes can wait for the record they belong to
const PENDING = {};
function track(col, id, p){ const k = col + '/' + id; PENDING[k] = p; p.catch(() => {}).finally(() => { if(PENDING[k] === p) delete PENDING[k]; }); return p; }
const afterSaved = ref => (PENDING[ref] || Promise.resolve()).catch(() => {});
function put(col, id, data){
  (D[col] = D[col] || {})[id] = data; schedule();
  const wait = (col === 'activity' || col === 'comments') && data && data.ref ? afterSaved(data.ref) : Promise.resolve();
  return track(col, id, wait.then(() => sb.from('docs').upsert({collection:col, id, data, updated_at:new Date().toISOString()})).then(({error}) => { if(error){ toast('Could not save. ' + error.message); throw error; } }));
}
// Create only if it does not exist yet (used for things that are generated automatically)
function putNew(col, id, data){
  if((D[col] || {})[id]) return Promise.resolve(false);
  (D[col] = D[col] || {})[id] = data; schedule();
  return track(col, id, sb.from('docs').upsert({collection:col, id, data}, {onConflict:'collection,id', ignoreDuplicates:true}).then(({error}) => { if(error) console.warn(error); return true; }));
}
// Change a few fields without overwriting someone else's changes to other fields
function patch(col, id, changes){
  const cur = (D[col] || {})[id] || {};
  (D[col] = D[col] || {})[id] = Object.assign({}, cur, changes); schedule();
  return sb.rpc('merge_doc', {p_col:col, p_id:id, p_patch:changes}).then(({error}) => { if(error){ toast('Could not save. ' + error.message); throw error; } });
}
// Take something only if nobody else has (stops two people paying the same invoice)
async function claim(col, id, key, value){
  const {data, error} = await sb.rpc('claim_doc', {p_col:col, p_id:id, p_key:key, p_value:value});
  if(error) throw error;
  if(data == null) return false;
  (D[col] = D[col] || {})[id] = data; schedule();
  return true;
}
function del(col, id){
  if(D[col]) delete D[col][id]; schedule();
  return sb.from('docs').delete().eq('collection', col).eq('id', id).then(({error}) => { if(error) toast('Could not delete. ' + error.message); });
}
const stamp = () => ({by: me.email, at: new Date().toISOString()});

// In-app notification, which the engine also sends to the person's phone
function notify(to, title, body, ref, kind){
  if(!to || !me || to === me.email || isProfile(to)) return;
  const id = newId();
  put('inbox', id, {to, title, body, ref: ref || '', kind: kind || 'info', read:false, by: me.email, at: new Date().toISOString()}).catch(() => {});
}
function notifyMany(emails, title, body, ref, kind){ uniq(emails).forEach(e => notify(e, title, body, ref, kind)); }
// Activity history: one small record per event, so nothing is overwritten
function logAct(ref, text){
  if(!me) return;
  put('activity', newId(), {ref, text, by: me.email, at: new Date().toISOString()}).catch(() => {});
}

/* ---------- files ---------- */
const MAX_FILE = 25 * 1024 * 1024;
const sizeText = n => !n ? '' : n < 1048576 ? Math.max(1, Math.round(n / 1024)) + ' KB' : (n / 1048576).toFixed(1) + ' MB';
async function uploadFile(file, name){
  if(file.size > MAX_FILE) throw new Error((name || file.name) + ' is ' + sizeText(file.size) + '. The limit is 25 MB per file.');
  const raw = name || file.name || 'file';
  const safe = raw.normalize('NFKD').replace(/[^\w.\- ]+/g, '').trim().replace(/\s+/g, '-').slice(-80) || 'file';
  const path = newId() + '/' + safe;
  const r = await sb.storage.from('files').upload(path, file, {contentType: file.type || 'application/octet-stream'});
  if(r.error) throw r.error;
  return {path, name: raw, size: file.size, type: file.type || ''};
}
async function uploadAll(files){ const out = []; for(const f of files || []) if(f) out.push(await uploadFile(f, f.__name)); return out; }
const urlCache = new Map();
async function signed(paths, bucket = 'files'){
  const need = uniq(paths).filter(p => !urlCache.has(bucket + ':' + p));
  if(need.length){
    const {data} = await sb.storage.from(bucket).createSignedUrls(need, 3600);
    (data || []).forEach(r => { if(r.signedUrl) urlCache.set(bucket + ':' + r.path, r.signedUrl); });
    setTimeout(() => need.forEach(p => urlCache.delete(bucket + ':' + p)), 50 * 60 * 1000);
  }
}
// show private files: <img data-f> and <a data-f> get short-lived links
async function hydrate(root){
  root = root || document;
  const els = [...root.querySelectorAll('[data-f]')];
  const byBucket = {};
  els.forEach(el => { const b = el.dataset.b || 'files'; (byBucket[b] = byBucket[b] || []).push(el.dataset.f); });
  for(const b of Object.keys(byBucket)) await signed(byBucket[b], b).catch(() => {});
  els.forEach(el => { const u = urlCache.get((el.dataset.b || 'files') + ':' + el.dataset.f); if(!u) return; if(el.tagName === 'A'){ if(el.href !== u) el.href = u; } else if(el.src !== u) el.src = u; });
}
function attHtml(files){
  if(!files || !files.length) return '';
  return '<div class="att">' + files.map(f => {
    if(/^image\//.test(f.type)) return '<a class="img" data-f="' + esc(f.path) + '" target="_blank" rel="noopener" title="' + esc(f.name) + '"><img data-f="' + esc(f.path) + '" alt="' + esc(f.name) + '"></a>';
    if(/^audio\//.test(f.type)) return '<span class="f">' + icon('mic') + '<audio controls preload="none" data-f="' + esc(f.path) + '"></audio></span>';
    return '<a data-f="' + esc(f.path) + '" target="_blank" rel="noopener">' + icon('file') + esc(f.name) + (f.size ? ' <span style="color:var(--mut)">' + sizeText(f.size) + '</span>' : '') + '</a>';
  }).join('') + '</div>';
}
function linksHtml(links){
  const ls = (links || []).filter(l => l && l.url);
  if(!ls.length) return '';
  return '<div class="att">' + ls.map(l => '<a href="' + esc(safeUrl(l.url)) + '" target="_blank" rel="noopener">' + icon('link') + esc(l.label || hostOf(l.url)) + '</a>').join('') + '</div>';
}
const safeUrl = u => /^https?:\/\//i.test(u) ? u : 'https://' + u;
const hostOf = u => { try { return new URL(safeUrl(u)).hostname.replace(/^www\./, ''); } catch(e){ return u; } };
function parseLinks(text){
  return String(text || '').split('\n').map(s => s.trim()).filter(Boolean).map(line => {
    const m = line.match(/^(.*?)\s*(https?:\/\/\S+|\S+\.\S+\/?\S*)$/i);
    return m ? {label: m[1].replace(/[-:|]\s*$/, '').trim(), url: m[2]} : {label:'', url: line};
  });
}
const linksText = links => (links || []).map(l => (l.label ? l.label + ' ' : '') + l.url).join('\n');

// WhatsApp share (opens WhatsApp with the message ready; it does not send anything by itself)
function waLink(text, toEmail){
  const m = member(toEmail);
  const phone = m && m.phone ? m.phone.replace(/[^\d]/g, '').replace(/^0/, '') : '';
  return 'https://wa.me/' + (phone || '') + '?text=' + encodeURIComponent(text);
}
const appLink = ref => location.origin + location.pathname + '#open/' + ref;
