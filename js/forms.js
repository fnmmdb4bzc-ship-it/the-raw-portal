/* The Raw Portal: forms, workflow step screens and quick capture. */
'use strict';

/* ---------- one form system for everything ---------- */
let F = null;
const peopleOpts = () => M.map(m => [m.email, nameOf(m.email)]);
const brandOpts = (blank = 'No specific brand') => [['', blank], ...cfg().brands.map(b => [b.name, b.name])];
const curOpts = () => cfg().currencies.map(c => [c, c]);
function opt(o, val){ const [v, l] = Array.isArray(o) ? o : [o, o]; return '<option value="' + esc(v) + '"' + (String(v) === String(val == null ? '' : val) ? ' selected' : '') + '>' + esc(l) + '</option>'; }
function fieldHtml(f, v){
  const n = 'name="' + f.k + '"', req = f.required ? ' required' : '', ph = f.ph ? ' placeholder="' + esc(f.ph) + '"' : '';
  const val = v == null ? '' : v;
  const lab = t => '<span>' + esc(t) + (f.required || f.type === 'check' ? '' : ' <small>(optional)</small>') + '</span>';
  if(f.type === 'note') return '<p class="hint" style="margin-top:0">' + f.label + '</p>';
  if(f.type === 'section') return '<div class="formsec">' + esc(f.label) + '</div>';
  if(f.type === 'check') return '<label class="cb"><input type="checkbox" ' + n + (val ? ' checked' : '') + '> ' + esc(f.label) + '</label>' + (f.hint ? '<p class="hint" style="margin-top:0">' + esc(f.hint) + '</p>' : '');
  if(f.type === 'checks') return '<fieldset class="f"><legend>' + esc(f.label) + '</legend><div class="cbs">' + f.options.map(([ov, ol]) => '<label class="cb"><input type="checkbox" ' + n + ' value="' + esc(ov) + '"' + ((val || []).includes(ov) ? ' checked' : '') + '> ' + esc(ol) + '</label>').join('') + '</div>' + (f.hint ? '<p class="hint" style="margin:4px 0 0">' + esc(f.hint) + '</p>' : '') + '</fieldset>';
  let inp;
  if(f.type === 'textarea') inp = '<textarea ' + n + req + ph + (f.rows ? ' rows="' + f.rows + '"' : '') + '>' + esc(val) + '</textarea>';
  else if(f.type === 'select') inp = '<select ' + n + req + '>' + f.options.map(o => opt(o, val)).join('') + '</select>';
  else if(f.type === 'files') inp = '<input type="file" multiple ' + n + (f.accept ? ' accept="' + f.accept + '"' : '') + '>' + (f.existing && f.existing.length ? '<div class="hint" style="margin:6px 0 0">Already attached: ' + f.existing.map(x => esc(x.name)).join(', ') + '</div>' : '') + (f.pending && f.pending.length ? '<div class="hint" style="margin:6px 0 0">From quick capture: ' + f.pending.map(x => esc(x.__name || x.name)).join(', ') + '</div>' : '');
  else if(f.type === 'photo') inp = '<input type="file" accept="image/*" ' + n + '>';
  else if(f.type === 'amount') inp = '<input type="text" inputmode="decimal" ' + n + req + ' placeholder="' + esc(f.ph || '53,000 or 162.36') + '" value="' + esc(val) + '">';
  else if(f.type === 'datetime') inp = '<input type="datetime-local" ' + n + req + ' value="' + esc(toLocalInput(val)) + '">';
  else inp = '<input type="' + (f.type || 'text') + '" ' + n + req + ph + (f.list ? ' list="dl-' + f.k + '"' : '') + (f.min != null ? ' min="' + f.min + '"' : '') + (f.max != null ? ' max="' + f.max + '"' : '') + ' value="' + esc(val) + '">' + (f.list ? '<datalist id="dl-' + f.k + '">' + f.list.map(o => '<option value="' + esc(o) + '">').join('') + '</datalist>' : '');
  return '<label class="f">' + lab(f.label) + inp + '</label>' + (f.hint ? '<p class="hint">' + esc(f.hint) + '</p>' : '');
}
function rowHtml(r, v){ return '<div class="row2">' + r.map(f => '<div>' + fieldHtml(f, v[f.k]) + '</div>').join('') + '</div>'; }
function openForm(o){
  F = o; const v = o.values || {};
  $('#fTitle').textContent = o.title;
  $('#fBody').innerHTML = (o.intro || '') + o.fields.map(f => Array.isArray(f) ? rowHtml(f, v) : fieldHtml(f, v[f.k])).join('');
  $('#fErr').textContent = ''; $('#fSave').textContent = o.saveLabel || 'Save'; $('#fSave').disabled = false;
  const d = $('#fDel'); d.hidden = !o.onDelete; d.textContent = o.deleteLabel || 'Delete'; d.dataset.armed = '';
  if(!$('#dlg').open) $('#dlg').showModal();
  $('#dlg .dl').scrollTop = 0;
  if(o.focus){ const el = $('#fBody [name="' + o.focus + '"]'); if(el) setTimeout(() => el.focus(), 60); }
}
$('#fCancel').onclick = () => $('#dlg').close();
$('#fDel').onclick = () => {
  const d = $('#fDel');
  if(!d.dataset.armed){ d.dataset.armed = '1'; d.textContent = 'Tap again to confirm'; return; }
  const fn = F.onDelete; $('#dlg').close(); fn();
};
$('#dlgForm').addEventListener('submit', async e => {
  e.preventDefault(); if(!F) return;
  const form = e.target, out = {};
  const all = F.fields.flat();
  for(const f of all){
    if(f.type === 'note' || f.type === 'section') continue;
    if(f.type === 'check'){ out[f.k] = form.elements[f.k].checked; continue; }
    if(f.type === 'checks'){ out[f.k] = [...form.querySelectorAll('input[name="' + f.k + '"]:checked')].map(x => x.value); continue; }
    const el = form.elements[f.k];
    if(f.type === 'files'){ out[f.k] = [...el.files, ...(f.pending || [])]; if(f.required && !out[f.k].length && !(f.existing || []).length){ $('#fErr').textContent = 'Please attach ' + f.label.toLowerCase() + '.'; return; } continue; }
    if(f.type === 'photo'){ out[f.k] = el.files[0] || null; if(f.required && !out[f.k]){ $('#fErr').textContent = 'Please choose a photo.'; return; } continue; }
    let v = el.value.trim();
    if(f.required && !v){ $('#fErr').textContent = 'Please fill in: ' + f.label + '.'; el.focus(); return; }
    if(f.type === 'amount' && v){ v = parseAmount(v); if(isNaN(v) || v < 0){ $('#fErr').textContent = f.label + ' must be an amount, for example 53,000 or 162.36.'; el.focus(); return; } }
    if(f.type === 'amount' && v === '') v = null;
    if(f.type === 'datetime') v = fromLocalInput(v);
    if(f.type === 'number' && v !== '') v = Number(v);
    out[f.k] = v;
  }
  $('#fSave').disabled = true; $('#fSave').textContent = 'Saving';
  try { await F.onSave(out); if($('#dlg').open && F && !F.keepOpen) $('#dlg').close(); }
  catch(err){ $('#fErr').textContent = (err && err.message) || 'Something went wrong.'; $('#fSave').disabled = false; $('#fSave').textContent = F.saveLabel || 'Save'; }
});
const linksField = (label) => ({k:'linksText', label: label || 'Links (Zoho, Google Drive, Planable), one per line', type:'textarea', rows:2, ph:'Zoho invoice https://...'});
function requireEdit(mod){ if(!canEdit(mod)) { toast('You can view this but not change it. Ask an admin for access.'); return false; } return true; }

