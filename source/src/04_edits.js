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
