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
    if(a===null||a===''||a==='Compound')continue;
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
const norm=s=>String(s||'').trim().toLowerCase();
const LS={get(k){try{return JSON.parse(localStorage.getItem('ds3:'+k))}catch(e){return null}},set(k,v){try{localStorage.setItem('ds3:'+k,JSON.stringify(v))}catch(e){}}};
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const rid=()=>Math.random().toString(36).slice(2,8);
const isNum=v=>typeof v==='number'&&isFinite(v);


/* ================= FX ================= */
let FX=LS.get('fx'); if(FX===null) FX=!reduced;
function applyFx(){document.body.classList.toggle('fx',FX);document.body.classList.toggle('nofx',!FX);$('fxBtn').setAttribute('aria-pressed',FX)}
applyFx();
$('fxBtn').onclick=()=>{FX=!FX;LS.set('fx',FX);applyFx();if(FX)glitchAll()};
const noise=$('noise'),nctx=noise.getContext('2d');const nimg=nctx.createImageData(160,90);
setInterval(()=>{if(!FX||document.hidden)return;const d=nimg.data;for(let i=0;i<d.length;i+=4){const v=Math.random()*255|0;d[i]=d[i+1]=d[i+2]=v;d[i+3]=255}nctx.putImageData(nimg,0,0)},90);
const pc=$('parts'),px=pc.getContext('2d');let parts=[],praf=0;
function sizeP(){pc.width=innerWidth*devicePixelRatio;pc.height=innerHeight*devicePixelRatio}
sizeP();addEventListener('resize',sizeP);
function burst(x,y,n=34,big=false){if(!FX)return;for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=(big?6:3.2)*(0.4+Math.random());parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,life:1,c:Math.random()<.55?'#ff2a6d':(Math.random()<.5?'#05d9e8':'#e6e6e6'),sz:(big?5:3)+Math.random()*3})}if(!praf)praf=requestAnimationFrame(stepP)}
function burstEl(el,n,big){const r=el.getBoundingClientRect();burst(r.left+r.width/2,r.top+r.height/2,n,big)}
function stepP(){const r=devicePixelRatio;px.clearRect(0,0,pc.width,pc.height);parts=parts.filter(p=>p.life>0);for(const p of parts){p.x+=p.vx;p.y+=p.vy;p.vy+=.18;p.vx*=.98;p.life-=.022;px.globalAlpha=Math.max(p.life,0);px.fillStyle=p.c;px.fillRect(Math.round(p.x*r),Math.round(p.y*r),p.sz*r,p.sz*r)}praf=parts.length?requestAnimationFrame(stepP):0}
function glitchAll(){if(!FX)return;const m=$('main');m.classList.remove('glitchall');void m.offsetWidth;m.classList.add('glitchall')}
function shake(){if(!FX)return;document.body.classList.remove('shake');void document.body.offsetWidth;document.body.classList.add('shake')}
function flash(t){if(!FX)return;$('flashTxt').textContent=t;const f=$('flash');f.classList.remove('on');void f.offsetWidth;f.classList.add('on')}
(function loopGlitch(){setTimeout(()=>{if(FX&&!document.hidden)glitchAll();loopGlitch()},14000+Math.random()*16000)})();
const SCR='!<>-_\\/[]{}—=+*^?#01ABCDEF';
function scramble(el,final,dur=520){final=String(final);if(!FX){el.textContent=final;return}const t0=performance.now();(function f(t){const p=Math.min((t-t0)/dur,1);let s='';for(let i=0;i<final.length;i++){s+=(i/final.length<p||final[i]===' ')?final[i]:SCR[Math.random()*SCR.length|0]}el.textContent=s;if(p<1)requestAnimationFrame(f)})(t0)}
const cx=$('curx'),cxy=$('curxy');
addEventListener('pointermove',e=>{if(e.pointerType!=='mouse')return;cx.style.left=e.clientX+'px';cx.style.top=e.clientY+'px';cxy.style.left=e.clientX+'px';cxy.style.top=e.clientY+'px';cxy.textContent=String(Math.round(e.clientX)).padStart(4,'0')+':'+String(Math.round(e.clientY)).padStart(4,'0');cx.classList.toggle('big',!!e.target.closest('button,a,input,select,textarea,.it,.tr,.cat'))});


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
      try{lastW[p]=JSON.stringify(v);await KV.set(p,v)}
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
const clone=o=>o==null?o:JSON.parse(JSON.stringify(o));
async function load(p){if(R&&ONLINE){try{const d=await KV.get(p);if(d!==undefined){LS.set(p,d);return clone(d)}return LS.get(p)}catch(e){}}return LS.get(p)}
async function listDocs(prefix){if(R&&ONLINE){try{const rows=await KV.list(prefix);rows.forEach(r=>LS.set(r.path,r.data));return rows.map(r=>({path:r.path,data:clone(r.data),at:r.updated_at}))}catch(e){}}
  const out=[];try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith('ds3:'+prefix)){const p=k.slice(4);const d=LS.get(p);if(d!=null)out.push({path:p,data:d})}}}catch(e){}return out}
// live updates from other devices and the laptop agent
const subs={},psubs=[];
function watch(p,cb){subs[p]=cb}
function watchPrefix(prefix,cb){psubs.push([prefix,cb])}
function onRemote(evt,path,data){
  if(evt!=='DELETE'){if(pend[path]!=null||busy[path])return;const s=JSON.stringify(data);if(lastW[path]===s)return;lastW[path]=s;LS.set(path,data)}
  else{try{localStorage.removeItem('ds3:'+path)}catch(e){}}
  if(subs[path]&&evt!=='DELETE')subs[path](clone(data));
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
const VIEW_ART={today:{seed:1.3,a:[1,.16,.43],b:[.02,.85,.91]},gym:{seed:4.1,a:[1,.16,.43],b:[1,.69,0]},body:{seed:7.7,a:[.02,.85,.91],b:[1,.16,.43]},tools:{seed:2.9,a:[.69,.55,1],b:[1,.16,.43]},journal:{seed:9.2,a:[.9,.9,.9],b:[1,.16,.43]},week:{seed:5.5,a:[.34,.96,.66],b:[1,.16,.43]},stack:{seed:3.3,a:[1,.16,.43],b:[.69,.55,1]},money:{seed:6.6,a:[1,.69,0],b:[.02,.85,.91]}};
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
const dayPath=d=>'days/d-'+ymd(d);
function isoWeek(d){const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const dn=t.getUTCDay()||7;t.setUTCDate(t.getUTCDate()+4-dn);const y=t.getUTCFullYear();const w=Math.ceil(((t-Date.UTC(y,0,1))/864e5+1)/7);return `${y}-W${pad(w)}`}
const mins=d=>d.getHours()*60+d.getMinutes();
const parseT=s=>{const m=String(s||'').match(/^(\d{1,2}):(\d{2})/);return m?(+m[1])*60+(+m[2]):null};
const fmtM=m=>pad(Math.floor(m/60)%24)+':'+pad(m%60);
const daysBetween=(a,b)=>Math.round((new Date(b+'T12:00')-new Date(a+'T12:00'))/864e5);
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
function renderPend(){const b=$('pendBtn');if(!b)return;const n=Object.keys(EDITS.p).length;const st=typeof XLSTATE==='undefined'?'off':XLSTATE;b.className='pendbtn on xl-'+st;
  b.textContent=st==='live'?(n?`XL ⟳ ${n}`:'XL ● live'):st==='err'?`XL ! ${n||''}`.trim():(n?`XL · ${n} waiting for laptop`:'XL · laptop off');b.title=st==='off'?'App is the main copy. Excel catches up next time your laptop is on.':'Excel sync: click for details'}

/* ================= MODEL ================= */
const STACK_CATS=['Anabolic / Main','Ancillaries','Supplements','Peptides','Cognition / Anxiolytic','Bloods & Supplies'];
const EXP_CATS=['Food','Subscriptions','Cat','Personal & Other','Investment & Savings'];
const FREQL={'weekly':52/12,'fortnightly':26/12,'4-weekly':13/12,'monthly':1,'bi-monthly':.5,'quarterly':1/3,'yearly':1/12};const FREQ=new Proxy({},{get:(o,k)=>FREQL[String(k).toLowerCase()]});const FREQ_OPTS=['Weekly','Fortnightly','4-weekly','Monthly','Bi-monthly','Quarterly','Yearly'];
const TYPES=['Task','Habit','Work','Study','Training','Meal','Break','Leisure','Social','Research','Plan','Mindset','Circadian','Sleep','LM','Peptide','Supplement','Cognition','Ancillary','Anabolic'];
const CMP=new Set(['Peptide','Supplement','Cognition','Ancillary','Anabolic']);
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
      let items=b.items.map(it=>applyP({...it},pre+':'+it.row)).filter(Boolean).concat(newOf(pre+':').filter(n=>n._ctx&&n._ctx.block===b.row));
      items=items.map(it=>{let t=parseT(it.time);if(t!==null&&t<s-60)t+=1440;return {...it,t,days:daysFrom(it.sched)||daysFrom(it.item),cmp:CMP.has(it.type),tk:pre+'|'+(it.time||'')+'|'+it.item}}).sort((a,b)=>(a.t??9999)-(b.t??9999)||(a.row||9e9)-(b.row||9e9));
      return {s,e,title:m[5],short:m[5].replace(/\s*\(.*?\)/g,'').replace(/\s*→.*$/,'').trim(),items,row:b.row,bi}});}
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
  M.stack.forEach(s=>{const v=v2.get(norm(s.name));s.status=v?v.status:'notinplan';s.times=v?[...new Set(v.times.filter(Boolean))]:[];s.cau=cautionsFor(s.name)});
  M.liveBudget=M.stack.filter(s=>s.inb&&s.status!=='paused').reduce((a,s)=>a+(s.monthly||0),0);
  M.targets=(extra.weekday['DAILY TARGETS – review Sundays 19:00']||[]);
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
    return `<label for="${id}">${esc(f.label||f.k)}</label>${inp}`}).join('')+
    (cfg.hint?`<div class="hint2">${esc(cfg.hint)}</div>`:'')+
    `<div class="mf">${cfg.onDelete?'<button class="btn d" type="button" id="mDel">delete</button>':''}${cfg.onRevert?'<button class="btn" type="button" id="mRev">undo my edits</button>':''}<span class="sp"></span><button class="btn" type="button" id="mCan">cancel</button><button class="btn p" type="submit">save</button></div>`;
  $('modal').classList.add('on');
  const first=$('mForm').querySelector('input,select,textarea');first&&first.focus();
  if(cfg.onDelete)$('mDel').onclick=()=>{cfg.onDelete();closeModal();glitchAll()};
  if(cfg.onRevert)$('mRev').onclick=()=>{cfg.onRevert();closeModal();glitchAll()};
  $('mCan').onclick=closeModal;
}
function closeModal(){$('modal').classList.remove('on');mCfg=null}
$('mX').onclick=closeModal;$('modal').onclick=e=>{if(e.target===$('modal'))closeModal()};
$('mForm').onsubmit=e=>{e.preventDefault();if(!mCfg)return;const vals={};
  for(const f of mCfg.fields){const el=$('f_'+f.k);let v=el.value;if(f.type==='bool')v=v==='1';else if(f.type==='num'){v=v.trim();v=v===''?null:(isFinite(+v)?+v:v)}else{v=v.trim()===''?null:v}vals[f.k]=v}
  const changed={};for(const f of mCfg.fields){if(JSON.stringify(vals[f.k]??null)!==JSON.stringify(mCfg.values[f.k]??null))changed[f.k]=vals[f.k]}
  const cfg=mCfg;closeModal();if(Object.keys(changed).length||cfg.isNew)cfg.onSave(vals,changed);
  const sub=$('main');burst(innerWidth/2,innerHeight/3,30);glitchAll()};

const F_PLAN=[{k:'time',label:'time',ph:'HH:MM'},{k:'item',label:'item'},{k:'type',type:'select',options:TYPES},{k:'dose'},{k:'route'},{k:'sched',label:'schedule / days',ph:'Daily · Mon–Fri · Tue, Thu · EOD'},{k:'notes',type:'area'},{k:'caution',label:'cautions',type:'area'}];
const F_EXTRA=[{k:'item'},{k:'type',type:'select',options:[''].concat(TYPES)},{k:'dose'},{k:'route'},{k:'sched',label:'schedule'},{k:'notes',type:'area'},{k:'caution',label:'cautions',type:'area'}];
const F_STACK=[{k:'name'},{k:'cat',label:'category',type:'select',options:STACK_CATS},{k:'dose'},{k:'route'},{k:'sched',label:'schedule'},{k:'notes',type:'area'},{k:'price',label:'pack price £',type:'num',ph:'or "owned"'},{k:'units',label:'units / pack',type:'num'},{k:'perweek',label:'used / week',type:'num'},{k:'inb',label:'in budget',type:'bool'},{k:'src',label:'source'}];
const F_EXP=[{k:'name'},{k:'cat',label:'category',type:'select',options:EXP_CATS},{k:'prov',label:'provider'},{k:'freq',label:'frequency',type:'select',options:FREQ_OPTS},{k:'per',label:'cost / payment £',type:'num'},{k:'day',label:'payment day'},{k:'method',label:'method'},{k:'notes'},{k:'inb',label:'in budget',type:'bool'}];
const F_TGT=[{k:'item',label:'target'},{k:'notes',label:'detail',type:'area'}];
function pick(o,fields){const r={};fields.forEach(f=>r[f.k]=o[f.k]??null);return r}
function editPlanItem(kind,it){const pre=kind==='weekday'?'wd':'we';
  openEditor({title:`edit · ${kind==='weekday'?'Day Plan v2':'Weekend Plan'}${it.row?' · row '+it.row:''}`,fields:F_PLAN,values:pick(it,F_PLAN),
    onSave:(v,ch)=>patch(it.key,it.isNew?v:ch),onDelete:()=>{if(it.isNew)dropPatch(it.key);else patch(it.key,{_del:true})},onRevert:it.edited&&!it.isNew?()=>dropPatch(it.key):null})}
function addPlanItem(kind,block){const pre=kind==='weekday'?'wd':'we';const b=M.plans[kind].find(x=>x.row===block);
  openEditor({title:`add to ${b?b.short.toLowerCase():'block'}`,fields:F_PLAN,values:{time:b?fmtM(b.s):'',type:'Task',sched:'Daily'},isNew:true,
    onSave:v=>patch(`${pre}:n:${rid()}`,{...v,_new:true},{block,kind})})}
function editExtra(kind,r){const pre=kind==='weekday'?'wx':'ex';const isT=/^DAILY TARGETS/.test(r.sec||'');const F=isT?F_TGT:F_EXTRA;
  openEditor({title:`edit · ${(r.sec||'').split(/[–(]/)[0].trim().toLowerCase()}${r.row?' · row '+r.row:''}`,fields:F,values:pick(r,F),
    onSave:(v,ch)=>patch(r.key,r.isNew?v:ch),onDelete:()=>{if(r.isNew)dropPatch(r.key);else patch(r.key,{_del:true})},onRevert:r.edited&&!r.isNew?()=>dropPatch(r.key):null})}