/* ---------- tasks ---------- */
function taskForm(id, o){
  o = o || {};
  const cur = id ? get('tasks', id) : null;
  if(cur && cur.stage) return openStageForm(...cur.ref.split('/'), cur.stage);
  const others = openTasks().filter(t => t.id !== id).sort(taskSort).slice(0, 60);
  const v = cur ? Object.assign({}, cur, {remKey: reminderKey(cur.reminders), linksText: linksText(cur.links), after: (cur.dependsOn || [])[0] || ''})
    : Object.assign({owner: me.email, priority:'normal', status:'awaiting', module:'general', brand: ui.brand !== 'all' ? ui.brand : '', remKey:'standard', recur:'none', due: dayEnd(addMonths(TODAY(), 0), 17)}, o.values || {});
  openForm({ title: cur ? 'Edit action' : o.title || 'New action', values: v, focus: cur ? null : 'title',
    fields: [
      {k:'title', label:'What needs to happen', required:true, ph:'Send proof of payment to the lawyers'},
      {k:'desc', label:'Details', type:'textarea', rows:3},
      [{k:'owner', label:'Who is responsible', type:'select', options: peopleOpts()}, {k:'due', label:'Deadline', type:'datetime'}],
      {k:'collab', label:'Collaborators', type:'checks', options: peopleOpts().filter(p => p[0] !== v.owner)},
      [{k:'priority', label:'Priority', type:'select', options: PRIORITY}, {k:'status', label:'Status', type:'select', options: STATUS}],
      {k:'waitingOn', label:'Waiting on (if someone outside the team)', ph:'Lawyers, supplier, customer...', hint:'Set the status to "Awaiting external response" and the deadline becomes the follow-up date.'},
      [{k:'module', label:'Area', type:'select', options: MODULE_OF_TASK}, {k:'brand', label:'Brand', type:'select', options: brandOpts()}],
      {type:'section', label:'Reminders and repeats'},
      {k:'remKey', label:'Reminders', type:'select', options: REMINDER_SETS.map(r => [r[0], r[1]])},
      {k:'escalate', label:'Alert management if this becomes overdue', type:'check', hint:'Critical actions always alert management.'},
      [{k:'recur', label:'Repeats', type:'select', options:[['none','Does not repeat'],['daily','Every day'],['weekly','Every week'],['monthly','Every month'],['quarterly','Every 3 months'],['yearly','Every year']]},
       {k:'after', label:'Starts after', type:'select', options:[['','Can start now'], ...others.map(t => [t.id, t.title.slice(0, 60)])]}],
      {type:'section', label:'Files and links'},
      {k:'files', label:'Attach files, photos or screenshots', type:'files', existing: cur ? cur.files : [], pending: o.files},
      linksField()
    ],
    onSave: async x => {
      if(x.status === 'external' && !x.due) throw new Error('Add a follow-up date for anything awaiting an external response.');
      const files = await uploadAll(x.files);
      const data = {title:x.title, desc:x.desc, owner:x.owner, collab:x.collab.filter(c => c !== x.owner), due:x.due, priority:x.priority, status:x.status, module:x.module, brand:x.brand,
        waitingOn:x.waitingOn, reminders: REMINDER_SETS.find(r => r[0] === x.remKey)[2], escalate:x.escalate || x.priority === 'critical', recur:x.recur, dependsOn: x.after ? [x.after] : [], links: parseLinks(x.linksText)};
      if(!cur){ data.files = files; const nid = createTask(Object.assign(data, o.extra || {})); if(o.after) o.after(nid); toast(x.owner === me.email ? 'Added to your actions.' : 'Sent to ' + firstName(x.owner) + '.'); return; }
      data.files = [...(cur.files || []), ...files];
      if(x.status === 'done' && !isDone(cur)){ Object.assign(data, {doneAt:new Date().toISOString(), doneBy: me.email}); }
      data.blocked = data.dependsOn.some(d => { const t = get('tasks', d); return t && !isDone(t); });
      patch('tasks', id, data);
      if(cur.owner !== x.owner){ notify(x.owner, 'Handed to you', x.title, 'tasks/' + id, 'assigned'); logAct('tasks/' + id, 'handed this to ' + nameOf(x.owner)); }
      if(cur.due !== x.due && x.due) logAct('tasks/' + id, 'moved the deadline to ' + fmtDT(x.due));
      if(cur.status !== x.status) logAct('tasks/' + id, 'set the status to ' + STATUS_LABEL[x.status]);
    },
    onDelete: cur && (cur.by === me.email || isAdmin()) ? () => { del('tasks', id); closeSheet(); } : null
  });
}

