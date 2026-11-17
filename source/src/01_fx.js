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
(function loopGlitch(){setTimeout(()=>{if(FX&&!document.hidden)glitchAll();loopGlitch()},55000+Math.random()*15000)})();
const SCR='!<>-_\\/[]{}—=+*^?#01ABCDEF';
function scramble(el,final,dur=520){final=String(final);if(!FX){el.textContent=final;return}const t0=performance.now();(function f(t){const p=Math.min((t-t0)/dur,1);let s='';for(let i=0;i<final.length;i++){s+=(i/final.length<p||final[i]===' ')?final[i]:SCR[Math.random()*SCR.length|0]}el.textContent=s;if(p<1)requestAnimationFrame(f)})(t0)}
const cx=$('curx'),cxy=$('curxy');
addEventListener('pointermove',e=>{if(e.pointerType!=='mouse')return;cx.style.left=e.clientX+'px';cx.style.top=e.clientY+'px';cxy.style.left=e.clientX+'px';cxy.style.top=e.clientY+'px';cxy.textContent=String(Math.round(e.clientX)).padStart(4,'0')+':'+String(Math.round(e.clientY)).padStart(4,'0');cx.classList.toggle('big',!!e.target.closest('button,a,input,select,textarea,.it,.tr,.cat'))});

