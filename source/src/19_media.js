/* ================= MEDIA — anime · movies · manga · books (Letterboxd + MyAnimeList style) ================= */
const MK={anime:{label:'anime',verb:'watch',unit:'ep',units:'episodes',ing:'watching',stars:10,icon:'◐'},movies:{label:'movies',verb:'watch',unit:'',units:'',ing:'watching',stars:5,icon:'▶︎'},manga:{label:'manga',verb:'read',unit:'ch',units:'chapters',ing:'reading',stars:10,icon:'❏'},books:{label:'books',verb:'read',unit:'p',units:'pages',ing:'reading',stars:5,icon:'▤'}};
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
  el.innerHTML=`<div class="row" style="justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:10px"><div class="seg" id="mSeg">${tabs.map(([k,l])=>`<button type="button" data-mv="${k}" aria-pressed="${MEDIAV===k}">${l}</button>`).join('')}</div><button class="btn p" type="button" id="mAddBtn">+ Add ${MK[MEDIAK].label==='movies'?'film':MK[MEDIAK].label==='books'?'book':MEDIAK}</button></div><div id="mBody"></div>`;
  $('mSeg').onclick=e=>{const b=e.target.closest('[data-mv]');if(b){MEDIAV=b.dataset.mv;renderMedia()}};$('mAddBtn').onclick=()=>mAdd(MEDIAK);
  ({library:mLibrary,diary:mDiary,lists:mLists,stats:mStats})[MEDIAV](MEDIAK)}
function initMediaNav(){$('mediaCards').onclick=e=>{const b=e.target.closest('[data-mk]');if(!b)return;MEDIAK=b.dataset.mk;LS.set('mediak',MEDIAK);renderMedia();staggerIn($('v-media-body'))}}

function poster(it,cls='mposter'){return it.img?`<img class="${cls}" src="${esc(it.img)}" alt="" loading="lazy">`:`<span class="${cls} ph">${esc((it.title||'?').slice(0,18))}</span>`}
function mCard(k,it){const max=MK[k].stars;const prog=it.total?Math.min(100,(it.prog||0)/it.total*100):null;
  return `<button type="button" class="mcard" data-mkey="${esc(it.key)}">${poster(it)}${it.fav?'<i class="mfav">♥</i>':''}${it.series?'<i class="mser">Series</i>':''}<span class="mst st-${it.st}"></span>${it.rating!=null&&it.rating!==''?`<span class="mrate">${stars(it.rating,max)}</span>`:''}${prog!=null&&it.st!=='done'?`<span class="mbar"><i style="width:${prog}%"></i></span>`:''}<span class="mt">${esc(it.title)}</span></button>`}
function mLibrary(k){const all=mItems(k);const fav=all.filter(x=>x.fav).slice(0,4);const q=norm(MFILT.q);
  let list=all.filter(x=>(MFILT.st==='all'||x.st===MFILT.st)&&(!q||norm(x.title).includes(q)));
  const S={recent:(a,b)=>(b.upd||'')>(a.upd||'')?1:-1,rating:(a,b)=>(+b.rating||0)-(+a.rating||0),title:(a,b)=>a.title.localeCompare(b.title),year:(a,b)=>(+b.year||0)-(+a.year||0)};list.sort(S[MFILT.sort]||S.recent);
  const cnt=s=>all.filter(x=>s==='all'||x.st===s).length;
  $('mBody').innerHTML=`${fav.length?`<div class="tag" style="margin-bottom:6px">Favourites</div><div class="mfavs">${fav.map(it=>mCard(k,it)).join('')}</div>`:''}
  <div class="row" style="gap:6px;flex-wrap:wrap;margin:10px 0"><div class="chips" id="mSt" style="margin:0">${[['all','all']].concat(MSTAT(k)).map(([s,l])=>`<button class="chip" type="button" data-st="${s}" aria-pressed="${MFILT.st===s}">${l} <span class="c">${cnt(s)}</span></button>`).join('')}</div></div>
  <div class="row" style="gap:6px;margin-bottom:10px"><select class="inp" id="mSort" style="flex:1">${[['recent','recently updated'],['rating','rating'],['title','title'],['year','year']].map(([v,l])=>`<option value="${v}" ${MFILT.sort===v?'selected':''}>${l}</option>`).join('')}</select></div>
  <div class="mgrid">${list.map(it=>mCard(k,it)).join('')||`<div class="dim mempty">Nothing here yet. Tap “+ add” to search.</div>`}</div>`;
  $('mSt').onclick=e=>{const b=e.target.closest('[data-st]');if(b){MFILT.st=b.dataset.st;mLibrary(k)}};$('mSort').onchange=e=>{MFILT.sort=e.target.value;mLibrary(k)};
  $('mBody').onclick=e=>{const b=e.target.closest('[data-mkey]');if(b)mEntry(k,b.dataset.mkey)}}

