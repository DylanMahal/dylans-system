/* ================= COMPETITIVE RANKS (Rocket League ladder) =================
   Score 0–21+: 3 divisions per tier, Bronze I … Grand Champion III, then Supersonic Legend.
   Exercise rank = your best set vs bodyweight-scaled strength standards. Every exercise is ranked: free weights,
   cables, machines (with brand corrections), bodyweight reps, timed holds and cardio speed. Stretches are the only thing left out.
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
/* strength standards: beginner, novice, intermediate, advanced, elite. Every exercise is matched to one rule (first hit wins).
   Load rules are 1RM as a multiple of bodyweight (per dumbbell / kettlebell / handle / arm for one-hand work), scaled to an 80 kg lifter.
   Cable and machine numbers come from crowd 1RM data for those machines, so stack brands that run light or heavy are corrected in the brand rules.
   k: w load (default) · r reps · b bodyweight lift (reps when logged as bodyweight, else bodyweight + added load) · s seconds · v speed km/h
   r: reps ladder used when a set has no weight on it */
const RLR5=[10,20,30,45,60],RLRX=[8,15,25,35,50],RLDR=[5,10,16,24,34],RLCORE=[10,25,45,65,90];
const RL_R=[
  /* custom machines, by brand */
  [/gymleco.*curl|curl.*gymleco/i,0,[.17,.27,.4,.57,.75]],
  [/nautilus.*pull.?over|pull.?over.*machine/i,0,[.5,.72,1,1.3,1.65]],
  [/prime.*row/i,0,[.42,.63,.9,1.22,1.6]],
  [/prime.*(incline|press)/i,0,[.33,.55,.85,1.2,1.62]],
  [/biangular|magnu[sm].*row|iso.?(lateral )?row|plate.?loaded row|hammer strength.*row/i,0,[.5,.85,1.3,1.85,2.45]],
  [/nautilus.*(deltoid|lateral)|(deltoid|lateral) raise.*machine/i,0,[.27,.45,.71,1.02,1.38]],
  [/nautilus.*tri|v-?tri/i,0,[.35,.57,.87,1.23,1.63]],
  /* cardio and timed */
  [/trail/i,0,[5,7,9,11,13],'v'],[/running|jogging/i,0,[8,10,12,14,16.5],'v'],[/walking, treadmill|^walking/i,0,[4,5,5.8,6.5,7.5],'v'],
  [/bicycl|recumbent|cycling|\bbike\b(?!.*air)/i,'machine|other',[15,20,25,30,36],'v'],[/elliptical/i,0,[6,8,10,12,14],'v'],[/rowing/i,0,[11,12.5,14,15.5,17],'v'],
  [/skating/i,0,[10,14,18,22,26],'v'],[/prowler/i,0,[5,8,11,14,17],'v'],[/power stairs/i,0,[.4,.7,1,1.4,1.8]],[/rope jump|skipping rope/i,0,[60,180,300,600,900],'s'],[/stair|step mill/i,0,[600,1200,1800,2700,3600],'s'],
  [/side plank/i,0,[10,30,60,90,120],'s'],[/plank/i,0,[20,45,90,150,240],'s'],
  /* equipment you can't put a load number on */
  [/push-?ups? with feet on/i,0,[3,10,22,36,50],'r'],
  [/./,'band',RLR5,'r'],
  [/./,'med ball',[.04,.07,.11,.16,.22],'w',RLRX],
  [/hyperextension/i,'swiss ball',[.1,.25,.45,.7,1],'w',[10,20,30,42,55]],[/side bend/i,'swiss ball',[.08,.15,.25,.37,.5],'w',RLR5],
  [/crunch/i,'swiss ball',RLCORE,'r'],[/./,'swiss ball',[10,20,32,46,60],'r'],
  /* strongman and sleds */
  [/atlas|keg/i,0,[.5,.8,1.1,1.4,1.7],'w',[2,4,6,9,12]],[/sandbag/i,0,[.4,.65,.95,1.25,1.6],'w',[2,4,6,9,12]],[/log lift/i,0,[.4,.6,.85,1.1,1.4]],
  [/circus bell/i,0,[.2,.33,.5,.68,.88]],[/conan/i,0,[1.2,2,3,4,5]],[/tire flip/i,0,[1.5,2.5,3.5,4.5,6],'w',[2,4,7,10,14]],[/car deadlift/i,0,[1.5,2.5,3.5,4.5,5.5]],
  [/rickshaw deadlift/i,0,[.9,1.4,2,2.6,3.3]],[/rickshaw/i,0,[.6,1,1.5,2.1,2.8]],[/yoke/i,0,[1,1.6,2.3,3.1,3.9]],[/farmer/i,0,[.3,.5,.75,1,1.3]],
  [/sledgehammer|heavy bag/i,0,[10,20,35,50,70],'r'],[/sled (push|drag)|^sled push/i,0,[.5,1,1.6,2.3,3.2]],[/drag/i,'other',[.3,.6,1,1.5,2]],[/sled/i,0,[.15,.3,.5,.75,1]],
  [/battling ropes|mountain climber|flutter|air bike/i,0,[20,40,60,90,120],'r'],
  /* olympic lifts */
  [/clean and jerk/i,'barbell',[.5,.75,1.05,1.35,1.65]],[/clean and press/i,'barbell',[.4,.6,.85,1.1,1.4]],
  [/(power|split|squat) jerk/i,'barbell',[.5,.78,1.08,1.4,1.72]],[/jerk balance/i,0,[.4,.62,.85,1.1,1.35]],[/jerk dip squat/i,0,[.8,1.3,1.8,2.5,3.1]],
  [/snatch balance/i,0,[.4,.62,.88,1.15,1.4]],[/snatch pull/i,0,[.6,.9,1.2,1.55,1.85]],[/snatch deadlift/i,0,[.8,1.2,1.6,2.05,2.5]],[/snatch shrug|clean shrug/i,0,[.6,.9,1.3,1.75,2.2]],
  [/muscle snatch/i,0,[.28,.45,.62,.82,1]],[/power snatch/i,'barbell',[.35,.55,.75,1,1.2]],[/hang snatch/i,0,[.33,.52,.72,.95,1.15]],[/snatch from blocks/i,0,[.37,.56,.78,1.02,1.25]],
  [/split snatch/i,'barbell',[.38,.57,.8,1.05,1.28]],[/^snatch$/i,0,[.4,.6,.85,1.1,1.35]],
  [/clean pull/i,0,[.75,1.1,1.5,1.9,2.3]],[/clean deadlift/i,0,[.9,1.35,1.8,2.3,2.75]],[/power clean from blocks/i,0,[.47,.7,.97,1.25,1.55]],[/hang power clean/i,0,[.45,.7,.95,1.22,1.5]],
  [/power clean/i,'barbell',[.5,.75,1.05,1.35,1.65]],[/hang clean|clean from blocks/i,'barbell',[.5,.73,1,1.28,1.6]],[/^(split )?clean$/i,0,[.55,.8,1.1,1.4,1.75]],
  [/rack delivery/i,0,[.4,.6,.85,1.1,1.35]],
  /* kettlebells (per bell) */
  [/swing/i,'kettlebell|dumbbell',[.15,.25,.38,.52,.7]],[/snatch/i,'kettlebell|dumbbell',[.1,.17,.26,.36,.48]],[/jerk|push press/i,'kettlebell',[.13,.22,.34,.47,.62]],
  [/clean/i,'kettlebell|dumbbell',[.12,.2,.3,.42,.55]],[/thruster/i,'kettlebell',[.1,.17,.27,.38,.5]],[/turkish|windmill|bent press/i,'kettlebell',[.08,.15,.25,.36,.5]],
  [/halo|figure 8|pirate|pass between|pass through/i,'kettlebell',[.06,.1,.15,.21,.28]],[/goblet/i,0,[.2,.32,.48,.66,.88]],[/front squats with two/i,0,[.15,.25,.38,.52,.7]],
  [/pistol/i,'kettlebell',[.05,.1,.18,.28,.4]],[/overhead kettlebell squat/i,0,[.08,.15,.25,.36,.5]],[/one-legged deadlift/i,'kettlebell',[.15,.25,.4,.55,.75]],
  [/sumo high pull/i,0,[.2,.32,.48,.65,.85]],[/triceps extension/i,'kettlebell',[.08,.14,.23,.33,.45]],[/push-?ups/i,'kettlebell',[3,10,22,36,50],'r'],
  [/renegade row/i,0,[.1,.18,.3,.42,.55]],[/\brow\b/i,'kettlebell',[.2,.35,.55,.8,1.05]],[/floor press/i,'kettlebell',[.15,.26,.4,.58,.78]],[/press/i,'kettlebell',[.1,.17,.27,.38,.5]],
  /* bodyweight pulling */
  [/one arm chin/i,0,[1,2,4,7,10],'r'],[/kipping muscle/i,0,[1,4,8,13,19],'r'],[/muscle.?up/i,0,[1,3,6,10,15],'r'],[/rope climb/i,0,[1,2,4,6,9],'r'],
  [/scapular pull/i,0,[5,10,16,22,30],'r'],[/band assisted/i,0,[3,8,14,20,28],'r'],[/gironda/i,0,[1,3,7,12,18],'r'],
  [/gorilla|hanging pike/i,0,[1,4,8,13,18],'r'],[/weighted pull|pull-?ups?|pullups|chin-?ups?|\bchins?\b|rocky pull/i,'none|other',[1,1.12,1.3,1.55,1.8],'b',[1,5,11,18,26]],
  [/inverted row|suspended row|bodyweight mid row/i,0,[3,8,15,22,30],'r'],
  /* bodyweight pushing */
  [/handstand/i,0,[1,3,8,14,20],'r'],[/single-arm push|one arm push/i,0,[1,3,7,12,18],'r'],[/plyo push|clock push|drop push|push-?up depth/i,0,[2,8,16,25,35],'r'],
  [/incline push-?up/i,0,[8,20,38,58,80],'r'],[/decline push|feet elevated/i,0,[3,12,25,40,55],'r'],[/push-?ups?.*(close|triceps)|close-grip push/i,0,[2,10,22,36,50],'r'],
  [/push-?ups?|pushups/i,0,[4,15,30,48,66],'r'],
  [/bench dips/i,0,[5,15,30,45,60],'r'],[/weighted bench dip/i,0,[.1,.25,.45,.7,1],'w',[5,15,30,45,60]],[/ring dip/i,0,[1.02,1.15,1.35,1.6,1.9],'b',[1,5,12,20,28]],
  [/dip machine|seated dip/i,0,[.44,.8,1.28,1.89,2.57]],[/\bdips?\b/i,'none|other',[1.05,1.25,1.5,1.8,2.15],'b',[2,9,18,29,40]],
  [/body tricep|body-up|towel/i,0,[3,8,15,22,30],'r'],[/bodyweight flyes/i,0,[3,8,15,22,30],'r'],
  /* deadlifts and hinges */
  [/leverage deadlift/i,0,[1,1.5,2,2.6,3.2]],[/cable deadlift/i,0,[.5,.8,1.15,1.55,2]],[/one-arm side deadlift/i,0,[.3,.5,.75,1,1.3]],
  [/trap bar|hex bar/i,0,[1.07,1.6,2.15,2.75,3.35]],[/rack pull/i,0,[1.1,1.65,2.2,2.8,3.4]],[/deficit deadlift/i,0,[.9,1.35,1.8,2.3,2.75]],[/axle/i,0,[.85,1.3,1.75,2.2,2.65]],
  [/romanian|rdl/i,'barbell',[.6,1,1.4,1.9,2.4]],[/stiff.?leg/i,'dumbbell',[.2,.35,.55,.8,1.05]],[/stiff.?leg/i,'machine',[.5,.85,1.25,1.7,2.2]],
  [/stiff.?leg(?!.*good)|wide stance stiff/i,'barbell',[.55,.9,1.3,1.8,2.3]],[/romanian|rdl/i,'dumbbell',[.25,.4,.6,.85,1.1]],
  [/deadlift/i,'barbell',[1,1.5,2,2.5,3]],
  [/seated good morning/i,0,[.25,.4,.6,.85,1.1]],[/good morning/i,'barbell',[.3,.5,.8,1.1,1.4]],
  [/hip thrust/i,0,[.75,1.25,1.75,2.5,3.25]],[/glute bridge/i,'barbell',[.7,1.15,1.65,2.35,3.05]],[/smith machine hip raise/i,0,[.7,1.15,1.65,2.35,3.05]],
  [/reverse hyper/i,0,[.3,.55,.85,1.2,1.6]],[/hyperextension|back extension/i,0,[.1,.25,.45,.7,1],'w',[10,20,30,42,55]],
  [/pull through/i,'cable',[.25,.42,.65,.9,1.2]],[/glute ham|glute-ham/i,0,[1.02,1.1,1.2,1.32,1.45],'b',[1,3,6,10,15]],
  /* squats and legs */
  [/calf-machine.*shrug/i,0,[.7,1.15,1.7,2.4,3.1]],[/calf press/i,0,[.9,1.5,2.2,3,3.9]],[/side split squat/i,'barbell',[.35,.6,.9,1.25,1.6]],
  [/smith.*pistol/i,0,[.1,.2,.35,.5,.7]],[/smith.*split squat/i,0,[.35,.6,.85,1.2,1.5]],[/smith.*leg press/i,0,[1.1,1.75,2.6,3.6,4.7]],[/smith.*squat/i,0,[.65,1.1,1.5,2.1,2.6]],
  [/hack squat/i,'machine',[.71,1.21,1.85,2.65,3.52]],[/lying machine squat/i,0,[.65,1.1,1.7,2.4,3.2]],[/leg press/i,'machine',[1.17,1.87,2.77,3.85,5.05]],
  [/chair squat/i,0,[.5,.9,1.4,2,2.6]],[/single-leg leg extension/i,0,[.25,.4,.6,.84,1.1]],[/leg extension/i,0,[.52,.83,1.21,1.67,2.18]],
  [/standing leg curl/i,0,[.15,.25,.38,.53,.7]],[/lying leg curl/i,0,[.38,.6,.88,1.2,1.56]],[/leg curl/i,'machine|cable',[.43,.67,.98,1.34,1.74]],
  [/front squat|front barbell squat/i,'barbell',[.6,1,1.25,1.75,2.2]],[/overhead squat/i,0,[.4,.65,.9,1.25,1.55]],[/zercher/i,0,[.55,.9,1.2,1.65,2.05]],
  [/hack squat/i,'barbell',[.5,.8,1.1,1.5,1.9]],[/jefferson|frankenstein/i,0,[.5,.85,1.2,1.65,2.1]],[/jump squat/i,'barbell',[.2,.35,.5,.7,.9]],
  [/sissy/i,0,[.1,.2,.35,.5,.7]],[/one leg barbell squat/i,0,[.3,.5,.75,1.05,1.35]],[/kneeling squat/i,0,[.6,1,1.4,1.9,2.4]],[/speed (box )?squat/i,0,[.5,.8,1,1.4,1.7]],
  [/box squat/i,'barbell',[.7,1.15,1.45,2.1,2.6]],[/weighted squat/i,0,[.6,1,1.4,1.9,2.4]],[/squat/i,'barbell',[.75,1.25,1.5,2.25,2.75]],
  [/side split squat/i,'barbell',[.35,.6,.9,1.25,1.6]],[/step.?ups?/i,'barbell',[.3,.5,.75,1.05,1.35]],[/lunge/i,'barbell',[.4,.7,1,1.4,1.8]],
  [/bulgarian|split squat/i,'dumbbell',[.12,.26,.43,.63,.88]],[/lunge/i,'dumbbell',[.15,.25,.4,.55,.75]],[/step.?ups?/i,'dumbbell',[.1,.2,.33,.48,.65]],
  [/plie/i,0,[.2,.33,.5,.7,.92]],[/squat/i,'dumbbell',[.15,.25,.4,.55,.75]],
  [/bodyweight squat/i,0,[15,30,50,75,100],'r'],[/walking lunge|lunge/i,'none|other',[10,20,32,46,60],'r'],[/lunge sprint/i,0,RLDR,'r'],[/split squat|high box squat/i,'other',[3,7,12,18,25],'r'],
  /* calves */
  [/reverse calf/i,0,[.1,.2,.33,.48,.65]],[/smith.*calf/i,0,[.6,1,1.5,2.1,2.7]],[/seated calf/i,'machine',[.4,.75,1.2,1.75,2.4]],[/seated calf/i,'barbell',[.3,.55,.9,1.3,1.8]],
  [/calf press/i,0,[.9,1.5,2.2,3,3.9]],[/one-leg calf|seated one-leg calf/i,0,[.1,.2,.33,.48,.65]],[/calf/i,'dumbbell',[.2,.35,.55,.8,1.05]],
  [/donkey calf/i,0,[.4,.75,1.2,1.75,2.4],'w',[15,25,40,55,75]],[/calf/i,'machine',[.73,1.22,1.83,2.56,3.4]],[/calf/i,'barbell',[.6,1,1.5,2.1,2.7]],
  /* hips */
  [/abductor|adductor|hip adduction/i,'machine',[.5,.8,1.2,1.7,2.25]],[/adduction|kickback/i,'cable',[.1,.18,.3,.45,.6]],
  /* horizontal pressing (and look-alikes that must not land on a press) */
  [/incline bench pull/i,0,[.35,.55,.8,1.1,1.4]],[/pallof/i,0,[.08,.15,.25,.37,.5]],[/curl over incline/i,0,[.08,.15,.24,.35,.47]],
  [/shoulder raise|raises on incline/i,'barbell|machine',[.2,.35,.55,.8,1.05]],[/triceps press to chin/i,0,[.22,.37,.56,.8,1.07]],
  [/smith.*(decline)/i,0,[.48,.75,1.15,1.6,2]],[/smith.*incline/i,0,[.38,.6,.95,1.35,1.7]],[/smith.*close/i,0,[.4,.65,1,1.4,1.7]],[/smith.*bench|decline smith/i,0,[.45,.7,1.1,1.55,1.95]],
  [/leverage incline|incline.*(machine|chest press)|neutral incline/i,'machine',[.37,.6,.93,1.3,1.75]],[/leverage decline/i,0,[.45,.72,1.1,1.55,2.05]],
  [/chest press|bench press/i,'machine',[.41,.68,1.05,1.48,1.96]],[/chest press/i,'cable',[.12,.22,.36,.55,.75]],
  [/guillotine|neck press/i,0,[.35,.55,.85,1.15,1.4]],[/jm press/i,0,[.35,.55,.85,1.2,1.55]],[/reverse triceps bench/i,0,[.4,.62,.95,1.3,1.6]],
  [/close-grip.*skull/i,0,[.25,.4,.62,.88,1.15]],[/one arm floor press/i,'barbell',[.15,.25,.4,.55,.7]],
  [/board press|pin press/i,0,[.5,.8,1.3,1.8,2.1]],[/close-grip.*(bench|press)/i,'barbell|ez bar',[.45,.7,1.1,1.5,1.8]],[/floor press/i,'barbell',[.45,.7,1.1,1.5,1.8]],
  [/incline.*(bench|press)/i,'barbell',[.4,.65,1,1.4,1.7]],[/decline.*bench/i,'barbell',[.55,.85,1.3,1.8,2.15]],[/bench press|chain press/i,'barbell|other',[.5,.75,1.25,1.75,2]],
  [/close-grip.*press/i,'dumbbell',[.12,.22,.35,.52,.7]],[/incline.*(press|bench)/i,'dumbbell',[.14,.25,.4,.58,.78]],[/(bench|floor) press/i,'dumbbell',[.16,.28,.43,.63,.85]],
  [/suspended push/i,0,[2,10,20,32,45],'r'],
  /* flyes and pullovers */
  [/reverse machine fl/i,0,[.25,.42,.64,.9,1.2]],[/butterfly|pec deck|machine.*fl[yi]/i,0,[.45,.71,1.04,1.44,1.88]],
  [/rear delt fly|reverse fl/i,'cable',[.04,.09,.16,.25,.35]],[/fl[yi]e?s?\b|crossover|iron cross/i,'cable',[.08,.18,.33,.52,.75]],
  [/reverse fl|rear (delt|lateral)|rear delt raise|bent over.*rear/i,'dumbbell',[.04,.08,.14,.22,.3]],[/fl[yi]e?s?\b/i,'dumbbell',[.09,.16,.26,.39,.54]],
  [/pullover/i,'dumbbell',[.12,.2,.32,.45,.6]],[/pullover/i,'barbell',[.18,.3,.45,.63,.82]],[/front raise and pullover/i,0,[.12,.2,.32,.45,.6]],
  [/around the world/i,0,[.03,.06,.1,.15,.2]],[/svend/i,0,[.05,.1,.16,.23,.3]],
  /* overhead pressing */
  [/push press/i,'barbell',[.5,.75,1,1.3,1.6]],[/bradford/i,0,[.28,.45,.66,.9,1.15]],[/behind (the )?neck/i,'barbell',[.32,.5,.74,.98,1.25]],
  [/anti-gravity/i,0,[.15,.25,.4,.55,.72]],[/jammer/i,0,[.2,.35,.55,.75,1]],
  [/seated.*(military|shoulder) press/i,'barbell',[.38,.58,.84,1.1,1.4]],[/(military|shoulder|overhead) press/i,'barbell',[.35,.55,.8,1.05,1.35]],
  [/smith.*(shoulder|overhead|military)/i,0,[.33,.53,.78,1.05,1.35]],[/(shoulder|military).*press/i,'machine',[.3,.55,.89,1.32,1.8]],[/shoulder press/i,'cable',[.08,.15,.25,.36,.5]],
  [/tate/i,0,[.08,.14,.23,.34,.46]],[/cuban/i,0,[.03,.06,.1,.15,.2]],[/triceps press/i,'dumbbell',[.12,.21,.33,.48,.65]],
  [/arnold/i,0,[.1,.18,.28,.4,.54]],[/standing.*press|see-saw/i,'dumbbell',[.1,.18,.29,.42,.56]],[/press/i,'dumbbell',[.11,.2,.32,.46,.62]],
  /* raises and delts */
  [/lying one-arm lateral|lying.*rear lateral/i,0,[.03,.06,.1,.15,.21]],[/lateral raise|side lateral|deltoid raise|side raise|laterals|incline lateral|lateral to front/i,'dumbbell',[.05,.1,.17,.26,.36]],
  [/front.*raise|straight-arm front|single dumbbell raise|^dumbbell raise|scaption|incline shoulder raise|power partials/i,'dumbbell',[.06,.12,.2,.29,.4]],
  [/plate raise|car drivers|front plate/i,0,[.1,.17,.27,.38,.5]],[/raise/i,'barbell',[.12,.2,.32,.45,.6]],
  [/lateral|deltoid raise|side raise/i,'cable',[.04,.09,.16,.26,.38]],[/front.*raise/i,'cable',[.05,.1,.18,.28,.38]],
  [/lateral|deltoid raise/i,'machine',[.27,.45,.71,1.02,1.38]],
  [/face pull/i,0,[.22,.37,.57,.82,1.08]],[/rope rear-delt row|row to neck/i,0,[.3,.48,.7,.97,1.25]],
  [/upright.*row/i,'barbell',[.3,.48,.7,.95,1.2]],[/upright.*row/i,'dumbbell',[.1,.17,.27,.38,.5]],[/upright.*row/i,'cable',[.25,.4,.6,.85,1.1]],[/upright.*row/i,'machine',[.28,.45,.67,.9,1.15]],
  [/rear delt row/i,'barbell',[.3,.48,.7,.95,1.2]],[/cuban|iron cross|crucifix/i,0,[.03,.06,.1,.15,.2]],
  [/rotation/i,'dumbbell',[.02,.04,.07,.1,.14]],[/rotation/i,'cable',[.03,.06,.1,.15,.21]],
  /* shrugs */
  [/middle back shrug/i,0,[.15,.27,.43,.62,.83]],[/shrug/i,'dumbbell',[.22,.39,.61,.88,1.18]],[/shrug/i,'cable',[.4,.7,1.1,1.55,2.05]],
  [/smith.*shrug/i,0,[.55,.95,1.45,2.05,2.7]],[/shrug/i,'machine',[.7,1.15,1.7,2.4,3.1]],[/shrug/i,'barbell',[.6,1.03,1.58,2.25,2.95]],
  /* rows */
  [/smith.*row/i,0,[.45,.7,.98,1.32,1.68]],[/lying t-bar|t-bar|two-arm long bar/i,0,[.45,.7,1.05,1.45,1.9]],[/one-arm long bar|one-arm long bar/i,0,[.25,.4,.6,.85,1.1]],
  [/incline bench pull|cambered|bench mid row/i,0,[.35,.55,.8,1.1,1.4]],[/\brows?\b/i,'barbell',[.49,.73,1.02,1.37,1.74]],
  [/one-arm.*row|one-arm dumbbell row/i,'dumbbell',[.22,.38,.6,.87,1.16]],[/\brows?\b/i,'dumbbell',[.17,.3,.47,.68,.9]],
  [/single-arm.*high pulley|one-arm cable pulley|shotgun/i,'cable',[.2,.32,.48,.66,.86]],[/high pulley row/i,'cable',[.45,.68,.95,1.28,1.62]],[/\brows?\b/i,'cable',[.5,.74,1.05,1.4,1.79]],
  [/\brow\b/i,'machine',[.46,.79,1.23,1.76,2.35]],
  /* pulldowns */
  [/one arm lat pulldown/i,0,[.14,.28,.48,.72,1]],[/straight-arm|incline pushdown/i,'cable',[.2,.33,.5,.7,.92]],[/behind the neck/i,'cable',[.45,.65,.9,1.17,1.47]],
  [/pulldown/i,'cable|machine',[.51,.73,1,1.3,1.63]],
  /* forearms */
  [/behind the back wrist/i,0,[.25,.45,.7,1,1.3]],[/finger curl/i,0,[.2,.35,.55,.8,1.05]],
  [/palms-?down.*wrist|wrist.*palms-?down/i,'dumbbell',[.04,.08,.13,.19,.26]],[/wrist curl/i,'dumbbell',[.07,.13,.21,.31,.42]],
  [/palms-?down.*wrist|wrist.*palms-?down/i,'barbell',[.1,.18,.28,.4,.53]],[/wrist curl/i,'barbell|cable',[.18,.32,.5,.72,.95]],
  [/pronation|supination/i,0,[.03,.06,.1,.15,.2]],[/wrist roller/i,0,[.04,.08,.13,.19,.26]],[/wrist rotation/i,0,[.1,.2,.33,.48,.65]],
  [/plate pinch/i,0,[.12,.2,.3,.42,.55]],[/hand squeeze/i,0,[.1,.17,.27,.38,.5]],[/bottoms-up/i,0,[.08,.14,.22,.31,.42]],
  /* biceps */
  [/reverse plate curl/i,0,[.05,.09,.15,.22,.3]],
  [/preacher.*curl|curl.*preacher|preacher curl/i,'machine',[.24,.4,.6,.85,1.13]],[/curl/i,'machine',[.27,.45,.67,.95,1.26]],
  [/reverse.*preacher/i,0,[.14,.23,.36,.5,.65]],[/lying high bench|concentration.*barbell/i,0,[.12,.2,.32,.45,.6]],[/spider|lying against an incline/i,'ez bar|barbell|dumbbell',[.17,.28,.43,.6,.78]],
  [/preacher|drag curl/i,'barbell|ez bar',[.2,.33,.5,.7,.9]],[/reverse.*curl/i,'barbell|ez bar',[.16,.27,.42,.58,.76]],[/curl/i,'barbell|ez bar',[.23,.38,.56,.78,1.02]],
  [/hammer/i,'dumbbell',[.11,.2,.32,.45,.61]],[/supine|lying.*curl/i,'dumbbell',[.06,.11,.18,.26,.35]],[/reverse.*curl|prone incline/i,'dumbbell',[.07,.13,.21,.3,.4]],
  [/concentration/i,'dumbbell',[.09,.16,.26,.37,.5]],[/incline|preacher|zottman|flexor/i,'dumbbell',[.08,.15,.24,.35,.47]],[/curl/i,'dumbbell',[.1,.18,.29,.43,.57]],
  [/hammer/i,'cable',[.2,.35,.55,.8,1.08]],[/one-arm.*curl|high cable curl|overhead cable curl/i,'cable',[.07,.13,.22,.33,.46]],
  [/preacher|lying.*curl/i,'cable',[.17,.3,.47,.68,.92]],[/reverse.*curl/i,'cable',[.15,.27,.42,.6,.8]],[/curl/i,'cable',[.21,.38,.6,.87,1.18]],
  /* triceps */
  [/skull|lying.*triceps? (extension|press)|lying triceps press|decline ez.*extension|triceps press to chin/i,'barbell|ez bar',[.22,.37,.56,.8,1.07]],
  [/triceps? extension/i,'barbell|ez bar',[.17,.3,.47,.68,.9]],
  [/kickback/i,'dumbbell',[.05,.1,.17,.26,.36]],[/tate/i,0,[.08,.14,.23,.34,.46]],
  [/(one-arm|one arm).*(pronated|supinated)|pronated.*one arm|bent-over.*triceps/i,'dumbbell',[.04,.08,.14,.21,.29]],
  [/one-arm.*triceps|single.*triceps|standing one-arm/i,'dumbbell',[.06,.11,.18,.27,.37]],[/lying.*tricep|decline.*triceps|pronated grip/i,'dumbbell',[.06,.11,.19,.28,.38]],
  [/triceps|tricep/i,'dumbbell',[.12,.21,.33,.48,.65]],
  [/(one arm|one-arm|single).*tricep/i,'cable',[.08,.15,.25,.37,.5]],[/reverse grip.*pushdown/i,0,[.13,.25,.42,.63,.87]],
  [/pushdown|pressdown/i,'cable',[.18,.34,.57,.87,1.2]],[/tricep|triceps/i,'cable',[.15,.28,.47,.72,1]],[/tricep|triceps/i,'machine',[.35,.57,.87,1.23,1.63]],
  /* core */
  [/ab crunch machine/i,0,[.3,.5,.8,1.15,1.5]],[/reverse crunch|oblique twist/i,'cable',[.1,.2,.33,.48,.65]],
  [/wood chop|cable lift|judo|russian twist/i,'cable',[.1,.18,.3,.45,.6]],[/pallof/i,0,[.08,.15,.25,.37,.5]],[/side bend/i,'cable',[.15,.27,.42,.6,.8]],[/crunch/i,'cable',[.35,.55,.85,1.2,1.6]],
  [/side bend/i,'dumbbell',[.2,.35,.55,.8,1.05]],[/side bend/i,'barbell',[.25,.45,.7,1,1.3]],[/barbell twist/i,0,[.15,.27,.42,.6,.8]],[/plate twist/i,0,[.05,.1,.17,.25,.35]],
  [/landmine 180/i,0,[.1,.2,.33,.48,.65]],[/press sit-up/i,0,[.1,.2,.32,.46,.62]],[/spell caster/i,0,[.06,.11,.18,.26,.35]],[/weighted sit/i,0,[.05,.1,.17,.25,.35],'w',RLCORE],
  [/rollout on knees|rollout - on knees/i,0,[5,12,22,33,45],'r'],[/roll(er|out)|fallout/i,0,[3,8,15,25,35],'r'],
  [/hanging pike|gorilla/i,0,[1,4,8,13,18],'r'],[/hanging leg raise|knee\/hip raise|leg raise on parallel/i,0,[2,6,12,20,28],'r'],
  [/russian twist/i,0,[15,30,50,75,100],'r'],[/jackknife|v-up|otis/i,0,[5,12,20,30,40],'r'],[/sit-?up/i,0,[8,20,35,50,70],'r'],
  [/crunch|bottoms up|butt-ups|elbow to knee|cocoons|heel touch|dead bug|leg pull-in|leg lift|lying leg raise|hip raise|tuck|side bridge|isometric wipers|spider crawl|suspended reverse/i,0,RLCORE,'r'],
  [/neck/i,'other',[.03,.06,.1,.15,.2],'w',RLR5],[/isometric/i,0,[5,10,15,20,25],'r'],
  /* bodyweight lower */
  [/natural glute ham|floor glute-ham/i,0,[1,2,5,9,14],'r'],[/glute bridge|butt lift|glute kickback/i,0,[10,20,32,46,60],'r'],[/step-up with knee/i,0,[10,20,30,42,55],'r'],
  /* jumps, sprints and drills: reps in a set */
  [/./,'other|none',[.1,.2,.35,.5,.7],'w',RLDR],
];
const RL_RC=RL_R.map(([re,q,s,k,r])=>({re,q:q?new RegExp('^('+q+')$','i'):null,s,k:k||'w',r}));
/* catch-all for anything no rule names (mostly your custom exercises): pitched by equipment and how big the muscle is */
const RL_FB={barbell:[[.4,.65,1,1.4,1.8],[.15,.27,.42,.6,.8]],'ez bar':[[.3,.5,.75,1,1.3],[.15,.27,.42,.6,.8]],dumbbell:[[.15,.25,.4,.58,.78],[.06,.11,.18,.27,.37]],
  kettlebell:[[.15,.25,.4,.58,.78],[.06,.11,.18,.27,.37]],cable:[[.3,.5,.75,1.05,1.4],[.08,.15,.25,.37,.5]],machine:[[.45,.75,1.1,1.55,2.05],[.25,.42,.65,.92,1.22]]};
