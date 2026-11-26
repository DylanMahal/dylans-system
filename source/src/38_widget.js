/* ================= feed for the goals, mood, career and people widgets =================
   widget/life = {at, date, goals, mood, career, people}. Written only when something on it changed,
   with the time stamped at most hourly so the widget can tell it is fresh. */
let NXW={g:[],gAt:0,gSig:'',md:'',mdays:[],last:'',at:0,busy:false};
async function nxWidget(){if(NXW.busy||!R)return;NXW.busy=true;try{
  const w={date:DAYK},wk0=addDays(DAYK,-((new Date(DAYK+'T12:00').getDay()||7)-1));
  /* goals: gData reads several sections, so refresh at most every 10 minutes unless a goal itself changed */
  if(typeof goalsLoad==='function'){await goalsLoad();const act=gActive(),sig=JSON.stringify(act);
    if(sig!==NXW.gSig||Date.now()-NXW.gAt>6e5){await gData();NXW.gSig=sig;NXW.gAt=Date.now();
      NXW.g=act.slice(0,6).map(g=>{const s=gState(g);return {n:g.name||'Goal',c:g.color||(typeof G_COLS!=='undefined'&&G_COLS[g.area])||'#ff2a6d',
        pct:Math.round(s.pct*100),pace:Math.round(s.pace*100),st:s.status,now:g.src==='ms'?s.label:gFmt(g,s.now),tgt:g.src==='ms'?'':gFmt(g,+g.target),u:gUnit(g),eta:s.eta||'',due:g.due||''}})}
    w.goals=NXW.g}
  /* mood: today's check-ins live, the previous 13 days read once a day */
  if(typeof MOODD!=='undefined'){
    if(NXW.md!==DAYK){const ds=Array.from({length:13},(_,i)=>addDays(DAYK,i-13));const docs=await Promise.all(ds.map(d=>load('mood/d-'+d).catch(()=>null)));
      NXW.mdays=ds.map((d,i)=>{const a=((docs[i]||{}).in||[]).filter(x=>x.m!=null).map(x=>moodV(x)/2);return [d,a.length?Math.round(a.reduce((s,v)=>s+v,0)/a.length*10)/10:null]});NXW.md=DAYK}
    const t=MOODD.in.filter(x=>x.m!=null).map(x=>moodV(x)/2),last=MOODD.in[MOODD.in.length-1],s=moodSlot();
    w.mood={days:[...NXW.mdays,[DAYK,t.length?Math.round(t.reduce((a,v)=>a+v,0)/t.length*10)/10:null]],
      last:last&&last.m!=null?{m:mood5(moodV(last)),e:last.e==null?null:+last.e,at:last.at}:null,n:MOODD.in.length,due:s&&!moodCur()?s:null}}
  /* career: this week's applications and practice, the funnel, and what to do next */
  if(typeof carLoad==='function'){await carLoad();const apps=CAR.apps,sent=apps.filter(a=>a.status!=='saved');
    const acts=apps.filter(a=>a.status!=='closed'&&a.next&&a.next.t).map(a=>({co:a.co||'',t:a.next.t,due:a.next.due||''}));
    apps.filter(a=>a.status==='applied'&&a.applied&&nxDays(a.applied,DAYK)>=10&&!(a.next&&a.next.t)).forEach(a=>acts.push({co:a.co||'',t:'Follow up',due:DAYK}));
    acts.sort((x,y)=>(x.due||'9')<(y.due||'9')?-1:1);
    w.career={wk:apps.filter(a=>a.applied&&a.applied>=wk0).length,wkT:+CCFG.apps||5,lc:typeof leetWeek==='function'?leetWeek():0,lcT:(typeof LEET!=='undefined'&&LEET.target)||8,
      f:[sent.length,sent.filter(a=>cReached(a,'replied')).length,sent.filter(a=>cReached(a,'interview')).length,sent.filter(a=>cReached(a,'offer')).length],next:acts.slice(0,4)}}
  /* people: who is due a call or a visit, and how many times you reached out this week */
  if(typeof peopleLoad==='function'&&!PPL_OFF){if(!pplLoaded)await peopleLoad();
    w.people={due:peopleDue().slice(0,5).map(p=>({n:p.name||'',k:p.dueKind,s:p.dueSub||''})),wk:PPLOG.log.filter(x=>pDay(x)>=wk0).length,n:PPL.people.length}}
  const sig=JSON.stringify(w),fresh=Date.now()-NXW.at<36e5;if(sig===NXW.last&&fresh)return;
  NXW.last=sig;NXW.at=Date.now();save('widget/life',{...w,at:new Date().toISOString()},true);
}catch(e){if(typeof nxErr==='function')nxErr(e,'widget')}finally{NXW.busy=false}}
