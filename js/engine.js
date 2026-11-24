/* The Raw Portal: one shared workflow engine for every module.
   Every action answers: what needs to happen, who is responsible, when it is due,
   who needs to know, what happens next, and whether the whole process is complete. */
'use strict';

const STATUS = [['awaiting','Awaiting action'], ['progress','In progress'], ['approval','Awaiting approval'], ['payment','Awaiting payment'], ['external','Awaiting external response'], ['done','Completed']];
const STATUS_LABEL = Object.fromEntries(STATUS);
const PRIORITY = [['low','Low'], ['normal','Normal'], ['high','High'], ['critical','Critical']];
const REMINDER_SETS = [['standard','72 h, 24 h, 3 h before and at the deadline', [72,24,3,0]], ['light','24 h before and at the deadline', [24,0]], ['long','30 days, 7 days, 3 days, 1 day before and at the deadline', [720,168,72,24,0]], ['none','No reminders', []]];
const reminderKey = arr => { const s = JSON.stringify(arr || [72,24,3,0]); const f = REMINDER_SETS.find(r => JSON.stringify(r[2]) === s); return f ? f[0] : 'standard'; };
const MODULE_OF_TASK = [['general','General'], ['finance','Finance'], ['marketing','Marketing'], ['customers','Customers'], ['suppliers','Suppliers and stock'], ['bizdev','Partnerships'], ['legal','Legal and compliance']];
const modName = k => (MODULE_OF_TASK.find(x => x[0] === k) || [0, 'General'])[1];

const isDone = t => t.status === 'done';
const isOverdue = t => !isDone(t) && !t.blocked && t.due && msLeft(t.due) < 0;
const dueSoon = (t, hours) => !isDone(t) && t.due && msLeft(t.due) >= 0 && msLeft(t.due) < hours * H;
function statusBadge(t){
  if(isDone(t)) return '<span class="b b-ok">Completed</span>';
  if(t.blocked) return '<span class="b">Waiting for an earlier step</span>';
  if(isOverdue(t)) return '<span class="b b-red">Overdue</span>';
  const c = {approval:'b-amber', payment:'b-amber', external:'b-teal', progress:'b-olive'}[t.status] || '';
  return '<span class="b ' + c + '">' + esc(STATUS_LABEL[t.status] || 'Awaiting action') + '</span>';
}
const prioBadge = p => p === 'critical' ? '<span class="b b-red">Critical</span>' : p === 'high' ? '<span class="b b-amber">High</span>' : '';
function dueBadge(t){
  if(!t.due || isDone(t)) return '';
  const ms = msLeft(t.due);
  const cls = ms < 0 ? 'b-red' : ms < DAY ? 'b-amber' : '';
  return '<span class="b ' + cls + '">' + icon('clock') + esc(relDue(t.due)) + '</span>';
}
const tasks = () => list('tasks').filter(inBrand);
const openTasks = () => tasks().filter(t => !isDone(t));
const taskSort = (a, b) => (isDone(a) - isDone(b)) || (!!a.blocked - !!b.blocked) || ((a.due || '9') < (b.due || '9') ? -1 : (a.due || '9') > (b.due || '9') ? 1 : 0);

/* ---------- tasks ---------- */
function createTask(data, opt){
  opt = opt || {};
  const id = opt.id || newId();
  const t = Object.assign({
    title:'', desc:'', owner: me.email, collab:[], due:'', priority:'normal', status:'awaiting', module:'general', brand:'',
    reminders:[72,24,3,0], escalate:false, recur:'none', dependsOn:[], files:[], links:[], waitingOn:'', ref:'', stage:''
  }, data, stamp());
  if(t.priority === 'critical') t.escalate = true;
  t.blocked = (t.dependsOn || []).some(d => { const x = get('tasks', d); return x && !isDone(x); });
  const write = opt.ifNew ? putNew('tasks', id, t) : put('tasks', id, t);
  write.catch(() => {});
  if(!opt.quiet){
    if(t.owner !== me.email) notify(t.owner, t.blocked ? 'New action (starts after an earlier step)' : 'New action for you', t.title + (t.due ? ', due ' + fmtDT(t.due) : ''), 'tasks/' + id, 'assigned');
    (t.collab || []).forEach(c => notify(c, 'Added as collaborator', t.title, 'tasks/' + id, 'assigned'));
    logAct('tasks/' + id, 'created this' + (t.owner !== me.email ? ' and gave it to ' + nameOf(t.owner) : ''));
  }
  return id;
}