function addExtra(kind,sec){const pre=kind==='weekday'?'wx':'ex';const isT=/^DAILY TARGETS/.test(sec);const F=isT?F_TGT:F_EXTRA;
  openEditor({title:'add · '+sec.split(/[–(]/)[0].trim().toLowerCase(),fields:F,values:{},isNew:true,onSave:v=>patch(`${pre}:n:${rid()}`,{...v,_new:true,sec},{sec,kind})})}
function editStack(s){openEditor({title:`edit · Stack${s.row?' · row '+s.row:''}`,fields:F_STACK,values:pick(s,F_STACK),hint:'Monthly cost is worked out from pack price ÷ units × used per week, the same as the sheet.',
  onSave:(v,ch)=>{patch(s.key,s.isNew?v:ch);closeDrawer()},onDelete:()=>{if(s.isNew)dropPatch(s.key);else patch(s.key,{_del:true});closeDrawer()},onRevert:s.edited&&!s.isNew?()=>{dropPatch(s.key);closeDrawer()}:null})}
function addStack(){openEditor({title:'add compound',fields:F_STACK,values:{cat:'Supplements',route:'Oral',sched:'Daily',inb:true},isNew:true,onSave:v=>patch('st:n:'+rid(),{...v,_new:true},{cat:v.cat})})}
function editExp(e){openEditor({title:`edit · Expenses${e.row?' · row '+e.row:''}`,fields:F_EXP,values:pick(e,F_EXP),
  onSave:(v,ch)=>patch(e.key,e.isNew?v:ch),onDelete:()=>{if(e.isNew)dropPatch(e.key);else patch(e.key,{_del:true})},onRevert:e.edited&&!e.isNew?()=>dropPatch(e.key):null})}
function addExp(cat){openEditor({title:'add · '+(cat||'bill').toLowerCase(),fields:F_EXP,values:{cat:cat||'Subscriptions',freq:'Monthly',inb:true},isNew:true,onSave:v=>patch('xp:n:'+rid(),{...v,_new:true},{cat:v.cat})})}
function editIncome(){openEditor({title:'edit · income (Expenses Summary B15–B16)',fields:[{k:'hours',label:'hours / month',type:'num'},{k:'take',label:'take-home £',type:'num'}],values:{hours:M.inc.hours,take:M.inc.take},onSave:(v)=>patch('inc:',{hours:v.hours,take:v.take})})}


/* ================= EDIT MODE ================= */
let EDIT=false;
function setEdit(on){EDIT=on;document.body.classList.toggle('edit-on',on);$('editBtn').setAttribute('aria-pressed',on);if(on)glitchAll()}
$('editBtn').onclick=()=>setEdit(!EDIT);


/* ================= TODAY ================= */
let L=logical(),DAYK=ymd(L),DOWN=DOW[L.getDay()];
let planKind=(DOWN==='Sat'||DOWN==='Sun')?'weekend':'weekday',planForced=false;
let DAY={ticks:{},water:0,msg:{},dw:0};let filt='all';
const tkey=(kind,it)=>it.key;
function visibleItems(){return M.plans[planKind].flatMap(b=>b.items.filter(i=>!i.days||i.days.has(DOWN)))}
function nowM(){let m=mins(new Date());if(m<300)m+=1440;return m}
function itemRow(i){
  const ds=[i.dose&&i.dose!=='—'?i.dose:null,i.route&&i.route!=='—'?i.route:null].filter(Boolean).join(' · ');
  const sch=i.sched&&!/^(Daily|—|None)$/.test(i.sched)?i.sched:'';
  return `<div class="it" role="checkbox" tabindex="0" aria-checked="false" data-k="${esc(i.tk)}" data-t="${i.t??''}" data-cmp="${i.cmp?1:0}"><span class="box"></span><span class="t num">${esc(i.time||'')}</span><span><span class="nm">${esc(i.item)}</span>${i.edited?'<span class="delta">Δ</span>':''}${ds?`<span class="dd">${esc(ds)}</span>`:''}${sch?`<span class="dd">· ${esc(sch)}</span>`:''}${i.caution?'<span class="warnflag" title="Has a caution">⚠</span>':''}${i.notes?`<span class="nt">${esc(i.notes)}</span>`:''}${i.caution?`<span class="ca">${esc(i.caution)}</span>`:''}</span><span class="row" style="gap:6px;justify-content:flex-end"><button class="ed" type="button" data-edit="${esc(i.key)}">✎</button><span class="ty${i.cmp?' c':''}">${esc(i.type||'')}</span></span></div>`;
}
function renderToday(){
  const blocks=M.plans[planKind];
  $('planName').textContent=planKind==='weekday'?'day plan v2':'weekend plan';
  $('pWd').setAttribute('aria-pressed',planKind==='weekday');$('pWe').setAttribute('aria-pressed',planKind==='weekend');
  const gym=(planKind==='weekday'&&(DOWN==='Tue'||DOWN==='Thu'))||(planKind==='weekend');
  const tdate=L.toLocaleDateString('en-GB',{weekday:'short',day:'2-digit',month:'short'}).toUpperCase();
  const late=mins(new Date())<300;
  $('dateline').innerHTML=`<span class="num">${esc(tdate)}</span><span class="chipy">${planKind}</span>${gym?`<button class="chipy hot" type="button" data-go="gym" style="background:none;cursor:pointer">gym day · ${gymTypeFor()} → log</button>`:''}${planKind==='weekday'&&!gym?'<span class="chipy">non-gym · dinner 19:30</span>':''}${late?'<span class="chipy hot">after midnight · still logging '+esc(DOWN)+'</span>':''}`;
  $('strip').innerHTML=blocks.map(b=>`<button type="button" data-b="${b.bi}" style="flex:${Math.max(b.e-b.s,20)}"><span class="t num">${fmtM(b.s)}</span><span class="n">${esc(b.short.toLowerCase())}</span><span class="fill"></span></button>`).join('')+`<span class="nowline" id="nowline"></span>`;
  const open=new Set([...document.querySelectorAll('#blocks .blk.open')].map(e=>e.dataset.b));
  $('blocks').innerHTML=blocks.map(b=>{const its=b.items.filter(i=>!i.days||i.days.has(DOWN));
    return `<div class="blk${open.has(String(b.bi))?' open':''}" id="blk-${b.bi}" data-b="${b.bi}"><button class="bh" type="button" aria-expanded="${open.has(String(b.bi))}"><span class="ar">▸</span><span class="tm num">${fmtM(b.s)}–${fmtM(b.e)}</span><span class="ti">${esc(b.title)}</span><span class="ct num"></span><span class="mini"><span></span></span></button><div class="items">${its.map(itemRow).join('')}<button class="addrow" type="button" data-addblock="${b.row}">+ add item to ${esc(b.short.toLowerCase())}</button></div></div>`}).join('');
  const ex=M.extra[planKind];const showK=Object.keys(ex).filter(k=>/^(AS NEEDED|WEEKLY)/.test(k));
  $('todayExtra').innerHTML=showK.map(k=>`<div class="blk" data-x="1"><button class="bh" type="button" aria-expanded="false"><span class="ar">▸</span><span class="tm">${/WEEKLY/.test(k)?'weekly':'any time'}</span><span class="ti">${/WEEKLY/.test(k)?'weekly':'as needed'}</span><span class="ct">${ex[k].length} items</span><span></span></button><div class="items">${ex[k].map(r=>`<div class="it" role="checkbox" tabindex="0" aria-checked="false" data-k="${esc(r.tk)}" data-cmp="${CMP.has(r.type)?1:0}"><span class="box"></span><span class="t">${esc(r.day||'—')}</span><span><span class="nm">${esc(r.item)}</span>${r.edited?'<span class="delta">Δ</span>':''}<span class="dd">${esc([r.dose,r.route,r.sched].filter(x=>x&&x!=='—').join(' · '))}</span>${r.caution?'<span class="warnflag">⚠</span>':''}${r.notes?`<span class="nt">${esc(r.notes)}</span>`:''}${r.caution?`<span class="ca">${esc(r.caution)}</span>`:''}</span><span class="row" style="gap:6px;justify-content:flex-end"><button class="ed" type="button" data-editx="${esc(r.key)}" data-sec="${esc(k)}">✎</button><span class="ty c">${esc(r.type||'')}</span></span></div>`).join('')}<button class="addrow" type="button" data-addsec="${esc(k)}">+ add</button></div></div>`).join('');
  applyTicks();applyFilter();tickNow(true);
}
function applyTicks(){document.querySelectorAll('#v-today .it').forEach(el=>el.setAttribute('aria-checked',!!DAY.ticks[el.dataset.k]));updateCounts()}
function updateCounts(){
  const vis=visibleItems();const total=vis.length;const done=vis.filter(i=>DAY.ticks[i.tk]).length;const p=total?Math.round(done/total*100):0;
  $('pct').textContent=p+'%';$('pct').className='pct num '+(p>=80?'ok':'');
  const W=40,f=Math.round(p/100*W);$('asc').innerHTML=`<span class="f">${'█'.repeat(f)}</span><span class="e">${'░'.repeat(W-f)}</span>`;
  $('pctTxt').textContent=`${done}/${total} ticked · target 80%`;
  M.plans[planKind].forEach(b=>{const its=b.items.filter(i=>!i.days||i.days.has(DOWN));const el=$('blk-'+b.bi);if(!el)return;const d=its.filter(i=>DAY.ticks[i.tk]).length;
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
tog('hideDone','hidedone','hideDone');tog('infoBtn','showinfo','info');
$('pWd').onclick=()=>{planKind='weekday';planForced=true;firstNow=true;renderToday();glitchAll()};
$('pWe').onclick=()=>{planKind='weekend';planForced=true;firstNow=true;renderToday();glitchAll()};
let resetArm=0;$('resetDay').onclick=function(){if(Date.now()-resetArm<2500){DAY.ticks={};applyTicks();persistDay();this.textContent='reset';glitchAll();resetArm=0}else{resetArm=Date.now();this.textContent='tap again';setTimeout(()=>{this.textContent='reset'},2500)}};

let lastMin=-1,firstNow=true;
function tickNow(force){
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
  const up=vis.filter(i=>i.t>m).slice(0,14);const html=(up.length?up:vis.slice(0,10)).map(i=>`<span><b>${fmtM(i.t)}</b> ${esc(i.item)}</span>`).join('');$('tick').innerHTML=html+html;
}
setInterval(()=>tickNow(false),1000);
async function loadDay(){
  const p='days/d-'+DAYK;const d=await load(p);DAY={ticks:{},water:0,msg:{},dw:0,...(d||{})};
  renderToday();renderTools();watch(p,dd=>{if(p!=='days/d-'+DAYK)return;DAY={ticks:{},water:0,msg:{},dw:0,...dd};applyTicks();renderTools()});
}


/* ================= GYM (workout logger) ================= */
const EXLIB=[
 ['Bench Press (Barbell)','Chest','Barbell'],['Incline Bench Press (Barbell)','Chest','Barbell'],['Incline Bench Press (Dumbbell)','Chest','Dumbbell'],['Bench Press (Dumbbell)','Chest','Dumbbell'],['Chest Press (Machine)','Chest','Machine'],['Cable Fly','Chest','Cable'],['Pec Deck','Chest','Machine'],['Chest Dip','Chest','Bodyweight'],['Push Up','Chest','Bodyweight'],
 ['Pull Up','Back','Bodyweight'],['Chin Up','Back','Bodyweight'],['Lat Pulldown (Cable)','Back','Cable'],['Seated Cable Row','Back','Cable'],['Bent Over Row (Barbell)','Back','Barbell'],['Chest Supported Row (Dumbbell)','Back','Dumbbell'],['T-Bar Row','Back','Machine'],['Single Arm Row (Dumbbell)','Back','Dumbbell'],['Straight Arm Pulldown','Back','Cable'],['Deadlift (Barbell)','Back','Barbell'],['Rack Pull','Back','Barbell'],['Back Extension','Back','Bodyweight'],
 ['Overhead Press (Barbell)','Shoulders','Barbell'],['Shoulder Press (Dumbbell)','Shoulders','Dumbbell'],['Shoulder Press (Machine)','Shoulders','Machine'],['Lateral Raise (Dumbbell)','Shoulders','Dumbbell'],['Lateral Raise (Cable)','Shoulders','Cable'],['Rear Delt Fly (Machine)','Shoulders','Machine'],['Face Pull','Shoulders','Cable'],['Shrug (Dumbbell)','Traps','Dumbbell'],
 ['Bicep Curl (Dumbbell)','Biceps','Dumbbell'],['Bicep Curl (Barbell)','Biceps','Barbell'],['EZ Bar Curl','Biceps','Barbell'],['Hammer Curl (Dumbbell)','Biceps','Dumbbell'],['Preacher Curl','Biceps','Machine'],['Incline Curl (Dumbbell)','Biceps','Dumbbell'],['Cable Curl','Biceps','Cable'],
 ['Triceps Pushdown','Triceps','Cable'],['Overhead Triceps Extension (Cable)','Triceps','Cable'],['Skullcrusher (EZ Bar)','Triceps','Barbell'],['Triceps Dip','Triceps','Bodyweight'],['Close Grip Bench Press','Triceps','Barbell'],
 ['Squat (Barbell)','Quads','Barbell'],['Hack Squat (Machine)','Quads','Machine'],['Leg Press','Quads','Machine'],['Leg Extension','Quads','Machine'],['Bulgarian Split Squat','Quads','Dumbbell'],['Goblet Squat','Quads','Dumbbell'],['Walking Lunge','Quads','Dumbbell'],
 ['Romanian Deadlift (Barbell)','Hamstrings','Barbell'],['Romanian Deadlift (Dumbbell)','Hamstrings','Dumbbell'],['Lying Leg Curl','Hamstrings','Machine'],['Seated Leg Curl','Hamstrings','Machine'],['Hip Thrust (Barbell)','Glutes','Barbell'],['Hip Abduction (Machine)','Glutes','Machine'],
 ['Standing Calf Raise','Calves','Machine'],['Seated Calf Raise','Calves','Machine'],
 ['Cable Crunch','Abs','Cable'],['Hanging Leg Raise','Abs','Bodyweight'],['Ab Wheel','Abs','Bodyweight'],['Plank','Abs','Bodyweight'],
 ['Treadmill Incline Walk','Cardio','Machine'],['Stationary Bike','Cardio','Machine'],['Stair Climber','Cardio','Machine']
].map(([name,muscle,equip])=>({name,muscle,equip}));
const MUSCLES=['All','Chest','Back','Shoulders','Biceps','Triceps','Quads','Hamstrings','Glutes','Calves','Abs','Traps','Cardio','Other'];
let GYMV='workout',ACTIVE=null,ROUTINES={list:[]},GLIB={custom:[]},WORKOUTS=[],gymLoaded=false;
let restEnd=LS.get('restEnd')||null,restTotal=LS.get('restTotal')||120;
function gymTypeFor(){if(planKind==='weekend')return DOWN==='Sun'?'lower':'upper';return 'upper'}
const e1=s=>(+s.kg||0)*(1+(+s.r||0)/30);
const fmtDur=ms=>{const s=Math.max(0,Math.floor(ms/1000));const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return h?`${h}h ${pad(m)}m`:`${m}:${pad(x)}`};
const kgs=v=>{const n=+v;return isFinite(n)?(Math.round(n*100)/100).toString():''};
function allEx(){const m=new Map();EXLIB.concat(GLIB.custom||[]).forEach(e=>m.set(norm(e.name),e));WORKOUTS.forEach(w=>(w.ex||[]).forEach(x=>{if(!m.has(norm(x.n)))m.set(norm(x.n),{name:x.n,muscle:'Other',equip:''})}));return [...m.values()].sort((a,b)=>a.name.localeCompare(b.name))}
function exInfo(n){return allEx().find(e=>norm(e.name)===norm(n))||{name:n,muscle:'Other',equip:''}}
function convertOld(s){return {id:'old-'+s.date,name:(s.type||'workout').replace(/^./,c=>c.toUpperCase()),date:s.date,startedAt:s.date+'T12:00:00',endedAt:null,ex:(s.ex||[]).filter(x=>x.sets&&x.sets.length).map(x=>({n:x.n,sets:x.sets.map(t=>({t:'n',kg:t.w,r:t.r,done:true}))})),vol:s.vol||0,nsets:s.nsets||0,prs:[]}}
async function loadGym(force){
  if(gymLoaded&&!force){renderGym();return}
  const [a,r,l,rows]=await Promise.all([load('gym/active'),load('gym/routines'),load('gym/lib'),listDocs('gym/')]);
  ACTIVE=a&&a.ex?a:null;ROUTINES={list:[],...(r||{})};GLIB={custom:[],...(l||{})};
  const ws=[];rows.forEach(x=>{if(x.path.startsWith('gym/w-')&&x.data&&x.data.date)ws.push(x.data);else if(x.path.startsWith('gym/s-')&&x.data&&x.data.date&&(x.data.nsets||0)>0)ws.push(convertOld(x.data))});
  WORKOUTS=ws.sort((a,b)=>(b.startedAt||b.date)<(a.startedAt||a.date)?-1:1);gymLoaded=true;renderGym();
}
watch('gym/active',d=>{ACTIVE=d&&d.ex?d:null;if(cur==='gym')renderGym()});
watch('gym/routines',d=>{ROUTINES={list:[],...(d||{})};if(cur==='gym')renderGym()});
watchPrefix('gym/w-',(evt,path,data)=>{const id=path.slice(6);WORKOUTS=WORKOUTS.filter(w=>w.id!==id);if(evt!=='DELETE'&&data)WORKOUTS.unshift(data);WORKOUTS.sort((a,b)=>(b.startedAt||b.date)<(a.startedAt||a.date)?-1:1);if(cur==='gym')renderGym()});
let activeT=null;function saveActive(){clearTimeout(activeT);activeT=setTimeout(()=>{if(ACTIVE)save('gym/active',ACTIVE);else removeDoc('gym/active')},300)}
function exHistory(n,beforeId){return WORKOUTS.filter(w=>w.id!==beforeId).map(w=>({w,x:(w.ex||[]).find(x=>norm(x.n)===norm(n))})).filter(o=>o.x&&o.x.sets.some(s=>s.done!==false&&+s.r>0))}
function prevSets(n){const h=exHistory(n,ACTIVE&&ACTIVE.id)[0];return h?h.x.sets.filter(s=>s.done!==false):[]}
function bests(n,beforeId){let kg=0,e=0,vol=0;exHistory(n,beforeId).forEach(o=>o.x.sets.forEach(s=>{if(s.t==='w'||s.done===false)return;kg=Math.max(kg,+s.kg||0);e=Math.max(e,e1(s));vol=Math.max(vol,(+s.kg||0)*(+s.r||0))}));return {kg,e,vol}}
function setLabel(sets,i){const s=sets[i];if(s.t==='w')return 'W';if(s.t==='d')return 'D';if(s.t==='f')return 'F';let n=0;for(let j=0;j<=i;j++)if(!sets[j].t||sets[j].t==='n')n++;return String(n)}
function stats(w){let vol=0,n=0;(w.ex||[]).forEach(x=>x.sets.forEach(s=>{if(s.done){n++;vol+=(+s.kg||0)*(+s.r||0)}}));return {vol,n}}

function renderGym(){
  $('gymSeg').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.g===GYMV));
  ['workout','routines','history','exercises'].forEach(v=>$('g-'+v).hidden=v!==GYMV);
  $('gymSub').textContent=planKind==='weekend'?(DOWN==='Sun'?'plan today: lower 11:00':'plan today: upper 11:00'):(DOWN==='Tue'||DOWN==='Thu'?'plan today: upper 20:30':'rest day in the plan');
  if(GYMV==='workout')renderWorkout();else if(GYMV==='routines')renderRoutines();else if(GYMV==='history')renderHistory();else renderLibrary();
  renderRest();
}
$('gymSeg').onclick=e=>{const b=e.target.closest('button');if(!b)return;GYMV=b.dataset.g;renderGym();staggerIn($('g-'+GYMV))};

/* --- workout --- */
function renderWorkout(){
  const el=$('g-workout');
  if(!ACTIVE){
    const sug=gymTypeFor();
    el.innerHTML=`<div class="gstart">
      <button class="bigstart" type="button" data-act="empty"><span class="tag">quick start</span><b>start empty workout</b><span class="dim">log as you go</span></button>
      <div class="ph2"><span class="tag">routines</span><button class="iconbtn" type="button" data-act="newroutine">+ new</button></div>
      <div class="rgrid">${ROUTINES.list.map(r=>`<div class="rcard${norm(r.name).includes(sug)?' hot':''}"><div class="rtop"><b>${esc(r.name)}</b>${norm(r.name).includes(sug)?'<span class="chipy hot">today</span>':''}</div><span class="dim rsum">${esc(r.ex.map(x=>x.n).join(', ')||'no exercises yet')}</span><button class="btn p" type="button" data-start="${esc(r.id)}">start routine</button></div>`).join('')||'<div class="dim" style="font-size:12px">No routines yet. Make an "Upper" and a "Lower" one so starting a session is one tap.</div>'}</div>
      ${WORKOUTS[0]?`<div class="ph2"><span class="tag">last workout</span></div>${wCard(WORKOUTS[0])}`:''}
    </div>`;return}
  const st=stats(ACTIVE);
  el.innerHTML=`<div class="wbar"><input class="wname" id="wName" value="${esc(ACTIVE.name)}" aria-label="Workout name"><div class="wstats"><div><span class="dim">duration</span><b class="num" id="wDur">${fmtDur(Date.now()-new Date(ACTIVE.startedAt))}</b></div><div><span class="dim">volume</span><b class="num">${Math.round(st.vol).toLocaleString('en-GB')} kg</b></div><div><span class="dim">sets</span><b class="num">${st.n}</b></div></div><div class="row"><button class="btn" type="button" data-act="discard">discard</button><button class="btn p" type="button" data-act="finish">finish</button></div></div>
  <div class="exlist">${ACTIVE.ex.map((x,xi)=>exCard(x,xi)).join('')}</div>
  <button class="addex" type="button" data-act="addex">+ add exercise</button>`;
}
function exCard(x,xi){
  const prev=prevSets(x.n);const b=bests(x.n,ACTIVE.id);
  return `<div class="exc" data-x="${xi}"><div class="exh"><button class="exname" type="button" data-exinfo="${esc(x.n)}">${esc(x.n)}</button><div class="row" style="gap:4px"><button class="iconbtn" type="button" data-mv="${xi}:-1" aria-label="Move up">↑</button><button class="iconbtn" type="button" data-mv="${xi}:1" aria-label="Move down">↓</button><button class="iconbtn" type="button" data-rmx="${xi}" aria-label="Remove exercise">✕</button></div></div>
  <input class="exnote" data-note="${xi}" placeholder="notes" value="${esc(x.note||'')}" aria-label="Notes for ${esc(x.n)}">
  <div class="restsel"><span class="dim">rest</span>${[0,60,90,120,180,240].map(s=>`<button type="button" data-rest="${xi}:${s}" aria-pressed="${(x.rest??120)===s}">${s?Math.floor(s/60)+':'+pad(s%60):'off'}</button>`).join('')}</div>
  <div class="sgrid shead"><span>set</span><span>previous</span><span>kg</span><span>reps</span><span>✓</span></div>
  ${x.sets.map((s,si)=>{const p=prev[si];const pr=s.done&&s.t!=='w'&&b.e>0&&e1(s)>b.e;return `<div class="sgrid srow${s.done?' done':''}${pr?' pr':''}" data-s="${xi}:${si}">
    <button class="stype t-${s.t||'n'}" type="button" data-stype="${xi}:${si}" title="Tap: normal, warm-up, drop, failure">${setLabel(x.sets,si)}</button>
    <button class="sprev" type="button" data-prev="${xi}:${si}" ${p?'':'disabled'}>${p?`${kgs(p.kg)}kg × ${p.r}`:'—'}</button>
    <input class="sin num" inputmode="decimal" data-kg="${xi}:${si}" value="${esc(s.kg??'')}" placeholder="${p?kgs(p.kg):''}" aria-label="kg">
    <input class="sin num" inputmode="numeric" data-r="${xi}:${si}" value="${esc(s.r??'')}" placeholder="${p?p.r:''}" aria-label="reps">
    <button class="scheck" type="button" data-done="${xi}:${si}" aria-pressed="${!!s.done}" aria-label="Complete set">✓</button>
    ${pr?'<span class="prtag">PR</span>':''}<button class="sdel" type="button" data-sdel="${xi}:${si}" aria-label="Delete set">✕</button></div>`}).join('')}
  <button class="addset" type="button" data-addset="${xi}">+ add set</button></div>`;
}
function wCard(w){const st=w.nsets!=null?{vol:w.vol,n:w.nsets}:stats(w);const dur=w.endedAt&&w.startedAt?fmtDur(new Date(w.endedAt)-new Date(w.startedAt)):'';
  return `<div class="wcard" data-w="${esc(w.id)}"><div class="rtop"><b>${esc(w.name)}</b><span class="dim">${esc(nice(w.date).toLowerCase())}</span></div>
  <div class="wmeta num"><span>${dur||'—'}</span><span>${Math.round(st.vol||0).toLocaleString('en-GB')} kg</span><span>${st.n||0} sets</span>${(w.prs||[]).length?`<span class="pink">${w.prs.length} PR</span>`:''}</div>
  <div class="wex">${(w.ex||[]).map(x=>{const best=x.sets.filter(s=>s.done!==false&&s.t!=='w').sort((a,b)=>e1(b)-e1(a))[0];return `<div><span>${x.sets.filter(s=>s.done!==false).length} × ${esc(x.n)}</span><span class="dim num">${best?kgs(best.kg)+'kg × '+best.r:''}</span></div>`}).join('')}</div></div>`}
function startWorkout(r){
  ACTIVE={id:new Date().toISOString().replace(/[:.]/g,'-'),name:r?r.name:(gymTypeFor()==='lower'?'Lower':'Upper'),routineId:r?r.id:null,startedAt:new Date().toISOString(),
    ex:r?r.ex.map(x=>{const prev=exHistory(x.n)[0];const ps=prev?prev.x.sets.filter(s=>s.done!==false):[];return {n:x.n,rest:x.rest??120,note:x.note||'',sets:Array.from({length:x.sets||3},(_,i)=>({t:(ps[i]&&ps[i].t)||'n',kg:'',r:'',done:false}))}}):[]};
  saveActive();renderGym();flash('workout_started');staggerIn($('g-workout'));
}
function mut(fn){fn();saveActive();renderWorkout();}
$('g-workout').addEventListener('click',e=>{
  const t=e.target.closest('button');if(!t)return;const d=t.dataset;
  if(d.act==='empty')return startWorkout(null);
  if(d.start)return startWorkout(ROUTINES.list.find(r=>r.id===d.start));
  if(d.act==='newroutine'){GYMV='routines';renderGym();return editRoutine(null)}
  if(d.act==='addex')return pickExercise(n=>mut(()=>{const prev=exHistory(n)[0];const ps=prev?prev.x.sets.filter(s=>s.done!==false):[];ACTIVE.ex.push({n,rest:120,note:'',sets:Array.from({length:Math.max(1,Math.min(ps.length||3,6))},(_,i)=>({t:(ps[i]&&ps[i].t)||'n',kg:'',r:'',done:false}))})}));
  if(d.act==='discard'){if(t.dataset.arm){ACTIVE=null;saveActive();renderGym();glitchAll()}else{t.dataset.arm=1;t.textContent='tap again';setTimeout(()=>{if(t.isConnected){delete t.dataset.arm;t.textContent='discard'}},2500)}return}
  if(d.act==='finish')return finishWorkout();
  if(d.exinfo)return openExercise(d.exinfo);
  if(d.mv){const [xi,dir]=d.mv.split(':').map(Number);const j=xi+dir;if(j<0||j>=ACTIVE.ex.length)return;return mut(()=>{const a=ACTIVE.ex;[a[xi],a[j]]=[a[j],a[xi]]})}
  if(d.rmx){const xi=+d.rmx;if(t.dataset.arm)return mut(()=>ACTIVE.ex.splice(xi,1));t.dataset.arm=1;t.textContent='remove?';setTimeout(()=>{if(t.isConnected){delete t.dataset.arm;t.textContent='✕'}},2500);return}
  if(d.rest){const [xi,s]=d.rest.split(':').map(Number);return mut(()=>ACTIVE.ex[xi].rest=s)}
  if(d.addset){const xi=+d.addset;return mut(()=>{const x=ACTIVE.ex[xi];const l=x.sets[x.sets.length-1];x.sets.push({t:'n',kg:l?l.kg:'',r:l?l.r:'',done:false})})}
  if(d.sdel){const [xi,si]=d.sdel.split(':').map(Number);return mut(()=>ACTIVE.ex[xi].sets.splice(si,1))}
  if(d.stype){const [xi,si]=d.stype.split(':').map(Number);const order=['n','w','d','f'];return mut(()=>{const s=ACTIVE.ex[xi].sets[si];s.t=order[(order.indexOf(s.t||'n')+1)%4]})}
  if(d.prev){const [xi,si]=d.prev.split(':').map(Number);const p=prevSets(ACTIVE.ex[xi].n)[si];if(p)return mut(()=>{const s=ACTIVE.ex[xi].sets[si];s.kg=p.kg;s.r=p.r})}
  if(d.done){const [xi,si]=d.done.split(':').map(Number);const x=ACTIVE.ex[xi];const s=x.sets[si];
    if(!s.done){const p=prevSets(x.n)[si];if(s.kg===''||s.kg==null)s.kg=p?p.kg:'';if(s.r===''||s.r==null)s.r=p?p.r:'';if(!(+s.r>0)){const row=t.closest('.srow');row&&row.animate&&row.animate([{transform:'translateX(-6px)'},{transform:'translateX(6px)'},{transform:'none'}],{duration:220});return}}
    s.done=!s.done;s.at=s.done?new Date().toISOString():null;const b=bests(x.n,ACTIVE.id);const isPR=s.done&&s.t!=='w'&&b.e>0&&e1(s)>b.e;
    saveActive();renderWorkout();
    if(s.done){const row=document.querySelector(`.srow[data-s="${xi}:${si}"]`);if(row){burstEl(row.querySelector('.scheck'),isPR?90:24,isPR)}if(isPR){flash('new_pr');shake()}if(x.rest)startRest(x.rest)}
    if(s.done&&stats(ACTIVE).n===1)autoTick(/^Gym\b/);
  }
});
$('g-workout').addEventListener('input',e=>{const t=e.target;const d=t.dataset;
  if(t.id==='wName'){ACTIVE.name=t.value;saveActive();return}
  if(d.note!=null){ACTIVE.ex[+d.note].note=t.value;saveActive();return}
  if(d.kg){const [xi,si]=d.kg.split(':').map(Number);ACTIVE.ex[xi].sets[si].kg=t.value.replace(',','.');saveActive();return}
  if(d.r){const [xi,si]=d.r.split(':').map(Number);ACTIVE.ex[xi].sets[si].r=t.value;saveActive();return}
});
function finishWorkout(){
  const undone=ACTIVE.ex.reduce((a,x)=>a+x.sets.filter(s=>!s.done).length,0);
  const go2=(dropUndone)=>{
    const w=clone(ACTIVE);w.endedAt=new Date().toISOString();w.date=ymd(logical(new Date(w.startedAt)));
    w.ex=w.ex.map(x=>({...x,sets:x.sets.filter(s=>s.done||(!dropUndone&&+s.r>0)).map(s=>({...s,done:true}))})).filter(x=>x.sets.length);
    const prs=[];w.ex.forEach(x=>{const b=bests(x.n,w.id);let mk=0,me=0,mv=0;x.sets.forEach(s=>{if(s.t==='w')return;mk=Math.max(mk,+s.kg||0);me=Math.max(me,e1(s));mv=Math.max(mv,(+s.kg||0)*(+s.r||0))});
      if(b.kg>0||b.e>0){if(mk>b.kg)prs.push({n:x.n,kind:'heaviest',v:mk});if(me>b.e)prs.push({n:x.n,kind:'e1RM',v:Math.round(me*10)/10});if(mv>b.vol)prs.push({n:x.n,kind:'best set volume',v:Math.round(mv)})}});
    const st=stats(w);w.vol=st.vol;w.nsets=st.n;w.prs=prs;
    if(!w.ex.length){ACTIVE=null;saveActive();renderGym();return}
    save('gym/w-'+w.id,w,true);WORKOUTS.unshift(w);ACTIVE=null;saveActive();restEnd=null;LS.set('restEnd',null);
    autoTick(/^Gym\b/);flash(prs.length?'new_pr':'workout_done');shake();burst(innerWidth/2,innerHeight/2,160,true);renderGym();showSummary(w);
  };
  if(undone){openSheet('finish workout?',`<p class="dim" style="margin:0 0 14px">${undone} set${undone>1?'s':''} not ticked.</p><div class="bigbtns"><button class="btn p" type="button" id="fDrop">discard unticked + finish</button><button class="btn" type="button" id="fKeep">keep sets with reps</button><button class="btn" type="button" id="fBack">back</button></div>`);
    $('fDrop').onclick=()=>{closeSheet();go2(true)};$('fKeep').onclick=()=>{closeSheet();go2(false)};$('fBack').onclick=closeSheet}
  else go2(true);
}
function showSummary(w){
  openSheet('workout complete',`<div class="sumhero"><b class="glitch" data-text="${esc(w.name)}">${esc(w.name)}</b><span class="dim">${esc(nice(w.date).toLowerCase())}</span></div>
  <div class="wstats big"><div><span class="dim">duration</span><b class="num">${fmtDur(new Date(w.endedAt)-new Date(w.startedAt))}</b></div><div><span class="dim">volume</span><b class="num">${Math.round(w.vol).toLocaleString('en-GB')} kg</b></div><div><span class="dim">sets</span><b class="num">${w.nsets}</b></div></div>
  ${w.prs.length?`<div class="prlist">${w.prs.map(p=>`<div><span class="pink">PR</span> ${esc(p.n)} · ${esc(p.kind)} <b class="num">${p.v}${p.kind==='best set volume'?' kg':' kg'}</b></div>`).join('')}</div>`:''}
  <div class="bigbtns" style="margin-top:16px">${w.routineId?'<button class="btn" type="button" id="updR">update routine</button>':'<button class="btn" type="button" id="saveR">save as routine</button>'}<button class="btn p" type="button" id="sumOk">done</button></div>`);
  $('sumOk').onclick=closeSheet;
  if($('saveR'))$('saveR').onclick=()=>{ROUTINES.list.push({id:rid(),name:w.name,ex:w.ex.map(x=>({n:x.n,sets:x.sets.length,rest:x.rest??120,note:x.note||''}))});save('gym/routines',ROUTINES);closeSheet();flash('saved')};
  if($('updR'))$('updR').onclick=()=>{const r=ROUTINES.list.find(x=>x.id===w.routineId);if(r){r.ex=w.ex.map(x=>({n:x.n,sets:x.sets.length,rest:x.rest??120,note:x.note||''}));save('gym/routines',ROUTINES)}closeSheet();flash('saved')};
}

/* --- rest timer --- */
function startRest(sec){restTotal=sec;restEnd=Date.now()+sec*1000;LS.set('restEnd',restEnd);LS.set('restTotal',restTotal);renderRest()}
function renderRest(){const bar=$('restDock');if(!restEnd){bar.classList.remove('on');return}bar.classList.add('on')}
$('restDock').onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.rd==='skip'){restEnd=null;LS.set('restEnd',null);renderRest();return}const d=+b.dataset.rd;restEnd=Math.max(Date.now()+1000,restEnd+d*1000);restTotal=Math.max(15,restTotal+d);LS.set('restEnd',restEnd);LS.set('restTotal',restTotal)};
setInterval(()=>{
  if(ACTIVE&&$('wDur'))$('wDur').textContent=fmtDur(Date.now()-new Date(ACTIVE.startedAt));
  if(!restEnd)return;const l=Math.max(0,Math.round((restEnd-Date.now())/1000));$('restT').textContent=Math.floor(l/60)+':'+pad(l%60);$('restBar').style.width=Math.min(100,100-l/restTotal*100)+'%';$('restDock').classList.add('on');
  if(l===0){restEnd=null;LS.set('restEnd',null);$('restDock').classList.remove('on');flash('go');try{navigator.vibrate&&navigator.vibrate([200,80,200])}catch(e){}}
},250);

