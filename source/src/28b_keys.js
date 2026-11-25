/* ================= TOOLS: keys — a vault encrypted on the device ================= */
// Only ciphertext ever leaves this page. kv 'tools/keys' = {v,salt,it,iv,ct}: AES-256-GCM, key from
// PBKDF2-SHA256 over a passphrase that is never stored, sent or logged. The key is non-extractable,
// lives in memory only, and is dropped on lock (button, 5 min idle, 60 s in the background).
const PV={doc:null,key:null,items:null,q:'',edit:null,chg:false,err:'',hid:0,t:0,loaded:false,bound:false};
const PV_IT=600000,PV_IDLE=5*60e3,PV_BG=60e3;
const pvB64=u=>{u=new Uint8Array(u);let s='';for(let i=0;i<u.length;i+=8192)s+=String.fromCharCode.apply(null,u.subarray(i,i+8192));return btoa(s)};
const pvU8=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function pvDerive(pass,salt,it){const m=await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:it,hash:'SHA-256'},m,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
async function pvOpen(doc,key){const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:pvU8(doc.iv)},key,pvU8(doc.ct));return (JSON.parse(new TextDecoder().decode(pt)).items)||[]}
async function pvSeal(key,salt,it){const iv=crypto.getRandomValues(new Uint8Array(12));
  const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify({items:PV.items})));
  PV.doc={v:1,salt,it,iv:pvB64(iv),ct:pvB64(ct),at:Date.now()};save('tools/keys',PV.doc,true)}
function pvLock(){PV.key=null;PV.items=null;PV.edit=null;PV.chg=false;PV.q='';clearTimeout(PV.t);const el=$('t-keys');if(el){el.innerHTML='';if(cur==='tools'&&TOOLV==='keys')renderKeys()}}
function pvPoke(){clearTimeout(PV.t);if(PV.key)PV.t=setTimeout(pvLock,PV_IDLE)}
function pvGen(n=20){const cs='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_=+?';const out=[];
  while(out.length<n){const b=crypto.getRandomValues(new Uint8Array(32));for(const x of b){if(x<cs.length*Math.floor(256/cs.length)&&out.length<n)out.push(cs[x%cs.length])}}return out.join('')}
async function pvCopy(v,b){try{await navigator.clipboard.writeText(v)}catch(e){const t=document.createElement('textarea');t.value=v;t.setAttribute('readonly','');t.style.cssText='position:fixed;opacity:0;top:0';document.body.appendChild(t);t.select();try{document.execCommand('copy')}catch(x){}t.remove()}
  if(b){const o=b.textContent;b.textContent='copied';b.classList.add('ok');setTimeout(()=>{b.textContent=o;b.classList.remove('ok')},1200)}}