// What happens when someone ticks an action
function completeTask(id){
  const t = get('tasks', id); if(!t) return;
  if(isDone(t)) return reopenTask(id);
  if(t.blocked) return toast('This starts after an earlier step is finished.');
  if(t.ref && t.stage){ const [col, rid] = t.ref.split('/'); return openStageForm(col, rid, t.stage); }
  if(t.kind === 'next' || t.kind === 'renew'){ markDone(id); const [col, rid] = t.ref.split('/'); toast('Done. Now set the next step.'); return FORMS[col] && FORMS[col](rid, {focusNext:true}); }
  if(t.kind === 'recurring') return completeRecurring(t);
  markDone(id);
}
function markDone(id, note){
  const t = get('tasks', id); if(!t || isDone(t)) return;
  patch('tasks', id, {status:'done', doneAt:new Date().toISOString(), doneBy: me.email, doneNote: note || ''});
  logAct('tasks/' + id, 'completed this' + (note ? ': ' + note : ''));
  if(t.by && t.by !== me.email && !t.stage) notify(t.by, 'Done: ' + t.title, nameOf(me.email) + ' completed it.', 'tasks/' + id, 'done');
  // the next person's action becomes active
  list('tasks').filter(x => (x.dependsOn || []).includes(id) && x.blocked).forEach(x => {
    const still = (x.dependsOn || []).some(d => d !== id && get('tasks', d) && !isDone(get('tasks', d)));
    if(!still){ patch('tasks', x.id, {blocked:false}); notify(x.owner, 'You can start now', x.title, 'tasks/' + x.id, 'handover'); }
  });
  if(t.recur && t.recur !== 'none' && t.due){
    const nd = new Date(t.due), base = ymd(nd), nxt = parseD(nextDate(base, t.recur));
    nxt.setHours(nd.getHours(), nd.getMinutes(), 0, 0);
    const copy = Object.assign({}, t); ['id','doneAt','doneBy','doneNote','status','blocked','at','by'].forEach(k => delete copy[k]);
    createTask(Object.assign(copy, {due: nxt.toISOString(), status:'awaiting', dependsOn:[]}), {quiet:true});
    toast('Done. The next one is due ' + fmtDT(nxt.toISOString()) + '.');
  } else toast('Done.');
}
function reopenTask(id){
  const t = get('tasks', id); if(!t) return;
  if(t.stage) return toast('This step is part of a workflow and cannot be reopened here.');
  patch('tasks', id, {status:'awaiting', doneAt:'', doneBy:''});
  logAct('tasks/' + id, 'reopened this');
}