/* --- routines --- */
function renderRoutines(){
  $('g-routines').innerHTML=`<div class="ph2"><span class="tag">${ROUTINES.list.length} routines</span><button class="btn p" type="button" data-r="new">+ new routine</button></div>
  <div class="rgrid">${ROUTINES.list.map(r=>`<div class="rcard"><div class="rtop"><b>${esc(r.name)}</b><span class="row" style="gap:4px"><button class="iconbtn" type="button" data-redit="${esc(r.id)}">✎</button></span></div>
  <div class="wex">${r.ex.map(x=>`<div><span>${x.sets} × ${esc(x.n)}</span><span class="dim num">rest ${x.rest?Math.floor(x.rest/60)+':'+pad(x.rest%60):'off'}</span></div>`).join('')||'<span class="dim">empty</span>'}</div>
  <button class="btn p" type="button" data-rstart="${esc(r.id)}">start</button></div>`).join('')||'<div class="dim">No routines yet.</div>'}</div>`;
}
$('g-routines').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.r==='new')return editRoutine(null);
  if(b.dataset.redit)return editRoutine(ROUTINES.list.find(r=>r.id===b.dataset.redit));
  if(b.dataset.rstart){if(ACTIVE){flash('finish_current_first');return}GYMV='workout';startWorkout(ROUTINES.list.find(r=>r.id===b.dataset.rstart))}});
