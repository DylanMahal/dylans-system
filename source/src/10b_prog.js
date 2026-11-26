/* ================= BODY PROGRESS: weight trend, measurements, monthly photos =================
   Shared by Food › Progress (group "body") and the Looks page (group "looks").
   body/meas   = {list:[{id,n,u,g}], r:[{d,g,v:{id:value}}]}
   body/photos = {r:[{g,m:'YYYY-MM',pose,f,at}]}   f = file in vault:<uid>/prog/ (private) */
let MEAS=null,PHOT=null,progLoaded=false,WTR=+LS.get('wtr')||90;
const MEAS_DEF=[['waist','Waist'],['chest','Chest'],['arm','Arms'],['thigh','Thighs'],['hips','Hips'],['neck','Neck']];
const POSES={body:[['front','Front'],['side','Side'],['back','Back']],looks:[['front','Front'],['side','Side']]};
async function progLoad(){if(progLoaded)return;const [m,p]=await Promise.all([load('body/meas').catch(()=>null),load('body/photos').catch(()=>null)]);
  MEAS={list:MEAS_DEF.map(([id,n])=>({id,n,u:'cm',g:'body'})),r:[],...(m||{})};PHOT={r:[],...(p||{})};progLoaded=true}
watch('body/meas',d=>{if(d&&MEAS)MEAS={...MEAS,...d}});watch('body/photos',d=>{if(d)PHOT={r:[],...d}});
const pgDays=(a,b)=>Math.round((new Date(b+'T12:00')-new Date(a+'T12:00'))/864e5);

/* ---------- weight: daily average, 7-day moving average, trend, weekly rate ---------- */
function wtDaily(){const by={};((typeof WT!=='undefined'&&WT.r)||[]).forEach(x=>{if(!(+x.kg>0))return;const d=ymd(new Date(x.t));(by[d]=by[d]||[]).push(+x.kg)});
  return Object.keys(by).sort().map(d=>({d,kg:avg(by[d])}))}
function wtMA(){const D=wtDaily();return D.map(x=>{const lo=addDays(x.d,-6);const w=D.filter(y=>y.d>=lo&&y.d<=x.d);return {d:x.d,kg:x.kg,ma:avg(w.map(y=>y.kg))}})}
function wtRate(ma){ma=ma||wtMA();if(ma.length<2)return null;const last=ma[ma.length-1];
  const ref=[...ma].reverse().find(x=>x.d<=addDays(last.d,-14))||[...ma].reverse().find(x=>x.d<=addDays(last.d,-7));if(!ref)return null;
  const n=pgDays(ref.d,last.d);if(n<5)return null;const kg=(last.ma-ref.ma)/n*7;return {kg,pct:kg/last.ma*100,days:n}}
function wtChart(ma,days,goal){const cut=addDays(DAYK,-days);const P=ma.filter(x=>x.d>=cut);if(P.length<2)return '<div class="dim" style="font-size:12px;padding:16px 0">Log a few weigh-ins to see the trend.</div>';
  const W=560,H=170,pl=30,pr=8,pt=10,pb=18,t0=+new Date(P[0].d+'T12:00'),t1=+new Date(P[P.length-1].d+'T12:00'),tx=d=>+new Date(d+'T12:00');
  const all=P.flatMap(x=>[x.kg,x.ma]).concat(goal&&Math.abs(goal-P[P.length-1].ma)<8?[goal]:[]);let lo=Math.min(...all),hi=Math.max(...all);if(hi-lo<2){hi+=1;lo-=1}const pd=(hi-lo)*.08;lo-=pd;hi+=pd;
  const X=t=>pl+(t-t0)/(t1-t0||1)*(W-pl-pr),Y=v=>pt+(1-(v-lo)/(hi-lo))*(H-pt-pb);
  const n=P.length,mx=P.reduce((a,p)=>a+tx(p.d),0)/n,my=P.reduce((a,p)=>a+p.ma,0)/n;let sxy=0,sxx=0;P.forEach(p=>{const dx=tx(p.d)-mx;sxy+=dx*(p.ma-my);sxx+=dx*dx});const k=sxx?sxy/sxx:0;
  let s=`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weight trend">`;
  [lo+pd,(lo+hi)/2,hi-pd].forEach(v=>{s+=`<line x1="${pl}" x2="${W-pr}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="rgba(255,255,255,.06)"/><text x="0" y="${(Y(v)+3).toFixed(1)}" font-size="9.5" fill="#7a7a7a">${v.toFixed(1)}</text>`});
  if(goal&&goal>lo&&goal<hi)s+=`<line x1="${pl}" x2="${W-pr}" y1="${Y(goal).toFixed(1)}" y2="${Y(goal).toFixed(1)}" stroke="#ffb000" stroke-dasharray="4 4" opacity=".7"/><text x="${W-pr}" y="${(Y(goal)-4).toFixed(1)}" text-anchor="end" font-size="9.5" fill="#ffb000">goal</text>`;
  s+=P.map(p=>`<circle cx="${X(tx(p.d)).toFixed(1)}" cy="${Y(p.kg).toFixed(1)}" r="2.2" fill="#fff" opacity=".35"/>`).join('');
  s+=`<line x1="${X(t0).toFixed(1)}" y1="${Y(my+k*(t0-mx)).toFixed(1)}" x2="${X(t1).toFixed(1)}" y2="${Y(my+k*(t1-mx)).toFixed(1)}" stroke="#05d9e8" stroke-width="1.4" stroke-dasharray="5 4" opacity=".8"/>`;
  s+=`<path d="M${P.map(p=>X(tx(p.d)).toFixed(1)+','+Y(p.ma).toFixed(1)).join(' L')}" fill="none" stroke="#ff2a6d" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`;
  s+=`<text x="${pl}" y="${H-3}" font-size="9.5" fill="#7a7a7a">${esc(nice(P[0].d))}</text><text x="${W-pr}" y="${H-3}" font-size="9.5" fill="#7a7a7a" text-anchor="end">${esc(nice(P[P.length-1].d))}</text>`;
  return s+'</svg><div class="dim" style="font-size:11px">dots = weigh-ins · pink = 7-day average · dashed = trend</div>'}
