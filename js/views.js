/* The Raw Portal: screens. Each function returns HTML for the main area. */
'use strict';

const title = (t, sub, acts) => '<div class="ptitle"><div><h1>' + t + '</h1>' + (sub ? '<div class="sub">' + sub + '</div>' : '') + '</div>' + (acts ? '<div class="acts">' + acts + '</div>' : '') + '</div>';
const sec = (t, inner, btn) => '<section><div class="sechd"><h2>' + t + '</h2>' + (btn || '') + '</div>' + inner + '</section>';
const empty = t => '<div class="empty">' + t + '</div>';
const chips = (act, cur, opts) => '<div class="chips">' + opts.map(([v, l]) => '<button class="chip" data-act="' + act + '" data-id="' + esc(v) + '" aria-pressed="' + (cur === v) + '">' + esc(l) + '</button>').join('') + '</div>';
const addBtn = (act, label, id) => '<button class="btn" data-act="' + act + '"' + (id ? ' data-id="' + esc(id) + '"' : '') + '>' + icon('plus') + esc(label || 'Add') + '</button>';
const tile = (n, l, cls, act, id) => '<button class="tile ' + (cls || '') + '"' + (act ? ' data-act="' + act + '"' + (id ? ' data-id="' + esc(id) + '"' : '') : ' disabled') + '><div class="n">' + n + '</div><div class="l">' + esc(l) + '</div></button>';
const listBox = rows => rows.length ? '<div class="list">' + rows.join('') + '</div>' : '';
const openAttr = (col, id) => ' data-act="open" data-id="' + esc(col + '/' + id) + '"';

/* ---------- a row for one action ---------- */
function taskRow(t, o){
  o = o || {};
  const wf = !!t.stage, done = isDone(t);
  return '<div class="item click' + (done ? ' done' : '') + '"' + openAttr('tasks', t.id) + '>' +
    '<button class="tick' + (wf && !done ? ' wf' : '') + '" role="checkbox" aria-checked="' + done + '" aria-label="' + (done ? 'Completed' : wf ? 'Complete this step' : 'Mark done') + '" data-act="tick" data-id="' + esc(t.id) + '"' + (t.blocked ? ' disabled' : '') + '>' + icon('check') + '</button>' +
    '<div class="main"><div class="t">' + esc(t.title) + '</div><div class="meta">' +
      (done ? '<span>Done ' + esc(fmtDT(t.doneAt, 1)) + '</span>' : dueBadge(t) + (t.status !== 'awaiting' || t.blocked || isOverdue(t) ? statusBadge(t) : '') + prioBadge(t.priority)) +
      (o.owner !== false && (t.owner !== me.email || o.owner) ? '<span>' + avatar(t.owner, 1) + ' ' + esc(firstName(t.owner)) + '</span>' : '') +
      (t.waitingOn ? '<span>Waiting on ' + esc(t.waitingOn) + '</span>' : '') +
      brandTag(t.brand) + ((t.comments || 0) ? '' : '') +
    '</div></div>' +
    (t.due && !done ? '<div class="side">' + esc(fmtDT(t.due, 1)) + '</div>' : '') +
  '</div>';
}
function recRow(col, r, main, side, extra){
  return '<div class="item click"' + openAttr(col, r.id) + '><div class="main"><div class="t">' + main + '</div><div class="meta">' + (extra || '') + '</div>' + miniSteps(r) + '</div>' + (side ? '<div class="side">' + side + '</div>' : '') + '</div>';
}

/* ---------- shared numbers ---------- */
const campaignsAtRisk = () => list('campaigns').filter(inBrand).filter(c => c.status === 'open' && c.publishAt && msLeft(c.publishAt) < 3 * DAY && ['submit','approve','schedule'].includes(c.stage));
const reconStats = () => {
  const rs = list('recons').filter(inBrand), open = rs.filter(r => r.status === 'open');
  const collect = open.filter(r => r.stage === 'collect');
  const stageTask = r => get('tasks', (activeStage(r) || {}).task) || {};
  return {
    due: open.filter(r => ['contact','reconcile'].includes(r.stage) && daysTo(r.date) >= 0 && daysTo(r.date) <= 7),
    overdue: open.filter(r => ['contact','reconcile','invoice'].includes(r.stage) && isOverdue(stageTask(r))),
    awaiting: collect,
    latePay: collect.filter(r => isOverdue(stageTask(r))),
    done: rs.filter(r => r.status === 'closed' && (r.closedAt || '').slice(0, 7) === ym(new Date()))
  };
};
function periodRange(p, month){
  const now = new Date();
  if(p === 'week'){ const s = new Date(now); s.setDate(now.getDate() - ((now.getDay() + 6) % 7)); return [ymd(s), ymd(new Date(s.getTime() + 6 * DAY)), 'This week']; }
  if(p === 'last7') return [ymd(new Date(now.getTime() - 6 * DAY)), ymd(now), 'Last 7 days'];
  const m = month || ym(now), last = new Date(parseD(m + '-01').getFullYear(), parseD(m + '-01').getMonth() + 1, 0);
  return [m + '-01', ymd(last), ymLabel(m)];
}
const ledgerIn = (a, b) => list('ledger').filter(inBrand).filter(l => l.date >= a && l.date <= b);
function moneyTiles(a, b){
  const rows = ledgerIn(a, b), inn = sumBy(rows.filter(r => r.dir === 'in')), out = sumBy(rows.filter(r => r.dir === 'out'));
  const curs = uniq([...cfg().currencies, ...Object.keys(inn), ...Object.keys(out)]);
  return '<div class="money">' + curs.map(c => tile(money(inn[c] || 0, c), 'In · ' + c, 'okc') + tile(money(out[c] || 0, c), 'Out · ' + c, 'red')).join('') + '</div>';
}
const openPayreqs = () => list('payreqs').filter(inBrand).filter(p => p.status === 'open');
function commitments(days){
  const lim = ymd(new Date(Date.now() + days * DAY)), out = [];
  openPayreqs().forEach(p => { if(!p.paidAmount) out.push({date: p.deadline || '', title: p.title, amount: p.amount, currency: p.currency, ref: 'payreqs/' + p.id, kind:'Payment request'}); });
  list('recurring').filter(inBrand).forEach(r => { if(r.active !== false && r.next && r.next <= lim) out.push({date: r.next, title: r.title, amount: r.amount, currency: r.currency, ref: 'recurring/' + r.id, kind:'Recurring'}); });
  list('ledger').filter(inBrand).forEach(l => { if(l.dir === 'due-out' && l.date <= lim) out.push({date: l.date, title: l.title, amount: l.amount, currency: l.currency, ref: 'ledger/' + l.id, kind:'Commitment'}); });
  list('suppliers').filter(inBrand).forEach(s => { if(s.status === 'open' && s.amount && /deposit|balance|payment/i.test(s.type) && s.stage === 'action') out.push({date: (s.due || '').slice(0, 10), title: s.title, amount: s.amount, currency: s.currency, ref: 'suppliers/' + s.id, kind:'Supplier'}); });
  return out.sort(by('date'));
}
function receivables(){
  const out = [];
  list('recons').filter(inBrand).forEach(r => { if(r.status === 'open' && r.stage === 'collect') out.push({date: r.payDue || '', title: r.title, amount: r.amount, currency: r.currency, ref: 'recons/' + r.id, kind:'Customer'}); });
  list('ledger').filter(inBrand).forEach(l => { if(l.dir === 'due-in') out.push({date: l.date, title: l.title, amount: l.amount, currency: l.currency, ref: 'ledger/' + l.id, kind:'Receivable'}); });
  return out.sort(by('date'));
}
const moneyRow = x => '<div class="item click" data-act="open" data-id="' + esc(x.ref) + '"><div class="main"><div class="t">' + esc(x.title) + '</div><div class="meta"><span class="b">' + esc(x.kind) + '</span>' + (x.date ? '<span' + (x.date < TODAY() ? ' style="color:var(--redink);font-weight:700"' : '') + '>' + esc(fmtD(x.date)) + '</span>' : '') + '</div></div><div class="side"><span class="amt">' + money(x.amount, x.currency) + '</span></div></div>';

/* ---------- screens ---------- */
const R = {};

