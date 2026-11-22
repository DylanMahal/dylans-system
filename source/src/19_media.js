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
/* typo-tolerant ranking: bigram similarity of the query against each title */
const mBig=s=>{s=' '+norm(s||'').replace(/[^a-z0-9]+/g,' ').trim()+' ';const m=new Map();for(let i=0;i<s.length-1;i++){const g=s.slice(i,i+2);m.set(g,(m.get(g)||0)+1)}return m};
const mSim=(a,b)=>{const A=mBig(a),B=mBig(b);let n=0,ta=0,tb=0;A.forEach(v=>ta+=v);B.forEach(v=>tb+=v);A.forEach((v,g)=>{n+=Math.min(v,B.get(g)||0)});return ta+tb?2*n/(ta+tb):0};
const mScore=(x,q)=>Math.max(mSim(x.title,q),mSim(x.alt,q),...String(x.title||'').split(/[:\-–]/).map(t=>mSim(t,q)));
async function msearch(k,q){q=q.trim();if(!q)return [];const r=await msearch1(k,q);
  if(k!=='manga'||(r&&r.length&&mScore(r[0],q)>=.6))return r;
  /* weak manga hit: probably a typo — ask the fuzzier sources in parallel and rank everything by closeness */
  const more=await Promise.all([MSRC.kitsu(k,q).catch(()=>[]),MSRC.jikan(k,q).catch(()=>[])]);const seen=new Set();
  const out=(r||[]).concat(...more).map(x=>({x,s:mScore(x,q)})).filter(o=>o.s>=.3).sort((a,b)=>b.s-a.s).map(o=>o.x).filter(x=>{const id=norm(x.title);if(seen.has(x.key)||seen.has(id))return false;seen.add(x.key);seen.add(id);return true});
  return out.length?out.slice(0,20):r}
