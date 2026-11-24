/* The Raw Portal: the More section (collab notes, ideas, photos, trips, lists, countdowns), settings, inbox, search and Excel export. */
'use strict';

/* ---------- simple add/edit forms for the smaller things ---------- */
function crud(col, titleNew, titleEdit, fields, o){
  o = o || {};
  return id => {
    const cur = id ? get(col, id) : null, fs = typeof fields === 'function' ? fields(cur) : fields;
    openForm({ title: cur ? titleEdit : titleNew, fields: fs, values: cur ? (o.load ? o.load(cur) : cur) : (o.defaults ? o.defaults() : {}),
      onSave: async v => { const data = Object.assign({}, cur || {}, o.clean ? await o.clean(v, cur) : v, cur ? (o.touch ? {editedBy: me.email, editedAt: new Date().toISOString()} : {}) : stamp()); delete data.id; put(col, id || newId(), data); },
      onDelete: cur ? () => { if(o.onDelete) o.onDelete(cur); del(col, id); } : null });
  };
}
const formCompany = crud('company', 'Company detail', 'Edit detail', [{k:'label', label:'Label', required:true, ph:'Company registration number'}, {k:'value', label:'Value', type:'textarea', rows:2, required:true}, {k:'notes', label:'Notes'}], {touch:true});
const formPerson = crud('people', 'Team profile', 'Edit profile', [{k:'name', label:'Name', required:true}, {k:'role', label:'Role'}, {k:'phone', label:'Phone', type:'tel'}, {k:'email', label:'Email', type:'email'}, {k:'emergency', label:'Emergency contact (name and number)'}, {k:'notes', label:'Notes', type:'textarea', rows:3}], {touch:true});
const formContact = crud('contacts', 'Contact', 'Edit contact', [{k:'name', label:'Name', required:true}, {k:'company', label:'Company'}, {k:'what', label:'What for', ph:'Lawyer, accountant, courier, supplier'}, {k:'phone', label:'Phone', type:'tel'}, {k:'email', label:'Email', type:'email'}, {k:'notes', label:'Notes', type:'textarea', rows:2}], {touch:true});
const formNote = crud('notes', 'New note', 'Edit note', [{k:'title', label:'Title', required:true}, {k:'body', label:'Note', type:'textarea', rows:10}, {k:'pin', label:'Pin to the top', type:'check'}], {touch:true});
const IDEA_STATUS = ['New', 'Discussing', 'Doing', 'Done', 'Parked'];
const formIdea = crud('ideas', 'New idea', 'Edit idea', cur => [{k:'title', label:'The idea', required:true}, {k:'body', label:'More detail', type:'textarea', rows:5}].concat(cur ? [{k:'status', label:'Status', type:'select', options: IDEA_STATUS}] : []), {clean: (v, cur) => cur ? v : Object.assign(v, {status:'New', votes:[me.email], comments:[]})});
const formCountdown = crud('countdowns', 'New countdown', 'Edit countdown', [{k:'title', label:'Counting down to', required:true}, {k:'date', label:'Date', type:'date', required:true}, {k:'notes', label:'Notes'}]);
const formItem = crud('shopping', 'Item', 'Edit item', () => [{k:'title', label:'Item', required:true}, {k:'list', label:'List', required:true, list: cfg().lists}, {k:'note', label:'Note (size, quantity, where)'}]);
const formTrip = crud('trips', 'New business trip', 'Edit trip', cur => [
  {k:'title', label:'Trip', required:true}, {k:'place', label:'Where to'}, [{k:'start', label:'First day', type:'date', required:true}, {k:'end', label:'Last day', type:'date'}],
  {k:'who', label:'Who is going', type:'checks', options: peopleOpts()}, {k:'travel', label:'Travel (flights, car hire, booking references)', type:'textarea', rows:3},
  {k:'stay', label:'Where you are staying', type:'textarea', rows:2}, [{k:'budget', label:'Budget', type:'amount'}, {k:'currency', label:'Currency', type:'select', options: curOpts()}],
  {k:'checkText', label:'Checklist, one item per line', type:'textarea', rows:5}, {k:'notes', label:'Notes', type:'textarea', rows:3}],
  {load: cur => Object.assign({}, cur, {checkText: (cur.checklist || []).map(x => x.t).join('\n')}), defaults: () => ({currency: cfg().currencies[0], who:[me.email]}),
   clean: (v, cur) => { if(v.end && v.end < v.start) throw new Error('The last day is before the first day.'); const old = (cur && cur.checklist) || []; const o = Object.assign({}, v); delete o.checkText;
     o.checklist = v.checkText.split('\n').map(s => s.trim()).filter(Boolean).map(t => ({t, done: old.some(x => x.t === t && x.done)})); return o; }});