R.home = () => {
  const c = cfg(), mine = openTasks().filter(t => t.owner === me.email && !t.blocked);
  const overdue = mine.filter(isOverdue), approvals = mine.filter(t => t.status === 'approval'), payments = mine.filter(t => t.status === 'payment');
  const chasing = openTasks().filter(t => t.owner !== me.email && (t.by === me.email || t.status === 'external' && (t.collab || []).includes(me.email)));
  const urgent = mine.filter(t => isOverdue(t) || dueSoon(t, 48) || ['approval','payment'].includes(t.status) || t.priority === 'critical').sort(taskSort);
  const hour = new Date().getHours(), greet = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';
  let h = title(greet + ', <em>' + esc(firstName(me.email)) + '</em>', esc(new Date().toLocaleDateString('en-GB', {weekday:'long', day:'numeric', month:'long'})) + (ui.brand !== 'all' ? ' · ' + esc(ui.brand) + ' only' : ''));
  if(c.notice || isAdmin()) h += c.notice ? '<div class="notice"><div class="split"><b>Notice</b>' + (isAdmin() ? '<button class="link" data-act="editNotice">Edit</button>' : '') + '</div><div class="pre">' + esc(c.notice) + '</div></div>' : '';
  h += '<div class="tiles">' + tile(mine.length, 'My open actions', 'hero', 'go', 'mine') + tile(overdue.length, 'Overdue', overdue.length ? 'red' : '', 'go', 'mine') +
    tile(approvals.length + payments.length, 'Approvals and payments', approvals.length + payments.length ? 'amber' : '', 'go', 'mine') + tile(chasing.length, 'Waiting on others', 'teal', 'go', 'waiting') + '</div>';
  h += '<div class="grid2"><div>' + sec('Needs your attention', urgent.length ? listBox(urgent.slice(0, 8).map(t => taskRow(t))) + (urgent.length > 8 ? '<button class="link" data-act="go" data-id="mine">See all ' + urgent.length + '</button>' : '') : empty('Nothing urgent. Nicely done.'), '<button class="link" data-act="go" data-id="mine">My actions</button>');
  if(canView('finance')){
    const [a, b] = periodRange('week'), pr = openPayreqs(), rc = receivables();
    h += sec('Money this week', moneyTiles(a, b) + '<div class="list">' +
      '<div class="item click" data-act="go" data-id="finance"><div class="main"><div class="t">Payment requests open</div><div class="meta">' + pr.length + ' waiting' + (pr.filter(p => !p.assignee).length ? ', ' + pr.filter(p => !p.assignee).length + ' without an owner' : '') + '</div></div><div class="side"><span class="amt">' + moneyMap(sumBy(pr)) + '</span></div></div>' +
      '<div class="item click" data-act="go" data-id="finance"><div class="main"><div class="t">Owed to us</div><div class="meta">' + rc.length + ' receivable' + (rc.length === 1 ? '' : 's') + '</div></div><div class="side"><span class="amt">' + moneyMap(sumBy(rc)) + '</span></div></div></div>', '<button class="link" data-act="go" data-id="finance">Finance</button>');
  }
  if(canView('customers')){
    const s = reconStats();
    h += sec('Customers', '<div class="tiles" style="grid-template-columns:repeat(2,1fr)">' + tile(s.due.length, 'Reconciliations in the next 7 days', '', 'go', 'customers') + tile(s.overdue.length, 'Overdue reconciliations', s.overdue.length ? 'red' : '', 'go', 'customers') +
      tile(s.awaiting.length, 'Awaiting payment', s.awaiting.length ? 'amber' : '', 'go', 'customers') + tile(s.latePay.length, 'Overdue payments', s.latePay.length ? 'red' : '', 'go', 'customers') + '</div>');
  }
  h += '</div><div>';
  if(canView('marketing')){
    const risk = campaignsAtRisk(), waitAp = list('campaigns').filter(inBrand).filter(x => x.status === 'open' && x.stage === 'approve');
    h += sec('Marketing', (risk.length ? '<div class="card hot"><b>' + risk.length + ' campaign' + (risk.length === 1 ? '' : 's') + ' at risk</b><div class="meta">Publishing within 3 days but not yet scheduled.</div></div>' : '') +
      (waitAp.length ? listBox(waitAp.slice(0, 4).map(x => recRow('campaigns', x, esc(x.name), esc(fmtDT(x.publishAt, 1)), wfStatus(x) + brandTag(x.brand)))) : empty('No campaigns waiting for approval.')), '<button class="link" data-act="go" data-id="marketing">Marketing</button>');
  }
  if(isFull()){
    const ot = openTasks().filter(t => !t.blocked);
    h += sec('Team', '<div class="list">' + M.map(m => { const own = ot.filter(t => t.owner === m.email), od = own.filter(isOverdue).length;
      return '<div class="teamrow click" data-act="teamFilter" data-id="' + esc(m.email) + '" style="cursor:pointer">' + avatar(m.email) + '<div><b>' + esc(nameOf(m.email)) + '</b><div class="meta" style="margin:0">' + esc(m.title || (m.access === 'full' ? 'Full access' : 'Selected access')) + '</div></div><div class="num">' + own.length + '<small>open</small></div><div class="num" style="color:' + (od ? 'var(--redink)' : 'var(--mut)') + '">' + od + '<small>late</small></div></div>'; }).join('') + '</div>');
  }
  if(chasing.length) h += sec('Waiting on others', listBox(chasing.sort(taskSort).slice(0, 5).map(t => taskRow(t, {owner:true}))), '<button class="link" data-act="go" data-id="waiting">See all</button>');
  const acts = list('activity').sort(by('at', -1)).slice(0, 8);
  if(acts.length) h += sec('Recent activity', '<div class="card" style="padding:4px 14px">' + acts.map(actRow).join('') + '</div>');
  h += '</div></div>';
  return h;
};
function actRow(a){
  const [col, id] = (a.ref || '').split('/'), r = get(col, id);
  const what = r ? recTitle(col, r) : '';
  return '<div class="act" style="cursor:pointer"' + (r ? openAttr(col, id) : '') + '><b>' + esc(firstName(a.by)) + '</b> ' + esc(a.text) + (what && !/^(created|added)/.test(a.text) ? '' : '') + (what ? ': <b>' + esc(what) + '</b>' : '') + ' <span>· ' + esc(fmtDT(a.at, 1)) + '</span></div>';
}

R.mine = () => {
  const all = tasks().filter(t => t.owner === me.email || (t.collab || []).includes(me.email));
  const open = all.filter(t => !isDone(t) && !t.blocked).sort(taskSort);
  const endToday = new Date(); endToday.setHours(23, 59, 59, 999);
  const endWeek = new Date(endToday.getTime() + 6 * DAY);
  const g = {over:[], today:[], week:[], later:[], none:[]};
  open.forEach(t => { if(!t.due) g.none.push(t); else if(isOverdue(t)) g.over.push(t); else if(new Date(t.due) <= endToday) g.today.push(t); else if(new Date(t.due) <= endWeek) g.week.push(t); else g.later.push(t); });
  const blocked = all.filter(t => !isDone(t) && t.blocked), done = all.filter(isDone).sort(by('doneAt', -1)).slice(0, 15);
  let h = title('My actions', open.length + ' open' + (g.over.length ? ', <b style="color:var(--redink)">' + g.over.length + ' overdue</b>' : ''), addBtn('newTask', 'New action'));
  if(ui.mineView === 'type'){
    h += chips('mineView', ui.mineView, [['due','By deadline'], ['type','By type']]);
    const types = [['approval','Approvals'], ['payment','Payments'], ['external','Follow-ups with people outside'], ['progress','In progress'], ['awaiting','To do']];
    types.forEach(([k, l]) => { const xs = open.filter(t => t.status === k); if(xs.length) h += sec(l + ' <small>' + xs.length + '</small>', listBox(xs.map(t => taskRow(t)))); });
  } else {
    h += chips('mineView', ui.mineView, [['due','By deadline'], ['type','By type']]);
    [['over','Overdue'], ['today','Today'], ['week','Next 7 days'], ['later','Later'], ['none','No deadline']].forEach(([k, l]) => { if(g[k].length) h += sec(l + ' <small>' + g[k].length + '</small>', listBox(g[k].map(t => taskRow(t)))); });
  }
  if(!open.length) h += empty('Nothing on your list. Use quick capture to add something.');
  if(blocked.length) h += sec('Starts after an earlier step <small>' + blocked.length + '</small>', listBox(blocked.map(t => taskRow(t))));
  if(done.length) h += sec('Recently completed', listBox(done.map(t => taskRow(t))));
  return h;
};

R.tasks = () => {
  const f = ui.taskF;
  let ts = tasks();
  if(f.who) ts = ts.filter(t => t.owner === f.who || (t.collab || []).includes(f.who));
  if(f.mod) ts = ts.filter(t => (t.module || 'general') === f.mod);
  if(f.pri) ts = ts.filter(t => t.priority === f.pri);
  if(f.status === 'open') ts = ts.filter(t => !isDone(t));
  else if(f.status === 'overdue') ts = ts.filter(isOverdue);
  else if(f.status === 'done') ts = ts.filter(isDone);
  else if(f.status && f.status !== 'all') ts = ts.filter(t => !isDone(t) && t.status === f.status);
  ts.sort(f.status === 'done' ? by('doneAt', -1) : taskSort);
  const sel = (k, opts) => '<select data-filter="taskF.' + k + '" aria-label="Filter">' + opts.map(o => opt(o, f[k])).join('') + '</select>';
  return title('All tasks', ts.length + ' shown', addBtn('newTask', 'New action')) +
    '<div class="filters">' + sel('who', [['', 'Everyone'], ...peopleOpts()]) + sel('status', [['open','Open'], ['overdue','Overdue'], ...STATUS.filter(s => s[0] !== 'done'), ['done','Completed'], ['all','Everything']]) +
    sel('mod', [['', 'All areas'], ...MODULE_OF_TASK]) + sel('pri', [['', 'Any priority'], ...PRIORITY]) + '</div>' +
    (ts.length ? listBox(ts.slice(0, 200).map(t => taskRow(t, {owner:true}))) : empty('No tasks match.'));
};

