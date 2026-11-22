/* ================= CALENDAR — Google Calendar-style (day / 3 days / week / month) =================
   Events live in the private doc cal/week:
     ev:  repeating  [title, cal, days '1234567' (Mon=1), 'HH:MM', 'HH:MM', description, id, meta?]
     one: one-off    [title, cal, 'YYYY-MM-DD',       'HH:MM', 'HH:MM', description, id, meta?]
     ex:  {seriesId:[dates skipped]}
   meta (optional): {ad:1 all-day, from/until 'YYYY-MM-DD' series bounds, rm minutes-before reminder (-1 none, default 10)}
   Today's events also show on the Today view, and each event queues a push notification (kind "cal"). */
let CAL=null,calP=null,calFS=false,calView=LS.get('calView')||(innerWidth<700?'3':'7'),calAt=null,calTick=null,calScrolled=false;
const CAL_COL={job:'#3d4a5c',study:'#52637a',gym:'#6b7d96',fun:'#8392a8',other:'#666a71'};
const CAL_DN=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const calMin=t=>{const [h,m]=String(t).split(':');return +h*60+ +m};
const calHM=m=>m>=1440?'24:00':pad(Math.floor(m/60))+':'+pad(m%60);
const calD=k=>new Date(k+'T12:00');
const calK=()=>calAt||ymd(new Date());
const calDow=k=>String((calD(k).getDay()+6)%7+1);
const calM=x=>x[7]&&typeof x[7]==='object'?x[7]:{};
const calKey=ev=>ev.id;
const calCol=ev=>CAL_COL[ev.c]||'#666a71';
const sheetOn=()=>$('sheet').classList.contains('on');
function calT1(m){const h=Math.floor(m/60)%24;return (h%12||12)+(m%60?':'+pad(m%60):'')+(h<12?'am':'pm')}
function calFmt(a,b){const ap=m=>Math.floor((m%1440)/720)?'pm':'am';const f=m=>{const h=Math.floor(m/60)%24;return (h%12||12)+(m%60?':'+pad(m%60):'')};
  return f(a)+(ap(a)===ap(b)?'':ap(a))+' – '+f(b)+ap(b)}
const calRmTxt=rm=>rm==null?'10 minutes before':rm<0?'No notification':rm===0?'At start':rm>=1440?'1 day before':rm>=60?(rm/60)+' hour'+(rm>60?'s':'')+' before':rm+' minutes before';

/* ---------- data ---------- */
function calNorm(){let ch=false;['ev','one'].forEach(k=>{CAL[k]=CAL[k]||[];CAL[k].forEach(x=>{if(x[5]==null)x[5]='';if(!x[6]){x[6]=k[0]+Math.random().toString(36).slice(2,9);ch=true}})});CAL.ex=CAL.ex||{};return ch}
function calEnsure(){if(CAL)return Promise.resolve(CAL);
  if(!calP)calP=load('cal/week').then(d=>{if(d==null&&!R){calP=null;return null}if(!CAL){CAL=d||{ev:[],one:[]};if(calNorm())save('cal/week',CAL,true)}return CAL}).catch(()=>{calP=null;return null});
  return calP}
function calSave(){calNorm();CAL.local=true;save('cal/week',CAL,true);if(typeof pushSync==='function')pushSync();renderTodayCal()}
function calEvents(d){const k=ymd(d),dow=String((d.getDay()+6)%7+1),out=[];
  if(CAL){const ex=CAL.ex||{};
    const mk=(x,one)=>{const m=calM(x);return {t:x[0],c:x[1],s:m.ad?0:calMin(x[3]),e:m.ad?1440:(calMin(x[4])||1440),d:x[5]||'',one:!!one,id:x[6],kind:one?'one':'ev',days:one?'':String(x[2]),date:k,ad:!!m.ad,from:m.from||'',until:m.until||'',rm:m.rm}};
    (CAL.ev||[]).forEach(x=>{const m=calM(x);if(String(x[2]).includes(dow)&&(!m.from||k>=m.from)&&(!m.until||k<=m.until)&&!(ex[x[6]]||[]).includes(k))out.push(mk(x))});
    (CAL.one||[]).forEach(x=>{if(x[2]===k)out.push(mk(x,1))})}
  return out}
