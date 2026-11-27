/* ================= SHARED for the newer sections: drawing helpers, the error badge, data export =================
   Goals, Career, Mood, Meds, People and System all build on these. Classes are nx-* (safelisted in build.py). */
const NXC={pink:'#ff2a6d',cyan:'#05d9e8',green:'#30d158',red:'#ff453a',yellow:'#ffd60a',orange:'#ff9f0a',purple:'#bf5af2',lime:'#a3e635',grey:'#8e8e93'};
const NX_MOODC={1:'#ff453a',2:'#ff9f0a',3:'#ffd60a',4:'#a3e635',5:'#30d158'};
let nxGid=0;
const nxR1=v=>Math.round(v*10)/10;
const nxSign=(v,d=1)=>(v>0?'+':v<0?'−':'')+Math.abs(v).toFixed(d);
const nxAvg=a=>{a=a.filter(v=>v!=null&&isFinite(v));return a.length?a.reduce((x,y)=>x+y,0)/a.length:null};
const nxDays=(a,b)=>Math.round((new Date(b+'T12:00')-new Date(a+'T12:00'))/864e5);
const nxDate=s=>new Date(s+'T12:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'});
const nxClock=iso=>{const d=new Date(iso);return pad(d.getHours())+':'+pad(d.getMinutes())};

function nxRing(p,size=64,sw=7,col=NXC.pink,inner=''){
  const r=(size-sw)/2,c=2*Math.PI*r;p=Math.max(0,Math.min(1,+p||0));
  return `<div class="nx-ring" style="width:${size}px;height:${size}px"><svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true"><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="${sw}"/><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${(c*p).toFixed(1)} ${c.toFixed(1)}"/></svg><div>${inner}</div></div>`}

function nxSpark(vals,{w=150,h=36,col=NXC.pink,fill=true,lo,hi,sw=2,dot=true}={}){
  vals=(vals||[]).filter(v=>v!=null&&isFinite(v));if(vals.length<2)return `<div style="height:${h}px"></div>`;
  lo=lo??Math.min(...vals);hi=hi??Math.max(...vals);if(hi-lo<1e-9){hi+=1;lo-=1}
  const X=i=>2+i*(w-4)/(vals.length-1),Y=v=>h-3-(v-lo)/(hi-lo)*(h-6);
  const d='M'+vals.map((v,i)=>X(i).toFixed(1)+','+Y(v).toFixed(1)).join(' L');const g='nxg'+(++nxGid);
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none" style="display:block;overflow:visible" aria-hidden="true">${fill?`<defs><linearGradient id="${g}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".28"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs><path d="${d} L${X(vals.length-1).toFixed(1)},${h} L2,${h} Z" fill="url(#${g})"/>`:''}<path d="${d}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>${dot?`<circle cx="${X(vals.length-1).toFixed(1)}" cy="${Y(vals[vals.length-1]).toFixed(1)}" r="3.2" fill="${col}" stroke="#0b0b0b" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`:''}</svg>`}

function nxFaceSvg(l,size=30){const col=NX_MOODC[l],c={1:-7,2:-3.5,3:0,4:4,5:7}[l];
  return `<svg viewBox="0 0 34 34" width="${size}" height="${size}" aria-hidden="true"><circle cx="17" cy="17" r="15" fill="none" stroke="${col}" stroke-width="2.2"/><circle cx="12" cy="14" r="1.9" fill="${col}"/><circle cx="22" cy="14" r="1.9" fill="${col}"/><path d="M10.5 ${(22-c/2).toFixed(1)} Q17 ${(22+c).toFixed(1)} 23.5 ${(22-c/2).toFixed(1)}" fill="none" stroke="${col}" stroke-width="2.2" stroke-linecap="round"/></svg>`}