const PVI='autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" data-lpignore="true" data-1p-ignore'; // keep fields out of spellcheck services and autofill
async function loadKeys(){PV.doc=await load('tools/keys').catch(()=>null)||null;PV.loaded=true;renderKeys()}
function renderKeys(){const el=$('t-keys');if(!el)return;if(!PV.loaded){el.innerHTML='<div class="panel"><div class="pb pv-dim">loading…</div></div>';loadKeys();return}
  pvBind();
  if(!PV.key){const fresh=!PV.doc;
    el.innerHTML=`<div class="panel pv-gate"><div class="ph"><span>${fresh?'new vault':'locked'}</span><span class="tag">AES-256 · on device</span></div><div class="pb">
      <div class="pv-lk"><svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/><circle cx="12" cy="15.5" r="1.3" fill="currentColor"/></svg></div>
      ${fresh?`<p class="pv-p">Pick a master passphrase. Everything is encrypted on this device before it's saved, so the database, GitHub and anyone else only ever see scrambled data.</p><p class="pv-p pv-warn">There is no reset. Forget it and the vault can't be opened by anyone, including you.</p>`:''}
      <form id="pvGate" class="pv-form"><input class="inp" type="password" id="pvPass" placeholder="${fresh?'master passphrase (10+ characters)':'master passphrase'}" ${PVI}>
      ${fresh?`<input class="inp" type="password" id="pvPass2" placeholder="type it again" ${PVI}>`:''}
      <div class="pv-err" id="pvErr">${esc(PV.err)}</div><button class="btn p" type="submit" id="pvGo">${fresh?'Create vault':'Unlock'}</button></form></div></div>`;
    PV.err='';setTimeout(()=>{const i=$('pvPass');if(i&&!PHONE)i.focus()},50);return}
  const q=PV.q.trim().toLowerCase(),list=PV.items.filter(x=>!q||[x.name,x.user,x.url].some(s=>String(s||'').toLowerCase().includes(q))).sort((a,b)=>String(a.name).localeCompare(String(b.name)));
  const row=(lab,v,mono)=>v?`<div class="pv-row"><span class="pv-lab">${lab}</span><span class="pv-v${mono?' pv-mono':''}">${esc(v)}</span><button type="button" class="btn sm" data-cp="${esc(v)}">copy</button></div>`:'';
  const card=x=>PV.edit===x.id?pvForm(x):`<div class="pv-card"><div class="pv-top"><b>${esc(x.name||'untitled')}</b>${x.url?`<span class="pv-url">${esc(x.url)}</span>`:''}<button type="button" class="pv-ed" data-ed="${esc(x.id)}" aria-label="Edit">edit</button></div>
      ${row('user',x.user)}${row('pass',x.pw,true)}${x.note?`<div class="pv-note">${esc(x.note)}</div>`:''}</div>`;
  el.innerHTML=`<div class="pv-bar"><input class="inp" id="pvQ" placeholder="search ${PV.items.length}" value="${esc(PV.q)}" ${PVI}><button type="button" class="btn p" id="pvAdd">+ add</button><button type="button" class="btn" id="pvLock">lock</button></div>
    ${PV.edit==='new'?pvForm({id:'new'}):''}
    <div class="pv-list">${list.map(card).join('')||`<div class="pv-dim pv-empty">${q?'no match':'empty. add your first one'}</div>`}</div>
    ${PV.chg?`<div class="panel"><div class="ph"><span>change passphrase</span></div><div class="pb"><form id="pvChg" class="pv-form"><input class="inp" type="password" id="pvOld" placeholder="current passphrase" ${PVI}><input class="inp" type="password" id="pvNew" placeholder="new passphrase (10+)" ${PVI}><input class="inp" type="password" id="pvNew2" placeholder="new again" ${PVI}><div class="pv-err" id="pvErr"></div><div class="pv-btns"><button class="btn p" type="submit">Change</button><button class="btn" type="button" id="pvChgX">Cancel</button></div></form></div></div>`
      :`<button type="button" class="pv-link" id="pvChgO">change master passphrase</button>`}
    <p class="pv-dim pv-foot">Locks after 5 min idle or a minute in the background.</p>`;
  pvPoke()}
function pvForm(x){return `<form class="pv-card pv-edit" data-fid="${esc(x.id)}">
  <input class="inp" name="name" placeholder="name (site / app)" value="${esc(x.name)}" ${PVI}>
  <input class="inp" name="user" placeholder="username / email" value="${esc(x.user)}" ${PVI}>
  <div class="pv-gen"><input class="inp pv-mono" name="pw" placeholder="password" value="${esc(x.pw)}" ${PVI}><button type="button" class="btn sm" data-gen="1">generate</button></div>
  <input class="inp" name="url" placeholder="url (optional)" value="${esc(x.url)}" ${PVI}>
  <textarea class="inp" name="note" rows="2" placeholder="note (optional)" ${PVI}>${esc(x.note)}</textarea>
  <div class="pv-btns"><button class="btn p" type="submit">Save</button><button class="btn" type="button" data-x="1">Cancel</button>${x.id!=='new'?`<button class="btn d" type="button" data-del="${esc(x.id)}">Delete</button>`:''}</div></form>`}