function calLay(evs){evs.sort((x,y)=>x.s-y.s||y.e-x.e);let grp=[],gEnd=-1;
  const flush=()=>{const cols=[];grp.forEach(ev=>{let c=cols.findIndex(end=>End<=ev.s);if(c<0){c=cols.length;cols.push(0)}cols[c]=ev.e;ev.col=c});
    grp.forEach((ev,i)=>{const n=cols.length;const near=grp.some(o=>o!==ev&&o.s<ev.e&&o.e>ev.s&&Math.abs(o.s-ev.s)<45);
      if(near){ev.l=ev.col/n;ev.w=1/n}else if(ev.col>0){ev.l=Math.min(.5,ev.col*.12);ev.w=1-ev.l}else{ev.l=0;ev.w=1}ev.z=i+1});grp=[]};
  evs.forEach(ev=>{if(grp.length&&ev.s>=gEnd){flush();gEnd=-1}grp.push(ev);gEnd=Math.max(gEnd,ev.e)});if(grp.length)flush();return evs}
async function calInit(){calRender();await calEnsure();calRender()}

/* ---------- navigation ---------- */
function calDays(){const a=calD(calK());
  if(calView==='m'){const f=new Date(a.getFullYear(),a.getMonth(),1,12);f.setDate(f.getDate()-((f.getDay()+6)%7));
    const L=Array.from({length:42},(_,i)=>{const d=new Date(f);d.setDate(f.getDate()+i);return d});return L[35].getMonth()!==a.getMonth()?L.slice(0,35):L}
  const n=+calView,s=new Date(a);if(n===7)s.setDate(s.getDate()-((s.getDay()+6)%7));
  return Array.from({length:n},(_,i)=>{const d=new Date(s);d.setDate(s.getDate()+i);return d})}
function calShift(dir){if(calView==='m'){const d=calD(calK());d.setDate(1);d.setMonth(d.getMonth()+dir);calAt=ymd(d)}else calAt=addDays(calK(),dir*+calView);calRender()}
function calSetView(v,at){calView=v;LS.set('calView',v);if(at)calAt=at;calRender()}
let calH=48;
function calSpan(){let a=24,b=0;if(CAL)(CAL.ev||[]).concat(CAL.one||[]).forEach(x=>{if(calM(x).ad)return;a=Math.min(a,Math.floor(calMin(x[3])/60));b=Math.max(b,Math.ceil((calMin(x[4])||1440)/60))});if(a>=b){a=8;b=24}return [a,b]}
function calFull(on){const el=$('gcal');if(!el)return;calFS=on==null?!calFS:on;el.classList.toggle('fs',calFS);document.body.classList.toggle('gcal-fs',calFS);calScrolled=false;calRender()}

