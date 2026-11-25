/* ================= USAGE: how you use the app, and building it vs doing the things it tracks =================
   Each device keeps its own month doc (sys/usage/<device>-m-YYYY-MM = {d:{day:{section:{o,ms}, _taps}}}) so iPhone
   and iPad never overwrite each other. Opened from the search menu ("system"). Nothing reorders without your OK. */
const USE_DEV=(()=>{let d=LS.get('nx/dev');if(!d){d=rid().slice(0,6);LS.set('nx/dev',d)}return d})();
let USE={d:{}},useMon=null,useCur=null,useT0=0,useLoaded=false,useSaveT=null;
const usePath=m=>'sys/usage/'+USE_DEV+'-m-'+m;
async function useEnsure(){const m=DAYK.slice(0,7);if(useLoaded&&useMon===m)return;useMon=m;const d=await load(usePath(m)).catch(()=>null);USE={d:{},...(d||{})};useLoaded=true}
function useDay(){return USE.d[DAYK]||(USE.d[DAYK]={})}
function useTick(){if(useCur&&useT0&&!document.hidden){const dt=Math.min(Date.now()-useT0,20*60e3);const s=useDay();(s[useCur]=s[useCur]||{o:0,ms:0}).ms+=dt}useT0=Date.now()}
function useDirty(now){clearTimeout(useSaveT);useSaveT=setTimeout(()=>{if(typeof R!=='undefined'&&R&&useLoaded)save(usePath(useMon),USE)},now?0:60e3)}
function nxUsageOpen(v){useEnsure().then(()=>{useTick();useCur=v;useT0=Date.now();const s=useDay();(s[v]=s[v]||{o:0,ms:0}).o++;useDirty()}).catch(e=>nxErr(e,'usage'))}
window.nxUsageOpen=nxUsageOpen;
document.addEventListener('visibilitychange',()=>{if(document.hidden){useTick();useDirty(true)}else{useT0=Date.now();if(useLoaded){const s=useDay();s._open=(s._open||0)+1;useDirty()}}});
document.addEventListener('click',()=>{if(!useLoaded)return;const s=useDay();s._taps=(s._taps||0)+1},{capture:true,passive:true});
/* re-order the tab bar if you approved an order on the System page */
watch('sys/taborder',d=>{if(d&&d.order)LS.set('nx/taborder',d.order);else if(d){try{localStorage.removeItem('ds3:nx/taborder')}catch(_){}}});

/* build time: commits to the app's repo, grouped into sessions (gaps under 90 min), each plus 30 min */
async function useBuildHours(sinceDay){try{const since=new Date(sinceDay+'T00:00').toISOString();const r=await fetch('https://api.github.com/repos/dylanmahal/dylans-system/commits?per_page=100&since='+encodeURIComponent(since));if(!r.ok)return null;
  const js=await r.json();const ts=js.map(c=>new Date(c.commit&&c.commit.author&&c.commit.author.date).getTime()).filter(x=>x).sort((a,b)=>a-b);if(!ts.length)return {h:0,n:0};
  let h=0,s=ts[0],p=ts[0];for(let i=1;i<=ts.length;i++){const t=ts[i];if(t==null||t-p>90*60e3){h+=(p-s)+30*60e3;s=t;}p=t}return {h:h/36e5,n:ts.length}}catch(e){return null}}