const NX_MOODL={1:'awful',2:'low',3:'okay',4:'good',5:'great'};
function nxFaces(sel,attr='data-mood',size=30){return `<div class="nx-faces">${[1,2,3,4,5].map(l=>`<button type="button" class="nx-face" ${attr}="${l}" aria-pressed="${+sel===l}" aria-label="${NX_MOODL[l]}" style="--fc:${NX_MOODC[l]}">${nxFaceSvg(l,size)}</button>`).join('')}</div>`}
/* every rating is 1 to 10 in 0.1 steps; old 1-5 values are doubled on read */
function nxSlide(v,attr,extra=''){const on=v!=null&&isFinite(v);return `<div class="nx-sl${on?'':' unset'}"><input type="range" min="1" max="10" step="0.1" value="${on?(+v).toFixed(1):'5.5'}" ${attr} ${extra} aria-label="1 to 10"><b class="num">${on?(+v).toFixed(1):'–'}</b></div>`}
document.addEventListener('input',e=>{const t=e.target;if(t.type!=='range'||!t.closest('.nx-sl'))return;const w=t.closest('.nx-sl');w.classList.remove('unset');w.querySelector('b').textContent=(+t.value).toFixed(1)});
const r10=v=>Math.round(+v*10)/10;
function nxScale(sel,attr){return `<div class="nx-scale">${[1,2,3,4,5].map(n=>`<button type="button" ${attr}="${n}" aria-pressed="${+sel===n}">${n}</button>`).join('')}</div>`}

/* goal trajectory: actual points (x = days from start) against a dashed straight line to the target */
function nxTraj(pts,{start,target,total,unit='',col=NXC.pink,w=358,h=176,dots,labels=[]}){
  const pl=4,pr=42,pt=12,pb=22,W=w-pl-pr,H=h-pt-pb;
  const all=pts.map(p=>p[1]).concat([start,target]).concat((dots||[]).map(p=>p[1]));
  let lo=Math.min(...all),hi=Math.max(...all);const pad0=(hi-lo)*.12||1;lo-=pad0;hi+=pad0;
  const X=d=>pl+Math.max(0,Math.min(1,d/total))*W,Y=v=>pt+H-(v-lo)/(hi-lo)*H;
  let s=`<svg viewBox="0 0 ${w} ${h}" width="100%" style="display:block" role="img" aria-label="progress against plan">`;
  for(let k=0;k<=4;k++){const v=lo+(hi-lo)*k/4,y=Y(v);s+=`<line x1="${pl}" x2="${pl+W}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,.06)"/><text x="${pl+W+6}" y="${(y+3.5).toFixed(1)}" font-size="10" fill="#6e6e73">${Math.abs(hi-lo)<20?v.toFixed(1):Math.round(v)}</text>`}
  labels.forEach(([d,l],i)=>{s+=`<text x="${X(d).toFixed(1)}" y="${h-5}" font-size="10" fill="#6e6e73" text-anchor="${i===0?'start':'middle'}">${esc(l)}</text>`});
  s+=`<line x1="${X(0)}" y1="${Y(start).toFixed(1)}" x2="${X(total)}" y2="${Y(target).toFixed(1)}" stroke="rgba(255,255,255,.35)" stroke-width="1.5" stroke-dasharray="4 4"/><circle cx="${X(total)}" cy="${Y(target).toFixed(1)}" r="5" fill="none" stroke="#fff" stroke-width="1.8"/>`;
  (dots||[]).forEach(p=>{s+=`<circle cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="1.6" fill="${col}" opacity=".3"/>`});
  if(pts.length){const g='nxg'+(++nxGid),d='M'+pts.map(p=>X(p[0]).toFixed(1)+','+Y(p[1]).toFixed(1)).join(' L'),lx=X(pts[pts.length-1][0]),ly=Y(pts[pts.length-1][1]);
    s+=`<defs><linearGradient id="${g}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".22"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>`;
    if(pts.length>1)s+=`<path d="${d} L${lx.toFixed(1)},${pt+H} L${X(pts[0][0]).toFixed(1)},${pt+H} Z" fill="url(#${g})"/><path d="${d}" fill="none" stroke="${col}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`;
    s+=`<line x1="${lx.toFixed(1)}" x2="${lx.toFixed(1)}" y1="${pt}" y2="${pt+H}" stroke="rgba(255,255,255,.18)"/><circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="4.5" fill="${col}" stroke="#0b0b0b" stroke-width="2"/><text x="${lx.toFixed(1)}" y="${pt-2}" font-size="9.5" fill="#8e8e93" text-anchor="middle">today</text>`}
  return s+'</svg>'}