function editRoutine(r){
  const R2=r?clone(r):{id:rid(),name:gymTypeFor()==='lower'?'Lower':'Upper',ex:[]};
  const draw=()=>{openSheet(r?'edit routine':'new routine',`<input class="inp" id="rName" value="${esc(R2.name)}" aria-label="Routine name" style="font-size:18px;margin-bottom:12px">
    <div class="rex">${R2.ex.map((x,i)=>`<div class="rexrow"><span>${esc(x.n)}</span><label class="dim">sets <input class="inp num" data-rs="${i}" value="${x.sets}" inputmode="numeric" style="width:50px"></label><label class="dim">rest <select class="inp" data-rr="${i}">${[0,60,90,120,180,240].map(s=>`<option value="${s}" ${s===(x.rest??120)?'selected':''}>${s?Math.floor(s/60)+':'+pad(s%60):'off'}</option>`).join('')}</select></label><span class="row" style="gap:4px"><button class="iconbtn" type="button" data-rm="${i}:-1">↑</button><button class="iconbtn" type="button" data-rm="${i}:1">↓</button><button class="iconbtn" type="button" data-rx="${i}">✕</button></span></div>`).join('')||'<div class="dim" style="font-size:12px">Add the exercises you do in this session.</div>'}</div>
    <button class="addex" type="button" id="rAdd">+ add exercise</button>
    <div class="bigbtns" style="margin-top:14px">${r?'<button class="btn d" type="button" id="rDel">delete</button>':''}<span style="flex:1"></span><button class="btn" type="button" id="rCancel">cancel</button><button class="btn p" type="button" id="rSave">save</button></div>`);
    const sh=$('sheetBody');
    sh.oninput=e=>{const t=e.target;if(t.id==='rName')R2.name=t.value;if(t.dataset.rs!=null)R2.ex[+t.dataset.rs].sets=Math.max(1,Math.min(12,parseInt(t.value)||1));if(t.dataset.rr!=null)R2.ex[+t.dataset.rr].rest=+t.value};
    sh.onchange=sh.oninput;
    sh.onclick=e=>{const b=e.target.closest('button');if(!b)return;
      if(b.dataset.rm){const [i,d]=b.dataset.rm.split(':').map(Number);const j=i+d;if(j>=0&&j<R2.ex.length){[R2.ex[i],R2.ex[j]]=[R2.ex[j],R2.ex[i]];draw()}}
      if(b.dataset.rx!=null){R2.ex.splice(+b.dataset.rx,1);draw()}
      if(b.id==='rAdd')pickExercise(n=>{R2.ex.push({n,sets:3,rest:120,note:''});draw()},true);
      if(b.id==='rCancel')closeSheet();
      if(b.id==='rDel'){if(b.dataset.arm){ROUTINES.list=ROUTINES.list.filter(x=>x.id!==R2.id);save('gym/routines',ROUTINES);closeSheet();renderGym()}else{b.dataset.arm=1;b.textContent='tap again'}}
      if(b.id==='rSave'){R2.name=(R2.name||'').trim()||'Routine';const i=ROUTINES.list.findIndex(x=>x.id===R2.id);if(i>=0)ROUTINES.list[i]=R2;else ROUTINES.list.push(R2);save('gym/routines',ROUTINES);closeSheet();renderGym();flash('saved')}};
  };draw();
}

/* --- exercise picker --- */
function pickExercise(cb,keepOpen){
  let mus='All',q='';
  const draw=()=>{const list=allEx().filter(e=>(mus==='All'||e.muscle===mus)&&(!q||norm(e.name).includes(norm(q))));
    $('pickList').innerHTML=list.map(e=>`<button type="button" class="pick" data-pick="${esc(e.name)}"><span>${esc(e.name)}</span><span class="dim">${esc(e.muscle)}${e.equip?' · '+esc(e.equip):''}</span></button>`).join('')+(q&&!list.some(e=>norm(e.name)===norm(q))?`<button type="button" class="pick new" data-newex="1"><span>+ create "${esc(q)}"</span><span class="dim">custom</span></button>`:'');
    $('pickMus').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.m===mus))};
  openSheet('add exercise',`<input class="inp" id="pickQ" placeholder="search exercises" autocomplete="off" style="margin-bottom:10px"><div class="chips" id="pickMus">${MUSCLES.map(m=>`<button class="chip" type="button" data-m="${m}">${m.toLowerCase()}</button>`).join('')}</div><div class="picklist" id="pickList"></div>`,keepOpen);
  draw();setTimeout(()=>$('pickQ')&&$('pickQ').focus(),250);
  $('pickQ').oninput=e=>{q=e.target.value;draw()};
  $('pickMus').onclick=e=>{const b=e.target.closest('[data-m]');if(b){mus=b.dataset.m;draw()}};
  $('pickList').onclick=e=>{const b=e.target.closest('button');if(!b)return;let n=b.dataset.pick;
    if(b.dataset.newex){n=q.trim();GLIB.custom.push({name:n,muscle:mus==='All'?'Other':mus,equip:''});save('gym/lib',GLIB)}
    if(n){if(!keepOpen)closeSheet();cb(n)}};
}

/* --- history + exercise stats --- */
function renderHistory(){
  const weeks=[];const now=logical();for(let i=7;i>=0;i--){const d=new Date(now);d.setDate(d.getDate()-i*7);weeks.push(isoWeek(d))}
  const perWeek=weeks.map(wk=>WORKOUTS.filter(w=>isoWeek(new Date(w.date+'T12:00'))===wk));
  const mx=Math.max(3,...perWeek.map(a=>a.length));
  $('g-history').innerHTML=`<div class="panel"><div class="ph"><span class="tag">workouts per week</span><span>${WORKOUTS.length} logged</span></div><div class="pb"><div class="wkbars">${perWeek.map((a,i)=>`<div class="d"><span class="p num">${a.length||''}</span><div class="b" style="height:${a.length/mx*100}%"></div><span class="l">${weeks[i].slice(-3).toLowerCase()}</span></div>`).join('')}</div></div></div>
  <div class="wlist">${WORKOUTS.map(wCard).join('')||'<div class="dim">Finished workouts show up here.</div>'}</div>`;
  if(FX)$('g-history').querySelectorAll('.wkbars .b').forEach((b,i)=>b.animate([{transform:'scaleY(0)'},{transform:'scaleY(1)'}],{duration:600,delay:i*50,easing:'cubic-bezier(.2,.9,.1,1)',fill:'backwards'}));
}
$('v-gym').addEventListener('click',e=>{const c=e.target.closest('.wcard[data-w]');if(!c||e.target.closest('button'))return;openWorkout(c.dataset.w)});
function openWorkout(id){const w=WORKOUTS.find(x=>x.id===id);if(!w)return;
  openSheet(w.name,`<div class="dim" style="margin-bottom:10px">${esc(nice(w.date))}${w.endedAt&&w.startedAt?' · '+fmtDur(new Date(w.endedAt)-new Date(w.startedAt)):''} · ${Math.round(w.vol||stats(w).vol).toLocaleString('en-GB')} kg</div>
  ${(w.ex||[]).map(x=>`<div class="hx"><b>${esc(x.n)}</b>${x.note?`<span class="dim"> · ${esc(x.note)}</span>`:''}<div class="hsets">${x.sets.map((s,i)=>`<span class="set t-${s.t||'n'}">${setLabel(x.sets,i)} · ${kgs(s.kg)}kg × ${s.r}</span>`).join('')}</div></div>`).join('')}
  ${(w.prs||[]).length?`<div class="prlist">${w.prs.map(p=>`<div><span class="pink">PR</span> ${esc(p.n)} · ${esc(p.kind)} <b class="num">${p.v}</b></div>`).join('')}</div>`:''}
  <div class="bigbtns" style="margin-top:14px"><button class="btn d" type="button" id="wDel">delete</button><span style="flex:1"></span><button class="btn" type="button" id="wRoutine">save as routine</button><button class="btn p" type="button" id="wRepeat">repeat</button></div>`);
  $('wDel').onclick=function(){if(this.dataset.arm){removeDoc('gym/w-'+w.id);WORKOUTS=WORKOUTS.filter(x=>x.id!==w.id);closeSheet();renderGym()}else{this.dataset.arm=1;this.textContent='tap again'}};
  $('wRoutine').onclick=()=>{ROUTINES.list.push({id:rid(),name:w.name,ex:w.ex.map(x=>({n:x.n,sets:x.sets.length,rest:x.rest??120,note:x.note||''}))});save('gym/routines',ROUTINES);closeSheet();flash('saved')};
  $('wRepeat').onclick=()=>{if(ACTIVE){flash('finish_current_first');return}closeSheet();GYMV='workout';startWorkout({id:null,name:w.name,ex:w.ex.map(x=>({n:x.n,sets:x.sets.length,rest:x.rest??120}))})};
}
function renderLibrary(){
  const used=new Map();WORKOUTS.forEach(w=>(w.ex||[]).forEach(x=>used.set(norm(x.n),(used.get(norm(x.n))||0)+1)));
  const list=allEx().sort((a,b)=>(used.get(norm(b.name))||0)-(used.get(norm(a.name))||0)||a.name.localeCompare(b.name));
  $('g-exercises').innerHTML=`<input class="inp" id="libQ" placeholder="search" style="margin-bottom:10px"><div class="picklist" id="libList">${list.map(e=>`<button class="pick" type="button" data-lib="${esc(e.name)}"><span>${esc(e.name)}</span><span class="dim">${used.get(norm(e.name))?used.get(norm(e.name))+'× · ':''}${esc(e.muscle)}</span></button>`).join('')}</div>`;
  $('libQ').oninput=e=>{const q=norm(e.target.value);$('libList').querySelectorAll('.pick').forEach(b=>b.hidden=q&&!norm(b.dataset.lib).includes(q))};
  $('libList').onclick=e=>{const b=e.target.closest('[data-lib]');if(b)openExercise(b.dataset.lib)};
}
function openExercise(n){
  const h=exHistory(n).reverse();const info=exInfo(n);
  const pts=h.map(o=>Math.max(...o.x.sets.filter(s=>s.t!=='w').map(e1),0)).filter(v=>v>0);
  const b=bests(n);
  openSheet(n,`<div class="dim" style="margin-bottom:10px">${esc(info.muscle)}${info.equip?' · '+esc(info.equip):''}</div>
  <div class="wstats big"><div><span class="dim">heaviest</span><b class="num">${b.kg?kgs(b.kg)+' kg':'—'}</b></div><div><span class="dim">best e1RM</span><b class="num">${b.e?kgs(Math.round(b.e*10)/10)+' kg':'—'}</b></div><div><span class="dim">sessions</span><b class="num">${h.length}</b></div></div>
  <div style="margin:12px 0">${spark(pts,{h:140,labels:h.length?[nice(h[0].w.date),nice(h[h.length-1].w.date)]:null})}</div>
  ${h.slice().reverse().slice(0,12).map(o=>`<div class="hx"><span class="dim">${esc(nice(o.w.date))}</span><div class="hsets">${o.x.sets.filter(s=>s.done!==false).map((s,i)=>`<span class="set t-${s.t||'n'}">${kgs(s.kg)}kg × ${s.r}</span>`).join('')}</div></div>`).join('')||'<div class="dim">No sets logged yet.</div>'}`);
}

