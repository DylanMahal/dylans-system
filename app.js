(function(){
"use strict";
/* ================= SHEET PARSER (raw Excel cells → model) ================= */
const p2=n=>String(n).padStart(2,'0');
const gc=(g,r,c)=>{const row=g&&g[r-1];if(!row)return null;const v=row[c-1];return v===undefined?null:v};
const ttl=s=>String(s).toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
const nn=v=>typeof v==='number'&&isFinite(v)?v:0;
function tv(v){if(typeof v==='number'&&v>=0&&v<1){const m=Math.round(v*1440);return p2(Math.floor(m/60)%24)+':'+p2(m%60)}return v===undefined?null:v}
function rowHas(g,r,x){const row=g[r-1]||[];return row.some(v=>v===x)}
function parseGrids(G){
  const out={stack:[],expenses:[],income:{},incRows:{},stackCatRows:{},expCatRows:{}};
  // Stack
  const S=G['Stack']||[];let cat=null;
  for(let r=5;r<=S.length;r++){const a=gc(S,r,1);
    if(a==='BUDGETED TOTAL'){out.stackTotalRow=r;continue}
    if(a==='Not in budget (optional)')continue;if(a==='If you bought everything')break;
    if(a&&rowHas(S,r,'Budgeted:')){cat=ttl(a);out.stackCatRows[cat]=r;continue}
    if(a===null||a===''||a===LX('hdr','#'))continue;
    out.stack.push({row:r,name:String(a).trim(),dose:gc(S,r,2),route:gc(S,r,3),sched:gc(S,r,4),notes:gc(S,r,7),price:gc(S,r,8),units:gc(S,r,9),perweek:gc(S,r,10),weekly:nn(gc(S,r,11)),monthly:nn(gc(S,r,12)),inb:gc(S,r,13)==='Yes',src:gc(S,r,14),cat});
  }
  // Expenses
  const E=G['Expenses']||[];cat=null;
  for(let r=5;r<=E.length;r++){const a=gc(E,r,1);
    if(a==='BUDGETED TOTAL'){out.expTotalRow=r;continue}
    if(a==='Not in budget (optional)')continue;if(a==='If you paid for everything')break;
    if(a&&rowHas(E,r,'Budgeted:')){cat=ttl(a);out.expCatRows[cat]=r;continue}
    if(a===null||a===''||a==='Expense')continue;
    const per=gc(E,r,7);
    out.expenses.push({row:r,name:String(a).trim(),prov:gc(E,r,2),freq:gc(E,r,3),day:gc(E,r,4),method:gc(E,r,5),notes:gc(E,r,6),per:typeof per==='number'?per:null,m:nn(gc(E,r,8)),y:nn(gc(E,r,9)),inb:gc(E,r,10)==='Yes',cat});
  }
  // Expenses Summary inputs
  const X=G['Expenses Summary']||[];
  for(let r=1;r<=X.length;r++){const a=gc(X,r,1);
    if(a==='Hours worked per month'){out.income['Hours worked per month']=gc(X,r,2);out.incRows.hours=r}
    if(a==='Take-home pay'){out.income['Take-home pay']=gc(X,r,2);out.incRows.take=r}}
  // Day plans
  const plan=g=>{const blocks=[],extra={},extraRows={};let sec=null;g=g||[];
    for(let r=4;r<=g.length;r++){const c=[];for(let k=1;k<=8;k++)c.push(tv(gc(g,r,k)));const c9=gc(g,r,9);
      if(c.every(x=>x===null||x==='')&&(c9===null||c9===''))continue;
      const restEmpty=c.slice(1).every(x=>x===null||x==='');
      if(c[0]!==null&&c[0]!==''&&restEmpty){const s=String(c[0]);
        if(s.includes('·')&&/^\d\d/.test(s)){blocks.push({title:s,row:r,items:[]});sec=null;continue}
        sec=s;extra[sec]=[];extraRows[sec]=r;continue}
      if(sec){extra[sec].push({row:r,cells:c});continue}
      if(!blocks.length)continue;
      blocks[blocks.length-1].items.push({row:r,time:c[0],item:c[1],type:c[2],dose:c[3],route:c[4],sched:c[5],notes:c[6],caution:c[7]});
    }
    return {blocks,extra,extraRows}};
  out.weekday=plan(G['Day Plan v2']);out.weekend=plan(G['Weekend Plan']);
  const t1=(G['Day Plan v2']||[])[0],t2=(G['Weekend Plan']||[])[0];
  out.weekdayTitle=(t1&&t1[0])||'Day Plan v2';out.weekendTitle=(t2&&t2[0])||'Weekend Plan';
  return out;
}
let GR={};let GMETA={at:null,mtime:null,src:'none'};
let D=parseGrids(GR);

const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const gbp=(n,d=0)=>(n<0?'−':'')+'£'+Math.abs(Number(n)||0).toLocaleString('en-GB',{minimumFractionDigits:d,maximumFractionDigits:d});
/* USD → GBP: amounts can be typed in dollars anywhere a £ is asked for; the app only ever stores and shows £.
   rate is fetched at most every 12h and cached; falls back to the last known (or a sane default) offline. */
const FXR={r:(()=>{try{return JSON.parse(localStorage.getItem('fx:usdgbp')||'{}').r||0.78}catch(e){return 0.78}})(),
  async get(){let c={};try{c=JSON.parse(localStorage.getItem('fx:usdgbp')||'{}')}catch(e){}if(c.r&&Date.now()-c.t<432e5)return FXR.r=c.r;
    try{const j=await (await fetch('https://open.er-api.com/v6/latest/USD')).json();const r=j&&j.rates&&+j.rates.GBP;if(r>0.3&&r<2){FXR.r=r;try{localStorage.setItem('fx:usdgbp',JSON.stringify({r,t:Date.now()}))}catch(e){}}}catch(e){}return FXR.r}};
const usd2gbp=n=>Math.round(n*FXR.r*100)/100;
/* "$12.50" / "12.5$" / "12 usd" → £ number; anything else → null */
const parseUsd=s=>{const m=/^\s*(?:\$|us\$|usd)\s*([\d.,]+)\s*$|^\s*([\d.,]+)\s*(?:\$|usd)\s*$/i.exec(String(s||''));if(!m)return null;const n=+(m[1]||m[2]).replace(/,/g,'');return isFinite(n)?usd2gbp(n):null};
setTimeout(()=>FXR.get(),3000);
const norm=s=>String(s||'').trim().toLowerCase();
const LS={get(k){try{return JSON.parse(localStorage.getItem('ds3:'+k))}catch(e){return null}},set(k,v){try{localStorage.setItem('ds3:'+k,JSON.stringify(v))}catch(e){}}};
/* private word list: personal labels live in the account (kv sys/lex), never in this public code.
   LX(key,fallback) for values, LW(key,fallback) for UI words; [data-lx] elements are filled at boot. */
let LEX=LS.get('sys/lex')||{};
const LX=(k,d)=>LEX[k]!=null?LEX[k]:d,LW=(k,d)=>(LEX.w&&LEX.w[k])||d;
function applyLex(root){(root||document).querySelectorAll('[data-lx]').forEach(el=>{const v=LW(el.dataset.lx,null);if(v==null)return;if(el.dataset.lxa)el.setAttribute(el.dataset.lxa,v);else el.textContent=v})}
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const rid=()=>Math.random().toString(36).slice(2,8);
const isNum=v=>typeof v==='number'&&isFinite(v);


/* ================= FX ================= */
let FX=LS.get('fx'); if(FX===null) FX=!reduced;
function applyFx(){document.body.classList.toggle('fx',FX);document.body.classList.toggle('nofx',!FX);$('fxBtn').setAttribute('aria-pressed',FX)}
applyFx();
$('fxBtn').onclick=()=>{FX=!FX;LS.set('fx',FX);applyFx();if(FX)glitchAll()};
const noise=$('noise'),nctx=noise.getContext('2d');const nimg=nctx.createImageData(160,90);
/* noise: 6 frames made once and cycled, instead of 14k random pixels every tick */
const NFR=[];for(let f=0;f<6;f++){const im=nctx.createImageData(160,90),d=im.data;for(let i=0;i<d.length;i+=4){const v=Math.random()*255|0;d[i]=d[i+1]=d[i+2]=v;d[i+3]=255}NFR.push(im)}
let nfi=0;setInterval(()=>{if(!FX||document.hidden)return;nctx.putImageData(NFR[nfi=(nfi+1)%NFR.length],0,0)},130);
const pc=$('parts'),px=pc.getContext('2d');let parts=[],praf=0;
function sizeP(){pc.width=innerWidth*devicePixelRatio;pc.height=innerHeight*devicePixelRatio}
sizeP();addEventListener('resize',sizeP);
function burst(x,y,n=34,big=false){if(!FX)return;for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=(big?6:3.2)*(0.4+Math.random());parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,life:1,c:Math.random()<.55?'#ff2a6d':(Math.random()<.5?'#05d9e8':'#e6e6e6'),sz:(big?5:3)+Math.random()*3})}if(!praf)praf=requestAnimationFrame(stepP)}
function burstEl(el,n,big){const r=el.getBoundingClientRect();burst(r.left+r.width/2,r.top+r.height/2,n,big)}
function stepP(){const r=devicePixelRatio;px.clearRect(0,0,pc.width,pc.height);parts=parts.filter(p=>p.life>0);for(const p of parts){p.x+=p.vx;p.y+=p.vy;p.vy+=.18;p.vx*=.98;p.life-=.022;px.globalAlpha=Math.max(p.life,0);px.fillStyle=p.c;px.fillRect(Math.round(p.x*r),Math.round(p.y*r),p.sz*r,p.sz*r)}praf=parts.length?requestAnimationFrame(stepP):0}
function glitchAll(){if(!FX)return;const m=$('main');m.classList.remove('glitchall');void m.offsetWidth;m.classList.add('glitchall')}
function shake(){if(!FX)return;document.body.classList.remove('shake');void document.body.offsetWidth;document.body.classList.add('shake')}
function flash(t){return; /* no pop-ups: everything happens quietly in the background */
  if(!FX)return;$('flashTxt').textContent=t;const f=$('flash');f.classList.remove('on');void f.offsetWidth;f.classList.add('on')}
/* domPatch(el,html): update a container in place instead of replacing it, so focus, the keyboard,
   scroll, images and running animations survive a re-render (no flicker, no reloaded thumbs) */
function domPatch(el,html){const t=document.createElement(el.tagName==='TBODY'?'tbody':'div');t.innerHTML=html;morphKids(el,t)}
function morphKids(a,b){const ak=[...a.childNodes],bk=[...b.childNodes];
  for(let i=0;i<bk.length;i++){const x=ak[i],y=bk[i];if(!x){a.appendChild(y);continue}
    if(x.nodeType!==y.nodeType||x.nodeName!==y.nodeName||(x.id||'')!==(y.id||'')){a.replaceChild(y,x);continue}
    if(x.nodeType===3||x.nodeType===8){if(x.nodeValue!==y.nodeValue)x.nodeValue=y.nodeValue;continue}
    morphEl(x,y)}
  for(let i=ak.length-1;i>=bk.length;i--)ak[i].remove()}
function morphEl(x,y){for(const at of [...x.attributes])if(!y.hasAttribute(at.name))x.removeAttribute(at.name);
  for(const at of [...y.attributes])if(x.getAttribute(at.name)!==at.value)x.setAttribute(at.name,at.value);
  const tag=x.nodeName;
  if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'){if(tag==='TEXTAREA')x.defaultValue=y.value;if(document.activeElement!==x&&x.value!==y.value)x.value=y.value;if(x.checked!==y.checked)x.checked=y.checked;if(tag!=='SELECT')return}
  morphKids(x,y)}
const SCR='!<>-_\\/[]{}—=+*^?#01ABCDEF';
function scramble(el,final,dur=520){final=String(final);if(!FX){el.textContent=final;return}const t0=performance.now();(function f(t){const p=Math.min((t-t0)/dur,1);let s='';for(let i=0;i<final.length;i++){s+=(i/final.length<p||final[i]===' ')?final[i]:SCR[Math.random()*SCR.length|0]}el.textContent=s;if(p<1)requestAnimationFrame(f)})(t0)}
const cx=$('curx'),cxy=$('curxy');
addEventListener('pointermove',e=>{if(e.pointerType!=='mouse')return;cx.style.left=e.clientX+'px';cx.style.top=e.clientY+'px';cxy.style.left=e.clientX+'px';cxy.style.top=e.clientY+'px';cxy.textContent=String(Math.round(e.clientX)).padStart(4,'0')+':'+String(Math.round(e.clientY)).padStart(4,'0');cx.classList.toggle('big',!!e.target.closest('button,a,input,select,textarea,.it,.tr,.cat'))});

/* iOS WebKit sometimes leaves the page unpainted (only the banner/backdrop showing) after resuming the app or a
   page switch, until you scroll. Nudge a repaint the same way a scroll does, a few times while things settle. */
function repaint(){const m=document.getElementById('main');if(!m)return;requestAnimationFrame(()=>{const y=scrollY;m.style.transform='translateZ(0)';scrollTo(0,y+1);requestAnimationFrame(()=>{m.style.transform='';scrollTo(0,y)})})}
function repaintSoon(){[60,400,1200].forEach(t=>setTimeout(repaint,t))}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)repaintSoon()});
addEventListener('pageshow',repaintSoon);addEventListener('focus',repaintSoon);

/* ================= STORE: Supabase (private to Dylan) with offline cache ================= */
// Every piece of data is one row in table `kv` (user_id, path, data jsonb). Row-level security
// means only the signed-in account can read or write its own rows.
let SB=null,UID=null,R=null,ONLINE=navigator.onLine;
const pend={},busy={},timers={},lastW={};
function setSync(s,txt){const el=$('sync');if(!el)return;el.className='sync'+(s?' '+s:'');$('syncTxt').textContent=txt}
const KV={
  async get(p){const {data,error}=await SB.from('kv').select('data').eq('path',p).maybeSingle();if(error)throw error;return data?data.data:undefined},
  async set(p,v){const {error}=await SB.from('kv').upsert({user_id:UID,path:p,data:v,updated_at:new Date().toISOString()},{onConflict:'user_id,path'});if(error)throw error},
  async del(p){const {error}=await SB.from('kv').delete().eq('path',p);if(error)throw error},
  async list(prefix){const out=[];let from=0;for(;;){const {data,error}=await SB.from('kv').select('path,data,updated_at').like('path',prefix.replace(/[%_]/g,m=>'\\'+m)+'%').order('path').range(from,from+999);if(error)throw error;out.push(...data);if(data.length<1000)break;from+=1000}return out}
};
async function remoteWrite(p){
  if(!R||busy[p])return;busy[p]=true;setSync('busy','saving');
  try{
    while(pend[p]!==undefined&&pend[p]!==null){const v=pend[p];pend[p]=null;
      try{lastW[p]=stab(v);await KV.set(p,v)}
      catch(e){pend[p]=pend[p]??v;setSync('','offline · will retry');busy[p]=false;scheduleRetry();return}}
    setSync('on','synced');
  }finally{busy[p]=false}
}
let retryT=null;function scheduleRetry(){clearTimeout(retryT);retryT=setTimeout(flushAll,8000)}
function flushAll(){Object.keys(pend).forEach(p=>{if(pend[p]!=null)remoteWrite(p)});Object.keys(pendDel).forEach(p=>removeRemote(p))}
addEventListener('online',()=>{ONLINE=true;flushAll()});addEventListener('offline',()=>{ONLINE=false;setSync('','offline')});
function save(p,v,now){LS.set(p,v);if(!R){LS.set('outbox:'+p,1);return}pend[p]=v;clearTimeout(timers[p]);timers[p]=setTimeout(()=>remoteWrite(p),now?0:450)}
const pendDel={};
async function removeRemote(p){try{await KV.del(p);delete pendDel[p]}catch(e){scheduleRetry()}}
function removeDoc(p){try{localStorage.removeItem('ds3:'+p)}catch(e){}delete pend[p];if(!R)return;pendDel[p]=1;removeRemote(p)}
/* key-order-independent JSON: Postgres jsonb reorders keys, so a plain stringify never matched our own echoes */
const stab=v=>JSON.stringify(v,(k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.keys(x).sort().reduce((o,k2)=>(o[k2]=x[k2],o),{}):x);
const clone=o=>o==null?o:JSON.parse(JSON.stringify(o));
async function load(p){if(R&&ONLINE){try{const d=await KV.get(p);if(d!==undefined){LS.set(p,d);return clone(d)}return LS.get(p)}catch(e){}}return LS.get(p)}
async function listDocs(prefix){if(R&&ONLINE){try{const rows=await KV.list(prefix);rows.forEach(r=>LS.set(r.path,r.data));return rows.map(r=>({path:r.path,data:clone(r.data),at:r.updated_at}))}catch(e){}}
  const out=[];try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith('ds3:'+prefix)){const p=k.slice(4);const d=LS.get(p);if(d!=null)out.push({path:p,data:d})}}}catch(e){}return out}
// live updates from other devices and the laptop agent
const subs={},psubs=[];
function watch(p,cb){(subs[p]=subs[p]||[]).push(cb)}
function watchPrefix(prefix,cb){psubs.push([prefix,cb])}
function onRemote(evt,path,data){
  if(evt!=='DELETE'){if(pend[path]!=null||busy[path])return;const s=stab(data);if(lastW[path]===s)return;lastW[path]=s;LS.set(path,data)}
  else{try{localStorage.removeItem('ds3:'+path)}catch(e){}}
  if(subs[path]&&evt!=='DELETE')subs[path].forEach(cb=>{try{cb(clone(data))}catch(e){console.error(e)}});
  psubs.forEach(([pre,cb])=>{if(path.startsWith(pre))cb(evt,path,evt==='DELETE'?null:clone(data))});
}
let channel=null;
function startRealtime(){
  if(channel)SB.removeChannel(channel);
  channel=SB.channel('kv-'+UID).on('postgres_changes',{event:'*',schema:'public',table:'kv',filter:'user_id=eq.'+UID},pl=>{
    const row=pl.eventType==='DELETE'?pl.old:pl.new;if(!row||!row.path)return;onRemote(pl.eventType,row.path,row.data)}).subscribe(st=>{if(st==='SUBSCRIBED')setSync('on','synced');else if(st==='CHANNEL_ERROR'||st==='TIMED_OUT')setSync('','live updates paused')});
}
// catch up after the app was in the background
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&R&&typeof refreshAfterResume==='function')refreshAfterResume()});

/* ================= VISUALS: generated banner art + motion ================= */
const VIEW_ART={media:{seed:9.4,a:[.73,.4,1],b:[1,.16,.43]},today:{seed:1.3,a:[1,.16,.43],b:[.02,.85,.91]},gym:{seed:4.1,a:[1,.16,.43],b:[1,.69,0]},body:{seed:7.7,a:[.02,.85,.91],b:[1,.16,.43]},tools:{seed:2.9,a:[.69,.55,1],b:[1,.16,.43]},journal:{seed:9.2,a:[.9,.9,.9],b:[1,.16,.43]},week:{seed:5.5,a:[.34,.96,.66],b:[1,.16,.43]},stack:{seed:3.3,a:[1,.16,.43],b:[.69,.55,1]},money:{seed:6.6,a:[1,.69,0],b:[.02,.85,.91]}};
const ART={gl:null,canvas:null,prog:null,u:{},tex:null,hasTex:false,view:null,t0:performance.now(),raf:0,mouse:[.5,.5],imgs:{}};
(function initArt(){
  const c=document.createElement('canvas');c.className='artcanvas';c.setAttribute('aria-hidden','true');ART.canvas=c;
  const gl=c.getContext('webgl',{antialias:false,premultipliedAlpha:false,alpha:false});if(!gl)return;ART.gl=gl;
  const vs='attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const fs=`precision mediump float;uniform vec2 r;uniform float t,sd,useTex,fx;uniform vec3 ca,cb;uniform vec2 m;uniform sampler2D tex;
  float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+sd)*43758.5453);}
  float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
  float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p*=2.03;a*=.5;}return v;}
  float bayer(vec2 p){vec2 q=mod(floor(p),4.);float x=q.x,y=q.y;
    float b=mod(x+y*4.,16.);int i=int(b);
    float m=0.;if(i==0)m=0.;else if(i==1)m=8.;else if(i==2)m=2.;else if(i==3)m=10.;else if(i==4)m=12.;else if(i==5)m=4.;else if(i==6)m=14.;else if(i==7)m=6.;else if(i==8)m=3.;else if(i==9)m=11.;else if(i==10)m=1.;else if(i==11)m=9.;else if(i==12)m=15.;else if(i==13)m=7.;else if(i==14)m=13.;else m=5.;
    return m/16.;}
  void main(){vec2 uv=gl_FragCoord.xy/r;float px=3.;vec2 g=floor(gl_FragCoord.xy/px)*px;vec2 q=g/r;
    float tt=t*fx;
    float row=floor(q.y*24.);float gl1=step(.93,h(vec2(row,floor(tt*6.))))*(h(vec2(row+3.,floor(tt*6.)))-.5)*.25*fx;
    q.x+=gl1;
    vec2 a=vec2(q.x*r.x/r.y,q.y)*2.4;
    vec2 w=vec2(fbm(a+tt*.08+m*0.6),fbm(a+vec2(5.2,1.3)-tt*.06));
    float v=fbm(a+2.4*w+vec2(tt*.05,0.));
    if(useTex>.5){vec2 tq=vec2(q.x,1.-q.y);vec4 c=texture2D(tex,tq+vec2(gl1*.5,0.));float l=dot(c.rgb,vec3(.299,.587,.114));v=mix(v,l,.85);}
    float d=bayer(gl_FragCoord.xy/px);
    float lv=v*1.15-.08;
    vec3 col=vec3(.02);
    if(lv>d*.5+.25)col=cb*.55;
    if(lv>d*.45+.48)col=ca;
    if(lv>d*.3+.78)col=vec3(.92);
    float shift=.004*fx*(1.+gl1*20.);
    col.r*=1.-step(.995,h(vec2(floor(q.y*90.),floor(tt*12.))))*.6;
    col*=.86+.14*step(.5,fract(gl_FragCoord.y/2.));
    float vig=smoothstep(1.2,.2,length((uv-.5)*vec2(1.,1.8)));
    col*=vig;
    col+=vec3(shift*3.,0.,shift*6.)*ca;
    gl_FragColor=vec4(col,1.);}`;
  const sh=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS)){console.warn(gl.getShaderInfoLog(o));return null}return o};
  const v=sh(gl.VERTEX_SHADER,vs),f=sh(gl.FRAGMENT_SHADER,fs);if(!v||!f){ART.gl=null;return}
  const p=gl.createProgram();gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);gl.useProgram(p);ART.prog=p;
  const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  const loc=gl.getAttribLocation(p,'p');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
  ['r','t','sd','useTex','fx','ca','cb','m','tex'].forEach(k=>ART.u[k]=gl.getUniformLocation(p,k));
  ART.tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,ART.tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  addEventListener('pointermove',e=>{ART.mouse=[e.clientX/innerWidth,1-e.clientY/innerHeight]},{passive:true});
})();
function artMount(view){
  const host=document.querySelector(`#v-${view} .banner .art`);if(!host)return;
  ART.view=view;if(ART.canvas.parentNode!==host)host.appendChild(ART.canvas);
  ART.hasTex=false;
  artResize();cancelAnimationFrame(ART.raf);artLoop();
}
function artResize(){const c=ART.canvas;const host=c.parentNode;if(!host)return;const w=host.clientWidth,h=host.clientHeight;const r=Math.min(devicePixelRatio||1,1.5);c.width=Math.max(1,Math.round(w*r));c.height=Math.max(1,Math.round(h*r));if(ART.gl)ART.gl.viewport(0,0,c.width,c.height);artFrame(true)}
addEventListener('resize',()=>artResize());
function artFrame(force){const gl=ART.gl;if(!gl||!ART.view)return;const a=VIEW_ART[ART.view]||VIEW_ART.today;const t=(performance.now()-ART.t0)/1000;
  gl.uniform2f(ART.u.r,ART.canvas.width,ART.canvas.height);gl.uniform1f(ART.u.t,FX?t:12.3);gl.uniform1f(ART.u.sd,a.seed);gl.uniform1f(ART.u.useTex,ART.hasTex?1:0);gl.uniform1f(ART.u.fx,FX?1:0);
  gl.uniform3fv(ART.u.ca,a.a);gl.uniform3fv(ART.u.cb,a.b);gl.uniform2fv(ART.u.m,ART.mouse);gl.uniform1i(ART.u.tex,0);gl.drawArrays(gl.TRIANGLE_STRIP,0,4)}
let artLast=0;function artLoop(ts){ART.raf=requestAnimationFrame(artLoop);if(document.hidden||!FX){if(!FX&&ts-artLast>1000){artLast=ts;artFrame(true)}return}if(ts-artLast<33)return;artLast=ts;artFrame()}
// your own image per section, dithered by the same shader

/* motion helpers */
function staggerIn(root){if(!FX||!root||!root.animate)return;const els=[...root.querySelectorAll(':scope > *, .panel, .exc, .rcard, .wcard, .blk, .tr:not(.hd), .kv > *, .trk, .streak, .jitem, .spend, .cat')].filter((el,i,a)=>a.indexOf(el)===i&&el.offsetParent).slice(0,40);
  els.forEach((el,i)=>el.animate([{transform:'translateY(18px)',opacity:.15,clipPath:'inset(0 0 100% 0)'},{transform:'none',opacity:1,clipPath:'inset(0 0 0% 0)'}],{duration:420,delay:Math.min(i*28,500),easing:'cubic-bezier(.2,.9,.1,1)',fill:'backwards'}))}
addEventListener('scroll',()=>{if(!FX)return;const c=ART.canvas;if(c&&c.parentNode)c.style.transform=`translateY(${Math.min(60,scrollY*.35)}px)`},{passive:true});

// own-image banners removed; clear any old stored images once
function loadArtImages(){load('tools/images').then(d=>{if(d)removeDoc('tools/images')}).catch(()=>{})}

/* ================= DATES ================= */
const DOW=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const pad=n=>String(n).padStart(2,'0');
const logical=(d=new Date())=>new Date(d.getTime()-5*3600e3);
const ymd=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
function isoWeek(d){const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const dn=t.getUTCDay()||7;t.setUTCDate(t.getUTCDate()+4-dn);const y=t.getUTCFullYear();const w=Math.ceil(((t-Date.UTC(y,0,1))/864e5+1)/7);return `${y}-W${pad(w)}`}
const mins=d=>d.getHours()*60+d.getMinutes();
const parseT=s=>{const m=String(s||'').match(/^(\d{1,2}):(\d{2})/);return m?(+m[1])*60+(+m[2]):null};
const fmtM=m=>pad(Math.floor(m/60)%24)+':'+pad(m%60);
const addDays=(s,n)=>{const d=new Date(s+'T12:00');d.setDate(d.getDate()+n);return ymd(d)};
const nice=s=>new Date(s+'T12:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});


/* ================= EDITS (queued for Excel; one row per edit) ================= */
let EDITS={p:{}};let EDITS_SAVED={};
function saveEdits(){
  for(const [k,v] of Object.entries(EDITS.p)){const j=JSON.stringify(v);if(JSON.stringify(EDITS_SAVED[k])!==j)save('edits/'+k,v,true)}
  for(const k of Object.keys(EDITS_SAVED))if(!(k in EDITS.p))removeDoc('edits/'+k);
  EDITS_SAVED=clone(EDITS.p);LS.set('edits:all',EDITS.p);renderPend();schedulePublishOps();
}
async function loadEdits(){const rows=await listDocs('edits/');const p={};rows.forEach(r=>{if(r.data)p[r.path.slice(6)]=r.data});
  // anything queued while offline/signed out survives too
  const local=LS.get('edits:all')||{};for(const [k,v] of Object.entries(local))if(!(k in p)&&!rows.length)p[k]=v;
  EDITS={p};EDITS_SAVED=clone(p);renderPend()}
function patch(key,fields,ctx){const cur=EDITS.p[key]||{};const n={...cur,...fields,...(ctx?{_ctx:ctx}:{})};delete n._err;delete n._lost;if(!key.includes(':n:')&&key!=='inc:'){const w=cur._was||identityOf(key);if(w)n._was=w}EDITS.p[key]=n;saveEdits();rebuild()}
function dropPatch(key){delete EDITS.p[key];saveEdits();rebuild()}
function ago(iso){if(!iso)return '';const m=Math.round((Date.now()-new Date(iso))/60000);return m<1?'just now':m<60?m+'m ago':m<1440?Math.round(m/60)+'h ago':Math.round(m/1440)+'d ago'}
function renderPend(){const b=$('pendBtn');if(!b)return;b.hidden=true;return;const n=Object.keys(EDITS.p).length;const st=typeof XLSTATE==='undefined'?'off':XLSTATE;b.className='pendbtn on xl-'+st;
  b.textContent=st==='live'?(n?`XL ⟳ ${n}`:'XL ● live'):st==='err'?`XL ! ${n||''}`.trim():(n?`XL · ${n} waiting for laptop`:'XL · laptop off');b.title=st==='off'?'App is the main copy. Excel catches up next time your laptop is on.':'Excel sync: click for details'}

/* ================= MODEL ================= */
const STACK_CATS=LX('sc',['Group A','Group B','Supplements','Group D','Group E','Group F']);
const EXP_CATS=['Food','Subscriptions','Cat','Personal & Other','Investment & Savings'];
const FREQL={'weekly':52/12,'fortnightly':26/12,'4-weekly':13/12,'monthly':1,'bi-monthly':.5,'quarterly':1/3,'yearly':1/12};const FREQ=new Proxy({},{get:(o,k)=>FREQL[String(k).toLowerCase()]});const FREQ_OPTS=['Weekly','Fortnightly','4-weekly','Monthly','Bi-monthly','Quarterly','Yearly'];
const TYPES=['Task','Habit','Work','Study','Training','Meal','Break','Leisure','Social','Research','Plan','Mindset','Circadian','Sleep',...LX('ty',[])];
const CMP=new Set(LX('cmp',['Supplement']));
let M={};
function applyP(base,key){const p=EDITS.p[key];if(!p)return {...base,key};if(p._del)return null;const o={...base,key,edited:true};for(const k in p)if(k[0]!=='_')o[k]=p[k];return o}
function newOf(prefix){return Object.entries(EDITS.p).filter(([k,p])=>k.startsWith(prefix+'n:')&&!p._del).map(([k,p])=>({...p,key:k,isNew:true,edited:true}))}
function stackMonthly(s){const pr=+s.price,u=+s.units,w=+s.perweek;if(isFinite(pr)&&pr>0&&isFinite(u)&&u>0&&isFinite(w))return pr/u*w*52/12;return 0}
function daysFrom(str){if(!str)return null;const s=String(str);const set=new Set();
  s.replace(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\s*[–-]\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/g,(_,a,b)=>{let i=DOW.indexOf(a);const j=DOW.indexOf(b);for(let k=0;k<7;k++){set.add(DOW[i]);if(i===j)break;i=(i+1)%7}return _});
  (s.match(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/g)||[]).forEach(x=>set.add(x));
  if(/\bSaturday\b/.test(s))set.add('Sat');if(/\bSunday\b/.test(s))set.add('Sun');return set.size?set:null}
function rebuild(){
  // stack
  const st=D.stack.map(s=>{const o=applyP({...s},'st:'+s.row);if(!o)return null;if(o.edited)o.monthly=stackMonthly(o);return o}).filter(Boolean).concat(newOf('st:').map(o=>({...o,monthly:stackMonthly(o)})));
  // plans
  const plans={};
  for(const kind of ['weekday','weekend']){const pre=kind==='weekday'?'wd':'we';const P=D[kind];
    plans[kind]=P.blocks.map((b,bi)=>{const m=b.title.match(/(\d{2}):(\d{2})\s*–\s*(\d{2}):(\d{2})\s*·\s*(.*)/);let s=+m[1]*60+ +m[2],e=+m[3]*60+ +m[4];if(e<=s)e+=1440;
      const ttl=(typeof TITLES!=='undefined'&&TITLES[pre]&&TITLES[pre][bi])||m[5];let items=b.items.map(it=>applyP({...it},pre+':'+it.row)).filter(Boolean).concat(newOf(pre+':').filter(n=>n._ctx&&n._ctx.block===b.row));
      items=items.map(it=>{let t=parseT(it.time);if(t!==null&&t<s-60)t+=1440;return {...it,t,days:daysFrom(it.sched)||daysFrom(it.item),cmp:CMP.has(it.type),tk:pre+'|'+(it.time||'')+'|'+it.item}}).sort((a,b)=>(a.t??9999)-(b.t??9999)||(a.row||9e9)-(b.row||9e9));
      return {s,e,title:ttl,short:ttl.replace(/\s*\(.*?\)/g,'').replace(/\s*→.*$/,'').trim(),items,row:b.row,bi}});}
  /* an item whose time falls outside its block moves to the block that covers that time */
  for(const kind of ['weekday','weekend']){const B=plans[kind];if(!B||!B.length)continue;let moved=false;
    B.forEach(b=>{b.items=b.items.filter(it=>{if(it.t==null||(it.t>=b.s&&it.t<b.e))return true;
      const m=it.t%1440;const nb=B.find(x=>x!==b&&((m>=x.s&&m<x.e)||(m+1440>=x.s&&m+1440<x.e)));if(!nb)return true;
      nb.items.push({...it,t:(m>=nb.s&&m<nb.e)?m:m+1440});moved=true;return false})});
    if(moved)B.forEach(b=>b.items.sort((a,c)=>(a.t??9999)-(c.t??9999)||(a.row||9e9)-(c.row||9e9)))}
  // extras
  const extra={};
  for(const kind of ['weekday','weekend']){const pre=kind==='weekday'?'wx':'ex';extra[kind]={};
    for(const [sec,rows] of Object.entries(D[kind].extra)){if(/^(SOURCES|WHAT CHANGED|WHY)/.test(sec))continue;
      const base=rows.map(r=>{const c=r.cells;return applyP({row:r.row,day:c[0],item:c[1],type:c[2],dose:c[3],route:c[4],sched:c[5],notes:c[6],caution:c[7],sec},pre+':'+r.row)}).filter(Boolean).map(o=>({...o,tk:'x|'+(o.day||'')+'|'+o.item}));
      extra[kind][sec]=base.concat(newOf(pre+':').filter(n=>n._ctx&&n._ctx.sec===sec).map(o=>({...o,tk:'x|'+(o.day||'')+'|'+o.item})))}}
  // expenses + income
  const ex=D.expenses.filter(e=>e.cat!=='Stack').map(e=>{const o=applyP({...e},'xp:'+e.row);if(!o)return null;if(o.edited&&FREQ[o.freq]&&isNum(+o.per))o.m=(+o.per)*FREQ[o.freq];if(o.edited)o.y=o.m*12;return o}).filter(Boolean)
    .concat(newOf('xp:').map(o=>({...o,m:FREQ[o.freq]&&isFinite(+o.per)?(+o.per)*FREQ[o.freq]:0,y:(FREQ[o.freq]&&isFinite(+o.per)?(+o.per)*FREQ[o.freq]:0)*12})));
  const inc={hours:D.income['Hours worked per month'],take:D.income['Take-home pay'],...(EDITS.p['inc:']||{})};
  M={stack:st,plans,extra,expenses:ex,inc};
  M.stackBudget=st.filter(s=>s.inb).reduce((a,s)=>a+(s.monthly||0),0);
  M.stackOpt=st.filter(s=>!s.inb).reduce((a,s)=>a+(s.monthly||0),0);
  const cats={};EXP_CATS.forEach(c=>cats[c]=ex.filter(e=>e.cat===c&&e.inb!==false).reduce((a,e)=>a+(e.m||0),0));cats['Stack']=M.stackBudget;
  M.cats=cats;M.out=Object.values(cats).reduce((a,b)=>a+b,0);M.save=cats['Investment & Savings'];M.spend=M.out-M.save;M.left=inc.take-M.out;M.rate=inc.hours?inc.take/inc.hours:0;
  // stack status vs v2
  const v2=new Map();plans.weekday.forEach(b=>b.items.forEach(i=>{const k=norm(i.item);if(!v2.has(k))v2.set(k,{status:'active',times:[]});v2.get(k).times.push(i.time)}));
  Object.entries(extra.weekday).forEach(([sec,rows])=>{const s=/^AS NEEDED/.test(sec)?'asneeded':/^(PAUSED|NOT STARTED)/.test(sec)?'paused':null;if(!s)return;rows.forEach(r=>{const n=norm(r.item);if(!v2.has(n))v2.set(n,{status:s,times:[]});else if(s==='paused')v2.get(n).status='paused'})});
  M.stack.forEach(s=>{const v=v2.get(norm(s.name));s.status=v?v.status:'notinplan';if(typeof STOVR!=='undefined'&&STOVR.map[norm(s.name)])s.status=STOVR.map[norm(s.name)];s.times=v?[...new Set(v.times.filter(Boolean))]:[];s.cau=cautionsFor(s.name)});
  M.liveBudget=M.stack.filter(s=>s.inb&&s.status!=='paused').reduce((a,s)=>a+(s.monthly||0),0);
  M.targets=(extra.weekday['DAILY TARGETS – review Sundays 19:00']||[]).filter(r=>!/messag|\bmsgs?\b/i.test(r.item||''));
  if(booted)renderAllViews();
}
function cautionsFor(name){const out=new Set();const n=norm(name);for(const kind of ['weekday','weekend']){M.plans&&M.plans[kind]&&M.plans[kind].forEach(b=>b.items.forEach(i=>{if(norm(i.item)===n&&i.caution)out.add(i.caution)}));M.extra&&M.extra[kind]&&Object.values(M.extra[kind]).forEach(rows=>rows.forEach(r=>{if(norm(r.item)===n&&r.caution)out.add(r.caution)}))}return [...out]}


/* ================= EDITOR MODAL ================= */
let mCfg=null;
function openEditor(cfg){
  mCfg=cfg;$('mTitle').textContent=cfg.title;
  $('mForm').innerHTML=cfg.fields.map(f=>{const v=cfg.values[f.k];const id='f_'+f.k;
    let inp;
    if(f.type==='select')inp=`<select id="${id}">${f.options.map(o=>`<option ${String(o)===String(v??'')?'selected':''}>${esc(o)}</option>`).join('')}</select>`;
    else if(f.type==='bool')inp=`<select id="${id}"><option value="1" ${v?'selected':''}>Yes</option><option value="0" ${!v?'selected':''}>No</option></select>`;
    else if(f.type==='area')inp=`<textarea id="${id}">${esc(v??'')}</textarea>`;
    else inp=`<input id="${id}" type="${f.type==='num'?'text':'text'}" ${f.type==='num'?'inputmode="decimal"':''} value="${esc(v??'')}" ${f.ph?`placeholder="${esc(f.ph)}"`:''}>`;
    if(f.type==='num'&&/£/.test(f.label||''))inp=`<span class="curw">${inp}<button type="button" class="curb" data-cur="${id}" aria-label="switch £ / $">£</button></span>`;
    return `<label for="${id}">${esc(f.label||f.k)}</label>${inp}`}).join('')+
    (cfg.extra||'')+(cfg.hint?`<div class="hint2">${esc(cfg.hint)}</div>`:'')+
    `<div class="mf">${cfg.onDelete?'<button class="btn d" type="button" id="mDel">Delete</button>':''}${cfg.onRevert?'<button class="btn" type="button" id="mRev">Undo my edits</button>':''}<span class="sp"></span><button class="btn" type="button" id="mCan">Cancel</button><button class="btn p" type="submit">Save</button></div>`;
  $('modal').classList.add('on');
  const first=$('mForm').querySelector('input,select,textarea');first&&first.focus();
  if(cfg.onDelete)$('mDel').onclick=()=>{cfg.onDelete();closeModal();glitchAll()};
  if(cfg.onRevert)$('mRev').onclick=()=>{cfg.onRevert();closeModal();glitchAll()};
  $('mCan').onclick=closeModal;
}
function closeModal(){$('modal').classList.remove('on');mCfg=null}
$('mX').onclick=closeModal;$('modal').onclick=e=>{if(e.target===$('modal'))closeModal()};
$('mForm').onsubmit=e=>{e.preventDefault();if(!mCfg)return;const vals={};
  for(const f of mCfg.fields){const el=$('f_'+f.k);let v=el.value;if(f.type==='bool')v=v==='1';else if(f.type==='num'){v=v.trim();const cb=document.querySelector(`[data-cur="f_${f.k}"]`);const u=parseUsd(v);if(u!=null)v=u;else if(cb&&cb.textContent==='$'&&v!==''&&isFinite(+v))v=usd2gbp(+v);else v=v===''?null:(isFinite(+v)?+v:v)}else{v=v.trim()===''?null:v}vals[f.k]=v}
  const changed={};for(const f of mCfg.fields){if(JSON.stringify(vals[f.k]??null)!==JSON.stringify(mCfg.values[f.k]??null))changed[f.k]=vals[f.k]}
  const cfg=mCfg;const ex=cfg.onExtra?cfg.readExtra():null;closeModal();if(Object.keys(changed).length||cfg.isNew)cfg.onSave(vals,changed);if(cfg.onExtra)cfg.onExtra(ex);
  const sub=$('main');burst(innerWidth/2,innerHeight/3,30);glitchAll()};

const F_PLAN=[{k:'time',label:'time',ph:'HH:MM'},{k:'item',label:'item'},{k:'type',type:'select',options:TYPES},{k:'dose'},{k:'route'},{k:'sched',label:'schedule / days',ph:'Daily · Mon–Fri · Tue, Thu · EOD'},{k:'notes',type:'area'},{k:'caution',label:'cautions',type:'area'}];
const F_EXTRA=[{k:'item'},{k:'type',type:'select',options:[''].concat(TYPES)},{k:'dose'},{k:'route'},{k:'sched',label:'schedule'},{k:'notes',type:'area'},{k:'caution',label:'cautions',type:'area'}];
const F_STACK=[{k:'name'},{k:'cat',label:'category',type:'select',options:STACK_CATS},{k:'dose'},{k:'route'},{k:'sched',label:'schedule'},{k:'notes',type:'area'},{k:'price',label:'pack price £',type:'num',ph:'or "owned"'},{k:'units',label:'units / pack',type:'num'},{k:'perweek',label:'used / week',type:'num'},{k:'inb',label:'in budget',type:'bool'},{k:'src',label:'source'}];
const F_EXP=[{k:'name'},{k:'cat',label:'category',type:'select',options:EXP_CATS},{k:'prov',label:'provider'},{k:'freq',label:'frequency',type:'select',options:FREQ_OPTS},{k:'per',label:'cost / payment £',type:'num'},{k:'day',label:'payment day'},{k:'method',label:'method'},{k:'notes'},{k:'inb',label:'in budget',type:'bool'}];
const F_TGT=[{k:'item',label:'target'},{k:'goal',label:'times per week',type:'num'},{k:'notes',label:'detail',type:'area'}];
function pick(o,fields){const r={};fields.forEach(f=>r[f.k]=o[f.k]??null);return r}
function pctSel(on){return `<label for="f_pct">counts toward day %</label><select id="f_pct"><option value="1" ${on?'selected':''}>Yes</option><option value="0" ${on?'':'selected'}>No</option></select>`}
function editPlanItem(kind,it){const pre=kind==='weekday'?'wd':'we';
  const lead=(typeof NITEMS!=='undefined'&&NITEMS.m[it.key]!=null)?NITEMS.m[it.key]:'';
  openEditor({title:`edit · ${kind==='weekday'?'weekday plan':'weekend plan'}${it.row?' · row '+it.row:''}`,fields:F_PLAN,values:pick(it,F_PLAN),
    extra:`<label for="f_notify">🔔 notification</label><select id="f_notify"><option value="" ${lead===''?'selected':''}>Off</option>${[0,5,10,15,30,60].map(m=>`<option value="${m}" ${lead===m?'selected':''}>${m?m+' min before':'at the time'}</option>`).join('')}</select>${pctSel(!noPct(it))}${it.t==null?'<div class="hint2">This item has no time yet — add one above for the notification to fire</div>':''}`,
    readExtra:()=>({n:$('f_notify').value,c:$('f_pct').value}),onExtra:v=>{if(typeof setItemNotify==='function')setItemNotify(it.key,v.n===''?null:+v.n);setNoPct(it,v.c==='0')},
    onSave:(v,ch)=>patch(it.key,it.isNew?v:ch),onDelete:()=>{if(it.isNew)dropPatch(it.key);else patch(it.key,{_del:true})},onRevert:it.edited&&!it.isNew?()=>dropPatch(it.key):null})}
function addPlanItem(kind,block){const pre=kind==='weekday'?'wd':'we';const nk=`${pre}:n:${rid()}`;let addV=null;const b=M.plans[kind].find(x=>x.row===block);
  openEditor({title:`add to ${b?b.short.toLowerCase():'block'}`,fields:F_PLAN,values:{time:b?fmtM(b.s):'',type:'Task',sched:'Daily'},isNew:true,
    extra:pctSel(true),readExtra:()=>$('f_pct').value,onExtra:c=>{if(c==='0'&&addV)setNoPct({tk:pre+'|'+(addV.time||'')+'|'+addV.item},true)},
    onSave:v=>{addV=v;patch(nk,{...v,_new:true},{block,kind})}})}
function editExtra(kind,r){const pre=kind==='weekday'?'wx':'ex';const isT=/^DAILY TARGETS/.test(r.sec||'');const F=isT?F_TGT:F_EXTRA;
  openEditor({title:`edit · ${(r.sec||'').split(/[–(]/)[0].trim().toLowerCase()}${r.row?' · row '+r.row:''}`,fields:F,values:pick(r,F),
    onSave:(v,ch)=>patch(r.key,r.isNew?v:ch),onDelete:()=>{if(r.isNew)dropPatch(r.key);else patch(r.key,{_del:true})},onRevert:r.edited&&!r.isNew?()=>dropPatch(r.key):null})}
function addExtra(kind,sec){const pre=kind==='weekday'?'wx':'ex';const isT=/^DAILY TARGETS/.test(sec);const F=isT?F_TGT:F_EXTRA;
  openEditor({title:'add · '+sec.split(/[–(]/)[0].trim().toLowerCase(),fields:F,values:{},isNew:true,onSave:v=>patch(`${pre}:n:${rid()}`,{...v,_new:true,sec},{sec,kind})})}
function editStack(s){openEditor({title:`edit · Stack${s.row?' · row '+s.row:''}`,fields:F_STACK,values:pick(s,F_STACK),hint:'Monthly cost is worked out from pack price ÷ units × used per week, the same as the sheet.',
  onSave:(v,ch)=>{patch(s.key,s.isNew?v:ch);closeDrawer()},onDelete:()=>{if(s.isNew)dropPatch(s.key);else patch(s.key,{_del:true});closeDrawer()},onRevert:s.edited&&!s.isNew?()=>{dropPatch(s.key);closeDrawer()}:null})}
function addStack(){openEditor({title:'add '+LW('item','item'),fields:F_STACK,values:{cat:'Supplements',route:'Oral',sched:'Daily',inb:true},isNew:true,onSave:v=>patch('st:n:'+rid(),{...v,_new:true},{cat:v.cat})})}
function editExp(e){openEditor({title:`edit · Expenses${e.row?' · row '+e.row:''}`,fields:F_EXP,values:pick(e,F_EXP),
  onSave:(v,ch)=>patch(e.key,e.isNew?v:ch),onDelete:()=>{if(e.isNew)dropPatch(e.key);else patch(e.key,{_del:true})},onRevert:e.edited&&!e.isNew?()=>dropPatch(e.key):null})}
function addExp(cat){openEditor({title:'add · '+(cat||'bill').toLowerCase(),fields:F_EXP,values:{cat:cat||'Subscriptions',freq:'Monthly',inb:true},isNew:true,onSave:v=>patch('xp:n:'+rid(),{...v,_new:true},{cat:v.cat})})}
function editIncome(){openEditor({title:'edit · income (Expenses Summary B15–B16)',fields:[{k:'hours',label:'hours / month',type:'num'},{k:'take',label:'take-home £',type:'num'}],values:{hours:M.inc.hours,take:M.inc.take},onSave:(v)=>patch('inc:',{hours:v.hours,take:v.take})})}


/* £ / $ toggle on money fields: in $ mode the field shows a live £ preview and saves as £ */
$('mForm').addEventListener('click',e=>{const b=e.target.closest('[data-cur]');if(!b)return;e.preventDefault();b.textContent=b.textContent==='£'?'$':'£';b.classList.toggle('usd',b.textContent==='$');FXR.get();curHint(b)});
$('mForm').addEventListener('input',e=>{const b=e.target.closest('.curw');if(b)curHint(b.querySelector('[data-cur]'))});
function curHint(b){const w=b.closest('.curw'),i=w.querySelector('input');let h=w.nextElementSibling;if(!h||!h.classList.contains('curh')){h=document.createElement('div');h.className='curh dim';w.after(h)}
  const v=i.value.trim(),u=parseUsd(v);const g=u!=null?u:(b.textContent==='$'&&v!==''&&isFinite(+v)?usd2gbp(+v):null);h.textContent=g!=null?`= ${gbp(g,2)} (rate ${FXR.r.toFixed(3)})`:''}

/* ================= EDIT MODE ================= */
let EDIT=false;
/* editing is local: hold a thing to edit it; holding a section shows its add/delete controls until you tap away */
let EDSCOPE=null;
function setEdit(on,el){if(EDSCOPE)EDSCOPE.classList.remove('edit-on');EDSCOPE=null;EDIT=on;
  if(on){EDSCOPE=el||document.body;EDSCOPE.classList.add('edit-on');try{navigator.vibrate&&navigator.vibrate(18)}catch(e){}}}
addEventListener('pointerdown',e=>{if(!EDIT)return;const t=e.target;if(!t.closest||t.closest('.modal,#modal,#sheet,.drawer,.ed,.addrow,.sdel,[data-edit],[data-editx],[data-tedit]'))return;
  if(EDSCOPE&&EDSCOPE!==document.body&&EDSCOPE.contains(t))return;setEdit(false)},true);
/* edit mode: long-press (touch) or right-click (mouse) on anything editable */
(function(){let t=null,sx=0,sy=0,fired=false,swallow=0;
  /* the tap that ends a long-press must not also tick/open the thing under the finger */
  ['click','pointerup','mouseup'].forEach(ev=>addEventListener(ev,e=>{if(Date.now()<swallow){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();if(ev==='click')swallow=0}},true));
  const EDITABLE='.it,.tr,.trk,.tgt,.blk,.panel,.exp,.row';
  const trigger=(target)=>{if(target.closest('input,textarea,select,#sheet,.drawer,.modal,#v-gym,#v-journal'))return false;if(!target.closest('#main'))return false;
    const row=target.closest('.it,.tr,.trk,.tgt,[data-key]');const ed=row&&row.querySelector('.ed,[data-edit],[data-editx],[data-tedit]');
    try{navigator.vibrate&&navigator.vibrate(18)}catch(e){}
    if(ed){setEdit(false);ed.click();return true}
    const sc=target.closest('.blk,.panel,.exp,section')||document.body;setEdit(true,sc);return true};
  addEventListener('touchstart',e=>{if(e.touches.length!==1)return;const tg=e.target;sx=e.touches[0].clientX;sy=e.touches[0].clientY;fired=false;clearTimeout(t);t=setTimeout(()=>{fired=trigger(tg);if(fired)swallow=Date.now()+900},520)},{passive:true});
  addEventListener('touchmove',e=>{if(Math.hypot(e.touches[0].clientX-sx,e.touches[0].clientY-sy)>10)clearTimeout(t)},{passive:true});
  addEventListener('touchend',e=>{clearTimeout(t);if(fired){e.preventDefault();fired=false}});
  addEventListener('contextmenu',e=>{if(e.target.closest('input,textarea'))return;if(trigger(e.target))e.preventDefault()});
  /* laptop: holding the left mouse button does the same as a long-press */
  let mt=null,mx=0,my=0;const mStop=()=>{clearTimeout(mt);mt=null};
  addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.button!==0)return;const tg=e.target;mx=e.clientX;my=e.clientY;mStop();mt=setTimeout(()=>{mt=null;if(trigger(tg))swallow=Date.now()+1500},520)},true);
  addEventListener('pointermove',e=>{if(mt&&Math.hypot(e.clientX-mx,e.clientY-my)>6)mStop()},true);
  ['pointerup','pointercancel','dragstart'].forEach(ev=>addEventListener(ev,mStop,true));
})();


/* ================= TODAY ================= */
let L=logical(),DAYK=ymd(L),DOWN=DOW[L.getDay()];
let planKind=(DOWN==='Sat'||DOWN==='Sun')?'weekend':'weekday',planForced=false;
let DAY={ticks:{},water:0,msg:{},dw:0};let filt='all';
/* injectables follow the protocols page: shown only on the days their protocol is due, hidden entirely until one exists */
let PROTO_READY=false;
function protoFor(i){if(!PROTO_READY)return null;const a=norm(i.item);return PROTO.list.find(c=>{const b=norm(c.name);return b&&(a===b||(Math.min(a.length,b.length)>=4&&(a.includes(b)||b.includes(a))))})||null}
function protoManaged(i){const r=norm(i.route||'');return !!r&&(PX.spot||[]).some(s=>norm(s)===r)}
function protoOk(i,d){if(!PROTO_READY)return true;const c=protoFor(i);if(c)return scheduledOn(c,d||DAYK);return !protoManaged(i)}
function eff(i){const c=protoFor(i);const tm=c&&c.times&&c.times[0];if(!tm||tm==='any'||tm===i.time)return i;const t=parseT(tm);return t===null?i:{...i,time:tm,t:t<300?t+1440:t}}
const onToday=i=>(!i.days||i.days.has(DOWN))&&protoOk(i);
function todaySync(){if(typeof M!=='undefined'&&M.plans&&M.plans[planKind]&&$('blocks'))renderToday()}
function visibleItems(){return M.plans[planKind].flatMap(b=>b.items.filter(onToday).map(eff))}
/* items flagged "doesn't count" stay on the list and can be ticked, but are left out of the day % */
let TITLES={};
load('today/titles').then(d=>{TITLES=d||{};if(typeof M!=='undefined'&&M.plans)rebuild()}).catch(()=>{});
watch('today/titles',d=>{TITLES=d||{};if(typeof M!=='undefined'&&M.plans)rebuild()});
window.addEventListener('sys-patch',e=>{try{const o=JSON.parse(e.detail);if(o.titles){TITLES={...TITLES,...o.titles};save('today/titles',TITLES)}
for(const [k,v] of Object.entries(o.p||{})){if(v===null)dropPatch(k);else patch(k,v,v._ctx)}
if(o.nopctReset)NOPCT={m:{}};(o.nopct||[]).forEach(k=>{NOPCT.m[k]=1});if(o.nopct)save('today/nopct',NOPCT,true);if(o.titles)rebuild();document.documentElement.dataset.patched=String(Date.now())}catch(x){document.documentElement.dataset.patched='err '+x.message}});
window.addEventListener('sys-kv',e=>{load(e.detail).then(d=>{document.documentElement.dataset.kv=JSON.stringify(d)}).catch(x=>{document.documentElement.dataset.kv='err '+x.message})});
window.addEventListener('sys-dump',()=>{const r={};for(const kind of ['weekday','weekend']){r[kind]={blocks:M.plans[kind].map(b=>({row:b.row,title:b.title,items:b.items.map(i=>({key:i.key,time:i.time,item:i.item,type:i.type,dose:i.dose,route:i.route,sched:i.sched,notes:i.notes,caution:i.caution}))})),extra:M.extra[kind]}}
document.documentElement.dataset.dump=JSON.stringify({r,t:TITLES,e:EDITS.p})});
let NOPCT={m:{}};
load('today/nopct').then(d=>{if(d)NOPCT={m:{},...d};if(typeof M!=='undefined'&&M.plans)updateCounts()}).catch(()=>{});
watch('today/nopct',d=>{NOPCT=d?{m:{},...d}:{m:{}};if(typeof M!=='undefined'&&M.plans&&$('pct'))updateCounts()});
function setNoPct(i,off){const key=typeof i==='string'?i:pctId(i);if(off)NOPCT.m[key]=1;else delete NOPCT.m[key];save('today/nopct',NOPCT,true);if($('pct'))updateCounts()}
function pctId(i){return (i.tk||'').toLowerCase().replace(/\s+/g,' ').trim()}
function noPct(i){return !!NOPCT.m[pctId(i)]}
function countedItems(){return visibleItems().filter(i=>!noPct(i))}
function nowM(){let m=mins(new Date());if(m<300)m+=1440;return m}
function itemRow(i){
  const ds=[i.dose&&i.dose!=='—'?i.dose:null,i.route&&i.route!=='—'?i.route:null].filter(Boolean).join(' · ');
  const sch=i.sched&&!/^(Daily|—|None)$/.test(i.sched)?i.sched:'';
  return `<div class="it" role="checkbox" tabindex="0" aria-checked="false" data-k="${esc(i.tk)}" data-t="${i.t??''}" data-cmp="${i.cmp?1:0}"><span class="box"></span><span class="t num">${esc(i.time||'')}</span><span><span class="nm">${esc(i.item)}</span>${i.edited?'<span class="delta">Δ</span>':''}${ds?`<span class="dd">${esc(ds)}</span>`:''}${sch?`<span class="dd">· ${esc(sch)}</span>`:''}${i.caution?'<span class="warnflag" title="Has a caution">⚠︎</span>':''}${i.notes?`<span class="nt">${esc(i.notes)}</span>`:''}${i.caution?`<span class="ca">${esc(i.caution)}</span>`:''}</span><span class="row" style="gap:6px;justify-content:flex-end"><button class="ed" type="button" data-edit="${esc(i.key)}">✎</button><span class="ty${i.cmp?' c':''}">${esc(i.type||'')}</span></span></div>`;
}
function renderToday(){if(typeof renderTodayTasks==='function')renderTodayTasks();if(typeof renderTodayCal==='function')renderTodayCal();
  const blocks=M.plans[planKind];
  
  $('pWd').setAttribute('aria-pressed',planKind==='weekday');$('pWe').setAttribute('aria-pressed',planKind==='weekend');
  const gym=(planKind==='weekday'&&(DOWN==='Tue'||DOWN==='Thu'))||(planKind==='weekend');
  const tdate=L.toLocaleDateString('en-GB',{weekday:'short',day:'2-digit',month:'short'}).toUpperCase();
  const late=mins(new Date())<300;
  $('dateline').innerHTML=`<span class="chipy">${planKind==='weekend'?'Weekend':'Weekday'} plan</span>${gym?`<button class="chipy hot" type="button" data-go="gym">Gym day · ${gymTypeFor()} <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>`:''}${planKind==='weekday'&&!gym?'<span class="chipy">Rest day · dinner 19:30</span>':''}${late?'<span class="chipy hot">after midnight · still logging '+esc(DOWN)+'</span>':''}`;
  $('strip').innerHTML=blocks.map(b=>`<button type="button" data-b="${b.bi}" style="flex:${Math.max(b.e-b.s,20)}"><span class="t num">${fmtM(b.s)}</span><span class="n">${esc(b.short.toLowerCase())}</span><span class="fill"></span></button>`).join('')+`<span class="nowline" id="nowline"></span>`;
  const open=new Set([...document.querySelectorAll('#blocks .blk.open')].map(e=>e.dataset.b));
  $('blocks').innerHTML=blocks.map(b=>{const its=b.items.filter(onToday).map(eff);
    return `<div class="blk${open.has(String(b.bi))?' open':''}" id="blk-${b.bi}" data-b="${b.bi}"><button class="bh" type="button" aria-expanded="${open.has(String(b.bi))}"><span class="ar">▸</span><span class="tm num">${fmtM(b.s)}–${fmtM(b.e)}</span><span class="ti">${esc(b.title)}</span><span class="ct num"></span><span class="mini"><span></span></span></button><div class="items">${its.map(itemRow).join('')}<button class="addrow" type="button" data-addblock="${b.row}">+ Add item to ${esc(b.short.toLowerCase())}</button></div></div>`}).join('');
  const ex=M.extra[planKind];const showK=Object.keys(ex).filter(k=>/^AS NEEDED/.test(k));
  $('todayExtra').innerHTML=showK.map(k=>`<div class="blk" data-x="1"><button class="bh" type="button" aria-expanded="false"><span class="ar">▸</span><span class="tm">${/WEEKLY/.test(k)?'weekly':'any time'}</span><span class="ti">Situational</span><span class="ct">${ex[k].length} items</span><span></span></button><div class="items">${ex[k].map(r=>`<div class="it" role="checkbox" tabindex="0" aria-checked="false" data-k="${esc(r.tk)}" data-cmp="${CMP.has(r.type)?1:0}"><span class="box"></span><span class="t">${esc(r.day||'—')}</span><span><span class="nm">${esc(r.item)}</span>${r.edited?'<span class="delta">Δ</span>':''}<span class="dd">${esc([r.dose,r.route,r.sched].filter(x=>x&&x!=='—').join(' · '))}</span>${r.caution?'<span class="warnflag">⚠︎</span>':''}${r.notes?`<span class="nt">${esc(r.notes)}</span>`:''}${r.caution?`<span class="ca">${esc(r.caution)}</span>`:''}</span><span class="row" style="gap:6px;justify-content:flex-end"><button class="ed" type="button" data-editx="${esc(r.key)}" data-sec="${esc(k)}">✎</button><span class="ty c">${esc(r.type||'')}</span></span></div>`).join('')}<button class="addrow" type="button" data-addsec="${esc(k)}">+ Add</button></div></div>`).join('');
  applyTicks();applyFilter();tickNow(true);
}
function applyTicks(){document.querySelectorAll('#v-today .it').forEach(el=>el.setAttribute('aria-checked',!!DAY.ticks[el.dataset.k]));updateCounts()}
function updateCounts(){
  const vis=countedItems();const total=vis.length;const done=vis.filter(i=>DAY.ticks[i.tk]).length;const p=total?Math.round(done/total*100):0;
  $('pct').textContent=p+'%';$('pct').className='pct num '+(p>=80?'ok':'');
  $('asc').innerHTML=`<span class="pbar${p>=80?' ok':''}"><i style="width:${Math.min(100,p)}%"></i><em></em></span>`;
  $('pctTxt').textContent=`${done}/${total} ticked · target 80%`;
  M.plans[planKind].forEach(b=>{const its=b.items.filter(onToday);const el=$('blk-'+b.bi);if(!el)return;const d=its.filter(i=>DAY.ticks[i.tk]).length;
    el.querySelector('.ct').textContent=`${d}/${its.length}`;el.querySelector('.mini span').style.width=(its.length?d/its.length*100:0)+'%';el.classList.toggle('done',its.length>0&&d===its.length);
    const sb=document.querySelector(`#strip button[data-b="${b.bi}"] .fill`);if(sb)sb.style.width=(its.length?d/its.length*100:0)+'%'});
  return {done,total,p};
}
function persistDay(){const {done,total}=updateCounts();const names=visibleItems().filter(i=>DAY.ticks[i.tk]).map(i=>i.item);DAY={...DAY,done,total,names,plan:planKind,dow:DOWN};save('days/d-'+DAYK,DAY);schedWidget()}
function setTick(k,on){if(on)DAY.ticks[k]=1;else delete DAY.ticks[k];document.querySelectorAll(`#v-today .it[data-k="${CSS.escape(k)}"]`).forEach(el=>el.setAttribute('aria-checked',on));persistDay()}
function autoTick(re){const it=visibleItems().find(i=>re.test(i.item));if(it&&!DAY.ticks[it.tk])setTick(it.tk,true)}
function toggle(el){
  const k=el.dataset.k;const on=!DAY.ticks[k];setTick(k,on);
  if(on){burstEl(el.querySelector('.box'),34);const nm=el.querySelector('.nm');scramble(nm,nm.textContent,300)}
  const c=updateCounts();const blk=el.closest('.blk');
  if(on&&blk&&!blk.dataset.x&&blk.classList.contains('done')){shake();flash('block_cleared');burstEl(blk.querySelector('.bh'),90,true)}
  if(on&&c.done===c.total&&c.total)setTimeout(()=>{flash('day_complete');shake();burst(innerWidth/2,innerHeight/2,200,true)},350);
}
$('v-today').addEventListener('click',e=>{
  const ed=e.target.closest('[data-edit]');if(ed){e.stopPropagation();const it=M.plans[planKind].flatMap(b=>b.items).find(i=>i.key===ed.dataset.edit);if(it)editPlanItem(planKind,it);return}
  const edx=e.target.closest('[data-editx]');if(edx){e.stopPropagation();const r=(M.extra[planKind][edx.dataset.sec]||[]).find(x=>x.key===edx.dataset.editx);if(r)editExtra(planKind,r);return}
  const ab=e.target.closest('[data-addblock]');if(ab){addPlanItem(planKind,+ab.dataset.addblock);return}
  const as=e.target.closest('[data-addsec]');if(as){addExtra(planKind,as.dataset.addsec);return}
  const g=e.target.closest('[data-go]');if(g){go(g.dataset.go);return}
  const it=e.target.closest('.it');if(it){toggle(it);return}
  const bh=e.target.closest('.bh');if(bh){const b=bh.parentElement;const o=!b.classList.contains('open');b.classList.toggle('open',o);bh.setAttribute('aria-expanded',o);return}
  const sb=e.target.closest('#strip button');if(sb)openBlock(+sb.dataset.b,true);
});
$('v-today').addEventListener('keydown',e=>{if((e.key===' '||e.key==='Enter')&&e.target.classList.contains('it')){e.preventDefault();toggle(e.target)}});
function openBlock(bi,scroll){const el=$('blk-'+bi);if(!el)return;el.classList.add('open');el.querySelector('.bh').setAttribute('aria-expanded',true);if(scroll){el.scrollIntoView({behavior:FX?'smooth':'auto',block:'start'});FX&&el.animate([{boxShadow:'0 0 0 2px #ff2a6d'},{boxShadow:'0 0 0 0 transparent'}],{duration:900})}}
$('filtSeg').onclick=e=>{const b=e.target.closest('button');if(!b)return;filt=b.dataset.f;$('filtSeg').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b));applyFilter()};
function applyFilter(){document.querySelectorAll('#v-today .it').forEach(el=>{const c=el.dataset.cmp==='1';el.classList.toggle('flt',filt==='cmp'&&!c||filt==='rtn'&&c)})}
function tog(id,cls,key){$(id).onclick=function(){const on=this.getAttribute('aria-pressed')!=='true';this.setAttribute('aria-pressed',on);$('v-today').classList.toggle(cls,on);LS.set(key,on)};if(LS.get(key)){$(id).setAttribute('aria-pressed',true);$('v-today').classList.add(cls)}}
tog('hideDone','hidedone','hideDone');document.body.classList.add('showinfo');
$('pWd').onclick=()=>{planKind='weekday';planForced=true;firstNow=true;renderToday();glitchAll()};
$('pWe').onclick=()=>{planKind='weekend';planForced=true;firstNow=true;renderToday();glitchAll()};
let resetArm=0;$('resetDay').onclick=function(){if(Date.now()-resetArm<2500){DAY.ticks={};applyTicks();persistDay();this.textContent='reset';glitchAll();resetArm=0}else{resetArm=Date.now();this.textContent='tap again';setTimeout(()=>{this.textContent='reset'},2500)}};

let lastMin=-1,firstNow=true;
function tickNow(force){if(!M||!M.plans||!M.plans[planKind]||!M.plans[planKind].length)return;
  if(!booted||!M.plans)return;
  const n=new Date();const hm=pad(n.getHours())+':'+pad(n.getMinutes());const ce=$('clock');
  if(ce.textContent!==hm){if(!force&&FX)scramble(ce,hm,420);else ce.textContent=hm;ce.dataset.text=hm}
  $('secs').textContent=pad(n.getSeconds());
  const m=nowM();if(m===lastMin&&!force)return;lastMin=m;
  const nl=logical();if(ymd(nl)!==DAYK){L=nl;DAYK=ymd(L);DOWN=DOW[L.getDay()];if(!planForced)planKind=(DOWN==='Sat'||DOWN==='Sun')?'weekend':'weekday';firstNow=true;loadDay();return}
  const blocks=M.plans[planKind];const cur=blocks.find(b=>m>=b.s&&m<b.e);
  const vis=visibleItems().filter(i=>i.t!==null).sort((a,b)=>a.t-b.t);
  const past=vis.filter(i=>i.t<=m);const nowT=past.length?past[past.length-1].t:null;const nowItems=vis.filter(i=>i.t===nowT);const next=vis.find(i=>i.t>m);
  const sleeping=m>=1440||m<480;
  $('nowBlk').textContent=cur?fmtM(cur.s)+'–'+fmtM(cur.e):(sleeping?'00:00–08:00':'');
  const nowName=sleeping&&m>=1440?'sleep — lights out was 00:00':cur?cur.short.toLowerCase():'free time';
  if($('nowItem').dataset.v!==nowName){$('nowItem').dataset.v=nowName;scramble($('nowItem'),nowName)}
  $('nowSub').textContent=nowItems.length&&!sleeping?`${fmtM(nowT)} · ${nowItems.slice(0,3).map(i=>i.item).join(', ')}${nowItems.length>3?' +'+(nowItems.length-3):''}`:(sleeping?'next up is the 08:00 wake':'');
  if(next){const dt=next.t-m;const prev=nowT??(cur?cur.s:m);const same=vis.filter(i=>i.t===next.t);const nn=same.length>1?`${next.item} +${same.length-1}`:next.item;
    if($('nextItem').dataset.v!==nn){$('nextItem').dataset.v=nn;scramble($('nextItem'),nn)}
    $('nextAt').textContent=fmtM(next.t);$('eta').textContent=dt>=60?`${Math.floor(dt/60)}h${pad(dt%60)}`:`${dt}m`;$('etaBar').style.width=Math.min(100,Math.max(2,(m-prev)/Math.max(1,next.t-prev)*100))+'%';
  }else{$('nextItem').textContent='wake · 08:00';$('nextAt').textContent='08:00';const dt=(1440+480-m)%1440;$('eta').textContent=`${Math.floor(dt/60)}h${pad(dt%60)}`;$('etaBar').style.width='100%'}
  const btns=[...$('strip').querySelectorAll('button')];btns.forEach(b=>{const bl=blocks[+b.dataset.b];b.classList.toggle('cur',bl===cur);b.classList.toggle('past',m>=bl.e)});
  const nl2=$('nowline');if(nl2){const tot=btns.reduce((s,b)=>s+parseFloat(b.style.flex),0);let acc=0,pos=null;for(const b of btns){const bl=blocks[+b.dataset.b];const w=parseFloat(b.style.flex);if(m>=bl.s&&m<bl.e){pos=acc+(m-bl.s)/(bl.e-bl.s)*w;break}acc+=w}if(pos===null)pos=m<blocks[0].s?0:tot;nl2.style.left=`calc(${pos/tot*100}% - 1px)`}
  document.querySelectorAll('#blocks .blk').forEach(el=>{const bl=blocks[+el.dataset.b];const isCur=bl===cur;el.classList.toggle('cur',isCur);if(isCur&&firstNow){el.classList.add('open');el.querySelector('.bh').setAttribute('aria-expanded',true)}});
  if(firstNow&&!cur){if(sleeping&&m>=1440){const all=document.querySelectorAll('#blocks .blk');all.length&&all[all.length-1].classList.add('open')}else{const f=document.querySelector('#blocks .blk');f&&f.classList.add('open')}}
  firstNow=false;
  document.querySelectorAll('#blocks .it').forEach(el=>el.classList.toggle('nowit',el.dataset.t!==''&&+el.dataset.t===nowT&&!sleeping));
}
setInterval(()=>{if(!document.hidden)tickNow(false)},1000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)tickNow(false)});
async function loadDay(){
  const p='days/d-'+DAYK;const d=await load(p);DAY={ticks:{},water:0,msg:{},dw:0,...(d||{})};
  renderToday();renderTools();watch(p,dd=>{if(p!=='days/d-'+DAYK)return;DAY={ticks:{},water:0,msg:{},dw:0,...dd};applyTicks();renderTools();if(cur==='streaks'&&typeof renderHabits==='function'&&!hHold)renderHabits()});
}



/* ================= GYM v2 — full workout tracker ================= */
/* exercise database: free-exercise-db (Unlicense), images from its GitHub CDN */
const IMGBASE='https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/';
const MUSCLES2=['chest','shoulders','biceps','triceps','forearms','abs','lats','upper back','lower back','traps','quads','hamstrings','glutes','calves','adductors','abductors','neck','cardio','full body'];
const EQUIP2=['barbell','dumbbell','machine','cable','none','kettlebell','band','ez bar','smith machine','plate','other'];
const XTYPES={wr:{l:'weight & reps',f:['kg','r']},bw:{l:'bodyweight reps',f:['r']},wbw:{l:'weighted bodyweight',f:['kg','r'],pfx:'+'},abw:{l:'assisted bodyweight',f:['kg','r'],pfx:'−'},r:{l:'reps only',f:['r']},dur:{l:'duration',f:['sec']},dd:{l:'distance & duration',f:['km','sec']},wd:{l:'weight & distance',f:['kg','m']}};
const FLAB={kg:'kg',r:'reps',sec:'time',km:'km',m:'m'};
const LEGACY={'bench press (barbell)':['chest','barbell'],'incline bench press (barbell)':['chest','barbell'],'incline bench press (dumbbell)':['chest','dumbbell'],'bench press (dumbbell)':['chest','dumbbell'],'chest press (machine)':['chest','machine'],'cable fly':['chest','cable'],'pec deck':['chest','machine'],'pull up':['lats','none','bw'],'chin up':['lats','none','bw'],'lat pulldown (cable)':['lats','cable'],'seated cable row':['upper back','cable'],'bent over row (barbell)':['upper back','barbell'],'deadlift (barbell)':['lower back','barbell'],'overhead press (barbell)':['shoulders','barbell'],'shoulder press (dumbbell)':['shoulders','dumbbell'],'lateral raise (dumbbell)':['shoulders','dumbbell'],'face pull':['shoulders','cable'],'bicep curl (dumbbell)':['biceps','dumbbell'],'hammer curl (dumbbell)':['biceps','dumbbell'],'triceps pushdown':['triceps','cable'],'squat (barbell)':['quads','barbell'],'leg press':['quads','machine'],'leg extension':['quads','machine'],'romanian deadlift (barbell)':['hamstrings','barbell'],'lying leg curl':['hamstrings','machine'],'seated leg curl':['hamstrings','machine'],'hip thrust (barbell)':['glutes','barbell'],'standing calf raise':['calves','machine'],'cable crunch':['abs','cable'],'hanging leg raise':['abs','none','bw'],'plank':['abs','none','dur'],'treadmill incline walk':['cardio','machine','dd']};

let WPH={};
let GYMV='workout',ACTIVE=null,ROUTINES={list:[]},GLIB={custom:[]},WORKOUTS=[],gymLoaded=false,EXDB=null,EXMAP=new Map(),PHOTOS={};
let restEnd=LS.get('restEnd')||null,restTotal=LS.get('restTotal')||120,HIST_MODE='list',HIST_MONTH=null,STAT_P=12,STAT_M='volume';
const GSET={bar:20,plates:[25,20,15,10,5,2.5,1.25],...(LS.get('gymset')||{})};
function gymTypeFor(){if(planKind==='weekend')return DOWN==='Sun'?'lower':'upper';return 'upper'}
const e1=s=>(+s.kg||0)*(1+(+s.r||0)/30);
const fmtDur=ms=>{const s=Math.max(0,Math.floor(ms/1000));const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return h?`${h}h ${pad(m)}m`:`${m}:${pad(x)}`};
const kgs=v=>{const n=+v;return v!==''&&v!=null&&isFinite(n)?(Math.round(n*100)/100).toString():''};
const mmss=s=>{s=+s||0;return Math.floor(s/60)+':'+pad(Math.round(s%60))};
const pmmss=v=>{v=String(v||'').trim();if(!v)return '';if(v.includes(':')){const [m,s]=v.split(':');return (+m||0)*60+(+s||0)}return Math.round((+v||0)*60)};
const fmtVol=v=>Math.round(v||0).toLocaleString('en-GB');

/* ---------- exercise catalogue ---------- */
async function loadExDb(){if(EXDB)return;try{const r=await fetch('exdb.json?v=1');EXDB=await r.json()}catch(e){EXDB=[]}indexEx()}
let NMAP=new Map();function indexEx(){EXMAP=new Map();NMAP=new Map();(EXDB||[]).forEach(x=>EXMAP.set(x.id,x));
  Object.entries(LEGACY).forEach(([k,v])=>{const id='n:'+k;if(!EXMAP.has(id))EXMAP.set(id,{id,n:k.replace(/(^|\s|\()\S/g,c=>c.toUpperCase()),pm:[v[0]],sm:[],eq:v[1],ty:v[2]||'wr',legacy:1})});
  (GLIB.custom||[]).forEach(c=>{if(!c.id)c.id='c-'+norm(c.name||c.n).replace(/\s+/g,'-');EXMAP.set(c.id,{id:c.id,n:c.n||c.name,pm:c.pm||[(c.muscle||'other').toLowerCase()],sm:c.sm||[],eq:c.eq||c.equip||'other',ty:c.ty||'wr',custom:1})});
  EXMAP.forEach(e=>{const k=norm(e.n);if(!NMAP.has(k)||e.custom)NMAP.set(k,e)})}
function exOf(x){if(x.id&&EXMAP.has(x.id))return EXMAP.get(x.id);const k='n:'+norm(x.n||'');if(EXMAP.has(k))return EXMAP.get(k);const nm=NMAP.get(norm(x.n||''));if(nm)return nm;return {id:x.id||k,n:x.n,pm:['other'],sm:[],eq:'other',ty:'wr'}}
function exKey(x){return exOf(x).id}
function imgOf(e,i=0){if(e.custom&&PHOTOS[e.id])return PHOTOS[e.id];return e.img&&e.img[i]?IMGBASE+e.img[i]:''}
function thumb(e,cls='thumb'){const u=imgOf(e);return u?`<img class="${cls}" src="${esc(u)}" alt="" loading="lazy" decoding="async">`:`<span class="${cls} ph">${esc((e.pm[0]||'?').slice(0,2))}</span>`}
function allExList(){return [...EXMAP.values()].filter(e=>!e.legacy||usedCount(e.id))}
let USED=new Map();function recountUsed(){USED=new Map();WORKOUTS.forEach(w=>(w.ex||[]).forEach(x=>{const k=exKey(x);USED.set(k,(USED.get(k)||0)+1)}))}
function usedCount(id){return USED.get(id)||0}

function convertOld(s){return {id:'old-'+s.date,name:(s.type||'workout').replace(/^./,c=>c.toUpperCase()),date:s.date,startedAt:s.date+'T12:00:00',endedAt:null,ex:(s.ex||[]).filter(x=>x.sets&&x.sets.length).map(x=>({n:x.n,sets:x.sets.map(t=>({t:'n',kg:t.w,r:t.r,done:true}))})),vol:s.vol||0,nsets:s.nsets||0,prs:[]}}
async function loadGym(force){
  if(gymLoaded&&!force){renderGym();return}
  const [a,r,l,rows]=await Promise.all([load('gym/active'),load('gym/routines'),load('gym/lib'),listDocs('gym/'),loadExDb()]);
  ACTIVE=a&&a.ex?a:null;ROUTINES={list:[],...(r||{})};GLIB={custom:[],...(l||{})};
  const ws=[];PHOTOS={};rows.forEach(x=>{if(x.path.startsWith('gym/w-')&&x.data&&x.data.date)ws.push(x.data);else if(x.path.startsWith('gym/s-')&&x.data&&x.data.date&&(x.data.nsets||0)>0)ws.push(convertOld(x.data));else if(x.path.startsWith('gym/xp-')&&x.data&&x.data.img)PHOTOS[x.path.slice(7)]=x.data.img;else if(x.path.startsWith('gym/wp-')&&x.data&&x.data.imgs)WPH[x.path.slice(7)]=x.data.imgs});
  WORKOUTS=ws.sort((a,b)=>(b.startedAt||b.date)<(a.startedAt||a.date)?-1:1);indexEx();recountUsed();gymLoaded=true;renderGym();
}
let gymDefer=false;function typingInGym(){const a=document.activeElement;return a&&a.closest&&a.closest('#g-workout')&&/INPUT|TEXTAREA/.test(a.tagName)}
watch('gym/active',d=>{if(typingInGym()&&ACTIVE&&d&&d.id===ACTIVE.id){gymDefer=d;return}ACTIVE=d&&d.ex?d:null;if(cur==='gym')renderGym()});
document.addEventListener('focusout',()=>setTimeout(()=>{if(gymDefer&&!typingInGym()){ACTIVE=gymDefer.ex?gymDefer:ACTIVE;gymDefer=false;if(cur==='gym')renderGym()}},0));
watch('gym/routines',d=>{ROUTINES={list:[],...(d||{})};if(cur==='gym')renderGym()});
let GUNITS={};load('gym/units').then(d=>{GUNITS=d||{};if(cur==='gym')renderGym()});watch('gym/units',d=>{GUNITS=d||{};if(cur==='gym')renderGym()});
const LB=2.20462,isLb=id=>GUNITS[id]==='lb',uL=id=>isLb(id)?'lbs':'kg',uIn=(id,v)=>{if(v===''||v==null||!isFinite(+v))return v??'';return isLb(id)?kgs(Math.round(+v*LB*10)/10):kgs(v)},uOut=(id,v)=>{if(v===''||!isFinite(+v))return v;return isLb(id)?String(Math.round(+v/LB*10000)/10000):v},wU=(id,v)=>uIn(id,v)+' '+uL(id);
watch('gym/lib',d=>{GLIB={custom:[],...(d||{})};indexEx();if(cur==='gym')renderGym()});
watchPrefix('gym/w-',(evt,path,data)=>{const id=path.slice(6);WORKOUTS=WORKOUTS.filter(w=>w.id!==id);if(evt!=='DELETE'&&data)WORKOUTS.unshift(data);WORKOUTS.sort((a,b)=>(b.startedAt||b.date)<(a.startedAt||a.date)?-1:1);recountUsed();if(cur==='gym')renderGym()});
watchPrefix('gym/xp-',(evt,path,data)=>{const id=path.slice(7);if(evt==='DELETE')delete PHOTOS[id];else if(data&&data.img)PHOTOS[id]=data.img;if(cur==='gym')renderGym()});
let activeT=null;function saveActive(){clearTimeout(activeT);activeT=setTimeout(()=>{if(ACTIVE)save('gym/active',ACTIVE);else removeDoc('gym/active')},300)}

/* ---------- history helpers ---------- */
function exHistory(key,beforeId){return WORKOUTS.filter(w=>w.id!==beforeId).map(w=>({w,x:(w.ex||[]).find(x=>exKey(x)===key)})).filter(o=>o.x&&o.x.sets.some(s=>s.done!==false))}
function prevSets(x){const h=exHistory(exKey(x),ACTIVE&&ACTIVE.id)[0];return h?h.x.sets.filter(s=>s.done!==false):[]}
function bests(key,beforeId){let kg=0,e=0,vol=0,reps=0,sec=0,km=0;exHistory(key,beforeId).forEach(o=>o.x.sets.forEach(s=>{if(s.t==='w'||s.done===false)return;kg=Math.max(kg,+s.kg||0);e=Math.max(e,e1(s));vol=Math.max(vol,(+s.kg||0)*(+s.r||0));reps=Math.max(reps,+s.r||0);sec=Math.max(sec,+s.sec||0);km=Math.max(km,+s.km||0)}));return {kg,e,vol,reps,sec,km}}
function setLabel(sets,i){const s=sets[i];if(s.t==='w')return 'W';if(s.t==='d')return 'D';if(s.t==='f')return 'F';let n=0;for(let j=0;j<=i;j++)if(!sets[j].t||sets[j].t==='n')n++;return String(n)}
function volOf(x,s){const ty=exOf(x).ty;return (ty==='wr'||ty==='wbw')?(+s.kg||0)*(+s.r||0):0}
function NS(w){return (w.ex||[]).some(x=>x.sets&&x.sets.length)?stats(w).n:(w.nsets||0)}
function stats(w){let vol=0,n=0,reps=0;(w.ex||[]).forEach(x=>x.sets.forEach(s=>{if(s.done){if(s.t!=='w')n++;vol+=volOf(x,s);reps+=+s.r||0}}));return {vol,n,reps}}
function fmtSet(x,s){const xid=exOf(x).id,ty=exOf(x).ty;const T=XTYPES[ty]||XTYPES.wr;const p=[];
  if(T.f.includes('kg')&&s.kg!==''&&s.kg!=null)p.push((T.pfx||'')+uIn(xid,s.kg)+(isLb(xid)?'lb':'kg'));if(T.f.includes('km')&&s.km)p.push(kgs(s.km)+'km');if(T.f.includes('m')&&s.m)p.push(s.m+'m');
  if(T.f.includes('r')&&s.r)p.push((p.length?'× ':'')+s.r);if(T.f.includes('sec')&&s.sec)p.push(mmss(s.sec));let o=p.join(' ');if(s.rpe)o+=' @'+s.rpe;return o||'—'}
function bestSet(x){return x.sets.filter(s=>s.done!==false&&s.t!=='w').sort((a,b)=>e1(b)-e1(a)||(+b.r||0)-(+a.r||0)||(+b.sec||0)-(+a.sec||0))[0]}

/* ---------- shell ---------- */
function renderGym(){
  $('gymSeg').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.g===GYMV));
  ['workout','routines','history','stats','exercises','motivation'].forEach(v=>$('g-'+v).hidden=v!==GYMV);
  $('gymSub').textContent=ACTIVE?(ACTIVE.editing?'editing a past workout':'workout in progress'):(planKind==='weekend'?(DOWN==='Sun'?'plan today: lower 11:00':'plan today: upper 11:00'):(DOWN==='Tue'||DOWN==='Thu'?'plan today: upper 20:30':'rest day in the plan'));
  if(!EXDB){loadExDb().then(()=>{indexEx();renderGym()});}
  ({workout:renderWorkout,routines:renderRoutines,history:renderHistory,stats:renderStats,exercises:renderLibrary,motivation:renderMotivation})[GYMV]();renderRest();
}
$('gymSeg').onclick=e=>{const b=e.target.closest('button');if(!b)return;GYMV=b.dataset.g;renderGym();staggerIn($('g-'+GYMV))};

/* ---------- workout ---------- */
const SSCOL=['#05d9e8','#ffb000','#b967ff','#57f5a8','#ff6b6b'];
function ssColor(ss){if(!ss||!ACTIVE)return '';const ids=[...new Set(ACTIVE.ex.map(x=>x.ss).filter(Boolean))];return SSCOL[ids.indexOf(ss)%SSCOL.length]}
function renderWorkout(){if(ACTIVE&&!ACTIVE.editing)ascPrime();
  const el=$('g-workout');
  if(!ACTIVE){
    const sug=gymTypeFor();const folders={};ROUTINES.list.forEach(r=>(folders[r.folder||'my routines']=folders[r.folder||'my routines']||[]).push(r));
    domPatch(el,`<div class="gstart">${rlWindow()}
      <button class="bigstart" type="button" data-act="empty"><span class="tag">Quick start</span><b>Start empty workout</b><span class="dim">Log as you go</span></button>
      ${Object.entries(folders).map(([f,rs])=>`<div class="rgrid">${rs.map(r=>rCard(r,norm(r.name).includes(sug))).join('')}</div>`).join('')||'<div class="dim" style="font-size:12px">No routines yet. Make an "Upper" and a "Lower" one so starting a session is one tap.</div>'}
      ${WORKOUTS[0]?`<div class="ph2"><span class="tag">Last workout</span></div>${wCard(WORKOUTS[0])}`:''}
    </div>`);return}
  const st=stats(ACTIVE);const ed=!!ACTIVE.editing;
  domPatch(el,`<div class="wbar"><input class="wname" id="wName" value="${esc(ACTIVE.name)}" aria-label="Workout name"><div class="wstats"><div><span class="dim">${ed?'date':'duration'}</span><b class="num" id="wDur">${ed?esc(nice(ACTIVE.date).toLowerCase()):fmtDur(Date.now()-new Date(ACTIVE.startedAt))}</b></div><div><span class="dim">Volume</span><b class="num">${fmtVol(st.vol)} kg</b></div><div><span class="dim">Sets</span><b class="num">${st.n}</b></div><div><span class="dim">Session rank</span>${rlChip(rlLive(),18)}</div></div><div class="row"><button class="btn" type="button" data-act="discard">${ed?'cancel':'discard'}</button><button class="btn p" type="button" data-act="finish">${ed?'save':'finish'}</button></div></div>
  <textarea class="wnote" id="wNote" rows="1" placeholder="Workout notes">${esc(ACTIVE.note||'')}</textarea>
  <div class="exlist">${ACTIVE.ex.map((x,xi)=>exCard(x,xi)).join('')}</div>
  <button class="addex" type="button" data-act="addex">+ Add exercises</button>`);
  const wn=$('wNote');if(wn&&wn.value){wn.style.height='auto';wn.style.height=wn.scrollHeight+'px'}
}
function exCard(x,xi){
  const e=exOf(x);const T=XTYPES[e.ty]||XTYPES.wr;const prev=prevSets(x);const b=bests(e.id,ACTIVE.id);const col=ssColor(x.ss);
  const cols=`34px minmax(0,1fr) ${T.f.map(()=>'minmax(52px,64px)').join(' ')} 40px 38px`;
  return `<div class="exc${x.ss?' ss':''}" data-x="${xi}" style="${x.ss?'--ssc:'+col:''}">${x.ss?`<span class="sslab">Superset</span>`:''}
  <div class="exh"><button class="exhead" type="button" data-exinfo="${xi}">${thumb(e)}<span><b class="exname">${esc(e.n)}</b><span class="dim exsub">${esc(e.pm.join(', '))}${T!==XTYPES.wr?' · '+T.l:''}</span>${(()=>{const sc=rlEx(e.id,ACTIVE.id,x);return sc==null?'':rlChip(sc,18)})()}</span></button><button class="iconbtn" type="button" data-exmenu="${xi}" aria-label="Exercise options">⋯</button></div>
  <input class="exnote" data-note="${xi}" placeholder="Add notes here…" value="${esc(x.note||'')}" aria-label="Notes">
  <button class="resttag" type="button" data-restpick="${xi}">⧗ rest timer: ${x.rest?mmss(x.rest):'off'}</button>
  <div class="sgrid shead" style="grid-template-columns:${cols}"><span>Set</span><span>Previous</span>${T.f.map(f=>f==='kg'?`<button class="uswap" type="button" data-unit="${xi}" title="Switch kg / lbs">${(T.pfx||'')+uL(e.id)} ⇄</button>`:`<span>${FLAB[f]}</span>`).join('')}<span>RPE</span><span>✓</span></div>
  ${x.sets.map((s,si)=>{const p=prev[si];const pr=s.done&&s.t!=='w'&&isPR(e,s,b);return `<div class="sgrid srow${s.done?' done':''}${pr?' pr':''}" data-s="${xi}:${si}" style="grid-template-columns:${cols}">
    <button class="stype t-${s.t||'n'}" type="button" data-stype="${xi}:${si}" title="Set type">${setLabel(x.sets,si)}</button>
    <button class="sprev" type="button" data-prev="${xi}:${si}" ${p?'':'disabled'}>${p?esc(fmtSet(x,p)):'—'}</button>
    ${T.f.map(f=>{const v=f==='sec'?(s.sec?mmss(s.sec):''):f==='kg'?uIn(e.id,s.kg):(s[f]??'');const ph=p?(f==='sec'?(p.sec?mmss(p.sec):''):f==='kg'?uIn(e.id,p.kg):(p[f]??'')):'';return `<input class="sin num" inputmode="${f==='r'||f==='m'?'numeric':f==='sec'?'text':'decimal'}" data-f="${f}" data-at="${xi}:${si}" value="${esc(v)}" placeholder="${esc(ph)}" aria-label="${FLAB[f]}">`}).join('')}
    <button class="srpe${s.rpe?' on':''}" type="button" data-rpe="${xi}:${si}">${s.rpe||'·'}</button>
    <button class="scheck" type="button" data-done="${xi}:${si}" aria-pressed="${!!s.done}" aria-label="Complete set">✓</button>
    ${pr?'<span class="prtag">PR</span>':''}</div>`}).join('')}
  <button class="addset" type="button" data-addset="${xi}">+ Add set</button></div>`;
}
function isPR(e,s,b){if(e.ty==='wr'||e.ty==='wbw')return b.e>0&&e1(s)>b.e;if(e.ty==='bw'||e.ty==='r')return b.reps>0&&+s.r>b.reps;if(e.ty==='dur')return b.sec>0&&+s.sec>b.sec;if(e.ty==='dd')return b.km>0&&+s.km>b.km;return false}
function rCard(r,hot){return `<div class="rcard${hot?' hot':''}"><div class="rtop"><b>${esc(r.name)}</b><span class="row" style="gap:4px">${hot?'<span class="chipy hot">Today</span>':''}<button class="iconbtn" type="button" data-rmenu="${esc(r.id)}" aria-label="Routine options">⋯</button></span></div>
  <div class="rthumbs">${r.ex.slice(0,6).map(x=>thumb(exOf(x),'rth')).join('')}</div><span class="dim rsum">${esc(r.ex.map(x=>exOf(x).n).join(', ')||'no exercises yet')}</span><button class="btn p" type="button" data-start="${esc(r.id)}">Start routine</button></div>`}
function wCard(w){const st={vol:w.vol??stats(w).vol,n:NS(w)};const dur=w.endedAt&&w.startedAt?fmtDur(new Date(w.endedAt)-new Date(w.startedAt)):'';
  return `<div class="wcard" data-w="${esc(w.id)}">${(WPH[w.id]||[])[0]?`<img class="wcimg" src="${WPH[w.id][0]}" alt="">`:''}<div class="rtop"><b>${esc(w.name)}</b><span class="dim">${esc(nice(w.date))}</span></div><div class="wcrank">${rlChip(rlSession(w),18)}</div>
  <div class="wmeta num"><span>${dur||'—'}</span><span>${fmtVol(st.vol)} kg</span><span>${st.n||0} sets</span>${(w.prs||[]).length?`<span class="pink">${w.prs.length} PR</span>`:''}</div>
  <div class="wex">${(w.ex||[]).map(x=>{const bs=bestSet(x);return `<div><span>${x.sets.filter(s=>s.done!==false&&s.t!=='w').length} × ${esc(exOf(x).n)}</span><span class="dim num">${bs?esc(fmtSet(x,bs)):''}</span></div>`}).join('')}</div></div>`}
function newSetsFor(x,count){const ps=prevSets(x);return Array.from({length:count},(_,i)=>({t:(ps[i]&&ps[i].t)||'n',kg:'',r:'',done:false}))}
function exEntry(e,opt={}){const x={id:e.id,n:e.n,rest:opt.rest??(e.ty==='dur'||e.ty==='dd'?0:120),note:opt.note||'',ss:opt.ss||null,sets:[]};const ps=prevSets(x);x.sets=newSetsFor(x,opt.sets||Math.max(1,Math.min(ps.length||3,8)));if(opt.reps)x.sets.forEach(s=>s.tr=opt.reps);return x}
function startWorkout(r){
  ACTIVE={id:new Date().toISOString().replace(/[:.]/g,'-'),name:r?r.name:(gymTypeFor()==='lower'?'Lower':'Upper'),routineId:r?r.id:null,startedAt:new Date().toISOString(),note:'',
    ex:r?r.ex.map(x=>exEntry(exOf(x),x)):[]};
  saveActive();GYMV='workout';renderGym();flash('workout_started');staggerIn($('g-workout'));
}
function editWorkout(w){if(ACTIVE&&!ACTIVE.editing){flash('finish_current_first');return}ACTIVE={...clone(w),editing:true};ACTIVE.ex.forEach(x=>x.sets.forEach(s=>s.done=true));GYMV='workout';closeSheet();renderGym()}
function mut(fn){fn();saveActive();renderWorkout()}
const SXY=v=>v.split(':').map(Number);
$('g-workout').addEventListener('click',e=>{
  const t=e.target.closest('button');if(!t)return;const d=t.dataset;
  if(d.act==='empty')return startWorkout(null);
  if(d.start)return startWorkout(ROUTINES.list.find(r=>r.id===d.start));
  if(d.unit!=null)return toggleUnit(exOf(ACTIVE.ex[+d.unit]).id);
  if(d.rmenu)return routineMenu(d.rmenu);
  if(d.act==='newroutine'){GYMV='routines';renderGym();return editRoutine(null)}
  if(d.act==='explore'){GYMV='exercises';return renderGym()}
  if(d.act==='addex')return pickExercises(list=>mut(()=>list.forEach(ex=>ACTIVE.ex.push(exEntry(ex)))));
  if(d.act==='discard'){if(ACTIVE.editing){ACTIVE=null;saveActive();renderGym();return}if(t.dataset.arm){ACTIVE=null;saveActive();clearRest();renderGym();glitchAll()}else{t.dataset.arm=1;t.textContent='tap again';setTimeout(()=>{if(t.isConnected){delete t.dataset.arm;t.textContent='discard'}},2500)}return}
  if(d.act==='finish')return finishWorkout();
  if(d.exinfo)return openExercise(exOf(ACTIVE.ex[+d.exinfo]).id);
  if(d.exmenu)return exMenu(+d.exmenu);
  if(d.restpick)return restPicker(+d.restpick);
  if(d.addset){const xi=+d.addset;return mut(()=>{const x=ACTIVE.ex[xi];const l=x.sets[x.sets.length-1];x.sets.push({t:'n',kg:l?l.kg:'',r:l?l.r:'',sec:l?l.sec:'',km:l?l.km:'',m:l?l.m:'',done:false})})}
  if(d.stype){const [xi,si]=SXY(d.stype);return setTypeMenu(xi,si)}
  if(d.rpe){const [xi,si]=SXY(d.rpe);return rpeMenu(xi,si)}
  if(d.prev){const [xi,si]=SXY(d.prev);const p=prevSets(ACTIVE.ex[xi])[si];if(p)return mut(()=>{const s=ACTIVE.ex[xi].sets[si];['kg','r','sec','km','m'].forEach(f=>{if(p[f]!=null&&p[f]!=='')s[f]=p[f]})})}
  if(d.done){const [xi,si]=SXY(d.done);const x=ACTIVE.ex[xi];const s=x.sets[si];const ex=exOf(x);const T=XTYPES[ex.ty]||XTYPES.wr;
    if(!s.done){const p=prevSets(x)[si];T.f.forEach(f=>{if((s[f]===''||s[f]==null)&&p&&p[f]!=null)s[f]=p[f]});
      const ok=T.f.every(f=>f==='kg'||(+s[f]>0));if(!ok){const row=t.closest('.srow');row&&row.animate&&row.animate([{transform:'translateX(-6px)'},{transform:'translateX(6px)'},{transform:'none'}],{duration:220});return}}
    const rb=s.done?null:rlEx(ex.id,ACTIVE.id,x);
    s.done=!s.done;s.at=s.done?new Date().toISOString():null;const ra=s.done&&rb!=null?rlEx(ex.id,ACTIVE.id,x):null;if(ra!=null&&Math.floor(ra)>Math.floor(rb)){if(!ascRank(ex,rb,ra))setTimeout(()=>rlUpToast(ex.n,rb,ra),350)}const b=bests(ex.id,ACTIVE.id);const pr=s.done&&s.t!=='w'&&isPR(ex,s,b);if(s.done)ascCheck(ex,s,b.kg);
    saveActive();renderWorkout();
    if(s.done){const row=document.querySelector(`.srow[data-s="${xi}:${si}"]`);if(row)burstEl(row.querySelector('.scheck'),pr?90:24,pr);if(pr){flash('new_pr');shake()}
      const grp=x.ss?ACTIVE.ex.filter(y=>y.ss===x.ss):[x];if(!ACTIVE.editing&&x.rest&&grp[grp.length-1]===x)startRest(x.rest)}
    if(s.done&&stats(ACTIVE).n===1&&!ACTIVE.editing)autoTick(/^Gym\b/);
  }
});
$('g-workout').addEventListener('input',e=>{const t=e.target;const d=t.dataset;
  if(t.id==='wName'){ACTIVE.name=t.value;saveActive();return}
  if(t.id==='wNote'){ACTIVE.note=t.value;t.style.height='auto';t.style.height=t.scrollHeight+'px';saveActive();return}
  if(d.note!=null){ACTIVE.ex[+d.note].note=t.value;saveActive();return}
  if(d.f){const [xi,si]=SXY(d.at);const s=ACTIVE.ex[xi].sets[si];const f=d.f;const v=t.value.replace(',','.');s[f]=f==='sec'?pmmss(t.value):f==='kg'?uOut(exOf(ACTIVE.ex[xi]).id,v):v;saveActive()}
});
$('g-workout').addEventListener('change',e=>{if(e.target.dataset.f)renderWorkout()});

/* set type / rpe / rest pickers */
function setTypeMenu(xi,si){openSheet('set type',`<div class="optlist">${[['n','normal set','1'],['w','warm-up set','W'],['d','drop set','D'],['f','failure set','F']].map(([k,l,s])=>`<button class="opt" type="button" data-ty="${k}"><span class="stype t-${k}">${s}</span>${l}</button>`).join('')}<button class="opt bad" type="button" data-ty="del"><span class="stype">✕</span>Remove set</button></div>`);
  $('sheetBody').onclick=e=>{const b=e.target.closest('[data-ty]');if(!b)return;closeSheet();mut(()=>{const x=ACTIVE.ex[xi];if(b.dataset.ty==='del')x.sets.splice(si,1);else x.sets[si].t=b.dataset.ty})}}
function rpeMenu(xi,si){const s=ACTIVE.ex[xi].sets[si];const vals=[6,6.5,7,7.5,8,8.5,9,9.5,10];const txt={6:'could do 4+ more reps',7:'could do 3 more',7.5:'2–3 more',8:'2 more reps',8.5:'1–2 more',9:'1 more rep',9.5:'maybe 1 more',10:'max effort',6.5:'3–4 more'};
  openSheet('rpe · rate of perceived exertion',`<div class="rpegrid">${vals.map(v=>`<button type="button" class="rpeb${s.rpe==v?' on':''}" data-v="${v}"><b>${v}</b><span>${txt[v]}</span></button>`).join('')}</div><button class="btn" type="button" data-v="" style="margin-top:10px">Clear</button>`);
  $('sheetBody').onclick=e=>{const b=e.target.closest('[data-v]');if(!b)return;closeSheet();mut(()=>{s.rpe=b.dataset.v?+b.dataset.v:null})}}
function restPicker(xi){const x=ACTIVE?ACTIVE.ex[xi]:null;const opts=[0,30,45,60,75,90,105,120,150,180,210,240,300];
  openSheet('rest timer',`<div class="chips">${opts.map(s=>`<button class="chip" type="button" data-s="${s}" aria-pressed="${(x.rest||0)===s}">${s?mmss(s):'off'}</button>`).join('')}</div>`);
  $('sheetBody').onclick=e=>{const b=e.target.closest('[data-s]');if(!b)return;closeSheet();mut(()=>{x.rest=+b.dataset.s;if(x.ss)ACTIVE.ex.filter(y=>y.ss===x.ss).forEach(y=>y.rest=x.rest)})}}

/* exercise ⋯ menu */
function exMenu(xi){const x=ACTIVE.ex[xi];const e=exOf(x);const T=XTYPES[e.ty]||XTYPES.wr;
  openSheet(e.n,`<div class="optlist">
   <button class="opt" type="button" data-m="info">ⓘ exercise info &amp; history</button>
   <button class="opt" type="button" data-m="ss">⛓ ${x.ss?'remove from superset':'superset with…'}</button>
   <button class="opt" type="button" data-m="replace">⇄ replace exercise</button>
   ${T.f.includes('kg')?'<button class="opt" type="button" data-m="unit">⇄ use '+(isLb(e.id)?'kg':'lbs')+' for this exercise</button><button class="opt" type="button" data-m="warm">Add warm-up sets</button><button class="opt" type="button" data-m="plates">◎ plate calculator</button>':''}
   <button class="opt" type="button" data-m="up">↑ move up</button><button class="opt" type="button" data-m="down">↓ move down</button>
   <button class="opt bad" type="button" data-m="rm">✕ remove exercise</button></div>`);
  $('sheetBody').onclick=ev=>{const b=ev.target.closest('[data-m]');if(!b)return;const m=b.dataset.m;
    if(m==='info')return openExercise(e.id);
    if(m==='unit'){closeSheet();return toggleUnit(e.id)}
    if(m==='rm'){closeSheet();return mut(()=>ACTIVE.ex.splice(xi,1))}
    if(m==='up'||m==='down'){closeSheet();const j=xi+(m==='up'?-1:1);if(j<0||j>=ACTIVE.ex.length)return;return mut(()=>{const a=ACTIVE.ex;[a[xi],a[j]]=[a[j],a[xi]]})}
    if(m==='replace'){return pickExercises(list=>{const n=list[0];if(!n)return;mut(()=>{const y=exEntry(n,{sets:x.sets.length,rest:x.rest,ss:x.ss});ACTIVE.ex[xi]=y})},{single:true})}
    if(m==='ss'){if(x.ss){closeSheet();return mut(()=>{const g=x.ss;x.ss=null;const left=ACTIVE.ex.filter(y=>y.ss===g);if(left.length<2)left.forEach(y=>y.ss=null)})}
      const others=ACTIVE.ex.map((y,i)=>[y,i]).filter(([y,i])=>i!==xi);if(!others.length){flash('add_another_exercise');return}
      openSheet('superset with',`<div class="optlist">${others.map(([y,i])=>`<button class="opt" type="button" data-with="${i}">${thumb(exOf(y),'rth')} ${esc(exOf(y).n)}</button>`).join('')}</div>`);
      $('sheetBody').onclick=ev2=>{const b2=ev2.target.closest('[data-with]');if(!b2)return;const j=+b2.dataset.with;closeSheet();mut(()=>{const y=ACTIVE.ex[j];const g=y.ss||x.ss||rid();x.ss=g;y.ss=g;x.rest=y.rest;const a=ACTIVE.ex;const xo=a.splice(a.indexOf(x),1)[0];a.splice(a.indexOf(y)+1,0,xo)})};return}
    if(m==='warm'){const work=x.sets.find(s=>s.t!=='w'&&+s.kg>0)||prevSets(x).find(s=>s.t!=='w'&&+s.kg>0);if(!work){flash('enter_a_weight_first');return}closeSheet();
      const W=+work.kg;const r=v=>Math.max(GSET.bar,Math.round(v/2.5)*2.5);mut(()=>x.sets.unshift({t:'w',kg:r(W*.4),r:10,done:false},{t:'w',kg:r(W*.6),r:6,done:false},{t:'w',kg:r(W*.8),r:3,done:false}));return}
    if(m==='plates'){const s=x.sets.find(s=>!s.done&&+s.kg>0)||x.sets.find(s=>+s.kg>0);return plateCalc(s?+s.kg:60)}
  }}
function plateCalc(target){const draw=()=>{let side=(target-GSET.bar)/2;const used=[];GSET.plates.forEach(p=>{while(side>=p-1e-9){used.push(p);side=Math.round((side-p)*1000)/1000}});
    $('pcOut').innerHTML=`<div class="barviz"><span class="bar"></span>${used.map(p=>`<span class="plate" style="height:${30+p*2.4}px" title="${p}kg">${p}</span>`).join('')}</div><div class="dim" style="font-size:12px;margin-top:8px">each side: ${used.length?used.join(' + ')+' kg':'nothing'}${side>0?` · ${kgs(side*2)}kg can't be made`:''}</div>`};
  openSheet('plate calculator',`<div class="row" style="gap:10px;align-items:end;flex-wrap:wrap"><label class="dim">Target kg<input class="inp num" id="pcT" value="${kgs(target)}" inputmode="decimal" style="width:90px;display:block"></label><label class="dim">Bar kg<input class="inp num" id="pcB" value="${GSET.bar}" inputmode="decimal" style="width:70px;display:block"></label></div><div id="pcOut" style="margin-top:14px"></div>`);
  draw();$('pcT').oninput=e=>{target=+e.target.value||0;draw()};$('pcB').oninput=e=>{GSET.bar=+e.target.value||0;LS.set('gymset',GSET);draw()}}

function finishWorkout(){
  if(ACTIVE.editing){const w=clone(ACTIVE);delete w.editing;w.ex=w.ex.map(x=>({...x,sets:x.sets.filter(s=>s.done)})).filter(x=>x.sets.length);const st=stats(w);w.vol=st.vol;w.nsets=st.n;
    save('gym/w-'+w.id,w,true);const i=WORKOUTS.findIndex(y=>y.id===w.id);if(i>=0)WORKOUTS[i]=w;ACTIVE=null;saveActive();recountUsed();renderGym();flash('saved');return}
  const undone=ACTIVE.ex.reduce((a,x)=>a+x.sets.filter(s=>!s.done).length,0);
  const go2=(dropUndone)=>{
    const w=clone(ACTIVE);w.endedAt=new Date().toISOString();w.date=ymd(logical(new Date(w.startedAt)));
    w.ex=w.ex.map(x=>({...x,sets:x.sets.filter(s=>s.done||(!dropUndone&&(+s.r>0||+s.sec>0))).map(s=>({...s,done:true}))})).filter(x=>x.sets.length);
    const prs=[];w.ex.forEach(x=>{const e=exOf(x);const b=bests(e.id,w.id);let mk=0,me=0,mv=0,mr=0,ms=0,mkm=0;x.sets.forEach(s=>{if(s.t==='w')return;mk=Math.max(mk,+s.kg||0);me=Math.max(me,e1(s));mv=Math.max(mv,(+s.kg||0)*(+s.r||0));mr=Math.max(mr,+s.r||0);ms=Math.max(ms,+s.sec||0);mkm=Math.max(mkm,+s.km||0)});
      const had=exHistory(e.id,w.id).length>0;if(!had)return;
      if(e.ty==='wr'||e.ty==='wbw'){if(mk>b.kg)prs.push({n:e.n,kind:'heaviest weight',v:kgs(mk)+' kg'});if(me>b.e)prs.push({n:e.n,kind:'best est. 1RM',v:kgs(Math.round(me*10)/10)+' kg'});if(mv>b.vol)prs.push({n:e.n,kind:'best set volume',v:fmtVol(mv)+' kg'})}
      else if(e.ty==='bw'||e.ty==='r'){if(mr>b.reps)prs.push({n:e.n,kind:'most reps',v:mr})}else if(e.ty==='dur'){if(ms>b.sec)prs.push({n:e.n,kind:'longest',v:mmss(ms)})}else if(e.ty==='dd'){if(mkm>b.km)prs.push({n:e.n,kind:'furthest',v:kgs(mkm)+' km'})}});
    const st=stats(w);w.vol=st.vol;w.nsets=st.n;w.prs=prs;
    if(!w.ex.length){ACTIVE=null;saveActive();renderGym();return}
    saveScreen(w,()=>commit(w));};
  const commit=w=>{
    const pre=rlOverall();save('gym/w-'+w.id,w,true);WORKOUTS.unshift(w);recountUsed();ACTIVE=null;saveActive();clearRest();
    autoTick(/^Gym\b/);shake();renderGym();rlAfter(pre,w,()=>showSummary(w));
  };
  if(undone){openSheet('finish workout?',`<p class="dim" style="margin:0 0 14px">${undone} set${undone>1?'s':''} not ticked.</p><div class="bigbtns"><button class="btn p" type="button" id="fDrop">Discard unticked + finish</button><button class="btn" type="button" id="fKeep">Keep sets with values</button><button class="btn" type="button" id="fBack">Back</button></div>`);
    $('fDrop').onclick=()=>{closeSheet();go2(true)};$('fKeep').onclick=()=>{closeSheet();go2(false)};$('fBack').onclick=closeSheet}
  else go2(true);
}
/* Hevy-style "save workout": title, stats, photos, description — then the summary */
function saveScreen(w,done){let imgs=[];
  const draw=()=>{const ph=$('swPh');if(!ph)return;ph.innerHTML=imgs.map((s,i)=>`<div class="swimg"><img src="${s}" alt=""><button type="button" data-swdel="${i}" aria-label="Remove photo">✕</button></div>`).join('')+(imgs.length<4?`<label class="swadd"><input type="file" accept="image/*" id="swFile" hidden multiple><span>＋</span><small>Add photo</small></label>`:'');
    const f=$('swFile');if(f)f.onchange=async e=>{for(const file of [...e.target.files].slice(0,4-imgs.length)){try{imgs.push(await resizeImg(file,1080))}catch(x){}}draw()}};
  openSheet('save workout',`<input class="inp swtitle" id="swName" value="${esc(w.name)}" aria-label="Workout title">
  <div class="wstats big" style="margin:12px 0"><div><span class="dim">Duration</span><b class="num">${fmtDur(new Date(w.endedAt)-new Date(w.startedAt))}</b></div><div><span class="dim">Volume</span><b class="num">${fmtVol(w.vol)} kg</b></div><div><span class="dim">Sets</span><b class="num">${NS(w)}</b></div><div><span class="dim">Records</span><b class="num pink">${w.prs.length}</b></div></div>
  <div class="dim" style="font-size:12px;margin-bottom:6px">when · ${esc(nice(w.date))} · ${new Date(w.startedAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</div>
  <div class="swph" id="swPh"></div>
  <textarea class="inp" id="swDesc" rows="3" placeholder="How did it go? share more about your workout…" style="margin-top:10px">${esc(w.note||'')}</textarea>
  <div class="bigbtns" style="margin-top:14px"><button class="btn" type="button" id="swBack">Resume</button><span style="flex:1"></span><button class="btn p" type="button" id="swSave">Save workout</button></div>`);
  draw();
  $('swPh').onclick=e=>{const b=e.target.closest('[data-swdel]');if(b){imgs.splice(+b.dataset.swdel,1);draw()}};
  $('swBack').onclick=closeSheet;
  $('swSave').onclick=()=>{w.name=$('swName').value.trim()||w.name;w.note=$('swDesc').value.trim();if(imgs.length){w.photos=imgs.length;WPH[w.id]=imgs;save('gym/wp-'+w.id,{imgs},true)}closeSheet();done()}}
function workoutNo(w){return WORKOUTS.slice().reverse().findIndex(x=>x.id===w.id)+1}
function showSummary(w){const muscles=muscleSets([w]);const top=Object.entries(muscles).sort((a,b)=>b[1]-a[1]).slice(0,6);const mx=Math.max(1,...top.map(t=>t[1]));
  openSheet('workout complete',`${(WPH[w.id]||[]).length?`<div class="swgal">${WPH[w.id].map(s=>`<img src="${s}" alt="">`).join('')}</div>`:''}${(()=>{const sc=rlSession(w),r=rlOf(sc);const ups=w.ex.map(x=>{const ex=exOf(x);const a=rlEx(ex.id,w.id),b=rlEx(ex.id);return b==null?null:[ex.n,a,b]}).filter(Boolean);return `<div class="rlsum" style="--rc:${RL[r.t][1]}">${rlBadge(sc,72)}<div><span class="dim">Session rank</span><b>${r.name}</b></div></div>${ups.length?`<div class="rlups">${ups.map(([n,a,b])=>`<div>${rlBadge(b,22)}<span>${esc(n)}</span><b style="color:${RL[rlOf(b).t][1]}">${rlOf(b).name}</b>${a!=null&&Math.floor(b)>Math.floor(a)?'<em>▲ rank up</em>':''}</div>`).join('')}</div>`:''}`})()}<div class="sumhero"><span class="tag">workout #${workoutNo(w)}</span><b class="glitch" data-text="${esc(w.name)}">${esc(w.name)}</b><span class="dim">${esc(nice(w.date))}</span></div>
  <div class="wstats big"><div><span class="dim">Duration</span><b class="num">${fmtDur(new Date(w.endedAt)-new Date(w.startedAt))}</b></div><div><span class="dim">Volume</span><b class="num">${fmtVol(w.vol)} kg</b></div><div><span class="dim">Sets</span><b class="num">${NS(w)}</b></div><div><span class="dim">Records</span><b class="num pink">${w.prs.length}</b></div></div>
  ${w.prs.length?`<div class="prlist">${w.prs.map(p=>`<div><span class="medal">PR</span> ${esc(p.n)} · ${esc(p.kind)} <b class="num">${esc(String(p.v))}</b></div>`).join('')}</div>`:''}
  ${top.length?`<div class="mbars" style="margin-top:12px">${top.map(([m,v])=>`<div><span>${esc(m)}</span><i style="--w:${v/mx*100}%"></i><b class="num">${kgs(v)}</b></div>`).join('')}</div>`:''}
  <div class="bigbtns" style="margin-top:16px">${w.routineId?'<button class="btn" type="button" id="updR">Update routine</button>':'<button class="btn" type="button" id="saveR">Save as routine</button>'}<button class="btn p" type="button" id="sumOk">Done</button></div>`);
  $('sumOk').onclick=closeSheet;
  if($('saveR'))$('saveR').onclick=()=>{ROUTINES.list.push(routineFrom(w));save('gym/routines',ROUTINES);closeSheet();flash('saved')};
  if($('updR'))$('updR').onclick=()=>{const r=ROUTINES.list.find(x=>x.id===w.routineId);if(r){const n=routineFrom(w);r.ex=n.ex}save('gym/routines',ROUTINES);closeSheet();flash('saved')};
}
function routineFrom(w){return {id:rid(),name:w.name,folder:'',ex:w.ex.map(x=>({id:exKey(x),n:exOf(x).n,sets:x.sets.filter(s=>s.t!=='w').length||x.sets.length,rest:x.rest??120,note:x.note||'',ss:x.ss||null}))}}

/* ---------- rest timer ---------- */
function startRest(sec){restTotal=sec;restEnd=Date.now()+sec*1000;LS.set('restEnd',restEnd);LS.set('restTotal',restTotal);renderRest();if(nOn('rest')){let nx='';try{for(const x of ACTIVE.ex){if(x.sets.some(s=>!s.done)){nx=exOf(x).n;break}}}catch(e){}pushOne('rest',restEnd,'Rest complete',nx?'Next up: '+nx:'Time for your next set','./#gym')}}
let restOk=null;
function clearRest(){restEnd=null;LS.set('restEnd',null);$('restDock').classList.remove('on');pushCancel('rest')}
function renderRest(){const bar=$('restDock');if(!restEnd){bar.classList.remove('on');return}bar.classList.add('on')}
$('restDock').onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.rd==='skip'){restEnd=null;LS.set('restEnd',null);renderRest();pushCancel('rest');return}const d=+b.dataset.rd;restEnd=Math.max(Date.now()+1000,restEnd+d*1000);restTotal=Math.max(15,restTotal+d);LS.set('restEnd',restEnd);LS.set('restTotal',restTotal);if(nOn('rest'))pushOne('rest',restEnd,'Rest complete','Time for your next set','./#gym')};
function beep(){try{const A=window.AudioContext||window.webkitAudioContext;const a=new A();[0,.18,.36].forEach((t,i)=>{const o=a.createOscillator(),g=a.createGain();o.frequency.value=i===2?1320:880;g.gain.setValueAtTime(.0001,a.currentTime+t);g.gain.exponentialRampToValueAtTime(.25,a.currentTime+t+.01);g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+t+.15);o.connect(g);g.connect(a.destination);o.start(a.currentTime+t);o.stop(a.currentTime+t+.16)})}catch(e){}}
setInterval(()=>{
  if(ACTIVE&&!ACTIVE.editing&&$('wDur'))$('wDur').textContent=fmtDur(Date.now()-new Date(ACTIVE.startedAt));
  if(!restEnd)return;
  // no workout running (finished, discarded, ended on another device) or the timer ran out long ago: drop it silently
  if((gymLoaded&&(!ACTIVE||ACTIVE.editing))||Date.now()-restEnd>10000){clearRest();return}
  if(!gymLoaded){if(restOk==null){restOk=false;load('gym/active').then(x=>{restOk=!!(x&&x.ex&&!x.editing);if(!restOk)clearRest()}).catch(()=>{restOk=null})}if(!restOk)return}
  const l=Math.max(0,Math.round((restEnd-Date.now())/1000));$('restT').textContent=Math.floor(l/60)+':'+pad(l%60);$('restBar').style.width=Math.min(100,100-l/restTotal*100)+'%';$('restDock').classList.add('on');
  if(l===0){restEnd=null;LS.set('restEnd',null);$('restDock').classList.remove('on');flash('go');beep();try{navigator.vibrate&&navigator.vibrate([200,80,200])}catch(e){}}
},250);

/* ---------- routines (with folders) ---------- */
const FOLDC=new Set(LS.get('gymfold')||[]);
function allFolders(){const f=[...(ROUTINES.folders||[])];ROUTINES.list.forEach(r=>{if(r.folder&&!f.includes(r.folder))f.push(r.folder)});return f}
function saveR(){save('gym/routines',ROUTINES);renderGym()}
function renderRoutines(){const fs=allFolders();const loose=ROUTINES.list.filter(r=>!r.folder);
  const grp=(f,rs)=>{const shut=FOLDC.has(f);return `<div class="fold fhead"><button type="button" class="fbtn" data-fold="${esc(f)}">${shut?'▸':'▾'} ${esc(f)} <span class="dim">· ${rs.length}</span></button><button class="iconbtn" type="button" data-fmenu="${esc(f)}" aria-label="Folder options">⋯</button></div>${shut?'':`<div class="rgrid">${rs.map(r=>rCard(r,false)).join('')||'<div class="dim">Empty — move routines here from their ⋯ menu.</div>'}</div>`}`};
  $('g-routines').innerHTML=`<div class="ph2"><span class="tag">${ROUTINES.list.length} routines</span><span class="row" style="gap:6px"><button class="btn" type="button" data-r="folder">+ Folder</button><button class="btn p" type="button" data-r="new">+ New routine</button></span></div>
  ${fs.map(f=>grp(f,ROUTINES.list.filter(r=>r.folder===f))).join('')}${loose.length?(fs.length?`<div class="fold"><span class="dim">no folder · ${loose.length}</span></div>`:'')+`<div class="rgrid">${loose.map(r=>rCard(r,false)).join('')}</div>`:''}${!ROUTINES.list.length&&!fs.length?'<div class="dim">No routines yet.</div>':''}`}
function newFolder(then){const n=(prompt('Folder name')||'').trim();if(!n)return;ROUTINES.folders=allFolders();if(!ROUTINES.folders.includes(n))ROUTINES.folders.push(n);then&&then(n);saveR()}
function folderMenu(f){openSheet(f,`<div class="optlist"><button class="opt" type="button" data-m="new">+ New routine in this folder</button><button class="opt" type="button" data-m="ren">✎ rename folder</button><button class="opt" type="button" data-m="up">↑ move up</button><button class="opt" type="button" data-m="down">↓ move down</button><button class="opt bad" type="button" data-m="del">✕ delete folder (keeps routines)</button></div>`);
  $('sheetBody').onclick=e=>{const b=e.target.closest('[data-m]');if(!b)return;const m=b.dataset.m;ROUTINES.folders=allFolders();const i=ROUTINES.folders.indexOf(f);
    if(m==='new')return editRoutine(null,f);
    if(m==='ren'){const n=(prompt('Rename folder',f)||'').trim();if(!n||n===f)return;closeSheet();if(ROUTINES.folders.includes(n))ROUTINES.folders.splice(i,1);else ROUTINES.folders[i]=n;ROUTINES.list.forEach(r=>{if(r.folder===f)r.folder=n});return saveR()}
    if(m==='up'||m==='down'){const j=i+(m==='up'?-1:1);closeSheet();if(j<0||j>=ROUTINES.folders.length)return;const a=ROUTINES.folders;[a[i],a[j]]=[a[j],a[i]];return saveR()}
    if(m==='del'){if(b.dataset.arm){ROUTINES.folders.splice(i,1);ROUTINES.list.forEach(r=>{if(r.folder===f)r.folder=''});closeSheet();saveR()}else{b.dataset.arm=1;b.textContent='tap again to delete folder'}}}}
function moveMenu(r){const fs=allFolders();openSheet('move “'+r.name+'” to',`<div class="optlist">${fs.map(f=>`<button class="opt" type="button" data-f="${esc(f)}">${r.folder===f?'● ':'▤ '}${esc(f)}</button>`).join('')}<button class="opt" type="button" data-f="">${r.folder?'○ ':'● '}no folder</button><button class="opt" type="button" data-nf="1">+ New folder…</button></div>`);
  $('sheetBody').onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.nf){closeSheet();return newFolder(n=>r.folder=n)}if(b.dataset.f==null)return;r.folder=b.dataset.f;closeSheet();saveR()}}
$('g-routines').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.r==='new')return editRoutine(null);
  if(b.dataset.r==='folder')return newFolder();
  if(b.dataset.fold!=null){const f=b.dataset.fold;FOLDC.has(f)?FOLDC.delete(f):FOLDC.add(f);LS.set('gymfold',[...FOLDC]);return renderRoutines()}
  if(b.dataset.fmenu!=null)return folderMenu(b.dataset.fmenu);
  if(b.dataset.rmenu)return routineMenu(b.dataset.rmenu);
  if(b.dataset.start){if(ACTIVE){flash('finish_current_first');return}startWorkout(ROUTINES.list.find(r=>r.id===b.dataset.start))}});
function routineMenu(id){const r=ROUTINES.list.find(x=>x.id===id);if(!r)return;
  openSheet(r.name,`<div class="optlist"><button class="opt" type="button" data-m="edit">✎ edit routine</button><button class="opt" type="button" data-m="move">▤ move to folder${r.folder?' · '+esc(r.folder):''}</button><button class="opt" type="button" data-m="dup">⧉ duplicate</button><button class="opt bad" type="button" data-m="del">✕ delete routine</button></div>`);
  $('sheetBody').onclick=e=>{const b=e.target.closest('[data-m]');if(!b)return;const m=b.dataset.m;
    if(m==='edit')return editRoutine(r);
    if(m==='move')return moveMenu(r);
    if(m==='dup'){ROUTINES.list.push({...clone(r),id:rid(),name:r.name+' (copy)'});save('gym/routines',ROUTINES);closeSheet();renderGym();return}
    if(m==='del'){if(b.dataset.arm){ROUTINES.list=ROUTINES.list.filter(x=>x.id!==id);save('gym/routines',ROUTINES);closeSheet();renderGym()}else{b.dataset.arm=1;b.textContent='tap again to delete'}}}}
function editRoutine(r,inF){
  const R2=r?clone(r):{id:rid(),name:gymTypeFor()==='lower'?'Lower':'Upper',folder:inF||'',ex:[]};const folders=allFolders();
  const draw=()=>{openSheet(r?'edit routine':'new routine',`<input class="inp" id="rName" value="${esc(R2.name)}" aria-label="Routine name" style="font-size:18px;margin-bottom:8px">
    <input class="inp" id="rFolder" value="${esc(R2.folder||'')}" placeholder="Folder (optional, e.g. PPL, cut block)" list="rFolders" style="margin-bottom:12px"><datalist id="rFolders">${folders.map(f=>`<option value="${esc(f)}">`).join('')}</datalist>
    <div class="rex">${R2.ex.map((x,i)=>{const e=exOf(x);return `<div class="rexrow">${thumb(e,'rth')}<span class="rexn">${esc(e.n)}</span><label class="dim">sets <input class="inp num" data-rs="${i}" value="${x.sets}" inputmode="numeric" style="width:46px"></label><label class="dim">reps <input class="inp num" data-rp="${i}" value="${esc(x.reps||'')}" placeholder="8-12" style="width:62px"></label><label class="dim">rest <select class="inp" data-rr="${i}">${[0,30,60,90,120,150,180,240,300].map(s=>`<option value="${s}" ${s===(x.rest??120)?'selected':''}>${s?mmss(s):'off'}</option>`).join('')}</select></label><span class="row" style="gap:4px"><button class="iconbtn" type="button" data-rm="${i}:-1">↑</button><button class="iconbtn" type="button" data-rm="${i}:1">↓</button><button class="iconbtn" type="button" data-rx="${i}">✕</button></span></div>`}).join('')||'<div class="dim" style="font-size:12px">Add the exercises you do in this session.</div>'}</div>
    <button class="addex" type="button" id="rAdd">+ Add exercises</button>
    <div class="bigbtns" style="margin-top:14px"><span style="flex:1"></span><button class="btn" type="button" id="rCancel">Cancel</button><button class="btn p" type="button" id="rSave">Save routine</button></div>`);
    const sh=$('sheetBody');
    sh.oninput=e=>{const t=e.target;if(t.id==='rName')R2.name=t.value;if(t.id==='rFolder')R2.folder=t.value.trim();if(t.dataset.rs!=null)R2.ex[+t.dataset.rs].sets=Math.max(1,Math.min(12,parseInt(t.value)||1));if(t.dataset.rp!=null)R2.ex[+t.dataset.rp].reps=t.value;if(t.dataset.rr!=null)R2.ex[+t.dataset.rr].rest=+t.value};
    sh.onchange=sh.oninput;
    sh.onclick=e=>{const b=e.target.closest('button');if(!b)return;
      if(b.dataset.rm){const [i,d]=SXY(b.dataset.rm);const j=i+d;if(j>=0&&j<R2.ex.length){[R2.ex[i],R2.ex[j]]=[R2.ex[j],R2.ex[i]];draw()}}
      if(b.dataset.rx!=null){R2.ex.splice(+b.dataset.rx,1);draw()}
      if(b.id==='rAdd')pickExercises(list=>{list.forEach(n=>R2.ex.push({id:n.id,n:n.n,sets:3,rest:n.ty==='dur'||n.ty==='dd'?0:120,reps:'',note:''}));draw()},{back:draw});
      if(b.id==='rCancel')closeSheet();
      if(b.id==='rSave'){R2.name=(R2.name||'').trim()||'Routine';const i=ROUTINES.list.findIndex(x=>x.id===R2.id);if(i>=0)ROUTINES.list[i]=R2;else ROUTINES.list.push(R2);if(R2.folder){ROUTINES.folders=allFolders()}save('gym/routines',ROUTINES);closeSheet();renderGym();flash('saved')}};
  };draw();
}

/* ---------- exercise picker (multi-select, filters, images) ---------- */
function filterBar(st){return `<input class="inp" id="pkQ" placeholder="Search ${EXMAP.size} exercises" autocomplete="off" value="${esc(st.q)}" style="margin-bottom:8px">
  <div class="row" style="gap:6px;margin-bottom:8px;flex-wrap:wrap"><select class="inp" id="pkM" style="flex:1;min-width:130px"><option value="">All muscles</option>${MUSCLES2.map(m=>`<option ${st.m===m?'selected':''}>${m}</option>`).join('')}</select><select class="inp" id="pkE" style="flex:1;min-width:130px"><option value="">All equipment</option>${EQUIP2.map(m=>`<option ${st.e===m?'selected':''}>${m}</option>`).join('')}</select></div>`}
function filteredEx(st){const q=norm(st.q);return allExList().filter(e=>(!st.m||e.pm.includes(st.m)||(st.m==='full body'&&e.pm.length>2))&&(!st.e||e.eq===st.e)&&(!q||q.split(' ').every(w=>norm(e.n).includes(w)))).sort((a,b)=>usedCount(b.id)-usedCount(a.id)||(b.custom?1:0)-(a.custom?1:0)||a.n.localeCompare(b.n))}
function exRow(e,sel){const u=usedCount(e.id);return `<button type="button" class="pickx${sel?' sel':''}" data-pick="${esc(e.id)}">${thumb(e)}<span class="pxn"><b>${esc(e.n)}</b><span class="dim">${esc(e.pm.join(', '))}${e.eq&&e.eq!=='other'?' · '+esc(e.eq):''}${u?' · '+u+'×':''}${e.custom?' · custom':''}</span></span><span class="pxc">${sel?'✓':''}</span></button>`}
async function pickExercises(cb,opt={}){await loadExDb();
  const st={q:'',m:'',e:''};const sel=[];
  const draw=()=>{const list=filteredEx(st).slice(0,250);$('pickList').innerHTML=list.map(e=>exRow(e,sel.includes(e.id))).join('')||'<div class="dim" style="padding:12px">No matches.</div>';
    $('pkGo').hidden=opt.single||!sel.length;$('pkGo').textContent=`add ${sel.length} exercise${sel.length>1?'s':''}`};
  openSheet(opt.single?'replace exercise':'add exercises',`${filterBar(st)}<div class="row" style="justify-content:flex-end;margin-bottom:6px"><button class="iconbtn" type="button" id="pkNew">+ Create custom exercise</button></div><div class="picklist" id="pickList"></div><button class="btn p pkgo" type="button" id="pkGo" hidden></button>`);
  draw();
  $('pkQ').oninput=e=>{st.q=e.target.value;draw()};$('pkM').onchange=e=>{st.m=e.target.value;draw()};$('pkE').onchange=e=>{st.e=e.target.value;draw()};
  $('pkNew').onclick=()=>editCustom(null,ex=>{if(opt.single){closeSheet();cb([ex])}else{sel.push(ex.id);pickExercisesResume()}},st.q);
  const pickExercisesResume=()=>{openSheet('add exercises',`${filterBar(st)}<div class="row" style="justify-content:flex-end;margin-bottom:6px"><button class="iconbtn" type="button" id="pkNew">+ Create custom exercise</button></div><div class="picklist" id="pickList"></div><button class="btn p pkgo" type="button" id="pkGo" hidden></button>`);bind();draw()};
  const bind=()=>{$('pkQ').oninput=e=>{st.q=e.target.value;draw()};$('pkM').onchange=e=>{st.m=e.target.value;draw()};$('pkE').onchange=e=>{st.e=e.target.value;draw()};
    $('pkNew').onclick=()=>editCustom(null,ex=>{sel.push(ex.id);pickExercisesResume()},st.q);
    $('pickList').onclick=e=>{const b=e.target.closest('[data-pick]');if(!b)return;const id=b.dataset.pick;if(opt.single){closeSheet();cb([EXMAP.get(id)]);return}const i=sel.indexOf(id);if(i>=0)sel.splice(i,1);else sel.push(id);draw()};
    $('pkGo').onclick=()=>{const list=sel.map(id=>EXMAP.get(id)).filter(Boolean);if(opt.back){cb(list)}else{closeSheet();cb(list)}}};
  bind();
}

/* ---------- custom exercises (with your own photo) ---------- */
function resizeImg(file,max=420){return new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>{const im=new Image();im.onload=()=>{const s=Math.min(1,max/Math.max(im.width,im.height));const c=document.createElement('canvas');c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);c.getContext('2d').drawImage(im,0,0,c.width,c.height);res(c.toDataURL('image/jpeg',.72))};im.onerror=rej;im.src=fr.result};fr.onerror=rej;fr.readAsDataURL(file)})}
function editCustom(id,done,preset){const ex=id?clone(EXMAP.get(id)):{id:'c-'+rid(),n:preset||'',pm:['chest'],sm:[],eq:'machine',ty:'wr',custom:1};let photo=id?PHOTOS[id]||'':'';
  const draw=()=>{openSheet(id?'edit exercise':'create exercise',`<div class="cxphoto">${photo?`<img src="${esc(photo)}" alt="">`:'<span class="dim">No photo</span>'}<label class="btn">${photo?'retake':'take photo of machine'}<input type="file" accept="image/*" capture="environment" id="cxCam" hidden></label>${photo?'<button class="iconbtn" type="button" id="cxNoPh">Remove photo</button>':''}<label class="iconbtn">From library<input type="file" accept="image/*" id="cxLib" hidden></label></div>
    <input class="inp" id="cxN" value="${esc(ex.n)}" placeholder="Exercise name" style="font-size:16px;margin:10px 0">
    <label class="dim">type <select class="inp" id="cxT">${Object.entries(XTYPES).map(([k,v])=>`<option value="${k}" ${ex.ty===k?'selected':''}>${v.l}</option>`).join('')}</select></label>
    <label class="dim">equipment <select class="inp" id="cxE">${EQUIP2.map(m=>`<option ${ex.eq===m?'selected':''}>${m}</option>`).join('')}</select></label>
    <label class="dim">primary muscle <select class="inp" id="cxP">${MUSCLES2.map(m=>`<option ${ex.pm[0]===m?'selected':''}>${m}</option>`).join('')}</select></label>
    <div class="dim" style="font-size:12px;margin:10px 0 4px">Other muscles</div><div class="chips" id="cxS">${MUSCLES2.filter(m=>m!=='cardio'&&m!=='full body').map(m=>`<button class="chip" type="button" data-m="${m}" aria-pressed="${ex.sm.includes(m)}">${m}</button>`).join('')}</div>
    <div class="bigbtns" style="margin-top:12px">${id?'<button class="btn d" type="button" id="cxDel">Delete</button>':''}<span style="flex:1"></span><button class="btn p" type="button" id="cxSave">Save exercise</button></div>`);
    const onFile=async e=>{const f=e.target.files&&e.target.files[0];if(!f)return;try{photo=await resizeImg(f)}catch(x){}draw()};
    $('cxCam').onchange=onFile;$('cxLib').onchange=onFile;if($('cxNoPh'))$('cxNoPh').onclick=()=>{photo='';draw()};
    $('cxN').oninput=e=>ex.n=e.target.value;$('cxT').onchange=e=>ex.ty=e.target.value;$('cxE').onchange=e=>ex.eq=e.target.value;$('cxP').onchange=e=>ex.pm=[e.target.value];
    $('cxS').onclick=e=>{const b=e.target.closest('[data-m]');if(!b)return;const m=b.dataset.m;ex.sm=ex.sm.includes(m)?ex.sm.filter(x=>x!==m):[...ex.sm,m];b.setAttribute('aria-pressed',ex.sm.includes(m))};
    if($('cxDel'))$('cxDel').onclick=function(){if(!this.dataset.arm){this.dataset.arm=1;this.textContent='tap again';return}GLIB.custom=GLIB.custom.filter(c=>c.id!==ex.id);save('gym/lib',GLIB);removeDoc('gym/xp-'+ex.id);delete PHOTOS[ex.id];indexEx();closeSheet();renderGym()};
    $('cxSave').onclick=()=>{ex.n=(ex.n||'').trim();if(!ex.n){$('cxN').focus();return}const rec={id:ex.id,n:ex.n,pm:ex.pm,sm:ex.sm,eq:ex.eq,ty:ex.ty};
      const i=GLIB.custom.findIndex(c=>c.id===ex.id);if(i>=0)GLIB.custom[i]=rec;else GLIB.custom.push(rec);save('gym/lib',GLIB);
      if(photo){PHOTOS[ex.id]=photo;save('gym/xp-'+ex.id,{img:photo},true)}else if(PHOTOS[ex.id]){delete PHOTOS[ex.id];removeDoc('gym/xp-'+ex.id)}
      indexEx();flash('exercise_saved');if(done)done(EXMAP.get(ex.id));else{closeSheet();renderGym()}}};
  draw()}

/* ---------- library ---------- */
const LIBST={q:'',m:'',e:''};
async function renderLibrary(){await loadExDb();const el=$('g-exercises');
  el.innerHTML=`<div class="row" style="justify-content:space-between;margin-bottom:8px"><span class="tag">${EXMAP.size} exercises</span><button class="btn p" type="button" id="libNew">+ Custom exercise</button></div>${filterBar(LIBST).replace('id="pkQ"','id="libQ"').replace('id="pkM"','id="libM"').replace('id="pkE"','id="libE"')}<div class="picklist tall" id="libList"></div>`;
  const draw=()=>{$('libList').innerHTML=filteredEx(LIBST).slice(0,300).map(e=>exRow(e,false)).join('')};draw();
  $('libQ').oninput=e=>{LIBST.q=e.target.value;draw()};$('libM').onchange=e=>{LIBST.m=e.target.value;draw()};$('libE').onchange=e=>{LIBST.e=e.target.value;draw()};
  $('libNew').onclick=()=>editCustom(null,null,LIBST.q);
  $('libList').onclick=e=>{const b=e.target.closest('[data-pick]');if(b)openExercise(b.dataset.pick)}}

/* ---------- exercise detail: summary / history / charts / records ---------- */
let exAnim=null;
function openExercise(id,tab='summary'){const e=EXMAP.get(id)||exOf({id,n:id});const h=exHistory(e.id).reverse();const T=XTYPES[e.ty]||XTYPES.wr;const weighted=T.f.includes('kg');
  const tabs=['summary','history','charts','records'];
  const head=`<div class="exhero">${imgOf(e)?`<div class="exanim"><img id="exA" src="${esc(imgOf(e))}" alt="${esc(e.n)}"></div>`:''}<div><div class="dim">${esc(T.l)} · ${esc(e.eq||'')}</div><div><b>primary:</b> ${esc(e.pm.join(', '))}</div>${e.sm.length?`<div class="dim">secondary: ${esc(e.sm.join(', '))}</div>`:''}${e.custom?`<button class="iconbtn" type="button" id="exEdit" style="margin-top:6px">Edit exercise</button>`:''}</div></div>
    <div class="seg" style="margin:10px 0" id="exTabs">${tabs.map(t=>`<button type="button" data-t="${t}" aria-pressed="${t===tab}">${t}</button>`).join('')}</div>`;
  let body='';
  if(tab==='summary'){const b=bests(e.id);body=rlExBlock(e)+`<div class="wstats big">${weighted?`<div><span class="dim">Heaviest</span><b class="num">${b.kg?wU(e.id,b.kg):'—'}</b></div><div><span class="dim">best e1RM</span><b class="num">${b.e?wU(e.id,Math.round(b.e*10)/10):'—'}</b></div>`:`<div><span class="dim">Most reps</span><b class="num">${b.reps||'—'}</b></div>`}<div><span class="dim">Sessions</span><b class="num">${h.length}</b></div></div>
    ${e.how&&e.how.length?`<div class="tag" style="margin-top:14px">How to</div><ol class="howto">${e.how.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>`:''}`}
  if(tab==='history')body=h.slice().reverse().map(o=>`<div class="hx"><span class="dim">${esc(nice(o.w.date))} · ${esc(o.w.name)}</span><div class="hsets">${o.x.sets.filter(s=>s.done!==false).map((s,i,a)=>`<span class="set t-${s.t||'n'}">${setLabel(a,i)} · ${esc(fmtSet(o.x,s))}</span>`).join('')}</div>${o.x.note?`<div class="dim" style="font-size:12px">“${esc(o.x.note)}”</div>`:''}</div>`).join('')||'<div class="dim">Not logged yet.</div>';
  if(tab==='charts'){const metrics=weighted?[['e1rm','best est. 1RM'],['heavy','heaviest weight'],['setvol','best set volume'],['vol','session volume'],['reps','total reps']]:e.ty==='dur'?[['sec','longest time']]:e.ty==='dd'?[['km','distance'],['sec','time']]:[['best','most reps in a set'],['reps','total reps']];
    const m=openExercise.metric&&metrics.some(x=>x[0]===openExercise.metric)?openExercise.metric:metrics[0][0];
    const val=o=>{const ss=o.x.sets.filter(s=>s.done!==false&&s.t!=='w');const mx=f=>Math.max(0,...ss.map(f));return {e1rm:mx(e1),heavy:mx(s=>+s.kg||0),setvol:mx(s=>(+s.kg||0)*(+s.r||0)),vol:ss.reduce((a,s)=>a+(+s.kg||0)*(+s.r||0),0),reps:ss.reduce((a,s)=>a+(+s.r||0),0),best:mx(s=>+s.r||0),sec:mx(s=>+s.sec||0),km:mx(s=>+s.km||0)}[m]};
    const pts=h.map(val);body=`<div class="chips" id="exMet">${metrics.map(([k,l])=>`<button class="chip" type="button" data-k="${k}" aria-pressed="${k===m}">${l}</button>`).join('')}</div>${pts.length>1?spark(pts,{h:170,labels:[nice(h[0].w.date),nice(h[h.length-1].w.date)]}):'<div class="dim">Log this exercise twice to see a chart.</div>'}`}
  if(tab==='records'){const recs=[];if(weighted){const b=bests(e.id);recs.push(['estimated 1RM',b.e?wU(e.id,Math.round(b.e*10)/10):'—'],['heaviest weight',b.kg?wU(e.id,b.kg):'—'],['best set volume',b.vol?fmtVol(b.vol)+' kg':'—']);
      const bySess=Math.max(0,...h.map(o=>o.x.sets.filter(s=>s.t!=='w').reduce((a,s)=>a+(+s.kg||0)*(+s.r||0),0)));recs.push(['best session volume',bySess?fmtVol(bySess)+' kg':'—']);}
    const rr={};h.forEach(o=>o.x.sets.forEach(s=>{if(s.t==='w'||!(+s.r>0))return;const r=+s.r;if(r<=15)rr[r]=Math.max(rr[r]||0,+s.kg||0)}));
    body=`<div class="reclist">${recs.map(([k,v])=>`<div><span>${k}</span><b class="num">${v}</b></div>`).join('')}</div>${weighted&&Object.keys(rr).length?`<div class="tag" style="margin:14px 0 6px">Rep records · best weight for</div><div class="reclist">${Object.entries(rr).sort((a,b)=>a[0]-b[0]).map(([r,kg])=>`<div><span>${r} rep${r>1?'s':''}</span><b class="num">${wU(e.id,kg)}</b></div>`).join('')}</div>`:''}${!weighted?`<div class="reclist"><div><span>Sessions</span><b class="num">${h.length}</b></div></div>`:''}`}
  openSheet(e.n,head+`<div id="exBody">${body}</div>`);
  $('exTabs').onclick=ev=>{const b=ev.target.closest('[data-t]');if(b)openExercise(e.id,b.dataset.t)};
  if($('exMet'))$('exMet').onclick=ev=>{const b=ev.target.closest('[data-k]');if(b){openExercise.metric=b.dataset.k;openExercise(e.id,'charts')}};
  if($('exEdit'))$('exEdit').onclick=()=>editCustom(e.id);
  clearInterval(exAnim);if(e.img&&e.img.length>1&&!e.custom){let i=0;exAnim=setInterval(()=>{const im=$('exA');if(!im||!$('sheet').classList.contains('on')){clearInterval(exAnim);return}i^=1;im.src=IMGBASE+e.img[i]},900)}
}

/* ---------- history: list + calendar ---------- */
function renderHistory(){const el=$('g-history');
  const head=`<div class="row" style="justify-content:space-between;margin-bottom:10px"><div class="seg" id="hMode"><button type="button" data-h="list" aria-pressed="${HIST_MODE==='list'}">List</button><button type="button" data-h="cal" aria-pressed="${HIST_MODE==='cal'}">Calendar</button></div><span class="tag">${WORKOUTS.length} workouts</span></div>`;
  if(HIST_MODE==='list'){el.innerHTML=head+`<div class="wlist">${WORKOUTS.map(wCard).join('')||'<div class="dim">Finished workouts show up here.</div>'}</div>`}
  else{const base=HIST_MONTH?new Date(HIST_MONTH+'-01T12:00'):logical();const y=base.getFullYear(),mo=base.getMonth();const first=new Date(y,mo,1),days=new Date(y,mo+1,0).getDate();const off=(first.getDay()+6)%7;
    const byDay={};WORKOUTS.forEach(w=>(byDay[w.date]=byDay[w.date]||[]).push(w));const key=d=>`${y}-${pad(mo+1)}-${pad(d)}`;const inMonth=WORKOUTS.filter(w=>w.date.startsWith(`${y}-${pad(mo+1)}`));
    el.innerHTML=head+`<div class="panel"><div class="ph"><button class="iconbtn chev" type="button" data-cm="-1" aria-label="Previous month">‹</button><span class="tag">${first.toLocaleDateString('en-GB',{month:'long',year:'numeric'})} · ${inMonth.length} workouts</span><button class="iconbtn chev" type="button" data-cm="1" aria-label="Next month">›</button></div><div class="pb"><div class="calg">${['m','t','w','t','f','s','s'].map(d=>`<span class="cdh">${d}</span>`).join('')}${'<span></span>'.repeat(off)}${Array.from({length:days},(_,i)=>{const k=key(i+1);const ws=byDay[k]||[];return `<button type="button" class="cday${ws.length?' on':''}${k===ymd(logical())?' today':''}" data-cday="${k}" ${ws.length?'':'disabled'}>${i+1}${ws.length?'<i></i>':''}</button>`}).join('')}</div></div></div>
    <div class="wlist" style="margin-top:10px">${inMonth.map(wCard).join('')}</div>`}
}
$('g-history').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.h){HIST_MODE=b.dataset.h;return renderHistory()}
  if(b.dataset.cm){const base=HIST_MONTH?new Date(HIST_MONTH+'-01T12:00'):logical();base.setMonth(base.getMonth()+ +b.dataset.cm);HIST_MONTH=`${base.getFullYear()}-${pad(base.getMonth()+1)}`;return renderHistory()}
  if(b.dataset.cday){const ws=WORKOUTS.filter(w=>w.date===b.dataset.cday);if(ws.length)openWorkout(ws[0].id)}});
$('v-gym').addEventListener('click',e=>{const c=e.target.closest('.wcard[data-w]');if(!c||e.target.closest('button'))return;openWorkout(c.dataset.w)});
function openWorkout(id){const w=WORKOUTS.find(x=>x.id===id);if(!w)return;const dur=w.endedAt&&w.startedAt?fmtDur(new Date(w.endedAt)-new Date(w.startedAt)):'—';
  openSheet(w.name,`<div class="wd-date">${esc(nice(w.date))}</div>
  <div class="wd-stats"><div><span>Duration</span><b class="num">${esc(dur)}</b></div><div><span>Volume</span><b class="num">${fmtVol(w.vol||stats(w).vol)}<small> kg</small></b></div><div><span>Sets</span><b class="num">${NS(w)}</b></div></div>
  ${(WPH[w.id]||[]).length?`<div class="swgal">${WPH[w.id].map(s=>`<img src="${s}" alt="">`).join('')}</div>`:''}${w.note?`<div class="wd-note">${esc(w.note)}</div>`:''}
  ${(w.prs||[]).length?`<div class="wd-prs">${w.prs.map(p=>`<div><i>PR</i><span>${esc(p.n)} · ${esc(p.kind)}</span><b class="num">${esc(String(p.v))}</b></div>`).join('')}</div>`:''}
  ${(w.ex||[]).map(x=>{const e=exOf(x);return `<div class="wd-ex"><div class="wd-exh">${thumb(e,'rth')}<div><b>${esc(e.n)}</b>${x.ss?'<span class="wd-ss">Superset</span>':''}${x.note?`<small>${esc(x.note)}</small>`:''}</div></div>
    <div class="wd-sets">${x.sets.map((s,i)=>{const l=setLabel(x.sets,i);return `<div class="t-${s.t||'n'}"><span class="wd-n">${l}</span><span class="num">${esc(fmtSet(x,s))}</span></div>`}).join('')}</div></div>`}).join('')}
  <button class="wd-go" type="button" id="wRepeat">Repeat workout</button>
  <div class="wd-acts"><button type="button" id="wRoutine">Save routine</button><button type="button" id="wEdit">Edit</button><button type="button" class="d" id="wDel">Delete</button></div>`);
  $('wDel').onclick=function(){if(this.dataset.arm){removeDoc('gym/w-'+w.id);if(WPH[w.id]){removeDoc('gym/wp-'+w.id);delete WPH[w.id]}WORKOUTS=WORKOUTS.filter(x=>x.id!==w.id);recountUsed();closeSheet();renderGym()}else{this.dataset.arm=1;this.textContent='Tap again to delete'}};
  $('wEdit').onclick=()=>editWorkout(w);
  $('wRoutine').onclick=()=>{ROUTINES.list.push(routineFrom(w));save('gym/routines',ROUTINES);closeSheet();flash('saved')};
  $('wRepeat').onclick=()=>{if(ACTIVE){flash('finish_current_first');return}closeSheet();startWorkout({...routineFrom(w),id:null})};
}

/* ---------- statistics ---------- */
function muscleSets(ws){const m={};ws.forEach(w=>(w.ex||[]).forEach(x=>{const e=exOf(x);const n=x.sets.filter(s=>s.done!==false&&s.t!=='w').length;e.pm.forEach(p=>m[p]=(m[p]||0)+n);e.sm.forEach(p=>m[p]=(m[p]||0)+n*.5)}));return m}
function weekKeyN(n){const out=[];const now=logical();for(let i=n-1;i>=0;i--){const d=new Date(now);d.setDate(d.getDate()-i*7);out.push(isoWeek(d))}return out}
function streakWeeks(){const have=new Set(WORKOUTS.map(w=>isoWeek(new Date(w.date+'T12:00'))));let s=0;const now=logical();for(let i=0;i<260;i++){const d=new Date(now);d.setDate(d.getDate()-i*7);const k=isoWeek(d);if(have.has(k))s++;else if(i>0)break}return s}
const BM_SIL='M60 37 L54 37 C50 40 46 42 41 43 C35 44 31 48 30 56 C29 64 29 74 28 86 C27 96 25 106 24 118 C23 124 22 128 21 134 C22 138 26 138 27 134 L29 124 C31 112 33 102 35 92 C36 84 37 76 38 70 L40 70 C40 80 41 90 42 100 C42 106 41 112 40 120 C39 134 40 150 42 164 C42 174 41 186 43 198 C44 206 44 212 43 218 C42 222 44 224 48 224 L52 224 C54 223 54 220 53 216 C52 208 53 200 54 192 C55 182 56 174 56 166 C57 152 58 138 59 128 L60 126 Z';const BM_FRONT={ traps:'M54 39 C51 41 48 43 45 44 L51 45 C53 43 54.5 41 55 40 Z', shoulders:'M44 44.5 C37 44 32 49 31.5 57 C32 62 34 65 36.5 65 C37.5 58 41 51 46 47.5 Z', chest:'M47.5 47.5 C52 45.5 57 46 59.4 47.5 L59.4 61 C55 65.5 47.5 65.5 42.5 61 C41.5 55 43.5 50 47.5 47.5 Z', biceps:'M37.5 66 C35 72 34 79 34.5 86 C36.5 88.5 39 88 40 85.5 C40.8 78 40.8 72 40.5 66.5 Z', forearms:'M34.5 90 C31 99 28.5 109 27 120 L31 122 C34 113 37 103 39.5 92 C38 90.5 36 90 34.5 90 Z', abs:'M50.5 66 L59.4 66 L59.4 103 C55 105 52 103.5 50.5 100 Z M43.5 66 C45 75 46 88 47.5 100 L49.6 99.5 C49 88 49 76 49.4 66 Z', quads:'M44.5 116 C41.5 127 41.5 145 44.5 160 C47.5 163.5 52 162.5 53.5 158 C55.5 145 56.5 131 56.5 121 C53 117 49 115.5 44.5 116 Z', adductors:'M57 121.5 C57.5 129 58 136 58.3 143 L59.4 142 L59.4 124 Z', calves:'M43.5 170 C41.5 180 42.5 194 45.5 205 L49 205.5 C50.5 195 50.5 181 49 170.5 Z'};const BM_BACK={ traps:'M59.4 36.5 L55 38 C50 41 46 43 43.5 45 C49 47 53.5 51 56 56 L59.4 63.5 Z', shoulders:BM_FRONT.shoulders, 'upper back':'M55.5 57.5 C52 53 47.5 51 44 51.5 C43 57 45.5 62.5 51 64.5 L58.8 64.5 Z', lats:'M43 60 C41.5 70 43.5 82 49 92 L55 88.5 C54 79 52.5 71 52 65.5 C48 64.5 45 62.5 43 60 Z', triceps:'M37.5 64 C35 70 34 78 34.5 86 C36.5 88.5 39 88 40 85.5 C40.8 78 40.8 70 40.5 64.5 Z', forearms:BM_FRONT.forearms, 'lower back':'M53.5 86 L59.4 84 L59.4 104 L54.5 104 C53.5 98 53 92 53.5 86 Z', glutes:'M44.5 106 C42 112 42 120 45.5 126 C51 128.5 56.5 126.5 59.4 122.5 L59.4 106 C55 104.5 49 104.5 44.5 106 Z', hamstrings:'M45 129.5 C43 141 43.5 152 46 162.5 L52 162.5 C54 151 56 140 57 129.5 C53 131 49 131 45 129.5 Z', calves:'M44 168 C41 176 41.5 188 44.5 197 C46.5 199.5 50 198 51 191 C52 183 52 175 50.5 168 Z'};const BM_LINES='M50.8 74 L59.4 74 M50.8 82 L59.4 82 M50.8 91 L59.4 91';
function bodyMap(m){const mx=Math.max(1,...Object.values(m));const c=k=>{const v=(m[k]||0)/mx;return v?`rgba(255,42,109,${(.25+.75*v).toFixed(2)})`:'#2b2b31'};
  const half=(P,ab)=>`<path d="${BM_SIL}" fill="#1a1a1f"/>`+Object.entries(P).map(([k,d])=>`<path d="${d}" fill="${c(k)}" stroke="#0b0b0e" stroke-width=".7" stroke-linejoin="round"><title>${k}: ${kgs(m[k]||0)} sets</title></path>`).join('')+(ab?`<path d="${BM_LINES}" stroke="#0b0b0e" stroke-width=".8" fill="none"/>`:'');
  const fig=(P,lab,ab)=>{const h=half(P,ab);return `<figure><svg viewBox="16 6 88 222" role="img" aria-label="${lab}"><ellipse cx="60" cy="21" rx="10.5" ry="12.5" fill="#1a1a1f"/><rect x="54.5" y="30" width="11" height="9" rx="3" fill="#1a1a1f"/><g>${h}</g><g transform="matrix(-1 0 0 1 120 0)">${h}</g></svg><figcaption>${lab}</figcaption></figure>`};
  return `<div class="bodymap">${fig(BM_FRONT,'Front',1)}${fig(BM_BACK,'Back')}</div><div class="bm-key"><span>Fewer sets</span><i></i><span>More sets</span></div>`}
function renderStats(){const el=$('g-stats');const weeks=weekKeyN(STAT_P);const since=weeks[0];
  const ws=WORKOUTS.filter(w=>isoWeek(new Date(w.date+'T12:00'))>=since);
  const per=weeks.map(k=>WORKOUTS.filter(w=>isoWeek(new Date(w.date+'T12:00'))===k));
  const val=a=>({volume:a.reduce((s,w)=>s+(w.vol||stats(w).vol),0),sets:a.reduce((s,w)=>s+(NS(w)),0),duration:a.reduce((s,w)=>s+(w.endedAt&&w.startedAt?(new Date(w.endedAt)-new Date(w.startedAt))/60000:0),0),workouts:a.length})[STAT_M];
  const vals=per.map(val);const mx=Math.max(1,...vals);
  const tot={w:ws.length,vol:ws.reduce((s,w)=>s+(w.vol||stats(w).vol),0),sets:ws.reduce((s,w)=>s+(NS(w)),0),dur:ws.reduce((s,w)=>s+(w.endedAt&&w.startedAt?(new Date(w.endedAt)-new Date(w.startedAt)):0),0)};
  const m30=muscleSets(WORKOUTS.filter(w=>(Date.now()-new Date(w.date+'T12:00'))<30*864e5));const mList=Object.entries(m30).filter(([k])=>k!=='other').sort((a,b)=>b[1]-a[1]);const mmx=Math.max(1,...mList.map(x=>x[1]));
  const recs=[...new Set(WORKOUTS.flatMap(w=>(w.ex||[]).map(exKey)))].map(id=>{const e=EXMAP.get(id)||exOf({id});const b=bests(id);return {e,b}}).filter(o=>o.b.e>0).sort((a,b)=>b.b.e-a.b.e).slice(0,10);
  el.innerHTML=`<div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px"><div class="seg" id="stP">${[[4,'4 weeks'],[12,'3 months'],[52,'1 year']].map(([n,l])=>`<button type="button" data-p="${n}" aria-pressed="${STAT_P===n}">${l}</button>`).join('')}</div><span class="tag">${streakWeeks()} week streak</span></div>
  <div class="statcards"><div><span class="dim">Workouts</span><b class="num">${tot.w}</b></div><div><span class="dim">Volume</span><b class="num">${fmtVol(tot.vol)}<small> kg</small></b></div><div><span class="dim">Sets</span><b class="num">${tot.sets}</b></div><div><span class="dim">Time</span><b class="num">${Math.round(tot.dur/3600000)}<small> h</small></b></div><div><span class="dim">Avg / week</span><b class="num">${(tot.w/STAT_P).toFixed(1)}</b></div></div>
  <div class="panel" style="margin-top:12px"><div class="ph"><span class="tag">Per week</span><div class="chips" id="stM" style="margin:0">${['volume','sets','duration','workouts'].map(k=>`<button class="chip" type="button" data-m="${k}" aria-pressed="${STAT_M===k}">${k}</button>`).join('')}</div></div><div class="pb"><div class="wkbars" style="grid-template-columns:repeat(${weeks.length},1fr)">${vals.map((v,i)=>`<div class="d"><span class="p num">${v?(STAT_M==='volume'?Math.round(v/1000)+'k':Math.round(v)):''}</span><div class="b" style="height:${v/mx*100}%"></div><span class="l">${weeks.length<=12||i%4===0?weeks[i].slice(-3).toLowerCase():''}</span></div>`).join('')}</div></div></div>
  <div class="statsplit"><div class="panel"><div class="ph"><span class="tag">Muscles · last 30 days</span></div><div class="pb">${bodyMap(m30)}<div class="mbars">${mList.map(([m,v])=>`<div><span>${esc(m)}</span><i style="--w:${v/mmx*100}%"></i><b class="num">${kgs(v)}</b></div>`).join('')||'<span class="dim">No sets in the last 30 days.</span>'}</div></div></div>
  <div class="panel"><div class="ph"><span class="tag">strength · best est. 1RM</span></div><div class="pb"><div class="reclist">${recs.map(o=>`<button type="button" data-ex="${esc(o.e.id)}"><span>${thumb(o.e,'rth')} ${esc(o.e.n)}</span><b class="num">${kgs(Math.round(o.b.e*10)/10)} kg</b></button>`).join('')||'<span class="dim">Log some weighted sets to see records.</span>'}</div></div></div></div>`;
  if(FX)el.querySelectorAll('.wkbars .b').forEach((b,i)=>b.animate([{transform:'scaleY(0)'},{transform:'scaleY(1)'}],{duration:600,delay:i*30,easing:'cubic-bezier(.2,.9,.1,1)',fill:'backwards'}));
}
$('g-stats').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.p){STAT_P=+b.dataset.p;renderStats()}if(b.dataset.m){STAT_M=b.dataset.m;renderStats()}if(b.dataset.ex)openExercise(b.dataset.ex)});

/* --- bottom sheet used by gym + journal --- */
let sheetStack=0;
function openSheet(title,html){$('sheetTitle').textContent=title;$('sheetBody').innerHTML=html;$('sheetBody').oninput=null;$('sheetBody').onclick=null;$('sheetBody').onchange=null;$('sheet').classList.add('on');$('sheet').setAttribute('aria-hidden','false');$('scrim').classList.add('on');sheetStack=1;$('sheetBody').scrollTop=0}
function closeSheet(){$('sheet').classList.remove('on');$('sheet').setAttribute('aria-hidden','true');if(!$('drawer').classList.contains('on'))$('scrim').classList.remove('on');sheetStack=0}
$('sheetX').onclick=closeSheet;


function toggleUnit(id){GUNITS={...GUNITS};if(isLb(id))delete GUNITS[id];else GUNITS[id]='lb';save('gym/units',GUNITS);renderGym();flash(isLb(id)?'lbs':'kg')}

/* ================= BODY ================= */
let BP={r:[]},WT={r:[]};
function spark(vals,{w=560,h=160,refs=[],min,max,color='#ff2a6d',series2,color2='#05d9e8',labels}={}){
  if(!vals.length)return '<div class="dim" style="font-size:12px;padding:20px 0">Log a reading to start the chart.</div>';
  const all=vals.concat(series2||[]).concat(refs.map(r=>r.v));let lo=min??Math.min(...all),hi=max??Math.max(...all);if(hi-lo<4){hi+=2;lo-=2}const pd=(hi-lo)*.12;lo-=pd;hi+=pd;
  const X=i=>vals.length===1?w/2:28+i*(w-40)/(vals.length-1),Y=v=>h-18-(v-lo)/(hi-lo)*(h-30);
  const line=(arr,c)=>{const pts=arr.map((v,i)=>`${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');return `<polygon points="${X(0)},${h-18} ${pts} ${X(arr.length-1)},${h-18}" fill="${c}" opacity=".08"/><polyline points="${pts}" fill="none" stroke="${c}" stroke-width="1.6"/>${arr.map((v,i)=>`<rect x="${X(i)-1.5}" y="${Y(v)-1.5}" width="3" height="3" fill="${c}"/>`).join('')}<rect x="${X(arr.length-1)-4}" y="${Y(arr[arr.length-1])-4}" width="8" height="8" fill="none" stroke="${c}"/>`};
  let s=`<svg class="chart" viewBox="0 0 ${w} ${h}" role="img">`;
  [lo+pd,(lo+hi)/2,hi-pd].forEach(v=>{s+=`<line x1="24" x2="${w}" y1="${Y(v)}" y2="${Y(v)}" stroke="#1c1c1c"/><text x="0" y="${Y(v)+3}" font-size="9" fill="#7a7a7a" font-family="JetBrains Mono, monospace">${Math.round(v)}</text>`});
  refs.forEach(r=>{s+=`<line x1="24" x2="${w}" y1="${Y(r.v)}" y2="${Y(r.v)}" stroke="#ffb000" stroke-dasharray="4 4" opacity=".7"/><text x="${w}" y="${Y(r.v)-4}" text-anchor="end" font-size="9" fill="#ffb000" font-family="JetBrains Mono, monospace">${esc(r.l)}</text>`});
  if(series2)s+=line(series2,color2);s+=line(vals,color);
  if(labels){s+=`<text x="28" y="${h-4}" font-size="9" fill="#7a7a7a" font-family="JetBrains Mono, monospace">${esc(labels[0])}</text><text x="${w}" y="${h-4}" text-anchor="end" font-size="9" fill="#7a7a7a" font-family="JetBrains Mono, monospace">${esc(labels[1])}</text>`}
  return s+'</svg>';
}
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
const fmtTs=t=>{const d=new Date(t);return d.toLocaleDateString('en-GB',{day:'numeric',month:'short'})+' '+pad(d.getHours())+':'+pad(d.getMinutes())};
function renderBody(){
  const r=BP.r.slice(-30);const wk=BP.r.filter(x=>Date.now()-new Date(x.t)<7*864e5);
  $('bpStat').innerHTML=r.length?`<div><b class="num">${r[r.length-1].s}/${r[r.length-1].d}</b><span>latest${r[r.length-1].p?' · pulse '+r[r.length-1].p:''}</span></div><div><b class="num">${wk.length?Math.round(avg(wk.map(x=>x.s)))+'/'+Math.round(avg(wk.map(x=>x.d))):'–'}</b><span>7-day average (${wk.length})</span></div>`:'';
  $('bpChart').innerHTML=spark(r.map(x=>x.s),{series2:r.map(x=>x.d),refs:[{v:135,l:'135 sys'},{v:85,l:'85 dia'}],labels:r.length?[fmtTs(r[0].t),fmtTs(r[r.length-1].t)]:null})+(r.length?'<div class="dim" style="font-size:11px">pink = systolic · cyan = diastolic · dashed = 135/85, NICE threshold for home readings</div>':'');
  $('bpList').innerHTML=BP.r.slice().reverse().slice(0,40).map((x,i)=>`<div><span>${fmtTs(x.t)}</span><span class="num">${x.s}/${x.d}${x.p?' · '+x.p+' bpm':''}</span><button type="button" data-rbp="${esc(x.t)}" aria-label="Delete reading">✕</button></div>`).join('');
  const w=WT.r.slice(-60);const w7=WT.r.filter(x=>Date.now()-new Date(x.t)<7*864e5);const old=WT.r.filter(x=>Date.now()-new Date(x.t)>=28*864e5);
  $('wtStat').innerHTML=w.length?`<div><b class="num">${w[w.length-1].kg.toFixed(1)}</b><span>Latest kg</span></div><div><b class="num">${w7.length?avg(w7.map(x=>x.kg)).toFixed(1):'–'}</b><span>7-day average</span></div>${old.length?`<div><b class="num ${w[w.length-1].kg-old[old.length-1].kg<=0?'ok':'pink'}">${(w[w.length-1].kg-old[old.length-1].kg>0?'+':'')+(w[w.length-1].kg-old[old.length-1].kg).toFixed(1)}</b><span>vs 4+ weeks ago</span></div>`:''}`:'';
  $('wtChart').innerHTML=spark(w.map(x=>x.kg),{labels:w.length?[fmtTs(w[0].t),fmtTs(w[w.length-1].t)]:null});
  $('wtList').innerHTML=WT.r.slice().reverse().slice(0,40).map(x=>`<div><span>${fmtTs(x.t)}</span><span class="num">${x.kg.toFixed(1)} kg</span><button type="button" data-rwt="${esc(x.t)}" aria-label="Delete entry">✕</button></div>`).join('');
}
async function loadBody(){BP={r:[],...(await load('body/bp')||{})};WT={r:[],...(await load('body/wt')||{})};renderBody()}
$('bpForm').onsubmit=e=>{e.preventDefault();const s=+$('bpS').value,d=+$('bpD').value,p=+$('bpP').value||null;if(!s||!d)return;BP.r.push({t:new Date().toISOString(),s,d,p});BP.r=BP.r.slice(-500);save('body/bp',BP);$('bpForm').reset();renderBody();burstEl($('bpChart'),40);autoTick(/^Blood pressure/)};
$('wtForm').onsubmit=e=>{e.preventDefault();const kg=+$('wtIn').value;if(!kg)return;WT.r.push({t:new Date().toISOString(),kg});WT.r=WT.r.slice(-800);save('body/wt',WT);$('wtForm').reset();renderBody();burstEl($('wtChart'),40)};
$('bpList').onclick=e=>{const b=e.target.closest('[data-rbp]');if(!b)return;BP.r=BP.r.filter(x=>x.t!==b.dataset.rbp);save('body/bp',BP);renderBody()};
$('wtList').onclick=e=>{const b=e.target.closest('[data-rwt]');if(!b)return;WT.r=WT.r.filter(x=>x.t!==b.dataset.rwt);save('body/wt',WT);renderBody()};


/* ================= TOOLS: focus · protocols · leetcode ================= */
let lc=0,WK=isoWeek(logical()),SET={},TOOLV=LS.get('toolv')||'focus';
function renderTools(){
  $('toolSeg').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.t===TOOLV));
  ['focus','protocols','leetcode','brick'].forEach(v=>$('t-'+v).hidden=v!==TOOLV);
  $('toolsSub').textContent=nice(DAYK).toLowerCase();
  if(TOOLV==='focus')renderFocus();else if(TOOLV==='protocols')renderProto();else if(TOOLV==='brick')renderBrick();else renderLeet();
  toolCardSubs();
}
function toolCardSubs(){const dw=DAY.dw||0;$('tcFocus').textContent=`${Math.floor(dw/60)}h ${pad(dw%60)}m today`;
  if(typeof protoDueCount==='function'){const n=protoDueCount();$('tcProto').textContent=n?`${n} due today`:'nothing due'}
  if(typeof leetWeek==='function')$('tcLeet').textContent=`${leetWeek()} solved this week`;
  if(typeof bToday==='function'&&$('tcBrick')){const m=bToday();$('tcBrick').textContent=BRICK.on?'bricked now':(m?Math.floor(m/60)+'h '+pad(m%60)+'m today':'lock the phone')}}
$('toolSeg').onclick=e=>{const b=e.target.closest('[data-t]');if(!b)return;TOOLV=b.dataset.t;LS.set('toolv',TOOLV);renderTools();staggerIn($('t-'+TOOLV))};

/* ---------------- FOCUS ---------------- */
let TM=LS.get('timer')||{len:90,end:null,left:90*60};if(!TM.phase)TM.phase='focus';
let FOCUS={sessions:[],pomo:false,brk:10,task:''},MUSIC={list:[],cur:null,vol:60,shuffle:false};
const DW_TARGET=260;
function tmLeft(){return TM.end?Math.max(0,Math.round((TM.end-Date.now())/1000)):TM.left}
function tmTotal(){return (TM.phase==='break'?FOCUS.brk:TM.len)*60}
function logDw(minutes,task){if(minutes<1)return;DAY.dw=(DAY.dw||0)+minutes;persistDay();FOCUS.sessions.unshift({d:DAYK,at:new Date().toISOString(),min:minutes,task:task||''});FOCUS.sessions=FOCUS.sessions.slice(0,600);save('tools/focus',FOCUS);if(TOOLV==='focus'&&cur==='tools')renderFocus();toolCardSubs()}
/* icons — drawn, never unicode glyphs (iOS turns those into emoji) */
const FZSV=(p,f)=>'<svg viewBox="0 0 24 24" aria-hidden="true" '+(f?'fill="currentColor"':'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"')+'>'+p+'</svg>';
const FI={
  play:FZSV('<path d="M8 5.6v12.8a1 1 0 0 0 1.52.85l10.4-6.4a1 1 0 0 0 0-1.7L9.52 4.75A1 1 0 0 0 8 5.6z"/>',1),
  pause:FZSV('<rect x="6" y="4.5" width="4.2" height="15" rx="1.3"/><rect x="13.8" y="4.5" width="4.2" height="15" rx="1.3"/>',1),
  prev:FZSV('<rect x="4" y="5" width="2.4" height="14" rx="1"/><path d="M20 6.3v11.4a.9.9 0 0 1-1.4.75L9.9 12.75a.9.9 0 0 1 0-1.5l8.7-5.7A.9.9 0 0 1 20 6.3z"/>',1),
  next:FZSV('<rect x="17.6" y="5" width="2.4" height="14" rx="1"/><path d="M4 6.3v11.4a.9.9 0 0 0 1.4.75l8.7-5.7a.9.9 0 0 0 0-1.5L5.4 5.55A.9.9 0 0 0 4 6.3z"/>',1),
  shuf:FZSV('<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>'),
  bell:FZSV('<path d="M10.27 21a1.94 1.94 0 0 0 3.46 0M3.26 15.33A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.67C19.41 13.96 18 12.5 18 8A6 6 0 0 0 6 8c0 4.5-1.41 5.96-2.74 7.33"/>',1),
  x:FZSV('<path d="M18 6 6 18M6 6l12 12"/>'),
  chev:FZSV('<path d="m9 18 6-6-6-6"/>'),
  full:FZSV('<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>'),
  vid:FZSV('<rect x="2" y="5" width="14" height="14" rx="2.5"/><path d="m16 10 6-3.5v11L16 14"/>'),
  link:FZSV('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'),
  plus:FZSV('<path d="M12 5v14M5 12h14"/>'),
  vlo:FZSV('<path d="M11 5 6 9H2v6h4l5 4z"/>'),
  vhi:FZSV('<path d="M11 5 6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>'),
  cup:FZSV('<path d="M17 8h1a4 4 0 0 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4zM6 2v2M10 2v2M14 2v2"/>'),
  moon:FZSV('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>'),
  rain:FZSV('<path d="M20 16.6A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25M8 19v2M8 13v2M16 19v2M16 13v2M12 21v2M12 15v2"/>'),
  waves:FZSV('<path d="M2 7c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2c1.3 0 1.9.5 2.5 1M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2c1.3 0 1.9.5 2.5 1M2 17c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2c1.3 0 1.9.5 2.5 1"/>'),
  wind:FZSV('<path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2M9.6 4.6A2 2 0 1 1 11 8H2M12.6 19.4A2 2 0 1 0 14 16H2"/>'),
  noise:FZSV('<path d="M2 10v4M6 6v12M10 3v18M14 8v8M18 5v14M22 10v4"/>')};
const AMBS=[['rain','Rain','rain'],['brown','Brown','waves'],['pink','Pink','wind'],['white','White','noise'],['cafe','Café','cup']];
const fzHm=m=>Math.floor(m/60)+'h '+pad(m%60)+'m';
function renderFocus(){const el=$('t-focus');if(!el)return;const live=YTP&&$('mBox')&&el.contains($('mBox'))?$('mBox').closest('.panel'):null;
  const today=FOCUS.sessions.filter(s=>s.d===DAYK);const dw=DAY.dw||0;
  const days=[...Array(7)].map((_,i)=>addDays(DAYK,i-6));const per=days.map(d=>FOCUS.sessions.filter(s=>s.d===d).reduce((a,s)=>a+s.min,0));per[6]=Math.max(per[6],dw);const mx=Math.max(DW_TARGET,...per);
  const pct=Math.min(100,Math.round(dw/DW_TARGET*100));
  const html=`<div class="focusgrid">
  <div class="panel fcard fz"><div class="pb">
    <div class="fz-ring"><svg viewBox="0 0 220 220"><circle cx="110" cy="110" r="100" class="rbg"/><circle cx="110" cy="110" r="100" class="rfg" id="fRing"/></svg>
      <div class="fz-in"><span class="fz-ph" id="fPhase">Focus</span><div class="fz-time num" id="timer">--:--</div><span class="fz-end num" id="fEnd"></span></div></div>
    <div class="fz-ctl"><button type="button" class="fz-c" id="tmReset">End</button><button type="button" class="fz-c go" id="tmGo">Start</button></div>
    <div class="fz-dur"><div class="fz-seg" id="tmPresets">${[25,50,75,90].map(m=>`<button type="button" data-m="${m}">${m}m</button>`).join('')}</div><div class="fz-step" id="tmStep"><button type="button" data-d="-5" aria-label="5 minutes less">−</button><i></i><button type="button" data-d="5" aria-label="5 minutes more">+</button></div></div>
    <div class="fz-list">
      <label class="fz-row"><span class="fz-ic g">${FI.moon}</span><span class="fz-t"><b>Auto break</b><small>Breaks start on their own</small></span><input type="checkbox" class="sl-sw" id="fPomo"${FOCUS.pomo?' checked':''}></label>
      ${FOCUS.pomo?`<div class="fz-row"><span class="fz-ic b">${FI.cup}</span><span class="fz-t"><b>Break length</b></span><div class="fz-step" id="fBrk"><button type="button" data-b="-5" aria-label="Shorter break">−</button><span class="num" id="fBrkV">${FOCUS.brk} min</span><button type="button" data-b="5" aria-label="Longer break">+</button></div></div>`:''}
      <button type="button" class="fz-row tap" id="fFull"><span class="fz-ic p">${FI.full}</span><span class="fz-t"><b>Focus mode</b><small>Full screen, nothing else</small></span><span class="fz-chev">${FI.chev}</span></button>
    </div>
  </div></div>
  <div class="fside">
    <div class="panel fz-today"><div class="ph"><span class="tag">Today</span><span class="dim">${today.length} session${today.length===1?'':'s'}</span></div><div class="pb">
      <div class="fz-big num">${Math.floor(dw/60)}<small>h</small> ${pad(dw%60)}<small>m</small></div><div class="fz-goal">of ${fzHm(DW_TARGET)} deep work · ${pct}%</div>
      <div class="meter"><span style="width:${pct}%"></span></div>
      <div class="fz-wk"><div class="gl" style="bottom:calc(22px + (100% - 22px) * ${(DW_TARGET/mx).toFixed(3)})"></div>${per.map((v,i)=>`<div class="d${i===6?' now':''}${v>=DW_TARGET?' hit':''}"><div class="bw"><div class="b" style="height:${(v/mx*100).toFixed(1)}%" title="${fzHm(v)}"></div></div><span class="l">${new Date(days[i]+'T12:00').toLocaleDateString('en-GB',{weekday:'narrow'})}</span></div>`).join('')}</div>
      ${today.length?`<div class="fz-log">${today.map(s=>`<div><span class="t num">${new Date(s.at).toTimeString().slice(0,5)}</span><span class="n">${esc(s.task||'Focus session')}</span><b class="num">${s.min} min</b></div>`).join('')}</div>`:`<div class="fz-empty">No sessions yet today</div>`}
    </div></div>
    <div class="panel"><div class="ph"><span class="tag">Audio deck</span></div><div class="pb${MUSIC.showVid?' showvid':''}" id="mBox">${musicHTML()}</div></div>
    <div class="panel"><div class="ph"><span class="tag">Ambient</span></div><div class="pb"><div class="fz-amb" id="ambBtns">${AMBS.map(([k,l,ic])=>`<button type="button" data-amb="${k}" aria-pressed="${AMB.kind===k}"><i>${FI[ic]}</i>${l}</button>`).join('')}</div>
      <div class="fz-vol">${FI.vlo}<input type="range" id="ambVol" min="0" max="100" value="${AMB.vol}" class="fz-range" style="--v:${AMB.vol}%" aria-label="Ambient volume">${FI.vhi}</div></div></div>
  </div></div>`;
  if(live){/* swap in everything except the audio deck, so whatever is playing keeps playing */
    const tmp=document.createElement('div');tmp.innerHTML=html;const fresh=tmp.querySelector('#mBox').closest('.panel');fresh.replaceWith(document.createComment('deck'));
    const oldGrid=el.querySelector('.focusgrid');const newGrid=tmp.querySelector('.focusgrid');
    oldGrid.querySelector('.fcard').replaceWith(newGrid.querySelector('.fcard'));
    const side=oldGrid.querySelector('.fside');[...side.children].forEach(ch=>{if(ch!==live)ch.remove()});[...newGrid.querySelector('.fside').childNodes].forEach(n=>{if(n.nodeType===8)side.appendChild(live);else side.appendChild(n)});
  }else el.innerHTML=html;
  drawTimer();bindFocus(!!live);
}
function setLen(m){TM={len:m,end:null,left:m*60,phase:'focus'};LS.set('timer',TM);drawTimer()}
function bindFocus(keepDeck){
  $('tmGo').onclick=()=>{if(TM.end){TM.left=tmLeft();TM.end=null;pushCancel('focus')}else{TM.end=Date.now()+TM.left*1000;if(typeof brickAuto==='function'&&TM.phase==='focus')brickAuto(true,Math.ceil(TM.left/60));if(nOn('focus'))pushOne('focus',TM.end,TM.phase==='break'?'Break over':'Focus session complete',TM.phase==='break'?'Time to get back to it':'Time for a break','./#tools')}LS.set('timer',TM);drawTimer();glitchAll()};
  $('tmReset').onclick=()=>{if(TM.phase==='focus'){const done=Math.floor((TM.len*60-tmLeft())/60);logDw(done)}if(TM.end)pushCancel('focus');TM={len:TM.len,end:null,left:TM.len*60,phase:'focus'};LS.set('timer',TM);drawTimer()};
  $('tmPresets').onclick=e=>{const b=e.target.closest('button');if(!b||TM.end)return;setLen(+b.dataset.m)};
  $('tmStep').onclick=e=>{const b=e.target.closest('button');if(!b||TM.end)return;setLen(Math.max(5,Math.min(240,TM.len+(+b.dataset.d))))};
  $('fPomo').onchange=e=>{FOCUS.pomo=e.target.checked;save('tools/focus',FOCUS);setTimeout(renderFocus,220)};
  if($('fBrk'))$('fBrk').onclick=e=>{const b=e.target.closest('button');if(!b)return;FOCUS.brk=Math.max(5,Math.min(30,(FOCUS.brk||10)+(+b.dataset.b)));$('fBrkV').textContent=FOCUS.brk+' min';save('tools/focus',FOCUS);drawTimer()};
  $('fFull').onclick=openFocusMode;
  $('mBox').onclick=musicClick;vizAttach($('vizC'));
  $('ambBtns').onclick=e=>{const b=e.target.closest('[data-amb]');if(!b)return;ambient(AMB.kind===b.dataset.amb?null:b.dataset.amb);$('ambBtns').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x.dataset.amb===AMB.kind))};
  $('ambVol').oninput=e=>{AMB.vol=+e.target.value;LS.set('amb',{vol:AMB.vol});if(AMB.g)AMB.g.gain.value=AMB.vol/100*.6};
  if(deckSrc()&&!keepDeck)ensureYT();
}
/* sliders paint their own filled track */
document.addEventListener('input',e=>{const t=e.target;if(t&&t.classList&&t.classList.contains('fz-range'))t.style.setProperty('--v',t.value+'%')});
function drawTimer(){const l=tmLeft();const tot=tmTotal();const hh=Math.floor(l/3600);const txt=(hh?hh+':'+pad(Math.floor(l%3600/60)):pad(Math.floor(l/60)))+':'+pad(l%60);
  const brk=TM.phase==='break',fresh=!TM.end&&l>=tot;
  ['timer','fmTime'].forEach(id=>{const t=$(id);if(t){t.textContent=txt;t.classList.toggle('run',!!TM.end);t.classList.toggle('long',txt.length>5)}});
  const f=tot?l/tot:0;['fRing','fmRing'].forEach(id=>{const r=$(id);if(r){const C=628.3;r.style.strokeDasharray=C;r.style.strokeDashoffset=(C*(1-f)).toFixed(1);r.classList.toggle('brk',brk)}});
  const end=TM.end?new Date(TM.end):new Date(Date.now()+l*1000);const et=pad(end.getHours())+':'+pad(end.getMinutes());
  ['fEnd','fmEnd'].forEach(id=>{const e=$(id);if(e){if(e.dataset.t!==et){e.innerHTML=FI.bell+'<span>'+et+'</span>';e.dataset.t=et}e.classList.toggle('paused',!TM.end)}});
  const ph=brk?'Break':TM.end?'Focusing':fresh?'Focus':'Paused';['fPhase','fmPhase'].forEach(id=>{if($(id))$(id).textContent=ph});
  ['tmGo','fmGo'].forEach(id=>{const b=$(id);if(b){b.textContent=TM.end?'Pause':fresh?'Start':'Resume';b.classList.toggle('pause',!!TM.end)}});
  ['tmReset','fmStop'].forEach(id=>{const b=$(id);if(b){b.textContent=brk?'Skip':'End';b.disabled=fresh&&!brk}});
  if($('tmPresets'))$('tmPresets').querySelectorAll('button').forEach(b=>{b.setAttribute('aria-pressed',+b.dataset.m===TM.len);b.disabled=!!TM.end});
  if($('tmStep'))$('tmStep').querySelectorAll('button').forEach(b=>b.disabled=!!TM.end);
  if(TM.end&&l===0){chime();if(TM.phase==='focus'){logDw(TM.len);if(typeof brickAuto==='function')brickAuto(false);flash('block_done');shake();burst(innerWidth/2,innerHeight/2,160,true);
      TM=FOCUS.pomo?{len:TM.len,phase:'break',left:FOCUS.brk*60,end:Date.now()+FOCUS.brk*60*1000}:{len:TM.len,end:null,left:TM.len*60,phase:'focus'}}
    else{flash('back_to_work');TM={len:TM.len,end:null,left:TM.len*60,phase:'focus'}}LS.set('timer',TM);drawTimer()}}
setInterval(drawTimer,1000);
function chime(){try{const A=window.AudioContext||window.webkitAudioContext;const a=new A();[523,659,784,1046].forEach((f,i)=>{const o=a.createOscillator(),g=a.createGain();o.type='sine';o.frequency.value=f;const t=a.currentTime+i*.14;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.2,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+.9);o.connect(g);g.connect(a.destination);o.start(t);o.stop(t+1)})}catch(e){}try{navigator.vibrate&&navigator.vibrate([200,80,200])}catch(e){}}

/* focus mode (full screen) */
function openFocusMode(){let fm=$('focusMode');if(!fm){fm=document.createElement('div');fm.id='focusMode';fm.className='focusmode';document.body.appendChild(fm)}
  const src=deckSrc();
  fm.innerHTML=`${DECKS[deckNow()].audio&&src?'<canvas class="viz fmviz" id="fmViz"></canvas>':''}<button class="fm-x" type="button" id="fmX" aria-label="Exit focus mode">${FI.x}</button>
    <div class="fz-ring fm-ring"><svg viewBox="0 0 220 220"><circle cx="110" cy="110" r="100" class="rbg"/><circle cx="110" cy="110" r="100" class="rfg" id="fmRing"/></svg><div class="fz-in"><span class="fz-ph" id="fmPhase"></span><div class="fz-time num" id="fmTime"></div><span class="fz-end num" id="fmEnd"></span></div></div>
    <div class="fz-ctl"><button type="button" class="fz-c" id="fmStop">End</button><button type="button" class="fz-c go" id="fmGo">Start</button></div>
    ${src?`<div class="fm-np"><button type="button" id="fmMus" aria-label="Play audio">${FI.play}</button><span class="fm-nt" id="fmNow">Audio deck</span><button type="button" class="sec" id="fmVid" aria-label="Show video">${FI.vid}</button></div>`:''}`;
  fm.classList.add('on');try{fm.requestFullscreen&&fm.requestFullscreen().catch(()=>{})}catch(e){}
  $('fmX').onclick=()=>{fm.classList.remove('on');try{document.fullscreenElement&&document.exitFullscreen()}catch(e){}};
  $('fmGo').onclick=()=>$('tmGo')?$('tmGo').click():null;$('fmStop').onclick=()=>$('tmReset')?$('tmReset').click():null;
  if($('fmMus'))$('fmMus').onclick=()=>ytToggle();if($('fmVid'))$('fmVid').onclick=()=>vidFull(true);drawTimer();ytNow();vizAttach($('fmViz'))}

/* music deck: lofi / private picks (audio + visualiser) · jvscholz (random livestream, video) · mine (other playlists) */
const SCHOLZ='UULVMwo6hT5hI3R56rO2HYP-wQ'; /* James Scholz — live streams uploads list */
const DECKS={lofi:{label:'lofi',sub:'your lofi playlist',audio:true},[LX('dk','picks')]:{label:LX('dk','picks'),sub:LW('dks','your private picks'),audio:true,random:true},scholz:{label:'jvscholz',sub:'random old pomodoro stream',audio:false,random:true},mine:{label:'custom',sub:'your other playlists',audio:true}};
let VLIST={},VHIST=[];const DSEEN=new Set();
function ytPlaying(){try{return !!YTP&&YTP.getPlayerState()===1}catch(e){return false}}
/* remember exactly where each deck was, so switching away and back carries on */
function savePos(){try{const s=deckSrc();if(!YTP||!s||s.deck==='mine')return;const v=(YTP.getVideoData()||{}).video_id,t=YTP.getCurrentTime();if(v){DPOS[s.deck]={key:s.key,v,t};LS.set('deckpos',DPOS)}}catch(e){}}
let YTP=null,ytReady=false,ytLoading=false,ytQ=null,ytTries=0;
const DPOS=LS.get('deckpos')||{};
function parseYT(url){try{const u=new URL(url.trim());const list=u.searchParams.get('list');let v=u.searchParams.get('v');if(!v&&/youtu\.be$/.test(u.hostname))v=u.pathname.slice(1);if(!v&&u.pathname.startsWith('/shorts/'))v=u.pathname.split('/')[2];return list?{type:'list',key:list,v}:v?{type:'video',key:v}:null}catch(e){return null}}
const deckNow=()=>DECKS[MUSIC.deck]?MUSIC.deck:'lofi';
function deckSrc(){const d=deckNow();if((d===LX('dk','picks')||d==='lofi')&&VLIST[d]&&VLIST[d].length)return {type:'vids',key:d+'-vids',ids:VLIST[d],deck:d};if(d==='mine'){const s=MUSIC.list.find(x=>x.id===MUSIC.cur);return s?{...s,deck:'mine'}:null}const l=d==='scholz'?SCHOLZ:(MUSIC.decks||{})[d];return l?{type:'list',key:l,deck:d}:null}
/* phones show the video by default (their own setting, not the synced one) */
const PHONE=/iPhone|iPod/.test(navigator.userAgent)||(navigator.maxTouchPoints>0&&matchMedia('(max-width:520px)').matches);
function showVidNow(){if(!PHONE)return !!MUSIC.showVid;const o=LS.get('phonevid');return o===null||o===undefined?true:!!o}
/* the deck's video across the whole screen — over focus mode too; the timer keeps running behind it */
function vidFull(on){const b=$('mVidBox');if(!b)return;if(on===undefined)on=!b.classList.contains('vfull');
  b.classList.toggle('vfull',on);document.body.classList.toggle('vfullon',on);let x=$('vfX');
  if(on){if(!x){x=document.createElement('button');x.id='vfX';x.type='button';x.className='vfx';x.textContent='✕ exit';x.onclick=e=>{e.stopPropagation();vidFull(false)};b.appendChild(x)}
    try{if(b.requestFullscreen){b._fs=true;b.requestFullscreen().catch(()=>{b._fs=false})}}catch(e){}}
  else{if(x)x.remove();try{if(document.fullscreenElement===b)document.exitFullscreen()}catch(e){}b._fs=false}}
document.addEventListener('fullscreenchange',()=>{const b=$('mVidBox');if(b&&b._fs&&b.classList.contains('vfull')&&document.fullscreenElement!==b)vidFull(false)});
addEventListener('keydown',e=>{if(e.key==='Escape'&&$('mVidBox')&&$('mVidBox').classList.contains('vfull'))vidFull(false)});
function openMode(d){return (MUSIC.open||{})[d]||(d==='scholz'?'random':'resume')}
function musicHTML(){const d=deckNow(),D=DECKS[d],src=deckSrc();
  const seg=`<div class="seg deckseg" id="deckSeg">${Object.keys(DECKS).map(k=>`<button type="button" data-deck="${k}" aria-pressed="${k===d}">${DECKS[k].label}</button>`).join('')}</div>`;
  if(!src&&d!=='mine')return seg+`<div class="dsetup"><div class="dim">Paste your ${D.label} playlist link. It has to be <b>Public</b> or <b>Unlisted</b> on YouTube — private playlists won't play outside YouTube. The link is saved to your account only, not the app's code.</div><div class="row" style="gap:6px;margin-top:8px"><input class="inp" id="dkUrl" placeholder="Https://music.youtube.com/playlist?list=…" style="flex:1"><button class="btn p" type="button" id="dkSave">Save</button></div></div>`;
  const mine=d==='mine'?`<div class="mlist">${MUSIC.list.map(s=>`<div class="mstn${s.id===MUSIC.cur?' on':''}"><button type="button" data-ms="${esc(s.id)}"><span class="mthumb" style="background-image:url(${s.thumb?esc(s.thumb):''})"></span><span>${esc(s.name)}</span></button><button class="iconbtn" type="button" data-mdel="${esc(s.id)}" aria-label="Remove">${FI.x}</button></div>`).join('')}</div><button class="dk-add" type="button" id="mAdd">${FI.plus}<span>Add playlist</span></button>`:'';
  if(!src)return seg+mine;
  const om=openMode(d);
  return seg+`<div class="deck ${D.audio?'aud':'vid'}"><div class="dscreen">${D.audio?`<canvas class="viz" id="vizC"></canvas><div class="dhud"><span id="dHudL">> ${esc(D.label)}.stream</span><span id="dHudR" class="num"></span></div>`:''}<div class="mvid${D.audio?' mini':''}" id="mVidBox"><div id="ytFrame"></div></div></div>
    <div class="mmeta"><b id="mTitle">loading…</b><span class="dim" id="mArtist"></span><div class="mprog seek" id="mSeek"><i id="mBar"></i><b id="mKnob"></b></div><div class="row" style="justify-content:space-between"><span class="dim num" id="mTime" style="font-size:10px"></span><span class="dim num" id="mIdx" style="font-size:10px"></span></div>
    <div class="mctl"><button type="button" data-mc="prev" aria-label="Previous">${FI.prev}</button><button type="button" data-mc="play" class="mplay" id="mPlay" aria-label="Play">${FI.play}</button><button type="button" data-mc="next" aria-label="Next">${FI.next}</button>${d==='mine'?`<button type="button" data-mc="shuf" class="mshuf" aria-pressed="${MUSIC.shuffle}" aria-label="Shuffle">${FI.shuf}</button>`:''}</div><div class="fz-vol">${FI.vlo}<input type="range" min="0" max="100" value="${MUSIC.vol}" id="mVol" class="fz-range" style="--v:${MUSIC.vol}%" aria-label="Volume">${FI.vhi}</div>
    <div class="mskip"><button type="button" data-sk="-10">−10s</button><button type="button" data-sk="30">+30s</button><button type="button" data-sk="120">+2m</button><button type="button" data-sk="300">+5m</button></div>
    ${d!=='mine'?`<div class="dk-opts"><div class="dk-om"><span>When opened</span><div class="fz-seg sm" id="dkOpen"><button type="button" data-om="resume" aria-pressed="${om==='resume'}">Resume</button><button type="button" data-om="random" aria-pressed="${om==='random'}">Random</button></div></div><div class="dk-btns">${D.audio?`<button type="button" id="dkVid">${FI.vid}<span>${showVidNow()?'Hide':'Show'} video</span></button>`:''}<button type="button" id="dkFull">${FI.full}<span>Full screen</span></button>${d==='lofi'&&src.type!=='vids'?`<button type="button" id="dkEdit">${FI.link}<span>Change playlist</span></button>`:''}</div></div>`:''}</div></div>`+mine}
function addStation(){openEditor({title:'add playlist',fields:[{k:'url',label:'YouTube Music / YouTube link'},{k:'name',label:'name (optional)'}],values:{url:'',name:''},isNew:true,
  hint:'Open the playlist in YouTube Music → Share → Copy link, and paste it here.',onSave:v=>{const p=parseYT(v.url||'');if(!p){flash('not_a_youtube_link');return}
    const s={id:rid(),name:(v.name||'').trim()||(p.type==='list'?'playlist':'track'),...p,thumb:p.v||p.type==='video'?`https://i.ytimg.com/vi/${p.v||p.key}/hqdefault.jpg`:''};MUSIC.list.push(s);MUSIC.cur=s.id;MUSIC.deck='mine';save('tools/music',MUSIC);renderFocus()}})}
function musicRender(play,mode){if(!$('mBox'))return;try{YTP&&YTP.destroy()}catch(e){}YTP=null;ytReady=false;if($('deckSub'))$('deckSub').textContent=DECKS[deckNow()].sub;$('mBox').innerHTML=musicHTML();$('mBox').classList.toggle('showvid',showVidNow());vizAttach($('vizC'));ensureYT(play,mode);
  const ds=$('mBox').querySelector('.dscreen');if(ds){let lt=0;ds.ondblclick=()=>vidFull();ds.addEventListener('touchend',()=>{const n=Date.now();if(n-lt<320)vidFull();lt=n})}}
function musicClick(e){const b=e.target.closest('button');if(!b)return;
  if(b.dataset.sk&&YTP){try{const t=YTP.getCurrentTime()+(+b.dataset.sk);YTP.seekTo(Math.max(0,Math.min(t,YTP.getDuration()-1)),true)}catch(x){}return}
  if(b.dataset.deck){if(b.dataset.deck===deckNow())return;const was=ytPlaying();savePos();MUSIC.deck=b.dataset.deck;save('tools/music',MUSIC);musicRender(was,DSEEN.has(MUSIC.deck)?'resume':undefined);return}
  if(b.id==='mAdd')return addStation();
  if(b.id==='dkSave'){const p=parseYT($('dkUrl').value||'');if(!p||p.type!=='list'){flash('paste_a_playlist_link');return}MUSIC.decks={...(MUSIC.decks||{}),[deckNow()]:p.key};delete DPOS[deckNow()];LS.set('deckpos',DPOS);save('tools/music',MUSIC);musicRender(false);return}
  if(b.id==='dkEdit'){const d=deckNow();const old=(MUSIC.decks||{})[d];MUSIC.decks={...MUSIC.decks};delete MUSIC.decks[d];musicRender(false);if(old)$('dkUrl').value='https://music.youtube.com/playlist?list='+old;MUSIC.decks[d]=old;return}
  if(b.id==='dkVid'){const nv=!showVidNow();if(PHONE)LS.set('phonevid',nv);else{MUSIC.showVid=nv;save('tools/music',MUSIC)}$('mBox').classList.toggle('showvid',nv);b.querySelector('span').textContent=(nv?'Hide':'Show')+' video';return}
  if(b.id==='dkFull'){vidFull(true);return}
  if(b.id==='vfX')return;
  if(b.dataset.om){MUSIC.open={...(MUSIC.open||{}),[deckNow()]:b.dataset.om};$('dkOpen').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b));save('tools/music',MUSIC);return}
  if(b.dataset.ms){MUSIC.cur=b.dataset.ms;save('tools/music',MUSIC);musicRender(true);return}
  if(b.dataset.mdel){if(!b.dataset.arm){b.dataset.arm=1;b.classList.add('arm');b.textContent='Delete';return}MUSIC.list=MUSIC.list.filter(x=>x.id!==b.dataset.mdel);if(MUSIC.cur===b.dataset.mdel)MUSIC.cur=null;save('tools/music',MUSIC);musicRender(false);return}
  const c=b.dataset.mc;if(!c||!YTP)return;
  if(c==='play')ytToggle();
  if(c==='next'){if(DECKS[deckNow()].random)ytRandom();else if(ytVids())vidStep(1);else YTP.nextVideo&&YTP.nextVideo()}
  if(c==='prev'){try{if(YTP.getCurrentTime()>8)YTP.seekTo(0,true);else if(ytVids())vidBack();else YTP.previousVideo()}catch(x){}}
  if(c==='rnd')ytRandom();
  if(c==='shuf'){MUSIC.shuffle=!MUSIC.shuffle;YTP.setShuffle&&YTP.setShuffle(MUSIC.shuffle);b.setAttribute('aria-pressed',MUSIC.shuffle);save('tools/music',MUSIC)}}
let mSeekDrag=false;
function bindSeek(){const el=$('mSeek');if(!el)return;const frac=e=>{const r=el.getBoundingClientRect();return Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))};
  const show=f=>{$('mBar').style.width=f*100+'%';$('mKnob').style.left=f*100+'%';try{if($('mTime'))$('mTime').textContent=fmtT(f*YTP.getDuration())+' / '+fmtT(YTP.getDuration())}catch(x){}};
  el.onpointerdown=e=>{if(!YTP)return;mSeekDrag=true;el.setPointerCapture(e.pointerId);show(frac(e));e.preventDefault()};
  el.onpointermove=e=>{if(mSeekDrag)show(frac(e))};
  el.onpointerup=el.onpointercancel=e=>{if(!mSeekDrag)return;mSeekDrag=false;try{YTP.seekTo(frac(e)*YTP.getDuration(),true)}catch(x){}}}
function ytToggle(){if(!YTP||!YTP.getPlayerState)return;const st=YTP.getPlayerState();if(st===1||st===3){YTP.pauseVideo();ytBtn(false);return}YTP.playVideo();ytBtn(true);ytKick()}
/* the play button follows the player itself, not just its change events — those get dropped */
function ytBtn(on){['mPlay','fmMus'].forEach(id=>{const b=$(id);if(b&&b.dataset.on!==String(on)){b.dataset.on=on;b.innerHTML=on?FI.pause:FI.play;b.setAttribute('aria-label',on?'Pause':'Play')}})}
/* iOS sometimes needs one tap on the actual video before the API can start it: reveal it if play didn't take */
function ytKick(){clearTimeout(ytKick.t);ytKick.t=setTimeout(()=>{try{const st=YTP.getPlayerState();if(st!==1&&st!==3&&$('mBox')&&!$('mBox').classList.contains('showvid')){$('mBox').classList.add('showvid');flash('tap_the_video_once')}}catch(e){}},2500)}
function ensureYT(play,mode){const s=deckSrc();if(!s||!$('ytFrame'))return;
  if(window.YT&&window.YT.Player){ytLoad(s,play,mode);return}ytQ=[play,mode];if(ytLoading)return;ytLoading=true;window.onYouTubeIframeAPIReady=()=>{ytLoading=false;const s2=deckSrc();if(s2&&$('ytFrame'))ytLoad(s2,ytQ[0],ytQ[1])};const sc=document.createElement('script');sc.src='https://www.youtube.com/iframe_api';document.head.appendChild(sc)}
function ytLoad(s,play,mode){if(!window.YT||!window.YT.Player||!$('ytFrame'))return ensureYT(play,mode);
  DSEEN.add(s.deck);const pos=DPOS[s.deck];mode=mode||(s.type==='list'&&s.deck!=='mine'?openMode(s.deck):null);if(mode==='resume'&&!(pos&&pos.key===s.key))mode=DECKS[s.deck].random?'random':null;
  const pv={controls:0,playsinline:1,rel:0,modestbranding:1,iv_load_policy:3,disablekb:1};if(s.type==='list'){pv.listType='playlist';pv.list=s.key}
  let vStart=0;if(s.type==='vids'){let v=mode==='resume'&&pos&&s.ids.includes(pos.v)?pos.v:null;if(v)vStart=Math.max(0,(pos.t||0)-3);else v=s.ids[Math.floor(Math.random()*s.ids.length)];s={...s,type:'video',key:v,vids:true};VHIST=[v];pv.start=Math.floor(vStart)}
  ytTries=0;const opts={width:'100%',height:'100%',playerVars:pv};if(s.type==='video')opts.videoId=s.key;YTP=new YT.Player('ytFrame',{...opts,events:{
    onReady:async()=>{ytReady=true;if(s.type==='list')setTimeout(async()=>{const pl=await ytPlaylist();if(!pl.length&&$('mTitle'))$('mTitle').textContent='can\u2019t load this playlist \u2014 set it to Unlisted (not Private) on YouTube'},4000);try{YTP.setVolume(MUSIC.vol);if(s.deck==='mine'&&MUSIC.shuffle&&YTP.setShuffle)YTP.setShuffle(true)}catch(e){}
      if(s.type==='list'&&mode){const pl=await ytPlaylist();let i=-1,t=0;if(mode==='resume'){i=pl.indexOf(pos.v);t=Math.max(0,(pos.t||0)-3)}if(i<0&&(mode==='random'||DECKS[s.deck].random))i=Math.floor(Math.random()*pl.length);
        if(i>=0){YTP[play?'loadPlaylist':'cuePlaylist']({list:s.key,listType:'playlist',index:i,startSeconds:t});ytNow();return}}
      if(play)YTP.playVideo();ytNow()},
    onStateChange:e=>{if(e&&e.data===1)ytTries=0;if(e&&e.data===0&&ytVids())vidStep(0);ytNow()},
    onError:()=>{if(++ytTries>6)return;setTimeout(()=>{if(ytVids())vidStep(DECKS[deckNow()].random?2:1);else try{YTP.nextVideo()}catch(e){}},400)}}});
  bindSeek();$('mBox').oninput=e=>{if(e.target.id==='mVol'){MUSIC.vol=+e.target.value;try{YTP.setVolume(MUSIC.vol)}catch(x){}clearTimeout(ytLoad.t);ytLoad.t=setTimeout(()=>save('tools/music',MUSIC),800)}}}
async function ytPlaylist(){for(let i=0;i<24;i++){let pl=null;try{pl=YTP.getPlaylist()}catch(e){}if(pl&&pl.length)return pl;await new Promise(r=>setTimeout(r,250))}return []}
const ytVids=()=>{const s=deckSrc();return s&&s.type==='vids'?s.ids:null};
/* id-list decks: next = random unheard, back = history */
function vidStep(dir){const ids=ytVids();if(!ids||!YTP)return;if(dir===1||(dir===0&&!DECKS[deckNow()].random)){let cur='';try{cur=YTP.getVideoData().video_id}catch(e){}const i=(ids.indexOf(cur)+1)%ids.length;VHIST.push(ids[i]);try{YTP.loadVideoById(ids[i])}catch(e){}return}const recent=new Set(VHIST.slice(-40));const pool=ids.filter(v=>!recent.has(v));const pick=(pool.length?pool:ids)[Math.floor(Math.random()*(pool.length||ids.length))];VHIST.push(pick);try{YTP.loadVideoById(pick)}catch(e){}}
function vidBack(){if(VHIST.length<2||!YTP)return;VHIST.pop();try{YTP.loadVideoById(VHIST[VHIST.length-1])}catch(e){}}
async function ytRandom(){if(!YTP)return;if(ytVids())return vidStep(2);const pl=await ytPlaylist();if(!pl.length){try{YTP.nextVideo()}catch(e){}return}let cur=-1;try{cur=YTP.getPlaylistIndex()}catch(e){}let i=Math.floor(Math.random()*pl.length);if(i===cur&&pl.length>1)i=(i+1)%pl.length;try{YTP.playVideoAt(i)}catch(e){}}
function fmtT(x){x=Math.floor(x||0);const h=Math.floor(x/3600),m=Math.floor(x%3600/60),s=x%60;return (h?h+':'+pad(m):m)+':'+pad(s)}
function ytNow(){if(!YTP||!YTP.getVideoData)return;let d={};try{d=YTP.getVideoData()||{}}catch(e){}const st=YTP.getPlayerState?YTP.getPlayerState():-1;VIZ.on=st===1;
  if($('mTitle'))$('mTitle').textContent=d.title||(st===-1||st===5?'ready':'loading…');if($('mArtist'))$('mArtist').textContent=d.author||'';ytBtn(st===1||st===3);
  try{const ids=ytVids();if(ids&&$('mIdx')){const i=ids.indexOf(d.video_id);$('mIdx').textContent=(i>=0?'#'+(i+1)+' / ':'')+ids.length}const pl=YTP.getPlaylist&&YTP.getPlaylist();if(pl&&pl.length&&$('mIdx'))$('mIdx').textContent='#'+(YTP.getPlaylistIndex()+1)+' / '+pl.length}catch(e){}
  if($('fmNow'))$('fmNow').textContent=d.title?d.title+(d.author?' — '+d.author:''):'Audio deck';
  const s=deckSrc();if(s&&s.deck==='mine'&&d.video_id){const m=MUSIC.list.find(x=>x.id===s.id);if(m&&!m.thumb){m.thumb=`https://i.ytimg.com/vi/${d.video_id}/hqdefault.jpg`;save('tools/music',MUSIC)}}}
setInterval(()=>{if(!YTP||!YTP.getCurrentTime||!ytReady)return;try{const t=YTP.getCurrentTime(),du=YTP.getDuration();if($('mBar')&&!mSeekDrag){$('mBar').style.width=(du?t/du*100:0)+'%';$('mKnob').style.left=(du?t/du*100:0)+'%'}if($('mTime'))$('mTime').textContent=fmtT(t)+' / '+fmtT(du);const ps=YTP.getPlayerState();ytBtn(ps===1||ps===3);VIZ.on=ps===1;if($('dHudR'))$('dHudR').textContent=(ps===1?'▶ ':'❚❚ ')+fmtT(t);
  const s=deckSrc();if(s&&s.deck!=='mine'&&YTP.getPlayerState()===1&&t>5&&!mSeekDrag){const v=(YTP.getVideoData()||{}).video_id;if(v){DPOS[s.deck]={key:s.key,v,t};DPOS.n=(DPOS.n||0)+1;if(DPOS.n%5===0)LS.set('deckpos',DPOS)}}}catch(e){}},1000);

/* PSP-style wave visualiser. It can't read YouTube's audio (cross-origin), so it follows play/pause and drifts organically. 30fps, stops when not visible. */
const VIZ={cv:new Set(),run:false,e:0,on:false,t:0,last:0,col:null};
function vizAttach(c){if(!c)return;VIZ.cv.add(c);if(!VIZ.run){VIZ.run=true;VIZ.last=performance.now();requestAnimationFrame(vizTick)}}
function vizTick(ts){VIZ.cv.forEach(c=>{if(!c.isConnected)VIZ.cv.delete(c)});if(!VIZ.cv.size){VIZ.run=false;return}
  const live=[...VIZ.cv].filter(c=>c.offsetWidth>0);if(!live.length||document.hidden){VIZ.last=ts;setTimeout(()=>requestAnimationFrame(vizTick),400);return}
  if(ts-VIZ.last<32){requestAnimationFrame(vizTick);return}const dt=Math.min(.1,(ts-VIZ.last)/1000);VIZ.last=ts;
  VIZ.e+=((VIZ.on?1:.08)-VIZ.e)*Math.min(1,dt*2);VIZ.t+=dt*(.25+VIZ.e*.9);live.forEach(drawViz);requestAnimationFrame(vizTick)}
function drawViz(c){const dpr=Math.min(2,devicePixelRatio||1),W=c.offsetWidth,H=c.offsetHeight;if(c.width!==Math.round(W*dpr)){c.width=Math.round(W*dpr);c.height=Math.round(H*dpr)}
  const g=c.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);const t=VIZ.t,e=VIZ.e;
  if(!VIZ.col){const cs=getComputedStyle(document.documentElement);VIZ.col=[cs.getPropertyValue('--pink').trim()||'#ff2a6d',cs.getPropertyValue('--cyan').trim()||'#05d9e8',cs.getPropertyValue('--ok').trim()||'#57f5a8']}
  g.globalCompositeOperation='source-over';g.fillStyle='rgba(2,2,4,.28)';g.fillRect(0,0,W,H);
  g.strokeStyle='rgba(255,255,255,.035)';g.lineWidth=1;g.beginPath();for(let x=0;x<W;x+=24){g.moveTo(x+.5,0);g.lineTo(x+.5,H)}for(let y=0;y<H;y+=24){g.moveTo(0,y+.5);g.lineTo(W,y+.5)}g.stroke();
  g.globalCompositeOperation='lighter';const mid=H*.52,amp=H*.32;
  for(let k=0;k<5;k++){const col=VIZ.col[k%3],ph=k*1.7,sp=.6+k*.17,thick=(6+k*5)*(.35+e*.65);
    const y=x=>{const u=x/W;return mid+Math.sin(u*(2.2+k*.35)*Math.PI+t*sp+ph)*amp*(.25+.75*e)*(.55+.45*Math.sin(t*.5+k))+Math.sin(u*9+t*1.9+k)*amp*.12*e+Math.sin(u*3.1-t*.7+ph)*amp*.18};
    g.beginPath();for(let x=0;x<=W;x+=6)g.lineTo(x,y(x)-thick);for(let x=W;x>=0;x-=6)g.lineTo(x,y(x)+thick);g.closePath();g.fillStyle=col;g.globalAlpha=.07+.05*e;g.fill();
    g.beginPath();for(let x=0;x<=W;x+=4)g.lineTo(x,y(x));g.strokeStyle=col;g.globalAlpha=.35+.45*e;g.lineWidth=1.2;g.stroke()}
  g.globalAlpha=1;g.globalCompositeOperation='source-over';
  const n=Math.max(16,Math.floor(W/14)),bw=W/n;for(let i=0;i<n;i++){const v=Math.abs(Math.sin(i*.9+t*3.1)*Math.sin(i*.37-t*1.7)+Math.sin(t*5+i*2.3)*.25)*e;const h=Math.max(1.5,v*H*.22);g.fillStyle=i%2?VIZ.col[1]:VIZ.col[0];g.globalAlpha=.25+.5*v;g.fillRect(i*bw+1,H-h,bw-2,h)}g.globalAlpha=1}

/* ambient sound, synthesised (no downloads) */
const AMB={kind:null,vol:(LS.get('amb')||{}).vol??40,ctx:null,src:null,g:null};
function ambient(kind){try{if(AMB.src){AMB.src.forEach(n=>{try{n.stop()}catch(e){}});AMB.src=null}AMB.kind=kind;if(!kind)return;
  const A=window.AudioContext||window.webkitAudioContext;AMB.ctx=AMB.ctx||new A();const a=AMB.ctx;a.resume&&a.resume();
  const len=a.sampleRate*4,buf=a.createBuffer(2,len,a.sampleRate);for(let ch=0;ch<2;ch++){const d=buf.getChannelData(ch);let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0,last=0;
    for(let i=0;i<len;i++){const w=Math.random()*2-1;
      if(kind==='white')d[i]=w*.25;
      else if(kind==='brown'||kind==='rain'){last=(last+.02*w)/1.02;d[i]=last*3.2}
      else{b0=.99886*b0+w*.0555179;b1=.99332*b1+w*.0750759;b2=.969*b2+w*.153852;b3=.8665*b3+w*.3104856;b4=.55*b4+w*.5329522;b5=-.7616*b5-w*.016898;d[i]=(b0+b1+b2+b3+b4+b5+b6+w*.5362)*.09;b6=w*.115926}
      if(kind==='rain'&&Math.random()<.0009)d[i]+=(Math.random()-.5)*.9;if(kind==='cafe'&&Math.random()<.00006)for(let k=0;k<400&&i+k<len;k++)d[i+k]+=Math.sin(k*(.05+Math.random()*.02))*.05*Math.exp(-k/150)}}
  const s=a.createBufferSource();s.buffer=buf;s.loop=true;let node=s;
  if(kind==='rain'){const f=a.createBiquadFilter();f.type='highpass';f.frequency.value=400;s.connect(f);node=f}
  if(kind==='cafe'){const f=a.createBiquadFilter();f.type='lowpass';f.frequency.value=1800;s.connect(f);node=f}
  AMB.g=a.createGain();AMB.g.gain.value=AMB.vol/100*.6;node.connect(AMB.g);AMB.g.connect(a.destination);s.start();AMB.src=[s]}catch(e){}}

/* ---------------- loading ---------------- */
async function loadTools(){const [f,m,a]=await Promise.all([load('tools/focus'),load('tools/music'),load('tools/decks')]);VLIST=a||{};FOCUS={sessions:[],pomo:false,brk:10,task:'',...(f||{})};MUSIC={list:[],cur:null,vol:60,shuffle:false,deck:'lofi',decks:{},open:{},showVid:false,...(m||{})};
  WEEK=await load('weeks/w-'+WK)||{};if(typeof loadProto==='function')await loadProto();if(typeof loadLeet==='function')await loadLeet();renderTools()}
watch('tools/music',d=>{if(!d)return;const keep={cur:MUSIC.cur,deck:MUSIC.deck};MUSIC={list:[],decks:{},open:{},...d,...keep};if(cur==='tools'&&TOOLV==='focus'&&$('mBox')&&!YTP)musicRender(false)});

/* ================= INK LAYER — handwriting drawn over typed text (journal + notes) =================
   the page is a host element holding the text (textarea / contenteditable) with canvases laid over / under it.
   ink = {h, strokes:[{i,c,w,t,pts:[x,y,pressure,...]}], bg}; coordinates are page units (IW wide), so ink stays where it was drawn.
   Highlighter strokes sit UNDER the text (back canvas) so words stay readable; pen strokes sit over it.
   One mode at a time: "type" (text is live) or an ink tool (text is frozen, the canvas takes every touch). */
const IW=1000,IH=1400;
const INKS={tool:'type',col:'#e6e6e6',hcol:'#ffe14d',w:4,po:LS.get('pencilOnly')||false,...(LS.get('inkset')||{})};INKS.tool='type';
INKS.w=[2,4,7].reduce((a,b)=>Math.abs(b-INKS.w)<Math.abs(a-INKS.w)?b:a);
const inkSet=()=>LS.set('inkset',{col:INKS.col,hcol:INKS.hcol,w:INKS.w,po:INKS.po});
const INK_BG=['blank','grid','dots'];const inkBgOf=k=>INK_BG.includes(k&&k.bg)?k.bg:'blank';
const INK_PEN=['#e6e6e6','#ff2a6d','#05d9e8','#ffb000'],INK_HL=['#ffe14d','#7dff9b','#ff7eb6','#6ad7ff'];
const ICO=d=>`<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const INK_I={type:ICO('<path d="M5 7V5h14v2M12 5v14M9 19h6"/>'),pen:ICO('<path d="M15 5l4 4L8 20l-5 1 1-5L15 5z"/><path d="M13 7l4 4"/>'),
  hl:ICO('<path d="M14 4l6 6-8 8H7l-3-3 10-11z"/><path d="M5 21h14"/>'),eraser:ICO('<path d="M20 20H9L4 15a2 2 0 010-3l8-8a2 2 0 013 0l5 5a2 2 0 010 3l-7 8"/><path d="M8 11l7 7"/>'),
  undo:ICO('<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>'),redo:ICO('<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 000 12h3"/>'),
  more:ICO('<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>'),
  full:ICO('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),exit:ICO('<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>'),
  page:ICO('<path d="M6 3h9l4 4v14H6z"/><path d="M12 11v6M9 14h6"/>'),clear:ICO('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>')};
function inkLayer(o){
  const host=o.host,cv=o.canvas,cx=cv.getContext('2d'),bar=o.bar;
  const bk=document.createElement('canvas');bk.className='inkcv inkback';host.insertBefore(bk,host.firstChild);const bx=bk.getContext('2d');
  const L={stack:o.stack||{undo:[],redo:[]},scale:1,H:IH,drawing:null,last:0,lw:0,lh:0};
  bar.className='inkbar';
  bar.innerHTML=`<div class="ib-seg" role="group" aria-label="Tool">${[['type','Type'],['pen','Pen'],['hl','Highlighter'],['eraser','Eraser']].map(([k,t])=>`<button type="button" data-ik="t:${k}" aria-label="${t}" title="${t}">${INK_I[k]}</button>`).join('')}</div>
    <div class="ib-ctx"><span class="ib-sep"></span><div class="ib-cols"></div><span class="ib-sep"></span>
    <div class="ib-sizes">${[[2,5],[4,8],[7,12]].map(([w,d])=>`<button type="button" class="ib-size" data-ik="s:${w}" aria-label="Size ${w}"><i style="width:${d}px;height:${d}px"></i></button>`).join('')}</div>
    <span class="ib-sep"></span>
    <button type="button" data-ik="undo" aria-label="Undo" title="Undo">${INK_I.undo}</button><button type="button" data-ik="redo" aria-label="Redo" title="Redo">${INK_I.redo}</button></div>
    ${o.fmt?`<div class="ib-fmt"><span class="ib-sep"></span>${o.fmt}</div>`:''}
    <span class="ib-sep ib-last"></span>
    <button type="button" data-ik="full" aria-label="Fullscreen" title="Fullscreen">${INK_I.full}</button><button type="button" data-ik="more" aria-label="More" title="More">${INK_I.more}</button>
    <div class="ib-pop">${o.paper?`<div class="ib-row"><span>Paper</span><div class="ib-seg">${INK_BG.map(b=>`<button type="button" data-ik="bg:${b}">${b}</button>`).join('')}</div></div>`:''}
      <button type="button" class="ib-act" data-ik="po"><span class="ib-l">Pencil only <small>Fingers scroll, only the pen draws</small></span><i class="ib-sw"></i></button>
      <button type="button" class="ib-act" data-ik="page">${INK_I.page}<span class="ib-l">Add a page</span></button>
      <button type="button" class="ib-act ib-bad" data-ik="clear">${INK_I.clear}<span class="ib-l">Clear all writing</span></button></div>`;
  const pop=bar.querySelector('.ib-pop'),colsEl=bar.querySelector('.ib-cols');
  const touch=()=>{L.last=Date.now();o.changed&&o.changed()};
  L.refresh=()=>{const ink=INKS.tool!=='type',hl=INKS.tool==='hl';
    bar.querySelectorAll('[data-ik^="t:"]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.ik==='t:'+INKS.tool));
    const pal=hl?INK_HL:INK_PEN,cur=hl?INKS.hcol:INKS.col;
    colsEl.innerHTML=pal.map(c=>`<button type="button" class="ib-dot" data-ik="c:${c}" style="--c:${c}" aria-label="Colour" aria-pressed="${c===cur}"></button>`).join('');
    colsEl.style.opacity=INKS.tool==='eraser'||!ink?'.35':'1';
    bar.querySelectorAll('[data-ik^="s:"]').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.ik.slice(2)===INKS.w));
    bar.querySelector('[data-ik="po"]').setAttribute('aria-pressed',INKS.po);
    bar.querySelectorAll('[data-ik^="bg:"]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.ik==='bg:'+inkBgOf(o.get())));
    const fb=bar.querySelector('[data-ik="full"]');if(o.full){const on=o.full.classList.contains('inkfull');fb.innerHTML=on?INK_I.exit:INK_I.full;fb.setAttribute('aria-pressed',on);fb.title=on?'Exit fullscreen':'Fullscreen'}else fb.style.display='none';
    cv.style.touchAction='none';host.classList.toggle('inking',ink);bar.classList.toggle('typing',!ink);
    host.querySelectorAll('.inkdead').forEach(x=>x.remove());
    host.querySelectorAll('textarea,[contenteditable]').forEach(x=>{if(!ink){x.style.display='';return}
      let d;if(x.tagName==='TEXTAREA'){d=document.createElement('div');d.className=x.className;d.textContent=x.value;d.style.height=x.style.height;d.style.whiteSpace='pre-wrap';d.style.overflowWrap='anywhere'}
      else{d=x.cloneNode(true);d.removeAttribute('id');d.removeAttribute('contenteditable')}
      d.classList.add('inkdead');d.setAttribute('aria-hidden','true');x.after(d);x.style.display='none'});
    if(ink){const a=document.activeElement;if(a&&a!==document.body&&a.blur)a.blur();try{getSelection().removeAllRanges()}catch(_){}}};
  L.size=()=>{const w=host.clientWidth;if(!w)return;L.scale=w/IW;const k=o.get();host.style.minHeight=Math.round(((k&&k.h)||IH)*L.scale)+'px';const h=host.clientHeight;
    let r=devicePixelRatio||1;while(w*r*h*r>1.6e7&&r>1)r-=.5;[cv,bk].forEach(c=>{c.width=Math.round(w*r);c.height=Math.round(h*r)});L.H=h/L.scale;L.lw=w;L.lh=h;
    [cx,bx].forEach(c=>c.setTransform(r*L.scale,0,0,r*L.scale,0,0));L.redraw()};
  const clear=c=>{c.save();c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,c.canvas.width,c.canvas.height);c.restore()};
  L.back=()=>{const k=o.get()||{h:IH,strokes:[]},sc=L.scale;clear(bx);
    const bg=o.paper?inkBgOf(k):'blank';bx.strokeStyle='rgba(255,255,255,.06)';bx.fillStyle='rgba(255,255,255,.14)';bx.lineWidth=1/sc;
    if(bg==='grid'){for(let y=40;y<L.H;y+=40){bx.beginPath();bx.moveTo(0,y);bx.lineTo(IW,y);bx.stroke()}for(let g=40;g<IW;g+=40){bx.beginPath();bx.moveTo(g,0);bx.lineTo(g,L.H);bx.stroke()}}
    else if(bg==='dots'){for(let y=40;y<L.H;y+=40)for(let g=40;g<IW;g+=40){bx.beginPath();bx.arc(g,y,1.6,0,7);bx.fill()}}
    bx.strokeStyle='rgba(255,42,109,.18)';for(let y=IH;y<L.H;y+=IH){bx.setLineDash([8,8]);bx.beginPath();bx.moveTo(0,y);bx.lineTo(IW,y);bx.stroke();bx.setLineDash([])}
    k.strokes.forEach(s=>{if(s.t==='hl')stroke(bx,s)});if(L.drawing&&L.drawing.t==='hl')stroke(bx,L.drawing)};
  L.redraw=()=>{const k=o.get()||{strokes:[]};L.back();clear(cx);k.strokes.forEach(s=>{if(s.t!=='hl')stroke(cx,s)});if(L.drawing&&!L.drawing.erase&&L.drawing.t!=='hl')stroke(cx,L.drawing)};
  function stroke(x,s){const p=s.pts;if(p.length<3)return;x.save();x.lineCap='round';x.lineJoin='round';x.strokeStyle=s.c;
    if(s.t==='hl'){x.globalAlpha=.4;x.lineCap='butt';x.lineWidth=s.w*4;x.beginPath();x.moveTo(p[0],p[1]);for(let i=3;i<p.length;i+=3)x.lineTo(p[i],p[i+1]);x.stroke();x.restore();return}
    for(let i=3;i<p.length;i+=3){const pr=(p[i+2]+p[i-1])/2;x.lineWidth=Math.max(.6,s.w*(.35+pr*1.1));x.beginPath();
      const mx0=i>=6?(p[i-6]+p[i-3])/2:p[i-3],my0=i>=6?(p[i-5]+p[i-2])/2:p[i-2];const mx1=(p[i-3]+p[i])/2,my1=(p[i-2]+p[i+1])/2;
      x.moveTo(mx0,my0);x.quadraticCurveTo(p[i-3],p[i-2],mx1,my1);x.stroke()}
    if(p.length===3){x.fillStyle=s.c;x.beginPath();x.arc(p[0],p[1],s.w/2,0,7);x.fill()}x.restore()}
  const pt=e=>{const r=cv.getBoundingClientRect();return [Math.round((e.clientX-r.left)/L.scale*10)/10,Math.round((e.clientY-r.top)/L.scale*10)/10,Math.round((e.pointerType==='mouse'?.5:(e.pressure||.5))*100)/100]};
  const scroller=()=>{let n=cv.parentElement;while(n&&n!==document.body){const cs=getComputedStyle(n);if(/(auto|scroll)/.test(cs.overflowY)&&n.scrollHeight>n.clientHeight+2)return n;n=n.parentElement}return document.scrollingElement||document.documentElement};
  ['contextmenu','selectstart','gesturestart'].forEach(t=>cv.addEventListener(t,e=>e.preventDefault()));
  ['touchstart','touchmove'].forEach(t=>cv.addEventListener(t,e=>e.preventDefault(),{passive:false}));
  const erase=p=>{const k=o.get();if(!k)return;const keep=[];let hit=false;
    k.strokes.forEach(s=>{let h=false;for(let i=0;i<s.pts.length;i+=3){if(Math.hypot(s.pts[i]-p[0],s.pts[i+1]-p[1])<(s.t==='hl'?s.w*2:14+s.w)){h=true;break}}if(h){s.i=s.i||rid();L.stack.undo.push({del:s});hit=true}else keep.push(s)});
    if(hit){k.strokes=keep;L.stack.redo=[];L.redraw()}};
  cv.addEventListener('pointerdown',e=>{
    if(e.pointerType==='pen'&&!INKS.po){INKS.po=true;inkSet();L.refresh()}
    e.preventDefault();
    if(e.pointerType==='pen')L.penAt=Date.now();
    if(e.pointerType==='touch'&&INKS.po){ /* pencil-only: fingers scroll by hand, never draw; ignored while the pen is working (palm) */
      if(L.drawing||Date.now()-(L.penAt||0)<1500||e.width>30||e.height>30)return;try{cv.setPointerCapture(e.pointerId)}catch(_){}L.scroll={y:e.clientY,el:scroller()};return}
    try{cv.setPointerCapture(e.pointerId)}catch(_){}
    const t=INKS.tool;
    if(t==='eraser'){L.drawing={erase:true};erase(pt(e));return}
    L.drawing={i:rid(),c:t==='hl'?INKS.hcol:INKS.col,w:t==='hl'?INKS.w*1.5:INKS.w,t:t==='hl'?'hl':'pen',pts:pt(e)}});
  cv.addEventListener('pointermove',e=>{if(L.scroll){e.preventDefault();const dy=e.clientY-L.scroll.y;L.scroll.y=e.clientY;L.scroll.el.scrollTop-=dy;return}const d=L.drawing;if(!d)return;e.preventDefault();if(e.pointerType==='pen')L.penAt=Date.now();
    let evs=e.getCoalescedEvents?e.getCoalescedEvents():[];if(!evs.length)evs=[e];
    for(const ev of evs){const p=pt(ev);if(d.erase){erase(p);continue}const n=d.pts.length;if(Math.hypot(p[0]-d.pts[n-3],p[1]-d.pts[n-2])<1.2)continue;d.pts.push(...p);if(d.t!=='hl')stroke(cx,{...d,pts:d.pts.slice(-9)})}
    if(!d.erase&&d.t==='hl')L.back();
    if(!d.erase){const y=d.pts[d.pts.length-2];if(y>L.H-120){const k=o.make();k.h=(Math.ceil(L.H/IH)+1)*IH;L.size()}}});
  const end=()=>{L.scroll=null;const d=L.drawing;if(!d)return;L.drawing=null;if(!d.erase){const k=o.make();k.strokes.push(d);L.stack.undo.push({add:d});L.stack.redo=[]}if(d.erase)L.redraw();touch()};
  cv.addEventListener('pointerup',end);cv.addEventListener('pointercancel',end);
  const closePop=()=>pop.classList.remove('open');
  L.docDown=e=>{if(!bar.contains(e.target))closePop()};document.addEventListener('pointerdown',L.docDown,true);
  bar.onclick=e=>{const b=e.target.closest('[data-ik]');if(!b)return;const a=b.dataset.ik,k=a==='more'||a==='full'||a.startsWith('t:')||a.startsWith('c:')||a.startsWith('s:')||a==='po'?null:o.make();
    if(a==='more'){pop.classList.toggle('open');return}
    if(a.startsWith('t:')){INKS.tool=a.slice(2);closePop();L.refresh();return}
    if(a.startsWith('c:')){const c=a.slice(2);if(INKS.tool==='hl')INKS.hcol=c;else{INKS.col=c;if(INKS.tool==='eraser'||INKS.tool==='type')INKS.tool='pen'}inkSet();L.refresh();return}
    if(a.startsWith('s:')){INKS.w=+a.slice(2);inkSet();L.refresh();return}
    if(a==='po'){INKS.po=!INKS.po;inkSet();L.refresh();return}
    if(a.startsWith('bg:')){const kk=o.make();kk.bg=a.slice(3);L.redraw();L.refresh();touch();return}
    if(a==='full'){if(o.full){o.full.classList.toggle('inkfull');document.documentElement.classList.toggle('inkfull-on',!!document.querySelector('.inkfull'));L.refresh();setTimeout(()=>L.size(),60)}return}
    if(a==='page'){k.h=(k.h||IH)+IH;L.size();touch();closePop();return}
    if(a==='undo'||a==='redo'){const from=a==='undo'?L.stack.undo:L.stack.redo,to=a==='undo'?L.stack.redo:L.stack.undo;const u=from.pop();if(!u)return;
      const adding=a==='undo'?!!u.del:!!u.add;const s=u.add||u.del;
      if(adding)k.strokes.push(s);else k.strokes=k.strokes.filter(x=>x.i!==s.i);
      to.push(u);L.redraw();touch();return}
    if(a==='clear'){const lab=b.querySelector('.ib-l');if(b.dataset.arm){k.strokes.forEach(s=>{s.i=s.i||rid();L.stack.undo.push({del:s})});k.strokes=[];k.h=IH;L.size();touch();delete b.dataset.arm;lab.textContent='Clear all writing';closePop()}
      else{b.dataset.arm=1;lab.textContent='Tap again to clear';setTimeout(()=>{delete b.dataset.arm;lab.textContent='Clear all writing'},2500)}return}};
  let raf=0;const ro=new ResizeObserver(()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{if(host.clientWidth!==L.lw||host.clientHeight!==L.lh)L.size()})});ro.observe(host);
  L.destroy=()=>{ro.disconnect();cancelAnimationFrame(raf);document.removeEventListener('pointerdown',L.docDown,true)};
  L.reset=()=>{L.stack.undo=[];L.stack.redo=[];L.drawing=null};
  return L}

/* fullscreen: Esc, or leaving the page, closes it */
const inkExitFull=()=>{document.querySelectorAll('.inkfull').forEach(x=>x.classList.remove('inkfull'));document.documentElement.classList.remove('inkfull-on')};
addEventListener('keydown',e=>{if(e.key==='Escape'&&document.querySelector('.inkfull')){inkExitFull();document.querySelectorAll('[data-ik="full"]').forEach(b=>{b.textContent='⛶ full';b.setAttribute('aria-pressed',false)})}});

/* ================= JOURNAL (typing + Apple Pencil) ================= */
const PAGE_W=1000,PAGE_H=1400;
const MOODS=[...Array(10)].map((_,i)=>[String(i+1),String(i+1)]);
const MOODC=['#f50a0a','#f52d0a','#f5510a','#f5740a','#f5970a','#f5be0a','#edf50a','#9ff50a','#49f50a','#09e126'];const moodI=v=>`<i class="mood" style="background:${MOODC[(+v||1)-1]||'#777'}"></i>`;
const PROMPTS=[['grat','Gratitude',"3 good things today, and why they happened\n1. \n   why: \n2. \n   why: \n3. \n   why: "],['review','Review',"Review\nWhat went well: \nWhat didn't: \nWhat I learned: \nWhat I'll do differently: "],['unload','Unload',"Unload: what's on my mind, and how I honestly feel about it\n"],['tmrw','Tomorrow',"Tomorrow\nThe one thing that matters: \nWhen and where I'll do it: \nIf ___ gets in the way, then I'll: \nEverything else to remember:\n- "]];
const JPI={recap:'<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',grat:'<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',review:'<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/><path d="M12 8v4l3 2"/>',unload:'<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/>',tmrw:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'};
const jpBtn=(k,l,c)=>`<button class="jpb${c?' '+c:''}" type="button" data-pr="${k}"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${JPI[k]}</svg><span>${l}</span></button>`;
let JDATE=null,JE=null,JLIST=[],jSaveT=null,jLoaded=false;
const jpath=d=>'journal/e-'+d;
async function loadJournal(){
  if(!JDATE)JDATE=DAYK;
  const rows=await listDocs('journal/e-');JLIST=rows.map(r=>r.data).filter(Boolean).sort((a,b)=>a.date<b.date?1:-1);
  await openEntry(JDATE);jLoaded=true;
}
watchPrefix('journal/e-',(evt,path,data)=>{const d=path.slice(10);JLIST=JLIST.filter(x=>x.date!==d);if(evt!=='DELETE'&&data)JLIST.push(data);JLIST.sort((a,b)=>a.date<b.date?1:-1);
  if(cur==='journal'){renderJList();if(d===JDATE&&data&&!jDirty){JE=data;renderJEditor(true)}}});
let jDirty=false;
async function openEntry(d){JDATE=d;const e=await load(jpath(d));JE=e||{date:d,text:'',mood:null,tags:[],ink:{h:PAGE_H,strokes:[]}};if(!JE.ink)JE.ink={h:PAGE_H,strokes:[]};if(typeof JL!=='undefined')JL.reset();renderJList();renderJEditor()}
const jEmpty=e=>!String(e.text||'').trim()&&!e.mood&&!(e.tags||[]).length&&!((e.ink&&e.ink.strokes)||[]).some(k=>k&&(k.tool||k.t)!=='eraser'&&(k.pts||k.p||k.points||[1]).length);
function saveJ(){jDirty=true;clearTimeout(jSaveT);$('jSaved').textContent='…';jSaveT=setTimeout(()=>{JE.updatedAt=new Date().toISOString();const empty=jEmpty(JE);
  if(empty)removeDoc(jpath(JE.date));else save(jpath(JE.date),JE,true);
  JLIST=JLIST.filter(x=>x.date!==JE.date);if(!empty)JLIST.push(clone(JE));JLIST.sort((a,b)=>a.date<b.date?1:-1);renderJList();$('jSaved').textContent='saved';jDirty=false},700)}
function renderJList(){
  const q=norm($('jQ').value);
  const days=new Set(JLIST.map(e=>e.date));
  const items=JLIST.filter(e=>!q||norm(e.text).includes(q)||(e.tags||[]).some(t=>norm(t).includes(q)));
  $('jList').innerHTML=(days.has(DAYK)||q?'':`<button type="button" class="jitem${JDATE===DAYK?' on':''}" data-jd="${DAYK}"><span class="jd">${esc(nice(DAYK))}</span></button>`)+
    items.map(e=>`<button type="button" class="jitem${e.date===JDATE?' on':''}" data-jd="${e.date}"><span class="jd">${esc(nice(e.date))}${e.mood?`${moodI(e.mood)}`:''}${e.ink&&e.ink.strokes&&e.ink.strokes.length?'<span class="dim"> ✎</span>':''}</span></button>`).join('')||'<div class="dim" style="font-size:12px;padding:8px">Nothing found.</div>';
  const streak=(()=>{let n=0;const d=new Date(logical());for(;;){if(days.has(ymd(d))){n++;d.setDate(d.getDate()-1)}else if(ymd(d)===DAYK){d.setDate(d.getDate()-1)}else break}return n})();
  $('jStreak').textContent=`${JLIST.length} entries · ${streak} day streak`;
}
$('jQ').oninput=renderJList;
$('jList').onclick=e=>{const b=e.target.closest('[data-jd]');if(b){flushJ();openEntry(b.dataset.jd);if(innerWidth<900)$('jEditor').scrollIntoView({behavior:FX?'smooth':'auto'})}};
function flushJ(){if(jSaveT){clearTimeout(jSaveT);jSaveT=null;JE.updatedAt=new Date().toISOString();save(jpath(JE.date),JE,true);jDirty=false}}
function renderJEditor(keepScroll){
  $('jDate').textContent=new Date(JDATE+'T12:00').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});
  $('jMood').innerHTML=MOODS.map(([v,l])=>`<button type="button" data-mood="${v}" aria-pressed="${String(JE.mood)===v}" title="${l}">${moodI(v)}<span>${l}</span></button>`).join('');
  $('jTags').innerHTML=(JE.tags||[]).map((t,i)=>`<span class="jtag">#${esc(t)}<button type="button" data-rmtag="${i}" aria-label="Remove tag">✕</button></span>`).join('')+`<input class="jtagin" id="jTagIn" placeholder="+ tag" aria-label="Add tag">`;
  $('jText').value=JE.text||'';autoGrow();
  $('jWords').textContent=((JE.text||'').trim().match(/\S+/g)||[]).length+' words';
  $('jSaved').textContent=JE.updatedAt?'saved '+ago(JE.updatedAt):'';
  JL.refresh();JL.size();
}
$('jPrev').onclick=()=>{flushJ();openEntry(addDays(JDATE,-1))};
$('jNext').onclick=()=>{flushJ();openEntry(addDays(JDATE,1))};
$('jToday').onclick=()=>{flushJ();openEntry(DAYK)};
$('jMood').onclick=e=>{const b=e.target.closest('[data-mood]');if(!b)return;JE.mood=JE.mood===+b.dataset.mood?null:+b.dataset.mood;saveJ();renderJEditor();burstEl(b,18)};
$('jTags').onclick=e=>{const b=e.target.closest('[data-rmtag]');if(b){JE.tags.splice(+b.dataset.rmtag,1);saveJ();renderJEditor()}};
$('jTags').onkeydown=e=>{if(e.target.id!=='jTagIn')return;if(e.key==='Enter'||e.key===','){e.preventDefault();const v=e.target.value.trim().replace(/^#/,'');if(v){JE.tags=[...(JE.tags||[]),v];saveJ();renderJEditor();$('jTagIn').focus()}}};
function autoGrow(){const t=$('jText');t.style.height='auto';t.style.height=Math.max(260,t.scrollHeight)+'px'}
$('jText').oninput=()=>{JE.text=$('jText').value;autoGrow();$('jWords').textContent=((JE.text||'').trim().match(/\S+/g)||[]).length+' words';saveJ()};
$('jPrompts').innerHTML=jpBtn('recap','Day recap','pr')+PROMPTS.map(([k,l])=>jpBtn(k,l)).join('');
$('jDel').onclick=function(){if(!this.dataset.arm){this.dataset.arm=1;this.classList.add('arm');this.insertAdjacentHTML('beforeend','<span>Delete?</span>');clearTimeout(this._t);this._t=setTimeout(()=>{delete this.dataset.arm;this.classList.remove('arm');const x=this.querySelector('span');x&&x.remove()},3000);return}
  clearTimeout(this._t);clearTimeout(jSaveT);delete this.dataset.arm;this.classList.remove('arm');const x=this.querySelector('span');x&&x.remove();
  const d=JDATE;removeDoc(jpath(d));JLIST=JLIST.filter(e=>e.date!==d);JE={date:d,text:'',mood:null,tags:[],ink:{h:PAGE_H,strokes:[]}};if(typeof JL!=='undefined')JL.reset();renderJList();renderJEditor();$('jSaved').textContent='deleted'};
$('jPrompts').onclick=e=>{const b=e.target.closest('[data-pr]');if(!b)return;if(b.dataset.pr==='recap'){jInsertRecap(b);return}const p=PROMPTS.find(x=>x[0]===b.dataset.pr)[2];JE.text=(JE.text?JE.text.replace(/\s*$/,'')+'\n\n':'')+p;renderJEditor();const t=$('jText');t.focus();t.setSelectionRange(t.value.length,t.value.length);saveJ()};

/* --- handwriting: drawn straight over the typed page (shared layer in 11a) --- */
const JL=inkLayer({host:$('jPage'),canvas:$('jCanvas'),bar:$('jTools'),full:$('jEditor'),paper:false,get:()=>JE&&JE.ink||null,make:()=>{if(!JE.ink)JE.ink={h:IH,strokes:[]};return JE.ink},changed:saveJ});

/* ---- day recap: pull what the app already knows about a day ---- */
async function jRecap(d){
  const L=[],R=n=>Math.round(n||0),K=n=>R(n).toLocaleString('en-GB');
  const P=(l,v)=>L.push(l.padEnd(8)+v),S=v=>L.push(' '.repeat(8)+v);
  const cut=(x,n)=>{x=String(x||'').trim();return x.length>n?x.slice(0,n-1)+'…':x};
  const hm=x=>x?Math.floor(x/60)+'h'+String(x%60).padStart(2,'0'):'';
  try{
    const f=await load('food/d-'+d);
    if(f&&f.m){const ML=[['b','breakfast'],['l','lunch'],['d','dinner'],['s','snacks']];
      const all=ML.reduce((a,[k])=>a.concat(f.m[k]||[]),[]);
      if(all.length){const t=typeof fSum==='function'?fSum(all):null;
        P('food',t?K(t.kcal)+' kcal · P'+R(t.p)+' C'+R(t.c)+' F'+R(t.f):all.length+' items');
        ML.forEach(([k,lab])=>{const its=(f.m[k]||[]).map(x=>cut(x.n,26)).filter(Boolean);if(!its.length)return;
          const c={};its.forEach(n=>c[n]=(c[n]||0)+1);
          S(lab+' · '+Object.entries(c).map(([n,q])=>q>1?n+' ×'+q:n).join(', '))})}
      const ex=(f.ex||[]).reduce((n,e)=>n+(+e.k||0),0);if(ex)P('burn',K(ex)+' kcal');
      if(f.w)P('weight',f.w+' kg')}
  }catch(e){}
  try{
    const s2=await load('sleep/w-'+d);
    if(s2&&(s2.asleep||s2.start)){
      P('sleep',[hm(s2.asleep)||'logged',s2.deep&&'deep '+hm(s2.deep),s2.rem&&'REM '+hm(s2.rem)].filter(Boolean).join(' · '));
      if(s2.mood)S('felt '+s2.mood+'/5')}
  }catch(e){}
  try{
    let ws=(typeof WORKOUTS!=='undefined'&&WORKOUTS.length)?WORKOUTS:(await listDocs('gym/w-')).map(r=>r.data).filter(Boolean);
    ws.filter(w=>w&&w.date===d).forEach(w=>{
      const st=(w.nsets!=null)?{vol:w.vol,n:w.nsets}:(typeof stats==='function'?stats(w):{vol:0,n:0});
      P('gym',[w.name||'session',(st.n||0)+' sets',st.vol&&K(st.vol)+' kg vol'].filter(Boolean).join(' · '));
      (w.ex||[]).forEach(x=>{const ds=(x.sets||[]).filter(s3=>s3.done!==false&&s3.t!=='w');if(!ds.length)return;
        const b=ds.slice().sort((a,c)=>((+c.kg||0)*(+c.r||0))-((+a.kg||0)*(+a.r||0)))[0];
        S(cut(x.n,24)+' · '+ds.length+'×'+[(+b.kg)&&b.kg+'kg',(+b.r)&&b.r].filter(Boolean).join('×'))});
      (w.prs||[]).forEach(x=>S('PR '+(typeof x==='string'?x:(x.n||'')+' '+(x.kg||'')+'kg×'+(x.r||''))))})
  }catch(e){}
  try{
    const t=await load('tasks/all');const done=((t&&t.list)||[]).filter(x=>x.done&&String(x.done).slice(0,10)===d);
    if(done.length){P('tasks',done.length+' done');done.forEach(x=>S('✓ '+cut(x.t,34)))}
  }catch(e){}
  try{
    const hl=await load('habits/log'),hx=await load('habits/list');
    const day=(hl&&hl.d&&hl.d[d])||{};
    const nm={};const HL=(hx&&hx.list)||(Array.isArray(hx)?hx:[]);HL.forEach(h=>{nm[h.id]=h.n||h.name});
    const hit=Object.keys(day).filter(k=>day[k]).map(k=>nm[k]||k);
    if(hit.length){P('habits',hit.length+' hit');S(hit.join(', '))}
  }catch(e){}
  try{
    const dd=d===DAYK&&typeof DAY!=='undefined'?DAY:await load('days/d-'+d);
    if(dd&&dd.total){P('plan',dd.done+'/'+dd.total+' ticked · '+R(dd.done/dd.total*100)+'%');if(dd.water)S('water · '+dd.water)}
  }catch(e){}
  try{
    const fo=await load('tools/focus');const fs=((fo&&fo.sessions)||[]).filter(x=>x.d===d);
    if(fs.length){P('focus',hm(fs.reduce((a,x)=>a+(+x.min||0),0))+' deep work · '+fs.length+' block'+(fs.length>1?'s':''));
      const tk=[...new Set(fs.map(x=>cut(x.task,30)).filter(Boolean))];if(tk.length)S(tk.join(', '))}
  }catch(e){}
  try{
    const bk=d===DAYK&&typeof BRICK!=='undefined'&&brickLoaded?BRICK:await load('tools/brick');const bs=((bk&&bk.sessions)||[]).filter(x=>x.d===d);
    if(bs.length){const br=bs.filter(x=>x.broke).length;P('brick',hm(bs.reduce((a,x)=>a+(+x.min||0),0))+' phone-free · '+bs.length+' session'+(bs.length>1?'s':'')+(br?' · '+br+' ended early':''))}
  }catch(e){}
  try{
    const h=await load('health/d-'+d)||{};
    if(h.screentime!=null)P('screen',hm(R(h.screentime/60))+' screen time');
    const hv=[h.hrv&&'HRV '+R(h.hrv)+' ms',h.rhr&&'RHR '+R(h.rhr),h.kcal&&K(h.kcal)+' active kcal',h.steps&&K(h.steps)+' steps'].filter(Boolean);
    if(hv.length)P('body',hv.join(' · '));
    if(typeof sRec==='function'&&typeof sleepLoaded!=='undefined'&&sleepLoaded){const rc=sRec(d);if(rc)S('recovery '+rc.v+'%')}
  }catch(e){}
  try{
    if(!L.some(x=>x.startsWith('weight'))){const wt=await load('body/wt');const w=((wt&&wt.r)||[]).filter(x=>String(x.t).slice(0,10)===d).pop();if(w)P('weight',w.kg+' kg')}
  }catch(e){}
  return L.length?L.join('\n'):'nothing logged in the app for this day yet.'}
async function jInsertRecap(btn){
  if(btn){btn.disabled=true;btn.classList.add('busy')}
  let txt='';try{txt=await jRecap(JDATE)}catch(e){txt='could not read the day.'}
  if(btn){btn.disabled=false;btn.classList.remove('busy')}
  const head='── recap · '+nice(JDATE).toLowerCase()+' ──\n';
  JE.text=(JE.text?JE.text.replace(/\s*$/,'')+'\n\n':'')+head+txt+'\n────\n\n';
  renderJEditor();
  const t=$('jText');t.focus();t.setSelectionRange(t.value.length,t.value.length);saveJ()}

/* ================= PROTOCOLS — item tracker ================= */
/* data: tools/protocols {list:[item]}, tools/protolog {logs:[{id,cid,at,amt,unit,site,note}]} */
let PROTO={list:[]},PLOG={logs:[]},PROTOV='today',PROTO_SEL=null;
const UNITS=['mcg','mg','IU','ml','units','caps','tabs','drops'];
/* routes, spots and the words for this module come from the private word list (LX 'px') */
const PX=LX('px',{}),PT=(k,d)=>(PX.t&&PX.t[k])||d,PF=Object.assign({v:'qa',w:'qb',s:'qc',h:'qh'},PX.f||{});
const ROUTES=PX.routes||['oral','nasal','topical','sublingual'];
const isSpot=r=>(PX.spot||[]).includes(r);
const SITES=PX.sites||[];
const SITE_XY=PX.xy||{};
const PDOW=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const fmtAmt=(a,u)=>`${kgs(a)} ${u}`;

async function loadProto(){const [p,l,old]=await Promise.all([load('tools/protocols'),load('tools/protolog'),load('tools/trackers')]);PROTO={list:[],...(p||{})};PLOG={logs:[],...(l||{})};PROTO_READY=true;if(typeof todaySync==='function')todaySync();
  if(!p&&old&&old.list&&old.list.length){ // one-time move from the old pins + cycles trackers
    old.list.forEach(t=>{const c=protoNew(t.name);if(t.kind==='interval')c.sched={type:'every',n:t.every||1,start:t.last||DAYK};else c.sched={type:'cycle',on:t.on,off:t.off,start:t.start||DAYK,every:1};PROTO.list.push(c);if(t.last)PLOG.logs.push({id:rid(),cid:c.id,at:t.last+'T09:00:00',amt:c.dose,unit:c.unit,site:'',note:'imported'})});
    save('tools/protocols',PROTO);save('tools/protolog',PLOG)}}
watch('tools/protocols',d=>{if(d){PROTO={list:[],...d};PROTO_READY=true;if(typeof todaySync==='function')todaySync();if(cur==='tools'&&TOOLV==='protocols')renderProto()}});
watch('tools/protolog',d=>{if(d){PLOG={logs:[],...d};if(cur==='tools'&&TOOLV==='protocols')renderProto()}});
function protoNew(name){return {id:rid(),name:name||'',route:ROUTES[0],dose:250,unit:'mcg',times:['08:00'],sched:{type:'daily',start:DAYK},[PF.h]:null,color:['#ff2a6d','#05d9e8','#ffb000','#57f5a8','#b967ff'][PROTO.list.length%5],
  active:true,rotate:true,inv:{[PF.v]:null,[PF.w]:null,remainMg:null,stock:0,[PF.s]:100},notes:'',created:DAYK}}
function saveProto(){save('tools/protocols',PROTO);if(typeof todaySync==='function')todaySync()}function saveLog(){PLOG.logs.sort((a,b)=>a.at<b.at?1:-1);save('tools/protolog',PLOG)}

/* schedule maths */
function daysBetween2(a,b){return Math.round((new Date(b+'T12:00')-new Date(a+'T12:00'))/864e5)}
function scheduledOn(c,d){if(!c.active)return false;const s=c.sched||{type:'daily'};const st=s.start||c.created||DAYK;const k=daysBetween2(st,d);if(k<0)return false;if(s.end&&d>s.end)return false;
  if(s.type==='daily')return true;if(s.type==='every')return k%Math.max(1,s.n||1)===0;
  if(s.type==='days'){const dw=(new Date(d+'T12:00').getDay()+6)%7;return (s.days||[]).includes(dw)}
  if(s.type==='cycle'){const L=((s.on||1)+(s.off||0))*7;const pos=k%L;if(pos>=(s.on||1)*7)return false;return pos%Math.max(1,s.every||1)===0}
  if(s.type==='asneeded')return false;return false}
function cyclePhase(c,d=DAYK){const s=c.sched;if(!s||s.type!=='cycle')return null;const k=daysBetween2(s.start||DAYK,d);if(k<0)return {txt:'starts '+nice(s.start).toLowerCase()};const L=((s.on||1)+(s.off||0))*7;const pos=k%L;const on=pos<(s.on||1)*7;
  const left=on?(s.on||1)*7-pos:L-pos;return {on,txt:on?`ON · week ${Math.floor(pos/7)+1}/${s.on}`:`OFF · week ${Math.floor((pos-(s.on||1)*7)/7)+1}/${s.off}`,sub:`${on?'off':'on'} in ${left}d`}}
function logsFor(cid,day){return PLOG.logs.filter(l=>l.cid===cid&&(!day||ymd(logical(new Date(l.at)))===day))}
function dueToday(){const out=[];PROTO.list.forEach(c=>{if(!scheduledOn(c,DAYK))return;const done=logsFor(c.id,DAYK);(c.times&&c.times.length?c.times:['any']).forEach((t,i)=>out.push({c,t,i,done:!!done[i],log:done[i]}))});return out.sort((a,b)=>(a.done-b.done)||(a.t>b.t?1:-1))}
function protoDueCount(){return dueToday().filter(x=>!x.done).length}
function nextSpot(c){const used={};PLOG.logs.filter(l=>l.cid===c.id&&l.site).forEach(l=>{if(!used[l.site]||l.at>used[l.site])used[l.site]=l.at});const pool=SITES.filter(s=>new RegExp((PX.pool||{})[c.route]||(PX.pool||{})._||'.').test(s[0]));
  return pool.slice().sort((a,b)=>(used[a[0]]||'')>(used[b[0]]||'')?1:-1)[0][0]}
function spotName(k){const s=SITES.find(x=>x[0]===k);return s?s[1]:k||''}
/* estimated amount still active: one-compartment exponential decay from each logged dose */
function levelAt(c,t){if(!c[PF.h])return null;const k=Math.LN2/(c[PF.h]*3600e3);let sum=0;PLOG.logs.forEach(l=>{if(l.cid!==c.id)return;const dt=t-new Date(l.at);if(dt>=0)sum+=(+l.amt||0)*Math.exp(-k*dt)});return sum}
function adherence(c,days=30){let due=0,done=0;for(let i=0;i<days;i++){const d=addDays(DAYK,-i);if(scheduledOn(c,d)){const n=(c.times||['x']).length;due+=n;done+=Math.min(n,logsFor(c.id,d).length)}}return due?Math.round(done/due*100):null}
function invInfo(c){const v=c.inv||{};const conc=v[PF.v]&&v[PF.w]?v[PF.v]/v[PF.w]:null;const doseMg=c.unit==='mg'?c.dose:c.unit==='mcg'?c.dose/1000:null;
  const ml=conc&&doseMg?doseMg/conc:null;const units=ml!=null?ml*(v[PF.s]||100):null;const remain=v.remainMg;
  const perDay=perDayAvg(c);const dosesLeft=remain!=null&&doseMg?Math.floor(remain/doseMg+1e-9):null;const daysLeft=dosesLeft!=null&&perDay?Math.floor(dosesLeft/perDay):null;
  return {conc,ml,units,remain,dosesLeft,daysLeft,doseMg}}
function perDayAvg(c){let n=0;for(let i=0;i<28;i++)if(scheduledOn(c,addDays(DAYK,i)))n+=(c.times||['x']).length;return n/28}

/* ---------- UI ---------- */
function undoLog(l){PLOG.logs=PLOG.logs.filter(x=>x.id!==l.id);const c=PROTO.list.find(x=>x.id===l.cid);const mg=c&&(l.unit==='mg'?+l.amt:l.unit==='mcg'?l.amt/1000:null);if(c&&mg&&c.inv&&c.inv.remainMg!=null){c.inv.remainMg=Math.round((c.inv.remainMg+mg)*1e4)/1e4;saveProto()}saveLog();renderProto();toolCardSubs()}
function logDose(c,btn,extra){const site=c.rotate&&isSpot(c.route)?nextSpot(c):'';
  openSheet('log · '+c.name,`<div class="row" style="gap:10px;flex-wrap:wrap;align-items:end"><label class="dim">Amount<input class="inp num" id="ldA" value="${c.dose}" inputmode="decimal" style="width:90px"></label><label class="dim">Unit<select class="inp" id="ldU">${UNITS.map(u=>`<option ${u===c.unit?'selected':''}>${u}</option>`).join('')}</select></label><label class="dim">Time<input class="inp" id="ldT" type="datetime-local" value="${new Date(Date.now()-new Date().getTimezoneOffset()*6e4).toISOString().slice(0,16)}"></label></div>
   ${isSpot(c.route)?`<div class="dim" style="margin:12px 0 4px;font-size:12px">${PT('spot','spot')}${site?' · suggested: '+esc(spotName(site)):''}</div>${spotMap(c,site,true)}`:''}
   <label class="dim">Note<input class="inp" id="ldN" placeholder="Optional"></label>
   <div class="bigbtns" style="margin-top:12px"><span style="flex:1"></span><button class="btn p" type="button" id="ldGo">Log dose</button></div>`);
  let chosen=site;$('sheetBody').onclick=e=>{const s=e.target.closest('[data-site]');if(s){chosen=s.dataset.site;$('sheetBody').querySelectorAll('[data-site]').forEach(x=>x.classList.toggle('sel',x.dataset.site===chosen))}};
  $('ldGo').onclick=()=>{const amt=+$('ldA').value||0,unit=$('ldU').value;const at=new Date($('ldT').value||Date.now()).toISOString();PLOG.logs.push({id:rid(),cid:c.id,at,amt,unit,site:chosen||'',note:$('ldN').value||''});
    const mg=unit==='mg'?amt:unit==='mcg'?amt/1000:null;if(mg&&c.inv&&c.inv.remainMg!=null){c.inv.remainMg=Math.max(0,Math.round((c.inv.remainMg-mg)*1e4)/1e4);saveProto()}
    saveLog();closeSheet();flash('dose_logged');try{autoTick(new RegExp('^'+c.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'))}catch(e){}renderProto();toolCardSubs()}}
function protoPick(cb){openSheet(PT('which','which item?'),`<div class="optlist">${PROTO.list.map(c=>`<button class="opt" type="button" data-c="${esc(c.id)}"><i class="cdot" style="background:${c.color}"></i>${esc(c.name)}</button>`).join('')||'<div class="dim">Add an item first.</div>'}</div>`);$('sheetBody').onclick=e=>{const b=e.target.closest('[data-c]');if(b)cb(PROTO.list.find(c=>c.id===b.dataset.c))}}

function schedText(c){const s=c.sched||{};const t=(c.times||[]).join(', ');const base=s.type==='daily'?'daily':s.type==='every'?`every ${s.n} days`:s.type==='days'?(s.days||[]).map(i=>PDOW[i]).join(' '):s.type==='cycle'?`${s.on} wk on / ${s.off} off${s.every>1?' · every '+s.every+'d':''}`:'as needed';return base+(t&&s.type!=='asneeded'?' · '+t:'')}
function stackSuggestions(){if(!M||!M.plans)return [];const have=new Set(PROTO.list.map(c=>norm(c.name)));const out=[];
  M.plans.weekday.forEach(b=>b.items.forEach(i=>{if(!CMP.has(i.type)||have.has(norm(i.item))||out.some(o=>o.name===i.item))return;const s=String(i.sched||'')+' '+String(i.notes||'');let m,sched={type:'daily',start:DAYK};
    if((m=s.match(/Every (\d+) days/i)))sched={type:'every',n:+m[1],start:DAYK};else if(/\bEOD\b/.test(s))sched={type:'every',n:2,start:DAYK};else if(/\bWeekly\b/i.test(s))sched={type:'every',n:7,start:DAYK};
    if((m=s.match(/(\d+)-week cycles? (\d+) off/i)))sched={type:'cycle',on:+m[1],off:+m[2],start:DAYK,every:sched.n||1};
    const dm=String(i.dose||'').match(/([\d.]+)\s*(mcg|mg|iu|ml)/i);const route=((PX.rx||[]).find(([re])=>new RegExp(re,'i').test(i.route||''))||[0,PX.rdef||ROUTES[0]])[1];
    out.push({name:i.item,patch:{sched,route,dose:dm?+dm[1]:0,unit:dm?(dm[2].toLowerCase()==='iu'?'IU':dm[2].toLowerCase()):'mg',times:[fmtM(i.t)||'08:00']}})}));return out}
function protoDetail(cid){const c=PROTO.list.find(x=>x.id===cid);if(!c)return;PROTO_SEL=cid;const i=invInfo(c);const a=adherence(c);const logs=logsFor(c.id).slice(0,40);
  const now=Date.now();let chart='';if(c[PF.h]){const pts=[];const labels=[];for(let h=-24*14;h<=24*7;h+=6){pts.push(levelAt(c,now+h*3600e3))}chart=`<div class="tag" style="margin:12px 0 4px">estimated amount active (${esc(c.unit)}) · 14 days back, 7 ahead</div>${spark(pts,{h:150,labels:['-14d','+7d']})}<div class="dim" style="font-size:11px">${PT('lvln','Rough estimate from your logged doses.')}</div>`}
  openSheet(c.name,`<div class="cstats big"><div><span class="dim">Dose</span><b class="num">${fmtAmt(c.dose,c.unit)}</b></div><div><span class="dim">Schedule</span><b>${esc(schedText(c))}</b></div><div><span class="dim">Adherence 30d</span><b class="num">${a==null?'—':a+'%'}</b></div></div>
  ${chart}
  <div class="tag" style="margin:14px 0 6px">Inventory</div><div class="reclist"><div><span>${PT('cur','current')}</span><b class="num">${i.remain!=null?kgs(Math.round(i.remain*100)/100)+' mg left':'—'}</b></div><div><span>Doses left</span><b class="num">${i.dosesLeft??'—'}</b></div><div><span>Days of supply</span><b class="num">${i.daysLeft??'—'}</b></div><div><span>${PT('unop','unopened')}</span><b class="num">${(c.inv&&c.inv.stock)||0}</b></div>${i.conc?`<div><span>Concentration</span><b class="num">${kgs(Math.round(i.conc*1000)/1000)} mg/ml</b></div><div><span>Per dose</span><b class="num">${kgs(Math.round(i.units*10)/10)} units · ${kgs(Math.round(i.ml*1000)/1000)} ml</b></div>`:''}</div>
  <div class="bigbtns" style="margin-top:8px"><button class="btn" type="button" id="cdNewPk">${PT('newpk','new one opened')}</button><button class="btn" type="button" id="cdLog">Log dose now</button></div>
  <div class="tag" style="margin:14px 0 6px">History</div>${logs.map(l=>`<div class="hx row" style="justify-content:space-between"><span class="dim">${new Date(l.at).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span><span>${fmtAmt(l.amt,l.unit)}${l.site?' · '+esc(spotName(l.site)):''}${l.note?' · '+esc(l.note):''}</span><button class="iconbtn" type="button" data-ldel="${esc(l.id)}">✕</button></div>`).join('')||'<div class="dim">No doses logged yet.</div>'}
  ${c.notes?`<div class="dim" style="margin-top:10px">“${esc(c.notes)}”</div>`:''}
  <div class="bigbtns" style="margin-top:14px"><button class="btn d" type="button" id="cdDel">Delete</button><span style="flex:1"></span><button class="btn" type="button" id="cdPause">${c.active?'pause':'resume'}</button><button class="btn p" type="button" id="cdEdit">Edit</button></div>`);
  $('cdEdit').onclick=()=>protoEdit(c);$('cdLog').onclick=()=>logDose(c);
  $('cdPause').onclick=()=>{c.active=!c.active;saveProto();protoDetail(cid);renderProto()};
  $('cdNewPk').onclick=()=>{c.inv=c.inv||{};if(!c.inv[PF.v]){flash('set_size_in_edit');return protoEdit(c)}c.inv.remainMg=c.inv[PF.v];if(c.inv.stock>0)c.inv.stock--;c.inv.openedAt=DAYK;saveProto();flash('opened');protoDetail(cid)};
  $('cdDel').onclick=function(){if(!this.dataset.arm){this.dataset.arm=1;this.textContent='tap again';return}PROTO.list=PROTO.list.filter(x=>x.id!==cid);PLOG.logs=PLOG.logs.filter(l=>l.cid!==cid);saveProto();saveLog();closeSheet();renderProto()};
  $('sheetBody').addEventListener('click',e=>{const d=e.target.closest('[data-ldel]');if(!d)return;if(!d.dataset.arm){d.dataset.arm=1;d.textContent='?';return}const l=PLOG.logs.find(x=>x.id===d.dataset.ldel);if(l)undoLog(l);protoDetail(cid)});
}
function protoEdit(c0,isNew){const c=clone(c0||protoNew(''));isNew=isNew||!c0;c.sched=c.sched||{type:'daily',start:DAYK};c.inv=c.inv||{};
  const draw=()=>{const s=c.sched;openSheet(isNew?'add '+PT('item','item'):'edit · '+c.name,`<input class="inp" id="ceN" value="${esc(c.name)}" placeholder="Name (e.g. BPC-157)" style="font-size:16px;margin-bottom:8px">
  <div class="row" style="gap:8px;flex-wrap:wrap"><label class="dim">Dose<input class="inp num" id="ceD" value="${c.dose??''}" inputmode="decimal" style="width:90px"></label><label class="dim">Unit<select class="inp" id="ceU">${UNITS.map(u=>`<option ${u===c.unit?'selected':''}>${u}</option>`).join('')}</select></label><label class="dim">Route<select class="inp" id="ceR">${ROUTES.map(u=>`<option ${u===c.route?'selected':''}>${u}</option>`).join('')}</select></label><label class="dim">Colour<input type="color" id="ceC" value="${c.color}" class="inp" style="width:56px;padding:2px"></label></div>
  <div class="tag" style="margin:14px 0 6px">Schedule</div>
  <div class="seg" id="ceST">${[['daily','daily'],['every','every N days'],['days','days of week'],['cycle','cycle on/off'],['asneeded','as needed']].map(([k,l])=>`<button type="button" data-st="${k}" aria-pressed="${s.type===k}">${l}</button>`).join('')}</div>
  <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:8px">${s.type==='every'?`<label class="dim">every N days<input class="inp num" id="ceEv" value="${s.n||2}" style="width:70px"></label>`:''}
   ${s.type==='days'?`<div class="chips" id="ceDays">${PDOW.map((d,i)=>`<button class="chip" type="button" data-dw="${i}" aria-pressed="${(s.days||[]).includes(i)}">${d}</button>`).join('')}</div>`:''}
   ${s.type==='cycle'?`<label class="dim">Weeks on<input class="inp num" id="ceOn" value="${s.on||8}" style="width:60px"></label><label class="dim">Weeks off<input class="inp num" id="ceOff" value="${s.off??4}" style="width:60px"></label><label class="dim">dose every N days while on<input class="inp num" id="ceEv2" value="${s.every||1}" style="width:60px"></label>`:''}
   <label class="dim">Start<input class="inp" type="date" id="ceS" value="${s.start||DAYK}"></label><label class="dim">End (optional)<input class="inp" type="date" id="ceE" value="${s.end||''}"></label></div>
  ${s.type!=='asneeded'?`<label class="dim">Times (comma separated)<input class="inp" id="ceT" value="${esc((c.times||[]).join(', '))}" placeholder="08:00, 20:00"></label>`:''}
  <div class="tag" style="margin:14px 0 6px">${PT('pk','timing (optional)')}</div><label class="dim">${PT('hl','decay in hours')}<input class="inp num" id="ceH" value="${c[PF.h]??''}" inputmode="decimal" placeholder="E.g. 4"></label>
  <label class="dim" style="display:flex;gap:8px;align-items:center;margin-top:8px"><input type="checkbox" id="ceRot" ${c.rotate?'checked':''} style="width:auto;display:inline"> ${PT('rot','rotate spots')}</label>
  <div class="tag" style="margin:14px 0 6px">Inventory</div><div class="row" style="gap:8px;flex-wrap:wrap"><label class="dim">${PT('mpv','mg per unit')}<input class="inp num" id="ceVm" value="${c.inv[PF.v]??''}" inputmode="decimal" style="width:80px"></label><label class="dim">${PT('wa','added (ml)')}<input class="inp num" id="ceVw" value="${c.inv[PF.w]??''}" inputmode="decimal" style="width:80px"></label><label class="dim">${PT('mlc','mg left in current')}<input class="inp num" id="ceVr" value="${c.inv.remainMg??''}" inputmode="decimal" style="width:90px"></label><label class="dim">${PT('unop','unopened')}<input class="inp num" id="ceVs" value="${c.inv.stock||0}" inputmode="numeric" style="width:70px"></label><label class="dim">${PT('sc','scale')}<select class="inp" id="ceSy">${[100,50,30].map(u=>`<option value="${u}" ${(c.inv[PF.s]||100)==u?'selected':''}>${PT('u','')}${u}</option>`).join('')}</select></label></div>
  <label class="dim">Notes<textarea class="inp" id="ceNo" rows="2">${esc(c.notes||'')}</textarea></label>
  <div class="bigbtns" style="margin-top:12px"><span style="flex:1"></span><button class="btn" type="button" id="ceX">Cancel</button><button class="btn p" type="button" id="ceOk">Save</button></div>`);
  const sb=$('sheetBody');
  const read=()=>{const g=id=>$(id)?$(id).value:undefined;c.name=g('ceN');c.dose=+g('ceD')||0;c.unit=g('ceU');c.route=g('ceR');c.color=g('ceC');s.start=g('ceS')||DAYK;s.end=g('ceE')||null;
    if($('ceEv'))s.n=Math.max(1,+g('ceEv')||1);if($('ceOn')){s.on=Math.max(1,+g('ceOn')||1);s.off=Math.max(0,+g('ceOff')||0);s.every=Math.max(1,+g('ceEv2')||1)}
    if($('ceT'))c.times=g('ceT').split(/[,\s]+/).map(x=>x.trim()).filter(x=>/^\d{1,2}:\d{2}$/.test(x)).map(x=>x.padStart(5,'0'));c[PF.h]=+g('ceH')||null;c.rotate=$('ceRot').checked;
    c.inv[PF.v]=+g('ceVm')||null;c.inv[PF.w]=+g('ceVw')||null;c.inv.remainMg=g('ceVr')===''?null:+g('ceVr');c.inv.stock=+g('ceVs')||0;c.inv[PF.s]=+g('ceSy')||100;c.notes=g('ceNo')};
  sb.onclick=e=>{const st=e.target.closest('[data-st]');if(st){read();s.type=st.dataset.st;if(s.type==='days'&&!s.days)s.days=[0,2,4];draw();return}
    const dw=e.target.closest('[data-dw]');if(dw){const k=+dw.dataset.dw;s.days=(s.days||[]).includes(k)?s.days.filter(x=>x!==k):[...(s.days||[]),k].sort();dw.setAttribute('aria-pressed',s.days.includes(k));return}
    if(e.target.id==='ceX')closeSheet();
    if(e.target.id==='ceOk'){read();c.name=(c.name||'').trim();if(!c.name){$('ceN').focus();return}const i=PROTO.list.findIndex(x=>x.id===c.id);if(i>=0)PROTO.list[i]=c;else PROTO.list.push(c);saveProto();closeSheet();PROTOV='items';renderProto();flash('saved')}}};
  draw()}

/* spot map */
function spotMap(c,sel,pick){const last={};PLOG.logs.filter(l=>!c||l.cid===c.id).forEach(l=>{if(l.site&&(!last[l.site]||l.at>last[l.site]))last[l.site]=l.at});
  const age=k=>last[k]?Math.floor((Date.now()-new Date(last[k]))/864e5):null;
  const dot=(k)=>{const [x,y]=SITE_XY[k];const a=age(k);const col=a==null?'#2a2a30':a<2?'#ff2a6d':a<5?'#ffb000':'#57f5a8';return `<g class="sdot${k===sel?' sel':''}" data-site="${k}" style="cursor:${pick?'pointer':'default'}"><circle cx="${x}" cy="${y}" r="6.5" fill="${col}" stroke="#000" stroke-width="1"/><title>${spotName(k)}${a!=null?` · ${a}d ago`:' · never'}</title></g>`};
  const body=(ox,lab)=>`<g transform="translate(${ox},0)"><circle cx="60" cy="20" r="11" fill="#16161a"/><path d="M42 34h36l8 40-6 30H40l-6-30z" fill="#16161a"/><path d="M42 104h16l-2 70H44zM62 104h16l-2 70H64z" fill="#16161a"/><path d="M34 36l-10 50h8l8-40zM86 36l10 50h-8l-8-40z" fill="#16161a"/><text x="60" y="190" fill="#555" font-size="8" text-anchor="middle">${lab}</text></g>`;
  return `<svg class="sitemap" viewBox="0 0 240 196">${body(0,'front')}${body(120,'back')}${Object.keys(SITE_XY).map(dot).join('')}</svg><div class="dim" style="font-size:11px;display:flex;gap:12px;flex-wrap:wrap"><span><i class="lg" style="background:#ff2a6d"></i>&lt;2 days</span><span><i class="lg" style="background:#ffb000"></i>2–4 days</span><span><i class="lg" style="background:#57f5a8"></i>Rested</span><span><i class="lg" style="background:#2a2a30"></i>Never</span></div>`}
const PI={check:FZSV('<path d="M5 12.5l4.2 4.2L19 7"/>'),calc:FZSV('<rect x="4" y="2" width="16" height="20" rx="3"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15v3M8 18h4"/>'),
  map:FZSV('<path d="M12 21s-7-5.7-7-11a7 7 0 0 1 14 0c0 5.3-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>'),clock:FZSV('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  warn:FZSV('<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/>')};
function renderProto(){const el=$('t-protocols');if(!el)return;
  const due=dueToday(),left=due.filter(x=>!x.done).length,n=due.length,pct=n?Math.round((n-left)/n*100):0;
  const act=PROTO.list.filter(c=>c.active),hasSpots=PROTO.list.some(c=>isSpot(c.route));
  const low=act.map(c=>({c,i:invInfo(c)})).filter(o=>o.i.daysLeft!=null&&o.i.daysLeft<=7);
  const nextUp=due.find(x=>!x.done);const week=[...Array(7)].map((_,i)=>addDays(DAYK,i));
  const phases=act.map(c=>({c,ph:cyclePhase(c)})).filter(o=>o.ph);
  el.innerHTML=`<div class="pr-grid"><div class="pr-col">
    <div class="panel pr-hero"><div class="pb">
      <div class="pr-sum"><div class="pr-ring"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" class="t"/><circle cx="20" cy="20" r="17" class="f" pathLength="100" style="stroke-dasharray:${pct} 100"/></svg><b class="num">${n-left}<small>/${n}</small></b></div>
        <div class="pr-st"><b>${!n?'Nothing due today':left?left+' left today':'All done today'}</b><span>${nextUp?'Next: '+esc(nextUp.c.name)+(nextUp.t!=='any'?' at '+nextUp.t:''):act.length+' active'}</span></div>
        <button class="pr-plus" type="button" id="pLogExtra" aria-label="Log an extra dose">${FI.plus}</button></div>
      <div class="pr-week">${week.map(d=>{const cs=PROTO.list.filter(c=>scheduledOn(c,d));return `<div class="${d===DAYK?'on':''}"><span>${new Date(d+'T12:00').toLocaleDateString('en-GB',{weekday:'narrow'})}</span><b class="num">${+d.slice(8)}</b><p>${cs.slice(0,4).map(c=>`<i style="background:${c.color}"></i>`).join('')}</p></div>`}).join('')}</div>
      ${phases.length?`<div class="pr-phases">${phases.map(o=>`<span style="--c:${o.c.color}"><i></i>${esc(o.c.name)} · ${esc(o.ph.txt)}</span>`).join('')}</div>`:''}
    </div></div>
    ${low.length?`<div class="pr-warn">${PI.warn}<span><b>Running low</b>${low.map(o=>`${esc(o.c.name)} · ${o.i.daysLeft} day${o.i.daysLeft===1?'':'s'} left`).join('<br>')}</span></div>`:''}
    <div class="pr-sec"><span>Today</span></div>
    <div class="pr-list">${due.map(x=>{const i=invInfo(x.c);const sub=[fmtAmt(x.c.dose,x.c.unit),x.c.route,x.done&&x.log.site?spotName(x.log.site):'',!x.done&&x.c.rotate&&isSpot(x.c.route)?PT('next','next')+': '+spotName(nextSpot(x.c)):'',i.units?'draw '+kgs(Math.round(i.units*10)/10)+' units':''].filter(Boolean).map(esc).join(' · ');
      return `<div class="pr-row${x.done?' done':''}" style="--c:${x.c.color}"><span class="pr-time num">${x.t==='any'?'Any':x.t}</span><span class="pr-t"><b>${esc(x.c.name)}</b><small>${sub}</small></span><button class="pr-chk" type="button" data-dlog="${esc(x.c.id)}:${x.i}" aria-pressed="${x.done}" aria-label="${x.done?'Undo':'Mark done'}">${PI.check}</button></div>`}).join('')||'<div class="pr-empty">Nothing scheduled today</div>'}</div>
  </div><div class="pr-col">
    <div class="pr-sec"><span>${esc(PT('items','Items'))}</span><button class="pr-link" type="button" id="cNew">${FI.plus}Add</button></div>
    <div class="pr-list">${PROTO.list.map(c=>{const i=invInfo(c),a=adherence(c),ph=cyclePhase(c);return `<button type="button" class="pr-row tap${c.active?'':' off'}" data-cid="${esc(c.id)}" style="--c:${c.color}"><span class="pr-dot"></span><span class="pr-t"><b>${esc(c.name)}</b><small>${esc([fmtAmt(c.dose,c.unit),schedText(c),c.active?(ph?ph.txt:''):'paused'].filter(Boolean).join(' · '))}</small></span><span class="pr-meta"><b class="num">${a==null?'—':a+'%'}</b><small>${i.daysLeft!=null?i.daysLeft+'d supply':'adherence'}</small></span><span class="fz-chev">${FI.chev}</span></button>`}).join('')||`<div class="pr-empty">Nothing added yet</div>`}</div>
    <div class="pr-sec"><span>Tools</span></div>
    <div class="pr-list">
      <button type="button" class="pr-row tap" id="prCalc"><span class="fz-ic b">${PI.calc}</span><span class="pr-t"><b>${esc(PT('calct','Calculator'))}</b><small>${esc(PT('calcs','')||'How much to draw')}</small></span><span class="fz-chev">${FI.chev}</span></button>
      ${hasSpots?`<button type="button" class="pr-row tap" id="prSpots"><span class="fz-ic g">${PI.map}</span><span class="pr-t"><b>${esc(PT('spots','Rotation'))}</b><small>${esc(PT('nxt','Next spot per item'))}</small></span><span class="fz-chev">${FI.chev}</span></button>`:''}
      <button type="button" class="pr-row tap" id="prHist"><span class="fz-ic">${PI.clock}</span><span class="pr-t"><b>History</b><small>${PLOG.logs.length} logged</small></span><span class="fz-chev">${FI.chev}</span></button>
    </div>
  </div></div>`;
  el.onclick=e=>{const t=e.target;
    const b=t.closest('[data-dlog]');if(b){const [cid,i]=b.dataset.dlog.split(':');const c=PROTO.list.find(x=>x.id===cid);const x=dueToday().find(y=>y.c.id===cid&&y.i===+i);if(x&&x.done)undoLog(x.log);else logDose(c,b);return}
    const r=t.closest('[data-cid]');if(r)return protoDetail(r.dataset.cid);
    const id=(t.closest('button')||{}).id;
    if(id==='cNew')return protoEdit(null);if(id==='pLogExtra')return protoPick(c=>logDose(c,null,true));
    if(id==='prCalc')return protoCalc();if(id==='prSpots')return protoSpots();if(id==='prHist')return protoHistory()};
}
function protoSpots(){const inj=PROTO.list.filter(c=>isSpot(c.route));const recent=PLOG.logs.filter(l=>l.site).slice(0,12);
  openSheet(PT('spots','Rotation'),`<div class="pr-map">${spotMap(null,null,false)}</div>
  <div class="pr-sec"><span>${esc(PT('nxt','Next spot per item'))}</span></div><div class="pr-list">${inj.map(c=>`<div class="pr-row" style="--c:${c.color}"><span class="pr-dot"></span><span class="pr-t"><b>${esc(c.name)}</b></span><span class="pr-val">${esc(spotName(nextSpot(c)))}</span></div>`).join('')||'<div class="pr-empty">Nothing to rotate</div>'}</div>
  <div class="pr-sec"><span>Recent</span></div><div class="pr-list">${recent.map(l=>{const c=PROTO.list.find(x=>x.id===l.cid);return `<div class="pr-row"><span class="pr-t"><b>${esc(spotName(l.site))}</b><small>${esc(c?c.name:'')}</small></span><span class="pr-val dim">${new Date(l.at).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</span></div>`}).join('')||'<div class="pr-empty">Nothing yet</div>'}</div>`)}
function protoCalc(){const st=LS.get('pcalc')||{mg:5,ml:2,dose:250,unit:'mcg',sy:100};
  openSheet(PT('calct','Calculator'),`<div class="pr-form">
    <label><span>${esc(PT('amt','amount (mg)'))}</span><input class="inp num" data-r="mg" value="${st.mg}" inputmode="decimal"></label>
    <label><span>${esc(PT('wa','added (ml)'))}</span><input class="inp num" data-r="ml" value="${st.ml}" inputmode="decimal"></label>
    <label><span>Dose</span><div class="pr-in2"><input class="inp num" data-r="dose" value="${st.dose}" inputmode="decimal"><div class="fz-seg sm" id="rcUnit">${['mcg','mg'].map(u=>`<button type="button" data-u="${u}" aria-pressed="${st.unit===u}">${u}</button>`).join('')}</div></div></label>
    <label><span>${esc(PT('sc','scale'))}</span><div class="fz-seg sm" id="rcSy">${[100,50,30].map(u=>`<button type="button" data-sy="${u}" aria-pressed="${st.sy==u}">${esc(PT('u',''))}${u}</button>`).join('')}</div></label>
  </div><div id="rcOut"></div>`);
  const draw=()=>{const conc=st.mg/st.ml,doseMg=st.unit==='mg'?st.dose:st.dose/1000,ml=doseMg/conc,units=ml*st.sy,per=Math.floor(st.mg/doseMg+1e-9);const f=v=>isFinite(v)&&v>0;
    $('rcOut').innerHTML=`<div class="pr-res"><span>Draw to</span><b class="num">${f(units)?kgs(Math.round(units*10)/10):'—'}<small> units</small></b></div>
    <div class="pr-syr"><div class="pr-syr-f" style="width:${f(units)?Math.min(100,units/st.sy*100):0}%"></div>${[...Array(11)].map((_,i)=>`<i style="left:${i*10}%"${i%5?'':' class="maj"'}></i>`).join('')}</div><div class="pr-syr-l num">${[0,.5,1].map(x=>`<span>${Math.round(st.sy*x)}</span>`).join('')}</div>
    ${units>st.sy?`<div class="pr-warn sm">${PI.warn}<span>${esc(PT('over','That dose is more than one full scale.'))}</span></div>`:''}
    <div class="pr-list pr-stats"><div class="pr-row"><span class="pr-t"><b>Volume</b></span><span class="pr-val num">${f(ml)?kgs(Math.round(ml*1000)/1000):'—'} ml</span></div><div class="pr-row"><span class="pr-t"><b>Concentration</b></span><span class="pr-val num">${f(conc)?kgs(Math.round(conc*1000)/1000):'—'} mg/ml</span></div><div class="pr-row"><span class="pr-t"><b>${esc(PT('dpu','Doses per unit'))}</b></span><span class="pr-val num">${f(per)?per:'—'}</span></div></div>`;LS.set('pcalc',st)};
  const sb=$('sheetBody');sb.oninput=e=>{const k=e.target.dataset.r;if(!k)return;st[k]=+e.target.value||0;draw()};
  sb.onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.u){st.unit=b.dataset.u;$('rcUnit').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b))}if(b.dataset.sy){st.sy=+b.dataset.sy;$('rcSy').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b))}draw()};draw()}
function protoHistory(){const days={};PLOG.logs.forEach(l=>{const d=ymd(logical(new Date(l.at)));(days[d]=days[d]||[]).push(l)});
  openSheet('History',Object.entries(days).sort((a,b)=>a[0]<b[0]?1:-1).slice(0,60).map(([d,ls])=>`<div class="pr-sec"><span>${esc(nice(d))}</span></div><div class="pr-list">${ls.map(l=>{const c=PROTO.list.find(x=>x.id===l.cid);return `<div class="pr-row" style="--c:${c?c.color:'#555'}"><span class="pr-dot"></span><span class="pr-t"><b>${esc(c?c.name:'?')}</b><small>${esc(fmtAmt(l.amt,l.unit))}${l.site?' · '+esc(spotName(l.site)):''}</small></span><span class="pr-val dim num">${new Date(l.at).toTimeString().slice(0,5)}</span></div>`}).join('')}</div>`).join('')||'<div class="pr-empty">No doses logged yet</div>')}

/* ================= LEETCODE — problem log with notes ================= */
/* catalogue: static/leetcode.json (4,100+ problems: id, title, slug, difficulty, topics). Your log: tools/leet {solved:{slug:{...}}} */
let LCDB=null,LEET={items:{},target:8},LEETV='log',LQ={q:'',d:'',t:'',st:''};
const LCDIFF={E:'Easy',M:'Medium',H:'Hard'};
async function loadLcDb(){if(LCDB)return;try{const r=await fetch('leetcode.json?v=1');const j=await r.json();LCDB={tags:j.tags,q:j.q.map(([id,t,s,d,tg,p])=>({id,t,s,d,tg,p})),bySlug:{}};LCDB.q.forEach(x=>LCDB.bySlug[x.s]=x)}catch(e){LCDB={tags:[],q:[],bySlug:{}}}}
async function loadLeet(){const l=await load('tools/leet');LEET={items:{},target:8,...(l||{})};lc=leetWeek()}
watch('tools/leet',d=>{if(d){LEET={items:{},target:8,...d};lc=leetWeek();if(cur==='tools'&&TOOLV==='leetcode')renderLeet()}});
function leetSaves(){lc=leetWeek();save('tools/leet',LEET);toolCardSubs();if(typeof schedWidget==='function')schedWidget()}
function solves(){return Object.values(LEET.items).flatMap(it=>(it.attempts||[]).filter(a=>a.ok).map(a=>({...a,slug:it.slug})))}
function leetWeek(){return solves().filter(a=>isoWeek(new Date(a.d+'T12:00'))===WK).length}
function probOf(slug){return (LCDB&&LCDB.bySlug[slug])||{id:'?',t:(LEET.items[slug]||{}).title||slug,s:slug,d:(LEET.items[slug]||{}).d||'M',tg:[]}}
function diffChip(d){return `<span class="lcd lcd-${d}">${LCDIFF[d]||d}</span>`}
async function renderLeet(){const el=$('t-leetcode');if(!el)return;await loadLcDb();
  const tabs=[['log','my problems'],['browse','browse all'],['stats','stats'],['review','review']];
  el.innerHTML=`<div class="seg gseg" id="lcSeg">${tabs.map(([k,l])=>`<button type="button" data-lv="${k}" aria-pressed="${LEETV===k}">${l}</button>`).join('')}</div><div id="lcBody"></div>`;
  $('lcSeg').onclick=e=>{const b=e.target.closest('[data-lv]');if(!b)return;LEETV=b.dataset.lv;renderLeet()};
  ({log:leetLog,browse:leetBrowse,stats:leetStats,review:leetReview})[LEETV]()}
function weekSlots(){const n=leetWeek(),t=LEET.target||8;return `<div class="lcweek"><div><b class="num">${n}</b><span class="dim">/ ${t} this week</span></div><div class="slots">${Array.from({length:Math.max(t,n)},(_,i)=>`<i class="${i<n?'f':''}"></i>`).join('')}</div><button class="iconbtn" type="button" id="lcTgt">Target</button></div>`}
function leetLog(){const items=Object.values(LEET.items).sort((a,b)=>(b.last||'')>(a.last||'')?1:-1);
  $('lcBody').innerHTML=`${weekSlots()}<button class="addex" type="button" id="lcAddP">+ Log a problem</button>
  <div class="lclist">${items.map(it=>{const p=probOf(it.slug);const ok=(it.attempts||[]).some(a=>a.ok);return `<button type="button" class="lcrow" data-slug="${esc(it.slug)}"><span class="num dim">${p.id}</span><span class="lct"><b>${esc(p.t)}</b><span class="dim">${(p.tg||[]).slice(0,4).map(i=>esc(LCDB.tags[i])).join(' · ')}</span></span>${diffChip(p.d)}<span class="lcst ${ok?'ok':'try'}">${ok?'✓':'…'}</span>${it.notes?'<span class="dim">✎</span>':''}</button>`}).join('')||'<div class="dim" style="padding:10px 0">No problems logged yet. Tap "log a problem" and pick one from the LeetCode list.</div>'}</div>`;
  $('lcAddP').onclick=()=>pickProblem(slug=>openProblem(slug,true));$('lcTgt').onclick=()=>{const v=parseInt(prompt('Weekly target?',LEET.target||8)||'');if(v>0){LEET.target=v;leetSaves();renderLeet()}};
  $('lcBody').onclick=e=>{const b=e.target.closest('[data-slug]');if(b)openProblem(b.dataset.slug)}}
function filterProblems(){const q=norm(LQ.q);return LCDB.q.filter(p=>(!LQ.d||p.d===LQ.d)&&(LQ.t===''||p.tg.includes(+LQ.t))&&(!q||norm(p.t).includes(q)||String(p.id)===q)&&(!LQ.st||(LQ.st==='done'?LEET.items[p.s]&&(LEET.items[p.s].attempts||[]).some(a=>a.ok):!LEET.items[p.s])))}
function probFilters(){return `<input class="inp" id="lqQ" placeholder="Search ${LCDB.q.length.toLocaleString('en-GB')} problems by name or number" value="${esc(LQ.q)}" style="margin-bottom:8px"><div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:8px"><select class="inp" id="lqD" style="flex:1;min-width:110px"><option value="">Any difficulty</option>${Object.entries(LCDIFF).map(([k,v])=>`<option value="${k}" ${LQ.d===k?'selected':''}>${v}</option>`).join('')}</select><select class="inp" id="lqT" style="flex:2;min-width:150px"><option value="">Any topic</option>${LCDB.tags.map((t,i)=>`<option value="${i}" ${LQ.t===String(i)?'selected':''}>${esc(t)}</option>`).join('')}</select><select class="inp" id="lqS" style="flex:1;min-width:110px"><option value="">All</option><option value="done" ${LQ.st==='done'?'selected':''}>Solved</option><option value="todo" ${LQ.st==='todo'?'selected':''}>Not tried</option></select></div>`}
function bindProbFilters(draw){$('lqQ').oninput=e=>{LQ.q=e.target.value;draw()};$('lqD').onchange=e=>{LQ.d=e.target.value;draw()};$('lqT').onchange=e=>{LQ.t=e.target.value;draw()};$('lqS').onchange=e=>{LQ.st=e.target.value;draw()}}
function probRow(p){const it=LEET.items[p.s];const ok=it&&(it.attempts||[]).some(a=>a.ok);return `<button type="button" class="lcrow" data-pslug="${esc(p.s)}"><span class="num dim">${p.id}</span><span class="lct"><b>${esc(p.t)}${p.p?' <span class="dim">🔒</span>':''}</b><span class="dim">${p.tg.slice(0,4).map(i=>esc(LCDB.tags[i])).join(' · ')}</span></span>${diffChip(p.d)}<span class="lcst ${ok?'ok':it?'try':''}">${ok?'✓':it?'…':''}</span></button>`}
function leetBrowse(){$('lcBody').innerHTML=probFilters()+`<div class="lclist" id="lqList"></div>`;const draw=()=>{const l=filterProblems();$('lqList').innerHTML=l.slice(0,200).map(probRow).join('')+(l.length>200?`<div class="dim" style="padding:8px">${l.length-200} more — narrow the search</div>`:'')};draw();bindProbFilters(draw);
  $('lqList').onclick=e=>{const b=e.target.closest('[data-pslug]');if(b)openProblem(b.dataset.pslug)}}
async function pickProblem(cb){await loadLcDb();openSheet('pick a problem',probFilters()+`<div class="lclist picklist" id="lqList"></div>`);const draw=()=>{$('lqList').innerHTML=filterProblems().slice(0,120).map(probRow).join('')};draw();bindProbFilters(draw);setTimeout(()=>$('lqQ')&&$('lqQ').focus(),200);
  $('lqList').onclick=e=>{const b=e.target.closest('[data-pslug]');if(b)cb(b.dataset.pslug)}}
function openProblem(slug,logNow){const p=probOf(slug);const it=LEET.items[slug]||{slug,title:p.t,d:p.d,attempts:[],notes:'',code:'',conf:0};
  const persist=()=>{it.title=p.t;it.d=p.d;LEET.items[slug]=it;leetSaves()};
  const draw=()=>{openSheet(`${p.id}. ${p.t}`,`<div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:10px">${diffChip(p.d)}${(p.tg||[]).map(i=>`<span class="chipy">${esc(LCDB.tags[i])}</span>`).join('')}<a class="iconbtn" href="https://leetcode.com/problems/${encodeURIComponent(slug)}/" target="_blank" rel="noopener">open on leetcode ↗</a></div>
    <div class="tag">Log an attempt</div><div class="row" style="gap:8px;flex-wrap:wrap;align-items:end;margin:6px 0 12px"><label class="dim">Result<select class="inp" id="laOk"><option value="1">Solved</option><option value="0">Didn't solve</option></select></label><label class="dim">Minutes<input class="inp num" id="laMin" inputmode="numeric" style="width:70px"></label><label class="dim">How<select class="inp" id="laHow"><option>On my own</option><option>With hints</option><option>Looked at solution</option></select></label><button class="btn p" type="button" id="laGo">Log</button></div>
    ${(it.attempts||[]).length?`<div class="hsets" style="margin-bottom:12px">${it.attempts.map((a,i)=>`<span class="set ${a.ok?'':'t-f'}">${esc(nice(a.d).toLowerCase())} · ${a.ok?'✓':'✗'}${a.min?' · '+a.min+'m':''} · ${esc(a.how||'')} <button class="iconbtn" type="button" data-adel="${i}" style="padding:0 4px">✕</button></span>`).join('')}</div>`:''}
    <div class="tag">Confidence</div><div class="chips" id="laConf" style="margin:6px 0 12px">${['','shaky','okay','solid','nailed it'].map((l,i)=>i?`<button class="chip" type="button" data-cf="${i}" aria-pressed="${it.conf===i}">${l}</button>`:'').join('')}</div>
    <div class="tag">Notes · approach, complexity, gotchas</div><textarea class="inp lcnote" id="laNotes" rows="6" placeholder="E.g. two pointers from both ends; O(n) time, O(1) space; watch duplicates">${esc(it.notes||'')}</textarea>
    <div class="tag" style="margin-top:10px">Solution code</div><textarea class="inp lccode" id="laCode" rows="8" spellcheck="false" placeholder="Paste your solution">${esc(it.code||'')}</textarea>
    <div class="row" style="justify-content:space-between;margin-top:10px"><span class="dim" id="laSaved">${it.last?'last attempt '+esc(nice(it.last).toLowerCase()):''}</span>${LEET.items[slug]?'<button class="btn d" type="button" id="laDel">Remove</button>':''}</div>`);
    let t=null;const typed=()=>{clearTimeout(t);$('laSaved').textContent='saving…';t=setTimeout(()=>{it.notes=$('laNotes').value;it.code=$('laCode').value;persist();$('laSaved').textContent='saved'},700)};
    $('laNotes').oninput=typed;$('laCode').oninput=typed;
    $('laGo').onclick=()=>{clearTimeout(t);it.notes=$('laNotes').value;it.code=$('laCode').value;const a={d:DAYK,ok:$('laOk').value==='1',min:+$('laMin').value||null,how:$('laHow').value};it.attempts=[...(it.attempts||[]),a];it.last=DAYK;
      if(a.ok){const n=it.attempts.filter(x=>x.ok).length;it.review=addDays(DAYK,[3,7,21,60][Math.min(3,n-1)])}persist();if(a.ok){flash('solved');burst(innerWidth/2,innerHeight/2,60);if(leetWeek()===(LEET.target||8)){flash('target_hit');shake()}}draw();renderLeet()};
    $('laConf').onclick=e=>{const b=e.target.closest('[data-cf]');if(!b)return;it.conf=+b.dataset.cf;persist();$('laConf').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',+x.dataset.cf===it.conf))};
    $('sheetBody').addEventListener('click',e=>{const d=e.target.closest('[data-adel]');if(!d)return;it.attempts.splice(+d.dataset.adel,1);persist();draw()});
    if($('laDel'))$('laDel').onclick=function(){if(!this.dataset.arm){this.dataset.arm=1;this.textContent='tap again';return}delete LEET.items[slug];leetSaves();closeSheet();renderLeet()};
  };draw();if(logNow)setTimeout(()=>$('laMin')&&$('laMin').focus(),250)}
function leetStats(){const S=solves();const solvedSlugs=new Set(S.map(a=>a.slug));const byD={E:0,M:0,H:0};solvedSlugs.forEach(s=>{const p=probOf(s);byD[p.d]=(byD[p.d]||0)+1});
  const tot={E:0,M:0,H:0};LCDB.q.forEach(p=>tot[p.d]++);const tags={};solvedSlugs.forEach(s=>probOf(s).tg.forEach(i=>tags[i]=(tags[i]||0)+1));const tl=Object.entries(tags).sort((a,b)=>b[1]-a[1]).slice(0,14);const tmx=Math.max(1,...tl.map(x=>x[1]));
  const weeks=weekKeyN(12);const per=weeks.map(k=>S.filter(a=>isoWeek(new Date(a.d+'T12:00'))===k).length);const mx=Math.max(LEET.target||8,...per);
  let streak=0;for(let i=0;i<400;i++){const d=addDays(DAYK,-i);if(S.some(a=>a.d===d))streak++;else if(i>0)break}
  $('lcBody').innerHTML=`<div class="statcards"><div><span class="dim">Solved</span><b class="num">${solvedSlugs.size}</b></div>${['E','M','H'].map(d=>`<div><span class="dim">${LCDIFF[d].toLowerCase()}</span><b class="num lcd-${d}t">${byD[d]||0}<small> / ${tot[d]}</small></b></div>`).join('')}<div><span class="dim">Day streak</span><b class="num">${streak}</b></div></div>
  <div class="panel" style="margin-top:12px"><div class="ph"><span class="tag">Solved per week</span></div><div class="pb"><div class="wkbars" style="grid-template-columns:repeat(12,1fr)">${per.map((v,i)=>`<div class="d"><span class="p num">${v||''}</span><div class="b" style="height:${v/mx*100}%;${v>=(LEET.target||8)?'background:var(--ok)':''}"></div><span class="l">${weeks[i].slice(-3).toLowerCase()}</span></div>`).join('')}</div></div></div>
  <div class="panel" style="margin-top:12px"><div class="ph"><span class="tag">Topics you've covered</span></div><div class="pb"><div class="mbars">${tl.map(([i,v])=>`<div><span>${esc(LCDB.tags[i])}</span><i style="--w:${v/tmx*100}%"></i><b class="num">${v}</b></div>`).join('')||'<span class="dim">Solve a few problems to see your topic spread.</span>'}</div></div></div>`}
function leetReview(){const due=Object.values(LEET.items).filter(it=>it.review&&it.review<=DAYK).sort((a,b)=>a.review<b.review?-1:1);const weak=Object.values(LEET.items).filter(it=>it.conf&&it.conf<=2);
  $('lcBody').innerHTML=`<div class="dim" style="font-size:12px;margin-bottom:10px">Solved problems come back for review after 3, 7, 21 and 60 days so the patterns stick.</div>
  <div class="tag">due for review · ${due.length}</div><div class="lclist">${due.map(it=>probRow(probOf(it.slug))).join('')||'<div class="dim" style="padding:8px 0">Nothing due.</div>'}</div>
  <div class="tag" style="margin-top:14px">low confidence · ${weak.length}</div><div class="lclist">${weak.map(it=>probRow(probOf(it.slug))).join('')||'<div class="dim" style="padding:8px 0">None.</div>'}</div>`;
  $('lcBody').onclick=e=>{const b=e.target.closest('[data-pslug]');if(b)openProblem(b.dataset.pslug)}}

/* ================= WEEK ================= */
let WEEK={};
async function renderWeek(){
  calInit();
  const L0=logical();const ds=[];for(let i=29;i>=0;i--){const d=new Date(L0);d.setDate(d.getDate()-i);ds.push(d)}
  const docs=await Promise.all(ds.map(d=>ymd(d)===DAYK?Promise.resolve(DAY):load('days/d-'+ymd(d))));
  const last7=ds.slice(-7),v7=docs.slice(-7);
  $('days').innerHTML=last7.map((d,i)=>{const v=v7[i];const p=v&&v.total?Math.round(v.done/v.total*100):null;const t=ymd(d)===DAYK;return `<div class="d${t?' t':''}"><div class="bw">${p===null?'<span class="nil"></span>':`<div class="b ${p>=80?'ok':p<50?'low':''}" style="height:${Math.max(3,p)}%"><span class="p num${p<14?' out':''}">${p}%</span></div>`}</div><span class="l">${t?'today':DOW[d.getDay()].toLowerCase()}</span></div>`}).join('');
  if(FX)document.querySelectorAll('#days .b').forEach((b,i)=>b.animate([{transform:'scaleY(0)'},{transform:'scaleY(1)'}],{duration:500,delay:i*60,easing:'cubic-bezier(.2,.9,.1,1)',fill:'backwards'}));
  const logged=v7.filter(v=>v&&v.total).length;$('daysNote').textContent=logged<2?'Fills in as you tick items on the today view.':`${logged} of 7 days logged · avg ${Math.round(avg(v7.filter(v=>v&&v.total).map(v=>v.done/v.total*100)))}%`;
  wkStreaks();renderReview();
  WEEK=await load('weeks/w-'+WK)||WEEK||{};
  renderTargets();
  $('weekSub').textContent=`${WK} · review Sundays 19:00`;
}
/* weekly targets: each one is a count of completions this week (one notch = one done).
   the goal is the target's "times per week" field, else a number in its text ("4x"), else 7 (daily).
   counts live in the week's own doc, so a new week starts every bar at zero. */
function tgGoal(r){const g=+r.goal;if(g>0)return Math.min(50,Math.round(g));const m=/(\d+)\s*(?:x|×|times|\/\s*w)|(?:x|×)\s*(\d+)/i.exec((r.item||'')+' '+(r.notes||''));const n=m?+(m[1]||m[2]):0;return n>0&&n<=50?n:7}
function tgCount(r,n){const w=WEEK||{};if(w.tc&&w.tc[r.key]!=null)return Math.max(0,Math.min(n,+w.tc[r.key]||0));const p=w.tp&&+w.tp[r.key];return p?Math.round(Math.min(100,p)/100*n):0}
/* auto targets: a target whose name matches one of these is filled from the app's own data, not by hand */
const TGK=r=>{const t=String(r.item||'').toLowerCase();return /wake/.test(t)?'hide':/sleep/.test(t)?'sleep':/deep|focus/.test(t)?'dw':/leet/.test(t)?'leet':/adher/.test(t)?'adh':/gym|train|workout|lift/.test(t)?'gym':null};
let TGA={},tgBusy=false;
function tgWeekDays(){const L0=logical(),dn=L0.getDay()||7,m=new Date(L0);m.setDate(m.getDate()-(dn-1));const out=[];for(let i=0;i<7;i++){const d=new Date(m);d.setDate(m.getDate()+i);const k=ymd(d);if(k<=DAYK)out.push(k)}return out}
async function tgAuto(){if(tgBusy)return;tgBusy=true;const days=tgWeekDays(),A={};
  try{const docs=await Promise.all(days.map(d=>d===DAYK?Promise.resolve(DAY):load('days/d-'+d)));const ps=docs.map(v=>v&&v.total?v.done/v.total*100:null);
    A.adh={v:ps.filter(p=>p!=null&&p>=80).length,sub:ps.some(p=>p!=null)?'days at 80%+ · avg '+Math.round(avg(ps.filter(p=>p!=null)))+'%':'days at 80%+ on Today'}}catch(e){}
  try{const rows=await listDocs('sleep/w-');const N=rows.filter(r=>r.data&&days.includes(r.path.slice(8))).map(r=>sQ(r.data));
    A.sleep={v:N.filter(q=>q>=75).length,n:6,lab:'sleep score 75+',sub:N.length?'nights this week · avg score '+Math.round(avg(N)):'nights this week, from the Sleep section'}}catch(e){}
  try{const fs=((FOCUS&&FOCUS.sessions&&FOCUS.sessions.length?FOCUS:await load('tools/focus'))||{}).sessions||[];const m=fs.filter(x=>days.includes(x.d)).reduce((a,x)=>a+(+x.min||0),0);const goal=Math.round(DW_TARGET*5/60);
    A.dw={v:Math.round(m/6)/10,n:goal,unit:'h',sub:'hours from the focus timer · '+Math.floor(m/60)+'h '+pad(m%60)+'m'}}catch(e){}
  try{if(typeof loadLeet==='function'&&!Object.keys(LEET.items||{}).length)await loadLeet();A.leet={v:leetWeek(),n:LEET.target||8,sub:'problems solved this week'}}catch(e){}
  try{const ws=(typeof gymLoaded!=='undefined'&&gymLoaded)?WORKOUTS:(await listDocs('gym/w-')).map(r=>r.data).filter(Boolean);
    A.gym={v:ws.filter(w=>w&&days.includes(w.date)&&w.endedAt!==null).length,sub:'workouts logged in Gym'}}catch(e){}
  TGA=A;tgBusy=false;renderTargets(true)}
function renderTargets(fromAuto){
  const rows=(M.targets||[]).filter(r=>TGK(r)!=='hide');const kinds=new Set(rows.map(TGK));
  const all=rows.concat(kinds.has('gym')?[]:[{key:'auto:gym',item:'train 4x a week',builtin:true}]);
  $('targets').innerHTML=all.map(r=>{const k=TGK(r),A=k&&TGA[k];
    if(k&&k!=='hide'){const n=(A&&A.n)||tgGoal(r)||7,v=A?A.v:0,full=v>=n,pc=Math.min(100,v/n*100);
      return `<div class="tg2 tgw tga${full?' full':''}"><b>${esc(A&&A.lab||String(r.item||'').toLowerCase())}</b><span>${esc(A?A.sub:'syncing…')}</span>${r.builtin?'<span></span>':`<button class="ed" type="button" data-tg="${esc(r.key)}">✎</button>`}
        <div class="tgs"><span class="pbar${full?' ok':''}"><i style="width:${pc.toFixed(1)}%"></i></span><span class="num tgv">${v}${A&&A.unit||''}/${n}${A&&A.unit||''}</span></div></div>`}
    const n=tgGoal(r),v=tgCount(r,n),pc=v/n*100;
    return `<div class="tg2 tgw${v>=n?' full':''}"><b>${esc(String(r.item||'').toLowerCase())}${r.edited?'<span class="delta">Δ</span>':''}</b><span>${esc(r.notes||'')}</span><button class="ed" type="button" data-tg="${esc(r.key)}">✎</button>
      <div class="tgs"><button class="tgb" type="button" data-tgd="${esc(r.key)}" data-d="-1" aria-label="undo one">−</button><input type="range" min="0" max="${n}" step="1" value="${v}" data-tgp="${esc(r.key)}" data-n="${n}" style="--v:${pc}%;--n:${n}" aria-label="done this week"><button class="tgb" type="button" data-tgd="${esc(r.key)}" data-d="1" aria-label="log one">+</button><span class="num tgv">${v}/${n}</span></div></div>`}).join('');
  if(!fromAuto)tgAuto()}
let tgT=null;
function tgSet(s,v){const n=+s.dataset.n;v=Math.max(0,Math.min(n,v));const was=+s.value;s.value=v;
  s.style.setProperty('--v',v/n*100+'%');const row=s.closest('.tg2');row.querySelector('.tgv').textContent=v+'/'+n;row.classList.toggle('full',v>=n);
  WEEK={...WEEK,tc:{...((WEEK&&WEEK.tc)||{}),[s.dataset.tgp]:v}};
  clearTimeout(tgT);tgT=setTimeout(()=>save('weeks/w-'+WK,WEEK),500);return was}
$('targets').oninput=e=>{const s=e.target.closest('[data-tgp]');if(s)tgSet(s,+s.value)};
$('targets').onchange=e=>{const s=e.target.closest('[data-tgp]');if(s&&+s.value>=+s.dataset.n&&typeof burstEl==='function')burstEl(s,30,true)};
$('targets').onclick=e=>{const d=e.target.closest('[data-tgd]');if(d){const s=d.parentNode.querySelector('[data-tgp]');const v=+s.value+(+d.dataset.d);const was=tgSet(s,v);if(+s.value>=+s.dataset.n&&was<+s.value&&typeof burstEl==='function')burstEl(s,30,true);return}const b=e.target.closest('[data-tg]');if(!b)return;const r=M.targets.find(x=>x.key===b.dataset.tg);editExtra('weekday',r)};
$('addTarget').onclick=()=>addExtra('weekday','DAILY TARGETS – review Sundays 19:00');


/* top streaks — same engine as the Streaks section, so the numbers always match */
function wkStreaks(){const el=$('streaks');if(!el)return;if(!habLoaded){loadHabits().then(()=>{if(cur==='week')wkStreaks()});return}
  const L=hAll().map(h=>({h,s:hStreak(h).n,r:hRate(h)})).filter(x=>x.s>0||x.r>0).sort((a,b)=>b.s-a.s||((b.r||0)-(a.r||0))).slice(0,8);
  el.innerHTML=L.length?L.map(({h,s,r})=>{const marks=[];for(let i=13;i>=0;i--){const d=hAdd(DAYK,-i);marks.push(!hDue(h,d)?'s':hDone(h,d)?'y':i===0?'p':'n')}
    return `<button type="button" class="streak" data-go="streaks"><span class="tag dim">${esc(h.ic||'')} ${esc(h.n)}</span><b class="num ${s>=3?'hot':''}">${s}</b><span class="dim" style="font-size:11px">day streak${r!=null?` · ${Math.round(r)}% last 30d`:''}</span><div class="dots">${marks.map(m=>`<i class="${m}"></i>`).join('')}</div></button>`}).join('')
    :'<div class="dim">Tick things off in Today or Streaks and your best streaks show up here.</div>';
  el.onclick=e=>{if(e.target.closest('[data-go]'))go('streaks')}}

/* ================= WEEK IN REVIEW =================
   Pulls every part of the app into one weekly summary, compared with the same days of last week.
   A one-line snapshot is kept in weeks/w-<isoweek>.sum so past reviews still show their numbers. */
let WRV=null,wrBusy=false;
const wrDays=(off)=>{const L0=logical(),dn=L0.getDay()||7,m=new Date(L0);m.setDate(m.getDate()-(dn-1)+off*7);const out=[];for(let i=0;i<7;i++){const d=new Date(m);d.setDate(m.getDate()+i);out.push(ymd(d))}return out};
const wrAvg=a=>{a=a.filter(x=>x!=null&&!isNaN(x));return a.length?a.reduce((x,y)=>x+y,0)/a.length:null};
async function wrStats(days){
  const S={},has=d=>days.includes(d),safe=async f=>{try{await f()}catch(e){}};
  await safe(async()=>{const docs=await Promise.all(days.map(d=>d===DAYK?Promise.resolve(DAY):load('days/d-'+d)));
    const ps=docs.map(v=>v&&v.total?v.done/v.total*100:null);S.adh=wrAvg(ps);S.adhDays=ps;S.adh80=ps.filter(p=>p!=null&&p>=80).length});
  await safe(async()=>{const rows=(await listDocs('sleep/w-')).filter(r=>r.data&&has(r.path.slice(8))).map(r=>r.data);
    S.sleep=wrAvg(rows.map(n=>n.asleep));S.sq=wrAvg(rows.map(n=>sQ(n)));S.deep=wrAvg(rows.map(n=>n.deep));S.nights=rows.length});
  await safe(async()=>{const hs=(await Promise.all(days.map(d=>load('health/d-'+d)))).map(h=>h||{});
    S.hrv=wrAvg(hs.map(h=>h.hrv));S.rhr=wrAvg(hs.map(h=>h.rhr));S.steps=wrAvg(hs.map(h=>h.steps));S.akcal=wrAvg(hs.map(h=>h.kcal));
    const st=hs.map(h=>h.screentime!=null?+h.screentime/60:null);S.screen=wrAvg(st)});
  await safe(async()=>{const fo=(FOCUS&&FOCUS.sessions&&FOCUS.sessions.length?FOCUS:await load('tools/focus'))||{};S.dw=(fo.sessions||[]).filter(x=>has(x.d)).reduce((a,x)=>a+(+x.min||0),0)});
  await safe(async()=>{const ws=(typeof gymLoaded!=='undefined'&&gymLoaded)?WORKOUTS:(await listDocs('gym/w-')).map(r=>r.data).filter(Boolean);
    const W=ws.filter(w=>w&&has(w.date));S.gym=W.length;S.vol=W.reduce((a,w)=>a+(w.vol!=null?+w.vol:stats(w).vol),0);S.sets=W.reduce((a,w)=>a+(w.nsets!=null?+w.nsets:stats(w).n),0)});
  await safe(async()=>{if(!FPROF){const p=await load('food/profile');if(p&&!FPROF)FPROF=p}
    const fd=(await Promise.all(days.map(d=>load('food/d-'+d)))).map(f=>f&&f.m?fSum(['b','l','d','s'].flatMap(k=>f.m[k]||[])):null).filter(t=>t&&t.kcal>0);
    S.kcal=wrAvg(fd.map(t=>t.kcal));S.prot=wrAvg(fd.map(t=>t.p));S.fdays=fd.length;try{S.budget=fBudget()}catch(e){}});
  await safe(async()=>{const wt=await load('body/wt');const r=((wt&&wt.r)||[]).filter(x=>has(String(x.t).slice(0,10)));if(r.length){S.kg0=+r[0].kg;S.kg1=+r[r.length-1].kg;S.kg=S.kg1}});
  await safe(async()=>{const bk=(typeof brickLoaded!=='undefined'&&brickLoaded)?BRICK:await load('tools/brick');S.brick=((bk&&bk.sessions)||[]).filter(x=>has(x.d)).reduce((a,x)=>a+(+x.min||0),0)});
  await safe(async()=>{const js=(await Promise.all(days.map(d=>load('journal/e-'+d)))).filter(Boolean);S.jn=js.length;S.mood=wrAvg(js.map(e=>e.mood?+e.mood:null))});
  await safe(async()=>{const t=await load('tasks/all');S.tasks=((t&&t.list)||[]).filter(x=>x.done&&has(String(x.done).slice(0,10))).length});
  await safe(async()=>{if(!habLoaded)await loadHabits();let due=0,hit=0;hAll().forEach(h=>days.filter(d=>d<=DAYK).forEach(d=>{if(hDue(h,d)){due++;if(hDone(h,d))hit++}}));S.hab=due?hit/due*100:null});
  await safe(async()=>{if(typeof loadLeet==='function'&&!Object.keys(LEET.items||{}).length)await loadLeet();S.leet=solves().filter(a=>has(a.d)).length});
  return S}
const wrHM=m=>m==null?'—':Math.floor(m/60)+'h '+pad(Math.round(m%60))+'m';
const WRT=[ /* key, label, format, higher-is-better, colour, view */
  ['adh','Plan done',v=>Math.round(v)+'<small>%</small>',1,'#ff2a6d','today'],
  ['sq','Sleep score',v=>Math.round(v),1,'#8e5cff','sleep'],
  ['sleep','Avg sleep',v=>wrHM(v),1,'#4f7cff','sleep'],
  ['hrv','HRV',v=>Math.round(v)+'<small> ms</small>',1,'#5ac8fa','sleep'],
  ['dw','Deep work',v=>wrHM(v),1,'#ff9f0a','tools'],
  ['gym','Workouts',v=>v+'<small> · '+(WRV&&WRV.cur.vol?Math.round(WRV.cur.vol/1000*10)/10+'t':'0t')+'</small>',1,'#30d158','gym'],
  ['kcal','Avg calories',v=>Math.round(v).toLocaleString('en-GB'),0,'#ffd60a','food'],
  ['prot','Avg protein',v=>Math.round(v)+'<small> g</small>',1,'#ff6b6b','food'],
  ['screen','Screen time',v=>wrHM(v)+'<small>/day</small>',0,'#ff375f','tools'],
  ['brick','Phone-free',v=>wrHM(v),1,'#bf5af2','tools'],
  ['hab','Habits hit',v=>Math.round(v)+'<small>%</small>',1,'#64d2ff','streaks'],
  ['tasks','Tasks done',v=>v,1,'#a1a1a6','journal'],
  ['leet','LeetCode',v=>v+'<small> solved</small>',1,'#ffcc00','tools'],
  ['mood','Journal mood',v=>(Math.round(v*10)/10)+'<small>/10</small>',1,'#5e5ce6','journal'],
];
function wrDelta(k,c,p,hi){if(c==null||p==null||!p)return '';const d=(c-p)/Math.abs(p)*100;if(Math.abs(d)<3)return '<em class="eq">≈ last week</em>';const good=hi?d>0:d<0;return `<em class="${good?'up':'dn'}">${d>0?'↑':'↓'} ${Math.round(Math.abs(d))}%</em>`}
async function renderReview(){const el=$('wkReview');if(!el||wrBusy)return;wrBusy=true;
  if(!WRV)el.innerHTML='<div class="wr-card wr-load">Reading your week…</div>';
  try{const cd=wrDays(0).filter(d=>d<=DAYK),n=cd.length,pd=wrDays(-1).slice(0,n);
    const [cur,prev]=await Promise.all([wrStats(cd),wrStats(pd)]);WRV={cur,prev,cd};
    /* week score = how far along every weekly target is */
    const tg=Object.values(typeof TGA!=='undefined'?TGA:{}).filter(a=>a&&a.n);const score=tg.length?Math.round(wrAvg(tg.map(a=>Math.min(1,a.v/a.n)))*100):null;
    const tiles=WRT.filter(([k])=>cur[k]!=null&&!(cur[k]===0&&!prev[k]));
    const hl=[];const ad=cur.adhDays||[];const bi=ad.reduce((b,v,i)=>v!=null&&(b<0||v>ad[b])?i:b,-1);
    if(bi>=0)hl.push(['star',`Best day: <b>${new Date(cd[bi]+'T12:00').toLocaleDateString('en-GB',{weekday:'long'})}</b>, ${Math.round(ad[bi])}% of your plan done`]);
    const ch=WRT.map(([k,l,,hi])=>{const c=cur[k],p=prev[k];if(c==null||p==null||!p)return null;const d=(c-p)/Math.abs(p)*100;return {l,d:hi?d:-d,raw:d}}).filter(x=>x&&Math.abs(x.raw)>=8).sort((a,b)=>b.d-a.d);
    if(ch[0]&&ch[0].d>0)hl.push(['up',`Biggest gain: <b>${ch[0].l.toLowerCase()}</b> ${ch[0].raw>0?'up':'down'} ${Math.round(Math.abs(ch[0].raw))}% on last week`]);
    const lo=ch[ch.length-1];if(lo&&lo.d<0)hl.push(['dn',`Slipped: <b>${lo.l.toLowerCase()}</b> ${lo.raw>0?'up':'down'} ${Math.round(Math.abs(lo.raw))}% on last week`]);
    if(tg.length){const full=tg.filter(a=>a.v>=a.n).length;hl.push(['tg',`<b>${full} of ${tg.length}</b> weekly targets already hit`])}
    if(cur.kg0!=null&&cur.kg1!=null&&cur.kg0!==cur.kg1)hl.push(['kg',`Weight <b>${cur.kg1>cur.kg0?'+':''}${(cur.kg1-cur.kg0).toFixed(1)} kg</b> this week (${cur.kg1} kg now)`]);
    if(cur.sleep!=null&&SSET&&SSET.goal){const debt=n*SSET.goal*60-cur.sleep*cur.nights;if(cur.nights&&Math.abs(debt)>30)hl.push([debt>0?'dn':'up',`Sleep ${debt>0?'debt':'surplus'}: <b>${wrHM(Math.abs(debt))}</b> against your ${SSET.goal}h goal`])}
    const IC={star:'<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>',up:'<path d="M5 15l7-7 7 7"/>',dn:'<path d="M5 9l7 7 7-7"/>',tg:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/>',kg:'<path d="M4 20h16M6 20l2-12h8l2 12M9 8a3 3 0 0 1 6 0"/>'};
    const D0=new Date(cd[0]+'T12:00'),D1=new Date(wrDays(0)[6]+'T12:00'),range=D0.getDate()+(D0.getMonth()!==D1.getMonth()?' '+D0.toLocaleDateString('en-GB',{month:'short'}):'')+' – '+D1.getDate()+' '+D1.toLocaleDateString('en-GB',{month:'short'});
    el.innerHTML=`<div class="wr-card"><div class="wr-top"><div><div class="wr-eye">Week in review · ${esc(WK)}</div><div class="wr-title">${range}</div><div class="wr-sub">${n} day${n>1?'s':''} in · compared with the same days last week</div></div>
      ${score!=null?sRing(score,score>=80?'#30d158':score>=50?'#ffd60a':'#ff2a6d',92,9,`<b class="num">${score}</b><span>Week score</span>`):''}</div>
      ${hl.length?`<div class="wr-hl">${hl.map(([i,t])=>`<div class="wr-hli ${i}"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${IC[i]}</svg><span>${t}</span></div>`).join('')}</div>`:''}
      <div class="wr-tiles">${tiles.map(([k,l,f,hi,c,v])=>`<button type="button" class="wr-tile" data-go="${v}" style="--c:${c}"><span><i></i>${l}</span><b class="num">${f(cur[k])}</b>${wrDelta(k,cur[k],prev[k],hi)||'<em class="eq">&nbsp;</em>'}</button>`).join('')||'<div class="sl-note">Nothing logged yet this week.</div>'}</div><div id="wkPast"></div></div>`;
    el.onclick=e=>{const b=e.target.closest('[data-go]');if(b)go(b.dataset.go)};
    /* keep a snapshot with the week so past reviews keep their numbers */
    const sum=[cur.adh!=null&&Math.round(cur.adh)+'% plan',cur.sq!=null&&'sleep '+Math.round(cur.sq),cur.dw&&wrHM(cur.dw)+' deep work',cur.gym&&cur.gym+' workouts',cur.screen!=null&&wrHM(cur.screen)+'/day screen',score!=null&&'score '+score].filter(Boolean).join(' · ');
    if(sum&&WEEK&&WEEK.sum!==sum){WEEK={...WEEK,sum};save('weeks/w-'+WK,WEEK)}
    wrPast()}catch(e){el.innerHTML='<div class="wr-card wr-load">Could not read the week.</div>'}
  wrBusy=false}
async function wrPast(){const el=$('wkPast');if(!el)return;try{
  const rows=(await listDocs('weeks/w-')).filter(r=>r.data&&r.path.slice(8)!==WK&&r.data.sum).sort((a,b)=>a.path<b.path?1:-1);
  
  el.innerHTML=rows.length?`<details class="sl-det"><summary>Past reviews · ${rows.length}</summary><div class="wr-past">${rows.slice(0,26).map(r=>`<div><b>${esc(r.path.slice(8))}</b>${r.data.sum?`<span>${esc(r.data.sum)}</span>`:''}${r.data.notes?`<p>${esc(r.data.notes)}</p>`:''}</div>`).join('')}</div></details>`:''}catch(e){}}

/* ================= STACK ================= */
const STC=Object.fromEntries(STACK_CATS.map((c,i)=>[c,['#ff2a6d','#ffb000','#57f5a8','#05d9e8','#b18cff','#7a7a7a'][i]||'#7a7a7a']));
const STATUSL={active:'in plan',asneeded:'as needed',paused:'paused',notinplan:'not in plan'};
let stF='active',catF=null,sortK='monthly',sortD=-1;
/* focus group: a cross-cutting chip for everything that supports one goal. its name and the private part of its
   word list come from sys/lex (w.fx, fxk); the generic support compounds below are just the public fallback. */
const FXK_BASE=['tyrosine','zinc','magnesium','bromantane','memantine','theanine','citicoline','cdp choline','alpha gpc','alcar','acetyl l carnitine','nac','omega','fish oil','iron','vitamin d','caffeine','rhodiola','ginkgo','saffron','lions mane','uridine','phosphatidylserine','guanfacine','modafinil','astaxanthin','astax','nebivolol','taurine','9 me bc','9mebc','mexidol','lemborexant','nacet','n acetylcysteine ethyl','adhd','medikinet','vyvanse','elvanse','ritalin','methylphenidate','lisdexamfetamine'];
const fxN=x=>' '+norm(x).replace(/[^a-z0-9]+/g,' ').trim()+' ';
const fxMatch=s=>{const n=fxN(s.name),c=n.replace(/ /g,'');return [...new Set(FXK_BASE.concat(LX('fxk',[])))].some(k=>{const t=fxN(k);return t.length<=6?n.includes(t):c.includes(t.replace(/ /g,''))})};
/* sleep group: same idea, for anything that aids sleep. extra private names come from sys/lex (slk). */
const SLK_BASE=['melatonin','glycine','magnesium','theanine','lemborexant','apigenin','ashwagandha','gaba','valerian','tryptophan','5 htp','5htp','inositol','taurine','passionflower','lemon balm','magnolia','cbd','cbn','trazodone','doxylamine','diphenhydramine','mirtazapine','zopiclone','zolpidem','daridorexant','suvorexant','ramelteon','hydroxyzine','tart cherry','montmorency','kava','chamomile','lavender','sleep'];
const slMatch=s=>{const n=fxN(s.name),c=n.replace(/ /g,'');return [...new Set(SLK_BASE.concat(LX('slk',[])))].some(k=>{const t=fxN(k);return t.length<=6?n.includes(t):c.includes(t.replace(/ /g,''))})};
const stFilter=k=>s=>k==='all'||(k==='fx'?fxMatch(s):k==='sl'?slMatch(s):k==='inb'?s.inb:k==='opt'?!s.inb:k==='edited'?s.edited:s.status===k);
function renderStack(){
  const st=M.stack;const c=s=>st.filter(x=>x.status===s).length;
  $('stackSub').textContent=`${st.length} ${LW('items','items')}`;
  $('stackKv').innerHTML=[['budget',gbp(M.stackBudget,2),'/month · in budget = Yes'],['live budget',gbp(M.liveBudget,2),'/month · minus paused in v2'],['optional',gbp(M.stackOpt,2),'/month · in budget = No'],['in plan',String(c('active')),`${c('asneeded')} as needed · ${c('paused')} paused`]]
    .map(([k,v,s],i)=>`<div class="panel"><div class="ph"><span class="tag">${k}</span></div><div class="pb"><span class="v num ${i===1?'pink':''}" data-scr="${esc(v)}">${v}</span><span class="s">${s}</span></div></div>`).join('');
  const pb=st.filter(s=>s.inb&&s.status==='paused'&&s.monthly>0);
  $('stackWarn').innerHTML='';
  const sts=[['all','all'],['active','in plan'],['asneeded','as needed'],['paused','paused'],['notinplan','not in plan'],['inb','in budget'],['opt','optional'],['fx',LW('fx','ADHD')],['sl',LW('sl','sleep')]];
  $('stChips').innerHTML=sts.map(([k,l])=>`<button class="chip" type="button" data-s="${k}" aria-pressed="${stF===k}">${l}<span class="c">${st.filter(stFilter(k)).length}</span></button>`).join('');
  $('catChips').innerHTML=STACK_CATS.map(cc=>`<button class="chip" type="button" data-c="${esc(cc)}" aria-pressed="${catF===cc}"><i style="background:${STC[cc]}"></i>${esc(cc.split(' / ')[0].toLowerCase())}<span class="c">${st.filter(s=>s.cat===cc).length}</span></button>`).join('');
  renderStackTbl();
}
function renderStackTbl(){
  const q=norm($('q').value);
  let rows=M.stack.filter(stFilter(stF)).filter(s=>!catF||s.cat===catF).filter(s=>!q||[s.name,s.dose,s.route,s.sched,s.notes,s.src,s.cat].some(x=>norm(x).includes(q)));
  rows.sort((a,b)=>sortK==='name'?a.name.localeCompare(b.name)*sortD:((a[sortK]||0)-(b[sortK]||0))*sortD||a.name.localeCompare(b.name));
  const ar=k=>sortK===k?(sortD<0?' ↓':' ↑'):'';
  $('stackTbl').innerHTML=`<div class="tr hd"><button type="button" data-sort="name">name${ar('name')}</button><span class="dd2">Dose · route</span><span class="dd2">Schedule · when</span><button type="button" data-sort="monthly" style="text-align:right">£/month${ar('monthly')}</button><span style="text-align:right">Status</span></div>`+
  (rows.length?rows.map(s=>`<div class="tr ${s.status}" role="button" tabindex="0" data-k="${esc(s.key)}"><span class="nm"><i style="background:${STC[s.cat]||'#7a7a7a'}"></i><span>${esc(s.name)}</span>${s.edited?'<span class="delta">Δ</span>':''}${s.cau.length?'<span class="warn" title="Has cautions">⚠︎</span>':''}</span><span class="ds dd2">${esc([s.dose,s.route].filter(x=>x&&x!=='—').join(' · '))}</span><span class="ds dd2">${esc([s.sched&&s.sched!=='—'?s.sched:null,s.times.length?'@ '+s.times.join(', '):null].filter(Boolean).join(' '))}</span><span class="co num">${s.monthly?gbp(s.monthly,2):(s.price==='owned'?'<span class="dim">Owned</span>':'<span class="dim">—</span>')}</span><span class="row" style="justify-content:flex-end;gap:6px"><button class="ed" type="button" data-sed="${esc(s.key)}">✎</button><span class="st ${s.status}">${STATUSL[s.status]}</span></span></div>`).join(''):`<div class="tr hd" style="color:var(--dim)">no match for "${esc(q)}"</div>`);
}
$('stChips').onclick=e=>{const b=e.target.closest('.chip');if(!b)return;stF=b.dataset.s;renderStack();glitchAll()};
$('catChips').onclick=e=>{const b=e.target.closest('.chip');if(!b)return;catF=catF===b.dataset.c?null:b.dataset.c;renderStack();glitchAll()};
$('q').oninput=renderStackTbl;$('addCmp').onclick=addStack;
$('stackTbl').onclick=e=>{const h=e.target.closest('[data-sort]');if(h){const k=h.dataset.sort;if(sortK===k)sortD*=-1;else{sortK=k;sortD=k==='name'?1:-1}renderStackTbl();return}
  const ed=e.target.closest('[data-sed]');if(ed){e.stopPropagation();editStack(M.stack.find(x=>x.key===ed.dataset.sed));return}
  const r=e.target.closest('.tr[data-k]');if(r)openDrawer(r.dataset.k)};
$('stackTbl').onkeydown=e=>{if(e.key==='Enter'&&e.target.dataset.k)openDrawer(e.target.dataset.k)};
function openDrawer(key){
  const s=M.stack.find(x=>x.key===key);if(!s)return;
  const row=(k,v)=>v!==null&&v!==undefined&&v!==''&&v!=='—'?`<dt>${k}</dt><dd>${esc(v)}</dd>`:'';
  const wk=s.monthly?s.monthly*12/52:0;
  $('drawer').innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center"><span class="tag" style="color:${STC[s.cat]||'#7a7a7a'}">${esc(s.cat||'')}</span><span class="row"><button class="btn p" type="button" id="dEdit">Edit</button><button class="iconbtn" type="button" id="dClose">esc ✕</button></span></div>
  <h3 class="glitch" data-text="${esc(s.name)}">${esc(s.name)}</h3>
  <div class="chips" id="dSt" style="margin:0 0 6px">${['active','asneeded','paused','notinplan'].map(x=>`<button class="chip" type="button" data-dst="${x}" aria-pressed="${s.status===x}">${STATUSL[x]}</button>`).join('')}</div><span class="dim" style="display:block;font-size:11px;margin-bottom:14px">${s.inb?'in budget':'optional'}${s.edited?' · edited':''}</span>
  <dl>${row('dose',s.dose)}${row('route',s.route)}${row('schedule',s.sched)}${row('taken at',s.times.join(', '))}${row('source',s.src)}${row('pack price',isNum(s.price)?gbp(s.price,2):s.price)}${row('units / pack',s.units)}${row('used / week',s.perweek)}${row('weekly',wk?gbp(wk,2):'')}${row('monthly',s.monthly?gbp(s.monthly,2):'')}${row('yearly',s.monthly?gbp(s.monthly*12,0):'')}</dl>
  ${s.notes?`<div class="sect"><span class="tag">Notes</span>${esc(s.notes)}</div>`:''}
  ${s.cau.length?`<div class="sect"><span class="tag">Interactions & cautions · from your plan</span>${s.cau.map(c=>`<div class="ca">${esc(c)}</div>`).join('')}</div>`:''}
  ${s.monthly&&M.rate?`<div class="sect"><span class="tag">Costs you</span><span style="font-size:22px;font-weight:800" class="num">${(s.monthly/M.rate).toFixed(1)} h</span> <span class="dim">of work a month</span></div>`:''}`;
  $('drawer').classList.add('on');$('drawer').setAttribute('aria-hidden','false');$('scrim').classList.add('on');$('dClose').onclick=closeDrawer;$('dEdit').onclick=()=>editStack(s);$('dSt').onclick=e=>{const b=e.target.closest('[data-dst]');if(!b)return;setStackStatus(s.name,b.dataset.dst);openDrawer(key)};$('dClose').focus();
}
function closeDrawer(){$('drawer').classList.remove('on');$('drawer').setAttribute('aria-hidden','true');$('scrim').classList.remove('on')}
$('scrim').onclick=()=>{closeDrawer();closeSheet()};
function openPendDrawer(){
  const ent=Object.entries(EDITS.p);
  const where=k=>{const [a,b]=k.split(':');const sheet=SHEET_OF[a];return b==='n'?`${sheet} · new row`:a==='inc'?`${sheet} · income`:`${sheet} · row ${b}`};
  const label=(k,p)=>{if(k==='inc:')return 'income';return p.name||p.item||findName(k)||(p._was)||k};
  const what=p=>p._del?'delete row':p._new?'add row':Object.keys(p).filter(x=>x[0]!=='_').map(f=>f+' → '+(p[f]===true?'Yes':p[f]===false?'No':p[f]??'blank')).join(', ');
  const stTxt={live:'<b class="ok">● live</b> · your laptop is linked to Stack Budget.xlsx. Edits from any device go into Excel within about 30 seconds, and changes made in Excel show up here.',
    err:'<b class="bad">! problem</b> · '+esc(XLMSG),
    off:'<b>· laptop not linked right now</b>'+(XLMSG?' · '+esc(XLMSG):'')+' · edits are saved and show everywhere; they go into Excel as soon as the laptop is on and the sync agent is running.'}[XLSTATE]||'';
  $('drawer').innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center"><span class="tag pink">Excel sync</span><button class="iconbtn" type="button" id="dClose">esc ✕</button></div>
  <h3>${ent.length?ent.length+' edit'+(ent.length===1?'':'s')+' queued':'all synced'}</h3>
  <p style="font-size:12px;margin:0 0 10px;line-height:1.6">${stTxt}</p>
  <p class="dim" style="font-size:12px;margin:0 0 14px">Sheet data from ${esc(GMETA.src==='excel'?'Excel':'the build snapshot')} · ${esc(ago(GMETA.at)||'—')}</p>
  <ul class="pl">${ent.map(([k,p])=>`<li><span><b>${esc(label(k,p))}</b></span><button class="iconbtn" type="button" data-undo="${esc(k)}">Undo</button><span class="s">${esc(where(k))} · ${esc(what(p))}${p._err?`<br><span class="bad">${esc(p._err)}</span>`:''}${p._lost?'<br><span class="bad">This row was removed or renamed in Excel, so the edit has nowhere to go. Undo it or redo it on the new row.</span>':''}</span>${p._err?`<button class="iconbtn" type="button" data-retry="${esc(k)}">Retry</button>`:''}</li>`).join('')}</ul>`;
  $('drawer').classList.add('on');$('drawer').setAttribute('aria-hidden','false');$('scrim').classList.add('on');$('dClose').onclick=closeDrawer;
  $('drawer').querySelectorAll('[data-undo]').forEach(b=>b.onclick=()=>{dropPatch(b.dataset.undo);openPendDrawer()});
  $('drawer').querySelectorAll('[data-retry]').forEach(b=>b.onclick=()=>{const p=EDITS.p[b.dataset.retry];if(p){delete p._err;EDITS.p[b.dataset.retry]={...p,_retry:Date.now()};saveEdits();lastOpsJson='';publishOps();openPendDrawer()}});
}
function findName(k){const [a,b]=k.split(':');const row=+b;if(a==='wd'||a==='we'){const P=D[a==='wd'?'weekday':'weekend'];for(const bl of P.blocks)for(const i of bl.items)if(i.row===row)return i.item}
  if(a==='wx'||a==='ex'){const P=D[a==='wx'?'weekday':'weekend'];for(const rows of Object.values(P.extra))for(const r of rows)if(r.row===row)return r.cells[1]}
  if(a==='xp'){const e=D.expenses.find(x=>x.row===row);return e&&e.name}return null}


/* status lives in the app now (not the Excel plan): tap a status in an item's panel to change it */
let STOVR={map:{}};
async function loadStackStatus(){const d=await load('stack/status');STOVR={map:{},...(d||{})};
  if(!STOVR.v&&(M.stack||[]).length){/* first run: anything sitting "paused" but still counted in budget becomes "not in plan" */
    (M.stack||[]).filter(s=>s.status==='paused'&&s.inb).forEach(s=>STOVR.map[norm(s.name)]='notinplan');STOVR.v=1;save('stack/status',STOVR)}
  rebuild()}
function setStackStatus(name,st){STOVR.map[norm(name)]=st;save('stack/status',STOVR);rebuild()}
watch('stack/status',d=>{if(d){STOVR={map:{},...d};rebuild()}});

/* ================= MONEY ================= */
const CATC={'Investment & Savings':'#ff2a6d','Personal & Other':'#ffb000','Stack':'#57f5a8','Food':'#e6e6e6','Subscriptions':'#05d9e8','Cat':'#b18cff'};
let billCat=null;
function renderMoney(){
  const I=M.inc;
  $('moneyKv').innerHTML=[['take-home',gbp(I.take),`${I.hours} h · ${gbp(M.rate,2)}/h`,'',true],['outgoings',gbp(M.out),'savings included',''],['left over',gbp(M.left),M.left<0?'budgeted more than you earn':'not yet allocated',M.left<0?'bad':'ok'],['spending',gbp(M.spend),`${Math.round(M.spend/I.take*100)}% of take-home · ${Math.round(M.save/I.take*100)}% saved`,'']]
    .map(([k,v,s,c,ed])=>`<div class="panel"><div class="ph"><span class="tag">${k}</span>${ed?'<button class="ed" type="button" id="incEd">✎</button>':''}</div><div class="pb"><span class="v num ${c}" data-scr="${esc(v)}">${v}</span><span class="s">${s}</span></div></div>`).join('');
  $('incEd').onclick=editIncome;
  const cats=Object.entries(M.cats).map(([cat,m])=>({cat,m})).sort((a,b)=>b.m-a.m);const mx=cats[0].m||1;
  $('cats').innerHTML=cats.map(c=>{const n=Math.max(1,Math.round(c.m/mx*44));return `<div class="cat${billCat===c.cat?' sel':''}" data-c="${esc(c.cat)}" role="button" tabindex="0"><span class="nm">${esc(c.cat==='Investment & Savings'?'savings':c.cat.toLowerCase())}</span><span class="bars"><i style="width:${(c.m/mx*100).toFixed(1)}%;background:${CATC[c.cat]}"></i></span><span class="co num">${gbp(c.m,2)}</span><span class="hr num">${M.rate?(c.m/M.rate).toFixed(1):0}h</span></div>`}).join('');
  if(billCat==='Stack'){$('billsTitle').textContent='stack';$('billsTot').textContent=gbp(M.stackBudget,2)+'/mo';$('bills').innerHTML='<div class="dim">Itemised on the stack view. <button class="iconbtn" type="button" id="goStack">Open /stack</button></div>';$('goStack').onclick=()=>go('stack');$('addBill').style.visibility='hidden'}
  else{$('addBill').style.visibility='';
    const list=M.expenses.filter(e=>e.name!=='x'&&(billCat?e.cat===billCat:e.cat!=='Investment & Savings')).sort((a,b)=>b.m-a.m);
    $('billsTitle').textContent=billCat?billCat.toLowerCase():'every bill';$('billsTot').textContent=gbp(list.filter(e=>e.inb!==false).reduce((s,e)=>s+(e.m||0),0),2)+'/mo';
    $('bills').innerHTML=list.map(billRow).join('')}
  const sv=M.expenses.filter(e=>e.cat==='Investment & Savings').sort((a,b)=>b.m-a.m);
  $('saveTot').textContent=gbp(M.save,2)+'/mo';
  $('saves').innerHTML=sv.map(billRow).join('')+`<div class="dim" style="font-size:12px;margin-top:8px">Yearly deposits are shown as their monthly share.</div>`;
  $('rateLbl').textContent=gbp(M.rate,2)+'/h take-home';calc();renderActuals();
}
function billRow(e){return `<div class="bill"><span>${esc(e.name)}${e.edited?'<span class="delta">Δ</span>':''}${e.inb===false?' <span class="dim" style="font-size:11px">(not in budget)</span>':''}<br><span class="s">${esc([e.prov&&e.prov!=='x'?e.prov:null,e.freq&&e.freq!=='x'?e.freq:null,e.day?'on the '+e.day:null,e.notes].filter(Boolean).join(' · '))}</span></span><span class="s num">${e.y?gbp(e.y)+'/yr':''} <button class="ed" type="button" data-xe="${esc(e.key)}">✎</button></span><span class="co num">${e.m?gbp(e.m,2):'<span class="dim">—</span>'}</span></div>`}
function calc(){let v=parseFloat($('calcIn').value)||0;if($('calcCur').textContent==='$')v=usd2gbp(v);const h=M.rate?v/M.rate:0;$('calcOut').textContent=h>=1?`${h.toFixed(1)} h`:`${Math.round(h*60)} min`;$('calcNote').textContent=`That's ${(h/(M.inc.hours/21.7)).toFixed(2)} working days at your take-home rate.`}
$('calcIn').oninput=calc;$('avCur').onclick=()=>{const b=$('avCur');b.textContent=b.textContent==='£'?'$':'£';b.classList.toggle('usd');FXR.get()};$('calcCur').onclick=()=>{const b=$('calcCur');b.textContent=b.textContent==='£'?'$':'£';b.classList.toggle('usd');FXR.get().then(calc);calc()};
$('cats').onclick=e=>{const c=e.target.closest('.cat');if(!c)return;billCat=billCat===c.dataset.c?null:c.dataset.c;renderMoney();glitchAll()};
$('cats').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.target.click()}};
document.getElementById('v-money').addEventListener('click',e=>{const b=e.target.closest('[data-xe]');if(b)editExp(M.expenses.find(x=>x.key===b.dataset.xe))});
$('addBill').onclick=()=>addExp(billCat&&billCat!=='Investment & Savings'?billCat:'Subscriptions');$('addSave').onclick=()=>addExp('Investment & Savings');


/* ---- actual vs budget, kept in the app (doc money/actuals: {months:{'YYYY-MM':{cat:amount}}}) ---- */
let ACT={months:{}},AVM=new Date().toISOString().slice(0,7);
async function loadActuals(){const d=await load('money/actuals');ACT={months:{},...(d||{})}}
watch('money/actuals',d=>{if(d){ACT={months:{},...d};if(!document.activeElement||!document.activeElement.closest||!document.activeElement.closest('#avBody'))renderActuals()}});
function avShift(n){const [y,m]=AVM.split('-').map(Number);const d=new Date(y,m-1+n,1);AVM=d.getFullYear()+'-'+pad(d.getMonth()+1);renderActuals()}
function renderActuals(){const el=$('avBody');if(!el||!M.cats)return;
  $('avMon').textContent=new Date(AVM+'-01T12:00').toLocaleDateString('en-GB',{month:'short',year:'numeric'});
  const cats=Object.entries(M.cats).filter(([c])=>c!=='Investment & Savings'&&c!=='Stack').sort((a,b)=>b[1]-a[1]);const mon=ACT.months[AVM]||{};
  const tb=cats.reduce((a,[,b])=>a+b,0),ta=cats.reduce((a,[c])=>a+(+mon[c]||0),0),logged=cats.some(([c])=>mon[c]!=null&&mon[c]!=='');
  const hist=[...Array(6)].map((_,i)=>{const [y,m]=AVM.split('-').map(Number);const d=new Date(y,m-6+i,1);const k=d.getFullYear()+'-'+pad(d.getMonth()+1);const mm=ACT.months[k]||{};return {k,a:cats.reduce((s,[c])=>s+(+mm[c]||0),0)}});const hmx=Math.max(tb,...hist.map(h=>h.a))||1;
  el.innerHTML=`<div class="av">${cats.map(([c,b])=>{const a=mon[c];const has=a!=null&&a!=='';const pct=has?Math.min(150,(+a)/(b||1)*100):0;const over=has&&+a>b;
    return `<div class="avr"><span class="avn">${esc(c==='Personal & Other'?'personal':c.toLowerCase())}</span><span class="avbar"><i class="${over?'over':''}" style="width:${Math.min(100,pct)}%;background:${over?'var(--bad)':CATC[c]||'var(--cyan)'}"></i></span><input class="inp num avin" data-avc="${esc(c)}" inputmode="decimal" placeholder="£${Math.round(b)}" value="${has?a:''}"><span class="avd num ${over?'bad':has?'ok':'dim'}">${has?(over?'+':'−')+gbp(Math.abs(+a-b),0):gbp(b,0)}</span></div>`}).join('')}
    ${logged?`<div class="avtot"><span>${logged?\`spent <b class="num">${gbp(ta,0)}</b> of <b class="num">${gbp(tb,0)}</b> budgeted\`:''}</span>${logged?\`<b class="num ${ta>tb?'bad':'ok'}">${ta>tb?'over by '+gbp(ta-tb,0):gbp(tb-ta,0)+' under'}</b>\`:''}</div>`:''}
    <div class="avhist">${hist.map(h=>`<div class="${h.k===AVM?'on':''}"><span class="b" style="height:${h.a/hmx*100}%;${h.a>tb?'background:var(--bad)':''}"></span><span class="l">${new Date(h.k+'-01T12:00').toLocaleDateString('en-GB',{month:'short'}).toLowerCase()}</span></div>`).join('')}</div></div>`;
  el.onchange=e=>{const c=e.target.dataset.avc;if(!c)return;const raw=e.target.value.replace(/[,\s]/g,'');const u=parseUsd(raw)??($('avCur').textContent==='$'&&raw!==''&&isFinite(+raw)?usd2gbp(+raw):null);if(u!=null){e.target.value=u;e.target.dispatchEvent(new Event('input',{bubbles:true}))}};
  el.oninput=e=>{const c=e.target.dataset.avc;if(!c||(e.isTrusted&&(/\$|usd/i.test(e.target.value)||$('avCur').textContent==='$')))return;const v=e.target.value.replace(/[£,\s]/g,'');ACT.months[AVM]={...(ACT.months[AVM]||{}),[c]:v===''?null:+v};clearTimeout(renderActuals.t);renderActuals.t=setTimeout(()=>{save('money/actuals',ACT);const f=document.activeElement&&document.activeElement.dataset.avc;renderActuals();if(f){const n=el.querySelector(`[data-avc="${CSS.escape(f)}"]`);if(n){n.focus();n.setSelectionRange(n.value.length,n.value.length)}}},700)}}
$('avPrev').onclick=()=>avShift(-1);$('avNext').onclick=()=>avShift(1);

/* ================= EXCEL SYNC ================= */
const SHEET_OF={st:'Stack',xp:'Expenses',wd:'Day Plan v2',wx:'Day Plan v2',we:'Weekend Plan',ex:'Weekend Plan',inc:'Expenses Summary'};
const SHEET_DOC={'Stack':'stack','Expenses':'expenses','Expenses Summary':'summary','Day Plan v2':'weekday','Weekend Plan':'weekend'};
const STACK_COLS={name:1,dose:2,route:3,sched:4,notes:7,price:8,units:9,perweek:10,inb:13,src:14};
const EXP_COLS={name:1,prov:2,freq:3,day:4,method:5,notes:6,per:7,inb:10};
const PLAN_COLS={time:1,item:2,type:3,dose:4,route:5,sched:6,notes:7,caution:8};
const XTRA_COLS={day:1,item:2,type:3,dose:4,route:5,sched:6,notes:7,caution:8};
function planOf(pre){return D[(pre==='wd'||pre==='wx')?'weekday':'weekend']}
function baseOf(key){const [a,b]=key.split(':');const row=+b;
  if(a==='st')return D.stack.find(s=>s.row===row);
  if(a==='xp')return D.expenses.find(e=>e.row===row);
  if(a==='wd'||a==='we'){for(const bl of planOf(a).blocks)for(const i of bl.items)if(i.row===row)return i;return null}
  if(a==='wx'||a==='ex'){for(const rows of Object.values(planOf(a).extra))for(const r of rows)if(r.row===row)return {row,item:r.cells[1],day:r.cells[0]};return null}
  return null}
function identityOf(key){const b=baseOf(key);if(!b)return null;return String(b.name||b.item||'')}
function cellVal(k,v,cols){
  if(v===undefined)return undefined;if(v===null||v==='')return null;
  if(k==='inb')return v?'Yes':'No';
  if(k==='time'){const t=parseT(v);return t===null?String(v):(t%1440)/1440}
  if(['price','units','perweek','per'].includes(k)&&isFinite(+v)&&String(v).trim()!=='')return +v;
  return typeof v==='number'?v:String(v)}
function colVals(COLS,src,all){const o={};for(const [k,c] of Object.entries(COLS)){if(!all&&!(k in src))continue;const v=cellVal(k,src[k]);o[c]=v===undefined?null:v}return o}
function relocatePatches(){
  let changed=false;const np={};
  for(const [key,p] of Object.entries(EDITS.p)){
    const [a,b]=key.split(':');
    if(a==='inc'||b==='n'||!p._was){np[key]=p;continue}
    const cur=identityOf(key);
    if(cur!==null&&norm(cur)===norm(p._was)){np[key]=p;continue}
    // the row moved in Excel: find it again by name
    let cand=[];
    if(a==='st')cand=D.stack.filter(s=>norm(s.name)===norm(p._was)).map(s=>s.row);
    else if(a==='xp')cand=D.expenses.filter(e=>norm(e.name)===norm(p._was)).map(e=>e.row);
    else if(a==='wd'||a==='we')planOf(a).blocks.forEach(bl=>bl.items.forEach(i=>{if(norm(i.item)===norm(p._was))cand.push(i.row)}));
    else Object.values(planOf(a).extra).forEach(rows=>rows.forEach(r=>{if(norm(r.cells[1])===norm(p._was))cand.push(r.row)}));
    changed=true;
    if(cand.length){cand.sort((x,y)=>Math.abs(x-+b)-Math.abs(y-+b));np[a+':'+cand[0]]=p}
    else np[key]={...p,_lost:true};
  }
  if(changed){EDITS.p=np;saveEdits()}
}
function sectionSpan(catRows,total,cat){const hr=catRows[cat];if(!hr)return null;const end=Math.min(...Object.values(catRows).filter(r=>r>hr).concat([total||1e9]));return [hr,end]}
function buildOps(){
  const sets=[],structs=[],used={};
  const del=(id,sheet,row,exp)=>structs.push({id,sheet,op:'delete',row,expect:exp});
  function placeSection(id,sheet,COLS,full,isStack){
    const g=GR[sheet];const span=sectionSpan(isStack?D.stackCatRows:D.expCatRows,isStack?D.stackTotalRow:D.expTotalRow,full.cat);
    if(!span)throw new Error('Unknown category '+full.cat);
    const [hr,end]=span;const fcol=isStack?11:8;
    const vals=colVals(COLS,full,true);if(isStack){vals[5]=null;vals[6]=null}
    for(let r=hr+1;r<end;r++){const a=gc(g,r,1);if((a===null||a==='')&&gc(g,r,fcol)!==null&&!used[sheet+r]){used[sheet+r]=1;sets.push({id,sheet,op:'set',row:r,values:vals,expect:{1:''}});return}}
    let copy=end-1;while(copy>hr&&gc(g,copy,fcol)===null)copy--;if(copy<=hr)copy=hr+1;
    structs.push({id,sheet,op:'insert',at:end,copy,values:vals,expect:{1:String(gc(g,copy,1)??'')}});
  }
  function placePlan(id,pre,full){
    const sheet=SHEET_OF[pre];const P=planOf(pre);const ctx=full._ctx||{};const bl=P.blocks.find(x=>x.row===ctx.block);
    if(!bl)throw new Error('That block no longer exists');
    const m=bl.title.match(/(\d{2}):(\d{2})/);const s=m?+m[1]*60+ +m[2]:0;const tt=x=>{let t=parseT(x);if(t!==null&&t<s-60)t+=1440;return t};
    const nt=tt(full.time);const its=bl.items.slice().sort((x,y)=>x.row-y.row);
    const vals=colVals(PLAN_COLS,full,true);vals[9]=null;
    if(!its.length){structs.push({id,sheet,op:'insert',at:bl.row+1,copy:bl.row,values:vals,expect:{1:String(gc(GR[sheet],bl.row,1)??'')}});return}
    let prev=null;for(const i of its){const t=tt(i.time);if(t!==null&&nt!==null&&t<=nt)prev=i}
    if(prev)structs.push({id,sheet,op:'insert',at:prev.row+1,copy:prev.row,values:vals,expect:{2:String(prev.item??'')}});
    else structs.push({id,sheet,op:'insert',at:its[0].row,copy:its[0].row,values:vals,expect:{2:String(its[0].item??'')}});
  }
  function placeExtra(id,pre,full){
    const sheet=SHEET_OF[pre];const P=planOf(pre);const sec=(full._ctx&&full._ctx.sec)||full.sec;const rows=P.extra[sec]||[];const hr=P.extraRows[sec];
    if(!hr)throw new Error('That section no longer exists');
    const last=rows.length?Math.max(...rows.map(r=>r.row)):hr;
    const vals=colVals(XTRA_COLS,full,true);vals[9]=null;
    structs.push({id,sheet,op:'insert',at:last+1,copy:last,values:vals,expect:{[rows.length?2:1]:String(gc(GR[sheet],last,rows.length?2:1)??'')}});
  }
  for(const [key,p] of Object.entries(EDITS.p)){
    if(p._lost||p._err)continue;
    const [a,b]=key.split(':');const isNew=b==='n';const sheet=SHEET_OF[a];
    try{
      if(a==='inc'){if(p.hours!=null)sets.push({id:key,sheet,op:'set',row:D.incRows.hours,values:{2:+p.hours}});if(p.take!=null)sets.push({id:key,sheet,op:'set',row:D.incRows.take,values:{2:+p.take}});continue}
      const base=isNew?null:baseOf(key);if(!isNew&&!base)continue;
      const idc=(a==='st'||a==='xp')?1:2;const exp={[idc]:p._was||identityOf(key)||''};
      const full={...(base||{}),...p};
      if(p._del){del(key,sheet,+b,exp);continue}
      if(a==='st'||a==='xp'){
        const COLS=a==='st'?STACK_COLS:EXP_COLS;
        if(isNew){placeSection(key,sheet,COLS,full,a==='st');continue}
        if(p.cat&&p.cat!==base.cat){del(key+'#mv',sheet,+b,exp);placeSection(key,sheet,COLS,full,a==='st');continue}
        const v=colVals(COLS,p,false);if(Object.keys(v).length)sets.push({id:key,sheet,op:'set',row:+b,values:v,expect:exp});continue}
      if(a==='wd'||a==='we'){
        if(isNew){placePlan(key,a,full);continue}
        const v=colVals(PLAN_COLS,p,false);if(Object.keys(v).length)sets.push({id:key,sheet,op:'set',row:+b,values:v,expect:exp});continue}
      if(a==='wx'||a==='ex'){
        if(isNew){placeExtra(key,a,full);continue}
        const v=colVals(XTRA_COLS,p,false);if(Object.keys(v).length)sets.push({id:key,sheet,op:'set',row:+b,values:v,expect:exp});continue}
    }catch(err){EDITS.p[key]={...p,_err:String(err.message||err)}}
  }
  const pos=o=>o.op==='delete'?o.row:o.at-0.5;
  structs.sort((x,y)=>pos(y)-pos(x));
  return sets.concat(structs);
}

/* --- grids in, grids out --- */
function setGrids(grids,meta){
  GR={...GR,...grids};GMETA={...GMETA,...meta};D=parseGrids(GR);
  relocatePatches();rebuild();renderPend();schedulePublishOps();
}
async function loadGridsFromDb(force){
  const meta=await load('sheet/meta');if(!meta||!meta.at)return false;if(!force&&GMETA.at&&meta.at<=GMETA.at)return false;
  const g={};for(const [sheet,slug] of Object.entries(SHEET_DOC)){const d=await load('sheet/s-'+slug);if(d&&d.rows)g[sheet]=d.rows}
  if(Object.keys(g).length<5)return false;
  setGrids(g,{at:meta.at,mtime:meta.mtime,src:'excel'});return true;
}

/* --- hand-off to the laptop agent ---
   Any device turns the queued edits into concrete Excel row operations and stores them in sync/ops.
   The Windows agent applies them through Excel, deletes the edits it applied, uploads fresh sheets
   and writes a heartbeat to agent/status. */
function resArr(x){return Array.isArray(x)?x:(x&&typeof x==='object'?(('id' in x||'ok' in x)?[x]:Object.values(x)):[])}
let XLSTATE='off',XLMSG='',AGENT=null,SYNCRES=null,pubT=null,lastOpsJson='';
function setXL(s,msg){XLSTATE=s;XLMSG=msg||'';renderPend()}
function schedulePublishOps(){clearTimeout(pubT);pubT=setTimeout(publishOps,900)}
function publishOps(){
  if(!GMETA.at)return; // no sheet data yet
  const live=Object.fromEntries(Object.entries(EDITS.p).map(([k,p])=>{const q={...p};delete q._err;return [k,q]}));
  const keep=EDITS.p;EDITS.p=live;let ops=[];try{ops=buildOps()}finally{EDITS.p=keep}
  const j=JSON.stringify(ops);if(j===lastOpsJson)return;lastOpsJson=j;
  save('sync/ops',{at:new Date().toISOString(),gridAt:GMETA.at,ops},true);
}
function agentState(){
  if(!AGENT||!AGENT.at)return setXL('off');
  const age=(Date.now()-new Date(AGENT.at))/1000;
  if(age>150)return setXL('off',`Laptop is off (last seen ${ago(AGENT.at)}). The app is your main copy and everything still syncs between devices; Excel catches up automatically next time the laptop is on.`);
  if(AGENT.ok===false)return setXL('err',AGENT.msg||'The laptop agent reported a problem.');
  const errs=SYNCRES&&SYNCRES.results?resArr(SYNCRES.results).filter(r=>!r.ok&&EDITS.p[String(r.id).split('#')[0]]):[];
  if(errs.length){errs.forEach(r=>{const k=String(r.id).split('#')[0];if(EDITS.p[k])EDITS.p[k]._err=r.error||'failed'});return setXL('err',`${errs.length} edit${errs.length>1?'s':''} couldn't be written. Open the queue to see why.`)}
  setXL('live');
}
async function startAgentLink(){
  AGENT=await load('agent/status');SYNCRES=await load('sync/result');agentState();
  watch('agent/status',d=>{AGENT=d;agentState()});
  watch('sync/result',d=>{SYNCRES=d;agentState();if(d&&d.results&&resArr(d.results).some(r=>r&&r.ok))flash('excel_synced')});
  watch('sheet/meta',m=>{if(m&&m.at&&(!GMETA.at||m.at>GMETA.at))loadGridsFromDb()});
  watchPrefix('edits/',(evt,path,data)=>{const k=path.slice(6);if(evt==='DELETE'){if(k in EDITS.p){delete EDITS.p[k];delete EDITS_SAVED[k];LS.set('edits:all',EDITS.p);rebuild();renderPend()}}else{EDITS.p[k]=data;EDITS_SAVED[k]=clone(data);rebuild();renderPend()}});
  setInterval(agentState,30000);
}

/* ================= ROUTER ================= */
const VIEWS=[['today','Today','<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>'],['week','Week','<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/>'],['streaks','Streaks','<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>'],['gym','Gym','<path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11"/>'],['food','Food','<path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06zM10 2c1 .5 2 2 2 5"/>'],['sleep','Sleep','<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>'],['journal','Journal','<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>'],['alter','Alter','<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>'],['tools','Tools','<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>'],['media','Media','<rect x="2" y="4" width="20" height="16" rx="3"/><path d="m10 9 5 3-5 3z"/>'],['stack','Stack','<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>'],['money','Money','<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>']];
const NVI=p=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
$('tabs').innerHTML=VIEWS.map(([v,l,ic],i)=>`<button type="button" data-v="${v}" title="${l} (${i+1})">${NVI(ic)}<span>${l}</span></button>`).join('');
$('bnav').innerHTML=VIEWS.map(([v,l,ic])=>`<button type="button" data-v="${v}"><i>${NVI(ic)}</i><span>${l}</span></button>`).join('')+'<span class="bnind" id="bnind"></span>';
let cur=null,goTok=0;
function go(v,fromHash,dirHint){if(typeof inkExitFull==="function")inkExitFull();
  if(!VIEWS.some(x=>x[0]===v))v='today';if(v===cur)return;
  const oi=VIEWS.findIndex(x=>x[0]===cur),ni=VIEWS.findIndex(x=>x[0]===v);const dir=dirHint||(oi<0?0:ni>oi?1:-1);cur=v;
  VIEWS.forEach(([x])=>$('v-'+x).classList.toggle('on',x===v));
  document.querySelectorAll('#tabs button,#bnav button').forEach(b=>b.setAttribute('aria-current',b.dataset.v===v?'page':'false'));
  const nb=document.querySelector(`#bnav button[data-v="${v}"]`);if(nb){$('bnind').style.transform=`translateX(${nb.offsetLeft}px)`;$('bnind').style.width=nb.offsetWidth+'px';bnavFit()}
  if(!fromHash&&location.hash!=='#'+v)history.replaceState(null,'','#'+v);
  const view=$('v-'+v);
  const m=$('main');
  if(FX&&m.animate){m.animate([{transform:`translateX(${dir*48}px)`,opacity:.1,filter:'hue-rotate(80deg) contrast(1.6)'},{transform:`translateX(${-dir*6}px)`,opacity:1,filter:'none',offset:.7},{transform:'none',opacity:1}],{duration:380,easing:'cubic-bezier(.2,.9,.1,1)'});m.classList.remove('switching');void m.offsetWidth;m.classList.add('switching')}
  const h=view.querySelector('.banner h2.glitch');if(h&&FX){const node=h.lastChild;scramble({set textContent(t){node.textContent=t}},h.dataset.text,500)}
  const eb=view.querySelector('.bover .eyebrow');if(eb)eb.textContent=new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});
  artMount(v);
  if(v!=='alter'){aLeave();if(typeof aQuiet==='function')aQuiet()}
  if(v==='money'||v==='stack')document.querySelectorAll(`#v-${v} [data-scr]`).forEach(el=>scramble(el,el.dataset.scr,700));
  window.scrollTo(0,0);setTimeout(repaint,420);
  const LOADERS={today:()=>{if(typeof renderTodayTasks==='function')renderTodayTasks();if(typeof renderTodayCal==='function')renderTodayCal()},week:()=>renderWeek(),gym:()=>loadGym(),tools:()=>renderTools(),media:()=>renderMedia(),food:()=>loadFood(),sleep:()=>loadSleep(),journal:()=>setJTab(JTAB),streaks:()=>loadHabits(),alter:()=>loadAlter()};
  /* a thin progress bar while the page fetches, and the stagger runs once the real content is in (not on stale/empty markup) */
  const tk=++goTok;let p;try{p=LOADERS[v]&&LOADERS[v]()}catch(e){console.error(e)}
  if(p&&typeof p.then==='function'){const sl=setTimeout(()=>{if(goTok===tk)view.classList.add('loading')},120);
    p.catch(e=>{console.error(e);if(goTok===tk&&LOADERS[v])return new Promise(r=>setTimeout(r,800)).then(()=>LOADERS[v]())}).catch(e=>console.error(e))
     .finally(()=>{clearTimeout(sl);view.classList.remove('loading');if(goTok===tk&&cur===v)staggerIn(view)})}
  else requestAnimationFrame(()=>{if(goTok===tk)staggerIn(view)});
}
$('tabs').onclick=e=>{const b=e.target.closest('button');if(b)go(b.dataset.v)};
/* the tab bar always spans the screen: every tab gets an equal share; labels drop when there isn't room */
function bnavFit(){const b=$('bnav');if(!b||!b.offsetWidth)return;b.classList.toggle('compact',b.offsetWidth/VIEWS.length<60)}addEventListener('resize',bnavFit);setTimeout(bnavFit,0);
$('bnav').onclick=e=>{const b=e.target.closest('button');if(b){go(b.dataset.v);try{navigator.vibrate&&navigator.vibrate(8)}catch(_){}}};
addEventListener('hashchange',()=>go(location.hash.slice(1),true));
/* section changes only from the nav buttons (no swipe) */
function renderAllViews(){renderToday();renderStack();renderMoney();renderTargets();renderTools()}

applyLex();

/* ================= PALETTE + KEYS ================= */
let palItems=[],palSel=0;
function palIndex(){
  const a=VIEWS.map(([v,l])=>({l,s:'view',run:()=>go(v)}));
  a.push({l:'edit mode',s:EDIT?'on':'off',run:()=>setEdit(!EDIT)},{l:'add '+LW('item','item'),s:'stack',run:()=>{go('stack');addStack()}},{l:'add bill',s:'money',run:()=>{go('money');addExp()}},{l:'log blood pressure',s:'body',run:()=>{go('today');setTimeout(()=>{$('bodyCheck').scrollIntoView({behavior:'smooth',block:'center'});$('bpS').focus()},300)}},{l:'log weight',s:'body',run:()=>{go('today');setTimeout(()=>{$('bodyCheck').scrollIntoView({behavior:'smooth',block:'center'});$('wtIn').focus()},300)}},{l:'start focus timer',s:'tools',run:()=>{TOOLV='focus';go('tools');renderTools();setTimeout(()=>{if(!TM.end&&$('tmGo'))$('tmGo').click()},200)}},{l:'write in journal',s:'journal',run:()=>{go('journal')}},{l:'start workout',s:'gym',run:()=>{go('gym');if(!ACTIVE)startWorkout(null)}},{l:'boot video',s:'settings',run:openBootVideo},{l:'focus timer',s:'tools',run:()=>{TOOLV='focus';go('tools');renderTools()}},{l:'log a dose',s:'protocols',run:()=>{TOOLV='protocols';go('tools');renderTools()}},{l:'log a leetcode problem',s:'leetcode',run:()=>{TOOLV='leetcode';go('tools');renderTools();setTimeout(()=>pickProblem(s=>openProblem(s,true)),300)}},{l:'sign out',s:'account',run:signOut});
  visibleItems().forEach(i=>a.push({l:i.item,s:(i.time||'')+' · today',run:()=>{go('today');const el=document.querySelector(`#v-today [data-k="${CSS.escape(i.tk)}"]`);if(el){el.closest('.blk').classList.add('open');el.scrollIntoView({block:'center',behavior:FX?'smooth':'auto'});el.focus();FX&&el.animate([{background:'rgba(255,42,109,.4)'},{background:'transparent'}],{duration:1200})}}}));
  M.stack.forEach(s=>a.push({l:s.name,s:'stack · '+STATUSL[s.status],run:()=>{go('stack');openDrawer(s.key)}}));
  M.expenses.forEach(e=>a.push({l:e.name,s:'money · '+(e.m?gbp(e.m,2):'—'),run:()=>{go('money');billCat=e.cat;renderMoney()}}));
  return a;
}
function openPal(){$('pal').classList.add('on');$('palIn').value='';palSel=0;drawPal();$('palIn').focus()}
function closePal(){$('pal').classList.remove('on')}
function drawPal(){const q=norm($('palIn').value);const all=palIndex();palItems=(q?all.filter(x=>norm(x.l).includes(q)||norm(x.s).includes(q)):all.slice(0,14)).slice(0,40);palSel=Math.min(palSel,Math.max(0,palItems.length-1));
  $('palList').innerHTML=palItems.map((x,i)=>`<li class="${i===palSel?'sel':''}" data-i="${i}"><span>${esc(x.l)}</span><span class="dim">${esc(x.s)}</span></li>`).join('')||'<li class="dim">Nothing found</li>'}
$('palIn').oninput=()=>{palSel=0;drawPal()};
$('palList').onclick=e=>{const li=e.target.closest('li[data-i]');if(li){closePal();palItems[+li.dataset.i].run()}};
$('pal').onclick=e=>{if(e.target===$('pal'))closePal()};
addEventListener('keydown',e=>{
  const _ae=document.activeElement||document.body;
  const typing=/INPUT|TEXTAREA|SELECT/.test(_ae.tagName)||_ae.isContentEditable===true;
  if($('pal').classList.contains('on')){if(e.key==='Escape')closePal();else if(e.key==='ArrowDown'){palSel=Math.min(palSel+1,palItems.length-1);drawPal();e.preventDefault()}else if(e.key==='ArrowUp'){palSel=Math.max(palSel-1,0);drawPal();e.preventDefault()}else if(e.key==='Enter'&&palItems[palSel]){closePal();palItems[palSel].run()}return}
  if($('modal').classList.contains('on')){if(e.key==='Escape')closeModal();return}
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openPal();return}
  if(e.key==='Escape'){closeDrawer();closeSheet();if(typing)document.activeElement.blur();return}
  if(typing||e.metaKey||e.ctrlKey||e.altKey)return;
  if(/^[1-8]$/.test(e.key)){go(VIEWS[+e.key-1][0]);return}
  if(e.key==='/'){e.preventDefault();openPal();return}
  if(e.key==='f'){$('fxBtn').click();return}
  if(e.key==='e'){setEdit(!EDIT);return}
  if(cur!=='today')return;
  if(e.key==='n'){const c=document.querySelector('#blocks .blk.cur')||document.querySelector('#blocks .blk');if(c){openBlock(+c.dataset.b,true);const ni=c.querySelector('.it.nowit')||c.querySelector('.it[aria-checked="false"]');ni&&ni.focus({preventScroll:true})}return}
  if(e.key==='j'||e.key==='k'){const its=[...document.querySelectorAll('#v-today .blk.open .it')].filter(x=>x.offsetParent);if(!its.length)return;let i=its.indexOf(document.activeElement);i=e.key==='j'?Math.min(i+1,its.length-1):Math.max(i-1,0);its[i].focus();its[i].scrollIntoView({block:'nearest'});e.preventDefault();return}
  if(e.key==='x'&&document.activeElement.classList.contains('it')){toggle(document.activeElement);return}
});

document.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('#promptBtn'))openPal()});

/* ================= BOOT: sign in, then load ================= */
let booted=false,loginBusy=false;
const BFX=(m,p,ok)=>{try{window.BOOTFX&&BOOTFX.step(m,p,ok)}catch(e){}};const BFXdone=m=>{try{window.BOOTFX&&BOOTFX.done(m)}catch(e){}};
function showLogin(msg){BFXdone('auth required · awaiting operator');$('login').hidden=false;document.body.classList.add('locked');$('loginMsg').textContent=msg||'';setTimeout(()=>{const e=$('lEmail');if(e&&!e.value)e.focus()},50)}
function hideLogin(){$('login').hidden=true;document.body.classList.remove('locked')}
$('loginForm').onsubmit=async e=>{e.preventDefault();if(loginBusy)return;loginBusy=true;$('loginMsg').textContent='signing in…';
  try{const {data,error}=await SB.auth.signInWithPassword({email:$('lEmail').value.trim(),password:$('lPass').value});if(error)throw error;$('lPass').value='';await startApp(data.session)}
  catch(err){$('loginMsg').textContent=(err&&err.message)||'Sign-in failed.';const f=$('loginBox');f.animate&&f.animate([{transform:'translateX(-8px)'},{transform:'translateX(8px)'},{transform:'none'}],{duration:260})}
  finally{loginBusy=false}};
async function boot(){
  if(location.hash.startsWith('#wake')){setTimeout(()=>sWakeMode(),50)}
  /* let the boot video get its first frames out before the app does its heavy start-up work */
  if(window.BOOTFX&&BOOTFX.ready)await Promise.race([BOOTFX.ready,new Promise(r=>setTimeout(r,2000))]);
  const cfg=window.APP_CONFIG||{};
  if(!cfg.supabaseUrl||!window.supabase){showLogin('This copy of the app isn\'t connected to its database yet.');return}
  SB=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,storageKey:'ds-auth'}});
  SB.auth.onAuthStateChange((ev)=>{if(ev==='SIGNED_OUT'){R=null;UID=null;showLogin()}});
  BFX('supabase client up',22);
  let session=null;try{session=(await SB.auth.getSession()).data.session}catch(e){}
  if(session)BFX('session '+String(session.user.id).slice(0,8)+' verified',36);
  if(!session){showLogin();return}
  await startApp(session);
}
async function startApp(session){
  UID=session.user.id;R=true;hideLogin();setSync('busy','loading');
  /* keep the animated boot frame on this device, so the boot never depends on a video
     element being allowed to play */
  (async()=>{try{const c=await caches.open('ds-media');
    if(await c.match('bootanim'))return;
    const {data}=await SB.storage.from('vault').createSignedUrl(UID+'/boot/anim.webp',600);
    if(!data||!data.signedUrl)return;
    const r=await fetch(data.signedUrl);if(!r.ok)return;
    await c.put('bootanim',new Response(await r.blob(),{headers:{'content-type':'image/webp'}}))
  }catch(e){}})();
  /* what the boot sequence actually did on this device, so it can be read back from
     any other one — guessing at an iPad's behaviour from a laptop does not work */
  try{const d=localStorage.getItem('ds3:bootdiag');
    if(d){localStorage.removeItem('ds3:bootdiag');
      save('diag/boot',{at:new Date().toISOString(),d:JSON.parse(d)},true)}}catch(e){}
  /* private word list: refresh it, and reload once if it changed so every label uses it */
  try{const lx=await load('sys/lex');if(lx&&JSON.stringify(lx)!==JSON.stringify(LEX)){LEX=lx;applyLex();
      if(!sessionStorage.getItem('ds-lex-'+JSON.stringify(lx).length)){sessionStorage.setItem('ds-lex-'+JSON.stringify(lx).length,1);safeReload()}}}catch(e){}
  await loadEdits();BFX('edit queue synced',48);
  const ok=await loadGridsFromDb(true);BFX(ok?'sheets pulled · stack/money/plan':'sheets: using local cache',ok?66:66,ok?undefined:false);
  $('nodata').hidden=ok||!!GMETA.at;
  try{const [tt,np,ni]=await Promise.all([load('today/titles'),load('today/nopct'),load('push/items')]);TITLES=tt||{};NOPCT=np?{m:{},...np}:{m:{}};if(ni)NITEMS={m:{},...ni}}catch(e){}
  rebuild();booted=true;if(typeof loadProto==='function')loadProto().catch(()=>{});await Promise.all([loadStackStatus(),loadActuals()]);renderPend();renderStack();renderMoney();renderTargets();
  cur=null;go(location.hash.slice(1)||'today',true);
  BFX('ui compiled · '+(cur||'today'),78);
  await loadDay();await loadTools();loadBody();BFX('day state + tools restored',90);
  startRealtime();startAgentLink();loadArtImages();flushOutbox();
  setSync(ONLINE?'on':'',ONLINE?'synced':'offline');BFX('realtime channel open',96);BFXdone('system ready');setTimeout(cacheBootVideo,600);
  schedWidget();setInterval(()=>{if(!document.hidden)publishWidget()},10*60*1000);setTimeout(()=>{Promise.all([loadHabits(),loadTasks()]).catch(()=>{}).then(()=>{if(typeof pushSync==='function')pushSync()})},4000);document.addEventListener('visibilitychange',()=>{if(!document.hidden&&typeof pushSync==='function'){NQ=null;pushSync()}});
}
function flushOutbox(){try{const ks=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('ds3:outbox:'))ks.push(k.slice(11))}ks.forEach(p=>{const v=LS.get(p);if(v!=null)save(p,v,true);localStorage.removeItem('ds3:outbox:'+p)})}catch(e){}}
let resumeAt=0;
async function refreshAfterResume(){if(!booted)return;/* realtime keeps an open app current; only re-pull after a real break */if(Date.now()-resumeAt<30e3)return;resumeAt=Date.now();await loadGridsFromDb();await loadEdits();rebuild();const p='days/d-'+DAYK;const d=await load(p);if(d){DAY={ticks:{},water:0,msg:{},dw:0,...d};applyTicks();renderTools()}AGENT=await load('agent/status');agentState();if(cur==='gym')loadGym(true);if(cur==='journal')loadJournal()}
async function signOut(){try{await SB.auth.signOut()}catch(e){}try{Object.keys(localStorage).filter(k=>k.startsWith('ds3:')).forEach(k=>localStorage.removeItem(k))}catch(e){}location.reload()}

/* widget feed: a small summary the iPhone/iPad widgets read */
let widgetT=null;function schedWidget(){clearTimeout(widgetT);widgetT=setTimeout(publishWidget,1500)}
let widgetLast='';
function publishWidget(){if(!R||!booted||!M.plans)return;
  const vis=visibleItems().filter(i=>i.t!==null).sort((a,b)=>a.t-b.t);
  const done=countedItems().filter(i=>DAY.ticks[i.tk]).length,total=countedItems().length;
  const w={at:new Date().toISOString(),date:DAYK,plan:planKind,pct:total?Math.round(done/total*100):0,done,total,
    items:vis.map(i=>({t:fmtM(i.t),n:i.item,d:!!DAY.ticks[i.tk],c:!!i.cmp})),water:DAY.water||0,waterTarget:(SET&&SET.water)||8,dw:DAY.dw||0,lc:typeof leetWeek==='function'?leetWeek():0,
    habits:habLoaded?hAll().filter(h=>hDue(h,DAYK)).slice(0,12).map(h=>({l:h.n,d:hDone(h,DAYK)})):[]};
  /* doses: today's plan items that match an active Stack entry; budget categories for the money widget */
  const kn=x=>norm(x).replace(/[^a-z0-9]/g,''),SN=(M.stack||[]).filter(x=>x.status!=='paused'&&x.status!=='notinplan'&&kn(x.name).length>=3).map(x=>({k:kn(x.name),dose:x.dose||''}));
  w.doses=vis.map(i=>{const k=kn(i.item),m=SN.find(x=>k.includes(x.k)||(k.length>=4&&x.k.includes(k)));return m?{t:fmtM(i.t),n:i.item,d:!!DAY.ticks[i.tk],dose:String(m.dose||'')}:null}).filter(Boolean);
  w.cats=Object.fromEntries(Object.entries(M.cats||{}).filter(([c])=>c!=='Investment & Savings'&&c!=='Stack'));
  w.money={take:+(M.inc&&M.inc.take)||0,out:+M.out||0,left:+M.left||0,spend:+M.spend||0,save:+M.save||0,cats:M.cats||{}};
  /* only write when something on it changed (stamp the time at most hourly, so the widget can tell it's fresh) */
  if(habLoaded)try{hWidget()}catch(e){}
  const sig=JSON.stringify({...w,at:0}),fresh=Date.now()-(+new Date(widgetAt||0))<36e5;if(sig===widgetLast&&fresh)return;widgetLast=sig;widgetAt=w.at;save('widget/today',w,true)}
let widgetAt=null;

/* installable app: offline cache */
if('serviceWorker' in navigator&&location.protocol==='https:'){
  const hadCtl=!!navigator.serviceWorker.controller;let reloaded=false;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(hadCtl&&!reloaded){reloaded=true;safeReload()}});
  addEventListener('load',()=>navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).then(r=>{
    const chk=()=>{r.update().catch(()=>{});checkVersion()};document.addEventListener('visibilitychange',()=>{if(!document.hidden)chk()});setInterval(chk,10*60*1000)}).catch(()=>{}));
}
// belt and braces: if the server has a newer build than the one running, reload once
async function checkVersion(){try{const t=await (await fetch('index.html?_='+Date.now(),{cache:'no-store'})).text();const m=t.match(/APP_V="(\d+)"/);
  if(m&&window.APP_V&&m[1]!==window.APP_V&&!sessionStorage.getItem('ds-reloaded-'+m[1])){sessionStorage.setItem('ds-reloaded-'+m[1],'1');if(window.caches){const ks=await caches.keys();await Promise.all(ks.filter(k=>k!=='ds-media').map(k=>caches.delete(k)))}safeReload()}}catch(e){}}
/* never reload under the boot edit: wait until it's finished, then reload with a quick boot (no second play) */
function safeReload(){if(document.getElementById('bootfx')){setTimeout(safeReload,700);return}try{sessionStorage.setItem('ds-quickboot','1')}catch(e){}location.reload()}
if(location.protocol==='https:')setTimeout(checkVersion,1500);
boot();

/* own boot video: lives in private storage (vault/<uid>/boot.mp4); each device keeps a copy in its own cache */
async function cacheBootVideo(){try{if(!window.caches||!SB||!UID)return;
  const {data:list,error:le}=await SB.storage.from('vault').list(UID,{search:'boot.mp4'});if(le||!Array.isArray(list))return; /* a failed check must never wipe the saved edit */
  const f=list.find(x=>x.name==='boot.mp4');const c=await caches.open('ds-media');
  if(!f){if(list.length===0&&LS.get('bootvidRemoved'))await c.delete('bootvid');return}
  const stamp=f.updated_at||f.created_at||String(f.metadata&&f.metadata.size);if(LS.get('bootvidStamp')===stamp&&await c.match('bootvid'))return;
  const {data:blob,error}=await SB.storage.from('vault').download(UID+'/boot.mp4');if(error||!blob)return;
  await c.put('bootvid',new Response(blob,{headers:{'Content-Type':'video/mp4'}}));LS.set('bootvidStamp',stamp);bvStatus()}catch(e){console.warn('boot video',e)}}

/* boot video controls (search menu → "boot video") */
async function bvStatus(){const el=$('bvStat');if(!el)return;try{const c=window.caches?await caches.open('ds-media'):null;const r=c?await c.match('bootvid'):null;
  if(r){const b=await r.blob();el.textContent=`on this device · ${(b.size/1048576).toFixed(1)} MB`}else el.textContent='not on this device yet'}catch(e){el.textContent=''}}
function openBootVideo(){openSheet('boot video',`<p class="dim" style="margin:0 0 10px;font-size:12px">Plays full screen when the app opens. Stored privately in your account; each device keeps its own copy.</p><div class="dim" id="bvStat" style="margin-bottom:10px"></div>
  <div class="bigbtns"><label class="btn p" style="cursor:pointer">Upload new<input type="file" id="bvFile" accept="video/mp4,video/*" hidden></label><button class="btn" type="button" id="bvRefresh">Re-download here</button><button class="btn" type="button" id="bvDel">Remove</button></div>`);bvStatus();
  $('bvFile').onchange=async e=>{const f=e.target.files&&e.target.files[0];e.target.value='';if(!f||!SB||!UID)return;
    if(f.size>50*1048576){$('bvStat').textContent='over 50 MB: trim it first';return}
    $('bvStat').textContent='uploading…';const {error}=await SB.storage.from('vault').upload(UID+'/boot.mp4',f,{upsert:true,contentType:f.type||'video/mp4'});
    if(error){$('bvStat').textContent='upload failed: '+error.message;return}LS.set('bootvidStamp',null);LS.set('bootvidRemoved',null);$('bvStat').textContent='uploaded · saving here…';await cacheBootVideo();flash('boot_video_set')};
  $('bvRefresh').onclick=async()=>{LS.set('bootvidStamp',null);$('bvStat').textContent='downloading…';await cacheBootVideo();bvStatus()};
  $('bvDel').onclick=async()=>{if(!SB||!UID)return;await SB.storage.from('vault').remove([UID+'/boot.mp4']);LS.set('bootvidRemoved',1);if(window.caches){const c=await caches.open('ds-media');await c.delete('bootvid')}LS.set('bootvidStamp',null);bvStatus()}}

/* no pinch / double-tap zoom, like a real app */
document.addEventListener('gesturestart',e=>e.preventDefault());document.addEventListener('touchmove',e=>{if(e.touches.length>1)e.preventDefault()},{passive:false});

/* a desktop opens straight into full screen. browsers only grant that from a gesture, so it
   rides on the very first click or key press — the tap that wakes the boot is enough. */
(function(){const touch=navigator.maxTouchPoints>1;if(touch||innerWidth<901||!document.documentElement.requestFullscreen)return;
  const go=()=>{off();if(!document.fullscreenElement)document.documentElement.requestFullscreen({navigationUI:'hide'}).catch(()=>{})};
  const off=()=>{removeEventListener('pointerdown',go,true);removeEventListener('keydown',go,true)};
  addEventListener('pointerdown',go,true);addEventListener('keydown',go,true)})();

/* ================= MEDIA — anime · movies · manga · books (Letterboxd + MyAnimeList style) ================= */
const MK={anime:{label:'anime',verb:'watch',unit:'ep',units:'episodes',ing:'watching',stars:10,icon:'◐'},movies:{label:'movies',verb:'watch',unit:'',units:'',ing:'watching',stars:5,icon:'▶︎'},manga:{label:'manga',verb:'read',unit:'ch',units:'chapters',ing:'reading',stars:10,icon:'❏'},books:{label:'books',verb:'read',unit:'p',units:'pages',ing:'reading',stars:5,icon:'▤'}};
const MSTAT=k=>[['cur',MK[k].ing],['done','completed'],['plan','plan to '+MK[k].verb],['hold','on hold'],['drop','dropped']];
let MEDIA={anime:{items:{},lists:[]},movies:{items:{},lists:[]},manga:{items:{},lists:[]},books:{items:{},lists:[]}},MEDIAK=LS.get('mediak')||'anime',MEDIAV='library',MFILT={st:'all',sort:'recent',q:''},mediaLoaded=false;
async function loadMedia(){if(mediaLoaded)return;const r=await Promise.all(Object.keys(MK).map(k=>load('media/'+k)));Object.keys(MK).forEach((k,i)=>MEDIA[k]={items:{},lists:[],...(r[i]||{})});mediaLoaded=true}
Object.keys(MK).forEach(k=>watch('media/'+k,d=>{if(d){MEDIA[k]={items:{},lists:[],...d};if(cur==='media')renderMedia()}}));
function saveMedia(k){save('media/'+k,MEDIA[k])}
const mItems=k=>Object.values(MEDIA[k].items);
function stars(v,max){if(v==null||v==='')return '';if(max===10)return `<span class="mscore">${kgs(v)}</span>`;const f=Math.floor(v),h=v-f>=.5;return `<span class="mstars">${'★'.repeat(f)}${h?'½':''}</span>`}

/* ---- search adapters (each source has a timeout; falls through to the next on failure) ---- */
async function mfetch(u,o={},ms=8000){const c=new AbortController();const t=setTimeout(()=>c.abort(),ms);try{const r=await fetch(u,{...o,signal:c.signal});if(!r.ok)throw new Error(r.status===429?'rate limited':'HTTP '+r.status);return await r.json()}catch(e){throw new Error(e.name==='AbortError'?'timed out':e.message)}finally{clearTimeout(t)}}
const stripHtml=s=>(s||'').replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]+>/g,'').replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&#039;/g,"'").trim();
const MSRC={
  anilist:async(k,q)=>{const T=k==='anime'?'ANIME':'MANGA';
    const j=await mfetch('https://graphql.anilist.co',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({query:`query($q:String){Page(perPage:20){media(search:$q,type:${T},sort:SEARCH_MATCH){id idMal title{romaji english} coverImage{large} startDate{year} episodes chapters volumes format genres averageScore description(asHtml:false) duration siteUrl studios(isMain:true){nodes{name}} staff(perPage:2){nodes{name{full}}}}}}`,variables:{q}})});
    return ((j.data&&j.data.Page&&j.data.Page.media)||[]).map(x=>({key:x.idMal?'mal'+x.idMal:'al'+x.id,src:x.idMal?'mal':'anilist',id:x.idMal||x.id,title:x.title.english||x.title.romaji,alt:x.title.romaji,img:x.coverImage&&x.coverImage.large,year:x.startDate&&x.startDate.year,
      total:k==='anime'?x.episodes:x.chapters,vols:x.volumes,kind:(x.format||'').replace(/_/g,' ').toLowerCase(),genres:x.genres||[],score:x.averageScore?+(x.averageScore/10).toFixed(1):null,syn:stripHtml(x.description),
      by:k==='anime'?((x.studios&&x.studios.nodes)||[]).map(s=>s.name).join(', '):((x.staff&&x.staff.nodes)||[]).map(s=>s.name.full).join(', '),dur:k==='anime'?(x.duration||24):null,url:x.idMal?`https://myanimelist.net/${k}/${x.idMal}`:x.siteUrl}))},
  jikan:async(k,q)=>{const j=await mfetch(`https://api.jikan.moe/v4/${k}?q=${encodeURIComponent(q)}&limit=20&sfw=true`);
    return (j.data||[]).map(x=>({key:'mal'+x.mal_id,src:'mal',id:x.mal_id,title:x.title_english||x.title,alt:x.title,img:(x.images&&(x.images.webp||x.images.jpg)||{}).large_image_url,year:x.year||(x.aired&&x.aired.prop&&x.aired.prop.from&&x.aired.prop.from.year)||(x.published&&x.published.prop&&x.published.prop.from&&x.published.prop.from.year),
      total:k==='anime'?x.episodes:x.chapters,vols:x.volumes,kind:x.type,genres:(x.genres||[]).concat(x.themes||[]).map(g=>g.name),score:x.score,syn:x.synopsis,by:k==='anime'?(x.studios||[]).map(s=>s.name).join(', '):(x.authors||[]).map(s=>s.name).join(', '),dur:k==='anime'?(parseInt(x.duration)||24):null,url:x.url}))},
  kitsu:async(k,q)=>{const j=await mfetch(`https://kitsu.io/api/edge/${k}?filter[text]=${encodeURIComponent(q)}&page[limit]=20`);
    return (j.data||[]).map(d=>{const x=d.attributes;return {key:'kitsu'+d.id,src:'kitsu',id:d.id,title:(x.titles&&x.titles.en)||x.canonicalTitle,alt:x.canonicalTitle,img:x.posterImage&&(x.posterImage.medium||x.posterImage.original),year:x.startDate?+x.startDate.slice(0,4):null,
      total:k==='anime'?x.episodeCount:x.chapterCount,vols:x.volumeCount,kind:x.subtype,genres:[],score:x.averageRating?+(x.averageRating/10).toFixed(1):null,syn:x.synopsis,by:'',dur:k==='anime'?(x.episodeLength||24):null,url:`https://kitsu.io/${k}/${x.slug}`}})},
  cinemeta:async(k,q)=>{const u=t=>`https://v3-cinemeta.strem.io/catalog/${t}/top/search=${encodeURIComponent(q)}.json`;
    const [m,s]=await Promise.allSettled([mfetch(u('movie')),mfetch(u('series'))]);if(m.status==='rejected'&&s.status==='rejected')throw m.reason;
    const map=(r,kind)=>r.status==='fulfilled'?(r.value.metas||[]).map(x=>({key:'imdb'+x.imdb_id,src:'imdb',id:x.imdb_id,title:x.name,img:x.poster&&x.poster.replace('/small/','/medium/'),year:parseInt(x.releaseInfo)||null,kind,genres:[],url:'https://www.imdb.com/title/'+x.imdb_id+'/'})):[];
    const a=map(m,'film'),b=map(s,'series'),out=[];for(let i=0;i<Math.max(a.length,b.length);i++){if(a[i])out.push(a[i]);if(b[i]&&i<6)out.push(b[i])}return out},
  openlibrary:async(k,q)=>{const j=await mfetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=20&fields=key,title,author_name,first_publish_year,number_of_pages_median,cover_i,subject`,{},10000);
    return (j.docs||[]).map(x=>({key:'ol'+x.key.replace('/works/',''),src:'ol',id:x.key,title:x.title,img:x.cover_i?`https://covers.openlibrary.org/b/id/${x.cover_i}-L.jpg`:'',year:x.first_publish_year,total:x.number_of_pages_median,genres:(x.subject||[]).slice(0,5),by:(x.author_name||[]).join(', '),url:'https://openlibrary.org'+x.key}))},
  gbooks:async(k,q)=>{const j=await mfetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=20&printType=books`);
    return (j.items||[]).map(d=>{const x=d.volumeInfo||{};return {key:'gb'+d.id,src:'gbooks',id:d.id,title:x.title,img:x.imageLinks&&(x.imageLinks.thumbnail||'').replace('http:','https:'),year:x.publishedDate?+x.publishedDate.slice(0,4):null,total:x.pageCount,genres:x.categories||[],by:(x.authors||[]).join(', '),syn:x.description,url:x.infoLink}})}
};
const MCHAIN={anime:['anilist','jikan','kitsu'],manga:['anilist','jikan','kitsu'],movies:['cinemeta'],books:['openlibrary','gbooks']};
let MSEARCH_ERR='';
async function msearch(k,q){q=q.trim();if(!q)return [];const errs=[];
  let ok=false;for(const s of MCHAIN[k]){try{const r=await MSRC[s](k,q);if(r.length)return r;ok=true}catch(e){errs.push(s+': '+e.message)}}
  MSEARCH_ERR=errs.join(' · ');return ok?[]:null}
/* fill in details (genres, director, runtime, synopsis) for a film after it's picked */
async function menrich(k,it){if(k!=='movies'||it.src!=='imdb')return;try{const t=it.kind==='series'?'series':'movie';const j=await mfetch(`https://v3-cinemeta.strem.io/meta/${t}/${it.id}.json`);const m=j.meta||{};
  const cur=MEDIA[k].items[it.key];if(!cur)return;Object.assign(cur,{genres:m.genres||m.genre||cur.genres||[],by:[].concat(m.director||[]).join(', ')||(m.cast||[]).slice(0,3).join(', '),syn:m.description||cur.syn,dur:parseInt(m.runtime)||cur.dur,mal:m.imdbRating?+m.imdbRating:cur.mal});
  saveMedia(k)}catch(e){}}

/* ---- shell ---- */
async function renderMedia(){const el=$('v-media-body');if(!el)return;await loadMedia();
  $('mediaCards').querySelectorAll('button').forEach(b=>{b.setAttribute('aria-pressed',b.dataset.mk===MEDIAK);const n=mItems(b.dataset.mk);b.querySelector('span').textContent=`${n.filter(x=>x.st==='done').length} done · ${n.filter(x=>x.st==='cur').length} ${MK[b.dataset.mk].ing}`});
  const tabs=[['library','library'],['diary','diary'],['lists','lists'],['stats','stats']];
  el.innerHTML=`<div class="row" style="justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:10px"><div class="seg" id="mSeg">${tabs.map(([k,l])=>`<button type="button" data-mv="${k}" aria-pressed="${MEDIAV===k}">${l}</button>`).join('')}</div><button class="btn p" type="button" id="mAddBtn">+ Add ${MK[MEDIAK].label==='movies'?'film':MK[MEDIAK].label==='books'?'book':MEDIAK}</button></div><div id="mBody"></div>`;
  $('mSeg').onclick=e=>{const b=e.target.closest('[data-mv]');if(b){MEDIAV=b.dataset.mv;renderMedia()}};$('mAddBtn').onclick=()=>mAdd(MEDIAK);
  ({library:mLibrary,diary:mDiary,lists:mLists,stats:mStats})[MEDIAV](MEDIAK)}
function initMediaNav(){$('mediaCards').onclick=e=>{const b=e.target.closest('[data-mk]');if(!b)return;MEDIAK=b.dataset.mk;LS.set('mediak',MEDIAK);renderMedia();staggerIn($('v-media-body'))}}

function poster(it,cls='mposter'){return it.img?`<img class="${cls}" src="${esc(it.img)}" alt="" loading="lazy">`:`<span class="${cls} ph">${esc((it.title||'?').slice(0,18))}</span>`}
function mCard(k,it){const max=MK[k].stars;const prog=it.total?Math.min(100,(it.prog||0)/it.total*100):null;
  return `<button type="button" class="mcard" data-mkey="${esc(it.key)}">${poster(it)}${it.fav?'<i class="mfav">♥</i>':''}<span class="mst st-${it.st}"></span>${it.rating!=null&&it.rating!==''?`<span class="mrate">${stars(it.rating,max)}</span>`:''}${prog!=null&&it.st!=='done'?`<span class="mbar"><i style="width:${prog}%"></i></span>`:''}<span class="mt">${esc(it.title)}</span></button>`}
function mLibrary(k){const all=mItems(k);const fav=all.filter(x=>x.fav).slice(0,4);const q=norm(MFILT.q);
  let list=all.filter(x=>(MFILT.st==='all'||x.st===MFILT.st)&&(!q||norm(x.title).includes(q)));
  const S={recent:(a,b)=>(b.upd||'')>(a.upd||'')?1:-1,rating:(a,b)=>(+b.rating||0)-(+a.rating||0),title:(a,b)=>a.title.localeCompare(b.title),year:(a,b)=>(+b.year||0)-(+a.year||0)};list.sort(S[MFILT.sort]||S.recent);
  const cnt=s=>all.filter(x=>s==='all'||x.st===s).length;
  $('mBody').innerHTML=`${fav.length?`<div class="tag" style="margin-bottom:6px">Favourites</div><div class="mfavs">${fav.map(it=>mCard(k,it)).join('')}</div>`:''}
  <div class="row" style="gap:6px;flex-wrap:wrap;margin:10px 0"><div class="chips" id="mSt" style="margin:0">${[['all','all']].concat(MSTAT(k)).map(([s,l])=>`<button class="chip" type="button" data-st="${s}" aria-pressed="${MFILT.st===s}">${l} <span class="c">${cnt(s)}</span></button>`).join('')}</div></div>
  <div class="row" style="gap:6px;margin-bottom:10px"><select class="inp" id="mSort" style="flex:1">${[['recent','recently updated'],['rating','rating'],['title','title'],['year','year']].map(([v,l])=>`<option value="${v}" ${MFILT.sort===v?'selected':''}>${l}</option>`).join('')}</select></div>
  <div class="mgrid">${list.map(it=>mCard(k,it)).join('')||`<div class="dim mempty">Nothing here yet. Tap “+ add” to search.</div>`}</div>`;
  $('mSt').onclick=e=>{const b=e.target.closest('[data-st]');if(b){MFILT.st=b.dataset.st;mLibrary(k)}};$('mSort').onchange=e=>{MFILT.sort=e.target.value;mLibrary(k)};
  $('mBody').onclick=e=>{const b=e.target.closest('[data-mkey]');if(b)mEntry(k,b.dataset.mkey)}}

/* ---- add (search) ---- */
mAdd.seq=0;
function mAdd(k){openSheet('add '+MK[k].label,`<input class="inp" id="msQ" placeholder="Search ${k==='anime'||k==='manga'?'AniList / MyAnimeList':k==='books'?'Open Library':'films & series'}…" autocomplete="off" style="margin-bottom:10px"><div class="msres" id="msRes"><div class="dim">Type a title.</div></div><button class="iconbtn" type="button" id="msManual" style="margin-top:10px">+ Add manually</button>`);
  let t=null,last=[];$('msQ').oninput=e=>{clearTimeout(t);const q=e.target.value;t=setTimeout(async()=>{const my=++mAdd.seq;$('msRes').innerHTML='<div class="dim">searching…</div>';const r=await msearch(k,q);if(my!==mAdd.seq||!$('msRes'))return;if(r===null){$('msRes').innerHTML=`<div class="dim">Couldn’t reach the search sources (${esc(MSEARCH_ERR)}). Try again in a moment, or use “add manually”.</div>`;return}last=r;
    $('msRes').innerHTML=r.map((x,i)=>`<button type="button" class="msr" data-i="${i}">${poster(x,'msp')}<span><b>${esc(x.title)}</b><span class="dim">${[x.year,x.kind,x.total?x.total+' '+MK[k].units:'',x.by].filter(Boolean).map(esc).join(' · ')}</span></span>${MEDIA[k].items[x.key]?'<span class="chipy">In library</span>':''}</button>`).join('')||'<div class="dim">No results.</div>'},350)};
  setTimeout(()=>$('msQ')&&$('msQ').focus(),200);
  $('msRes').onclick=e=>{const b=e.target.closest('[data-i]');if(!b)return;const x=last[+b.dataset.i];if(MEDIA[k].items[x.key])return mEntry(k,x.key);const it={...x,st:k==='movies'?'done':'plan',prog:0,rating:null,added:DAYK,upd:new Date().toISOString(),log:k==='movies'?[{d:DAYK,r:null,re:false}]:[],tags:[],fin:k==='movies'?DAYK:undefined};delete it.score;it.mal=x.score;MEDIA[k].items[it.key]=it;saveMedia(k);flash('added');mEntry(k,it.key,true);menrich(k,it).then(()=>{const a=document.activeElement;if($('sheet').classList.contains('on')&&$('sheetTitle').textContent===it.title&&!(a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName)))mEntry(k,it.key)})};
  $('msManual').onclick=()=>{const title=($('msQ').value||'').trim()||'untitled';const it={key:'m'+rid(),src:'manual',title,img:'',st:'plan',prog:0,rating:null,added:DAYK,upd:new Date().toISOString(),log:[],tags:[],genres:[]};MEDIA[k].items[it.key]=it;saveMedia(k);mEntry(k,it.key,true)}}

/* ---- entry sheet ---- */
function mEntry(k,key,fresh){const it=MEDIA[k].items[key];if(!it)return;const max=MK[k].stars;const K=MK[k];
  const persist=()=>{it.upd=new Date().toISOString();saveMedia(k);if(cur==='media')renderMedia()};
  const rateBtns=max===10?[...Array(10)].map((_,i)=>`<button type="button" class="rb${+it.rating===i+1?' on':''}" data-rate="${i+1}">${i+1}</button>`).join(''):[1,2,3,4,5].map(n=>{const r=+it.rating||0;const cls=r>=n?'full':r>=n-.5?'half':'';return `<span class="star5 ${cls}"><button type="button" data-rate="${n-.5}" aria-label="${n-.5} stars"></button><button type="button" data-rate="${n}" aria-label="${n} stars"></button></span>`}).join('');
  openSheet(it.title,`<div class="mhero">${poster(it,'mbig')}<div class="mhi"><b>${esc(it.title)}</b>${it.alt&&it.alt!==it.title?`<span class="dim">${esc(it.alt)}</span>`:''}<span class="dim">${[it.year,it.kind,it.by].filter(Boolean).map(esc).join(' · ')}</span>${it.genres&&it.genres.length?`<div class="chips" style="margin:6px 0 0">${it.genres.slice(0,6).map(g=>`<span class="chipy">${esc(g)}</span>`).join('')}</div>`:''}${it.mal?`<span class="dim">${it.src==='imdb'?'IMDb':it.src==='mal'?'MAL':it.src==='anilist'?'AniList':it.src==='kitsu'?'Kitsu':'score'} ${it.mal}/10</span>`:''}${it.url?`<a class="iconbtn" href="${esc(it.url)}" target="_blank" rel="noopener" style="width:fit-content;margin-top:6px">open ↗</a>`:''}</div></div>
  <div class="tag" style="margin:12px 0 6px">Status</div><div class="chips" id="meSt">${MSTAT(k).map(([s,l])=>`<button class="chip" type="button" data-st="${s}" aria-pressed="${it.st===s}">${l}</button>`).join('')}</div>
  <div class="tag" style="margin:6px 0 6px">your rating ${max===10?'/ 10':''}</div><div class="rates${max===10?'':' starrow'}" id="meRate">${rateBtns}<button type="button" class="iconbtn" data-rate="">Clear</button></div>
  ${K.unit?`<div class="tag" style="margin:12px 0 6px">Progress</div><div class="row" style="gap:8px;align-items:center"><button class="btn" type="button" data-pg="-1">−</button><input class="inp num" id="mePg" value="${it.prog||0}" inputmode="numeric" style="width:80px;text-align:center"><span class="dim">/ <input class="inp num" id="meTot" value="${it.total||''}" placeholder="?" inputmode="numeric" style="width:70px;display:inline-block"> ${K.units}</span><button class="btn p" type="button" data-pg="1">+1</button></div>`:''}
  <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:12px"><label class="dim">Started<input class="inp" type="date" id="meS" value="${it.start||''}"></label><label class="dim">Finished<input class="inp" type="date" id="meF" value="${it.fin||''}"></label><label class="dim" style="display:flex;gap:6px;align-items:center;margin-top:18px"><input type="checkbox" id="meFav" ${it.fav?'checked':''} style="width:auto;display:inline"> favourite</label></div>
  <div class="tag" style="margin:12px 0 6px">Review</div><textarea class="inp" id="meRev" rows="4" placeholder="What did you think?">${esc(it.review||'')}</textarea>
  <label class="dim">Tags (comma separated)<input class="inp" id="meTags" value="${esc((it.tags||[]).join(', '))}"></label>
  ${epBlock(k,it)}
  <div class="tag" style="margin:14px 0 6px">diary · ${(it.log||[]).length} ${K.verb==='watch'?'watch':'read'}${(it.log||[]).length===1?'':'es'}</div>
  <div class="row" style="gap:8px;flex-wrap:wrap;align-items:end"><label class="dim">Date<input class="inp" type="date" id="meLd" value="${DAYK}"></label><label class="dim" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="meRe" ${(it.log||[]).length?'checked':''} style="width:auto;display:inline"> re${K.verb}</label><button class="btn" type="button" id="meLog">log ${K.verb==='watch'?'watched':'read'}</button></div>
  <div class="hsets" style="margin-top:8px">${(it.log||[]).map((l,i)=>`<span class="set">${esc(nice(l.d).toLowerCase())}${l.re?' ↻':''}${l.r!=null&&l.r!==''?' · '+stars(l.r,max):''} <button class="iconbtn" type="button" data-ldi="${i}" style="padding:0 4px">✕</button></span>`).join('')}</div>
  ${it.syn?`<details style="margin-top:12px"><summary class="dim">Synopsis</summary><p style="font-size:13px;line-height:1.55">${esc(it.syn)}</p></details>`:''}
  <div class="tag" style="margin:14px 0 6px">Lists</div><div class="chips" id="meLists">${(MEDIA[k].lists||[]).map(l=>`<button class="chip" type="button" data-li="${esc(l.id)}" aria-pressed="${l.keys.includes(key)}">${esc(l.name)}</button>`).join('')}<button class="chip" type="button" data-li="new">+ New list</button></div>
  <div class="bigbtns" style="margin-top:14px"><button class="btn d" type="button" id="meDel">Remove</button><span style="flex:1"></span><button class="btn p" type="button" id="meOk">Done</button></div>`);
  const sb=$('sheetBody');
  sb.onclick=e=>{const b=e.target.closest('button');if(!b)return;
    if(b.dataset.st){it.st=b.dataset.st;if(it.st==='cur'&&!it.start)it.start=DAYK;if(it.st==='done'){if(!it.fin)it.fin=DAYK;if(it.total)it.prog=it.total;if(!(it.log||[]).length&&k!=='anime'&&k!=='manga')it.log=[{d:DAYK,r:it.rating,re:false}];else if(!(it.log||[]).length)it.log=[{d:DAYK,r:it.rating,re:false}]}persist();mEntry(k,key);if(it.st==='done')flash('completed');return}
    if(b.dataset.rate!=null){it.rating=b.dataset.rate===''?null:+b.dataset.rate;if((it.log||[]).length)it.log[it.log.length-1].r=it.rating;persist();mEntry(k,key);return}
    if(b.dataset.pg){it.prog=Math.max(0,(+it.prog||0)+ +b.dataset.pg);if(it.total&&it.prog>=it.total){it.prog=+it.total;if(it.st!=='done'){it.st='done';it.fin=DAYK;it.log=[...(it.log||[]),{d:DAYK,r:it.rating,re:false}];flash('completed');burst(innerWidth/2,innerHeight/2,80)}}else if(it.st==='plan'||!it.st){it.st='cur';it.start=it.start||DAYK}persist();mEntry(k,key);return}
    if(b.id==='meLog'){it.log=[...(it.log||[]),{d:$('meLd').value||DAYK,r:it.rating,re:$('meRe').checked}];if(it.st!=='done'){it.st='done';it.fin=it.fin||$('meLd').value||DAYK}persist();flash('logged');mEntry(k,key);return}
    if(b.dataset.ldi!=null){it.log.splice(+b.dataset.ldi,1);persist();mEntry(k,key);return}
    if(b.dataset.li){if(b.dataset.li==='new'){const n=prompt('List name?');if(!n)return;MEDIA[k].lists=[...(MEDIA[k].lists||[]),{id:rid(),name:n.trim(),keys:[key]}]}else{const l=MEDIA[k].lists.find(x=>x.id===b.dataset.li);l.keys=l.keys.includes(key)?l.keys.filter(x=>x!==key):[...l.keys,key]}persist();mEntry(k,key);return}
    if(b.id==='meDel'){if(!b.dataset.arm){b.dataset.arm=1;b.textContent='tap again';return}delete MEDIA[k].items[key];(MEDIA[k].lists||[]).forEach(l=>l.keys=l.keys.filter(x=>x!==key));saveMedia(k);closeSheet();renderMedia();return}
    if(b.dataset.epr){$('meEpR').value=b.dataset.epr;sb.querySelectorAll('[data-epr]').forEach(x=>x.classList.toggle('on',x===b));return}
    if(b.dataset.epo){const e=(it.eps||{})[b.dataset.epo]||{};$('meEpN').value=b.dataset.epo;$('meEpR').value=e.r||'';$('meEpNote').value=e.note||'';sb.querySelectorAll('[data-epr]').forEach(x=>x.classList.toggle('on',+x.dataset.epr===+e.r));$('meEpN').scrollIntoView({block:'center',behavior:'smooth'});return}
    if(b.dataset.epd){if(!b.dataset.arm){b.dataset.arm=1;b.textContent='?';return}delete it.eps[b.dataset.epd];persist();mEntry(k,key);return}
    if(b.id==='meEpSave'){const n=parseInt($('meEpN').value);if(!(n>0)){flash('which_'+EPU(k));return}const r=$('meEpR').value===''?null:+$('meEpR').value,note=$('meEpNote').value.trim();
      it.eps={...(it.eps||{}),[n]:{r,note,d:((it.eps||{})[n]||{}).d||DAYK}};if(K.unit&&(+it.prog||0)<n&&(!it.total||n<=it.total)){it.prog=n;if(it.st==='plan'||!it.st){it.st='cur';it.start=it.start||DAYK}}persist();flash(EPU(k)+'_'+n+'_saved');mEntry(k,key);setTimeout(()=>{const el=$('meEpList');el&&el.scrollIntoView({block:'center'})},60);return}
    if(b.id==='meOk'){closeSheet()}};
  let tt=null;sb.oninput=e=>{const id=e.target.id;clearTimeout(tt);tt=setTimeout(()=>{
    if(id==='mePg'){it.prog=+e.target.value||0}if(id==='meTot'){it.total=+e.target.value||null}if(id==='meS')it.start=e.target.value;if(id==='meF')it.fin=e.target.value;if(id==='meRev')it.review=e.target.value;
    if(id==='meTags')it.tags=e.target.value.split(',').map(x=>x.trim()).filter(Boolean);if(id==='meFav')it.fav=e.target.checked;persist()},400)};sb.onchange=sb.oninput}

/* ---- per-episode / per-chapter ratings + notes ---- */
const EPU=k=>k==='anime'?'episode':'chapter';
function epBlock(k,it){if(k==='movies')return '';const U=EPU(k),eps=it.eps||{},ns=Object.keys(eps).map(Number).sort((a,b)=>b-a);const next=Math.max(1,+it.prog||1);
  return `<div class="tag" style="margin:14px 0 6px">${U}s · ${ns.length} rated</div>
  <div class="epbox"><div class="row" style="gap:8px;align-items:center;flex-wrap:wrap"><span class="dim">${U}</span><input class="inp num" id="meEpN" value="${next}" inputmode="numeric" style="width:72px;text-align:center"><input type="hidden" id="meEpR" value=""><div class="rates" style="flex:1">${[...Array(10)].map((_,i)=>`<button type="button" class="rb" data-epr="${i+1}">${i+1}</button>`).join('')}</div></div>
  <textarea class="inp" id="meEpNote" rows="2" placeholder="Thoughts on this ${U}…" style="margin-top:8px"></textarea><div class="row" style="justify-content:flex-end;margin-top:6px"><button class="btn p" type="button" id="meEpSave">save ${U}</button></div></div>
  <div class="eplist" id="meEpList">${ns.map(n=>{const e=eps[n];return `<div class="eprow"><button type="button" class="epmain" data-epo="${n}"><b class="num">${U==='episode'?'EP':'CH'} ${n}</b>${e.r?`<span class="epr num">${e.r}/10</span>`:''}<span class="dim">${esc((e.note||'').slice(0,90))}${(e.note||'').length>90?'…':''}</span></button><button class="iconbtn" type="button" data-epd="${n}">✕</button></div>`}).join('')}</div>`}
/* ---- diary (Letterboxd style) ---- */
function mDiary(k){const rows=[];mItems(k).forEach(it=>(it.log||[]).forEach(l=>rows.push({it,l})));rows.sort((a,b)=>a.l.d<b.l.d?1:-1);const max=MK[k].stars;let lastM='';
  $('mBody').innerHTML=`<div class="mdiary">${rows.map(({it,l})=>{const m=l.d.slice(0,7);const head=m!==lastM?`<div class="mdm">${new Date(l.d+'T12:00').toLocaleDateString('en-GB',{month:'long',year:'numeric'})}</div>`:'';lastM=m;
    return head+`<button type="button" class="mdr" data-mkey="${esc(it.key)}"><span class="mdd num">${+l.d.slice(8)}</span>${poster(it,'msp')}<span class="mdt"><b>${esc(it.title)}</b><span class="dim">${esc(String(it.year||''))}</span></span><span>${l.r!=null&&l.r!==''?stars(l.r,max):''}</span><span class="dim">${l.re?'↻':''}${it.review?' ✎':''}${it.fav?' ♥':''}</span></button>`}).join('')||'<div class="dim">Your diary fills in as you log things you finish.</div>'}</div>`;
  $('mBody').onclick=e=>{const b=e.target.closest('[data-mkey]');if(b)mEntry(k,b.dataset.mkey)}}
/* ---- lists ---- */
function mLists(k){const L=MEDIA[k].lists||[];
  $('mBody').innerHTML=`<div class="row" style="justify-content:flex-end;margin-bottom:8px"><button class="iconbtn" type="button" id="mlNew">+ New list</button></div>${L.map(l=>`<div class="panel" style="margin-bottom:10px"><div class="ph"><span class="tag">${esc(l.name)} · ${l.keys.length}</span><span class="row" style="gap:6px"><button class="iconbtn" type="button" data-lren="${esc(l.id)}">Rename</button><button class="iconbtn" type="button" data-ldel="${esc(l.id)}">Delete</button></span></div><div class="pb"><div class="mgrid sm">${l.keys.map(x=>MEDIA[k].items[x]).filter(Boolean).map(it=>mCard(k,it)).join('')||'<span class="dim">Add titles to this list from their page.</span>'}</div></div></div>`).join('')||'<div class="dim">Make lists like “all-time top 10”, “comfort rewatches” or “2026 to-watch”.</div>'}`;
  $('mBody').onclick=e=>{const b=e.target.closest('button');if(!b)return;
    if(b.id==='mlNew'){const n=prompt('List name?');if(n){MEDIA[k].lists=[...L,{id:rid(),name:n.trim(),keys:[]}];saveMedia(k);mLists(k)}return}
    if(b.dataset.lren){const l=L.find(x=>x.id===b.dataset.lren);const n=prompt('Rename list',l.name);if(n){l.name=n.trim();saveMedia(k);mLists(k)}return}
    if(b.dataset.ldel){if(!b.dataset.arm){b.dataset.arm=1;b.textContent='tap again';return}MEDIA[k].lists=L.filter(x=>x.id!==b.dataset.ldel);saveMedia(k);mLists(k);return}
    if(b.dataset.mkey)mEntry(k,b.dataset.mkey)}}
/* ---- wrapped: your top 5, best episodes, year highlights ---- */
function mWrapped(k,all,logs,yr,genres,months){const max=MK[k].stars,U=k==='movies'?null:EPU(k);
  const top=all.filter(x=>x.rating!=null&&x.rating!=='').sort((a,b)=>(+b.rating-+a.rating)||((b.fav?1:0)-(a.fav?1:0))||((b.upd||'')>(a.upd||'')?1:-1)).slice(0,5);
  const eps=U?all.flatMap(it=>Object.entries(it.eps||{}).filter(([n,e])=>e.r).map(([n,e])=>({it,n:+n,e}))).sort((a,b)=>b.e.r-a.e.r||((b.e.d||'')>(a.e.d||'')?1:-1)).slice(0,5):[];
  const yrLogs=logs.filter(o=>o.l.d.startsWith(String(yr)));const g=Object.entries(genres).sort((a,b)=>b[1]-a[1])[0];
  const bm=months.indexOf(Math.max(...months));const re=all.map(it=>({it,c:(it.log||[]).length})).sort((a,b)=>b.c-a.c)[0];
  const epsYr=U?all.reduce((a,it)=>a+Object.values(it.eps||{}).filter(e=>(e.d||'').startsWith(String(yr))).length,0):0;
  if(!top.length&&!eps.length&&!yrLogs.length)return `<div class="wrapped empty"><b>${yr} wrapped</b><span class="dim">Rate a few ${MK[k].label} and your wrapped builds itself here.</span></div>`;
  return `<div class="wrapped"><div class="wrhead"><span class="wrk">${yr}</span><b>${MK[k].label} wrapped</b></div>
  <div class="wrgrid">
    ${top.length?`<div class="wrcard wrtop"><span class="wrl">your top ${top.length}</span>${top.map((it,i)=>`<button type="button" class="wrrow" data-mkey="${esc(it.key)}"><i class="num">${i+1}</i>${poster(it,'msp')}<span><b>${esc(it.title)}</b><span class="dim">${esc(String(it.year||''))}</span></span>${stars(it.rating,max)}</button>`).join('')}</div>`:''}
    ${eps.length?`<div class="wrcard wreps"><span class="wrl">highest rated ${U}s ever</span>${eps.map((o,i)=>`<button type="button" class="wrrow" data-mkey="${esc(o.it.key)}"><i class="num">${i+1}</i>${poster(o.it,'msp')}<span><b>${esc(o.it.title)}</b><span class="dim">${U==='episode'?'EP':'CH'} ${o.n}${o.e.note?' · '+esc(o.e.note.slice(0,40)):''}</span></span><span class="epr num">${o.e.r}/10</span></button>`).join('')}</div>`:''}
    <div class="wrcard wrnums">
      <div><span class="wrl">finished in ${yr}</span><b class="num">${yrLogs.length}</b></div>
      ${U?`<div><span class="wrl">${U}s rated in ${yr}</span><b class="num">${epsYr}</b></div>`:''}
      ${g?`<div><span class="wrl">#1 genre</span><b class="wrs">${esc(g[0])}</b></div>`:''}
      ${yrLogs.length?`<div><span class="wrl">Busiest month</span><b class="wrs">${new Date(yr,bm,1).toLocaleDateString('en-GB',{month:'long'})}</b></div>`:''}
      ${re&&re.c>1?`<div><span class="wrl">most re${MK[k].verb==='watch'?'watched':'read'}</span><b class="wrs">${esc(re.it.title)} ×${re.c}</b></div>`:''}
    </div></div></div>`}
/* ---- stats ---- */
function mStats(k){const all=mItems(k);const done=all.filter(x=>x.st==='done');const max=MK[k].stars;const yr=new Date().getFullYear();
  const logs=all.flatMap(it=>(it.log||[]).map(l=>({it,l})));const thisYear=logs.filter(o=>o.l.d.startsWith(String(yr)));
  const rated=all.filter(x=>x.rating!=null&&x.rating!=='');const avg=rated.length?rated.reduce((a,x)=>a+ +x.rating,0)/rated.length:null;
  const buckets=max===10?[...Array(10)].map((_,i)=>i+1):[...Array(10)].map((_,i)=>(i+1)/2);const dist=buckets.map(b=>rated.filter(x=>+x.rating===b).length);const dmx=Math.max(1,...dist);
  const genres={};done.concat(all.filter(x=>x.st==='cur')).forEach(x=>(x.genres||[]).forEach(g=>genres[g]=(genres[g]||0)+1));const gl=Object.entries(genres).sort((a,b)=>b[1]-a[1]).slice(0,10);const gmx=Math.max(1,...gl.map(x=>x[1]));
  const months=[...Array(12)].map((_,i)=>logs.filter(o=>o.l.d.startsWith(`${yr}-${pad(i+1)}`)).length);const mmx=Math.max(1,...months);
  const units=all.reduce((a,x)=>a+(+x.prog||0),0);const hours=k==='anime'?Math.round(all.reduce((a,x)=>a+(+x.prog||0)*(x.dur||24),0)/60):null;
  const W=mWrapped(k,all,logs,yr,genres,months);
  $('mBody').innerHTML=W+`<div class="statcards"><div><span class="dim">Completed</span><b class="num">${done.length}</b></div><div><span class="dim">in ${yr}</span><b class="num">${thisYear.length}</b></div><div><span class="dim">Avg rating</span><b class="num">${avg==null?'—':kgs(Math.round(avg*10)/10)}<small>${max===10?' /10':' ★'}</small></b></div>${MK[k].unit?`<div><span class="dim">${MK[k].units}</span><b class="num">${units.toLocaleString('en-GB')}</b></div>`:''}${hours!=null?`<div><span class="dim">Hours watched</span><b class="num">${hours}</b></div>`:''}<div><span class="dim">plan to ${MK[k].verb}</span><b class="num">${all.filter(x=>x.st==='plan').length}</b></div></div>
  <div class="statsplit"><div class="panel"><div class="ph"><span class="tag">${yr} by month</span></div><div class="pb"><div class="wkbars" style="grid-template-columns:repeat(12,1fr)">${months.map((v,i)=>`<div class="d"><span class="p num">${v||''}</span><div class="b" style="height:${v/mmx*100}%"></div><span class="l">${'jfmamjjasond'[i]}</span></div>`).join('')}</div></div></div>
  <div class="panel"><div class="ph"><span class="tag">Ratings</span><span class="dim">${rated.length} rated</span></div><div class="pb"><div class="wkbars" style="grid-template-columns:repeat(10,1fr)">${dist.map((v,i)=>`<div class="d"><span class="p num">${v||''}</span><div class="b" style="height:${v/dmx*100}%;background:var(--cyan)"></div><span class="l">${max===10?buckets[i]:(buckets[i]%1?'½':buckets[i])}</span></div>`).join('')}</div></div></div></div>
  <div class="panel" style="margin-top:12px"><div class="ph"><span class="tag">Top genres</span></div><div class="pb"><div class="mbars">${gl.map(([g,v])=>`<div><span>${esc(g)}</span><i style="--w:${v/gmx*100}%"></i><b class="num">${v}</b></div>`).join('')||'<span class="dim">Add a few titles to see your taste.</span>'}</div></div></div>`;
  $('mBody').onclick=e=>{const b=e.target.closest('[data-mkey]');if(b)mEntry(k,b.dataset.mkey)}}
initMediaNav();

/* ================= FOOD (calories + macros, Lose It style) =================
   docs: food/profile · food/lib {custom,meals,recent,fav} · food/d-YYYY-MM-DD {m:{b,l,d,s},ex,w,note} · food/fast {cur,log}
   an entry stores per-100g values + grams eaten, so it can be re-portioned later */
const FMEALS=[['b','breakfast'],['l','lunch'],['d','dinner'],['s','snacks']];
const FACT=[[1.2,'sedentary (desk, little exercise)'],[1.375,'lightly active (1–3 workouts/wk)'],[1.55,'active (3–5 workouts/wk)'],[1.725,'very active (6–7 hard days)']];
const FRATE=[[-1,'lose 1 kg / week'],[-0.75,'lose 0.75 kg / week'],[-0.5,'lose 0.5 kg / week'],[-0.25,'lose 0.25 kg / week'],[0,'maintain'],[0.25,'gain 0.25 kg / week'],[0.5,'gain 0.5 kg / week']];
const FEX=[['weights / gym',5],['walking',3.5],['incline treadmill walk',6],['running',9.8],['cycling',7.5],['HIIT',8],['swimming',7],['football',7],['boxing / bag work',7.8],['stretching / yoga',2.5]];
let FPROF=null,FLIB={custom:[],meals:[],recent:[],fav:{}},FDAYS={},FFAST={cur:null,log:[]},FGEN=null,FV=LS.get('foodv')||'log',FD=null,foodLoaded=false;
const fK=d=>'food/d-'+d;
const fDay=d=>FDAYS[d]||(FDAYS[d]={m:{b:[],l:[],d:[],s:[]},ex:[],w:0,note:''});
const r1=x=>Math.round((+x||0)*10)/10;
function fNum(e,k){if(e.quick)return +e['q'+k]||0;return (+e[k]||0)*(+e.g||0)/100}
function fSum(list){const t={kcal:0,p:0,c:0,f:0,fi:0,su:0,na:0};list.forEach(e=>{t.kcal+=fNum(e,'k');t.p+=fNum(e,'p');t.c+=fNum(e,'c');t.f+=fNum(e,'f');t.fi+=fNum(e,'fi');t.su+=fNum(e,'su');t.na+=fNum(e,'na')});return t}
function dayItems(d){const x=fDay(d);return FMEALS.flatMap(([m])=>x.m[m]||[])}
function curKg(){const r=(typeof WT!=='undefined'&&WT.r)||[];return r.length?+r[r.length-1].kg:(FPROF&&+FPROF.kg)||80}
function fBudget(){const P=FPROF||{};if(P.override)return +P.override;const kg=curKg(),h=+P.hcm||178,a=+P.age||22;
  const bmr=10*kg+6.25*h-5*a+(P.sex==='f'?-161:5);const tdee=bmr*(+P.act||1.375);const b=tdee+(+P.rate||0)*7700/7;return Math.round(Math.max(P.sex==='f'?1200:1500,b)/10)*10}
function fTargets(){const P=FPROF||{},B=fBudget();if(P.mmode==='g')return {p:+P.gp||150,c:+P.gc||200,f:+P.gf||70};
  const pp=+P.mp||35,pc=+P.mc||35,pf=+P.mf||30;return {p:Math.round(B*pp/100/4),c:Math.round(B*pc/100/4),f:Math.round(B*pf/100/9)}}
function exKcal(d){return (fDay(d).ex||[]).reduce((a,e)=>a+(+e.k||0),0)}
async function loadFood(){
  if(foodLoaded){renderFood();return}
  const [p,l,f,rows,gen]=await Promise.all([load('food/profile'),load('food/lib'),load('food/fast'),listDocs('food/d-'),FGEN?FGEN:fetch('foods.json').then(r=>r.json()).catch(()=>[])]);
  FPROF=p||null;FLIB={custom:[],meals:[],recent:[],fav:{},...(l||{})};FFAST={cur:null,log:[],...(f||{})};
  rows.forEach(r=>{if(r.data)FDAYS[r.path.slice(7)]={m:{b:[],l:[],d:[],s:[]},ex:[],w:0,note:'',...r.data}});
  FGEN=gen.map((g,i)=>({id:'g'+i,n:g[0],k:g[1],p:g[2],c:g[3],f:g[4],fi:g[5],sv:g[6],src:'gen'}));
  foodLoaded=true;FD=FD||DAYK;renderFood()}
watchPrefix('food/d-',(evt,path,data)=>{const d=path.slice(7);if(evt==='DELETE')delete FDAYS[d];else if(data)FDAYS[d]={m:{b:[],l:[],d:[],s:[]},ex:[],w:0,note:'',...data};if(cur==='food'&&!$('sheet').classList.contains('on'))renderFood()});
watch('food/lib',d=>{if(d)FLIB={custom:[],meals:[],recent:[],fav:{},...d}});
watch('food/profile',d=>{if(d){FPROF=d;if(cur==='food')renderFood()}});
watch('food/fast',d=>{if(d){FFAST={cur:null,log:[],...d};if(cur==='food'&&FV==='fast')renderFood()}});
const saveDay=d=>save(fK(d),fDay(d));
const saveLib=()=>save('food/lib',FLIB);

/* ---------- shell ---------- */
function renderFood(){if(!foodLoaded){loadFood();return}
  document.querySelectorAll('#foodSeg [data-fv]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.fv===FV));
  $('foodSub').textContent=FPROF?`${fBudget()} kcal budget · ${(FRATE.find(r=>r[0]===+FPROF.rate)||[0,'maintain'])[1]}`:'set up your goal';
  if(!FPROF&&FV!=='goals'){FV='goals'}
  ({log:fLog,progress:fProgress,fast:fFast,goals:fGoals}[FV]||fLog)()}
document.addEventListener('click',e=>{const b=e.target.closest('#foodSeg [data-fv]');if(!b)return;FV=b.dataset.fv;LS.set('foodv',FV);renderFood()});

/* ---------- log (the main daily screen) ---------- */
function fLog(){const el=$('foodBody');FD=FD||DAYK;const x=fDay(FD),B=fBudget(),T=fTargets(),items=dayItems(FD),S=fSum(items),EX=FPROF&&FPROF.noEx?0:exKcal(FD);
  const left=Math.round(B+EX-S.kcal),pct=Math.min(1,S.kcal/Math.max(1,B+EX)),over=left<0;
  const R=58,C=2*Math.PI*R;const isToday=FD===DAYK;
  const mbar=(lab,v,t,col)=>`<div class="fmac"><div class="row" style="justify-content:space-between"><span>${lab}</span><span class="num"><b>${Math.round(v)}</b><span class="dim"> / ${t} g</span></span></div><div class="fmbar"><i style="width:${Math.min(100,v/Math.max(1,t)*100)}%;background:${col}"></i></div></div>`;
  el.innerHTML=`<div class="fdate"><button class="iconbtn chev" type="button" data-fd="-1" aria-label="Previous day">‹</button><b>${isToday?'today':esc(nice(FD).toLowerCase())}</b><button class="iconbtn chev" type="button" data-fd="1" aria-label="Next day" ${isToday?'disabled':''}>›</button></div>
  <div class="fh2"><div class="fh2-top">
    <div class="fh2-ring${over?' over':''}"><svg viewBox="0 0 200 200"><defs><linearGradient id="fhg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${over?'#ff453a':'#ff2a6d'}"/><stop offset="1" stop-color="${over?'#ff9f0a':'#ff7ab0'}"/></linearGradient></defs><circle cx="100" cy="100" r="86" class="tr"/>${pct>0?`<circle cx="100" cy="100" r="86" class="fl" pathLength="100" stroke-dasharray="${Math.min(100,pct*100).toFixed(2)} 100"/>`:''}</svg>
      <div class="in"><b class="num">${Math.abs(left).toLocaleString('en-GB')}</b><span>${over?'kcal over':'kcal left'}</span></div></div>
    <div class="fh2-stats">
      <div class="fh2-st"><i style="--c:#a1a1a6"><svg viewBox="0 0 24 24"><path d="M5 21V8l7-5 7 5v13M9 21v-6h6v6"/></svg></i><span>Budget</span><b class="num">${B.toLocaleString('en-GB')}</b></div>
      <div class="fh2-st"><i style="--c:#ff2a6d"><svg viewBox="0 0 24 24"><path d="M7 3v8a3 3 0 0 0 6 0V3M10 3v18M17 3c-1.7 0-3 2.2-3 5.5S15.3 13 17 13v8"/></svg></i><span>Eaten</span><b class="num">${Math.round(S.kcal).toLocaleString('en-GB')}</b></div>
      <div class="fh2-st"><i style="--c:#ff9f0a"><svg viewBox="0 0 24 24"><path d="M12 3c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .3 2 1.5 3 2.5 3 0-3-1-6 0-9z"/></svg></i><span>Burned</span><b class="num">${EX.toLocaleString('en-GB')}</b></div>
    </div></div>
    <div class="fh2-macs">${[['Protein',S.p,T.p,'#ff2a6d'],['Carbs',S.c,T.c,'#5ac8fa'],['Fat',S.f,T.f,'#ffd60a']].map(([l,v,t,c])=>`<div class="fh2-mac" style="--c:${c}"><div class="h"><span>${l}</span><b class="num">${Math.round(v)}<small> / ${t}g</small></b></div><div class="bar"><i style="width:${Math.min(100,v/Math.max(1,t)*100).toFixed(1)}%"></i></div><em>${Math.max(0,Math.round(t-v))}g left</em></div>`).join('')}</div>
    <div class="fquick"><button type="button" class="btn p" data-fadd="${fAutoMeal()}"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>Log food</button><button type="button" class="btn" id="fScanTop"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 9v6M11 9v6M14 9v6M17 9v6"/></svg>Scan barcode</button></div>
    <div class="fh2-nut num"><span>Fibre <b>${r1(S.fi)}</b>/${(FPROF&&FPROF.fib)||30}g</span><span>Sugar <b>${r1(S.su)}</b>g</span><span>Sodium <b>${Math.round(S.na)}</b>/${(FPROF&&FPROF.na)||2300}mg</span></div></div>
  ${FMEALS.map(([m,lab])=>{const L=x.m[m]||[],s=fSum(L);return `<div class="panel fmeal"><div class="ph"><span class="tag">${lab}</span><span class="row" style="gap:6px"><span class="num fkc">${Math.round(s.kcal)} kcal</span><button class="iconbtn" type="button" data-fmenu="${m}">⋯</button></span></div><div class="pb">
    ${L.map((e,i)=>`<button type="button" class="frow" data-fe="${m}:${i}"><span><b>${esc(e.n)}</b><span class="dim">${esc(fAmt(e))}${e.b?' · '+esc(e.b):''}</span></span><span class="num">${Math.round(fNum(e,'k'))}</span></button>`).join('')}
    <button class="addrow" type="button" data-fadd="${m}">+ Add food</button></div></div>`}).join('')}
  <div class="panel fmeal"><div class="ph"><span class="tag">Exercise</span><span class="num">${EX} kcal</span></div><div class="pb">${(x.ex||[]).map((e,i)=>`<button type="button" class="frow" data-fx="${i}"><span><b>${esc(e.n)}</b><span class="dim">${e.min?e.min+' min':''}</span></span><span class="num">${e.k}</span></button>`).join('')}<button class="addrow" type="button" id="fAddEx">+ Add exercise</button></div></div>
  <div class="panel"><div class="ph"><span class="tag">Water</span><span class="num">${x.w||0} / ${(FPROF&&FPROF.water)||2500} ml</span></div><div class="pb"><div class="fwater">${[...Array(Math.ceil(((FPROF&&FPROF.water)||2500)/250))].map((_,i)=>`<button type="button" class="${(x.w||0)>=(i+1)*250?'on':''}" data-fw="${(i+1)*250}" aria-label="${(i+1)*250} ml"></button>`).join('')}</div></div></div>
  <div class="panel"><div class="ph"><span class="tag">Notes</span></div><div class="pb"><textarea class="inp" id="fNote" rows="2" placeholder="How did today go?">${esc(x.note||'')}</textarea></div></div>`;
  el.onclick=fLogClick;el.oninput=e=>{if(e.target.id==='fNote'){x.note=e.target.value;clearTimeout(fLog.t);fLog.t=setTimeout(()=>saveDay(FD),600)}}}
function fAutoMeal(){const h=new Date().getHours();return h>=5&&h<11?'b':h<15?'l':h>=17&&h<22?'d':'s'}
function fAmt(e){if(e.quick)return 'quick add';const q=+e.q||1;return e.u&&e.u!=='g'?`${r1(q)} × ${e.u}`:`${Math.round(e.g)} g`}
function fLogClick(e){const b=e.target.closest('button');if(!b)return;const x=fDay(FD);
  if(b.dataset.fd){const d=new Date(FD+'T12:00');d.setDate(d.getDate()+(+b.dataset.fd));const k=ymd(d);if(k>DAYK)return;FD=k;renderFood();return}
  if(b.dataset.fadd)return fAdd(b.dataset.fadd);
  if(b.dataset.fe){const [m,i]=b.dataset.fe.split(':');return fPortion(x.m[m][+i],{meal:m,idx:+i})}
  if(b.dataset.fmenu)return fMealMenu(b.dataset.fmenu);
  if(b.dataset.fw){const v=+b.dataset.fw;x.w=(x.w||0)>=v?v-250:v;saveDay(FD);fLog();return}
  if(b.id==='fAddEx')return fExercise();
  if(b.id==='fScanTop')return fScan(fAutoMeal());
  if(b.dataset.fx){const i=+b.dataset.fx;openSheet('exercise',`<p>${esc(x.ex[i].n)} · ${x.ex[i].k} kcal</p><div class="bigbtns"><button class="btn d" type="button" id="fxDel">Remove</button><button class="btn p" type="button" id="fxOk">Done</button></div>`);$('fxOk').onclick=closeSheet;$('fxDel').onclick=()=>{x.ex.splice(i,1);saveDay(FD);closeSheet();fLog()}}}
function fMealMenu(m){const lab=FMEALS.find(z=>z[0]===m)[1];const x=fDay(FD);const y=new Date(FD+'T12:00');y.setDate(y.getDate()-1);const yk=ymd(y);const yl=(fDay(yk).m[m]||[]);
  openSheet(lab,`<div class="bigbtns col"><button class="btn" type="button" id="fmCopy" ${yl.length?'':'disabled'}>copy yesterday's ${lab} (${yl.length} item${yl.length===1?'':'s'})</button><button class="btn" type="button" id="fmSave" ${(x.m[m]||[]).length?'':'disabled'}>save this ${lab} as a meal</button><button class="btn d" type="button" id="fmClear" ${(x.m[m]||[]).length?'':'disabled'}>clear ${lab}</button></div>`);
  $('fmCopy').onclick=()=>{x.m[m]=(x.m[m]||[]).concat(clone(yl).map(e=>({...e,id:rid()})));saveDay(FD);closeSheet();fLog()};
  $('fmSave').onclick=()=>{const n=prompt('name this meal',lab+' '+nice(FD).toLowerCase());if(!n)return;FLIB.meals.unshift({id:rid(),n,items:clone(x.m[m])});saveLib();closeSheet()};
  $('fmClear').onclick=function(){if(!this.dataset.arm){this.dataset.arm=1;this.textContent='tap again to clear';return}x.m[m]=[];saveDay(FD);closeSheet();fLog()}}

/* ---------- add food: search, recent, frequent, my foods, meals, barcode, quick add ---------- */
let FTAB='recent',fSeq=0;
function fAdd(meal){const lab=FMEALS.find(z=>z[0]===meal)[1];
  openSheet('add to '+lab,`<div class="fsearch"><input class="inp" id="fQ" placeholder="Search foods & brands…" autocomplete="off" enterkeyhint="search"><button class="btn" type="button" id="fScan" aria-label="Scan barcode">▥ scan</button></div>
  <div class="seg mini" id="fTabs" style="margin:8px 0">${[['recent','recent'],['freq','frequent'],['mine','my foods'],['meals','meals']].map(([k,l])=>`<button type="button" data-ft="${k}" aria-pressed="${FTAB===k}">${l}</button>`).join('')}</div>
  <div class="row" style="gap:6px;margin-bottom:8px"><button class="iconbtn" type="button" id="fQuick">+ Quick add</button><button class="iconbtn" type="button" id="fCreate">+ Create food</button></div>
  <div id="fRes" class="fres"></div>`);
  const sb=$('sheetBody');const list=()=>{const q=$('fQ').value.trim();if(q)return fSearch(q,meal);$('fRes').innerHTML=fTabList(FTAB)};list();
  sb.oninput=e=>{if(e.target.id==='fQ'){clearTimeout(fAdd.t);fAdd.t=setTimeout(list,250)}};
  sb.onclick=e=>{const b=e.target.closest('button');if(!b)return;
    if(b.dataset.ft){FTAB=b.dataset.ft;sb.querySelectorAll('[data-ft]').forEach(z=>z.setAttribute('aria-pressed',z===b));$('fQ').value='';list();return}
    if(b.id==='fScan')return fScan(meal);if(b.id==='fQuick')return fQuickAdd(meal);if(b.id==='fCreate')return fCreate(meal);
    if(b.dataset.fmeal){const M=FLIB.meals.find(z=>z.id===b.dataset.fmeal);if(!M)return;const x=fDay(FD);x.m[meal]=(x.m[meal]||[]).concat(clone(M.items).map(e=>({...e,id:rid()})));saveDay(FD);closeSheet();fLog();return}
    if(b.dataset.fdelmeal){FLIB.meals=FLIB.meals.filter(z=>z.id!==b.dataset.fdelmeal);saveLib();list();return}
    if(b.dataset.fpick){const f=fFind(b.dataset.fpick);if(f)fPortion(f,{meal,isNew:true});return}}}
let FCACHE={};
function fFind(id){return FCACHE[id]||FLIB.custom.find(f=>f.id===id)||FGEN.find(f=>f.id===id)||(FLIB.recent.find(f=>f.id===id))}
function fRow(f){FCACHE[f.id]=f;const s=(f.sv&&f.sv[0])||['100 g',100];const k=Math.round((+f.k||0)*s[1]/100);
  return `<button type="button" class="frow" data-fpick="${esc(f.id)}">${f.img?`<img src="${esc(f.img)}" alt="" loading="lazy">`:''}<span><b>${esc(f.n)}${FLIB.fav[f.id]?' ★':''}</b><span class="dim">${esc([f.b,s[0]].filter(Boolean).join(' · '))}</span></span><span class="num">${k}<small> kcal</small></span></button>`}
function fTabList(t){
  if(t==='meals')return FLIB.meals.length?FLIB.meals.map(M=>{const s=fSum(M.items);return `<div class="row" style="gap:6px"><button type="button" class="frow" data-fmeal="${esc(M.id)}" style="flex:1"><span><b>${esc(M.n)}</b><span class="dim">${M.items.length} items · P ${Math.round(s.p)} C ${Math.round(s.c)} F ${Math.round(s.f)}</span></span><span class="num">${Math.round(s.kcal)}</span></button><button class="iconbtn" type="button" data-fdelmeal="${esc(M.id)}">✕</button></div>`}).join(''):'<div class="dim fempty">Save a meal from a meal\'s ⋯ menu to add it here in one tap.</div>';
  if(t==='mine')return FLIB.custom.length?FLIB.custom.map(fRow).join(''):'<div class="dim fempty">Foods you create show here.</div>';
  const R=[...FLIB.recent];if(t==='freq')R.sort((a,b)=>(b.cnt||0)-(a.cnt||0));else R.sort((a,b)=>(b.last||'')>(a.last||'')?1:-1);
  const fav=R.filter(f=>FLIB.fav[f.id]);const rest=R.filter(f=>!FLIB.fav[f.id]);
  return (R.length?(fav.length?'<div class="flab">Favourites</div>'+fav.map(fRow).join(''):'')+rest.slice(0,40).map(fRow).join(''):'<div class="dim fempty">Search above, scan a barcode, or pick from common foods:</div>'+FGEN.slice(0,30).map(fRow).join(''))}
const offStr=v=>Array.isArray(v)?v.join(', '):v==null?'':String(v);
function offToFood(p){try{return offToFood0(p)}catch(e){return null}}
function offToFood0(p){p={...p,brands:offStr(p.brands),product_name:offStr(p.product_name),product_name_en:offStr(p.product_name_en),quantity:offStr(p.quantity),serving_size:offStr(p.serving_size)};const n=p.nutriments||{};let k=n['energy-kcal_100g'];if(k==null&&n['energy_100g']!=null)k=n['energy_100g']/4.184;if(k==null)return null;
  const sq=+p.serving_quantity||0;const sv=[];if(sq>0)sv.push([p.serving_size||('serving · '+sq+' g'),sq]);if(p.quantity&&/^\s*\d+(\.\d+)?\s*g\s*$/i.test(p.quantity))sv.push(['pack · '+p.quantity.trim(),parseFloat(p.quantity)]);sv.push(['100 g',100]);
  return {id:'off'+p.code,code:p.code,n:(p.product_name_en||p.product_name||'').trim()||'unnamed product',b:(p.brands||'').split(',')[0].trim(),k:+k,p:+n.proteins_100g||0,c:+n.carbohydrates_100g||0,f:+n.fat_100g||0,fi:+n.fiber_100g||0,su:+n.sugars_100g||0,na:n.sodium_100g!=null?+n.sodium_100g*1000:(n.salt_100g!=null?+n.salt_100g*400:0),sv,img:p.image_small_url||'',src:'off'}}
async function offCall(body){const C=window.APP_CONFIG||{};let tok='';try{tok=JSON.parse(localStorage.getItem('ds-auth')||'{}').access_token||''}catch(e){}
  const url=(C.supabaseUrl||'').replace(/\/$/,'')+'/functions/v1/food';
  for(let a=0;a<2;a++){const ac=new AbortController();const to=setTimeout(()=>ac.abort(),a?20000:12000);
    try{const r=await fetch(url,{method:'POST',signal:ac.signal,headers:{'content-type':'application/json',apikey:C.supabaseKey,authorization:'Bearer '+(tok||C.supabaseKey)},body:JSON.stringify(body)});clearTimeout(to);
      if(r.status===401&&!a){try{const s=await Promise.race([SB.auth.refreshSession(),new Promise(z=>setTimeout(z,4000))]);tok=(s&&s.data&&s.data.session&&s.data.session.access_token)||tok}catch(e){}continue}
      if(!r.ok)continue;const j=await r.json();return j.items||[]}catch(e){clearTimeout(to)}}
  return null}
async function fSearch(q,meal){const my=++fSeq;const ql=q.toLowerCase(),words=ql.split(/\s+/);const hit=f=>{const s=(f.n+' '+(f.b||'')).toLowerCase();return words.every(w=>s.includes(w))};
  const seen=new Set();const loc=[...FLIB.custom,...FLIB.recent,...FGEN].filter(f=>{if(seen.has(f.id)||!hit(f))return false;seen.add(f.id);return true}).slice(0,25);
  $('fRes').innerHTML=(loc.length?loc.map(fRow).join(''):'')+'<div class="flab" id="fOnl">searching online…</div>';
  const items=await offCall({q});if(my!==fSeq||!$('fRes'))return;try{
  const on=(items||[]).map(offToFood).filter(Boolean).filter(f=>!seen.has(f.id));
  const lab=$('fOnl');if(!lab)return;lab.outerHTML=items===null?'<div class="dim fempty">Online search unavailable right now — use create food or quick add.</div>':on.length?'<div class="flab">from Open Food Facts</div>'+on.map(fRow).join(''):(loc.length?'':'<div class="dim fempty">Nothing found. Try another word, scan the barcode, or create it.</div>')}catch(e){const l=$('fOnl');if(l)l.outerHTML='<div class="dim fempty">Online search hit an error — try again.</div>'}}

/* portion editor (used for new picks and for editing logged entries) */
function fPortion(f,{meal,idx,isNew}){const ent=!isNew;const sv=(f.sv&&f.sv.length?f.sv:[['100 g',100]]).concat([['g',1]]);
  let u=ent?(f.u||'g'):sv[0][0],q=ent?(+f.q||(f.u==='g'?f.g:1)):1,m=meal;
  if(f.quick){return fQuickAdd(meal,idx)}
  const gr=()=>{const s=sv.find(z=>z[0]===u)||['g',1];return q*s[1]};
  const draw=()=>{const g=gr(),K=(+f.k||0)*g/100,P=(+f.p||0)*g/100,Cc=(+f.c||0)*g/100,F=(+f.f||0)*g/100,tot=P*4+Cc*4+F*9||1;
    $('fpOut').innerHTML=`<div class="fpk num"><b>${Math.round(K)}</b><span>kcal</span></div><div class="fpm num"><span><b>${r1(P)}</b> g protein</span><span><b>${r1(Cc)}</b> g carbs</span><span><b>${r1(F)}</b> g fat</span></div><div class="fpbar"><i style="flex:${P*4/tot};background:var(--pink)"></i><i style="flex:${Cc*4/tot};background:var(--cyan)"></i><i style="flex:${F*9/tot};background:#ffb000"></i></div><div class="dim" style="font-size:11px;margin-top:6px">${Math.round(g)} g · fibre ${r1((+f.fi||0)*g/100)} g · sugar ${r1((+f.su||0)*g/100)} g · sodium ${Math.round((+f.na||0)*g/100)} mg</div>`};
  openSheet(ent?'edit food':'add food',`${f.img?`<img class="fpimg" src="${esc(f.img)}" alt="">`:''}<b style="font-size:17px">${esc(f.n)}</b>${f.b?`<div class="dim">${esc(f.b)}</div>`:''}
    <div class="row" style="gap:8px;margin:12px 0"><input class="inp num" id="fpQ" value="${r1(q)}" inputmode="decimal" style="width:90px;text-align:center"><select class="inp" id="fpU" style="flex:1">${sv.map(s=>`<option value="${esc(s[0])}" ${s[0]===u?'selected':''}>${esc(s[0]==='g'?'grams':s[0]+(s[1]!==100||s[0]!=='100 g'?` (${r1(s[1])} g)`:''))}</option>`).join('')}</select></div>
    <div id="fpOut"></div>
    <div class="seg mini" id="fpMeal" style="margin-top:12px">${FMEALS.map(([k,l])=>`<button type="button" data-fpm="${k}" aria-pressed="${k===m}">${l}</button>`).join('')}</div>
    <div class="bigbtns" style="margin-top:14px">${ent?'<button class="btn d" type="button" id="fpDel">Delete</button>':''}<button class="iconbtn" type="button" id="fpFav">${FLIB.fav[f.fid||f.id]?'★ favourite':'☆ favourite'}</button><span style="flex:1"></span><button class="btn p" type="button" id="fpOk">${ent?'save':'add'}</button></div>`);
  draw();const sb=$('sheetBody');
  sb.oninput=e=>{if(e.target.id==='fpQ'){q=parseFloat(e.target.value.replace(',','.'))||0;draw()}};
  sb.onchange=e=>{if(e.target.id==='fpU'){const old=gr();u=e.target.value;const s=sv.find(z=>z[0]===u);q=u==='g'?Math.round(old):r1(old/s[1])||1;$('fpQ').value=q;draw()}};
  sb.onclick=e=>{const b=e.target.closest('button');if(!b)return;
    if(b.dataset.fpm){m=b.dataset.fpm;sb.querySelectorAll('[data-fpm]').forEach(z=>z.setAttribute('aria-pressed',z===b));return}
    if(b.id==='fpFav'){const id=f.fid||f.id;FLIB.fav[id]=!FLIB.fav[id];if(!FLIB.fav[id])delete FLIB.fav[id];b.textContent=FLIB.fav[id]?'★ favourite':'☆ favourite';fRemember(f);saveLib();return}
    if(b.id==='fpDel'){const x=fDay(FD);x.m[meal].splice(idx,1);saveDay(FD);closeSheet();fLog();return}
    if(b.id==='fpOk'){const x=fDay(FD);const e2={id:ent?f.id:rid(),fid:f.fid||f.id,n:f.n,b:f.b||'',k:f.k,p:f.p,c:f.c,f:f.f,fi:f.fi||0,su:f.su||0,na:f.na||0,sv:f.sv,img:f.img||'',code:f.code||'',src:f.src||'',q,u,g:gr(),t:new Date().toISOString()};
      if(ent){x.m[meal].splice(idx,1)}x.m[m]=(x.m[m]||[]);if(ent&&m===meal)x.m[m].splice(idx,0,e2);else x.m[m].push(e2);
      fRemember(f);saveLib();saveDay(FD);closeSheet();fLog()}}}
function fRemember(f){const id=f.fid||f.id;const keep={id,n:f.n,b:f.b||'',k:f.k,p:f.p,c:f.c,f:f.f,fi:f.fi||0,su:f.su||0,na:f.na||0,sv:f.sv,img:f.img||'',code:f.code||'',src:f.src||''};
  const i=FLIB.recent.findIndex(z=>z.id===id);const cnt=i>=0?(FLIB.recent[i].cnt||0)+1:1;if(i>=0)FLIB.recent.splice(i,1);FLIB.recent.unshift({...keep,cnt,last:new Date().toISOString()});FLIB.recent=FLIB.recent.slice(0,150)}
function fQuickAdd(meal,idx){const x=fDay(FD);const e=idx!=null?x.m[meal][idx]:{qk:'',qp:'',qc:'',qf:'',n:'quick add'};
  openSheet('quick add',`<label class="fl">Name<input class="inp" id="qaN" value="${esc(e.n||'quick add')}"></label><div class="fgrid4"><label class="fl">kcal<input class="inp num" id="qaK" inputmode="decimal" value="${e.qk||''}"></label><label class="fl">Protein g<input class="inp num" id="qaP" inputmode="decimal" value="${e.qp||''}"></label><label class="fl">Carbs g<input class="inp num" id="qaC" inputmode="decimal" value="${e.qc||''}"></label><label class="fl">Fat g<input class="inp num" id="qaF" inputmode="decimal" value="${e.qf||''}"></label></div>
  <div class="dim" style="font-size:11px">Leave kcal empty and it's worked out from the macros.</div><div class="bigbtns" style="margin-top:12px">${idx!=null?'<button class="btn d" type="button" id="qaDel">Delete</button>':''}<span style="flex:1"></span><button class="btn p" type="button" id="qaOk">${idx!=null?'save':'add'}</button></div>`);
  $('qaK').focus();
  if($('qaDel'))$('qaDel').onclick=()=>{x.m[meal].splice(idx,1);saveDay(FD);closeSheet();fLog()};
  $('qaOk').onclick=()=>{const P=+$('qaP').value||0,C=+$('qaC').value||0,F=+$('qaF').value||0;let K=+$('qaK').value;if(!K)K=Math.round(P*4+C*4+F*9);if(!K)return;
    const ne={id:e.id||rid(),quick:1,n:$('qaN').value.trim()||'quick add',qk:K,qp:P,qc:C,qf:F,t:new Date().toISOString()};if(idx!=null)x.m[meal][idx]=ne;else(x.m[meal]=x.m[meal]||[]).push(ne);saveDay(FD);closeSheet();fLog()}}
function fCreate(meal,pre={}){openSheet('create food',`<label class="fl">Name<input class="inp" id="cfN" value="${esc(pre.n||'')}"></label><label class="fl">Brand (optional)<input class="inp" id="cfB" value="${esc(pre.b||'')}"></label>
  <div class="fgrid4"><label class="fl">Serving name<input class="inp" id="cfS" value="${esc(pre.sn||'serving')}"></label><label class="fl">Serving size g<input class="inp num" id="cfG" inputmode="decimal" value="${pre.sg||100}"></label></div>
  <div class="dim" style="font-size:11px;margin:4px 0 6px">Nutrition per serving — copy it straight off the label</div>
  <div class="fgrid4">${[['K','kcal'],['P','protein g'],['C','carbs g'],['F','fat g'],['Fi','fibre g'],['Su','sugar g'],['Na','sodium mg']].map(([k,l])=>`<label class="fl">${l}<input class="inp num" id="cf${k}" inputmode="decimal"></label>`).join('')}</div>
  <div class="row" style="gap:10px;align-items:center;margin-top:10px"><button class="iconbtn" type="button" id="cfPicB"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-3px;margin-right:4px"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/></svg>Add photo</button><input type="file" id="cfPic" accept="image/*" hidden><img id="cfPrev" alt="" style="width:52px;height:52px;object-fit:cover;border:1px solid var(--line2);display:none"></div>
  <div class="bigbtns" style="margin-top:12px"><span style="flex:1"></span><button class="btn p" type="button" id="cfOk">Save + add</button></div>`);
  /* a photo for the food: taken or picked, shrunk to a thumbnail so the library stays light */
  let cfImg=pre.img||'';if(cfImg){$('cfPrev').src=cfImg;$('cfPrev').style.display='block'}
  $('cfPicB').onclick=()=>$('cfPic').click();
  $('cfPic').onchange=e=>{const fl=e.target.files&&e.target.files[0];if(!fl)return;const im=new Image();
    im.onload=()=>{const m=176,k=Math.min(1,m/Math.max(im.width,im.height)),cv=document.createElement('canvas');cv.width=Math.round(im.width*k);cv.height=Math.round(im.height*k);
      cv.getContext('2d').drawImage(im,0,0,cv.width,cv.height);cfImg=cv.toDataURL('image/jpeg',.68);URL.revokeObjectURL(im.src);
      $('cfPrev').src=cfImg;$('cfPrev').style.display='block';$('cfPicB').textContent='📷 retake'};
    im.src=URL.createObjectURL(fl)};
  $('cfOk').onclick=()=>{const n=$('cfN').value.trim();const g=+$('cfG').value||100;const v=k=>(+$('cf'+k).value||0)*100/g;if(!n||!$('cfK').value){$('cfN').focus();return}
    const f={id:'c-'+rid(),n,b:$('cfB').value.trim(),k:v('K'),p:v('P'),c:v('C'),f:v('F'),fi:v('Fi'),su:v('Su'),na:v('Na'),sv:[[$('cfS').value.trim()||'serving',g],['100 g',100]],code:pre.code||'',src:'mine',img:cfImg};
    FLIB.custom.unshift(f);saveLib();fPortion(f,{meal,isNew:true})}}

/* barcode: native BarcodeDetector where available, otherwise ZXing (loaded only when you scan) */
let fStream=null,fZX=null;
function fScanStop(){try{fZX&&fZX.reset()}catch(e){}fZX=null;if(fStream){fStream.getTracks().forEach(t=>t.stop());fStream=null}}
async function fScan(meal){openSheet('scan barcode',`<div class="fscan"><video id="fsV" playsinline muted></video><i class="fsline"></i></div><div class="dim" id="fsMsg" style="margin-top:8px">point the camera at the barcode…</div><div class="row" style="gap:8px;margin-top:8px"><input class="inp num" id="fsCode" placeholder="Or type the barcode number" inputmode="numeric" style="flex:1"><button class="btn" type="button" id="fsGo">Look up</button></div>`);
  const done=async code=>{fScanStop();$('fsMsg').textContent='looking up '+code+'…';const items=await offCall({code});const f=items&&items[0]?offToFood(items[0]):null;
    if(f){FCACHE[f.id]=f;fPortion(f,{meal,isNew:true})}else{$('fsMsg').innerHTML='Not in the database yet — <button class="iconbtn" type="button" id="fsNew">Create it</button>';$('fsNew').onclick=()=>fCreate(meal,{code})}};
  $('fsGo').onclick=()=>{const c=$('fsCode').value.replace(/\D/g,'');if(c)done(c)};
  const obs=new MutationObserver(()=>{if(!$('fsV')){fScanStop();obs.disconnect()}});obs.observe($('sheetBody'),{childList:true});
  $('sheetX')&&$('sheetX').addEventListener('click',fScanStop,{once:true});
  try{const v=$('fsV');
    if('BarcodeDetector' in window){fStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});v.srcObject=fStream;await v.play();const det=new BarcodeDetector({formats:['ean_13','ean_8','upc_a','upc_e']});
      const loop=async()=>{if(!fStream||!$('fsV'))return;try{const r=await det.detect(v);if(r[0]){done(r[0].rawValue);return}}catch(e){}requestAnimationFrame(loop)};loop()}
    else{if(!window.ZXing)await new Promise((res,rej)=>{const s=document.createElement('script');s.src='vendor/zxing.min.js';s.onload=res;s.onerror=rej;document.head.appendChild(s)});
      const hints=new Map();hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS,[ZXing.BarcodeFormat.EAN_13,ZXing.BarcodeFormat.EAN_8,ZXing.BarcodeFormat.UPC_A,ZXing.BarcodeFormat.UPC_E]);
      fZX=new ZXing.BrowserMultiFormatReader(hints);fZX.decodeFromConstraints({video:{facingMode:'environment'}},'fsV',(res)=>{if(res&&fZX){const c=res.getText();done(c)}})}}
  catch(e){$('fsMsg').textContent='Camera unavailable — type the barcode number instead.'}}

function fExercise(){const kg=curKg();openSheet('add exercise',`<div class="fexl">${FEX.map(([n,met],i)=>`<button type="button" class="chip" data-fxp="${i}">${n}</button>`).join('')}</div>
  <div class="fgrid4" style="margin-top:10px"><label class="fl">Activity<input class="inp" id="exN" value="weights / gym"></label><label class="fl">Minutes<input class="inp num" id="exM" inputmode="numeric" value="60"></label><label class="fl">Kcal burned<input class="inp num" id="exK" inputmode="numeric"></label></div>
  <div class="dim" style="font-size:11px">kcal is estimated from the activity, time and your weight (${r1(kg)} kg) — overwrite it if your watch says different.</div>
  <div class="bigbtns" style="margin-top:12px"><span style="flex:1"></span><button class="btn p" type="button" id="exOk">Add</button></div>`);
  let met=5;const est=()=>{$('exK').value=Math.round(met*kg*(+$('exM').value||0)/60)};est();
  $('sheetBody').onclick=e=>{const b=e.target.closest('[data-fxp]');if(!b)return;const p=FEX[+b.dataset.fxp];met=p[1];$('exN').value=p[0];est()};
  $('exM').oninput=est;
  $('exOk').onclick=()=>{const x=fDay(FD);(x.ex=x.ex||[]).push({id:rid(),n:$('exN').value.trim()||'exercise',min:+$('exM').value||0,k:Math.round(+$('exK').value||0)});saveDay(FD);closeSheet();fLog()}}

/* ---------- progress: weight, calories, macros, streak, insights ---------- */
function fProgress(){const el=$('foodBody');const P=FPROF||{},B=fBudget(),T=fTargets();
  const ws=((typeof WT!=='undefined'&&WT.r)||[]).slice(-60);const startKg=+P.startKg||(ws[0]&&+ws[0].kg)||curKg(),goal=+P.goalKg||0,now=curKg();
  const days=[...Array(14)].map((_,i)=>{const d=new Date(DAYK+'T12:00');d.setDate(d.getDate()-13+i);const k=ymd(d);const it=FDAYS[k]?dayItems(k):[];const s=fSum(it);const ex=FDAYS[k]&&!(P.noEx)?exKcal(k):0;return {k,kcal:s.kcal,p:s.p,c:s.c,f:s.f,b:B+ex,has:it.length>0}});
  const wk=days.slice(-7),logged=wk.filter(d=>d.has);const wkEat=logged.reduce((a,d)=>a+d.kcal,0),wkBud=logged.reduce((a,d)=>a+d.b,0);
  let streak=0;for(let i=0;i<400;i++){const d=new Date(DAYK+'T12:00');d.setDate(d.getDate()-i);const k=ymd(d);if(FDAYS[k]&&dayItems(k).length)streak++;else if(i>0)break}
  const avg=k=>logged.length?logged.reduce((a,d)=>a+d[k],0)/logged.length:0;const ap=avg('p'),ac=avg('c'),af=avg('f'),tot=ap*4+ac*4+af*9||1;
  const mx=Math.max(...days.map(d=>Math.max(d.kcal,d.b)),1);
  const need=goal?now-goal:0,rate=Math.abs(+P.rate||0);const eta=goal&&rate&&Math.sign(need)===Math.sign(-(+P.rate))?new Date(Date.now()+Math.abs(need)/rate*7*864e5):null;
  const top={};Object.keys(FDAYS).filter(k=>k>ymd(new Date(Date.now()-30*864e5))).forEach(k=>dayItems(k).forEach(e=>{const n=e.n;top[n]=(top[n]||0)+fNum(e,'k')}));const tops=Object.entries(top).sort((a,b)=>b[1]-a[1]).slice(0,5);
  el.innerHTML=`<div class="statcards"><div class="panel"><div class="pb"><span class="dim">Current</span><b class="num">${r1(now)} kg</b></div></div><div class="panel"><div class="pb"><span class="dim">${now<=startKg?'lost':'gained'}</span><b class="num ${now<=startKg?'ok':''}">${r1(Math.abs(startKg-now))} kg</b></div></div><div class="panel"><div class="pb"><span class="dim">Goal</span><b class="num">${goal?r1(goal)+' kg':'—'}</b></div></div><div class="panel"><div class="pb"><span class="dim">Logging streak</span><b class="num pink">${streak} 🔥</b></div></div></div>
  <div class="panel"><div class="ph"><span class="tag">Weight</span><span class="dim">${eta?'on pace for goal ~'+eta.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}).toLowerCase():'log weight on today ↓'}</span></div><div class="pb">${typeof spark==='function'?spark(ws.map(x=>+x.kg),{refs:goal?[{v:goal,l:'goal'}]:[]}):''}
    <form class="row" id="fWt" style="gap:6px;margin-top:8px"><input class="inp num" id="fWtIn" inputmode="decimal" placeholder="Weigh in (kg)" style="flex:1"><button class="btn p" type="submit">Log</button></form></div></div>
  <div class="panel"><div class="ph"><span class="tag">Calories · last 14 days</span><span class="dim num">this week ${logged.length?(wkEat<=wkBud?gbp0(wkBud-wkEat)+' under':gbp0(wkEat-wkBud)+' over'):'—'}</span></div><div class="pb"><div class="fbars">${days.map(d=>`<div class="${d.k===DAYK?'on':''}"><span class="b ${d.kcal>d.b?'over':''}" style="height:${d.kcal/mx*100}%"></span><i style="bottom:${d.b/mx*100}%"></i><span class="l">${new Date(d.k+'T12:00').toLocaleDateString('en-GB',{weekday:'narrow'})}</span></div>`).join('')}</div>
    <div class="dim" style="font-size:11px;margin-top:6px">dashed line = your budget that day (incl. exercise) · ${logged.length} of 7 days logged this week · ${Math.round(wkEat)} eaten of ${Math.round(wkBud)} budgeted</div></div></div>
  <div class="grid2"><div class="panel"><div class="ph"><span class="tag">Macros · 7-day average</span></div><div class="pb fdonut"><svg viewBox="0 0 42 42">${(()=>{let o=25;return [[ap*4,'var(--pink)'],[ac*4,'var(--cyan)'],[af*9,'#ffb000']].map(([v,c])=>{const p=v/tot*100;const s=`<circle cx="21" cy="21" r="15.9" fill="none" stroke="${c}" stroke-width="5" stroke-dasharray="${p} ${100-p}" stroke-dashoffset="${o}"/>`;o-=p;return s}).join('')})()}</svg>
    <div class="num"><div><b style="color:var(--pink)">${Math.round(ap)} g</b> protein <span class="dim">/ ${T.p} · ${Math.round(ap*4/tot*100)}%</span></div><div><b style="color:var(--cyan)">${Math.round(ac)} g</b> carbs <span class="dim">/ ${T.c} · ${Math.round(ac*4/tot*100)}%</span></div><div><b style="color:#ffb000">${Math.round(af)} g</b> fat <span class="dim">/ ${T.f} · ${Math.round(af*9/tot*100)}%</span></div></div></div></div>
  <div class="panel"><div class="ph"><span class="tag">Insights</span></div><div class="pb fins">${logged.length?[ap<T.p*0.9?`protein is averaging <b>${Math.round(ap)} g</b> — ${Math.round(T.p-ap)} g a day under your target`:`protein on target — averaging <b>${Math.round(ap)} g</b>`,`average day: <b>${Math.round(wkEat/Math.max(1,logged.length))} kcal</b> vs a <b>${B}</b> budget`,tops.length?`biggest calorie sources this month: ${tops.map(([n,k])=>`<b>${esc(n)}</b> (${Math.round(k)})`).join(', ')}`:''].filter(Boolean).map(t=>`<div>▸ ${t}</div>`).join(''):'<div class="dim">Log a few days and patterns show up here.</div>'}</div></div></div>`;
  $('fWt').onsubmit=e=>{e.preventDefault();const kg=parseFloat($('fWtIn').value.replace(',','.'));if(!kg)return;WT.r.push({t:new Date().toISOString(),kg});save('body/wt',WT);if(typeof renderBody==='function')renderBody();fProgress()}}
const gbp0=n=>Math.round(n)+' kcal';

/* ---------- fasting ---------- */
function fFast(){const el=$('foodBody');const P=FPROF||{};const H=+P.fastH||16;const c=FFAST.cur;const now=Date.now();
  const el_=c?(now-new Date(c.s))/36e5:0;const pct=Math.min(1,el_/(c?c.h:H));const R=86,C=2*Math.PI*R;
  const zone=h=>h<4?'fed — digesting':h<12?'early fast':h<16?'fat-burning window':h<24?'deep fast':'extended fast';
  el.innerHTML=`<div class="panel ffast"><div class="pb"><div class="fdring big"><svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="${R}" class="rb"/><circle cx="100" cy="100" r="${R}" class="rf" style="stroke-dasharray:${C};stroke-dashoffset:${C*(1-pct)}"/></svg><div><span class="dim">${c?'fasting':'not fasting'}</span><b class="num" id="ffT">${c?fmtH(el_):H+':00'}</b><span class="dim" id="ffZ">${c?zone(el_):'target'}</span></div></div>
    ${c?`<div class="dim num" style="text-align:center">started ${new Date(c.s).toLocaleString('en-GB',{weekday:'short',hour:'2-digit',minute:'2-digit'})} · goal ${c.h} h · ends ${new Date(new Date(c.s).getTime()+c.h*36e5).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</div>`:''}
    <div class="seg mini" id="ffH" style="justify-content:center;margin:12px 0">${[12,14,16,18,20,24].map(h=>`<button type="button" data-ffh="${h}" aria-pressed="${(c?c.h:H)===h}">${h===24?'OMAD':h+':'+(24-h)}</button>`).join('')}</div>
    <div class="bigbtns" style="justify-content:center"><button class="btn p" type="button" id="ffGo">${c?'end fast':'start fast'}</button>${c?'':'<button class="btn" type="button" id="ffBack">started earlier…</button>'}</div></div></div>
  <div class="panel"><div class="ph"><span class="tag">Recent fasts</span><span class="dim">${FFAST.log.length} logged</span></div><div class="pb">${FFAST.log.slice(-10).reverse().map(f=>{const h=(new Date(f.e)-new Date(f.s))/36e5;return `<div class="frow" style="cursor:default"><span><b>${new Date(f.s).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}).toLowerCase()}</b><span class="dim">goal ${f.h} h</span></span><span class="num ${h>=f.h?'ok':''}">${fmtH(h)} ${h>=f.h?'✓':''}</span></div>`}).join('')||'<div class="dim">No fasts yet.</div>'}</div></div>`;
  el.onclick=e=>{const b=e.target.closest('button');if(!b)return;
    if(b.dataset.ffh){const h=+b.dataset.ffh;if(FFAST.cur){FFAST.cur.h=h;save('food/fast',FFAST)}else{FPROF={...(FPROF||{}),fastH:h};save('food/profile',FPROF)}fFast();return}
    if(b.id==='ffGo'){if(FFAST.cur){FFAST.log.push({...FFAST.cur,e:new Date().toISOString()});FFAST.log=FFAST.log.slice(-200);FFAST.cur=null}else FFAST.cur={s:new Date().toISOString(),h:H};save('food/fast',FFAST);if(FFAST.cur&&nOn('fast'))pushOne('fast',new Date(FFAST.cur.s).getTime()+FFAST.cur.h*36e5,'Fasting goal reached',FFAST.cur.h+' h complete. Break your fast when ready.','./#food');else pushCancel('fast');fFast();return}
    if(b.id==='ffBack'){const t=prompt('when did you start? (HH:MM)','20:00');if(!t||!/^\d{1,2}:\d{2}$/.test(t))return;const [hh,mm]=t.split(':').map(Number);const d=new Date();d.setHours(hh,mm,0,0);if(d>new Date())d.setDate(d.getDate()-1);FFAST.cur={s:d.toISOString(),h:H};save('food/fast',FFAST);fFast()}};
  clearInterval(fFast.t);if(c)fFast.t=setInterval(()=>{if(!$('ffT')||FV!=='fast'||!FFAST.cur){clearInterval(fFast.t);return}const h=(Date.now()-new Date(FFAST.cur.s))/36e5;$('ffT').textContent=fmtH(h);$('ffZ').textContent=zone(h)},1000)}
const fmtH=h=>{const s=Math.max(0,Math.floor(h*3600));return Math.floor(s/3600)+':'+pad(Math.floor(s%3600/60))+':'+pad(s%60)};

/* ---------- goals ---------- */
function fGoals(){const el=$('foodBody');const P={sex:'m',age:'',hcm:'',kg:curKg(),goalKg:'',rate:-0.5,act:1.375,mmode:'pct',mp:35,mc:35,mf:30,gp:'',gc:'',gf:'',water:2500,fib:30,na:2300,fastH:16,...(FPROF||{})};
  const sel=(id,opts,v)=>`<select class="inp" id="${id}">${opts.map(([k,l])=>`<option value="${k}" ${String(k)===String(v)?'selected':''}>${l}</option>`).join('')}</select>`;
  el.innerHTML=`${FPROF?'':'<div class="panel"><div class="pb"><b>Set up your calorie budget</b><div class="dim">A few details and the app works out your daily budget and macros, the same way Lose It does.</div></div></div>'}
  <div class="grid2"><div class="panel"><div class="ph"><span class="tag">You</span></div><div class="pb fform">
    <label class="fl">sex${sel('gSex',[['m','male'],['f','female']],P.sex)}</label><label class="fl">Age<input class="inp num" id="gAge" inputmode="numeric" value="${P.age}"></label>
    <label class="fl">Height (cm)<input class="inp num" id="gH" inputmode="decimal" value="${P.hcm}"></label><label class="fl">Current weight (kg)<input class="inp num" id="gKg" inputmode="decimal" value="${r1(P.kg)}"></label>
    <label class="fl">Goal weight (kg)<input class="inp num" id="gGoal" inputmode="decimal" value="${P.goalKg}"></label><label class="fl">plan${sel('gRate',FRATE,P.rate)}</label>
    <label class="fl" style="grid-column:1/-1">activity (outside logged exercise)${sel('gAct',FACT,P.act)}</label>
    <label class="fl" style="grid-column:1/-1"><span><input type="checkbox" id="gNoEx" ${P.noEx?'':'checked'}> add logged exercise calories back to my budget</span></label></div></div>
  <div class="panel"><div class="ph"><span class="tag">Daily budget</span></div><div class="pb"><div class="fdbig num" id="gOut"></div>
    <label class="fl">Override budget (optional)<input class="inp num" id="gOv" inputmode="numeric" value="${P.override||''}" placeholder="Auto"></label>
    <div class="seg mini" id="gMode" style="margin:10px 0">${[['pct','macro %'],['g','macro grams']].map(([k,l])=>`<button type="button" data-gm="${k}" aria-pressed="${P.mmode===k}">${l}</button>`).join('')}</div>
    <div class="fgrid4" id="gMac"></div>
    <div class="fgrid4" style="margin-top:6px"><label class="fl">Water ml<input class="inp num" id="gW" value="${P.water}"></label><label class="fl">Fibre g<input class="inp num" id="gFi" value="${P.fib}"></label><label class="fl">Sodium mg<input class="inp num" id="gNa" value="${P.na}"></label></div>
    <div class="bigbtns" style="margin-top:12px"><span style="flex:1"></span><button class="btn p" type="button" id="gSave">Save goals</button></div></div></div></div>`;
  let mode=P.mmode;const macHtml=()=>{$('gMac').innerHTML=mode==='pct'?`<label class="fl">protein %<input class="inp num" id="gMp" value="${P.mp}"></label><label class="fl">carbs %<input class="inp num" id="gMc" value="${P.mc}"></label><label class="fl">fat %<input class="inp num" id="gMf" value="${P.mf}"></label>`:`<label class="fl">Protein g<input class="inp num" id="gGp" value="${P.gp||fTargets().p}"></label><label class="fl">Carbs g<input class="inp num" id="gGc" value="${P.gc||fTargets().c}"></label><label class="fl">Fat g<input class="inp num" id="gGf" value="${P.gf||fTargets().f}"></label>`};macHtml();
  const read=()=>{const v=id=>$(id)?$(id).value:'';const n={...P,sex:v('gSex'),age:+v('gAge')||'',hcm:+v('gH')||'',kg:+v('gKg')||P.kg,goalKg:+v('gGoal')||'',rate:+v('gRate'),act:+v('gAct'),noEx:!$('gNoEx').checked,override:+v('gOv')||null,mmode:mode,water:+v('gW')||2500,fib:+v('gFi')||30,na:+v('gNa')||2300};
    if(mode==='pct'){n.mp=+v('gMp')||35;n.mc=+v('gMc')||35;n.mf=+v('gMf')||30}else{n.gp=+v('gGp')||0;n.gc=+v('gGc')||0;n.gf=+v('gGf')||0}if(!n.startKg)n.startKg=n.kg;return n};
  const show=()=>{const keep=FPROF;FPROF=read();const b=fBudget(),t=fTargets();FPROF=keep;const sum=mode==='pct'?(+$('gMp').value||0)+(+$('gMc').value||0)+(+$('gMf').value||0):100;
    $('gOut').innerHTML=`<b>${b}</b><span> kcal / day</span><div class="dim" style="font-size:12px">protein ${t.p} g · carbs ${t.c} g · fat ${t.f} g${sum!==100?` · <span class="bad">macros add to ${sum}%</span>`:''}</div>`};show();
  el.oninput=show;el.onchange=show;
  el.onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.gm){mode=b.dataset.gm;el.querySelectorAll('[data-gm]').forEach(z=>z.setAttribute('aria-pressed',z===b));macHtml();show();return}
    if(b.id==='gSave'){const n=read();if(!n.age||!n.hcm){(!n.age?$('gAge'):$('gH')).focus();return}const kgChanged=Math.abs(n.kg-curKg())>0.05;FPROF=n;save('food/profile',FPROF);
      if(kgChanged&&typeof WT!=='undefined'){WT.r.push({t:new Date().toISOString(),kg:n.kg});save('body/wt',WT)}FV='log';LS.set('foodv',FV);renderFood()}}}

/* ================= SLEEP =================
   Tracking comes from your Apple Watch: an iPhone Shortcut sends last night's Apple Health sleep to the
   "sleep-in" function every morning → doc sleep/w-YYYY-MM-DD {start,end,asleep,deep,rem,core,awake,segs,mood,tags}.
   Waking: your normal iPhone alarm rings; a Shortcut automation ("when alarm is stopped → open URL") opens
   #wake here, which keeps ringing until an Alarmy-style mission is done. */
const SMISS=[['math','maths'],['shake','shake'],['type','type a phrase'],['scan','scan a barcode']];
const SSND=[['rise','rising chime'],['classic','classic beeps'],['siren','siren']];
const STAGS=['gym','caffeine late','alcohol','late meal','screens in bed','stressed','melatonin','magnesium','nap','fasted cardio'];
const SPHRASE=['I am awake and I am getting up now','Discipline is doing it when you do not feel like it','Get out of bed and win the morning','Everybody wants it until it is time to wake up'];
const SFN='https://ucnwefjblxqbmmwdbqhw.supabase.co/functions/v1/sleep-in';
let SHEALTH={};let SSET=null,SNIGHTS={},SV=({recovery:'sleep',last:'sleep',history:'sleep'})[LS.get('sleepv')]||LS.get('sleepv')||'sleep',sleepLoaded=false,SCFG=null;
const fmtHM=m=>{m=Math.round(m||0);return Math.floor(m/60)+'h '+pad(m%60)+'m'};
async function loadSleep(){if(sleepLoaded){renderSleep();return}
  const [s,rows,c,hr]=await Promise.all([load('sleep/settings'),listDocs('sleep/w-'),load('sleep/cfg'),listDocs('health/d-')]);hr.forEach(r=>{if(r.data)SHEALTH[r.path.slice(9)]=r.data});
  SSET={wake:'07:30',bed:'23:00',goal:8,miss:'math',diff:2,shakes:30,snd:'rise',code:'',...(s||{})};SCFG=c||{};
  rows.forEach(r=>{if(r.data)SNIGHTS[r.path.slice(8)]=r.data});sleepLoaded=true;renderSleep()}
watchPrefix('health/d-',(evt,path,data)=>{const k=path.slice(9);if(evt==='DELETE')delete SHEALTH[k];else if(data)SHEALTH[k]=data;if(cur==='sleep'&&SV!=='setup')renderSleep()});
watchPrefix('sleep/w-',(evt,path,data)=>{const k=path.slice(8);if(evt==='DELETE')delete SNIGHTS[k];else if(data)SNIGHTS[k]=data;if(cur==='sleep'&&!$('sheet').classList.contains('on'))renderSleep()});
const saveSS=()=>save('sleep/settings',SSET);
/* Sleep score 0–100, modelled on Oura / Fitbit / Apple: amounts (not %) of sleep dominate, so a short night can't score well.
   duration 40 · deep 15 · REM 15 · efficiency 10 · awake/restfulness 10 · timing 10. */
const sCl=x=>Math.max(0,Math.min(1,x));
function sQB(n){if(!n||!n.asleep)return null;const g=(SSET&&SSET.goal||8)*60,a=n.asleep,r=a/g;
  const dur=r>=1?(r>1.35?Math.max(.85,1-(r-1.35)):1):Math.pow(sCl((r-.4)/.6),1.1);
  const hasSt=(n.deep||0)+(n.rem||0)+(n.core||0)>0;
  const deep=sCl((n.deep||0)/(g*.16)),rem=sCl((n.rem||0)/(g*.1875));
  const bed=n.start&&n.end?(new Date(n.end)-new Date(n.start))/6e4:0;
  const eff=bed>a?sCl((a/bed-.75)/.17):1; /* share of time in bed asleep: 92%+ full, 75% zero */
  const aw=sWakes(n)!=null?sCl(1-(sWakes(n)-2)/10):sCl(1-((n.awake||0)-20)/70); /* wake-ups: ≤2 full, 12+ zero */
  let tim=1;if(n.start){const d=new Date(n.start),b=d.getHours()*60+d.getMinutes(),[h,m]=sBedFor().split(':').map(Number);let off=Math.abs(b-(h*60+m));off=Math.min(off,1440-off);tim=sCl(1-(off-30)/120)}
  const wk=sWakes(n),offM=n.start?Math.round(Math.abs((()=>{const d=new Date(n.start),b=d.getHours()*60+d.getMinutes(),[h,m]=sBedFor().split(':').map(Number);let o=Math.abs(b-(h*60+m));return Math.min(o,1440-o)})())):0;
  const P=[['Duration',dur,40,fmtHM(a)],['Deep',deep,15,Math.round(n.deep||0)+'m'],['REM',rem,15,Math.round(n.rem||0)+'m'],['Efficiency',eff,10,bed?Math.round(a/bed*100)+'% asleep':''],['Restfulness',aw,10,wk!=null?wk+' wake-up'+(wk===1?'':'s'):Math.round(n.awake||0)+'m awake'],['Timing',tim,10,n.start?offM+'m off':'']].filter(x=>hasSt||(x[0]!=='Deep'&&x[0]!=='REM'));
  const W=P.reduce((t,x)=>t+x[2],0);return {parts:P,score:Math.round(P.reduce((t,x)=>t+x[1]*x[2],0)/W*100)}}
/* one clean timeline from overlapping sources (Watch + phone): at every moment the most specific stage wins, gaps count as awake, blips under 3 min fold into their neighbour */
function sNorm(segs){const g=(segs||[]).map(([a,b,st])=>[+new Date(a),+new Date(b),st]).filter(x=>x[1]>x[0]);if(!g.length)return [];
  const P={deep:4,rem:3,awake:2,core:1};const bs=[...new Set(g.flatMap(x=>[x[0],x[1]]))].sort((a,b)=>a-b);const out=[];
  for(let i=0;i<bs.length-1;i++){const a=bs[i],b=bs[i+1];let best=null;for(const x of g)if(x[0]<=a&&x[1]>=b&&(!best||(P[x[2]]||0)>(P[best]||0)))best=x[2];const st=best||'awake';const l=out[out.length-1];if(l&&l[2]===st&&l[1]===a)l[1]=b;else out.push([a,b,st])}
  for(let k=0;k<3;k++)for(let i=out.length-1;i>=0;i--){if(out.length<2)break;if(out[i][1]-out[i][0]<18e4){const prev=out[i-1],next=out[i+1];if(prev){prev[1]=out[i][1];out.splice(i,1);if(next&&next[2]===prev[2]){prev[1]=next[1];out.splice(i,1)}}else if(next){next[0]=out[i][0];out.splice(i,1)}}}
  return out}
function sWakes(n){const g=sNorm(n.segs);const sl=g.filter(x=>x[2]!=='awake');if(!sl.length)return null;
  const t0=sl[0][0],t1=sl[sl.length-1][1];let c=0,end=-1;g.forEach(([a,b,st])=>{if(st!=='awake'||a<t0||b>t1)return;if(a-end>6e4)c++;end=b});return c}
function sQ(n){const b=sQB(n);return b?b.score:0}
function renderSleep(){if(!sleepLoaded){loadSleep();return}
  document.querySelectorAll('#sleepSeg [data-sv]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.sv===SV));
  const last=Object.keys(SNIGHTS).sort().pop();$('sleepSub').textContent=last?`${esc(nice(last))} · ${fmtHM(SNIGHTS[last].asleep)} · ${sQ(SNIGHTS[last])}%`:'apple watch sleep + wake-up missions';
  ({sleep:sMain,stats:sTrends,setup:sSetup}[SV]||sMain)()}
document.addEventListener('click',e=>{const b=e.target.closest('#sleepSeg [data-sv]');if(!b)return;SV=b.dataset.sv;LS.set('sleepv',SV);renderSleep()});

/* ---------- shared UI pieces ---------- */
const SLC={awake:'#ff7a6b',rem:'#5ac8fa',core:'#4f7cff',deep:'#8e5cff'},SLN={awake:'Awake',rem:'REM',core:'Core',deep:'Deep'};
const sQC=q=>q>=75?'#30d158':q>=50?'#ffd60a':'#ff453a';
const sT=d=>{const x=new Date(d);return pad(x.getHours())+':'+pad(x.getMinutes())};
const sRing=(v,col,size,sw,inner)=>{const r=50-sw/2;return `<div class="sl-ring" style="width:${size}px;height:${size}px"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="${r}" class="tr" stroke-width="${sw}"/>${v>0?`<circle cx="50" cy="50" r="${r}" class="fl" stroke="${col}" stroke-width="${sw}" pathLength="100" stroke-dasharray="${Math.min(100,v).toFixed(1)} 100"/>`:''}</svg><div class="in">${inner}</div></div>`};
const sStBar=n=>`<div class="sl-stbar">${['awake','rem','core','deep'].map(s=>`<i style="flex:${Math.max(0,n[s]||0)};background:${SLC[s]}"></i>`).join('')}</div>`;
const sEmpty=(t,d,btn)=>`<div class="sl-card sl-empty"><svg viewBox="0 0 24 24" width="34" height="34"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg><b>${t}</b><p>${d}</p>${btn?`<button class="btn p" type="button" data-go="setup">${btn}</button>`:''}</div>`;
const sGoSetup=el=>{el.onclick=e=>{if(e.target.closest('[data-go]')){SV='setup';renderSleep()}}};

/* hypnogram from watch stages */
function sHyp(n,h=120){const segs=n.segs||[];if(!segs.length)return '<div class="sl-note">No stage data for this night</div>';const t0=+new Date(n.start),t1=+new Date(n.end),W=1000,L={awake:0,rem:1,core:2,deep:3};
  const lh=h/4,X=t=>((t-t0)/(t1-t0||1))*W;
  const rects=segs.map(([s,e,st])=>{const l=L[st]??2;return `<rect x="${X(+new Date(s)).toFixed(1)}" y="${(l*lh+lh*.18).toFixed(1)}" width="${Math.max(2,X(+new Date(e))-X(+new Date(s))).toFixed(1)}" height="${(lh*.64).toFixed(1)}" fill="${SLC[st]||SLC.core}" rx="3"/>`}).join('');
  const mid=sT(t0+(t1-t0)/2);
  return `<div class="sl-hyp"><div class="sl-hyl">${['awake','rem','core','deep'].map(s=>`<span>${SLN[s]}</span>`).join('')}</div><div><svg viewBox="0 0 ${W} ${h}" preserveAspectRatio="none" style="height:${h}px">${[1,2,3].map(i=>`<line x1="0" x2="${W}" y1="${i*lh}" y2="${i*lh}" stroke="rgba(255,255,255,.06)" vector-effect="non-scaling-stroke"/>`).join('')}${rects}</svg><div class="sl-axis"><span>${sT(n.start)}</span><span>${mid}</span><span>${sT(n.end)}</span></div></div></div>`}
function sNight(k){const n=SNIGHTS[k];const q=sQ(n);const a=n.asleep||1;const pc=x=>Math.round((n[x]||0)/a*100);
  return `<div class="sl-card sl-night" data-sn="${k}">
    <div class="sl-nh"><div><div class="sl-eyebrow">${esc(nice(k))}</div><div class="sl-dur num">${fmtHM(n.asleep).replace(/(\d+)h (\d+)m/,'$1<small>h</small> $2<small>m</small>')}</div><div class="sl-sub">asleep · ${sT(n.start)} – ${sT(n.end)}</div></div>${sRing(q,sQC(q),64,10,`<b class="num">${q}</b><span>Score</span>`)}</div>
    ${sStBar(n)}
    <div class="sl-legend">${['awake','rem','core','deep'].map(s=>`<div><i style="background:${SLC[s]}"></i><span>${SLN[s]}</span><b class="num">${s==='awake'?Math.round(n.awake||0)+'m':fmtHM(n[s])}</b><em class="num">${s==='awake'?'':pc(s)+'%'}</em></div>`).join('')}</div>
    ${sHyp(n,112)}${sQBars(n)}</div>`}
function sQBars(n){const b=sQB(n);if(!b)return '';return `<div class="sl-qb">${b.parts.map(([l,v,,x])=>{const p=Math.round(v*100);return `<div><span>${l}<small>${x||''}</small></span><i><b style="width:${p}%;background:${sQC(p)}"></b></i><em class="num">${p}</em></div>`}).join('')}</div>`}
function sRow(k){const n=SNIGHTS[k];const q=sQ(n);
  return `<button type="button" class="sl-hrow" data-sn="${k}"><span class="sl-hd"><b>${esc(nice(k))}</b><small class="num">${n.start?sT(n.start)+' – '+sT(n.end):''}</small></span><span class="sl-hbar">${sStBar(n)}</span><span class="sl-hv num">${fmtHM(n.asleep)}</span><span class="sl-pill num" style="--c:${sQC(q)}">${q}</span><svg class="sl-chev" viewBox="0 0 8 14" width="7" height="12"><path d="M1 1l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`}
function sLast(){const el=$('sleepBody');const k=Object.keys(SNIGHTS).sort().pop();
  if(!k){el.innerHTML=sEmpty('No nights yet','Wear your Apple Watch to bed and finish the one-time setup — every morning your sleep lands here automatically.','Open setup');sGoSetup(el);return}
  const n=SNIGHTS[k];
  el.innerHTML=sNight(k)+`<div class="sl-card"><div class="sl-h"><span>How do you feel?</span></div><div class="sl-mood">${['😫','😕','😐','🙂','😁'].map((m,i)=>`<button type="button" data-mood="${i+1}" aria-pressed="${n.mood===i+1}">${m}</button>`).join('')}</div>
    <div class="sl-h" style="margin-top:18px"><span>Sleep notes</span></div><div class="chips" style="margin:0">${STAGS.map(t=>`<button type="button" class="chip${(n.tags||[]).includes(t)?' on':''}" data-tag="${esc(t)}">${t}</button>`).join('')}</div></div>
    <div class="sl-card sl-tonight"><span class="sl-ico"><svg viewBox="0 0 24 24" width="20" height="20"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" fill="currentColor"/></svg></span><div><div class="sl-sub">Tonight</div><b>Be asleep by <span class="num">${sBedFor()}</span></b><div class="sl-sub">${SSET.goal} h goal · ${SSET.wake} wake-up${SSET.bedOn?' · reminder 30 min before':''}</div></div></div>`;
  el.onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.mood){n.mood=+b.dataset.mood;save('sleep/w-'+k,n);sLast();return}
    if(b.dataset.tag){const t=b.dataset.tag;n.tags=(n.tags||[]).includes(t)?n.tags.filter(x=>x!==t):(n.tags||[]).concat(t);save('sleep/w-'+k,n);sLast()}}}
function sBedFor(){const [h,m]=SSET.wake.split(':').map(Number);let t=h*60+m-SSET.goal*60;t=(t+1440)%1440;return pad(Math.floor(t/60))+':'+pad(t%60)}
function sHistory(){const el=$('sleepBody');const ks=Object.keys(SNIGHTS).sort().reverse();
  if(!ks.length){el.innerHTML=sEmpty('No nights yet','Your synced nights will be listed here.','Open setup');sGoSetup(el);return}
  el.innerHTML=`<div class="sl-card sl-list">${ks.map(sRow).join('')}</div>`;
  el.onclick=e=>{const c=e.target.closest('[data-sn]');if(!c)return;const k=c.dataset.sn;openSheet(nice(k).toLowerCase(),sNight(k)+`<div class="bigbtns"><button class="btn d" type="button" id="snDel">Delete night</button><span style="flex:1"></span><button class="btn p" type="button" id="snOk">Done</button></div>`);
    $('snOk').onclick=closeSheet;$('snDel').onclick=function(){if(!this.dataset.arm){this.dataset.arm=1;this.textContent='Tap again to delete';return}delete SNIGHTS[k];removeDoc('sleep/w-'+k);closeSheet();renderSleep()}}}
function sStats(){const el=$('sleepBody');const N=Object.keys(SNIGHTS).sort().slice(-30).map(k=>({k,...SNIGHTS[k],q:sQ(SNIGHTS[k])}));
  if(!N.length){el.innerHTML=sEmpty('No stats yet','Stats appear after your first synced night.');el.onclick=null;return}
  const avg=f=>N.reduce((a,n)=>a+(+n[f]||0),0)/N.length;const bt=N.map(n=>{const d=new Date(n.start);let m=d.getHours()*60+d.getMinutes();if(m<720)m+=1440;return m});const wk=N.map(n=>{const d=new Date(n.end);return d.getHours()*60+d.getMinutes()});
  const sd=a=>{const m=a.reduce((x,y)=>x+y,0)/a.length;return Math.sqrt(a.reduce((x,y)=>x+(y-m)**2,0)/a.length)};const hm=m=>{m=Math.round(m)%1440;return pad(Math.floor(m/60))+':'+pad(m%60)};
  const L=N.slice(-14);const mx=Math.max(...L.map(n=>n.asleep||0),SSET.goal*60)*1.08;
  const tagI=STAGS.map(t=>{const w=N.filter(n=>(n.tags||[]).includes(t)),wo=N.filter(n=>!(n.tags||[]).includes(t));if(w.length<2||wo.length<2)return null;const d=w.reduce((a,n)=>a+n.q,0)/w.length-wo.reduce((a,n)=>a+n.q,0)/wo.length;return [t,Math.round(d),w.length]}).filter(Boolean).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1]));
  const debt=N.slice(-7).reduce((a,n)=>a+(SSET.goal*60-(n.asleep||0)),0);const aq=Math.round(avg('q'));const as=Math.max(1,avg('asleep'));
  const tile=(l,v,s,c)=>`<div class="sl-tile"><span>${l}</span><b class="num"${c?` style="color:${c}"`:''}>${v}</b>${s?`<em>${s}</em>`:''}</div>`;
  el.innerHTML=`<div class="sl-tiles sl-t4">${tile('Avg asleep',fmtHM(avg('asleep')),`goal ${SSET.goal}h`)}${tile('Avg score',aq+'%','',sQC(aq))}${tile('Avg bedtime',hm(bt.reduce((a,b)=>a+b,0)/bt.length),`±${Math.round(sd(bt))} min`)}${tile('7-day '+(debt>0?'debt':'surplus'),fmtHM(Math.abs(debt)),'',debt>0?'#ff453a':'#30d158')}</div>
  <div class="sl-card"><div class="sl-h"><span>Last ${L.length} nights</span><em>goal ${SSET.goal} h</em></div><div class="sl-cols" style="grid-template-columns:repeat(${L.length},1fr)"><em class="sl-goal" style="bottom:calc(22px + (100% - 22px) * ${(SSET.goal*60/mx).toFixed(3)})"></em>${L.map(n=>`<div><span class="stk" style="height:calc((100% - 22px) * ${((n.asleep||0)/mx).toFixed(3)})"><i style="flex:${n.rem||0};background:${SLC.rem}"></i><i style="flex:${n.core||0};background:${SLC.core}"></i><i style="flex:${n.deep||0};background:${SLC.deep}"></i></span><span class="l">${new Date(n.k+'T12:00').toLocaleDateString('en-GB',{weekday:'narrow'})}</span></div>`).join('')}</div>
    <div class="sl-keys">${['rem','core','deep'].map(s=>`<span><i style="background:${SLC[s]}"></i>${SLN[s]}</span>`).join('')}</div></div>
  <div class="sl-grid2"><div class="sl-card"><div class="sl-h"><span>Stages · average</span></div><div class="sl-rows">
    <div><span><i class="dot" style="background:${SLC.deep}"></i>Deep</span><b class="num">${fmtHM(avg('deep'))}<em>${Math.round(avg('deep')/as*100)}%</em></b></div>
    <div><span><i class="dot" style="background:${SLC.rem}"></i>REM</span><b class="num">${fmtHM(avg('rem'))}<em>${Math.round(avg('rem')/as*100)}%</em></b></div>
    <div><span><i class="dot" style="background:${SLC.awake}"></i>Awake</span><b class="num">${Math.round(avg('awake'))} min</b></div>
    <div><span>Bedtime consistency</span><b class="num">±${Math.round(sd(bt))} min</b></div>
    <div><span>Wake-up consistency</span><b class="num">±${Math.round(sd(wk))} min</b></div></div></div>
  <div class="sl-card"><div class="sl-h"><span>What affects your sleep</span></div>${tagI.length?`<div class="sl-rows">${tagI.map(([t,d,c])=>`<div><span>${esc(t)}<small>${c} nights</small></span><span class="sl-delta ${d>=0?'up':'dn'} num">${d>=0?'+':''}${d}%</span></div>`).join('')}</div>`:'<div class="sl-note">Tag a few mornings with sleep notes (gym, caffeine…) and this shows what helps or hurts.</div>'}</div></div>`;
  el.onclick=null}
/* ---------- setup: watch sync, wake-up mission, reminders ---------- */
function sSetup(){const el=$('sleepBody'),S=SSET;const tok=SCFG&&SCFG.token;const url=SFN+'?token='+(tok||'…');const wurl=location.origin+location.pathname+'#wake='+encodeURIComponent(JSON.stringify({m:S.miss,d:S.diff,n:S.shakes,c:S.code,s:S.snd}));
  const lastK=Object.keys(SNIGHTS).sort().pop();const synced=!!lastK;
  const link=(id,v)=>`<div class="sl-link"><code id="${id}">${esc(v)}</code><button class="btn sm" type="button" data-copy="${id}">Copy</button></div>`;
  el.innerHTML=`<div class="sl-sec">Apple Watch sync</div><div class="sl-card">
    <div class="sl-status"><i style="background:${synced?'#30d158':'#8e8e93'}"></i><div><b>${synced?'Connected':'Not set up yet'}</b><div class="sl-sub">${synced?'last night received '+esc(nice(lastK)):'finish the steps below once (~5 min)'}</div></div></div>
    <details class="sl-det"${synced?'':' open'}><summary>Shortcut steps</summary><ol class="sl-steps">
      <li>Wear your Watch to bed with <b>Sleep</b> on (Health → Sleep → set a schedule).</li>
      <li>Shortcuts → <b>+</b>, name it <b>Send sleep</b>. Add <b>Find Health Samples</b> — Type <i>Sleep</i>, Start Date is in the last <i>2 days</i>.</li>
      <li><b>Repeat with Each</b> → inside it a <b>Text</b>: <code>Start Date|End Date|Value</code> from <i>Repeat Item</i>, both dates as <i>ISO 8601</i> with time.</li>
      <li>After the repeat: <b>Combine Text</b> (Repeat Results) with <i>New Lines</i>.</li>
      <li>For recovery: <b>Find Health Samples</b> + <b>Calculate Statistics</b> for HRV (Average), Resting Heart Rate (Average), Respiratory Rate (Average) and Active Energy (Sum), each last 1 day.</li>
      <li>A <b>Text</b> with <code>Combined Text</code> then lines <code>HRV|…</code> <code>Resting Heart Rate|…</code> <code>Respiratory Rate|…</code> <code>Active Energy|…</code>, inserting each statistic.</li>
      <li><b>Get Contents of URL</b> — the link below, Method <i>POST</i>, Request Body <i>File</i> → that Text.</li>
      <li>Automation → <b>Time of Day</b> 10:00 daily → <b>Run Immediately</b> → Send sleep.</li></ol></details>
    <div class="sl-lab">Your private upload link</div>${tok?link('slUrl',url):'<div class="sl-note">Link not ready — reopen the app in a minute.</div>'}</div>
  <div class="sl-sec">Wake-up mission</div><div class="sl-card">
    <p class="sl-p">Your iPhone alarm rings as normal. Stopping it opens a mission that keeps ringing until you finish it.</p>
    <div class="sl-lab">Mission</div><div class="seg sl-seg">${SMISS.map(([k,l])=>`<button type="button" data-slm="${k}" aria-pressed="${S.miss===k}">${l}</button>`).join('')}</div>
    <div class="sl-opt">${S.miss==='math'?`<div class="sl-lab">Difficulty</div><div class="seg sl-seg">${[1,2,3].map(d=>`<button type="button" data-sld="${d}" aria-pressed="${S.diff===d}">${['easy','medium','hard'][d-1]}</button>`).join('')}</div>`:S.miss==='shake'?`<label class="sl-frow"><span>Shakes needed</span><input class="inp num" id="slShk" value="${S.shakes}" inputmode="numeric"></label>`:S.miss==='scan'?`<div class="sl-frow"><span>${S.code?`Barcode <b class="num">${esc(S.code)}</b>`:'No barcode registered'}</span><button class="btn sm" type="button" id="slReg">${S.code?'Change':'Register'}</button></div>`:'<div class="sl-note">You\'ll type a motivational line exactly.</div>'}</div>
    <div class="sl-lab">Sound</div><div class="seg sl-seg">${SSND.map(([k,l])=>`<button type="button" data-sls="${k}" aria-pressed="${S.snd===k}">${l}</button>`).join('')}</div>
    <div class="sl-btns"><button class="btn" type="button" id="slTest">Preview sound</button><button class="btn" type="button" id="slTry">Try the mission</button></div>
    <details class="sl-det"><summary>Alarm automation</summary><ol class="sl-steps"><li>Shortcuts → <b>Automation</b> → <b>+</b> → <b>Alarm</b> → <b>Is Stopped</b> (any alarm) → <b>Run Immediately</b>.</li><li>Action: <b>Open URLs</b> → paste the link below. Re-copy it if you change the mission.</li></ol></details>
    <div class="sl-lab">Mission link</div>${link('slWake',wurl)}</div>
  <div class="sl-sec">Schedule</div><div class="sl-card sl-form">
    <label class="sl-frow"><span>Usual wake-up</span><input type="time" class="inp num" id="slW" value="${S.wake}"></label>
    <label class="sl-frow"><span>Sleep goal <small>Hours</small></span><input class="inp num" id="slG" value="${S.goal}" inputmode="decimal"></label>
    <label class="sl-frow"><span>Bedtime reminder<small>30 min before ${sBedFor()} · needs notifications on</small></span><input type="checkbox" class="sl-sw" id="slBedOn" ${S.bedOn?'checked':''}></label></div>`;
  el.onchange=e=>{const t=e.target;if(t.id==='slShk'){S.shakes=Math.max(5,+t.value||30)}if(t.id==='slW')S.wake=t.value;if(t.id==='slG')S.goal=Math.max(4,Math.min(12,+t.value||8));if(t.id==='slBedOn')S.bedOn=t.checked;saveSS();if(typeof pushSync==='function')pushSync();sSetup()};
  el.onclick=e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;
    if(d.copy){const v=$(d.copy).textContent;navigator.clipboard&&navigator.clipboard.writeText(v).then(()=>{b.textContent='copied ✓'}).catch(()=>{});return}
    if(d.slm){S.miss=d.slm;saveSS();sSetup();return}if(d.sld){S.diff=+d.sld;saveSS();sSetup();return}if(d.sls){S.snd=d.sls;saveSS();sSetup();return}
    if(b.id==='slTest'){sAlarmSound(true);setTimeout(sAlarmStop,3500);return}if(b.id==='slTry'){sMission(true);return}if(b.id==='slReg')sRegister()}}

/* ---------- #wake: opened by the "alarm stopped" automation (works signed out, in Safari too) ---------- */
function sWakeMode(){let p={};try{p=JSON.parse(decodeURIComponent(location.hash.slice(6)))}catch(e){}
  SSET={wake:'07:30',goal:8,miss:p.m||'math',diff:+p.d||2,shakes:+p.n||30,snd:p.s||'rise',code:p.c||'',...(SSET||{}),...(p.m?{miss:p.m}:{})};
  const o=$('sleepNight');o.hidden=false;document.body.classList.add('sleeping');
  o.innerHTML=`<div class="smhead"><span class="tag pink">Wake up</span><b class="num">${pad(new Date().getHours())}:${pad(new Date().getMinutes())}</b></div><button class="btn p slgo" type="button" id="wkGo">Tap to start your mission</button><div class="dim" style="font-size:11px">The alarm keeps going until it's done</div>`;
  $('wkGo').onclick=async()=>{try{SAC=SAC||new (window.AudioContext||window.webkitAudioContext)();await SAC.resume()}catch(e){}try{if(SSET.miss==='shake'&&typeof DeviceMotionEvent!=='undefined'&&DeviceMotionEvent.requestPermission)await DeviceMotionEvent.requestPermission()}catch(e){}
    if(SSET.miss==='shake')addEventListener('devicemotion',sMotion);sAlarmSound(false);sMission('wake')}}
function sAwake(){const o=$('sleepNight');history.replaceState(null,'',location.pathname+'#today');
  o.innerHTML=`<div class="smq">you're up ✓</div><div class="dim">A wake-up check pops up in 3 minutes — tap it or the alarm comes back</div><button class="btn" type="button" id="wkOk" style="margin-top:14px">Ok</button>`;
  $('wkOk').onclick=()=>{o.hidden=true;document.body.classList.remove('sleeping')};
  setTimeout(()=>{o.hidden=false;document.body.classList.add('sleeping');let left=90;o.innerHTML=`<div class="smq">Still awake?</div><div class="smshake num" id="scT">${left}</div><button class="btn p slgo" type="button" id="scOk">yes, I'm up</button>`;
    const t=setInterval(()=>{left--;if($('scT'))$('scT').textContent=left;if(left<=0){clearInterval(t);sAlarmSound(false);sMission('check')}},1000);$('scOk').onclick=()=>{clearInterval(t);o.hidden=true;document.body.classList.remove('sleeping')}},3*60e3)}
let SAC=null;
function sMotion(e){const g=e.accelerationIncludingGravity||e.acceleration;if(!g)return;const m=Math.sqrt((g.x||0)**2+(g.y||0)**2+(g.z||0)**2);if(sShake.on&&Math.abs(m-9.8)>14){const t=Date.now();if(t-sShake.lt>220){sShake.lt=t;sShake.n++;sShake.cb&&sShake.cb()}}}
const sShake={on:false,n:0,lt:0,cb:null};

/* alarm sound (generated, ramps up over a minute) */
let SAL=null;
function sAlarmSound(preview){try{SAC=SAC||new (window.AudioContext||window.webkitAudioContext)();SAC.resume()}catch(e){return}
  sAlarmStop();const g=SAC.createGain();g.gain.value=preview?.5:.08;g.connect(SAC.destination);if(!preview)g.gain.linearRampToValueAtTime(1,SAC.currentTime+60);
  const kind=SSET.snd;let i=0;const beep=()=>{if(!SAL)return;const t=SAC.currentTime;
    if(kind==='classic'){[0,.18,.36,.54].forEach(d=>{const o=SAC.createOscillator(),e=SAC.createGain();o.type='square';o.frequency.value=1760;e.gain.setValueAtTime(.35,t+d);e.gain.setValueAtTime(0,t+d+.1);o.connect(e).connect(g);o.start(t+d);o.stop(t+d+.12)})}
    else if(kind==='siren'){const o=SAC.createOscillator(),e=SAC.createGain();o.type='sawtooth';o.frequency.setValueAtTime(600,t);o.frequency.linearRampToValueAtTime(1400,t+.6);o.frequency.linearRampToValueAtTime(600,t+1.2);e.gain.value=.3;o.connect(e).connect(g);o.start(t);o.stop(t+1.2)}
    else{const n=[523.25,659.25,783.99,1046.5,783.99,659.25][i++%6];const o=SAC.createOscillator(),e=SAC.createGain();o.type='triangle';o.frequency.value=n;e.gain.setValueAtTime(.0001,t);e.gain.exponentialRampToValueAtTime(.6,t+.02);e.gain.exponentialRampToValueAtTime(.0001,t+.9);o.connect(e).connect(g);o.start(t);o.stop(t+1)}};
  SAL={g,t:setInterval(beep,kind==='classic'?1000:kind==='siren'?1200:420)};beep();try{navigator.vibrate&&navigator.vibrate([400,200,400,200,400])}catch(e){}}
function sAlarmStop(){if(SAL){clearInterval(SAL.t);try{SAL.g.disconnect()}catch(e){}SAL=null}}

/* missions: alarm keeps going until it's solved */
function sMission(test){const o=$('sleepNight');o.hidden=false;document.body.classList.add('sleeping');const S=SSET;const done=()=>{sAlarmStop();sShake.on=false;if(test==='check'||test===true){o.hidden=true;document.body.classList.remove('sleeping');return}sAwake()};
  const snz='';
  const head=`<div class="smhead"><span class="tag pink">${test===true?'mission test':'wake up'}</span><b class="num">${pad(new Date().getHours())}:${pad(new Date().getMinutes())}</b></div>`;
  if(test===true)sAlarmStop();
  if(S.miss==='math'){const mk=()=>{const d=S.diff;const r=n=>Math.floor(Math.random()*n);let a,b,c,q,ans;if(d===1){a=10+r(40);b=10+r(40);q=`${a} + ${b}`;ans=a+b}else if(d===2){a=12+r(30);b=3+r(9);c=10+r(90);q=`${a} × ${b} + ${c}`;ans=a*b+c}else{a=13+r(40);b=12+r(20);c=100+r(400);q=`${a} × ${b} − ${c}`;ans=a*b-c}return {q,ans}};
    let left=3,cur=mk();const draw=()=>{o.innerHTML=head+`<div class="smq num">${cur.q} =</div><input class="smin num" id="smA" inputmode="none" readonly autocomplete="off"><div class="dim">${left} to go</div><div class="smkp">${[1,2,3,4,5,6,7,8,9,'−',0,'⌫'].map(k=>`<button type="button" data-k="${k}">${k}</button>`).join('')}</div><button class="btn p" type="button" id="smOk">Submit</button>${snz}`;bind()};
    const bind=()=>{o.onclick=e=>{const b=e.target.closest('button');if(!b)return;const i=$('smA');if(b.dataset.k!=null){const k=b.dataset.k;i.value=k==='⌫'?i.value.slice(0,-1):k==='−'?(i.value.startsWith('-')?i.value.slice(1):'-'+i.value):i.value+k;return}
      if(b.id==='smOk'){if(+i.value===cur.ans&&i.value!==''){left--;if(!left)return done();cur=mk();draw()}else{i.value='';i.classList.add('bad');setTimeout(()=>i.classList.remove('bad'),400)}}if(b.id==='smSnz')sSnooze()}};draw()}
  else if(S.miss==='shake'){sShake.on=true;addEventListener('devicemotion',sMotion);sShake.n=0;const need=S.shakes;o.innerHTML=head+`<div class="smq">Shake it</div><div class="smshake num" id="smN">0 / ${need}</div><div class="smbar"><i id="smBar"></i></div>${snz}<div class="dim" style="font-size:11px">no motion sensor? <button class="iconbtn" type="button" id="smAlt">Switch to maths</button></div>`;
    sShake.cb=()=>{$('smN').textContent=sShake.n+' / '+need;$('smBar').style.width=Math.min(100,sShake.n/need*100)+'%';if(sShake.n>=need){sShake.cb=null;done()}};
    o.onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.id==='smSnz')sSnooze();if(b.id==='smAlt'){sShake.on=false;const m=S.miss;S.miss='math';sMission(test);S.miss=m}}}
  else if(S.miss==='type'){const ph=SPHRASE[Math.floor(Math.random()*SPHRASE.length)];o.innerHTML=head+`<div class="smq" style="font-size:20px">type exactly:</div><div class="smph">${esc(ph)}</div><input class="smin" id="smT" autocomplete="off" autocapitalize="off" spellcheck="false">${snz}`;
    $('smT').oninput=e=>{if(e.target.value.trim().toLowerCase()===ph.toLowerCase())done()};o.onclick=e=>{if(e.target.id==='smSnz')sSnooze()}}
  else{if(!S.code){const m=S.miss;S.miss='math';sMission(test);S.miss=m;return}
    o.innerHTML=head+`<div class="smq" style="font-size:20px">Scan your barcode</div><div class="fscan"><video id="smV" playsinline muted></video><i class="fsline"></i></div><div class="dim" id="smMsg">Find it and point the camera at it</div>${snz}`;
    sScanner($('smV'),code=>{if(code===S.code){sScanStop();done();return true}$('smMsg').textContent='wrong barcode — that\'s not the one';return false});o.onclick=e=>{if(e.target.id==='smSnz'){sScanStop();sSnooze()}}}}

let SSC=null;
async function sScanner(v,cb){sScanStop();try{
  if('BarcodeDetector' in window){const st=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});SSC={st};v.srcObject=st;await v.play();const det=new BarcodeDetector({formats:['ean_13','ean_8','upc_a','upc_e','code_128']});
    const loop=async()=>{if(!SSC||!v.isConnected)return sScanStop();try{const r=await det.detect(v);if(r[0]&&cb(r[0].rawValue))return}catch(e){}setTimeout(loop,250)};loop()}
  else{if(!window.ZXing)await new Promise((res,rej)=>{const s=document.createElement('script');s.src='vendor/zxing.min.js';s.onload=res;s.onerror=rej;document.head.appendChild(s)});
    const zx=new ZXing.BrowserMultiFormatReader();SSC={zx};zx.decodeFromConstraints({video:{facingMode:'environment'}},v,res=>{if(res&&SSC&&cb(res.getText()))sScanStop()})}}catch(e){}}
function sScanStop(){if(!SSC)return;try{SSC.zx&&SSC.zx.reset()}catch(e){}if(SSC.st)SSC.st.getTracks().forEach(t=>t.stop());SSC=null}
function sRegister(){openSheet('register barcode',`<div class="dim" style="margin-bottom:8px">Scan something that lives in another room — toothpaste, shower gel, a cereal box.</div><div class="fscan"><video id="srV" playsinline muted></video><i class="fsline"></i></div><div class="row" style="gap:6px;margin-top:8px"><input class="inp num" id="srC" placeholder="Or type the number" style="flex:1"><button class="btn p" type="button" id="srOk">Save</button></div>`);
  const saveC=c=>{SSET.code=c;saveSS();sScanStop();closeSheet();sTonight()};sScanner($('srV'),c=>{saveC(c);return true});$('srOk').onclick=()=>{const c=$('srC').value.replace(/\s/g,'');if(c)saveC(c)};$('sheetX')&&$('sheetX').addEventListener('click',sScanStop,{once:true})}


/* ---------- recovery / strain (Whoop-style) ---------- */
const sAddD=(k,n)=>{const x=new Date(k+'T12:00');x.setDate(x.getDate()+n);return ymd(x)};
function sStrain(day){/* strain for a calendar day: active energy arrives the next morning */const h=SHEALTH[sAddD(day,1)]||{};let load=+h.kcal||0;if(!load&&h.steps)load=h.steps*0.04;
  try{if(typeof WORKOUTS!=='undefined')WORKOUTS.filter(w=>w.date===day).forEach(w=>{const m=w.endedAt&&w.startedAt?(new Date(w.endedAt)-new Date(w.startedAt))/6e4:45;if(!h.kcal)load+=m*5;load+=Math.min(150,(w.vol||0)/100)})}catch(e){}
  return load?Math.round(21*(1-Math.exp(-load/650))*10)/10:null}
function sBase(k,f,days=30){const v=[];for(let i=1;i<=days;i++){const d=sAddD(k,-i);const x=f==='asleep'?(SNIGHTS[d]||{}).asleep:(SHEALTH[d]||{})[f];if(x!=null&&!isNaN(+x)&&+x>0)v.push(+x)}if(v.length<3)return null;const m=v.reduce((a,b)=>a+b,0)/v.length;const sd=Math.sqrt(v.reduce((a,b)=>a+(b-m)**2,0)/v.length);return {m,sd,n:v.length}}
function sNeed(k){const g=(SSET&&SSET.goal||8)*60;const st=sStrain(sAddD(k,-1));let need=g+(st&&st>10?(st-10)*6:0);let debt=0;for(let i=1;i<=3;i++){const n=SNIGHTS[sAddD(k,-i)];if(n&&n.asleep)debt+=Math.max(0,g-n.asleep)}return Math.round(need+Math.min(60,debt*.3))}
function sRec(k){const h=SHEALTH[k]||{},n=SNIGHTS[k];const need=sNeed(k);const perf=n&&n.asleep?Math.min(100,n.asleep/need*100):null;
  const bH=sBase(k,'hrv'),bR=sBase(k,'rhr'),bRR=sBase(k,'rr');let s=null,est=false;
  if(h.hrv){const zH=bH?(h.hrv-bH.m)/Math.max(5,bH.sd):0,zR=h.rhr&&bR?(h.rhr-bR.m)/Math.max(2,bR.sd):0;s=52+22*zH-14*zR+(perf!=null?.35*(perf-80):0);if(h.rr&&bRR&&h.rr>bRR.m+1)s-=8;est=!bH}
  else if(perf!=null){s=perf*.85;est=true}
  return s==null?null:{v:Math.round(Math.max(1,Math.min(99,s))),perf:perf!=null?Math.round(perf):null,need,est,h,bH,bR}}
const sZone=v=>v>=67?['#30d158','green','Your body is primed — push it today','14 – 18']:v>=34?['#ffd60a','yellow','Maintain — keep strain moderate','10 – 14']:['#ff453a','red','Prioritise rest and recovery','0 – 10'];
function sLine(vals,col,h=84){const pts=vals.map((v,i)=>v==null||isNaN(+v)?null:[i,+v]).filter(Boolean);if(pts.length<2)return '<div class="sl-note">Not enough data yet — check back after a few mornings.</div>';
  const lo=Math.min(...pts.map(p=>p[1])),hi=Math.max(...pts.map(p=>p[1])),X=i=>(i/29*1000).toFixed(1),Y=v=>(h-8-(v-lo)/Math.max(1,hi-lo)*(h-16)).toFixed(1);const d=pts.map(([i,v])=>X(i)+','+Y(v)).join(' ');const g='slg'+col.slice(1);
  return `<svg class="sl-line" viewBox="0 0 1000 ${h}" preserveAspectRatio="none" style="height:${h}px"><defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".3"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs><polygon points="${X(pts[0][0])},${h} ${d} ${X(pts[pts.length-1][0])},${h}" fill="url(#${g})"/><polyline points="${d}" fill="none" stroke="${col}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg><div class="sl-axis"><span>30 days ago</span><span class="num">${Math.round(lo)} – ${Math.round(hi)}</span><span>Today</span></div>`}
function sRecovery(){const el=$('sleepBody');const k=DAYK;const R=sRec(k)||sRec(sAddD(k,-1));const kk=sRec(k)?k:sAddD(k,-1);const yS=sStrain(sAddD(k,-1));
  if(!R&&yS==null){el.innerHTML=sEmpty('Recovery needs your Watch data','Finish the Shortcut in setup (sleep + the HRV / heart-rate lines). After a few mornings you\'ll get a daily recovery %, strain and trends.','Open setup');sGoSetup(el);return}
  const z=R?sZone(R.v):['#8e8e93','—','No recovery score yet',''];const n=SNIGHTS[kk];
  const days=[...Array(30)].map((_,i)=>sAddD(k,-29+i));const recs=days.map(d=>({d,r:sRec(d),s:sStrain(d)}));
  const tile=(l,v,s,up)=>`<div class="sl-tile"><span>${l}</span><b class="num">${v}</b><em${up!=null?` class="${up?'up':'dn'}"`:''}>${s||'&nbsp;'}</em></div>`;
  const bed=(()=>{const [h,m]=SSET.wake.split(':').map(Number);let t=(h*60+m-sNeed(sAddD(k,1))+1440)%1440;return pad(Math.floor(t/60))+':'+pad(t%60)})();
  const hv=days.map(d=>(SHEALTH[d]||{}).hrv),rh=days.map(d=>(SHEALTH[d]||{}).rhr);
  el.innerHTML=`<div class="sl-card sl-hero" style="--z:${z[0]}">
    <div class="sl-heroL">${sRing(R?R.v:0,z[0],168,9,`<span>Recovery</span><b class="num" style="color:${z[0]}">${R?R.v+'<small>%</small>':'—'}</b><span>${kk!==k?'yesterday':R&&R.est?'estimated':'today'}</span>`)}<div class="sl-zone"><i></i>${esc(z[2])}</div></div>
    <div class="sl-tiles">${tile('HRV',R&&R.h.hrv?Math.round(R.h.hrv)+'<small> ms</small>':'—',R&&R.bH&&R.h.hrv?`${R.h.hrv>=R.bH.m?'↑':'↓'} avg ${Math.round(R.bH.m)}`:'',R&&R.bH&&R.h.hrv?R.h.hrv>=R.bH.m:null)}${tile('Resting HR',R&&R.h.rhr?Math.round(R.h.rhr)+'<small> bpm</small>':'—',R&&R.bR&&R.h.rhr?`${R.h.rhr<=R.bR.m?'↓':'↑'} avg ${Math.round(R.bR.m)}`:'',R&&R.bR&&R.h.rhr?R.h.rhr<=R.bR.m:null)}${tile('Sleep',R&&R.perf!=null?R.perf+'<small>%</small>':'—',n&&R?fmtHM(n.asleep)+' of '+fmtHM(R.need):'')}${tile('Resp. rate',R&&R.h.rr?R.h.rr.toFixed(1)+'<small> /min</small>':'—','')}</div></div>
  <div class="sl-grid2"><div class="sl-card"><div class="sl-h"><span>Strain</span></div>
    <div class="sl-strain"><div><span>Yesterday</span><b class="num">${yS!=null?yS.toFixed(1):'—'}</b></div><div><span>Today's target</span><b class="num" style="color:${z[0]}">${R?z[3]:'—'}</b></div></div>
    <div class="sl-gauge"><i style="width:${Math.min(100,(yS||0)/21*100).toFixed(1)}%"></i>${R?`<em style="left:${(parseInt(z[3])/21*100).toFixed(1)}%;width:${((parseInt(z[3].split('–')[1])-parseInt(z[3]))/21*100).toFixed(1)}%;--z:${z[0]}"></em>`:''}</div>
    <div class="sl-note">From active energy, steps and logged gym sessions.</div></div>
  <div class="sl-card"><div class="sl-h"><span>Sleep coach</span></div><div class="sl-rows">
    <div><span>Sleep needed tonight</span><b class="num">${fmtHM(sNeed(sAddD(k,1)))}</b></div>
    <div><span>Be asleep by</span><b class="num">${bed}</b></div>
    ${n?`<div><span>Last night</span><b class="num">${fmtHM(n.asleep)}</b></div><div><span>Deep · REM</span><b class="num">${fmtHM(n.deep)} · ${fmtHM(n.rem)}</b></div>`:''}</div></div></div>
  <div class="sl-card"><div class="sl-h"><span>Recovery · 30 days</span><span class="sl-keys" style="margin:0"><span><i style="background:#30d158"></i>Recovery</span><span><i style="background:#5ac8fa"></i>Strain</span></span></div>
    <div class="sl-rbars">${recs.map(o=>`<div title="${o.d}">${o.r?`<span style="height:${o.r.v}%;background:${sZone(o.r.v)[0]}"></span>`:'<span class="nil"></span>'}${o.s!=null?`<i style="bottom:${(o.s/21*100).toFixed(1)}%"></i>`:''}</div>`).join('')}</div></div>
  <div class="sl-grid2"><div class="sl-card"><div class="sl-h"><span>HRV</span><b class="num" style="color:#5ac8fa">${hv.filter(x=>x!=null).length?Math.round(hv.filter(x=>x!=null).pop())+' ms':''}</b></div>${sLine(hv,'#5ac8fa')}</div>
    <div class="sl-card"><div class="sl-h"><span>Resting heart rate</span><b class="num" style="color:#ff375f">${rh.filter(x=>x!=null).length?Math.round(rh.filter(x=>x!=null).pop())+' bpm':''}</b></div>${sLine(rh,'#ff375f')}</div></div>`;
  el.onclick=null}
/* ---------- main sleep page (Sleep Cycle style): quality first, graph, tiles, calendar ---------- */
let SSEL=null,SCALM=null;
const SI={moon:'<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" fill="currentColor" stroke="none"/>',
  alarm:'<circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.2 1.6M4.5 5.5l2.5-2M19.5 5.5l-2.5-2"/>',
  lat:'<path d="M4 12a8 8 0 1 0 8-8"/><path d="M12 8v4l2.5 2"/><path d="M3 4.5h4.5L3 9.5h4.5" stroke-width="1.7"/>',
  reg:'<path d="M5 18V9M9.5 18V6M14 18v-8M18.5 18V7.5"/>',
  heart:'<path d="M19.5 12.6 12 20l-7.5-7.4A4.6 4.6 0 0 1 12 6.5a4.6 4.6 0 0 1 7.5 6.1z"/><path d="M3.5 12.5h4l1.5-2.5 2.5 5 1.5-2.5h3"/>',
  wake:'<path d="M12 3v3M5.6 5.6l2.1 2.1M3 12h3M18 12h3M16.3 7.7l2.1-2.1"/><path d="M7 17a5 5 0 0 1 10 0"/><path d="M3 20h18"/>',
  cal:'<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
  chevL:'<path d="m15 18-6-6 6-6"/>',chevR:'<path d="m9 18 6-6-6-6"/>'};
const sIco=(k,s=20)=>`<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SI[k]}</svg>`;
const sHM=m=>{m=Math.round(m||0);return `${Math.floor(m/60)}<small>h</small> ${pad(m%60)}<small>m</small>`};
/* intervals asleep for every synced night — used for regularity */
function sSleepIv(){const iv=[];Object.values(SNIGHTS).forEach(n=>{const sg=(n.segs||[]).filter(x=>x[2]!=='awake');if(sg.length)sg.forEach(([a,b])=>iv.push([+new Date(a),+new Date(b)]));else if(n.start&&n.end)iv.push([+new Date(n.start),+new Date(n.end)])});return iv.sort((a,b)=>a[0]-b[0])}
/* Sleep Regularity: how often you're in the same state (asleep / awake) at the same clock time 24 h apart, over the last week */
function sRegularity(k){const iv=sSleepIv();const at=t=>{for(const [a,b] of iv){if(a>t)return 0;if(t<b)return 1}return 0};let same=0,tot=0;
  for(let i=0;i<7;i++){const d=sAddD(k,-i),p=sAddD(k,-i-1),n=SNIGHTS[d];if(!n||!n.end||!SNIGHTS[p])continue;const e=+new Date(n.end);for(let t=e-864e5;t<e;t+=3e5){tot++;if(at(t)===at(t-864e5))same++}}
  return tot?Math.round(same/tot*100):null}
function sLatency(n){const sg=sNorm(n.segs).filter(x=>x[2]!=='awake').map(x=>x[0]);return sg.length&&n.start?Math.max(0,Math.round((sg[0]-new Date(n.start))/6e4)):null}
/* the night as one smooth line: awake at the top, deep at the bottom */
function sWave(n,H=200){const segs=sNorm(n.segs);if(!segs.length)return '<div class="sl-note">No stage data for this night — your Watch needs to be worn to bed.</div>';
  const t0=Math.min(+new Date(n.start)||segs[0][0],segs[0][0]),t1=Math.max(+new Date(n.end)||0,segs[segs.length-1][1]),W=1000,L={awake:0,rem:1,core:2,deep:3},pt=16,Y=st=>(pt+(L[st]??2)*(H-2*pt)/3).toFixed(1),X=t=>((t-t0)/(t1-t0||1))*W;
  const m=[];segs.forEach(s=>{const l=m[m.length-1];if(l&&l[2]===s[2]&&s[0]-l[1]<12e4)l[1]=Math.max(l[1],s[1]);else m.push([...s])});
  let d=`M0,${Y(m[0][2])} L${X(m[0][0]).toFixed(1)},${Y(m[0][2])}`;
  m.forEach((s,i)=>{const x0=X(s[0]),x1=X(s[1]),nx=m[i+1];if(!nx){d+=` L${W},${Y(s[2])}`;return}const nw=X(nx[1])-X(nx[0]),r=Math.max(.5,Math.min(42,(x1-x0)*.45,nw*.45)),xb=X(nx[0]);d+=` L${(x1-r).toFixed(1)},${Y(s[2])} C${(x1+r*.1).toFixed(1)},${Y(s[2])} ${(xb-r*.1).toFixed(1)},${Y(nx[2])} ${(xb+r).toFixed(1)},${Y(nx[2])}`});
  const ticks=[];for(let h=Math.ceil(t0/36e5)*36e5;h<t1;h+=36e5){const p=(h-t0)/(t1-t0);if(p>.07&&p<.93)ticks.push(`<span style="left:${(p*100).toFixed(1)}%">${new Date(h).getHours()}</span>`)}
  return `<div class="sw"><div class="sw-lab">${['Awake','REM','Core','Deep'].map(s=>`<span>${s}</span>`).join('')}</div><div class="sw-plot"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="height:${H}px"><defs><linearGradient id="swg" gradientUnits="userSpaceOnUse" x1="0" y1="${pt}" x2="0" y2="${H-pt}"><stop offset="0" stop-color="#ffb07a"/><stop offset=".34" stop-color="#ff7a9c"/><stop offset=".68" stop-color="#8fa8d8"/><stop offset="1" stop-color="#4fb3c8"/></linearGradient></defs>${[0,1,2,3].map(i=>`<line x1="0" x2="${W}" y1="${Y(Object.keys(L)[i])}" y2="${Y(Object.keys(L)[i])}" class="sw-grid"/>`).join('')}<path d="${d}" class="sw-line"/></svg>
    <div class="sw-ax"><span class="e">${sT(t0)}</span>${ticks.join('')}<span class="e r">${sT(t1)}</span></div></div></div>`}
const sFace=(v)=>{const c=[-6,-3,0,3.5,6][v-1];return `<svg viewBox="0 0 32 32" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="16" cy="16" r="13"/><circle cx="11.5" cy="13" r="1.2" fill="currentColor" stroke="none"/><circle cx="20.5" cy="13" r="1.2" fill="currentColor" stroke="none"/><path d="M10.5 ${20-c/3} Q16 ${20+c} 21.5 ${20-c/3}"/></svg>`};
function sCal(selK){const keys=Object.keys(SNIGHTS);const base=SCALM||(selK||DAYK).slice(0,7);const [y,mo]=base.split('-').map(Number);const first=new Date(y,mo-1,1),days=new Date(y,mo,0).getDate(),lead=(first.getDay()+6)%7;
  const cell=dn=>{const k=`${y}-${pad(mo)}-${pad(dn)}`,n=SNIGHTS[k],q=n?sQ(n):null;const fut=k>DAYK;
    return `<button type="button" class="sc-d${k===selK?' sel':''}${k===DAYK?' today':''}" ${n?`data-sc="${k}"`:'disabled'}><span>${dn}</span><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" class="t${fut?' fut':''}"/>${n?`<circle cx="18" cy="18" r="15" class="f" pathLength="100" style="stroke-dasharray:${Math.max(3,q)} 100"/>`:''}</svg></button>`};
  return `<div class="sl-card sc"><div class="sc-h"><b>${first.toLocaleDateString('en-GB',{month:'long',year:'numeric'})}</b><span><button type="button" class="sc-nav" data-cm="-1" aria-label="Previous month">${sIco('chevL',18)}</button><button type="button" class="sc-nav" data-cm="1" aria-label="Next month"${base>=DAYK.slice(0,7)?' disabled':''}>${sIco('chevR',18)}</button></span></div>
    <div class="sc-g">${['M','T','W','T','F','S','S'].map(d=>`<em>${d}</em>`).join('')}${'<i></i>'.repeat(lead)}${[...Array(days)].map((_,i)=>cell(i+1)).join('')}</div></div>`}
function sMain(){const el=$('sleepBody');const ks=Object.keys(SNIGHTS).sort();
  if(!ks.length){el.innerHTML=sEmpty('No nights yet','Wear your Apple Watch to bed and finish the one-time setup — every morning your sleep lands here automatically.','Open setup');sGoSetup(el);return}
  const k=SSEL&&SNIGHTS[SSEL]?SSEL:ks[ks.length-1],n=SNIGHTS[k],i=ks.indexOf(k),q=sQ(n);
  const inBed=n.start&&n.end?(new Date(n.end)-new Date(n.start))/6e4:null,lat=sLatency(n),reg=sRegularity(k),R=sRec(k),wk=sWakes(n);
  const d1=new Date(sAddD(k,-1)+'T12:00'),d2=new Date(k+'T12:00');const lbl=`${d1.toLocaleDateString('en-GB',{weekday:'short'})} ${d1.getDate()}–${d2.getDate()} ${d2.toLocaleDateString('en-GB',{month:'short'})}`;
  const tile=(ic,l,v,cls)=>`<div class="smt${cls?' '+cls:''}"><span>${l}</span><b class="num">${sIco(ic,22)}${v}</b></div>`;
  const stages=[['awake','Awake'],['rem','REM'],['core','Core'],['deep','Deep']];
  el.innerHTML=`<div class="sm"><div class="sm-l">
    <div class="sh-hero"><div class="sh-top"><button type="button" class="sh-ic" id="shCal" aria-label="Calendar">${sIco('cal',19)}</button><span class="sh-nav"><button type="button" data-sk="-1" aria-label="Previous night"${i<=0?' disabled':''}>${sIco('chevL',18)}</button><b>${lbl}</b><button type="button" data-sk="1" aria-label="Next night"${i>=ks.length-1?' disabled':''}>${sIco('chevR',18)}</button></span><span class="sh-ic sp"></span></div>
      <button type="button" class="sh-ring" id="shQ"><svg viewBox="0 0 200 200"><defs><linearGradient id="shg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff9f6b"/><stop offset="1" stop-color="#ffe0cf"/></linearGradient></defs><circle cx="100" cy="100" r="88" class="t"/><circle cx="100" cy="100" r="76" class="t2"/><circle cx="100" cy="100" r="88" class="f" pathLength="100" style="stroke-dasharray:${q} 100"/></svg><span class="sh-v"><b class="num">${q}<small>%</small></b><em>Quality ${sIco('chevR',16)}</em></span></button>
      <div class="sh-sum"><div><b class="num">${inBed!=null?sHM(inBed):'—'}</b><span>In bed</span></div><i></i><div><b class="num">${sHM(n.asleep)}</b><span>Time asleep</span></div></div></div>
    <div class="sm-cal" id="smCal">${sCal(k)}</div>
  </div><div class="sm-r">
    <div class="sl-card sw-card">${sWave(n)}</div>
    <div class="sl-card sm-stg">${stages.map(([s,l])=>`<div><i style="background:${SLC[s]}"></i><span>${l}</span><b class="num">${s==='awake'?Math.round(n.awake||0)+'<small>m</small>':sHM(n[s])}</b></div>`).join('')}</div>
    <div class="sm-tiles">${tile('moon','Went to bed',n.start?sT(n.start):'—')}${tile('alarm','Woke up',n.end?sT(n.end):'—')}${tile('lat','Asleep after',lat!=null?lat+'<small> min</small>':'—')}${tile('reg','Regularity',reg!=null?reg+'<small>%</small>':'—')}${tile('heart','Recovery',R?R.v+'<small>%</small>':'—','rec" style="--z:'+(R?sZone(R.v)[0]:'#8e8e93'))}${tile('wake','Wake-ups',wk!=null?wk:'—')}</div>
    ${reg==null?`<div class="sl-note sm-hint">Regularity appears once you have two nights in a row synced.</div>`:''}
    <div class="sm-sec">Experience</div>
    <div class="sl-card"><div class="sm-q">How did you feel waking up?</div><div class="sm-mood">${[1,2,3,4,5].map(v=>`<button type="button" data-mood="${v}" aria-pressed="${n.mood===v}" aria-label="Mood ${v} of 5">${sFace(v)}</button>`).join('')}</div>
      <div class="sm-q" style="margin-top:18px">Sleep notes</div><div class="sm-tags">${STAGS.map(t=>`<button type="button" data-tag="${esc(t)}" aria-pressed="${(n.tags||[]).includes(t)}">${t}</button>`).join('')}</div></div>
    <div class="sl-card sl-tonight"><span class="sl-ico">${sIco('moon',20)}</span><div><div class="sl-sub">Tonight</div><b>Be asleep by <span class="num">${sBedFor()}</span></b><div class="sl-sub">${SSET.goal} h goal · ${SSET.wake} wake-up${SSET.bedOn?' · reminder 30 min before':''}</div></div></div>
    <button type="button" class="sm-del" id="smDel">Delete this night</button>
  </div></div>`;
  el.onclick=e=>{const b=e.target.closest('button');if(!b)return;
    if(b.dataset.sk){SSEL=ks[i+ +b.dataset.sk]||k;SCALM=null;sMain();return}
    if(b.dataset.sc){SSEL=b.dataset.sc;sMain();if(innerWidth<900)$('sleepBody').scrollIntoView({behavior:'smooth',block:'start'});return}
    if(b.dataset.cm){const [yy,mm]=(SCALM||k.slice(0,7)).split('-').map(Number);const d=new Date(yy,mm-1+ +b.dataset.cm,1);SCALM=`${d.getFullYear()}-${pad(d.getMonth()+1)}`;$('smCal').innerHTML=sCal(k);return}
    if(b.id==='shCal'){$('smCal').scrollIntoView({behavior:'smooth',block:'center'});return}
    if(b.id==='shQ'){openSheet('Sleep quality',`<div class="sq-big num">${q}<small>%</small></div><div class="sl-note" style="text-align:center;margin-bottom:14px">Duration counts most, then deep sleep, REM, efficiency, restfulness and timing.</div>${sQBars(n)}`);return}
    if(b.dataset.mood){n.mood=+b.dataset.mood;save('sleep/w-'+k,n);el.querySelectorAll('[data-mood]').forEach(x=>x.setAttribute('aria-pressed',x===b));return}
    if(b.dataset.tag){const t=b.dataset.tag;n.tags=(n.tags||[]).includes(t)?n.tags.filter(x=>x!==t):(n.tags||[]).concat(t);save('sleep/w-'+k,n);b.setAttribute('aria-pressed',n.tags.includes(t));return}
    if(b.id==='smDel'){if(!b.dataset.arm){b.dataset.arm=1;b.textContent='Tap again to delete';return}delete SNIGHTS[k];removeDoc('sleep/w-'+k);SSEL=null;sMain()}}}
function sTrends(){const el=$('sleepBody');sRecovery();const a=el.innerHTML;sStats();el.innerHTML=a+'<div class="sm-sec">Sleep</div>'+el.innerHTML;sGoSetup(el)}

/* ================= NOTIFICATIONS (web push) =================
   The app keeps a queue of upcoming notifications in kv "push/q"; a Supabase cron (every 15 s) sends whatever is due
   to this device's push subscription ("push/subs"), even when the app is closed. Works on iPhone/iPad for the home-screen app. */
const VAPID_PUB='BHHSvXm_9iKVpSZSPkmn2jm_1IiM9rzT5cFtPdOzmpNn6cwQzidSZYJKVYc-p7bYgeisTYvVWIsYmOAW-fGhwoU';
const NKINDS=[['plan','plan blocks','when each block of your day starts'],['dose','doses','protocol doses at their times'],['rest','gym rest timer','when rest is over, even if you left the app'],['focus','focus timer','when a focus session ends'],['fast','fasting','when you hit your fasting goal'],['bed','bedtime','30 min before your sleep time'],['cal','calendar events','10 min before each event (or what you set on the event)']];
let NSET=LS.get('notify')||{on:false,k:{plan:true,dose:true,rest:true,focus:true,fast:true,bed:true,leet:true,water:false}};
if(NSET.k&&NSET.k.cal==null)NSET.k.cal=true;
const nOn=k=>NSET.on&&NSET.k[k];
function b64u(s){const p='='.repeat((4-s.length%4)%4);const b=atob((s+p).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from([...b].map(c=>c.charCodeAt(0)))}
async function nSubscribe(){if(!('serviceWorker' in navigator)||!('PushManager' in window))return 'This device can\'t do web notifications here. On iPhone/iPad they work in the home-screen app (iOS 16.4+).';
  const p=await Notification.requestPermission();if(p!=='granted')return 'Notifications are blocked — allow them in Settings → Notifications → Dylan\'s System.';
  const reg=await navigator.serviceWorker.ready;let sub=await reg.pushManager.getSubscription();if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u(VAPID_PUB)});
  const cur=(await load('push/subs'))||{list:[]};const j=sub.toJSON();const dev=/iPad/.test(navigator.userAgent)||(/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1)?'iPad':/iPhone/.test(navigator.userAgent)?'iPhone':/Windows/.test(navigator.userAgent)?'laptop':'device';
  cur.list=(cur.list||[]).filter(s=>s.sub.endpoint!==j.endpoint).concat({sub:j,dev,at:new Date().toISOString()});save('push/subs',cur,true);NSET.on=true;LS.set('notify',NSET);pushSync();return null}
/* queue */
let NQ=null;
async function nQueue(){if(NQ)return NQ;NQ=(await load('push/q'))||{items:[]};return NQ}
async function pushOne(tag,at,title,body,url){if(!NSET.on)return;const q=await nQueue();q.items=q.items.filter(i=>i.tag!==tag);if(at&&at>Date.now()+3000)q.items.push({id:rid()+rid(),tag,at:new Date(at).toISOString(),title,body,url:url||'./'});save('push/q',q,true)}
/* notification copy: title = the thing, body = when + one line of context. Clean, sentence case, no emoji. */
const nT=t=>{t=String(t||'').replace(/\s+/g,' ').trim();return t?t[0].toUpperCase()+t.slice(1):''};
const nClock=m=>{const h=Math.floor(m/60)%24;return (h%12||12)+':'+pad(m%60)+(h<12?' am':' pm')};
const nRange=(a,b)=>nClock(a).replace(/ (am|pm)$/,nClock(a).slice(-2)===nClock(b).slice(-2)?'':' $1')+' – '+nClock(b);
const nLead=m=>!m?'Now':m>=60?'In '+(m/60)+' hr':'In '+m+' min';
const nJoin=(...a)=>a.filter(Boolean).map(String).map(x=>x.trim()).filter(Boolean).join(' · ');
async function pushCancel(tag){if(!NSET.on)return;const q=await nQueue();const n=q.items.length;q.items=q.items.filter(i=>i.tag!==tag);if(q.items.length!==n)save('push/q',q,true)}
async function pushSync(){if(!NSET.on)return;const q=await nQueue();const now=Date.now(),H=now+36*36e5;const keep=q.items.filter(i=>!/^(plan|item|dose|bed|leet|water|habit|task|cal):/.test(i.tag)&&new Date(i.at)>now-60e3);const add=[];
  const push=(tag,at,title,body,url)=>{if(at>now+5000&&at<H)add.push({id:rid()+rid(),tag,at:new Date(at).toISOString(),title,body,url:url||'./'})};
  const days=[DAYK,ymd(new Date(new Date(DAYK+'T12:00').getTime()+864e5))];
  days.forEach((dk,di)=>{const base=new Date(dk+'T00:00').getTime();const dow=new Date(dk+'T12:00').getDay();const kind=(dow===0||dow===6)?'weekend':'weekday';
    if(nOn('plan')&&typeof M!=='undefined'&&M.plans&&M.plans[kind])M.plans[kind].forEach(b=>{const n=b.items.length;push('plan:'+dk+':'+b.bi,base+b.s*60e3,nT(b.short||b.title),nJoin('Starts now',nRange(b.s,b.e),n?n+' item'+(n===1?'':'s'):''),'./#today')});
    if(typeof M!=='undefined'&&M.plans&&M.plans[kind])M.plans[kind].forEach(b=>b.items.forEach(it=>{const lead=NITEMS.m[it.key];if(lead==null||it.t==null)return;if(it.days&&!it.days.has(DOW[dow]))return;if(typeof protoOk==='function'&&!protoOk(it,dk))return;if(di===0&&typeof DAY!=='undefined'&&DAY.ticks&&DAY.ticks[it.tk])return;
      push('item:'+dk+':'+it.key,base+(it.t-lead)*60e3,nT(it.item),nJoin(nLead(lead),nClock(it.t),it.dose,it.notes&&nT(it.notes).slice(0,80)),'./#today')}));
    if(typeof HAB!=='undefined')HAB.list.filter(h=>h.remind&&!h.arch).forEach(h=>{if(!hDue(h,dk))return;if(di===0&&hDone(h,dk))return;const [rh,rm]=h.remind.split(':').map(Number);push('habit:'+dk+':'+h.id,base+(rh*60+rm)*60e3,nT(h.n),h.type==='neg'?'Stay on track today':(hStreak(h).n?`Keep your ${hStreak(h).n}-${hStreak(h).unit} streak going`:'Log it to start a streak'),'./#streaks')});
    if(typeof TASKS!=='undefined'&&di===0)TASKS.list.filter(t=>!t.done&&t.d&&t.tm).forEach(t=>{const [th,tm]=t.tm.split(':').map(Number);push('task:'+t.id,new Date(t.d+'T00:00').getTime()+(th*60+tm)*60e3,nT(t.t),nJoin('Due now',t.note&&nT(t.note).slice(0,80)),'./#journal')});
    if(nOn('dose')&&typeof PROTO!=='undefined'&&typeof scheduledOn==='function')PROTO.list.forEach(c=>{if(!scheduledOn(c,dk))return;(c.times||[]).forEach((t,i)=>{const m=/^(\d{1,2}):(\d{2})$/.exec(t);if(!m)return;if(di===0&&typeof logsFor==='function'&&logsFor(c.id,dk)[i])return;push('dose:'+dk+':'+c.id+':'+i,base+(+m[1]*60+ +m[2])*60e3,nT(c.name),nJoin('Due now',[c.dose,c.unit].filter(Boolean).join(' '))||'Due now','./#tools')})});
    if(nOn('bed')&&typeof SSET!=='undefined'&&SSET&&SSET.bedOn&&typeof sBedFor==='function'){const [bh,bm]=sBedFor().split(':').map(Number);let t=base+(bh*60+bm-30)*60e3;if(bh<12)t+=864e5;push('bed:'+dk,t,'Bedtime in 30 min',`Lights out by ${sBedFor()} for ${SSET.goal} h before ${SSET.wake}`,'./#sleep')}});
  if(nOn('cal')&&typeof calEnsure==='function'&&await calEnsure())days.forEach(dk=>{const base=new Date(dk+'T00:00').getTime();calEvents(new Date(dk+'T12:00')).forEach(ev=>{if(ev.ad||ev.rm<0)return;const lead=ev.rm==null?10:ev.rm;
    push('cal:'+dk+':'+ev.id,base+(ev.s-lead)*60e3,nT(ev.t)||'Event',nJoin(lead?nLead(lead):'Starting now',nRange(ev.s,ev.e)),'./#week')})});
  q.items=keep.concat(add).sort((a,b)=>a.at<b.at?-1:1).slice(0,200);save('push/q',q,true)}
function openNotify(){const sup=('serviceWorker' in navigator)&&('PushManager' in window);const perm=typeof Notification!=='undefined'?Notification.permission:'unsupported';
  openSheet('notifications',`<div class="row" style="justify-content:space-between;align-items:center"><div><b>${NSET.on&&perm==='granted'?'on for this device':'off'}</b><div class="dim" style="font-size:11px">${sup?'arrive even when the app is closed':'not supported in this browser'}</div></div><button class="btn ${NSET.on&&perm==='granted'?'':'p'}" type="button" id="nTog">${NSET.on&&perm==='granted'?'turn off':'turn on'}</button></div>
  <div class="dim" id="nMsg" style="font-size:12px;margin:8px 0"></div>
  <div class="nlist">${NKINDS.map(([k,l,d])=>`<label class="nrow"><span><b>${l}</b><span class="dim">${d}</span></span><input type="checkbox" data-nk="${k}" ${NSET.k[k]?'checked':''}></label>`).join('')}</div>
  <div class="bigbtns" style="margin-top:12px"><button class="iconbtn" type="button" id="nTest">Send a test</button><span style="flex:1"></span><button class="btn p" type="button" id="nOk">Done</button></div>`);
  const sb=$('sheetBody');sb.onchange=e=>{const k=e.target.dataset.nk;if(!k)return;NSET.k[k]=e.target.checked;LS.set('notify',NSET);pushSync()};
  $('nOk').onclick=closeSheet;
  $('nTest').onclick=async()=>{if(!NSET.on){$('nMsg').textContent='turn notifications on first';return}await pushOne('test',Date.now()+8000,'Notifications on','You’re all set. Alerts will appear here.','./');$('nMsg').textContent='sent — it should arrive within ~20 seconds (lock your phone to see it)'};
  $('nTog').onclick=async()=>{if(NSET.on&&perm==='granted'){NSET.on=false;LS.set('notify',NSET);try{const reg=await navigator.serviceWorker.ready;const s=await reg.pushManager.getSubscription();if(s){const cur=(await load('push/subs'))||{list:[]};cur.list=(cur.list||[]).filter(x=>x.sub.endpoint!==s.endpoint);save('push/subs',cur,true);await s.unsubscribe()}}catch(e){}openNotify();return}
    $('nMsg').textContent='asking…';const err=await nSubscribe().catch(e=>String(e&&e.message||e));if(err){$('nMsg').textContent=err;return}openNotify()}}
document.addEventListener('click',e=>{if(e.target.closest('#notifyBtn'))openNotify()});

function leetDue(){return typeof LEET!=='undefined'&&LEET&&LEET.items?Object.values(LEET.items).filter(it=>it.review&&it.review<=DAYK).length:0}

/* per-item reminders set from a Today item's edit sheet: doc push/items {m:{itemKey:minutesBefore}} */
let NITEMS={m:{}};
load('push/items').then(d=>{if(d)NITEMS={m:{},...d}}).catch(()=>{});
watch('push/items',d=>{if(d)NITEMS={m:{},...d}});
async function setItemNotify(key,lead){if(lead==null)delete NITEMS.m[key];else NITEMS.m[key]=lead;save('push/items',NITEMS,true);
  if(lead!=null&&!NSET.on){openNotify();return}pushSync()}

/* ================= STREAKS (Streaks-app style habits) =================
   docs: habits/list {list:[habit]} · habits/log {d:{'YYYY-MM-DD':{habitId:count}}}
   habit: {id,n,ic,col,type:'daily'|'week'|'days'|'neg',per(times/week),days:[0-6],q(target per day),unit,remind:'HH:MM',created,arch} */
const HCOLS=['#ff2a6d','#05d9e8','#9b5cff','#57f5a8','#ffb000','#ff6b3d','#4da3ff','#e6e6e6'];
const HICONS='💪 🏋️ 🏃 🚶 🧘 💧 🥗 🍎 💊 🧴 🦷 🛏️ 📖 ✍️ 💻 🧠 🎯 🧹 🐈 ☀️ 🌙 🚿 🧊 📵 🚭 🍺 🍬 ☕ 🎧 🙏 💸 📞 🪥 ✂️ 👔 🔥 ⭐ ✅'.split(' ');
let HAB={list:[]},HLOG={d:{}},habLoaded=false,HSEL=null;
async function loadHabits(){if(habLoaded){renderHabits();return}const [l,g,dd]=await Promise.all([load('habits/list'),load('habits/log'),listDocs('days/d-')]);(dd||[]).forEach(r=>{if(r.data&&r.data.names)DNAMES[r.path.slice(7)]=r.data.names});HAB={list:[],...(l||{})};HLOG={d:{},...(g||{})};habLoaded=true;renderHabits()}
watch('habits/list',d=>{if(d){HAB={list:[],...d};if(cur==='streaks')renderHabits()}});
watch('habits/log',d=>{if(d){HLOG={d:{},...d};if(cur==='streaks'&&!hHold)renderHabits()}});
const hSave=()=>save('habits/list',HAB),hSaveLog=()=>{save('habits/log',HLOG);hWidget()};
/* habits linked to Today: every plan item except tasks/work/sleep/meals etc. Ticks live in the Today day docs (days/d-*), so ticking here or in Today is the same tick */
const HL_SKIP=new Set(['Task','Work','Sleep','Meal','Break','Leisure','Social','Research','Plan','Study']);
const HL_META={Habit:['✅','#57f5a8','habits'],Training:['🏋️','#ff2a6d','training'],Mindset:['🎯','#ffb000','mindset'],Circadian:['☀️','#ffb000','circadian']};Object.assign(HL_META,LX('hl',{}));
/* mindset streaks = these Today items only, whatever their plan type */
const HL_MIND=/chess|leet ?code|deep ?work/i;
let DNAMES={},dnLoaded=false;
const hlKind=d=>{const w=new Date(d+'T12:00').getDay();return w===0||w===6?'weekend':'weekday'};
const hlItems=(d,name)=>{if(!M.plans)return [];const dow=DOW[new Date(d+'T12:00').getDay()];return (M.plans[hlKind(d)]||[]).flatMap(b=>b.items).filter(i=>i.item.trim()===name&&(!i.days||i.days.has(dow))&&protoOk(i,d))};
function hLinked(){if(!M.plans)return [];const hide=new Set(HAB.hide||[]);const map=new Map();
  for(const kind of ['weekday','weekend'])(M.plans[kind]||[]).forEach(b=>b.items.forEach(i=>{if(!i.item)return;const n=i.item.trim();const mind=HL_MIND.test(n);if(!mind&&(HL_SKIP.has(i.type)||i.type==='Mindset'))return;const id='tl:'+n.toLowerCase();if(map.has(id))return;const m=mind?HL_META.Mindset:HL_META[i.type]||['⭐','#e6e6e6',(i.type||'other').toLowerCase()];
    map.set(id,{id,n,ic:m[0],col:m[1],grp:m[2],type:'daily',link:n,names:[n],created:hFirstDay()})}));
  /* combined habits: several Today items counted as one streak (config lives in habits/list .combo) */
  (HAB.combo||[]).forEach(c=>{const mem=(c.names||[]).map(n=>map.get('tl:'+String(n).trim().toLowerCase())).filter(Boolean);if(!mem.length)return;mem.forEach(x=>map.delete(x.id));const f=mem[0];map.set('cb:'+c.id,{id:'cb:'+c.id,n:c.n||f.n,ic:c.ic||f.ic,col:c.col||f.col,grp:f.grp,type:'daily',names:mem.map(x=>x.n),once:!!c.once,every:!!c.every,combo:c.id,created:hFirstDay()})});
  return [...map.values()].filter(h=>!hide.has(h.id))}
const hName=h=>(HAB.ren&&HAB.ren[h.id])||hDisp(h.n);
const hDisp=n=>String(n).replace(/\s*[\(\[][^\)\]]*[\)\]]/g,'').replace(/\s{2,}/g,' ').trim()||String(n);
function hFirstDay(){const k=Object.keys(DNAMES).sort()[0];return k||DAYK}
function hTodayTicked(name){return visibleItems().filter(i=>i.item.trim()===name&&DAY.ticks[i.tk])}
const hItemsFor=(d,h)=>h.names.flatMap(n=>hlItems(d,n));
const hMan=(h,d)=>((HLOG.d[d]||{})[h.id])||0;
const hCnt=(h,d)=>{if(h.names){let c=hMan(h,d);if(d===DAYK&&M.plans)c+=visibleItems().filter(i=>h.names.includes(i.item.trim())&&DAY.ticks[i.tk]).length;else c+=(DNAMES[d]||[]).filter(x=>h.names.includes(String(x).trim())).length;return c}return hMan(h,d)};
const hTarget=(h,d)=>h.names?(h.once?1:Math.max(1,hItemsFor(d||DAYK,h).length)):Math.max(1,+h.q||1);
const hDone=(h,d)=>h.type==='neg'?hCnt(h,d)===0:hCnt(h,d)>=hTarget(h,d);
const hDue=(h,d)=>{if(h.names)return !!h.every||hItemsFor(d,h).length>0;const dow=new Date(d+'T12:00').getDay();return h.type==='days'?(h.days||[]).includes(dow):true};
const hAdd=(d,n)=>{const x=new Date(d+'T12:00');x.setDate(x.getDate()+n);return ymd(x)};
const hWeekStart=d=>{const x=new Date(d+'T12:00');const k=(x.getDay()+6)%7;x.setDate(x.getDate()-k);return ymd(x)};
function hWeekCount(h,d){const s=hWeekStart(d);let n=0;for(let i=0;i<7;i++){const k=hAdd(s,i);if(k>DAYK)break;if(hCnt(h,k)>=hTarget(h))n++}return n}
/* streak: days (or weeks for x-per-week habits) in a row; today doesn't break it until it's over */
function hStreak(h){const start=h.created||'2000-01-01';
  if(h.type==='week'){const per=+h.per||3;const ok=w=>{let c=0;for(let i=0;i<7;i++){const k=hAdd(w,i);if(k<=DAYK&&hCnt(h,k)>=hTarget(h))c++}return c>=per};let n=0,w=hWeekStart(DAYK);if(ok(w))n++;w=hAdd(w,-7);while(w>=hWeekStart(start)&&ok(w)){n++;w=hAdd(w,-7)}return {n,unit:'wk'}}
  let n=0,d=DAYK;if(!hDone(h,d)||!hDue(h,d))d=hAdd(d,-1);
  for(let i=0;i<2000&&d>=start;i++){if(!hDue(h,d)){d=hAdd(d,-1);continue}if(hDone(h,d)){n++;d=hAdd(d,-1)}else break}return {n,unit:'day'}}
function hBest(h){const start=h.created||DAYK;let best=0,cur=0;for(let d=start;d<=DAYK;d=hAdd(d,1)){if(!hDue(h,d))continue;if(hDone(h,d)){cur++;best=Math.max(best,cur)}else if(d!==DAYK)cur=0}return Math.max(best,hStreak(h).n)}
function hRate(h,days=30){let due=0,ok=0;for(let i=0;i<days;i++){const d=hAdd(DAYK,-i);if(d<(h.created||'0'))break;if(!hDue(h,d))continue;if(i===0&&!hDone(h,d))continue;due++;if(hDone(h,d))ok++}return due?Math.round(ok/due*100):0}
const hAll=()=>HAB.list.filter(h=>!h.arch).concat(hLinked());
const hGet=id=>HAB.list.find(z=>z.id===id)||hLinked().find(z=>z.id===id);
function renderHabits(){if(!habLoaded){loadHabits();return}const el=$('habBody');const L=HAB.list.filter(h=>!h.arch);const LK=hLinked();const ALL=L.concat(LK);
  const today=ALL.filter(h=>hDue(h,DAYK));const done=today.filter(h=>hDone(h,DAYK)).length;
  $('habSub').textContent=ALL.length?`${done}/${today.length} today · ${Math.max(0,...ALL.map(h=>hStreak(h).n))} best current streak`:'build streaks that stick';
  const grps=[];LK.forEach(h=>{let g=grps.find(x=>x.n===h.grp);if(!g)grps.push(g={n:h.grp,col:h.col,L:[]});g.L.push(h)});L.forEach(h=>{const g=h.grp&&grps.find(x=>x.n===h.grp);if(g)g.L.push(h)});
  const gh=grps.map(g=>{const due=g.L.filter(h=>hDue(h,DAYK));const ok=due.filter(h=>hDone(h,DAYK)).length;const open=(HAB.open||[]).includes(g.n);
    return `<div class="panel hgrp${open?' open':''}"><button type="button" class="ph hgh" data-hg="${esc(g.n)}"><span class="tag" style="color:${g.col}">${esc(g.n)}</span><span class="num dim">${ok}/${due.length} today${due.length&&ok===due.length?' ✓':''} <span class="hchev">${open?'▾':'▸'}</span></span></button>${open?`<div class="pb"><div class="hgrid sm">${g.L.sort((a,b)=>hDue(b,DAYK)-hDue(a,DAYK)).map(hTile).join('')}</div></div>`:''}</div>`}).join('');
  el.innerHTML=`<div class="hgrid">${L.filter(h=>!(h.grp&&grps.some(g=>g.n===h.grp))).map(hTile).join('')}<button type="button" class="htile hnew" id="hNew"><span class="hring"><b>＋</b></span><span class="hn">New habit</span></button></div>
    ${gh?`<div style="margin-top:16px">${gh}</div>`:''}
    ${ALL.length?`<div class="dim" style="font-size:11px;text-align:center;margin-top:10px">Hold a habit to complete it · tap for stats</div>`:''}
    ${L.length?`<div class="panel" style="margin-top:14px"><div class="ph"><span class="tag">Last 12 weeks</span><span class="dim">${Math.round(L.reduce((a,h)=>a+hRate(h,30),0)/Math.max(1,L.length))}% in the last 30 days</span></div><div class="pb">${hHeat(null)}</div></div>`:''}`;
  hBind()}
function hTile(h){const c=hCnt(h,DAYK),t=hTarget(h),due=hDue(h,DAYK),ok=hDone(h,DAYK);const st=hStreak(h);const p=h.type==='neg'?(ok?1:0):Math.min(1,c/t);const R=42,C=2*Math.PI*R;
  return `<button type="button" class="htile${ok?' ok':''}${due?'':' off'}${h.type==='neg'?' neg':''}" data-h="${h.id}" style="--hc:${h.col||HCOLS[0]}"><span class="hring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="${R}" class="hb"/><circle cx="50" cy="50" r="${R}" class="hf" style="stroke-dasharray:${C};stroke-dashoffset:${C*(1-p)}"/><circle cx="50" cy="50" r="${R}" class="hh" style="stroke-dasharray:${C};stroke-dashoffset:${C}"/></svg><b>${esc(h.ic||'⭐')}</b>${t>1&&h.type!=='neg'?`<em class="num">${c}/${t}</em>`:''}</span>
    <span class="hn">${esc(hName(h))}</span><span class="hs num">${st.n?`🔥 ${st.n} ${st.unit}${st.n>1?'s':''}`:h.type==='week'?`${hWeekCount(h,DAYK)}/${h.per||3} this week`:due?'start today':'rest day'}</span></button>`}
let hHold=null,hFired=0;
function hBind(){const el=$('habBody');
  el.onclick=e=>{if(e.target.closest('#hNew'))return hEdit(null);const g=e.target.closest('[data-hg]');if(g){const n=g.dataset.hg;const o=new Set(HAB.open||[]);o.has(n)?o.delete(n):o.add(n);HAB.open=[...o];hSave();renderHabits();return}const t=e.target.closest('[data-h]');if(!t)return;if(Date.now()-hFired<700)return;hDetail(t.dataset.h)};
  const start=(t,x)=>{if(hHold)return;const h=hGet(t.dataset.h);if(!h)return;const ring=t.querySelector('.hh');const C=2*Math.PI*42;
    ring.style.transition='none';ring.style.strokeDashoffset=C;void ring.offsetWidth;ring.style.transition='stroke-dashoffset .6s linear';ring.style.strokeDashoffset=0;t.classList.add('holding');
    hHold={t,x:x&&x.clientX,y:x&&x.clientY,timer:setTimeout(()=>{hFired=Date.now();hHold=null;t.classList.remove('holding');hTick(h,t)},600),ring,C}};
  const stop=()=>{if(!hHold)return;clearTimeout(hHold.timer);hHold.ring.style.transition='stroke-dashoffset .2s';hHold.ring.style.strokeDashoffset=hHold.C;hHold.t.classList.remove('holding');hHold=null};
  el.onpointerdown=e=>{const t=e.target.closest('[data-h]');if(t)start(t,e)};el.onpointerup=el.onpointercancel=stop;el.onpointermove=e=>{if(hHold&&hHold.x!=null&&Math.hypot(e.clientX-hHold.x,e.clientY-hHold.y)>12)stop()};
  el.oncontextmenu=e=>{if(e.target.closest('[data-h]'))e.preventDefault()}}
function hTick(h,tile){const fx=()=>{try{navigator.vibrate&&navigator.vibrate(hDone(h,DAYK)?[20,40,20]:10)}catch(e){}if(tile&&hDone(h,DAYK)&&h.type!=='neg'){const r=tile.getBoundingClientRect();burst(r.left+r.width/2,r.top+r.height/2,40,true)}};
  if(h.names){const its=visibleItems().filter(i=>h.names.includes(i.item.trim()));
    if(!its.length){const d=HLOG.d[DAYK]=HLOG.d[DAYK]||{};if(d[h.id])delete d[h.id];else d[h.id]=hTarget(h);hSaveLog()}
    else{const done=hDone(h,DAYK);const nx=its.find(i=>!DAY.ticks[i.tk]);
      if(!done&&nx)setTick(nx.tk,true);else{its.forEach(i=>{delete DAY.ticks[i.tk]});const m=HLOG.d[DAYK];if(m&&m[h.id]){delete m[h.id];hSaveLog()}persistDay();applyTicks()}}
    fx();renderHabits();hWidget();return}
  const d=HLOG.d[DAYK]=HLOG.d[DAYK]||{};const t=hTarget(h);
  if(h.type==='neg'){d[h.id]=(d[h.id]||0)?0:1}else{const c=d[h.id]||0;d[h.id]=c>=t?0:c+1}
  if(!d[h.id])delete d[h.id];hSaveLog();try{navigator.vibrate&&navigator.vibrate(hDone(h,DAYK)?[20,40,20]:10)}catch(e){}
  if(hDone(h,DAYK)&&h.type!=='neg'){const r=tile.getBoundingClientRect();burst(r.left+r.width/2,r.top+r.height/2,40,true)}
  renderHabits();if(typeof pushSync==='function')pushSync()}
function hHeat(h){const weeks=12;const s=hAdd(hWeekStart(DAYK),-7*(weeks-1));const L=h?[h]:HAB.list.filter(x=>!x.arch);let cells='';
  for(let w=0;w<weeks;w++){cells+='<div class="hcol">';for(let i=0;i<7;i++){const d=hAdd(s,w*7+i);if(d>DAYK){cells+='<i class="fut"></i>';continue}
    const due=L.filter(x=>hDue(x,d)&&d>=(x.created||'0'));const ok=due.filter(x=>hDone(x,d)).length;const v=due.length?ok/due.length:0;
    cells+=`<i title="${d} · ${ok}/${due.length}" style="${v?`background:${h?h.col:'var(--pink)'};opacity:${.2+.8*v}`:''}" class="${d===DAYK?'td':''}"></i>`}cells+='</div>'}
  return `<div class="hheat">${cells}</div>`}
/* log / undo a past day for a Today-linked habit: edits that day's doc so Today and streaks stay one source */
async function hPast(h,d){if(d>DAYK)return;const p='days/d-'+d;const doc=(await load(p))||{};let nm=(doc.names||[]).slice();
  if(hDone(h,d)){nm=nm.filter(x=>!h.names.includes(String(x).trim()));const m=HLOG.d[d];if(m&&m[h.id]){delete m[h.id];if(!Object.keys(m).length)delete HLOG.d[d];hSaveLog()}}
  else{const need=hTarget(h,d)-hCnt(h,d);let pool=h.once?[h.names[0]]:h.names.flatMap(n=>Array(hlItems(d,n).length).fill(n));if(!pool.length)pool=[h.names[0]];nm=nm.concat(pool.slice(0,Math.max(1,need)))}
  doc.names=nm;DNAMES[d]=nm;save(p,doc);try{navigator.vibrate&&navigator.vibrate(10)}catch(e){}}
function hRename(h){openSheet('rename','');$('sheetBody').innerHTML=`<label class="fl">Name<input class="inp" id="hrN" value="${esc(hName(h))}"></label><div class="bigbtns" style="margin-top:12px"><button class="btn" type="button" id="hrR">Reset</button><span style="flex:1"></span><button class="btn p" type="button" id="hrOk">Save</button></div>`;
  const done=()=>{hSave();hWidget();closeSheet();renderHabits()};
  $('hrOk').onclick=()=>{const v=($('hrN').value||'').trim();HAB.ren=HAB.ren||{};if(v&&v!==hDisp(h.n))HAB.ren[h.id]=v;else delete HAB.ren[h.id];done()};
  $('hrR').onclick=()=>{if(HAB.ren)delete HAB.ren[h.id];done()}}
function hSplit(h){HAB.combo=(HAB.combo||[]).filter(c=>c.id!==h.combo);hSave();closeSheet();renderHabits()}
function hCombo(h){const L=hLinked().filter(x=>!x.combo);const sel=new Set([h.id]);let nm=hDisp(h.n),once=false,every=false;
  const draw=()=>{$('sheetBody').innerHTML=`<label class="fl">Name<input class="inp" id="hcN" value="${esc(nm)}"></label><div class="dim" style="font-size:11px;margin:8px 0 4px">Combine with</div><div>${L.map(x=>`<button type="button" class="btn${sel.has(x.id)?' p':''}" data-cm="${x.id}" style="margin:2px">${esc(x.n)}</button>`).join('')}</div>
    <label class="fl" style="margin-top:10px"><input type="checkbox" id="hcO"${once?' checked':''}> count once a day (any one of them)</label><label class="fl"><input type="checkbox" id="hcE"${every?' checked':''}> due every day</label>
    <div class="bigbtns" style="margin-top:12px"><span style="flex:1"></span><button class="btn p" type="button" id="hcOk">Combine</button></div>`};
  const read=()=>{nm=($('hcN').value||'').trim();once=$('hcO').checked;every=$('hcE').checked};
  openSheet('combine streaks','');draw();
  $('sheetBody').onclick=e=>{const b=e.target.closest('button');if(!b)return;
    if(b.dataset.cm){read();const id=b.dataset.cm;if(id!==h.id)sel.has(id)?sel.delete(id):sel.add(id);draw();return}
    if(b.id==='hcOk'){read();HAB.combo=(HAB.combo||[]).concat({id:rid(),n:nm||hDisp(h.n),names:L.filter(x=>sel.has(x.id)).map(x=>x.n),once,every});hSave();closeSheet();renderHabits()}}}
function hDetail(id){const h=hGet(id);if(!h)return;const st=hStreak(h);
  const hist=[...Array(28)].map((_,i)=>{const d=hAdd(DAYK,-27+i);return `<button type="button" class="hday${hDone(h,d)?' ok':''}${hDue(h,d)?'':' off'}" data-hd="${d}" style="--hc:${h.col}"><span>${new Date(d+'T12:00').toLocaleDateString('en-GB',{weekday:'narrow'})}</span><b>${new Date(d+'T12:00').getDate()}</b></button>`}).join('');
  openSheet(`${h.ic||''} ${hName(h)}`,`<div class="hstats num"><div><b style="color:${h.col}">${st.n}</b><span>current ${st.unit}s</span></div><div><b>${hBest(h)}</b><span>Best</span></div><div><b>${hRate(h,30)}%</b><span>Last 30 days</span></div><div><b>${h.link?Object.keys(DNAMES).filter(d=>hDone(h,d)).length:Object.values(HLOG.d).filter(x=>x[h.id]).length}</b><span>${h.type==='neg'?'slips':'total'}</span></div></div>
    ${hHeat(h)}<div class="dim" style="font-size:11px;margin:12px 0 6px">Last 28 days — tap a day to log or fix it</div><div class="hdays">${hist}</div>
    <div class="dim" style="font-size:11px;margin-top:10px">${h.type==='neg'?'avoid it — hold the tile if you slipped':h.type==='week'?`${h.per||3}× a week`:h.type==='days'?'on '+(h.days||[]).map(i=>DOW[i]).join(' '):'every day'}${hTarget(h)>1?` · ${hTarget(h)} ${esc(h.unit||'times')} a day`:''}${h.remind?` · reminder ${h.remind}`:''}</div>
    <div class="bigbtns" style="margin-top:14px">${h.names?`<button class="btn" type="button" id="hRn">Rename</button><button class="btn" type="button" id="hCb">${h.combo?'split':'combine'}</button><button class="btn" type="button" id="hHide">Hide</button>`:'<button class="btn" type="button" id="hEd">Edit</button>'}<span style="flex:1"></span><button class="btn p" type="button" id="hOk">Done</button></div>`);
  $('hOk').onclick=closeSheet;if($('hRn'))$('hRn').onclick=()=>hRename(h);if($('hCb'))$('hCb').onclick=()=>h.combo?hSplit(h):hCombo(h);if($('hEd'))$('hEd').onclick=()=>hEdit(h);if($('hHide'))$('hHide').onclick=()=>{HAB.hide=(HAB.hide||[]).concat(h.id);hSave();closeSheet();renderHabits()};
  $('sheetBody').onclick=e=>{const b=e.target.closest('[data-hd]');if(!b)return;const d=b.dataset.hd;if(h.names){(d===DAYK?Promise.resolve(hTick(h)):hPast(h,d)).then(()=>{hDetail(id);renderHabits()});return}const o=HLOG.d[d]=HLOG.d[d]||{};if(h.type==='neg')o[h.id]=o[h.id]?0:1;else o[h.id]=hDone(h,d)?0:hTarget(h);if(!o[h.id])delete o[h.id];hSaveLog();hDetail(id);renderHabits()}}
function hEdit(h){const isNew=!h;h=h?clone(h):{id:rid(),n:'',ic:'💪',col:HCOLS[HAB.list.length%HCOLS.length],type:'daily',per:3,days:[1,2,3,4,5],q:1,unit:'',remind:'',created:DAYK};
  const draw=()=>{$('sheetBody').innerHTML=`<label class="fl">Habit<input class="inp" id="heN" value="${esc(h.n)}" placeholder="E.g. gym, skincare, no sugar"></label>
    <div class="dim" style="font-size:11px;margin:4px 0">Icon</div><div class="hicons">${HICONS.map(i=>`<button type="button" data-hi="${i}" class="${h.ic===i?'on':''}">${i}</button>`).join('')}</div>
    <div class="dim" style="font-size:11px;margin:10px 0 4px">Folder</div><div class="seg mini" style="flex-wrap:wrap">${[''].concat([...new Set(hLinked().map(x=>x.grp))]).map(g=>`<button type="button" data-hf="${esc(g)}" aria-pressed="${(h.grp||'')===g}">${g?esc(g):'none'}</button>`).join('')}</div>
    <div class="dim" style="font-size:11px;margin:10px 0 4px">Type</div><div class="seg mini">${[['daily','every day'],['days','some days'],['week','x per week'],['neg','break a habit']].map(([k,l])=>`<button type="button" data-ht="${k}" aria-pressed="${h.type===k}">${l}</button>`).join('')}</div>
    ${h.type==='days'?`<div class="hdow">${[1,2,3,4,5,6,0].map(i=>`<button type="button" data-hw="${i}" class="${(h.days||[]).includes(i)?'on':''}">${DOW[i]}</button>`).join('')}</div>`:''}
    ${h.type==='week'?`<label class="fl" style="margin-top:8px">Times per week<input class="inp num" id="heP" value="${h.per||3}" inputmode="numeric"></label>`:''}
    ${h.type!=='neg'?`<div class="fgrid4" style="margin-top:8px"><label class="fl">Times a day<input class="inp num" id="heQ" value="${h.q||1}" inputmode="numeric"></label><label class="fl">Unit (optional)<input class="inp" id="heU" value="${esc(h.unit||'')}" placeholder="Glasses, pages…"></label></div>`:''}
    <label class="fl" style="margin-top:8px">🔔 reminder<input type="time" class="inp" id="heR" value="${h.remind||''}"></label>
    <div class="bigbtns" style="margin-top:12px">${isNew?'':'<button class="btn d" type="button" id="heDel">Delete</button>'}<span style="flex:1"></span><button class="btn p" type="button" id="heOk">${isNew?'add habit':'save'}</button></div>`};
  openSheet(isNew?'new habit':'edit habit','');draw();
  const read=()=>{const v=id=>$(id)?$(id).value:null;h.n=(v('heN')||'').trim();if(v('heP')!=null)h.per=Math.max(1,Math.min(7,+v('heP')||3));if(v('heQ')!=null)h.q=Math.max(1,+v('heQ')||1);if(v('heU')!=null)h.unit=v('heU').trim();h.remind=v('heR')||''};
  $('sheetBody').onclick=e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;
    if(d.hi||d.hc||d.ht||d.hw||d.hf!==undefined){read();if(d.hf!==undefined){h.grp=d.hf;const g=hLinked().find(x=>x.grp===d.hf);h.col=g?g.col:HCOLS[0]}if(d.hi)h.ic=d.hi;if(d.hc)h.col=d.hc;if(d.ht)h.type=d.ht;if(d.hw){const i=+d.hw;h.days=(h.days||[]).includes(i)?h.days.filter(x=>x!==i):(h.days||[]).concat(i)}draw();return}
    if(b.id==='heDel'){if(!b.dataset.arm){b.dataset.arm=1;b.textContent='tap again';return}HAB.list=HAB.list.filter(x=>x.id!==h.id);hSave();closeSheet();renderHabits();return}
    if(b.id==='heOk'){read();if(!h.n){$('heN').focus();return}const i=HAB.list.findIndex(x=>x.id===h.id);if(i>=0)HAB.list[i]=h;else HAB.list.push(h);hSave();hWidget();closeSheet();renderHabits();if(typeof pushSync==='function')pushSync()}}}
/* widget feed: a small summary doc any future widget can read */
let hWLast='';function hWidget(){if(!habLoaded)return;const L=hAll(),s0=hAdd(hWeekStart(DAYK),-77);
  /* g: 84 days from a Monday 11 weeks back — 1 done, 0 missed, . not due, f future */
  const g=h=>{let o='';for(let i=0;i<84;i++){const k=hAdd(s0,i);o+=k>DAYK?'f':(h.created&&k<h.created)||!hDue(h,k)?'.':hDone(h,k)?'1':'0'}return o};
  const w={day:DAYK,from:s0,items:L.map(h=>{const st=hStreak(h);return {n:hName(h),ic:h.ic,col:h.col,streak:st.n,unit:st.unit,done:hDone(h,DAYK),due:hDue(h,DAYK),c:hCnt(h,DAYK),t:hTarget(h),g:g(h)}})};
  const sig=JSON.stringify(w);if(sig===hWLast)return;hWLast=sig;save('widget/streaks',{at:new Date().toISOString(),...w},true)}

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
      ${td.length?srt(td).map(row).join(''):(ov.length?'':'<div class="dim tempty">Nothing due today — add one in the journal</div>')}
      ${doneToday.length?`<div class="tgrp">Done</div>${doneToday.map(row).join('')}`:''}</div></div>`;
  if(!el.dataset.hold){el.dataset.hold=1;tHold(el,'[data-tte]',c=>tEdit(c.dataset.tte))}
  el.onclick=e=>{const b=e.target.closest('[data-ttc],[data-tte],#ttGo');if(!b)return;
    if(b.id==='ttGo'){JTAB='tasks';JB.f='due';jSaveV();go('journal');setJTab('tasks');return}
    if(b.dataset.ttc){if(!tToggle(b.dataset.ttc))return;const r=b.closest('.ttrow');if(r)r.classList.add('pop');
      setTimeout(()=>{tSave();renderTodayTasks();if(cur==='journal'&&JTAB==='tasks')renderTasks()},260);return}
    if(b.dataset.tte){JTAB='tasks';go('journal');setJTab('tasks');setTimeout(()=>tEdit(b.dataset.tte),250)}}}
watch('tasks/all',()=>{if(cur==='today')renderTodayTasks()});

/* ================= NOTES · handwriting over the typed page ================= */
let NL=null;const NSTK={};
function nInkBusy(){return !!NL&&(!!NL.drawing||Date.now()-NL.last<3000)}
function nInkDirty(){const n=NOTES[NCUR];if(!n)return;n.upd=new Date().toISOString();if($('nSaved'))$('nSaved').textContent='…';clearTimeout(nSaveT);nSaveT=setTimeout(nSave,1800)}
function nInkMount(){
  const ed=document.querySelector('#jPaneN .neditor'),ned=$('nEd');if(!ed||!ned||!NCUR||!NOTES[NCUR])return;
  if(NL){NL.destroy();NL=null}
  document.documentElement.classList.toggle('inkfull-on',!!document.querySelector('.inkfull'));
  const host=document.createElement('div');host.className='inkhost';ned.replaceWith(host);
  const cv=document.createElement('canvas');cv.className='inkcv';host.append(ned,cv);
  const bar=document.createElement('div');bar.id='nTools';const tb=ed.querySelector('.nhead');tb?tb.after(bar):ed.prepend(bar);
  const id=NCUR;
  NL=inkLayer({host,canvas:cv,bar,full:ed,fmt:NFMT_HTML,paper:true,stack:NSTK[id]||(NSTK[id]={undo:[],redo:[]}),
    get:()=>{const n=NOTES[id];return n&&n.ink||null},
    make:()=>{const n=NOTES[id];if(!n.ink)n.ink={h:IH,strokes:[],bg:'blank'};return n.ink},changed:nInkDirty});
  const hp=document.createElement('div');hp.className='ib-pop ib-hlpop';
  hp.innerHTML=NHL.map(c=>`<button type="button" class="ib-dot" data-nc="hl:${c}" style="--c:${c.replace(/,[.\d]+\)/,')').replace('rgba','rgb')}" aria-label="Highlight colour"></button>`).join('')+'<button type="button" class="ib-none" data-nc="hl:none" title="Remove highlight">None</button>';
  bar.append(hp);NL.refresh();NL.size()}
document.addEventListener('pointerdown',e=>{const p=document.querySelector('#nTools .ib-hlpop.open');if(p&&!e.target.closest('.ib-hlpop,[data-nc="hl"]'))p.classList.remove('open')},true);
/* list thumbnail for handwritten notes (cached per note + last-edit time) */
const NTH=new Map();
function nThumb(n){const S=n.ink&&n.ink.strokes;if(!S||!S.length)return '';const key=n.id+'|'+n.upd;let u=NTH.get(key);
  if(!u){for(const k of NTH.keys())if(k.startsWith(n.id+'|'))NTH.delete(k);
    let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;S.forEach(s=>{for(let i=0;i<s.pts.length;i+=3){x0=Math.min(x0,s.pts[i]);x1=Math.max(x1,s.pts[i]);y0=Math.min(y0,s.pts[i+1]);y1=Math.max(y1,s.pts[i+1])}});
    const pad=20,bw=Math.max(60,x1-x0+pad*2),bh=Math.max(60,y1-y0+pad*2),T=88,sc=Math.min(T/bw,T/bh);const c=document.createElement('canvas');c.width=c.height=T;const g=c.getContext('2d');
    g.lineCap='round';g.lineJoin='round';const ox=(T-bw*sc)/2-(x0-pad)*sc,oy=(T-bh*sc)/2-(y0-pad)*sc;
    S.forEach(s=>{if(s.pts.length<6)return;g.strokeStyle=s.c;g.globalAlpha=s.t==='hl'?.35:1;g.lineWidth=Math.max(1,s.w*sc*(s.t==='hl'?3:1));g.beginPath();for(let i=0;i<s.pts.length;i+=3){const X=s.pts[i]*sc+ox,Y=s.pts[i+1]*sc+oy;i?g.lineTo(X,Y):g.moveTo(X,Y)}g.stroke()});
    u=c.toDataURL('image/png');NTH.set(key,u)}
  return `<img class="nth" alt="" src="${u}">`}

/* ================= COMPETITIVE RANKS (Rocket League ladder) =================
   Score 0–21+: 3 divisions per tier, Bronze I … Grand Champion III, then Supersonic Legend.
   Exercise rank = your best set vs bodyweight-scaled strength standards.
   Session rank = working sets + records + volume vs your recent sessions + how strong the sets were. */
const rlBW=()=>typeof curKg==='function'?(curKg()||80):80;
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
function rlSetScore(e,s,std){std=std||rlStd(e);if(!std||!std.s||s.t==='w'||s.done===false)return null;const bw=rlBW();const r=Math.min(12,+s.r||0);
  if(std.k==='bw')return +s.r>0?rlScoreRatio(+s.r,std.s):null;
  if(std.k==='wbw')return r>0?rlScoreRatio((bw+(+s.kg||0))*(1+r/30)/bw,std.s):null;
  return (+s.kg>0&&r>0)?rlScoreRatio((+s.kg)*(1+r/30)/bw,std.s):null}
function rlBestIn(e,x,std){let b=null;(x.sets||[]).forEach(s=>{const v=rlSetScore(e,s,std);if(v!=null&&(b==null||v>b))b=v});return b}
/* best score for an exercise across history (optionally excluding a workout id) plus extra sets */
function rlEx(id,excl,extra){const e=EXMAP.get(id)||exOf({id,n:id});const std=rlStd(e);if(!std||!std.s)return null;let b=null;
  exHistory(e.id,excl).forEach(o=>{const v=rlBestIn(e,o.x,std);if(v!=null&&(b==null||v>b))b=v});
  if(extra){const v=rlBestIn(e,extra,std);if(v!=null&&(b==null||v>b))b=v}return b}
function rlSession(w,ws){ws=ws||WORKOUTS;const t=w.startedAt||w.date;const prev=ws.filter(o=>o.id!==w.id&&(o.startedAt||o.date)<t).slice(0,10);
  const vols=prev.map(rlVol).filter(v=>v>0);const avg=vols.length?vols.reduce((a,b)=>a+b,0)/vols.length:0;const r=avg?rlVol(w)/avg:1;
  const sc=(w.ex||[]).map(x=>rlBestIn(exOf(x),x)).filter(v=>v!=null);const q=sc.length?sc.reduce((a,b)=>a+b,0)/sc.length:0;
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
  return `est. 1RM of ${kgs(Math.ceil(v*bw*2)/2)} kg for ${nm}`}
function rlExBlock(e){const sc=rlEx(e.id);if(sc==null)return '';const r=rlOf(sc);
  return `<div class="rlblock" style="--rc:${RL[r.t][1]}">${rlBadge(sc,54)}<div><span class="dim">Rank</span><b>${r.name}</b>${r.t<7?`<div class="rpgbar"><i style="width:${r.frac*100}%;background:var(--rc);box-shadow:0 0 8px var(--rc)"></i></div>`:''}<small class="dim">${esc(rlNext(e,sc))||'top of the ladder'}</small></div></div>`}
function rlTopList(n){const seen=new Map();WORKOUTS.forEach(w=>(w.ex||[]).forEach(x=>{const e=exOf(x);if(!seen.has(e.id))seen.set(e.id,e)}));
  return [...seen.values()].map(e=>[e,rlEx(e.id)]).filter(a=>a[1]!=null).sort((a,b)=>b[1]-a[1]).slice(0,n)}

/* overall rank = average of your 5 best-ranked lifts (needs at least one ranked lift) */
function rlOverall(){const L=rlTopList(5);return L.length?L.reduce((a,x)=>a+x[1],0)/L.length:null}
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
  const flush=()=>{const cols=[];grp.forEach(ev=>{let c=cols.findIndex(end=>end<=ev.s);if(c<0){c=cols.length;cols.push(0)}cols[c]=ev.e;ev.col=c});
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
  el.innerHTML=`<div class="blk ttblk tcblk"><div class="bh static"><span class="tm">Calendar</span><span class="ti">Today</span><span class="ct">${evs.length} event${evs.length>1?'s':''}</span><button type="button" class="ttgo" id="tcGo">Open calendar</button></div>
    <div class="items">${evs.map(ev=>{const past=!ev.ad&&ev.e<=m,on=ev===nowEv;
      return `<button type="button" class="tcrow${past?' past':''}${on?' now':''}" data-tce="${esc(calKey(ev))}"><i style="background:${calCol(ev)}"></i><span class="num">${ev.ad?'all day':calFmt(ev.s,ev.e)}</span><b>${esc(ev.t)}</b></button>`}).join('')}</div></div>`;
  el.onclick=e=>{const b=e.target.closest('#tcGo,[data-tce]');if(!b)return;if(b.id==='tcGo'){calAt=null;go('week');return}
    const ev=calEvents(new Date()).find(x=>calKey(x)===b.dataset.tce);if(ev)calDetail(ev)}}

setInterval(()=>{if(typeof cur!=='undefined'&&cur==='today'&&!document.hidden)renderTodayCal()},60e3);document.addEventListener('visibilitychange',()=>{if(!document.hidden&&typeof cur!=='undefined'&&cur==='today')renderTodayCal()});

/* ================= BRICK — phone lockdown =================
   A web app can't block iPhone apps itself (only Apple's Screen Time API can, and that needs a native app).
   What this does instead: it drives an iOS Shortcut, which CAN turn on a Focus that hides and silences your apps —
   and if you own the real Brick, it runs that app's shortcut too. The app tracks the state, time and streaks. */
/* date of birth arrives once via ?dob=YYYY-MM-DD and is kept in kv (never in this repo) */
{const q=new URLSearchParams(location.search).get('dob');if(q&&/^\d{4}-\d\d-\d\d$/.test(q)){LS.set('dobq',q);history.replaceState(null,'',location.pathname+location.hash)}}
const bAge=()=>{if(!BRICK.dob)return +BRICK.age||null;const d=new Date(BRICK.dob+'T12:00'),n=new Date();return (n-d)/(365.2425*864e5)};
let BST={};/* daily screen time from the morning Shortcut, health/d-<day>.screentime */
const bSTh=v=>v<=0||isNaN(v)?null:v/3600;   // Jomo sends seconds
let BRICK={on:false,since:null,until:null,sessions:[],strict:false,auto:false,sOn:'Brick On',sOff:'Brick Off'},brickLoaded=false,brickTick=null;
const bMin=(a,b)=>Math.max(0,Math.round((b-a)/60000));
async function loadBrick(){if(brickLoaded){renderBrick();return}
  try{const d=await load('tools/brick');if(d)BRICK={...BRICK,...d}}catch(e){}
  try{(await listDocs('health/d-')).forEach(r=>{const v=r.data&&(r.data.screentime??r.data.screen);if(v!=null)BST[r.path.slice(9)]=+v})}catch(e){}
  {const q=LS.get('dobq');if(q){BRICK.dob=q;LS.set('dobq','');bSave()}}
  brickLoaded=true;
  if(BRICK.on&&BRICK.until&&Date.now()>BRICK.until)bEnd(true);   // ran out while the app was closed
  renderBrick()}
const bSave=()=>save('tools/brick',BRICK,true);
/* fire a Shortcut by name. Needs a real tap, so only call this from a click handler.
   An <a> click is used rather than location.href so a missing handler can't blank the page. */
const bIOS=()=>/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
function bRun(name,input){if(!name)return false;
  if(!bIOS()){bToast('Shortcuts only run on your iPhone — the timer still counts here.');return false}
  const a=document.createElement('a');a.href='shortcuts://run-shortcut?name='+encodeURIComponent(name)+(input?'&input=text&text='+encodeURIComponent(input):'');a.style.display='none';
  document.body.appendChild(a);a.click();setTimeout(()=>a.remove(),0);return true}
function bToast(msg){const t=document.createElement('div');t.className='bktoast';t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),3200)}
function bStart(mins){const now=Date.now();BRICK.on=true;BRICK.since=now;BRICK.until=mins?now+mins*60000:null;bSave();
  const e=new Date(BRICK.until||now+864e5);bRun(BRICK.sOn,ymd(e)+' '+pad(e.getHours())+':'+pad(e.getMinutes()));renderBrick();try{navigator.vibrate&&navigator.vibrate([25,60,25])}catch(e){}}
function bEnd(auto){const now=Date.now();const min=BRICK.since?bMin(BRICK.since,Math.min(now,BRICK.until||now)):0;
  const broke=!auto&&BRICK.until&&now<BRICK.until;
  if(min>0)BRICK.sessions.unshift({d:DAYK,at:new Date(BRICK.since).toISOString(),min,broke:!!broke});
  BRICK.sessions=BRICK.sessions.slice(0,400);BRICK.on=false;BRICK.since=null;BRICK.until=null;bSave();
  if(!auto)bRun(BRICK.sOff);renderBrick()}
function bLeft(){return BRICK.on&&BRICK.until?Math.max(0,Math.round((BRICK.until-Date.now())/1000)):null}
const bToday=()=>BRICK.sessions.filter(s=>s.d===DAYK).reduce((a,s)=>a+s.min,0)+(BRICK.on&&BRICK.since?bMin(BRICK.since,Date.now()):0);
function bStreak(){let n=0;for(let i=0;;i++){const d=addDays(DAYK,-i);const m=BRICK.sessions.filter(s=>s.d===d).reduce((a,s)=>a+s.min,0)+(i===0&&BRICK.on&&BRICK.since?bMin(BRICK.since,Date.now()):0);
  if(m>=25)n++;else if(i>0)break;else if(!n&&i===0)break}return n}
function bHMS(s){return (s>=3600?Math.floor(s/3600)+':':'')+pad(Math.floor(s/60)%60)+':'+pad(s%60)}
const bHM=m=>m>=60?Math.floor(m/60)+'h '+pad(m%60)+'m':m+'m';
function bLife(){const ks=Object.keys(BST).sort().slice(-7),vals=ks.map(k=>bSTh(BST[k])).filter(x=>x!=null);
  const st=vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length*10)/10:null,age=bAge(),goal=BRICK.goalH==null?2:+BRICK.goalH;
  if(st==null)return `<div class="bk-card bk-life"><div class="bk-h"><span>Your phone life</span></div>
    <p class="bk-p">Waiting for your screen time. Add one line to your morning sleep Shortcut and this fills in by itself:</p>
    <ol class="sl-steps"><li>Shortcut <b>Send screen time</b>: Jomo <i>Get Today's Screen Time</i> → Text <code>Screen Time|</code> + that result → Get Contents of URL (your sleep upload link, POST, File = Text).</li><li>Automation → Time of Day <b>23:55</b> daily → Run Immediately → Send screen time.</li></ol></div>`;
  if(!age)return `<div class="bk-card bk-life"><div class="bk-h"><span>Your phone life</span></div><div class="bk-big num">${st}<small> h a day</small></div>
    <p class="bk-p">Your average over the last ${vals.length} day${vals.length===1?'':'s'}. One last thing — how old are you?</p>
    <div class="bk-goal" style="background:rgba(255,255,255,.04)"><div><span>Age</span><div class="bk-step"><button type="button" data-age="-1" aria-label="Younger">−</button><b class="num">${BRICK.ageTmp||21}</b><button type="button" data-age="1" aria-label="Older">+</button></div></div><button class="btn p sm" type="button" id="bkAgeOk">Done</button></div></div>`;
  const left=Math.max(1,80-age),yrs=left*st/24,goalY=left*Math.min(st,goal)/24,back=Math.max(0,yrs-goalY),waking=Math.round(st/16*100);
  const sl=left*8/24,free=left-sl-yrs;const W=x=>(x/left*100).toFixed(2)+'%';
  return `<div class="bk-card bk-life"><div class="bk-h"><span>Your phone life</span><em>${vals.length}-day average</em></div>
    <div class="bk-big num">${yrs.toFixed(1)}<small> years</small></div>
    <p class="bk-p">of the rest of your life will be spent looking at your phone, at <b>${st}h a day</b> from ${Math.floor(age)} to 80. That's <b>${waking}%</b> of every waking hour.</p>
    <div class="bk-lifebar"><i style="width:${W(yrs)};background:var(--pink)"></i><i style="width:${W(sl)};background:#5e5ce6"></i><i style="width:${W(Math.max(0,free))};background:rgba(255,255,255,.14)"></i></div>
    <div class="bk-keys"><span><i style="background:var(--pink)"></i>phone ${yrs.toFixed(1)}y</span><span><i style="background:#5e5ce6"></i>sleep ${sl.toFixed(0)}y</span><span><i style="background:rgba(255,255,255,.3)"></i>everything else ${Math.max(0,free).toFixed(1)}y</span></div>
    <div class="bk-goal"><div><span>Cut it to</span><div class="bk-step"><button type="button" data-gh="-0.5" aria-label="Less">−</button><b class="num">${String(goal).replace(/\.0$/,'')}h</b><button type="button" data-gh="0.5" aria-label="More">+</button></div><span>a day</span></div>
      <div class="bk-back"><b class="num">+${back.toFixed(1)} years</b><span>of your life back</span></div></div></div>`}
function renderBrick(){const el=$('t-brick');if(!el)return;if(!brickLoaded){loadBrick();return}
  const l=bLeft(),today=bToday(),streak=bStreak();
  const days=[...Array(7)].map((_,i)=>addDays(DAYK,i-6));
  const per=days.map(d=>BRICK.sessions.filter(s=>s.d===d).reduce((a,s)=>a+s.min,0)+(d===DAYK&&BRICK.on&&BRICK.since?bMin(BRICK.since,Date.now()):0));
  const week=per.reduce((a,b)=>a+b,0),mx=Math.max(60,...per),log=BRICK.sessions.filter(s=>s.d===DAYK).slice(0,8);
  const all=BRICK.sessions.reduce((a,s)=>a+s.min,0)+(BRICK.on&&BRICK.since?bMin(BRICK.since,Date.now()):0);
  const ready=!!BRICK.sOn,pre=BRICK.pre?BRICK.pre:25;
  const tot=BRICK.on&&BRICK.until?(BRICK.until-BRICK.since)/1000:0,pct=tot?Math.max(0,Math.min(100,(1-l/tot)*100)):0;
  const sw=(id,on,t,s)=>`<label class="bk-frow"><span>${t}<small>${s}</small></span><input type="checkbox" class="sl-sw" id="${id}" ${on?'checked':''}></label>`;
  const hero=BRICK.on?`<div class="bk-card bk-hero on">
      <div class="bk-ringw"><div class="sl-ring" style="width:210px;height:210px"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" class="tr" stroke-width="5"/><circle id="bkRing" cx="50" cy="50" r="46" class="fl" stroke="var(--pink)" stroke-width="5" pathLength="100" stroke-dasharray="${(l!=null?pct:100).toFixed(2)} 100"/></svg>
        <div class="in"><svg viewBox="0 0 24 24" width="22" height="22" class="bk-lk"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2"/></svg><b class="num" id="bkLeft">${l!=null?bHMS(l):bHM(bMin(BRICK.since,Date.now()))}</b><span>${l!=null?'until '+new Date(BRICK.until).toTimeString().slice(0,5):'bricked · open-ended'}</span></div></div></div>
      <div class="bk-title">Phone bricked</div><p class="bk-p c">Stay with it. Everything unlocks by itself at ${l!=null?new Date(BRICK.until).toTimeString().slice(0,5):'the end'}.</p>
      <div class="bk-sealed"><svg viewBox="0 0 24 24" width="15" height="15"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>No way out until it ends</div></div>`
    :`<div class="bk-card bk-hero">
      <div class="bk-lock"><svg viewBox="0 0 24 24" width="40" height="40"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 10.5V8a4 4 0 0 1 7.6-1.7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="15.5" r="1.4" fill="currentColor"/></svg></div>
      <div class="bk-title">Phone is open</div><p class="bk-p c">${today?bHM(today)+' bricked today':'Nothing bricked yet today'}</p>
      <div class="bk-lab">Duration</div>
      <div class="seg bk-pre" id="bkPre">${[25,50,90,180].map(m=>`<button type="button" data-m="${m}" aria-pressed="${pre===m}">${m>=60?(m/60+'h').replace('.5h','½h'):m+'m'}</button>`).join('')}<button type="button" data-m="custom" aria-pressed="${![25,50,90,180].includes(pre)}">${![25,50,90,180].includes(pre)?pre+'m':'Custom'}</button></div>
      <button class="btn p bk-wide bk-go" type="button" id="bkOn"${ready?'':' disabled'}>Brick my phone</button>
      ${ready?'':'<div class="bk-warn">Set up the shortcuts first, see Setup below.</div>'}
      <div class="bk-form bk-opts">${sw('bkAuto',BRICK.auto,'Brick with focus timer','Locks when a focus timer starts')}</div></div>`;
  const tile=(lab,v,s)=>`<div class="sl-tile"><span>${lab}</span><b class="num">${v}</b><em>${s}</em></div>`;
  el.innerHTML=`<div class="bk-grid"><div class="bk-col">${hero}
    <div class="sl-tiles bk-tiles">${tile('Today',bHM(today),log.length+' session'+(log.length===1?'':'s'))}${tile('Streak',streak+'<small> day'+(streak===1?'':'s')+'</small>','25 min+ a day')}${tile('This week',bHM(week),'last 7 days')}${tile('Reclaimed',(all/60).toFixed(all<600?1:0)+'<small> h</small>','≈ '+(all/1440).toFixed(1)+' days, all time')}</div></div>
    <div class="bk-col">${bLife()}
    <div class="bk-card"><div class="bk-h"><span>Last 7 days</span><em>${bHM(week)}</em></div>
      <div class="bk-bars">${per.map((v,i)=>`<div><em class="num">${v?(v/60).toFixed(1)+'h':''}</em><span style="height:${(v/mx*100).toFixed(1)}%"${days[i]===DAYK?' class="t"':''}></span><small>${new Date(days[i]+'T12:00').toLocaleDateString('en-GB',{weekday:'narrow'})}</small></div>`).join('')}</div>
      ${log.length?`<div class="sl-rows bk-log">${log.map(s=>`<div><span><i class="dot" style="background:${s.broke?'#ff453a':'#30d158'}"></i>${new Date(s.at).toTimeString().slice(0,5)}<small>${s.broke?'ended early':'completed'}</small></span><b class="num">${bHM(s.min)}</b></div>`).join('')}</div>`:''}</div>
    <div class="bk-card"><details class="sl-det bk-setup"${ready?'':' open'}><summary>Setup</summary>
      <ol class="sl-steps">
        <li><b>Jomo</b> (free): Rules → Start blocking → pick the apps to block, turn on <b>Strict Mode</b>, save it as <b>Brick</b>.</li>
        
        <li>Shortcuts app → new shortcut <b>Brick On</b> → Jomo <i>Start Session</i> → Brick, Timing <i>Until Date</i>, Date = <i>Shortcut Input</i>, Show When Run off.</li>
        <li>Tap <b>Test lock</b> below. Your blocked apps grey out for about a minute, then unlock by themselves.</li></ol>
      <div class="bk-form" style="margin-top:12px"><label class="bk-frow"><span>Lock shortcut</span><input class="inp" id="bkSOn" value="${esc(BRICK.sOn||'')}" placeholder="Brick On"></label></div>
      <div class="sl-btns"><button class="btn" type="button" id="bkTestOn">Test lock</button></div>
      <div class="sl-note">The name must match your Shortcut exactly. Your app tells Jomo when to unlock, so a brick can't be ended early. The blocking itself is done by Jomo through Apple's Screen Time. This app is the switch and the record.</div></details></div>
  </div></div>`;
  bindBrick();if(typeof toolCardSubs==='function')toolCardSubs();clearInterval(brickTick);if(BRICK.on)brickTick=setInterval(()=>{if(cur==='tools'&&TOOLV==='brick'&&!document.hidden){const x=bLeft();if(x===0){bEnd(true);return}const t=$('bkLeft');if(!t)return;if(x!=null){t.textContent=bHMS(x);const r=$('bkRing'),T=(BRICK.until-BRICK.since)/1000;if(r)r.setAttribute('stroke-dasharray',Math.max(0,Math.min(100,(1-x/T)*100)).toFixed(2)+' 100')}else t.textContent=bHM(bMin(BRICK.since,Date.now()))}},1000)}
function bindBrick(){
  if($('bkOn'))$('bkOn').onclick=()=>{bStart(BRICK.pre==null?25:BRICK.pre)};
  if($('bkPre'))$('bkPre').onclick=e=>{const b=e.target.closest('button');if(!b)return;let m=b.dataset.m;
    if(m==='custom'){m=parseInt(prompt('Brick for how many minutes?','60')||'');if(!(m>0))return}
    BRICK.pre=+m;bSave();renderBrick()};
  if($('bkOff'))$('bkOff').onclick=()=>{const l=bLeft();
    if(BRICK.strict&&l){openSheet('end early?',`<div class="gc-det"><p>${Math.ceil(l/60)} minutes left. Ending now goes in the log as a broken session.</p><div class="bigbtns"><button class="btn" type="button" id="bkYes">End it anyway</button><button class="btn p" type="button" id="bkNo">Keep going</button></div></div>`);
      $('sheetBody').onclick=e=>{if(e.target.id==='bkYes'){closeSheet();bEnd(false)}if(e.target.id==='bkNo')closeSheet()};return}
    bEnd(false)};
  if($('bkAuto'))$('bkAuto').onchange=e=>{BRICK.auto=e.target.checked;bSave()};
  if($('bkStrict'))$('bkStrict').onchange=e=>{BRICK.strict=e.target.checked;bSave()};
  const nm=(id,k)=>{const n=$(id);if(n)n.oninput=e=>{BRICK[k]=e.target.value.trim();clearTimeout(bindBrick['t'+k]);bindBrick['t'+k]=setTimeout(bSave,700)}};
  nm('bkSOn','sOn');nm('bkSOff','sOff');
  if($('bkTestOn'))$('bkTestOn').onclick=()=>{const e=new Date(Date.now()+12e4);bRun($('bkSOn').value.trim(),ymd(e)+' '+pad(e.getHours())+':'+pad(e.getMinutes()))};
  if($('bkTestOff'))$('bkTestOff').onclick=()=>bRun($('bkSOff').value.trim());
  document.querySelectorAll('#t-brick [data-age]').forEach(b=>b.onclick=()=>{BRICK.ageTmp=Math.max(10,Math.min(90,(BRICK.ageTmp||21)+ +b.dataset.age));renderBrick()});
  if($('bkAgeOk'))$('bkAgeOk').onclick=()=>{BRICK.age=BRICK.ageTmp||21;delete BRICK.ageTmp;bSave();renderBrick()};
  document.querySelectorAll('#t-brick [data-gh]').forEach(b=>b.onclick=()=>{BRICK.goalH=Math.max(0,Math.min(12,(BRICK.goalH==null?2:+BRICK.goalH)+ +b.dataset.gh));bSave();renderBrick()});}
/* called by the focus timer */
function brickAuto(on,mins){if(!BRICK.auto||!BRICK.sOn)return;
  if(on){if(!BRICK.on&&mins>0)bStart(mins)}else if(BRICK.on)bEnd(true)}

/* ================= ALTER EGOS =================
   A list of selves. Each one opens into its own themed page: a written manifesto plus a
   masonry board of images and looping clips (muted on the board, sound in the viewer).
   Media lives in the private `vault` bucket (UID/alter/<ego>/…), never in the public repo. */
const ATHEME={
  operator:{n:'operator',ac:'#39ff9a',bg:'#04120b',fg:'#dcffe9',f:'var(--mono)',fx:'scan'},
  predator:{n:'predator',ac:'#ff2a3d',bg:'#140305',fg:'#ffe3e6',f:'var(--mono)',fx:'grain'},
  monk:{n:'monk',ac:'#d8c9a8',bg:'#100f0c',fg:'#efe9dc',f:'Georgia,"Times New Roman",serif',fx:'paper'},
  sovereign:{n:'sovereign',ac:'#ffc83d',bg:'#120d02',fg:'#fff3d6',f:'Georgia,"Times New Roman",serif',fx:'glow'},
  machine:{n:'machine',ac:'#9fb4c7',bg:'#0a0d10',fg:'#e6edf3',f:'var(--mono)',fx:'steel'},
  ghost:{n:'ghost',ac:'#eaeaea',bg:'#070707',fg:'#f4f4f4',f:'system-ui,"Segoe UI",sans-serif',fx:'none'},
  oracle:{n:'oracle',ac:'#a46bff',bg:'#0c0616',fg:'#ece0ff',f:'Georgia,"Times New Roman",serif',fx:'glow'},
  athlete:{n:'athlete',ac:'#2fa8ff',bg:'#030c16',fg:'#dcefff',f:'system-ui,"Segoe UI",sans-serif',fx:'grain'},
};
let ALTER={egos:[]},alterLoaded=false,AEGO=null,AE=null,aIO=null,aLO=null,aBusy=0;
/* the section keeps its router classes — wiping className used to unhide alter over every other view */
const aBase=el=>'view'+(el.classList.contains('on')?' on':'');
/* inside an ego the app's chrome gets out of the way: no tabs, no bottom nav */
function aLeave(){document.body.classList.remove('asolo')}
const aPath=(e,f)=>`${UID}/alter/${e}/${f}`;
async function loadAlter(){if(alterLoaded){renderAlter();return}
  try{const d=await load('alter/list');if(d&&Array.isArray(d.egos))ALTER=d}catch(e){}
  alterLoaded=true;renderAlter()}
const aSave=()=>save('alter/list',ALTER,true);
const aSaveEgo=()=>AE&&save('alter/e-'+AE.id,{notes:AE.notes||'',items:AE.items||[]},true);
/* signed urls for the private bucket, cached until they expire */
const AURL=new Map(Object.entries(LS.get('aurl')||{}).filter(([k,v])=>v&&v.exp>Date.now()+864e5));
/* reusing the same URL across launches lets the browser and the service worker serve the file
   from this device instead of downloading it again */
let aurlT=null;const aurlSave=()=>{clearTimeout(aurlT);aurlT=setTimeout(()=>LS.set('aurl',Object.fromEntries(AURL)),400)};
/* drop a file's on-device copy (after it was replaced or deleted) */
async function mediaForget(paths){paths=[].concat(paths).filter(Boolean);paths.forEach(p=>AURL.delete(p));aurlSave();
  try{if(!window.caches)return;const c=await caches.open('ds-media');for(const r of await c.keys()){const pn=decodeURIComponent(new URL(r.url).pathname);
    if(paths.some(p=>pn.endsWith('/vault/'+p)))await c.delete(r)}}catch(e){}}
async function aSign(paths){const need=paths.filter(p=>{const c=AURL.get(p);return !c||c.exp<Date.now()+6e4});
  for(let i=0;i<need.length;i+=80){const batch=need.slice(i,i+80);
    try{const {data}=await SB.storage.from('vault').createSignedUrls(batch,604800);
      (data||[]).forEach(r=>{if(r&&r.signedUrl&&!r.error)AURL.set(r.path,{u:r.signedUrl,exp:Date.now()+6048e5})});aurlSave()}catch(e){}}
  return paths.map(p=>(AURL.get(p)||{}).u||'')}
/* ---------- main list ---------- */
let CSI=0;
function renderAlter(){const el=$('v-alter');if(!el)return;if(!alterLoaded){loadAlter();return}
  if(AEGO){aRenderEgo();return}
  aLeave();el.className=aBase(el);el.removeAttribute('style');
  const seen=el.dataset.intro==='1';el.dataset.intro='1';
  el.innerHTML=`${FX?'<div class="csintro" id="csIntro"><span>Select<br>Your alter ego</span></div>':''}<div class="csel">
    <div class="cstop"><span class="csn" id="csN"></span></div>
    <div class="csstage">
      <button type="button" class="csarr" id="csL" aria-label="previous">◀</button>
      <div class="cswin" id="csWin"></div>
      <button type="button" class="csarr" id="csR" aria-label="next">▶</button>
    </div>
    <div class="csname" id="csName"></div>
    <button type="button" class="csgo" id="csGo">Select</button>
    <div class="csdots" id="csDots"></div>
  </div>`;
  CSI=0;csDraw(0);
  const intro=$('csIntro');if(intro)setTimeout(()=>{intro.classList.add('out');setTimeout(()=>intro.remove(),620)},1250);
  $('csL').onclick=()=>csStep(-1);$('csR').onclick=()=>csStep(1);
  $('csGo').onclick=csPick;
  /* tapping the portrait toggles its sound; only the button enters the page */
  $('csWin').onclick=()=>{CSND=!CSND;csSnd()};
  let x0=null;
  $('csWin').addEventListener('pointerdown',e=>{x0=e.clientX});
  $('csWin').addEventListener('pointerup',e=>{if(x0==null)return;const d=e.clientX-x0;x0=null;if(Math.abs(d)>40){csStep(d<0?1:-1);e.stopPropagation()}});
  el.onkeydown=null;
  document.onkeydown=e=>{if(AEGO||$('v-alter').hidden||!$('csWin'))return;
    if(e.key==='ArrowLeft')csStep(-1);else if(e.key==='ArrowRight')csStep(1);else if(e.key==='Enter')csPick()}}
let CSND=false;
function csSnd(){const w=$('csWin');if(!w)return;w.classList.toggle('snd',CSND);const v=w.querySelector('video');if(!v)return;
  v.muted=!CSND;v.volume=1;if(CSND){const p=v.play();if(p&&p.catch)p.catch(()=>{v.muted=true})}}
/* leaving the section: nothing of it keeps sounding */
function aQuiet(){document.querySelectorAll('#v-alter video,#g-motivation video').forEach(v=>{try{v.muted=true;if(v.classList.contains('csvid'))v.pause()}catch(e){}});
  document.querySelectorAll('.apin.snd').forEach(f=>f.classList.remove('snd'));if(typeof aPeekClose==='function'&&APK)aPeekClose()}
const csList=()=>ALTER.egos.concat([{id:'__new',name:'new alter ego',tag:'name it, theme it, build the board',theme:'ghost'}]);
function csStep(d){const L=csList();CSI=((CSI+d)%L.length+L.length)%L.length;csDraw(d)}
async function csDraw(d){const win=$('csWin');if(!win)return;const L=csList();const e=L[CSI];
  const t=ATHEME[e.theme]||ATHEME.ghost;const isNew=e.id==='__new';
  win.style.setProperty('--ac',t.ac);win.style.setProperty('--abg',t.bg);
  win.innerHTML=`<div class="csfig${isNew?' isnew':''}">${isNew?'<span class="csplus">＋</span>'
    :`${e.cover?`<img alt="" class="cspic">`:''}${e.v?'<video class="csvid" muted loop playsinline preload="none"></video>':''}`}
    <i class="cscrn tl"></i><i class="cscrn tr"></i><i class="cscrn bl"></i><i class="cscrn br"></i></div>`;
  win.classList.remove('inL','inR');void win.offsetWidth;win.classList.add(d<0?'inL':'inR');
  $('csName').innerHTML=`<b>${esc(e.name||'untitled')}</b><i>${esc(e.tag||t.n)}</i>`;
  $('csName').style.setProperty('--ac',t.ac);
  $('csN').textContent=String(CSI+1).padStart(2,'0')+' / '+String(L.length).padStart(2,'0');
  $('csDots').innerHTML=L.map((_,i)=>`<span class="${i===CSI?'on':''}"></span>`).join('');
  $('csGo').textContent=isNew?'create':'select';$('csGo').style.setProperty('--ac',t.ac);
  if(isNew)return;
  const want=CSI;
  if(e.cover){const [u]=await aSign([e.cover]);const p=win.querySelector('.cspic');if(p&&u&&CSI===want)p.src=u}
  if(e.v){const [u]=await aSign([e.v]);const v=win.querySelector('.csvid');
    if(v&&u&&CSI===want){v.src=u;v.muted=!CSND;win.classList.toggle('snd',CSND);const pr=v.play();if(pr&&pr.catch)pr.catch(()=>{v.muted=true;v.play().catch(()=>{})})}}}
function csPick(){const L=csList();const e=L[CSI];if(!e)return;
  if(e.id==='__new')return aEdit(null);
  const win=$('csWin');win.classList.add('picking');
  const t=ATHEME[e.theme]||ATHEME.ghost;
  const fl=document.createElement('div');fl.className='chflash';fl.style.setProperty('--ac',t.ac);
  if(FX)document.body.appendChild(fl);
  setTimeout(()=>{fl.remove();document.onkeydown=null;aOpen(e.id)},FX?560:0)}
/* the motivation board is not a self — it lives in the gym */
let MOTIV=null;
async function renderMotivation(){const el=$('g-motivation');if(!el)return;
  if(!MOTIV){el.innerHTML='<div class="aempty">loading…</div>';
    try{MOTIV=await load('alter/e-'+LX('gb','m'))||{items:[]}}catch(e){MOTIV={items:[]}}}
  const items=MOTIV.items||[];
  /* dealt fresh every visit — the wall never reads the same way twice */
  const shown=items.slice();
  for(let i=shown.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[shown[i],shown[j]]=[shown[j],shown[i]]}
  el.innerHTML='<div class="mtop"><button type="button" class="aadd" id="mAdd" aria-label="add pics or videos">+</button></div>'+(shown.length
    ? `<div class="mwall aemason">${shown.map((it,i)=>aTile(it,i,LX('gb','m'))).join('')}</div>`
    : '<div class="aempty">Nothing here yet.</div>');
  $('mAdd').onclick=e=>{e.stopPropagation();aAddMedia(LX('gb','m'),$('mAdd'),its=>{MOTIV.items=(MOTIV.items||[]).concat(its);save('alter/e-'+LX('gb','m'),MOTIV,true);renderMotivation()})};
  aMason(el);requestAnimationFrame(()=>aMason(el));aHydrate(el);
  let lt=0,lp=null;
  el.onclick=e=>{const p=e.target.closest('.apin');if(!p)return;const n=Date.now();
    if(lp===p&&n-lt<340){lt=0;lp=null;aPeekOpen(p,true);return}
    lt=n;lp=p;const v=p.querySelector('video');if(v)aSound(v)}}
function aEdit(ego){const e=ego||{id:rid(),name:'',tag:'',theme:'ghost',notes:''};
  openSheet(ego?'edit alter ego':'new alter ego',`<div class="gc-form">
    <input id="aeN" class="gc-in big" placeholder="Name" value="${esc(e.name)}" autocomplete="off">
    <input id="aeT" class="gc-in" placeholder="One line — who is he?" value="${esc(e.tag)}" autocomplete="off">
    <div class="athemes" id="aeTh">${Object.entries(ATHEME).map(([k,t])=>`<button type="button" data-th="${k}" class="${k===e.theme?'on':''}" style="--ac:${t.ac};--abg:${t.bg}"><i></i>${t.n}</button>`).join('')}</div>
    <div class="bigbtns"><button class="btn p" type="button" id="aeOk">${ego?'Save':'Create'}</button>${ego?'<button class="btn" type="button" id="aeDel">Delete</button>':''}</div></div>`);
  let th=e.theme;
  $('sheetBody').onclick=ev=>{const t=ev.target.closest('[data-th]');
    if(t){th=t.dataset.th;$('aeTh').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===t));return}
    if(ev.target.id==='aeOk'){e.name=$('aeN').value.trim()||'untitled';e.tag=$('aeT').value.trim();e.theme=th;
      if(!ego)ALTER.egos.push(e);aSave();closeSheet();if(AEGO)aRenderEgo();else renderAlter()}
    if(ev.target.id==='aeDel')aDeleteEgo(e)};
  setTimeout(()=>$('aeN')&&$('aeN').focus(),60)}
function aDeleteEgo(e){openSheet('delete '+e.name+'?',`<div class="gc-det"><p>This removes the alter ego, its writing and every pinned image and clip. It can't be undone.</p>
  <div class="bigbtns"><button class="btn" type="button" id="adY">Delete everything</button><button class="btn p" type="button" id="adN">Keep it</button></div></div>`);
  $('sheetBody').onclick=async ev=>{if(ev.target.id==='adN')return closeSheet();if(ev.target.id!=='adY')return;
    closeSheet();try{const d=await load('alter/e-'+e.id);const paths=[];(d&&d.items||[]).forEach(it=>{paths.push(aPath(e.id,it.f));if(it.p)paths.push(aPath(e.id,it.p))});
      if(paths.length){await SB.storage.from('vault').remove(paths);mediaForget(paths)}await KV.del('alter/e-'+e.id)}catch(x){}
    ALTER.egos=ALTER.egos.filter(x=>x.id!==e.id);aSave();AEGO=null;AE=null;renderAlter()}}
/* ---------- one alter ego ---------- */
async function aOpen(id){const meta=ALTER.egos.find(e=>e.id===id);if(!meta)return;AEGO=id;AE={...meta,notes:'',items:[]};
  aRenderEgo();try{const d=await load('alter/e-'+id);if(d){AE.notes=d.notes||'';AE.items=d.items||[]}}catch(e){}
  aRenderEgo();scrollTo(0,0)}
function aBack(){aLeave();AEGO=null;AE=null;if(aIO){aIO.disconnect();aIO=null}renderAlter();scrollTo(0,0)}
const APH={predator:"Rules, standards, the version of you that doesn't negotiate. Write it like orders.",
  oracle:'What is already written. Who you become, and what it costs. Write it as prophecy.',
  operator:'Protocols. What gets switched off, what gets done, in what order. Write it like a spec.',
  sovereign:'The standard you hold. Presence, grooming, carriage, the details nobody else bothers with.',
  ghost:'Who is he? How does he move, speak, train, decide? Write it as if it is already true.',
  monk:'The discipline. What you give up, and what that buys you.',
  machine:'Inputs, outputs, tolerances. No feelings in this one.',
  athlete:'The work, the numbers, the standard on the worst day.'};
/* one media element, with its own aspect in --asp so each skin can honour or override it */
function aMedia(it,cls,ego){const p=esc(aPath(ego||AE.id,it.f));
  return it.k==='v'
    ? `<video class="${cls||''}" muted loop playsinline preload="none" data-src="${p}" ${it.p?`data-poster="${esc(aPath(ego||AE.id,it.p))}"`:''}></video>`
    : `<img class="${cls||''}" alt="" loading="lazy" data-src="${p}">`}
function aTile(it,i,ego){const w=it.w||3,h=it.h||4;
  return `<figure class="apin${it.k==='v'?' isv':''}" data-i="${i}" data-aid="${esc(it.id||it.f||i)}" data-aw="${w}" data-ah="${h}" style="--asp:${w}/${h}">`
  +`<span class="apix">${String(i+1).padStart(2,'0')}</span>${aMedia(it,'',ego)}</figure>`}
/* real masonry: every tile keeps its own shape, and some are given extra width
   so the board has a rhythm instead of one uniform column width throughout */
const AU=2;
/* a stable 0..1 drawn from the tile's own id — the layout stays put between renders */
function aRnd(s){let h=2166136261;for(let i=0;i<String(s).length;i++){h^=String(s).charCodeAt(i);h=Math.imul(h,16777619)}return ((h>>>0)%10000)/10000}
/* how many columns a tile earns: wide pictures take the extra width, tall ones
   rarely need it since their height already gives them the room */
function aWide(f,cols){
  if(cols<3)return 1;
  const r=(+f.dataset.aw||3)/(+f.dataset.ah||4), n=aRnd(f.dataset.aid||f.dataset.i||'');
  const p=(r>1.25?.62:r>.85?.4:.17)*(cols>3?1:.7);
  let w=n<p?2:1;
  if(w===2&&cols>=5&&r>1.5&&n<p*.3)w=3;
  return Math.min(w,cols)}
function aMason(root){const el=root||$('v-alter');if(!el)return;
  el.querySelectorAll('.aemason').forEach(b=>{
    const cs=getComputedStyle(b);const gap=parseFloat(cs.rowGap)||0;
    const cols=(cs.gridTemplateColumns||'').split(' ').filter(x=>x&&x!=='none').length||1;
    const tiles=[...b.querySelectorAll('.apin')];if(!tiles.length)return;
    const cw=(b.getBoundingClientRect().width-gap*(cols-1))/cols;if(cw<=0)return;
    const U=AU+gap;
    const h=new Array(cols).fill(0);
    /* where a run of n columns sits lowest, and how much dead space that leaves */
    const fit=n=>{let c=0,top=Infinity,low=0;
      for(let k=0;k+n<=cols;k++){let m=0;for(let j=k;j<k+n;j++)if(h[j]>m)m=h[j];
        if(m<top-0.5){top=m;c=k}}
      if(!isFinite(top))top=0;
      low=h[c];for(let j=c;j<c+n;j++)if(h[j]<low)low=h[j];
      return {c,top,waste:top-low}};
    const last=new Array(cols).fill(null),place=new Map();
    tiles.forEach(f=>{
      let cspan=aWide(f,cols),a=fit(cspan);
      /* a wide tile hanging off a taller neighbour would leave a hole under it: narrow it
         until it sits flush, so every tile butts straight onto the ones above it */
      while(cspan>1&&a.waste>gap+1){cspan--;a=fit(cspan)}
      const px=cw*cspan+gap*(cspan-1);
      const rspan=Math.max(1,Math.round((px*(+f.dataset.ah||4)/(+f.dataset.aw||3)+gap)/U));
      place.set(f,{c:a.c,span:cspan,row:Math.round(a.top/U)+1,rspan});
      for(let j=a.c;j<a.c+cspan;j++){h[j]=a.top+rspan*U;last[j]=f}});
    /* columns finish at different depths, which reads as black gaps along the bottom —
       stretch whichever tile ends each short column down to meet the deepest one */
    let deep=0;for(let j=0;j<cols;j++)if(h[j]>deep)deep=h[j];
    new Set(last.filter(Boolean)).forEach(f=>{
      const p=place.get(f);let bottom=0;
      for(let j=p.c;j<p.c+p.span;j++)if(h[j]>bottom)bottom=h[j];
      const grow=Math.round((deep-bottom)/U);
      if(grow>0&&grow<p.rspan*1.5)p.rspan+=grow});
    tiles.forEach(f=>{const p=place.get(f);
      f.style.gridColumn=(cols>1?(p.c+1):1)+' / span '+p.span;
      f.style.gridRowStart=p.row;
      f.style.gridRowEnd='span '+p.rspan});
  })}
let aMT=null;
addEventListener('resize',()=>{clearTimeout(aMT);aMT=setTimeout(()=>aMason(),120)});
/* each skin lays its media out differently — collage, scroll, index, spread, wall */
function aBoardHTML(sk,items){
  if(!items.length)return '<div class="aempty">Nothing pinned here yet.</div>';
  if(sk==='operator')return `<div class="aegrid aemason">${items.map((it,i)=>aTile(it,i)).join('')}</div>`;
  if(sk==='oracle')return `<div class="aescroll">${items.map((it,i)=>
      `<section class="aeverse">${aTile(it,i)}<i class="aenum">${aRom(i+1)}</i></section>`).join('')}</div>`;
  if(sk==='sovereign')return `<div class="aespread aemason">${items.map((it,i)=>aTile(it,i)).join('')}</div>`;
  if(sk==='predator')return `<div class="aecollage aemason">${items.map((it,i)=>aTile(it,i)).join('')}</div>`;
  if(sk==='ghost')return `<div class="aewall aemason">${items.map((it,i)=>aTile(it,i)).join('')}</div>`;
  return `<div class="aboard aemason">${items.map((it,i)=>aTile(it,i)).join('')}</div>`}
const aRom=n=>['','I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][n]||String(n);
function aRenderEgo(){const el=$('v-alter');if(!el||!AE)return;const t=ATHEME[AE.theme]||ATHEME.ghost;const sk=AE.theme||'ghost';
  if(typeof cur==='undefined'||cur==='alter')document.body.classList.add('asolo');else aLeave();
  el.className=aBase(el)+' aego fx-'+t.fx+' sk-'+sk;el.setAttribute('style',`--ac:${t.ac};--abg:${t.bg};--afg:${t.fg};--af:${t.f}`);
  const items=AE.items||[];const nm=esc(AE.name||'');
  const mini=`<span class="aemini"><b>${nm}</b><i>${esc(AE.tag||t.n)}</i></span>`;
  const head=`<div class="aehead"><div class="aenav"><button type="button" class="aeback" id="aeBack">‹</button>${mini}<span class="aeacts"><button type="button" class="aeback" id="aeAdd" aria-label="add pics or videos">+</button><button type="button" class="aeback" id="aeEdit">Edit</button></span></div></div>`;
  el.classList.add('aenter');setTimeout(()=>el.classList.remove('aenter'),620);el.innerHTML=head+
    `<div class="aenotes"><i class="aenb"></i><textarea id="aeNotes" placeholder="${esc(APH[sk]||APH.ghost)}">${esc(AE.notes||'')}</textarea><span class="aesave" id="aeSaved"></span></div>
     <div class="aboardwrap" id="aBoard">${aBoardHTML(sk,items)}</div>`;
  aMason();requestAnimationFrame(()=>aMason());aHydrate();aBindEgo()}
async function aHydrate(root){const el=root||$('v-alter');if(!el)return;
  const nodes=[...el.querySelectorAll('[data-src]')];if(!nodes.length)return;
  const urls=await aSign(nodes.map(n=>n.dataset.src));
  nodes.forEach((n,i)=>{if(!urls[i])return;
    if(n.tagName==='VIDEO'){n.dataset.url=urls[i];if(n.dataset.poster)aSign([n.dataset.poster]).then(([p])=>{if(p)n.poster=p})}
    else n.src=urls[i]});
  if(aIO)aIO.disconnect();if(aLO)aLO.disconnect();
  /* load well before a clip is needed, so nothing is still buffering when it scrolls in */
  aLO=new IntersectionObserver(es=>es.forEach(e=>{const v=e.target;
    if(e.isIntersecting&&!v.src&&v.dataset.url)v.src=v.dataset.url}),{rootMargin:'600px 0px'});
  /* then play on any sliver of visibility — a tall last tile never reached a .35 threshold */
  aIO=new IntersectionObserver(es=>es.forEach(e=>{const v=e.target;
    if(e.isIntersecting){if(!v.src&&v.dataset.url)v.src=v.dataset.url;aPlay(v)}
    else{v.pause();if(!v.muted)aMute(v)}}),{threshold:.01,rootMargin:'0px'});
  el.querySelectorAll('video').forEach(v=>{aLO.observe(v);aIO.observe(v);
    v.addEventListener('loadeddata',()=>{if(v.dataset.want==='1')aPlay(v)},{once:true})});
}
function aPlay(v){v.dataset.want='1';const p=v.play();if(p&&p.catch)p.catch(()=>{})}
/* one clip at a time has sound; tapping a clip toggles its own audio */
function aMute(v){v.muted=true;const f=v.closest('.apin');if(f)f.classList.remove('snd')}
function aSound(v){document.querySelectorAll('video').forEach(o=>{if(o!==v&&!o.muted)aMute(o)});
  if(v.muted){v.muted=false;v.volume=1;const f=v.closest('.apin');if(f)f.classList.add('snd');
    const p=v.play();if(p&&p.catch)p.catch(()=>{v.muted=true;if(f)f.classList.remove('snd')})}
  else aMute(v)}
function aBindEgo(){
  $('aeBack').onclick=aBack;
  $('aeAdd').onclick=()=>{const ego=AE.id;aAddMedia(ego,$('aeAdd'),its=>{if(!AE||AE.id!==ego)return;AE.items=(AE.items||[]).concat(its);aSaveEgo();aRenderEgo()})};$('aeEdit').onclick=()=>aEdit(ALTER.egos.find(e=>e.id===AEGO));
  const ta=$('aeNotes');let tmr=null;
  ta.oninput=()=>{AE.notes=ta.value;$('aeSaved').textContent='…';clearTimeout(tmr);tmr=setTimeout(()=>{aSaveEgo();$('aeSaved').textContent='saved';setTimeout(()=>{if($('aeSaved'))$('aeSaved').textContent=''},1500)},800)};
  $('aBoard').onclick=e=>{const p=e.target.closest('.apin');if(!p)return;const v=p.querySelector('video');if(v)aSound(v)}}

/* ---------- add pics / videos to a board ----------
   one tiny "+": pick any number of files; each gets its real size (the masonry needs it),
   big photos are shrunk, videos get a poster frame, and all of it goes to the private vault. */
const aUid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const aBlob=(c,q)=>new Promise(r=>c.toBlob(r,'image/jpeg',q));
function aFit(w,h,m){const k=Math.min(1,m/Math.max(w,h));return [Math.round(w*k)||1,Math.round(h*k)||1]}
async function aPrepImg(f){const u=URL.createObjectURL(f);
  try{const im=new Image();im.src=u;await im.decode();const w=im.naturalWidth,h=im.naturalHeight;
    if(Math.max(w,h)<=2048&&/jpe?g|png|webp|gif/.test(f.type))return {blob:f,ext:(f.type.split('/')[1]||'jpg').replace('jpeg','jpg'),ct:f.type,w,h};
    const [W,H]=aFit(w,h,2048);const c=document.createElement('canvas');c.width=W;c.height=H;c.getContext('2d').drawImage(im,0,0,W,H);
    return {blob:await aBlob(c,.88),ext:'jpg',ct:'image/jpeg',w:W,h:H}}
  finally{URL.revokeObjectURL(u)}}
async function aPrepVid(f){const u=URL.createObjectURL(f);const v=document.createElement('video');
  v.muted=true;v.playsInline=true;v.setAttribute('playsinline','');v.preload='auto';v.src=u;
  const once=(ev,ms)=>new Promise(r=>{const t=setTimeout(r,ms);v.addEventListener(ev,()=>{clearTimeout(t);r()},{once:true})});
  try{await once('loadeddata',15000);const w=v.videoWidth||9,h=v.videoHeight||16;let poster=null;
    try{v.currentTime=Math.min(.5,(v.duration||1)/2);await once('seeked',5000);
      const [W,H]=aFit(w,h,720);const c=document.createElement('canvas');c.width=W;c.height=H;c.getContext('2d').drawImage(v,0,0,W,H);poster=await aBlob(c,.8)}catch(e){}
    const ext=(f.name.split('.').pop()||'mp4').toLowerCase().replace(/[^a-z0-9]/g,'')||'mp4';
    return {blob:f,ext,ct:f.type||'video/mp4',w,h,poster}}
  finally{v.removeAttribute('src');v.load();URL.revokeObjectURL(u)}}
function aAddMedia(ego,btn,done){
  const inp=document.createElement('input');inp.type='file';inp.multiple=true;inp.accept='image/*,video/*';
  inp.style.cssText='position:fixed;left:-9999px;top:0';document.body.appendChild(inp);
  inp.onchange=async()=>{const files=[...inp.files];inp.remove();if(!files.length)return;
    const lbl=btn.textContent;btn.disabled=true;const out=[];let bad=0;
    for(let i=0;i<files.length;i++){const f=files[i];btn.textContent=(i+1)+'/'+files.length;
      try{const isV=/^video\//.test(f.type)||/\.(mp4|mov|m4v|webm)$/i.test(f.name);
        const m=isV?await aPrepVid(f):await aPrepImg(f);const id=aUid();const it={id,k:isV?'v':'i',f:id+'.'+m.ext,w:m.w,h:m.h};
        const up=(n,b,ct)=>SB.storage.from('vault').upload(aPath(ego,n),b,{contentType:ct,upsert:true}).then(r=>{if(r.error)throw r.error});
        await up(it.f,m.blob,m.ct);
        if(m.poster){it.p=id+'_p.jpg';try{await up(it.p,m.poster,'image/jpeg')}catch(e){delete it.p}}
        out.push(it)}catch(e){bad++}}
    btn.textContent=lbl;btn.disabled=false;
    if(out.length)done(out);
    if(bad){const b=document.getElementById(btn.id);if(b){b.textContent=bad+' failed';setTimeout(()=>{const x=document.getElementById(btn.id);if(x)x.textContent=lbl},2500)}}};
  inp.click()}

/* ---------- vault relay ----------
   Loaded in an iframe with ?relay=1, this lets a page that CAN read a CDN
   (allowlisted in the private word list) hand its bytes to the app, which is the thing holding the
   Supabase session. Inert unless the flag is present. */
if(new URLSearchParams(location.search).get('relay')==='1'){
  const OK=new RegExp(LX('ro','^$'));
  addEventListener('message',async e=>{
    const d=e.data;if(!d||d.k!=='vault-put')return;
    const reply=o=>{try{e.source.postMessage(Object.assign({k:'vault-done',id:d.id},o),'*')}catch(_){}};
    if(!OK.test(e.origin))return reply({ok:false,msg:'origin'});
    if(typeof d.path!=='string'||d.path.indexOf(UID+'/')!==0)return reply({ok:false,msg:'path'});
    try{const {error}=await SB.storage.from('vault').upload(d.path,new Blob([d.buf],{type:d.ct||'application/octet-stream'}),{contentType:d.ct||'application/octet-stream',upsert:true});
      reply({ok:!error,msg:error?error.message:''})}
    catch(err){reply({ok:false,msg:String(err).slice(0,120)})}});
  addEventListener('load',()=>{try{parent!==window&&parent.postMessage({k:'vault-ready'},'*')}catch(_){}});
  try{parent!==window&&parent.postMessage({k:'vault-ready'},'*')}catch(_){}
}

/* ---------- hold a pin to see it full screen ----------
   a long press lifts the media out of the board at full size and plays it with sound;
   letting go — or any tap, or escape — puts it back. taps alone still toggle the sound. */
let APK=null,aPkT=null,aPkFrom=null,aPkSwallow=false;
function aPeekOpen(fig,tap){
  if(APK)return;
  const src=fig.querySelector('img,video');if(!src)return;
  const box=document.createElement('div');box.className='apeek';
  let node;
  if(src.tagName==='VIDEO'){
    node=document.createElement('video');
    node.src=src.currentSrc||src.src||src.dataset.url||'';
    node.playsInline=true;node.setAttribute('playsinline','');node.loop=true;node.controls=false;
    node.muted=false;node.volume=1;
    if(src.poster)node.poster=src.poster;
    try{node.currentTime=src.currentTime||0}catch(e){}
    const p=node.play();if(p&&p.catch)p.catch(()=>{node.muted=true;node.play().catch(()=>{})});
    try{src.pause()}catch(e){}
  }else{
    node=document.createElement('img');node.src=src.currentSrc||src.src;node.alt=''}
  box.appendChild(node);document.body.appendChild(box);
  APK={box,node,t0:tap?Date.now():0};aPkFrom=fig;
  /* every way a press can end, on the overlay and on the window alike: a pointerup that
     never arrives must not be able to strand the screen */
  ['pointerup','pointercancel','pointerdown','touchend','mouseup','click'].forEach(t=>{
    box.addEventListener(t,aPeekClose,true);
    addEventListener(t,aPeekClose,true)});
  addEventListener('keydown',aPeekClose,true);
  addEventListener('blur',aPeekClose,true);
  APK.guard=setTimeout(aPeekClose,60000);
}
function aPeekClose(){
  if(!APK)return;
  /* opened by a double tap: the tail of that same tap must not close it again */
  if(APK.t0&&Date.now()-APK.t0<380)return;
  const {box,node,guard}=APK;APK=null;clearTimeout(guard);
  ['pointerup','pointercancel','pointerdown','touchend','mouseup','click'].forEach(t=>removeEventListener(t,aPeekClose,true));
  removeEventListener('keydown',aPeekClose,true);removeEventListener('blur',aPeekClose,true);
  try{if(node.tagName==='VIDEO'){node.pause();node.src=''}}catch(e){}
  box.remove();
  if(aPkFrom){const v=aPkFrom.querySelector('video');if(v&&v.dataset.url)v.play().catch(()=>{});aPkFrom=null}
  aPkSwallow=true;setTimeout(()=>{aPkSwallow=false},350);
}
addEventListener('pointerdown',e=>{
  if(APK)return;
  const fig=e.target.closest&&e.target.closest('.apin');if(!fig)return;
  if(fig.closest('.mwall'))return; /* the motivation wall uses a double tap instead */
  const x0=e.clientX,y0=e.clientY;
  clearTimeout(aPkT);
  const off=()=>{removeEventListener('pointermove',move);removeEventListener('pointerup',up);removeEventListener('pointercancel',up)};
  const move=ev=>{if(Math.abs(ev.clientX-x0)>12||Math.abs(ev.clientY-y0)>12){clearTimeout(aPkT);aPkT=null;off()}};
  const up=()=>{clearTimeout(aPkT);aPkT=null;off()};
  aPkT=setTimeout(()=>{aPkT=null;off();aPeekOpen(fig)},420);
  addEventListener('pointermove',move);addEventListener('pointerup',up);addEventListener('pointercancel',up);
},true);
/* the press that opened the peek must not also land as a tap on the pin */
addEventListener('click',e=>{if(aPkSwallow){e.stopPropagation();e.preventDefault()}},true);
addEventListener('contextmenu',e=>{if(e.target.closest&&e.target.closest('.apin'))e.preventDefault()});

/* ================= ASCEND =================
   A secret: the first time a lift crosses a round weight you've never passed before,
   the clip plays full screen. Nothing is shown anywhere until it fires. */
const ASC_PATH=()=>`${UID}/system/ascend.mp4`;
let ascEl=null,ascPrimed=false;
const ascOn=()=>LS.get('ascendOff')!==true;
const ascStep=best=>Best<60?5:10;
/* pull the clip in quietly once a session is live, so it plays the instant it's earned */
async function ascPrime(){if(ascPrimed||!ascOn()||!SB||!UID)return;ascPrimed=true;
  try{const [u]=await aSign([ASC_PATH()]);if(!u)return;
    ascEl=document.createElement('video');ascEl.src=u;ascEl.preload='auto';ascEl.playsInline=true;ascEl.style.display='none';
    document.body.appendChild(ascEl)}catch(e){}}
/* prevKg = your best on this lift before today. Only a genuine new round number counts. */
function ascCheck(ex,s,prevKg){
  if(!ascOn()||!s.done||s.t==='w'||ACTIVE&&ACTIVE.editing)return;
  const T=XTYPES[ex.ty]||XTYPES.wr;if(!T.f.includes('kg'))return;
  const w=+s.kg||0,r=+s.r||0;if(w<=0||r<=0)return;
  prevKg=+prevKg||0;if(prevKg<=0||w<=prevKg)return;            /* needs a mark to beat */
  const step=ascStep(prevKg);
  if(Math.floor(w/step)<=Math.floor(prevKg/step))return;        /* no round number crossed */
  const hit=Math.floor(w/step)*step;if(hit<step)return;
  ascFire(ex,kgs(hit),'kg',ex.n)}
/* one per lift per session, whichever lands first: a round weight or a new rank */
function ascFire(ex,big,unit,sub){
  if(!ascOn()||!ACTIVE||ACTIVE.editing)return false;
  ACTIVE._asc=ACTIVE._asc||{};if(ACTIVE._asc[ex.id])return false;
  ACTIVE._asc[ex.id]=1;setTimeout(()=>ascPlay(big,unit,sub),420);return true}
/* a lift moving up a division */
function ascRank(ex,from,to){const r=rlOf(to);return ascFire(ex,r.name,'',ex.n+' · rank up')}
async function ascPlay(big,unit,sub){
  let url=ascEl&&ascEl.src;if(!url){try{[url]=await aSign([ASC_PATH()])}catch(e){}}
  if(!url)return;
  const ov=document.createElement('div');ov.className='ascov';
  const txt=!/^[0-9.]+$/.test(String(big));
  ov.innerHTML=`<video class="ascv" playsinline></video>
    <div class="ascfg${txt?' txt':''}"><div class="ascw"><b>${esc(big)}</b>${unit?`<small>${esc(unit)}</small>`:''}</div><div class="ascn">${esc(sub)}</div></div>
    <button type="button" class="ascx" aria-label="close">✕</button>`;
  document.body.appendChild(ov);document.body.classList.add('gcal-fs');
  const v=ov.querySelector('.ascv');v.src=url;v.autoplay=true;
  requestAnimationFrame(()=>ov.classList.add('on'));
  try{navigator.vibrate&&navigator.vibrate([40,60,40,60,200])}catch(e){}
  const done=()=>{ov.classList.remove('on');setTimeout(()=>ov.remove(),320);document.body.classList.remove('gcal-fs');removeEventListener('keydown',key)};
  const key=e=>{if(e.key==='Escape')done()};addEventListener('keydown',key);
  v.onended=done;ov.onclick=e=>{if(e.target===ov||e.target.closest('.ascx'))done()};
  const p=v.play();if(p&&p.catch)p.catch(()=>{v.muted=true;v.play().catch(()=>{})})}

/* ---------- settings (lives in the gym ranks sheet) ---------- */
let ascHas=null;
async function ascProbe(){if(ascHas!==null)return ascHas;
  try{const {data}=await SB.storage.from('vault').list(UID+'/system',{search:'ascend.mp4'});ascHas=Array.isArray(data)&&data.some(f=>f.name==='ascend.mp4')}catch(e){ascHas=false}
  return ascHas}
function ascSettings(){return `<div class="rpgsec">Ascend</div>
  <div class="ascset" id="ascSet"><div class="ascrow"><span id="ascStat" class="dim">checking…</span>
    <span class="row"><button type="button" class="btn sm" id="ascPick">Choose clip</button><button type="button" class="btn sm" id="ascTest">Test</button></span></div>
  <label class="ascrow"><span class="dim">Play it on a new round weight</span><input type="checkbox" id="ascTog" ${ascOn()?'checked':''}></label>
  <input type="file" id="ascFile" accept="video/*" hidden></div>`}
function ascBind(){const st=$('ascStat');if(!st)return;
  ascProbe().then(h=>{if($('ascStat'))$('ascStat').textContent=h?'clip is set':'no clip yet'});
  $('ascPick').onclick=()=>$('ascFile').click();
  $('ascTog').onchange=e=>LS.set('ascendOff',!e.target.checked);
  $('ascTest').onclick=async()=>{if(!(await ascProbe()))return bToast('Choose a clip first.');ascPlay('100','kg','test lift')};
  $('ascFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;
    if(f.size>25*1024*1024)return bToast('That clip is over 25MB — trim it first.');
    $('ascStat').textContent='uploading…';
    try{const {error}=await SB.storage.from('vault').upload(ASC_PATH(),f,{contentType:f.type||'video/mp4',upsert:true});if(!error){await mediaForget(ASC_PATH());if(ascEl){ascEl.remove();ascEl=null;ascPrimed=false}}
      if(error)throw error;ascHas=true;ascPrimed=false;ascEl=null;AURL.delete(ASC_PATH());$('ascStat').textContent='clip is set'}
    catch(x){$('ascStat').textContent='upload failed — try again'}}}

})();
