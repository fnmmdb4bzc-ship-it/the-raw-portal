/* The Raw Portal: navigation, taps, sign-in. Loaded last. */
'use strict';

const NAV = [
  {label:'Work', items:[['home','Dashboard','home','What needs attention'], ['mine','My actions','check','Everything you are responsible for'], ['tasks','All tasks','list','Filter by person, area, status'], ['waiting','Waiting on others','clock','Delegated and external follow-ups'], ['briefing','Briefing','sunrise','Daily and weekly summary']]},
  {label:'Business', items:[['finance','Finance','money','Payments, money in and out, commitments'], ['marketing','Marketing','mega','Campaign approvals and publishing'], ['customers','Customers','store','Stockists and monthly reconciliations'], ['suppliers','Suppliers and stock','truck','Deposits, deliveries, stock actions'], ['bizdev','Partnerships','hand','Opportunities and next steps'], ['legal','Legal and compliance','shield','Permits, licences, renewals']]},
  {label:'Shared', items:[['calendar','Calendar','cal','Every date in one place'], ['docs','Documents','file','Files and links'], ['details','Contacts and details','users','Company details and handy numbers']]}
];
const ROUTE_MOD = {finance:'finance', marketing:'marketing', customers:'customers', suppliers:'suppliers', bizdev:'bizdev', legal:'legal', docs:'docs', details:'details'};
const navVisible = it => { const m = ROUTE_MOD[it[0]]; return !m || canView(m); };
function navCounts(){
  if(!me || !loaded) return {};
  const mine = openTasks().filter(t => t.owner === me.email && !t.blocked);
  const endToday = new Date(); endToday.setHours(23, 59, 59, 999);
  const n = {mine: mine.filter(t => isOverdue(t) || (t.due && new Date(t.due) <= endToday) || ['approval','payment'].includes(t.status)).length};
  n.waiting = openTasks().filter(t => (t.by === me.email && t.owner !== me.email || t.status === 'external' && t.owner === me.email) && isOverdue(t)).length;
  if(canEdit('finance')) n.finance = openPayreqs().filter(p => !p.assignee).length;
  if(canView('marketing')) n.marketing = campaignsAtRisk().length;
  if(canView('customers')){ const s = reconStats(); n.customers = s.overdue.length + s.latePay.length; }
  if(canView('bizdev')) n.bizdev = list('opps').filter(inBrand).filter(o => o.stage !== 'Closed' && (!o.nextAction || !o.nextDate || daysTo(o.nextDate) < 0)).length;
  if(canView('legal')) n.legal = list('legal').filter(inBrand).filter(x => x.renewal && daysTo(x.renewal) <= 30 && x.status !== 'Closed').length;
  return n;
}