/* --- bottom sheet used by gym + journal --- */
let sheetStack=0;
function openSheet(title,html){$('sheetTitle').textContent=title;$('sheetBody').innerHTML=html;$('sheetBody').oninput=null;$('sheetBody').onclick=null;$('sheetBody').onchange=null;$('sheet').classList.add('on');$('sheet').setAttribute('aria-hidden','false');$('scrim').classList.add('on');sheetStack=1}
function closeSheet(){$('sheet').classList.remove('on');$('sheet').setAttribute('aria-hidden','true');if(!$('drawer').classList.contains('on'))$('scrim').classList.remove('on');sheetStack=0}
$('sheetX').onclick=closeSheet;

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
  $('wtStat').innerHTML=w.length?`<div><b class="num">${w[w.length-1].kg.toFixed(1)}</b><span>latest kg</span></div><div><b class="num">${w7.length?avg(w7.map(x=>x.kg)).toFixed(1):'–'}</b><span>7-day average</span></div>${old.length?`<div><b class="num ${w[w.length-1].kg-old[old.length-1].kg<=0?'ok':'pink'}">${(w[w.length-1].kg-old[old.length-1].kg>0?'+':'')+(w[w.length-1].kg-old[old.length-1].kg).toFixed(1)}</b><span>vs 4+ weeks ago</span></div>`:''}`:'';
  $('wtChart').innerHTML=spark(w.map(x=>x.kg),{labels:w.length?[fmtTs(w[0].t),fmtTs(w[w.length-1].t)]:null});
  $('wtList').innerHTML=WT.r.slice().reverse().slice(0,40).map(x=>`<div><span>${fmtTs(x.t)}</span><span class="num">${x.kg.toFixed(1)} kg</span><button type="button" data-rwt="${esc(x.t)}" aria-label="Delete entry">✕</button></div>`).join('');
}
async function loadBody(){BP={r:[],...(await load('body/bp')||{})};WT={r:[],...(await load('body/wt')||{})};renderBody()}
$('bpForm').onsubmit=e=>{e.preventDefault();const s=+$('bpS').value,d=+$('bpD').value,p=+$('bpP').value||null;if(!s||!d)return;BP.r.push({t:new Date().toISOString(),s,d,p});BP.r=BP.r.slice(-500);save('body/bp',BP);$('bpForm').reset();renderBody();burstEl($('bpChart'),40);autoTick(/^Blood pressure/)};
$('wtForm').onsubmit=e=>{e.preventDefault();const kg=+$('wtIn').value;if(!kg)return;WT.r.push({t:new Date().toISOString(),kg});WT.r=WT.r.slice(-800);save('body/wt',WT);$('wtForm').reset();renderBody();burstEl($('wtChart'),40)};
$('bpList').onclick=e=>{const b=e.target.closest('[data-rbp]');if(!b)return;BP.r=BP.r.filter(x=>x.t!==b.dataset.rbp);save('body/bp',BP);renderBody()};
$('wtList').onclick=e=>{const b=e.target.closest('[data-rwt]');if(!b)return;WT.r=WT.r.filter(x=>x.t!==b.dataset.rwt);save('body/wt',WT);renderBody()};


/* ================= TOOLS ================= */
let lc=0,WK=isoWeek(logical()),SET={water:8},TRK={list:[]};
function renderTools(){
  // water
  const wt=SET.water||8;$('waterN').textContent=DAY.water||0;$('waterPips').innerHTML=Array.from({length:Math.max(wt,DAY.water||0)},(_,i)=>`<i class="${i<(DAY.water||0)?'f':''}"></i>`).join('');
  // messages
  const slots=['08:50','12:45','17:00'];const used=slots.filter(s=>DAY.msg&&DAY.msg[s]).length;$('msgN').textContent=`${used}/3`;
  $('msgs').innerHTML=slots.map(s=>`<button type="button" data-msg="${s}" aria-pressed="${!!(DAY.msg&&DAY.msg[s])}">${s}</button>`).join('');
  // deep work
  const dw=DAY.dw||0;$('dwToday').textContent=`today ${Math.floor(dw/60)}h${pad(dw%60)}`;$('dwLbl').textContent=`deep work today · ${Math.floor(dw/60)}h ${pad(dw%60)}m of 4h 20m`;$('dwBar').style.width=Math.min(100,dw/260*100)+'%';
  $('toolsSub').textContent=nice(DAYK).toLowerCase();
  renderTrackers();
}
$('waterAdd').onclick=e=>{DAY.water=(DAY.water||0)+1;persistDay();renderTools();burstEl(e.target,20);if(DAY.water===(SET.water||8)){flash('hydrated');autoTick(/^Hydration/)}};
$('waterSub').onclick=()=>{DAY.water=Math.max(0,(DAY.water||0)-1);persistDay();renderTools()};
$('waterTgtEd').onclick=()=>openEditor({title:'water target',fields:[{k:'water',label:'glasses / day',type:'num'}],values:{water:SET.water||8},onSave:v=>{SET.water=Math.max(1,Math.round(+v.water||8));save('tools/settings',SET);renderTools()}});
$('msgs').onclick=e=>{const b=e.target.closest('[data-msg]');if(!b)return;DAY.msg={...(DAY.msg||{})};DAY.msg[b.dataset.msg]=!DAY.msg[b.dataset.msg];persistDay();renderTools();if(DAY.msg[b.dataset.msg]){burstEl(b,20);autoTick(new RegExp('check '+(['08:50','12:45','17:00'].indexOf(b.dataset.msg)+1)+' of 3'))}};
// leetcode
function drawLc(){$('lcNum').textContent=lc;$('lcNum').className='timer num'+(lc>=8?' run':'');$('slots').innerHTML=Array.from({length:Math.max(8,lc)},(_,i)=>`<i class="${i<lc?'f':''}"></i>`).join('');$('lcWeek').textContent=WK}
$('lcAdd').onclick=e=>{lc++;drawLc();save('weeks/w-'+WK,{...(WEEK||{}),lc});WEEK={...(WEEK||{}),lc};burstEl(e.target,40);if(lc===8){flash('target_hit');shake()}};
$('lcSub').onclick=()=>{lc=Math.max(0,lc-1);drawLc();WEEK={...(WEEK||{}),lc};save('weeks/w-'+WK,WEEK)};
// focus timer
let TM=LS.get('timer')||{len:90,end:null,left:90*60};
function tmLeft(){return TM.end?Math.max(0,Math.round((TM.end-Date.now())/1000)):TM.left}
function logDw(minutes){if(minutes<1)return;DAY.dw=(DAY.dw||0)+minutes;persistDay();renderTools()}
function drawTimer(){const l=tmLeft();$('timer').textContent=pad(Math.floor(l/60))+':'+pad(l%60);$('timer').className='timer num'+(TM.end?' run':'');$('tmGo').textContent=TM.end?'pause':(l<TM.len*60?'resume':'start');$('tmBar').style.width=(100-l/(TM.len*60)*100)+'%';
  $('tmPresets').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.m===TM.len));
  if(TM.end&&l===0){logDw(TM.len);TM={len:TM.len,end:null,left:TM.len*60};LS.set('timer',TM);flash('block_done');shake();burst(innerWidth/2,innerHeight/2,160,true)}}
$('tmGo').onclick=()=>{if(TM.end){TM.left=tmLeft();TM.end=null}else{TM.end=Date.now()+TM.left*1000}LS.set('timer',TM);drawTimer();glitchAll()};
$('tmReset').onclick=()=>{const done=Math.floor((TM.len*60-tmLeft())/60);logDw(done);TM={len:TM.len,end:null,left:TM.len*60};LS.set('timer',TM);drawTimer()};
$('tmPresets').onclick=e=>{const b=e.target.closest('button');if(!b)return;TM={len:+b.dataset.m,end:null,left:+b.dataset.m*60};LS.set('timer',TM);drawTimer()};
setInterval(drawTimer,1000);
// trackers
function trkState(t){const today=DAYK;
  if(t.kind==='interval'){if(!t.last)return {txt:'not started',cls:'due',sub:'tap done when you next take it'};const nxt=addDays(t.last,t.every);const d=daysBetween(today,nxt);
    return {txt:d<0?`overdue ${-d}d`:d===0?'due today':d===1?'due tomorrow':`due in ${d}d`,cls:d<0?'over':d===0?'due':'',sub:`every ${t.every} day${t.every>1?'s':''} · last ${nice(t.last).toLowerCase()} · next ${nice(nxt).toLowerCase()}`,bar:Array.from({length:t.every},(_,i)=>i<Math.min(t.every,daysBetween(t.last,today))?'on':'')}}
  const L2=(t.on+t.off)*7;const d=daysBetween(t.start,today);if(d<0)return {txt:'starts '+nice(t.start).toLowerCase(),cls:'offc',sub:''};const pos=d%L2;const on=pos<t.on*7;const cyc=Math.floor(d/L2)+1;
  const wkN=Math.floor((on?pos:pos-t.on*7)/7)+1;const left=on?t.on*7-pos:L2-pos;
  return {txt:on?`ON · week ${wkN}/${t.on}`:`OFF · week ${wkN}/${t.off}`,cls:on?'due':'offc',sub:`cycle ${cyc} · ${on?'off':'on'} in ${left}d (${nice(addDays(today,left)).toLowerCase()})`,bar:Array.from({length:t.on+t.off},(_,i)=>(i<t.on?'on':'off')+(Math.floor(pos/7)===i?' now':''))}}
function renderTrackers(){
  $('trackers').innerHTML=TRK.list.map(t=>{const s=trkState(t);return `<div class="trk"><div class="top2"><b>${esc(t.name)}</b><span class="row" style="gap:6px"><button class="iconbtn" type="button" data-tedit="${t.id}" title="Edit">✎</button><button class="iconbtn" type="button" data-tdel="${t.id}" title="Delete">✕</button></span></div><span class="st2 ${s.cls}">${esc(s.txt)}</span>${s.bar?`<div class="bar2">${s.bar.map(c=>`<i class="${c}"></i>`).join('')}</div>`:''}<span class="dim" style="font-size:12px">${esc(s.sub)}</span>${t.kind==='interval'?`<div class="bigbtns" style="margin-top:4px"><button class="btn p" type="button" data-tdone="${t.id}">done today</button></div>`:''}</div>`}).join('')||'<div class="dim" style="font-size:12px">Nothing tracked yet. Add one from your plan below.</div>';
  const have=new Set(TRK.list.map(t=>norm(t.name)));
  const sugg=[];M.plans.weekday.forEach(b=>b.items.forEach(i=>{const s=String(i.sched||'')+' '+String(i.notes||'');let m;
    if(have.has(norm(i.item))||sugg.some(x=>x.name===i.item))return;
    if((m=s.match(/Every (\d+) days/i)))sugg.push({name:i.item,kind:'interval',every:+m[1]});
    else if(/\bWeekly\b/.test(i.sched||'')&&CMP.has(i.type))sugg.push({name:i.item,kind:'interval',every:7});
    else if(/\bEOD\b/.test(i.sched||'')&&CMP.has(i.type))sugg.push({name:i.item,kind:'interval',every:2});
    if((m=s.match(/(\d+)-week cycles? (\d+) off/i)))sugg.push({name:i.item,kind:'cycle',on:+m[1],off:+m[2]});
    else if((m=s.match(/(\d+)-week cycle/i)))sugg.push({name:i.item,kind:'cycle',on:+m[1],off:0})}));
  $('trkSugg').innerHTML=sugg.map((s,i)=>`<button class="chip" type="button" data-sg="${i}">+ ${esc(s.name)} <span class="c">${s.kind==='interval'?'every '+s.every+'d':s.on+' on / '+s.off+' off'}</span></button>`).join('')+`<button class="chip" type="button" data-sg="custom">+ custom</button>`;
  $('trkSugg').onclick=e=>{const b=e.target.closest('[data-sg]');if(!b)return;const s=b.dataset.sg==='custom'?{name:'',kind:'interval',every:7}:sugg[+b.dataset.sg];editTracker({...s,id:rid(),last:null,start:DAYK},true)};
}
function editTracker(t,isNew){
  const F=t.kind==='interval'?[{k:'name'},{k:'every',label:'every N days',type:'num'},{k:'last',label:'last done',ph:'YYYY-MM-DD'}]:[{k:'name'},{k:'on',label:'weeks on',type:'num'},{k:'off',label:'weeks off',type:'num'},{k:'start',label:'cycle started',ph:'YYYY-MM-DD'}];
  openEditor({title:(isNew?'track · ':'edit · ')+(t.kind==='interval'?'interval':'cycle'),fields:F,values:t,isNew,hint:'Kept on this dashboard only; it is not written to the Excel sheet.',
    onSave:v=>{const n={...t,...v};if(n.kind==='interval')n.every=Math.max(1,Math.round(+n.every||1));else{n.on=Math.max(1,Math.round(+n.on||1));n.off=Math.max(0,Math.round(+n.off||0))}
      if(n.last&&!/^\d{4}-\d{2}-\d{2}$/.test(n.last))n.last=null;if(n.start&&!/^\d{4}-\d{2}-\d{2}$/.test(n.start))n.start=DAYK;
      const i=TRK.list.findIndex(x=>x.id===n.id);if(i>=0)TRK.list[i]=n;else TRK.list.push(n);save('tools/trackers',TRK);renderTrackers()},
    onDelete:isNew?null:()=>{TRK.list=TRK.list.filter(x=>x.id!==t.id);save('tools/trackers',TRK);renderTrackers()}});
}
$('trackers').onclick=e=>{const d=e.target.closest('[data-tdone]');if(d){const t=TRK.list.find(x=>x.id===d.dataset.tdone);t.last=DAYK;save('tools/trackers',TRK);renderTrackers();burstEl(d,40);flash('logged');autoTick(new RegExp('^'+t.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));return}
  const dl=e.target.closest('[data-tdel]');if(dl){const t=TRK.list.find(x=>x.id===dl.dataset.tdel);if(t&&dl.dataset.arm){TRK.list=TRK.list.filter(x=>x.id!==t.id);save('tools/trackers',TRK);renderTrackers();glitchAll()}else if(t){dl.dataset.arm=1;dl.textContent='delete?';setTimeout(()=>{if(dl.isConnected){delete dl.dataset.arm;dl.textContent='✕'}},2500)}return}
  const ed=e.target.closest('[data-tedit]');if(ed)editTracker(TRK.list.find(x=>x.id===ed.dataset.tedit))};
