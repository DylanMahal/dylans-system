/* ================= JOURNAL tabs: journal · notes (Apple Notes) · tasks (Todoist) =================
   notes: notes/n-<id> {id,html,folder,pin,created,upd} · notes/folders {list:[name]}
   tasks: tasks/all {list:[task],projects:[{id,n,col}]}  task {id,t,d,tm,p,proj,rep,note,sub:[{t,x}],done,created} */
let JTAB=LS.get('jtab')||'journal';
function setJTab(t){if(typeof inkExitFull==='function')inkExitFull();JTAB=t;LS.set('jtab',t);document.querySelectorAll('#jTabs [data-jt]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.jt===t));
  $('jPaneJ').hidden=t!=='journal';$('jPaneN').hidden=t!=='notes';$('jPaneT').hidden=t!=='tasks';
  if(t==='notes')loadNotes();if(t==='tasks')loadTasks();if(t==='journal'){if(jLoaded)renderJEditor();else loadJournal()}}
document.addEventListener('click',e=>{const b=e.target.closest('#jTabs [data-jt]');if(b)setJTab(b.dataset.jt)});

/* ---------------- NOTES ---------------- */
let NOTES={},NFOLD={list:['notes']},notesLoaded=false,NCUR=null,NF=LS.get('nfold')||'all',nSaveT=null;
async function loadNotes(){if(notesLoaded){renderNotes();return}const [rows,f]=await Promise.all([listDocs('notes/n-'),load('notes/folders')]);
  rows.forEach(r=>{if(r.data)NOTES[r.data.id]=r.data});NFOLD={list:['notes'],...(f||{})};notesLoaded=true;renderNotes()}
watchPrefix('notes/n-',(evt,path,data)=>{const id=path.slice(8);if(evt==='DELETE')delete NOTES[id];else if(data){if(NCUR===id&&((document.activeElement&&document.activeElement.id==='nEd')||nInkBusy()))return;NOTES[id]=data}if(cur==='journal'&&JTAB==='notes')renderNotes(true)});
watch('notes/folders',d=>{if(d)NFOLD={list:['notes'],...d}});
const nText=h=>{const d=document.createElement('div');d.innerHTML=h||'';d.querySelectorAll('li,p,div,h1,h2,h3,br').forEach(x=>x.append(' '));return d.textContent.replace(/\s+/g,' ').trim()};
const nTitle=n=>{const d=document.createElement('div');d.innerHTML=n.html||'';const f=[...d.childNodes].map(x=>x.textContent.trim()).find(Boolean);return (f||(n.ink&&n.ink.strokes&&n.ink.strokes.length?'handwritten note':'new note')).slice(0,80)};
function nAgo(t){const d=new Date(t),n=new Date();return ymd(d)===ymd(n)?d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}):((n-d)<6*864e5?d.toLocaleDateString('en-GB',{weekday:'long'}):d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'2-digit'})).toLowerCase()}
function renderNotes(listOnly){const el=$('jPaneN');if(!el)return;const q=(($('nQ')||{}).value||'').toLowerCase();
  const all=Object.values(NOTES).filter(n=>NF==='all'||n.folder===NF).filter(n=>!q||nText(n.html).toLowerCase().includes(q)).sort((a,b)=>(b.pin?1:0)-(a.pin?1:0)||(b.upd>a.upd?1:-1));
  const listHtml=`${all.map(n=>{const t=nTitle(n);const body=nText(n.html).slice(t.length).trim();const th=nThumb(n);return `<button type="button" class="nitem${n.id===NCUR?' on':''}${th?' hasth':''}" data-n="${n.id}">${th}<b>${n.pin?'📌 ':''}${esc(t)}</b><span class="dim"><span class="num">${nAgo(n.upd)}</span> ${esc(body.slice(0,70))||(th?'handwriting':'no additional text')}</span></button>`}).join('')||'<div class="dim" style="padding:14px 4px">No notes</div>'}`;
  if(listOnly&&$('nList')){$('nList').innerHTML=listHtml;return}
  el.innerHTML=`<div class="ngrid${NCUR?' editing':''}"><div class="nside"><div class="row" style="gap:6px"><input class="inp" id="nQ" type="search" placeholder="Search notes" value="${esc(q)}" style="flex:1"><button class="btn p" type="button" id="nNew" title="new note">✎</button></div>
    <div class="chips" id="nFolders" style="margin:8px 0">${['all',...NFOLD.list].map(f=>`<button type="button" class="chip${NF===f?' on':''}" data-nf="${esc(f)}">${esc(f)}</button>`).join('')}<button type="button" class="chip" id="nAddF">+ Folder</button></div>
    <div class="nlistw" id="nList">${listHtml}</div></div>
    <div class="neditor panel">${NCUR&&NOTES[NCUR]?nEditorHtml(NOTES[NCUR]):'<div class="pb dim nempty">pick a note or start a new one ✎</div>'}</div></div>`;
  nBind();if(NCUR&&NOTES[NCUR])nInkMount();else inkExitFull()}
