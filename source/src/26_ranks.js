/* ================= COMPETITIVE RANKS (Rocket League ladder) =================
   Score 0–21+: 3 divisions per tier, Bronze I … Grand Champion III, then Supersonic Legend.
   Exercise rank = your best set vs bodyweight-scaled strength standards.
   Session rank = working sets + records + volume vs your recent sessions + how strong the sets were. */
/* bodyweight for scoring: the ranks keep their own copy of the weigh-ins (loaded once, kept live), so every screen
   scores with the same numbers whatever page loaded first; each set is judged at the weight you were that day */
let RLW=null,rlWP=null;
function rlEnsureW(){if(RLW||rlWP||typeof load!=='function')return;rlWP=load('body/wt').then(d=>{RLW=((d&&d.r)||[]).filter(x=>+x.kg>0).map(x=>({d:String(x.t||'').slice(0,10),kg:+x.kg})).sort((a,b)=>a.d<b.d?-1:1);if(typeof cur!=='undefined'&&cur==='gym'&&typeof loadGym==='function')loadGym(true)}).catch(()=>{RLW=[]})}
if(typeof watch==='function')watch('body/wt',d=>{if(d)RLW=(d.r||[]).filter(x=>+x.kg>0).map(x=>({d:String(x.t||'').slice(0,10),kg:+x.kg})).sort((a,b)=>a.d<b.d?-1:1)});
function rlBWAt(day){rlEnsureW();const L=RLW||[];if(!L.length)return (typeof FPROF!=='undefined'&&FPROF&&+FPROF.kg)||80;if(!day)return L[L.length-1].kg;
  let k=L[0].kg;for(const x of L){if(x.d<=day)k=x.kg;else break}return k}
const rlBW=()=>rlBWAt(null);
/* allometric bodyweight scaling (the ⅔ power used by strength-scoring formulas), anchored so an 80 kg lifter's ratio is unchanged */
const rlNorm=(load,bw)=>load/(Math.pow(bw,2/3)*Math.pow(80,1/3));
const rlSets=w=>(w.ex||[]).reduce((a,x)=>a+x.sets.filter(s=>s.t!=='w'&&s.done!==false).length,0);
const rlVol=w=>w.vol!=null?+w.vol:stats(w).vol;
const RL=[['bronze','#d08a52','#5a2d12'],['silver','#dfe6ef','#59627a'],['gold','#ffd23f','#7a4f00'],['platinum','#7af0f7','#13636d'],
  ['diamond','#6c9bff','#1a2a86'],['champion','#c47dff','#43137a'],['grand champion','#ff4766','#6e0a20'],['supersonic legend','#ffffff','#22213a']];
function rlOf(score){score=Math.max(0,+score||0);const i=Math.min(21,Math.floor(score));const t=i>=21?7:Math.floor(i/3),d=i>=21?0:i%3;
  return {i,t,d,name:RL[t][0]+(t<7?' '+['I','II','III'][d]:''),frac:i>=21?1:score-i}}
/* original emblem set: a different armoured silhouette per tier, metallic gradients, wing blades that grow with rank,
   a faceted core, and 1-3 lit chevrons for the division. Gradients live once in a hidden <svg> (rlDefs). */
const rlMix=(h,k,to)=>{const n=parseInt(h.slice(1),16),t=to==null?255:to;const f=c=>Math.round(c+(t-c)*k);return '#'+[n>>16&255,n>>8&255,n&255].map(c=>f(c).toString(16).padStart(2,'0')).join('')};
const RL_SHAPE=[
  [[32,6],[52,17],[52,41],[32,54],[12,41],[12,17]],
  [[32,5],[53,13],[53,38],[32,56],[11,38],[11,13]],
  [[32,4],[54,11],[51,40],[32,57],[13,40],[10,11]],
  [[32,3],[45,9],[55,8],[52,40],[32,58],[12,40],[9,8],[19,9]],
  [[32,2],[50,13],[55,30],[45,48],[32,59],[19,48],[9,30],[14,13]],
  [[32,1],[40,10],[54,6],[52,40],[32,59],[12,40],[10,6],[24,10]],
  [[32,0],[38,9],[47,2],[49,12],[58,9],[53,41],[32,60],[11,41],[6,9],[15,12],[17,2],[26,9]],
  Array.from({length:16},(_,i)=>{const a=-Math.PI/2+i*Math.PI/8,r=i%2?17:30;return [32+Math.cos(a)*r,30+Math.sin(a)*r]})];
