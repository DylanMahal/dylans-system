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
function staggerIn(root){if(!FX||!root||!root.animate)return;const els=[...root.querySelectorAll(':scope > *, .panel, .exc, .rcard, .wcard, .blk, .tr:not(.hd), .kv > *, .trk, .streak, .jitem, .spend, .cat')].filter((el,i,a)=>a.indexOf(el)===i&&el.offsetParent);
  const vh=innerHeight;let n=0;els.forEach(el=>{if(n>=14)return;const r=el.getBoundingClientRect();if(r.bottom<0||r.top>vh)return;/* only what's on screen */
    el.animate([{transform:'translateY(10px)',opacity:0},{transform:'none',opacity:1}],{duration:260,delay:n++*22,easing:'cubic-bezier(.2,.8,.2,1)',fill:'backwards'})})}
addEventListener('scroll',()=>{if(!FX)return;const c=ART.canvas;if(c&&c.parentNode)c.style.transform=`translateY(${Math.min(60,scrollY*.35)}px)`},{passive:true});

// own-image banners removed; clear any old stored images once
function loadArtImages(){load('tools/images').then(d=>{if(d)removeDoc('tools/images')}).catch(()=>{})}