R.waiting = () => {
  const open = openTasks();
  const ext = open.filter(t => t.status === 'external' && (isFull() || t.owner === me.email || t.by === me.email)).sort(taskSort);
  const deleg = open.filter(t => t.by === me.email && t.owner !== me.email && t.status !== 'external' && !t.stage).sort(taskSort);
  const myRecs = ['payreqs','campaigns','suppliers'].flatMap(col => list(col).filter(r => r.by === me.email && r.status === 'open' && r.stageOwner && r.stageOwner !== me.email).map(r => [col, r]));
  return title('Waiting on others', 'Everything with a follow-up date, so nothing is forgotten') +
    sec('Outside the team <small>' + ext.length + '</small>', ext.length ? listBox(ext.map(t => chaseRow(t))) : empty('Not waiting on anyone outside the team. Set an action to "Awaiting external response" with a follow-up date.')) +
    sec('Delegated by you <small>' + deleg.length + '</small>', deleg.length ? listBox(deleg.map(t => chaseRow(t))) : empty('Nothing delegated and still open.')) +
    (myRecs.length ? sec('Your requests in progress', listBox(myRecs.map(([col, r]) => recRow(col, r, esc(recTitle(col, r)), esc(firstName(r.stageOwner)), wfStatus(r) + brandTag(r.brand))))) : '');
};
function chaseRow(t){
  const msg = 'Hi ' + firstName(t.owner) + ', checking on: ' + t.title + (t.due ? ' (due ' + fmtDT(t.due) + ')' : '') + '. ' + appLink('tasks/' + t.id);
  const ext = t.status === 'external';
  return '<div class="item click"' + openAttr('tasks', t.id) + '>' +
    '<button class="tick" role="checkbox" aria-checked="false" aria-label="Mark done" data-act="tick" data-id="' + esc(t.id) + '">' + icon('check') + '</button>' +
    '<div class="main"><div class="t">' + esc(t.title) + '</div><div class="meta">' + dueBadge(t) + (t.due ? '<span>Follow up ' + esc(fmtDT(t.due, 1)) + '</span>' : '') +
    (ext && t.waitingOn ? '<span class="b b-teal">Waiting on ' + esc(t.waitingOn) + '</span>' : '') + '<span>' + avatar(t.owner, 1) + ' ' + esc(firstName(t.owner)) + '</span>' + brandTag(t.brand) + '</div></div>' +
    '<div class="side">' + (ext ? '<button class="btn sm ghost" data-act="gotReply" data-id="' + esc(t.id) + '">Got a reply</button>' : '<a class="btn sm ghost" href="' + esc(waLink(msg, t.owner)) + '" target="_blank" rel="noopener">' + icon('wa') + 'Chase</a>') + '</div></div>';
}

R.briefing = () => {
  let h = title('Briefing', esc(new Date().toLocaleDateString('en-GB', {weekday:'long', day:'numeric', month:'long'})), '<button class="btn ghost" data-act="print">Print</button>') + chips('briefTab', ui.briefTab, [['today','Today'], ['week','Weekly summary']]);
  const open = openTasks().filter(t => !t.blocked), mine = open.filter(t => t.owner === me.email);
  const endToday = new Date(); endToday.setHours(23, 59, 59, 999);
  if(ui.briefTab === 'today'){
    const blocks = [
      ['Overdue', mine.filter(isOverdue)],
      ['Due today', mine.filter(t => !isOverdue(t) && t.due && new Date(t.due) <= endToday)],
      ['Approvals waiting for you', mine.filter(t => t.status === 'approval')],
      ['Payments needing action', mine.filter(t => t.status === 'payment')],
      ['Waiting on others: follow up today', open.filter(t => (t.by === me.email && t.owner !== me.email || t.status === 'external' && t.owner === me.email) && t.due && new Date(t.due) <= endToday)]
    ];
    if(isFull()) blocks.push(['Critical deadlines in the next 72 hours (team)', open.filter(t => (t.priority === 'critical' || t.priority === 'high') && t.due && msLeft(t.due) < 72 * H)]);
    blocks.forEach(([l, xs]) => { h += sec(l + ' <small>' + xs.length + '</small>', xs.length ? listBox(xs.sort(taskSort).map(t => taskRow(t, {owner: isFull()}))) : empty('Nothing.')); });
    if(canView('customers')){
      const s = reconStats(), up = list('recons').filter(inBrand).filter(r => r.status === 'open' && ['contact','reconcile'].includes(r.stage));
      h += sec('Customer payments due <small>' + s.awaiting.length + '</small>', s.awaiting.length ? listBox(s.awaiting.map(r => recRow('recons', r, esc(r.title), r.amount != null ? '<span class="amt">' + money(r.amount, r.currency) + '</span>' : '', wfStatus(r) + (r.payDue ? 'due ' + esc(fmtD(r.payDue)) : '')))) : empty('None.'));
      h += sec('Upcoming reconciliations <small>' + up.length + '</small>', up.length ? listBox(up.sort(by('date')).map(r => recRow('recons', r, esc(r.title), esc(fmtD(r.date)), wfStatus(r)))) : empty('None.'));
    }
    if(canView('marketing')){ const risk = campaignsAtRisk(); h += sec('Campaigns at risk <small>' + risk.length + '</small>', risk.length ? listBox(risk.map(x => recRow('campaigns', x, esc(x.name), esc(fmtDT(x.publishAt, 1)), wfStatus(x)))) : empty('None.')); }
  } else {
    const [a, b] = periodRange('last7'), since = new Date(Date.now() - 7 * DAY).toISOString();
    const doneWk = tasks().filter(t => isDone(t) && (t.doneAt || '') >= since);
    if(canView('finance')){
      const rows = ledgerIn(a, b), outBrand = {};
      rows.filter(r => r.dir === 'out').forEach(r => { const k = (r.brand || 'No brand') + '|' + (r.currency || 'GBP'); outBrand[k] = (outBrand[k] || 0) + Number(r.amount || 0); });
      h += sec('Money, last 7 days', moneyTiles(a, b) + (Object.keys(outBrand).length ? '<div class="list">' + Object.keys(outBrand).sort().map(k => { const [br, cu] = k.split('|'); return '<div class="item"><div class="main"><div class="t">' + (br === 'No brand' ? 'No brand' : brandTag(br)) + '</div></div><div class="side"><span class="amt">' + money(outBrand[k], cu) + '</span></div></div>'; }).join('') + '</div>' : '') +
        '<div class="list">' + '<div class="item"><div class="main"><div class="t">Open payment requests</div></div><div class="side"><span class="amt">' + moneyMap(sumBy(openPayreqs())) + '</span></div></div><div class="item"><div class="main"><div class="t">Owed to us</div></div><div class="side"><span class="amt">' + moneyMap(sumBy(receivables())) + '</span></div></div></div>');
    }
    h += sec('Progress by person', '<div class="list">' + M.map(m => { const d = doneWk.filter(t => t.doneBy === m.email || t.owner === m.email && !t.doneBy).length, o = open.filter(t => t.owner === m.email), od = o.filter(isOverdue).length;
      return '<div class="teamrow">' + avatar(m.email) + '<div><b>' + esc(nameOf(m.email)) + '</b></div><div class="num" style="color:var(--okink)">' + d + '<small>done</small></div><div class="num">' + o.length + '<small>open</small>' + (od ? '<small style="color:var(--redink)">' + od + ' late</small>' : '') + '</div></div>'; }).join('') + '</div>');
    const late = open.filter(isOverdue).sort(taskSort);
    h += sec('Unresolved and overdue <small>' + late.length + '</small>', late.length ? listBox(late.map(t => taskRow(t, {owner:true}))) : empty('Nothing overdue across the team.'));
    const closed = ['payreqs','campaigns','recons','suppliers'].flatMap(col => list(col).filter(inBrand).filter(r => r.status === 'closed' && (r.closedAt || '') >= since).map(r => [col, r]));
    if(closed.length) h += sec('Workflows closed this week <small>' + closed.length + '</small>', listBox(closed.map(([col, r]) => recRow(col, r, esc(recTitle(col, r)), '', '<span class="b b-ok">' + esc(WF[col].name) + '</span>'))));
  }
  return h;
};

/* ---------- calendar: everything with a date, linked to where it came from ---------- */
function calItems(){
  const f = ui.calF, out = [];
  tasks().forEach(t => {
    if(!t.due) return;
    if(f.who && t.owner !== f.who && !(t.collab || []).includes(f.who)) return;
    if(f.mod && (t.module || 'general') !== f.mod) return;
    if(f.pri && t.priority !== f.pri) return;
    out.push({date: ymd(new Date(t.due)), time: t.due, title: t.title, ref:'tasks/' + t.id, color: isDone(t) ? 'var(--ok)' : isOverdue(t) ? 'var(--red)' : t.priority === 'critical' ? 'var(--red)' : brandColor(t.brand) === 'var(--faint)' ? 'var(--amber)' : brandColor(t.brand), task:t});
  });
  if(!f.mod || f.mod === 'calendar') list('events').filter(inBrand).forEach(e => {
    if(f.who && !(e.who || []).includes(f.who)) return;
    if(f.pri) return;
    const s = new Date(e.start), end = e.end ? new Date(e.end) : s;
    for(let d = new Date(s.getFullYear(), s.getMonth(), s.getDate()), i = 0; d <= end && i < 60; d.setDate(d.getDate() + 1), i++) out.push({date: ymd(d), time: e.start, title: e.title, ref:'events/' + e.id, color:'var(--teal)', ev:e});
  });
  if(!f.mod && !f.pri && !f.who) list('trips').forEach(t => { for(let d = parseD(t.start), e = parseD(t.end || t.start), i = 0; d <= e && i < 60; d.setDate(d.getDate() + 1), i++) out.push({date: ymd(d), time:'', title:'Trip: ' + t.title, ref:'more/trips', color:'var(--olive)'}); });
  return out;
}
R.calendar = () => {
  const items = calItems(), byDay = {};
  items.forEach(x => (byDay[x.date] = byDay[x.date] || []).push(x));
  const m = parseD(ui.calMonth + '-01'), start = new Date(m); start.setDate(1 - ((m.getDay() + 6) % 7));
  let cells = '';
  for(let i = 0; i < 42; i++){
    const d = new Date(start); d.setDate(start.getDate() + i); const k = ymd(d);
    if(i >= 35 && d.getMonth() !== m.getMonth() && i % 7 === 0) break;
    const xs = byDay[k] || [];
    cells += '<button data-act="calDay" data-id="' + k + '" class="' + (d.getMonth() !== m.getMonth() ? 'out ' : '') + (k === TODAY() ? 'today' : '') + '" aria-pressed="' + (k === ui.calDay) + '" aria-label="' + esc(fmtD(k)) + ', ' + xs.length + ' items">' + d.getDate() + '<span class="dots">' + xs.slice(0, 6).map(x => '<i style="--c:' + x.color + '"></i>').join('') + '</span></button>';
  }
  const day = (byDay[ui.calDay] || []).sort(by('time'));
  const f = ui.calF, sel = (k, opts) => '<select data-filter="calF.' + k + '" aria-label="Filter">' + opts.map(o => opt(o, f[k])).join('') + '</select>';
  const upcoming = items.filter(x => x.date >= TODAY() && !(x.task && isDone(x.task))).sort((a, b) => (a.time || a.date) < (b.time || b.date) ? -1 : 1).slice(0, 12);
  const row = x => '<div class="item click" data-act="open" data-id="' + esc(x.ref) + '"><span class="av sm" style="background:' + x.color + '"></span><div class="main"><div class="t">' + esc(x.title) + '</div><div class="meta">' + (x.time ? esc(fmtDT(x.time, 1)) : esc(fmtD(x.date))) + (x.task ? statusBadge(x.task) + ' <span>' + esc(firstName(x.task.owner)) + '</span>' : x.ev ? '<span class="b b-teal">Meeting</span>' + (x.ev.place ? ' ' + esc(x.ev.place) : '') : '') + '</div></div></div>';
  return title('Calendar', 'Every deadline, payment, campaign, reconciliation and meeting in one place', addBtn('newEvent', 'Meeting')) +
    '<div class="filters">' + sel('who', [['', 'Everyone'], ...peopleOpts()]) + sel('mod', [['', 'All areas'], ...MODULE_OF_TASK, ['calendar','Meetings']]) + sel('pri', [['', 'Any priority'], ...PRIORITY]) + '</div>' +
    '<div class="grid2"><div><div class="calhd"><button class="btn ghost sm" data-act="calPrev" aria-label="Previous month">' + icon('back') + '</button><h2>' + esc(ymLabel(ui.calMonth)) + '</h2><button class="btn ghost sm" data-act="calNext" aria-label="Next month" style="transform:scaleX(-1)">' + icon('back') + '</button></div>' +
    '<div class="cal">' + ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => '<div class="dow">' + d + '</div>').join('') + cells + '</div></div>' +
    '<div>' + sec(esc(fmtD(ui.calDay)), day.length ? listBox(day.map(row)) : empty('Nothing on this day.')) + sec('Coming up', upcoming.length ? listBox(upcoming.map(row)) : empty('Nothing coming up.')) + '</div></div>';
};