/* ---------- render ---------- */
function calChip(ev,k){return `<button type="button" class="gc-chip" data-gce="${k}|${esc(calKey(ev))}" style="background:${calCol(ev)}">${esc(ev.t)}</button>`}
function calRender(){const el=$('gcal');if(!el)return;
  const st=el.querySelector('.gc-scroll');const keep=st?st.scrollTop:null;
  const days=calDays(),now=new Date(),tk=ymd(now),anchor=calD(calK()),month=calView==='m';
  const a=days[0],b=days[days.length-1];
  const title=month?anchor.toLocaleDateString('en-GB',{month:'long',year:'numeric'}):calView==='1'?anchor.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})
    :a.getMonth()===b.getMonth()?a.toLocaleDateString('en-GB',{month:'long',year:'numeric'}):a.toLocaleDateString('en-GB',{month:'short'})+(a.getFullYear()!==b.getFullYear()?' '+a.getFullYear():'')+' – '+b.toLocaleDateString('en-GB',{month:'short',year:'numeric'});
  const top=`<div class="gc-top"><button type="button" class="gc-today" data-gc="today">Today</button><button type="button" class="gc-nav" data-gc="prev" aria-label="Previous">‹</button><button type="button" class="gc-nav" data-gc="next" aria-label="Next">›</button>
      <label class="gc-title"><span>${esc(title)}</span><span class="gc-caret">▾</span><input type="date" id="gcPick" value="${calK()}" aria-label="Go to date"></label>
      <span class="gc-views">${[['1','Day'],['3','3 days'],['7','Week'],['m','Month']].map(([v,l])=>`<button type="button" data-gcv="${v}" class="${calView===v?'on':''}">${l}</button>`).join('')}</span>
      <button type="button" class="gc-nav gc-add" data-gc="new" aria-label="Create" title="Create (c)">+</button>
      <button type="button" class="gc-nav gc-fs" data-gc="full" aria-label="${calFS?'Exit full screen':'Full screen'}" title="${calFS?'Exit full screen':'Full screen'}">${calFS?'<svg viewBox="0 0 18 18" width="15" height="15"><path d="M7 1v6H1M11 17v-6h6" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>':'<svg viewBox="0 0 18 18" width="15" height="15"><path d="M1 6V1h5M17 12v5h-5M12 1h5v5M6 17H1v-5" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>'}</button></div>`;
  el._days=days;el.classList.toggle('gc-mview',month);
  if(month){const max=innerWidth<700?2:3;
    el.innerHTML=top+`<div class="gc-mhead">${CAL_DN.map(x=>`<span>${x.toUpperCase()}</span>`).join('')}</div>
      <div class="gc-month" style="grid-template-rows:repeat(${days.length/7},minmax(0,1fr))">${days.map(d=>{const k=ymd(d);const evs=calEvents(d).sort((x,y)=>(y.ad-x.ad)||x.s-y.s);const show=evs.length>max+1?evs.slice(0,max):evs;
        return `<div class="gc-mc${d.getMonth()!==anchor.getMonth()?' out':''}${k===tk?' today':''}" data-gcm="${k}"><button type="button" class="gc-md" data-gcday="${k}">${d.getDate()===1?d.toLocaleDateString('en-GB',{day:'numeric',month:'short'}):d.getDate()}</button>${show.map(ev=>ev.ad?calChip(ev,k)
          :`<button type="button" class="gc-mt" data-gce="${k}|${esc(calKey(ev))}"><i style="background:${calCol(ev)}"></i><span>${calT1(ev.s)}</span> <b>${esc(ev.t)}</b></button>`).join('')}${evs.length>show.length?`<button type="button" class="gc-more" data-gcday="${k}">${evs.length-show.length} more</button>`:''}</div>`}).join('')}</div>`;
    clearInterval(calTick);return}
  const n=days.length,lists=days.map(d=>{const all=calEvents(d);return {d,k:ymd(d),ad:all.filter(e=>e.ad),tm:calLay(all.filter(e=>!e.ad))}});
  const adN=Math.max(0,...lists.map(l=>l.ad.length));
  const [h0,h1]=calSpan();const H=calH=calFS?Math.max(26,(innerHeight-(adN?150+adN*22:140))/(h1-h0)):48;
  const tz='GMT'+(()=>{const o=-now.getTimezoneOffset()/60;return o?(o>0?'+':'-')+pad(Math.abs(o)):''})();
  const cols=`grid-template-columns:${n===7&&innerWidth<700?38:52}px repeat(${n},minmax(0,1fr))`;
  el.innerHTML=top+`<div class="gc-head" style="${cols}"><span class="gc-tz">${tz}</span>${days.map(d=>`<button type="button" class="gc-dh${ymd(d)===tk?' today':''}" data-gcday="${ymd(d)}"><small>${DOW[d.getDay()].toUpperCase()}</small><b>${d.getDate()}</b></button>`).join('')}</div>
    <div class="gc-adr" style="${cols}"><span class="gc-adl">${adN?'all day':''}</span>${lists.map(l=>`<div class="gc-adc" data-gcad="${l.k}">${l.ad.map(ev=>calChip(ev,l.k)).join('')}</div>`).join('')}</div>
    <div class="gc-scroll" style="--gh:${H}px"><div class="gc-body" style="${cols};height:${24*H}px">
      <div class="gc-gut">${Array.from({length:23},(_,i)=>`<span style="top:${(i+1)*H}px">${(i+1)%12||12} ${i+1<12?'AM':'PM'}</span>`).join('')}</div>
      ${lists.map(({k,tm})=>`<div class="gc-col">${tm.map(ev=>{const h=Math.max(11,(ev.e-ev.s)/60*H-2),sm=ev.e-ev.s<=30;
          return `<button type="button" class="gc-ev${sm?' sm':''}" data-gce="${k}|${esc(calKey(ev))}" style="top:${ev.s/60*H}px;height:${h}px;left:${ev.l*100}%;width:calc(${ev.w*100}% - ${ev.l+ev.w>=.99?8:1}px);z-index:${ev.z};background:${calCol(ev)}"><b>${esc(ev.t)}</b>${sm?`<i>, ${calFmt(ev.s,ev.e).split(' – ')[0]}</i>`:`<i>${calFmt(ev.s,ev.e)}</i>`}</button>`}).join('')}
          ${k===tk?`<div class="gc-now" style="top:${(now.getHours()*60+now.getMinutes())/60*H}px"></div>`:''}</div>`).join('')}
    </div></div>`;
  const sc=el.querySelector('.gc-scroll');if(keep!=null&&calScrolled)sc.scrollTop=keep;else{sc.scrollTop=calFS?h0*H:Math.max(0,(Math.min(now.getHours(),17)-1.5)*H);calScrolled=true}
  clearInterval(calTick);calTick=setInterval(()=>{if(cur==='week'&&!document.hidden&&!calDrag&&!sheetOn())calRender()},60000)}