function wtPanel(goal){const ma=wtMA();const last=ma[ma.length-1];const r=wtRate(ma);const m30=ma.filter(x=>x.d<=addDays(DAYK,-30)).pop();
  const st=last?`<div class="pg-stats num"><div><b>${last.kg.toFixed(1)}</b><span>latest kg</span></div><div><b>${last.ma.toFixed(1)}</b><span>7-day avg</span></div>
    <div><b class="${r?(r.kg<=0?'ok':'pink'):''}">${r?(r.kg>0?'+':'')+r.kg.toFixed(2):'–'}</b><span>kg / week</span></div><div><b class="${r?(r.pct<=0?'ok':'pink'):''}">${r?(r.pct>0?'+':'')+r.pct.toFixed(2)+'%':'–'}</b><span>of bodyweight / wk</span></div>
    ${m30?`<div><b>${(last.ma-m30.ma>0?'+':'')+(last.ma-m30.ma).toFixed(1)}</b><span>kg in 30 days</span></div>`:''}</div>`:'';
  return st+`<div class="seg pg-rng" style="margin:10px 0">${[[30,'1M'],[90,'3M'],[182,'6M'],[365,'1Y']].map(([n,l])=>`<button type="button" data-wtr="${n}" aria-pressed="${WTR===n}">${l}</button>`).join('')}</div>${wtChart(ma,WTR,goal)}
    ${r?`<div class="dim" style="font-size:11.5px;margin-top:6px">${Math.abs(r.pct)>1?'Losing more than 1% of bodyweight a week usually costs muscle. ':''}Rate is the 7-day average over the last ${r.days} days.</div>`:''}`}
document.addEventListener('click',e=>{const b=e.target.closest('[data-wtr]');if(!b)return;WTR=+b.dataset.wtr;LS.set('wtr',WTR);if(cur==='food'&&typeof renderFood==='function')renderFood()});

