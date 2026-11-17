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