/* ---------- editing (create / edit / move / delete — "this", "this and following", "all") ---------- */
let calDrag=null,calSupp=0,calPT='mouse',calLP=null,calSw=null;
function calRow(n,k,id,from){const m={};if(n.ad)m.ad=1;if(n.rm!=null&&n.rm!==10)m.rm=n.rm;if(from)m.from=from;if(n.until)m.until=n.until;
  return [n.t.trim()||'(No title)',n.c,k,n.ad?'00:00':calHM(n.s),n.ad?'24:00':calHM(n.e),n.d||'',id||''].concat(Object.keys(m).length?[m]:[])}
/* orig = existing event (or null), n = new values (or null to delete), scope = 'one' | 'following' | 'all' */
function calCommit(orig,n,scope){let keepId='',from='';
  if(orig){const ser=orig.kind==='ev'?CAL.ev.find(x=>x[6]===orig.id):null;
    if(orig.kind==='one')CAL.one=CAL.one.filter(x=>x[6]!==orig.id);
    else if(scope==='one')(CAL.ex[orig.id]=CAL.ex[orig.id]||[]).push(orig.date);
    else if(scope==='following'&&ser&&(!orig.from||orig.date>orig.from)){const u=addDays(orig.date,-1);ser[7]={...calM(ser),until:u};if(CAL.ex[orig.id])CAL.ex[orig.id]=CAL.ex[orig.id].filter(k=>k<=u);from=n?n.date:''}
    else{CAL.ev=CAL.ev.filter(x=>x[6]!==orig.id);
      if(n&&n.rep&&scope==='all'){keepId=orig.id;from=orig.from&&n.date<orig.from?n.date:orig.from}else delete CAL.ex[orig.id];
      if(scope==='following')from=n?n.date:''}}
  if(n){if(n.rep&&!(orig&&orig.kind==='ev'&&scope==='one'))CAL.ev.push(calRow(n,n.rep,keepId,from||(orig&&orig.kind==='ev'?'':n.date)));else CAL.one.push(calRow(n,n.date))}
  calSave();closeSheet();calRender()}
function calAsk(what,cb){openSheet(what+' recurring event',`<div class="gc-scope"><button class="btn p" type="button" data-sc="one">This event</button><button class="btn" type="button" data-sc="following">This and following events</button><button class="btn" type="button" data-sc="all">All events</button></div>`);
  $('sheetBody').onclick=e=>{const b=e.target.closest('[data-sc]');if(b)cb(b.dataset.sc)}}