/* ---------- measurements ---------- */
const measItems=g=>(MEAS&&MEAS.list||[]).filter(x=>(x.g||'body')===g&&!x.arch);
function measSeries(id){return (MEAS.r||[]).filter(r=>r.v&&r.v[id]!=null&&r.v[id]!=='').map(r=>({d:r.d,v:+r.v[id]})).sort((a,b)=>a.d<b.d?-1:1)}
function measSpark(pts){if(pts.length<2)return '';const W=90,H=26,vs=pts.map(p=>p.v),lo=Math.min(...vs),hi=Math.max(...vs)||1;
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true"><polyline points="${pts.map((p,i)=>`${(i/(pts.length-1)*(W-4)+2).toFixed(1)},${(H-3-(p.v-lo)/((hi-lo)||1)*(H-6)).toFixed(1)}`).join(' ')}" fill="none" stroke="#05d9e8" stroke-width="1.6"/></svg>`}
/* US Navy estimate: needs waist and neck (and hips for women) in cm, plus height from your food profile */
function bfEst(){if(!MEAS)return null;const P=(typeof FPROF!=='undefined'&&FPROF)||{};const h=+P.hcm;if(!h)return null;const L=id=>{const s=measSeries(id);return s.length?s[s.length-1].v:null};
  const w=L('waist'),n=L('neck'),hp=L('hips');if(!w||!n||w<=n)return null;
  const v=P.sex==='f'?(hp?495/(1.29579-.35004*Math.log10(w+hp-n)+.221*Math.log10(h))-450:null):495/(1.0324-.19077*Math.log10(w-n)+.15456*Math.log10(h))-450;
  return v&&v>2&&v<60?Math.round(v*10)/10:null}
function measPanel(g){const L=measItems(g);const bf=g==='body'?bfEst():null;
  const rows=L.map(x=>{const s=measSeries(x.id);const last=s[s.length-1],first=s[0],m30=s.filter(p=>p.d<=addDays(DAYK,-30)).pop();
    return `<div class="pg-mrow"><span><b>${esc(x.n)}</b><small>${last?esc(nice(last.d)):'not logged'}</small></span>${measSpark(s.slice(-12))}<span class="num"><b>${last?last.v+' '+esc(x.u||'cm'):'–'}</b><small>${m30&&last?(last.v-m30.v>0?'+':'')+(Math.round((last.v-m30.v)*10)/10)+' in 30d':first&&last&&first!==last?(last.v-first.v>0?'+':'')+(Math.round((last.v-first.v)*10)/10)+' total':''}</small></span></div>`}).join('');
  return `${bf!=null?`<div class="pg-bf"><b class="num">${bf}%</b><span>estimated body fat<small>US Navy method from waist, neck${(FPROF||{}).sex==='f'?', hips':''} and height. Rough, ±3–4%.</small></span></div>`:g==='body'?'<div class="dim" style="font-size:11.5px;margin-bottom:8px">Log waist and neck (and your height in Food › Goals) for a body fat estimate.</div>':''}
    <div class="pg-mlist">${rows||'<div class="dim" style="font-size:12.5px">No measurements yet.</div>'}</div><button type="button" class="btn p pg-mlog" data-mlog="${g}">Log measurements</button>`}
function measLog(g,after){const L=measItems(g);const today=(MEAS.r||[]).find(r=>r.d===DAYK&&(r.g||'body')===g)||{v:{}};
  openSheet('Measurements',`<div class="pg-mform">${L.map(x=>`<label class="fl">${esc(x.n)} <small class="dim">${esc(x.u||'cm')}</small><input class="inp num" data-mv="${esc(x.id)}" inputmode="decimal" value="${today.v[x.id]??''}"></label>`).join('')}
    <div class="row" style="gap:6px;margin-top:6px"><input class="inp" id="mNewN" placeholder="Add a measurement (name)" style="flex:1"><input class="inp" id="mNewU" placeholder="cm" style="width:64px"><button class="btn" type="button" id="mNewB">Add</button></div>
    <div class="bigbtns" style="margin-top:14px"><span style="flex:1"></span><button class="btn p" type="button" id="mSave">Save</button></div></div>`);
  $('mNewB').onclick=()=>{const n=$('mNewN').value.trim();if(!n)return;MEAS.list.push({id:'m'+rid(),n,u:$('mNewU').value.trim()||'cm',g});save('body/meas',MEAS);measLog(g,after)};
  $('mSave').onclick=()=>{const v={};document.querySelectorAll('[data-mv]').forEach(i=>{const x=parseFloat(String(i.value).replace(',','.'));if(x>0)v[i.dataset.mv]=x});
    MEAS.r=(MEAS.r||[]).filter(r=>!(r.d===DAYK&&(r.g||'body')===g));if(Object.keys(v).length)MEAS.r.push({d:DAYK,g,v});save('body/meas',MEAS);closeSheet();after&&after()}}

/* ---------- monthly photos, side by side ---------- */
const PGSEL={};
function photoMonths(g){return [...new Set((PHOT.r||[]).filter(x=>x.g===g).map(x=>x.m))].sort()}
function photoPanel(g){const ms=photoMonths(g),poses=POSES[g]||POSES.body;const cm=DAYK.slice(0,7);
  const sel=PGSEL[g]||{};const A=ms.includes(sel.a)?sel.a:ms[0],B=ms.includes(sel.b)?sel.b:ms[ms.length-1];
  const pic=(m,p)=>{const x=(PHOT.r||[]).filter(y=>y.g===g&&y.m===m&&y.pose===p).pop();return x?`<img data-vp="${esc(x.f)}" alt="${esc(p)} ${esc(m)}">`:'<span class="dim">—</span>'};
  const ml=m=>new Date(m+'-15T12:00').toLocaleDateString('en-GB',{month:'short',year:'numeric'});
  const has=poses.filter(([p])=>(PHOT.r||[]).some(y=>y.g===g&&y.m===cm&&y.pose===p)).length;
  return `<div class="pg-ph-top"><span class="dim">${ms.length} month${ms.length===1?'':'s'} · this month ${has}/${poses.length}</span><button type="button" class="btn p" data-padd="${g}">${has?'Update':'Add'} this month</button></div>
    ${ms.length>1?`<div class="row pg-sel" style="gap:6px;margin:8px 0"><select class="inp" data-psa="${g}">${ms.map(m=>`<option value="${m}"${m===A?' selected':''}>${ml(m)}</option>`).join('')}</select><span class="dim">vs</span><select class="inp" data-psb="${g}">${ms.map(m=>`<option value="${m}"${m===B?' selected':''}>${ml(m)}</option>`).join('')}</select></div>`:''}
    ${ms.length?`<div class="pg-cmp">${poses.map(([p,l])=>`<div class="pg-pair"><div class="pg-pl">${l}</div><div class="pg-two"><figure>${pic(A,p)}<figcaption>${ml(A)}</figcaption></figure>${A!==B?`<figure>${pic(B,p)}<figcaption>${ml(B)}</figcaption></figure>`:''}</div></div>`).join('')}</div>`:'<div class="dim" style="font-size:12.5px;margin-top:8px">Private: photos go only to your own vault. Same light, same spot, once a month.</div>'}`}
async function progFillImgs(root){const im=[...(root||document).querySelectorAll('img[data-vp]:not([src])')];if(!im.length||typeof aSign!=='function')return;
  const urls=await aSign(im.map(i=>i.dataset.vp));im.forEach((i,k)=>{if(urls[k])i.src=urls[k]})}
async function photoShrink(f,max=1400){const img=new Image();img.src=URL.createObjectURL(f);await img.decode();const k=Math.min(1,max/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);
  c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(img.src);return await new Promise(r=>c.toBlob(r,'image/jpeg',.86))}
function photoAdd(g,after){const poses=POSES[g]||POSES.body;const m=DAYK.slice(0,7);
  openSheet('This month',`<div class="pg-padd">${poses.map(([p,l])=>{const x=(PHOT.r||[]).filter(y=>y.g===g&&y.m===m&&y.pose===p).pop();return `<button type="button" class="pg-pb" data-pp="${p}">${x?`<img data-vp="${esc(x.f)}" alt="">`:'<i>＋</i>'}<span>${l}</span></button>`}).join('')}</div><div class="dim" id="pgSt" style="font-size:12px;margin-top:10px">Tap a pose to take or pick a photo.</div>`);
  progFillImgs($('sheetBody'));
  $('sheetBody').onclick=e=>{const b=e.target.closest('[data-pp]');if(!b)return;const i=document.createElement('input');i.type='file';i.accept='image/*';
    i.onchange=async()=>{const f=i.files&&i.files[0];if(!f||!SB||!UID)return;$('pgSt').textContent='uploading…';
      try{const blob=await photoShrink(f);const path=`${UID}/prog/${g}/${m}-${b.dataset.pp}-${rid()}.jpg`;const {error}=await SB.storage.from('vault').upload(path,blob,{upsert:true,contentType:'image/jpeg'});if(error)throw error;
        const old=(PHOT.r||[]).filter(y=>y.g===g&&y.m===m&&y.pose===b.dataset.pp);if(old.length){try{await SB.storage.from('vault').remove(old.map(o=>o.f))}catch(_){}if(typeof mediaForget==='function')mediaForget(old.map(o=>o.f))}
        PHOT.r=(PHOT.r||[]).filter(y=>!(y.g===g&&y.m===m&&y.pose===b.dataset.pp)).concat({g,m,pose:b.dataset.pp,f:path,at:new Date().toISOString()});save('body/photos',PHOT,true);photoAdd(g,after);after&&after()}
      catch(er){$('pgSt').textContent='upload failed, try again'}};i.click()}}
/* one click/change handler for every progress panel on the page */
function progBind(root,redraw){root._pgr=redraw;progFillImgs(root);if(root._pg)return;root._pg=1;const R=()=>root._pgr&&root._pgr();
  root.addEventListener('click',e=>{const a=e.target.closest('[data-mlog]'),p=e.target.closest('[data-padd]');if(a)measLog(a.dataset.mlog,R);if(p)photoAdd(p.dataset.padd,R)});
  root.addEventListener('change',e=>{const t=e.target;if(t.dataset.psa){(PGSEL[t.dataset.psa]=PGSEL[t.dataset.psa]||{}).a=t.value;R()}if(t.dataset.psb){(PGSEL[t.dataset.psb]=PGSEL[t.dataset.psb]||{}).b=t.value;R()}})}