/* ---------- finance ---------- */
R.finance = () => {
  if(!canView('finance')) return noAccess();
  const ed = canEdit('finance'), c = cfg();
  const [a, b, label] = periodRange(ui.finPeriod, ui.finMonth);
  const rows = ledgerIn(a, b).sort(by('date', -1));
  const prs = list('payreqs').filter(inBrand).sort((x, y) => (x.status !== 'open') - (y.status !== 'open') || ((x.deadline || '') < (y.deadline || '') ? -1 : 1));
  const open = prs.filter(p => p.status === 'open'), closed = prs.filter(p => p.status !== 'open').slice(0, ui.showClosed ? 50 : 0);
  const com = commitments(30), rec = receivables();
  const outBy = (key) => { const o = {}; rows.filter(r => r.dir === 'out').forEach(r => { const k = (r[key] || 'Not set') + '|' + (r.currency || 'GBP'); o[k] = (o[k] || 0) + Number(r.amount || 0); }); return o; };
  const bars = (o, tag) => { const ks = Object.keys(o).sort(); if(!ks.length) return empty('No money out in this period.'); const max = Math.max(...ks.map(k => o[k]));
    return '<div class="card">' + ks.map(k => { const [n, cu] = k.split('|'); return '<div style="margin-bottom:10px"><div class="split"><span>' + (tag ? brandTag(n === 'Not set' ? '' : n) || 'No brand' : esc(n)) + '</span><span class="amt">' + money(o[k], cu) + '</span></div><div class="bar"><i style="width:' + Math.max(3, o[k] / max * 100) + '%"></i></div></div>'; }).join('') + '</div>'; };
  let h = title('Finance', 'Coordinates payments; Zoho stays the accounting record', (ed ? addBtn('newPayreq', 'Payment request') + '<button class="btn ghost" data-act="newLedger">' + icon('plus') + 'Money in or out</button>' : '') + '<button class="btn ghost" data-act="exportXlsx">Excel</button>');
  h += '<div class="chips">' + [['week','This week'], ['month','Month']].map(([v, l]) => '<button class="chip" data-act="finPeriod" data-id="' + v + '" aria-pressed="' + (ui.finPeriod === v) + '">' + l + '</button>').join('') +
    (ui.finPeriod === 'month' ? '<button class="chip" data-act="finPrev" aria-label="Previous month">‹</button><button class="chip" aria-pressed="true">' + esc(label) + '</button><button class="chip" data-act="finNext" aria-label="Next month">›</button>' : '') + '</div>';
  h += moneyTiles(a, b);
  h += '<div class="grid2"><div>';
  h += sec('Payment requests <small>' + open.length + ' open</small>', (open.length ? listBox(open.map(p => recRow('payreqs', p, esc(p.title), '<span class="amt">' + money(p.amount, p.currency) + '</span>' + (p.deadline ? '<span' + (p.deadline < TODAY() ? ' style="color:var(--redink)"' : '') + '>by ' + esc(fmtDs(p.deadline)) + '</span>' : ''), wfStatus(p) + (p.stageOwner ? '<span>' + esc(firstName(p.stageOwner)) + '</span>' : '') + brandTag(p.brand) + (p.priority === 'critical' ? prioBadge('critical') : '')))) : empty('No open payment requests.')) +
    (prs.length > open.length ? '<button class="link" data-act="toggleClosed">' + (ui.showClosed ? 'Hide' : 'Show') + ' closed requests</button>' + (closed.length ? listBox(closed.map(p => recRow('payreqs', p, esc(p.title), '<span class="amt">' + money(p.paidAmount || p.amount, p.currency) + '</span>', wfStatus(p) + brandTag(p.brand)))) : '') : ''));
  h += sec('Coming up to pay <small>next 30 days</small>', com.length ? listBox(com.map(moneyRow)) + '<p class="meta">Total: ' + moneyMap(sumBy(com)) + '</p>' : empty('Nothing due in the next 30 days.'));
  h += sec('Owed to us', rec.length ? listBox(rec.map(moneyRow)) + '<p class="meta">Total: ' + moneyMap(sumBy(rec)) + '</p>' : empty('Nothing outstanding.'));
  h += '</div><div>';
  h += sec('Money out by brand', bars(outBy('brand'), true));
  h += sec('Money out by account', bars(outBy('account')));
  const recs = list('recurring').filter(inBrand).sort(by('next'));
  h += sec('Recurring payments', recs.length ? listBox(recs.map(r => '<div class="item click"' + openAttr('recurring', r.id) + '><div class="main"><div class="t">' + esc(r.title) + (r.active === false ? ' <span class="b">Paused</span>' : '') + '</div><div class="meta">' + esc({weekly:'Weekly', monthly:'Monthly', quarterly:'Every 3 months', yearly:'Yearly'}[r.every] || '') + ' · next ' + esc(fmtD(r.next)) + ' · ' + esc(firstName(r.owner)) + brandTag(r.brand) + '</div></div><div class="side"><span class="amt">' + money(r.amount, r.currency) + '</span></div></div>')) : empty('No recurring payments yet.'), ed ? '<button class="link" data-act="newRecurring">+ Add</button>' : '');
  h += sec('Entries · ' + esc(label), rows.length ? listBox(rows.map(r => '<div class="item click"' + openAttr('ledger', r.id) + '><div class="main"><div class="t">' + esc(r.title) + '</div><div class="meta">' + esc(fmtD(r.date)) + ' · ' + esc(r.cat || '') + (r.account ? ' · ' + esc(r.account) : '') + brandTag(r.brand) + (r.zoho ? '<span class="b b-ok">Zoho</span>' : '') + '</div></div><div class="side"><span class="amt" style="color:' + (r.dir === 'in' ? 'var(--okink)' : r.dir === 'out' ? 'var(--ink)' : 'var(--mut)') + '">' + (r.dir === 'in' ? '+' : r.dir === 'out' ? '−' : '') + money(r.amount, r.currency) + '</span>' + (r.dir.startsWith('due') ? '<span>' + (r.dir === 'due-in' ? 'owed to us' : 'we owe') + '</span>' : '') + '</div></div>')) : empty('No entries in this period.'));
  h += '</div></div>';
  return h;
};