const formPhoto = crud('photos', 'Share a photo', 'Edit photo', cur => [{k:'file', label: cur ? 'Replace the photo' : 'Photo', type:'photo', required: !cur}, {k:'caption', label:'Description', type:'textarea', rows:3}, {k:'date', label:'Date', type:'date', required:true}, {k:'brand', label:'Brand', type:'select', options: brandOpts()}],
  {defaults: () => ({date: TODAY()}), clean: async (v, cur) => { const o = {caption: v.caption, date: v.date, brand: v.brand}; if(v.file){ const p = await uploadPhoto(v.file); o.path = p.path; o.thumb = p.thumb; if(cur) removePhoto(cur); } return o; }, onDelete: cur => removePhoto(cur)});

async function loadImg(file){
  const url = URL.createObjectURL(file);
  try { return await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('That file could not be read as a photo.')); i.src = url; }); }
  finally { setTimeout(() => URL.revokeObjectURL(url), 1500); }
}
function toBlob(img, max, q){
  let w = img.naturalWidth, h = img.naturalHeight; const s = Math.min(1, max / Math.max(w, h)); w = Math.round(w * s); h = Math.round(h * s);
  const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h);
  return new Promise(r => c.toBlob(r, 'image/jpeg', q));
}
async function uploadPhoto(file){
  const img = await loadImg(file), key = newId();
  const full = await toBlob(img, 1600, .82), th = await toBlob(img, 480, .72);
  const path = 'full/' + key + '.jpg', thumb = 'thumb/' + key + '.jpg';
  let r = await sb.storage.from('photos').upload(path, full, {contentType:'image/jpeg'}); if(r.error) throw r.error;
  r = await sb.storage.from('photos').upload(thumb, th, {contentType:'image/jpeg'}); if(r.error) throw r.error;
  return {path, thumb};
}
function removePhoto(p){ if(p && p.path) sb.storage.from('photos').remove([p.path, p.thumb]).then(() => {}); }

/* ---------- More screens ---------- */
const MORE = [['m-notes','Collab notes','list','Shared working notes and plans'], ['m-ideas','Ideas','spark','Drop it, vote on it, talk it through'], ['m-photos','Photos','cam','Shared photos with descriptions'],
  ['m-trips','Business trips','truck','Dates, travel, stay and checklist'], ['m-lists','Lists','check','Shopping and supply lists'], ['m-countdowns','Countdowns','clock','Launches, expos and deadlines']];