/* ---------- workflows ---------- */
const plus = days => isoPlus(new Date().toISOString(), days);
const before = (iso, days) => iso ? isoPlus(iso, -days) : '';
const WF = {
  payreqs: {
    module:'finance', name:'Payment request', title: r => r.title,
    created: r => notifyMany([roleEmail('charlie'), roleEmail('dale'), roleEmail('rhiannon')], 'New payment request', r.title + ': ' + money(r.amount, r.currency) + (r.deadline ? ', due ' + fmtD(r.deadline) : ''), null, 'payreq'),
    stages: r => [
      {key:'assign', label:'Accept responsibility and choose the funding account', owner: roleEmail('rhiannon'), collab:[roleEmail('dale')], status:'payment', due: () => r.deadline ? before(dayEnd(r.deadline), 2) : plus(1), needs:['account']},
      {key:'pay', label:'Make the payment and upload proof', owner: '@assignee', status:'payment', due: () => r.deadline ? dayEnd(r.deadline) : plus(3), needs:['paid','proof'], notify:[roleEmail('charlie'), roleEmail('rhiannon')], critical: r.priority === 'critical'},
      {key:'followup', label:'Operational follow-up (send proof, confirm next step)', owner: roleEmail('charlie'), status:'progress', due: () => plus(2), needs:['note'], optional:true},
      {key:'accounts', label:'Capture or reconcile the payment in Zoho', owner: roleEmail('rhiannon'), status:'progress', due: () => plus(5), needs:['zoho']}
    ],
    closed: r => notifyMany([r.by, roleEmail('stacey')], 'Payment request closed', r.title + ': paid, followed up and in Zoho.', null, 'done')
  },
  campaigns: {
    module:'marketing', name:'Campaign', title: r => r.name,
    stages: r => [
      {key:'submit', label:'Submit the content for approval', owner: r.submitter || r.by, status:'progress', due: () => r.approveBy ? before(r.approveBy, 1) : plus(2), needs:['content']},
      {key:'approve', label:'Approve or request revisions', owner: roleEmail('stacey'), status:'approval', due: () => r.approveBy || plus(2), needs:['decision']},
      {key:'schedule', label:'Schedule the content', owner: r.scheduler || roleEmail('charlie'), status:'progress', due: () => r.scheduleBy || plus(3), needs:['schedule'], escalate:true},
      {key:'publish', label:'Confirm it is published', owner: roleEmail('charlie'), status:'progress', due: () => r.publishAt || plus(4), needs:['publish'], escalate:true}
    ],
    closed: r => notifyMany([r.submitter, roleEmail('stacey')], 'Published', r.name + ' is live.', null, 'done')
  },
  recons: {
    module:'customers', name:'Monthly reconciliation', title: r => r.title,
    stages: r => {
      const c = get('customers', r.customer) || {}, mgr = c.manager || roleEmail('charlie');
      return [
        {key:'contact', label:'Ask the customer for sales and stock figures', owner: mgr, status:'external', due: () => before(dayEnd(r.date), 2), needs:['note']},
        {key:'reconcile', label:'Complete the reconciliation using Zoho records', owner: mgr, status:'progress', due: () => dayEnd(r.date), needs:['amount']},
        {key:'invoice', label:'Issue the invoice or payment request', owner: roleEmail('rhiannon'), status:'progress', due: () => plus(2), needs:['invoice']},
        {key:'collect', label:'Confirm the customer has paid', owner: roleEmail('rhiannon'), status:'payment', due: () => r.payDue ? dayEnd(r.payDue) : plus(14), needs:['received']},
        {key:'zoho', label:'Confirm receipt is reconciled in Zoho', owner: roleEmail('rhiannon'), status:'progress', due: () => plus(3), needs:['zoho']}
      ];
    },
    closed: r => notify(roleEmail('charlie'), 'Reconciliation closed', r.title + ' is complete.', null, 'done')
  },
  suppliers: {
    module:'suppliers', name:'Supplier and stock follow-up', title: r => r.title,
    stages: r => {
      const pay = /deposit|balance|payment/i.test(r.type || '');
      const stock = /stock|restock|adjust/i.test(r.type || '');
      return [
        {key:'action', label: pay ? 'Make the payment' : stock ? 'Do the stock action' : 'Chase and get confirmation', owner: r.owner || me.email, status: pay ? 'payment' : stock ? 'awaiting' : 'external', due: () => r.due || plus(3), needs: pay ? ['paid','proof'] : ['note']},
        {key:'zoho', label:'Confirm Zoho is updated', owner: roleEmail('rhiannon'), status:'progress', due: () => plus(3), needs:['zoho']}
      ];
    },
    closed: r => r.by && notify(r.by, 'Supplier follow-up closed', r.title, null, 'done')
  }
};
const recTitle = (col, r) => WF[col] ? WF[col].title(r) : (r.title || r.name || r.label || 'Item');