/* ---------- marketing ---------- */
R.marketing = () => {
  if(!canView('marketing')) return noAccess();
  const cs = list('campaigns').filter(inBrand), risk = campaignsAtRisk();
  const cols = [['Draft or revising', c => c.status === 'open' && c.stage === 'submit'], ['Awaiting approval', c => c.status === 'open' && c.stage === 'approve'], ['To schedule', c => c.status === 'open' && c.stage === 'schedule'],
    ['Scheduled', c => c.status === 'open' && c.stage === 'publish'], ['Published', c => c.status === 'closed' && msLeft(c.closedAt) > -30 * DAY]];
  const card = c => { const s = activeStage(c), late = risk.includes(c);
    return '<div class="card click' + (late ? ' hot' : '') + '"' + openAttr('campaigns', c.id) + '><h3>' + esc(c.name) + '</h3><div class="meta">' + brandTag(c.brand) + '<span>' + esc(fmtDT(c.publishAt, 1)) + '</span>' + (late ? '<span class="b b-red">At risk</span>' : '') + (c.revisions ? '<span class="b">' + c.revisions + ' revision' + (c.revisions === 1 ? '' : 's') + '</span>' : '') + '</div>' + (s ? '<div class="meta">' + avatar(s.owner, 1) + esc(firstName(s.owner)) + ' · ' + esc(s.due ? relDue(s.due) : '') + '</div>' : '') + '</div>'; };
  return title('Marketing', 'Created, approved, scheduled, published', addBtn('newCampaign', 'Campaign')) +
    (risk.length ? '<div class="notice"><b>' + risk.length + ' at risk.</b> Publishing within 3 days without being scheduled. ' + esc(firstName(roleEmail('charlie'))) + ' has been alerted.</div>' : '') +
    '<div class="kanban">' + cols.map(([l, fn]) => { const xs = cs.filter(fn).sort(by('publishAt')); return '<div class="col"><h3>' + esc(l) + '<span>' + xs.length + '</span></h3>' + (xs.map(card).join('') || '<div class="meta" style="padding:4px">Nothing here.</div>') + '</div>'; }).join('') + '</div>' +
    '<p class="hint" style="margin-top:12px">Scheduling itself happens in Planable. Paste the Planable link when you mark a campaign as scheduled.</p>';
};

/* ---------- customers ---------- */
R.customers = () => {
  if(!canView('customers')) return noAccess();
  const s = reconStats(), cs = list('customers').filter(inBrand).sort(by('name'));
  const openR = list('recons').filter(inBrand).filter(r => r.status === 'open').sort(by('date'));
  const outstanding = c => sumBy(list('recons').filter(r => r.customer === c.id && r.status === 'open' && r.stage === 'collect'));
  let h = title('Customers', 'Retailers, distributors, gyms, clinics and stockists', canEdit('customers') ? addBtn('newCustomer', 'Customer') : '');
  h += '<div class="tiles">' + tile(s.due.length, 'Reconciliations due in 7 days') + tile(s.overdue.length, 'Overdue reconciliations', s.overdue.length ? 'red' : '') + tile(s.awaiting.length, 'Awaiting payment', s.awaiting.length ? 'amber' : '') + tile(s.latePay.length, 'Overdue payments', s.latePay.length ? 'red' : '') + '</div>';
  h += '<div class="grid2"><div>' + sec('Reconciliations in progress <small>' + openR.length + '</small>', openR.length ? listBox(openR.map(r => recRow('recons', r, esc(r.title), r.amount != null ? '<span class="amt">' + money(r.amount, r.currency) + '</span>' : esc(fmtDs(r.date)), wfStatus(r) + (r.stageOwner ? '<span>' + esc(firstName(r.stageOwner)) + '</span>' : '')))) : empty('Reconciliations appear here automatically ' + (cfg().reconLead || 5) + ' days before each customer\'s reconciliation day.'));
  if(s.done.length) h += sec('Completed this month <small>' + s.done.length + '</small>', listBox(s.done.map(r => recRow('recons', r, esc(r.title), r.received != null ? '<span class="amt">' + money(r.received, r.currency) + '</span>' : '', wfStatus(r)))));
  h += '</div><div>' + sec('All customers <small>' + cs.length + '</small>', cs.length ? listBox(cs.map(c => { const nx = c.reconDay ? (daysTo(reconDate(c, ym(new Date()))) >= 0 ? reconDate(c, ym(new Date())) : reconDate(c, ym(parseD(addMonths(TODAY(), 1))))) : '';
    return '<div class="item click"' + openAttr('customers', c.id) + '><span class="av">' + esc((c.name || '?').slice(0, 2)) + '</span><div class="main"><div class="t">' + esc(c.name) + (c.active === false ? ' <span class="b">Inactive</span>' : '') + '</div><div class="meta">' + esc(c.type || '') + brandTag(c.brand) + (nx && c.active !== false ? '<span>Next reconciliation ' + esc(fmtDs(nx)) + '</span>' : '') + '</div></div><div class="side"><span class="amt">' + moneyMap(outstanding(c)) + '</span><span>outstanding</span></div></div>'; })) : empty('No customers yet.')) + '</div></div>';
  return h;
};

/* ---------- suppliers and stock ---------- */
R.suppliers = () => {
  if(!canView('suppliers')) return noAccess();
  const xs = list('suppliers').filter(inBrand), open = xs.filter(x => x.status === 'open').sort((a, b) => ((activeStage(a) || {}).due || '') < ((activeStage(b) || {}).due || '') ? -1 : 1);
  const done = xs.filter(x => x.status !== 'open').sort(by('closedAt', -1)).slice(0, 15);
  const ed = canEdit('suppliers');
  return title('Suppliers and stock', 'Payment deadlines, deposits, orders, deliveries and stock actions. Records stay in Zoho.', ed ? addBtn('newSupplier', 'Follow-up') : '') +
    (ed ? '<div class="chips">' + ['Deposit payment', 'Balance payment', 'Delivery follow-up', 'Stock check', 'Restock follow-up', 'Stock adjustment in Zoho'].map(t => '<button class="chip" data-act="newSupplier" data-id="' + esc(t) + '">+ ' + esc(t) + '</button>').join('') + '</div>' : '') +
    sec('Open <small>' + open.length + '</small>', open.length ? listBox(open.map(x => { const s = activeStage(x), t = s && get('tasks', s.task);
      return recRow('suppliers', x, esc(x.title), (x.amount ? '<span class="amt">' + money(x.amount, x.currency) + '</span>' : '') + (t && t.due ? '<span>' + esc(fmtDs(ymd(new Date(t.due)))) + '</span>' : ''), wfStatus(x) + '<span>' + esc(x.supplier || '') + '</span><span class="b">' + esc(x.type || '') + '</span>' + (s ? '<span>' + esc(firstName(s.owner)) + '</span>' : '') + brandTag(x.brand)); })) : empty('No open supplier or stock follow-ups.')) +
    (done.length ? sec('Recently closed', listBox(done.map(x => recRow('suppliers', x, esc(x.title), '', wfStatus(x) + '<span>' + esc(x.supplier || '') + '</span>')))) : '');
};

/* ---------- partnerships ---------- */
R.bizdev = () => {
  if(!canView('bizdev')) return noAccess();
  const os = list('opps').filter(inBrand);
  const noNext = os.filter(o => o.stage !== 'Closed' && (!o.nextAction || !o.nextDate || daysTo(o.nextDate) < 0));
  const card = o => { const late = o.nextDate && daysTo(o.nextDate) < 0, none = !o.nextAction || !o.nextDate;
    return '<div class="card click' + (late || none ? ' hot' : '') + '"' + openAttr('opps', o.id) + '><h3>' + esc(o.company) + '</h3><div class="meta">' + brandTag(o.brand) + avatar(o.owner, 1) + esc(firstName(o.owner)) + '</div><div class="meta" style="color:' + (late || none ? 'var(--redink)' : 'var(--mut)') + '">' + (none ? 'No next action set' : esc(o.nextAction) + ' · ' + esc(fmtDs(o.nextDate))) + '</div></div>'; };
  return title('Partnerships', 'Every active opportunity has a next action and date', canEdit('bizdev') ? addBtn('newOpp', 'Opportunity') : '') +
    (noNext.length ? '<div class="notice">' + noNext.length + ' need' + (noNext.length === 1 ? 's' : '') + ' a new next action or are past their date.</div>' : '') +
    '<div class="kanban">' + OPP_STAGES.filter(s => s !== 'Closed').map(s => { const xs = os.filter(o => o.stage === s).sort(by('nextDate')); return '<div class="col"><h3>' + esc(s) + '<span>' + xs.length + '</span></h3>' + (xs.map(card).join('') || '<div class="meta" style="padding:4px">None.</div>') + '</div>'; }).join('') + '</div>' +
    (os.some(o => o.stage === 'Closed') ? sec('Closed', listBox(os.filter(o => o.stage === 'Closed').map(o => recRow('opps', o, esc(o.company), '', brandTag(o.brand))))) : '');
};

/* ---------- legal ---------- */
R.legal = () => {
  if(!canView('legal')) return noAccess();
  const xs = list('legal').filter(inBrand);
  const soon = xs.filter(x => x.renewal && daysTo(x.renewal) <= 60 && x.status !== 'Closed').sort(by('renewal'));
  const types = uniq(xs.map(x => x.type)).sort();
  const row = x => '<div class="item click"' + openAttr('legal', x.id) + '><div class="main"><div class="t">' + (x.sensitive ? icon('lock') + ' ' : '') + esc(x.title) + '</div><div class="meta"><span class="b' + (/expired|renewal/i.test(x.status) ? ' b-red' : /awaiting/i.test(x.status) ? ' b-teal' : x.status === 'Active' ? ' b-ok' : '') + '">' + esc(x.status) + '</span><span>' + esc(firstName(x.owner)) + '</span>' + (x.nextAction ? '<span>Next: ' + esc(x.nextAction) + (x.nextDate ? ' · ' + esc(fmtDs(x.nextDate)) : '') + '</span>' : '') + brandTag(x.brand) + '</div></div>' + (x.renewal ? '<div class="side"><span' + (daysTo(x.renewal) < 30 ? ' style="color:var(--redink);font-weight:700"' : '') + '>' + esc(fmtD(x.renewal)) + '</span><span>' + (daysTo(x.renewal) < 0 ? 'expired' : 'renews') + '</span></div>' : '') + '</div>';
  return title('Legal and compliance', 'Registrations, permits, licences, insurance, contracts and deadlines', canEdit('legal') ? addBtn('newLegal', 'Record') : '') +
    (soon.length ? sec('Renewals in the next 60 days', listBox(soon.map(row))) : '') +
    (types.length ? types.map(t => sec(esc(t), listBox(xs.filter(x => x.type === t).sort(by('title')).map(row)))).join('') : empty('Nothing recorded yet. Start with work permits, licences and insurance renewals.'));
};