async function loadTools(){SET={water:8,...(await load('tools/settings')||{})};TRK={list:[],...(await load('tools/trackers')||{})};WEEK=await load('weeks/w-'+WK)||{};lc=WEEK.lc||0;drawLc();renderTools();drawTimer()}


/* ================= JOURNAL (typing + Apple Pencil) ================= */
const PAGE_W=1000,PAGE_H=1400;
const MOODS=[['1','awful'],['2','low'],['3','okay'],['4','good'],['5','great']];
const PROMPTS=[['woop','WOOP\nWish: \nOutcome: \nObstacle: \nPlan (if…then…): '],['wins','3 wins today\n1. \n2. \n3. '],['grat','Grateful for\n- '],['tmrw','Tomorrow, the one thing that matters: ']];
let JDATE=null,JE=null,JLIST=[],jmode=LS.get('jmode')||'type',jtool='pen',jcolor='#e6e6e6',jwidth=4,pencilOnly=LS.get('pencilOnly')||false,jundo=[],jredo=[],jSaveT=null,jLoaded=false;
const jpath=d=>'journal/e-'+d;
async function loadJournal(){
  if(!JDATE)JDATE=DAYK;
  const rows=await listDocs('journal/e-');JLIST=rows.map(r=>r.data).filter(Boolean).sort((a,b)=>a.date<b.date?1:-1);
  await openEntry(JDATE);jLoaded=true;
}
watchPrefix('journal/e-',(evt,path,data)=>{const d=path.slice(10);JLIST=JLIST.filter(x=>x.date!==d);if(evt!=='DELETE'&&data)JLIST.push(data);JLIST.sort((a,b)=>a.date<b.date?1:-1);
  if(cur==='journal'){renderJList();if(d===JDATE&&data&&!jDirty){JE=data;renderJEditor(true)}}});
let jDirty=false;
async function openEntry(d){JDATE=d;const e=await load(jpath(d));JE=e||{date:d,text:'',mood:null,tags:[],ink:{h:PAGE_H,strokes:[]}};if(!JE.ink)JE.ink={h:PAGE_H,strokes:[]};jundo=[];jredo=[];renderJList();renderJEditor()}
function saveJ(){jDirty=true;clearTimeout(jSaveT);$('jSaved').textContent='…';jSaveT=setTimeout(()=>{JE.updatedAt=new Date().toISOString();const empty=!JE.text&&!JE.mood&&!(JE.tags||[]).length&&!JE.ink.strokes.length;
  if(empty)removeDoc(jpath(JE.date));else save(jpath(JE.date),JE,true);
  JLIST=JLIST.filter(x=>x.date!==JE.date);if(!empty)JLIST.push(clone(JE));JLIST.sort((a,b)=>a.date<b.date?1:-1);renderJList();$('jSaved').textContent='saved';jDirty=false},700)}