function startWorkflow(col, id, rec, opt){
  opt = opt || {};
  const def = WF[col];
  rec.stages = def.stages(rec).map((s, i) => ({uid: 's' + i, key:s.key, label:s.label, owner:s.owner, collab:s.collab || [], tstatus:s.status, needs:s.needs, optional:!!s.optional, escalate:!!s.escalate, critical:!!s.critical, notify:s.notify || [], status:'pending'}));
  rec.status = 'open';
  activateStage(col, id, rec, 0, opt);
  if(def.created && !opt.quiet) def.created(rec);
}
function activateStage(col, id, rec, idx, opt){
  opt = opt || {};
  const def = WF[col], s = rec.stages[idx];
  const tmpl = def.stages(rec).find(x => x.key === s.key) || {};
  if(s.owner === '@assignee') s.owner = rec.assignee || me.email;
  if(!s.owner) s.owner = me.email;
  s.status = 'active';
  s.due = typeof tmpl.due === 'function' ? tmpl.due() : '';
  const taskId = col + '-' + id + '-' + s.uid;
  s.task = taskId;
  rec.stage = s.key; rec.stageOwner = s.owner;
  (opt.ifNew ? putNew(col, id, rec) : put(col, id, rec)).catch(() => {});
  createTask({title: s.label + ': ' + recTitle(col, rec), owner: s.owner, collab: s.collab, due: s.due, status: s.tstatus, module: def.module, brand: rec.brand || '',
    priority: s.critical || rec.priority === 'critical' ? 'critical' : (rec.priority || 'normal'), escalate: s.escalate, ref: col + '/' + id, stage: s.uid},
    {id: taskId, quiet: true, ifNew: opt.ifNew});
  if(!opt.quiet){
    notify(s.owner, 'Your turn: ' + s.label, recTitle(col, rec) + (s.due ? ', due ' + fmtDT(s.due) : ''), col + '/' + id, 'handover');
    (s.collab || []).forEach(c => notify(c, 'Needs one of you: ' + s.label, recTitle(col, rec), col + '/' + id, 'handover'));
  }
}
// Called when someone finishes a step (with what they recorded)
async function completeStage(col, id, uid, out){
  const rec = get(col, id); if(!rec) throw new Error('This record no longer exists.');
  const def = WF[col];
  let idx = rec.stages.findIndex(s => s.uid === uid);
  const s = rec.stages[idx];
  if(!s || s.status !== 'active') throw new Error('This step has already been completed.');
  // stop two people paying the same invoice
  if(col === 'payreqs' && s.key === 'assign'){
    const ok = await claim('payreqs', id, 'assignee', me.email);
    if(!ok){ const cur = get('payreqs', id); throw new Error(nameOf(cur && cur.assignee) + ' has already taken this payment. Nothing was changed.'); }
    Object.assign(rec, get('payreqs', id));
  }
  s.status = out.skip ? 'skipped' : 'done'; s.doneBy = me.email; s.doneAt = new Date().toISOString(); s.note = out.note || '';
  if(out.files && out.files.length) s.files = out.files;
  // remember what was recorded on the record itself
  if(out.account) rec.account = out.account;
  if(out.paidAmount != null){ rec.paidAmount = out.paidAmount; rec.paidOn = out.paidOn; rec.proof = out.files || []; }
  if(out.zoho) { rec.zoho = true; rec.zohoRef = out.zohoRef || ''; }
  if(out.amount != null){ rec.amount = out.amount; rec.currency = out.currency || rec.currency; }
  if(out.invoice){ rec.invoice = out.invoice; rec.payDue = out.payDue || rec.payDue; }
  if(out.received != null){ rec.received = out.received; rec.receivedOn = out.paidOn; }
  if(out.scheduledFor){ rec.scheduledFor = out.scheduledFor; }
  if(out.liveUrl){ rec.liveUrl = out.liveUrl; }
  if(out.content != null){ rec.content = out.content; }
  if(out.links) rec.links = out.links;
  if(out.decision){ rec.lastDecision = out.decision; rec.feedback = out.note || ''; }
  markStageTask(s.task, out.skip ? 'Not needed' : out.note);
  logAct(col + '/' + id, (out.skip ? 'marked as not needed: ' : 'completed: ') + s.label + (out.note ? ' (' + out.note + ')' : ''));

  // money records follow the workflow automatically
  if(out.paidAmount != null && (col === 'payreqs' || col === 'suppliers')) put('ledger', newId(), Object.assign({dir:'out', amount: out.paidAmount, currency: rec.currency || cfg().currencies[0], date: out.paidOn || TODAY(), title: recTitle(col, rec), cat: rec.cat || (col === 'suppliers' ? 'Stock and product' : 'Other'), brand: rec.brand || '', account: rec.account || '', ref: col + '/' + id, files: out.files || []}, stamp())).catch(() => {});
  if(out.received != null && col === 'recons') put('ledger', newId(), Object.assign({dir:'in', amount: out.received, currency: rec.currency || cfg().currencies[0], date: out.paidOn || TODAY(), title: recTitle(col, rec), cat:'Sales', brand: rec.brand || '', account: out.account || '', ref: col + '/' + id, files: out.files || []}, stamp())).catch(() => {});

  // a revision request sends it back to whoever submitted it, then back for approval
  if(col === 'campaigns' && s.key === 'approve' && out.decision === 'revise'){
    const n = rec.stages.length;
    rec.stages.splice(idx + 1, 0,
      {uid:'s' + n, key:'submit', label:'Make the requested revisions and resubmit', owner: rec.submitter || rec.by, collab:[], tstatus:'progress', needs:['content'], notify:[], status:'pending'},
      {uid:'s' + (n + 1), key:'approve', label:'Approve or request revisions', owner: roleEmail('stacey'), collab:[], tstatus:'approval', needs:['decision'], notify:[], status:'pending'});
    rec.revisions = (rec.revisions || 0) + 1;
  }
  (s.notify || []).forEach(e => notify(e, s.label + ' done', recTitle(col, rec) + ' (by ' + nameOf(me.email) + ')', col + '/' + id, 'progress'));
  const next = rec.stages.findIndex((x, i) => i > idx && x.status === 'pending');
  if(next > -1) activateStage(col, id, rec, next);
  else {
    rec.status = 'closed'; rec.closedAt = new Date().toISOString(); rec.stage = 'closed'; rec.stageOwner = '';
    put(col, id, rec).catch(() => {});
    logAct(col + '/' + id, 'closed this: every step is complete');
    if(def.closed) def.closed(rec);
  }
}
function markStageTask(taskId, note){
  const t = get('tasks', taskId); if(!t || isDone(t)) return;
  patch('tasks', taskId, {status:'done', doneAt:new Date().toISOString(), doneBy: me.email, doneNote: note || ''});
}
function cancelWorkflow(col, id, reason){
  const rec = get(col, id); if(!rec) return;
  (rec.stages || []).forEach(s => { if(s.task && s.status === 'active') patch('tasks', s.task, {status:'done', doneAt:new Date().toISOString(), doneBy: me.email, doneNote:'Cancelled'}); if(s.status !== 'done') s.status = 'skipped'; });
  rec.status = 'cancelled'; rec.stage = 'cancelled'; rec.cancelReason = reason || '';
  put(col, id, rec).catch(() => {});
  logAct(col + '/' + id, 'cancelled this' + (reason ? ': ' + reason : ''));
}
// change who is responsible for the current step
function reassignStage(col, id, email){
  const rec = get(col, id); if(!rec) return;
  const s = (rec.stages || []).find(x => x.status === 'active'); if(!s) return;
  s.owner = email; rec.stageOwner = email;
  put(col, id, rec).catch(() => {});
  if(s.task) patch('tasks', s.task, {owner: email});
  notify(email, 'Handed to you: ' + s.label, recTitle(col, rec), col + '/' + id, 'handover');
  logAct(col + '/' + id, 'handed "' + s.label + '" to ' + nameOf(email));
}
const activeStage = r => (r.stages || []).find(s => s.status === 'active');
function stagesHtml(r){
  if(!r.stages) return '';
  return '<ol class="steps">' + r.stages.map(s => '<li class="' + s.status + '">' + esc(s.label) +
    '<div class="meta">' + avatar(s.owner, 1) + esc(nameOf(s.owner)) + (s.status === 'done' ? ' · done ' + esc(fmtDT(s.doneAt, 1)) + (s.doneBy && s.doneBy !== s.owner ? ' by ' + esc(nameOf(s.doneBy)) : '') : s.status === 'active' && s.due ? ' · due ' + esc(fmtDT(s.due, 1)) : s.status === 'skipped' ? ' · not needed' : '') + '</div>' +
    (s.note ? '<div class="meta pre">' + esc(s.note) + '</div>' : '') + attHtml(s.files) + '</li>').join('') + '</ol>';
}
function miniSteps(r){
  if(!r.stages) return '';
  return '<div class="mini">' + r.stages.map(s => '<i class="' + (s.status === 'done' || s.status === 'skipped' ? 'd' : s.status === 'active' ? 'a' : '') + '"></i>').join('') + '</div>';
}
function wfStatus(r){
  if(r.status === 'closed') return '<span class="b b-ok">Closed</span>';
  if(r.status === 'cancelled') return '<span class="b">Cancelled</span>';
  const s = activeStage(r); if(!s) return '';
  const t = get('tasks', s.task);
  const late = t && isOverdue(t);
  return '<span class="b ' + (late ? 'b-red' : s.tstatus === 'approval' || s.tstatus === 'payment' ? 'b-amber' : s.tstatus === 'external' ? 'b-teal' : '') + '">' + esc(late ? 'Overdue: ' : '') + esc(shortStage(s)) + '</span>';
}
const shortStage = s => ({assign:'Needs an owner', pay:'To pay', followup:'Follow-up', accounts:'Zoho capture', submit:'Draft', approve:'Awaiting approval', schedule:'To schedule', publish:'Scheduled', contact:'Contact customer', reconcile:'Reconcile', invoice:'Invoice', collect:'Awaiting payment', zoho:'Zoho check', action:'In progress'})[s.key] || s.label;