/* ---------- workflow records ---------- */
function payreqForm(id, o){
  o = o || {};
  if(!requireEdit('finance') && !id) return;
  const cur = id ? get('payreqs', id) : null, c = cfg();
  const v = cur ? Object.assign({}, cur, {linksText: linksText(cur.links)}) : Object.assign({currency: c.currencies[0], entity: c.entities[0], priority:'normal', brand: ui.brand !== 'all' ? ui.brand : ''}, o.values || {});
  openForm({ title: cur ? 'Edit payment request' : 'New payment request', values: v, focus: cur ? null : 'title',
    intro: cur ? '' : '<p class="hint" style="margin-top:0">The app coordinates the payment; nobody pays from here. Charlie, Dale and Rhiannon are told, one of them takes it on, pays and uploads proof, then it is followed up and captured in Zoho.</p>',
    fields: [
      {k:'title', label:'What is it for', required:true, ph:"Lawyer's invoice for Dale's work permit"},
      [{k:'amount', label:'Amount', type:'amount', required:true}, {k:'currency', label:'Currency', type:'select', options: curOpts()}],
      [{k:'deadline', label:'Pay by', type:'date', required:true}, {k:'priority', label:'Priority', type:'select', options: PRIORITY}],
      [{k:'entity', label:'Business entity', type:'select', options: c.entities}, {k:'brand', label:'Brand', type:'select', options: brandOpts()}],
      {k:'cat', label:'Category', type:'select', options: c.finCats},
      {k:'payee', label:'Pay to', ph:'Name of the firm or person'},
      {k:'bank', label:'Bank details for the payment', type:'textarea', rows:3, hint:'Everyone with finance access can see these. Never put card numbers or passwords here.'},
      {k:'notes', label:'Notes', type:'textarea', rows:2},
      {k:'files', label:'Invoice', type:'files', existing: cur ? cur.files : [], pending: o.files},
      linksField('Links (Zoho, Google Drive), one per line')
    ],
    onSave: async x => {
      const files = await uploadAll(x.files);
      const data = {title:x.title, amount:x.amount, currency:x.currency, deadline:x.deadline, priority:x.priority, entity:x.entity, brand:x.brand, cat:x.cat, payee:x.payee, bank:x.bank, notes:x.notes, links: parseLinks(x.linksText)};
      if(cur){ data.files = [...(cur.files || []), ...files]; patch('payreqs', id, data); logAct('payreqs/' + id, 'edited the request'); return; }
      const nid = newId(), rec = Object.assign(data, {files}, o.extra || {}, stamp());
      startWorkflow('payreqs', nid, rec);
      logAct('payreqs/' + nid, 'requested ' + money(x.amount, x.currency));
      toast('Payment request sent.');
    },
    onDelete: cur && isAdmin() ? () => { cancelWorkflow('payreqs', id, 'Deleted'); del('payreqs', id); closeSheet(); } : null
  });
}
function campaignForm(id, o){
  o = o || {};
  const cur = id ? get('campaigns', id) : null, c = cfg();
  const pub = cur ? cur.publishAt : dayEnd(addMonths(TODAY(), 0), 9);
  const v = cur ? Object.assign({}, cur, {linksText: linksText(cur.links)}) : Object.assign({submitter: me.email, scheduler: roleEmail('charlie'), brand: ui.brand !== 'all' ? ui.brand : (c.brands[1] || c.brands[0]).name, submitNow:true}, o.values || {});
  openForm({ title: cur ? 'Edit campaign' : 'New campaign', values: v, focus: cur ? null : 'name',
    intro: cur ? '' : '<p class="hint" style="margin-top:0">Leave the approval and scheduling dates blank and they are set to 3 days and 1 day before publication.</p>',
    fields: [
      {k:'name', label:'Campaign or post', required:true, ph:'Combat Monday reel'},
      [{k:'brand', label:'Brand', type:'select', options: brandOpts('Group-wide')}, {k:'channels', label:'Channels', ph:'Instagram, TikTok'}],
      {k:'content', label:'Content, caption or brief', type:'textarea', rows:4},
      {k:'files', label:'Images, video or drafts', type:'files', existing: cur ? cur.files : [], pending: o.files},
      linksField('Links (Planable post, Google Drive), one per line'),
      {type:'section', label:'Deadlines'},
      {k:'publishAt', label:'Publish on', type:'datetime', required:true},
      [{k:'approveBy', label:'Approve by', type:'datetime'}, {k:'scheduleBy', label:'Schedule by', type:'datetime'}],
      [{k:'submitter', label:'Prepared by', type:'select', options: peopleOpts()}, {k:'scheduler', label:'Scheduled by', type:'select', options: peopleOpts()}]
    ].concat(cur ? [] : [{k:'submitNow', label:'Submit for approval now', type:'check', hint:'Untick to save it as a draft; the person preparing it gets an action to submit.'}]),
    onSave: async x => {
      if(!x.publishAt) throw new Error('Add the publish date.');
      const files = await uploadAll(x.files);
      const data = {name:x.name, brand:x.brand, channels:x.channels, content:x.content, links: parseLinks(x.linksText), publishAt:x.publishAt,
        approveBy: x.approveBy || isoPlus(x.publishAt, -3), scheduleBy: x.scheduleBy || isoPlus(x.publishAt, -1), submitter:x.submitter, scheduler:x.scheduler};
      if(new Date(data.approveBy) > new Date(data.publishAt) || new Date(data.scheduleBy) > new Date(data.publishAt)) throw new Error('Approval and scheduling must be before publication.');
      if(cur){ data.files = [...(cur.files || []), ...files]; patch('campaigns', id, data); logAct('campaigns/' + id, 'edited the campaign'); return; }
      const nid = newId(), rec = Object.assign(data, {files}, stamp());
      startWorkflow('campaigns', nid, rec, {quiet: x.submitNow && x.submitter === me.email});
      logAct('campaigns/' + nid, 'created the campaign');
      if(x.submitNow && x.submitter === me.email){ await completeStage('campaigns', nid, 's0', {content: x.content, note:'Submitted for approval'}); toast('Submitted to ' + firstName(roleEmail('stacey')) + ' for approval.'); }
      else toast('Campaign saved.');
    },
    onDelete: cur && (isAdmin() || cur.by === me.email) ? () => { cancelWorkflow('campaigns', id, 'Deleted'); del('campaigns', id); closeSheet(); } : null
  });
}
function customerForm(id){
  if(!requireEdit('customers')) return;
  const cur = id ? get('customers', id) : null, c = cfg();
  const v = cur ? Object.assign({}, cur, {linksText: linksText(cur.links)}) : {type: c.custTypes[0], manager: roleEmail('charlie'), reconDay: 28, terms: 14, currency: c.currencies[c.currencies.length > 1 ? 1 : 0], active:true, brand: ui.brand !== 'all' ? ui.brand : ''};
  openForm({ title: cur ? 'Edit customer' : 'New customer or stockist', values: v, focus: cur ? null : 'name',
    fields: [
      {k:'name', label:'Business name', required:true},
      [{k:'type', label:'Type', type:'select', options: c.custTypes}, {k:'brand', label:'Main brand', type:'select', options: brandOpts('Several brands')}],
      [{k:'contact', label:'Contact person'}, {k:'phone', label:'Phone', type:'tel'}],
      {k:'email', label:'Email', type:'email'},
      {k:'address', label:'Address', type:'textarea', rows:2},
      {k:'arrangement', label:'Commercial arrangement', type:'textarea', rows:3, ph:'Consignment, 30% margin, stock counted monthly'},
      {type:'section', label:'Monthly reconciliation'},
      [{k:'reconDay', label:'Reconciliation day of the month', type:'number', min:1, max:31}, {k:'terms', label:'Payment due (days after invoice)', type:'number', min:0, max:120}],
      [{k:'manager', label:'Relationship manager', type:'select', options: peopleOpts()}, {k:'currency', label:'Currency', type:'select', options: curOpts()}],
      {k:'active', label:'Active (create the monthly reconciliation automatically)', type:'check'},
      {k:'since', label:'First reconciliation from', type:'date'},
      {type:'section', label:'Records'},
      {k:'zoho', label:'Zoho customer link', type:'url', ph:'https://books.zoho.com/...'},
      linksField('Other links, one per line'),
      {k:'notes', label:'Notes', type:'textarea', rows:3},
      {k:'files', label:'Agreements and documents', type:'files', existing: cur ? cur.files : []}
    ],
    onSave: async x => {
      const files = await uploadAll(x.files);
      const data = Object.assign({}, x, {links: parseLinks(x.linksText)}); delete data.linksText; delete data.files;
      if(cur){ data.files = [...(cur.files || []), ...files]; patch('customers', id, data); logAct('customers/' + id, 'edited the profile'); }
      else { const nid = newId(); put('customers', nid, Object.assign(data, {files}, stamp())); logAct('customers/' + nid, 'added this customer'); }
      setTimeout(generateRecurring, 300);
    },
    onDelete: cur && isAdmin() ? () => { del('customers', id); closeSheet(); } : null
  });
}
const SUPPLIER_TYPES = ['Deposit payment', 'Balance payment', 'Order follow-up', 'Delivery follow-up', 'Quotation follow-up', 'Stock check', 'Restock follow-up', 'Stock adjustment in Zoho', 'Other'];
function supplierForm(id, o){
  o = o || {};
  const cur = id ? get('suppliers', id) : null, c = cfg();
  const v = cur ? Object.assign({}, cur, {linksText: linksText(cur.links)}) : Object.assign({type: SUPPLIER_TYPES[0], currency: c.currencies[0], owner: roleEmail('charlie'), due: dayEnd(addMonths(TODAY(), 0)), brand: ui.brand !== 'all' ? ui.brand : ''}, o.values || {});
  openForm({ title: cur ? 'Edit follow-up' : 'New supplier or stock follow-up', values: v, focus: cur ? null : 'title',
    intro: cur ? '' : '<p class="hint" style="margin-top:0">Supplier records, orders and stock stay in Zoho. This tracks who must do what by when, and that Zoho gets updated.</p>',
    fields: [
      {k:'title', label:'What', required:true, ph:'Deposit for tub order'},
      [{k:'supplier', label:'Supplier', list: uniq(list('suppliers').map(s => s.supplier))}, {k:'type', label:'Type', type:'select', options: SUPPLIER_TYPES}],
      [{k:'amount', label:'Amount', type:'amount'}, {k:'currency', label:'Currency', type:'select', options: curOpts()}],
      [{k:'owner', label:'Who is responsible', type:'select', options: peopleOpts()}, {k:'due', label:'Deadline', type:'datetime', required:true}],
      {k:'brand', label:'Brand', type:'select', options: brandOpts()},
      {k:'notes', label:'Notes', type:'textarea', rows:3},
      {k:'files', label:'Quote, order or invoice', type:'files', existing: cur ? cur.files : [], pending: o.files},
      linksField('Zoho or other links, one per line')
    ],
    onSave: async x => {
      if(!x.due) throw new Error('Add a deadline.');
      const files = await uploadAll(x.files);
      const data = Object.assign({}, x, {links: parseLinks(x.linksText)}); delete data.linksText; delete data.files;
      if(cur){ data.files = [...(cur.files || []), ...files]; patch('suppliers', id, data); const s = activeStage(cur); if(s && s.key === 'action' && s.task){ patch('tasks', s.task, {due: x.due, owner: x.owner}); } logAct('suppliers/' + id, 'edited the follow-up'); return; }
      const nid = newId();
      startWorkflow('suppliers', nid, Object.assign(data, {files}, stamp()));
      logAct('suppliers/' + nid, 'created the follow-up');
      toast('Follow-up created.');
    },
    onDelete: cur && (isAdmin() || cur.by === me.email) ? () => { cancelWorkflow('suppliers', id, 'Deleted'); del('suppliers', id); closeSheet(); } : null
  });
}
const OPP_STAGES = ['New opportunity', 'Contact established', 'Meeting', 'Proposal submitted', 'Negotiation', 'Agreement', 'Onboarding', 'Active partnership', 'Closed'];
function oppForm(id, o){
  o = o || {};
  if(!requireEdit('bizdev')) return;
  const cur = id ? get('opps', id) : null;
  const v = cur ? Object.assign({}, cur, {linksText: linksText(cur.links)}) : {stage: OPP_STAGES[0], owner: roleEmail('stacey'), nextDate: ymd(new Date(Date.now() + 3 * DAY)), brand: ui.brand !== 'all' ? ui.brand : ''};
  openForm({ title: cur ? 'Edit opportunity' : 'New opportunity', values: v, focus: o.focusNext ? 'nextAction' : cur ? null : 'company',
    intro: o.focusNext ? '<div class="notice">What is the next step for this one? Every active opportunity needs a next action and date.</div>' : '',
    fields: [
      {k:'company', label:'Company', required:true},
      [{k:'contact', label:'Contact person'}, {k:'contactInfo', label:'Phone or email'}],
      [{k:'brand', label:'Brand', type:'select', options: brandOpts('Group-wide')}, {k:'stage', label:'Stage', type:'select', options: OPP_STAGES}],
      {k:'desc', label:'Opportunity', type:'textarea', rows:3},
      [{k:'owner', label:'Relationship manager', type:'select', options: peopleOpts()}, {k:'lastContact', label:'Last communication', type:'date'}],
      {type:'section', label:'Next step'},
      {k:'nextAction', label:'Next action', ph:'Send the revised proposal', required: true},
      {k:'nextDate', label:'By', type:'date', required:true},
      {k:'files', label:'Proposal or documents', type:'files', existing: cur ? cur.files : []},
      linksField(),
      {k:'notes', label:'Notes', type:'textarea', rows:2}
    ],
    onSave: async x => {
      const files = await uploadAll(x.files);
      const data = Object.assign({}, x, {links: parseLinks(x.linksText)}); delete data.linksText; delete data.files;
      let rid = id;
      if(cur){ data.files = [...(cur.files || []), ...files]; patch('opps', id, data); if(cur.stage !== x.stage) logAct('opps/' + id, 'moved it to ' + x.stage); }
      else { rid = newId(); put('opps', rid, Object.assign(data, {files}, stamp())); logAct('opps/' + rid, 'added this opportunity'); }
      setTimeout(() => syncNext('opps', rid), 50);
    },
    onDelete: cur && isAdmin() ? () => { del('opps', id); ['next'].forEach(k => del('tasks', 'opps-' + id + '-' + k)); closeSheet(); } : null
  });
}
const LEGAL_STATUS = ['Active', 'In progress', 'Awaiting external response', 'Renewal due', 'Expired', 'Closed'];
function legalForm(id, o){
  o = o || {};
  if(!requireEdit('legal')) return;
  const cur = id ? get('legal', id) : null, c = cfg();
  const v = cur ? Object.assign({}, cur, {linksText: linksText(cur.links)}) : {type: c.legalTypes[0], status:'Active', owner: roleEmail('charlie'), entity: c.entities[0]};
  openForm({ title: cur ? 'Edit record' : 'New legal or compliance record', values: v, focus: o.focusNext ? 'nextAction' : cur ? null : 'title',
    intro: o.focusNext ? '<div class="notice">What is the next step, or the new renewal date?</div>' : '',
    fields: [
      {k:'title', label:'Name', required:true, ph:"Dale's work permit"},
      [{k:'type', label:'Type', type:'select', options: c.legalTypes}, {k:'status', label:'Status', type:'select', options: LEGAL_STATUS}],
      [{k:'entity', label:'Business entity', type:'select', options: c.entities}, {k:'brand', label:'Brand', type:'select', options: brandOpts()}],
      {k:'owner', label:'Who is responsible', type:'select', options: peopleOpts()},
      {k:'ref', label:'Reference or registration number'},
      [{k:'issued', label:'Issued', type:'date'}, {k:'renewal', label:'Expires or renews', type:'date'}],
      {type:'section', label:'Next step'},
      {k:'nextAction', label:'Next action', ph:'Lawyers to submit stage 2 documents'},
      {k:'nextDate', label:'By', type:'date'},
      {k:'sensitive', label:'Sensitive: only admins and the responsible person can see it', type:'check'},
      {k:'files', label:'Documents', type:'files', existing: cur ? cur.files : []},
      linksField(),
      {k:'notes', label:'Notes', type:'textarea', rows:3}
    ],
    onSave: async x => {
      if(x.nextAction && !x.nextDate) throw new Error('Add a date for the next action.');
      const files = await uploadAll(x.files);
      const data = Object.assign({}, x, {links: parseLinks(x.linksText)}); delete data.linksText; delete data.files;
      let rid = id;
      if(cur){ data.files = [...(cur.files || []), ...files]; patch('legal', id, data); logAct('legal/' + id, 'updated the record'); }
      else { rid = newId(); put('legal', rid, Object.assign(data, {files}, stamp())); logAct('legal/' + rid, 'added this record'); }
      setTimeout(() => syncNext('legal', rid), 50);
    },
    onDelete: cur && isAdmin() ? () => { del('legal', id); ['next','renew'].forEach(k => del('tasks', 'legal-' + id + '-' + k)); closeSheet(); } : null
  });
}
function ledgerForm(id, o){
  o = o || {};
  if(!requireEdit('finance')) return;
  const cur = id ? get('ledger', id) : null, c = cfg();
  const v = cur || Object.assign({dir:'out', currency: c.currencies[0], date: TODAY(), cat: c.finCats[0], account: c.accounts[0], brand: ui.brand !== 'all' ? ui.brand : ''}, o.values || {});
  openForm({ title: cur ? 'Edit entry' : 'Record money in or out', values: v, focus: cur ? null : 'title',
    intro: cur ? '' : '<p class="hint" style="margin-top:0">Zoho stays the accounting record. These entries give the team the weekly picture until Zoho is connected.</p>',
    fields: [
      {k:'dir', label:'Money', type:'select', options:[['out','Out (paid)'], ['in','In (received)'], ['due-in','Receivable (owed to us)'], ['due-out','Commitment (we owe)']]},
      {k:'title', label:'Description', required:true},
      [{k:'amount', label:'Amount', type:'amount', required:true}, {k:'currency', label:'Currency', type:'select', options: curOpts()}],
      [{k:'date', label:'Date (or due date)', type:'date', required:true}, {k:'account', label:'Account', type:'select', options: [['', 'Not set'], ...c.accounts.map(a => [a, a])]}],
      [{k:'cat', label:'Category', type:'select', options: c.finCats}, {k:'brand', label:'Brand', type:'select', options: brandOpts()}],
      {k:'zoho', label:'Captured in Zoho', type:'check'},
      {k:'notes', label:'Notes', type:'textarea', rows:2},
      {k:'files', label:'Receipt or proof', type:'files', existing: cur ? cur.files : [], pending: o.files}
    ],
    onSave: async x => {
      const files = await uploadAll(x.files);
      const data = Object.assign({}, x); delete data.files;
      if(cur){ data.files = [...(cur.files || []), ...files]; patch('ledger', id, data); }
      else put('ledger', newId(), Object.assign(data, {files}, stamp()));
    },
    onDelete: cur ? () => { del('ledger', id); closeSheet(); } : null
  });
}
function recurringForm(id){
  if(!requireEdit('finance')) return;
  const cur = id ? get('recurring', id) : null, c = cfg();
  const v = cur || {every:'monthly', currency: c.currencies[0], next: TODAY(), owner: roleEmail('rhiannon'), account: c.accounts[0], cat: c.finCats[0], active:true};
  openForm({ title: cur ? 'Edit recurring payment' : 'New recurring payment', values: v, focus: cur ? null : 'title',
    intro: '<p class="hint" style="margin-top:0">A week before each due date, the person responsible gets an action to pay it. Ticking it records the payment and moves the date on.</p>',
    fields: [
      {k:'title', label:'What', required:true, ph:'Office rent'},
      [{k:'amount', label:'Amount', type:'amount', required:true}, {k:'currency', label:'Currency', type:'select', options: curOpts()}],
      [{k:'every', label:'How often', type:'select', options:[['weekly','Every week'],['monthly','Every month'],['quarterly','Every 3 months'],['yearly','Every year']]}, {k:'next', label:'Next due', type:'date', required:true}],
      [{k:'owner', label:'Who pays it', type:'select', options: peopleOpts()}, {k:'account', label:'From account', type:'select', options: c.accounts}],
      [{k:'cat', label:'Category', type:'select', options: c.finCats}, {k:'brand', label:'Brand', type:'select', options: brandOpts()}],
      {k:'active', label:'Active', type:'check'}
    ],
    onSave: x => { if(cur) patch('recurring', id, x); else put('recurring', newId(), Object.assign(x, stamp())); setTimeout(generateRecurring, 300); },
    onDelete: cur ? () => { del('recurring', id); closeSheet(); } : null
  });
}
function eventForm(id, o){
  o = o || {};
  const cur = id ? get('events', id) : null;
  const v = cur ? Object.assign({}, cur, {linksText: linksText(cur.links)}) : Object.assign({start: dayEnd(ui.route === 'calendar' ? ui.calDay : TODAY(), 10), who:[me.email], brand: ui.brand !== 'all' ? ui.brand : ''}, o.values || {});
  openForm({ title: cur ? 'Edit meeting or event' : 'New meeting or event', values: v, focus: cur ? null : 'title',
    fields: [
      {k:'title', label:'What', required:true},
      [{k:'start', label:'Starts', type:'datetime', required:true}, {k:'end', label:'Ends', type:'datetime'}],
      {k:'place', label:'Where or call link'},
      {k:'who', label:'Who', type:'checks', options: peopleOpts()},
      {k:'brand', label:'Brand', type:'select', options: brandOpts()},
      {k:'notes', label:'Notes or agenda', type:'textarea', rows:3},
      linksField('Links, one per line')
    ],
    onSave: x => {
      if(!x.start) throw new Error('Add when it starts.');
      if(x.end && x.end < x.start) throw new Error('It ends before it starts.');
      const data = Object.assign({}, x, {links: parseLinks(x.linksText)}); delete data.linksText;
      if(cur) patch('events', id, data);
      else { const nid = newId(); put('events', nid, Object.assign(data, stamp())); x.who.forEach(e => notify(e, 'New meeting', x.title + ', ' + fmtDT(x.start), 'events/' + nid, 'event')); }
    },
    onDelete: cur ? () => { del('events', id); closeSheet(); } : null
  });
}
function fileForm(id, o){
  o = o || {};
  const cur = id ? get('files', id) : null, c = cfg();
  openForm({ title: cur ? 'Edit document' : 'Add a document', values: cur || Object.assign({folder: ui.docFilter !== 'all' ? ui.docFilter : c.folders[0], brand: ui.brand !== 'all' ? ui.brand : ''}, o.values || {}),
    intro: cur ? '' : '<p class="hint" style="margin-top:0">Upload a file, or paste a link to something already in Google Drive or Zoho so it is not stored twice.</p>',
    fields: [
      {k:'file', label: cur && cur.path ? 'Replace the file' : 'File', type:'files', pending: o.files},
      {k:'url', label:'Or a link to it', type:'url', ph:'https://drive.google.com/...'},
      {k:'title', label:'Title', required:true},
      [{k:'folder', label:'Folder', required:true, list: uniq([...c.folders, ...list('files').map(f => f.folder)])}, {k:'brand', label:'Brand', type:'select', options: brandOpts()}],
      {k:'restricted', label:'Admins only', type:'check', hint:'Only admins and whoever added it can see it.'},
      {k:'notes', label:'Notes', type:'textarea', rows:2}
    ],
    onSave: async x => {
      const fl = x.file || [];
      if(!cur && !fl.length && !x.url) throw new Error('Choose a file or paste a link.');
      const data = {title:x.title, folder:x.folder, brand:x.brand, notes:x.notes, url:x.url, sensitive: x.restricted, restricted: x.restricted};
      if(fl.length) Object.assign(data, await uploadFile(fl[0], fl[0].__name));
      if(cur){ if(fl.length && cur.path) sb.storage.from('files').remove([cur.path]).then(() => {}); patch('files', id, data); }
      else put('files', newId(), Object.assign(data, stamp()));
    },
    onDelete: cur ? () => { if(cur.path) sb.storage.from('files').remove([cur.path]).then(() => {}); del('files', id); } : null
  });
}