function renderJList(){
  const q=norm($('jQ').value);
  const days=new Set(JLIST.map(e=>e.date));
  const items=JLIST.filter(e=>!q||norm(e.text).includes(q)||(e.tags||[]).some(t=>norm(t).includes(q)));
  $('jList').innerHTML=(days.has(DAYK)||q?'':`<button type="button" class="jitem${JDATE===DAYK?' on':''}" data-jd="${DAYK}"><span class="jd">${esc(nice(DAYK).toLowerCase())}</span><span class="dim">today · not written yet</span></button>`)+
    items.map(e=>`<button type="button" class="jitem${e.date===JDATE?' on':''}" data-jd="${e.date}"><span class="jd">${esc(nice(e.date).toLowerCase())}${e.mood?`<i class="mood m${e.mood}"></i>`:''}${e.ink&&e.ink.strokes&&e.ink.strokes.length?'<span class="dim"> ✎</span>':''}</span><span class="dim jprev">${esc((e.text||'').split('\n').find(l=>l.trim())||(e.ink&&e.ink.strokes.length?'handwritten':''))}</span>${(e.tags||[]).length?`<span class="jtags">${e.tags.map(t=>'#'+esc(t)).join(' ')}</span>`:''}</button>`).join('')||'<div class="dim" style="font-size:12px;padding:8px">Nothing found.</div>';
  const streak=(()=>{let n=0;const d=new Date(logical());for(;;){if(days.has(ymd(d))){n++;d.setDate(d.getDate()-1)}else if(ymd(d)===DAYK){d.setDate(d.getDate()-1)}else break}return n})();
  $('jStreak').textContent=`${JLIST.length} entries · ${streak} day streak`;
}
$('jQ').oninput=renderJList;
$('jList').onclick=e=>{const b=e.target.closest('[data-jd]');if(b){flushJ();openEntry(b.dataset.jd);if(innerWidth<900)$('jEditor').scrollIntoView({behavior:FX?'smooth':'auto'})}};
function flushJ(){if(jSaveT){clearTimeout(jSaveT);jSaveT=null;JE.updatedAt=new Date().toISOString();save(jpath(JE.date),JE,true);jDirty=false}}
function renderJEditor(keepScroll){
  $('jDate').textContent=new Date(JDATE+'T12:00').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'}).toLowerCase();
  $('jMood').innerHTML=MOODS.map(([v,l])=>`<button type="button" data-mood="${v}" aria-pressed="${String(JE.mood)===v}" title="${l}"><i class="mood m${v}"></i><span>${l}</span></button>`).join('');
  $('jTags').innerHTML=(JE.tags||[]).map((t,i)=>`<span class="jtag">#${esc(t)}<button type="button" data-rmtag="${i}" aria-label="Remove tag">✕</button></span>`).join('')+`<input class="jtagin" id="jTagIn" placeholder="+ tag" aria-label="Add tag">`;
  $('jText').value=JE.text||'';autoGrow();
  $('jModeSeg').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.jm===jmode));
  $('jTypePane').hidden=jmode!=='type';$('jInkPane').hidden=jmode!=='ink';
  $('jWords').textContent=((JE.text||'').trim().match(/\S+/g)||[]).length+' words';
  $('jPencil').setAttribute('aria-pressed',pencilOnly);$('jCanvasWrap').classList.toggle('pencil',pencilOnly);
  $('jTools').querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.tool===jtool));
  $('jTools').querySelectorAll('[data-col]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.col===jcolor));
  $('jSaved').textContent=JE.updatedAt?'saved '+ago(JE.updatedAt):'';
  if(jmode==='ink')sizeInk();
}
$('jPrev').onclick=()=>{flushJ();openEntry(addDays(JDATE,-1))};
$('jNext').onclick=()=>{flushJ();openEntry(addDays(JDATE,1))};
$('jToday').onclick=()=>{flushJ();openEntry(DAYK)};
$('jMood').onclick=e=>{const b=e.target.closest('[data-mood]');if(!b)return;JE.mood=JE.mood===+b.dataset.mood?null:+b.dataset.mood;saveJ();renderJEditor();burstEl(b,18)};
$('jTags').onclick=e=>{const b=e.target.closest('[data-rmtag]');if(b){JE.tags.splice(+b.dataset.rmtag,1);saveJ();renderJEditor()}};
$('jTags').onkeydown=e=>{if(e.target.id!=='jTagIn')return;if(e.key==='Enter'||e.key===','){e.preventDefault();const v=e.target.value.trim().replace(/^#/,'');if(v){JE.tags=[...(JE.tags||[]),v];saveJ();renderJEditor();$('jTagIn').focus()}}};
function autoGrow(){const t=$('jText');t.style.height='auto';t.style.height=Math.max(260,t.scrollHeight)+'px'}
$('jText').oninput=()=>{JE.text=$('jText').value;autoGrow();$('jWords').textContent=((JE.text||'').trim().match(/\S+/g)||[]).length+' words';saveJ()};
$('jPrompts').innerHTML=PROMPTS.map(([k])=>`<button class="chip" type="button" data-pr="${k}">${k==='woop'?'WOOP':k==='wins'?'3 wins':k==='grat'?'grateful for':'tomorrow'}</button>`).join('');
$('jPrompts').onclick=e=>{const b=e.target.closest('[data-pr]');if(!b)return;const p=PROMPTS.find(x=>x[0]===b.dataset.pr)[1];JE.text=(JE.text?JE.text.replace(/\s*$/,'')+'\n\n':'')+p;jmode='type';LS.set('jmode',jmode);renderJEditor();const t=$('jText');t.focus();t.setSelectionRange(t.value.length,t.value.length);saveJ();if(b.dataset.pr==='woop')autoTick(/^WOOP/)};
$('jModeSeg').onclick=e=>{const b=e.target.closest('[data-jm]');if(!b)return;jmode=b.dataset.jm;LS.set('jmode',jmode);renderJEditor();glitchAll()};

/* --- handwriting canvas --- */
const jc=$('jCanvas'),jx=jc.getContext('2d');let jscale=1,drawing=null;
function sizeInk(){const w=$('jCanvasWrap').clientWidth||600;jscale=w/PAGE_W;const h=(JE.ink.h||PAGE_H)*jscale;const r=devicePixelRatio||1;jc.width=Math.round(w*r);jc.height=Math.round(h*r);jc.style.width=w+'px';jc.style.height=h+'px';jx.setTransform(r*jscale,0,0,r*jscale,0,0);redrawInk()}
function redrawInk(){jx.save();jx.setTransform(1,0,0,1,0,0);jx.clearRect(0,0,jc.width,jc.height);jx.restore();
  // ruled lines
  jx.strokeStyle='rgba(255,255,255,.06)';jx.lineWidth=1/jscale;for(let y=80;y<(JE.ink.h||PAGE_H);y+=56){jx.beginPath();jx.moveTo(40,y);jx.lineTo(PAGE_W-40,y);jx.stroke()}
  jx.strokeStyle='rgba(255,42,109,.18)';for(let y=PAGE_H;y<(JE.ink.h||PAGE_H);y+=PAGE_H){jx.setLineDash([8,8]);jx.beginPath();jx.moveTo(0,y);jx.lineTo(PAGE_W,y);jx.stroke();jx.setLineDash([])}
  JE.ink.strokes.forEach(drawStroke)}
function drawStroke(s){const p=s.pts;if(p.length<3)return;jx.save();jx.lineCap='round';jx.lineJoin='round';jx.strokeStyle=s.c;
  if(s.t==='hl'){jx.globalAlpha=.32;jx.lineWidth=s.w*4;jx.beginPath();jx.moveTo(p[0],p[1]);for(let i=3;i<p.length;i+=3)jx.lineTo(p[i],p[i+1]);jx.stroke();jx.restore();return}
  for(let i=3;i<p.length;i+=3){const pr=(p[i+2]+p[i-1])/2;jx.lineWidth=Math.max(.6,s.w*(.35+pr*1.1));jx.beginPath();
    const mx0=i>=6?(p[i-6]+p[i-3])/2:p[i-3],my0=i>=6?(p[i-5]+p[i-2])/2:p[i-2];const mx1=(p[i-3]+p[i])/2,my1=(p[i-2]+p[i+1])/2;
    jx.moveTo(mx0,my0);jx.quadraticCurveTo(p[i-3],p[i-2],mx1,my1);jx.stroke()}
  if(p.length===3){jx.fillStyle=s.c;jx.beginPath();jx.arc(p[0],p[1],s.w/2,0,7);jx.fill()}jx.restore()}
function ptOf(e){const r=jc.getBoundingClientRect();return [Math.round((e.clientX-r.left)/jscale*10)/10,Math.round((e.clientY-r.top)/jscale*10)/10,Math.round((e.pointerType==='mouse'?.5:(e.pressure||.5))*100)/100]}
jc.addEventListener('pointerdown',e=>{
  if(e.pointerType==='pen'&&!pencilOnly){pencilOnly=true;LS.set('pencilOnly',true);$('jPencil').setAttribute('aria-pressed',true);$('jCanvasWrap').classList.add('pencil')}
  if(pencilOnly&&e.pointerType==='touch')return;
  e.preventDefault();jc.setPointerCapture(e.pointerId);
  if(jtool==='eraser'){drawing={erase:true};eraseAt(ptOf(e));return}
  drawing={c:jcolor,w:jtool==='hl'?jwidth*1.5:jwidth,t:jtool==='hl'?'hl':'pen',pts:ptOf(e)};
});
jc.addEventListener('pointermove',e=>{if(!drawing)return;if(pencilOnly&&e.pointerType==='touch')return;e.preventDefault();
  let evs=e.getCoalescedEvents?e.getCoalescedEvents():[];if(!evs.length)evs=[e];
  for(const ev of evs){const p=ptOf(ev);if(drawing.erase){eraseAt(p);continue}const n=drawing.pts.length;if(Math.hypot(p[0]-drawing.pts[n-3],p[1]-drawing.pts[n-2])<1.2)continue;drawing.pts.push(...p);
    const s={...drawing,pts:drawing.pts.slice(-9)};drawStroke(s)}
  // grow the page as you write near the bottom
  if(!drawing.erase){const y=drawing.pts[drawing.pts.length-2];if(y>(JE.ink.h||PAGE_H)-120){JE.ink.h=(JE.ink.h||PAGE_H)+PAGE_H;sizeInk()}}
});
function endStroke(){if(!drawing)return;if(!drawing.erase){JE.ink.strokes.push(drawing);jundo.push({add:drawing});jredo=[]}drawing=null;redrawInk();saveJ()}
jc.addEventListener('pointerup',endStroke);jc.addEventListener('pointercancel',endStroke);
function eraseAt(p){const r=14;const before=JE.ink.strokes.length;const keep=[];JE.ink.strokes.forEach(s=>{let hit=false;for(let i=0;i<s.pts.length;i+=3){if(Math.hypot(s.pts[i]-p[0],s.pts[i+1]-p[1])<r+s.w){hit=true;break}}if(hit)jundo.push({del:s});else keep.push(s)});if(keep.length!==before){JE.ink.strokes=keep;redrawInk()}}
$('jTools').onclick=e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.tool){jtool=b.dataset.tool;renderJEditor();return}
  if(b.dataset.col){jcolor=b.dataset.col;if(jtool==='eraser')jtool='pen';renderJEditor();return}
  if(b.id==='jUndo'){const u=jundo.pop();if(!u)return;if(u.add)JE.ink.strokes=JE.ink.strokes.filter(s=>s!==u.add);if(u.del)JE.ink.strokes.push(u.del);jredo.push(u);redrawInk();saveJ();return}
  if(b.id==='jRedo'){const u=jredo.pop();if(!u)return;if(u.add)JE.ink.strokes.push(u.add);if(u.del)JE.ink.strokes=JE.ink.strokes.filter(s=>s!==u.del);jundo.push(u);redrawInk();saveJ();return}
  if(b.id==='jPage'){JE.ink.h=(JE.ink.h||PAGE_H)+PAGE_H;sizeInk();saveJ();return}
  if(b.id==='jClear'){if(b.dataset.arm){jundo.push(...JE.ink.strokes.map(s=>({del:s})));JE.ink.strokes=[];JE.ink.h=PAGE_H;sizeInk();saveJ();delete b.dataset.arm;b.textContent='clear'}else{b.dataset.arm=1;b.textContent='tap again';setTimeout(()=>{delete b.dataset.arm;b.textContent='clear'},2500)}return}
  if(b.id==='jPencil'){pencilOnly=!pencilOnly;LS.set('pencilOnly',pencilOnly);renderJEditor();return}
};
$('jWidth').oninput=e=>{jwidth=+e.target.value};
addEventListener('resize',()=>{if(cur==='journal'&&jmode==='ink')sizeInk()});

/* ================= WEEK ================= */
let WEEK={};
const HABITS=[['wake',/^Wake$/],['daylight',/^Morning daylight/],['woop',/^WOOP/],['leetcode',/^LeetCode/],['gym',/^Gym\b/],['lights out',/^Lights out/],['bp check',/^Blood pressure/],['red light',/^Red light/]];
async function renderWeek(){
  const L0=logical();const ds=[];for(let i=29;i>=0;i--){const d=new Date(L0);d.setDate(d.getDate()-i);ds.push(d)}
  const docs=await Promise.all(ds.map(d=>ymd(d)===DAYK?Promise.resolve(DAY):load('days/d-'+ymd(d))));
  const last7=ds.slice(-7),v7=docs.slice(-7);
  $('days').innerHTML=`<div class="line80" style="bottom:${21+0.8*130}px"></div>`+last7.map((d,i)=>{const v=v7[i];const p=v&&v.total?Math.round(v.done/v.total*100):null;return `<div class="d"><span class="p num ${p!==null&&p>=80?'ok':''}">${p===null?'–':p+'%'}</span>${p===null?'':`<div class="b ${p<80?'low':''}" style="height:${p*1.3}px"></div>`}<span class="l">${DOW[d.getDay()].toLowerCase()}</span></div>`}).join('');
  if(FX)document.querySelectorAll('#days .b').forEach((b,i)=>b.animate([{transform:'scaleY(0)'},{transform:'scaleY(1)'}],{duration:500,delay:i*60,easing:'cubic-bezier(.2,.9,.1,1)',fill:'backwards'}));
  const logged=v7.filter(v=>v&&v.total).length;$('daysNote').textContent=logged<2?'Fills in as you tick items on the today view.':`${logged} of 7 days logged · avg ${Math.round(avg(v7.filter(v=>v&&v.total).map(v=>v.done/v.total*100)))}%`;
  // streaks
  $('streaks').innerHTML=HABITS.map(([lbl,re])=>{
    const marks=ds.map((d,i)=>{const doc=docs[i];const dow=DOW[d.getDay()];const kind=(doc&&doc.plan)||((dow==='Sat'||dow==='Sun')?'weekend':'weekday');
      const sched=M.plans[kind].some(b=>b.items.some(it=>re.test(it.item)&&(!it.days||it.days.has(dow))));if(!sched)return 's';
      if(!doc||!doc.names)return ymd(d)===DAYK?'p':'u';return doc.names.some(n=>re.test(n))?'y':(ymd(d)===DAYK?'p':'n')});
    let st=0;for(let i=marks.length-1;i>=0;i--){const m=marks[i];if(m==='y')st++;else if(m==='s'||m==='p')continue;else break}
    const hit=marks.filter(m=>m==='y').length,sch=marks.filter(m=>m==='y'||m==='n').length;
    return `<div class="streak"><span class="tag dim">${esc(lbl)}</span><b class="num ${st>=3?'hot':''}">${st}</b><span class="dim" style="font-size:11px">day streak · ${hit}/${sch} logged days</span><div class="dots">${marks.slice(-14).map(m=>`<i class="${m==='y'?'y':m==='n'?'n':''}"></i>`).join('')}</div></div>`}).join('');
  renderTargets();
  WEEK=await load('weeks/w-'+WK)||WEEK||{};if(document.activeElement!==$('weekNotes'))$('weekNotes').value=WEEK.notes||'';
  $('weekSub').textContent=`${WK} · review Sundays 19:00`;
}
function renderTargets(){$('targets').innerHTML=(M.targets||[]).map(r=>`<div class="tg2"><b>${esc(String(r.item||'').toLowerCase())}${r.edited?'<span class="delta">Δ</span>':''}</b><span>${esc(r.notes||'')}</span><button class="ed" type="button" data-tg="${esc(r.key)}">✎</button></div>`).join('')}
$('targets').onclick=e=>{const b=e.target.closest('[data-tg]');if(!b)return;const r=M.targets.find(x=>x.key===b.dataset.tg);editExtra('weekday',r)};
$('addTarget').onclick=()=>addExtra('weekday','DAILY TARGETS – review Sundays 19:00');
let notesT;$('weekNotes').oninput=()=>{clearTimeout(notesT);$('notesSaved').textContent='typing…';notesT=setTimeout(()=>{WEEK={...WEEK,notes:$('weekNotes').value,lc};save('weeks/w-'+WK,WEEK);$('notesSaved').textContent='saved'},700)};


/* ================= STACK ================= */
const STC={'Anabolic / Main':'#ff2a6d','Ancillaries':'#ffb000','Supplements':'#57f5a8','Peptides':'#05d9e8','Cognition / Anxiolytic':'#b18cff','Bloods & Supplies':'#7a7a7a'};
const STATUSL={active:'in plan',asneeded:'as needed',paused:'paused',notinplan:'not in plan'};
let stF='all',catF=null,sortK='monthly',sortD=-1;
const stFilter=k=>s=>k==='all'||(k==='inb'?s.inb:k==='opt'?!s.inb:k==='edited'?s.edited:s.status===k);
function renderStack(){
  const st=M.stack;const c=s=>st.filter(x=>x.status===s).length;
  $('stackSub').textContent=`${st.length} rows · Stack sheet · status from Day Plan v2`;
  $('stackKv').innerHTML=[['budget',gbp(M.stackBudget,2),'/month · in budget = Yes'],['live budget',gbp(M.liveBudget,2),'/month · minus paused in v2'],['optional',gbp(M.stackOpt,2),'/month · in budget = No'],['in plan',String(c('active')),`${c('asneeded')} as needed · ${c('paused')} paused`]]
    .map(([k,v,s],i)=>`<div class="panel"><div class="ph"><span class="tag">${k}</span></div><div class="pb"><span class="v num ${i===1?'pink':''}" data-scr="${esc(v)}">${v}</span><span class="s">${s}</span></div></div>`).join('');
  const pb=st.filter(s=>s.inb&&s.status==='paused'&&s.monthly>0);
  $('stackWarn').innerHTML=pb.length?`<div class="panel"><div class="pb warn" style="font-size:12px;display:flex;gap:12px;align-items:center;flex-wrap:wrap"><span style="flex:1;min-width:240px">⚠ ${pb.map(s=>esc(s.name)+' ('+gbp(s.monthly,2)+')').join(', ')} ${pb.length>1?'are':'is'} paused in Day Plan v2 but still in budget.</span><button class="btn p" type="button" id="fixPaused">set to not in budget</button></div></div>`:'';
  if(pb.length)$('fixPaused').onclick=()=>{pb.forEach(s=>{EDITS.p[s.key]={...(EDITS.p[s.key]||{}),inb:false,_was:s.name}});saveEdits();rebuild();flash('queued');};
  const sts=[['all','all'],['active','in plan'],['asneeded','as needed'],['paused','paused'],['notinplan','not in plan'],['inb','in budget'],['opt','optional'],['edited','edited Δ']];
  $('stChips').innerHTML=sts.map(([k,l])=>`<button class="chip" type="button" data-s="${k}" aria-pressed="${stF===k}">${l}<span class="c">${st.filter(stFilter(k)).length}</span></button>`).join('');
  $('catChips').innerHTML=STACK_CATS.map(cc=>`<button class="chip" type="button" data-c="${esc(cc)}" aria-pressed="${catF===cc}"><i style="background:${STC[cc]}"></i>${esc(cc.split(' / ')[0].toLowerCase())}<span class="c">${st.filter(s=>s.cat===cc).length}</span></button>`).join('');
  renderStackTbl();
}
function renderStackTbl(){
  const q=norm($('q').value);
  let rows=M.stack.filter(stFilter(stF)).filter(s=>!catF||s.cat===catF).filter(s=>!q||[s.name,s.dose,s.route,s.sched,s.notes,s.src,s.cat].some(x=>norm(x).includes(q)));
  rows.sort((a,b)=>sortK==='name'?a.name.localeCompare(b.name)*sortD:((a[sortK]||0)-(b[sortK]||0))*sortD||a.name.localeCompare(b.name));
  const ar=k=>sortK===k?(sortD<0?' ↓':' ↑'):'';
  $('stackTbl').innerHTML=`<div class="tr hd"><button type="button" data-sort="name">name${ar('name')}</button><span class="dd2">dose · route</span><span class="dd2">schedule · when</span><button type="button" data-sort="monthly" style="text-align:right">£/month${ar('monthly')}</button><span style="text-align:right">status</span></div>`+
  (rows.length?rows.map(s=>`<div class="tr ${s.status}" role="button" tabindex="0" data-k="${esc(s.key)}"><span class="nm"><i style="background:${STC[s.cat]||'#7a7a7a'}"></i><span>${esc(s.name)}</span>${s.edited?'<span class="delta">Δ</span>':''}${s.cau.length?'<span class="warn" title="Has cautions">⚠</span>':''}</span><span class="ds dd2">${esc([s.dose,s.route].filter(x=>x&&x!=='—').join(' · '))}</span><span class="ds dd2">${esc([s.sched&&s.sched!=='—'?s.sched:null,s.times.length?'@ '+s.times.join(', '):null].filter(Boolean).join(' '))}</span><span class="co num">${s.monthly?gbp(s.monthly,2):(s.price==='owned'?'<span class="dim">owned</span>':'<span class="dim">—</span>')}</span><span class="row" style="justify-content:flex-end;gap:6px"><button class="ed" type="button" data-sed="${esc(s.key)}">✎</button><span class="st ${s.status}">${STATUSL[s.status]}</span></span></div>`).join(''):`<div class="tr hd" style="color:var(--dim)">no match for "${esc(q)}"</div>`);
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
  $('drawer').innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center"><span class="tag" style="color:${STC[s.cat]||'#7a7a7a'}">${esc(s.cat||'')}</span><span class="row"><button class="btn p" type="button" id="dEdit">edit</button><button class="iconbtn" type="button" id="dClose">esc ✕</button></span></div>
  <h3 class="glitch" data-text="${esc(s.name)}">${esc(s.name)}</h3>
  <span class="st ${s.status}" style="display:inline-block;margin-bottom:16px">${STATUSL[s.status]}${s.inb?' · in budget':' · optional'}${s.edited?' · Δ edited':''}</span>
  <dl>${row('dose',s.dose)}${row('route',s.route)}${row('schedule',s.sched)}${row('taken at',s.times.join(', '))}${row('source',s.src)}${row('pack price',isNum(s.price)?gbp(s.price,2):s.price)}${row('units / pack',s.units)}${row('used / week',s.perweek)}${row('weekly',wk?gbp(wk,2):'')}${row('monthly',s.monthly?gbp(s.monthly,2):'')}${row('yearly',s.monthly?gbp(s.monthly*12,0):'')}${row('sheet row',s.row?'Stack!'+s.row:'new')}</dl>
  ${s.notes?`<div class="sect"><span class="tag">notes</span>${esc(s.notes)}</div>`:''}
  ${s.cau.length?`<div class="sect"><span class="tag">interactions & cautions · from your plan</span>${s.cau.map(c=>`<div class="ca">${esc(c)}</div>`).join('')}</div>`:''}
  ${s.monthly&&M.rate?`<div class="sect"><span class="tag">costs you</span><span style="font-size:22px;font-weight:800" class="num">${(s.monthly/M.rate).toFixed(1)} h</span> <span class="dim">of work a month</span></div>`:''}`;
  $('drawer').classList.add('on');$('drawer').setAttribute('aria-hidden','false');$('scrim').classList.add('on');$('dClose').onclick=closeDrawer;$('dEdit').onclick=()=>editStack(s);$('dClose').focus();
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
  $('drawer').innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center"><span class="tag pink">excel sync</span><button class="iconbtn" type="button" id="dClose">esc ✕</button></div>
  <h3>${ent.length?ent.length+' edit'+(ent.length===1?'':'s')+' queued':'all synced'}</h3>
  <p style="font-size:12px;margin:0 0 10px;line-height:1.6">${stTxt}</p>
  <p class="dim" style="font-size:12px;margin:0 0 14px">Sheet data from ${esc(GMETA.src==='excel'?'Excel':'the build snapshot')} · ${esc(ago(GMETA.at)||'—')}</p>
  <ul class="pl">${ent.map(([k,p])=>`<li><span><b>${esc(label(k,p))}</b></span><button class="iconbtn" type="button" data-undo="${esc(k)}">undo</button><span class="s">${esc(where(k))} · ${esc(what(p))}${p._err?`<br><span class="bad">${esc(p._err)}</span>`:''}${p._lost?'<br><span class="bad">This row was removed or renamed in Excel, so the edit has nowhere to go. Undo it or redo it on the new row.</span>':''}</span>${p._err?`<button class="iconbtn" type="button" data-retry="${esc(k)}">retry</button>`:''}</li>`).join('')}</ul>`;
  $('drawer').classList.add('on');$('drawer').setAttribute('aria-hidden','false');$('scrim').classList.add('on');$('dClose').onclick=closeDrawer;
  $('drawer').querySelectorAll('[data-undo]').forEach(b=>b.onclick=()=>{dropPatch(b.dataset.undo);openPendDrawer()});
  $('drawer').querySelectorAll('[data-retry]').forEach(b=>b.onclick=()=>{const p=EDITS.p[b.dataset.retry];if(p){delete p._err;EDITS.p[b.dataset.retry]={...p,_retry:Date.now()};saveEdits();lastOpsJson='';publishOps();openPendDrawer()}});
}
function findName(k){const [a,b]=k.split(':');const row=+b;if(a==='wd'||a==='we'){const P=D[a==='wd'?'weekday':'weekend'];for(const bl of P.blocks)for(const i of bl.items)if(i.row===row)return i.item}
  if(a==='wx'||a==='ex'){const P=D[a==='wx'?'weekday':'weekend'];for(const rows of Object.values(P.extra))for(const r of rows)if(r.row===row)return r.cells[1]}
  if(a==='xp'){const e=D.expenses.find(x=>x.row===row);return e&&e.name}return null}


/* ================= MONEY ================= */
const CATC={'Investment & Savings':'#ff2a6d','Personal & Other':'#ffb000','Stack':'#57f5a8','Food':'#e6e6e6','Subscriptions':'#05d9e8','Cat':'#b18cff'};
let billCat=null;
function renderMoney(){
  const I=M.inc;
  $('moneyKv').innerHTML=[['take-home',gbp(I.take),`${I.hours} h · ${gbp(M.rate,2)}/h`,'',true],['outgoings',gbp(M.out),'savings included',''],['left over',gbp(M.left),M.left<0?'budgeted more than you earn':'not yet allocated',M.left<0?'bad':'ok'],['spending',gbp(M.spend),`${Math.round(M.spend/I.take*100)}% of take-home · ${Math.round(M.save/I.take*100)}% saved`,'']]
    .map(([k,v,s,c,ed])=>`<div class="panel"><div class="ph"><span class="tag">${k}</span>${ed?'<button class="ed" type="button" id="incEd">✎</button>':''}</div><div class="pb"><span class="v num ${c}" data-scr="${esc(v)}">${v}</span><span class="s">${s}</span></div></div>`).join('');
  $('incEd').onclick=editIncome;
  const cats=Object.entries(M.cats).map(([cat,m])=>({cat,m})).sort((a,b)=>b.m-a.m);const mx=cats[0].m||1;
  $('cats').innerHTML=cats.map(c=>{const n=Math.max(1,Math.round(c.m/mx*44));return `<div class="cat${billCat===c.cat?' sel':''}" data-c="${esc(c.cat)}" role="button" tabindex="0"><span class="nm">${esc(c.cat==='Investment & Savings'?'savings':c.cat.toLowerCase())}</span><span class="bars" style="color:${CATC[c.cat]}">${'▇'.repeat(n)}<span style="color:var(--dim2)">${'·'.repeat(44-n)}</span></span><span class="co num">${gbp(c.m,2)}</span><span class="hr num">${M.rate?(c.m/M.rate).toFixed(1):0}h</span></div>`}).join('');
  if(billCat==='Stack'){$('billsTitle').textContent='stack';$('billsTot').textContent=gbp(M.stackBudget,2)+'/mo';$('bills').innerHTML='<div class="dim">Itemised on the stack view. <button class="iconbtn" type="button" id="goStack">open /stack</button></div>';$('goStack').onclick=()=>go('stack');$('addBill').style.visibility='hidden'}
  else{$('addBill').style.visibility='';
    const list=M.expenses.filter(e=>e.name!=='x'&&(billCat?e.cat===billCat:e.cat!=='Investment & Savings')).sort((a,b)=>b.m-a.m);
    $('billsTitle').textContent=billCat?billCat.toLowerCase():'every bill';$('billsTot').textContent=gbp(list.filter(e=>e.inb!==false).reduce((s,e)=>s+(e.m||0),0),2)+'/mo';
    $('bills').innerHTML=list.map(billRow).join('')}
  const sv=M.expenses.filter(e=>e.cat==='Investment & Savings').sort((a,b)=>b.m-a.m);
  $('saveTot').textContent=gbp(M.save,2)+'/mo';
  $('saves').innerHTML=sv.map(billRow).join('')+`<div class="dim" style="font-size:12px;margin-top:8px">Yearly deposits are shown as their monthly share.</div>`;
  $('rateLbl').textContent=gbp(M.rate,2)+'/h take-home';calc();
}
function billRow(e){return `<div class="bill"><span>${esc(e.name)}${e.edited?'<span class="delta">Δ</span>':''}${e.inb===false?' <span class="dim" style="font-size:11px">(not in budget)</span>':''}<br><span class="s">${esc([e.prov&&e.prov!=='x'?e.prov:null,e.freq&&e.freq!=='x'?e.freq:null,e.day?'on the '+e.day:null,e.notes].filter(Boolean).join(' · '))}</span></span><span class="s num">${e.y?gbp(e.y)+'/yr':''} <button class="ed" type="button" data-xe="${esc(e.key)}">✎</button></span><span class="co num">${e.m?gbp(e.m,2):'<span class="dim">—</span>'}</span></div>`}
function calc(){const v=parseFloat($('calcIn').value)||0;const h=M.rate?v/M.rate:0;$('calcOut').textContent=h>=1?`${h.toFixed(1)} h`:`${Math.round(h*60)} min`;$('calcNote').textContent=`That's ${(h/(M.inc.hours/21.7)).toFixed(2)} working days at your take-home rate.`}
$('calcIn').oninput=calc;
$('cats').onclick=e=>{const c=e.target.closest('.cat');if(!c)return;billCat=billCat===c.dataset.c?null:c.dataset.c;renderMoney();glitchAll()};
$('cats').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.target.click()}};
document.getElementById('v-money').addEventListener('click',e=>{const b=e.target.closest('[data-xe]');if(b)editExp(M.expenses.find(x=>x.key===b.dataset.xe))});
$('addBill').onclick=()=>addExp(billCat&&billCat!=='Investment & Savings'?billCat:'Subscriptions');$('addSave').onclick=()=>addExp('Investment & Savings');


