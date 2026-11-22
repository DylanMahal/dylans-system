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