R['m-notes'] = () => {
  const ns = list('notes').filter(inBrand).sort((a, b) => (!!b.pin - !!a.pin) || ((a.editedAt || a.at) < (b.editedAt || b.at) ? 1 : -1));
  return title('Collab notes', 'Plans, meeting notes and checklists you work on together', addBtn('newNote', 'Note')) +
    (ns.length ? ns.map(n => '<div class="card' + (n.pin ? ' hot' : '') + '"><div class="split"><h3>' + esc(n.title) + '</h3><button class="link" data-act="editNote" data-id="' + n.id + '">Edit</button></div><p class="pre">' + esc(n.body) + '</p><div class="meta">Last edited by ' + esc(firstName(n.editedBy || n.by)) + ', ' + esc(fmtDT(n.editedAt || n.at, 1)) + '</div></div>').join('') : empty('No notes yet.'));
};
R['m-ideas'] = () => {
  const is = list('ideas').filter(inBrand);
  is.sort(ui.ideaSort === 'top' ? ((a, b) => (b.votes || []).length - (a.votes || []).length || (a.at < b.at ? 1 : -1)) : by('at', -1));
  return title('Ideas', 'Drop it, vote on it, talk it through', addBtn('newIdea', 'Idea')) + chips('ideaSort', ui.ideaSort, [['top','Most votes'], ['new','Newest']]) +
    (is.length ? is.map(i => { const v = i.votes || [], cs = i.comments || [], open = ui.openIdea === i.id;
      return '<div class="card' + (i.status === 'Doing' ? ' hot' : '') + '"><div style="display:flex;gap:12px"><button class="vote" data-act="vote" data-id="' + i.id + '" aria-pressed="' + v.includes(me.email) + '" aria-label="Vote">' + v.length + '<small>VOTE</small></button><div style="flex:1;min-width:0"><span class="b' + (i.status === 'Doing' ? ' b-red' : i.status === 'Done' ? ' b-ok' : '') + '">' + esc(i.status || 'New') + '</span><h3 style="margin-top:4px">' + esc(i.title) + '</h3>' + (i.body ? '<p class="pre">' + esc(i.body) + '</p>' : '') + '<div class="meta">' + esc(firstName(i.by)) + ' · ' + esc(fmtDs((i.at || '').slice(0, 10))) + '</div></div><button class="link" data-act="editIdea" data-id="' + i.id + '">Edit</button></div>' +
        '<div class="tools" style="margin:8px 0 0"><button class="btn ghost sm" data-act="openIdea" data-id="' + i.id + '">' + (open ? 'Hide comments' : 'Comments (' + cs.length + ')') + '</button><button class="btn ghost sm" data-act="ideaToTask" data-id="' + i.id + '">' + icon('check') + 'Make it an action</button></div>' +
        (open ? cs.map(c => '<div class="cmt">' + avatar(c.by, 1) + '<div class="body"><div class="who">' + esc(nameOf(c.by)) + '<span>' + esc(fmtDs((c.at || '').slice(0, 10))) + '</span></div><div class="pre">' + esc(c.text) + '</div></div></div>').join('') + '<form class="compose" data-form="idea" data-id="' + i.id + '"><input type="text" id="c-' + i.id + '" placeholder="Add a comment" aria-label="Add a comment"><button class="btn sm">Post</button></form>' : '') + '</div>'; }).join('') : empty('No ideas yet. First one in sets the tone.'));
};
R['m-photos'] = () => {
  const all = list('photos').filter(inBrand).sort((a, b) => (b.date || '') < (a.date || '') ? -1 : (b.date || '') > (a.date || '') ? 1 : (a.at < b.at ? 1 : -1)), ps = all.slice(0, ui.photoLimit);
  let h = '', cur = '';
  ps.forEach(p => { const k = (p.date || '').slice(0, 7); if(k !== cur){ if(cur) h += '</div>'; cur = k; h += '<div class="sechd" style="margin-top:14px"><h2>' + (k ? esc(ymLabel(k)) : 'No date') + '</h2></div><div class="pgrid">'; }
    h += '<button class="ph" data-act="viewPhoto" data-id="' + p.id + '"><img data-b="photos" data-f="' + esc(p.thumb) + '" alt="' + esc(p.caption || 'Photo') + '" loading="lazy"><div>' + esc(p.caption || '') + '<div class="meta">' + esc(firstName(p.by)) + ' · ' + esc(fmtDs(p.date)) + '</div></div></button>'; });
  if(cur) h += '</div>';
  return title('Photos', all.length + ' shared', addBtn('newPhoto', 'Photo')) + (ps.length ? h : empty('Product shots, events, stock deliveries: share anything worth seeing, with a description.')) +
    (all.length > ps.length ? '<p style="text-align:center"><button class="btn ghost" data-act="morePhotos">Show more</button></p>' : '');
};
R['m-trips'] = () => {
  const ts = list('trips'), up = ts.filter(t => daysTo(t.end || t.start) >= 0).sort(by('start')), past = ts.filter(t => daysTo(t.end || t.start) < 0).sort(by('start', -1));
  const card = t => { const cl = t.checklist || [];
    return '<div class="card' + (daysTo(t.end || t.start) >= 0 ? ' hot' : '') + '"><div class="split"><h3>' + esc(t.title) + '</h3><button class="link" data-act="editTrip" data-id="' + t.id + '">Edit</button></div><div class="meta">' + esc([t.place, fmtD(t.start) + (t.end && t.end !== t.start ? ' to ' + fmtD(t.end) : ''), (t.who || []).map(firstName).join(', ')].filter(Boolean).join(' · ')) + (daysTo(t.start) > 0 ? '<span class="b b-amber">In ' + daysTo(t.start) + ' days</span>' : daysTo(t.end || t.start) >= 0 ? '<span class="b b-red">On now</span>' : '') + '</div>' +
      [['Travel', t.travel], ['Stay', t.stay], ['Notes', t.notes]].filter(x => x[1]).map(x => '<p class="pre"><b>' + x[0] + ':</b> ' + esc(x[1]) + '</p>').join('') + (t.budget ? '<p><b>Budget:</b> ' + money(t.budget, t.currency) + '</p>' : '') +
      (cl.length ? '<div class="list" style="margin-top:10px">' + cl.map((x, i) => '<div class="item' + (x.done ? ' done' : '') + '" style="min-height:48px"><button class="tick" role="checkbox" aria-checked="' + !!x.done + '" aria-label="' + esc(x.t) + '" data-act="tickTrip" data-id="' + t.id + '" data-i="' + i + '">' + icon('check') + '</button><div class="main"><div class="t">' + esc(x.t) + '</div></div></div>').join('') + '</div>' : '') + '</div>'; };
  return title('Business trips', '', addBtn('newTrip', 'Trip')) + sec('Upcoming', up.length ? up.map(card).join('') : empty('No trips planned.')) + (past.length ? sec('Past', past.map(card).join('')) : '');
};
R['m-lists'] = () => {
  const c = cfg(), all = list('shopping'), used = uniq([...c.lists, ...all.map(i => i.list)]);
  const show = used.filter(l => ui.listFilter === 'all' || ui.listFilter === l), ticked = all.filter(i => i.done).length;
  const pick = ui.listFilter !== 'all' ? ui.listFilter : (ui.lastList || used[0]);
  return title('Lists', all.filter(i => !i.done).length + ' to get') +
    '<form class="compose" data-form="addItem" style="margin:0 0 12px"><input type="text" id="addItem" placeholder="Add an item" aria-label="Item" autocomplete="off" enterkeyhint="done"><select id="addList" aria-label="List" style="flex:0 0 40%">' + used.map(l => opt(l, pick)).join('') + '</select><button class="btn" aria-label="Add item">' + icon('plus') + '</button></form>' +
    chips('listFilter', ui.listFilter, [['all','All'], ...used.map(l => [l, l])]) +
    show.map(l => { const its = all.filter(i => i.list === l).sort((a, b) => (!!a.done - !!b.done) || (a.at < b.at ? -1 : 1)); if(!its.length) return '';
      return sec(esc(l), listBox(its.map(i => '<div class="item' + (i.done ? ' done' : '') + '"><button class="tick" role="checkbox" aria-checked="' + !!i.done + '" aria-label="Got it" data-act="tickItem" data-id="' + i.id + '">' + icon('check') + '</button><div class="main"><div class="t">' + esc(i.title) + '</div>' + (i.note ? '<div class="meta">' + esc(i.note) + '</div>' : '') + '</div><div class="side">' + esc(firstName(i.by)) + '<button class="link" data-act="editItem" data-id="' + i.id + '">Edit</button></div></div>'))); }).join('') +
    (all.length ? '' : empty('Nothing on any list.')) + (ticked ? '<button class="btn ghost sm" data-act="clearTicked">Clear ' + ticked + ' ticked</button>' : '');
};
function cdCard(c){
  const n = daysTo(c.date);
  return '<div class="card' + (n >= 0 ? ' hot' : '') + '"><div style="display:flex;gap:14px;align-items:center"><div style="min-width:80px;text-align:center"><div class="big">' + Math.abs(n) + '</div><div class="meta" style="justify-content:center;margin:0">' + (n === 0 ? 'today' : (Math.abs(n) === 1 ? 'day ' : 'days ') + (n < 0 ? 'ago' : 'to go')) + '</div></div><div style="flex:1;min-width:0"><h3>' + esc(c.title) + '</h3><div class="meta">' + esc(fmtD(c.date)) + '</div>' + (c.notes ? '<p class="pre">' + esc(c.notes) + '</p>' : '') + '</div><button class="link" data-act="editCountdown" data-id="' + c.id + '">Edit</button></div></div>';
}
R['m-countdowns'] = () => {
  const cs = list('countdowns'), up = cs.filter(c => daysTo(c.date) >= 0).sort(by('date')), past = cs.filter(c => daysTo(c.date) < 0).sort(by('date', -1));
  return title('Countdowns', '', addBtn('newCountdown', 'Countdown')) + (up.length ? up.map(cdCard).join('') : empty('Nothing to count down to. Add a launch, an expo, a deadline.')) + (past.length ? sec('Passed', past.map(cdCard).join('')) : '');
};