/* ---------- documents and details ---------- */
R.docs = () => {
  if(!canView('docs')) return noAccess();
  const all = list('files').filter(inBrand).sort(by('at', -1)), folders = uniq(all.map(f => f.folder)).sort();
  if(ui.docFilter !== 'all' && !folders.includes(ui.docFilter)) ui.docFilter = 'all';
  const fs = all.filter(f => ui.docFilter === 'all' || f.folder === ui.docFilter);
  // files attached elsewhere in the app, so everything can be found from one place
  const attached = [];
  ['tasks','payreqs','campaigns','customers','suppliers','opps','legal','ledger'].forEach(col => list(col).filter(inBrand).forEach(r => (r.files || []).concat(r.proof || []).forEach(f => attached.push({f, col, r}))));
  return title('Documents', 'Uploads and links to Google Drive or Zoho', canEdit('docs') ? addBtn('newFile', 'Add') : '') +
    (folders.length > 1 ? chips('docFilter', ui.docFilter, [['all','All'], ...folders.map(l => [l, l])]) : '') +
    (fs.length ? listBox(fs.map(f => '<div class="item"><span class="av">' + icon(f.path ? 'file' : 'link') + '</span><div class="main"><div class="t">' + (f.restricted ? icon('lock') + ' ' : '') + esc(f.title) + '</div><div class="meta"><span class="b">' + esc(f.folder || 'Other') + '</span>' + esc([f.name, sizeText(f.size), firstName(f.by), fmtDs((f.at || '').slice(0, 10))].filter(Boolean).join(' · ')) + brandTag(f.brand) + '</div>' + (f.notes ? '<p class="meta pre">' + esc(f.notes) + '</p>' : '') + '</div><div class="side">' +
      (f.path ? '<a class="btn sm" data-f="' + esc(f.path) + '" target="_blank" rel="noopener">Open</a>' : '<a class="btn sm" href="' + esc(safeUrl(f.url)) + '" target="_blank" rel="noopener">Open</a>') + '<button class="link" data-act="editFile" data-id="' + f.id + '">Edit</button></div></div>')) : empty('No documents yet. Contracts, certificates, price lists, proof of payment: anything the team needs to find.')) +
    (attached.length ? sec('Attached to tasks and records <small>' + attached.length + '</small>', listBox(attached.slice(0, 60).map(({f, col, r}) => '<div class="item"><span class="av">' + icon('clip') + '</span><div class="main"><div class="t">' + esc(f.name) + '</div><div class="meta"><button class="link" style="padding:0"' + openAttr(col, r.id) + '>' + esc(recTitle(col, r)) + '</button>' + esc(sizeText(f.size)) + '</div></div><div class="side"><a class="btn sm ghost" data-f="' + esc(f.path) + '" target="_blank" rel="noopener">Open</a></div></div>'))) : '');
};
R.details = () => {
  if(!canView('details')) return noAccess();
  const ed = canEdit('details');
  const co = list('company').sort(by('label')), pp = list('people').sort(by('name')), ct = list('contacts').sort(by('name'));
  const link = (v, pre) => v ? '<a href="' + pre + esc(v.replace(/\s/g, '')) + '">' + esc(v) + '</a>' : '';
  return title('Contacts and details', 'Tap a company detail to copy it') +
    '<p class="hint" style="margin:0 0 16px">Everyone with access can see this page. Never keep passwords, card numbers or PINs here.</p>' +
    '<div class="grid2"><div>' + sec('Company', co.length ? listBox(co.map(x => '<div class="item"><div class="main"><div class="meta" style="margin:0">' + esc(x.label) + '</div><button class="link pre" style="color:var(--ink);font-size:16px;text-align:left;white-space:pre-wrap;padding:2px 0" data-act="copy" data-id="' + x.id + '">' + esc(x.value) + '</button>' + (x.notes ? '<div class="meta">' + esc(x.notes) + '</div>' : '') + '</div>' + (ed ? '<button class="link" data-act="editCompany" data-id="' + x.id + '">Edit</button>' : '') + '</div>')) : empty('Registration and tax numbers, addresses, banking details for invoices.'), ed ? '<button class="link" data-act="editCompany">+ Add</button>' : '') +
    sec('Team profiles', pp.length ? listBox(pp.map(x => '<div class="item"><div class="main"><div class="t">' + esc(x.name) + '</div><div class="meta">' + esc(x.role || '') + '</div><div class="meta">' + [link(x.phone, 'tel:'), link(x.email, 'mailto:')].filter(Boolean).join(' · ') + '</div>' + (x.emergency ? '<div class="meta">Emergency: ' + esc(x.emergency) + '</div>' : '') + '</div>' + (ed ? '<button class="link" data-act="editPerson" data-id="' + x.id + '">Edit</button>' : '') + '</div>')) : empty('Role, phone and emergency contact for each person.'), ed ? '<button class="link" data-act="editPerson">+ Add</button>' : '') + '</div><div>' +
    sec('Handy contacts', ct.length ? listBox(ct.map(x => '<div class="item"><div class="main"><div class="t">' + esc(x.name) + '</div><div class="meta">' + esc([x.company, x.what].filter(Boolean).join(' · ')) + '</div><div class="meta">' + [link(x.phone, 'tel:'), link(x.email, 'mailto:')].filter(Boolean).join(' · ') + '</div>' + (x.notes ? '<div class="meta pre">' + esc(x.notes) + '</div>' : '') + '</div>' + (ed ? '<button class="link" data-act="editContact" data-id="' + x.id + '">Edit</button>' : '') + '</div>')) : empty('Lawyers, accountant, couriers, suppliers and other numbers.'), ed ? '<button class="link" data-act="editContact">+ Add</button>' : '') + '</div></div>';
};
const noAccess = () => title('Not available') + empty('You do not have access to this area. Ask an admin if you need it.');