const NSV=d=>`<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const NFMT=[['h','<span class="ft">H</span>','Heading'],['b','<span class="ft fb">B</span>','Bold'],['i','<span class="ft fi">I</span>','Italic'],['u','<span class="ft fu">U</span>','Underline'],['s','<span class="ft fs">S</span>','Strikethrough'],['hl',NSV('<path d="M14 4l6 6-8 8H7l-3-3 10-11z"/><path d="M5 21h14"/>'),'Highlight text'],'|',
 ['ul',NSV('<path d="M9 7h11M9 12h11M9 17h11"/><circle cx="4.5" cy="7" r=".9"/><circle cx="4.5" cy="12" r=".9"/><circle cx="4.5" cy="17" r=".9"/>'),'Bullets'],['ol',NSV('<path d="M10 7h10M10 12h10M10 17h10M4 6l1.5-1v4.5M4 14.5h3l-3 3.5h3"/>'),'Numbers'],['chk',NSV('<circle cx="7.5" cy="12" r="3.6"/><path d="M6 12l1.2 1.2L9.2 11M14 12h6"/>'),'Checklist'],'|',
 ['q',NSV('<path d="M5 18V12a5 5 0 015-5M13 18V12a5 5 0 015-5"/>'),'Quote'],['code',NSV('<path d="M9 7l-5 5 5 5M15 7l5 5-5 5"/>'),'Code'],['hr',NSV('<path d="M4 12h16"/>'),'Divider']];
const NFMT_HTML=NFMT.map(f=>f==='|'?'<span class="ib-sep"></span>':`<button type="button" data-nc="${f[0]}" title="${f[2]}" aria-label="${f[2]}">${f[1]}</button>`).join('');
const NHL=['rgba(255,225,77,.42)','rgba(125,255,155,.36)','rgba(255,126,182,.42)','rgba(106,215,255,.38)'];
function nEditorHtml(n){return `<div class="nhead"><button type="button" class="nback" id="nBack">‹ Notes</button>
  <select id="nFold" class="nfsel" aria-label="Folder">${NFOLD.list.map(f=>`<option ${n.folder===f?'selected':''}>${esc(f)}</option>`).join('')}</select>
  <span class="nsp"></span><span id="nSaved" class="nstat"></span>
  <button type="button" class="nicon" id="nPin" title="${n.pin?'Unpin':'Pin'}" aria-label="Pin" aria-pressed="${!!n.pin}">${NSV('<path d="M12 17v5M8 3h8l-1 6 3 4H6l3-4z"/>')}</button>
  <button type="button" class="nicon" id="nCopy" title="Copy text" aria-label="Copy">${NSV('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 012-2h9"/>')}</button>
  <button type="button" class="nicon nbad" id="nDel" title="Delete note" aria-label="Delete">${NSV('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>')}<span class="lbl">Delete?</span></button></div>
  <div class="ndate">${new Date(n.upd).toLocaleString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
  <div class="ned" id="nEd" contenteditable="true" spellcheck="true">${n.html||'<h2><br></h2>'}</div>`}
function nBind(){const el=$('jPaneN');
  el.oninput=e=>{if(e.target.id==='nQ'){clearTimeout(nBind.t);nBind.t=setTimeout(()=>renderNotes(true),150);return}if(e.target.id==='nEd')nDirty()};
  el.onchange=e=>{if(e.target.id==='nFold'&&NCUR){NOTES[NCUR].folder=e.target.value;nSave()}};
  el.onclick=e=>{const ck=e.target.closest('.ned ul.chk>li');if(ck&&e.offsetX<26){ck.dataset.c=ck.dataset.c==='1'?'0':'1';nDirty();return}
    const b=e.target.closest('button');if(!b)return;const d=b.dataset;
    if(d.n){NCUR=d.n;renderNotes();if(innerWidth>900)setTimeout(()=>{const ed=$('nEd');ed&&ed.focus()},50);return}
    if(d.nf){NF=d.nf;LS.set('nfold',NF);renderNotes();return}
    if(b.id==='nNew'){const id=rid()+rid();NOTES[id]={id,html:'<h2><br></h2>',folder:NF==='all'?(NFOLD.list[0]||'notes'):NF,pin:false,created:new Date().toISOString(),upd:new Date().toISOString()};NCUR=id;renderNotes();setTimeout(()=>{const ed=$('nEd');if(ed){ed.focus();const r=document.createRange();r.selectNodeContents(ed.firstChild||ed);r.collapse(true);const s=getSelection();s.removeAllRanges();s.addRange(r)}},40);return}
    if(b.id==='nAddF'){const f=prompt('new folder name');if(f&&!NFOLD.list.includes(f.trim())){NFOLD.list.push(f.trim());save('notes/folders',NFOLD);NF=f.trim();renderNotes()}return}
    if(b.id==='nBack'){nFlush();NCUR=null;renderNotes();return}
    if(!NCUR)return;const n=NOTES[NCUR];
    if(b.id==='nPin'){n.pin=!n.pin;nSave();renderNotes();return}
    if(b.id==='nCopy'){navigator.clipboard&&navigator.clipboard.writeText($('nEd').innerText).then(()=>{b.classList.add('ok');setTimeout(()=>b.classList.remove('ok'),1400)});return}
    if(b.id==='nDel'){if(!b.dataset.arm){b.dataset.arm=1;b.classList.add('arm');setTimeout(()=>{delete b.dataset.arm;b.classList.remove('arm')},2500);return}delete NOTES[NCUR];removeDoc('notes/n-'+NCUR);NCUR=null;renderNotes();return}
    if(d.nc){nCmd(d.nc);return}};
  el.onmousedown=el.onpointerdown=e=>{if(e.target.closest('[data-nc]'))e.preventDefault()}}
function nCmd(c){const ed=$('nEd');if(!ed)return;
  const pop=document.querySelector('#nTools .ib-hlpop');
  if(c==='hl'){pop&&pop.classList.toggle('open');return}
  ed.focus();const X=(a,v)=>document.execCommand(a,false,v);
  if(c.startsWith('hl:')){const v=c.slice(3);X('styleWithCSS',false,true);X('hiliteColor',false,v==='none'?'transparent':v);X('styleWithCSS',false,false);pop&&pop.classList.remove('open');nDirty();return}
  pop&&pop.classList.remove('open');
  if(c==='h'){const blk=(getSelection().anchorNode||{}).parentElement;X('formatBlock',blk&&blk.closest&&blk.closest('h2')?'div':'h2')}
  else if(c==='b')X('bold');else if(c==='i')X('italic');else if(c==='u')X('underline');else if(c==='s')X('strikeThrough');
  else if(c==='ul')X('insertUnorderedList');else if(c==='ol')X('insertOrderedList');else if(c==='q')X('formatBlock','blockquote');else if(c==='code')X('formatBlock','pre');else if(c==='hr')X('insertHorizontalRule');
  else if(c==='chk'){X('insertUnorderedList');const n=getSelection().anchorNode;const ul=n&&(n.nodeType===1?n:n.parentElement).closest('ul');if(ul){ul.classList.toggle('chk');ul.querySelectorAll('li').forEach(li=>{if(!li.dataset.c)li.dataset.c='0'})}}
  nDirty()}
function nDirty(){if(!NCUR)return;NOTES[NCUR].html=$('nEd').innerHTML;NOTES[NCUR].upd=new Date().toISOString();if($('nSaved'))$('nSaved').textContent='…';clearTimeout(nSaveT);nSaveT=setTimeout(nSave,600)}
function nSave(){clearTimeout(nSaveT);if(!NCUR||!NOTES[NCUR])return;const n=NOTES[NCUR];if(!nText(n.html)&&!/<img|<hr/.test(n.html)&&!(n.ink&&n.ink.strokes&&n.ink.strokes.length)){removeDoc('notes/n-'+n.id)}else save('notes/n-'+n.id,n,true);if($('nSaved'))$('nSaved').textContent='saved';renderNotes(true)}
function nFlush(){if(nSaveT)nSave()}
addEventListener('pagehide',nFlush);

/* ---------------- TASKS ---------------- */
let TASKS={list:[],projects:[]},tasksLoaded=false,TV=LS.get('tview')||'today';
const PCOL=['#7a7a7a','#05d9e8','#ffb000','#ff2a6d'];
async function loadTasks(){if(tasksLoaded){renderTasks();return}const d=await load('tasks/all');TASKS={list:[],projects:[],...(d||{})};tasksLoaded=true;renderTasks()}
watch('tasks/all',d=>{if(d){TASKS={list:[],projects:[],...d};if(cur==='journal'&&JTAB==='tasks'&&!(document.activeElement&&document.activeElement.id==='tAdd'))renderTasks()}});
const tSave=()=>{save('tasks/all',TASKS);if(typeof pushSync==='function')pushSync();if(typeof renderTodayTasks==='function')renderTodayTasks()};
/* natural language: "gym tmrw 7pm p1 #health every mon" */
function tParse(s){let t=' '+s+' ',d=null,tm=null,p=3,proj=null,rep=null;const today=new Date(DAYK+'T12:00');const fmt=x=>ymd(x);const add=n=>{const x=new Date(today);x.setDate(x.getDate()+n);return fmt(x)};
  const DN=['sun','mon','tue','wed','thu','fri','sat'];
  t=t.replace(/\sp([1-4])\b/i,(m,a)=>{p=+a;return ' '});
  t=t.replace(/\s#([\w-]+)/,(m,a)=>{const P=TASKS.projects.find(x=>x.n.toLowerCase()===a.toLowerCase());proj=P?P.id:(()=>{const id=rid();TASKS.projects.push({id,n:a,col:HCOLS?HCOLS[TASKS.projects.length%HCOLS.length]:'#05d9e8'});return id})();return ' '});
  t=t.replace(/\severy\s+(day|weekday|week|month|year|(mon|tue|wed|thu|fri|sat|sun)\w*|(\d+)\s*days?)\b/i,(m,a,dn,n)=>{rep=n?'every '+n+' days':dn?'every '+dn.slice(0,3).toLowerCase():a.toLowerCase()==='day'?'daily':a.toLowerCase()==='weekday'?'weekdays':a.toLowerCase()+'ly';if(!d)d=dn?null:DAYK;return ' '});
  t=t.replace(/\s(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i,(m,h,mi,ap)=>{h=+h%12+(ap.toLowerCase()==='pm'?12:0);tm=pad(h)+':'+pad(+mi||0);return ' '});
  t=t.replace(/\s(?:at\s+)(\d{1,2}):(\d{2})\b|\s(\d{1,2}):(\d{2})\b/,(m,a,b,c,e)=>{tm=pad(+(a||c))+':'+(b||e);return ' '});
  t=t.replace(/\s(today|tonight|tod)\b/i,(m,a)=>{d=DAYK;if(/tonight/i.test(a)&&!tm)tm='20:00';return ' '});
  t=t.replace(/\s(tomorrow|tmrw|tmr|tom)\b/i,()=>{d=add(1);return ' '});
  t=t.replace(/\snext\s+week\b/i,()=>{d=add(((8-today.getDay())%7)||7);return ' '});
  t=t.replace(/\sin\s+(\d+)\s+(day|week)s?\b/i,(m,n,u)=>{d=add(+n*(u.toLowerCase()==='week'?7:1));return ' '});
  t=t.replace(/\s(?:on\s+|next\s+)?(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b/i,(m,a)=>{const i=DN.indexOf(a.toLowerCase());let k=(i-today.getDay()+7)%7;if(!k)k=7;if(!d)d=add(k);return ' '});
  t=t.replace(/\s(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/,(m,a,b,c)=>{const y=c?(+c<100?2000+ +c:+c):today.getFullYear();const x=new Date(y,+b-1,+a,12);if(!c&&x<today)x.setFullYear(y+1);d=fmt(x);return ' '});
  if(rep&&!d)d=DAYK;if(tm&&!d)d=DAYK;
  return {t:t.replace(/\s+/g,' ').trim(),d,tm,p,proj,rep}}
function tNext(tk){const x=new Date((tk.d||DAYK)+'T12:00');const r=tk.rep||'';const DN=['sun','mon','tue','wed','thu','fri','sat'];
  if(r==='daily')x.setDate(x.getDate()+1);else if(r==='weekdays'){do x.setDate(x.getDate()+1);while(x.getDay()===0||x.getDay()===6)}else if(r==='weekly')x.setDate(x.getDate()+7);else if(r==='monthly')x.setMonth(x.getMonth()+1);else if(r==='yearly')x.setFullYear(x.getFullYear()+1);
  else if(/^every \d+ days$/.test(r))x.setDate(x.getDate()+ +r.match(/\d+/)[0]);else if(/^every (\w{3})$/.test(r)){const i=DN.indexOf(r.slice(6));do x.setDate(x.getDate()+1);while(x.getDay()!==i)}else return null;
  let k=ymd(x);while(k<DAYK){const y=new Date(k+'T12:00');y.setDate(y.getDate()+1);k=ymd(y)}return k}
function tWhen(tk){if(!tk.d)return '';const diff=Math.round((new Date(tk.d+'T12:00')-new Date(DAYK+'T12:00'))/864e5);const lab=diff===0?'today':diff===1?'tomorrow':diff===-1?'yesterday':diff<0?nice(tk.d).toLowerCase():diff<7?new Date(tk.d+'T12:00').toLocaleDateString('en-GB',{weekday:'long'}).toLowerCase():nice(tk.d).toLowerCase();return lab+(tk.tm?' '+tk.tm:'')}
const TSV=d=>`<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const TIC={cal:'<rect x="4" y="5.5" width="16" height="14" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',rep:'<path d="M17 3l3 3-3 3"/><path d="M20 6H8a4 4 0 00-4 4v1M7 21l-3-3 3-3"/><path d="M4 18h12a4 4 0 004-4v-1"/>',sub:'<path d="M4 6.5l1.8 1.8L9 5M4 15.5l1.8 1.8L9 14M12.5 7h7.5M12.5 16h7.5"/>',plus:'<path d="M12 5v14M5 12h14"/>',inbox:'<path d="M3.5 13l2.5-8h12l2.5 8v6H3.5z"/><path d="M3.5 13H9l1 2h4l1-2h5.5"/>',done:'<circle cx="12" cy="12" r="8.5"/><path d="M8 12.2l2.7 2.7L16 9.6"/>',search:'<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',board:'<rect x="3.5" y="4" width="5" height="16" rx="1.5"/><rect x="10.5" y="4" width="5" height="11" rx="1.5"/><rect x="17.5" y="4" width="3" height="7" rx="1"/>',list:'<path d="M9 6.5h11M9 12h11M9 17.5h11"/><rect x="3.5" y="5" width="3" height="3" rx=".8"/><rect x="3.5" y="10.5" width="3" height="3" rx=".8"/><rect x="3.5" y="16" width="3" height="3" rx=".8"/>'};
const TPR=['','tkp1','tkp2','tkp3','tkp4'];
const tCap=s=>s?s[0].toUpperCase()+s.slice(1):s;
/* jira-style model on top of the existing task list: status (st), type (ty), points (sp), key number (no) */
const JSC={todo:'js-todo',prog:'js-prog',wait:'js-wait',done:'js-done'};
const JST=[['todo','To Do'],['prog','In Progress'],['done','Done']];
const JPR={1:['Highest','jp-1','<path d="M6 12.5l6-5.5 6 5.5M6 18l6-5.5 6 5.5" stroke-width="2.4"/>'],2:['High','jp-2','<path d="M6 15l6-6 6 6" stroke-width="2.4"/>'],3:['Medium','jp-3','<path d="M5.5 9.5h13M5.5 14.5h13" stroke-width="2.4"/>'],4:['Low','jp-4','<path d="M6 9l6 6 6-6" stroke-width="2.4"/>']};
const tSt=tk=>tk.done?'done':(tk.st==='prog'?'prog':'todo');
const jIc=(a,cls)=>`<span class="ji ${a[1]}${cls?' '+cls:''}" title="${a[0]}">${TSV(a[2])}</span>`;
/* numbers = week + order: 4803 is the 3rd task created in week 48 */
const jWk=d=>isoWeek(logical(new Date(d)));const jCurWk=()=>isoWeek(new Date(DAYK+'T12:00'));
const jKey=tk=>tk.code?String(tk.code).padStart(4,'0'):'—';
function tKeys(){let ch=false;const used={};TASKS.list.forEach(t=>{if(t.code&&t.cw)used[t.cw]=Math.max(used[t.cw]||0,t.code%100)});
  [...TASKS.list].sort((a,b)=>(a.created||'')<(b.created||'')?-1:1).forEach(t=>{if(t.code)return;const w=jWk(t.created||Date.now());const n=(used[w]||0)+1;used[w]=n;t.cw=w;t.code=(+w.slice(-2))*100+n;ch=true});if(ch)setTimeout(tSave,0)}
function tSetSt(tk,st){if(st==='done'){if(!tk.done){tToggle(tk.id);if(!tk.done)tk.st='todo'}}else{tk.done=null;tk.st=st}}
let JB={v:'board',p:'all',q:'',f:'',...(LS.get('tjira')||{})};const jSaveV=()=>LS.set('tjira',{v:JB.v,p:JB.p,f:JB.f});
function jDue(tk){if(!tk.d)return '';const late=tk.d<DAYK&&!tk.done,now=tk.d===DAYK;return `<span class="jdue${late?' late':now?' now':''}">${TSV(TIC.cal)}${esc(tCap(tWhen({d:tk.d})).replace(/ \d.*$/,''))}${tk.tm?' '+esc(tk.tm):''}</span>`}
const jWait=tk=>false&&tk.wo?`<span class="jwo">${TSV('<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/>')}${esc(tk.wo)}</span>`:'';
function jFoot(tk){const subs=tk.sub||[];return `<span class="jkey">${esc(jKey(tk))}</span><span class="jsp"></span>${jDue(tk)}${tk.rep?`<span class="jm" title="Repeats">${TSV(TIC.rep)}</span>`:''}${subs.length?`<span class="jm">${TSV(TIC.sub)}${subs.filter(s=>s.x).length}/${subs.length}</span>`:''}${jIc(JPR[tk.p||3]||JPR[3])}`}
function jCard(tk){const P=JB.p==='all'&&TASKS.projects.find(x=>x.id===tk.proj);
  return `<div class="jc trow${tk.done?' done':''}" data-tk="${tk.id}" data-te="${tk.id}" draggable="true"><div class="jc-t">${esc(tk.t)}</div>${jWait(tk)?`<div class="jc-l">${jWait(tk)}</div>`:''}${P?`<div class="jc-l"><span class="jlab" style="--c:${P.col}">${esc(P.n)}</span></div>`:''}<div class="jc-f">${jFoot(tk)}</div></div>`}
function jRow(tk){const st=tSt(tk);return `<div class="jr trow${tk.done?' done':''}" data-tk="${tk.id}" data-te="${tk.id}"><span class="jkey">${esc(jKey(tk))}</span><span class="jr-t">${esc(tk.t)}</span>${jWait(tk)}${jDue(tk)}${jIc(JPR[tk.p||3]||JPR[3])}<button type="button" class="jst ${JSC[st]}" data-cyc="${tk.id}">${(JST.find(s=>s[0]===st)||JST[0])[1]}</button></div>`}
function renderTasks(){const el=$('jPaneT');if(!el)return;tKeys();const L=TASKS.list;
  if(JB.p!=='all'&&JB.p!=='inbox'&&!TASKS.projects.some(P=>P.id===JB.p))JB.p='all';
  const q=JB.q.toLowerCase();
  const inP=t=>JB.p==='all'||(JB.p==='inbox'?!t.proj:t.proj===JB.p);
  const inF=t=>!JB.f||(JB.f==='due'?t.d&&t.d<=DAYK:JB.f==='hi'?(t.p||3)<=2:true);
  const inQ=t=>!q||(t.t+' '+(t.note||'')+' '+(t.wo||'')+' '+jKey(t)).toLowerCase().includes(q);
  const wk=jCurWk();const vis=L.filter(t=>inP(t)&&inF(t)&&inQ(t)&&(!t.done||jWk(t.done)===wk));
  const sortT=a=>a.sort((x,y)=>((x.p||3)-(y.p||3))||((x.d||'9')<(y.d||'9')?-1:(x.d||'9')>(y.d||'9')?1:(x.no||0)-(y.no||0)));
  const by=st=>{const r=vis.filter(t=>tSt(t)===st);return st==='done'?r.sort((a,b)=>b.done>a.done?1:-1):sortT(r)};
  const P=TASKS.projects.find(x=>x.id===JB.p);const name=JB.p==='all'?'All work':JB.p==='inbox'?'Inbox':P.n;
  const openN=vis.filter(t=>!t.done).length;
  let body='';
  if(JB.v==='board')body=`<div class="jboard">${JST.map(([k,l])=>{const r=by(k);return `<section class="jcol" data-col="${k}"><header class="jcol-h"><span>${l}</span><span class="num">${vis.filter(t=>tSt(t)===k).length}</span></header><div class="jcol-b">${k==='todo'?'<!--ADD-->':''}${r.map(jCard).join('')}</div></section>`}).join('')}</div>`;
  else body=JST.map(([k,l])=>{const r=by(k);return `<div class="jlg"><div class="jlg-h"><span class="jst ${JSC[k]}">${l}</span><span class="num">${vis.filter(t=>tSt(t)===k).length} task${vis.filter(t=>tSt(t)===k).length===1?'':'s'}</span></div>${r.length?`<div class="jlist">${r.map(jRow).join('')}</div>`:'<div class="jlg-e">Nothing here</div>'}</div>`}).join('');
  const chip=(k,l,dot)=>`<button type="button" class="jchip${JB.p===k?' on':''}" data-jp="${esc(k)}">${dot?`<i class="tkdot" style="background:${dot}"></i>`:''}${esc(l)}</button>`;
  const fchip=(k,l)=>`<button type="button" class="jfch${JB.f===k?' on':''}" data-jf="${k}">${l}</button>`;
  const addF=`<form class="jadd" id="tAddF"><span class="tkplus">${TSV(TIC.plus)}</span><input id="tAdd" placeholder="Create a task" autocomplete="off" enterkeyhint="done"><button class="jaddgo" type="submit" aria-label="Create">${TSV('<path d="M5 12h14M13 6l6 6-6 6"/>')}</button></form><div class="tprev tkprev" id="tPrev"></div>`;
  if(JB.v==='board')body=body.replace('<!--ADD-->',addF);else body=`<div class="jlistadd">${addF}</div>`+body;
  const tab=(k,l,dot)=>`<button type="button" class="jtab${JB.p===k?' on':''}" data-jp="${esc(k)}">${dot?`<i class="tkdot" style="background:${dot}"></i>`:''}${esc(l)}</button>`;
  el.innerHTML=`<div class="jw panel">
    <div class="jhd"><h3 class="jtitle">Sprint ${+wk.slice(-2)}</h3><span class="jlive"><i></i>Active</span></div>
    <nav class="jtabs">${tab('all','All work')}${tab('inbox','Inbox')}${TASKS.projects.map(P=>tab(P.id,P.n,P.col)).join('')}<button type="button" class="jtab jtabadd" id="tNewP" aria-label="New project">${TSV(TIC.plus)}</button></nav>
    <div class="jtool"><label class="jsearch">${TSV(TIC.search)}<input id="jQ" type="search" placeholder="Search" value="${esc(JB.q)}" autocomplete="off"></label>
      <div class="jfil">${fchip('due','Due now')}${fchip('hi','High priority')}</div><span class="jgrow"></span>
      <div class="jvt" role="tablist"><button type="button" data-jv="board" aria-pressed="${JB.v==='board'}" aria-label="Board">${TSV(TIC.board)}<span>Board</span></button><button type="button" data-jv="list" aria-pressed="${JB.v==='list'}" aria-label="List">${TSV(TIC.list)}<span>List</span></button></div></div>
    <div class="jbody">${body}</div></div>`;
  tBind()}
/* hold to open: the editor appears while the finger is still down */
let tHeld=0;
document.addEventListener('pointerdown',()=>{tHeld=0},true);
document.addEventListener('click',e=>{if(tHeld){tHeld=0;e.stopPropagation();e.preventDefault()}},true);
function tHold(el,sel,open){let tmr=null,sx=0,sy=0;
  el.addEventListener('pointerdown',e=>{const c=e.target.closest(sel);if(!c||e.target.closest('[data-tc],[data-ttc],[data-cyc],input'))return;sx=e.clientX;sy=e.clientY;clearTimeout(tmr);
    tmr=setTimeout(()=>{tHeld=1;try{navigator.vibrate&&navigator.vibrate(10)}catch(x){}c.classList.add('held');setTimeout(()=>c.classList.remove('held'),300);open(c)},380)});
  const stop=()=>clearTimeout(tmr);el.addEventListener('pointerup',stop);el.addEventListener('pointercancel',stop);el.addEventListener('pointerleave',stop);
  el.addEventListener('pointermove',e=>{if(Math.abs(e.clientX-sx)>8||Math.abs(e.clientY-sy)>8)stop()});
  el.addEventListener('contextmenu',e=>{if(e.target.closest(sel))e.preventDefault()})}
let jDrag=null;
function tBind(){const el=$('jPaneT');
  if(!el.dataset.hold){el.dataset.hold=1;tHold(el,'[data-te]',c=>tEdit(c.dataset.te))}
  $('tAddF').onsubmit=e=>{e.preventDefault();const v=$('tAdd').value.trim();if(!v)return;const r=tParse(v);if(!r.t)return;if(!r.proj&&JB.p!=='all'&&JB.p!=='inbox')r.proj=JB.p;
    TASKS.list.push({id:rid()+rid(),...r,st:'todo',note:'',sub:[],done:null,created:new Date().toISOString()});tSave();renderTasks();$('tAdd').focus()};
  $('tAdd').oninput=e=>{const v=e.target.value.trim();if(!v){$('tPrev').textContent='';return}const r=tParse(v);const P=TASKS.projects.find(x=>x.id===r.proj);$('tPrev').textContent=[r.d?tCap(tWhen(r)):'',r.rep?'Repeats '+r.rep:'',(JPR[r.p]||JPR[3])[0]+' priority',P?P.n:''].filter(Boolean).join('  ·  ')};
  $('jQ').oninput=e=>{JB.q=e.target.value;const p=e.target.selectionStart;renderTasks();const i=$('jQ');i.focus();try{i.setSelectionRange(p,p)}catch(x){}};
  el.onclick=e=>{const b=e.target.closest('button,[data-te]');if(!b)return;const d=b.dataset;
    if(d.jv){JB.v=d.jv;jSaveV();renderTasks();return}
    if(d.jp){JB.p=d.jp;jSaveV();renderTasks();return}
    if(d.jf){JB.f=JB.f===d.jf?'':d.jf;jSaveV();renderTasks();return}
    if(b.id==='jColAdd'){$('tAdd').focus();return}
    if(b.id==='tNewP'){const n=prompt('Project name');if(n&&n.trim()){const id=rid();TASKS.projects.push({id,n:n.trim(),col:HCOLS[TASKS.projects.length%HCOLS.length]});JB.p=id;jSaveV();tSave();renderTasks()}return}
    if(d.cyc){const tk=TASKS.list.find(x=>x.id===d.cyc);if(!tk)return;const i=JST.findIndex(s=>s[0]===tSt(tk));tSetSt(tk,JST[(i+1)%JST.length][0]);try{navigator.vibrate&&navigator.vibrate(8)}catch(x){}tSave();renderTasks();return}
    if(d.te)return tEdit(d.te)};
  /* drag a card between columns (mouse / trackpad) */
  el.ondragstart=e=>{const c=e.target.closest('.jc');if(!c)return;jDrag=c.dataset.tk;c.classList.add('drag');try{e.dataTransfer.setData('text/plain',jDrag);e.dataTransfer.effectAllowed='move'}catch(x){}};
  el.ondragend=e=>{jDrag=null;el.querySelectorAll('.drag,.dropok').forEach(x=>x.classList.remove('drag','dropok'))};
  el.ondragover=e=>{const col=e.target.closest('.jcol');if(!col||!jDrag)return;e.preventDefault();el.querySelectorAll('.dropok').forEach(x=>x!==col&&x.classList.remove('dropok'));col.classList.add('dropok')};
  el.ondrop=e=>{const col=e.target.closest('.jcol');if(!col||!jDrag)return;e.preventDefault();const tk=TASKS.list.find(x=>x.id===jDrag);if(tk&&tSt(tk)!==col.dataset.col){tSetSt(tk,col.dataset.col);tSave()}jDrag=null;renderTasks()}}
function tEdit(id){const tk=TASKS.list.find(x=>x.id===id);if(!tk)return;const draft=clone(tk);draft.sub=draft.sub||[];draft.st=tSt(tk);draft.p=draft.p||3;
  const REPS=[['','Never'],['daily','Every day'],['weekdays','Weekdays'],['weekly','Every week'],['monthly','Every month'],['yearly','Every year'],...['mon','tue','wed','thu','fri','sat','sun'].map(d=>['every '+d,'Every '+new Date(2024,0,{mon:1,tue:2,wed:3,thu:4,fri:5,sat:6,sun:7}[d]).toLocaleDateString('en-GB',{weekday:'long'})])];
  const PRI=[1,2,3,4];
  const row=(ic,l,val,ctrl,clr)=>`<label class="tes-row"><span class="tes-ic">${TSV(ic)}</span><span class="tes-l">${l}</span><span class="tes-v${val?'':' none'}">${val||'None'}</span>${clr&&val?`<button type="button" class="tes-clr" data-clr="${clr}" aria-label="Clear">${TSV('<path d="M7 7l10 10M17 7L7 17"/>')}</button>`:TSV('<path d="M9 6l6 6-6 6"/>').replace('<svg','<svg class="tes-chev"')}${ctrl}</label>`;
  const P=TASKS.projects.find(x=>x.id===draft.proj);
  const draw=()=>{const P=TASKS.projects.find(x=>x.id===draft.proj);$('sheetBody').innerHTML=`<div class="tes">
    <div class="tes-st">${JST.map(([k,l])=>`<button type="button" class="${JSC[k]}" data-tst="${k}" aria-pressed="${draft.st===k}">${l}</button>`).join('')}</div>
    <textarea class="tes-t" id="teT" rows="1" placeholder="Task name">${esc(draft.t)}</textarea>
    <textarea class="tes-n" id="teN" rows="2" placeholder="Add notes">${esc(draft.note||'')}</textarea>

    <div class="tes-card">
      ${row(TIC.cal,'Date',draft.d?tCap(tWhen({d:draft.d})):'',`<input type="date" class="tes-in" id="teD" value="${draft.d||''}">`,'d')}
      ${row('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>','Time',draft.tm||'',`<input type="time" class="tes-in" id="teTm" value="${draft.tm||''}">`,'tm')}
      ${row(TIC.rep,'Repeat',draft.rep?(REPS.find(r=>r[0]===draft.rep)||[0,tCap(draft.rep)])[1]:'',`<select class="tes-in" id="teR">${REPS.map(([v,l])=>`<option value="${v}" ${(draft.rep||'')===v?'selected':''}>${l}</option>`).join('')}</select>`)}
      ${row(TIC.inbox,'Project',P?`<i class="tkdot" style="background:${P.col}"></i>${esc(P.n)}`:'Inbox',`<select class="tes-in" id="teP"><option value="">Inbox</option>${TASKS.projects.map(P=>`<option value="${P.id}" ${draft.proj===P.id?'selected':''}>${esc(P.n)}</option>`).join('')}</select>`)}
    </div>
    <div class="tes-lab">Priority</div>
    <div class="tes-seg" id="tePr">${PRI.map(p=>`<button type="button" data-tp="${p}" aria-pressed="${draft.p===p}">${jIc(JPR[p])}<span>${JPR[p][0]}</span></button>`).join('')}</div>
    <div class="tes-lab">Subtasks${draft.sub.length?` <span class="num">${draft.sub.filter(s=>s.x).length}/${draft.sub.length}</span>`:''}</div>
    <div class="tes-card">${draft.sub.map((s,i)=>`<div class="tes-sub${s.x?' done':''}"><button type="button" class="tkchk" data-ts="${i}" aria-label="Complete">${TSV('<path d="M6.5 12.5l3.5 3.5 7.5-8"/>')}</button><input data-tsi="${i}" value="${esc(s.t)}" placeholder="Subtask"><button type="button" class="tes-clr" data-tsd="${i}" aria-label="Remove">${TSV('<path d="M7 7l10 10M17 7L7 17"/>')}</button></div>`).join('')}
      <button type="button" class="tes-add" id="teSub">${TSV(TIC.plus)}Add subtask</button></div>
    <div class="tes-foot"><button type="button" class="tes-del" id="teDel">Delete task</button><span style="flex:1"></span><button type="button" class="tkgo tes-save" id="teOk">Save</button></div></div>`;
    const t=$('teT');const fit=()=>{t.style.height='auto';t.style.height=t.scrollHeight+'px'};fit();t.oninput=fit;
    $('sheetBody').querySelectorAll('input.tes-in').forEach(x=>x.addEventListener('click',()=>{try{x.showPicker&&x.showPicker()}catch(e){}}))};
  openSheet(jKey(tk),'');draw();const sb=$('sheetBody');sb.onchange=e=>{if(e.target.classList.contains('tes-in')){read();draw()}};
  const read=()=>{draft.t=$('teT').value.trim()||draft.t;draft.note=$('teN').value;draft.d=$('teD').value||null;draft.tm=$('teTm').value||null;draft.rep=$('teR').value||null;draft.proj=$('teP').value||null;if($('teWo'))draft.wo=$('teWo').value.trim()||null;sb.querySelectorAll('[data-tsi]').forEach(x=>draft.sub[+x.dataset.tsi].t=x.value)};
  sb.onclick=e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;
    if(d.clr){e.preventDefault();read();draft[d.clr]=null;draw();return}
    if(d.tp){read();draft.p=+d.tp;draw();return}if(d.tst){read();draft.st=d.tst;draw();return}if(d.ts){read();const s=draft.sub[+d.ts];s.x=!s.x;draw();return}if(d.tsd){read();draft.sub.splice(+d.tsd,1);draw();return}
    if(b.id==='teSub'){read();draft.sub.push({t:'',x:false});draw();const ins=sb.querySelectorAll('[data-tsi]');ins[ins.length-1].focus();return}
    if(b.id==='teDel'){if(!b.dataset.arm){b.dataset.arm=1;b.textContent='Tap again to delete';b.classList.add('arm');return}TASKS.list=TASKS.list.filter(x=>x.id!==id);tSave();closeSheet();renderTasks();return}
    if(b.id==='teOk'){read();draft.sub=draft.sub.filter(s=>s.t.trim());const st=draft.st;delete draft.st;draft.done=tk.done;Object.assign(tk,draft);tSetSt(tk,st);tSave();closeSheet();renderTasks()}}}