const RL_BIG=/chest|lats|back|quads|hamstrings|glutes|full/;
function rlRule(e){const n=e.n||'',eq=(e.eq||'other').toLowerCase();for(const R of RL_RC){if(R.re.test(n)&&(!R.q||R.q.test(eq)))return R}
  const pm=(e.pm||[]).join(' '),f=RL_FB[eq];if(f)return {s:f[RL_BIG.test(pm)?0:1],k:'w',fb:1};return {s:RLRX,k:'r',fb:1}}
function rlStd(e){if(!e||e.cat==='stretching')return null;const R=rlRule(e);let k=R.k,s=R.s;
  if(e.ty==='dur'&&k!=='s')return {k:'sec',s:[20,40,70,110,160]};
  if(e.ty==='dd'&&k!=='v'&&k!=='s')return {k:'sec',s:[300,900,1800,2700,3600]};
  if(k==='v')return {k:'kmh',s};if(k==='s')return {k:'sec',s};if(k==='r')return {k:'bw',s};
  if(k==='b'){if(e.ty==='bw'||e.ty==='r')return {k:'bw',s:R.r};return {k:'wbw',s,r:R.r}}
  if(e.ty==='bw'||e.ty==='r')return {k:'bw',s:R.r||RLRX};
  if(e.ty==='wbw')return {k:'wbw',s:[1,1.12,1.3,1.55,1.8],r:R.r};
  return {k:'wr',s,r:R.r}}