async function openSystem(){openSheet('system','<div class="nx" style="padding:0"><div class="nx-s">Reading usage…</div></div>');
  let rows=[];try{rows=await listDocs('sys/usage/')}catch(e){nxErr(e,'usage')}
  useTick();const all={};const days30=[...Array(30)].map((_,i)=>addDays(DAYK,i-29));
  rows.concat([{path:usePath(DAYK.slice(0,7)),data:USE}]).forEach(r=>{const dd=(r.data&&r.data.d)||{};Object.entries(dd).forEach(([day,secs])=>{if(!days30.includes(day))return;const A=all[day]||(all[day]={});Object.entries(secs).forEach(([k,v])=>{if(k[0]==='_'){A[k]=Math.max(A[k]||0,v||0);return}const x=A[k]||(A[k]={o:0,ms:0});x.o=Math.max(x.o,0)+(+v.o||0);x.ms+=(+v.ms||0)})})});
  const secs=VIEWS.map(v=>v[0]),lab=Object.fromEntries(VIEWS.map(v=>[v[0],v[1]]));
  const tot=s=>days30.reduce((a,d)=>a+((all[d]&&all[d][s]&&all[d][s].o)||0),0),tms=s=>days30.reduce((a,d)=>a+((all[d]&&all[d][s]&&all[d][s].ms)||0),0);
  const used=days30.filter(d=>all[d]&&Object.keys(all[d]).some(k=>k[0]!=='_'));const msDay=used.length?days30.reduce((a,d)=>a+Object.entries(all[d]||{}).filter(([k])=>k[0]!=='_').reduce((x,[,v])=>x+(v.ms||0),0),0)/used.length:0;
  const minDay=Math.round(msDay/60e3),taps=used.length?Math.round(nxAvg(used.map(d=>(all[d]&&all[d]._taps)||0))):0;
  const rank=secs.map(s=>({s,o:tot(s),ms:tms(s)})).sort((a,b)=>b.o-a.o);const mx=Math.max(1,...rank.map(r=>r.o));
  const mon=addDays(DAYK,-((new Date(DAYK+'T12:00').getDay()||7)-1));const fo=await load('tools/focus').catch(()=>null);const doing=((fo&&fo.sessions)||[]).filter(x=>x.d>=mon).reduce((a,x)=>a+(+x.min||0),0)/60;
  const bh=await useBuildHours(mon);const bk=await load('agent/backup').catch(()=>null);const lx=LS.get('nx/lastExport');
  const sugg=[];if(rank.length>2&&rank[1].o>0){const order=VIEWS.map(v=>v[0]);const pos=order.indexOf(rank[1].s);if(pos>2)sugg.push(['','Move',`${lab[rank[1].s]} is your second most used section. Put it near the start of the tab bar.`])}
  rank.filter(r=>r.o<=1&&r.s!=='today').slice(0,2).forEach(r=>sugg.push(['nx-mid2',r.o?'Merge':'Unused',`${lab[r.s]} was opened ${r.o?'once':'zero times'} in 30 days.${r.s==='career'?' Give it a 20-minute block on Today so it gets a start.':' Its key numbers could live in a widget or Goals › Trends instead.'}`]));
  if(minDay>15)sugg.push(['nx-bad','Trim',`You spend about ${minDay} minutes a day in the app. Aim for under 15: the app should save time, not eat it.`]);
  const order=rank.filter(r=>r.o>0).map(r=>r.s).concat(rank.filter(r=>r.o===0).map(r=>r.s));const curOrder=VIEWS.map(v=>v[0]);const differs=used.length>=14&&order.slice(0,5).join()!==curOrder.slice(0,5).join();
  const bp=bh&&bh.h+doing>0?bh.h/(bh.h+doing):null;
  $('sheetBody').innerHTML=`<div class="nx" style="padding:0">
    <div class="nx-card nx-hero">${nxRing(Math.min(1,minDay/15),76,8,minDay<=15?NXC.green:NXC.red,`<b style="font-size:20px">${minDay}</b><span>min / day</span>`)}<div style="flex:1;display:grid;gap:6px;min-width:0"><div class="nx-t2">Time in the app</div><div class="nx-s">Aim for under 15 minutes a day of logging and checking. ${used.length} day${used.length===1?'':'s'} of data so far.</div><div class="nx-xs">${taps} taps a day</div></div></div>
    <div class="nx-card"><div class="nx-split"><span class="nx-t2">Building vs doing</span>${bp!=null?`<span class="nx-pill ${bp>1/3?'nx-bad':'nx-ok'}">${bp>1/3?'Building ahead':'Doing ahead'}</span>`:''}</div>
      <div class="nx-s" style="margin-top:4px">This week. Building is estimated from your commits to the app, doing is time on the focus timer.</div>
      <div style="display:grid;gap:12px;margin-top:14px"><div><div class="nx-split"><span class="nx-s" style="color:#d1d1d6">Building the app</span><b class="num" style="font-size:13px">${bh?bh.h.toFixed(1)+' h · '+bh.n+' commits':'offline'}</b></div><div class="nx-bar" style="margin-top:7px"><i class="r" style="width:${bh?Math.min(100,bh.h/Math.max(1,bh.h,doing)*100):0}%"></i></div></div>
      <div><div class="nx-split"><span class="nx-s" style="color:#d1d1d6">Focus time</span><b class="num" style="font-size:13px">${doing.toFixed(1)} h</b></div><div class="nx-bar" style="margin-top:7px"><i class="g" style="width:${Math.min(100,doing/Math.max(1,bh?bh.h:0,doing)*100)}%"></i></div></div></div>
      <div class="nx-xs" style="margin-top:12px">Target: building stays under a third of the total. A fixed build slot on Today keeps it there.</div></div>
    <div class="nx-card"><div class="nx-h"><span>Opens per day · 30 days</span><em>darker = more</em></div><div class="nx-heat">${rank.map(r=>`<div><span class="nx-xs" style="color:#a1a1a6">${esc(lab[r.s])}</span>${days30.map(d=>{const o=(all[d]&&all[d][r.s]&&all[d][r.s].o)||0;return `<i style="${o?`background:rgba(255,42,109,${Math.min(1,.25+o/6).toFixed(2)})`:''}"></i>`}).join('')}</div>`).join('')}</div></div>
    <div class="nx-card"><div class="nx-h"><span>Sections ranked</span><em>opens · time a day</em></div><div class="nx-rows">${rank.map((r,i)=>`<div class="nx-row" style="padding:9px 0"><span style="display:flex;gap:10px;align-items:center"><span class="num nx-xs" style="width:16px">${i+1}</span>${esc(lab[r.s])}</span><span class="num nx-s">${r.o} · ${Math.round(r.ms/60e3/Math.max(1,used.length))} min</span></div>`).join('')}</div>
      ${differs?`<button type="button" class="nx-btn2 pk" id="sysOrder" style="margin-top:12px">Use this order for the tab bar</button>`:''}${LS.get('nx/taborder')?'<button type="button" class="nx-btn2" id="sysOrderReset" style="margin-top:8px">Back to the default tab order</button>':''}</div>
    ${sugg.length?`<div class="nx-card"><div class="nx-h"><span>Suggestions</span><em>last 30 days</em></div><div style="display:grid;gap:12px;font-size:13.5px;color:#d1d1d6;line-height:1.4">${sugg.map(([c,l,t])=>`<div style="display:flex;gap:10px"><span class="nx-pill ${c}" style="height:fit-content;min-width:64px;justify-content:center">${l}</span><span>${esc(t)}</span></div>`).join('')}</div></div>`:''}
    <div class="nx-card"><div class="nx-h"><span>Backups</span></div><div class="nx-rows">
      <div class="nx-row"><span class="nx-s" style="color:#d1d1d6">Nightly to OneDrive</span><span class="nx-pill ${bk&&Date.now()-new Date(bk.at)<36*36e5?'nx-ok':'nx-mid2'}">${bk?nxDate(String(bk.at).slice(0,10))+' · '+bk.count+' docs':'needs the new laptop agent'}</span></div>
      <div class="nx-row"><span class="nx-s" style="color:#d1d1d6">Last export from this device</span><span class="nx-pill">${lx?nxDate(String(lx.at).slice(0,10)):'never'}</span></div></div>
      <button type="button" class="nx-btn2" id="sysExport" style="margin-top:12px">Export all data</button></div>
    ${NXERR.length?`<div class="nx-card"><div class="nx-h"><span>Recent errors</span><em>${NXERR.length}</em></div><div class="nx-rows">${NXERR.slice(0,6).map(x=>`<div class="nx-row" style="padding:8px 0;align-items:flex-start"><span class="nx-xs" style="flex:none">${nxDate(x.t.slice(0,10))} ${nxClock(x.t)}</span><span class="nx-xs" style="color:#d1d1d6;text-align:right">${esc(x.m)}</span></div>`).join('')}</div><button type="button" class="nx-btn2" id="sysErrClr" style="margin-top:10px">Clear</button></div>`:''}
  </div>`;
  $('sheetBody').onclick=e=>{if(e.target.closest('#sysExport')){nxExport(e.target.closest('#sysExport'));return}
    if(e.target.closest('#sysOrder')){LS.set('nx/taborder',order);save('sys/taborder',{order,at:new Date().toISOString()});e.target.closest('#sysOrder').textContent='Saved · reload the app to see it';return}
    if(e.target.closest('#sysOrderReset')){try{localStorage.removeItem('ds3:nx/taborder')}catch(_){}save('sys/taborder',{order:null});e.target.closest('#sysOrderReset').textContent='Reset · reload the app to see it';return}
    if(e.target.closest('#sysErrClr')){NXERR=[];LS.set('diag/errs',[]);save('diag/errors',{list:[]});openSystem()}}}
nxCmd('system usage','system',openSystem);