/* ---- add (search) ---- */
mAdd.seq=0;
/* ---- whole-series (franchise) support: walks AniList sequel/prequel links so a show can be logged as one entry ---- */
const mClean=t=>{let s=t||'';for(let i=0;i<3;i++)s=s.replace(/\s*[:\-–]?\s*(season\s*\d+|\d+(st|nd|rd|th)\s*season|part\s*\d+|cour\s*\d+|the final season.*|final season.*|final chapters?.*|s\d+)\s*$/i,'').trim();return s||t};
async function mFranchise(k,it){if(k!=='anime'&&k!=='manga')return null;const T=k==='anime'?'ANIME':'MANGA';let start;
  if(it.src==='mal')start={mal:+it.id};else if(it.src==='anilist')start={id:+it.id};else return null;
  const Q=`query($id:Int,$mal:Int){Media(id:$id,idMal:$mal,type:${T}){id title{romaji english} episodes chapters format startDate{year month} coverImage{large} genres relations{edges{relationType node{id type format}}}}}`;
  const get=v=>mfetch('https://graphql.anilist.co',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({query:Q,variables:v})},10000).then(j=>j.data&&j.data.Media);
  const OK=k==='anime'?['TV','TV_SHORT','ONA','OVA','SPECIAL','MOVIE']:['MANGA'];const seen=new Map();
  try{let level=[await get(start)];if(!level[0])return null;
    while(level.length&&seen.size<30){const next=[];level.forEach(m=>{if(!m||seen.has(m.id))return;seen.set(m.id,m);((m.relations&&m.relations.edges)||[]).forEach(e=>{const x=e.node;if((e.relationType==='SEQUEL'||e.relationType==='PREQUEL')&&x&&x.type===T&&OK.includes(x.format)&&!seen.has(x.id)&&!next.includes(x.id))next.push(x.id)})});
      level=next.length?await Promise.all(next.slice(0,8).map(id=>get({id}).catch(()=>null))):[]}}catch(e){if(!seen.size)return null}
  const all=[...seen.values()],sd=m=>m.startDate||{};all.sort((a,b)=>((sd(a).year||9999)-(sd(b).year||9999))||((sd(a).month||0)-(sd(b).month||0))||a.id-b.id);
  const f=all[0],parts=all.map(m=>({id:m.id,t:m.title.english||m.title.romaji,n:k==='anime'?m.episodes:m.chapters,y:sd(m).year,f:(m.format||'').replace(/_/g,' ').toLowerCase()}));
  return {root:'al'+f.id,title:mClean(f.title.english||f.title.romaji),alt:mClean(f.title.romaji),img:f.coverImage&&f.coverImage.large,year:sd(f).year,parts,total:parts.reduce((a,p)=>a+(p.n||0),0)||null,genres:[...new Set(all.flatMap(m=>m.genres||[]))].slice(0,8)}}
function mSeriesify(it,f,keepSingle){if(keepSingle)it.single={title:it.title,alt:it.alt,total:it.total,img:it.img,year:it.year,kind:it.kind};it.series=true;it.kind='series';
  if(f)Object.assign(it,{title:f.title,alt:f.alt,parts:f.parts,total:f.total||it.total,year:f.year||it.year,img:f.img||it.img,genres:f.genres.length?f.genres:it.genres});else it.title=mClean(it.title);if(it.st==='done'&&it.total)it.prog=it.total;return it}