function rlScoreRatio(v,s){const P=[[0,0],[s[0],3],[s[1],6],[s[2],9],[s[3],12],[s[4],15],[s[4]*1.15,18],[s[4]*1.3,21]];
  for(let i=1;i<P.length;i++)if(v<=P[i][0]){const [a,x]=P[i-1],[b,y]=P[i];return x+(v-a)/(b-a||1)*(y-x)}return 21}
const rlE1=(kg,r)=>r<=1?kg:kg*(1+Math.min(10,r)/30);   /* Epley, trusted up to 10 reps */
function rlSetScore(e,s,std,bw){std=std||rlStd(e);if(!std||!std.s||s.t==='w'||s.done===false)return null;bw=bw||rlBW();const r=+s.r||0,kg=+s.kg||0;
  if(std.k==='bw')return r>0?rlScoreRatio(r,std.s):null;
  if(std.k==='sec')return +s.sec>0?rlScoreRatio(+s.sec,std.s):null;
  if(std.k==='kmh')return (+s.km>0&&+s.sec>0)?rlScoreRatio(+s.km/(+s.sec/3600),std.s):null;
  if(std.k==='wbw')return r>0?rlScoreRatio(rlE1(bw+kg,r)/bw,std.s):null;
  if(kg>0&&r>0)return rlScoreRatio(rlNorm(rlE1(kg,r),bw),std.s);
  return (r>0&&std.r)?rlScoreRatio(r,std.r):null}