/* ---------- linked "next action" tasks for partnerships and legal ---------- */
function syncNext(col, id){
  const r = get(col, id); if(!r) return;
  const tid = col + '-' + id + '-next', cur = get('tasks', tid);
  const closed = r.status === 'closed' || r.stage === 'Active partnership' && !r.nextAction || r.stage === 'Closed';
  if(r.nextAction && r.nextDate && r.owner && !closed){
    const due = dayEnd(r.nextDate, 10);
    const same = cur && !isDone(cur) && cur.title === r.nextAction + ' (' + recTitle(col, r) + ')' && cur.due === due && cur.owner === r.owner;
    if(!same){
      const t = Object.assign({}, cur || {}, {title: r.nextAction + ' (' + recTitle(col, r) + ')', owner: r.owner, due, status: col === 'opps' ? 'external' : 'awaiting', module: col === 'opps' ? 'bizdev' : 'legal', brand: r.brand || '',
        reminders:[24,0], kind:'next', ref: col + '/' + id, priority: r.priority || 'normal', blocked:false, doneAt:'', doneBy:''}, cur ? {} : stamp());
      put('tasks', tid, t).catch(() => {});
      if(r.owner !== me.email) notify(r.owner, 'Next action for you', t.title + ', by ' + fmtD(r.nextDate), 'tasks/' + tid, 'assigned');
    }
  } else if(cur && !isDone(cur)) patch('tasks', tid, {status:'done', doneAt:new Date().toISOString(), doneBy: me.email, doneNote:'No next action set'});
  if(col === 'legal'){
    const rid = col + '-' + id + '-renew', rc = get('tasks', rid);
    if(r.renewal && r.owner && r.status !== 'closed'){
      const due = dayEnd(r.renewal, 10);
      if(!rc || rc.due !== due || isDone(rc) && rc.due !== due) put('tasks', rid, Object.assign({}, rc || stamp(), {title:'Renewal due: ' + r.title, owner: r.owner, due, status:'awaiting', module:'legal', brand: r.brand || '', reminders:[720,168,72,24,0], escalate:true, kind:'renew', ref: col + '/' + id, priority:'high', doneAt:'', doneBy:''})).catch(() => {});
    } else if(rc && !isDone(rc)) patch('tasks', rid, {status:'done', doneAt:new Date().toISOString(), doneBy: me.email, doneNote:'No renewal date'});
  }
}