/* ---------- menu (phones) ---------- */
R.menu = () => {
  const n = navCounts();
  const card = ([r, l, ic, hint]) => '<button data-act="go" data-id="' + r + '">' + icon(ic) + esc(l) + '<small>' + esc(hint || '') + '</small>' + (n[r] ? '<span class="b b-red n">' + n[r] + '</span>' : '') + '</button>';
  return title('Menu') + NAV.map(g => { const its = g.items.filter(navVisible); return its.length ? '<div class="navgrp"><h4>' + esc(g.label) + '</h4><div class="menu-grid">' + its.map(card).join('') + '</div></div>' : ''; }).join('') +
    (canView('more') ? '<div class="navgrp"><h4>More</h4><div class="menu-grid">' + MORE.map(card).join('') + '</div></div>' : '') +
    '<div class="menu-grid"><button data-act="go" data-id="settings">' + icon('gear') + 'Team and settings<small>People, access, notifications, setup</small></button><button data-act="signOut">' + icon('x') + 'Sign out<small>' + esc(me.email) + '</small></button></div>';
};

/* ---------- settings ---------- */
R.settings = () => {
  const c = cfg(), th = (() => { try { return localStorage.getItem('raw-theme') || 'auto'; } catch(e){ return 'auto'; } })();
  let h = title('Team and settings');
  h += '<div class="grid2"><div>';
  h += sec('You', '<div class="card"><div class="person">' + avatar(me.email) + '<div class="grow"><b>' + esc(nameOf(me.email)) + '</b><div class="meta" style="margin:0">' + esc(me.email) + ' · ' + esc(me.access === 'full' ? 'Full access' : 'Selected access') + (me.is_admin ? ' · Admin' : '') + '</div></div></div>' +
    '<label class="f" style="margin-top:10px"><span>Your WhatsApp number <small>(so others can message you from a task)</small></span><div class="compose" style="margin:0"><input type="tel" id="myPhone" value="' + esc(me.phone || '') + '" placeholder="+66 81 234 5678"><button class="btn ghost" data-act="savePhone">Save</button></div></label>' +
    '<p class="meta">Your time zone: ' + esc(Intl.DateTimeFormat().resolvedOptions().timeZone || '') + '. Deadlines show in your own time.</p></div>');
  h += sec('Notifications on this device', '<div class="card" id="pushCard"><p class="meta" style="margin:0">Checking…</p></div>');
  h += sec('Look', chips('theme', th, [['auto','Follow my phone'], ['dark','Dark'], ['light','Light']]));
  h += '<button class="btn ghost" data-act="signOut">Sign out</button>';
  h += '</div><div>';
  h += sec('Who has access', '<div class="list">' + M.map(m => '<div class="item' + (isAdmin() ? ' click" data-act="editMember" data-id="' + esc(m.email) : '') + '">' + avatar(m.email) + '<div class="main"><div class="t">' + esc(m.name || m.email) + (m.is_admin ? ' <span class="b b-red">Admin</span>' : '') + '</div><div class="meta">' + esc(m.title || '') + '<span>' + esc(m.email) + '</span><span class="b">' + esc(m.access === 'full' ? 'Full access' : 'Selected areas') + '</span>' + (m.briefing ? '<span class="b b-teal">Daily briefing</span>' : '') + ((m.brands || []).length ? '<span>' + esc(m.brands.join(', ')) + ' only</span>' : '') + '</div></div></div>').join('') + '</div>' +
    '<p class="hint" style="margin-top:8px">' + (isAdmin() ? 'People sign in with exactly these email addresses. Each Gmail address must also be a test user in Google Cloud.' : 'Only an admin can change who has access.') + '</p>', isAdmin() ? addBtn('addMember', 'Person') : '');
  if(isAdmin()){
    h += sec('Who does what in the workflows', '<div class="list">' + ROLES.map(([k, l]) => '<div class="item"><div class="main"><div class="t">' + esc(l) + '</div></div><div class="side"><b style="color:var(--ink)">' + esc(nameOf(roleEmail(k))) + '</b></div></div>').join('') + '</div>', '<button class="link" data-act="editRoles">Change</button>');
    h += sec('Business setup', '<div class="list">' +
      [['Portal name', c.name], ['Brands', c.brands.map(b => b.name).join(', ')], ['Currencies', c.currencies.join(', ')], ['Accounts', c.accounts.join(', ')], ['Business entities', c.entities.join(', ')],
       ['Escalation goes to', (c.escalate || []).length ? c.escalate.map(firstName).join(', ') : 'All admins'], ['Reconciliations created', (c.reconLead || 5) + ' days ahead'], ['Daily briefing at', (c.briefHour || 7) + ':00 local time']]
      .map(([k, v]) => '<div class="item"><div class="main"><div class="meta" style="margin:0">' + esc(k) + '</div><div class="t">' + esc(v) + '</div></div></div>').join('') + '</div>', '<button class="link" data-act="editSetup">Change</button>');
  }
  h += '</div></div>';
  return h;
};
async function renderPushCard(){
  const el = $('#pushCard'); if(!el) return;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent), standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if(!('serviceWorker' in navigator) || !('PushManager' in window)){
    el.innerHTML = '<p style="margin:0">' + (ios && !standalone ? 'On iPhone, notifications only work when the portal is opened from the Home Screen. Tap Share, then <b>Add to Home Screen</b>, open it from there, and come back here.' : 'This browser cannot receive notifications.') + '</p>'; return;
  }
  const reg = await getReg().catch(() => null), sub = reg && await reg.pushManager.getSubscription();
  if(sub && Notification.permission === 'granted') el.innerHTML = '<p style="margin:0 0 10px"><b style="color:var(--okink)">On.</b> Reminders, handovers, mentions and escalations arrive on this device.</p><div class="tools" style="margin:0"><button class="btn ghost sm" data-act="testPush">Send a test</button><button class="btn ghost sm" data-act="pushOff">Turn off</button></div>';
  else if(Notification.permission === 'denied') el.innerHTML = '<p style="margin:0">Notifications are blocked for this site. Allow them in your browser or phone settings, then reload.</p>';
  else el.innerHTML = '<p style="margin:0 0 10px">Get reminders 72, 24 and 3 hours before deadlines, handovers when it is your turn, and mentions.</p><button class="btn" data-act="pushOn">' + icon('bell') + 'Turn on notifications</button>';
}
let swReg = null;
async function getReg(){ if(swReg) return swReg; swReg = await navigator.serviceWorker.register('sw.js'); await navigator.serviceWorker.ready; return swReg; }
function b64ToBytes(b64){ const p = '='.repeat((4 - b64.length % 4) % 4); const raw = atob((b64 + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(raw, c => c.charCodeAt(0)); }
async function pushOn(){
  try{
    const perm = await Notification.requestPermission();
    if(perm !== 'granted') return renderPushCard();
    const reg = await getReg();
    const sub = await reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey: b64ToBytes(VAPID_PUBLIC)});
    const j = sub.toJSON();
    const {error} = await sb.from('push_subscriptions').upsert({endpoint: j.endpoint, email: me.email, p256dh: j.keys.p256dh, auth: j.keys.auth});
    if(error) throw error;
    toast('Notifications are on for this device.');
  }catch(e){ toast('Could not turn on notifications. ' + (e.message || '')); }
  renderPushCard();
}
async function pushOff(){
  const reg = await getReg().catch(() => null), sub = reg && await reg.pushManager.getSubscription();
  if(sub){ await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint); await sub.unsubscribe(); }
  toast('Notifications are off for this device.'); renderPushCard();
}
function testPush(){
  put('inbox', newId(), {to: me.email, title:'Test notification', body:'If you can see this on your phone, notifications work.', ref:'', kind:'test', read:false, by:'self-test', at:new Date().toISOString()});
  toast('Sent. It should arrive within a few seconds.');
}