async function msearch1(k,q){const errs=[];
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
/* library: one collapsible section per status (MyAniList style) instead of filter chips */
function mRow(k,it){const K=MK[k],max=K.stars,p=+it.prog||0;
  const sub=it.series&&it.parts&&it.parts.length?`Whole series · ${it.parts.length} parts`:k==='movies'?(it.kind==='series'?'Series':'Film')+(it.year?' · '+it.year:''):it.st==='cur'||(it.st==='hold'||it.st==='drop')&&p?`${p} / ${it.total||'?'} ${K.units}`:it.total===1&&it.kind?esc(it.kind[0].toUpperCase()+it.kind.slice(1)):it.total?`${it.total} ${K.units} total`:it.kind?esc(it.kind):'';
  const pr=it.total&&it.st!=='done'&&p?Math.min(100,p/it.total*100):null;
  return `<button type="button" class="mrow" data-mkey="${esc(it.key)}">${poster(it,'mrp')}<span class="mri"><b>${esc(it.title)}</b><span class="mrs">${sub}</span>${it.rating!=null&&it.rating!==''?`<span class="mrr">${max===10?'★ '+kgs(it.rating):stars(it.rating,max)}</span>`:''}${it.fav?'<span class="mrf">♥</span>':''}${pr!=null?`<span class="mrb"><i style="width:${pr}%"></i></span>`:''}</span></button>`}
function mLibrary(k){const all=mItems(k);const q=norm(MFILT.q||'');let shut={};try{shut=JSON.parse(LS.get('mshut')||'{}')}catch(e){}
  const list=all.filter(x=>!q||norm(x.title).includes(q)).sort((a,b)=>(b.upd||'')>(a.upd||'')?1:-1);
  const sec=MSTAT(k).map(([s,l])=>{const xs=list.filter(x=>(x.st||'plan')===s);if(!xs.length&&s!=='cur')return '';const open=q?true:!shut[k+s];
    return `<section class="msec${open?' open':''}"><button type="button" class="msh" data-sec="${s}"><span>${esc(l[0].toUpperCase()+l.slice(1))}</span><span class="num">${xs.length}</span>${MSVG('<path d="M9 6l6 6-6 6"/>')}</button>${open?`<div class="mrows">${xs.map(it=>mRow(k,it)).join('')||`<div class="dim mempty">Nothing ${esc(MK[k].ing)} right now.</div>`}</div>`:''}</section>`}).join('');
  $('mBody').innerHTML=`<div class="ma-search mlsearch">${MSVG('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>')}<input id="mQ" placeholder="Search your ${esc(MK[k].label)}" value="${esc(MFILT.q||'')}" autocomplete="off"></div>${all.length?sec:`<div class="dim mempty">Nothing here yet. Tap “+ add” to search.</div>`}`;
  const qi=$('mQ');qi.oninput=()=>{MFILT.q=qi.value;clearTimeout(mLibrary.t);mLibrary.t=setTimeout(()=>{mLibrary(k);const n=$('mQ');n.focus();n.setSelectionRange(n.value.length,n.value.length)},250)};
  $('mBody').onclick=e=>{const h=e.target.closest('[data-sec]');if(h){shut[k+h.dataset.sec]=!shut[k+h.dataset.sec];LS.set('mshut',JSON.stringify(shut));mLibrary(k);return}const b=e.target.closest('[data-mkey]');if(b)mEntry(k,b.dataset.mkey)}}

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

/* ---- offline anime index: instant, typo/case/punctuation-tolerant search (static/anidx.json) ---- */
const anorm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim();
const ASTOP=new Set(['x','the','no','of','a','to','wa','ga','s','and','in','on','tv']);
let ANIDX=null,ANIDXP=null,AVOC=[];
function aniLoad(){if(ANIDX)return Promise.resolve(ANIDX);if(!ANIDXP)ANIDXP=fetch('anidx.json').then(r=>{if(!r.ok)throw new Error(r.status);return r.json()}).then(a=>{const V=new Map();AVOC=[];
    const id=w=>{let i=V.get(w);if(i==null){i=AVOC.length;V.set(w,i);AVOC.push(w)}return i};
    return ANIDX=a.map(r=>({r,n:[r[2],...r[3]].map(s=>{const t=anorm(s),w=t.split(' ').filter(Boolean);return {s,c:t.replace(/ /g,''),w:w.map(id),k:w.filter(x=>!ASTOP.has(x)).length||1}})}))}).catch(e=>{ANIDXP=null;throw e});return ANIDXP}
/* optimal-string-alignment distance (a swap of two letters counts as one typo), bails out past m */
function alev(a,b,m){if(Math.abs(a.length-b.length)>m)return m+1;let p2=null,p=[...Array(b.length+1).keys()];for(let i=1;i<=a.length;i++){const c=[i];let lo=i;for(let j=1;j<=b.length;j++){let v=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])v=Math.min(v,p2[j-2]+1);c[j]=v;if(v<lo)lo=v}if(lo>m)return m+1;p2=p;p=c}return p[b.length]}
function atok(q,w){if(w===q)return 1;if(q.length>=2&&w.startsWith(q))return .92;if(q.length<4)return 0;const m=q.length>=7?2:1;if(w.length>q.length&&alev(q,w.slice(0,q.length),m)<=m)return .78;const e=alev(q,w,m);return e<=m?.86-.08*e:0}
function aniSearch(q,lim=20){q=anorm(q);if(!q||!ANIDX)return [];const qc=q.replace(/ /g,''),qw=q.split(' ').filter(Boolean);
  const M=aniSearch.m||(aniSearch.m=new Map());const S=qw.map(t=>{let a=M.get(t);if(!a){a=new Float32Array(AVOC.length);for(let i=0;i<AVOC.length;i++)a[i]=atok(t,AVOC[i]);if(M.size>60)M.clear();M.set(t,a)}return a});const out=[];
  for(const x of ANIDX){let best=0,bs='';for(const n of x.n){let s=0;
      if(n.c===qc)s=1.5;else if(qc.length>=2&&n.c.startsWith(qc))s=1.2+qc.length/n.c.length*.1;else if(qc.length>=4&&n.c.includes(qc))s=1;
      else{let tot=0,miss=0;const hit=new Set();for(const a of S){let b=0,bj=-1;n.w.forEach((w,j)=>{const v=hit.has(j)?a[w]*.5:a[w];if(v>b){b=v;bj=j}});if(!b)miss++;else hit.add(bj);tot+=b}
        if(miss&&(qw.length<3||miss>1))continue;let cov=0;hit.forEach(j=>{if(!ASTOP.has(AVOC[n.w[j]]))cov++});s=tot/qw.length*(miss?.8:1)*(.75+.25*Math.min(1,cov/n.k))}
      if(s>best){best=s;bs=n.s}}
    if(best>=.6)out.push({x,s:best+x.r[8]/200+(x.r[4]===0?.03:0)-((x.r[6]||2000)-1990)*.0005,t:bs})}
  out.sort((a,b)=>b.s-a.s);const K=['tv','movie','ona','ova','special'];
  return out.slice(0,lim).map(({x,t})=>{const r=x.r;return {key:r[0]?'mal'+r[0]:'al'+r[1],src:r[0]?'mal':'anilist',id:r[0]||r[1],al:r[1]||null,title:t.length<=5&&t!==r[2]?r[2]:t,alt:r[2],img:r[7]?`https://cdn.myanimelist.net/images/anime/${r[7]}l.jpg`:'',year:r[6]||null,total:r[5]||null,kind:K[r[4]],genres:[],score:r[8]||null,dur:24,url:r[0]?`https://myanimelist.net/anime/${r[0]}`:`https://anilist.co/anime/${r[1]}`}})}