const MSVG=p=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
function mAdd(k){const canSer=k==='anime'||k==='manga';let ser=canSer&&LS.get('maser')==='1';
  openSheet('add '+MK[k].label,`<div class="ma-search">${MSVG('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>')}<input id="msQ" placeholder="Search ${k==='anime'||k==='manga'?'AniList / MyAnimeList':k==='books'?'Open Library':'films & series'}" autocomplete="off" enterkeyhint="search"></div>
  ${canSer?`<div class="tes-seg ma-mode" id="msMode" style="grid-template-columns:1fr 1fr"><button type="button" data-mode="0" aria-pressed="${!ser}">Single ${k==='anime'?'season':'entry'}</button><button type="button" data-mode="1" aria-pressed="${ser}">Whole series</button></div><div class="ma-hint" id="msHint"${ser?'':' hidden'}>Pick any season — every season is pulled in and logged as one entry with a single rating.</div>`:''}
  <div class="msres" id="msRes"><div class="ma-empty">Type a title to search.</div></div><button class="ma-manual" type="button" id="msManual">${MSVG('<path d="M12 5v14M5 12h14"/>')} Add manually</button>`);
  let t=null,last=[];const draw=()=>{$('msRes').innerHTML=last.map((x,i)=>`<button type="button" class="msr" data-i="${i}">${poster(x,'msp')}<span><b>${esc(x.title)}</b><span class="dim">${[x.year,x.kind,x.total?x.total+' '+MK[k].units:'',x.by].filter(Boolean).map(esc).join(' · ')}</span></span>${!ser&&MEDIA[k].items[x.key]?'<span class="ma-in">In library</span>':ser?'<span class="ma-in s">Series</span>':MSVG('<path d="M12 5v14M5 12h14"/>').replace('<svg','<svg class="ma-plus"')}</button>`).join('')||'<div class="ma-empty">No results.</div>'};
  $('msQ').oninput=e=>{clearTimeout(t);const q=e.target.value;t=setTimeout(async()=>{const my=++mAdd.seq;$('msRes').innerHTML='<div class="ma-empty">Searching…</div>';const r=await msearch(k,q);if(my!==mAdd.seq||!$('msRes'))return;if(r===null){$('msRes').innerHTML=`<div class="ma-empty">Couldn’t reach the search sources (${esc(MSEARCH_ERR)}). Try again in a moment, or add manually.</div>`;return}last=r;draw()},350)};
  setTimeout(()=>$('msQ')&&$('msQ').focus(),200);
  if(canSer)$('msMode').onclick=e=>{const b=e.target.closest('[data-mode]');if(!b)return;ser=b.dataset.mode==='1';LS.set('maser',ser?'1':'0');$('msMode').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b));$('msHint').hidden=!ser;if(last.length)draw()};
  const mk=(x,key)=>{const it={...x,key,st:k==='movies'?'done':'plan',prog:0,rating:null,added:DAYK,upd:new Date().toISOString(),log:k==='movies'?[{d:DAYK,r:null,re:false}]:[],tags:[],fin:k==='movies'?DAYK:undefined};delete it.score;it.mal=x.score;return it};
  $('msRes').onclick=async e=>{const b=e.target.closest('[data-i]');if(!b||b.classList.contains('busy'))return;const x=last[+b.dataset.i];
    if(ser){b.classList.add('busy');b.querySelector('.ma-in').textContent='Building…';const f=await mFranchise(k,x);const key='ser'+(f?f.root:x.key);if(MEDIA[k].items[key])return mEntry(k,key);
      const it=mSeriesify(mk(x,key),f);MEDIA[k].items[key]=it;saveMedia(k);flash(f?'series_added_'+f.parts.length+'_parts':'series_added');return mEntry(k,key,true)}
    if(MEDIA[k].items[x.key])return mEntry(k,x.key);const it=mk(x,x.key);MEDIA[k].items[it.key]=it;saveMedia(k);flash('added');mEntry(k,it.key,true);menrich(k,it).then(()=>{const a=document.activeElement;if($('sheet').classList.contains('on')&&$('sheetTitle').textContent===it.title&&!(a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName)))mEntry(k,it.key)})};
  $('msManual').onclick=()=>{const title=($('msQ').value||'').trim()||'untitled';const it={key:'m'+rid(),src:'manual',title,img:'',st:'plan',prog:0,rating:null,added:DAYK,upd:new Date().toISOString(),log:[],tags:[],genres:[]};if(ser)mSeriesify(it,null);MEDIA[k].items[it.key]=it;saveMedia(k);mEntry(k,it.key,true)}}

/* ---- decimal rating control (score + slider, 0.5 steps by drag, any 0.1 by typing) ---- */
const RWORD=v=>['','Appalling','Horrible','Very bad','Bad','Average','Fine','Good','Very good','Great','Masterpiece'][Math.max(1,Math.min(10,Math.floor(+v)))];
const fmtR=v=>kgs(Math.round(+v*10)/10);
function rateCtl(id,v,sm){const has=v!=null&&v!=='';
  return `<div class="me-rate${sm?' sm':''}${has?'':' unset'}" data-rc="${id}" data-v="${has?+v:''}"><div class="me-rtop"><input class="me-rnum num" value="${has?fmtR(v):''}" placeholder="–" inputmode="decimal" aria-label="Score"><span class="me-rof">/10</span><span class="me-rw">${has?RWORD(v):'Not rated'}</span>${sm?'':`<button type="button" class="me-rclr" data-rate=""${has?'':' hidden'}>Clear</button>`}</div>
  <input type="range" class="me-slider" min="1" max="10" step="0.5" value="${has?v:5.5}" style="--p:${has?(+v-1)/9*100:0}%" aria-label="Rating"><div class="me-ticks">${[...Array(10)].map((_,i)=>`<span>${i+1}</span>`).join('')}</div></div>`}
