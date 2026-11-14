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
setInterval(()=>{if(!FX||document.hidden)return;const d=nimg.data;for(let i=0;i<d.length;i+=4){const v=Math.random()*255|0;d[i]=d[i+1]=d[i+2]=v;d[i+3]=255}nctx.putImageData(nimg,0,0)},130);
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
(function loopGlitch(){setTimeout(()=>{if(FX&&!document.hidden)glitchAll();loopGlitch()},55000+Math.random()*15000)})();
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
function renderPend(){const b=$('pendBtn');if(!b)return;b.hidden=true;return;const n=Object.keys(EDITS.p).length;const st=typeof XLSTATE==='undefined'?'off':XLSTATE;b.className='pendbtn on xl-'+st;
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
  M.stack.forEach(s=>{const v=v2.get(norm(s.name));s.status=v?v.status:'notinplan';if(typeof STOVR!=='undefined'&&STOVR.map[norm(s.name)])s.status=STOVR.map[norm(s.name)];s.times=v?[...new Set(v.times.filter(Boolean))]:[];s.cau=cautionsFor(s.name)});
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
    (cfg.extra||'')+(cfg.hint?`<div class="hint2">${esc(cfg.hint)}</div>`:'')+
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
  const cfg=mCfg;const ex=cfg.onExtra?cfg.readExtra():null;closeModal();if(Object.keys(changed).length||cfg.isNew)cfg.onSave(vals,changed);if(cfg.onExtra)cfg.onExtra(ex);
  const sub=$('main');burst(innerWidth/2,innerHeight/3,30);glitchAll()};

const F_PLAN=[{k:'time',label:'time',ph:'HH:MM'},{k:'item',label:'item'},{k:'type',type:'select',options:TYPES},{k:'dose'},{k:'route'},{k:'sched',label:'schedule / days',ph:'Daily · Mon–Fri · Tue, Thu · EOD'},{k:'notes',type:'area'},{k:'caution',label:'cautions',type:'area'}];
const F_EXTRA=[{k:'item'},{k:'type',type:'select',options:[''].concat(TYPES)},{k:'dose'},{k:'route'},{k:'sched',label:'schedule'},{k:'notes',type:'area'},{k:'caution',label:'cautions',type:'area'}];
const F_STACK=[{k:'name'},{k:'cat',label:'category',type:'select',options:STACK_CATS},{k:'dose'},{k:'route'},{k:'sched',label:'schedule'},{k:'notes',type:'area'},{k:'price',label:'pack price £',type:'num',ph:'or "owned"'},{k:'units',label:'units / pack',type:'num'},{k:'perweek',label:'used / week',type:'num'},{k:'inb',label:'in budget',type:'bool'},{k:'src',label:'source'}];
const F_EXP=[{k:'name'},{k:'cat',label:'category',type:'select',options:EXP_CATS},{k:'prov',label:'provider'},{k:'freq',label:'frequency',type:'select',options:FREQ_OPTS},{k:'per',label:'cost / payment £',type:'num'},{k:'day',label:'payment day'},{k:'method',label:'method'},{k:'notes'},{k:'inb',label:'in budget',type:'bool'}];
const F_TGT=[{k:'item',label:'target'},{k:'notes',label:'detail',type:'area'}];
function pick(o,fields){const r={};fields.forEach(f=>r[f.k]=o[f.k]??null);return r}
function editPlanItem(kind,it){const pre=kind==='weekday'?'wd':'we';
  const lead=(typeof NITEMS!=='undefined'&&NITEMS.m[it.key]!=null)?NITEMS.m[it.key]:'';
  openEditor({title:`edit · ${kind==='weekday'?'weekday plan':'weekend plan'}${it.row?' · row '+it.row:''}`,fields:F_PLAN,values:pick(it,F_PLAN),
    extra:`<label for="f_notify">🔔 notification</label><select id="f_notify"><option value="" ${lead===''?'selected':''}>off</option>${[0,5,10,15,30,60].map(m=>`<option value="${m}" ${lead===m?'selected':''}>${m?m+' min before':'at the time'}</option>`).join('')}</select>${it.t==null?'<div class="hint2">this item has no time yet — add one above for the notification to fire</div>':''}`,
    readExtra:()=>$('f_notify').value,onExtra:v=>{if(typeof setItemNotify==='function')setItemNotify(it.key,v===''?null:+v)},
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
function setEdit(on){EDIT=on;document.body.classList.toggle('edit-on',on);$('editPill').hidden=!on;if(on){glitchAll();try{navigator.vibrate&&navigator.vibrate(18)}catch(e){}}}
$('editPill').onclick=()=>setEdit(false);
/* edit mode: long-press (touch) or right-click (mouse) on anything editable */
(function(){let t=null,sx=0,sy=0,fired=false,swallow=0;
  /* the tap that ends a long-press must not also tick/open the thing under the finger */
  ['click','pointerup','mouseup'].forEach(ev=>addEventListener(ev,e=>{if(Date.now()<swallow){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();if(ev==='click')swallow=0}},true));
  const EDITABLE='.it,.tr,.trk,.tgt,.blk,.panel,.exp,.row';
  const trigger=(target)=>{if(target.closest('input,textarea,select,#sheet,.drawer,.modal,#v-gym,#v-journal'))return false;if(!target.closest('#main'))return false;
    const wasOn=EDIT;if(!EDIT)setEdit(true);const row=target.closest('.it,.tr,.trk,.tgt,[data-key]');const ed=row&&row.querySelector('.ed,[data-edit],[data-editx],[data-tedit]');if(ed&&wasOn)ed.click();return true};
  addEventListener('touchstart',e=>{if(e.touches.length!==1)return;const tg=e.target;sx=e.touches[0].clientX;sy=e.touches[0].clientY;fired=false;clearTimeout(t);t=setTimeout(()=>{fired=trigger(tg);if(fired)swallow=Date.now()+900},520)},{passive:true});
  addEventListener('touchmove',e=>{if(Math.hypot(e.touches[0].clientX-sx,e.touches[0].clientY-sy)>10)clearTimeout(t)},{passive:true});
  addEventListener('touchend',e=>{clearTimeout(t);if(fired){e.preventDefault();fired=false}});
  addEventListener('contextmenu',e=>{if(e.target.closest('input,textarea'))return;if(trigger(e.target))e.preventDefault()});
})();


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
  $('planName').textContent=planKind==='weekday'?'weekday plan':'weekend plan';$('todaySub').textContent=planKind==='weekday'?'weekday plan':'weekend plan';
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
  renderQuotes();
}
setInterval(()=>tickNow(false),1000);
async function loadDay(){
  const p='days/d-'+DAYK;const d=await load(p);DAY={ticks:{},water:0,msg:{},dw:0,...(d||{})};
  renderToday();renderTools();watch(p,dd=>{if(p!=='days/d-'+DAYK)return;DAY={ticks:{},water:0,msg:{},dw:0,...dd};applyTicks();renderTools();if(cur==='streaks'&&typeof renderHabits==='function'&&!hHold)renderHabits()});
}


/* bottom ticker: quotes */
const QUOTES=[["Everyone has a plan until they get punched in the mouth.", "Mike Tyson"], ["Discipline is doing what you hate to do, but doing it like you love it.", "Mike Tyson"], ["Fear is the greatest obstacle to learning. But fear is your best friend.", "Mike Tyson"], ["The biggest challenge is learning how to psych yourself up into believing in yourself as you walk into the Octagon.", "Jon Jones"], ["Being remembered for standing for something is a lot more important than just for a cool move that you did.", "Jon Jones"], ["To stimulate optimal size and strength increases, it's imperative that you regularly attempt the momentarily impossible.", "Mike Mentzer"], ["It is the body itself that produces growth; but it does so only during a sufficient rest period.", "Mike Mentzer"], ["Man's proper stature is not one of mediocrity, failure, frustration, or defeat, but one of achievement, strength, and nobility.", "Mike Mentzer"], ["Success doesn't know these things about cold or early or tired. It just knows if you showed up or not.", "Greg Plitt"], ["It's early in the morning and your competition is still sleeping.", "Greg Plitt"], ["We all fall in life. The question is: who gets back up?", "Greg Plitt"], ["Stay hungry, stay foolish.", "Steve Jobs"], ["Strength does not come from winning. Your struggles develop your strengths.", "Arnold Schwarzenegger"], ["The last three or four reps is what makes the muscle grow.", "Arnold Schwarzenegger"], ["Everybody wants to be a bodybuilder, but nobody wants to lift no heavy-ass weights.", "Ronnie Coleman"], ["The pain you feel today will be the strength you feel tomorrow.", "Arnold Schwarzenegger"], ["You are in danger of living a life so comfortable and soft that you will die without ever realising your true potential.", "David Goggins"], ["Don't stop when you're tired. Stop when you're done.", "David Goggins"], ["Rest at the end, not in the middle.", "Kobe Bryant"], ["Great things come from hard work and perseverance. No excuses.", "Kobe Bryant"], ["Be water, my friend.", "Bruce Lee"], ["Absorb what is useful, discard what is useless, add what is specifically your own.", "Bruce Lee"], ["I like criticism. It makes you strong.", "LeBron James"], ["You have to be able to accept failure to get better.", "LeBron James"], ["Everything negative – pressure, challenges – is all an opportunity for me to rise.", "Kobe Bryant"], ["I can't relate to lazy people. We don't speak the same language.", "Kobe Bryant"], ["Talent without working hard is nothing.", "Cristiano Ronaldo"], ["Your love makes me strong. Your hate makes me unstoppable.", "Cristiano Ronaldo"], ["Dreams are not what you see in your sleep, dreams are things which do not let you sleep.", "Cristiano Ronaldo"], ["I'm living a dream I never want to wake up from.", "Cristiano Ronaldo"], ["It took me 17 years and 114 days to become an overnight success.", "Lionel Messi"], ["You have to fight to reach your dream. You have to sacrifice and work hard for it.", "Lionel Messi"], ["I've failed over and over and over again in my life. And that is why I succeed.", "Michael Jordan"], ["Some people want it to happen, some wish it would happen, others make it happen.", "Michael Jordan"], ["Never say never, because limits, like fears, are often just an illusion.", "Michael Jordan"], ["I hated every minute of training, but I said: don't quit. Suffer now and live the rest of your life as a champion.", "Muhammad Ali"], ["Don't count the days. Make the days count.", "Muhammad Ali"], ["Impossible is nothing.", "Muhammad Ali"], ["There's no talent here, this is hard work. This is an obsession.", "Conor McGregor"], ["Doubt is only removed by action.", "Conor McGregor"], ["I don't think limits.", "Usain Bolt"], ["Champions aren't made in gyms. Champions are made from something they have deep inside them.", "Muhammad Ali"], ["A champion is defined not by their wins but by how they can recover when they fall.", "Serena Williams"]];
function renderQuotes(){const tk=$('tick');if(!tk||tk.dataset.q)return;const q=[...QUOTES];for(let i=q.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[q[i],q[j]]=[q[j],q[i]]}
  for(let i=1;i<q.length;i++)if(q[i][1]===q[i-1][1]){const j=q.findIndex((x,k)=>k>i&&x[1]!==q[i][1]&&(!q[k+1]||q[k+1][1]!==q[i][1])&&x[1]!==q[i-1][1]);if(j>0)[q[i],q[j]]=[q[j],q[i]]}
  const html=q.map(([t,a])=>`<span>“${esc(t)}” <b>— ${esc(a)}</b></span>`).join('');tk.dataset.q='1';tk.innerHTML=html+html;tk.style.animationDuration=Math.max(60,tk.scrollWidth/2/40)+'s'}

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
watch('gym/active',d=>{ACTIVE=d&&d.ex?d:null;if(cur==='gym')renderGym()});
watch('gym/routines',d=>{ROUTINES={list:[],...(d||{})};if(cur==='gym')renderGym()});
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
function stats(w){let vol=0,n=0,reps=0;(w.ex||[]).forEach(x=>x.sets.forEach(s=>{if(s.done){n++;vol+=volOf(x,s);reps+=+s.r||0}}));return {vol,n,reps}}
function fmtSet(x,s){const ty=exOf(x).ty;const T=XTYPES[ty]||XTYPES.wr;const p=[];
  if(T.f.includes('kg')&&s.kg!==''&&s.kg!=null)p.push((T.pfx||'')+kgs(s.kg)+'kg');if(T.f.includes('km')&&s.km)p.push(kgs(s.km)+'km');if(T.f.includes('m')&&s.m)p.push(s.m+'m');
  if(T.f.includes('r')&&s.r)p.push((p.length?'× ':'')+s.r);if(T.f.includes('sec')&&s.sec)p.push(mmss(s.sec));let o=p.join(' ');if(s.rpe)o+=' @'+s.rpe;return o||'—'}
function bestSet(x){return x.sets.filter(s=>s.done!==false&&s.t!=='w').sort((a,b)=>e1(b)-e1(a)||(+b.r||0)-(+a.r||0)||(+b.sec||0)-(+a.sec||0))[0]}

/* ---------- shell ---------- */
function renderGym(){
  $('gymSeg').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.g===GYMV));
  ['workout','routines','history','stats','exercises'].forEach(v=>$('g-'+v).hidden=v!==GYMV);
  $('gymSub').textContent=ACTIVE?(ACTIVE.editing?'editing a past workout':'workout in progress'):(planKind==='weekend'?(DOWN==='Sun'?'plan today: lower 11:00':'plan today: upper 11:00'):(DOWN==='Tue'||DOWN==='Thu'?'plan today: upper 20:30':'rest day in the plan'));
  if(!EXDB){loadExDb().then(()=>{indexEx();renderGym()});}
  ({workout:renderWorkout,routines:renderRoutines,history:renderHistory,stats:renderStats,exercises:renderLibrary})[GYMV]();renderRest();
}
$('gymSeg').onclick=e=>{const b=e.target.closest('button');if(!b)return;GYMV=b.dataset.g;renderGym();staggerIn($('g-'+GYMV))};

/* ---------- workout ---------- */
const SSCOL=['#05d9e8','#ffb000','#b967ff','#57f5a8','#ff6b6b'];
function ssColor(ss){if(!ss||!ACTIVE)return '';const ids=[...new Set(ACTIVE.ex.map(x=>x.ss).filter(Boolean))];return SSCOL[ids.indexOf(ss)%SSCOL.length]}
function renderWorkout(){
  const el=$('g-workout');
  if(!ACTIVE){
    const sug=gymTypeFor();const folders={};ROUTINES.list.forEach(r=>(folders[r.folder||'my routines']=folders[r.folder||'my routines']||[]).push(r));
    el.innerHTML=`<div class="gstart">
      <button class="bigstart" type="button" data-act="empty"><span class="tag">quick start</span><b>start empty workout</b><span class="dim">log as you go</span></button>
      <div class="ph2"><span class="tag">routines</span><span class="row" style="gap:6px"><button class="iconbtn" type="button" data-act="newroutine">+ new routine</button><button class="iconbtn" type="button" data-act="explore">explore exercises</button></span></div>
      ${Object.entries(folders).map(([f,rs])=>`<div class="fold"><span class="dim">${esc(f)} · ${rs.length}</span></div><div class="rgrid">${rs.map(r=>rCard(r,norm(r.name).includes(sug))).join('')}</div>`).join('')||'<div class="dim" style="font-size:12px">No routines yet. Make an "Upper" and a "Lower" one so starting a session is one tap.</div>'}
      ${WORKOUTS[0]?`<div class="ph2"><span class="tag">last workout</span></div>${wCard(WORKOUTS[0])}`:''}
    </div>`;return}
  const st=stats(ACTIVE);const ed=!!ACTIVE.editing;
  el.innerHTML=`<div class="wbar"><input class="wname" id="wName" value="${esc(ACTIVE.name)}" aria-label="Workout name"><div class="wstats"><div><span class="dim">${ed?'date':'duration'}</span><b class="num" id="wDur">${ed?esc(nice(ACTIVE.date).toLowerCase()):fmtDur(Date.now()-new Date(ACTIVE.startedAt))}</b></div><div><span class="dim">volume</span><b class="num">${fmtVol(st.vol)} kg</b></div><div><span class="dim">sets</span><b class="num">${st.n}</b></div></div><div class="row"><button class="btn" type="button" data-act="discard">${ed?'cancel':'discard'}</button><button class="btn p" type="button" data-act="finish">${ed?'save':'finish'}</button></div></div>
  <textarea class="wnote" id="wNote" rows="1" placeholder="workout notes">${esc(ACTIVE.note||'')}</textarea>
  <div class="exlist">${ACTIVE.ex.map((x,xi)=>exCard(x,xi)).join('')}</div>
  <button class="addex" type="button" data-act="addex">+ add exercises</button>`;
}
function exCard(x,xi){
  const e=exOf(x);const T=XTYPES[e.ty]||XTYPES.wr;const prev=prevSets(x);const b=bests(e.id,ACTIVE.id);const col=ssColor(x.ss);
  const cols=`34px minmax(0,1fr) ${T.f.map(()=>'minmax(52px,64px)').join(' ')} 40px 38px`;
  return `<div class="exc${x.ss?' ss':''}" data-x="${xi}" style="${x.ss?'--ssc:'+col:''}">${x.ss?`<span class="sslab">superset</span>`:''}
  <div class="exh"><button class="exhead" type="button" data-exinfo="${xi}">${thumb(e)}<span><b class="exname">${esc(e.n)}</b><span class="dim exsub">${esc(e.pm.join(', '))}${T!==XTYPES.wr?' · '+T.l:''}</span></span></button><button class="iconbtn" type="button" data-exmenu="${xi}" aria-label="Exercise options">⋯</button></div>
  <input class="exnote" data-note="${xi}" placeholder="add notes here…" value="${esc(x.note||'')}" aria-label="Notes">
  <button class="resttag" type="button" data-restpick="${xi}">⧗ rest timer: ${x.rest?mmss(x.rest):'off'}</button>
  <div class="sgrid shead" style="grid-template-columns:${cols}"><span>set</span><span>previous</span>${T.f.map(f=>`<span>${(f==='kg'&&T.pfx)?T.pfx+'kg':FLAB[f]}</span>`).join('')}<span>rpe</span><span>✓</span></div>
  ${x.sets.map((s,si)=>{const p=prev[si];const pr=s.done&&s.t!=='w'&&isPR(e,s,b);return `<div class="sgrid srow${s.done?' done':''}${pr?' pr':''}" data-s="${xi}:${si}" style="grid-template-columns:${cols}">
    <button class="stype t-${s.t||'n'}" type="button" data-stype="${xi}:${si}" title="Set type">${setLabel(x.sets,si)}</button>
    <button class="sprev" type="button" data-prev="${xi}:${si}" ${p?'':'disabled'}>${p?esc(fmtSet(x,p)):'—'}</button>
    ${T.f.map(f=>{const v=f==='sec'?(s.sec?mmss(s.sec):''):(s[f]??'');const ph=p?(f==='sec'?(p.sec?mmss(p.sec):''):(p[f]??'')):'';return `<input class="sin num" inputmode="${f==='r'||f==='m'?'numeric':f==='sec'?'text':'decimal'}" data-f="${f}" data-at="${xi}:${si}" value="${esc(v)}" placeholder="${esc(ph)}" aria-label="${FLAB[f]}">`}).join('')}
    <button class="srpe${s.rpe?' on':''}" type="button" data-rpe="${xi}:${si}">${s.rpe||'·'}</button>
    <button class="scheck" type="button" data-done="${xi}:${si}" aria-pressed="${!!s.done}" aria-label="Complete set">✓</button>
    ${pr?'<span class="prtag">PR</span>':''}</div>`}).join('')}
  <button class="addset" type="button" data-addset="${xi}">+ add set</button></div>`;
}
function isPR(e,s,b){if(e.ty==='wr'||e.ty==='wbw')return b.e>0&&e1(s)>b.e;if(e.ty==='bw'||e.ty==='r')return b.reps>0&&+s.r>b.reps;if(e.ty==='dur')return b.sec>0&&+s.sec>b.sec;if(e.ty==='dd')return b.km>0&&+s.km>b.km;return false}
function rCard(r,hot){return `<div class="rcard${hot?' hot':''}"><div class="rtop"><b>${esc(r.name)}</b><span class="row" style="gap:4px">${hot?'<span class="chipy hot">today</span>':''}<button class="iconbtn" type="button" data-rmenu="${esc(r.id)}" aria-label="Routine options">⋯</button></span></div>
  <div class="rthumbs">${r.ex.slice(0,6).map(x=>thumb(exOf(x),'rth')).join('')}</div><span class="dim rsum">${esc(r.ex.map(x=>exOf(x).n).join(', ')||'no exercises yet')}</span><button class="btn p" type="button" data-start="${esc(r.id)}">start routine</button></div>`}
function wCard(w){const st=w.nsets!=null?{vol:w.vol,n:w.nsets}:stats(w);const dur=w.endedAt&&w.startedAt?fmtDur(new Date(w.endedAt)-new Date(w.startedAt)):'';
  return `<div class="wcard" data-w="${esc(w.id)}">${(WPH[w.id]||[])[0]?`<img class="wcimg" src="${WPH[w.id][0]}" alt="">`:''}<div class="rtop"><b>${esc(w.name)}</b><span class="dim">${esc(nice(w.date).toLowerCase())}</span></div>
  <div class="wmeta num"><span>${dur||'—'}</span><span>${fmtVol(st.vol)} kg</span><span>${st.n||0} sets</span>${(w.prs||[]).length?`<span class="pink">${w.prs.length} PR</span>`:''}</div>
  <div class="wex">${(w.ex||[]).map(x=>{const bs=bestSet(x);return `<div><span>${x.sets.filter(s=>s.done!==false).length} × ${esc(exOf(x).n)}</span><span class="dim num">${bs?esc(fmtSet(x,bs)):''}</span></div>`}).join('')}</div></div>`}
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
  if(d.rmenu)return routineMenu(d.rmenu);
  if(d.act==='newroutine'){GYMV='routines';renderGym();return editRoutine(null)}
  if(d.act==='explore'){GYMV='exercises';return renderGym()}
  if(d.act==='addex')return pickExercises(list=>mut(()=>list.forEach(ex=>ACTIVE.ex.push(exEntry(ex)))));
  if(d.act==='discard'){if(ACTIVE.editing){ACTIVE=null;saveActive();renderGym();return}if(t.dataset.arm){ACTIVE=null;saveActive();renderGym();glitchAll()}else{t.dataset.arm=1;t.textContent='tap again';setTimeout(()=>{if(t.isConnected){delete t.dataset.arm;t.textContent='discard'}},2500)}return}
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
    s.done=!s.done;s.at=s.done?new Date().toISOString():null;const b=bests(ex.id,ACTIVE.id);const pr=s.done&&s.t!=='w'&&isPR(ex,s,b);
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
  if(d.f){const [xi,si]=SXY(d.at);const s=ACTIVE.ex[xi].sets[si];const f=d.f;s[f]=f==='sec'?pmmss(t.value):t.value.replace(',','.');saveActive()}
});
$('g-workout').addEventListener('change',e=>{if(e.target.dataset.f)renderWorkout()});

/* set type / rpe / rest pickers */
function setTypeMenu(xi,si){openSheet('set type',`<div class="optlist">${[['n','normal set','1'],['w','warm-up set','W'],['d','drop set','D'],['f','failure set','F']].map(([k,l,s])=>`<button class="opt" type="button" data-ty="${k}"><span class="stype t-${k}">${s}</span>${l}</button>`).join('')}<button class="opt bad" type="button" data-ty="del"><span class="stype">✕</span>remove set</button></div>`);
  $('sheetBody').onclick=e=>{const b=e.target.closest('[data-ty]');if(!b)return;closeSheet();mut(()=>{const x=ACTIVE.ex[xi];if(b.dataset.ty==='del')x.sets.splice(si,1);else x.sets[si].t=b.dataset.ty})}}