/* ---------- error badge: failures used to vanish silently; now they show for a few seconds and are kept in diag/errors ---------- */
let NXERR=LS.get('diag/errs')||[],nxBadgeT=null;
function nxErr(e,where){try{
  const m=((where?where+': ':'')+String(e&&(e.message||e.code)||e||'error')).replace(/\s+/g,' ').slice(0,180);
  console.warn('[nx]',m,e);NXERR.unshift({t:new Date().toISOString(),m,v:window.APP_V||''});NXERR=NXERR.slice(0,40);LS.set('diag/errs',NXERR);
  if(typeof R!=='undefined'&&R)save('diag/errors',{list:NXERR});
  let b=$('nxBadge');if(!b){b=document.createElement('div');b.id='nxBadge';b.className='nx-badge';b.setAttribute('role','status');b.innerHTML='<b>!</b><span></span><button type="button">Dismiss</button>';document.body.appendChild(b);b.querySelector('button').onclick=()=>{b.hidden=true}}
  b.querySelector('span').textContent='Something failed · '+m;b.hidden=false;clearTimeout(nxBadgeT);nxBadgeT=setTimeout(()=>{b.hidden=true},9000);if(typeof errBadge==='function')errBadge();
}catch(_){}}
window.nxErr=nxErr;

/* ---------- export: every document you own, as one JSON file (share sheet on iPhone/iPad, download elsewhere) ---------- */
async function nxExport(btn){
  if(typeof R==='undefined'||!R){nxErr('sign in first','export');return}
  if(btn){btn.disabled=true;btn.textContent='Preparing…'}
  try{const rows=await KV.list('');const name='dylans-system-backup-'+DAYK+'.json';
    const blob=new Blob([JSON.stringify({app:'dylans-system',at:new Date().toISOString(),count:rows.length,rows})],{type:'application/json'});
    LS.set('nx/lastExport',{at:new Date().toISOString(),n:rows.length});
    let file=null;try{file=new File([blob],name,{type:'application/json'})}catch(_){}
    if(file&&navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:name})}catch(e){if(!e||e.name!=='AbortError')throw e}}
    else{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},5000)}
  }catch(e){nxErr(e,'export')}
  finally{if(btn){btn.disabled=false;btn.textContent='Export all data'}}}

/* extra search-menu commands from the newer sections (17_palette reads this) */
const NX_CMDS=[];
function nxCmd(l,s,run){NX_CMDS.push({l,s,run})}
nxCmd('export all data','backup',()=>nxExport());

/* ---------- sub-pages: #stack/meds style links, and the Stack seg (Stack · Protocols · Meds) ---------- */
const NX_SUB=window.NX_SUB={};
let STACKV=LS.get('stackv')||'stack';
function setStackV(v){if(!['stack','protocols','meds'].includes(v))v='stack';STACKV=v;LS.set('stackv',v);
  document.querySelectorAll('#stackSeg [data-sv]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.sv===v));
  $('stackPaneS').hidden=v!=='stack';$('t-protocols').hidden=v!=='protocols';$('stackPaneM').hidden=v!=='meds';
  try{if(v==='protocols'&&typeof renderProto==='function')renderProto();if(v==='meds'){MEDV='home';renderMeds().catch(e=>nxErr(e,'meds'))}}catch(e){nxErr(e,'stack')}}
NX_SUB.stack=setStackV;window.setStackV=setStackV;
document.addEventListener('click',e=>{const b=e.target.closest('#stackSeg [data-sv]');if(b){setStackV(b.dataset.sv);if(typeof staggerIn==='function')staggerIn(b.dataset.sv==='stack'?$('stackPaneS'):b.dataset.sv==='protocols'?$('t-protocols'):$('stackPaneM'))}});
NX_SUB.journal=t=>{if(typeof setJTab==='function')setJTab(t)};