function rateSync(box,v){const has=v!=null&&!isNaN(v);box.classList.toggle('unset',!has);box.dataset.v=has?v:'';const s=box.querySelector('.me-slider'),n=box.querySelector('.me-rnum'),c=box.querySelector('.me-rclr');
  if(has){s.value=v;if(document.activeElement!==n)n.value=fmtR(v)}else n.value='';s.style.setProperty('--p',(has?(v-1)/9*100:0)+'%');box.querySelector('.me-rw').textContent=has?RWORD(v):'Not rated';if(c)c.hidden=!has}
const rateVal=box=>box&&box.dataset.v!==''?+box.dataset.v:null;

/* ---- entry sheet ---- */
function mEntry(k,key,fresh){const it=MEDIA[k].items[key];if(!it)return;const max=MK[k].stars;const K=MK[k];
  const keep=$('sheet').classList.contains('on')&&mEntry.cur===key?$('sheetBody').scrollTop:0;mEntry.cur=key;
  const persist=()=>{it.upd=new Date().toISOString();saveMedia(k);if(cur==='media')renderMedia()};
  const SH={cur:K.ing,done:'Completed',plan:'Planned',hold:'On hold',drop:'Dropped'};const lg=it.log||[];
  const prog=+it.prog||0,pct=it.total?Math.min(100,Math.round(prog/it.total*100)):null;
  const src=it.src==='imdb'?'IMDb':it.src==='mal'?'MAL':it.src==='anilist'?'AniList':it.src==='kitsu'?'Kitsu':'Score';
  const stars5=[1,2,3,4,5].map(n=>{const r=+it.rating||0;const cls=r>=n?'full':r>=n-.5?'half':'';return `<span class="star5 ${cls}"><button type="button" data-rate="${n-.5}" aria-label="${n-.5} stars"></button><button type="button" data-rate="${n}" aria-label="${n} stars"></button></span>`}).join('');
  const sw=(id,on,l,sub)=>`<label class="me-row"><span class="me-l">${l}${sub?`<small>${sub}</small>`:''}</span><input type="checkbox" class="me-sw" id="${id}"${on?' checked':''}></label>`;
  const dateRow=(id,l,v)=>`<label class="me-row"><span class="me-l">${l}</span><span class="me-v${v?'':' none'}">${v?esc(nice(v)):'None'}</span><input type="date" class="me-in" id="${id}" value="${v||''}"></label>`;
  openSheet(it.title,`<div class="me">
  <div class="me-hero">${it.img?`<div class="me-bg" style="background-image:url('${esc(it.img)}')"></div>`:''}<div class="me-hrow">${poster(it,'me-poster')}<div class="me-hi">
    <span class="me-kind">${it.series?`Whole series${it.parts&&it.parts.length?' · '+it.parts.length+' parts':''}`:esc(it.kind||K.label)}</span><h3 class="me-title">${esc(it.title)}</h3>${it.alt&&it.alt!==it.title?`<span class="me-alt">${esc(it.alt)}</span>`:''}
    <span class="me-meta">${[it.year,it.total&&K.unit?it.total+' '+K.units:'',it.by].filter(Boolean).map(esc).join(' · ')}</span>
    ${it.genres&&it.genres.length?`<div class="me-gen">${it.genres.slice(0,5).map(g=>`<span>${esc(g)}</span>`).join('')}</div>`:''}
    <div class="me-pills">${it.mal?`<span class="me-pill">${src} <b class="num">${it.mal}</b></span>`:''}${it.url?`<a class="me-pill" href="${esc(it.url)}" target="_blank" rel="noopener">Open ↗</a>`:''}</div></div></div></div>
  <div class="me-seg" id="meSt">${MSTAT(k).map(([s])=>`<button type="button" data-st="${s}" aria-pressed="${it.st===s}">${esc(SH[s][0].toUpperCase()+SH[s].slice(1))}</button>`).join('')}</div>
  <div class="tes-lab">Your rating</div><div class="me-card me-pad">${max===10?rateCtl('meRate',it.rating):`<div class="me-stars"><div class="rates starrow">${stars5}</div>${it.rating!=null&&it.rating!==''?`<span class="me-rw">${kgs(it.rating)} / 5</span><button type="button" class="me-rclr" data-rate="">Clear</button>`:'<span class="me-rw">Not rated</span>'}</div>`}</div>
  ${K.unit?`<div class="tes-lab">Progress</div><div class="me-card me-pad"><div class="me-prow"><button class="me-step" type="button" data-pg="-1" aria-label="Minus one">−</button><div class="me-pv"><input class="num" id="mePg" value="${prog||''}" placeholder="0" inputmode="numeric" aria-label="Progress"><span>/</span><input class="num" id="meTot" value="${it.total||''}" placeholder="?" inputmode="numeric" aria-label="Total"></div><button class="me-step p" type="button" data-pg="1">+1</button></div>
    <div class="me-bar"><i style="width:${pct||0}%"></i></div><div class="me-psub"><span>${K.units}</span><span class="num">${pct!=null?pct+'%':''}</span></div></div>`:''}
  ${it.series&&it.parts&&it.parts.length?`<div class="tes-lab">Included <span class="num">${it.parts.length}</span></div><div class="me-card">${it.parts.map((p,i)=>`<div class="me-row me-part"><i class="num">${i+1}</i><span class="me-l">${esc(p.t)}<small>${[p.y,p.f].filter(Boolean).map(esc).join(' · ')}</small></span><span class="me-v num">${p.n?p.n+' '+(K.unit||''):''}</span></div>`).join('')}</div>`:''}
  <div class="tes-lab">Details</div><div class="me-card">${dateRow('meS','Started',it.start)}${dateRow('meF','Finished',it.fin)}${sw('meFav',it.fav,'Favourite')}${k==='anime'||k==='manga'?sw('meSer',it.series,'Whole series','One rating covering every season'):''}</div>
  <div class="tes-lab">Review</div><div class="me-card"><textarea class="me-ta" id="meRev" rows="4" placeholder="What did you think?">${esc(it.review||'')}</textarea><input class="me-tags" id="meTags" value="${esc((it.tags||[]).join(', '))}" placeholder="Tags, comma separated"></div>
  ${epBlock(k,it)}
  <div class="tes-lab">Diary <span class="num">${lg.length}</span></div><div class="me-card">${lg.map((l,i)=>`<div class="me-row"><span class="me-l">${esc(nice(l.d))}${l.re?`<small>re${K.verb}</small>`:''}</span><span class="me-v">${l.r!=null&&l.r!==''?stars(l.r,max):''}</span><button type="button" class="tes-clr" data-ldi="${i}" aria-label="Delete">${MSVG('<path d="M7 7l10 10M17 7L7 17"/>')}</button></div>`).join('')}
    ${dateRow('meLd','Date',DAYK)}${sw('meRe',lg.length,'Re'+K.verb)}<button type="button" class="tes-add" id="meLog">${MSVG('<path d="M12 5v14M5 12h14"/>')} Log ${K.verb==='watch'?'watched':'read'}</button></div>
  ${it.syn?`<details class="me-syn"><summary>Synopsis</summary><p>${esc(it.syn)}</p></details>`:''}
  <div class="tes-lab">Lists</div><div class="me-lists" id="meLists">${(MEDIA[k].lists||[]).map(l=>`<button type="button" data-li="${esc(l.id)}" aria-pressed="${l.keys.includes(key)}">${esc(l.name)}</button>`).join('')}<button type="button" data-li="new">+ New list</button></div>
  <div class="tes-foot"><button class="tes-del" type="button" id="meDel">Remove</button><span style="flex:1"></span><button class="btn p tes-save" type="button" id="meOk">Done</button></div></div>`);
  const sb=$('sheetBody');if(keep)sb.scrollTop=keep;
  ['mePg','meTot','meEpN'].forEach(id=>{const el=$(id);if(el)el.onfocus=()=>setTimeout(()=>el.select(),0)});
  sb.onclick=async e=>{const b=e.target.closest('button');if(!b)return;
    if(b.dataset.st){it.st=b.dataset.st;if(it.st==='cur'&&!it.start)it.start=DAYK;if(it.st==='done'){if(!it.fin)it.fin=DAYK;if(it.total)it.prog=it.total;if(!(it.log||[]).length)it.log=[{d:DAYK,r:it.rating,re:false}]}persist();mEntry(k,key);if(it.st==='done')flash('completed');return}
    if(b.dataset.rate!=null){it.rating=b.dataset.rate===''?null:+b.dataset.rate;if((it.log||[]).length)it.log[it.log.length-1].r=it.rating;persist();mEntry(k,key);return}
    if(b.dataset.pg){it.prog=Math.max(0,(+it.prog||0)+ +b.dataset.pg);if(it.total&&it.prog>=it.total){it.prog=+it.total;if(it.st!=='done'){it.st='done';it.fin=DAYK;it.log=[...(it.log||[]),{d:DAYK,r:it.rating,re:false}];flash('completed');burst(innerWidth/2,innerHeight/2,80)}}else if(it.st==='plan'||!it.st){it.st='cur';it.start=it.start||DAYK}persist();mEntry(k,key);return}
    if(b.id==='meLog'){const d=$('meLd').value||DAYK;it.log=[...(it.log||[]),{d,r:it.rating,re:$('meRe').checked}];if(it.st!=='done'){it.st='done';it.fin=it.fin||d}persist();flash('logged');mEntry(k,key);return}
    if(b.dataset.ldi!=null){it.log.splice(+b.dataset.ldi,1);persist();mEntry(k,key);return}
    if(b.dataset.li){if(b.dataset.li==='new'){const n=prompt('List name?');if(!n)return;MEDIA[k].lists=[...(MEDIA[k].lists||[]),{id:rid(),name:n.trim(),keys:[key]}]}else{const l=MEDIA[k].lists.find(x=>x.id===b.dataset.li);l.keys=l.keys.includes(key)?l.keys.filter(x=>x!==key):[...l.keys,key]}persist();mEntry(k,key);return}
    if(b.id==='meDel'){if(!b.dataset.arm){b.dataset.arm=1;b.classList.add('arm');b.textContent='Tap again to remove';return}delete MEDIA[k].items[key];(MEDIA[k].lists||[]).forEach(l=>l.keys=l.keys.filter(x=>x!==key));saveMedia(k);closeSheet();renderMedia();return}
    if(b.dataset.epo){const ep=(it.eps||{})[b.dataset.epo]||{};$('meEpN').value=b.dataset.epo;rateSync(sb.querySelector('[data-rc="meEpR"]'),ep.r==null||ep.r===''?null:+ep.r);$('meEpNote').value=ep.note||'';$('meEpN').scrollIntoView({block:'center',behavior:'smooth'});return}
    if(b.dataset.epd){if(!b.dataset.arm){b.dataset.arm=1;b.classList.add('arm');return}delete it.eps[b.dataset.epd];persist();mEntry(k,key);return}
    if(b.id==='meEpSave'){const n=parseInt($('meEpN').value);if(!(n>0)){flash('which_'+EPU(k));return}const r=rateVal(sb.querySelector('[data-rc="meEpR"]')),note=$('meEpNote').value.trim();
      it.eps={...(it.eps||{}),[n]:{r,note,d:((it.eps||{})[n]||{}).d||DAYK}};if(K.unit&&(+it.prog||0)<n&&(!it.total||n<=it.total)){it.prog=n;if(it.st==='plan'||!it.st){it.st='cur';it.start=it.start||DAYK}}persist();flash(EPU(k)+'_'+n+'_saved');mEntry(k,key);setTimeout(()=>{const el=$('meEpList');el&&el.scrollIntoView({block:'center'})},60);return}
    if(b.id==='meOk'){closeSheet()}};
  const toSer=async el=>{if(el.checked){const row=el.closest('.me-row');row.classList.add('busy');const f=await mFranchise(k,it);mSeriesify(it,f,true);flash(f?'series_'+f.parts.length+'_parts':'whole_series')}else{Object.assign(it,it.single||{title:mClean(it.title)});it.series=false;delete it.parts;delete it.single}persist();mEntry(k,key)};
  let tt=null;const deb=e=>{const id=e.target.id;clearTimeout(tt);tt=setTimeout(()=>{
    if(id==='mePg'){it.prog=+e.target.value||0;if(it.prog>0&&(it.st==='plan'||!it.st)){it.st='cur';it.start=it.start||DAYK}}if(id==='meTot'){it.total=+e.target.value||null}if(id==='meRev')it.review=e.target.value;
    if(id==='meTags')it.tags=e.target.value.split(',').map(x=>x.trim()).filter(Boolean);persist()},400)};
  sb.oninput=e=>{const t=e.target;if(t.classList.contains('me-slider')){rateSync(t.closest('.me-rate'),+t.value);return}if(t.classList.contains('me-rnum')||t.type==='checkbox'||t.type==='date'||t.id==='meEpN'||t.id==='meEpNote')return;deb(e)};
  sb.onchange=e=>{const t=e.target;
    if(t.classList.contains('me-slider')||t.classList.contains('me-rnum')){const box=t.closest('.me-rate');let v=t.classList.contains('me-rnum')?(t.value.trim()===''?null:parseFloat(t.value.replace(',','.'))):+t.value;if(v!=null)v=isNaN(v)?null:Math.min(10,Math.max(1,Math.round(v*10)/10));rateSync(box,v);
      if(box.dataset.rc==='meRate'){it.rating=v;if((it.log||[]).length)it.log[it.log.length-1].r=v;persist()}return}
    if(t.id==='meS'||t.id==='meF'){it[t.id==='meS'?'start':'fin']=t.value;persist();mEntry(k,key);return}
    if(t.id==='meLd'){const v=t.closest('.me-row').querySelector('.me-v');v.textContent=t.value?nice(t.value):'None';return}
    if(t.id==='meFav'){it.fav=t.checked;persist();return}
    if(t.id==='meSer'){toSer(t);return}
    if(t.id==='mePg'||t.id==='meTot'||t.id==='meRev'||t.id==='meTags')deb(e)}}