const rlPts=(P,k=1)=>P.map(([x,y])=>(32+(x-32)*k).toFixed(1)+','+(30+(y-30)*k).toFixed(1)).join(' ');
function rlDefs(){if(document.getElementById('rlDefs'))return;
  const g=RL.map(([,c1,c2],t)=>`<linearGradient id="rla${t}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="${c1}"/><stop offset=".7" stop-color="${rlMix(c2,.25)}"/><stop offset="1" stop-color="${rlMix(c1,.5)}"/></linearGradient>
    <linearGradient id="rlb${t}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${rlMix(c1,.55)}"/><stop offset=".5" stop-color="${c1}"/><stop offset="1" stop-color="${rlMix(c2,.15)}"/></linearGradient>
    <radialGradient id="rlc${t}" cx=".5" cy=".35" r=".8"><stop offset="0" stop-color="${rlMix(c2,.2)}"/><stop offset="1" stop-color="${rlMix(c2,.75,10)}"/></radialGradient>`).join('');
  document.body.insertAdjacentHTML('beforeend',`<svg id="rlDefs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${g}</defs></svg>`)}
function rlBadge(score,sz=26){rlDefs();const r=rlOf(score),t=r.t;const [,c1,c2]=RL[t];const P=RL_SHAPE[t];
  const nb=t<2?0:t===2?1:t===3?2:t===7?4:3,ext=t>=6?5:t>=4?2:0;let wings='';
  for(let k=0;k<nb;k++){const q=[[45,18+7*k],[61+ext-3.5*k,9+9.5*k],[58+ext-3.5*k,17+9.5*k],[45,25+7*k]];
    const d=m=>q.map(([x,y])=>(m?64-x:x).toFixed(1)+','+y.toFixed(1)).join(' ');
    wings+=`<polygon points="${d(0)}" fill="url(#rlb${t})" stroke="${c2}" stroke-width=".6"/><polygon points="${d(1)}" fill="url(#rlb${t})" stroke="${c2}" stroke-width=".6"/>`}
  const orbit=t>=4?`<ellipse cx="32" cy="30" rx="33" ry="8" transform="rotate(-18 32 30)" fill="none" stroke="${c1}" stroke-width=".8" opacity=".55" stroke-dasharray="${t>=6?'3 2':'14 6'}"/>`:'';
  const core=t===7?`<polygon points="${rlPts(RL_SHAPE[7],.42)}" fill="#fff"/><circle cx="32" cy="30" r="3.2" fill="${c2}"/>`
    :`<polygon points="32,15 42,27 32,46 22,27" fill="url(#rlc${t})" stroke="#fff" stroke-opacity=".7" stroke-width=".7"/><polygon points="32,15 42,27 32,30 22,27" fill="#fff" opacity=".38"/><path d="M22 27 L32 30 L42 27 M32 30 V46" stroke="#fff" stroke-opacity=".45" stroke-width=".6" fill="none"/>`;
  const circ=t>=1&&t<7?`<path d="M15 24 h5 l2 2 M49 24 h-5 l-2 2 M17 37 h4 M47 37 h-4" stroke="${c2}" stroke-width=".8" fill="none" opacity=".8"/>`:'';
  const div=t===7?'':[0,1,2].map(k=>{const x=23+k*9;return `<path d="M${x-4} 63 l4 4 l4 -4 v3.4 l-4 4 l-4 -4z" fill="${k<=r.d?`url(#rla${t})`:'rgba(255,255,255,.13)'}"/>`}).join('');
  return `<svg class="rlb t${t}" viewBox="-8 -2 80 ${t===7?66:76}" width="${Math.round(sz*1.2)}" height="${Math.round(sz*(t===7?.99:1.14))}" role="img" aria-label="${r.name}"><title>${r.name}</title>
    ${orbit}${wings}<polygon points="${rlPts(P)}" fill="url(#rlc${t})" stroke="url(#rla${t})" stroke-width="2.2" stroke-linejoin="round"/>
    <polygon points="${rlPts(P,.74)}" fill="url(#rlb${t})" stroke="${c2}" stroke-width=".7"/><polygon points="${rlPts(P,.74)}" fill="#fff" opacity=".12" clip-path="inset(0 0 55% 0)"/>${circ}${core}${div}</svg>`}
const rlChip=(score,sz=20)=>{const r=rlOf(score);return `<span class="rlchip" style="--rc:${RL[r.t][1]}">${rlBadge(score,sz)}<span>${r.name}</span></span>`};
/* strength standards as multiples of bodyweight: beginner, novice, intermediate, advanced, elite */
const RL_STD=[
  [/romanian|rdl|stiff.?leg/i,null,[.6,1,1.4,1.9,2.4]],[/hack squat/i,null,[.6,1.1,1.7,2.4,3.1]],[/bulgarian|split squat/i,'dumbbell',[.15,.3,.5,.75,1]],
  [/lunge/i,'barbell',[.4,.7,1,1.4,1.8]],[/lunge/i,'dumbbell',[.15,.25,.4,.55,.75]],[/lateral raise|side raise/i,null,[.05,.1,.17,.26,.36]],
  [/pushdown|push-?down/i,null,[.2,.35,.55,.8,1.05]],[/skull|lying.*extension|tricep.*extension/i,null,[.15,.3,.5,.75,1]],
  [/seated.*row|cable row/i,null,[.4,.6,.9,1.25,1.6]],[/row/i,'dumbbell',[.2,.35,.55,.8,1.05]],[/leg extension/i,null,[.4,.7,1.05,1.5,2]],
  [/leg curl|hamstring curl/i,null,[.3,.5,.8,1.15,1.5]],[/pec deck|butterfly/i,null,[.3,.55,.9,1.3,1.7]],[/fly|flye/i,'dumbbell',[.08,.15,.26,.4,.55]],
  [/fly|flye/i,'cable',[.1,.2,.35,.55,.75]],[/calf raise/i,null,[.6,1,1.6,2.3,3]],[/shrug/i,'barbell',[.6,1,1.5,2.1,2.7]],[/shrug/i,'dumbbell',[.25,.4,.6,.85,1.1]],
  [/chest press/i,'machine',[.4,.7,1.05,1.5,1.95]],[/shoulder press/i,'machine',[.25,.45,.7,1,1.35]],
  [/front squat/i,'barbell',[.6,1,1.25,1.75,2.2]],[/incline.*bench|incline.*press/i,'barbell',[.4,.65,1,1.4,1.7]],
  [/bench press/i,'barbell',[.5,.75,1.25,1.75,2]],[/squat/i,'barbell',[.75,1.25,1.5,2.25,2.75]],[/deadlift/i,'barbell',[1,1.5,2,2.5,3]],
  [/overhead press|shoulder press|military press/i,'barbell',[.4,.55,.8,1.05,1.35]],[/row/i,'barbell',[.5,.75,1,1.5,1.75]],[/hip thrust/i,null,[.75,1.25,1.75,2.5,3.25]],
  [/bench press|chest press/i,'dumbbell',[.2,.3,.5,.7,.85]],[/shoulder press|overhead press/i,'dumbbell',[.12,.2,.32,.45,.6]],[/curl/i,'dumbbell',[.1,.18,.3,.42,.55]],
  [/curl/i,'barbell',[.2,.35,.55,.75,.95]],[/curl/i,'ez bar',[.2,.35,.55,.75,.95]],[/pulldown/i,null,[.5,.75,1,1.3,1.6]],[/leg press/i,null,[1,1.75,2.5,3.5,4.5]],
];
const RL_BW=[[/pull-?up|chin-?up/i,[1,5,10,18,25]],[/push-?up/i,[5,15,30,45,60]],[/dip/i,[2,8,15,25,35]],[/.*/,[5,12,25,40,55]]];
const RL_WBW=[[/pull-?up|chin-?up/i,[1,1.12,1.3,1.55,1.8]],[/dip/i,[1.05,1.25,1.5,1.8,2.15]],[/.*/,[1,1.15,1.35,1.6,1.9]]];
const rlComp=e=>/press|squat|deadlift|row|pull|chin|lunge|dip|clean|snatch|thrust|push|jerk|step.?up|good morning/i.test(e.n)&&!/curl|raise|fly|flye|extension|kickback|shrug|crunch/i.test(e.n);
function rlStd(e){if(!e||e.cat&&!/strength|powerlifting|olympic|strongman/.test(e.cat))return null;
  if(e.ty==='bw')return {k:'bw',s:(RL_BW.find(([re])=>re.test(e.n))||[])[1]};
  if(e.ty==='wbw')return {k:'wbw',s:(RL_WBW.find(([re])=>re.test(e.n))||[])[1]};
  if(e.ty!=='wr')return null;const eq=e.eq||'other';
  const hit=RL_STD.find(([re,q])=>re.test(e.n)&&(!q||q===eq));if(hit)return {k:'wr',s:hit[2]};
  const comp=rlComp(e);const el={barbell:comp?1.6:.7,'smith machine':1.8,dumbbell:comp?.55:.3,machine:comp?2.2:1,cable:comp?1.2:.55,kettlebell:.5,'ez bar':.7,plate:.6,band:.4,other:.8}[eq]||.8;
  return {k:'wr',s:[.25,.4,.6,.85,1].map(f=>f*el)}}
function rlScoreRatio(v,s){const P=[[0,0],[s[0],3],[s[1],6],[s[2],9],[s[3],12],[s[4],15],[s[4]*1.15,18],[s[4]*1.3,21]];
  for(let i=1;i<P.length;i++)if(v<=P[i][0]){const [a,x]=P[i-1],[b,y]=P[i];return x+(v-a)/(b-a||1)*(y-x)}return 21}
const rlE1=(kg,r)=>r<=1?kg:kg*(1+Math.min(10,r)/30);   /* Epley, trusted up to 10 reps */
function rlSetScore(e,s,std,bw){std=std||rlStd(e);if(!std||!std.s||s.t==='w'||s.done===false)return null;bw=bw||rlBW();const r=+s.r||0;
  if(std.k==='bw')return r>0?rlScoreRatio(r,std.s):null;
  if(std.k==='wbw')return r>0?rlScoreRatio(rlE1(bw+(+s.kg||0),r)/bw,std.s):null;
  return (+s.kg>0&&r>0)?rlScoreRatio(rlNorm(rlE1(+s.kg,r),bw),std.s):null}
function rlBestIn(e,x,std,bw){let b=null;(x.sets||[]).forEach(s=>{const v=rlSetScore(e,s,std,bw);if(v!=null&&(b==null||v>b))b=v});return b}
/* best score for an exercise across history (optionally excluding a workout id) plus extra sets */
function rlEx(id,excl,extra){const e=EXMAP.get(id)||exOf({id,n:id});const std=rlStd(e);if(!std||!std.s)return null;let b=null;
  exHistory(e.id,excl).forEach(o=>{const v=rlBestIn(e,o.x,std,rlBWAt(o.w&&o.w.date));if(v!=null&&(b==null||v>b))b=v});
  if(extra){const v=rlBestIn(e,extra,std,rlBWAt(null));if(v!=null&&(b==null||v>b))b=v}return b}
function rlSession(w,ws){ws=ws||WORKOUTS;const t=w.startedAt||w.date;const prev=ws.filter(o=>o.id!==w.id&&(o.startedAt||o.date)<t).slice(0,10);
  const vols=prev.map(rlVol).filter(v=>v>0);const avg=vols.length?vols.reduce((a,b)=>a+b,0)/vols.length:0;const r=avg?rlVol(w)/avg:1;
  const wbw=rlBWAt(w.date),sc=(w.ex||[]).map(x=>rlBestIn(exOf(x),x,null,wbw)).filter(v=>v!=null);const q=sc.length?sc.reduce((a,b)=>a+b,0)/sc.length:0;
  const prs=w.prs?w.prs.length:(w._prs||0);
  return Math.min(21.5,Math.min(9,rlSets(w)*.45)+Math.min(5,prs*1.5)+Math.max(0,Math.min(5,(r-.6)/.8*5))+q/21*2.5)}
/* live session for the active workout (records counted from ticked sets) */
function rlLive(){if(!ACTIVE)return 0;const w={...ACTIVE,ex:ACTIVE.ex.map(x=>({...x,sets:x.sets.filter(s=>s.done)}))};w.vol=stats(ACTIVE).vol;
  let n=0;ACTIVE.ex.forEach(x=>{const e=exOf(x);const b=bests(e.id,ACTIVE.id);x.sets.forEach(s=>{if(s.done&&s.t!=='w'&&isPR(e,s,b))n++})});w._prs=n;delete w.prs;return rlSession(w)}
/* toast when a ticked set moves an exercise up a division */
function rlUpToast(name,from,to){const a=rlOf(from),b=rlOf(to);const t=document.createElement('div');t.className='rltoast';t.style.setProperty('--rc',RL[b.t][1]);
  t.innerHTML=`${rlBadge(to,40)}<span><small>rank up · ${esc(name)}</small><b>${b.name}</b><small class="dim">from ${a.name}</small></span>`;document.body.appendChild(t);
  try{navigator.vibrate&&navigator.vibrate([20,40,40])}catch(e){}setTimeout(()=>t.remove(),3200)}
/* what it takes to reach the next division, as an e1RM / reps target */
function rlNext(e,score){const std=rlStd(e);if(!std||!std.s||score>=21)return '';const s=std.s;const P=[[0,0],[s[0],3],[s[1],6],[s[2],9],[s[3],12],[s[4],15],[s[4]*1.15,18],[s[4]*1.3,21]];
  const tgt=Math.floor(score)+1;let v=0;for(let i=1;i<P.length;i++)if(tgt<=P[i][1]){const [a,x]=P[i-1],[b,y]=P[i];v=a+(tgt-x)/(y-x)*(b-a);break}
  const nm=rlOf(tgt).name,bw=rlBW();
  if(std.k==='bw')return `${Math.ceil(v)} reps in a set for ${nm}`;
  if(std.k==='wbw')return `${kgs(Math.max(0,Math.ceil(v*bw-bw)))} kg added (1RM) for ${nm}`;
  return `est. 1RM of ${kgs(Math.ceil(v*Math.pow(bw,2/3)*Math.pow(80,1/3)*2)/2)} kg for ${nm}`}
function rlExBlock(e){const sc=rlEx(e.id);if(sc==null)return '';const r=rlOf(sc);
  return `<div class="rlblock" style="--rc:${RL[r.t][1]}">${rlBadge(sc,54)}<div><span class="dim">Rank</span><b>${r.name}</b>${r.t<7?`<div class="rpgbar"><i style="width:${r.frac*100}%;background:var(--rc);box-shadow:0 0 8px var(--rc)"></i></div>`:''}<small class="dim">${esc(rlNext(e,sc))||'top of the ladder'}</small></div></div>`}
function rlTopList(n){const seen=new Map();WORKOUTS.forEach(w=>(w.ex||[]).forEach(x=>{const e=exOf(x);if(!seen.has(e.id))seen.set(e.id,e)}));
  return [...seen.values()].map(e=>[e,rlEx(e.id)]).filter(a=>a[1]!=null).sort((a,b)=>b[1]-a[1]).slice(0,n)}

/* overall rank = average of your 5 best-ranked lifts, at most 2 of them isolation lifts (needs at least one ranked lift) */
function rlOverall(){const L=rlTopList(99),pick=[];let iso=0;for(const x of L){const c=rlComp(x[0]);if(!c&&iso>=2)continue;if(!c)iso++;pick.push(x);if(pick.length===5)break}return pick.length?pick.reduce((a,x)=>a+x[1],0)/pick.length:null}
function rlWindow(){const ov=rlOverall();if(ov==null)return `<div class="rlwin empty"><span class="dim">Log a lift like bench, squat or deadlift and your rank shows up here.</span></div>`;
  const r=rlOf(ov),last=WORKOUTS[0]?rlSession(WORKOUTS[0]):null,top=rlTopList(3);
  return `<button type="button" class="rlwin" data-rl="open" style="--rc:${RL[r.t][1]}">
    <span class="rlwtop">${rlBadge(ov,56)}<span class="rlwho"><small>Overall rank</small><b>${r.name}</b>${r.t<7?`<div class="rpgbar"><i style="width:${r.frac*100}%"></i></div><small class="dim">${Math.round(r.frac*100)}% to ${rlOf(r.i+1).name}</small>`:''}</span></span>
    <span class="rlwrow">${last!=null?`<span><small>Last session</small>${rlChip(last,18)}</span>`:''}${top.map(([e,sc])=>`<span><small>${esc(e.n.replace(/\s*\(.*\)|\s*-.*$/,''))}</small>${rlChip(sc,18)}</span>`).join('')}</span>
  </button>`}
function rlOpen(){const ov=rlOverall();const r=rlOf(ov||0);const L=rlTopList(40);const S=WORKOUTS.slice(0,12).map(w=>[w,rlSession(w)]);
  openSheet('ranks',`<div class="rlfull" style="--rc:${RL[r.t][1]}">
    ${ov!=null?`<div class="rlsum">${rlBadge(ov,72)}<div><span class="dim">Overall · avg of your top 5 lifts</span><b>${r.name}</b></div></div>`:''}
    <div class="rpgsec">Lifts</div><div class="rlexl">${L.map(([e,sc])=>`<button type="button" data-rlex="${esc(e.id)}">${rlBadge(sc,24)}<span>${esc(e.n)}</span><b style="color:${RL[rlOf(sc).t][1]}">${rlOf(sc).name}</b></button>`).join('')||'<span class="dim">No ranked lifts yet.</span>'}</div>
    ${S.length?`<div class="rpgsec">Recent sessions</div><div class="rlexl">${S.map(([w,sc])=>`<button type="button" data-rlw="${esc(w.id)}">${rlBadge(sc,24)}<span>${esc(w.name)} <small class="dim">${esc(nice(w.date).toLowerCase())}</small></span><b style="color:${RL[rlOf(sc).t][1]}">${rlOf(sc).name}</b></button>`).join('')}</div>`:''}
    <div class="rpgsec">Ladder</div><div class="rlladder">${RL.map((t,i)=>`<span style="--rc:${t[1]}">${rlBadge(i*3+(i<7?2:0),30)}<small>${t[0]}</small></span>`).join('')}</div>
    ${ascSettings()}
    <div class="dim" style="font-size:11px;margin-top:8px">Lift ranks use your best set's estimated 1RM against your bodyweight (reps for bodyweight moves). Session rank = working sets, records, volume vs your last 10 sessions and set strength.</div>
  </div>`);
  ascBind();
  $('sheetBody').onclick=e=>{const x=e.target.closest('[data-rlex]');if(x){closeSheet();openExercise(x.dataset.rlex);return}const w=e.target.closest('[data-rlw]');if(w){const o=WORKOUTS.find(z=>z.id===w.dataset.rlw);closeSheet();if(o)showSummary(o)}}}
document.addEventListener('click',e=>{if(e.target.closest('[data-rl="open"]'))rlOpen()});
/* after saving: promotion screen if your overall rank went up a division, otherwise straight to the summary */
function rlAfter(pre,w,next){const post=rlOverall();
  if(post==null||(pre!=null&&Math.floor(post)<=Math.floor(pre))){next&&next();return}
  const a=pre==null?null:rlOf(pre),b=rlOf(post);const ov=document.createElement('div');ov.className='rlov';ov.style.setProperty('--rc',RL[b.t][1]);
  ov.innerHTML=`<div class="rllines"></div><div class="rlbox"><small>${a?'rank up':'placement complete'}</small>${rlBadge(post,150)}<b>${b.name}</b>${a?`<span class="dim">from ${a.name}</span>`:''}<button type="button" class="btn rlok">Continue</button></div>`;
  document.body.appendChild(ov);requestAnimationFrame(()=>ov.classList.add('on'));try{navigator.vibrate&&navigator.vibrate([30,60,30,60,150])}catch(e){}
  const done=()=>{ov.classList.remove('on');setTimeout(()=>ov.remove(),300);next&&next()};ov.querySelector('.rlok').onclick=done}
