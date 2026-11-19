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
  hp.innerHTML=NHL.map(c=>`<button type="button" class="ib-dot" data-nc="hl:${c}" style="--c:${c.replace(/,[.\d]+\)/,')').replace('rgba','rgb')}" aria-label="Highlight colour"></button>`).join('')+'<button type="button" class="ib-none" data-nc="hl:none" title="Remove highlight">none</button>';
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