/* ---------- finishing a workflow step ---------- */
function openStageForm(col, id, uid){
  const rec = get(col, id); if(!rec) return toast('This record is not available to you.');
  const s = (rec.stages || []).find(x => x.uid === uid);
  if(!s) return;
  if(s.status !== 'active') return openRecord(col, id);
  const c = cfg(), f = [], vals = {paidOn: TODAY(), currency: rec.currency || c.currencies[0]};
  const n = s.needs || [];
  const mine = s.owner === me.email || (s.collab || []).includes(me.email);
  let intro = '<div class="card" style="margin-bottom:14px"><h3>' + esc(recTitle(col, rec)) + '</h3><div class="meta">' + (rec.amount != null ? '<span class="amt">' + money(rec.amount, rec.currency) + '</span>' : '') + (rec.deadline ? 'pay by ' + esc(fmtD(rec.deadline)) : '') + (rec.publishAt ? 'publishes ' + esc(fmtDT(rec.publishAt)) : '') + brandTag(rec.brand) + '</div>' + miniSteps(rec) + '</div>';
  if(!mine) intro += '<div class="notice">This step belongs to ' + esc(nameOf(s.owner)) + '. You can complete it on their behalf.</div>';
  if(n.includes('account')){
    intro += rec.payee || rec.bank ? '<dl class="kv">' + (rec.payee ? '<dt>Pay to</dt><dd>' + esc(rec.payee) + '</dd>' : '') + (rec.bank ? '<dt>Bank details</dt><dd class="pre">' + esc(rec.bank) + '</dd>' : '') + '</dl>' : '';
    f.push({type:'note', label:'Taking this on means you will make the payment. Nobody else can take it once you have.'});
    f.push({k:'account', label:'Pay from', type:'select', options: c.accounts, required:true});
  }
  if(n.includes('paid')){ f.push([{k:'paidAmount', label:'Amount paid', type:'amount', required:true}, {k:'paidOn', label:'Paid on', type:'date', required:true}]); vals.paidAmount = rec.amount; }
  if(n.includes('proof')) f.push({k:'files', label:'Proof of payment', type:'files', required: col === 'payreqs'});
  if(n.includes('content')){ f.push({k:'content', label:'Content, caption or brief', type:'textarea', rows:5}); f.push({k:'files', label:'Images, video or drafts', type:'files', existing: rec.files}); f.push(linksField('Links (Planable post, Google Drive), one per line')); vals.content = rec.content; vals.linksText = linksText(rec.links);
    if(rec.feedback && rec.lastDecision === 'revise') intro += '<div class="notice"><b>Feedback:</b> ' + esc(rec.feedback) + '</div>'; }
  if(n.includes('decision')){
    intro += (rec.content ? '<p class="pre">' + esc(rec.content) + '</p>' : '') + attHtml(rec.files) + linksHtml(rec.links);
    f.push({k:'decision', label:'Decision', type:'select', options:[['approve','Approve'], ['revise','Request revisions']], required:true});
  }
  if(n.includes('schedule')){ f.push({k:'scheduledFor', label:'Scheduled to go out', type:'datetime', required:true}); f.push({k:'linksText', label:'Planable or scheduling link', type:'textarea', rows:2}); vals.scheduledFor = rec.publishAt; vals.linksText = linksText(rec.links); }
  if(n.includes('publish')){ f.push({k:'liveUrl', label:'Link to the live post', type:'url'}); f.push({k:'confirm', label:'It is published', type:'check'}); }
  if(n.includes('amount')){ f.push([{k:'amount', label:'Amount the customer owes', type:'amount', required:true}, {k:'currency', label:'Currency', type:'select', options: curOpts()}]); f.push({k:'files', label:'Reconciliation sheet or figures', type:'files'}); }
  if(n.includes('invoice')){ f.push({k:'invoice', label:'Invoice or payment request number', required:true}); f.push({k:'payDue', label:'Payment due', type:'date', required:true}); f.push({k:'files', label:'Invoice', type:'files'}); vals.payDue = ymd(new Date(Date.now() + (Number(rec.terms) || 14) * DAY));
    intro += rec.amount != null ? '<p>Amount from the reconciliation: <b>' + money(rec.amount, rec.currency) + '</b></p>' : ''; }
  if(n.includes('received')){ f.push([{k:'received', label:'Amount received', type:'amount', required:true}, {k:'paidOn', label:'Received on', type:'date', required:true}]); f.push({k:'account', label:'Into account', type:'select', options: c.accounts}); f.push({k:'files', label:'Proof', type:'files'}); vals.received = rec.amount; }
  if(n.includes('zoho')){ f.push({k:'zoho', label:'Done in Zoho', type:'check'}); f.push({k:'zohoRef', label:'Zoho reference'}); }
  f.push({k:'note', label: n.includes('decision') ? 'Feedback (required for revisions)' : 'Note', type:'textarea', rows:3});
  if(s.optional) f.push({k:'skip', label:'Not needed this time', type:'check'});
  openForm({ title: s.label, intro, values: vals, fields: f, saveLabel: n.includes('account') ? 'Take it on' : n.includes('decision') ? 'Send decision' : 'Mark this step done',
    onSave: async x => {
      if(n.includes('zoho') && !x.zoho && !x.skip) throw new Error('Tick "Done in Zoho" once it is captured.');
      if(n.includes('publish') && !x.confirm) throw new Error('Tick "It is published" once it is live.');
      if(n.includes('decision') && x.decision === 'revise' && !x.note) throw new Error('Say what needs to change.');
      const files = await uploadAll(x.files);
      const out = {note:x.note, files, skip:x.skip};
      if(n.includes('account')) out.account = x.account;
      if(n.includes('paid')){ out.paidAmount = x.paidAmount; out.paidOn = x.paidOn; }
      if(n.includes('content')){ out.content = x.content; out.links = parseLinks(x.linksText); if(files.length){ rec.files = [...(rec.files || []), ...files]; patch(col, id, {files: rec.files}); } }
      if(n.includes('decision')) out.decision = x.decision;
      if(n.includes('schedule')){ out.scheduledFor = x.scheduledFor; out.links = parseLinks(x.linksText); }
      if(n.includes('publish')) out.liveUrl = x.liveUrl;
      if(n.includes('amount')){ out.amount = x.amount; out.currency = x.currency; }
      if(n.includes('invoice')){ out.invoice = x.invoice; out.payDue = x.payDue; }
      if(n.includes('received')){ out.received = x.received; out.paidOn = x.paidOn; out.account = x.account; }
      if(n.includes('zoho')){ out.zoho = !!x.zoho; out.zohoRef = x.zohoRef; }
      await completeStage(col, id, uid, out);
      const r2 = get(col, id), nx = r2 && activeStage(r2);
      toast(nx ? 'Done. Handed to ' + firstName(nx.owner) + ': ' + nx.label.toLowerCase() + '.' : 'Done. Every step is complete.');
    }
  });
}