function rpeMenu(xi,si){const s=ACTIVE.ex[xi].sets[si];const vals=[6,6.5,7,7.5,8,8.5,9,9.5,10];const txt={6:'could do 4+ more reps',7:'could do 3 more',7.5:'2–3 more',8:'2 more reps',8.5:'1–2 more',9:'1 more rep',9.5:'maybe 1 more',10:'max effort',6.5:'3–4 more'};
  openSheet('rpe · rate of perceived exertion',`<div class="rpegrid">${vals.map(v=>`<button type="button" class="rpeb${s.rpe==v?' on':''}" data-v="${v}"><b>${v}</b><span>${txt[v]}</span></button>`).join('')}</div><button class="btn" type="button" data-v="" style="margin-top:10px">clear</button>`);
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
   ${T.f.includes('kg')?'<button class="opt" type="button" data-m="warm">🔥 add warm-up sets</button><button class="opt" type="button" data-m="plates">◎ plate calculator</button>':''}
   <button class="opt" type="button" data-m="up">↑ move up</button><button class="opt" type="button" data-m="down">↓ move down</button>
   <button class="opt bad" type="button" data-m="rm">✕ remove exercise</button></div>`);
  $('sheetBody').onclick=ev=>{const b=ev.target.closest('[data-m]');if(!b)return;const m=b.dataset.m;
    if(m==='info')return openExercise(e.id);
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
  openSheet('plate calculator',`<div class="row" style="gap:10px;align-items:end;flex-wrap:wrap"><label class="dim">target kg<input class="inp num" id="pcT" value="${kgs(target)}" inputmode="decimal" style="width:90px;display:block"></label><label class="dim">bar kg<input class="inp num" id="pcB" value="${GSET.bar}" inputmode="decimal" style="width:70px;display:block"></label></div><div id="pcOut" style="margin-top:14px"></div>`);
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
    save('gym/w-'+w.id,w,true);WORKOUTS.unshift(w);recountUsed();ACTIVE=null;saveActive();restEnd=null;LS.set('restEnd',null);pushCancel('rest');
    autoTick(/^Gym\b/);flash(w.prs.length?'new_pr':'workout_done');shake();burst(innerWidth/2,innerHeight/2,160,true);renderGym();showSummary(w);
  };
  if(undone){openSheet('finish workout?',`<p class="dim" style="margin:0 0 14px">${undone} set${undone>1?'s':''} not ticked.</p><div class="bigbtns"><button class="btn p" type="button" id="fDrop">discard unticked + finish</button><button class="btn" type="button" id="fKeep">keep sets with values</button><button class="btn" type="button" id="fBack">back</button></div>`);
    $('fDrop').onclick=()=>{closeSheet();go2(true)};$('fKeep').onclick=()=>{closeSheet();go2(false)};$('fBack').onclick=closeSheet}
  else go2(true);
}
/* Hevy-style "save workout": title, stats, photos, description — then the summary */
function saveScreen(w,done){let imgs=[];
  const draw=()=>{const ph=$('swPh');if(!ph)return;ph.innerHTML=imgs.map((s,i)=>`<div class="swimg"><img src="${s}" alt=""><button type="button" data-swdel="${i}" aria-label="Remove photo">✕</button></div>`).join('')+(imgs.length<4?`<label class="swadd"><input type="file" accept="image/*" id="swFile" hidden multiple><span>＋</span><small>add photo</small></label>`:'');
    const f=$('swFile');if(f)f.onchange=async e=>{for(const file of [...e.target.files].slice(0,4-imgs.length)){try{imgs.push(await resizeImg(file,1080))}catch(x){}}draw()}};
  openSheet('save workout',`<input class="inp swtitle" id="swName" value="${esc(w.name)}" aria-label="Workout title">
  <div class="wstats big" style="margin:12px 0"><div><span class="dim">duration</span><b class="num">${fmtDur(new Date(w.endedAt)-new Date(w.startedAt))}</b></div><div><span class="dim">volume</span><b class="num">${fmtVol(w.vol)} kg</b></div><div><span class="dim">sets</span><b class="num">${w.nsets}</b></div><div><span class="dim">records</span><b class="num pink">${w.prs.length}</b></div></div>
  <div class="dim" style="font-size:12px;margin-bottom:6px">when · ${esc(nice(w.date).toLowerCase())} · ${new Date(w.startedAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</div>
  <div class="swph" id="swPh"></div>
  <textarea class="inp" id="swDesc" rows="3" placeholder="how did it go? share more about your workout…" style="margin-top:10px">${esc(w.note||'')}</textarea>
  <div class="bigbtns" style="margin-top:14px"><button class="btn" type="button" id="swBack">resume</button><span style="flex:1"></span><button class="btn p" type="button" id="swSave">save workout</button></div>`);
  draw();
  $('swPh').onclick=e=>{const b=e.target.closest('[data-swdel]');if(b){imgs.splice(+b.dataset.swdel,1);draw()}};
  $('swBack').onclick=closeSheet;
  $('swSave').onclick=()=>{w.name=$('swName').value.trim()||w.name;w.note=$('swDesc').value.trim();if(imgs.length){w.photos=imgs.length;WPH[w.id]=imgs;save('gym/wp-'+w.id,{imgs},true)}closeSheet();done()}}
function workoutNo(w){return WORKOUTS.slice().reverse().findIndex(x=>x.id===w.id)+1}
function showSummary(w){const muscles=muscleSets([w]);const top=Object.entries(muscles).sort((a,b)=>b[1]-a[1]).slice(0,6);const mx=Math.max(1,...top.map(t=>t[1]));
  openSheet('workout complete',`${(WPH[w.id]||[]).length?`<div class="swgal">${WPH[w.id].map(s=>`<img src="${s}" alt="">`).join('')}</div>`:''}<div class="sumhero"><span class="tag">workout #${workoutNo(w)}</span><b class="glitch" data-text="${esc(w.name)}">${esc(w.name)}</b><span class="dim">${esc(nice(w.date).toLowerCase())}</span></div>
  <div class="wstats big"><div><span class="dim">duration</span><b class="num">${fmtDur(new Date(w.endedAt)-new Date(w.startedAt))}</b></div><div><span class="dim">volume</span><b class="num">${fmtVol(w.vol)} kg</b></div><div><span class="dim">sets</span><b class="num">${w.nsets}</b></div><div><span class="dim">records</span><b class="num pink">${w.prs.length}</b></div></div>
  ${w.prs.length?`<div class="prlist">${w.prs.map(p=>`<div><span class="medal">🏆</span> ${esc(p.n)} · ${esc(p.kind)} <b class="num">${esc(String(p.v))}</b></div>`).join('')}</div>`:''}
  ${top.length?`<div class="mbars" style="margin-top:12px">${top.map(([m,v])=>`<div><span>${esc(m)}</span><i style="--w:${v/mx*100}%"></i><b class="num">${kgs(v)}</b></div>`).join('')}</div>`:''}
  <div class="bigbtns" style="margin-top:16px">${w.routineId?'<button class="btn" type="button" id="updR">update routine</button>':'<button class="btn" type="button" id="saveR">save as routine</button>'}<button class="btn p" type="button" id="sumOk">done</button></div>`);
  $('sumOk').onclick=closeSheet;
  if($('saveR'))$('saveR').onclick=()=>{ROUTINES.list.push(routineFrom(w));save('gym/routines',ROUTINES);closeSheet();flash('saved')};
  if($('updR'))$('updR').onclick=()=>{const r=ROUTINES.list.find(x=>x.id===w.routineId);if(r){const n=routineFrom(w);r.ex=n.ex}save('gym/routines',ROUTINES);closeSheet();flash('saved')};
}
function routineFrom(w){return {id:rid(),name:w.name,folder:'',ex:w.ex.map(x=>({id:exKey(x),n:exOf(x).n,sets:x.sets.filter(s=>s.t!=='w').length||x.sets.length,rest:x.rest??120,note:x.note||'',ss:x.ss||null}))}}

/* ---------- rest timer ---------- */
function startRest(sec){restTotal=sec;restEnd=Date.now()+sec*1000;LS.set('restEnd',restEnd);LS.set('restTotal',restTotal);renderRest();if(nOn('rest')){let nx='';try{for(const x of ACTIVE.ex){if(x.sets.some(s=>!s.done)){nx=exOf(x).n;break}}}catch(e){}pushOne('rest',restEnd,'rest over 💪',nx?'next: '+nx:'back to it','./#gym')}}
function renderRest(){const bar=$('restDock');if(!restEnd){bar.classList.remove('on');return}bar.classList.add('on')}
$('restDock').onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.rd==='skip'){restEnd=null;LS.set('restEnd',null);renderRest();pushCancel('rest');return}const d=+b.dataset.rd;restEnd=Math.max(Date.now()+1000,restEnd+d*1000);restTotal=Math.max(15,restTotal+d);LS.set('restEnd',restEnd);LS.set('restTotal',restTotal);if(nOn('rest'))pushOne('rest',restEnd,'rest over 💪','back to it','./#gym')};
function beep(){try{const A=window.AudioContext||window.webkitAudioContext;const a=new A();[0,.18,.36].forEach((t,i)=>{const o=a.createOscillator(),g=a.createGain();o.frequency.value=i===2?1320:880;g.gain.setValueAtTime(.0001,a.currentTime+t);g.gain.exponentialRampToValueAtTime(.25,a.currentTime+t+.01);g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+t+.15);o.connect(g);g.connect(a.destination);o.start(a.currentTime+t);o.stop(a.currentTime+t+.16)})}catch(e){}}
setInterval(()=>{
  if(ACTIVE&&!ACTIVE.editing&&$('wDur'))$('wDur').textContent=fmtDur(Date.now()-new Date(ACTIVE.startedAt));
  if(!restEnd)return;const l=Math.max(0,Math.round((restEnd-Date.now())/1000));$('restT').textContent=Math.floor(l/60)+':'+pad(l%60);$('restBar').style.width=Math.min(100,100-l/restTotal*100)+'%';$('restDock').classList.add('on');
  if(l===0){restEnd=null;LS.set('restEnd',null);$('restDock').classList.remove('on');flash('go');beep();try{navigator.vibrate&&navigator.vibrate([200,80,200])}catch(e){}}
},250);

/* ---------- routines (with folders) ---------- */
function renderRoutines(){const folders={};ROUTINES.list.forEach(r=>(folders[r.folder||'my routines']=folders[r.folder||'my routines']||[]).push(r));
  $('g-routines').innerHTML=`<div class="ph2"><span class="tag">${ROUTINES.list.length} routines</span><button class="btn p" type="button" data-r="new">+ new routine</button></div>
  ${Object.entries(folders).map(([f,rs])=>`<div class="fold"><span class="dim">${esc(f)} · ${rs.length}</span></div><div class="rgrid">${rs.map(r=>rCard(r,false)).join('')}</div>`).join('')||'<div class="dim">No routines yet.</div>'}`}
$('g-routines').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.r==='new')return editRoutine(null);
  if(b.dataset.rmenu)return routineMenu(b.dataset.rmenu);
  if(b.dataset.start){if(ACTIVE){flash('finish_current_first');return}startWorkout(ROUTINES.list.find(r=>r.id===b.dataset.start))}});
function routineMenu(id){const r=ROUTINES.list.find(x=>x.id===id);if(!r)return;
  openSheet(r.name,`<div class="optlist"><button class="opt" type="button" data-m="edit">✎ edit routine</button><button class="opt" type="button" data-m="dup">⧉ duplicate</button><button class="opt bad" type="button" data-m="del">✕ delete routine</button></div>`);
  $('sheetBody').onclick=e=>{const b=e.target.closest('[data-m]');if(!b)return;const m=b.dataset.m;
    if(m==='edit')return editRoutine(r);
    if(m==='dup'){ROUTINES.list.push({...clone(r),id:rid(),name:r.name+' (copy)'});save('gym/routines',ROUTINES);closeSheet();renderGym();return}
    if(m==='del'){if(b.dataset.arm){ROUTINES.list=ROUTINES.list.filter(x=>x.id!==id);save('gym/routines',ROUTINES);closeSheet();renderGym()}else{b.dataset.arm=1;b.textContent='tap again to delete'}}}}
function editRoutine(r){
  const R2=r?clone(r):{id:rid(),name:gymTypeFor()==='lower'?'Lower':'Upper',folder:'',ex:[]};const folders=[...new Set(ROUTINES.list.map(x=>x.folder).filter(Boolean))];
  const draw=()=>{openSheet(r?'edit routine':'new routine',`<input class="inp" id="rName" value="${esc(R2.name)}" aria-label="Routine name" style="font-size:18px;margin-bottom:8px">
    <input class="inp" id="rFolder" value="${esc(R2.folder||'')}" placeholder="folder (optional, e.g. PPL, cut block)" list="rFolders" style="margin-bottom:12px"><datalist id="rFolders">${folders.map(f=>`<option value="${esc(f)}">`).join('')}</datalist>
    <div class="rex">${R2.ex.map((x,i)=>{const e=exOf(x);return `<div class="rexrow">${thumb(e,'rth')}<span class="rexn">${esc(e.n)}</span><label class="dim">sets <input class="inp num" data-rs="${i}" value="${x.sets}" inputmode="numeric" style="width:46px"></label><label class="dim">reps <input class="inp num" data-rp="${i}" value="${esc(x.reps||'')}" placeholder="8-12" style="width:62px"></label><label class="dim">rest <select class="inp" data-rr="${i}">${[0,30,60,90,120,150,180,240,300].map(s=>`<option value="${s}" ${s===(x.rest??120)?'selected':''}>${s?mmss(s):'off'}</option>`).join('')}</select></label><span class="row" style="gap:4px"><button class="iconbtn" type="button" data-rm="${i}:-1">↑</button><button class="iconbtn" type="button" data-rm="${i}:1">↓</button><button class="iconbtn" type="button" data-rx="${i}">✕</button></span></div>`}).join('')||'<div class="dim" style="font-size:12px">Add the exercises you do in this session.</div>'}</div>
    <button class="addex" type="button" id="rAdd">+ add exercises</button>
    <div class="bigbtns" style="margin-top:14px"><span style="flex:1"></span><button class="btn" type="button" id="rCancel">cancel</button><button class="btn p" type="button" id="rSave">save routine</button></div>`);
    const sh=$('sheetBody');
    sh.oninput=e=>{const t=e.target;if(t.id==='rName')R2.name=t.value;if(t.id==='rFolder')R2.folder=t.value.trim();if(t.dataset.rs!=null)R2.ex[+t.dataset.rs].sets=Math.max(1,Math.min(12,parseInt(t.value)||1));if(t.dataset.rp!=null)R2.ex[+t.dataset.rp].reps=t.value;if(t.dataset.rr!=null)R2.ex[+t.dataset.rr].rest=+t.value};
    sh.onchange=sh.oninput;
    sh.onclick=e=>{const b=e.target.closest('button');if(!b)return;
      if(b.dataset.rm){const [i,d]=SXY(b.dataset.rm);const j=i+d;if(j>=0&&j<R2.ex.length){[R2.ex[i],R2.ex[j]]=[R2.ex[j],R2.ex[i]];draw()}}
      if(b.dataset.rx!=null){R2.ex.splice(+b.dataset.rx,1);draw()}
      if(b.id==='rAdd')pickExercises(list=>{list.forEach(n=>R2.ex.push({id:n.id,n:n.n,sets:3,rest:n.ty==='dur'||n.ty==='dd'?0:120,reps:'',note:''}));draw()},{back:draw});
      if(b.id==='rCancel')closeSheet();
      if(b.id==='rSave'){R2.name=(R2.name||'').trim()||'Routine';const i=ROUTINES.list.findIndex(x=>x.id===R2.id);if(i>=0)ROUTINES.list[i]=R2;else ROUTINES.list.push(R2);save('gym/routines',ROUTINES);closeSheet();renderGym();flash('saved')}};
  };draw();
}

/* ---------- exercise picker (multi-select, filters, images) ---------- */
function filterBar(st){return `<input class="inp" id="pkQ" placeholder="search ${EXMAP.size} exercises" autocomplete="off" value="${esc(st.q)}" style="margin-bottom:8px">
  <div class="row" style="gap:6px;margin-bottom:8px;flex-wrap:wrap"><select class="inp" id="pkM" style="flex:1;min-width:130px"><option value="">all muscles</option>${MUSCLES2.map(m=>`<option ${st.m===m?'selected':''}>${m}</option>`).join('')}</select><select class="inp" id="pkE" style="flex:1;min-width:130px"><option value="">all equipment</option>${EQUIP2.map(m=>`<option ${st.e===m?'selected':''}>${m}</option>`).join('')}</select></div>`}
function filteredEx(st){const q=norm(st.q);return allExList().filter(e=>(!st.m||e.pm.includes(st.m)||(st.m==='full body'&&e.pm.length>2))&&(!st.e||e.eq===st.e)&&(!q||q.split(' ').every(w=>norm(e.n).includes(w)))).sort((a,b)=>usedCount(b.id)-usedCount(a.id)||(b.custom?1:0)-(a.custom?1:0)||a.n.localeCompare(b.n))}
function exRow(e,sel){const u=usedCount(e.id);return `<button type="button" class="pickx${sel?' sel':''}" data-pick="${esc(e.id)}">${thumb(e)}<span class="pxn"><b>${esc(e.n)}</b><span class="dim">${esc(e.pm.join(', '))}${e.eq&&e.eq!=='other'?' · '+esc(e.eq):''}${u?' · '+u+'×':''}${e.custom?' · custom':''}</span></span><span class="pxc">${sel?'✓':''}</span></button>`}
async function pickExercises(cb,opt={}){await loadExDb();
  const st={q:'',m:'',e:''};const sel=[];
  const draw=()=>{const list=filteredEx(st).slice(0,250);$('pickList').innerHTML=list.map(e=>exRow(e,sel.includes(e.id))).join('')||'<div class="dim" style="padding:12px">No matches.</div>';
    $('pkGo').hidden=opt.single||!sel.length;$('pkGo').textContent=`add ${sel.length} exercise${sel.length>1?'s':''}`};
  openSheet(opt.single?'replace exercise':'add exercises',`${filterBar(st)}<div class="row" style="justify-content:flex-end;margin-bottom:6px"><button class="iconbtn" type="button" id="pkNew">+ create custom exercise</button></div><div class="picklist" id="pickList"></div><button class="btn p pkgo" type="button" id="pkGo" hidden></button>`);
  draw();
  $('pkQ').oninput=e=>{st.q=e.target.value;draw()};$('pkM').onchange=e=>{st.m=e.target.value;draw()};$('pkE').onchange=e=>{st.e=e.target.value;draw()};
  $('pkNew').onclick=()=>editCustom(null,ex=>{if(opt.single){closeSheet();cb([ex])}else{sel.push(ex.id);pickExercisesResume()}},st.q);
  const pickExercisesResume=()=>{openSheet('add exercises',`${filterBar(st)}<div class="row" style="justify-content:flex-end;margin-bottom:6px"><button class="iconbtn" type="button" id="pkNew">+ create custom exercise</button></div><div class="picklist" id="pickList"></div><button class="btn p pkgo" type="button" id="pkGo" hidden></button>`);bind();draw()};
  const bind=()=>{$('pkQ').oninput=e=>{st.q=e.target.value;draw()};$('pkM').onchange=e=>{st.m=e.target.value;draw()};$('pkE').onchange=e=>{st.e=e.target.value;draw()};
    $('pkNew').onclick=()=>editCustom(null,ex=>{sel.push(ex.id);pickExercisesResume()},st.q);
    $('pickList').onclick=e=>{const b=e.target.closest('[data-pick]');if(!b)return;const id=b.dataset.pick;if(opt.single){closeSheet();cb([EXMAP.get(id)]);return}const i=sel.indexOf(id);if(i>=0)sel.splice(i,1);else sel.push(id);draw()};
    $('pkGo').onclick=()=>{const list=sel.map(id=>EXMAP.get(id)).filter(Boolean);if(opt.back){cb(list)}else{closeSheet();cb(list)}}};
  bind();
}

/* ---------- custom exercises (with your own photo) ---------- */
function resizeImg(file,max=420){return new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>{const im=new Image();im.onload=()=>{const s=Math.min(1,max/Math.max(im.width,im.height));const c=document.createElement('canvas');c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);c.getContext('2d').drawImage(im,0,0,c.width,c.height);res(c.toDataURL('image/jpeg',.72))};im.onerror=rej;im.src=fr.result};fr.onerror=rej;fr.readAsDataURL(file)})}
function editCustom(id,done,preset){const ex=id?clone(EXMAP.get(id)):{id:'c-'+rid(),n:preset||'',pm:['chest'],sm:[],eq:'machine',ty:'wr',custom:1};let photo=id?PHOTOS[id]||'':'';
  const draw=()=>{openSheet(id?'edit exercise':'create exercise',`<div class="cxphoto">${photo?`<img src="${esc(photo)}" alt="">`:'<span class="dim">no photo</span>'}<label class="btn">${photo?'retake':'take photo of machine'}<input type="file" accept="image/*" capture="environment" id="cxCam" hidden></label>${photo?'<button class="iconbtn" type="button" id="cxNoPh">remove photo</button>':''}<label class="iconbtn">from library<input type="file" accept="image/*" id="cxLib" hidden></label></div>
    <input class="inp" id="cxN" value="${esc(ex.n)}" placeholder="exercise name" style="font-size:16px;margin:10px 0">
    <label class="dim">type <select class="inp" id="cxT">${Object.entries(XTYPES).map(([k,v])=>`<option value="${k}" ${ex.ty===k?'selected':''}>${v.l}</option>`).join('')}</select></label>
    <label class="dim">equipment <select class="inp" id="cxE">${EQUIP2.map(m=>`<option ${ex.eq===m?'selected':''}>${m}</option>`).join('')}</select></label>
    <label class="dim">primary muscle <select class="inp" id="cxP">${MUSCLES2.map(m=>`<option ${ex.pm[0]===m?'selected':''}>${m}</option>`).join('')}</select></label>
    <div class="dim" style="font-size:12px;margin:10px 0 4px">other muscles</div><div class="chips" id="cxS">${MUSCLES2.filter(m=>m!=='cardio'&&m!=='full body').map(m=>`<button class="chip" type="button" data-m="${m}" aria-pressed="${ex.sm.includes(m)}">${m}</button>`).join('')}</div>
    <div class="bigbtns" style="margin-top:12px">${id?'<button class="btn d" type="button" id="cxDel">delete</button>':''}<span style="flex:1"></span><button class="btn p" type="button" id="cxSave">save exercise</button></div>`);
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
  el.innerHTML=`<div class="row" style="justify-content:space-between;margin-bottom:8px"><span class="tag">${EXMAP.size} exercises</span><button class="btn p" type="button" id="libNew">+ custom exercise</button></div>${filterBar(LIBST).replace('id="pkQ"','id="libQ"').replace('id="pkM"','id="libM"').replace('id="pkE"','id="libE"')}<div class="picklist tall" id="libList"></div>`;
  const draw=()=>{$('libList').innerHTML=filteredEx(LIBST).slice(0,300).map(e=>exRow(e,false)).join('')};draw();
  $('libQ').oninput=e=>{LIBST.q=e.target.value;draw()};$('libM').onchange=e=>{LIBST.m=e.target.value;draw()};$('libE').onchange=e=>{LIBST.e=e.target.value;draw()};
  $('libNew').onclick=()=>editCustom(null,null,LIBST.q);
  $('libList').onclick=e=>{const b=e.target.closest('[data-pick]');if(b)openExercise(b.dataset.pick)}}

/* ---------- exercise detail: summary / history / charts / records ---------- */
let exAnim=null;
function openExercise(id,tab='summary'){const e=EXMAP.get(id)||exOf({id,n:id});const h=exHistory(e.id).reverse();const T=XTYPES[e.ty]||XTYPES.wr;const weighted=T.f.includes('kg');
  const tabs=['summary','history','charts','records'];
  const head=`<div class="exhero">${imgOf(e)?`<div class="exanim"><img id="exA" src="${esc(imgOf(e))}" alt="${esc(e.n)}"></div>`:''}<div><div class="dim">${esc(T.l)} · ${esc(e.eq||'')}</div><div><b>primary:</b> ${esc(e.pm.join(', '))}</div>${e.sm.length?`<div class="dim">secondary: ${esc(e.sm.join(', '))}</div>`:''}${e.custom?`<button class="iconbtn" type="button" id="exEdit" style="margin-top:6px">edit exercise</button>`:''}</div></div>
    <div class="seg" style="margin:10px 0" id="exTabs">${tabs.map(t=>`<button type="button" data-t="${t}" aria-pressed="${t===tab}">${t}</button>`).join('')}</div>`;
  let body='';
  if(tab==='summary'){const b=bests(e.id);body=`<div class="wstats big">${weighted?`<div><span class="dim">heaviest</span><b class="num">${b.kg?kgs(b.kg)+' kg':'—'}</b></div><div><span class="dim">best e1RM</span><b class="num">${b.e?kgs(Math.round(b.e*10)/10)+' kg':'—'}</b></div>`:`<div><span class="dim">most reps</span><b class="num">${b.reps||'—'}</b></div>`}<div><span class="dim">sessions</span><b class="num">${h.length}</b></div></div>
    ${e.how&&e.how.length?`<div class="tag" style="margin-top:14px">how to</div><ol class="howto">${e.how.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>`:''}`}
  if(tab==='history')body=h.slice().reverse().map(o=>`<div class="hx"><span class="dim">${esc(nice(o.w.date))} · ${esc(o.w.name)}</span><div class="hsets">${o.x.sets.filter(s=>s.done!==false).map((s,i,a)=>`<span class="set t-${s.t||'n'}">${setLabel(a,i)} · ${esc(fmtSet(o.x,s))}</span>`).join('')}</div>${o.x.note?`<div class="dim" style="font-size:12px">“${esc(o.x.note)}”</div>`:''}</div>`).join('')||'<div class="dim">Not logged yet.</div>';
  if(tab==='charts'){const metrics=weighted?[['e1rm','best est. 1RM'],['heavy','heaviest weight'],['setvol','best set volume'],['vol','session volume'],['reps','total reps']]:e.ty==='dur'?[['sec','longest time']]:e.ty==='dd'?[['km','distance'],['sec','time']]:[['best','most reps in a set'],['reps','total reps']];
    const m=openExercise.metric&&metrics.some(x=>x[0]===openExercise.metric)?openExercise.metric:metrics[0][0];
    const val=o=>{const ss=o.x.sets.filter(s=>s.done!==false&&s.t!=='w');const mx=f=>Math.max(0,...ss.map(f));return {e1rm:mx(e1),heavy:mx(s=>+s.kg||0),setvol:mx(s=>(+s.kg||0)*(+s.r||0)),vol:ss.reduce((a,s)=>a+(+s.kg||0)*(+s.r||0),0),reps:ss.reduce((a,s)=>a+(+s.r||0),0),best:mx(s=>+s.r||0),sec:mx(s=>+s.sec||0),km:mx(s=>+s.km||0)}[m]};
    const pts=h.map(val);body=`<div class="chips" id="exMet">${metrics.map(([k,l])=>`<button class="chip" type="button" data-k="${k}" aria-pressed="${k===m}">${l}</button>`).join('')}</div>${pts.length>1?spark(pts,{h:170,labels:[nice(h[0].w.date),nice(h[h.length-1].w.date)]}):'<div class="dim">Log this exercise twice to see a chart.</div>'}`}
  if(tab==='records'){const recs=[];if(weighted){const b=bests(e.id);recs.push(['estimated 1RM',b.e?kgs(Math.round(b.e*10)/10)+' kg':'—'],['heaviest weight',b.kg?kgs(b.kg)+' kg':'—'],['best set volume',b.vol?fmtVol(b.vol)+' kg':'—']);
      const bySess=Math.max(0,...h.map(o=>o.x.sets.filter(s=>s.t!=='w').reduce((a,s)=>a+(+s.kg||0)*(+s.r||0),0)));recs.push(['best session volume',bySess?fmtVol(bySess)+' kg':'—']);}
    const rr={};h.forEach(o=>o.x.sets.forEach(s=>{if(s.t==='w'||!(+s.r>0))return;const r=+s.r;if(r<=15)rr[r]=Math.max(rr[r]||0,+s.kg||0)}));
    body=`<div class="reclist">${recs.map(([k,v])=>`<div><span>${k}</span><b class="num">${v}</b></div>`).join('')}</div>${weighted&&Object.keys(rr).length?`<div class="tag" style="margin:14px 0 6px">rep records · best weight for</div><div class="reclist">${Object.entries(rr).sort((a,b)=>a[0]-b[0]).map(([r,kg])=>`<div><span>${r} rep${r>1?'s':''}</span><b class="num">${kgs(kg)} kg</b></div>`).join('')}</div>`:''}${!weighted?`<div class="reclist"><div><span>sessions</span><b class="num">${h.length}</b></div></div>`:''}`}
  openSheet(e.n,head+`<div id="exBody">${body}</div>`);
  $('exTabs').onclick=ev=>{const b=ev.target.closest('[data-t]');if(b)openExercise(e.id,b.dataset.t)};
  if($('exMet'))$('exMet').onclick=ev=>{const b=ev.target.closest('[data-k]');if(b){openExercise.metric=b.dataset.k;openExercise(e.id,'charts')}};
  if($('exEdit'))$('exEdit').onclick=()=>editCustom(e.id);
  clearInterval(exAnim);if(e.img&&e.img.length>1&&!e.custom){let i=0;exAnim=setInterval(()=>{const im=$('exA');if(!im||!$('sheet').classList.contains('on')){clearInterval(exAnim);return}i^=1;im.src=IMGBASE+e.img[i]},900)}
}

/* ---------- history: list + calendar ---------- */
function renderHistory(){const el=$('g-history');
  const head=`<div class="row" style="justify-content:space-between;margin-bottom:10px"><div class="seg" id="hMode"><button type="button" data-h="list" aria-pressed="${HIST_MODE==='list'}">list</button><button type="button" data-h="cal" aria-pressed="${HIST_MODE==='cal'}">calendar</button></div><span class="tag">${WORKOUTS.length} workouts</span></div>`;
  if(HIST_MODE==='list'){el.innerHTML=head+`<div class="wlist">${WORKOUTS.map(wCard).join('')||'<div class="dim">Finished workouts show up here.</div>'}</div>`}
  else{const base=HIST_MONTH?new Date(HIST_MONTH+'-01T12:00'):logical();const y=base.getFullYear(),mo=base.getMonth();const first=new Date(y,mo,1),days=new Date(y,mo+1,0).getDate();const off=(first.getDay()+6)%7;
    const byDay={};WORKOUTS.forEach(w=>(byDay[w.date]=byDay[w.date]||[]).push(w));const key=d=>`${y}-${pad(mo+1)}-${pad(d)}`;const inMonth=WORKOUTS.filter(w=>w.date.startsWith(`${y}-${pad(mo+1)}`));
    el.innerHTML=head+`<div class="panel"><div class="ph"><button class="iconbtn" type="button" data-cm="-1">‹</button><span class="tag">${first.toLocaleDateString('en-GB',{month:'long',year:'numeric'})} · ${inMonth.length} workouts</span><button class="iconbtn" type="button" data-cm="1">›</button></div><div class="pb"><div class="calg">${['m','t','w','t','f','s','s'].map(d=>`<span class="cdh">${d}</span>`).join('')}${'<span></span>'.repeat(off)}${Array.from({length:days},(_,i)=>{const k=key(i+1);const ws=byDay[k]||[];return `<button type="button" class="cday${ws.length?' on':''}${k===ymd(logical())?' today':''}" data-cday="${k}" ${ws.length?'':'disabled'}>${i+1}${ws.length?'<i></i>':''}</button>`}).join('')}</div></div></div>
    <div class="wlist" style="margin-top:10px">${inMonth.map(wCard).join('')}</div>`}
}
$('g-history').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.h){HIST_MODE=b.dataset.h;return renderHistory()}
  if(b.dataset.cm){const base=HIST_MONTH?new Date(HIST_MONTH+'-01T12:00'):logical();base.setMonth(base.getMonth()+ +b.dataset.cm);HIST_MONTH=`${base.getFullYear()}-${pad(base.getMonth()+1)}`;return renderHistory()}
  if(b.dataset.cday){const ws=WORKOUTS.filter(w=>w.date===b.dataset.cday);if(ws.length)openWorkout(ws[0].id)}});
$('v-gym').addEventListener('click',e=>{const c=e.target.closest('.wcard[data-w]');if(!c||e.target.closest('button'))return;openWorkout(c.dataset.w)});
function openWorkout(id){const w=WORKOUTS.find(x=>x.id===id);if(!w)return;
  openSheet(w.name,`<div class="dim" style="margin-bottom:10px">${esc(nice(w.date))}${w.endedAt&&w.startedAt?' · '+fmtDur(new Date(w.endedAt)-new Date(w.startedAt)):''} · ${fmtVol(w.vol||stats(w).vol)} kg · ${w.nsets||stats(w).n} sets</div>${(WPH[w.id]||[]).length?`<div class="swgal">${WPH[w.id].map(s=>`<img src="${s}" alt="">`).join('')}</div>`:''}${w.note?`<div class="dim" style="margin-bottom:10px">“${esc(w.note)}”</div>`:''}
  ${(w.ex||[]).map(x=>{const e=exOf(x);return `<div class="hx"><div class="row" style="gap:8px">${thumb(e,'rth')}<b>${esc(e.n)}</b>${x.ss?'<span class="chipy">superset</span>':''}</div>${x.note?`<span class="dim"> · ${esc(x.note)}</span>`:''}<div class="hsets">${x.sets.map((s,i)=>`<span class="set t-${s.t||'n'}">${setLabel(x.sets,i)} · ${esc(fmtSet(x,s))}</span>`).join('')}</div></div>`}).join('')}
  ${(w.prs||[]).length?`<div class="prlist">${w.prs.map(p=>`<div><span class="medal">🏆</span> ${esc(p.n)} · ${esc(p.kind)} <b class="num">${esc(String(p.v))}</b></div>`).join('')}</div>`:''}
  <div class="bigbtns" style="margin-top:14px"><button class="btn d" type="button" id="wDel">delete</button><button class="btn" type="button" id="wEdit">edit</button><span style="flex:1"></span><button class="btn" type="button" id="wRoutine">save as routine</button><button class="btn p" type="button" id="wRepeat">repeat</button></div>`);
  $('wDel').onclick=function(){if(this.dataset.arm){removeDoc('gym/w-'+w.id);if(WPH[w.id]){removeDoc('gym/wp-'+w.id);delete WPH[w.id]}WORKOUTS=WORKOUTS.filter(x=>x.id!==w.id);recountUsed();closeSheet();renderGym()}else{this.dataset.arm=1;this.textContent='tap again'}};
  $('wEdit').onclick=()=>editWorkout(w);
  $('wRoutine').onclick=()=>{ROUTINES.list.push(routineFrom(w));save('gym/routines',ROUTINES);closeSheet();flash('saved')};
  $('wRepeat').onclick=()=>{if(ACTIVE){flash('finish_current_first');return}closeSheet();startWorkout({id:null,...routineFrom(w),id:null})};
}

/* ---------- statistics ---------- */
function muscleSets(ws){const m={};ws.forEach(w=>(w.ex||[]).forEach(x=>{const e=exOf(x);const n=x.sets.filter(s=>s.done!==false&&s.t!=='w').length;e.pm.forEach(p=>m[p]=(m[p]||0)+n);e.sm.forEach(p=>m[p]=(m[p]||0)+n*.5)}));return m}
function weekKeyN(n){const out=[];const now=logical();for(let i=n-1;i>=0;i--){const d=new Date(now);d.setDate(d.getDate()-i*7);out.push(isoWeek(d))}return out}
function streakWeeks(){const have=new Set(WORKOUTS.map(w=>isoWeek(new Date(w.date+'T12:00'))));let s=0;const now=logical();for(let i=0;i<260;i++){const d=new Date(now);d.setDate(d.getDate()-i*7);const k=isoWeek(d);if(have.has(k))s++;else if(i>0)break}return s}
function bodyMap(m){const mx=Math.max(1,...Object.values(m));const c=k=>{const v=(m[k]||0)/mx;return v?`rgba(255,42,109,${.18+.82*v})`:'#1b1b1f'};
  const F=[['shoulders','M38 44h12v14H36zM70 44h12l2 14H70z'],['chest','M50 44h20v18H50z'],['biceps','M34 60h10v18H33zM76 60h10l1 18H76z'],['forearms','M31 80h10l-2 22h-9zM79 80h10l1 22h-9z'],['abs','M51 64h18v30H51z'],['quads','M47 100h12l-1 40H46zM61 100h12l1 40H62z'],['adductors','M58 100h4v26h-4z'],['calves','M47 146h10l-1 34h-8zM63 146h10l-1 34h-8z']];
  const B=[['traps','M50 38h20l4 8H46z'],['shoulders','M36 44h12v12H35zM72 44h12l1 12H72z'],['upper back','M50 48h20v14H50z'],['lats','M46 62h10l-2 20h-8zM64 62h10l-2 20h-8z'],['triceps','M34 60h10v18H33zM76 60h10l1 18H76z'],['lower back','M53 82h14v12H53z'],['glutes','M48 96h24v14H48z'],['hamstrings','M47 112h12l-1 30H46zM61 112h12l1 30H62z'],['calves','M47 146h10l-1 34h-8zM63 146h10l-1 34h-8z']];
  const sil='<circle cx="60" cy="24" r="10" fill="#141418"/>';const draw=(arr)=>sil+arr.map(([k,d])=>`<path d="${d}" fill="${c(k)}" stroke="#000" stroke-width=".6"><title>${k}: ${kgs(m[k]||0)} sets</title></path>`).join('');
  return `<div class="bodymap"><svg viewBox="20 8 80 180"><text x="60" y="186" fill="#555" font-size="6" text-anchor="middle">front</text>${draw(F)}</svg><svg viewBox="20 8 80 180"><text x="60" y="186" fill="#555" font-size="6" text-anchor="middle">back</text>${draw(B)}</svg></div>`}
function renderStats(){const el=$('g-stats');const weeks=weekKeyN(STAT_P);const since=weeks[0];
  const ws=WORKOUTS.filter(w=>isoWeek(new Date(w.date+'T12:00'))>=since);
  const per=weeks.map(k=>WORKOUTS.filter(w=>isoWeek(new Date(w.date+'T12:00'))===k));
  const val=a=>({volume:a.reduce((s,w)=>s+(w.vol||stats(w).vol),0),sets:a.reduce((s,w)=>s+(w.nsets||stats(w).n),0),duration:a.reduce((s,w)=>s+(w.endedAt&&w.startedAt?(new Date(w.endedAt)-new Date(w.startedAt))/60000:0),0),workouts:a.length})[STAT_M];
  const vals=per.map(val);const mx=Math.max(1,...vals);
  const tot={w:ws.length,vol:ws.reduce((s,w)=>s+(w.vol||stats(w).vol),0),sets:ws.reduce((s,w)=>s+(w.nsets||stats(w).n),0),dur:ws.reduce((s,w)=>s+(w.endedAt&&w.startedAt?(new Date(w.endedAt)-new Date(w.startedAt)):0),0)};
  const m30=muscleSets(WORKOUTS.filter(w=>(Date.now()-new Date(w.date+'T12:00'))<30*864e5));const mList=Object.entries(m30).filter(([k])=>k!=='other').sort((a,b)=>b[1]-a[1]);const mmx=Math.max(1,...mList.map(x=>x[1]));
  const recs=[...new Set(WORKOUTS.flatMap(w=>(w.ex||[]).map(exKey)))].map(id=>{const e=EXMAP.get(id)||exOf({id});const b=bests(id);return {e,b}}).filter(o=>o.b.e>0).sort((a,b)=>b.b.e-a.b.e).slice(0,10);
  el.innerHTML=`<div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px"><div class="seg" id="stP">${[[4,'4 weeks'],[12,'3 months'],[52,'1 year']].map(([n,l])=>`<button type="button" data-p="${n}" aria-pressed="${STAT_P===n}">${l}</button>`).join('')}</div><span class="tag">🔥 ${streakWeeks()} week streak</span></div>
  <div class="statcards"><div><span class="dim">workouts</span><b class="num">${tot.w}</b></div><div><span class="dim">volume</span><b class="num">${fmtVol(tot.vol)}<small> kg</small></b></div><div><span class="dim">sets</span><b class="num">${tot.sets}</b></div><div><span class="dim">time</span><b class="num">${Math.round(tot.dur/3600000)}<small> h</small></b></div><div><span class="dim">avg / week</span><b class="num">${(tot.w/STAT_P).toFixed(1)}</b></div></div>
  <div class="panel" style="margin-top:12px"><div class="ph"><span class="tag">per week</span><div class="chips" id="stM" style="margin:0">${['volume','sets','duration','workouts'].map(k=>`<button class="chip" type="button" data-m="${k}" aria-pressed="${STAT_M===k}">${k}</button>`).join('')}</div></div><div class="pb"><div class="wkbars" style="grid-template-columns:repeat(${weeks.length},1fr)">${vals.map((v,i)=>`<div class="d"><span class="p num">${v?(STAT_M==='volume'?Math.round(v/1000)+'k':Math.round(v)):''}</span><div class="b" style="height:${v/mx*100}%"></div><span class="l">${weeks.length<=12||i%4===0?weeks[i].slice(-3).toLowerCase():''}</span></div>`).join('')}</div></div></div>
  <div class="statsplit"><div class="panel"><div class="ph"><span class="tag">muscles · last 30 days</span><span class="dim">sets</span></div><div class="pb">${bodyMap(m30)}<div class="mbars">${mList.map(([m,v])=>`<div><span>${esc(m)}</span><i style="--w:${v/mmx*100}%"></i><b class="num">${kgs(v)}</b></div>`).join('')||'<span class="dim">No sets in the last 30 days.</span>'}</div></div></div>
  <div class="panel"><div class="ph"><span class="tag">strength · best est. 1RM</span></div><div class="pb"><div class="reclist">${recs.map(o=>`<button type="button" data-ex="${esc(o.e.id)}"><span>${thumb(o.e,'rth')} ${esc(o.e.n)}</span><b class="num">${kgs(Math.round(o.b.e*10)/10)} kg</b></button>`).join('')||'<span class="dim">Log some weighted sets to see records.</span>'}</div></div></div></div>`;
  if(FX)el.querySelectorAll('.wkbars .b').forEach((b,i)=>b.animate([{transform:'scaleY(0)'},{transform:'scaleY(1)'}],{duration:600,delay:i*30,easing:'cubic-bezier(.2,.9,.1,1)',fill:'backwards'}));
}
$('g-stats').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.p){STAT_P=+b.dataset.p;renderStats()}if(b.dataset.m){STAT_M=b.dataset.m;renderStats()}if(b.dataset.ex)openExercise(b.dataset.ex)});

/* --- bottom sheet used by gym + journal --- */
let sheetStack=0;
function openSheet(title,html){$('sheetTitle').textContent=title;$('sheetBody').innerHTML=html;$('sheetBody').oninput=null;$('sheetBody').onclick=null;$('sheetBody').onchange=null;$('sheet').classList.add('on');$('sheet').setAttribute('aria-hidden','false');$('scrim').classList.add('on');sheetStack=1;$('sheetBody').scrollTop=0}
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


/* ================= TOOLS: focus · protocols · leetcode ================= */
let lc=0,WK=isoWeek(logical()),SET={},TOOLV=LS.get('toolv')||'focus';
function renderTools(){
  $('toolSeg').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.t===TOOLV));
  ['focus','protocols','leetcode'].forEach(v=>$('t-'+v).hidden=v!==TOOLV);
  $('toolsSub').textContent=nice(DAYK).toLowerCase();
  if(TOOLV==='focus')renderFocus();else if(TOOLV==='protocols')renderProto();else renderLeet();
  toolCardSubs();
}
function toolCardSubs(){const dw=DAY.dw||0;$('tcFocus').textContent=`${Math.floor(dw/60)}h ${pad(dw%60)}m today`;
  if(typeof protoDueCount==='function'){const n=protoDueCount();$('tcProto').textContent=n?`${n} due today`:'nothing due'}
  if(typeof leetWeek==='function')$('tcLeet').textContent=`${leetWeek()} solved this week`}
$('toolSeg').onclick=e=>{const b=e.target.closest('[data-t]');if(!b)return;TOOLV=b.dataset.t;LS.set('toolv',TOOLV);renderTools();staggerIn($('t-'+TOOLV))};

/* ---------------- FOCUS ---------------- */
let TM=LS.get('timer')||{len:90,end:null,left:90*60};if(!TM.phase)TM.phase='focus';
let FOCUS={sessions:[],pomo:false,brk:10,task:''},MUSIC={list:[],cur:null,vol:60,shuffle:false};
const DW_TARGET=260;
function tmLeft(){return TM.end?Math.max(0,Math.round((TM.end-Date.now())/1000)):TM.left}
function tmTotal(){return (TM.phase==='break'?FOCUS.brk:TM.len)*60}
function logDw(minutes,task){if(minutes<1)return;DAY.dw=(DAY.dw||0)+minutes;persistDay();FOCUS.sessions.unshift({d:DAYK,at:new Date().toISOString(),min:minutes,task:task||FOCUS.task||''});FOCUS.sessions=FOCUS.sessions.slice(0,600);save('tools/focus',FOCUS);if(TOOLV==='focus'&&cur==='tools')renderFocus();toolCardSubs()}
function renderFocus(){const el=$('t-focus');if(!el)return;const live=YTP&&$('mBox')&&el.contains($('mBox'))?$('mBox').closest('.panel'):null;
  const today=FOCUS.sessions.filter(s=>s.d===DAYK);const dw=DAY.dw||0;
  const days=[...Array(7)].map((_,i)=>addDays(DAYK,i-6));const per=days.map(d=>FOCUS.sessions.filter(s=>s.d===d).reduce((a,s)=>a+s.min,0)+(d===DAYK?0:0));per[6]=Math.max(per[6],dw);const mx=Math.max(DW_TARGET,...per);
  const html=`<div class="focusgrid">
  <div class="panel fcard"><div class="ph"><span class="tag" id="fPhase">${TM.phase==='break'?'break':'focus'}</span><span class="row" style="gap:6px"><button class="iconbtn" type="button" id="fPomo" aria-pressed="${FOCUS.pomo}">auto-break ${FOCUS.pomo?'on':'off'}</button><button class="iconbtn" type="button" id="fFull">⤢ focus mode</button></span></div><div class="pb">
    <input class="fintent" id="fTask" placeholder="what are you working on?" value="${esc(FOCUS.task||'')}">
    <div class="fring"><svg viewBox="0 0 220 220"><circle cx="110" cy="110" r="100" class="rbg"/><circle cx="110" cy="110" r="100" class="rfg" id="fRing"/></svg><div class="ftime num" id="timer">--:--</div></div>
    <div class="seg fpresets" id="tmPresets">${[90,75,50,25].map(m=>`<button type="button" data-m="${m}">${m}</button>`).join('')}<button type="button" data-m="custom">…</button></div>
    <div class="bigbtns" style="margin-top:14px;justify-content:center"><button class="btn p fbig" type="button" id="tmGo">start</button><button class="btn" type="button" id="tmReset">stop + log</button></div>
    <div style="margin-top:16px"><div class="dim" style="font-size:11px;margin-bottom:4px">deep work today · ${Math.floor(dw/60)}h ${pad(dw%60)}m of ${Math.floor(DW_TARGET/60)}h ${pad(DW_TARGET%60)}m</div><div class="meter"><span style="width:${Math.min(100,dw/DW_TARGET*100)}%"></span></div></div>
  </div></div>
  <div class="fside">
    <div class="panel"><div class="ph"><span class="tag">audio deck</span></div><div class="pb${MUSIC.showVid?' showvid':''}" id="mBox">${musicHTML()}</div></div>
    <div class="panel"><div class="ph"><span class="tag">ambient</span><span class="dim">generated on device</span></div><div class="pb"><div class="chips" id="ambBtns" style="margin:0 0 8px">${['rain','brown','pink','white','cafe'].map(k=>`<button class="chip" type="button" data-amb="${k}" aria-pressed="${AMB.kind===k}">${k}</button>`).join('')}</div><input type="range" id="ambVol" min="0" max="100" value="${AMB.vol}" class="vol"></div></div>
    <div class="panel"><div class="ph"><span class="tag">last 7 days</span><span class="dim">${today.length} session${today.length===1?'':'s'} today</span></div><div class="pb"><div class="wkbars" style="grid-template-columns:repeat(7,1fr);height:100px">${per.map((v,i)=>`<div class="d"><span class="p num">${v?Math.round(v/6)/10+'h':''}</span><div class="b" style="height:${v/mx*100}%"></div><span class="l">${new Date(days[i]+'T12:00').toLocaleDateString('en-GB',{weekday:'short'}).toLowerCase()}</span></div>`).join('')}</div>
      <div class="flog">${today.map(s=>`<div><span class="num">${new Date(s.at).toTimeString().slice(0,5)}</span><span>${esc(s.task||'focus')}</span><b class="num">${s.min}m</b></div>`).join('')}</div></div></div>
  </div></div>`;
  if(live){/* swap in everything except the audio deck, so whatever is playing keeps playing */
    const tmp=document.createElement('div');tmp.innerHTML=html;const fresh=tmp.querySelector('#mBox').closest('.panel');fresh.replaceWith(document.createComment('deck'));
    const oldGrid=el.querySelector('.focusgrid');const newGrid=tmp.querySelector('.focusgrid');
    oldGrid.querySelector('.fcard').replaceWith(newGrid.querySelector('.fcard'));
    const side=oldGrid.querySelector('.fside');[...side.children].forEach(ch=>{if(ch!==live)ch.remove()});[...newGrid.querySelector('.fside').childNodes].forEach(n=>{if(n.nodeType===8)side.appendChild(live);else side.appendChild(n)});
  }else el.innerHTML=html;
  drawTimer();bindFocus(!!live);
}
function bindFocus(keepDeck){
  $('tmGo').onclick=()=>{if(TM.end){TM.left=tmLeft();TM.end=null;pushCancel('focus')}else{TM.end=Date.now()+TM.left*1000;if(nOn('focus'))pushOne('focus',TM.end,TM.phase==='break'?'break over':'focus session done ✓',TM.phase==='break'?'back to work':(FOCUS.task||'take a break'),'./#tools')}LS.set('timer',TM);drawTimer();glitchAll()};
  $('tmReset').onclick=()=>{if(TM.phase==='focus'){const done=Math.floor((TM.len*60-tmLeft())/60);logDw(done)}TM={len:TM.len,end:null,left:TM.len*60,phase:'focus'};LS.set('timer',TM);drawTimer()};
  $('tmPresets').onclick=e=>{const b=e.target.closest('button');if(!b)return;let m=b.dataset.m;if(m==='custom'){m=parseInt(prompt('Minutes?',TM.len)||'');if(!(m>0))return}TM={len:+m,end:null,left:+m*60,phase:'focus'};LS.set('timer',TM);drawTimer()};
  $('fTask').oninput=e=>{FOCUS.task=e.target.value;clearTimeout(bindFocus.t);bindFocus.t=setTimeout(()=>save('tools/focus',FOCUS),600)};
  $('fPomo').onclick=()=>{FOCUS.pomo=!FOCUS.pomo;save('tools/focus',FOCUS);renderFocus()};
  $('fFull').onclick=openFocusMode;
  $('mBox').onclick=musicClick;vizAttach($('vizC'));
  $('ambBtns').onclick=e=>{const b=e.target.closest('[data-amb]');if(!b)return;ambient(AMB.kind===b.dataset.amb?null:b.dataset.amb);$('ambBtns').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x.dataset.amb===AMB.kind))};
  $('ambVol').oninput=e=>{AMB.vol=+e.target.value;LS.set('amb',{vol:AMB.vol});if(AMB.g)AMB.g.gain.value=AMB.vol/100*.6};
  if(deckSrc()&&!keepDeck)ensureYT();
}
function drawTimer(){const l=tmLeft();const tot=tmTotal();const txt=pad(Math.floor(l/60))+':'+pad(l%60);
  ['timer','fmTime'].forEach(id=>{const t=$(id);if(t){t.textContent=txt;t.classList.toggle('run',!!TM.end)}});
  const ring=$('fRing');if(ring){const C=628.3;ring.style.strokeDasharray=C;ring.style.strokeDashoffset=C*(l/tot);ring.classList.toggle('brk',TM.phase==='break')}
  if($('tmGo'))$('tmGo').textContent=TM.end?'pause':(l<tot?'resume':'start');if($('fmGo'))$('fmGo').textContent=TM.end?'pause':'start';
  if($('fPhase'))$('fPhase').textContent=TM.phase==='break'?'break':'focus';
  if($('tmPresets'))$('tmPresets').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.m===TM.len));
  if(TM.end&&l===0){chime();if(TM.phase==='focus'){logDw(TM.len);flash('block_done');shake();burst(innerWidth/2,innerHeight/2,160,true);
      TM=FOCUS.pomo?{len:TM.len,phase:'break',left:FOCUS.brk*60,end:Date.now()+FOCUS.brk*60*1000}:{len:TM.len,end:null,left:TM.len*60,phase:'focus'}}
    else{flash('back_to_work');TM={len:TM.len,end:null,left:TM.len*60,phase:'focus'}}LS.set('timer',TM);drawTimer()}}
setInterval(drawTimer,1000);
function chime(){try{const A=window.AudioContext||window.webkitAudioContext;const a=new A();[523,659,784,1046].forEach((f,i)=>{const o=a.createOscillator(),g=a.createGain();o.type='sine';o.frequency.value=f;const t=a.currentTime+i*.14;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.2,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+.9);o.connect(g);g.connect(a.destination);o.start(t);o.stop(t+1)})}catch(e){}try{navigator.vibrate&&navigator.vibrate([200,80,200])}catch(e){}}

/* focus mode (full screen) */
function openFocusMode(){let fm=$('focusMode');if(!fm){fm=document.createElement('div');fm.id='focusMode';fm.className='focusmode';document.body.appendChild(fm)}
  fm.innerHTML=`<button class="iconbtn fmx" type="button" id="fmX">exit</button><div class="fmtask">${esc(FOCUS.task||'deep work')}</div>${DECKS[deckNow()].audio&&deckSrc()?'<canvas class="viz fmviz" id="fmViz"></canvas>':''}<div class="fmtime num" id="fmTime"></div><div class="bigbtns" style="justify-content:center"><button class="btn p" type="button" id="fmGo">start</button>${deckSrc()?'<button class="btn" type="button" id="fmMus">⏯ audio</button>':''}</div><div class="fmnow" id="fmNow"></div>`;
  fm.classList.add('on');try{fm.requestFullscreen&&fm.requestFullscreen().catch(()=>{})}catch(e){}
  $('fmX').onclick=()=>{fm.classList.remove('on');try{document.fullscreenElement&&document.exitFullscreen()}catch(e){}};
  $('fmGo').onclick=()=>$('tmGo')?$('tmGo').click():null;if($('fmMus'))$('fmMus').onclick=()=>ytToggle();drawTimer();ytNow();vizAttach($('fmViz'))}

/* music deck: lofi / asmr (audio + visualiser) · jvscholz (random livestream, video) · mine (other playlists) */
const SCHOLZ='UULVMwo6hT5hI3R56rO2HYP-wQ'; /* James Scholz — live streams uploads list */
const DECKS={lofi:{label:'lofi',sub:'your lofi playlist',audio:true},asmr:{label:'asmr',sub:'your asmr picks (private)',audio:true,random:true},scholz:{label:'jvscholz',sub:'random old pomodoro stream',audio:false,random:true},mine:{label:'custom',sub:'your other playlists',audio:true}};
let VLIST={},VHIST=[];const DSEEN=new Set();
function ytPlaying(){try{return !!YTP&&YTP.getPlayerState()===1}catch(e){return false}}
/* remember exactly where each deck was, so switching away and back carries on */
function savePos(){try{const s=deckSrc();if(!YTP||!s||s.deck==='mine')return;const v=(YTP.getVideoData()||{}).video_id,t=YTP.getCurrentTime();if(v){DPOS[s.deck]={key:s.key,v,t};LS.set('deckpos',DPOS)}}catch(e){}}
let YTP=null,ytReady=false,ytLoading=false,ytQ=null,ytTries=0;
const DPOS=LS.get('deckpos')||{};
function parseYT(url){try{const u=new URL(url.trim());const list=u.searchParams.get('list');let v=u.searchParams.get('v');if(!v&&/youtu\.be$/.test(u.hostname))v=u.pathname.slice(1);if(!v&&u.pathname.startsWith('/shorts/'))v=u.pathname.split('/')[2];return list?{type:'list',key:list,v}:v?{type:'video',key:v}:null}catch(e){return null}}
const deckNow=()=>DECKS[MUSIC.deck]?MUSIC.deck:'lofi';
function deckSrc(){const d=deckNow();if((d==='asmr'||d==='lofi')&&VLIST[d]&&VLIST[d].length)return {type:'vids',key:d+'-vids',ids:VLIST[d],deck:d};if(d==='mine'){const s=MUSIC.list.find(x=>x.id===MUSIC.cur);return s?{...s,deck:'mine'}:null}const l=d==='scholz'?SCHOLZ:(MUSIC.decks||{})[d];return l?{type:'list',key:l,deck:d}:null}
function openMode(d){return (MUSIC.open||{})[d]||(d==='scholz'?'random':'resume')}
function musicHTML(){const d=deckNow(),D=DECKS[d],src=deckSrc();
  const seg=`<div class="seg deckseg" id="deckSeg">${Object.keys(DECKS).map(k=>`<button type="button" data-deck="${k}" aria-pressed="${k===d}">${DECKS[k].label}</button>`).join('')}</div>`;
  if(!src&&d!=='mine')return seg+`<div class="dsetup"><div class="dim">Paste your ${D.label} playlist link. It has to be <b>Public</b> or <b>Unlisted</b> on YouTube — private playlists won't play outside YouTube. The link is saved to your account only, not the app's code.</div><div class="row" style="gap:6px;margin-top:8px"><input class="inp" id="dkUrl" placeholder="https://music.youtube.com/playlist?list=…" style="flex:1"><button class="btn p" type="button" id="dkSave">set</button></div></div>`;
  const mine=d==='mine'?`<div class="mlist">${MUSIC.list.map(s=>`<div class="mstn${s.id===MUSIC.cur?' on':''}"><button type="button" data-ms="${esc(s.id)}"><span class="mthumb" style="background-image:url(${s.thumb?esc(s.thumb):''})"></span><span>${esc(s.name)}</span></button><button class="iconbtn" type="button" data-mdel="${esc(s.id)}" aria-label="Remove">✕</button></div>`).join('')}</div><button class="iconbtn" type="button" id="mAdd" style="margin-top:8px">+ add playlist</button>`:'';
  if(!src)return seg+mine;
  const om=openMode(d);
  return seg+`<div class="deck ${D.audio?'aud':'vid'}"><div class="dscreen">${D.audio?`<canvas class="viz" id="vizC"></canvas><div class="dhud"><span id="dHudL">> ${esc(D.label)}.stream</span><span id="dHudR" class="num"></span></div>`:''}<div class="mvid${D.audio?' mini':''}" id="mVidBox"><div id="ytFrame"></div></div></div>
    <div class="mmeta"><b id="mTitle">loading…</b><span class="dim" id="mArtist"></span><div class="mprog seek" id="mSeek"><i id="mBar"></i><b id="mKnob"></b></div><div class="row" style="justify-content:space-between"><span class="dim num" id="mTime" style="font-size:10px"></span><span class="dim num" id="mIdx" style="font-size:10px"></span></div>
    <div class="mctl"><button type="button" data-mc="prev" aria-label="Previous">⏮</button><button type="button" data-mc="play" class="mplay" id="mPlay" aria-label="Play">▶</button><button type="button" data-mc="next" aria-label="Next">⏭</button>${d==='mine'?`<button type="button" data-mc="shuf" aria-pressed="${MUSIC.shuffle}" aria-label="Shuffle">⤮</button>`:''}<input type="range" min="0" max="100" value="${MUSIC.vol}" id="mVol" class="vol" aria-label="Volume"></div>
    <div class="mskip"><button type="button" data-sk="-10">−10s</button><button type="button" data-sk="30">+30s</button><button type="button" data-sk="120">+2m</button><button type="button" data-sk="300">+5m</button></div>
    ${d!=='mine'?`<div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap"><span class="dim" style="font-size:10px">on open:</span><div class="seg mini" id="dkOpen"><button type="button" data-om="resume" aria-pressed="${om==='resume'}">resume</button><button type="button" data-om="random" aria-pressed="${om==='random'}">random</button></div>${D.audio?`<button class="iconbtn" type="button" id="dkVid">${MUSIC.showVid?'hide':'show'} video</button>`:''}${d==='lofi'&&src.type!=='vids'?`<button class="iconbtn" type="button" id="dkEdit">change playlist</button>`:''}</div>`:''}</div></div>`+mine}
function addStation(){openEditor({title:'add playlist',fields:[{k:'url',label:'YouTube Music / YouTube link'},{k:'name',label:'name (optional)'}],values:{url:'',name:''},isNew:true,
  hint:'Open the playlist in YouTube Music → Share → Copy link, and paste it here.',onSave:v=>{const p=parseYT(v.url||'');if(!p){flash('not_a_youtube_link');return}
    const s={id:rid(),name:(v.name||'').trim()||(p.type==='list'?'playlist':'track'),...p,thumb:p.v||p.type==='video'?`https://i.ytimg.com/vi/${p.v||p.key}/hqdefault.jpg`:''};MUSIC.list.push(s);MUSIC.cur=s.id;MUSIC.deck='mine';save('tools/music',MUSIC);renderFocus()}})}
function musicRender(play,mode){if(!$('mBox'))return;try{YTP&&YTP.destroy()}catch(e){}YTP=null;ytReady=false;if($('deckSub'))$('deckSub').textContent=DECKS[deckNow()].sub;$('mBox').innerHTML=musicHTML();$('mBox').classList.toggle('showvid',!!MUSIC.showVid);vizAttach($('vizC'));ensureYT(play,mode)}
function musicClick(e){const b=e.target.closest('button');if(!b)return;
  if(b.dataset.sk&&YTP){try{const t=YTP.getCurrentTime()+(+b.dataset.sk);YTP.seekTo(Math.max(0,Math.min(t,YTP.getDuration()-1)),true)}catch(x){}return}
  if(b.dataset.deck){if(b.dataset.deck===deckNow())return;const was=ytPlaying();savePos();MUSIC.deck=b.dataset.deck;save('tools/music',MUSIC);musicRender(was,DSEEN.has(MUSIC.deck)?'resume':undefined);return}
  if(b.id==='mAdd')return addStation();
  if(b.id==='dkSave'){const p=parseYT($('dkUrl').value||'');if(!p||p.type!=='list'){flash('paste_a_playlist_link');return}MUSIC.decks={...(MUSIC.decks||{}),[deckNow()]:p.key};delete DPOS[deckNow()];LS.set('deckpos',DPOS);save('tools/music',MUSIC);musicRender(false);return}
  if(b.id==='dkEdit'){const d=deckNow();const old=(MUSIC.decks||{})[d];MUSIC.decks={...MUSIC.decks};delete MUSIC.decks[d];musicRender(false);if(old)$('dkUrl').value='https://music.youtube.com/playlist?list='+old;MUSIC.decks[d]=old;return}
  if(b.id==='dkVid'){MUSIC.showVid=!MUSIC.showVid;$('mBox').classList.toggle('showvid',MUSIC.showVid);b.textContent=(MUSIC.showVid?'hide':'show')+' video';save('tools/music',MUSIC);return}
  if(b.dataset.om){MUSIC.open={...(MUSIC.open||{}),[deckNow()]:b.dataset.om};$('dkOpen').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b));save('tools/music',MUSIC);return}
  if(b.dataset.ms){MUSIC.cur=b.dataset.ms;save('tools/music',MUSIC);musicRender(true);return}
  if(b.dataset.mdel){if(!b.dataset.arm){b.dataset.arm=1;b.textContent='?';return}MUSIC.list=MUSIC.list.filter(x=>x.id!==b.dataset.mdel);if(MUSIC.cur===b.dataset.mdel)MUSIC.cur=null;save('tools/music',MUSIC);musicRender(false);return}
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
function ytToggle(){if(!YTP||!YTP.getPlayerState)return;const st=YTP.getPlayerState();if(st===1){YTP.pauseVideo();return}YTP.playVideo();ytKick()}
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
  if($('mTitle'))$('mTitle').textContent=d.title||(st===-1||st===5?'ready':'loading…');if($('mArtist'))$('mArtist').textContent=d.author||'';if($('mPlay'))$('mPlay').textContent=st===1?'⏸':'▶';if($('fmMus'))$('fmMus').textContent=st===1?'⏸ audio':'▶ audio';
  try{const ids=ytVids();if(ids&&$('mIdx')){const i=ids.indexOf(d.video_id);$('mIdx').textContent=(i>=0?'#'+(i+1)+' / ':'')+ids.length}const pl=YTP.getPlaylist&&YTP.getPlaylist();if(pl&&pl.length&&$('mIdx'))$('mIdx').textContent='#'+(YTP.getPlaylistIndex()+1)+' / '+pl.length}catch(e){}
  if($('fmNow'))$('fmNow').textContent=d.title?'♪ '+d.title+(d.author?' — '+d.author:''):'';
  const s=deckSrc();if(s&&s.deck==='mine'&&d.video_id){const m=MUSIC.list.find(x=>x.id===s.id);if(m&&!m.thumb){m.thumb=`https://i.ytimg.com/vi/${d.video_id}/hqdefault.jpg`;save('tools/music',MUSIC)}}}
setInterval(()=>{if(!YTP||!YTP.getCurrentTime||!ytReady)return;try{const t=YTP.getCurrentTime(),du=YTP.getDuration();if($('mBar')&&!mSeekDrag){$('mBar').style.width=(du?t/du*100:0)+'%';$('mKnob').style.left=(du?t/du*100:0)+'%'}if($('mTime'))$('mTime').textContent=fmtT(t)+' / '+fmtT(du);if($('dHudR'))$('dHudR').textContent=(YTP.getPlayerState()===1?'▶ ':'❚❚ ')+fmtT(t);
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

/* ================= PROTOCOLS — compound / peptide tracker ================= */
/* data: tools/protocols {list:[compound]}, tools/protolog {logs:[{id,cid,at,amt,unit,site,note}]} */
let PROTO={list:[]},PLOG={logs:[]},PROTOV='today',PROTO_SEL=null;
const UNITS=['mcg','mg','IU','ml','units','caps','tabs','drops'];
const ROUTES=['SubQ','IM','oral','nasal','topical','sublingual'];
const SITES=[['abd-ul','abdomen upper L'],['abd-ur','abdomen upper R'],['abd-ll','abdomen lower L'],['abd-lr','abdomen lower R'],['flank-l','love handle L'],['flank-r','love handle R'],['thigh-l','thigh L'],['thigh-r','thigh R'],['delt-l','delt L'],['delt-r','delt R'],['glute-l','glute L'],['glute-r','glute R'],['vg-l','ventroglute L'],['vg-r','ventroglute R']];
const SITE_XY={'abd-ul':[52,74],'abd-ur':[68,74],'abd-ll':[52,88],'abd-lr':[68,88],'flank-l':[45,82],'flank-r':[75,82],'thigh-l':[52,118],'thigh-r':[68,118],'delt-l':[38,48],'delt-r':[82,48],'glute-l':[172,100],'glute-r':[188,100],'vg-l':[163,92],'vg-r':[197,92]};
const PDOW=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const toMcg=(amt,unit)=>unit==='mg'?amt*1000:unit==='mcg'?amt:null;
const fmtAmt=(a,u)=>`${kgs(a)} ${u}`;

async function loadProto(){const [p,l,old]=await Promise.all([load('tools/protocols'),load('tools/protolog'),load('tools/trackers')]);PROTO={list:[],...(p||{})};PLOG={logs:[],...(l||{})};
  if(!p&&old&&old.list&&old.list.length){ // one-time move from the old pins + cycles trackers
    old.list.forEach(t=>{const c=newCompound(t.name);if(t.kind==='interval')c.sched={type:'every',n:t.every||1,start:t.last||DAYK};else c.sched={type:'cycle',on:t.on,off:t.off,start:t.start||DAYK,every:1};PROTO.list.push(c);if(t.last)PLOG.logs.push({id:rid(),cid:c.id,at:t.last+'T09:00:00',amt:c.dose,unit:c.unit,site:'',note:'imported'})});
    save('tools/protocols',PROTO);save('tools/protolog',PLOG)}}
watch('tools/protocols',d=>{if(d){PROTO={list:[],...d};if(cur==='tools'&&TOOLV==='protocols')renderProto()}});
watch('tools/protolog',d=>{if(d){PLOG={logs:[],...d};if(cur==='tools'&&TOOLV==='protocols')renderProto()}});
function newCompound(name){return {id:rid(),name:name||'',kind:'peptide',route:'SubQ',dose:250,unit:'mcg',times:['08:00'],sched:{type:'daily',start:DAYK},halfLife:null,color:['#ff2a6d','#05d9e8','#ffb000','#57f5a8','#b967ff'][PROTO.list.length%5],
  active:true,rotate:true,inv:{vialMg:null,waterMl:null,remainMg:null,stock:0,syringe:100},notes:'',created:DAYK}}
function saveProto(){save('tools/protocols',PROTO)}function saveLog(){PLOG.logs.sort((a,b)=>a.at<b.at?1:-1);save('tools/protolog',PLOG)}

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
function nextSite(c){const used={};PLOG.logs.filter(l=>l.cid===c.id&&l.site).forEach(l=>{if(!used[l.site]||l.at>used[l.site])used[l.site]=l.at});const pool=c.route==='IM'?SITES.filter(s=>/delt|glute|vg|thigh/.test(s[0])):SITES.filter(s=>/abd|flank|thigh|delt/.test(s[0]));
  return pool.slice().sort((a,b)=>(used[a[0]]||'')>(used[b[0]]||'')?1:-1)[0][0]}
function siteName(k){const s=SITES.find(x=>x[0]===k);return s?s[1]:k||''}
/* estimated amount still active: one-compartment exponential decay from each logged dose */
function levelAt(c,t){if(!c.halfLife)return null;const k=Math.LN2/(c.halfLife*3600e3);let sum=0;PLOG.logs.forEach(l=>{if(l.cid!==c.id)return;const dt=t-new Date(l.at);if(dt>=0)sum+=(+l.amt||0)*Math.exp(-k*dt)});return sum}
function adherence(c,days=30){let due=0,done=0;for(let i=0;i<days;i++){const d=addDays(DAYK,-i);if(scheduledOn(c,d)){const n=(c.times||['x']).length;due+=n;done+=Math.min(n,logsFor(c.id,d).length)}}return due?Math.round(done/due*100):null}
function invInfo(c){const v=c.inv||{};const conc=v.vialMg&&v.waterMl?v.vialMg/v.waterMl:null;const doseMg=c.unit==='mg'?c.dose:c.unit==='mcg'?c.dose/1000:null;
  const ml=conc&&doseMg?doseMg/conc:null;const units=ml!=null?ml*(v.syringe||100):null;const remain=v.remainMg;
  const perDay=perDayAvg(c);const dosesLeft=remain!=null&&doseMg?Math.floor(remain/doseMg+1e-9):null;const daysLeft=dosesLeft!=null&&perDay?Math.floor(dosesLeft/perDay):null;
  return {conc,ml,units,remain,dosesLeft,daysLeft,doseMg}}
function perDayAvg(c){let n=0;for(let i=0;i<28;i++)if(scheduledOn(c,addDays(DAYK,i)))n+=(c.times||['x']).length;return n/28}

/* ---------- UI ---------- */
function renderProto(){const el=$('t-protocols');if(!el)return;
  const tabs=[['today','today'],['compounds','compounds'],['sites','injection sites'],['calc','reconstitution'],['history','history']];
  el.innerHTML=`<div class="seg gseg" id="protoSeg">${tabs.map(([k,l])=>`<button type="button" data-pv="${k}" aria-pressed="${PROTOV===k}">${l}</button>`).join('')}</div><div id="protoBody"></div>`;
  $('protoSeg').onclick=e=>{const b=e.target.closest('[data-pv]');if(!b)return;PROTOV=b.dataset.pv;renderProto()};
  ({today:protoToday,compounds:protoCompounds,sites:protoSites,calc:protoCalc,history:protoHistory})[PROTOV]();
}
function protoToday(){const due=dueToday();const left=due.filter(x=>!x.done).length;const strip=[...Array(14)].map((_,i)=>addDays(DAYK,i));
  const low=PROTO.list.filter(c=>c.active).map(c=>({c,i:invInfo(c)})).filter(o=>o.i.daysLeft!=null&&o.i.daysLeft<=7);
  $('protoBody').innerHTML=`<div class="protohead"><div><b class="num">${due.length-left}/${due.length}</b><span class="dim">doses today</span></div>${PROTO.list.filter(c=>c.active).map(c=>{const ph=cyclePhase(c);return ph?`<div class="phchip" style="--c:${c.color}"><b>${esc(c.name)}</b><span>${esc(ph.txt)}</span></div>`:''}).join('')}</div>
  ${low.length?`<div class="panel"><div class="pb warn" style="font-size:12px">⚠ running low: ${low.map(o=>`${esc(o.c.name)} (${o.i.daysLeft}d left)`).join(', ')}</div></div>`:''}
  <div class="dosel">${due.map(x=>`<div class="dose${x.done?' done':''}" style="--c:${x.c.color}"><span class="dt num">${x.t==='any'?'any':x.t}</span><div class="dn"><b>${esc(x.c.name)}</b><span class="dim">${fmtAmt(x.c.dose,x.c.unit)} · ${esc(x.c.route)}${x.done&&x.log.site?' · '+esc(siteName(x.log.site)):''}${!x.done&&x.c.rotate&&/SubQ|IM/.test(x.c.route)?' · next site: '+esc(siteName(nextSite(x.c))):''}</span>${(()=>{const i=invInfo(x.c);return i.units?`<span class="dim">draw ${kgs(Math.round(i.units*10)/10)} units (${kgs(Math.round(i.ml*1000)/1000)} ml)</span>`:''})()}</div>
    <button class="scheck" type="button" data-dlog="${esc(x.c.id)}:${x.i}" aria-pressed="${x.done}">✓</button></div>`).join('')||'<div class="dim" style="padding:10px 0">Nothing scheduled today.</div>'}</div>
  <div class="panel" style="margin-top:12px"><div class="ph"><span class="tag">next 14 days</span></div><div class="pb"><div class="strip14">${strip.map(d=>{const cs=PROTO.list.filter(c=>scheduledOn(c,d));return `<div class="s14${d===DAYK?' today':''}"><span class="dim">${new Date(d+'T12:00').toLocaleDateString('en-GB',{weekday:'narrow'})}</span><b class="num">${+d.slice(8)}</b><div>${cs.map(c=>`<i style="background:${c.color}" title="${esc(c.name)}"></i>`).join('')}</div></div>`}).join('')}</div></div></div>
  <div class="bigbtns" style="margin-top:12px"><button class="btn" type="button" id="pLogExtra">+ log an extra dose</button></div>`;
  $('protoBody').onclick=e=>{const b=e.target.closest('[data-dlog]');if(b){const [cid,i]=b.dataset.dlog.split(':');const c=PROTO.list.find(x=>x.id===cid);const x=dueToday().find(y=>y.c.id===cid&&y.i===+i);if(x&&x.done){undoLog(x.log)}else logDose(c,b)}};
  $('pLogExtra').onclick=()=>pickCompound(c=>logDose(c,null,true));
}
function undoLog(l){PLOG.logs=PLOG.logs.filter(x=>x.id!==l.id);const c=PROTO.list.find(x=>x.id===l.cid);const mg=c&&(l.unit==='mg'?+l.amt:l.unit==='mcg'?l.amt/1000:null);if(c&&mg&&c.inv&&c.inv.remainMg!=null){c.inv.remainMg=Math.round((c.inv.remainMg+mg)*1e4)/1e4;saveProto()}saveLog();renderProto();toolCardSubs()}
function logDose(c,btn,extra){const site=c.rotate&&/SubQ|IM/.test(c.route)?nextSite(c):'';
  openSheet('log · '+c.name,`<div class="row" style="gap:10px;flex-wrap:wrap;align-items:end"><label class="dim">amount<input class="inp num" id="ldA" value="${c.dose}" inputmode="decimal" style="width:90px"></label><label class="dim">unit<select class="inp" id="ldU">${UNITS.map(u=>`<option ${u===c.unit?'selected':''}>${u}</option>`).join('')}</select></label><label class="dim">time<input class="inp" id="ldT" type="datetime-local" value="${new Date(Date.now()-new Date().getTimezoneOffset()*6e4).toISOString().slice(0,16)}"></label></div>
   ${/SubQ|IM/.test(c.route)?`<div class="dim" style="margin:12px 0 4px;font-size:12px">injection site${site?' · suggested: '+esc(siteName(site)):''}</div>${siteMap(c,site,true)}`:''}
   <label class="dim">note<input class="inp" id="ldN" placeholder="optional"></label>
   <div class="bigbtns" style="margin-top:12px"><span style="flex:1"></span><button class="btn p" type="button" id="ldGo">log dose</button></div>`);
  let chosen=site;$('sheetBody').onclick=e=>{const s=e.target.closest('[data-site]');if(s){chosen=s.dataset.site;$('sheetBody').querySelectorAll('[data-site]').forEach(x=>x.classList.toggle('sel',x.dataset.site===chosen))}};
  $('ldGo').onclick=()=>{const amt=+$('ldA').value||0,unit=$('ldU').value;const at=new Date($('ldT').value||Date.now()).toISOString();PLOG.logs.push({id:rid(),cid:c.id,at,amt,unit,site:chosen||'',note:$('ldN').value||''});
    const mg=unit==='mg'?amt:unit==='mcg'?amt/1000:null;if(mg&&c.inv&&c.inv.remainMg!=null){c.inv.remainMg=Math.max(0,Math.round((c.inv.remainMg-mg)*1e4)/1e4);saveProto()}
    saveLog();closeSheet();flash('dose_logged');try{autoTick(new RegExp('^'+c.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'))}catch(e){}renderProto();toolCardSubs()}}
function pickCompound(cb){openSheet('which compound?',`<div class="optlist">${PROTO.list.map(c=>`<button class="opt" type="button" data-c="${esc(c.id)}"><i class="cdot" style="background:${c.color}"></i>${esc(c.name)}</button>`).join('')||'<div class="dim">Add a compound first.</div>'}</div>`);$('sheetBody').onclick=e=>{const b=e.target.closest('[data-c]');if(b)cb(PROTO.list.find(c=>c.id===b.dataset.c))}}

function schedText(c){const s=c.sched||{};const t=(c.times||[]).join(', ');const base=s.type==='daily'?'daily':s.type==='every'?`every ${s.n} days`:s.type==='days'?(s.days||[]).map(i=>PDOW[i]).join(' '):s.type==='cycle'?`${s.on} wk on / ${s.off} off${s.every>1?' · every '+s.every+'d':''}`:'as needed';return base+(t&&s.type!=='asneeded'?' · '+t:'')}
function protoCompounds(){const sugg=stackSuggestions();
  $('protoBody').innerHTML=`<div class="row" style="justify-content:space-between;margin-bottom:10px"><span class="tag">${PROTO.list.length} compounds</span><button class="btn p" type="button" id="cNew">+ add compound</button></div>
  <div class="ccards">${PROTO.list.map(c=>{const i=invInfo(c);const a=adherence(c);const lv=levelAt(c,Date.now());const ph=cyclePhase(c);return `<button type="button" class="ccard${c.active?'':' off'}" data-cid="${esc(c.id)}" style="--c:${c.color}"><div class="rtop"><b>${esc(c.name)}</b><span class="dim">${esc(c.route)}</span></div>
    <span class="dim">${fmtAmt(c.dose,c.unit)} · ${esc(schedText(c))}</span>${ph?`<span class="phtxt">${esc(ph.txt)}</span>`:''}
    <div class="cstats"><div><span class="dim">adherence</span><b class="num">${a==null?'—':a+'%'}</b></div><div><span class="dim">in system</span><b class="num">${lv==null?'—':kgs(Math.round(lv*10)/10)}</b></div><div><span class="dim">supply</span><b class="num">${i.daysLeft!=null?i.daysLeft+'d':'—'}</b></div></div></button>`}).join('')||'<div class="dim">No compounds yet.</div>'}</div>
  ${sugg.length?`<div class="tag" style="margin:16px 0 6px">from your stack</div><div class="chips">${sugg.map((s,i)=>`<button class="chip" type="button" data-sg="${i}">+ ${esc(s.name)}</button>`).join('')}</div>`:''}`;
  $('cNew').onclick=()=>editCompound(null);
  $('protoBody').onclick=e=>{const b=e.target.closest('[data-cid]');if(b)return compoundDetail(b.dataset.cid);const s=e.target.closest('[data-sg]');if(s){const g=sugg[+s.dataset.sg];const c=newCompound(g.name);Object.assign(c,g.patch);editCompound(c,true)}};
}
function stackSuggestions(){if(!M||!M.plans)return [];const have=new Set(PROTO.list.map(c=>norm(c.name)));const out=[];
  M.plans.weekday.forEach(b=>b.items.forEach(i=>{if(!CMP.has(i.type)||have.has(norm(i.item))||out.some(o=>o.name===i.item))return;const s=String(i.sched||'')+' '+String(i.notes||'');let m,sched={type:'daily',start:DAYK};
    if((m=s.match(/Every (\d+) days/i)))sched={type:'every',n:+m[1],start:DAYK};else if(/\bEOD\b/.test(s))sched={type:'every',n:2,start:DAYK};else if(/\bWeekly\b/i.test(s))sched={type:'every',n:7,start:DAYK};
    if((m=s.match(/(\d+)-week cycles? (\d+) off/i)))sched={type:'cycle',on:+m[1],off:+m[2],start:DAYK,every:sched.n||1};
    const dm=String(i.dose||'').match(/([\d.]+)\s*(mcg|mg|iu|ml)/i);const route=/sub|subq|sc\b/i.test(i.route||'')?'SubQ':/im\b|intramusc/i.test(i.route||'')?'IM':/oral|cap|tab/i.test(i.route||'')?'oral':/nasal/i.test(i.route||'')?'nasal':'SubQ';
    out.push({name:i.item,patch:{sched,route,dose:dm?+dm[1]:0,unit:dm?(dm[2].toLowerCase()==='iu'?'IU':dm[2].toLowerCase()):'mg',times:[fmtM(i.t)||'08:00'],kind:i.type==='Peptide'?'peptide':'compound'}})}));return out}
function compoundDetail(cid){const c=PROTO.list.find(x=>x.id===cid);if(!c)return;PROTO_SEL=cid;const i=invInfo(c);const a=adherence(c);const logs=logsFor(c.id).slice(0,40);
  const now=Date.now();let chart='';if(c.halfLife){const pts=[];const labels=[];for(let h=-24*14;h<=24*7;h+=6){pts.push(levelAt(c,now+h*3600e3))}chart=`<div class="tag" style="margin:12px 0 4px">estimated amount active (${esc(c.unit)}) · 14 days back, 7 ahead</div>${spark(pts,{h:150,labels:['-14d','+7d']})}<div class="dim" style="font-size:11px">Rough estimate from your logged doses and a ${kgs(c.halfLife)}h half-life. Not a blood level.</div>`}
  openSheet(c.name,`<div class="cstats big"><div><span class="dim">dose</span><b class="num">${fmtAmt(c.dose,c.unit)}</b></div><div><span class="dim">schedule</span><b>${esc(schedText(c))}</b></div><div><span class="dim">adherence 30d</span><b class="num">${a==null?'—':a+'%'}</b></div></div>
  ${chart}
  <div class="tag" style="margin:14px 0 6px">inventory</div><div class="reclist"><div><span>current vial</span><b class="num">${i.remain!=null?kgs(Math.round(i.remain*100)/100)+' mg left':'—'}</b></div><div><span>doses left in vial</span><b class="num">${i.dosesLeft??'—'}</b></div><div><span>days of supply</span><b class="num">${i.daysLeft??'—'}</b></div><div><span>unopened vials</span><b class="num">${(c.inv&&c.inv.stock)||0}</b></div>${i.conc?`<div><span>concentration</span><b class="num">${kgs(Math.round(i.conc*1000)/1000)} mg/ml</b></div><div><span>per dose</span><b class="num">${kgs(Math.round(i.units*10)/10)} units · ${kgs(Math.round(i.ml*1000)/1000)} ml</b></div>`:''}</div>
  <div class="bigbtns" style="margin-top:8px"><button class="btn" type="button" id="cdNewVial">new vial opened</button><button class="btn" type="button" id="cdLog">log dose now</button></div>
  <div class="tag" style="margin:14px 0 6px">history</div>${logs.map(l=>`<div class="hx row" style="justify-content:space-between"><span class="dim">${new Date(l.at).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span><span>${fmtAmt(l.amt,l.unit)}${l.site?' · '+esc(siteName(l.site)):''}${l.note?' · '+esc(l.note):''}</span><button class="iconbtn" type="button" data-ldel="${esc(l.id)}">✕</button></div>`).join('')||'<div class="dim">No doses logged yet.</div>'}
  ${c.notes?`<div class="dim" style="margin-top:10px">“${esc(c.notes)}”</div>`:''}
  <div class="bigbtns" style="margin-top:14px"><button class="btn d" type="button" id="cdDel">delete</button><span style="flex:1"></span><button class="btn" type="button" id="cdPause">${c.active?'pause':'resume'}</button><button class="btn p" type="button" id="cdEdit">edit</button></div>`);
  $('cdEdit').onclick=()=>editCompound(c);$('cdLog').onclick=()=>logDose(c);
  $('cdPause').onclick=()=>{c.active=!c.active;saveProto();compoundDetail(cid);renderProto()};
  $('cdNewVial').onclick=()=>{c.inv=c.inv||{};if(!c.inv.vialMg){flash('set_vial_size_in_edit');return editCompound(c)}c.inv.remainMg=c.inv.vialMg;if(c.inv.stock>0)c.inv.stock--;c.inv.openedAt=DAYK;saveProto();flash('vial_opened');compoundDetail(cid)};
  $('cdDel').onclick=function(){if(!this.dataset.arm){this.dataset.arm=1;this.textContent='tap again';return}PROTO.list=PROTO.list.filter(x=>x.id!==cid);PLOG.logs=PLOG.logs.filter(l=>l.cid!==cid);saveProto();saveLog();closeSheet();renderProto()};
  $('sheetBody').addEventListener('click',e=>{const d=e.target.closest('[data-ldel]');if(!d)return;if(!d.dataset.arm){d.dataset.arm=1;d.textContent='?';return}const l=PLOG.logs.find(x=>x.id===d.dataset.ldel);if(l)undoLog(l);compoundDetail(cid)});
}
function editCompound(c0,isNew){const c=clone(c0||newCompound(''));isNew=isNew||!c0;c.sched=c.sched||{type:'daily',start:DAYK};c.inv=c.inv||{};
  const draw=()=>{const s=c.sched;openSheet(isNew?'add compound':'edit · '+c.name,`<input class="inp" id="ceN" value="${esc(c.name)}" placeholder="name (e.g. BPC-157)" style="font-size:16px;margin-bottom:8px">
  <div class="row" style="gap:8px;flex-wrap:wrap"><label class="dim">dose<input class="inp num" id="ceD" value="${c.dose??''}" inputmode="decimal" style="width:90px"></label><label class="dim">unit<select class="inp" id="ceU">${UNITS.map(u=>`<option ${u===c.unit?'selected':''}>${u}</option>`).join('')}</select></label><label class="dim">route<select class="inp" id="ceR">${ROUTES.map(u=>`<option ${u===c.route?'selected':''}>${u}</option>`).join('')}</select></label><label class="dim">colour<input type="color" id="ceC" value="${c.color}" class="inp" style="width:56px;padding:2px"></label></div>
  <div class="tag" style="margin:14px 0 6px">schedule</div>
  <div class="seg" id="ceST">${[['daily','daily'],['every','every N days'],['days','days of week'],['cycle','cycle on/off'],['asneeded','as needed']].map(([k,l])=>`<button type="button" data-st="${k}" aria-pressed="${s.type===k}">${l}</button>`).join('')}</div>
  <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:8px">${s.type==='every'?`<label class="dim">every N days<input class="inp num" id="ceEv" value="${s.n||2}" style="width:70px"></label>`:''}
   ${s.type==='days'?`<div class="chips" id="ceDays">${PDOW.map((d,i)=>`<button class="chip" type="button" data-dw="${i}" aria-pressed="${(s.days||[]).includes(i)}">${d}</button>`).join('')}</div>`:''}
   ${s.type==='cycle'?`<label class="dim">weeks on<input class="inp num" id="ceOn" value="${s.on||8}" style="width:60px"></label><label class="dim">weeks off<input class="inp num" id="ceOff" value="${s.off??4}" style="width:60px"></label><label class="dim">dose every N days while on<input class="inp num" id="ceEv2" value="${s.every||1}" style="width:60px"></label>`:''}
   <label class="dim">start<input class="inp" type="date" id="ceS" value="${s.start||DAYK}"></label><label class="dim">end (optional)<input class="inp" type="date" id="ceE" value="${s.end||''}"></label></div>
  ${s.type!=='asneeded'?`<label class="dim">times (comma separated)<input class="inp" id="ceT" value="${esc((c.times||[]).join(', '))}" placeholder="08:00, 20:00"></label>`:''}
  <div class="tag" style="margin:14px 0 6px">pharmacology (optional)</div><label class="dim">half-life in hours (for the "in system" estimate)<input class="inp num" id="ceH" value="${c.halfLife??''}" inputmode="decimal" placeholder="e.g. 4"></label>
  <label class="dim" style="display:flex;gap:8px;align-items:center;margin-top:8px"><input type="checkbox" id="ceRot" ${c.rotate?'checked':''} style="width:auto;display:inline"> rotate injection sites</label>
  <div class="tag" style="margin:14px 0 6px">vial &amp; inventory</div><div class="row" style="gap:8px;flex-wrap:wrap"><label class="dim">mg per vial<input class="inp num" id="ceVm" value="${c.inv.vialMg??''}" inputmode="decimal" style="width:80px"></label><label class="dim">water added (ml)<input class="inp num" id="ceVw" value="${c.inv.waterMl??''}" inputmode="decimal" style="width:80px"></label><label class="dim">mg left in current vial<input class="inp num" id="ceVr" value="${c.inv.remainMg??''}" inputmode="decimal" style="width:90px"></label><label class="dim">unopened vials<input class="inp num" id="ceVs" value="${c.inv.stock||0}" inputmode="numeric" style="width:70px"></label><label class="dim">syringe<select class="inp" id="ceSy">${[100,50,30].map(u=>`<option value="${u}" ${(c.inv.syringe||100)==u?'selected':''}>U-${u}</option>`).join('')}</select></label></div>
  <label class="dim">notes<textarea class="inp" id="ceNo" rows="2">${esc(c.notes||'')}</textarea></label>
  <div class="bigbtns" style="margin-top:12px"><span style="flex:1"></span><button class="btn" type="button" id="ceX">cancel</button><button class="btn p" type="button" id="ceOk">save</button></div>`);
  const sb=$('sheetBody');
  const read=()=>{const g=id=>$(id)?$(id).value:undefined;c.name=g('ceN');c.dose=+g('ceD')||0;c.unit=g('ceU');c.route=g('ceR');c.color=g('ceC');s.start=g('ceS')||DAYK;s.end=g('ceE')||null;
    if($('ceEv'))s.n=Math.max(1,+g('ceEv')||1);if($('ceOn')){s.on=Math.max(1,+g('ceOn')||1);s.off=Math.max(0,+g('ceOff')||0);s.every=Math.max(1,+g('ceEv2')||1)}
    if($('ceT'))c.times=g('ceT').split(/[,\s]+/).map(x=>x.trim()).filter(x=>/^\d{1,2}:\d{2}$/.test(x)).map(x=>x.padStart(5,'0'));c.halfLife=+g('ceH')||null;c.rotate=$('ceRot').checked;
    c.inv.vialMg=+g('ceVm')||null;c.inv.waterMl=+g('ceVw')||null;c.inv.remainMg=g('ceVr')===''?null:+g('ceVr');c.inv.stock=+g('ceVs')||0;c.inv.syringe=+g('ceSy')||100;c.notes=g('ceNo')};
  sb.onclick=e=>{const st=e.target.closest('[data-st]');if(st){read();s.type=st.dataset.st;if(s.type==='days'&&!s.days)s.days=[0,2,4];draw();return}
    const dw=e.target.closest('[data-dw]');if(dw){const k=+dw.dataset.dw;s.days=(s.days||[]).includes(k)?s.days.filter(x=>x!==k):[...(s.days||[]),k].sort();dw.setAttribute('aria-pressed',s.days.includes(k));return}
    if(e.target.id==='ceX')closeSheet();
    if(e.target.id==='ceOk'){read();c.name=(c.name||'').trim();if(!c.name){$('ceN').focus();return}const i=PROTO.list.findIndex(x=>x.id===c.id);if(i>=0)PROTO.list[i]=c;else PROTO.list.push(c);saveProto();closeSheet();PROTOV='compounds';renderProto();flash('saved')}}};
  draw()}

/* injection site map */
function siteMap(c,sel,pick){const last={};PLOG.logs.filter(l=>!c||l.cid===c.id).forEach(l=>{if(l.site&&(!last[l.site]||l.at>last[l.site]))last[l.site]=l.at});
  const age=k=>last[k]?Math.floor((Date.now()-new Date(last[k]))/864e5):null;
  const dot=(k)=>{const [x,y]=SITE_XY[k];const a=age(k);const col=a==null?'#2a2a30':a<2?'#ff2a6d':a<5?'#ffb000':'#57f5a8';return `<g class="sdot${k===sel?' sel':''}" data-site="${k}" style="cursor:${pick?'pointer':'default'}"><circle cx="${x}" cy="${y}" r="6.5" fill="${col}" stroke="#000" stroke-width="1"/><title>${siteName(k)}${a!=null?` · ${a}d ago`:' · never'}</title></g>`};
  const body=(ox,lab)=>`<g transform="translate(${ox},0)"><circle cx="60" cy="20" r="11" fill="#16161a"/><path d="M42 34h36l8 40-6 30H40l-6-30z" fill="#16161a"/><path d="M42 104h16l-2 70H44zM62 104h16l-2 70H64z" fill="#16161a"/><path d="M34 36l-10 50h8l8-40zM86 36l10 50h-8l-8-40z" fill="#16161a"/><text x="60" y="190" fill="#555" font-size="8" text-anchor="middle">${lab}</text></g>`;
  return `<svg class="sitemap" viewBox="0 0 240 196">${body(0,'front')}${body(120,'back')}${Object.keys(SITE_XY).map(dot).join('')}</svg><div class="dim" style="font-size:11px;display:flex;gap:12px;flex-wrap:wrap"><span><i class="lg" style="background:#ff2a6d"></i>&lt;2 days</span><span><i class="lg" style="background:#ffb000"></i>2–4 days</span><span><i class="lg" style="background:#57f5a8"></i>rested</span><span><i class="lg" style="background:#2a2a30"></i>never</span></div>`}
function protoSites(){const inj=PROTO.list.filter(c=>/SubQ|IM/.test(c.route));const recent=PLOG.logs.filter(l=>l.site).slice(0,12);
  $('protoBody').innerHTML=`<div class="statsplit" style="margin-top:0"><div class="panel"><div class="ph"><span class="tag">all injections</span></div><div class="pb">${siteMap(null,null,false)}</div></div>
  <div class="panel"><div class="ph"><span class="tag">next site per compound</span></div><div class="pb"><div class="reclist">${inj.map(c=>`<div><span><i class="cdot" style="background:${c.color}"></i> ${esc(c.name)}</span><b>${esc(siteName(nextSite(c)))}</b></div>`).join('')||'<span class="dim">No injectable compounds.</span>'}</div>
  <div class="tag" style="margin:14px 0 6px">recent</div><div class="reclist">${recent.map(l=>{const c=PROTO.list.find(x=>x.id===l.cid);return `<div><span class="dim">${new Date(l.at).toLocaleDateString('en-GB',{day:'numeric',month:'short'})} · ${esc(c?c.name:'')}</span><span>${esc(siteName(l.site))}</span></div>`}).join('')||'<span class="dim">Nothing yet.</span>'}</div></div></div></div>`}
function protoCalc(){const st=LS.get('recon')||{mg:5,ml:2,dose:250,unit:'mcg',sy:100};
  const draw=()=>{const conc=st.mg/st.ml;const doseMg=st.unit==='mg'?st.dose:st.dose/1000;const ml=doseMg/conc;const units=ml*st.sy;const per=Math.floor(st.mg/doseMg+1e-9);
    $('rcOut').innerHTML=`<div class="statcards"><div><span class="dim">draw to</span><b class="num">${isFinite(units)?kgs(Math.round(units*10)/10):'—'}<small> units</small></b></div><div><span class="dim">volume</span><b class="num">${isFinite(ml)?kgs(Math.round(ml*1000)/1000):'—'}<small> ml</small></b></div><div><span class="dim">concentration</span><b class="num">${isFinite(conc)?kgs(Math.round(conc*1000)/1000):'—'}<small> mg/ml</small></b></div><div><span class="dim">doses per vial</span><b class="num">${isFinite(per)?per:'—'}</b></div></div>
    <div class="syringe"><div class="sfill" style="width:${Math.min(100,units/st.sy*100)}%"></div>${[...Array(11)].map((_,i)=>`<span style="left:${i*10}%">${Math.round(st.sy*i/10)}</span>`).join('')}</div>${units>st.sy?'<div class="pb warn" style="font-size:12px">That dose is more than one full syringe; add less water or split it.</div>':''}`;LS.set('recon',st)};
  $('protoBody').innerHTML=`<div class="panel"><div class="ph"><span class="tag">reconstitution calculator</span><span class="dim">vial + bacteriostatic water → syringe units</span></div><div class="pb">
  <div class="row" style="gap:10px;flex-wrap:wrap;align-items:end"><label class="dim">peptide in vial (mg)<input class="inp num" data-r="mg" value="${st.mg}" inputmode="decimal" style="width:100px"></label><label class="dim">water added (ml)<input class="inp num" data-r="ml" value="${st.ml}" inputmode="decimal" style="width:100px"></label><label class="dim">dose<input class="inp num" data-r="dose" value="${st.dose}" inputmode="decimal" style="width:100px"></label><label class="dim">unit<select class="inp" data-r="unit"><option ${st.unit==='mcg'?'selected':''}>mcg</option><option ${st.unit==='mg'?'selected':''}>mg</option></select></label><label class="dim">syringe<select class="inp" data-r="sy">${[100,50,30].map(u=>`<option value="${u}" ${st.sy==u?'selected':''}>U-${u}</option>`).join('')}</select></label></div>
  <div id="rcOut" style="margin-top:14px"></div></div></div>`;
  $('protoBody').oninput=$('protoBody').onchange=e=>{const k=e.target.dataset.r;if(!k)return;st[k]=k==='unit'?e.target.value:+e.target.value||0;draw()};draw()}
function protoHistory(){const days={};PLOG.logs.forEach(l=>{const d=ymd(logical(new Date(l.at)));(days[d]=days[d]||[]).push(l)});
  $('protoBody').innerHTML=Object.entries(days).sort((a,b)=>a[0]<b[0]?1:-1).slice(0,60).map(([d,ls])=>`<div class="hx"><b>${esc(nice(d))}</b><div class="hsets">${ls.map(l=>{const c=PROTO.list.find(x=>x.id===l.cid);return `<span class="set" style="border-color:${c?c.color:'#333'}">${new Date(l.at).toTimeString().slice(0,5)} · ${esc(c?c.name:'?')} · ${fmtAmt(l.amt,l.unit)}${l.site?' · '+esc(siteName(l.site)):''}</span>`}).join('')}</div></div>`).join('')||'<div class="dim">No doses logged yet.</div>'}

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
function weekSlots(){const n=leetWeek(),t=LEET.target||8;return `<div class="lcweek"><div><b class="num">${n}</b><span class="dim">/ ${t} this week</span></div><div class="slots">${Array.from({length:Math.max(t,n)},(_,i)=>`<i class="${i<n?'f':''}"></i>`).join('')}</div><button class="iconbtn" type="button" id="lcTgt">target</button></div>`}
function leetLog(){const items=Object.values(LEET.items).sort((a,b)=>(b.last||'')>(a.last||'')?1:-1);
  $('lcBody').innerHTML=`${weekSlots()}<button class="addex" type="button" id="lcAddP">+ log a problem</button>
  <div class="lclist">${items.map(it=>{const p=probOf(it.slug);const ok=(it.attempts||[]).some(a=>a.ok);return `<button type="button" class="lcrow" data-slug="${esc(it.slug)}"><span class="num dim">${p.id}</span><span class="lct"><b>${esc(p.t)}</b><span class="dim">${(p.tg||[]).slice(0,4).map(i=>esc(LCDB.tags[i])).join(' · ')}</span></span>${diffChip(p.d)}<span class="lcst ${ok?'ok':'try'}">${ok?'✓':'…'}</span>${it.notes?'<span class="dim">✎</span>':''}</button>`}).join('')||'<div class="dim" style="padding:10px 0">No problems logged yet. Tap "log a problem" and pick one from the LeetCode list.</div>'}</div>`;
  $('lcAddP').onclick=()=>pickProblem(slug=>openProblem(slug,true));$('lcTgt').onclick=()=>{const v=parseInt(prompt('Weekly target?',LEET.target||8)||'');if(v>0){LEET.target=v;leetSaves();renderLeet()}};
  $('lcBody').onclick=e=>{const b=e.target.closest('[data-slug]');if(b)openProblem(b.dataset.slug)}}
function filterProblems(){const q=norm(LQ.q);return LCDB.q.filter(p=>(!LQ.d||p.d===LQ.d)&&(LQ.t===''||p.tg.includes(+LQ.t))&&(!q||norm(p.t).includes(q)||String(p.id)===q)&&(!LQ.st||(LQ.st==='done'?LEET.items[p.s]&&(LEET.items[p.s].attempts||[]).some(a=>a.ok):!LEET.items[p.s])))}
function probFilters(){return `<input class="inp" id="lqQ" placeholder="search ${LCDB.q.length.toLocaleString('en-GB')} problems by name or number" value="${esc(LQ.q)}" style="margin-bottom:8px"><div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:8px"><select class="inp" id="lqD" style="flex:1;min-width:110px"><option value="">any difficulty</option>${Object.entries(LCDIFF).map(([k,v])=>`<option value="${k}" ${LQ.d===k?'selected':''}>${v}</option>`).join('')}</select><select class="inp" id="lqT" style="flex:2;min-width:150px"><option value="">any topic</option>${LCDB.tags.map((t,i)=>`<option value="${i}" ${LQ.t===String(i)?'selected':''}>${esc(t)}</option>`).join('')}</select><select class="inp" id="lqS" style="flex:1;min-width:110px"><option value="">all</option><option value="done" ${LQ.st==='done'?'selected':''}>solved</option><option value="todo" ${LQ.st==='todo'?'selected':''}>not tried</option></select></div>`}
function bindProbFilters(draw){$('lqQ').oninput=e=>{LQ.q=e.target.value;draw()};$('lqD').onchange=e=>{LQ.d=e.target.value;draw()};$('lqT').onchange=e=>{LQ.t=e.target.value;draw()};$('lqS').onchange=e=>{LQ.st=e.target.value;draw()}}
function probRow(p){const it=LEET.items[p.s];const ok=it&&(it.attempts||[]).some(a=>a.ok);return `<button type="button" class="lcrow" data-pslug="${esc(p.s)}"><span class="num dim">${p.id}</span><span class="lct"><b>${esc(p.t)}${p.p?' <span class="dim">🔒</span>':''}</b><span class="dim">${p.tg.slice(0,4).map(i=>esc(LCDB.tags[i])).join(' · ')}</span></span>${diffChip(p.d)}<span class="lcst ${ok?'ok':it?'try':''}">${ok?'✓':it?'…':''}</span></button>`}
function leetBrowse(){$('lcBody').innerHTML=probFilters()+`<div class="lclist" id="lqList"></div>`;const draw=()=>{const l=filterProblems();$('lqList').innerHTML=l.slice(0,200).map(probRow).join('')+(l.length>200?`<div class="dim" style="padding:8px">${l.length-200} more — narrow the search</div>`:'')};draw();bindProbFilters(draw);
  $('lqList').onclick=e=>{const b=e.target.closest('[data-pslug]');if(b)openProblem(b.dataset.pslug)}}
async function pickProblem(cb){await loadLcDb();openSheet('pick a problem',probFilters()+`<div class="lclist picklist" id="lqList"></div>`);const draw=()=>{$('lqList').innerHTML=filterProblems().slice(0,120).map(probRow).join('')};draw();bindProbFilters(draw);setTimeout(()=>$('lqQ')&&$('lqQ').focus(),200);
  $('lqList').onclick=e=>{const b=e.target.closest('[data-pslug]');if(b)cb(b.dataset.pslug)}}
function openProblem(slug,logNow){const p=probOf(slug);const it=LEET.items[slug]||{slug,title:p.t,d:p.d,attempts:[],notes:'',code:'',conf:0};
  const persist=()=>{it.title=p.t;it.d=p.d;LEET.items[slug]=it;leetSaves()};
  const draw=()=>{openSheet(`${p.id}. ${p.t}`,`<div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:10px">${diffChip(p.d)}${(p.tg||[]).map(i=>`<span class="chipy">${esc(LCDB.tags[i])}</span>`).join('')}<a class="iconbtn" href="https://leetcode.com/problems/${encodeURIComponent(slug)}/" target="_blank" rel="noopener">open on leetcode ↗</a></div>
    <div class="tag">log an attempt</div><div class="row" style="gap:8px;flex-wrap:wrap;align-items:end;margin:6px 0 12px"><label class="dim">result<select class="inp" id="laOk"><option value="1">solved</option><option value="0">didn't solve</option></select></label><label class="dim">minutes<input class="inp num" id="laMin" inputmode="numeric" style="width:70px"></label><label class="dim">how<select class="inp" id="laHow"><option>on my own</option><option>with hints</option><option>looked at solution</option></select></label><button class="btn p" type="button" id="laGo">log</button></div>
    ${(it.attempts||[]).length?`<div class="hsets" style="margin-bottom:12px">${it.attempts.map((a,i)=>`<span class="set ${a.ok?'':'t-f'}">${esc(nice(a.d).toLowerCase())} · ${a.ok?'✓':'✗'}${a.min?' · '+a.min+'m':''} · ${esc(a.how||'')} <button class="iconbtn" type="button" data-adel="${i}" style="padding:0 4px">✕</button></span>`).join('')}</div>`:''}
    <div class="tag">confidence</div><div class="chips" id="laConf" style="margin:6px 0 12px">${['','shaky','okay','solid','nailed it'].map((l,i)=>i?`<button class="chip" type="button" data-cf="${i}" aria-pressed="${it.conf===i}">${l}</button>`:'').join('')}</div>
    <div class="tag">notes · approach, complexity, gotchas</div><textarea class="inp lcnote" id="laNotes" rows="6" placeholder="e.g. two pointers from both ends; O(n) time, O(1) space; watch duplicates">${esc(it.notes||'')}</textarea>
    <div class="tag" style="margin-top:10px">solution code</div><textarea class="inp lccode" id="laCode" rows="8" spellcheck="false" placeholder="paste your solution">${esc(it.code||'')}</textarea>
    <div class="row" style="justify-content:space-between;margin-top:10px"><span class="dim" id="laSaved">${it.last?'last attempt '+esc(nice(it.last).toLowerCase()):''}</span>${LEET.items[slug]?'<button class="btn d" type="button" id="laDel">remove</button>':''}</div>`);
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
  $('lcBody').innerHTML=`<div class="statcards"><div><span class="dim">solved</span><b class="num">${solvedSlugs.size}</b></div>${['E','M','H'].map(d=>`<div><span class="dim">${LCDIFF[d].toLowerCase()}</span><b class="num lcd-${d}t">${byD[d]||0}<small> / ${tot[d]}</small></b></div>`).join('')}<div><span class="dim">day streak</span><b class="num">${streak}</b></div></div>
  <div class="panel" style="margin-top:12px"><div class="ph"><span class="tag">solved per week</span><span class="dim">target ${LEET.target||8}</span></div><div class="pb"><div class="wkbars" style="grid-template-columns:repeat(12,1fr)">${per.map((v,i)=>`<div class="d"><span class="p num">${v||''}</span><div class="b" style="height:${v/mx*100}%;${v>=(LEET.target||8)?'background:var(--ok)':''}"></div><span class="l">${weeks[i].slice(-3).toLowerCase()}</span></div>`).join('')}</div></div></div>
  <div class="panel" style="margin-top:12px"><div class="ph"><span class="tag">topics you've covered</span></div><div class="pb"><div class="mbars">${tl.map(([i,v])=>`<div><span>${esc(LCDB.tags[i])}</span><i style="--w:${v/tmx*100}%"></i><b class="num">${v}</b></div>`).join('')||'<span class="dim">Solve a few problems to see your topic spread.</span>'}</div></div></div>`}
function leetReview(){const due=Object.values(LEET.items).filter(it=>it.review&&it.review<=DAYK).sort((a,b)=>a.review<b.review?-1:1);const weak=Object.values(LEET.items).filter(it=>it.conf&&it.conf<=2);
  $('lcBody').innerHTML=`<div class="dim" style="font-size:12px;margin-bottom:10px">Solved problems come back for review after 3, 7, 21 and 60 days so the patterns stick.</div>
  <div class="tag">due for review · ${due.length}</div><div class="lclist">${due.map(it=>probRow(probOf(it.slug))).join('')||'<div class="dim" style="padding:8px 0">Nothing due.</div>'}</div>
  <div class="tag" style="margin-top:14px">low confidence · ${weak.length}</div><div class="lclist">${weak.map(it=>probRow(probOf(it.slug))).join('')||'<div class="dim" style="padding:8px 0">None.</div>'}</div>`;
  $('lcBody').onclick=e=>{const b=e.target.closest('[data-pslug]');if(b)openProblem(b.dataset.pslug)}}

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
let stF='active',catF=null,sortK='monthly',sortD=-1;
const stFilter=k=>s=>k==='all'||(k==='inb'?s.inb:k==='opt'?!s.inb:k==='edited'?s.edited:s.status===k);
function renderStack(){
  const st=M.stack;const c=s=>st.filter(x=>x.status===s).length;
  $('stackSub').textContent=`${st.length} compounds`;
  $('stackKv').innerHTML=[['budget',gbp(M.stackBudget,2),'/month · in budget = Yes'],['live budget',gbp(M.liveBudget,2),'/month · minus paused in v2'],['optional',gbp(M.stackOpt,2),'/month · in budget = No'],['in plan',String(c('active')),`${c('asneeded')} as needed · ${c('paused')} paused`]]
    .map(([k,v,s],i)=>`<div class="panel"><div class="ph"><span class="tag">${k}</span></div><div class="pb"><span class="v num ${i===1?'pink':''}" data-scr="${esc(v)}">${v}</span><span class="s">${s}</span></div></div>`).join('');
  const pb=st.filter(s=>s.inb&&s.status==='paused'&&s.monthly>0);
  $('stackWarn').innerHTML='';
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
  <div class="chips" id="dSt" style="margin:0 0 6px">${['active','asneeded','paused','notinplan'].map(x=>`<button class="chip" type="button" data-dst="${x}" aria-pressed="${s.status===x}">${STATUSL[x]}</button>`).join('')}</div><span class="dim" style="display:block;font-size:11px;margin-bottom:14px">${s.inb?'in budget':'optional'}${s.edited?' · edited':''}</span>
  <dl>${row('dose',s.dose)}${row('route',s.route)}${row('schedule',s.sched)}${row('taken at',s.times.join(', '))}${row('source',s.src)}${row('pack price',isNum(s.price)?gbp(s.price,2):s.price)}${row('units / pack',s.units)}${row('used / week',s.perweek)}${row('weekly',wk?gbp(wk,2):'')}${row('monthly',s.monthly?gbp(s.monthly,2):'')}${row('yearly',s.monthly?gbp(s.monthly*12,0):'')}</dl>
  ${s.notes?`<div class="sect"><span class="tag">notes</span>${esc(s.notes)}</div>`:''}
  ${s.cau.length?`<div class="sect"><span class="tag">interactions & cautions · from your plan</span>${s.cau.map(c=>`<div class="ca">${esc(c)}</div>`).join('')}</div>`:''}
  ${s.monthly&&M.rate?`<div class="sect"><span class="tag">costs you</span><span style="font-size:22px;font-weight:800" class="num">${(s.monthly/M.rate).toFixed(1)} h</span> <span class="dim">of work a month</span></div>`:''}`;
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


/* status lives in the app now (not the Excel plan): tap a status in a compound's panel to change it */
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
  $('cats').innerHTML=cats.map(c=>{const n=Math.max(1,Math.round(c.m/mx*44));return `<div class="cat${billCat===c.cat?' sel':''}" data-c="${esc(c.cat)}" role="button" tabindex="0"><span class="nm">${esc(c.cat==='Investment & Savings'?'savings':c.cat.toLowerCase())}</span><span class="bars" style="color:${CATC[c.cat]}">${'▇'.repeat(n)}<span style="color:var(--dim2)">${'·'.repeat(44-n)}</span></span><span class="co num">${gbp(c.m,2)}</span><span class="hr num">${M.rate?(c.m/M.rate).toFixed(1):0}h</span></div>`}).join('');
  if(billCat==='Stack'){$('billsTitle').textContent='stack';$('billsTot').textContent=gbp(M.stackBudget,2)+'/mo';$('bills').innerHTML='<div class="dim">Itemised on the stack view. <button class="iconbtn" type="button" id="goStack">open /stack</button></div>';$('goStack').onclick=()=>go('stack');$('addBill').style.visibility='hidden'}
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
function calc(){const v=parseFloat($('calcIn').value)||0;const h=M.rate?v/M.rate:0;$('calcOut').textContent=h>=1?`${h.toFixed(1)} h`:`${Math.round(h*60)} min`;$('calcNote').textContent=`That's ${(h/(M.inc.hours/21.7)).toFixed(2)} working days at your take-home rate.`}
$('calcIn').oninput=calc;
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
  $('avMon').textContent=new Date(AVM+'-01T12:00').toLocaleDateString('en-GB',{month:'short',year:'numeric'}).toLowerCase();
  const cats=Object.entries(M.cats).filter(([c])=>c!=='Investment & Savings').sort((a,b)=>b[1]-a[1]);const mon=ACT.months[AVM]||{};
  const tb=cats.reduce((a,[,b])=>a+b,0),ta=cats.reduce((a,[c])=>a+(+mon[c]||0),0),logged=cats.some(([c])=>mon[c]!=null&&mon[c]!=='');
  const hist=[...Array(6)].map((_,i)=>{const [y,m]=AVM.split('-').map(Number);const d=new Date(y,m-6+i,1);const k=d.getFullYear()+'-'+pad(d.getMonth()+1);const mm=ACT.months[k]||{};return {k,a:cats.reduce((s,[c])=>s+(+mm[c]||0),0)}});const hmx=Math.max(tb,...hist.map(h=>h.a))||1;
  el.innerHTML=`<div class="av">${cats.map(([c,b])=>{const a=mon[c];const has=a!=null&&a!=='';const pct=has?Math.min(150,(+a)/(b||1)*100):0;const over=has&&+a>b;
    return `<div class="avr"><span class="avn">${esc(c==='Personal & Other'?'personal':c.toLowerCase())}</span><span class="avbar"><i class="${over?'over':''}" style="width:${Math.min(100,pct)}%;background:${over?'var(--bad)':CATC[c]||'var(--cyan)'}"></i></span><input class="inp num avin" data-avc="${esc(c)}" inputmode="decimal" placeholder="£${Math.round(b)}" value="${has?a:''}"><span class="avd num ${over?'bad':has?'ok':'dim'}">${has?(over?'+':'−')+gbp(Math.abs(+a-b),0):gbp(b,0)}</span></div>`}).join('')}
    <div class="avtot"><span>${logged?`spent <b class="num">${gbp(ta,0)}</b> of <b class="num">${gbp(tb,0)}</b> budgeted`:'type what you actually spent in each category this month'}</span>${logged?`<b class="num ${ta>tb?'bad':'ok'}">${ta>tb?'over by '+gbp(ta-tb,0):gbp(tb-ta,0)+' under'}</b>`:''}</div>
    <div class="avhist">${hist.map(h=>`<div class="${h.k===AVM?'on':''}"><span class="b" style="height:${h.a/hmx*100}%;${h.a>tb?'background:var(--bad)':''}"></span><span class="l">${new Date(h.k+'-01T12:00').toLocaleDateString('en-GB',{month:'short'}).toLowerCase()}</span></div>`).join('')}<i class="avline" style="bottom:${tb/hmx*100}%"></i></div></div>`;
  el.oninput=e=>{const c=e.target.dataset.avc;if(!c)return;const v=e.target.value.replace(/[£,\s]/g,'');ACT.months[AVM]={...(ACT.months[AVM]||{}),[c]:v===''?null:+v};clearTimeout(renderActuals.t);renderActuals.t=setTimeout(()=>{save('money/actuals',ACT);const f=document.activeElement&&document.activeElement.dataset.avc;renderActuals();if(f){const n=el.querySelector(`[data-avc="${CSS.escape(f)}"]`);if(n){n.focus();n.setSelectionRange(n.value.length,n.value.length)}}},700)}}
$('avPrev').onclick=()=>avShift(-1);$('avNext').onclick=()=>avShift(1);

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
const VIEWS=[['today','today','◉'],['week','week','▦'],['streaks','streaks','✦'],['gym','gym','▲'],['food','food','◍'],['sleep','sleep','☾'],['journal','journal','✎'],['tools','tools','⧗'],['media','media','◐'],['stack','stack','◈'],['money','money','£']];
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
  if(v==='week')renderWeek();if(v==='gym')loadGym();if(v==='tools')renderTools();if(v==='media')renderMedia();if(v==='food')loadFood();if(v==='sleep')loadSleep();if(v==='journal')setJTab(JTAB);if(v==='streaks')loadHabits();
  if(v==='money'||v==='stack')document.querySelectorAll(`#v-${v} [data-scr]`).forEach(el=>scramble(el,el.dataset.scr,700));
  window.scrollTo(0,0);setTimeout(()=>staggerIn($('v-'+v)),20);
}
$('tabs').onclick=e=>{const b=e.target.closest('button');if(b)go(b.dataset.v)};
$('bnav').onclick=e=>{const b=e.target.closest('button');if(b){go(b.dataset.v);try{navigator.vibrate&&navigator.vibrate(8)}catch(_){}}};
addEventListener('hashchange',()=>go(location.hash.slice(1),true));
/* section changes only from the nav buttons (no swipe) */
function renderAllViews(){renderToday();renderStack();renderMoney();renderTargets();renderTools()}

/* ================= PALETTE + KEYS ================= */
let palItems=[],palSel=0;
function palIndex(){
  const a=VIEWS.map(([v])=>({l:'/'+v,s:'view',run:()=>go(v)}));
  a.push({l:'edit mode',s:EDIT?'on':'off',run:()=>setEdit(!EDIT)},{l:'add compound',s:'stack',run:()=>{go('stack');addStack()}},{l:'add bill',s:'money',run:()=>{go('money');addExp()}},{l:'log blood pressure',s:'body',run:()=>{go('today');setTimeout(()=>{$('bodyCheck').scrollIntoView({behavior:'smooth',block:'center'});$('bpS').focus()},300)}},{l:'log weight',s:'body',run:()=>{go('today');setTimeout(()=>{$('bodyCheck').scrollIntoView({behavior:'smooth',block:'center'});$('wtIn').focus()},300)}},{l:'start focus timer',s:'tools',run:()=>{TOOLV='focus';go('tools');renderTools();setTimeout(()=>{if(!TM.end&&$('tmGo'))$('tmGo').click()},200)}},{l:'write in journal',s:'journal',run:()=>{go('journal')}},{l:'start workout',s:'gym',run:()=>{go('gym');if(!ACTIVE)startWorkout(null)}},{l:'boot video',s:'settings',run:openBootVideo},{l:'focus timer',s:'tools',run:()=>{TOOLV='focus';go('tools');renderTools()}},{l:'log a dose',s:'protocols',run:()=>{TOOLV='protocols';go('tools');renderTools()}},{l:'log a leetcode problem',s:'leetcode',run:()=>{TOOLV='leetcode';go('tools');renderTools();setTimeout(()=>pickProblem(s=>openProblem(s,true)),300)}},{l:'sign out',s:'account',run:signOut});
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
$('pal').onclick=e=>{if(e.target===$('pal'))closePal()};
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
  await loadEdits();BFX('edit queue synced',48);
  const ok=await loadGridsFromDb(true);BFX(ok?'sheets pulled · stack/money/plan':'sheets: using local cache',ok?66:66,ok?undefined:false);
  $('nodata').hidden=ok||!!GMETA.at;
  rebuild();booted=true;await Promise.all([loadStackStatus(),loadActuals()]);renderPend();renderStack();renderMoney();renderTargets();
  cur=null;go(location.hash.slice(1)||'today',true);
  BFX('ui compiled · '+(cur||'today'),78);
  await loadDay();await loadTools();loadBody();BFX('day state + tools restored',90);
  startRealtime();startAgentLink();loadArtImages();flushOutbox();
  setSync(ONLINE?'on':'',ONLINE?'synced':'offline');BFX('realtime channel open',96);BFXdone('system ready');setTimeout(cacheBootVideo,600);
  schedWidget();setInterval(publishWidget,10*60*1000);setTimeout(()=>{Promise.all([loadHabits(),loadTasks()]).catch(()=>{}).then(()=>{if(typeof pushSync==='function')pushSync()})},4000);document.addEventListener('visibilitychange',()=>{if(!document.hidden&&typeof pushSync==='function'){NQ=null;pushSync()}});
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
    items:vis.map(i=>({t:fmtM(i.t),n:i.item,d:!!DAY.ticks[i.tk],c:!!i.cmp})),water:DAY.water||0,waterTarget:(SET&&SET.water)||8,dw:DAY.dw||0,lc:typeof leetWeek==='function'?leetWeek():0,
    habits:HABITS.map(([l,re])=>({l,d:visibleItems().some(i=>re.test(i.item)&&DAY.ticks[i.tk])}))},true)}

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
  <div class="bigbtns"><label class="btn p" style="cursor:pointer">upload new<input type="file" id="bvFile" accept="video/mp4,video/*" hidden></label><button class="btn" type="button" id="bvRefresh">re-download here</button><button class="btn" type="button" id="bvDel">remove</button></div>`);bvStatus();
  $('bvFile').onchange=async e=>{const f=e.target.files&&e.target.files[0];e.target.value='';if(!f||!SB||!UID)return;
    if(f.size>50*1048576){$('bvStat').textContent='over 50 MB: trim it first';return}
    $('bvStat').textContent='uploading…';const {error}=await SB.storage.from('vault').upload(UID+'/boot.mp4',f,{upsert:true,contentType:f.type||'video/mp4'});
    if(error){$('bvStat').textContent='upload failed: '+error.message;return}LS.set('bootvidStamp',null);LS.set('bootvidRemoved',null);$('bvStat').textContent='uploaded · saving here…';await cacheBootVideo();flash('boot_video_set')};
  $('bvRefresh').onclick=async()=>{LS.set('bootvidStamp',null);$('bvStat').textContent='downloading…';await cacheBootVideo();bvStatus()};
  $('bvDel').onclick=async()=>{if(!SB||!UID)return;await SB.storage.from('vault').remove([UID+'/boot.mp4']);LS.set('bootvidRemoved',1);if(window.caches){const c=await caches.open('ds-media');await c.delete('bootvid')}LS.set('bootvidStamp',null);bvStatus()}}

/* no pinch / double-tap zoom, like a real app */
document.addEventListener('gesturestart',e=>e.preventDefault());document.addEventListener('touchmove',e=>{if(e.touches.length>1)e.preventDefault()},{passive:false});

/* ================= MEDIA — anime · movies · manga · books (Letterboxd + MyAnimeList style) ================= */
const MK={anime:{label:'anime',verb:'watch',unit:'ep',units:'episodes',ing:'watching',stars:10,icon:'◐'},movies:{label:'movies',verb:'watch',unit:'',units:'',ing:'watching',stars:5,icon:'▶'},manga:{label:'manga',verb:'read',unit:'ch',units:'chapters',ing:'reading',stars:10,icon:'❏'},books:{label:'books',verb:'read',unit:'p',units:'pages',ing:'reading',stars:5,icon:'▤'}};
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
  el.innerHTML=`<div class="row" style="justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:10px"><div class="seg" id="mSeg">${tabs.map(([k,l])=>`<button type="button" data-mv="${k}" aria-pressed="${MEDIAV===k}">${l}</button>`).join('')}</div><button class="btn p" type="button" id="mAddBtn">+ add ${MK[MEDIAK].label==='movies'?'film':MK[MEDIAK].label==='books'?'book':MEDIAK}</button></div><div id="mBody"></div>`;
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
  $('mBody').innerHTML=`${fav.length?`<div class="tag" style="margin-bottom:6px">favourites</div><div class="mfavs">${fav.map(it=>mCard(k,it)).join('')}</div>`:''}
  <div class="row" style="gap:6px;flex-wrap:wrap;margin:10px 0"><div class="chips" id="mSt" style="margin:0">${[['all','all']].concat(MSTAT(k)).map(([s,l])=>`<button class="chip" type="button" data-st="${s}" aria-pressed="${MFILT.st===s}">${l} <span class="c">${cnt(s)}</span></button>`).join('')}</div></div>
  <div class="row" style="gap:6px;margin-bottom:10px"><select class="inp" id="mSort" style="flex:1">${[['recent','recently updated'],['rating','rating'],['title','title'],['year','year']].map(([v,l])=>`<option value="${v}" ${MFILT.sort===v?'selected':''}>${l}</option>`).join('')}</select></div>
  <div class="mgrid">${list.map(it=>mCard(k,it)).join('')||`<div class="dim">Nothing here yet. Tap “+ add” to search.</div>`}</div>`;
  $('mSt').onclick=e=>{const b=e.target.closest('[data-st]');if(b){MFILT.st=b.dataset.st;mLibrary(k)}};$('mSort').onchange=e=>{MFILT.sort=e.target.value;mLibrary(k)};
  $('mBody').onclick=e=>{const b=e.target.closest('[data-mkey]');if(b)mEntry(k,b.dataset.mkey)}}

/* ---- add (search) ---- */
mAdd.seq=0;
function mAdd(k){openSheet('add '+MK[k].label,`<input class="inp" id="msQ" placeholder="search ${k==='anime'||k==='manga'?'AniList / MyAnimeList':k==='books'?'Open Library':'films & series'}…" autocomplete="off" style="margin-bottom:10px"><div class="msres" id="msRes"><div class="dim">Type a title.</div></div><button class="iconbtn" type="button" id="msManual" style="margin-top:10px">+ add manually</button>`);
  let t=null,last=[];$('msQ').oninput=e=>{clearTimeout(t);const q=e.target.value;t=setTimeout(async()=>{const my=++mAdd.seq;$('msRes').innerHTML='<div class="dim">searching…</div>';const r=await msearch(k,q);if(my!==mAdd.seq||!$('msRes'))return;if(r===null){$('msRes').innerHTML=`<div class="dim">Couldn’t reach the search sources (${esc(MSEARCH_ERR)}). Try again in a moment, or use “add manually”.</div>`;return}last=r;
    $('msRes').innerHTML=r.map((x,i)=>`<button type="button" class="msr" data-i="${i}">${poster(x,'msp')}<span><b>${esc(x.title)}</b><span class="dim">${[x.year,x.kind,x.total?x.total+' '+MK[k].units:'',x.by].filter(Boolean).map(esc).join(' · ')}</span></span>${MEDIA[k].items[x.key]?'<span class="chipy">in library</span>':''}</button>`).join('')||'<div class="dim">No results.</div>'},350)};
  setTimeout(()=>$('msQ')&&$('msQ').focus(),200);
  $('msRes').onclick=e=>{const b=e.target.closest('[data-i]');if(!b)return;const x=last[+b.dataset.i];if(MEDIA[k].items[x.key])return mEntry(k,x.key);const it={...x,st:k==='movies'?'done':'plan',prog:0,rating:null,added:DAYK,upd:new Date().toISOString(),log:k==='movies'?[{d:DAYK,r:null,re:false}]:[],tags:[],fin:k==='movies'?DAYK:undefined};delete it.score;it.mal=x.score;MEDIA[k].items[it.key]=it;saveMedia(k);flash('added');mEntry(k,it.key,true);menrich(k,it).then(()=>{const a=document.activeElement;if($('sheet').classList.contains('on')&&$('sheetTitle').textContent===it.title&&!(a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName)))mEntry(k,it.key)})};
  $('msManual').onclick=()=>{const title=($('msQ').value||'').trim()||'untitled';const it={key:'m'+rid(),src:'manual',title,img:'',st:'plan',prog:0,rating:null,added:DAYK,upd:new Date().toISOString(),log:[],tags:[],genres:[]};MEDIA[k].items[it.key]=it;saveMedia(k);mEntry(k,it.key,true)}}

/* ---- entry sheet ---- */
function mEntry(k,key,fresh){const it=MEDIA[k].items[key];if(!it)return;const max=MK[k].stars;const K=MK[k];
  const persist=()=>{it.upd=new Date().toISOString();saveMedia(k);if(cur==='media')renderMedia()};
  const rateBtns=max===10?[...Array(10)].map((_,i)=>`<button type="button" class="rb${+it.rating===i+1?' on':''}" data-rate="${i+1}">${i+1}</button>`).join(''):[1,2,3,4,5].map(n=>{const r=+it.rating||0;const cls=r>=n?'full':r>=n-.5?'half':'';return `<span class="star5 ${cls}"><button type="button" data-rate="${n-.5}" aria-label="${n-.5} stars"></button><button type="button" data-rate="${n}" aria-label="${n} stars"></button></span>`}).join('');
  openSheet(it.title,`<div class="mhero">${poster(it,'mbig')}<div class="mhi"><b>${esc(it.title)}</b>${it.alt&&it.alt!==it.title?`<span class="dim">${esc(it.alt)}</span>`:''}<span class="dim">${[it.year,it.kind,it.by].filter(Boolean).map(esc).join(' · ')}</span>${it.genres&&it.genres.length?`<div class="chips" style="margin:6px 0 0">${it.genres.slice(0,6).map(g=>`<span class="chipy">${esc(g)}</span>`).join('')}</div>`:''}${it.mal?`<span class="dim">${it.src==='imdb'?'IMDb':it.src==='mal'?'MAL':it.src==='anilist'?'AniList':it.src==='kitsu'?'Kitsu':'score'} ${it.mal}/10</span>`:''}${it.url?`<a class="iconbtn" href="${esc(it.url)}" target="_blank" rel="noopener" style="width:fit-content;margin-top:6px">open ↗</a>`:''}</div></div>
  <div class="tag" style="margin:12px 0 6px">status</div><div class="chips" id="meSt">${MSTAT(k).map(([s,l])=>`<button class="chip" type="button" data-st="${s}" aria-pressed="${it.st===s}">${l}</button>`).join('')}</div>
  <div class="tag" style="margin:6px 0 6px">your rating ${max===10?'/ 10':''}</div><div class="rates${max===10?'':' starrow'}" id="meRate">${rateBtns}<button type="button" class="iconbtn" data-rate="">clear</button></div>
  ${K.unit?`<div class="tag" style="margin:12px 0 6px">progress</div><div class="row" style="gap:8px;align-items:center"><button class="btn" type="button" data-pg="-1">−</button><input class="inp num" id="mePg" value="${it.prog||0}" inputmode="numeric" style="width:80px;text-align:center"><span class="dim">/ <input class="inp num" id="meTot" value="${it.total||''}" placeholder="?" inputmode="numeric" style="width:70px;display:inline-block"> ${K.units}</span><button class="btn p" type="button" data-pg="1">+1</button></div>`:''}
  <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:12px"><label class="dim">started<input class="inp" type="date" id="meS" value="${it.start||''}"></label><label class="dim">finished<input class="inp" type="date" id="meF" value="${it.fin||''}"></label><label class="dim" style="display:flex;gap:6px;align-items:center;margin-top:18px"><input type="checkbox" id="meFav" ${it.fav?'checked':''} style="width:auto;display:inline"> favourite</label></div>
  <div class="tag" style="margin:12px 0 6px">review</div><textarea class="inp" id="meRev" rows="4" placeholder="what did you think?">${esc(it.review||'')}</textarea>
  <label class="dim">tags (comma separated)<input class="inp" id="meTags" value="${esc((it.tags||[]).join(', '))}"></label>
  ${epBlock(k,it)}
  <div class="tag" style="margin:14px 0 6px">diary · ${(it.log||[]).length} ${K.verb==='watch'?'watch':'read'}${(it.log||[]).length===1?'':'es'}</div>
  <div class="row" style="gap:8px;flex-wrap:wrap;align-items:end"><label class="dim">date<input class="inp" type="date" id="meLd" value="${DAYK}"></label><label class="dim" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="meRe" ${(it.log||[]).length?'checked':''} style="width:auto;display:inline"> re${K.verb}</label><button class="btn" type="button" id="meLog">log ${K.verb==='watch'?'watched':'read'}</button></div>
  <div class="hsets" style="margin-top:8px">${(it.log||[]).map((l,i)=>`<span class="set">${esc(nice(l.d).toLowerCase())}${l.re?' ↻':''}${l.r!=null&&l.r!==''?' · '+stars(l.r,max):''} <button class="iconbtn" type="button" data-ldi="${i}" style="padding:0 4px">✕</button></span>`).join('')}</div>
  ${it.syn?`<details style="margin-top:12px"><summary class="dim">synopsis</summary><p style="font-size:13px;line-height:1.55">${esc(it.syn)}</p></details>`:''}
  <div class="tag" style="margin:14px 0 6px">lists</div><div class="chips" id="meLists">${(MEDIA[k].lists||[]).map(l=>`<button class="chip" type="button" data-li="${esc(l.id)}" aria-pressed="${l.keys.includes(key)}">${esc(l.name)}</button>`).join('')}<button class="chip" type="button" data-li="new">+ new list</button></div>
  <div class="bigbtns" style="margin-top:14px"><button class="btn d" type="button" id="meDel">remove</button><span style="flex:1"></span><button class="btn p" type="button" id="meOk">done</button></div>`);
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
  <textarea class="inp" id="meEpNote" rows="2" placeholder="thoughts on this ${U}…" style="margin-top:8px"></textarea><div class="row" style="justify-content:flex-end;margin-top:6px"><button class="btn p" type="button" id="meEpSave">save ${U}</button></div></div>
  <div class="eplist" id="meEpList">${ns.map(n=>{const e=eps[n];return `<div class="eprow"><button type="button" class="epmain" data-epo="${n}"><b class="num">${U==='episode'?'EP':'CH'} ${n}</b>${e.r?`<span class="epr num">${e.r}/10</span>`:''}<span class="dim">${esc((e.note||'').slice(0,90))}${(e.note||'').length>90?'…':''}</span></button><button class="iconbtn" type="button" data-epd="${n}">✕</button></div>`}).join('')}</div>`}
/* ---- diary (Letterboxd style) ---- */
function mDiary(k){const rows=[];mItems(k).forEach(it=>(it.log||[]).forEach(l=>rows.push({it,l})));rows.sort((a,b)=>a.l.d<b.l.d?1:-1);const max=MK[k].stars;let lastM='';
  $('mBody').innerHTML=`<div class="mdiary">${rows.map(({it,l})=>{const m=l.d.slice(0,7);const head=m!==lastM?`<div class="mdm">${new Date(l.d+'T12:00').toLocaleDateString('en-GB',{month:'long',year:'numeric'})}</div>`:'';lastM=m;
    return head+`<button type="button" class="mdr" data-mkey="${esc(it.key)}"><span class="mdd num">${+l.d.slice(8)}</span>${poster(it,'msp')}<span class="mdt"><b>${esc(it.title)}</b><span class="dim">${esc(String(it.year||''))}</span></span><span>${l.r!=null&&l.r!==''?stars(l.r,max):''}</span><span class="dim">${l.re?'↻':''}${it.review?' ✎':''}${it.fav?' ♥':''}</span></button>`}).join('')||'<div class="dim">Your diary fills in as you log things you finish.</div>'}</div>`;
  $('mBody').onclick=e=>{const b=e.target.closest('[data-mkey]');if(b)mEntry(k,b.dataset.mkey)}}
/* ---- lists ---- */
function mLists(k){const L=MEDIA[k].lists||[];
  $('mBody').innerHTML=`<div class="row" style="justify-content:flex-end;margin-bottom:8px"><button class="iconbtn" type="button" id="mlNew">+ new list</button></div>${L.map(l=>`<div class="panel" style="margin-bottom:10px"><div class="ph"><span class="tag">${esc(l.name)} · ${l.keys.length}</span><span class="row" style="gap:6px"><button class="iconbtn" type="button" data-lren="${esc(l.id)}">rename</button><button class="iconbtn" type="button" data-ldel="${esc(l.id)}">delete</button></span></div><div class="pb"><div class="mgrid sm">${l.keys.map(x=>MEDIA[k].items[x]).filter(Boolean).map(it=>mCard(k,it)).join('')||'<span class="dim">Add titles to this list from their page.</span>'}</div></div></div>`).join('')||'<div class="dim">Make lists like “all-time top 10”, “comfort rewatches” or “2026 to-watch”.</div>'}`;
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
      ${yrLogs.length?`<div><span class="wrl">busiest month</span><b class="wrs">${new Date(yr,bm,1).toLocaleDateString('en-GB',{month:'long'}).toLowerCase()}</b></div>`:''}
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
  $('mBody').innerHTML=W+`<div class="statcards"><div><span class="dim">completed</span><b class="num">${done.length}</b></div><div><span class="dim">in ${yr}</span><b class="num">${thisYear.length}</b></div><div><span class="dim">avg rating</span><b class="num">${avg==null?'—':kgs(Math.round(avg*10)/10)}<small>${max===10?' /10':' ★'}</small></b></div>${MK[k].unit?`<div><span class="dim">${MK[k].units}</span><b class="num">${units.toLocaleString('en-GB')}</b></div>`:''}${hours!=null?`<div><span class="dim">hours watched</span><b class="num">${hours}</b></div>`:''}<div><span class="dim">plan to ${MK[k].verb}</span><b class="num">${all.filter(x=>x.st==='plan').length}</b></div></div>
  <div class="statsplit"><div class="panel"><div class="ph"><span class="tag">${yr} by month</span></div><div class="pb"><div class="wkbars" style="grid-template-columns:repeat(12,1fr)">${months.map((v,i)=>`<div class="d"><span class="p num">${v||''}</span><div class="b" style="height:${v/mmx*100}%"></div><span class="l">${'jfmamjjasond'[i]}</span></div>`).join('')}</div></div></div>
  <div class="panel"><div class="ph"><span class="tag">ratings</span><span class="dim">${rated.length} rated</span></div><div class="pb"><div class="wkbars" style="grid-template-columns:repeat(10,1fr)">${dist.map((v,i)=>`<div class="d"><span class="p num">${v||''}</span><div class="b" style="height:${v/dmx*100}%;background:var(--cyan)"></div><span class="l">${max===10?buckets[i]:(buckets[i]%1?'½':buckets[i])}</span></div>`).join('')}</div></div></div></div>
  <div class="panel" style="margin-top:12px"><div class="ph"><span class="tag">top genres</span></div><div class="pb"><div class="mbars">${gl.map(([g,v])=>`<div><span>${esc(g)}</span><i style="--w:${v/gmx*100}%"></i><b class="num">${v}</b></div>`).join('')||'<span class="dim">Add a few titles to see your taste.</span>'}</div></div></div>`;
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
  el.innerHTML=`<div class="fdate"><button class="iconbtn" type="button" data-fd="-1">‹</button><b>${isToday?'today':esc(nice(FD).toLowerCase())}</b><button class="iconbtn" type="button" data-fd="1" ${isToday?'disabled':''}>›</button></div>
  <div class="fhero panel"><div class="fring"><svg viewBox="0 0 140 140"><circle cx="70" cy="70" r="${R}" class="rb"/><circle cx="70" cy="70" r="${R}" class="rf${over?' over':''}" style="stroke-dasharray:${C};stroke-dashoffset:${C*(1-pct)}"/></svg><div><b class="num${over?' bad':''}">${Math.abs(left)}</b><span class="dim">${over?'over':'left'}</span></div></div>
    <div class="feq num"><div><b>${B}</b><span>budget</span></div><i>−</i><div><b>${Math.round(S.kcal)}</b><span>food</span></div><i>+</i><div><b>${EX}</b><span>exercise</span></div><i>=</i><div><b class="${over?'bad':'ok'}">${left}</b><span>${over?'over':'remaining'}</span></div></div>
    <div class="fmacs">${mbar('protein',S.p,T.p,'var(--pink)')}${mbar('carbs',S.c,T.c,'var(--cyan)')}${mbar('fat',S.f,T.f,'#ffb000')}</div>
    <div class="fquick"><button type="button" class="btn p" data-fadd="${fAutoMeal()}">🔍 log food</button><button type="button" class="btn" id="fScanTop">▥ scan barcode</button></div>
    <div class="fnut dim num">fibre ${r1(S.fi)}/${(FPROF&&FPROF.fib)||30} g · sugar ${r1(S.su)} g · sodium ${Math.round(S.na)}/${(FPROF&&FPROF.na)||2300} mg</div></div>
  ${FMEALS.map(([m,lab])=>{const L=x.m[m]||[],s=fSum(L);return `<div class="panel fmeal"><div class="ph"><span class="tag">${lab}</span><span class="row" style="gap:6px"><span class="num">${Math.round(s.kcal)} kcal</span><button class="iconbtn" type="button" data-fmenu="${m}">⋯</button></span></div><div class="pb">
    ${L.map((e,i)=>`<button type="button" class="frow" data-fe="${m}:${i}"><span><b>${esc(e.n)}</b><span class="dim">${esc(fAmt(e))}${e.b?' · '+esc(e.b):''}</span></span><span class="num">${Math.round(fNum(e,'k'))}</span></button>`).join('')}
    <button class="addrow" type="button" data-fadd="${m}">+ add food</button></div></div>`}).join('')}
  <div class="panel fmeal"><div class="ph"><span class="tag">exercise</span><span class="num">${EX} kcal</span></div><div class="pb">${(x.ex||[]).map((e,i)=>`<button type="button" class="frow" data-fx="${i}"><span><b>${esc(e.n)}</b><span class="dim">${e.min?e.min+' min':''}</span></span><span class="num">${e.k}</span></button>`).join('')}<button class="addrow" type="button" id="fAddEx">+ add exercise</button></div></div>
  <div class="panel"><div class="ph"><span class="tag">water</span><span class="num">${x.w||0} / ${(FPROF&&FPROF.water)||2500} ml</span></div><div class="pb"><div class="fwater">${[...Array(Math.ceil(((FPROF&&FPROF.water)||2500)/250))].map((_,i)=>`<button type="button" class="${(x.w||0)>=(i+1)*250?'on':''}" data-fw="${(i+1)*250}" aria-label="${(i+1)*250} ml"></button>`).join('')}</div></div></div>
  <div class="panel"><div class="ph"><span class="tag">notes</span></div><div class="pb"><textarea class="inp" id="fNote" rows="2" placeholder="how did today go?">${esc(x.note||'')}</textarea></div></div>`;
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
  if(b.dataset.fx){const i=+b.dataset.fx;openSheet('exercise',`<p>${esc(x.ex[i].n)} · ${x.ex[i].k} kcal</p><div class="bigbtns"><button class="btn d" type="button" id="fxDel">remove</button><button class="btn p" type="button" id="fxOk">done</button></div>`);$('fxOk').onclick=closeSheet;$('fxDel').onclick=()=>{x.ex.splice(i,1);saveDay(FD);closeSheet();fLog()}}}
function fMealMenu(m){const lab=FMEALS.find(z=>z[0]===m)[1];const x=fDay(FD);const y=new Date(FD+'T12:00');y.setDate(y.getDate()-1);const yk=ymd(y);const yl=(fDay(yk).m[m]||[]);
  openSheet(lab,`<div class="bigbtns col"><button class="btn" type="button" id="fmCopy" ${yl.length?'':'disabled'}>copy yesterday's ${lab} (${yl.length} item${yl.length===1?'':'s'})</button><button class="btn" type="button" id="fmSave" ${(x.m[m]||[]).length?'':'disabled'}>save this ${lab} as a meal</button><button class="btn d" type="button" id="fmClear" ${(x.m[m]||[]).length?'':'disabled'}>clear ${lab}</button></div>`);
  $('fmCopy').onclick=()=>{x.m[m]=(x.m[m]||[]).concat(clone(yl).map(e=>({...e,id:rid()})));saveDay(FD);closeSheet();fLog()};
  $('fmSave').onclick=()=>{const n=prompt('name this meal',lab+' '+nice(FD).toLowerCase());if(!n)return;FLIB.meals.unshift({id:rid(),n,items:clone(x.m[m])});saveLib();closeSheet()};
  $('fmClear').onclick=function(){if(!this.dataset.arm){this.dataset.arm=1;this.textContent='tap again to clear';return}x.m[m]=[];saveDay(FD);closeSheet();fLog()}}

/* ---------- add food: search, recent, frequent, my foods, meals, barcode, quick add ---------- */
let FTAB='recent',fSeq=0;
function fAdd(meal){const lab=FMEALS.find(z=>z[0]===meal)[1];
  openSheet('add to '+lab,`<div class="fsearch"><input class="inp" id="fQ" placeholder="search foods & brands…" autocomplete="off" enterkeyhint="search"><button class="btn" type="button" id="fScan" aria-label="Scan barcode">▥ scan</button></div>
  <div class="seg mini" id="fTabs" style="margin:8px 0">${[['recent','recent'],['freq','frequent'],['mine','my foods'],['meals','meals']].map(([k,l])=>`<button type="button" data-ft="${k}" aria-pressed="${FTAB===k}">${l}</button>`).join('')}</div>
  <div class="row" style="gap:6px;margin-bottom:8px"><button class="iconbtn" type="button" id="fQuick">+ quick add</button><button class="iconbtn" type="button" id="fCreate">+ create food</button></div>
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
  return (R.length?(fav.length?'<div class="flab">favourites</div>'+fav.map(fRow).join(''):'')+rest.slice(0,40).map(fRow).join(''):'<div class="dim fempty">Search above, scan a barcode, or pick from common foods:</div>'+FGEN.slice(0,30).map(fRow).join(''))}
function offToFood(p){const n=p.nutriments||{};let k=n['energy-kcal_100g'];if(k==null&&n['energy_100g']!=null)k=n['energy_100g']/4.184;if(k==null)return null;
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
  const items=await offCall({q});if(my!==fSeq||!$('fRes'))return;
  const on=(items||[]).map(offToFood).filter(Boolean).filter(f=>!seen.has(f.id));
  const lab=$('fOnl');if(!lab)return;lab.outerHTML=items===null?'<div class="dim fempty">Online search unavailable right now — use create food or quick add.</div>':on.length?'<div class="flab">from Open Food Facts</div>'+on.map(fRow).join(''):(loc.length?'':'<div class="dim fempty">Nothing found. Try another word, scan the barcode, or create it.</div>')}

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
    <div class="bigbtns" style="margin-top:14px">${ent?'<button class="btn d" type="button" id="fpDel">delete</button>':''}<button class="iconbtn" type="button" id="fpFav">${FLIB.fav[f.fid||f.id]?'★ favourite':'☆ favourite'}</button><span style="flex:1"></span><button class="btn p" type="button" id="fpOk">${ent?'save':'add'}</button></div>`);
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
  openSheet('quick add',`<label class="fl">name<input class="inp" id="qaN" value="${esc(e.n||'quick add')}"></label><div class="fgrid4"><label class="fl">kcal<input class="inp num" id="qaK" inputmode="decimal" value="${e.qk||''}"></label><label class="fl">protein g<input class="inp num" id="qaP" inputmode="decimal" value="${e.qp||''}"></label><label class="fl">carbs g<input class="inp num" id="qaC" inputmode="decimal" value="${e.qc||''}"></label><label class="fl">fat g<input class="inp num" id="qaF" inputmode="decimal" value="${e.qf||''}"></label></div>
  <div class="dim" style="font-size:11px">Leave kcal empty and it's worked out from the macros.</div><div class="bigbtns" style="margin-top:12px">${idx!=null?'<button class="btn d" type="button" id="qaDel">delete</button>':''}<span style="flex:1"></span><button class="btn p" type="button" id="qaOk">${idx!=null?'save':'add'}</button></div>`);
  $('qaK').focus();
  if($('qaDel'))$('qaDel').onclick=()=>{x.m[meal].splice(idx,1);saveDay(FD);closeSheet();fLog()};
  $('qaOk').onclick=()=>{const P=+$('qaP').value||0,C=+$('qaC').value||0,F=+$('qaF').value||0;let K=+$('qaK').value;if(!K)K=Math.round(P*4+C*4+F*9);if(!K)return;
    const ne={id:e.id||rid(),quick:1,n:$('qaN').value.trim()||'quick add',qk:K,qp:P,qc:C,qf:F,t:new Date().toISOString()};if(idx!=null)x.m[meal][idx]=ne;else(x.m[meal]=x.m[meal]||[]).push(ne);saveDay(FD);closeSheet();fLog()}}
function fCreate(meal,pre={}){openSheet('create food',`<label class="fl">name<input class="inp" id="cfN" value="${esc(pre.n||'')}"></label><label class="fl">brand (optional)<input class="inp" id="cfB" value="${esc(pre.b||'')}"></label>
  <div class="fgrid4"><label class="fl">serving name<input class="inp" id="cfS" value="${esc(pre.sn||'serving')}"></label><label class="fl">serving size g<input class="inp num" id="cfG" inputmode="decimal" value="${pre.sg||100}"></label></div>
  <div class="dim" style="font-size:11px;margin:4px 0 6px">nutrition per serving — copy it straight off the label</div>
  <div class="fgrid4">${[['K','kcal'],['P','protein g'],['C','carbs g'],['F','fat g'],['Fi','fibre g'],['Su','sugar g'],['Na','sodium mg']].map(([k,l])=>`<label class="fl">${l}<input class="inp num" id="cf${k}" inputmode="decimal"></label>`).join('')}</div>
  <div class="bigbtns" style="margin-top:12px"><span style="flex:1"></span><button class="btn p" type="button" id="cfOk">save + add</button></div>`);
  $('cfOk').onclick=()=>{const n=$('cfN').value.trim();const g=+$('cfG').value||100;const v=k=>(+$('cf'+k).value||0)*100/g;if(!n||!$('cfK').value){$('cfN').focus();return}
    const f={id:'c-'+rid(),n,b:$('cfB').value.trim(),k:v('K'),p:v('P'),c:v('C'),f:v('F'),fi:v('Fi'),su:v('Su'),na:v('Na'),sv:[[$('cfS').value.trim()||'serving',g],['100 g',100]],code:pre.code||'',src:'mine'};
    FLIB.custom.unshift(f);saveLib();fPortion(f,{meal,isNew:true})}}

/* barcode: native BarcodeDetector where available, otherwise ZXing (loaded only when you scan) */
let fStream=null,fZX=null;
function fScanStop(){try{fZX&&fZX.reset()}catch(e){}fZX=null;if(fStream){fStream.getTracks().forEach(t=>t.stop());fStream=null}}
async function fScan(meal){openSheet('scan barcode',`<div class="fscan"><video id="fsV" playsinline muted></video><i class="fsline"></i></div><div class="dim" id="fsMsg" style="margin-top:8px">point the camera at the barcode…</div><div class="row" style="gap:8px;margin-top:8px"><input class="inp num" id="fsCode" placeholder="or type the barcode number" inputmode="numeric" style="flex:1"><button class="btn" type="button" id="fsGo">look up</button></div>`);
  const done=async code=>{fScanStop();$('fsMsg').textContent='looking up '+code+'…';const items=await offCall({code});const f=items&&items[0]?offToFood(items[0]):null;
    if(f){FCACHE[f.id]=f;fPortion(f,{meal,isNew:true})}else{$('fsMsg').innerHTML='Not in the database yet — <button class="iconbtn" type="button" id="fsNew">create it</button>';$('fsNew').onclick=()=>fCreate(meal,{code})}};
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
  <div class="fgrid4" style="margin-top:10px"><label class="fl">activity<input class="inp" id="exN" value="weights / gym"></label><label class="fl">minutes<input class="inp num" id="exM" inputmode="numeric" value="60"></label><label class="fl">kcal burned<input class="inp num" id="exK" inputmode="numeric"></label></div>
  <div class="dim" style="font-size:11px">kcal is estimated from the activity, time and your weight (${r1(kg)} kg) — overwrite it if your watch says different.</div>
  <div class="bigbtns" style="margin-top:12px"><span style="flex:1"></span><button class="btn p" type="button" id="exOk">add</button></div>`);
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
  el.innerHTML=`<div class="statcards"><div class="panel"><div class="pb"><span class="dim">current</span><b class="num">${r1(now)} kg</b></div></div><div class="panel"><div class="pb"><span class="dim">${now<=startKg?'lost':'gained'}</span><b class="num ${now<=startKg?'ok':''}">${r1(Math.abs(startKg-now))} kg</b></div></div><div class="panel"><div class="pb"><span class="dim">goal</span><b class="num">${goal?r1(goal)+' kg':'—'}</b></div></div><div class="panel"><div class="pb"><span class="dim">logging streak</span><b class="num pink">${streak} 🔥</b></div></div></div>
  <div class="panel"><div class="ph"><span class="tag">weight</span><span class="dim">${eta?'on pace for goal ~'+eta.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}).toLowerCase():'log weight on today ↓'}</span></div><div class="pb">${typeof spark==='function'?spark(ws.map(x=>+x.kg),{refs:goal?[{v:goal,l:'goal'}]:[]}):''}
    <form class="row" id="fWt" style="gap:6px;margin-top:8px"><input class="inp num" id="fWtIn" inputmode="decimal" placeholder="weigh in (kg)" style="flex:1"><button class="btn p" type="submit">log</button></form></div></div>
  <div class="panel"><div class="ph"><span class="tag">calories · last 14 days</span><span class="dim num">this week ${logged.length?(wkEat<=wkBud?gbp0(wkBud-wkEat)+' under':gbp0(wkEat-wkBud)+' over'):'—'}</span></div><div class="pb"><div class="fbars">${days.map(d=>`<div class="${d.k===DAYK?'on':''}"><span class="b ${d.kcal>d.b?'over':''}" style="height:${d.kcal/mx*100}%"></span><i style="bottom:${d.b/mx*100}%"></i><span class="l">${new Date(d.k+'T12:00').toLocaleDateString('en-GB',{weekday:'narrow'})}</span></div>`).join('')}</div>
    <div class="dim" style="font-size:11px;margin-top:6px">dashed line = your budget that day (incl. exercise) · ${logged.length} of 7 days logged this week · ${Math.round(wkEat)} eaten of ${Math.round(wkBud)} budgeted</div></div></div>
  <div class="grid2"><div class="panel"><div class="ph"><span class="tag">macros · 7-day average</span></div><div class="pb fdonut"><svg viewBox="0 0 42 42">${(()=>{let o=25;return [[ap*4,'var(--pink)'],[ac*4,'var(--cyan)'],[af*9,'#ffb000']].map(([v,c])=>{const p=v/tot*100;const s=`<circle cx="21" cy="21" r="15.9" fill="none" stroke="${c}" stroke-width="5" stroke-dasharray="${p} ${100-p}" stroke-dashoffset="${o}"/>`;o-=p;return s}).join('')})()}</svg>
    <div class="num"><div><b style="color:var(--pink)">${Math.round(ap)} g</b> protein <span class="dim">/ ${T.p} · ${Math.round(ap*4/tot*100)}%</span></div><div><b style="color:var(--cyan)">${Math.round(ac)} g</b> carbs <span class="dim">/ ${T.c} · ${Math.round(ac*4/tot*100)}%</span></div><div><b style="color:#ffb000">${Math.round(af)} g</b> fat <span class="dim">/ ${T.f} · ${Math.round(af*9/tot*100)}%</span></div></div></div></div>
  <div class="panel"><div class="ph"><span class="tag">insights</span></div><div class="pb fins">${logged.length?[ap<T.p*0.9?`protein is averaging <b>${Math.round(ap)} g</b> — ${Math.round(T.p-ap)} g a day under your target`:`protein on target — averaging <b>${Math.round(ap)} g</b>`,`average day: <b>${Math.round(wkEat/Math.max(1,logged.length))} kcal</b> vs a <b>${B}</b> budget`,tops.length?`biggest calorie sources this month: ${tops.map(([n,k])=>`<b>${esc(n)}</b> (${Math.round(k)})`).join(', ')}`:''].filter(Boolean).map(t=>`<div>▸ ${t}</div>`).join(''):'<div class="dim">Log a few days and patterns show up here.</div>'}</div></div></div>`;
  $('fWt').onsubmit=e=>{e.preventDefault();const kg=parseFloat($('fWtIn').value.replace(',','.'));if(!kg)return;WT.r.push({t:new Date().toISOString(),kg});save('body/wt',WT);if(typeof renderBody==='function')renderBody();fProgress()}}
const gbp0=n=>Math.round(n)+' kcal';

/* ---------- fasting ---------- */
function fFast(){const el=$('foodBody');const P=FPROF||{};const H=+P.fastH||16;const c=FFAST.cur;const now=Date.now();
  const el_=c?(now-new Date(c.s))/36e5:0;const pct=Math.min(1,el_/(c?c.h:H));const R=86,C=2*Math.PI*R;
  const zone=h=>h<4?'fed — digesting':h<12?'early fast':h<16?'fat-burning window':h<24?'deep fast':'extended fast';
  el.innerHTML=`<div class="panel ffast"><div class="pb"><div class="fring big"><svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="${R}" class="rb"/><circle cx="100" cy="100" r="${R}" class="rf" style="stroke-dasharray:${C};stroke-dashoffset:${C*(1-pct)}"/></svg><div><span class="dim">${c?'fasting':'not fasting'}</span><b class="num" id="ffT">${c?fmtH(el_):H+':00'}</b><span class="dim" id="ffZ">${c?zone(el_):'target'}</span></div></div>
    ${c?`<div class="dim num" style="text-align:center">started ${new Date(c.s).toLocaleString('en-GB',{weekday:'short',hour:'2-digit',minute:'2-digit'})} · goal ${c.h} h · ends ${new Date(new Date(c.s).getTime()+c.h*36e5).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</div>`:''}
    <div class="seg mini" id="ffH" style="justify-content:center;margin:12px 0">${[12,14,16,18,20,24].map(h=>`<button type="button" data-ffh="${h}" aria-pressed="${(c?c.h:H)===h}">${h===24?'OMAD':h+':'+(24-h)}</button>`).join('')}</div>
    <div class="bigbtns" style="justify-content:center"><button class="btn p" type="button" id="ffGo">${c?'end fast':'start fast'}</button>${c?'':'<button class="btn" type="button" id="ffBack">started earlier…</button>'}</div></div></div>
  <div class="panel"><div class="ph"><span class="tag">recent fasts</span><span class="dim">${FFAST.log.length} logged</span></div><div class="pb">${FFAST.log.slice(-10).reverse().map(f=>{const h=(new Date(f.e)-new Date(f.s))/36e5;return `<div class="frow" style="cursor:default"><span><b>${new Date(f.s).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}).toLowerCase()}</b><span class="dim">goal ${f.h} h</span></span><span class="num ${h>=f.h?'ok':''}">${fmtH(h)} ${h>=f.h?'✓':''}</span></div>`}).join('')||'<div class="dim">No fasts yet.</div>'}</div></div>`;
  el.onclick=e=>{const b=e.target.closest('button');if(!b)return;
    if(b.dataset.ffh){const h=+b.dataset.ffh;if(FFAST.cur){FFAST.cur.h=h;save('food/fast',FFAST)}else{FPROF={...(FPROF||{}),fastH:h};save('food/profile',FPROF)}fFast();return}
    if(b.id==='ffGo'){if(FFAST.cur){FFAST.log.push({...FFAST.cur,e:new Date().toISOString()});FFAST.log=FFAST.log.slice(-200);FFAST.cur=null}else FFAST.cur={s:new Date().toISOString(),h:H};save('food/fast',FFAST);if(FFAST.cur&&nOn('fast'))pushOne('fast',new Date(FFAST.cur.s).getTime()+FFAST.cur.h*36e5,'fasting goal reached 🎯',FFAST.cur.h+' h done — break your fast when ready','./#food');else pushCancel('fast');fFast();return}
    if(b.id==='ffBack'){const t=prompt('when did you start? (HH:MM)','20:00');if(!t||!/^\d{1,2}:\d{2}$/.test(t))return;const [hh,mm]=t.split(':').map(Number);const d=new Date();d.setHours(hh,mm,0,0);if(d>new Date())d.setDate(d.getDate()-1);FFAST.cur={s:d.toISOString(),h:H};save('food/fast',FFAST);fFast()}};
  clearInterval(fFast.t);if(c)fFast.t=setInterval(()=>{if(!$('ffT')||FV!=='fast'||!FFAST.cur){clearInterval(fFast.t);return}const h=(Date.now()-new Date(FFAST.cur.s))/36e5;$('ffT').textContent=fmtH(h);$('ffZ').textContent=zone(h)},1000)}
const fmtH=h=>{const s=Math.max(0,Math.floor(h*3600));return Math.floor(s/3600)+':'+pad(Math.floor(s%3600/60))+':'+pad(s%60)};

/* ---------- goals ---------- */
function fGoals(){const el=$('foodBody');const P={sex:'m',age:'',hcm:'',kg:curKg(),goalKg:'',rate:-0.5,act:1.375,mmode:'pct',mp:35,mc:35,mf:30,gp:'',gc:'',gf:'',water:2500,fib:30,na:2300,fastH:16,...(FPROF||{})};
  const sel=(id,opts,v)=>`<select class="inp" id="${id}">${opts.map(([k,l])=>`<option value="${k}" ${String(k)===String(v)?'selected':''}>${l}</option>`).join('')}</select>`;
  el.innerHTML=`${FPROF?'':'<div class="panel"><div class="pb"><b>set up your calorie budget</b><div class="dim">A few details and the app works out your daily budget and macros, the same way Lose It does.</div></div></div>'}
  <div class="grid2"><div class="panel"><div class="ph"><span class="tag">you</span></div><div class="pb fform">
    <label class="fl">sex${sel('gSex',[['m','male'],['f','female']],P.sex)}</label><label class="fl">age<input class="inp num" id="gAge" inputmode="numeric" value="${P.age}"></label>
    <label class="fl">height (cm)<input class="inp num" id="gH" inputmode="decimal" value="${P.hcm}"></label><label class="fl">current weight (kg)<input class="inp num" id="gKg" inputmode="decimal" value="${r1(P.kg)}"></label>
    <label class="fl">goal weight (kg)<input class="inp num" id="gGoal" inputmode="decimal" value="${P.goalKg}"></label><label class="fl">plan${sel('gRate',FRATE,P.rate)}</label>
    <label class="fl" style="grid-column:1/-1">activity (outside logged exercise)${sel('gAct',FACT,P.act)}</label>
    <label class="fl" style="grid-column:1/-1"><span><input type="checkbox" id="gNoEx" ${P.noEx?'':'checked'}> add logged exercise calories back to my budget</span></label></div></div>
  <div class="panel"><div class="ph"><span class="tag">daily budget</span></div><div class="pb"><div class="fbig num" id="gOut"></div>
    <label class="fl">override budget (optional)<input class="inp num" id="gOv" inputmode="numeric" value="${P.override||''}" placeholder="auto"></label>
    <div class="seg mini" id="gMode" style="margin:10px 0">${[['pct','macro %'],['g','macro grams']].map(([k,l])=>`<button type="button" data-gm="${k}" aria-pressed="${P.mmode===k}">${l}</button>`).join('')}</div>
    <div class="fgrid4" id="gMac"></div>
    <div class="fgrid4" style="margin-top:6px"><label class="fl">water ml<input class="inp num" id="gW" value="${P.water}"></label><label class="fl">fibre g<input class="inp num" id="gFi" value="${P.fib}"></label><label class="fl">sodium mg<input class="inp num" id="gNa" value="${P.na}"></label></div>
    <div class="bigbtns" style="margin-top:12px"><span style="flex:1"></span><button class="btn p" type="button" id="gSave">save goals</button></div></div></div></div>`;
  let mode=P.mmode;const macHtml=()=>{$('gMac').innerHTML=mode==='pct'?`<label class="fl">protein %<input class="inp num" id="gMp" value="${P.mp}"></label><label class="fl">carbs %<input class="inp num" id="gMc" value="${P.mc}"></label><label class="fl">fat %<input class="inp num" id="gMf" value="${P.mf}"></label>`:`<label class="fl">protein g<input class="inp num" id="gGp" value="${P.gp||fTargets().p}"></label><label class="fl">carbs g<input class="inp num" id="gGc" value="${P.gc||fTargets().c}"></label><label class="fl">fat g<input class="inp num" id="gGf" value="${P.gf||fTargets().f}"></label>`};macHtml();
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
let SHEALTH={};let SSET=null,SNIGHTS={},SV=LS.get('sleepv')||'recovery',sleepLoaded=false,SCFG=null;
const fmtHM=m=>{m=Math.round(m||0);return Math.floor(m/60)+'h '+pad(m%60)+'m'};
async function loadSleep(){if(sleepLoaded){renderSleep();return}
  const [s,rows,c,hr]=await Promise.all([load('sleep/settings'),listDocs('sleep/w-'),load('sleep/cfg'),listDocs('health/d-')]);hr.forEach(r=>{if(r.data)SHEALTH[r.path.slice(9)]=r.data});
  SSET={wake:'07:30',bed:'23:00',goal:8,miss:'math',diff:2,shakes:30,snd:'rise',code:'',...(s||{})};SCFG=c||{};
  rows.forEach(r=>{if(r.data)SNIGHTS[r.path.slice(8)]=r.data});sleepLoaded=true;renderSleep()}
watchPrefix('health/d-',(evt,path,data)=>{const k=path.slice(9);if(evt==='DELETE')delete SHEALTH[k];else if(data)SHEALTH[k]=data;if(cur==='sleep'&&SV==='recovery')renderSleep()});
watchPrefix('sleep/w-',(evt,path,data)=>{const k=path.slice(8);if(evt==='DELETE')delete SNIGHTS[k];else if(data)SNIGHTS[k]=data;if(cur==='sleep'&&!$('sheet').classList.contains('on'))renderSleep()});
const saveSS=()=>save('sleep/settings',SSET);
function sQ(n){if(!n||!n.asleep)return 0;const g=(SSET&&SSET.goal||8)*60,a=n.asleep;const dp=n.deep/a,rp=n.rem/a;
  return Math.round(Math.max(0,Math.min(100,45*Math.min(1,a/g)+20*Math.min(1,dp/.15)+20*Math.min(1,rp/.2)+15*Math.max(0,1-(n.awake||0)/45))))}
function renderSleep(){if(!sleepLoaded){loadSleep();return}
  document.querySelectorAll('#sleepSeg [data-sv]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.sv===SV));
  const last=Object.keys(SNIGHTS).sort().pop();$('sleepSub').textContent=last?`${esc(nice(last).toLowerCase())} · ${fmtHM(SNIGHTS[last].asleep)} · ${sQ(SNIGHTS[last])}%`:'apple watch sleep + wake-up missions';
  ({recovery:sRecovery,last:sLast,history:sHistory,stats:sStats,setup:sSetup}[SV]||sRecovery)()}
document.addEventListener('click',e=>{const b=e.target.closest('#sleepSeg [data-sv]');if(!b)return;SV=b.dataset.sv;LS.set('sleepv',SV);renderSleep()});

/* hypnogram from watch stages */
function sHyp(n,h=130){const segs=n.segs||[];if(!segs.length)return '<div class="dim">no stage data</div>';const t0=+new Date(n.start),t1=+new Date(n.end),W=600,L={awake:0,rem:1,core:2,deep:3},C={awake:'#ff2a6d',rem:'#05d9e8',core:'#6b7cff',deep:'#9b5cff'};
  const y=l=>10+l*(h-30)/3;const X=t=>((t-t0)/(t1-t0||1))*W;
  const rects=segs.map(([s,e,st])=>`<rect x="${X(+new Date(s)).toFixed(1)}" y="${y(L[st]??2)}" width="${Math.max(1,X(+new Date(e))-X(+new Date(s))).toFixed(1)}" height="${(h-30)/3-2}" fill="${C[st]||'#6b7cff'}" rx="2"/>`).join('');
  const T=d=>{const x=new Date(d);return pad(x.getHours())+':'+pad(x.getMinutes())};
  return `<svg class="slgraph" viewBox="0 0 ${W} ${h}" preserveAspectRatio="none" style="height:${h}px">${['awake','rem','core','deep'].map((k,i)=>`<line x1="0" x2="${W}" y1="${y(i)+(h-30)/6}" y2="${y(i)+(h-30)/6}" stroke="#1c1c1c"/>`).join('')}${rects}</svg>
  <div class="slaxis dim num"><span>${T(n.start)}</span><span class="sllg"><i style="background:#ff2a6d"></i>awake <i style="background:#05d9e8"></i>REM <i style="background:#6b7cff"></i>core <i style="background:#9b5cff"></i>deep</span><span>${T(n.end)}</span></div>`}
function sCard(k,full){const n=SNIGHTS[k];const q=sQ(n);const a=n.asleep||1;const pc=x=>Math.round((n[x]||0)/a*100);
  return `<div class="panel slcard${full?' full':''}" data-sn="${k}"><div class="pb"><div class="row" style="justify-content:space-between;align-items:baseline"><b>${esc(nice(k).toLowerCase())}</b><span class="num">${['','😫','😕','😐','🙂','😁'][n.mood||0]||''} <b class="${q>=75?'ok':q<50?'bad':''}" style="font-size:${full?28:16}px">${q}%</b></span></div>
    <div class="slstat num"><div><b>${fmtHM(n.asleep)}</b><span>asleep</span></div><div><b>${fmtHM(n.deep)}</b><span>deep ${pc('deep')}%</span></div><div><b>${fmtHM(n.rem)}</b><span>REM ${pc('rem')}%</span></div><div><b>${fmtHM(n.core)}</b><span>core</span></div><div><b>${Math.round(n.awake||0)}m</b><span>awake</span></div></div>
    ${sHyp(n,full?150:90)}${(n.tags||[]).length&&!full?`<div class="dim" style="font-size:11px;margin-top:4px">${n.tags.map(esc).join(' · ')}</div>`:''}</div></div>`}
function sLast(){const el=$('sleepBody');const k=Object.keys(SNIGHTS).sort().pop();
  if(!k){el.innerHTML=`<div class="panel"><div class="pb"><b>no nights yet</b><div class="dim" style="margin-top:6px">Wear your Apple Watch to bed and finish the one-time setup in the <b>setup</b> tab — every morning your sleep lands here automatically.</div><button class="btn p" type="button" data-go="setup" style="margin-top:10px">open setup</button></div></div>`;el.onclick=e=>{if(e.target.closest('[data-go]')){SV='setup';renderSleep()}};return}
  const n=SNIGHTS[k];
  el.innerHTML=sCard(k,true)+`<div class="panel"><div class="ph"><span class="tag">how do you feel?</span></div><div class="pb"><div class="smmood">${['😫','😕','😐','🙂','😁'].map((m,i)=>`<button type="button" data-mood="${i+1}" class="${n.mood===i+1?'on':''}">${m}</button>`).join('')}</div>
    <div class="dim" style="margin:12px 0 6px;font-size:12px">sleep notes</div><div class="chips">${STAGS.map(t=>`<button type="button" class="chip${(n.tags||[]).includes(t)?' on':''}" data-tag="${esc(t)}">${t}</button>`).join('')}</div></div></div>
    <div class="panel"><div class="ph"><span class="tag">tonight</span></div><div class="pb dim" style="font-size:12.5px">for ${SSET.goal} h of sleep before a ${SSET.wake} wake-up, be asleep by <b style="color:var(--fg)">${sBedFor()}</b>${SSET.bedOn?' · you\'ll get a reminder 30 min before':''}</div></div>`;
  el.onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.mood){n.mood=+b.dataset.mood;save('sleep/w-'+k,n);sLast();return}
    if(b.dataset.tag){const t=b.dataset.tag;n.tags=(n.tags||[]).includes(t)?n.tags.filter(x=>x!==t):(n.tags||[]).concat(t);save('sleep/w-'+k,n);sLast()}}}
function sBedFor(){const [h,m]=SSET.wake.split(':').map(Number);let t=h*60+m-SSET.goal*60;t=(t+1440)%1440;return pad(Math.floor(t/60))+':'+pad(t%60)}
function sHistory(){const el=$('sleepBody');const ks=Object.keys(SNIGHTS).sort().reverse();el.innerHTML=ks.length?ks.map(k=>sCard(k,false)).join(''):'<div class="panel"><div class="pb dim">No nights yet.</div></div>';
  el.onclick=e=>{const c=e.target.closest('[data-sn]');if(!c)return;const k=c.dataset.sn;openSheet(nice(k).toLowerCase(),sCard(k,true)+`<div class="bigbtns"><button class="btn d" type="button" id="snDel">delete night</button><span style="flex:1"></span><button class="btn p" type="button" id="snOk">close</button></div>`);
    $('snOk').onclick=closeSheet;$('snDel').onclick=function(){if(!this.dataset.arm){this.dataset.arm=1;this.textContent='tap again';return}delete SNIGHTS[k];removeDoc('sleep/w-'+k);closeSheet();renderSleep()}}}
function sStats(){const el=$('sleepBody');const N=Object.keys(SNIGHTS).sort().slice(-30).map(k=>({k,...SNIGHTS[k],q:sQ(SNIGHTS[k])}));
  if(!N.length){el.innerHTML='<div class="panel"><div class="pb dim">Stats appear after your first synced night.</div></div>';return}
  const avg=f=>N.reduce((a,n)=>a+(+n[f]||0),0)/N.length;const bt=N.map(n=>{const d=new Date(n.start);let m=d.getHours()*60+d.getMinutes();if(m<720)m+=1440;return m});const wk=N.map(n=>{const d=new Date(n.end);return d.getHours()*60+d.getMinutes()});
  const sd=a=>{const m=a.reduce((x,y)=>x+y,0)/a.length;return Math.sqrt(a.reduce((x,y)=>x+(y-m)**2,0)/a.length)};const hm=m=>{m=Math.round(m)%1440;return pad(Math.floor(m/60))+':'+pad(m%60)};
  const L=N.slice(-14);const mx=Math.max(...L.map(n=>n.asleep||0),SSET.goal*60);
  const tagI=STAGS.map(t=>{const w=N.filter(n=>(n.tags||[]).includes(t)),wo=N.filter(n=>!(n.tags||[]).includes(t));if(w.length<2||wo.length<2)return null;const d=w.reduce((a,n)=>a+n.q,0)/w.length-wo.reduce((a,n)=>a+n.q,0)/wo.length;return [t,Math.round(d),w.length]}).filter(Boolean).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1]));
  const debt=N.slice(-7).reduce((a,n)=>a+(SSET.goal*60-(n.asleep||0)),0);
  el.innerHTML=`<div class="statcards"><div class="panel"><div class="pb"><span class="dim">avg asleep</span><b class="num">${fmtHM(avg('asleep'))}</b></div></div><div class="panel"><div class="pb"><span class="dim">avg score</span><b class="num pink">${Math.round(avg('q'))}%</b></div></div><div class="panel"><div class="pb"><span class="dim">avg bedtime</span><b class="num">${hm(bt.reduce((a,b)=>a+b,0)/bt.length)}</b></div></div><div class="panel"><div class="pb"><span class="dim">7-day sleep ${debt>0?'debt':'surplus'}</span><b class="num ${debt>0?'bad':'ok'}">${fmtHM(Math.abs(debt))}</b></div></div></div>
  <div class="panel"><div class="ph"><span class="tag">last ${L.length} nights</span><span class="dim">goal ${SSET.goal} h</span></div><div class="pb"><div class="slbars" style="grid-template-columns:repeat(${L.length},1fr)">${L.map(n=>{const a=n.asleep||1;return `<div><span class="stk" style="height:${(n.asleep||0)/mx*100}%"><i style="flex:${n.deep};background:#9b5cff"></i><i style="flex:${n.core};background:#6b7cff"></i><i style="flex:${n.rem};background:#05d9e8"></i></span><em style="bottom:${SSET.goal*60/mx*100}%"></em><span class="l">${new Date(n.k+'T12:00').toLocaleDateString('en-GB',{weekday:'narrow'})}</span></div>`}).join('')}</div></div></div>
  <div class="grid2"><div class="panel"><div class="ph"><span class="tag">stages · average</span></div><div class="pb fins"><div>▸ deep <b>${fmtHM(avg('deep'))}</b> <span class="dim">(${Math.round(avg('deep')/Math.max(1,avg('asleep'))*100)}%)</span></div><div>▸ REM <b>${fmtHM(avg('rem'))}</b> <span class="dim">(${Math.round(avg('rem')/Math.max(1,avg('asleep'))*100)}%)</span></div><div>▸ awake <b>${Math.round(avg('awake'))} min</b> a night</div><div>▸ bedtime varies <b>±${Math.round(sd(bt))} min</b>, wake-up <b>±${Math.round(sd(wk))} min</b></div></div></div>
  <div class="panel"><div class="ph"><span class="tag">what affects your sleep</span></div><div class="pb fins">${tagI.length?tagI.map(([t,d,c])=>`<div>▸ <b>${esc(t)}</b>: score ${d>=0?'+':''}${d}% <span class="dim">(${c} nights)</span></div>`).join(''):'<div class="dim">Tag a few mornings with sleep notes (gym, caffeine…) and this shows what helps or hurts.</div>'}</div></div></div>`}

/* ---------- setup: watch sync, wake-up mission, reminders ---------- */
function sSetup(){const el=$('sleepBody'),S=SSET;const tok=SCFG&&SCFG.token;const url=SFN+'?token='+(tok||'…');const wurl=location.origin+location.pathname+'#wake='+encodeURIComponent(JSON.stringify({m:S.miss,d:S.diff,n:S.shakes,c:S.code,s:S.snd}));
  el.innerHTML=`<div class="panel"><div class="ph"><span class="tag">1 · apple watch → app (once, ~5 min)</span></div><div class="pb slsteps">
    <ol><li>Wear your Watch to bed with <b>Sleep</b> on (Health → Sleep → set a schedule).</li>
    <li>Open <b>Shortcuts</b> → <b>+</b> → name it <b>Send sleep</b>. Add these actions:<br>
      <b>Find Health Samples</b> — Type: <i>Sleep Analysis</i>, filter: <i>Start Date is in the last 1 days</i>.<br>
      <b>Repeat with Each</b> → inside it add <b>Text</b>: <code>Start Date|End Date|Value</code> (tap each word to insert the variable from <i>Repeat Item</i>; set both dates' format to <i>ISO 8601</i>).<br>
      After the repeat: <b>Combine Text</b> (Repeat Results) with <i>New Lines</i>.<br>
      For recovery (Whoop stats) add, before the upload: <b>Find Health Samples</b> → <i>Heart Rate Variability</i>, last 1 day → <b>Calculate Statistics</b> <i>Average</i>; do the same for <i>Resting Heart Rate</i> and <i>Respiratory Rate</i>; and <i>Active Energy</i> + <i>Steps</i> with Start Date <i>is yesterday</i> → <i>Sum</i>.<br>
      Then one <b>Text</b> action: <code>Combined Text</code> + new lines <code>HRV|Average</code> <code>Resting Heart Rate|Average</code> <code>Respiratory Rate|Average</code> <code>Active Energy|Sum</code> <code>Steps|Sum</code> (insert each statistic as a variable).<br>
      <b>Get Contents of URL</b> — URL below, Method <i>POST</i>, Request Body <i>File</i> → that Text.</li>
    <li>Shortcuts → <b>Automation</b> → <b>+</b> → <b>Time of Day</b> 10:00 daily (or <b>Alarm → is stopped</b>) → <b>Run Immediately</b> → run <b>Send sleep</b>.</li></ol>
    <div class="dim" style="font-size:11px">your private upload link</div>${tok?`<div class="slurl"><code id="slUrl">${esc(url)}</code><button class="iconbtn" type="button" data-copy="slUrl">copy</button></div>`:'<div class="dim">link not ready — reopen the app in a minute</div>'}</div></div>
  <div class="panel"><div class="ph"><span class="tag">2 · wake-up mission (Alarmy style)</span></div><div class="pb">
    <div class="dim" style="font-size:12px;margin-bottom:8px">Your iPhone alarm rings as normal. Stopping it opens this mission, which keeps ringing until you finish it.</div>
    <div class="seg mini">${SMISS.map(([k,l])=>`<button type="button" data-slm="${k}" aria-pressed="${S.miss===k}">${l}</button>`).join('')}</div>
    <div class="slmd dim" style="margin-top:8px">${S.miss==='math'?`difficulty <span class="seg mini" style="display:inline-flex">${[1,2,3].map(d=>`<button type="button" data-sld="${d}" aria-pressed="${S.diff===d}">${['easy','medium','hard'][d-1]}</button>`).join('')}</span>`:S.miss==='shake'?`shakes <input class="inp num" id="slShk" value="${S.shakes}" style="width:60px;display:inline-block">`:S.miss==='scan'?`${S.code?`registered <b>${esc(S.code)}</b> `:''}<button class="iconbtn" type="button" id="slReg">${S.code?'change':'register'} barcode</button>`:'type a motivational line exactly'}</div>
    <div class="dim" style="margin:10px 0 4px;font-size:12px">sound</div><div class="seg mini">${SSND.map(([k,l])=>`<button type="button" data-sls="${k}" aria-pressed="${S.snd===k}">${l}</button>`).join('')}</div>
    <div class="row" style="gap:6px;margin-top:10px;flex-wrap:wrap"><button class="iconbtn" type="button" id="slTest">▶ preview sound</button><button class="iconbtn" type="button" id="slTry">try the mission</button></div>
    <ol class="slsteps" style="margin-top:10px"><li>Shortcuts → <b>Automation</b> → <b>+</b> → <b>Alarm</b> → <b>Is Stopped</b> (any alarm) → <b>Run Immediately</b>.</li><li>Action: <b>Open URLs</b> → paste the link below.</li></ol>
    <div class="slurl"><code id="slWake">${esc(wurl)}</code><button class="iconbtn" type="button" data-copy="slWake">copy</button></div><div class="dim" style="font-size:11px">re-copy this link if you change the mission settings</div></div></div>
  <div class="panel"><div class="ph"><span class="tag">3 · schedule</span></div><div class="pb fform">
    <label class="fl">usual wake-up<input type="time" class="inp" id="slW" value="${S.wake}"></label><label class="fl">sleep goal (hours)<input class="inp num" id="slG" value="${S.goal}" inputmode="decimal"></label>
    <label class="fl" style="grid-column:1/-1"><span><input type="checkbox" id="slBedOn" ${S.bedOn?'checked':''}> bedtime reminder 30 min before ${sBedFor()} (needs notifications on 🔔)</span></label></div></div>`;
  el.onchange=e=>{const t=e.target;if(t.id==='slShk'){S.shakes=Math.max(5,+t.value||30)}if(t.id==='slW')S.wake=t.value;if(t.id==='slG')S.goal=Math.max(4,Math.min(12,+t.value||8));if(t.id==='slBedOn')S.bedOn=t.checked;saveSS();if(typeof pushSync==='function')pushSync();sSetup()};
  el.onclick=e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;
    if(d.copy){const v=$(d.copy).textContent;navigator.clipboard&&navigator.clipboard.writeText(v).then(()=>{b.textContent='copied ✓'}).catch(()=>{});return}
    if(d.slm){S.miss=d.slm;saveSS();sSetup();return}if(d.sld){S.diff=+d.sld;saveSS();sSetup();return}if(d.sls){S.snd=d.sls;saveSS();sSetup();return}
    if(b.id==='slTest'){sAlarmSound(true);setTimeout(sAlarmStop,3500);return}if(b.id==='slTry'){sMission(true);return}if(b.id==='slReg')sRegister()}}

/* ---------- #wake: opened by the "alarm stopped" automation (works signed out, in Safari too) ---------- */
function sWakeMode(){let p={};try{p=JSON.parse(decodeURIComponent(location.hash.slice(6)))}catch(e){}
  SSET={wake:'07:30',goal:8,miss:p.m||'math',diff:+p.d||2,shakes:+p.n||30,snd:p.s||'rise',code:p.c||'',...(SSET||{}),...(p.m?{miss:p.m}:{})};
  const o=$('sleepNight');o.hidden=false;document.body.classList.add('sleeping');
  o.innerHTML=`<div class="smhead"><span class="tag pink">wake up</span><b class="num">${pad(new Date().getHours())}:${pad(new Date().getMinutes())}</b></div><button class="btn p slgo" type="button" id="wkGo">tap to start your mission</button><div class="dim" style="font-size:11px">the alarm keeps going until it's done</div>`;
  $('wkGo').onclick=async()=>{try{SAC=SAC||new (window.AudioContext||window.webkitAudioContext)();await SAC.resume()}catch(e){}try{if(SSET.miss==='shake'&&typeof DeviceMotionEvent!=='undefined'&&DeviceMotionEvent.requestPermission)await DeviceMotionEvent.requestPermission()}catch(e){}
    if(SSET.miss==='shake')addEventListener('devicemotion',sMotion);sAlarmSound(false);sMission('wake')}}
function sAwake(){const o=$('sleepNight');history.replaceState(null,'',location.pathname+'#today');
  o.innerHTML=`<div class="smq">you're up ✓</div><div class="dim">a wake-up check pops up in 3 minutes — tap it or the alarm comes back</div><button class="btn" type="button" id="wkOk" style="margin-top:14px">ok</button>`;
  $('wkOk').onclick=()=>{o.hidden=true;document.body.classList.remove('sleeping')};
  setTimeout(()=>{o.hidden=false;document.body.classList.add('sleeping');let left=90;o.innerHTML=`<div class="smq">still awake?</div><div class="smshake num" id="scT">${left}</div><button class="btn p slgo" type="button" id="scOk">yes, I'm up</button>`;
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
    let left=3,cur=mk();const draw=()=>{o.innerHTML=head+`<div class="smq num">${cur.q} =</div><input class="smin num" id="smA" inputmode="none" readonly autocomplete="off"><div class="dim">${left} to go</div><div class="smkp">${[1,2,3,4,5,6,7,8,9,'−',0,'⌫'].map(k=>`<button type="button" data-k="${k}">${k}</button>`).join('')}</div><button class="btn p" type="button" id="smOk">submit</button>${snz}`;bind()};
    const bind=()=>{o.onclick=e=>{const b=e.target.closest('button');if(!b)return;const i=$('smA');if(b.dataset.k!=null){const k=b.dataset.k;i.value=k==='⌫'?i.value.slice(0,-1):k==='−'?(i.value.startsWith('-')?i.value.slice(1):'-'+i.value):i.value+k;return}
      if(b.id==='smOk'){if(+i.value===cur.ans&&i.value!==''){left--;if(!left)return done();cur=mk();draw()}else{i.value='';i.classList.add('bad');setTimeout(()=>i.classList.remove('bad'),400)}}if(b.id==='smSnz')sSnooze()}};draw()}
  else if(S.miss==='shake'){sShake.on=true;addEventListener('devicemotion',sMotion);sShake.n=0;const need=S.shakes;o.innerHTML=head+`<div class="smq">shake it</div><div class="smshake num" id="smN">0 / ${need}</div><div class="smbar"><i id="smBar"></i></div>${snz}<div class="dim" style="font-size:11px">no motion sensor? <button class="iconbtn" type="button" id="smAlt">switch to maths</button></div>`;
    sShake.cb=()=>{$('smN').textContent=sShake.n+' / '+need;$('smBar').style.width=Math.min(100,sShake.n/need*100)+'%';if(sShake.n>=need){sShake.cb=null;done()}};
    o.onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.id==='smSnz')sSnooze();if(b.id==='smAlt'){sShake.on=false;const m=S.miss;S.miss='math';sMission(test);S.miss=m}}}
  else if(S.miss==='type'){const ph=SPHRASE[Math.floor(Math.random()*SPHRASE.length)];o.innerHTML=head+`<div class="smq" style="font-size:20px">type exactly:</div><div class="smph">${esc(ph)}</div><input class="smin" id="smT" autocomplete="off" autocapitalize="off" spellcheck="false">${snz}`;
    $('smT').oninput=e=>{if(e.target.value.trim().toLowerCase()===ph.toLowerCase())done()};o.onclick=e=>{if(e.target.id==='smSnz')sSnooze()}}
  else{if(!S.code){const m=S.miss;S.miss='math';sMission(test);S.miss=m;return}
    o.innerHTML=head+`<div class="smq" style="font-size:20px">scan your barcode</div><div class="fscan"><video id="smV" playsinline muted></video><i class="fsline"></i></div><div class="dim" id="smMsg">find it and point the camera at it</div>${snz}`;
    sScanner($('smV'),code=>{if(code===S.code){sScanStop();done();return true}$('smMsg').textContent='wrong barcode — that\'s not the one';return false});o.onclick=e=>{if(e.target.id==='smSnz'){sScanStop();sSnooze()}}}}

let SSC=null;
async function sScanner(v,cb){sScanStop();try{
  if('BarcodeDetector' in window){const st=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});SSC={st};v.srcObject=st;await v.play();const det=new BarcodeDetector({formats:['ean_13','ean_8','upc_a','upc_e','code_128']});
    const loop=async()=>{if(!SSC||!v.isConnected)return sScanStop();try{const r=await det.detect(v);if(r[0]&&cb(r[0].rawValue))return}catch(e){}setTimeout(loop,250)};loop()}
  else{if(!window.ZXing)await new Promise((res,rej)=>{const s=document.createElement('script');s.src='vendor/zxing.min.js';s.onload=res;s.onerror=rej;document.head.appendChild(s)});
    const zx=new ZXing.BrowserMultiFormatReader();SSC={zx};zx.decodeFromConstraints({video:{facingMode:'environment'}},v,res=>{if(res&&SSC&&cb(res.getText()))sScanStop()})}}catch(e){}}
function sScanStop(){if(!SSC)return;try{SSC.zx&&SSC.zx.reset()}catch(e){}if(SSC.st)SSC.st.getTracks().forEach(t=>t.stop());SSC=null}
function sRegister(){openSheet('register barcode',`<div class="dim" style="margin-bottom:8px">Scan something that lives in another room — toothpaste, shower gel, a cereal box.</div><div class="fscan"><video id="srV" playsinline muted></video><i class="fsline"></i></div><div class="row" style="gap:6px;margin-top:8px"><input class="inp num" id="srC" placeholder="or type the number" style="flex:1"><button class="btn p" type="button" id="srOk">save</button></div>`);
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
const sZone=v=>v>=67?['#16ec06','green','your body is primed — push it today','14 – 18']:v>=34?['#ffde00','yellow','maintain — moderate strain','10 – 14']:['#ff0026','red','prioritise rest and recovery','0 – 10'];
function sRecovery(){const el=$('sleepBody');const k=DAYK;const R=sRec(k)||sRec(sAddD(k,-1));const kk=sRec(k)?k:sAddD(k,-1);const yS=sStrain(sAddD(k,-1));
  if(!R&&yS==null){el.innerHTML=`<div class="panel"><div class="pb"><b>recovery needs your Watch data</b><div class="dim" style="margin-top:6px">Finish the Shortcut in <b>setup</b> (sleep + the HRV / heart-rate lines). After a few mornings you'll get a daily recovery %, strain and trends like Whoop.</div><button class="btn p" type="button" data-go="setup" style="margin-top:10px">open setup</button></div></div>`;el.onclick=e=>{if(e.target.closest('[data-go]')){SV='setup';renderSleep()}};return}
  const z=R?sZone(R.v):['#7a7a7a','—','',''];const C=2*Math.PI*78;const n=SNIGHTS[kk];
  const days=[...Array(30)].map((_,i)=>sAddD(k,-29+i));const recs=days.map(d=>({d,r:sRec(d),s:sStrain(d)}));
  const line=(vals,col,h=70)=>{const pts=vals.map((v,i)=>v==null?null:[i,v]).filter(Boolean);if(pts.length<2)return '<div class="dim" style="font-size:11px">not enough data yet</div>';const lo=Math.min(...pts.map(p=>p[1])),hi=Math.max(...pts.map(p=>p[1]));const Y=v=>h-6-(v-lo)/Math.max(1,hi-lo)*(h-12);
    return `<svg class="slgraph" viewBox="0 0 600 ${h}" preserveAspectRatio="none" style="height:${h}px"><polyline points="${pts.map(([i,v])=>`${(i/29*600).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')}" fill="none" stroke="${col}" stroke-width="2"/>${pts.map(([i,v])=>`<circle cx="${(i/29*600).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="2.5" fill="${col}"/>`).join('')}</svg><div class="slaxis dim num"><span>${Math.round(lo)}</span><span>30 days</span><span>${Math.round(hi)}</span></div>`};
  el.innerHTML=`<div class="wrec panel"><div class="pb"><div class="wring"><svg viewBox="0 0 180 180"><circle cx="90" cy="90" r="78" class="rb"/><circle cx="90" cy="90" r="78" class="rf" style="stroke:${z[0]};stroke-dasharray:${C};stroke-dashoffset:${R?C*(1-R.v/100):C};filter:drop-shadow(0 0 10px ${z[0]})"/></svg><div><span class="dim">recovery${kk!==k?' · yesterday':''}</span><b class="num" style="color:${z[0]}">${R?R.v+'%':'—'}</b><span class="dim">${R&&R.est?'estimated':''}</span></div></div>
    <div class="wside"><div class="wmsg" style="color:${z[0]}">${esc(z[2])}</div>
      <div class="wkv num"><div><span>HRV</span><b>${R&&R.h.hrv?Math.round(R.h.hrv)+' ms':'—'}</b><em>${R&&R.bH?`${R.h.hrv>=R.bH.m?'▲':'▼'} avg ${Math.round(R.bH.m)}`:''}</em></div><div><span>resting HR</span><b>${R&&R.h.rhr?Math.round(R.h.rhr)+' bpm':'—'}</b><em>${R&&R.bR?`${R.h.rhr<=R.bR.m?'▼':'▲'} avg ${Math.round(R.bR.m)}`:''}</em></div><div><span>sleep performance</span><b>${R&&R.perf!=null?R.perf+'%':'—'}</b><em>${n?fmtHM(n.asleep)+' of '+fmtHM(R?R.need:0):''}</em></div><div><span>resp. rate</span><b>${R&&R.h.rr?R.h.rr.toFixed(1):'—'}</b><em></em></div></div></div></div></div>
  <div class="grid2"><div class="panel"><div class="ph"><span class="tag">strain</span><span class="dim">0 – 21</span></div><div class="pb"><div class="wstrain"><div><span class="dim">yesterday</span><b class="num">${yS!=null?yS.toFixed(1):'—'}</b></div><div><span class="dim">today's target</span><b class="num" style="color:${z[0]}">${R?z[3]:'—'}</b></div></div><div class="wsbar"><i style="width:${(yS||0)/21*100}%"></i>${R?`<em style="left:${parseInt(z[3])/21*100}%;width:${(parseInt(z[3].split('–')[1])-parseInt(z[3]))/21*100}%"></em>`:''}</div><div class="dim" style="font-size:11px;margin-top:6px">from active energy, steps and logged gym sessions</div></div></div>
    <div class="panel"><div class="ph"><span class="tag">sleep coach</span></div><div class="pb fins"><div>▸ tonight you need <b>${fmtHM(sNeed(sAddD(k,1)))}</b></div><div>▸ for a ${SSET.wake} wake-up, be asleep by <b>${(()=>{const [h,m]=SSET.wake.split(':').map(Number);let t=(h*60+m-sNeed(sAddD(k,1))+1440)%1440;return pad(Math.floor(t/60))+':'+pad(t%60)})()}</b></div>${n?`<div>▸ last night: deep ${fmtHM(n.deep)}, REM ${fmtHM(n.rem)}, awake ${Math.round(n.awake||0)} min</div>`:''}</div></div></div>
  <div class="panel"><div class="ph"><span class="tag">recovery · 30 days</span></div><div class="pb"><div class="wbars">${recs.map(o=>`<div title="${o.d}"><span style="height:${o.r?o.r.v:0}%;background:${o.r?sZone(o.r.v)[0]:'transparent'}"></span><i style="height:${o.s!=null?o.s/21*100:0}%"></i></div>`).join('')}</div><div class="dim" style="font-size:11px;margin-top:6px">bars = recovery · blue = strain</div></div></div>
  <div class="grid2"><div class="panel"><div class="ph"><span class="tag">HRV</span></div><div class="pb">${line(days.map(d=>(SHEALTH[d]||{}).hrv),'#05d9e8')}</div></div><div class="panel"><div class="ph"><span class="tag">resting heart rate</span></div><div class="pb">${line(days.map(d=>(SHEALTH[d]||{}).rhr),'#ff2a6d')}</div></div></div>`;
  el.onclick=null}

/* ================= NOTIFICATIONS (web push) =================
   The app keeps a queue of upcoming notifications in kv "push/q"; a Supabase cron (every 15 s) sends whatever is due
   to this device's push subscription ("push/subs"), even when the app is closed. Works on iPhone/iPad for the home-screen app. */
const VAPID_PUB='BHHSvXm_9iKVpSZSPkmn2jm_1IiM9rzT5cFtPdOzmpNn6cwQzidSZYJKVYc-p7bYgeisTYvVWIsYmOAW-fGhwoU';
const NKINDS=[['plan','plan blocks','when each block of your day starts'],['dose','doses','protocol doses at their times'],['rest','gym rest timer','when rest is over, even if you left the app'],['focus','focus timer','when a focus session ends'],['fast','fasting','when you hit your fasting goal'],['bed','bedtime','30 min before your sleep time'],['leet','leetcode reviews','9:00 if problems are due for review'],['water','water','nudge at 13:00 and 17:00 if you\'re behind']];
let NSET=LS.get('notify')||{on:false,k:{plan:true,dose:true,rest:true,focus:true,fast:true,bed:true,leet:true,water:false}};
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
async function pushCancel(tag){if(!NSET.on)return;const q=await nQueue();const n=q.items.length;q.items=q.items.filter(i=>i.tag!==tag);if(q.items.length!==n)save('push/q',q,true)}
const atMin=(dayKey,mins)=>{const d=new Date(dayKey+'T00:00');return d.getTime()+mins*60e3+5*3600e3*0};
async function pushSync(){if(!NSET.on)return;const q=await nQueue();const now=Date.now(),H=now+36*36e5;const keep=q.items.filter(i=>!/^(plan|item|dose|bed|leet|water|habit|task):/.test(i.tag)&&new Date(i.at)>now-60e3);const add=[];
  const push=(tag,at,title,body,url)=>{if(at>now+5000&&at<H)add.push({id:rid()+rid(),tag,at:new Date(at).toISOString(),title,body,url:url||'./'})};
  const days=[DAYK,ymd(new Date(new Date(DAYK+'T12:00').getTime()+864e5))];
  days.forEach((dk,di)=>{const base=new Date(dk+'T00:00').getTime();const dow=new Date(dk+'T12:00').getDay();const kind=(dow===0||dow===6)?'weekend':'weekday';
    if(nOn('plan')&&typeof M!=='undefined'&&M.plans&&M.plans[kind])M.plans[kind].forEach(b=>{const n=b.items.length;push('plan:'+dk+':'+b.bi,base+b.s*60e3,b.short||b.title,`${pad(Math.floor(b.s/60)%24)}:${pad(b.s%60)}–${pad(Math.floor(b.e/60)%24)}:${pad(b.e%60)} · ${n} item${n===1?'':'s'}`,'./#today')});
    if(typeof M!=='undefined'&&M.plans&&M.plans[kind])M.plans[kind].forEach(b=>b.items.forEach(it=>{const lead=NITEMS.m[it.key];if(lead==null||it.t==null)return;if(it.days&&!it.days.has(DOW[dow]))return;if(di===0&&typeof DAY!=='undefined'&&DAY.ticks&&DAY.ticks[it.tk])return;
      push('item:'+dk+':'+it.key,base+(it.t-lead)*60e3,(lead?`in ${lead} min · `:'')+it.item,[it.time,it.dose,it.notes&&it.notes.slice(0,80)].filter(Boolean).join(' · '),'./#today')}));
    if(typeof HAB!=='undefined')HAB.list.filter(h=>h.remind&&!h.arch).forEach(h=>{if(!hDue(h,dk))return;if(di===0&&hDone(h,dk))return;const [rh,rm]=h.remind.split(':').map(Number);push('habit:'+dk+':'+h.id,base+(rh*60+rm)*60e3,`${h.ic||''} ${h.n}`,h.type==='neg'?'stay strong today':`keep the streak going${hStreak(h).n?` — ${hStreak(h).n} ${hStreak(h).unit}s`:''}`,'./#streaks')});
    if(typeof TASKS!=='undefined'&&di===0)TASKS.list.filter(t=>!t.done&&t.d&&t.tm).forEach(t=>{const [th,tm]=t.tm.split(':').map(Number);push('task:'+t.id,new Date(t.d+'T00:00').getTime()+(th*60+tm)*60e3,'✓ '+t.t,t.note||'task due','./#journal')});
    if(nOn('dose')&&typeof PROTO!=='undefined'&&typeof scheduledOn==='function')PROTO.list.forEach(c=>{if(!scheduledOn(c,dk))return;(c.times||[]).forEach((t,i)=>{const m=/^(\d{1,2}):(\d{2})$/.exec(t);if(!m)return;if(di===0&&typeof logsFor==='function'&&logsFor(c.id,dk)[i])return;push('dose:'+dk+':'+c.id+':'+i,base+(+m[1]*60+ +m[2])*60e3,c.name+' due',[c.dose,c.unit].filter(Boolean).join(' ')||'log your dose','./#tools')})});
    if(nOn('leet')){const n=leetDue();if(n&&di===0)push('leet:'+dk,base+9*36e5,`${n} LeetCode review${n>1?'s':''} due`,'spaced repetition — keep the streak','./#tools')}
    if(nOn('water'))[13,17].forEach(h=>push('water:'+dk+':'+h,base+h*36e5,'drink some water','check your water for today','./#food'));
    if(nOn('bed')&&typeof SSET!=='undefined'&&SSET&&SSET.bedOn&&typeof sBedFor==='function'){const [bh,bm]=sBedFor().split(':').map(Number);let t=base+(bh*60+bm-30)*60e3;if(bh<12)t+=864e5;push('bed:'+dk,t,'bedtime in 30 min',`aim to be asleep by ${sBedFor()} — ${SSET.goal} h before ${SSET.wake}`,'./#sleep')}});
  q.items=keep.concat(add).sort((a,b)=>a.at<b.at?-1:1).slice(0,200);save('push/q',q,true)}
function openNotify(){const sup=('serviceWorker' in navigator)&&('PushManager' in window);const perm=typeof Notification!=='undefined'?Notification.permission:'unsupported';
  openSheet('notifications',`<div class="row" style="justify-content:space-between;align-items:center"><div><b>${NSET.on&&perm==='granted'?'on for this device':'off'}</b><div class="dim" style="font-size:11px">${sup?'arrive even when the app is closed':'not supported in this browser'}</div></div><button class="btn ${NSET.on&&perm==='granted'?'':'p'}" type="button" id="nTog">${NSET.on&&perm==='granted'?'turn off':'turn on'}</button></div>
  <div class="dim" id="nMsg" style="font-size:12px;margin:8px 0"></div>
  <div class="nlist">${NKINDS.map(([k,l,d])=>`<label class="nrow"><span><b>${l}</b><span class="dim">${d}</span></span><input type="checkbox" data-nk="${k}" ${NSET.k[k]?'checked':''}></label>`).join('')}</div>
  <div class="bigbtns" style="margin-top:12px"><button class="iconbtn" type="button" id="nTest">send a test</button><span style="flex:1"></span><button class="btn p" type="button" id="nOk">done</button></div>`);
  const sb=$('sheetBody');sb.onchange=e=>{const k=e.target.dataset.nk;if(!k)return;NSET.k[k]=e.target.checked;LS.set('notify',NSET);pushSync()};
  $('nOk').onclick=closeSheet;
  $('nTest').onclick=async()=>{if(!NSET.on){$('nMsg').textContent='turn notifications on first';return}await pushOne('test',Date.now()+8000,'dylan@system','notifications are working ✓','./');$('nMsg').textContent='sent — it should arrive within ~20 seconds (lock your phone to see it)'};
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
const HL_META={Habit:['✅','#57f5a8','habits'],Training:['🏋️','#ff2a6d','training'],Mindset:['🎯','#ffb000','mindset'],Circadian:['☀️','#ffb000','circadian'],LM:['🪞','#9b5cff','looksmaxxing'],Supplement:['💊','#05d9e8','supplements'],Peptide:['💉','#4da3ff','peptides'],Ancillary:['💊','#ff6b3d','ancillaries'],Cognition:['🧠','#9b5cff','cognition'],Anabolic:['💪','#ff2a6d','anabolics']};
let DNAMES={},dnLoaded=false;
const hlKind=d=>{const w=new Date(d+'T12:00').getDay();return w===0||w===6?'weekend':'weekday'};
const hlItems=(d,name)=>{if(!M.plans)return [];const dow=DOW[new Date(d+'T12:00').getDay()];return (M.plans[hlKind(d)]||[]).flatMap(b=>b.items).filter(i=>i.item.trim()===name&&(!i.days||i.days.has(dow)))};
function hLinked(){if(!M.plans)return [];const hide=new Set(HAB.hide||[]);const map=new Map();
  for(const kind of ['weekday','weekend'])(M.plans[kind]||[]).forEach(b=>b.items.forEach(i=>{if(HL_SKIP.has(i.type)||!i.item)return;const n=i.item.trim();const id='tl:'+n.toLowerCase();if(map.has(id)||hide.has(id))return;const m=HL_META[i.type]||['⭐','#e6e6e6',(i.type||'other').toLowerCase()];
    map.set(id,{id,n,ic:m[0],col:m[1],grp:m[2],type:'daily',link:n,created:hFirstDay()})}));return [...map.values()]}
function hFirstDay(){const k=Object.keys(DNAMES).sort()[0];return k||DAYK}
function hTodayTicked(name){return visibleItems().filter(i=>i.item.trim()===name&&DAY.ticks[i.tk])}
const hCnt=(h,d)=>{if(h.link){if(d===DAYK&&M.plans)return hTodayTicked(h.link).length;return (DNAMES[d]||[]).filter(x=>String(x).trim()===h.link).length}return ((HLOG.d[d]||{})[h.id])||0};
const hTarget=(h,d)=>h.link?Math.max(1,hlItems(d||DAYK,h.link).length):Math.max(1,+h.q||1);
const hDone=(h,d)=>h.type==='neg'?hCnt(h,d)===0:hCnt(h,d)>=hTarget(h,d);
const hDue=(h,d)=>{if(h.link)return hlItems(d,h.link).length>0;const dow=new Date(d+'T12:00').getDay();return h.type==='days'?(h.days||[]).includes(dow):true};
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
  const grps=[];LK.forEach(h=>{let g=grps.find(x=>x.n===h.grp);if(!g)grps.push(g={n:h.grp,col:h.col,L:[]});g.L.push(h)});
  const gh=grps.map(g=>{const due=g.L.filter(h=>hDue(h,DAYK));const ok=due.filter(h=>hDone(h,DAYK)).length;const open=(HAB.open||[]).includes(g.n);
    return `<div class="panel hgrp${open?' open':''}"><button type="button" class="ph hgh" data-hg="${esc(g.n)}"><span class="tag" style="color:${g.col}">${esc(g.n)}</span><span class="num dim">${ok}/${due.length} today${due.length&&ok===due.length?' ✓':''} <span class="hchev">${open?'▾':'▸'}</span></span></button>${open?`<div class="pb"><div class="hgrid sm">${g.L.sort((a,b)=>hDue(b,DAYK)-hDue(a,DAYK)).map(hTile).join('')}</div></div>`:''}</div>`}).join('');
  el.innerHTML=`<div class="hgrid">${L.map(hTile).join('')}<button type="button" class="htile hnew" id="hNew"><span class="hring"><b>＋</b></span><span class="hn">new habit</span></button></div>
    ${gh?`<div class="flab" style="margin:16px 0 6px">from today · ticks sync both ways</div>${gh}`:''}
    ${ALL.length?`<div class="dim" style="font-size:11px;text-align:center;margin-top:10px">hold a habit to complete it · tap for stats</div>`:''}
    ${L.length?`<div class="panel" style="margin-top:14px"><div class="ph"><span class="tag">last 12 weeks</span><span class="dim">${Math.round(L.reduce((a,h)=>a+hRate(h,30),0)/Math.max(1,L.length))}% in the last 30 days</span></div><div class="pb">${hHeat(null)}</div></div>`:''}`;
  hBind()}
function hTile(h){const c=hCnt(h,DAYK),t=hTarget(h),due=hDue(h,DAYK),ok=hDone(h,DAYK);const st=hStreak(h);const p=h.type==='neg'?(ok?1:0):Math.min(1,c/t);const R=42,C=2*Math.PI*R;
  return `<button type="button" class="htile${ok?' ok':''}${due?'':' off'}${h.type==='neg'?' neg':''}" data-h="${h.id}" style="--hc:${h.col||HCOLS[0]}"><span class="hring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="${R}" class="hb"/><circle cx="50" cy="50" r="${R}" class="hf" style="stroke-dasharray:${C};stroke-dashoffset:${C*(1-p)}"/><circle cx="50" cy="50" r="${R}" class="hh" style="stroke-dasharray:${C};stroke-dashoffset:${C}"/></svg><b>${esc(h.ic||'⭐')}</b>${t>1&&h.type!=='neg'?`<em class="num">${c}/${t}</em>`:''}</span>
    <span class="hn">${esc(h.n)}</span><span class="hs num">${st.n?`🔥 ${st.n} ${st.unit}${st.n>1?'s':''}`:h.type==='week'?`${hWeekCount(h,DAYK)}/${h.per||3} this week`:due?'start today':'rest day'}</span></button>`}
let hHold=null,hFired=0;
function hBind(){const el=$('habBody');
  el.onclick=e=>{if(e.target.closest('#hNew'))return hEdit(null);const g=e.target.closest('[data-hg]');if(g){const n=g.dataset.hg;const o=new Set(HAB.open||[]);o.has(n)?o.delete(n):o.add(n);HAB.open=[...o];hSave();renderHabits();return}const t=e.target.closest('[data-h]');if(!t)return;if(Date.now()-hFired<700)return;hDetail(t.dataset.h)};
  const start=(t,x)=>{if(hHold)return;const h=hGet(t.dataset.h);if(!h)return;const ring=t.querySelector('.hh');const C=2*Math.PI*42;
    ring.style.transition='none';ring.style.strokeDashoffset=C;void ring.offsetWidth;ring.style.transition='stroke-dashoffset .6s linear';ring.style.strokeDashoffset=0;t.classList.add('holding');
    hHold={t,x:x&&x.clientX,y:x&&x.clientY,timer:setTimeout(()=>{hFired=Date.now();hHold=null;t.classList.remove('holding');hTick(h,t)},600),ring,C}};
  const stop=()=>{if(!hHold)return;clearTimeout(hHold.timer);hHold.ring.style.transition='stroke-dashoffset .2s';hHold.ring.style.strokeDashoffset=hHold.C;hHold.t.classList.remove('holding');hHold=null};
  el.onpointerdown=e=>{const t=e.target.closest('[data-h]');if(t)start(t,e)};el.onpointerup=el.onpointercancel=stop;el.onpointermove=e=>{if(hHold&&hHold.x!=null&&Math.hypot(e.clientX-hHold.x,e.clientY-hHold.y)>12)stop()};
  el.oncontextmenu=e=>{if(e.target.closest('[data-h]'))e.preventDefault()}}
function hTick(h,tile){if(h.link){const its=visibleItems().filter(i=>i.item.trim()===h.link);if(!its.length)return;const nx=its.find(i=>!DAY.ticks[i.tk]);
    if(nx)setTick(nx.tk,true);else its.forEach(i=>{delete DAY.ticks[i.tk]});if(!nx){persistDay();applyTicks()}
    try{navigator.vibrate&&navigator.vibrate(hDone(h,DAYK)?[20,40,20]:10)}catch(e){}if(hDone(h,DAYK)){const r=tile.getBoundingClientRect();burst(r.left+r.width/2,r.top+r.height/2,40,true)}renderHabits();hWidget();return}
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
function hDetail(id){const h=hGet(id);if(!h)return;const st=hStreak(h);
  const hist=[...Array(14)].map((_,i)=>{const d=hAdd(DAYK,-13+i);return `<button type="button" class="hday${hDone(h,d)?' ok':''}${hDue(h,d)?'':' off'}" data-hd="${d}" style="--hc:${h.col}"><span>${new Date(d+'T12:00').toLocaleDateString('en-GB',{weekday:'narrow'})}</span><b>${new Date(d+'T12:00').getDate()}</b></button>`}).join('');
  openSheet(`${h.ic||''} ${h.n}`,`<div class="hstats num"><div><b style="color:${h.col}">${st.n}</b><span>current ${st.unit}s</span></div><div><b>${hBest(h)}</b><span>best</span></div><div><b>${hRate(h,30)}%</b><span>last 30 days</span></div><div><b>${h.link?Object.keys(DNAMES).filter(d=>hDone(h,d)).length:Object.values(HLOG.d).filter(x=>x[h.id]).length}</b><span>${h.type==='neg'?'slips':'total'}</span></div></div>
    ${hHeat(h)}<div class="dim" style="font-size:11px;margin:12px 0 6px">last 14 days — ${h.link?'linked to Today — fix past days there':'tap a day to fix it'}</div><div class="hdays">${hist}</div>
    <div class="dim" style="font-size:11px;margin-top:10px">${h.type==='neg'?'avoid it — hold the tile if you slipped':h.type==='week'?`${h.per||3}× a week`:h.type==='days'?'on '+(h.days||[]).map(i=>DOW[i]).join(' '):'every day'}${hTarget(h)>1?` · ${hTarget(h)} ${esc(h.unit||'times')} a day`:''}${h.remind?` · reminder ${h.remind}`:''}</div>
    <div class="bigbtns" style="margin-top:14px">${h.link?'<button class="btn" type="button" id="hHide">hide from streaks</button>':'<button class="btn" type="button" id="hEd">edit</button>'}<span style="flex:1"></span><button class="btn p" type="button" id="hOk">done</button></div>`);
  $('hOk').onclick=closeSheet;if($('hEd'))$('hEd').onclick=()=>hEdit(h);if($('hHide'))$('hHide').onclick=()=>{HAB.hide=(HAB.hide||[]).concat(h.id);hSave();closeSheet();renderHabits()};
  $('sheetBody').onclick=e=>{const b=e.target.closest('[data-hd]');if(!b||h.link)return;const d=b.dataset.hd;const o=HLOG.d[d]=HLOG.d[d]||{};if(h.type==='neg')o[h.id]=o[h.id]?0:1;else o[h.id]=hDone(h,d)?0:hTarget(h);if(!o[h.id])delete o[h.id];hSaveLog();hDetail(id);renderHabits()}}
function hEdit(h){const isNew=!h;h=h?clone(h):{id:rid(),n:'',ic:'💪',col:HCOLS[HAB.list.length%HCOLS.length],type:'daily',per:3,days:[1,2,3,4,5],q:1,unit:'',remind:'',created:DAYK};
  const draw=()=>{$('sheetBody').innerHTML=`<label class="fl">habit<input class="inp" id="heN" value="${esc(h.n)}" placeholder="e.g. gym, skincare, no sugar"></label>
    <div class="dim" style="font-size:11px;margin:4px 0">icon</div><div class="hicons">${HICONS.map(i=>`<button type="button" data-hi="${i}" class="${h.ic===i?'on':''}">${i}</button>`).join('')}</div>
    <div class="dim" style="font-size:11px;margin:10px 0 4px">colour</div><div class="hcols">${HCOLS.map(c=>`<button type="button" data-hc="${c}" class="${h.col===c?'on':''}" style="background:${c}"></button>`).join('')}</div>
    <div class="dim" style="font-size:11px;margin:10px 0 4px">type</div><div class="seg mini">${[['daily','every day'],['days','some days'],['week','x per week'],['neg','break a habit']].map(([k,l])=>`<button type="button" data-ht="${k}" aria-pressed="${h.type===k}">${l}</button>`).join('')}</div>
    ${h.type==='days'?`<div class="hdow">${[1,2,3,4,5,6,0].map(i=>`<button type="button" data-hw="${i}" class="${(h.days||[]).includes(i)?'on':''}">${DOW[i]}</button>`).join('')}</div>`:''}
    ${h.type==='week'?`<label class="fl" style="margin-top:8px">times per week<input class="inp num" id="heP" value="${h.per||3}" inputmode="numeric"></label>`:''}
    ${h.type!=='neg'?`<div class="fgrid4" style="margin-top:8px"><label class="fl">times a day<input class="inp num" id="heQ" value="${h.q||1}" inputmode="numeric"></label><label class="fl">unit (optional)<input class="inp" id="heU" value="${esc(h.unit||'')}" placeholder="glasses, pages…"></label></div>`:''}
    <label class="fl" style="margin-top:8px">🔔 reminder<input type="time" class="inp" id="heR" value="${h.remind||''}"></label>
    <div class="bigbtns" style="margin-top:12px">${isNew?'':'<button class="btn d" type="button" id="heDel">delete</button>'}<span style="flex:1"></span><button class="btn p" type="button" id="heOk">${isNew?'add habit':'save'}</button></div>`};
  openSheet(isNew?'new habit':'edit habit','');draw();
  const read=()=>{const v=id=>$(id)?$(id).value:null;h.n=(v('heN')||'').trim();if(v('heP')!=null)h.per=Math.max(1,Math.min(7,+v('heP')||3));if(v('heQ')!=null)h.q=Math.max(1,+v('heQ')||1);if(v('heU')!=null)h.unit=v('heU').trim();h.remind=v('heR')||''};
  $('sheetBody').onclick=e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;
    if(d.hi||d.hc||d.ht||d.hw){read();if(d.hi)h.ic=d.hi;if(d.hc)h.col=d.hc;if(d.ht)h.type=d.ht;if(d.hw){const i=+d.hw;h.days=(h.days||[]).includes(i)?h.days.filter(x=>x!==i):(h.days||[]).concat(i)}draw();return}
    if(b.id==='heDel'){if(!b.dataset.arm){b.dataset.arm=1;b.textContent='tap again';return}HAB.list=HAB.list.filter(x=>x.id!==h.id);hSave();closeSheet();renderHabits();return}
    if(b.id==='heOk'){read();if(!h.n){$('heN').focus();return}const i=HAB.list.findIndex(x=>x.id===h.id);if(i>=0)HAB.list[i]=h;else HAB.list.push(h);hSave();hWidget();closeSheet();renderHabits();if(typeof pushSync==='function')pushSync()}}}
/* widget feed: a small summary doc any future widget can read */
function hWidget(){const L=hAll();save('widget/streaks',{at:new Date().toISOString(),day:DAYK,items:L.map(h=>({n:h.n,ic:h.ic,col:h.col,streak:hStreak(h).n,unit:hStreak(h).unit,done:hDone(h,DAYK),due:hDue(h,DAYK),c:hCnt(h,DAYK),t:hTarget(h)}))})}

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
watchPrefix('notes/n-',(evt,path,data)=>{const id=path.slice(8);if(evt==='DELETE')delete NOTES[id];else if(data){if(NCUR===id&&document.activeElement&&document.activeElement.id==='nEd')return;NOTES[id]=data}if(cur==='journal'&&JTAB==='notes')renderNotes(true)});
watch('notes/folders',d=>{if(d)NFOLD={list:['notes'],...d}});
const nText=h=>{const d=document.createElement('div');d.innerHTML=h||'';d.querySelectorAll('li,p,div,h1,h2,h3,br').forEach(x=>x.append(' '));return d.textContent.replace(/\s+/g,' ').trim()};
const nTitle=n=>{const d=document.createElement('div');d.innerHTML=n.html||'';const f=[...d.childNodes].map(x=>x.textContent.trim()).find(Boolean);return (f||'new note').slice(0,80)};
function nAgo(t){const d=new Date(t),n=new Date();return ymd(d)===ymd(n)?d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}):((n-d)<6*864e5?d.toLocaleDateString('en-GB',{weekday:'long'}):d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'2-digit'})).toLowerCase()}
function renderNotes(listOnly){const el=$('jPaneN');if(!el)return;const q=(($('nQ')||{}).value||'').toLowerCase();
  const all=Object.values(NOTES).filter(n=>NF==='all'||n.folder===NF).filter(n=>!q||nText(n.html).toLowerCase().includes(q)).sort((a,b)=>(b.pin?1:0)-(a.pin?1:0)||(b.upd>a.upd?1:-1));
  const listHtml=`${all.map(n=>{const t=nTitle(n);const body=nText(n.html).slice(t.length).trim();return `<button type="button" class="nitem${n.id===NCUR?' on':''}" data-n="${n.id}"><b>${n.pin?'📌 ':''}${esc(t)}</b><span class="dim"><span class="num">${nAgo(n.upd)}</span> ${esc(body.slice(0,70))||'no additional text'}</span></button>`}).join('')||'<div class="dim" style="padding:14px 4px">no notes</div>'}`;
  if(listOnly&&$('nList')){$('nList').innerHTML=listHtml;return}
  el.innerHTML=`<div class="ngrid${NCUR?' editing':''}"><div class="nside"><div class="row" style="gap:6px"><input class="inp" id="nQ" type="search" placeholder="search notes" value="${esc(q)}" style="flex:1"><button class="btn p" type="button" id="nNew" title="new note">✎</button></div>
    <div class="chips" id="nFolders" style="margin:8px 0">${['all',...NFOLD.list].map(f=>`<button type="button" class="chip${NF===f?' on':''}" data-nf="${esc(f)}">${esc(f)}</button>`).join('')}<button type="button" class="chip" id="nAddF">+ folder</button></div>
    <div class="nlistw" id="nList">${listHtml}</div></div>
    <div class="neditor panel">${NCUR&&NOTES[NCUR]?nEditorHtml(NOTES[NCUR]):'<div class="pb dim nempty">pick a note or start a new one ✎</div>'}</div></div>`;
  nBind()}
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
function nSave(){clearTimeout(nSaveT);if(!NCUR||!NOTES[NCUR])return;const n=NOTES[NCUR];if(!nText(n.html)&&!/<img|<hr/.test(n.html)){removeDoc('notes/n-'+n.id)}else save('notes/n-'+n.id,n,true);if($('nSaved'))$('nSaved').textContent='saved';renderNotes(true)}
function nFlush(){if(nSaveT)nSave()}
addEventListener('pagehide',nFlush);

/* ---------------- TASKS ---------------- */
let TASKS={list:[],projects:[]},tasksLoaded=false,TV=LS.get('tview')||'today';
const PCOL=['#7a7a7a','#05d9e8','#ffb000','#ff2a6d'];
async function loadTasks(){if(tasksLoaded){renderTasks();return}const d=await load('tasks/all');TASKS={list:[],projects:[],...(d||{})};tasksLoaded=true;renderTasks()}
watch('tasks/all',d=>{if(d){TASKS={list:[],projects:[],...d};if(cur==='journal'&&JTAB==='tasks'&&!(document.activeElement&&document.activeElement.id==='tAdd'))renderTasks()}});
const tSave=()=>{save('tasks/all',TASKS);if(typeof pushSync==='function')pushSync()};
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
    if(d.tc){const tk=TASKS.list.find(x=>x.id===d.tc);if(!tk)return;if(tk.done){tk.done=null}else if(tk.rep&&tk.d){const nx=tNext(tk);TASKS.list.push({...clone(tk),id:rid()+rid(),done:new Date().toISOString(),rep:null});tk.d=nx;(tk.sub||[]).forEach(s=>s.x=false)}else tk.done=new Date().toISOString();
      const row=b.closest('.trow');row.classList.add('pop');try{navigator.vibrate&&navigator.vibrate(12)}catch(x){}setTimeout(()=>{tSave();renderTasks()},260);return}
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

// Offline cache for the app shell. Data always comes from Supabase (or the local cache in the page).
const CACHE='system-__V__';
const SHELL=['./','index.html','app.css?v=__V__','app.js?v=__V__','config.js?v=__V__','vendor/supabase.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE&&k!=='ds-media').map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET')return;
  if(u.hostname.endsWith('supabase.co'))return; // never cache data or auth
  if(u.origin===location.origin){
    const isPage=e.request.mode==='navigate'||u.pathname.endsWith('/')||u.pathname.endsWith('.html')||u.pathname.endsWith('sw.js')||u.pathname.endsWith('.webmanifest');
    if(isPage){ // network first: always get the newest app when online
      e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{if(r.ok){const cp=r.clone();caches.open(CACHE).then(c=>c.put(e.request,cp))}return r}).catch(()=>caches.match(e.request,{ignoreSearch:true}).then(h=>h||caches.match('index.html'))));return}
    // versioned assets: cache first (their URL changes on every release)
    e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{if(r.ok){const cp=r.clone();caches.open(CACHE).then(c=>c.put(e.request,cp))}return r})));return}
  if(u.hostname==='cdn.jsdelivr.net'&&u.pathname.includes('free-exercise-db')){e.respondWith(caches.open('ds-media').then(c=>c.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{if(r.ok||r.type==='opaque')c.put(e.request,r.clone());return r}))));return}
  if(u.hostname.includes('fonts.g')){e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{const cp=r.clone();caches.open(CACHE).then(c=>c.put(e.request,cp));return r})))}
});
// web push: show it, and open/focus the app when tapped
self.addEventListener('push',e=>{let d={};try{d=e.data?e.data.json():{}}catch(x){d={title:'dylan@system',body:e.data&&e.data.text()}}
  e.waitUntil(self.registration.showNotification(d.title||'dylan@system',{body:d.body||'',tag:d.tag||undefined,renotify:!!d.tag,icon:'icons/icon-192.png',badge:'icons/icon-192.png',data:{url:d.url||'./'}}))});
self.addEventListener('notificationclick',e=>{e.notification.close();const url=new URL((e.notification.data&&e.notification.data.url)||'./',self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{for(const c of cs){if('focus' in c){c.navigate&&c.navigate(url).catch(()=>{});return c.focus()}}return self.clients.openWindow(url)}))});

})();