/* ================= EXCEL SYNC ================= */
const HS='host:stack-sync';
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
const VIEWS=[['today','today','◉'],['gym','gym','▲'],['journal','journal','✎'],['body','body','♥'],['tools','tools','⧗'],['week','week','▦'],['stack','stack','◈'],['money','money','£']];
$('tabs').innerHTML=VIEWS.map(([v,l],i)=>`<button type="button" data-v="${v}"><span class="k">${i+1}</span>${l}</button>`).join('');
$('bnav').innerHTML=VIEWS.map(([v,l,ic])=>`<button type="button" data-v="${v}"><i>${ic}</i><span>${l}</span></button>`).join('')+'<span class="bnind" id="bnind"></span>';
let cur=null;
function go(v,fromHash,dirHint){
  if(!VIEWS.some(x=>x[0]===v))v='today';if(v===cur)return;
  const oi=VIEWS.findIndex(x=>x[0]===cur),ni=VIEWS.findIndex(x=>x[0]===v);const dir=dirHint||(oi<0?0:ni>oi?1:-1);cur=v;
  VIEWS.forEach(([x])=>$('v-'+x).classList.toggle('on',x===v));
  document.querySelectorAll('#tabs button,#bnav button').forEach(b=>b.setAttribute('aria-current',b.dataset.v===v?'page':'false'));
  const nb=document.querySelector(`#bnav button[data-v="${v}"]`);if(nb){$('bnind').style.transform=`translateX(${nb.offsetLeft}px)`;$('bnind').style.width=nb.offsetWidth+'px';nb.scrollIntoView({inline:'center',block:'nearest',behavior:FX?'smooth':'auto'})}
  if(!fromHash&&location.hash!=='#'+v)history.replaceState(null,'','#'+v);
  const m=$('main');
  if(FX&&m.animate){m.animate([{transform:`translateX(${dir*48}px)`,opacity:.1,filter:'hue-rotate(80deg) contrast(1.6)'},{transform:`translateX(${-dir*6}px)`,opacity:1,filter:'none',offset:.7},{transform:'none',opacity:1}],{duration:380,easing:'cubic-bezier(.2,.9,.1,1)'});m.classList.remove('switching');void m.offsetWidth;m.classList.add('switching')}
  const h=$('v-'+v).querySelector('.banner h2.glitch');if(h&&FX){const node=h.lastChild;scramble({set textContent(t){node.textContent=t}},h.dataset.text.slice(1),500)}
  artMount(v);
  if(v==='week')renderWeek();if(v==='gym')loadGym();if(v==='body')loadBody();if(v==='tools')renderTools();if(v==='journal'){if(jLoaded)renderJEditor();else loadJournal()}
  if(v==='money'||v==='stack')document.querySelectorAll(`#v-${v} [data-scr]`).forEach(el=>scramble(el,el.dataset.scr,700));
  window.scrollTo(0,0);setTimeout(()=>staggerIn($('v-'+v)),20);
}
$('tabs').onclick=e=>{const b=e.target.closest('button');if(b)go(b.dataset.v)};
$('bnav').onclick=e=>{const b=e.target.closest('button');if(b){go(b.dataset.v);try{navigator.vibrate&&navigator.vibrate(8)}catch(_){}}};
addEventListener('hashchange',()=>go(location.hash.slice(1),true));
// swipe left/right between sections on touch screens
(function(){let sx=0,sy=0,st=0,ok=false;
  addEventListener('touchstart',e=>{const t=e.touches[0];const el=e.target;ok=e.touches.length===1&&!el.closest('input,textarea,select,canvas,.strip,.tbl,.picklist,.sheet,.drawer,.modal,.restsel,.chips,.exc,.bnav');sx=t.clientX;sy=t.clientY;st=Date.now()},{passive:true});
  addEventListener('touchend',e=>{if(!ok)return;const t=e.changedTouches[0];const dx=t.clientX-sx,dy=t.clientY-sy;if(Date.now()-st<600&&Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)*1.8){const i=VIEWS.findIndex(x=>x[0]===cur);const j=i+(dx<0?1:-1);if(j>=0&&j<VIEWS.length)go(VIEWS[j][0],false,dx<0?1:-1)}},{passive:true});
})();
function renderAllViews(){renderToday();renderStack();renderMoney();renderTargets();renderTools()}

/* ================= PALETTE + KEYS ================= */
let palItems=[],palSel=0;
function palIndex(){
  const a=VIEWS.map(([v])=>({l:'/'+v,s:'view',run:()=>go(v)}));
  a.push({l:'edit mode',s:EDIT?'on':'off',run:()=>setEdit(!EDIT)},{l:'pending edits → excel',s:Object.keys(EDITS.p).length+' queued',run:openPendDrawer},{l:'add compound',s:'stack',run:()=>{go('stack');addStack()}},{l:'add bill',s:'money',run:()=>{go('money');addExp()}},{l:'log blood pressure',s:'body',run:()=>{go('body');setTimeout(()=>$('bpS').focus(),50)}},{l:'log weight',s:'body',run:()=>{go('body');setTimeout(()=>$('wtIn').focus(),50)}},{l:'start focus timer',s:'tools',run:()=>{go('tools');if(!TM.end)$('tmGo').click()}},{l:'write in journal',s:'journal',run:()=>{go('journal')}},{l:'start workout',s:'gym',run:()=>{go('gym');if(!ACTIVE)startWorkout(null)}},{l:'sign out',s:'account',run:signOut});
  visibleItems().forEach(i=>a.push({l:i.item,s:(i.time||'')+' · today',run:()=>{go('today');const el=document.querySelector(`#v-today [data-k="${CSS.escape(i.tk)}"]`);if(el){el.closest('.blk').classList.add('open');el.scrollIntoView({block:'center',behavior:FX?'smooth':'auto'});el.focus();FX&&el.animate([{background:'rgba(255,42,109,.4)'},{background:'transparent'}],{duration:1200})}}}));
  M.stack.forEach(s=>a.push({l:s.name,s:'stack · '+STATUSL[s.status],run:()=>{go('stack');openDrawer(s.key)}}));
  M.expenses.forEach(e=>a.push({l:e.name,s:'money · '+(e.m?gbp(e.m,2):'—'),run:()=>{go('money');billCat=e.cat;renderMoney()}}));
  return a;
}
function openPal(){$('pal').classList.add('on');$('palIn').value='';palSel=0;drawPal();$('palIn').focus()}
function closePal(){$('pal').classList.remove('on')}
function drawPal(){const q=norm($('palIn').value);const all=palIndex();palItems=(q?all.filter(x=>norm(x.l).includes(q)||norm(x.s).includes(q)):all.slice(0,14)).slice(0,40);palSel=Math.min(palSel,Math.max(0,palItems.length-1));
  $('palList').innerHTML=palItems.map((x,i)=>`<li class="${i===palSel?'sel':''}" data-i="${i}"><span>${esc(x.l)}</span><span class="dim">${esc(x.s)}</span></li>`).join('')||'<li class="dim">nothing found</li>'}
$('palIn').oninput=()=>{palSel=0;drawPal()};
$('palList').onclick=e=>{const li=e.target.closest('li[data-i]');if(li){closePal();palItems[+li.dataset.i].run()}};
$('pal').onclick=e=>{if(e.target===$('pal'))closePal()};$('palBtn').onclick=openPal;
addEventListener('keydown',e=>{
  const typing=/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
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


/* ================= BOOT: sign in, then load ================= */
let booted=false,loginBusy=false;
function showLogin(msg){$('login').hidden=false;document.body.classList.add('locked');$('loginMsg').textContent=msg||'';setTimeout(()=>{const e=$('lEmail');if(e&&!e.value)e.focus()},50)}
function hideLogin(){$('login').hidden=true;document.body.classList.remove('locked')}
$('loginForm').onsubmit=async e=>{e.preventDefault();if(loginBusy)return;loginBusy=true;$('loginMsg').textContent='signing in…';
  try{const {data,error}=await SB.auth.signInWithPassword({email:$('lEmail').value.trim(),password:$('lPass').value});if(error)throw error;$('lPass').value='';await startApp(data.session)}
  catch(err){$('loginMsg').textContent=(err&&err.message)||'Sign-in failed.';const f=$('loginBox');f.animate&&f.animate([{transform:'translateX(-8px)'},{transform:'translateX(8px)'},{transform:'none'}],{duration:260})}
  finally{loginBusy=false}};
async function boot(){
  const cfg=window.APP_CONFIG||{};
  if(!cfg.supabaseUrl||!window.supabase){showLogin('This copy of the app isn\'t connected to its database yet.');return}
  SB=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,storageKey:'ds-auth'}});
  SB.auth.onAuthStateChange((ev)=>{if(ev==='SIGNED_OUT'){R=null;UID=null;showLogin()}});
  let session=null;try{session=(await SB.auth.getSession()).data.session}catch(e){}
  if(!session){showLogin();return}
  await startApp(session);
}
async function startApp(session){
  UID=session.user.id;R=true;hideLogin();setSync('busy','loading');
  await loadEdits();
  const ok=await loadGridsFromDb(true);
  $('nodata').hidden=ok||!!GMETA.at;
  rebuild();booted=true;renderPend();renderStack();renderMoney();renderTargets();
  cur=null;go(location.hash.slice(1)||'today',true);
  await loadDay();await loadTools();
  startRealtime();startAgentLink();loadArtImages();flushOutbox();
  setSync(ONLINE?'on':'',ONLINE?'synced':'offline');
  schedWidget();setInterval(publishWidget,10*60*1000);
}
function flushOutbox(){try{const ks=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('ds3:outbox:'))ks.push(k.slice(11))}ks.forEach(p=>{const v=LS.get(p);if(v!=null)save(p,v,true);localStorage.removeItem('ds3:outbox:'+p)})}catch(e){}}
async function refreshAfterResume(){if(!booted)return;await loadGridsFromDb();await loadEdits();rebuild();const p='days/d-'+DAYK;const d=await load(p);if(d){DAY={ticks:{},water:0,msg:{},dw:0,...d};applyTicks();renderTools()}AGENT=await load('agent/status');agentState();if(cur==='gym')loadGym(true);if(cur==='journal')loadJournal()}
async function signOut(){try{await SB.auth.signOut()}catch(e){}try{Object.keys(localStorage).filter(k=>k.startsWith('ds3:')).forEach(k=>localStorage.removeItem(k))}catch(e){}location.reload()}

/* widget feed: a small summary the iPhone/iPad widgets read */
let widgetT=null;function schedWidget(){clearTimeout(widgetT);widgetT=setTimeout(publishWidget,1500)}
function publishWidget(){if(!R||!booted||!M.plans)return;
  const vis=visibleItems().filter(i=>i.t!==null).sort((a,b)=>a.t-b.t);
  const done=visibleItems().filter(i=>DAY.ticks[i.tk]).length,total=visibleItems().length;
  save('widget/today',{at:new Date().toISOString(),date:DAYK,plan:planKind,pct:total?Math.round(done/total*100):0,done,total,
    items:vis.map(i=>({t:fmtM(i.t),n:i.item,d:!!DAY.ticks[i.tk],c:!!i.cmp})),water:DAY.water||0,waterTarget:(SET&&SET.water)||8,dw:DAY.dw||0,lc:typeof lc==='number'?lc:0,
    habits:HABITS.map(([l,re])=>({l,d:visibleItems().some(i=>re.test(i.item)&&DAY.ticks[i.tk])}))},true)}

/* installable app: offline cache */
if('serviceWorker' in navigator&&location.protocol==='https:')addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
boot();

// Offline cache for the app shell. Data always comes from Supabase (or the local cache in the page).
const CACHE='system-__V__';
const SHELL=['./','index.html','app.css?v=__V__','app.js?v=__V__','config.js?v=__V__','vendor/supabase.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET')return;
  if(u.hostname.endsWith('supabase.co'))return; // never cache data or auth
  if(u.origin===location.origin){e.respondWith(caches.match(e.request,{ignoreSearch:u.pathname.endsWith('/')||u.pathname.endsWith('index.html')}).then(hit=>{const net=fetch(e.request).then(r=>{if(r.ok){const cp=r.clone();caches.open(CACHE).then(c=>c.put(e.request,cp))}return r}).catch(()=>hit);return hit||net}));return}
  if(u.hostname.includes('fonts.g')){e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{const cp=r.clone();caches.open(CACHE).then(c=>c.put(e.request,cp));return r})))}
});

})();