/* ---------- quick capture ---------- */
const CAP = {files:[], sugg:[], rec:null, chunks:[], speech:null};
function openCapture(prefill){
  CAP.files = []; CAP.sugg = [];
  $('#capBody').innerHTML =
    '<div class="dlhd"><h2>Quick capture</h2><button class="icon-btn" data-act="closeCapture" aria-label="Close">' + icon('x') + '</button></div>' +
    '<label class="f"><span>Type or dictate an instruction</span><textarea id="capText" rows="4" placeholder="Charlie, please follow up with the lawyers on Dale\'s work permit on Thursday and make sure Rhiannon has captured the payment."></textarea></label>' +
    '<div class="tools">' +
      (window.SpeechRecognition || window.webkitSpeechRecognition ? '<button type="button" class="btn ghost sm" data-act="dictate" id="dictBtn">' + icon('mic') + 'Dictate</button>' : '') +
      '<button type="button" class="btn ghost sm rec" data-act="voice" id="voiceBtn">' + icon('mic') + 'Voice note</button>' +
      '<label class="btn ghost sm">' + icon('cam') + 'Photo<input type="file" accept="image/*" capture="environment" id="capCam" hidden></label>' +
      '<label class="btn ghost sm">' + icon('clip') + 'File or screenshot<input type="file" multiple id="capFile" hidden></label>' +
    '</div><div id="capAtt"></div>' +
    '<button type="button" class="btn" data-act="suggest" style="width:100%">' + icon('spark') + 'Suggest actions from this</button>' +
    '<div id="capSugg" style="margin-top:14px"></div>' +
    '<div class="formsec">Or create directly</div>' +
    '<div class="menu-grid">' +
      '<button data-act="capAs" data-id="task">' + icon('check') + 'Task<small>For you or someone else</small></button>' +
      '<button data-act="capAs" data-id="delegate">' + icon('users') + 'Delegate<small>Hand it to someone with a deadline</small></button>' +
      (canEdit('finance') ? '<button data-act="capAs" data-id="payreq">' + icon('money') + 'Payment request<small>Invoice to be paid</small></button>' : '') +
      '<button data-act="capAs" data-id="followup">' + icon('clock') + 'Follow-up reminder<small>Waiting on someone outside</small></button>' +
      '<button data-act="capAs" data-id="event">' + icon('cal') + 'Meeting<small>On the calendar</small></button>' +
      (canEdit('finance') ? '<button data-act="capAs" data-id="ledger">' + icon('money') + 'Receipt or expense<small>Money in or out</small></button>' : '') +
    '</div>';
  if(prefill) $('#capText').value = prefill;
  $('#capCam').onchange = e => { addCapFiles(e.target.files); e.target.value = ''; };
  $('#capFile').onchange = e => { addCapFiles(e.target.files); e.target.value = ''; };
  if(!$('#capture').open) $('#capture').showModal();
  setTimeout(() => $('#capText').focus(), 80);
}
function addCapFiles(fl){ [...fl].forEach(f => { f.__name = f.name; CAP.files.push(f); }); renderCapAtt(); }
function renderCapAtt(){
  $('#capAtt').innerHTML = CAP.files.length ? '<div class="att">' + CAP.files.map((f, i) => '<span class="f">' + icon(/^audio/.test(f.type) ? 'mic' : /^image/.test(f.type) ? 'cam' : 'file') + esc(f.__name || f.name) + ' <button type="button" class="link" data-act="capRm" data-id="' + i + '" aria-label="Remove">' + icon('x') + '</button></span>').join('') + '</div>' : '';
}
async function toggleVoice(){
  const b = $('#voiceBtn');
  if(CAP.rec && CAP.rec.state === 'recording'){ CAP.rec.stop(); return; }
  if(!navigator.mediaDevices || !window.MediaRecorder) return toast('Voice notes are not supported in this browser.');
  try{
    const stream = await navigator.mediaDevices.getUserMedia({audio:true});
    CAP.chunks = []; CAP.rec = new MediaRecorder(stream);
    CAP.rec.ondataavailable = e => { if(e.data.size) CAP.chunks.push(e.data); };
    CAP.rec.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      const type = CAP.rec.mimeType || 'audio/webm', ext = /mp4|aac|m4a/.test(type) ? 'm4a' : /ogg/.test(type) ? 'ogg' : 'webm';
      const blob = new Blob(CAP.chunks, {type}); blob.__name = 'Voice note ' + new Date().toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'}) + '.' + ext;
      CAP.files.push(blob); renderCapAtt();
      b.classList.remove('on'); b.innerHTML = icon('mic') + 'Voice note';
    };
    CAP.rec.start(); b.classList.add('on'); b.innerHTML = icon('mic') + 'Stop recording';
  }catch(e){ toast('Could not use the microphone. Allow it in your browser settings.'); }
}
function toggleDictate(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition, b = $('#dictBtn');
  if(CAP.speech){ CAP.speech.stop(); return; }
  const r = new SR(); r.lang = 'en-GB'; r.interimResults = false; r.continuous = true;
  const ta = $('#capText'), base = ta.value ? ta.value.trim() + ' ' : '';
  let said = '';
  r.onresult = e => { for(let i = e.resultIndex; i < e.results.length; i++) if(e.results[i].isFinal) said += e.results[i][0].transcript + ' '; ta.value = base + said.trim(); };
  r.onend = () => { CAP.speech = null; b.classList.remove('on'); b.innerHTML = icon('mic') + 'Dictate'; };
  r.onerror = () => toast('Dictation stopped. Check microphone permission.');
  CAP.speech = r; r.start(); b.classList.add('on'); b.innerHTML = icon('mic') + 'Stop dictating';
}
function capAs(kind){
  const text = ($('#capText').value || '').trim(), files = CAP.files.slice();
  const p = text ? parseInstruction(text)[0] : null;
  const title = p ? p.title : text;
  const due = p && p.date ? dayEnd(p.date, p.hour || 17) : '';
  const done = () => { $('#capture').close(); };
  if(kind === 'payreq') return payreqForm(null, {values:{title: title.slice(0, 120), amount: p && p.amount, currency: p && p.currency || cfg().currencies[0], deadline: p && p.date || ''}, files, extra:{}}), setTimeout(done, 50);
  if(kind === 'event') return eventForm(null, {values:{title, start: due || dayEnd(TODAY(), 10)}}), setTimeout(done, 50);
  if(kind === 'ledger') return ledgerForm(null, {values:{title, amount: p && p.amount, currency: p && p.currency || cfg().currencies[0]}, files}), setTimeout(done, 50);
  const v = {title, owner: p && p.owner || me.email, due: due || dayEnd(ymd(new Date(Date.now() + DAY)), 17), priority: p && p.priority || 'normal', desc: text.length > title.length ? text : ''};
  if(kind === 'followup') Object.assign(v, {status:'external', waitingOn: p && p.waitingOn || ''});
  if(kind === 'delegate' && v.owner === me.email) v.owner = (M.find(m => m.email !== me.email) || me).email;
  taskForm(null, {values: v, files, title: kind === 'delegate' ? 'Delegate' : kind === 'followup' ? 'Follow-up reminder' : 'New action'});
  setTimeout(done, 50);
}