function calRepLabel(days){return days==='1234567'?'Daily':days==='12345'?'Every weekday (Mon–Fri)':days.length===1?'Weekly on '+CAL_DN[+days-1]:'Weekly on '+[...days].map(x=>CAL_DN[+x-1]).join(', ')}
const calRepKind=(rep,date)=>!rep?'':rep==='1234567'?'daily':rep==='12345'?'wd':rep===calDow(date)?'weekly':'custom';
/* o = {t,c,date,s,e,d,rep,ad,until,rm}; orig = the event being edited (null for new) */
function calEdit(o,orig){let c=o.c||'other';const rk=calRepKind(o.rep,o.date),wd=o.rep||calDow(o.date);
  openSheet(orig?'edit event':'new event',`<div class="gc-form"><input id="ceT" class="gc-in big" placeholder="Add title" value="${esc(o.t||'')}" autocomplete="off" enterkeyhint="done">
    <label class="gc-chk"><input type="checkbox" id="ceA"${o.ad?' checked':''}> All day</label>
    <div class="gc-row"><input id="ceD" class="gc-in" type="date" value="${o.date}"><span class="gc-tms" id="ceTm"><input id="ceS" class="gc-in" type="time" step="300" value="${calHM(o.s%1440)}"><span class="gc-end" id="ceEw"><span>–</span><input id="ceE" class="gc-in" type="time" step="300" value="${calHM(o.e%1440)}"></span></span></div>
    <div id="ceEv" class="gc-form">
      <select id="ceR" class="gc-in">${[['','Does not repeat'],['daily','Daily'],['weekly',''],['wd','Every weekday (Mon–Fri)'],['custom','Custom…']].map(([v,l])=>`<option value="${v}"${v===rk?' selected':''}>${l}</option>`).join('')}</select>
      <div class="gc-dows" id="ceW">${CAL_DN.map((d,i)=>`<button type="button" data-cw="${i+1}" class="${wd.includes(String(i+1))?'on':''}" aria-label="${d}">${d[0]}</button>`).join('')}</div>
      <div class="gc-row" id="ceU"><span class="dim">Ends</span><select id="ceUs" class="gc-in"><option value="">Never</option><option value="on"${o.until?' selected':''}>On</option></select><input id="ceUd" class="gc-in" type="date" value="${o.until||addDays(o.date,28)}"></div>
      <select id="ceRm" class="gc-in" aria-label="Notification">${[[-1,'No notification'],[0,'At start'],[5,'5 minutes before'],[10,'10 minutes before'],[30,'30 minutes before'],[60,'1 hour before'],[1440,'1 day before']].map(([v,l])=>`<option value="${v}"${v===(o.rm==null?10:o.rm)?' selected':''}>🔔 ${l}</option>`).join('')}</select>
      <div class="gc-cals" id="ceC">${Object.entries(CAL_COL).map(([k,cc])=>`<button type="button" data-cc="${k}" class="${k===c?'on':''}"><i style="background:${cc}"></i>${k}</button>`).join('')}</div>
    </div>
    <textarea id="ceN" class="gc-in" rows="3" placeholder="Add description">${esc(o.d||'')}</textarea>
    <div class="bigbtns"><button class="btn p" type="button" id="ceOk">Save</button>${orig?'<button class="btn" type="button" id="ceDel">Delete</button>':''}</div></div>`);
  const upd=()=>{const ad=$('ceA').checked,r=$('ceR').value;
    $('ceTm').classList.toggle('gc-hide',ad);
    $('ceW').classList.toggle('gc-hide',r!=='custom');$('ceU').classList.toggle('gc-hide',!r);$('ceUd').classList.toggle('gc-hide',$('ceUs').value!=='on');
    $('ceR').options[2].textContent=calRepLabel(calDow($('ceD').value||o.date))};
  upd();if(!orig&&calPT==='mouse')setTimeout(()=>$('ceT')&&$('ceT').focus(),60);
  const read=()=>{const ad=$('ceA').checked,date=$('ceD').value||o.date,rv=$('ceR').value;const s=calMin($('ceS').value||'09:00');let e=calMin($('ceE').value||'10:00');if(e<=s)e=e===0?1440:Math.min(1440,s+60);
    const rep=rv===''?'':rv==='daily'?'1234567':rv==='wd'?'12345':rv==='weekly'?calDow(date):[...$('ceW').querySelectorAll('.on')].map(b=>b.dataset.cw).join('')||calDow(date);
    return {t:$('ceT').value,c,date,s,e,d:$('ceN').value,ad,rep,until:rep&&$('ceUs').value==='on'?$('ceUd').value:'',rm:+$('ceRm').value}};
  const sb=$('sheetBody');sb.onchange=upd;
  sb.onclick=e=>{const b=e.target.closest('button');if(!b)return;
    if(b.dataset.cc){c=b.dataset.cc;$('ceC').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));return}
    if(b.dataset.cw){b.classList.toggle('on');return}
    if(b.id==='ceOk'){const n=read();
      if(orig&&orig.kind==='ev')calAsk('Edit',sc=>calCommit(orig,n,sc));else calCommit(orig,n,'all')}
    if(b.id==='ceDel')calDelete(orig)};
  $('ceT').onkeydown=e=>{if(e.key==='Enter')$('ceOk').click()}}