function pvBind(){if(PV.bound)return;PV.bound=true;const el=$('t-keys');
  el.addEventListener('submit',async e=>{e.preventDefault();const f=e.target;
    if(f.id==='pvGate'){const p=$('pvPass').value,b=$('pvGo');
      if(!PV.doc){if(p.length<10){$('pvErr').textContent='at least 10 characters';return}if(p!==$('pvPass2').value){$('pvErr').textContent="they don't match";return}
        b.disabled=true;b.textContent='creating…';const ex=await load('tools/keys').catch(()=>null);if(ex&&ex.ct){PV.doc=ex;PV.err='a vault already exists. unlock it';return renderKeys()}const salt=crypto.getRandomValues(new Uint8Array(16));PV.key=await pvDerive(p,salt,PV_IT);PV.items=[];await pvSeal(PV.key,pvB64(salt),PV_IT);renderKeys();return}
      b.disabled=true;b.textContent='unlocking…';try{const k=await pvDerive(p,pvU8(PV.doc.salt),PV.doc.it||PV_IT);PV.items=await pvOpen(PV.doc,k);PV.key=k}catch(x){PV.err='wrong passphrase'}renderKeys();return}
    if(f.id==='pvChg'){const o=$('pvOld').value,n=$('pvNew').value,er=$('pvErr');if(n.length<10){er.textContent='at least 10 characters';return}if(n!==$('pvNew2').value){er.textContent="new ones don't match";return}
      try{await pvOpen(PV.doc,await pvDerive(o,pvU8(PV.doc.salt),PV.doc.it||PV_IT))}catch(x){er.textContent='current passphrase is wrong';return}
      const salt=crypto.getRandomValues(new Uint8Array(16));PV.key=await pvDerive(n,salt,PV_IT);await pvSeal(PV.key,pvB64(salt),PV_IT);PV.chg=false;renderKeys();return}
    if(f.dataset.fid&&PV.key){const v=Object.fromEntries(new FormData(f));Object.keys(v).forEach(k=>v[k]=String(v[k]).trim());if(!v.name&&!v.user&&!v.pw)return;
      if(f.dataset.fid==='new')PV.items.push({id:rid(),...v,at:Date.now()});else{const it=PV.items.find(x=>x.id===f.dataset.fid);if(it)Object.assign(it,v,{at:Date.now()})}
      PV.edit=null;await pvSeal(PV.key,PV.doc.salt,PV.doc.it||PV_IT);renderKeys()}});
  el.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b||!PV.key)return;
    if(b.dataset.cp!==undefined)return pvCopy(b.dataset.cp,b);
    if(b.dataset.gen){b.closest('form').elements.pw.value=pvGen();return}
    if(b.id==='pvLock')return pvLock();
    if(b.id==='pvAdd'){PV.edit='new';renderKeys();const f=el.querySelector('[data-fid="new"] [name=name]');f&&f.focus();return}
    if(b.dataset.ed){PV.edit=b.dataset.ed;return renderKeys()}
    if(b.dataset.x){PV.edit=null;return renderKeys()}
    if(b.dataset.del){if(!b.dataset.arm){b.dataset.arm=1;b.textContent='Sure?';return}PV.items=PV.items.filter(x=>x.id!==b.dataset.del);PV.edit=null;await pvSeal(PV.key,PV.doc.salt,PV.doc.it||PV_IT);return renderKeys()}
    if(b.id==='pvChgO'){PV.chg=true;return renderKeys()}if(b.id==='pvChgX'){PV.chg=false;return renderKeys()}});
  el.addEventListener('input',e=>{if(e.target.id!=='pvQ')return;PV.q=e.target.value;const s=e.target.selectionStart;renderKeys();const i=$('pvQ');i.focus();i.setSelectionRange(s,s)});
  ['pointerdown','keydown'].forEach(t=>document.addEventListener(t,()=>{if(PV.key)pvPoke()},{passive:true}));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)PV.hid=Date.now();else if(PV.key&&Date.now()-PV.hid>PV_BG)pvLock()})}
watch('tools/keys',d=>{if(!d)return;const same=PV.doc&&PV.doc.salt===d.salt;PV.doc=d;if(!PV.key)return;if(!same)return pvLock();
  pvOpen(d,PV.key).then(items=>{PV.items=items;if(!PV.edit&&!PV.chg&&cur==='tools'&&TOOLV==='keys')renderKeys()}).catch(pvLock)});