/* ---------- things that repeat: customer reconciliations and recurring payments ---------- */
function reconDate(c, monthStr){
  const d = parseD(monthStr + '-01'), last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return monthStr + '-' + pad(Math.min(Math.max(1, Number(c.reconDay) || 1), last));
}
function generateRecurring(){
  if(!me || !loaded) return;
  const lead = Number(cfg().reconLead) || 5;
  if(canEdit('customers')){
    const months = [ym(new Date()), ym(parseD(addMonths(TODAY(), 1)))];
    list('customers').forEach(c => {
      if(c.active === false || !c.reconDay) return;
      months.forEach(mo => {
        const date = reconDate(c, mo);
        if(daysTo(date) > lead) return;
        if(c.since && date < c.since) return;
        const id = c.id + '-' + mo;
        if(get('recons', id)) return;
        const rec = Object.assign({customer: c.id, title: (c.name || 'Customer') + ' · ' + ymLabel(mo), month: mo, date, brand: c.brand || '', currency: c.currency || cfg().currencies[0], terms: Number(c.terms) || 14}, stamp());
        startWorkflow('recons', id, rec, {ifNew:true, quiet:true});
        notify(rec.stages[0].owner, 'Reconciliation coming up', rec.title + ' on ' + fmtD(date), 'recons/' + id, 'handover');
      });
    });
  }
  if(canEdit('finance')){
    list('recurring').forEach(r => {
      if(r.active === false || !r.next || daysTo(r.next) > 7) return;
      const tid = 'recurring-' + r.id + '-' + r.next;
      if(get('tasks', tid)) return;
      createTask({title:'Pay ' + r.title + ' (' + money(r.amount, r.currency) + ')', owner: r.owner || roleEmail('rhiannon'), due: dayEnd(r.next, 12), status:'payment', module:'finance', brand: r.brand || '', kind:'recurring', ref:'recurring/' + r.id, reminders:[72,24,0], forDate: r.next}, {id: tid, ifNew:true, quiet:true});
    });
  }
}
function completeRecurring(t){
  const r = get('recurring', (t.ref || '').split('/')[1]);
  markDone(t.id);
  if(!r) return;
  put('ledger', newId(), Object.assign({dir:'out', amount: r.amount, currency: r.currency, date: TODAY(), title: r.title, cat: r.cat || 'Other', brand: r.brand || '', account: r.account || '', ref:'recurring/' + r.id}, stamp())).catch(() => {});
  if(t.forDate === r.next) patch('recurring', r.id, {next: nextDate(r.next, r.every || 'monthly'), lastPaid: TODAY()});
  toast('Paid and recorded. Next one is ' + fmtD(nextDate(r.next, r.every || 'monthly')) + '.');
}