const PRESETS = {
  finance: {label:'Financial oversight (like Dale)', perms:{finance:'edit', calendar:'view', docs:'view', details:'view'}},
  marketing: {label:'Marketing assistant', perms:{marketing:'edit', calendar:'view', docs:'view'}},
};
function memberForm(email){
  const cur = email ? M.find(m => m.email === email) : null, perms = (cur && cur.perms) || {};
  const accessVal = !cur ? 'full' : cur.access === 'full' ? 'full' : Object.keys(PRESETS).find(k => JSON.stringify(PRESETS[k].perms) === JSON.stringify(perms)) || 'custom';
  const vals = Object.assign({}, cur || {is_admin:false}, {accessSel: accessVal, brandsSel: (cur && cur.brands) || []});
  MODULES.forEach(([k]) => vals['p_' + k] = perms[k] || 'none');
  openForm({ title: cur ? 'Edit ' + (cur.name || cur.email) : 'Add a person', values: vals,
    intro: '<p class="hint" style="margin-top:0">Everyone can always see and work on actions they are responsible for, collaborating on, or created.</p>',
    fields: [
      {k:'name', label:'Name', required:true}, {k:'title', label:'Role', ph:'Operations'},
    ].concat(cur ? [] : [{k:'email', label:'Email they sign in with', type:'email', required:true}]).concat([
      {k:'accessSel', label:'Access', type:'select', options:[['full','Full access to everything'], ...Object.entries(PRESETS).map(([k, p]) => [k, p.label]), ['custom','Choose areas below']]},
      {type:'section', label:'Areas (used when "Choose areas below" is selected)'},
      ...MODULES.map(([k, l]) => ({k:'p_' + k, label:l, type:'select', options:[['none','No access'], ['view','Can view'], ['edit','Can view and change']]})),
      {k:'brandsSel', label:'Limit to brands (leave all unticked for every brand)', type:'checks', options: cfg().brands.map(b => [b.name, b.name])},
      {k:'briefing', label:'Daily briefing and weekly summary notifications', type:'check'},
      {k:'is_admin', label:'Admin (can manage people and settings)', type:'check'}
    ]),
    onSave: async v => {
      if(cur && cur.email === me.email && !v.is_admin) throw new Error('You cannot remove your own admin rights. Ask another admin.');
      const row = {name: v.name, title: v.title, is_admin: v.is_admin, briefing: v.briefing, brands: v.brandsSel};
      if(v.accessSel === 'full'){ row.access = 'full'; row.perms = {}; }
      else if(PRESETS[v.accessSel]){ row.access = 'custom'; row.perms = PRESETS[v.accessSel].perms; }
      else { row.access = 'custom'; row.perms = {}; MODULES.forEach(([k]) => { if(v['p_' + k] !== 'none') row.perms[k] = v['p_' + k]; }); }
      if(cur){ const {error} = await sb.from('allowed_emails').update(row).eq('email', cur.email); if(error) throw error; }
      else { const e = v.email.toLowerCase().trim(); if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error('That does not look like an email address.');
        const {error} = await sb.from('allowed_emails').insert(Object.assign(row, {email: e})); if(error) throw new Error(error.code === '23505' ? 'That email is already on the list.' : error.message);
        toast('Added. If they use Gmail, also add ' + e + ' as a test user in Google Cloud.'); }
      await loadMembers(); render();
    },
    deleteLabel:'Remove access',
    onDelete: cur && cur.email !== me.email ? async () => { const {error} = await sb.from('allowed_emails').delete().eq('email', cur.email); if(error) toast(error.message); await loadMembers(); render(); } : null });
}
function rolesForm(){
  const c = cfg(), vals = {};
  ROLES.forEach(([k]) => vals[k] = roleEmail(k));
  vals.escalate = (c.escalate || []).length ? c.escalate : [roleEmail('stacey'), roleEmail('charlie')];
  openForm({ title:'Who does what', values: vals,
    intro:'<p class="hint" style="margin-top:0">The workflows hand each step to these people. Payment requests go to accounts to take on (or financial oversight), proof to operations, Zoho capture to accounts, approvals to management.</p>',
    fields: ROLES.map(([k, l]) => ({k, label:l, type:'select', options: peopleOpts()})).concat([{k:'escalate', label:'Overdue critical actions escalate to', type:'checks', options: peopleOpts()}]),
    onSave: v => { const roles = {}; ROLES.forEach(([k]) => roles[k] = v[k]); saveCfg({roles, escalate: v.escalate}); }
  });
}
function setupForm(){
  const c = cfg(), lines = a => a.join('\n');
  openForm({ title:'Business setup', values: {name: c.name, brands: c.brands.map(b => b.name + ' ' + b.color).join('\n'), currencies: lines(c.currencies), accounts: lines(c.accounts), entities: lines(c.entities), finCats: lines(c.finCats),
      legalTypes: lines(c.legalTypes), custTypes: lines(c.custTypes), folders: lines(c.folders), lists: lines(c.lists), reconLead: c.reconLead, briefHour: c.briefHour, tz: c.tz},
    fields: [
      {k:'name', label:'Portal name', required:true},
      {k:'brands', label:'Brands, one per line, with a colour', type:'textarea', rows:5, hint:'For example: Nutrients #f5a530'},
      [{k:'currencies', label:'Currencies (3-letter codes)', type:'textarea', rows:3}, {k:'accounts', label:'Bank accounts', type:'textarea', rows:3}],
      {k:'entities', label:'Business entities', type:'textarea', rows:3},
      {k:'finCats', label:'Finance categories', type:'textarea', rows:6},
      {k:'legalTypes', label:'Legal and compliance types', type:'textarea', rows:6},
      [{k:'custTypes', label:'Customer types', type:'textarea', rows:4}, {k:'folders', label:'Document folders', type:'textarea', rows:4}],
      {k:'lists', label:'Lists (in More)', type:'textarea', rows:3},
      [{k:'reconLead', label:'Create reconciliations this many days ahead', type:'number', min:1, max:20}, {k:'briefHour', label:'Daily briefing hour (local time)', type:'number', min:4, max:12}],
      {k:'tz', label:'Default time zone for briefings', ph:'Asia/Bangkok', hint:'Used for anyone whose phone has not reported a time zone yet.'}
    ],
    onSave: v => {
      const ls = s => uniq(String(s || '').split('\n').map(x => x.trim()));
      const brands = ls(v.brands).map(l => { const m = l.match(/^(.*?)\s*(#[0-9a-f]{3,8})?$/i); return {name: m[1].trim(), color: m[2] || '#a49e98'}; }).filter(b => b.name);
      const curs = ls(v.currencies).map(x => x.toUpperCase());
      if(curs.some(x => !/^[A-Z]{3}$/.test(x))) throw new Error('Currencies must be 3-letter codes such as GBP or THB.');
      try { Intl.DateTimeFormat('en-GB', {timeZone: v.tz || 'Asia/Bangkok'}); } catch(e){ throw new Error('That time zone is not recognised. Try Asia/Bangkok or Europe/London.'); }
      saveCfg({name: v.name, brands, currencies: curs, accounts: ls(v.accounts), entities: ls(v.entities), finCats: ls(v.finCats), legalTypes: ls(v.legalTypes), custTypes: ls(v.custTypes), folders: ls(v.folders), lists: ls(v.lists), reconLead: Number(v.reconLead) || 5, briefHour: Number(v.briefHour) || 7, tz: v.tz || 'Asia/Bangkok'});
    }
  });
}
function saveCfg(changes){ put('settings', 'main', Object.assign({}, (D.settings || {}).main || {}, changes)); }

/* ---------- notifications inbox ---------- */
const myInbox = () => list('inbox').filter(n => n.to === me.email).sort(by('at', -1));
function openInbox(){
  const ns = myInbox().slice(0, 80);
  $('#popBody').innerHTML = '<div class="dlhd"><h2>Notifications</h2><button class="icon-btn" data-act="closePop" aria-label="Close">' + icon('x') + '</button></div>' +
    (ns.some(n => !n.read) ? '<button class="btn ghost sm" data-act="readAll" style="margin-bottom:10px">Mark all as seen</button>' : '') +
    '<p class="hint" style="margin-top:0">Marking something as seen does not complete the task.</p>' +
    (ns.length ? '<div class="list">' + ns.map(n => '<div class="item' + (n.ref ? ' click" data-act="openNote" data-id="' + n.id : '') + '" style="' + (n.read ? 'opacity:.62' : '') + '"><span class="av" style="background:' + ({escalation:'var(--red)', overdue:'var(--red)', reminder:'var(--amber)', handover:'var(--teal)'}[n.kind] || 'var(--s3)') + ';color:#fff">' + icon({escalation:'shield', overdue:'clock', reminder:'clock', handover:'users', mention:'users', comment:'list', briefing:'sunrise'}[n.kind] || 'bell') + '</span><div class="main"><div class="t">' + esc(n.title) + '</div><div class="meta">' + esc(n.body || '') + '</div><div class="meta">' + esc(fmtDT(n.at, 1)) + (n.by && n.by !== 'engine' && n.by !== 'self-test' ? ' · from ' + esc(firstName(n.by)) : '') + '</div></div>' + (n.read ? '' : '<button class="btn ghost sm" data-act="readNote" data-id="' + n.id + '">Seen</button>') + '</div>').join('') + '</div>' : empty('No notifications yet.'));
  if(!$('#pop').open) $('#pop').showModal();
}
function updateInboxDot(){
  const n = me ? myInbox().filter(x => !x.read).length : 0;
  $('#inboxDot').hidden = !n; $('#inboxDot').textContent = n > 9 ? '9+' : n;
}

/* ---------- search ---------- */
const SEARCH = [['tasks','title','Action'], ['payreqs','title','Payment request'], ['campaigns','name','Campaign'], ['customers','name','Customer'], ['recons','title','Reconciliation'], ['suppliers','title','Supplier follow-up'],
  ['opps','company','Partnership'], ['legal','title','Legal'], ['events','title','Meeting'], ['ledger','title','Money'], ['recurring','title','Recurring payment'], ['files','title','Document'], ['contacts','name','Contact'], ['company','label','Company detail'], ['notes','title','Note'], ['ideas','title','Idea']];
function openSearch(){
  $('#popBody').innerHTML = '<div class="dlhd"><h2>Search</h2><button class="icon-btn" data-act="closePop" aria-label="Close">' + icon('x') + '</button></div><input type="search" id="q" placeholder="Search everything" aria-label="Search"><div id="qr" style="margin-top:12px"></div>';
  if(!$('#pop').open) $('#pop').showModal();
  const q = $('#q'); q.oninput = () => runSearch(q.value); setTimeout(() => q.focus(), 50);
}
function runSearch(q){
  q = q.trim().toLowerCase();
  if(q.length < 2){ $('#qr').innerHTML = ''; return; }
  const out = [];
  SEARCH.forEach(([col, key, label]) => list(col).forEach(r => {
    const hay = Object.values(r).filter(v => typeof v === 'string').join(' ').toLowerCase();
    if(hay.includes(q)) out.push({col, r, t: r[key] || recTitle(col, r), label});
  }));
  list('comments').forEach(c => { if((c.text || '').toLowerCase().includes(q)){ const [col, id] = (c.ref || '').split('/'), r = get(col, id); if(r) out.push({col, r, t: recTitle(col, r), label: 'Comment: ' + c.text.slice(0, 60)}); } });
  $('#qr').innerHTML = out.length ? '<div class="list">' + out.slice(0, 50).map(x => '<div class="item click" data-act="openFromSearch" data-id="' + esc(x.col + '/' + x.r.id) + '"><div class="main"><div class="t">' + esc(x.t) + '</div><div class="meta"><span class="b">' + esc(x.label) + '</span>' + brandTag(x.r.brand) + '</div></div></div>').join('') + '</div>' : empty('Nothing found.');
}

/* ---------- Excel export ---------- */
let xlsxLoading = null;
function loadXlsx(){ return window.XLSX ? Promise.resolve() : (xlsxLoading = xlsxLoading || new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js'; s.onload = res; s.onerror = () => { xlsxLoading = null; rej(new Error('Could not load the Excel tool. Check your connection and try again.')); }; document.head.appendChild(s); })); }
async function exportXlsx(){
  try{
    toast('Building the Excel file'); await loadXlsx();
    const [a, b, label] = periodRange(ui.finPeriod, ui.finMonth);
    const rows = ledgerIn(a, b).sort(by('date'));
    const dirName = d => ({in:'In', out:'Out', 'due-in':'Owed to us', 'due-out':'We owe'}[d] || d);
    const led = r => ({'Date': r.date, 'Money': dirName(r.dir), 'Description': r.title, 'Amount': r.amount, 'Currency': r.currency, 'Category': r.cat || '', 'Brand': r.brand || '', 'Account': r.account || '', 'In Zoho': r.zoho ? 'Yes' : 'No', 'Notes': r.notes || ''});
    const sum = {}; rows.forEach(r => { const k = r.currency + '|' + (r.cat || 'Other'); sum[k] = sum[k] || {'Currency': r.currency, 'Category': r.cat || 'Other', 'In': 0, 'Out': 0}; if(r.dir === 'in') sum[k]['In'] += r.amount; if(r.dir === 'out') sum[k]['Out'] += r.amount; });
    const wb = XLSX.utils.book_new(), add = (data, name, blank) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.length ? data : [blank]), name.slice(0, 31));
    add(Object.values(sum).sort((x, y) => (x.Currency + x.Category) < (y.Currency + y.Category) ? -1 : 1), 'Summary', {'Category':'No entries in this period'});
    add(rows.map(led), 'Entries', {'Description':'No entries'});
    add(list('payreqs').sort(by('deadline')).map(p => ({'Request': p.title, 'Amount': p.amount, 'Currency': p.currency, 'Pay by': p.deadline || '', 'Entity': p.entity || '', 'Brand': p.brand || '', 'Status': p.status === 'open' ? shortStage(activeStage(p) || {}) : p.status, 'Taken on by': p.assignee ? nameOf(p.assignee) : '', 'Account': p.account || '', 'Paid': p.paidAmount != null ? p.paidAmount : '', 'Paid on': p.paidOn || '', 'In Zoho': p.zoho ? 'Yes' : 'No', 'Requested by': nameOf(p.by)})), 'Payment requests', {'Request':'None'});
    add(commitments(90).map(x => ({'Due': x.date, 'What': x.title, 'Type': x.kind, 'Amount': x.amount, 'Currency': x.currency})), 'Commitments', {'What':'None'});
    add(receivables().map(x => ({'Due': x.date, 'What': x.title, 'Type': x.kind, 'Amount': x.amount, 'Currency': x.currency})), 'Owed to us', {'What':'None'});
    XLSX.writeFile(wb, 'RAW-finance-' + label.replace(/\s+/g, '-') + '.xlsx');
  }catch(e){ toast(e.message || 'Export failed.'); }
}