// Reads a typed instruction and suggests actions. Simple rules, not AI: always check before creating.
function parseInstruction(text){
  const names = [];
  M.forEach(m => { const f = (m.name || '').trim().split(/\s+/)[0]; if(f) names.push([f, m.email]); });
  ROLES.forEach(([k, , n]) => { if(!names.some(x => x[0].toLowerCase() === n.toLowerCase())) names.push([n, roleEmail(k)]); });
  const nameRe = names.length ? new RegExp('\\b(' + names.map(n => n[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b(?![\'’]s)', 'i') : null;
  const emailFor = n => (names.find(x => x[0].toLowerCase() === n.toLowerCase()) || [])[1];
  const parts = text.replace(/\s+/g, ' ').trim()
    .split(/\s*(?:;|\n|\.\s+(?=[A-Z])|,?\s+and then\s+|,?\s+then\s+|,?\s+and also\s+|,?\s+also\s+|,?\s+(?=and (?:make sure|ensure|check|ask|tell|get|remind)\b))/i)
    .map(s => s.replace(/^and\s+/i, '').trim()).filter(s => s.length > 2);
  const out = []; let lastDate = '', lastHour = 0;
  parts.forEach(raw => {
    let s = raw, owner = '';
    const lead = s.match(new RegExp('^(?:@)?(' + names.map(n => n[0]).join('|') + ')\\s*[,:-]\\s*(?:please\\s+|can you\\s+|could you\\s+)?', 'i'));
    if(names.length && lead){ owner = emailFor(lead[1]); s = s.slice(lead[0].length); }
    if(!owner && nameRe){
      const m2 = s.match(new RegExp('\\b(?:make sure|ensure|check|ask|tell|get|remind)\\s+(' + names.map(n => n[0]).join('|') + ')\\b', 'i')) || s.match(new RegExp('\\b(' + names.map(n => n[0]).join('|') + ')\\s+(?:to|should|must|needs to|will)\\b', 'i')) || s.match(nameRe);
      if(m2) owner = emailFor(m2[1]);
    }
    const d = findDate(s);
    if(d.date){ s = s.replace(d.match, ' ').trim(); lastDate = d.date; lastHour = d.hour; }
    let amount = null, currency = '';
    const am = s.match(/(?:(THB|GBP|£|฿)\s?([\d.,]+)|([\d.,]+)\s?(THB|GBP|baht|pounds?))/i);
    if(am){ amount = parseAmount(am[2] || am[3]); const cu = (am[1] || am[4] || '').toLowerCase(); currency = /thb|฿|baht/.test(cu) ? 'THB' : 'GBP'; }
    const priority = /\b(urgent|asap|critical|immediately|today without fail)\b/i.test(raw) ? 'critical' : /\b(important|priority)\b/i.test(raw) ? 'high' : 'normal';
    const ext = /\b(follow up|follow-up|chase|hear back|wait(?:ing)? for)\b/i.test(s);
    const wo = s.match(/\b(?:with|from)\s+(?:the\s+)?([a-z][\w\s'’]{2,30}?)(?=\s+(?:on|about|regarding|re|for|by|to)\b|[,.]|$)/i);
    const isPay = /\b(pay|invoice|transfer|payment)\b/i.test(s) && amount != null;
    s = s.replace(/^(please|pls|can you|could you)\s+/i, '').replace(/\s+(please|thanks|thank you)\.?$/i, '').replace(/[\s,.]+$/, '');
    s = s.charAt(0).toUpperCase() + s.slice(1);
    out.push({title: s, owner: owner || me.email, date: d.date || lastDate, hour: d.date ? d.hour : lastHour, priority, kind: isPay ? 'payreq' : ext ? 'followup' : 'task', waitingOn: ext && wo ? wo[1].trim() : '', amount, currency, include:true});
  });
  return out;
}
function findDate(s){
  const now = new Date(), wd = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  let m, date = '', hour = 0, match = '';
  const tm = s.match(/\b(?:at|by)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i) || s.match(/\b(\d{1,2}):(\d{2})\b/);
  if(tm){ let h = Number(tm[1]); if(tm[3] && /pm/i.test(tm[3]) && h < 12) h += 12; if(tm[3] && /am/i.test(tm[3]) && h === 12) h = 0; if(h < 24){ hour = h; } }
  else if(/\bmorning\b/i.test(s)) hour = 9; else if(/\bafternoon\b/i.test(s)) hour = 14; else if(/\b(end of (the )?day|eod|tonight)\b/i.test(s)) hour = 17;
  const set = (d, mt) => { date = ymd(d); match = mt; };
  if((m = s.match(/\b(?:by |on |this |next )?(today|tonight)\b/i))) set(now, m[0]);
  else if((m = s.match(/\b(?:by |on )?tomorrow\b/i))) set(new Date(now.getTime() + DAY), m[0]);
  else if((m = s.match(/\b(?:by |on |this |next )?(mon|tues?|wed(?:nes)?|thu(?:rs?)?|fri|sat(?:ur)?|sun)(?:day)?\b/i))){
    const key = m[1].toLowerCase().slice(0, 3), target = wd.findIndex(w => w.startsWith(key));
    let add = (target - now.getDay() + 7) % 7; if(add === 0) add = 7; if(/next/i.test(m[0]) && add < 7) add += 0;
    set(new Date(now.getTime() + add * DAY), m[0]);
  }
  else if((m = s.match(/\b(?:by |at )?(?:the )?end of (?:the )?week\b/i))){ const add = (5 - now.getDay() + 7) % 7; set(new Date(now.getTime() + add * DAY), m[0]); }
  else if((m = s.match(/\b(?:by |at )?(?:the )?end of (?:the )?month\b/i))) set(new Date(now.getFullYear(), now.getMonth() + 1, 0), m[0]);
  else if((m = s.match(/\bnext week\b/i))) set(new Date(now.getTime() + 7 * DAY), m[0]);
  else if((m = s.match(/\bin (\d+) (day|week)s?\b/i))) set(new Date(now.getTime() + Number(m[1]) * (/week/i.test(m[2]) ? 7 : 1) * DAY), m[0]);
  else if((m = s.match(/\b(?:by |on )?(\d{1,2})[\/.](\d{1,2})(?:[\/.](\d{2,4}))?\b/))){ let y = m[3] ? Number(m[3]) : now.getFullYear(); if(y < 100) y += 2000; const d = new Date(y, Number(m[2]) - 1, Number(m[1])); if(!m[3] && d < new Date(now.getFullYear(), now.getMonth(), now.getDate())) d.setFullYear(y + 1); set(d, m[0]); }
  else if((m = s.match(new RegExp('\\b(?:by |on )?(\\d{1,2})(?:st|nd|rd|th)?\\s+(' + months.map(x => x.slice(0, 3)).join('|') + ')[a-z]*\\b', 'i'))) || (m = s.match(new RegExp('\\b(?:by |on )?(' + months.map(x => x.slice(0, 3)).join('|') + ')[a-z]*\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b', 'i')))){
    const dayN = Number(/\d/.test(m[1]) ? m[1] : m[2]), monS = (/\d/.test(m[1]) ? m[2] : m[1]).toLowerCase().slice(0, 3);
    const d = new Date(now.getFullYear(), months.findIndex(x => x.startsWith(monS)), dayN);
    if(d < new Date(now.getFullYear(), now.getMonth(), now.getDate())) d.setFullYear(d.getFullYear() + 1);
    set(d, m[0]);
  }
  if(date && tm && s.indexOf(tm[0]) > -1) match = new RegExp(match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '|' + tm[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  return {date, hour: hour || 17, match};
}
function renderSuggestions(){
  const box = $('#capSugg');
  if(!CAP.sugg.length){ box.innerHTML = '<div class="empty">I could not find an action in that. Try starting with what needs to happen, for example "Charlie, chase the supplier on Friday".</div>'; return; }
  const kinds = [['task','Action'], ['followup','Follow-up (waiting on someone outside)']].concat(canEdit('finance') ? [['payreq','Payment request']] : []);
  box.innerHTML = '<div class="sechd"><h2>Suggested actions</h2></div><p class="hint" style="margin-top:0">These are suggestions. Check the person and date before creating them.</p>' +
    CAP.sugg.map((g, i) => '<div class="sugg">' +
      '<label class="cb" style="padding-top:0"><input type="checkbox" id="sg' + i + 'in"' + (g.include ? ' checked' : '') + '> <b>Create this</b></label>' +
      '<label class="f"><span>What</span><input type="text" id="sg' + i + 't" value="' + esc(g.title) + '"></label>' +
      '<div class="row2"><label class="f"><span>Who</span><select id="sg' + i + 'o">' + peopleOpts().map(o => opt(o, g.owner)).join('') + '</select></label>' +
      '<label class="f"><span>By</span><input type="datetime-local" id="sg' + i + 'd" value="' + esc(g.date ? toLocalInput(dayEnd(g.date, g.hour)) : toLocalInput(dayEnd(ymd(new Date(Date.now() + DAY)), 17))) + '"></label></div>' +
      '<div class="row2"><label class="f"><span>Type</span><select id="sg' + i + 'k">' + kinds.map(o => opt(o, g.kind)).join('') + '</select></label>' +
      '<label class="f"><span>Priority</span><select id="sg' + i + 'p">' + PRIORITY.map(o => opt(o, g.priority)).join('') + '</select></label></div>' +
      (g.amount != null ? '<p class="meta">Amount found: ' + money(g.amount, g.currency) + '</p>' : '') +
      (g.waitingOn ? '<p class="meta">Waiting on: ' + esc(g.waitingOn) + '</p>' : '') +
    '</div>').join('') +
    (CAP.sugg.length > 1 ? '<label class="cb"><input type="checkbox" id="sgChain"> Do these in order (each starts after the one before)</label>' : '') +
    '<button class="btn ok" data-act="createSugg" style="width:100%;margin-top:6px">Create ' + (CAP.sugg.length > 1 ? 'these actions' : 'this action') + '</button>';
}
async function createSuggestions(){
  const btn = $('[data-act=createSugg]'); btn.disabled = true; btn.textContent = 'Creating';
  try{
    const files = await uploadAll(CAP.files);
    const text = ($('#capText').value || '').trim(), group = newId(), chain = $('#sgChain') && $('#sgChain').checked;
    let prev = null, made = 0;
    for(let i = 0; i < CAP.sugg.length; i++){
      if(!$('#sg' + i + 'in').checked) continue;
      const g = CAP.sugg[i], kind = $('#sg' + i + 'k').value, title = $('#sg' + i + 't').value.trim() || g.title;
      const owner = $('#sg' + i + 'o').value, due = fromLocalInput($('#sg' + i + 'd').value), priority = $('#sg' + i + 'p').value;
      if(kind === 'payreq'){
        const nid = newId(), rec = Object.assign({title, amount: g.amount || 0, currency: g.currency || cfg().currencies[0], deadline: due ? ymd(new Date(due)) : TODAY(), priority, entity: cfg().entities[0], brand: ui.brand !== 'all' ? ui.brand : '', cat:'Other', notes: text, files: made ? [] : files}, stamp());
        startWorkflow('payreqs', nid, rec); logAct('payreqs/' + nid, 'requested ' + money(rec.amount, rec.currency) + ' from quick capture');
      } else {
        prev = createTask({title, owner, due, priority, status: kind === 'followup' ? 'external' : 'awaiting', waitingOn: kind === 'followup' ? g.waitingOn : '', desc: text, files: made ? [] : files, group, dependsOn: chain && prev ? [prev] : [], brand: ui.brand !== 'all' ? ui.brand : ''});
      }
      made++;
    }
    $('#capture').close();
    toast(made ? made + (made === 1 ? ' action created.' : ' linked actions created.') : 'Nothing was selected.');
  }catch(e){ btn.disabled = false; btn.textContent = 'Create'; toast(e.message || 'Could not create them.'); }
}

const FORMS = {tasks: taskForm, payreqs: payreqForm, campaigns: campaignForm, customers: customerForm, suppliers: supplierForm, opps: oppForm, legal: legalForm, ledger: ledgerForm, recurring: recurringForm, events: eventForm, files: fileForm};