function calDelete(ev){if(ev.kind==='ev')calAsk('Delete',sc=>calCommit(ev,null,sc));else calCommit(ev,null,'all')}
function calDetail(ev){const d=calD(ev.date);
  openSheet(ev.t,`<div class="gc-det"><div><i style="background:${calCol(ev)}"></i><b>${esc(ev.t)}</b></div><div class="dim">${esc(d.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'}))} · ${ev.ad?'All day':calFmt(ev.s,ev.e)}</div>
    <div class="dim">${esc(ev.c)} calendar${ev.one?'':' · '+calRepLabel(ev.days)+(ev.until?' until '+esc(nice(ev.until)):'')}</div>${ev.ad?'':`<div class="dim">🔔 ${calRmTxt(ev.rm)}</div>`}${ev.d?`<p>${esc(ev.d)}</p>`:''}
    <div class="bigbtns" style="margin-top:10px"><button class="btn p" type="button" id="cdE">Edit</button><button class="btn" type="button" id="cdC">Duplicate</button><button class="btn" type="button" id="cdD">Delete</button></div></div>`);
  $('sheetBody').onclick=e=>{if(e.target.id==='cdE')calEdit({...ev,rep:ev.days},ev);if(e.target.id==='cdC')calEdit({...ev,rep:''},null);if(e.target.id==='cdD')calDelete(ev)}}
function calEvOf(x){const [k,key]=x.dataset.gce.split('|');return calEvents(calD(k)).find(e=>calKey(e)===key)}
function calNewAt(date,s,e,ad){calEdit({t:'',c:'other',date,s,e,d:'',rep:'',ad},null)}
function calCreate(){const t=ymd(new Date()),days=calDays().map(ymd);const date=days.includes(t)?t:calK();const now=new Date(),s=Math.min(23*60,(now.getHours()+1)*60);calNewAt(date,s,s+60)}
const calY=(col,y,snap)=>{const r=col.getBoundingClientRect();return Math.max(0,Math.min(1440,Math.round((y-r.top)/calH*60/snap)*snap))};
const calColAt=x=>[...$('gcal').querySelectorAll('.gc-col')].find(c=>{const r=c.getBoundingClientRect();return x>=r.left&&x<r.right});
function calDraft(col,s,e){let d=$('gcDraft');if(!d){d=document.createElement('div');d.id='gcDraft';d.className='gc-ev gc-draft'}if(d.parentNode!==col)col.appendChild(d);
  d.style.cssText=`top:${s/60*calH}px;height:${Math.max(11,(e-s)/60*calH-2)}px;left:0;width:calc(100% - 8px);z-index:90`;d.innerHTML=`<b>(No title)</b><i>${calFmt(s,e)}</i>`}
function calNew(col,s,e){const i=[...col.parentNode.querySelectorAll('.gc-col')].indexOf(col);const date=ymd($('gcal')._days[i]);calDraft(col,s,e);calNewAt(date,s,e)}
/* when any sheet closes (saved or cancelled) redraw so nothing is left half-dragged */
new MutationObserver(()=>{if(sheetOn())return;const ae=document.activeElement;if(ae&&$('sheet').contains(ae))ae.blur();if($('gcDraft'))$('gcDraft').remove();if(cur==='week'&&!calDrag)calRender()}).observe($('sheet'),{attributes:true,attributeFilter:['class']});
function calStart(x,ev,col,cx,cy,touch){const r=x.getBoundingClientRect();
  calDrag={mode:cy>r.bottom-(touch?12:7)?'resize':'move',x,ev,col,y0:cy,x0:cx,off:calY(col,cy,1)-ev.s,s:ev.s,e:ev.e,moved:touch,touch};if(touch)x.classList.add('drag')}
$('gcal').addEventListener('pointerdown',e=>{calPT=e.pointerType;const col=e.target.closest('.gc-col'),x=e.target.closest('.gc-col [data-gce]');
  if(e.pointerType!=='mouse'){calSw={x:e.clientX,y:e.clientY,t:Date.now()};
    if(x&&col){const ev=calEvOf(x);if(!ev)return;if(calLP)clearTimeout(calLP.t);const cx=e.clientX,cy=e.clientY;
      calLP={x:cx,y:cy,t:setTimeout(()=>{calLP=null;calSw=null;calStart(x,ev,col,cx,cy,true);try{navigator.vibrate&&navigator.vibrate(10)}catch(_){}},380)}}
    return}
  if(e.button!==0||!col)return;
  if(x){const ev=calEvOf(x);if(!ev)return;calStart(x,ev,col,e.clientX,e.clientY,false)}
  else{const s=Math.floor(calY(col,e.clientY,1)/15)*15;calDrag={mode:'new',col,a:s,s,e:s+15,y0:e.clientY,moved:false}}
  e.preventDefault()});