const rlComp=e=>/press|squat|deadlift|row|pull|chin|lunge|dip|clean|snatch|thrust|push|jerk|step.?up|good morning/i.test(e.n)&&!/curl|raise|fly|flye|extension|kickback|shrug|crunch/i.test(e.n);
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
/* what it takes to reach the next division, in the unit the exercise is scored in */
function rlNext(e,score){const std=rlStd(e);if(!std||!std.s||score>=21)return '';const s=std.s;const P=[[0,0],[s[0],3],[s[1],6],[s[2],9],[s[3],12],[s[4],15],[s[4]*1.15,18],[s[4]*1.3,21]];
  const tgt=Math.floor(score)+1;let v=0;for(let i=1;i<P.length;i++)if(tgt<=P[i][1]){const [a,x]=P[i-1],[b,y]=P[i];v=a+(tgt-x)/(y-x)*(b-a);break}
  const nm=rlOf(tgt).name,bw=rlBW();
  if(std.k==='bw')return `${Math.ceil(v)} reps in a set for ${nm}`;
  if(std.k==='sec')return `${v>=120?mmss(Math.ceil(v)):Math.ceil(v)+' s'} for ${nm}`;
  if(std.k==='kmh')return `${(Math.ceil(v*10)/10).toFixed(1)} km/h average for ${nm}`;
  if(std.k==='wbw')return `${kgs(Math.max(0,Math.ceil(v*bw-bw)))} kg added (1RM) for ${nm}`;
  return `est. 1RM of ${kgs(Math.ceil(v*Math.pow(bw,2/3)*Math.pow(80,1/3)*2)/2)} kg for ${nm}`}