/* fill in English title, genres, studio, synopsis for an anime picked from the offline index */
async function menrichAni(k,it){if(k!=='anime')return;try{const v=it.src==='mal'?{mal:+it.id}:{id:+it.id};
  const j=await mfetch('https://graphql.anilist.co',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({query:'query($id:Int,$mal:Int){Media(id:$id,idMal:$mal,type:ANIME){title{romaji english} coverImage{extraLarge large} genres episodes duration description(asHtml:false) studios(isMain:true){nodes{name}}}}',variables:v})},10000);
  const m=j.data&&j.data.Media,c=MEDIA[k].items[it.key];if(!m||!c)return;const t0=c.title;
  Object.assign(c,{title:c.series?c.title:(m.title.english||c.title),alt:c.series?c.alt:(m.title.romaji||c.alt),genres:m.genres||c.genres,syn:stripHtml(m.description)||c.syn,dur:m.duration||c.dur,by:((m.studios&&m.studios.nodes)||[]).map(x=>x.name).join(', ')||c.by,total:c.series?c.total:(m.episodes||c.total)});
  if(!c.img&&m.coverImage)c.img=m.coverImage.extraLarge||m.coverImage.large;saveMedia(k);return t0}catch(e){}}
const MSVG=p=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
function mAdd(k){const canSer=k==='anime'||k==='manga';let ser=canSer&&LS.get('maser')==='1';
  openSheet('add '+MK[k].label,`<div class="ma-search">${MSVG('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>')}<input id="msQ" placeholder="Search ${k==='anime'||k==='manga'?'AniList / MyAnimeList':k==='books'?'Open Library':'films & series'}" autocomplete="off" enterkeyhint="search"></div>
  ${canSer?`<div class="tes-seg ma-mode" id="msMode" style="grid-template-columns:1fr 1fr"><button type="button" data-mode="0" aria-pressed="${!ser}">Single ${k==='anime'?'season':'entry'}</button><button type="button" data-mode="1" aria-pressed="${ser}">Whole series</button></div><div class="ma-hint" id="msHint"${ser?'':' hidden'}>Pick any season — every season is pulled in and logged as one entry with a single rating.</div>`:''}
  <div class="msres" id="msRes"><div class="ma-empty">Type a title to search.</div></div><button class="ma-manual" type="button" id="msManual">${MSVG('<path d="M12 5v14M5 12h14"/>')} Add manually</button>`);
  let t=null,last=[];const draw=()=>{$('msRes').innerHTML=last.map((x,i)=>`<button type="button" class="msr" data-i="${i}">${poster(x,'msp')}<span><b>${esc(x.title)}</b>${x.alt&&anorm(x.alt)!==anorm(x.title)?`<span class="ma-alt">${esc(x.alt)}</span>`:''}<span class="dim">${[x.year,x.kind,x.total>1?x.total+' '+MK[k].units:'',x.by].filter(Boolean).map(esc).join(' · ')}</span></span>${!ser&&MEDIA[k].items[x.key]?'<span class="ma-in">In library</span>':ser?'<span class="ma-in s">Series</span>':MSVG('<path d="M12 5v14M5 12h14"/>').replace('<svg','<svg class="ma-plus"')}</button>`).join('')||'<div class="ma-empty">No results.</div>'};
  if(k==='anime')aniLoad().catch(()=>{});
  $('msQ').oninput=e=>{clearTimeout(t);const q=e.target.value;t=setTimeout(async()=>{const my=++mAdd.seq;if(!q.trim()){$('msRes').innerHTML='<div class="ma-empty">Type a title to search.</div>';return}
    if(k==='anime'){let ok=true;if(!ANIDX){$('msRes').innerHTML='<div class="ma-empty">Loading anime index…</div>';try{await aniLoad()}catch(x){ok=false}}
      if(ok){if(my!==mAdd.seq||!$('msRes'))return;last=aniSearch(q);draw();
        /* brand-new shows may not be in the index yet: top up from AniList without blocking */
        if(last.length<4&&q.trim().length>=3)MSRC.anilist(k,q.trim()).then(r=>{if(my!==mAdd.seq||!$('msRes'))return;const have=new Set(last.map(x=>x.key));r=r.filter(x=>!have.has(x.key));if(r.length){last=last.concat(r);draw()}}).catch(()=>{});return}}
    $('msRes').innerHTML='<div class="ma-empty">Searching…</div>';const r=await msearch(k,q);if(my!==mAdd.seq||!$('msRes'))return;if(r===null){$('msRes').innerHTML=`<div class="ma-empty">Couldn’t reach the search sources (${esc(MSEARCH_ERR)}). Try again in a moment, or add manually.</div>`;return}last=r;draw()},k==='anime'?90:350)};
  setTimeout(()=>$('msQ')&&$('msQ').focus(),200);
  if(canSer)$('msMode').onclick=e=>{const b=e.target.closest('[data-mode]');if(!b)return;ser=b.dataset.mode==='1';LS.set('maser',ser?'1':'0');$('msMode').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b));$('msHint').hidden=!ser;if(last.length)draw()};
  const mk=(x,key)=>{const it={...x,key,st:k==='movies'?'done':'plan',prog:0,rating:null,added:DAYK,upd:new Date().toISOString(),log:[],tags:[]};delete it.score;it.mal=x.score;return it};
  $('msRes').onclick=async e=>{const b=e.target.closest('[data-i]');if(!b||b.classList.contains('busy'))return;const x=last[+b.dataset.i];
    if(ser){b.classList.add('busy');b.querySelector('.ma-in').textContent='Building…';const f=await mFranchise(k,x);const key='ser'+(f?f.root:x.key);if(MEDIA[k].items[key])return mEntry(k,key);
      const it=mSeriesify(mk(x,key),f);MEDIA[k].items[key]=it;saveMedia(k);if(k==='anime')menrichAni(k,it);flash(f?'series_added_'+f.parts.length+'_parts':'series_added');return mEntry(k,key,true)}
    if(MEDIA[k].items[x.key])return mEntry(k,x.key);const it=mk(x,x.key);MEDIA[k].items[it.key]=it;saveMedia(k);flash('added');mEntry(k,it.key,true);(k==='anime'?menrichAni(k,it):menrich(k,it)).then(t0=>{const a=document.activeElement,st=$('sheetTitle').textContent;if($('sheet').classList.contains('on')&&(st===it.title||st===t0)&&!(a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName)))mEntry(k,it.key)})};
  $('msManual').onclick=()=>{const title=($('msQ').value||'').trim()||'untitled';const it={key:'m'+rid(),src:'manual',title,img:'',st:'plan',prog:0,rating:null,added:DAYK,upd:new Date().toISOString(),log:[],tags:[],genres:[]};if(ser)mSeriesify(it,null);MEDIA[k].items[it.key]=it;saveMedia(k);mEntry(k,it.key,true)}}