/* ---------- drawing ---------- */
let pending = false, lastToastNote = null;
function schedule(){
  if(!me) return;
  const a = document.activeElement;
  if(a && $('#view').contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== 'checkbox'){ pending = true; return; }
  if(schedule.t) return;
  schedule.t = requestAnimationFrame(() => { schedule.t = 0; render(); });
}
$('#view').addEventListener('focusout', () => { if(pending){ pending = false; setTimeout(schedule, 80); } });
function render(){
  if(!me) return;
  const c = cfg();
  document.title = c.name;
  $('#portalName').textContent = c.name.replace(/^the\s+/i, '').replace(/^raw\s*/i, '') || 'Portal';
  const bf = $('#brandFilter'), bopts = [['all', 'All brands'], ...c.brands.filter(b => !(me.brands || []).length || me.brands.includes(b.name)).map(b => [b.name, b.name])];
  if(!bopts.some(o => o[0] === ui.brand)) ui.brand = 'all';
  const bh = bopts.map(o => opt(o, ui.brand)).join(''); if(bf.innerHTML !== bh) bf.innerHTML = bh;
  const n = navCounts();
  const navBtn = ([r, l, ic]) => '<button class="navlink" data-act="go" data-id="' + r + '"' + (ui.route === r ? ' aria-current="page"' : '') + '>' + icon(ic) + esc(l) + (n[r] ? '<span class="n red">' + n[r] + '</span>' : '') + '</button>';
  $('#side').innerHTML = '<button class="logo" data-act="go" data-id="home"><span class="mark" aria-hidden="true"></span><b>RAW</b><span>' + esc($('#portalName').textContent) + '</span></button>' +
    NAV.map(g => { const its = g.items.filter(navVisible); return its.length ? '<div class="navgrp"><h4>' + esc(g.label) + '</h4>' + its.map(navBtn).join('') + '</div>' : ''; }).join('') +
    (canView('more') ? '<div class="navgrp"><h4>More</h4>' + MORE.map(navBtn).join('') + '</div>' : '') +
    '<div class="navgrp"><h4>You</h4>' + navBtn(['settings', 'Team and settings', 'gear']) + '<div class="meta" style="padding:4px 10px">' + esc(me.email) + '</div></div>';
  const inMenu = !['home','mine','calendar'].includes(ui.route);
  $('#bottom').innerHTML =
    '<button data-act="go" data-id="home"' + (ui.route === 'home' ? ' aria-current="page"' : '') + '>' + icon('home') + 'Home</button>' +
    '<button data-act="go" data-id="mine"' + (ui.route === 'mine' ? ' aria-current="page"' : '') + '>' + icon('check') + 'My actions' + (n.mine ? '<span class="dot">' + n.mine + '</span>' : '') + '</button>' +
    '<button class="cap" data-act="capture" aria-label="Quick capture">' + icon('plus') + '</button>' +
    '<button data-act="go" data-id="calendar"' + (ui.route === 'calendar' ? ' aria-current="page"' : '') + '>' + icon('cal') + 'Calendar</button>' +
    '<button data-act="go" data-id="menu"' + (inMenu ? ' aria-current="page"' : '') + '>' + icon('menu') + 'Menu</button>';
  const a = document.activeElement, keep = a && a.id && $('#view').contains(a) ? {id: a.id, v: a.value} : null;
  $('#view').innerHTML = (R[ui.route] || R.home)();
  if(keep){ const el = document.getElementById(keep.id); if(el){ el.value = keep.v; el.focus(); } }
  if(ui.focus){ const el = document.getElementById(ui.focus); if(el) el.focus(); ui.focus = null; }
  hydrate($('#view'));
  updateInboxDot();
  const newest = myInbox().find(x => !x.read);
  if(newest && lastToastNote !== null && newest.id !== lastToastNote && msLeft(newest.at) > -60000) toast(newest.title + (newest.body ? ': ' + newest.body : ''));
  lastToastNote = newest ? newest.id : '';
  if(ui.open && $('#sheet').open) renderSheet();
  if(ui.route === 'settings') renderPushCard();
  if($('#pop').open && ui.pop === 'inbox') openInbox();
  $('#themeIcon').setAttribute('href', effectiveTheme() === 'dark' ? '#i-sun' : '#i-moon');
}
function go(route){
  ui.route = route === 'today' ? 'home' : route;
  if(!R[ui.route]) ui.route = 'home';
  try{ history.replaceState(null, '', '#' + ui.route); }catch(e){}
  render(); window.scrollTo(0, 0);
}
function effectiveTheme(){ const t = document.documentElement.getAttribute('data-theme'); return t || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'); }
function setTheme(t){
  try{ localStorage.setItem('raw-theme', t); }catch(e){}
  if(t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
  const meta = document.querySelector('meta[name=theme-color]'); if(meta) meta.content = effectiveTheme() === 'dark' ? '#121111' : '#f5f3ef';
  render();
}

/* ---------- every tap ---------- */
const pickPerson = (titleText, cur, onPick) => openForm({title: titleText, values:{who: cur}, fields:[{k:'who', label:'Person', type:'select', options: peopleOpts()}], saveLabel:'Hand over', onSave: v => onPick(v.who)});
const A = {
  go: id => { closeSheet(); go(id); },
  open: id => { const i = id.indexOf('/'); openRecord(id.slice(0, i), id.slice(i + 1)); },
  closeSheet: () => closeSheet(),
  tick: id => completeTask(id),
  newTask: () => taskForm(),
  editTask: id => taskForm(id),
  newTaskFor: ref => { const [col, id] = ref.split('/'), r = get(col, id); taskForm(null, {values:{module: col === 'customers' ? 'customers' : col === 'legal' ? 'legal' : 'general', brand: r && r.brand || '', title:''}, extra:{ref}}); },
  quickStatus: id => { const t = get('tasks', id); openForm({title:'Status', values:{status: t.status, waitingOn: t.waitingOn, due: t.due}, fields:[{k:'status', label:'Status', type:'select', options: STATUS}, {k:'waitingOn', label:'Waiting on (if outside the team)'}, {k:'due', label:'Deadline or follow-up date', type:'datetime'}],
    onSave: v => { if(v.status === 'external' && !v.due) throw new Error('Add a follow-up date.'); if(v.status === 'done') return markDone(id); patch('tasks', id, {status: v.status, waitingOn: v.waitingOn, due: v.due}); logAct('tasks/' + id, 'set the status to ' + STATUS_LABEL[v.status]); }}); },
  gotReply: id => { patch('tasks', id, {status:'progress'}); logAct('tasks/' + id, 'got a reply'); toast('Marked as in progress. Tick it when it is done.'); },
  doStage: id => { const [col, rid, uid] = id.split('/'); openStageForm(col, rid, uid); },
  handover: id => { const [col, rid] = id.split('/'), s = activeStage(get(col, rid)); if(s) pickPerson('Hand over: ' + s.label, s.owner, who => reassignStage(col, rid, who)); },
  cancelWf: id => { const [col, rid] = id.split('/'); openForm({title:'Cancel this request', fields:[{k:'reason', label:'Why', required:true}], saveLabel:'Cancel it', onSave: v => cancelWorkflow(col, rid, v.reason)}); },
  editRec: id => { const [col, rid] = id.split('/'); (FORMS[col] || (() => {}))(rid); },
  oppNext: id => { const o = get('opps', id), i = OPP_STAGES.indexOf(o.stage); patch('opps', id, {stage: OPP_STAGES[i + 1]}); logAct('opps/' + id, 'moved it to ' + OPP_STAGES[i + 1]); toast('Moved. Check the next action is still right.'); setTimeout(() => oppForm(id, {focusNext:true}), 200); },
  payFor: id => { const x = get('legal', id); payreqForm(null, {values:{title: x.title + ': ', cat:'Legal and professional', brand: x.brand || '', entity: x.entity}, extra:{legal: id}}); },
  postCmt: () => postComment(),
  newPayreq: () => payreqForm(), newLedger: () => ledgerForm(), newRecurring: () => recurringForm(), newCampaign: () => campaignForm(),
  newCustomer: () => customerForm(), newSupplier: t => supplierForm(null, {values: t ? {type: t, title: t} : {}}), newOpp: () => oppForm(), newLegal: () => legalForm(),
  newEvent: () => eventForm(), newFile: () => fileForm(), editFile: id => fileForm(id),
  editCompany: id => formCompany(id), editPerson: id => formPerson(id), editContact: id => formContact(id),
  copy: id => { const x = get('company', id); if(!x) return; (navigator.clipboard ? navigator.clipboard.writeText(x.value) : Promise.reject()).then(() => toast('Copied'), () => toast('Could not copy. Press and hold the text instead.')); },
  exportXlsx: () => exportXlsx(),
  finPeriod: id => { ui.finPeriod = id; render(); }, finPrev: () => { ui.finMonth = ym(parseD(addMonths(ui.finMonth + '-01', -1))); render(); }, finNext: () => { ui.finMonth = ym(parseD(addMonths(ui.finMonth + '-01', 1))); render(); },
  toggleClosed: () => { ui.showClosed = !ui.showClosed; render(); },
  calDay: id => { ui.calDay = id; if(id.slice(0, 7) !== ui.calMonth) ui.calMonth = id.slice(0, 7); render(); },
  calPrev: () => { ui.calMonth = ym(parseD(addMonths(ui.calMonth + '-01', -1))); render(); }, calNext: () => { ui.calMonth = ym(parseD(addMonths(ui.calMonth + '-01', 1))); render(); },
  mineView: id => { ui.mineView = id; render(); }, briefTab: id => { ui.briefTab = id; render(); }, print: () => window.print(),
  teamFilter: email => { ui.taskF = {who: email, status:'open', mod:'', pri:''}; go('tasks'); },
  docFilter: id => { ui.docFilter = id; render(); }, listFilter: id => { ui.listFilter = id; render(); },
  ideaSort: id => { ui.ideaSort = id; render(); }, openIdea: id => { ui.openIdea = ui.openIdea === id ? null : id; render(); },
  vote: id => { const i = get('ideas', id); if(!i) return; const v = i.votes || []; patch('ideas', id, {votes: v.includes(me.email) ? v.filter(x => x !== me.email) : [...v, me.email]}); },
  ideaToTask: id => { const i = get('ideas', id); taskForm(null, {values:{title: i.title, desc: i.body || ''}}); patch('ideas', id, {status:'Doing'}); },
  newIdea: () => formIdea(), editIdea: id => formIdea(id), newNote: () => formNote(), editNote: id => formNote(id),
  newPhoto: () => formPhoto(), morePhotos: () => { ui.photoLimit += 30; render(); },
  viewPhoto: id => { const p = get('photos', id); if(!p) return; $('#vImg').removeAttribute('src'); $('#vImg').dataset.f = p.path; $('#vImg').dataset.b = 'photos'; $('#vCap').textContent = (p.caption || '') + '\n' + firstName(p.by) + ' · ' + fmtD(p.date); $('#vEdit').onclick = () => { $('#viewer').close(); formPhoto(id); }; $('#viewer').showModal(); hydrate($('#viewer')); },
  newTrip: () => formTrip(), editTrip: id => formTrip(id),
  tickTrip: (id, el) => { const t = get('trips', id); if(!t) return; patch('trips', id, {checklist: (t.checklist || []).map((x, i) => i === +el.dataset.i ? {t: x.t, done: !x.done} : x)}); },
  tickItem: id => { const i = get('shopping', id); if(i) patch('shopping', id, {done: !i.done}); }, editItem: id => formItem(id),
  clearTicked: () => { const ids = list('shopping').filter(i => i.done).map(i => i.id); ids.forEach(id => delete D.shopping[id]); render(); sb.from('docs').delete().eq('collection', 'shopping').in('id', ids).then(({error}) => { if(error) toast('Could not clear. ' + error.message); }); },
  newCountdown: () => formCountdown(), editCountdown: id => formCountdown(id),
  capture: () => openCapture(), closeCapture: () => { if(CAP.rec && CAP.rec.state === 'recording') CAP.rec.stop(); if(CAP.speech) CAP.speech.stop(); $('#capture').close(); },
  capAs: k => capAs(k), suggest: () => { CAP.sugg = parseInstruction($('#capText').value || ''); renderSuggestions(); }, createSugg: () => createSuggestions(),
  voice: () => toggleVoice(), dictate: () => toggleDictate(), capRm: i => { CAP.files.splice(+i, 1); renderCapAtt(); },
  inbox: () => { ui.pop = 'inbox'; openInbox(); }, closePop: () => { ui.pop = null; $('#pop').close(); },
  readNote: id => patch('inbox', id, {read:true}),
  readAll: () => myInbox().filter(n => !n.read).forEach(n => patch('inbox', n.id, {read:true})),
  openNote: id => { const n = get('inbox', id); if(!n) return; if(!n.read) patch('inbox', id, {read:true}); ui.pop = null; $('#pop').close(); routeRef(n.ref); },
  search: () => { ui.pop = 'search'; openSearch(); }, openFromSearch: id => { ui.pop = null; $('#pop').close(); A.open(id); },
  theme: id => setTheme(id || (effectiveTheme() === 'dark' ? 'light' : 'dark')),
  savePhone: () => { const v = $('#myPhone').value.trim(); sb.rpc('set_my_profile', {p_tz: null, p_phone: v}).then(({error}) => { if(error) toast(error.message); else { toast('Saved.'); loadMembers().then(render); } }); },
  pushOn: () => pushOn(), pushOff: () => pushOff(), testPush: () => testPush(),
  addProfile: () => profileForm(), editProfile: id => profileForm(id),
  addMember: () => memberForm(), editMember: id => memberForm(id), editRoles: () => rolesForm(), editSetup: () => setupForm(),
  editNotice: () => openForm({title:'Notice', values:{notice: cfg().notice}, fields:[{k:'notice', label:'Message for everyone on the dashboard', type:'textarea', rows:4}], onSave: v => saveCfg({notice: v.notice})}),
  signOut: () => sb.auth.signOut()
};
function routeRef(ref){
  if(!ref) return go('home');
  const [col, id] = ref.split('/');
  if(col === 'briefing'){ ui.briefTab = id === 'week' ? 'week' : 'today'; return go('briefing'); }
  A.open(ref);
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if(!el || !me) return;
  const inner = e.target.closest('a[href], label, input, select, textarea');
  if(inner && inner !== el && el.contains(inner)) return;
  const fn = A[el.dataset.act];
  if(fn){ if(el.tagName === 'BUTTON' || el.tagName === 'A' && !el.getAttribute('href')) e.preventDefault(); e.stopPropagation(); fn(el.dataset.id, el); }
});
document.addEventListener('change', e => {
  const f = e.target.closest('select[data-filter]');
  if(f){ const [o, k] = f.dataset.filter.split('.'); ui[o][k] = f.value; render(); }
});
$('#brandFilter').addEventListener('change', e => { ui.brand = e.target.value; try{ localStorage.setItem('raw-brand', ui.brand); }catch(x){} render(); });
document.addEventListener('submit', e => {
  const f = e.target.closest('form[data-form]'); if(!f) return;
  e.preventDefault();
  if(f.dataset.form === 'addItem'){ const inp = $('#addItem'), t = inp.value.trim(); if(!t) return; const l = $('#addList').value; ui.lastList = l; inp.value = ''; ui.focus = 'addItem'; put('shopping', newId(), Object.assign({title: t, list: l, done:false}, stamp())); }
  if(f.dataset.form === 'idea'){ const id = f.dataset.id, inp = document.getElementById('c-' + id), t = inp.value.trim(), i = get('ideas', id); if(!t || !i) return; inp.value = ''; patch('ideas', id, {comments: [...(i.comments || []), Object.assign({text: t}, stamp())]}); }
});
$('#vClose').onclick = () => $('#viewer').close();
$('#sheet').addEventListener('close', () => { ui.open = null; try{ history.replaceState(null, '', '#' + ui.route); }catch(e){} });
$('#pop').addEventListener('close', () => { ui.pop = null; });
document.addEventListener('keydown', e => { if(e.key === 'Enter' && !e.shiftKey && e.target.id === 'cmtText'){ e.preventDefault(); postComment(); } });
document.addEventListener('visibilitychange', () => { if(!document.hidden && me && loaded) loadAll().then(() => { schedule(); generateRecurring(); }).catch(() => {}); });
if('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', e => { if(e.data && e.data.url) handleHash(e.data.url.replace(/^.*#/, '')); });
function handleHash(h){
  h = h || '';
  if(h.startsWith('open/')) return routeRef(h.slice(5));
  if(h) go(h.split('/')[0]); else go('home');
}

/* ---------- sign-in ---------- */
let curUid = null;
function gate(text, signedIn){
  $('#app').hidden = true; $('#gate').hidden = false; $('#gateText').textContent = text;
  $('#gGoogle').hidden = signedIn; $('#gEmailBox').hidden = signedIn; $('#gOut').hidden = !signedIn;
}
async function handleUser(u){
  if(chan){ sb.removeChannel(chan); chan = null; }
  me = null; loaded = false; D = {};
  if(!u){ gate('Team members only. Sign in to continue.', false); return; }
  const email = (u.email || '').toLowerCase();
  try{
    await loadMembers();
    me = MEMBERS.find(m => m.email === email) || null;
    if(!me){ gate(email + ' is not on the team list. Ask an admin to add this exact address, or sign out and use a different account.', true); return; }
    await loadAll();
  }catch(e){ me = null; gate('Could not reach the portal. Check your connection and try again. ' + (e.message || ''), true); return; }
  const hash = location.hash.slice(1);
  if(/(access_token|code)=/.test(location.href)){ try{ history.replaceState(null, '', location.pathname); }catch(e){} }
  subscribe();
  try{ ui.brand = localStorage.getItem('raw-brand') || 'all'; }catch(e){}
  $('#gate').hidden = true; $('#app').hidden = false; $('#gateErr').textContent = '';
  const tz = (Intl.DateTimeFormat().resolvedOptions() || {}).timeZone || '';
  if(tz && tz !== me.tz) sb.rpc('set_my_profile', {p_tz: tz, p_phone: null}).then(() => {});
  handleHash(/(access_token|code)=/.test(hash) ? '' : hash);
  generateRecurring();
  clearInterval(handleUser.iv); handleUser.iv = setInterval(generateRecurring, 30 * 60 * 1000);
}
function boot(){
  if(!window.supabase){ gate('The page could not load fully. Check your connection and reload.', false); $('#gGoogle').hidden = true; $('#gEmailBox').hidden = true; return; }
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {auth:{persistSession:true, autoRefreshToken:true, detectSessionInUrl:true}});
  const back = location.origin + location.pathname;
  $('#gGoogle').onclick = async () => { $('#gateErr').textContent = ''; const {error} = await sb.auth.signInWithOAuth({provider:'google', options:{redirectTo: back, queryParams:{prompt:'select_account'}}}); if(error) $('#gateErr').textContent = error.message; };
  $('#gLink').onclick = async () => { const e = $('#gEmail').value.trim().toLowerCase(); if(!e){ $('#gateErr').textContent = 'Type your email address first.'; return; }
    $('#gLink').disabled = true; const {error} = await sb.auth.signInWithOtp({email: e, options:{emailRedirectTo: back}}); $('#gLink').disabled = false;
    $('#gateErr').textContent = error ? error.message : 'Check your inbox for a sign-in link and open it on this device.'; };
  $('#gOut').onclick = () => sb.auth.signOut();
  const err = new URLSearchParams(location.hash.slice(1) || location.search).get('error_description');
  if(err) $('#gateErr').textContent = err.replace(/\+/g, ' ');
  sb.auth.onAuthStateChange((event, session) => {
    const u = session && session.user, id = u ? u.id : null;
    if(id === curUid && (me || !id)) return;
    curUid = id; setTimeout(() => handleUser(u), 0);
  });
}
boot();