/* while a touch-drag is live, stop the page from scrolling under the finger */
$('gcal').addEventListener('touchmove',e=>{if(calDrag&&calDrag.touch)e.preventDefault()},{passive:false});
addEventListener('pointercancel',()=>{if(calLP){clearTimeout(calLP.t);calLP=null}calSw=null;if(calDrag&&calDrag.touch){calDrag=null;calRender()}});
addEventListener('pointermove',e=>{if(calLP&&Math.abs(e.clientX-calLP.x)+Math.abs(e.clientY-calLP.y)>8){clearTimeout(calLP.t);calLP=null}
  const g=calDrag;if(!g)return;if(!g.moved&&Math.abs(e.clientY-g.y0)+Math.abs(e.clientX-(g.x0||e.clientX))<5)return;g.moved=true;
  if(g.mode==='new'){const y=calY(g.col,e.clientY,15);g.s=Math.min(g.a,y);g.e=Math.max(g.a+15,y);if(y<g.a)g.e=g.a+15;calDraft(g.col,g.s,g.e);return}
  if(g.mode==='resize'){g.e=Math.max(g.s+15,calY(g.col,e.clientY,15))}
  else{const c=calColAt(e.clientX)||g.col;g.col=c;const len=g.ev.e-g.ev.s;g.s=Math.max(0,Math.min(1440-len,calY(c,e.clientY,1)-g.off));g.s=Math.round(g.s/15)*15;g.e=g.s+len;if(g.x.parentNode!==c)c.appendChild(g.x)}
  g.x.classList.add('drag');g.x.style.top=g.s/60*calH+'px';g.x.style.height=Math.max(11,(g.e-g.s)/60*calH-2)+'px';g.x.style.left='0';g.x.style.width='calc(100% - 8px)';g.x.style.zIndex=95;
  const t=g.x.querySelector('i');if(t)t.textContent=calFmt(g.s,g.e)});
addEventListener('pointerup',e=>{if(calLP){clearTimeout(calLP.t);calLP=null}
  const sw=calSw;calSw=null;
  if(sw&&!calDrag&&$('gcal').contains(e.target)){const dx=e.clientX-sw.x,dy=e.clientY-sw.y;if(Math.abs(dx)>70&&Math.abs(dx)>1.8*Math.abs(dy)&&Date.now()-sw.t<700&&!sheetOn()){calSupp=Date.now();calShift(dx<0?1:-1);return}}
  const g=calDrag;if(!g)return;calDrag=null;
  if(g.mode==='new'){calSupp=Date.now();if(!g.moved){g.s=Math.floor(g.a/30)*30;g.e=Math.min(1440,g.s+60)}calNew(g.col,g.s,g.e);return}
  if(!g.moved)return;calSupp=Date.now();const i=[...g.col.parentNode.querySelectorAll('.gc-col')].indexOf(g.col);const date=ymd($('gcal')._days[i]);const ev=g.ev;
  if(date===ev.date&&g.s===ev.s&&g.e===ev.e){calRender();return}
  const n={t:ev.t,c:ev.c,date,s:g.s,e:g.e,d:ev.d,ad:false,rm:ev.rm,until:ev.until,rep:ev.kind==='ev'?(ev.days.length===1?calDow(date):ev.days):''};
  if(ev.kind==='ev')calAsk('Move',sc=>calCommit(ev,n,sc));else calCommit(ev,n,'all')});
addEventListener('keydown',e=>{if(e.key==='Escape'&&calFS&&!sheetOn()){calFull(false);return}
  if(cur!=='week'||e.metaKey||e.ctrlKey||e.altKey||sheetOn()||$('pal').classList.contains('on'))return;
  const ae=document.activeElement;if(ae&&(/INPUT|TEXTAREA|SELECT/.test(ae.tagName)||ae.isContentEditable))return;
  const k=e.key,V={d:'1',x:'3',w:'7',m:'m'};
  if(k==='t'){calAt=null;calRender()}else if(k==='j'||k==='n'||k==='ArrowRight')calShift(1);else if(k==='k'||k==='p'||k==='ArrowLeft')calShift(-1);else if(V[k])calSetView(V[k]);else if(k==='c')calCreate();else return;
  e.preventDefault()});