/* small inline badge: one exercise's rank (session best or all-time), '' when unranked */
function rlScoreIn(e,x,date){const std=rlStd(e);if(!std||!std.s)return null;return rlBestIn(e,x,std,rlBWAt(date))}
function rlMini(sc,sz=18){if(sc==null)return '';const r=rlOf(sc);return `<span class="rlmini" title="${esc(r.name)}" aria-label="rank ${esc(r.name)}">${rlBadge(sc,sz)}</span>`}
function rlExBlock(e){const sc=rlEx(e.id);if(sc==null)return '';const r=rlOf(sc);
  return `<div class="rlblock" style="--rc:${RL[r.t][1]}">${rlBadge(sc,54)}<div><span class="dim">Rank</span><b>${r.name}</b>${r.t<7?`<div class="rpgbar"><i style="width:${r.frac*100}%;background:var(--rc);box-shadow:0 0 8px var(--rc)"></i></div>`:''}<small class="dim">${esc(rlNext(e,sc))||'top of the ladder'}</small></div></div>`}
function rlTopList(n){const seen=new Map();WORKOUTS.forEach(w=>(w.ex||[]).forEach(x=>{const e=exOf(x);if(!seen.has(e.id))seen.set(e.id,e)}));
  return [...seen.values()].map(e=>[e,rlEx(e.id)]).filter(a=>a[1]!=null).sort((a,b)=>b[1]-a[1]).slice(0,n)}

/* overall rank = average of your 5 best-ranked lifts, at most 2 of them isolation lifts (needs at least one ranked lift) */
function rlOverall(){const L=rlTopList(99),pick=[];let iso=0;for(const x of L){const sk=rlStd(x[0]).k;if(sk==='kmh'||sk==='sec')continue;const c=rlComp(x[0]);if(!c&&iso>=2)continue;if(!c)iso++;pick.push(x);if(pick.length===5)break}return pick.length?pick.reduce((a,x)=>a+x[1],0)/pick.length:null}
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
