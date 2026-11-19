/* ================= JOURNAL tabs: journal · notes (Apple Notes) · tasks (Todoist) =================
   notes: notes/n-<id> {id,html,folder,pin,created,upd} · notes/folders {list:[name]}
   tasks: tasks/all {list:[task],projects:[{id,n,col}]}  task {id,t,d,tm,p,proj,rep,note,sub:[{t,x}],done,created} */
let JTAB=LS.get('jtab')||'journal';
function setJTab(t){JTAB=t;LS.set('jtab',t);document.querySelectorAll('#jTabs [data-jt]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.jt===t));
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
  const listHtml=`${all.map(n=>{const t=nTitle(n);const body=nText(n.html).slice(t.length).trim();const th=nThumb(n);return `<button type="button" class="nitem${n.id===NCUR?' on':''}${th?' hasth':''}" data-n="${n.id}">${th}<b>${n.pin?'📌 ':''}${esc(t)}</b><span class="dim"><span class="num">${nAgo(n.upd)}</span> ${esc(body.slice(0,70))||(th?'handwriting':'no additional text')}</span></button>`}).join('')||'<div class="dim" style="padding:14px 4px">no notes</div>'}`;
  if(listOnly&&$('nList')){$('nList').innerHTML=listHtml;return}
  el.innerHTML=`<div class="ngrid${NCUR?' editing':''}"><div class="nside"><div class="row" style="gap:6px"><input class="inp" id="nQ" type="search" placeholder="search notes" value="${esc(q)}" style="flex:1"><button class="btn p" type="button" id="nNew" title="new note">✎</button></div>
    <div class="chips" id="nFolders" style="margin:8px 0">${['all',...NFOLD.list].map(f=>`<button type="button" class="chip${NF===f?' on':''}" data-nf="${esc(f)}">${esc(f)}</button>`).join('')}<button type="button" class="chip" id="nAddF">+ folder</button></div>
    <div class="nlistw" id="nList">${listHtml}</div></div>
    <div class="neditor panel">${NCUR&&NOTES[NCUR]?nEditorHtml(NOTES[NCUR]):'<div class="pb dim nempty">pick a note or start a new one ✎</div>'}</div></div>`;
  nBind();if(NCUR&&NOTES[NCUR])nInkMount()}
function nEditorHtml(n){return `<div class="ntool"><button type="button" class="iconbtn nback" id="nBack">‹ notes</button><span class="ntbtns">${[['h','H','heading'],['b','<b>B</b>','bold'],['i','<i>I</i>','italic'],['u','<u>U</u>','underline'],['s','<s>S</s>','strike'],['ul','•','bullets'],['ol','1.','numbers'],['chk','☑','checklist'],['q','❝','quote'],['code','&lt;/&gt;','code'],['hr','—','divider']].map(([k,l,t])=>`<button type="button" data-nc="${k}" title="${t}">${l}</button>`).join('')}</span></div>
  <div class="nmeta dim num">${new Date(n.upd).toLocaleString('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).toLowerCase()} · <select id="nFold" class="nfsel">${NFOLD.list.map(f=>`<option ${n.folder===f?'selected':''}>${esc(f)}</option>`).join('')}</select> <button type="button" class="iconbtn" id="nPin">${n.pin?'unpin':'pin'}</button> <button type="button" class="iconbtn" id="nCopy">copy</button> <button type="button" class="iconbtn" id="nDel">delete</button> <span id="nSaved"></span></div>
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
    if(b.id==='nCopy'){navigator.clipboard&&navigator.clipboard.writeText($('nEd').innerText).then(()=>{b.textContent='copied ✓'});return}
    if(b.id==='nDel'){if(!b.dataset.arm){b.dataset.arm=1;b.textContent='tap again';return}delete NOTES[NCUR];removeDoc('notes/n-'+NCUR);NCUR=null;renderNotes();return}
    if(d.nc){nCmd(d.nc);return}};
  el.onmousedown=e=>{if(e.target.closest('[data-nc]'))e.preventDefault()}}
function nCmd(c){const ed=$('nEd');if(!ed)return;ed.focus();const X=(a,v)=>document.execCommand(a,false,v);
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
function tParse(s){let t=' '+s+' ',d=null,tm=null,p=4,proj=null,rep=null;const today=new Date(DAYK+'T12:00');const fmt=x=>ymd(x);const add=n=>{const x=new Date(today);x.setDate(x.getDate()+n);return fmt(x)};
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
function tRow(tk){const P=TASKS.projects.find(x=>x.id===tk.proj);const over=tk.d&&tk.d<DAYK&&!tk.done;const subs=tk.sub||[];
  return `<div class="trow${tk.done?' done':''}" data-tk="${tk.id}"><button type="button" class="tchk p${tk.p||4}" data-tc="${tk.id}" aria-label="complete"></button><button type="button" class="tmain" data-te="${tk.id}"><b>${esc(tk.t)}</b>${tk.note?`<span class="dim">${esc(tk.note.slice(0,80))}</span>`:''}<span class="tmeta">${tk.d?`<span class="${over?'bad':tk.d===DAYK?'ok':''}">📅 ${esc(tWhen(tk))}</span>`:''}${tk.rep?`<span>↻ ${esc(tk.rep)}</span>`:''}${subs.length?`<span>☑ ${subs.filter(s=>s.x).length}/${subs.length}</span>`:''}${P?`<span style="color:${P.col}"># ${esc(P.n)}</span>`:''}</span></button></div>`}
function renderTasks(){const el=$('jPaneT');if(!el)return;const L=TASKS.list;const open=L.filter(t=>!t.done);
  const cnt={inbox:open.filter(t=>!t.proj).length,today:open.filter(t=>t.d&&t.d<=DAYK).length,upcoming:open.filter(t=>t.d&&t.d>DAYK).length};
  const views=[['today','today',cnt.today],['upcoming','upcoming',cnt.upcoming],['inbox','inbox',cnt.inbox],...TASKS.projects.map(P=>['p:'+P.id,'# '+P.n,open.filter(t=>t.proj===P.id).length]),['done','completed','']];
  let body='';const sortT=a=>a.sort((x,y)=>(x.d||'9')<(y.d||'9')?-1:(x.d||'9')>(y.d||'9')?1:(x.p||4)-(y.p||4)||((x.tm||'99')<(y.tm||'99')?-1:1));
  if(TV==='today'){const ov=sortT(open.filter(t=>t.d&&t.d<DAYK)),td=sortT(open.filter(t=>t.d===DAYK));body=(ov.length?`<div class="tgrp bad">overdue</div>${ov.map(tRow).join('')}`:'')+`<div class="tgrp">${esc(nice(DAYK).toLowerCase())} · today</div>${td.map(tRow).join('')||'<div class="dim tempty">nothing due today ✓</div>'}`}
  else if(TV==='upcoming'){const g={};sortT(open.filter(t=>t.d&&t.d>DAYK)).forEach(t=>(g[t.d]=g[t.d]||[]).push(t));body=Object.entries(g).map(([d,ts])=>`<div class="tgrp">${esc(tWhen({d}))}</div>${ts.map(tRow).join('')}`).join('')||'<div class="dim tempty">nothing scheduled</div>'}
  else if(TV==='inbox')body=sortT(open.filter(t=>!t.proj)).map(tRow).join('')||'<div class="dim tempty">inbox zero 🎉</div>';
  else if(TV==='done')body=L.filter(t=>t.done).sort((a,b)=>b.done>a.done?1:-1).slice(0,80).map(tRow).join('')||'<div class="dim tempty">nothing completed yet</div>';
  else{const pid=TV.slice(2);body=sortT(open.filter(t=>t.proj===pid)).map(tRow).join('')||'<div class="dim tempty">no tasks</div>'}
  el.innerHTML=`<div class="tgridw"><div class="tside">${views.map(([k,l,c])=>`<button type="button" class="tview${TV===k?' on':''}" data-tv="${esc(k)}"><span>${esc(l)}</span><span class="dim num">${c||''}</span></button>`).join('')}<button type="button" class="tview dim" id="tNewP">+ project</button></div>
    <div class="tmainw"><form class="tadd" id="tAddF"><input class="inp" id="tAdd" placeholder="add a task — e.g. “gym tmrw 7pm p1 #health”" autocomplete="off" enterkeyhint="done"><button class="btn p" type="submit">add</button></form><div class="dim tprev" id="tPrev"></div><div class="tlist">${body}</div></div></div>`;
  tBind()}
function tBind(){const el=$('jPaneT');
  $('tAddF').onsubmit=e=>{e.preventDefault();const v=$('tAdd').value.trim();if(!v)return;const r=tParse(v);if(!r.t)return;if(!r.d&&TV==='today')r.d=DAYK;if(!r.proj&&TV.startsWith('p:'))r.proj=TV.slice(2);
    TASKS.list.push({id:rid()+rid(),...r,note:'',sub:[],done:null,created:new Date().toISOString()});tSave();renderTasks();$('tAdd').focus()};
  $('tAdd').oninput=e=>{const v=e.target.value.trim();if(!v){$('tPrev').textContent='';return}const r=tParse(v);const P=TASKS.projects.find(x=>x.id===r.proj);$('tPrev').textContent=[r.d?'📅 '+tWhen(r):'',r.rep?'↻ '+r.rep:'',r.p<4?'p'+r.p:'',P?'# '+P.n:''].filter(Boolean).join('  ')};
  el.onclick=e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;
    if(d.tv){TV=d.tv;LS.set('tview',TV);renderTasks();return}
    if(b.id==='tNewP'){const n=prompt('project name');if(n){TASKS.projects.push({id:rid(),n:n.trim(),col:HCOLS[TASKS.projects.length%HCOLS.length]});tSave();renderTasks()}return}
    if(d.tc){if(!tToggle(d.tc))return;
      const row=b.closest('.trow');if(row)row.classList.add('pop');setTimeout(()=>{tSave();renderTasks();renderTodayTasks()},260);return}
    if(d.te)return tEdit(d.te)}}
function tEdit(id){const tk=TASKS.list.find(x=>x.id===id);if(!tk)return;const draft=clone(tk);draft.sub=draft.sub||[];
  const draw=()=>{$('sheetBody').innerHTML=`<input class="inp tetitle" id="teT" value="${esc(draft.t)}"><textarea class="inp" id="teN" rows="2" placeholder="description" style="margin-top:8px">${esc(draft.note||'')}</textarea>
    <div class="fgrid4" style="margin-top:8px"><label class="fl">date<input type="date" class="inp" id="teD" value="${draft.d||''}"></label><label class="fl">time (reminder)<input type="time" class="inp" id="teTm" value="${draft.tm||''}"></label>
    <label class="fl">repeat<select class="inp" id="teR">${['','daily','weekdays','weekly','monthly','yearly','every mon','every tue','every wed','every thu','every fri','every sat','every sun'].map(r=>`<option value="${r}" ${draft.rep===r?'selected':''}>${r||'never'}</option>`).join('')}</select></label>
    <label class="fl">project<select class="inp" id="teP"><option value="">inbox</option>${TASKS.projects.map(P=>`<option value="${P.id}" ${draft.proj===P.id?'selected':''}>${esc(P.n)}</option>`).join('')}</select></label></div>
    <div class="seg mini" id="tePr">${[1,2,3,4].map(p=>`<button type="button" data-tp="${p}" aria-pressed="${(draft.p||4)===p}" style="color:${PCOL[4-p]}">p${p}</button>`).join('')}</div>
    <div class="dim" style="font-size:11px;margin:12px 0 4px">sub-tasks</div>${draft.sub.map((s,i)=>`<div class="tsub"><button type="button" class="tchk${s.x?' x':''}" data-ts="${i}"></button><input class="inp" data-tsi="${i}" value="${esc(s.t)}"><button type="button" class="iconbtn" data-tsd="${i}">✕</button></div>`).join('')}
    <button type="button" class="iconbtn" id="teSub" style="margin-top:6px">+ sub-task</button>
    <div class="bigbtns" style="margin-top:14px"><button class="btn d" type="button" id="teDel">delete</button><span style="flex:1"></span><button class="btn p" type="button" id="teOk">save</button></div>`};
  openSheet('task','');draw();const sb=$('sheetBody');
  const read=()=>{draft.t=$('teT').value.trim()||draft.t;draft.note=$('teN').value;draft.d=$('teD').value||null;draft.tm=$('teTm').value||null;draft.rep=$('teR').value||null;draft.proj=$('teP').value||null;sb.querySelectorAll('[data-tsi]').forEach(x=>draft.sub[+x.dataset.tsi].t=x.value)};
  sb.onclick=e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;
    if(d.tp){read();draft.p=+d.tp;draw();return}if(d.ts){read();const s=draft.sub[+d.ts];s.x=!s.x;draw();return}if(d.tsd){read();draft.sub.splice(+d.tsd,1);draw();return}
    if(b.id==='teSub'){read();draft.sub.push({t:'',x:false});draw();const ins=sb.querySelectorAll('[data-tsi]');ins[ins.length-1].focus();return}
    if(b.id==='teDel'){if(!b.dataset.arm){b.dataset.arm=1;b.textContent='tap again';return}TASKS.list=TASKS.list.filter(x=>x.id!==id);tSave();closeSheet();renderTasks();return}
    if(b.id==='teOk'){read();draft.sub=draft.sub.filter(s=>s.t.trim());Object.assign(tk,draft);tSave();closeSheet();renderTasks()}}}

/* ---- today's tasks, mirrored into the Today view ---- */
function tToggle(id){const tk=TASKS.list.find(x=>x.id===id);if(!tk)return false;
  if(tk.done){tk.done=null}
  else if(tk.rep&&tk.d){const nx=tNext(tk);TASKS.list.push({...clone(tk),id:rid()+rid(),done:new Date().toISOString(),rep:null});tk.d=nx;(tk.sub||[]).forEach(s=>s.x=false)}
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
      +`${late?'<span class="bad">overdue</span>':''}${tk.tm?`<span>${esc(tk.tm)}</span>`:''}`
      +`${sb.length?`<span>☑ ${sb.filter(s=>s.x).length}/${sb.length}</span>`:''}`
      +`${P?`<span style="color:${P.col}"># ${esc(P.n)}</span>`:''}</span></button></div>`};

  el.innerHTML=`<div class="blk ttblk"><div class="bh static"><span class="tm">tasks</span><span class="ti">due today</span>
      <span class="ct">${td.length+ov.length} open</span><button type="button" class="ttgo" id="ttGo">open journal ›</button></div>
    <div class="items">${ov.length?`<div class="tgrp bad">overdue</div>${srt(ov).map(row).join('')}`:''}
      ${td.length?srt(td).map(row).join(''):(ov.length?'':'<div class="dim tempty">nothing due today — add one in the journal</div>')}
      ${doneToday.length?`<div class="tgrp">done</div>${doneToday.map(row).join('')}`:''}</div></div>`;
  el.onclick=e=>{const b=e.target.closest('[data-ttc],[data-tte],#ttGo');if(!b)return;
    if(b.id==='ttGo'){JTAB='tasks';TV='today';LS.set('tview','today');go('journal');setJTab('tasks');return}
    if(b.dataset.ttc){if(!tToggle(b.dataset.ttc))return;const r=b.closest('.ttrow');if(r)r.classList.add('pop');
      setTimeout(()=>{tSave();renderTodayTasks();if(cur==='journal'&&JTAB==='tasks')renderTasks()},260);return}
    if(b.dataset.tte){JTAB='tasks';go('journal');setJTab('tasks');setTimeout(()=>tEdit(b.dataset.tte),250)}}}
watch('tasks/all',()=>{if(cur==='today')renderTodayTasks()});