/* ---- today's tasks, mirrored into the Today view ---- */
function tToggle(id){const tk=TASKS.list.find(x=>x.id===id);if(!tk)return false;
  if(tk.done){tk.done=null;tk.st='todo'}
  else if(tk.rep&&tk.d){const nx=tNext(tk);TASKS.list.push({...clone(tk),id:rid()+rid(),done:new Date().toISOString(),rep:null,st:'done',code:null,cw:null,created:new Date().toISOString()});tk.st='todo';tk.d=nx;(tk.sub||[]).forEach(s=>s.x=false)}
  else tk.done=new Date().toISOString();
  try{navigator.vibrate&&navigator.vibrate(12)}catch(x){}
  return true}
async function ensureTasks(){if(tasksLoaded)return;const d=await load('tasks/all');TASKS={list:[],projects:[],...(d||{})};tasksLoaded=true}
async function renderTodayTasks(){const el=$('todayTasks');if(!el)return;
  await ensureTasks();
  const L=TASKS.list,open=L.filter(t=>!t.done);
  const ov=open.filter(t=>t.d&&t.d<DAYK),td=open.filter(t=>t.d===DAYK);
  const doneToday=L.filter(t=>t.done&&t.d===DAYK);
  const srt=a=>a.sort((x,y)=>(x.p||4)-(y.p||4)||((x.tm||'99')<(y.tm||'99')?-1:1));
  const row=tk=>{const P=TASKS.projects.find(x=>x.id===tk.proj);const late=tk.d&&tk.d<DAYK&&!tk.done;const sb=tk.sub||[];
    return `<div class="ttrow${tk.done?' done':''}" data-tk="${tk.id}"><button type="button" class="tchk p${tk.p||4}" data-ttc="${tk.id}" aria-label="complete"></button>`
      +`<button type="button" class="ttmain" data-tte="${tk.id}"><b>${esc(tk.t)}</b><span class="tmeta">`
      +`${late?'<span class="bad">Overdue</span>':''}${tk.tm?`<span>${esc(tk.tm)}</span>`:''}`
      +`${sb.length?`<span>☑ ${sb.filter(s=>s.x).length}/${sb.length}</span>`:''}`
      +`${P?`<span style="color:${P.col}"># ${esc(P.n)}</span>`:''}</span></button></div>`};

  el.innerHTML=`<div class="blk ttblk"><div class="bh static"><span class="tm">Tasks</span><span class="ti">Due today</span>
      <span class="ct">${td.length+ov.length} open</span><button type="button" class="ttgo" id="ttGo">Open journal</button></div>
    <div class="items">${ov.length?`<div class="tgrp bad">Overdue</div>${srt(ov).map(row).join('')}`:''}
      ${td.length?srt(td).map(row).join(''):(ov.length?'':'<div class="dim tempty">Nothing due today. Add one in the journal</div>')}
      ${doneToday.length?`<div class="tgrp">Done</div>${doneToday.map(row).join('')}`:''}</div></div>`;
  if(!el.dataset.hold){el.dataset.hold=1;tHold(el,'[data-tte]',c=>tEdit(c.dataset.tte))}
  el.onclick=e=>{const b=e.target.closest('[data-ttc],[data-tte],#ttGo');if(!b)return;
    if(b.id==='ttGo'){JTAB='tasks';JB.f='due';jSaveV();go('journal');setJTab('tasks');return}
    if(b.dataset.ttc){if(!tToggle(b.dataset.ttc))return;const r=b.closest('.ttrow');if(r)r.classList.add('pop');
      setTimeout(()=>{tSave();renderTodayTasks();if(cur==='journal'&&JTAB==='tasks')renderTasks()},260);return}
    if(b.dataset.tte){JTAB='tasks';go('journal');setJTab('tasks');setTimeout(()=>tEdit(b.dataset.tte),250)}}}
watch('tasks/all',()=>{if(cur==='today')renderTodayTasks()});