/* ---- decimal rating control (score + slider in 0.1 steps, or type it) ---- */
const RWORD=v=>['','Appalling','Horrible','Very bad','Bad','Average','Fine','Good','Very good','Great','Masterpiece'][Math.max(1,Math.min(10,Math.floor(+v)))];
const fmtR=v=>kgs(Math.round(+v*10)/10);
function rateCtl(id,v,sm){const has=v!=null&&v!=='';
  return `<div class="me-rate${sm?' sm':''}${has?'':' unset'}" data-rc="${id}" data-v="${has?+v:''}"><div class="me-rtop"><input class="me-rnum num" value="${has?fmtR(v):''}" placeholder="–" inputmode="decimal" aria-label="Score"><span class="me-rof">/10</span><span class="me-rw">${has?RWORD(v):'Not rated'}</span>${sm?'':`<button type="button" class="me-rclr" data-rate=""${has?'':' hidden'}>Clear</button>`}</div>
  <input type="range" class="me-slider" min="1" max="10" step="0.1" value="${has?v:5.5}" style="--p:${has?(+v-1)/9*100:0}%" aria-label="Rating"><div class="me-ticks">${[...Array(10)].map((_,i)=>`<span>${i+1}</span>`).join('')}</div></div>`}
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
    ${dateRow('meLd','Date','')}${sw('meRe',lg.length,'Re'+K.verb)}<button type="button" class="tes-add" id="meLog">${MSVG('<path d="M12 5v14M5 12h14"/>')} Log ${K.verb==='watch'?'watched':'read'}</button></div>
  ${it.syn?`<details class="me-syn"><summary>Synopsis</summary><p>${esc(it.syn)}</p></details>`:''}
  <div class="tes-lab">Lists</div><div class="me-lists" id="meLists">${(MEDIA[k].lists||[]).map(l=>`<button type="button" data-li="${esc(l.id)}" aria-pressed="${l.keys.includes(key)}">${esc(l.name)}</button>`).join('')}<button type="button" data-li="new">+ New list</button></div>
  <div class="tes-foot"><button class="tes-del" type="button" id="meDel">Remove</button><span style="flex:1"></span><button class="btn p tes-save" type="button" id="meOk">Done</button></div></div>`);
  const sb=$('sheetBody');if(keep)sb.scrollTop=keep;
  ['mePg','meTot','meEpN'].forEach(id=>{const el=$(id);if(el)el.onfocus=()=>setTimeout(()=>el.select(),0)});
  sb.onclick=async e=>{if(e.target.classList.contains('me-in')){try{e.target.showPicker()}catch(x){}return}const b=e.target.closest('button');if(!b)return;
    if(b.dataset.st){it.st=b.dataset.st;if(it.st==='done'&&it.total)it.prog=it.total;persist();mEntry(k,key);if(it.st==='done')flash('completed');return}
    if(b.dataset.rate!=null){it.rating=b.dataset.rate===''?null:+b.dataset.rate;if((it.log||[]).length)it.log[it.log.length-1].r=it.rating;persist();mEntry(k,key);return}
    if(b.dataset.pg){it.prog=Math.max(0,(+it.prog||0)+ +b.dataset.pg);if(it.total&&it.prog>=it.total){it.prog=+it.total;if(it.st!=='done'){it.st='done';flash('completed');burst(innerWidth/2,innerHeight/2,80)}}else if(it.st==='plan'||!it.st){it.st='cur'}persist();mEntry(k,key);return}
    if(b.id==='meLog'){const d=$('meLd').value;if(!d){flash('pick_a_date');try{$('meLd').showPicker()}catch(x){$('meLd').focus()}return}it.log=[...(it.log||[]),{d,r:it.rating,re:$('meRe').checked}];if(it.st!=='done'){it.st='done'}persist();flash('logged');mEntry(k,key);return}
    if(b.dataset.ldi!=null){it.log.splice(+b.dataset.ldi,1);persist();mEntry(k,key);return}
    if(b.dataset.li){if(b.dataset.li==='new'){const n=prompt('List name?');if(!n)return;MEDIA[k].lists=[...(MEDIA[k].lists||[]),{id:rid(),name:n.trim(),keys:[key]}]}else{const l=MEDIA[k].lists.find(x=>x.id===b.dataset.li);l.keys=l.keys.includes(key)?l.keys.filter(x=>x!==key):[...l.keys,key]}persist();mEntry(k,key);return}
    if(b.id==='meDel'){if(!b.dataset.arm){b.dataset.arm=1;b.classList.add('arm');b.textContent='Tap again to remove';return}delete MEDIA[k].items[key];(MEDIA[k].lists||[]).forEach(l=>l.keys=l.keys.filter(x=>x!==key));saveMedia(k);closeSheet();renderMedia();return}
    if(b.dataset.epo){const ep=(it.eps||{})[b.dataset.epo]||{};$('meEpN').value=b.dataset.epo;rateSync(sb.querySelector('[data-rc="meEpR"]'),ep.r==null||ep.r===''?null:+ep.r);$('meEpNote').value=ep.note||'';$('meEpN').scrollIntoView({block:'center',behavior:'smooth'});return}
    if(b.dataset.epd){if(!b.dataset.arm){b.dataset.arm=1;b.classList.add('arm');return}delete it.eps[b.dataset.epd];persist();mEntry(k,key);return}
    if(b.id==='meEpSave'){const n=parseInt($('meEpN').value);if(!(n>0)){flash('which_'+EPU(k));return}const r=rateVal(sb.querySelector('[data-rc="meEpR"]')),note=$('meEpNote').value.trim();
      it.eps={...(it.eps||{}),[n]:{r,note,d:((it.eps||{})[n]||{}).d||DAYK}};if(K.unit&&(+it.prog||0)<n&&(!it.total||n<=it.total)){it.prog=n;if(it.st==='plan'||!it.st){it.st='cur'}}persist();flash(EPU(k)+'_'+n+'_saved');mEntry(k,key);setTimeout(()=>{const el=$('meEpList');el&&el.scrollIntoView({block:'center'})},60);return}
    if(b.id==='meOk'){closeSheet()}};
  const toSer=async el=>{if(el.checked){const row=el.closest('.me-row');row.classList.add('busy');const f=await mFranchise(k,it);mSeriesify(it,f,true);flash(f?'series_'+f.parts.length+'_parts':'whole_series')}else{Object.assign(it,it.single||{title:mClean(it.title)});it.series=false;delete it.parts;delete it.single}persist();mEntry(k,key)};
  let tt=null;const deb=e=>{const id=e.target.id;clearTimeout(tt);tt=setTimeout(()=>{
    if(id==='mePg'){it.prog=+e.target.value||0;if(it.prog>0&&(it.st==='plan'||!it.st)){it.st='cur'}}if(id==='meTot'){it.total=+e.target.value||null}if(id==='meRev')it.review=e.target.value;
    if(id==='meTags')it.tags=e.target.value.split(',').map(x=>x.trim()).filter(Boolean);persist()},400)};
  const liveBar=()=>{const pv=+($('mePg')||{}).value||0,tv=+($('meTot')||{}).value||0,bar=sb.querySelector('.me-bar i'),pc=sb.querySelector('.me-psub .num');if(!bar)return;const x=tv?Math.min(100,Math.round(pv/tv*100)):0;bar.style.width=x+'%';if(pc)pc.textContent=tv?x+'%':''};
  const progDone=()=>{clearTimeout(tt);const pv=+$('mePg').value||0,tv=+$('meTot').value||0;it.total=tv||null;it.prog=pv;if(tv&&pv>=tv){it.prog=tv;if(it.st!=='done'){it.st='done';flash('completed')}}else if(pv>0&&(it.st==='plan'||!it.st))it.st='cur';persist();mEntry(k,key)};
  sb.onkeydown=e=>{if(e.key==='Enter'&&(e.target.id==='mePg'||e.target.id==='meTot')){e.preventDefault();e.target.blur()}};
  sb.oninput=e=>{const t=e.target;if(t.id==='mePg'||t.id==='meTot')liveBar();if(t.classList.contains('me-slider')){rateSync(t.closest('.me-rate'),+t.value);return}if(t.classList.contains('me-rnum')||t.type==='checkbox'||t.type==='date'||t.id==='meEpN'||t.id==='meEpNote')return;deb(e)};
  sb.onchange=e=>{const t=e.target;
    if(t.classList.contains('me-slider')||t.classList.contains('me-rnum')){const box=t.closest('.me-rate');let v=t.classList.contains('me-rnum')?(t.value.trim()===''?null:parseFloat(t.value.replace(',','.'))):+t.value;if(v!=null)v=isNaN(v)?null:Math.min(10,Math.max(1,Math.round(v*10)/10));rateSync(box,v);
      if(box.dataset.rc==='meRate'){it.rating=v;if((it.log||[]).length)it.log[it.log.length-1].r=v;persist()}return}
    if(t.id==='meS'||t.id==='meF'){it[t.id==='meS'?'start':'fin']=t.value;persist();mEntry(k,key);return}
    if(t.id==='meLd'){const v=t.closest('.me-row').querySelector('.me-v');v.textContent=t.value?nice(t.value):'None';return}
    if(t.id==='meFav'){it.fav=t.checked;persist();return}
    if(t.id==='meSer'){toSer(t);return}
    if(t.id==='mePg'||t.id==='meTot'){progDone();return}if(t.id==='meRev'||t.id==='meTags')deb(e)}}

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
/* an entry counts towards a year only if one of its dates falls in it (or it's being watched right now) */
const mInYr=(it,Y)=>[it.start,it.fin,...(it.log||[]).map(l=>l.d)].some(d=>(d||'').startsWith(Y))||(it.st==='cur'&&Y===String(new Date().getFullYear()));
const mFinYr=(it,Y)=>(it.fin||'').startsWith(Y)?it.fin:((it.log||[]).map(l=>l.d).find(d=>(d||'').startsWith(Y))||null);
const mFinD=it=>it.fin||((it.log||[]).map(l=>l.d).filter(Boolean).sort().pop())||null;
const mHas=v=>v!=null&&v!=='';
const mHrs=(k,xs,f=x=>+x.prog||0)=>k==='anime'?xs.reduce((a,x)=>a+f(x)*(x.dur||24),0)/60:null;
const MSC={cur:'#6ab8ff',done:'#5fe39a',plan:'#8e8e93',hold:'#ffb562',drop:'#ff6b81'};
const mTitle=s=>s[0].toUpperCase()+s.slice(1);

function mWrapped(k,ALL,yr){const max=MK[k].stars,K=MK[k],U=k==='movies'?null:EPU(k),Y=String(yr);
  const all=ALL.filter(it=>mInYr(it,Y)),fins=ALL.map(it=>({it,d:mFinYr(it,Y)})).filter(o=>o.d);
  const genres={};all.forEach(x=>(x.genres||[]).forEach(g=>genres[g]=(genres[g]||0)+1));const g=Object.entries(genres).sort((a,b)=>b[1]-a[1])[0];
  const months=[...Array(12)].map((_,i)=>fins.filter(o=>o.d.slice(5,7)===pad(i+1)).length),mmx=Math.max(1,...months),bm=months.indexOf(Math.max(...months));
  const top=all.filter(x=>mHas(x.rating)).sort((a,b)=>(+b.rating-+a.rating)||((b.fav?1:0)-(a.fav?1:0))).slice(0,5);
  const ep=U?ALL.flatMap(it=>Object.entries(it.eps||{}).filter(([n,e])=>mHas(e.r)&&(e.d||'').startsWith(Y)).map(([n,e])=>({it,n:+n,e}))).sort((a,b)=>b.e.r-a.e.r)[0]:null;
  const units=fins.reduce((a,o)=>a+(+o.it.total||+o.it.prog||0),0),hrs=mHrs(k,fins.map(o=>o.it),x=>+x.total||+x.prog||0);
  const rated=top.length?all.filter(x=>mHas(x.rating)):[],avg=rated.length?rated.reduce((a,x)=>a+ +x.rating,0)/rated.length:null;
  if(!all.length)return `<div class="wr2 empty"><span class="wr2-y">${yr}</span><b>Nothing logged for ${yr} yet</b><span>Add a Started or Finished date, or log a ${K.verb}, and it lands here.</span></div>`;
  return `<div class="wr2"><div class="wr2-hd"><span class="wr2-y">${yr}</span><b>${esc(mTitle(K.label))} Wrapped</b></div>
   <div class="wr2-big"><div><b class="num">${fins.length}</b><span>finished</span></div>${K.unit?`<div><b class="num">${units.toLocaleString('en-GB')}</b><span>${K.units}</span></div>`:''}${hrs!=null?`<div><b class="num">${Math.round(hrs)}</b><span>hours</span></div>`:`<div><b class="num">${all.length}</b><span>titles</span></div>`}</div>
   ${top.length?`<div class="wr2-l">Your top ${top.length}</div><div class="wr2-top">${top.map((it,i)=>`<button type="button" data-mkey="${esc(it.key)}">${poster(it,'wr2-p')}<i class="num">${i+1}</i><span class="wr2-s num">${max===10?kgs(it.rating):stars(it.rating,max)}</span><b>${esc(it.title)}</b></button>`).join('')}</div>`:''}
   <div class="wr2-facts">${g?`<div><span>Top genre</span><b>${esc(g[0])}</b></div>`:''}${fins.length?`<div><span>Busiest month</span><b>${new Date(yr,bm,1).toLocaleDateString('en-GB',{month:'long'})}</b></div>`:''}${avg!=null?`<div><span>Average score</span><b class="num">${kgs(Math.round(avg*10)/10)}${max===10?'':' ★'}</b></div>`:''}${ep?`<div><span>Best ${U}</span><b>${esc(ep.it.title)} · ${U==='episode'?'EP':'CH'} ${ep.n}</b></div>`:''}</div>
   ${fins.length?`<div class="wr2-l">Finished by month</div><div class="ms-cols m12">${months.map((v,i)=>`<div class="${i===bm&&v?'hi':''}"><span class="num">${v||''}</span><i style="height:${v?Math.max(6,v/mmx*100):3}%"></i><em>${'JFMAMJJASOND'[i]}</em></div>`).join('')}</div>`:''}</div>`}

function mStats(k){const all=mItems(k),K=MK[k],max=K.stars,now=new Date().getFullYear();
  const years=[];for(let y=now;y>=2026;y--)years.push(y);if(!years.length)years.push(now);if(!years.includes(mStats.yr))mStats.yr=years[0];
  const done=all.filter(x=>x.st==='done'),rated=all.filter(x=>mHas(x.rating)),avg=rated.length?rated.reduce((a,x)=>a+ +x.rating,0)/rated.length:null;
  const units=all.reduce((a,x)=>a+(+x.prog||0),0),hrs=mHrs(k,all);
  const buckets=max===10?[...Array(10)].map((_,i)=>i+1):[...Array(10)].map((_,i)=>(i+1)/2);
  const dist=buckets.map(b=>rated.filter(x=>(max===10?Math.floor(+x.rating):Math.floor(+x.rating*2)/2)===b).length),dmx=Math.max(1,...dist),dmode=dist.indexOf(Math.max(...dist));
  const st=MSTAT(k).map(([s,l])=>({s,l,n:all.filter(x=>(x.st||'plan')===s).length})).filter(o=>o.n);
  const genres={};done.concat(all.filter(x=>x.st==='cur')).forEach(x=>(x.genres||[]).forEach(g=>genres[g]=(genres[g]||0)+1));const gl=Object.entries(genres).sort((a,b)=>b[1]-a[1]).slice(0,8),gmx=Math.max(1,...gl.map(x=>x[1])),gtot=gl.reduce((a,x)=>a+x[1],0)||1;
  const top=rated.slice().sort((a,b)=>(+b.rating-+a.rating)||((b.fav?1:0)-(a.fav?1:0))).slice(0,10);
  const byYr={};done.forEach(x=>{const d=mFinD(x);if(d)byYr[d.slice(0,4)]=(byYr[d.slice(0,4)]||0)+1});const yk=Object.keys(byYr).sort().slice(-8),ymx=Math.max(1,...yk.map(y=>byYr[y]));
  const tile=(l,v,sub)=>`<div class="ms-tile"><span>${l}</span><b class="num">${v}</b>${sub?`<small>${sub}</small>`:''}</div>`;
  $('mBody').innerHTML=`<div class="ms">
  <div class="ms-hd"><b>Wrapped</b>${years.length>1?`<div class="ms-yrs">${years.map(y=>`<button type="button" data-wy="${y}" aria-pressed="${y===mStats.yr}">${y}</button>`).join('')}</div>`:''}</div>
  ${mWrapped(k,all,mStats.yr)}
  <div class="ms-hd"><b>All time</b></div>
  <div class="ms-tiles">${tile('Completed',done.length)}${tile('Mean score',avg==null?'–':kgs(Math.round(avg*100)/100),avg==null?'':max===10?'out of 10':'out of 5')}${K.unit?tile(mTitle(K.units),units.toLocaleString('en-GB')):''}${hrs!=null?tile('Days watched',(hrs/24).toFixed(1),Math.round(hrs)+' hours'):tile('In library',all.length)}</div>
  ${st.length?`<div class="ms-card"><div class="ms-ch"><b>Status</b><span>${all.length} total</span></div><div class="ms-stack">${st.map(o=>`<i style="flex:${o.n};background:${MSC[o.s]}"></i>`).join('')}</div><div class="ms-leg">${st.map(o=>`<span><i style="background:${MSC[o.s]}"></i>${esc(mTitle(o.l))}<b class="num">${o.n}</b></span>`).join('')}</div></div>`:''}
  <div class="ms-card"><div class="ms-ch"><b>Score distribution</b><span>${rated.length} rated</span></div>${rated.length?`<div class="ms-cols">${dist.map((v,i)=>`<div class="${i===dmode&&v?'hi':''}"><span class="num">${v||''}</span><i style="height:${v?Math.max(6,v/dmx*100):3}%"></i><em>${max===10?buckets[i]:(buckets[i]%1?'½':buckets[i])}</em></div>`).join('')}</div>`:`<div class="ms-none">Rate a few titles to see your curve.</div>`}</div>
  ${yk.length?`<div class="ms-card"><div class="ms-ch"><b>Finished per year</b><span>${done.length} completed</span></div><div class="ms-cols">${yk.map(y=>`<div class="${+y===now?'hi':''}"><span class="num">${byYr[y]}</span><i style="height:${Math.max(6,byYr[y]/ymx*100)}%"></i><em>${y}</em></div>`).join('')}</div></div>`:''}
  <div class="ms-card"><div class="ms-ch"><b>Top genres</b></div>${gl.length?`<div class="ms-hbars">${gl.map(([g,v])=>`<div><span>${esc(g)}</span><div><i style="width:${v/gmx*100}%"></i></div><b class="num">${Math.round(v/gtot*100)}%</b></div>`).join('')}</div>`:`<div class="ms-none">Add a few titles to see your taste.</div>`}</div>
  ${top.length?`<div class="ms-card ms-list"><div class="ms-ch"><b>Highest rated</b></div>${top.map((it,i)=>`<button type="button" data-mkey="${esc(it.key)}"><i class="num">${i+1}</i>${poster(it,'msp')}<span><b>${esc(it.title)}</b><small>${[it.year,it.series?'whole series':it.kind].filter(Boolean).map(esc).join(' · ')}</small></span><em class="num">${max===10?kgs(it.rating):stars(it.rating,max)}</em></button>`).join('')}</div>`:''}
  </div>`;
  $('mBody').onclick=e=>{const y=e.target.closest('[data-wy]');if(y){mStats.yr=+y.dataset.wy;mStats(k);return}const b=e.target.closest('[data-mkey]');if(b)mEntry(k,b.dataset.mkey)}}
initMediaNav();