/* ---- per-episode / per-chapter ratings + notes ---- */
const EPU=k=>k==='anime'?'episode':'chapter';
function epBlock(k,it){if(k==='movies')return '';const U=EPU(k),eps=it.eps||{},ns=Object.keys(eps).map(Number).sort((a,b)=>b-a);const next=Math.max(1,+it.prog||1);
  return `<details class="me-det"${ns.length&&!it.series?' open':''}><summary class="tes-lab">${U} ratings <span class="num">${ns.length}</span></summary><div class="me-card me-pad">
  <div class="me-epn"><span>${U[0].toUpperCase()+U.slice(1)}</span><input class="num" id="meEpN" value="${next}" inputmode="numeric" aria-label="${U} number"></div>
  ${rateCtl('meEpR',null,true)}<textarea class="me-ta" id="meEpNote" rows="2" placeholder="Thoughts on this ${U}…"></textarea><div class="me-epsave"><button class="btn p tes-save" type="button" id="meEpSave">Save ${U}</button></div></div>
  <div class="me-card eplist" id="meEpList"${ns.length?'':' hidden'}>${ns.map(n=>{const e=eps[n];return `<div class="me-row"><button type="button" class="epmain" data-epo="${n}"><b class="num">${U==='episode'?'EP':'CH'} ${n}</b>${e.r!=null&&e.r!==''?`<span class="epr num">${fmtR(e.r)}</span>`:''}<span class="dim">${esc((e.note||'').slice(0,90))}${(e.note||'').length>90?'…':''}</span></button><button class="tes-clr" type="button" data-epd="${n}" aria-label="Delete">${MSVG('<path d="M7 7l10 10M17 7L7 17"/>')}</button></div>`}).join('')}</div></details>`}