/* ---------- one record, with its steps, comments and history ---------- */
function openRecord(col, id){
  if(col === 'more'){ closeSheet(); return go('m-' + id); }
  const r = get(col, id);
  if(!r){ toast('This is not available. It may have been deleted, or you may not have access.'); return; }
  ui.open = {col, id};
  $('#sheetBody').innerHTML = '<div id="shMain"></div><section id="shThread"><div class="sechd" style="margin-top:8px"><h2>Conversation</h2></div><div id="shCmts"></div>' +
    '<div class="compose"><textarea id="cmtText" rows="1" placeholder="Write a comment. Type @ and a name to mention someone." aria-label="Comment"></textarea><label class="btn ghost" style="padding:0 12px" aria-label="Attach">' + icon('clip') + '<input type="file" multiple id="cmtFile" hidden></label><button class="btn" data-act="postCmt">Post</button></div><div id="cmtAtt" class="meta"></div></section>' +
    '<section><div class="sechd" style="margin-top:8px"><h2>History</h2></div><div id="shAct"></div></section>';
  $('#cmtFile').onchange = e => { $('#cmtAtt').textContent = [...e.target.files].map(f => f.name).join(', '); };
  renderSheet();
  if(!$('#sheet').open) $('#sheet').showModal();
  $('#sheet .dl').scrollTop = 0;
  try{ history.replaceState(null, '', '#open/' + col + '/' + id); }catch(e){}
}
function closeSheet(){ ui.open = null; if($('#sheet').open) $('#sheet').close(); try{ history.replaceState(null, '', '#' + ui.route); }catch(e){} }
function renderSheet(){
  if(!ui.open) return;
  const {col, id} = ui.open, r = get(col, id);
  if(!r){ closeSheet(); return; }
  const ref = col + '/' + id;
  $('#shMain').innerHTML = (DETAIL[col] || DETAIL.generic)(r, col);
  const cm = list('comments').filter(c => c.ref === ref).sort(by('at'));
  $('#shCmts').innerHTML = cm.length ? cm.map(c => '<div class="cmt">' + avatar(c.by) + '<div class="body"><div class="who">' + esc(nameOf(c.by)) + '<span>' + esc(fmtDT(c.at, 1)) + '</span></div><div class="pre">' + mentionHtml(c.text) + '</div>' + attHtml(c.files) + '</div></div>').join('') : '<p class="meta">No comments yet. Keep the conversation about this here instead of on WhatsApp.</p>';
  const acts = list('activity').filter(a => a.ref === ref).sort(by('at', -1)).slice(0, 40);
  $('#shAct').innerHTML = acts.length ? acts.map(a => '<div class="act"><b>' + esc(firstName(a.by)) + '</b> ' + esc(a.text) + ' <span>· ' + esc(fmtDT(a.at)) + '</span></div>').join('') : '<p class="meta">No history yet.</p>';
  hydrate($('#sheet'));
}
function mentionHtml(t){
  let s = esc(t);
  M.forEach(m => { const n = (m.name || '').split(' ')[0]; if(n) s = s.replace(new RegExp('@' + n + '\\b', 'gi'), '<span class="mention">@' + esc(n) + '</span>'); });
  return s;
}
async function postComment(){
  const ta = $('#cmtText'), text = ta.value.trim(), fl = $('#cmtFile').files;
  if(!text && !fl.length) return;
  const {col, id} = ui.open, ref = col + '/' + id, r = get(col, id);
  const btn = $('[data-act=postCmt]'); btn.disabled = true;
  try{
    const files = await uploadAll([...fl]);
    put('comments', newId(), Object.assign({ref, text, files}, stamp()));
    ta.value = ''; $('#cmtFile').value = ''; $('#cmtAtt').textContent = '';
    const tagged = M.filter(m => { const n = (m.name || '').split(' ')[0]; return n && new RegExp('@' + n + '\\b', 'i').test(text); }).map(m => m.email);
    const what = recTitle(col, r);
    tagged.forEach(e => notify(e, firstName(me.email) + ' mentioned you', what + ': ' + text.slice(0, 140), ref, 'mention'));
    const involved = uniq([r.owner, r.by, r.stageOwner, ...(r.collab || []), ...list('comments').filter(c => c.ref === ref).map(c => c.by)]).filter(e => !tagged.includes(e));
    involved.forEach(e => notify(e, 'New comment: ' + what, firstName(me.email) + ': ' + text.slice(0, 140), ref, 'comment'));
  }catch(e){ toast(e.message || 'Could not post.'); }
  btn.disabled = false;
}
function sheetHead(r, col, t, badges, actions){
  return '<div class="dlhd"><button class="icon-btn" data-act="closeSheet" aria-label="Back">' + icon('back') + '</button><h2>' + t + '</h2></div>' +
    '<div class="meta" style="margin:-6px 0 12px">' + badges + '</div>' + (actions ? '<div class="tools">' + actions + '</div>' : '');
}
function waBtn(text, to){ return '<a class="btn ghost sm" href="' + esc(waLink(text, to)) + '" target="_blank" rel="noopener">' + icon('wa') + 'WhatsApp</a>'; }
const kv = pairs => { const ps = pairs.filter(p => p[1] !== '' && p[1] != null && p[1] !== false); return ps.length ? '<dl class="kv">' + ps.map(([k, v]) => '<dt>' + esc(k) + '</dt><dd>' + v + '</dd>').join('') + '</dl>' : ''; };
function linkedTasks(ref){
  const ts = list('tasks').filter(t => t.ref === ref && !t.stage).sort(taskSort);
  return ts.length ? sec('Linked actions', listBox(ts.map(t => taskRow(t, {owner:true})))) : '';
}
function stageActions(col, r){
  const s = activeStage(r); if(!s) return '';
  const mod = WF[col].module, can = s.owner === me.email || (s.collab || []).includes(me.email) || canEdit(mod);
  let h = can ? '<button class="btn" data-act="doStage" data-id="' + esc(col + '/' + r.id + '/' + s.uid) + '">' + icon('check') + (s.owner === me.email || (s.collab || []).includes(me.email) ? 'Do this step' : 'Complete for ' + esc(firstName(s.owner))) + '</button>' : '';
  if(canEdit(mod)) h += '<button class="btn ghost sm" data-act="handover" data-id="' + esc(col + '/' + r.id) + '">' + icon('users') + 'Hand over this step</button>';
  return h;
}
const DETAIL = {
  tasks(t){
    const parent = t.ref ? t.ref.split('/') : null, pr = parent && get(parent[0], parent[1]);
    const msg = t.title + (t.due ? ', due ' + fmtDT(t.due) : '') + '. ' + appLink('tasks/' + t.id);
    const deps = (t.dependsOn || []).map(d => get('tasks', d)).filter(Boolean);
    return sheetHead(t, 'tasks', esc(t.title), statusBadge(t) + prioBadge(t.priority) + dueBadge(t) + brandTag(t.brand),
      (t.blocked ? '' : '<button class="btn' + (isDone(t) ? ' ghost' : ' ok') + '" data-act="tick" data-id="' + t.id + '">' + icon('check') + (isDone(t) ? 'Reopen' : t.stage ? 'Complete this step' : 'Mark done') + '</button>') +
      (!t.stage && !isDone(t) ? '<button class="btn ghost sm" data-act="editTask" data-id="' + t.id + '">Edit</button>' : '') +
      (!isDone(t) && !t.stage ? '<button class="btn ghost sm" data-act="quickStatus" data-id="' + t.id + '">Status</button>' : '') + waBtn(msg, t.owner !== me.email ? t.owner : '')) +
      (t.desc ? '<p class="pre">' + esc(t.desc) + '</p>' : '') +
      (pr ? '<div class="card click"' + openAttr(parent[0], parent[1]) + '><div class="meta" style="margin:0">Part of ' + esc((WF[parent[0]] || {}).name || ({legal:'Legal record', opps:'Partnership', recurring:'Recurring payment'})[parent[0]] || 'record') + '</div><h3>' + esc(recTitle(parent[0], pr)) + '</h3>' + miniSteps(pr) + '</div>' : '') +
      kv([['Responsible', avatar(t.owner, 1) + ' ' + esc(nameOf(t.owner))], ['Collaborators', (t.collab || []).map(c => esc(nameOf(c))).join(', ')], ['Deadline', esc(fmtDT(t.due))], ['Waiting on', esc(t.waitingOn || '')],
        ['Area', esc(modName(t.module))], ['Reminders', esc((REMINDER_SETS.find(x => x[0] === reminderKey(t.reminders)) || [])[1] || '')], ['Repeats', t.recur && t.recur !== 'none' ? esc(t.recur) : ''],
        ['Starts after', deps.map(d => esc(d.title) + (isDone(d) ? ' (done)' : '')).join('<br>')], ['Escalates', t.escalate ? 'Management is alerted if overdue' : ''],
        ['Created', esc(nameOf(t.by)) + ', ' + esc(fmtDT(t.at))], ['Completed', isDone(t) ? esc(nameOf(t.doneBy)) + ', ' + esc(fmtDT(t.doneAt)) + (t.doneNote ? ' · ' + esc(t.doneNote) : '') : '']]) +
      attHtml(t.files) + linksHtml(t.links);
  },
  payreqs(r){
    return sheetHead(r, 'payreqs', esc(r.title), wfStatus(r) + prioBadge(r.priority) + brandTag(r.brand), stageActions('payreqs', r) + (canEdit('finance') && r.status === 'open' ? '<button class="btn ghost sm" data-act="editRec" data-id="payreqs/' + r.id + '">Edit</button>' : '') + (isAdmin() && r.status === 'open' ? '<button class="btn ghost sm" data-act="cancelWf" data-id="payreqs/' + r.id + '">Cancel request</button>' : '') + waBtn('Payment request: ' + r.title + ', ' + money(r.amount, r.currency) + '. ' + appLink('payreqs/' + r.id))) +
      '<div class="big">' + money(r.amount, r.currency) + '</div>' +
      kv([['Pay by', esc(fmtD(r.deadline))], ['Entity', esc(r.entity || '')], ['Category', esc(r.cat || '')], ['Pay to', esc(r.payee || '')], ['Bank details', r.bank ? '<span class="pre">' + esc(r.bank) + '</span>' : ''],
        ['Taken on by', r.assignee ? esc(nameOf(r.assignee)) : '<span style="color:var(--amberink)">Nobody yet</span>'], ['From account', esc(r.account || '')], ['Paid', r.paidAmount != null ? money(r.paidAmount, r.currency) + ' on ' + esc(fmtD(r.paidOn)) : ''],
        ['In Zoho', r.zoho ? 'Yes' + (r.zohoRef ? ' (' + esc(r.zohoRef) + ')' : '') : ''], ['Requested by', esc(nameOf(r.by)) + ', ' + esc(fmtDT(r.at))], ['Notes', r.notes ? '<span class="pre">' + esc(r.notes) + '</span>' : '']]) +
      attHtml(r.files) + linksHtml(r.links) + sec('Steps', stagesHtml(r)) + linkedTasks('payreqs/' + r.id);
  },
  campaigns(r){
    const risk = campaignsAtRisk().includes(r);
    return sheetHead(r, 'campaigns', esc(r.name), wfStatus(r) + brandTag(r.brand) + (risk ? '<span class="b b-red">At risk</span>' : ''), stageActions('campaigns', r) + (r.status === 'open' && (canEdit('marketing') || r.by === me.email) ? '<button class="btn ghost sm" data-act="editRec" data-id="campaigns/' + r.id + '">Edit</button>' : '')) +
      (r.feedback && r.lastDecision === 'revise' && r.stage === 'submit' ? '<div class="notice"><b>Revisions requested:</b> ' + esc(r.feedback) + '</div>' : '') +
      kv([['Publish', esc(fmtDT(r.publishAt))], ['Approve by', esc(fmtDT(r.approveBy))], ['Schedule by', esc(fmtDT(r.scheduleBy))], ['Scheduled for', esc(fmtDT(r.scheduledFor))], ['Channels', esc(r.channels || '')],
        ['Prepared by', esc(nameOf(r.submitter))], ['Live post', r.liveUrl ? '<a href="' + esc(safeUrl(r.liveUrl)) + '" target="_blank" rel="noopener">' + esc(hostOf(r.liveUrl)) + '</a>' : ''], ['Revisions', r.revisions || '']]) +
      (r.content ? '<div class="card"><p class="pre" style="margin:0">' + esc(r.content) + '</p></div>' : '') + attHtml(r.files) + linksHtml(r.links) + sec('Steps', stagesHtml(r));
  },
  recons(r){
    const c = get('customers', r.customer);
    return sheetHead(r, 'recons', esc(r.title), wfStatus(r) + brandTag(r.brand), stageActions('recons', r) + (c ? '<button class="btn ghost sm"' + openAttr('customers', c.id) + '>Customer profile</button>' : '') + (c && c.phone ? waBtn('Hi ' + (c.contact || '') + ', please send your sales and stock figures for ' + ymLabel(r.month) + '.', '').replace('wa.me/?', 'wa.me/' + c.phone.replace(/[^\d]/g, '') + '?') : '')) +
      kv([['Reconciliation date', esc(fmtD(r.date))], ['Amount owed', r.amount != null ? money(r.amount, r.currency) : ''], ['Invoice', esc(r.invoice || '')], ['Payment due', esc(fmtD(r.payDue))], ['Received', r.received != null ? money(r.received, r.currency) + ' on ' + esc(fmtD(r.receivedOn)) : ''], ['In Zoho', r.zoho ? 'Yes' : ''],
        ['Customer arrangement', c && c.arrangement ? '<span class="pre">' + esc(c.arrangement) + '</span>' : ''], ['Zoho customer', c && c.zoho ? '<a href="' + esc(safeUrl(c.zoho)) + '" target="_blank" rel="noopener">Open in Zoho</a>' : '']]) +
      sec('Steps', stagesHtml(r)) + '<p class="hint">When this closes, next month\'s reconciliation is created automatically ' + (cfg().reconLead || 5) + ' days before its date.</p>';
  },
  suppliers(r){
    return sheetHead(r, 'suppliers', esc(r.title), wfStatus(r) + '<span class="b">' + esc(r.type || '') + '</span>' + brandTag(r.brand), stageActions('suppliers', r) + (r.status === 'open' && canEdit('suppliers') ? '<button class="btn ghost sm" data-act="editRec" data-id="suppliers/' + r.id + '">Edit</button>' : '')) +
      kv([['Supplier', esc(r.supplier || '')], ['Amount', r.amount ? money(r.amount, r.currency) : ''], ['Deadline', esc(fmtDT(r.due))], ['Paid', r.paidAmount != null ? money(r.paidAmount, r.currency) + ' on ' + esc(fmtD(r.paidOn)) : ''], ['Zoho updated', r.zoho ? 'Yes' : ''], ['Notes', r.notes ? '<span class="pre">' + esc(r.notes) + '</span>' : '']]) +
      attHtml(r.files) + linksHtml(r.links) + sec('Steps', stagesHtml(r));
  },
  customers(c){
    const rs = list('recons').filter(r => r.customer === c.id).sort(by('date', -1));
    const out = sumBy(rs.filter(r => r.status === 'open' && r.stage === 'collect'));
    return sheetHead(c, 'customers', esc(c.name), '<span class="b">' + esc(c.type || '') + '</span>' + brandTag(c.brand) + (c.active === false ? '<span class="b">Inactive</span>' : ''), (canEdit('customers') ? '<button class="btn ghost sm" data-act="editRec" data-id="customers/' + c.id + '">Edit</button><button class="btn ghost sm" data-act="newTaskFor" data-id="customers/' + c.id + '">' + icon('plus') + 'Action</button>' : '') + (c.phone ? '<a class="btn ghost sm" href="tel:' + esc(c.phone.replace(/\s/g, '')) + '">Call</a>' : '') + (c.zoho ? '<a class="btn ghost sm" href="' + esc(safeUrl(c.zoho)) + '" target="_blank" rel="noopener">Zoho</a>' : '')) +
      kv([['Outstanding', moneyMap(out)], ['Contact', esc(c.contact || '')], ['Phone', esc(c.phone || '')], ['Email', c.email ? '<a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a>' : ''], ['Address', c.address ? '<span class="pre">' + esc(c.address) + '</span>' : ''],
        ['Arrangement', c.arrangement ? '<span class="pre">' + esc(c.arrangement) + '</span>' : ''], ['Relationship manager', esc(nameOf(c.manager))], ['Reconciliation', c.reconDay ? 'Day ' + esc(c.reconDay) + ' of each month' : 'Not set'], ['Payment terms', c.terms != null ? esc(c.terms) + ' days' : ''], ['Notes', c.notes ? '<span class="pre">' + esc(c.notes) + '</span>' : '']]) +
      attHtml(c.files) + linksHtml(c.links) + sec('Reconciliations', rs.length ? listBox(rs.map(r => recRow('recons', r, esc(ymLabel(r.month)), r.amount != null ? '<span class="amt">' + money(r.amount, r.currency) + '</span>' : '', wfStatus(r)))) : empty('None yet.')) + linkedTasks('customers/' + c.id);
  },
  opps(o){
    const i = OPP_STAGES.indexOf(o.stage);
    return sheetHead(o, 'opps', esc(o.company), '<span class="b b-teal">' + esc(o.stage) + '</span>' + brandTag(o.brand), (canEdit('bizdev') ? '<button class="btn" data-act="editRec" data-id="opps/' + o.id + '">Update</button>' + (i > -1 && i < OPP_STAGES.length - 2 ? '<button class="btn ghost sm" data-act="oppNext" data-id="' + o.id + '">Move to ' + esc(OPP_STAGES[i + 1]) + '</button>' : '') : '')) +
      '<div class="mini">' + OPP_STAGES.slice(0, -1).map((s, k) => '<i class="' + (k < i ? 'd' : k === i ? 'a' : '') + '" title="' + esc(s) + '"></i>').join('') + '</div>' +
      kv([['Next action', o.nextAction ? esc(o.nextAction) + ' · ' + esc(fmtD(o.nextDate)) : '<span style="color:var(--redink)">Not set</span>'], ['Relationship manager', esc(nameOf(o.owner))], ['Contact', esc([o.contact, o.contactInfo].filter(Boolean).join(' · '))], ['Last communication', esc(fmtD(o.lastContact))], ['Opportunity', o.desc ? '<span class="pre">' + esc(o.desc) + '</span>' : ''], ['Notes', o.notes ? '<span class="pre">' + esc(o.notes) + '</span>' : '']]) +
      attHtml(o.files) + linksHtml(o.links) + linkedTasks('opps/' + o.id);
  },
  legal(x){
    const prs = list('payreqs').filter(p => p.legal === x.id);
    return sheetHead(x, 'legal', (x.sensitive ? icon('lock') + ' ' : '') + esc(x.title), '<span class="b">' + esc(x.type) + '</span><span class="b">' + esc(x.status) + '</span>' + brandTag(x.brand), (canEdit('legal') ? '<button class="btn" data-act="editRec" data-id="legal/' + x.id + '">Update</button><button class="btn ghost sm" data-act="newTaskFor" data-id="legal/' + x.id + '">' + icon('plus') + 'Action</button>' : '') + (canEdit('finance') ? '<button class="btn ghost sm" data-act="payFor" data-id="' + x.id + '">' + icon('money') + 'Payment request</button>' : '')) +
      kv([['Responsible', esc(nameOf(x.owner))], ['Entity', esc(x.entity || '')], ['Reference', esc(x.ref || '')], ['Issued', esc(fmtD(x.issued))], ['Expires or renews', x.renewal ? esc(fmtD(x.renewal)) + ' (' + (daysTo(x.renewal) < 0 ? 'expired' : 'in ' + daysTo(x.renewal) + ' days') + ')' : ''],
        ['Next action', x.nextAction ? esc(x.nextAction) + (x.nextDate ? ' · ' + esc(fmtD(x.nextDate)) : '') : ''], ['Visibility', x.sensitive ? 'Admins and ' + esc(firstName(x.owner)) + ' only' : 'Everyone with legal access'], ['Notes', x.notes ? '<span class="pre">' + esc(x.notes) + '</span>' : '']]) +
      attHtml(x.files) + linksHtml(x.links) + (prs.length ? sec('Payment requests', listBox(prs.map(p => recRow('payreqs', p, esc(p.title), '<span class="amt">' + money(p.amount, p.currency) + '</span>', wfStatus(p))))) : '') + linkedTasks('legal/' + x.id);
  },
  events(e){
    return sheetHead(e, 'events', esc(e.title), '<span class="b b-teal">Meeting</span>' + brandTag(e.brand), '<button class="btn ghost sm" data-act="editRec" data-id="events/' + e.id + '">Edit</button>') +
      kv([['When', esc(fmtDT(e.start)) + (e.end ? ' to ' + esc(fmtDT(e.end, 1)) : '')], ['Where', esc(e.place || '')], ['Who', (e.who || []).map(w => esc(nameOf(w))).join(', ')], ['Notes', e.notes ? '<span class="pre">' + esc(e.notes) + '</span>' : '']]) + linksHtml(e.links);
  },
  ledger(l){
    return sheetHead(l, 'ledger', esc(l.title), '<span class="b">' + esc({in:'Money in', out:'Money out', 'due-in':'Owed to us', 'due-out':'We owe'}[l.dir] || '') + '</span>' + brandTag(l.brand), canEdit('finance') ? '<button class="btn ghost sm" data-act="editRec" data-id="ledger/' + l.id + '">Edit</button>' : '') +
      '<div class="big">' + money(l.amount, l.currency) + '</div>' + kv([['Date', esc(fmtD(l.date))], ['Category', esc(l.cat || '')], ['Account', esc(l.account || '')], ['In Zoho', l.zoho ? 'Yes' : 'Not yet'], ['Recorded by', esc(nameOf(l.by))], ['Notes', l.notes ? '<span class="pre">' + esc(l.notes) + '</span>' : '']]) +
      (l.ref ? '<button class="link"' + openAttr(...l.ref.split('/')) + '>Open what this came from</button>' : '') + attHtml(l.files);
  },
  recurring(r){
    return sheetHead(r, 'recurring', esc(r.title), brandTag(r.brand) + (r.active === false ? '<span class="b">Paused</span>' : ''), canEdit('finance') ? '<button class="btn ghost sm" data-act="editRec" data-id="recurring/' + r.id + '">Edit</button>' : '') +
      '<div class="big">' + money(r.amount, r.currency) + '</div>' + kv([['How often', esc(r.every)], ['Next due', esc(fmtD(r.next))], ['Paid by', esc(nameOf(r.owner))], ['From account', esc(r.account || '')], ['Last paid', esc(fmtD(r.lastPaid))]]) + linkedTasks('recurring/' + r.id);
  },
  generic(r, col){ return sheetHead(r, col, esc(recTitle(col, r)), '', '') + kv(Object.entries(r).filter(([k, v]) => typeof v === 'string' && v && !['by','at','id'].includes(k)).map(([k, v]) => [k, esc(v)])); }
};