$('gcal').addEventListener('change',e=>{if(e.target.id==='gcPick'&&e.target.value){calAt=e.target.value;calRender()}});
document.addEventListener('click',e=>{const el=$('gcal');if(!el||!el.contains(e.target))return;if(Date.now()-calSupp<450)return;
  const pk=e.target.closest('.gc-title');if(pk){const inp=$('gcPick');if(inp&&inp.showPicker&&e.target!==inp){try{inp.showPicker();e.preventDefault()}catch(_){}}return}
  const b=e.target.closest('[data-gc]');if(b){const a=b.dataset.gc;if(a==='full')calFull();else if(a==='new')calCreate();else if(a==='today'){calAt=null;calRender()}else calShift(a==='next'?1:-1);return}
  const v=e.target.closest('[data-gcv]');if(v){calSetView(v.dataset.gcv);return}
  const x=e.target.closest('[data-gce]');if(x){const ev=calEvOf(x);if(ev)calDetail(ev);return}
  const dd=e.target.closest('[data-gcday]');if(dd){calSetView('1',dd.dataset.gcday);return}
  const ad=e.target.closest('[data-gcad]');if(ad){calNewAt(ad.dataset.gcad,9*60,10*60,true);return}
  const mc=e.target.closest('[data-gcm]');if(mc){calNewAt(mc.dataset.gcm,9*60,10*60);return}
  const col=e.target.closest('.gc-col');if(col&&calPT!=='mouse'&&!e.target.closest('#gcDraft')){const s=Math.floor(calY(col,e.clientY,1)/30)*30;calNew(col,s,Math.min(1440,s+60))}});

/* ---------- sync: other devices, coming back to the app, and the Today view ---------- */
watch('cal/week',d=>{if(!d)return;CAL=d;calNorm();if(!calDrag&&!sheetOn())calRender();renderTodayCal();if(typeof pushSync==='function')pushSync()});
document.addEventListener('visibilitychange',()=>{if(document.hidden||!R||!CAL||pend['cal/week']!=null||busy['cal/week'])return;
  load('cal/week').then(d=>{if(!d||JSON.stringify(d)===JSON.stringify(CAL)||calDrag||sheetOn())return;CAL=d;calNorm();calRender();renderTodayCal()}).catch(()=>{})});
function renderTodayCal(){const el=$('todayCal');if(!el)return;if(!CAL){calEnsure().then(c=>{if(c)renderTodayCal()});return}
  const now=new Date(),m=now.getHours()*60+now.getMinutes();const evs=calEvents(now).sort((a,b)=>(b.ad-a.ad)||a.s-b.s);
  if(!evs.length){el.innerHTML='';return}
  const nowEv=evs.filter(ev=>!ev.ad&&ev.s<=m&&ev.e>m).sort((a,b)=>(b.s-a.s)||((a.e-a.s)-(b.e-b.s)))[0];
  el.innerHTML=`<div class="blk ttblk tcblk"><div class="bh static"><span class="tm">Calendar</span><span class="ti">Today</span><span class="ct">${evs.length} event${evs.length>1?'s':''}</span><button type="button" class="ttgo" id="tcGo">open calendar ›</button></div>
    <div class="items">${evs.map(ev=>{const past=!ev.ad&&ev.e<=m,on=ev===nowEv;
      return `<button type="button" class="tcrow${past?' past':''}${on?' now':''}" data-tce="${esc(calKey(ev))}"><i style="background:${calCol(ev)}"></i><span class="num">${ev.ad?'all day':calFmt(ev.s,ev.e)}</span><b>${esc(ev.t)}</b></button>`}).join('')}</div></div>`;
  el.onclick=e=>{const b=e.target.closest('#tcGo,[data-tce]');if(!b)return;if(b.id==='tcGo'){calAt=null;go('week');return}
    const ev=calEvents(new Date()).find(x=>calKey(x)===b.dataset.tce);if(ev)calDetail(ev)}}

setInterval(()=>{if(typeof cur!=='undefined'&&cur==='today'&&!document.hidden)renderTodayCal()},60e3);document.addEventListener('visibilitychange',()=>{if(!document.hidden&&typeof cur!=='undefined'&&cur==='today')renderTodayCal()});