/* ---- diary (Letterboxd style) ---- */
function mDiary(k){const rows=[];mItems(k).forEach(it=>(it.log||[]).forEach(l=>rows.push({it,l})));rows.sort((a,b)=>a.l.d<b.l.d?1:-1);const max=MK[k].stars;let lastM='';
  $('mBody').innerHTML=`<div class="mdiary">${rows.map(({it,l})=>{const m=l.d.slice(0,7);const head=m!==lastM?`<div class="mdm">${new Date(l.d+'T12:00').toLocaleDateString('en-GB',{month:'long',year:'numeric'})}</div>`:'';lastM=m;
    return head+`<button type="button" class="mdr" data-mkey="${esc(it.key)}"><span class="mdd num">${+l.d.slice(8)}</span>${poster(it,'msp')}<span class="mdt"><b>${esc(it.title)}</b><span class="dim">${esc(String(it.year||''))}</span></span><span>${l.r!=null&&l.r!==''?stars(l.r,max):''}</span><span class="dim">${l.re?'↻':''}${it.review?' ✎':''}${it.fav?' ♥':''}</span></button>`}).join('')||'<div class="dim">Your diary fills in as you log things you finish.</div>'}</div>`;
  $('mBody').onclick=e=>{const b=e.target.closest('[data-mkey]');if(b)mEntry(k,b.dataset.mkey)}}
/* ---- lists ---- */
function mLists(k){const L=MEDIA[k].lists||[];
  $('mBody').innerHTML=`<div class="row" style="justify-content:flex-end;margin-bottom:8px"><button class="iconbtn" type="button" id="mlNew">+ New list</button></div>${L.map(l=>`<div class="panel" style="margin-bottom:10px"><div class="ph"><span class="tag">${esc(l.name)} · ${l.keys.length}</span><span class="row" style="gap:6px"><button class="iconbtn" type="button" data-lren="${esc(l.id)}">Rename</button><button class="iconbtn" type="button" data-ldel="${esc(l.id)}">Delete</button></span></div><div class="pb"><div class="mgrid sm">${l.keys.map(x=>MEDIA[k].items[x]).filter(Boolean).map(it=>mCard(k,it)).join('')||'<span class="dim">Add titles to this list from their page.</span>'}</div></div></div>`).join('')||'<div class="dim">Make lists like “all-time top 10”, “comfort rewatches” or “2026 to-watch”.</div>'}`;
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
      ${yrLogs.length?`<div><span class="wrl">Busiest month</span><b class="wrs">${new Date(yr,bm,1).toLocaleDateString('en-GB',{month:'long'})}</b></div>`:''}
      ${re&&re.c>1?`<div><span class="wrl">most re${MK[k].verb==='watch'?'watched':'read'}</span><b class="wrs">${esc(re.it.title)} ×${re.c}</b></div>`:''}
    </div></div></div>`}
/* ---- stats ---- */
function mStats(k){const all=mItems(k);const done=all.filter(x=>x.st==='done');const max=MK[k].stars;const yr=new Date().getFullYear();
  const logs=all.flatMap(it=>(it.log||[]).map(l=>({it,l})));const thisYear=logs.filter(o=>o.l.d.startsWith(String(yr)));
  const rated=all.filter(x=>x.rating!=null&&x.rating!=='');const avg=rated.length?rated.reduce((a,x)=>a+ +x.rating,0)/rated.length:null;
  const buckets=max===10?[...Array(10)].map((_,i)=>i+1):[...Array(10)].map((_,i)=>(i+1)/2);const dist=buckets.map(b=>rated.filter(x=>(max===10?Math.floor(+x.rating):Math.floor(+x.rating*2)/2)===b).length);const dmx=Math.max(1,...dist);
  const genres={};done.concat(all.filter(x=>x.st==='cur')).forEach(x=>(x.genres||[]).forEach(g=>genres[g]=(genres[g]||0)+1));const gl=Object.entries(genres).sort((a,b)=>b[1]-a[1]).slice(0,10);const gmx=Math.max(1,...gl.map(x=>x[1]));
  const months=[...Array(12)].map((_,i)=>logs.filter(o=>o.l.d.startsWith(`${yr}-${pad(i+1)}`)).length);const mmx=Math.max(1,...months);
  const units=all.reduce((a,x)=>a+(+x.prog||0),0);const hours=k==='anime'?Math.round(all.reduce((a,x)=>a+(+x.prog||0)*(x.dur||24),0)/60):null;
  const W=mWrapped(k,all,logs,yr,genres,months);
  $('mBody').innerHTML=W+`<div class="statcards"><div><span class="dim">Completed</span><b class="num">${done.length}</b></div><div><span class="dim">in ${yr}</span><b class="num">${thisYear.length}</b></div><div><span class="dim">Avg rating</span><b class="num">${avg==null?'—':kgs(Math.round(avg*10)/10)}<small>${max===10?' /10':' ★'}</small></b></div>${MK[k].unit?`<div><span class="dim">${MK[k].units}</span><b class="num">${units.toLocaleString('en-GB')}</b></div>`:''}${hours!=null?`<div><span class="dim">Hours watched</span><b class="num">${hours}</b></div>`:''}<div><span class="dim">plan to ${MK[k].verb}</span><b class="num">${all.filter(x=>x.st==='plan').length}</b></div></div>
  <div class="statsplit"><div class="panel"><div class="ph"><span class="tag">${yr} by month</span></div><div class="pb"><div class="wkbars" style="grid-template-columns:repeat(12,1fr)">${months.map((v,i)=>`<div class="d"><span class="p num">${v||''}</span><div class="b" style="height:${v/mmx*100}%"></div><span class="l">${'jfmamjjasond'[i]}</span></div>`).join('')}</div></div></div>
  <div class="panel"><div class="ph"><span class="tag">Ratings</span><span class="dim">${rated.length} rated</span></div><div class="pb"><div class="wkbars" style="grid-template-columns:repeat(10,1fr)">${dist.map((v,i)=>`<div class="d"><span class="p num">${v||''}</span><div class="b" style="height:${v/dmx*100}%;background:var(--cyan)"></div><span class="l">${max===10?buckets[i]:(buckets[i]%1?'½':buckets[i])}</span></div>`).join('')}</div></div></div></div>
  <div class="panel" style="margin-top:12px"><div class="ph"><span class="tag">Top genres</span></div><div class="pb"><div class="mbars">${gl.map(([g,v])=>`<div><span>${esc(g)}</span><i style="--w:${v/gmx*100}%"></i><b class="num">${v}</b></div>`).join('')||'<span class="dim">Add a few titles to see your taste.</span>'}</div></div></div>`;
  $('mBody').onclick=e=>{const b=e.target.closest('[data-mkey]');if(b)mEntry(k,b.dataset.mkey)}}
initMediaNav();
