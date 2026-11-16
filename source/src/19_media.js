/* ================= MEDIA — anime · movies · manga · books (Letterboxd + MyAnimeList style) ================= */
const MK={anime:{label:'anime',verb:'watch',unit:'ep',units:'episodes',ing:'watching',stars:10,icon:'◐'},movies:{label:'movies',verb:'watch',unit:'',units:'',ing:'watching',stars:5,icon:'▶'},manga:{label:'manga',verb:'read',unit:'ch',units:'chapters',ing:'reading',stars:10,icon:'❏'},books:{label:'books',verb:'read',unit:'p',units:'pages',ing:'reading',stars:5,icon:'▤'}};
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
  el.innerHTML=`<div class="row" style="justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:10px"><div class="seg" id="mSeg">${tabs.map(([k,l])=>`<button type="button" data-mv="${k}" aria-pressed="${MEDIAV===k}">${l}</button>`).join('')}</div><button class="btn p" type="button" id="mAddBtn">+ add ${MK[MEDIAK].label==='movies'?'film':MK[MEDIAK].label==='books'?'book':MEDIAK}</button></div><div id="mBody"></div>`;
  $('mSeg').onclick=e=>{const b=e.target.closest('[data-mv]');if(b){MEDIAV=b.dataset.mv;renderMedia()}};$('mAddBtn').onclick=()=>mAdd(MEDIAK);
  ({library:mLibrary,diary:mDiary,lists:mLists,stats:mStats})[MEDIAV](MEDIAK)}
function initMediaNav(){$('mediaCards').onclick=e=>{const b=e.target.closest('[data-mk]');if(!b)return;MEDIAK=b.dataset.mk;LS.set('mediak',MEDIAK);renderMedia();staggerIn($('v-media-body'))}}

function poster(it,cls='mposter'){return it.img?`<img class="${cls}" src="${esc(it.img)}" alt="" loading="lazy">`:`<span class="${cls} ph">${esc((it.title||'?').slice(0,18))}</span>`}
function mCard(k,it){const max=MK[k].stars;const prog=it.total?Math.min(100,(it.prog||0)/it.total*100):null;
  return `<button type="button" class="mcard" data-mkey="${esc(it.key)}">${poster(it)}${it.fav?'<i class="mfav">♥</i>':''}<span class="mst st-${it.st}"></span>${it.rating!=null&&it.rating!==''?`<span class="mrate">${stars(it.rating,max)}</span>`:''}${prog!=null&&it.st!=='done'?`<span class="mbar"><i style="width:${prog}%"></i></span>`:''}<span class="mt">${esc(it.title)}</span></button>`}
function mLibrary(k){const all=mItems(k);const fav=all.filter(x=>x.fav).slice(0,4);const q=norm(MFILT.q);
  let list=all.filter(x=>(MFILT.st==='all'||x.st===MFILT.st)&&(!q||norm(x.title).includes(q)));
  const S={recent:(a,b)=>(b.upd||'')>(a.upd||'')?1:-1,rating:(a,b)=>(+b.rating||0)-(+a.rating||0),title:(a,b)=>a.title.localeCompare(b.title),year:(a,b)=>(+b.year||0)-(+a.year||0)};list.sort(S[MFILT.sort]||S.recent);
  const cnt=s=>all.filter(x=>s==='all'||x.st===s).length;
  $('mBody').innerHTML=`${fav.length?`<div class="tag" style="margin-bottom:6px">favourites</div><div class="mfavs">${fav.map(it=>mCard(k,it)).join('')}</div>`:''}
  <div class="row" style="gap:6px;flex-wrap:wrap;margin:10px 0"><div class="chips" id="mSt" style="margin:0">${[['all','all']].concat(MSTAT(k)).map(([s,l])=>`<button class="chip" type="button" data-st="${s}" aria-pressed="${MFILT.st===s}">${l} <span class="c">${cnt(s)}</span></button>`).join('')}</div></div>
  <div class="row" style="gap:6px;margin-bottom:10px"><select class="inp" id="mSort" style="flex:1">${[['recent','recently updated'],['rating','rating'],['title','title'],['year','year']].map(([v,l])=>`<option value="${v}" ${MFILT.sort===v?'selected':''}>${l}</option>`).join('')}</select></div>
  <div class="mgrid">${list.map(it=>mCard(k,it)).join('')||`<div class="dim mempty">Nothing here yet. Tap “+ add” to search.</div>`}</div>`;
  $('mSt').onclick=e=>{const b=e.target.closest('[data-st]');if(b){MFILT.st=b.dataset.st;mLibrary(k)}};$('mSort').onchange=e=>{MFILT.sort=e.target.value;mLibrary(k)};
  $('mBody').onclick=e=>{const b=e.target.closest('[data-mkey]');if(b)mEntry(k,b.dataset.mkey)}}

/* ---- add (search) ---- */
mAdd.seq=0;
function mAdd(k){openSheet('add '+MK[k].label,`<input class="inp" id="msQ" placeholder="search ${k==='anime'||k==='manga'?'AniList / MyAnimeList':k==='books'?'Open Library':'films & series'}…" autocomplete="off" style="margin-bottom:10px"><div class="msres" id="msRes"><div class="dim">Type a title.</div></div><button class="iconbtn" type="button" id="msManual" style="margin-top:10px">+ add manually</button>`);
  let t=null,last=[];$('msQ').oninput=e=>{clearTimeout(t);const q=e.target.value;t=setTimeout(async()=>{const my=++mAdd.seq;$('msRes').innerHTML='<div class="dim">searching…</div>';const r=await msearch(k,q);if(my!==mAdd.seq||!$('msRes'))return;if(r===null){$('msRes').innerHTML=`<div class="dim">Couldn’t reach the search sources (${esc(MSEARCH_ERR)}). Try again in a moment, or use “add manually”.</div>`;return}last=r;
    $('msRes').innerHTML=r.map((x,i)=>`<button type="button" class="msr" data-i="${i}">${poster(x,'msp')}<span><b>${esc(x.title)}</b><span class="dim">${[x.year,x.kind,x.total?x.total+' '+MK[k].units:'',x.by].filter(Boolean).map(esc).join(' · ')}</span></span>${MEDIA[k].items[x.key]?'<span class="chipy">in library</span>':''}</button>`).join('')||'<div class="dim">No results.</div>'},350)};
  setTimeout(()=>$('msQ')&&$('msQ').focus(),200);
  $('msRes').onclick=e=>{const b=e.target.closest('[data-i]');if(!b)return;const x=last[+b.dataset.i];if(MEDIA[k].items[x.key])return mEntry(k,x.key);const it={...x,st:k==='movies'?'done':'plan',prog:0,rating:null,added:DAYK,upd:new Date().toISOString(),log:k==='movies'?[{d:DAYK,r:null,re:false}]:[],tags:[],fin:k==='movies'?DAYK:undefined};delete it.score;it.mal=x.score;MEDIA[k].items[it.key]=it;saveMedia(k);flash('added');mEntry(k,it.key,true);menrich(k,it).then(()=>{const a=document.activeElement;if($('sheet').classList.contains('on')&&$('sheetTitle').textContent===it.title&&!(a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName)))mEntry(k,it.key)})};
  $('msManual').onclick=()=>{const title=($('msQ').value||'').trim()||'untitled';const it={key:'m'+rid(),src:'manual',title,img:'',st:'plan',prog:0,rating:null,added:DAYK,upd:new Date().toISOString(),log:[],tags:[],genres:[]};MEDIA[k].items[it.key]=it;saveMedia(k);mEntry(k,it.key,true)}}

/* ---- entry sheet ---- */
function mEntry(k,key,fresh){const it=MEDIA[k].items[key];if(!it)return;const max=MK[k].stars;const K=MK[k];
  const persist=()=>{it.upd=new Date().toISOString();saveMedia(k);if(cur==='media')renderMedia()};
  const rateBtns=max===10?[...Array(10)].map((_,i)=>`<button type="button" class="rb${+it.rating===i+1?' on':''}" data-rate="${i+1}">${i+1}</button>`).join(''):[1,2,3,4,5].map(n=>{const r=+it.rating||0;const cls=r>=n?'full':r>=n-.5?'half':'';return `<span class="star5 ${cls}"><button type="button" data-rate="${n-.5}" aria-label="${n-.5} stars"></button><button type="button" data-rate="${n}" aria-label="${n} stars"></button></span>`}).join('');
  openSheet(it.title,`<div class="mhero">${poster(it,'mbig')}<div class="mhi"><b>${esc(it.title)}</b>${it.alt&&it.alt!==it.title?`<span class="dim">${esc(it.alt)}</span>`:''}<span class="dim">${[it.year,it.kind,it.by].filter(Boolean).map(esc).join(' · ')}</span>${it.genres&&it.genres.length?`<div class="chips" style="margin:6px 0 0">${it.genres.slice(0,6).map(g=>`<span class="chipy">${esc(g)}</span>`).join('')}</div>`:''}${it.mal?`<span class="dim">${it.src==='imdb'?'IMDb':it.src==='mal'?'MAL':it.src==='anilist'?'AniList':it.src==='kitsu'?'Kitsu':'score'} ${it.mal}/10</span>`:''}${it.url?`<a class="iconbtn" href="${esc(it.url)}" target="_blank" rel="noopener" style="width:fit-content;margin-top:6px">open ↗</a>`:''}</div></div>
  <div class="tag" style="margin:12px 0 6px">status</div><div class="chips" id="meSt">${MSTAT(k).map(([s,l])=>`<button class="chip" type="button" data-st="${s}" aria-pressed="${it.st===s}">${l}</button>`).join('')}</div>
  <div class="tag" style="margin:6px 0 6px">your rating ${max===10?'/ 10':''}</div><div class="rates${max===10?'':' starrow'}" id="meRate">${rateBtns}<button type="button" class="iconbtn" data-rate="">clear</button></div>
  ${K.unit?`<div class="tag" style="margin:12px 0 6px">progress</div><div class="row" style="gap:8px;align-items:center"><button class="btn" type="button" data-pg="-1">−</button><input class="inp num" id="mePg" value="${it.prog||0}" inputmode="numeric" style="width:80px;text-align:center"><span class="dim">/ <input class="inp num" id="meTot" value="${it.total||''}" placeholder="?" inputmode="numeric" style="width:70px;display:inline-block"> ${K.units}</span><button class="btn p" type="button" data-pg="1">+1</button></div>`:''}
  <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:12px"><label class="dim">started<input class="inp" type="date" id="meS" value="${it.start||''}"></label><label class="dim">finished<input class="inp" type="date" id="meF" value="${it.fin||''}"></label><label class="dim" style="display:flex;gap:6px;align-items:center;margin-top:18px"><input type="checkbox" id="meFav" ${it.fav?'checked':''} style="width:auto;display:inline"> favourite</label></div>
  <div class="tag" style="margin:12px 0 6px">review</div><textarea class="inp" id="meRev" rows="4" placeholder="what did you think?">${esc(it.review||'')}</textarea>
  <label class="dim">tags (comma separated)<input class="inp" id="meTags" value="${esc((it.tags||[]).join(', '))}"></label>
  ${epBlock(k,it)}
  <div class="tag" style="margin:14px 0 6px">diary · ${(it.log||[]).length} ${K.verb==='watch'?'watch':'read'}${(it.log||[]).length===1?'':'es'}</div>
  <div class="row" style="gap:8px;flex-wrap:wrap;align-items:end"><label class="dim">date<input class="inp" type="date" id="meLd" value="${DAYK}"></label><label class="dim" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="meRe" ${(it.log||[]).length?'checked':''} style="width:auto;display:inline"> re${K.verb}</label><button class="btn" type="button" id="meLog">log ${K.verb==='watch'?'watched':'read'}</button></div>
  <div class="hsets" style="margin-top:8px">${(it.log||[]).map((l,i)=>`<span class="set">${esc(nice(l.d).toLowerCase())}${l.re?' ↻':''}${l.r!=null&&l.r!==''?' · '+stars(l.r,max):''} <button class="iconbtn" type="button" data-ldi="${i}" style="padding:0 4px">✕</button></span>`).join('')}</div>
  ${it.syn?`<details style="margin-top:12px"><summary class="dim">synopsis</summary><p style="font-size:13px;line-height:1.55">${esc(it.syn)}</p></details>`:''}
  <div class="tag" style="margin:14px 0 6px">lists</div><div class="chips" id="meLists">${(MEDIA[k].lists||[]).map(l=>`<button class="chip" type="button" data-li="${esc(l.id)}" aria-pressed="${l.keys.includes(key)}">${esc(l.name)}</button>`).join('')}<button class="chip" type="button" data-li="new">+ new list</button></div>
  <div class="bigbtns" style="margin-top:14px"><button class="btn d" type="button" id="meDel">remove</button><span style="flex:1"></span><button class="btn p" type="button" id="meOk">done</button></div>`);
  const sb=$('sheetBody');
  sb.onclick=e=>{const b=e.target.closest('button');if(!b)return;
    if(b.dataset.st){it.st=b.dataset.st;if(it.st==='cur'&&!it.start)it.start=DAYK;if(it.st==='done'){if(!it.fin)it.fin=DAYK;if(it.total)it.prog=it.total;if(!(it.log||[]).length&&k!=='anime'&&k!=='manga')it.log=[{d:DAYK,r:it.rating,re:false}];else if(!(it.log||[]).length)it.log=[{d:DAYK,r:it.rating,re:false}]}persist();mEntry(k,key);if(it.st==='done')flash('completed');return}
    if(b.dataset.rate!=null){it.rating=b.dataset.rate===''?null:+b.dataset.rate;if((it.log||[]).length)it.log[it.log.length-1].r=it.rating;persist();mEntry(k,key);return}
    if(b.dataset.pg){it.prog=Math.max(0,(+it.prog||0)+ +b.dataset.pg);if(it.total&&it.prog>=it.total){it.prog=+it.total;if(it.st!=='done'){it.st='done';it.fin=DAYK;it.log=[...(it.log||[]),{d:DAYK,r:it.rating,re:false}];flash('completed');burst(innerWidth/2,innerHeight/2,80)}}else if(it.st==='plan'||!it.st){it.st='cur';it.start=it.start||DAYK}persist();mEntry(k,key);return}
    if(b.id==='meLog'){it.log=[...(it.log||[]),{d:$('meLd').value||DAYK,r:it.rating,re:$('meRe').checked}];if(it.st!=='done'){it.st='done';it.fin=it.fin||$('meLd').value||DAYK}persist();flash('logged');mEntry(k,key);return}
    if(b.dataset.ldi!=null){it.log.splice(+b.dataset.ldi,1);persist();mEntry(k,key);return}
    if(b.dataset.li){if(b.dataset.li==='new'){const n=prompt('List name?');if(!n)return;MEDIA[k].lists=[...(MEDIA[k].lists||[]),{id:rid(),name:n.trim(),keys:[key]}]}else{const l=MEDIA[k].lists.find(x=>x.id===b.dataset.li);l.keys=l.keys.includes(key)?l.keys.filter(x=>x!==key):[...l.keys,key]}persist();mEntry(k,key);return}
    if(b.id==='meDel'){if(!b.dataset.arm){b.dataset.arm=1;b.textContent='tap again';return}delete MEDIA[k].items[key];(MEDIA[k].lists||[]).forEach(l=>l.keys=l.keys.filter(x=>x!==key));saveMedia(k);closeSheet();renderMedia();return}
    if(b.dataset.epr){$('meEpR').value=b.dataset.epr;sb.querySelectorAll('[data-epr]').forEach(x=>x.classList.toggle('on',x===b));return}
    if(b.dataset.epo){const e=(it.eps||{})[b.dataset.epo]||{};$('meEpN').value=b.dataset.epo;$('meEpR').value=e.r||'';$('meEpNote').value=e.note||'';sb.querySelectorAll('[data-epr]').forEach(x=>x.classList.toggle('on',+x.dataset.epr===+e.r));$('meEpN').scrollIntoView({block:'center',behavior:'smooth'});return}
    if(b.dataset.epd){if(!b.dataset.arm){b.dataset.arm=1;b.textContent='?';return}delete it.eps[b.dataset.epd];persist();mEntry(k,key);return}
    if(b.id==='meEpSave'){const n=parseInt($('meEpN').value);if(!(n>0)){flash('which_'+EPU(k));return}const r=$('meEpR').value===''?null:+$('meEpR').value,note=$('meEpNote').value.trim();
      it.eps={...(it.eps||{}),[n]:{r,note,d:((it.eps||{})[n]||{}).d||DAYK}};if(K.unit&&(+it.prog||0)<n&&(!it.total||n<=it.total)){it.prog=n;if(it.st==='plan'||!it.st){it.st='cur';it.start=it.start||DAYK}}persist();flash(EPU(k)+'_'+n+'_saved');mEntry(k,key);setTimeout(()=>{const el=$('meEpList');el&&el.scrollIntoView({block:'center'})},60);return}
    if(b.id==='meOk'){closeSheet()}};
  let tt=null;sb.oninput=e=>{const id=e.target.id;clearTimeout(tt);tt=setTimeout(()=>{
    if(id==='mePg'){it.prog=+e.target.value||0}if(id==='meTot'){it.total=+e.target.value||null}if(id==='meS')it.start=e.target.value;if(id==='meF')it.fin=e.target.value;if(id==='meRev')it.review=e.target.value;
    if(id==='meTags')it.tags=e.target.value.split(',').map(x=>x.trim()).filter(Boolean);if(id==='meFav')it.fav=e.target.checked;persist()},400)};sb.onchange=sb.oninput}

/* ---- per-episode / per-chapter ratings + notes ---- */
const EPU=k=>k==='anime'?'episode':'chapter';
function epBlock(k,it){if(k==='movies')return '';const U=EPU(k),eps=it.eps||{},ns=Object.keys(eps).map(Number).sort((a,b)=>b-a);const next=Math.max(1,+it.prog||1);
  return `<div class="tag" style="margin:14px 0 6px">${U}s · ${ns.length} rated</div>
  <div class="epbox"><div class="row" style="gap:8px;align-items:center;flex-wrap:wrap"><span class="dim">${U}</span><input class="inp num" id="meEpN" value="${next}" inputmode="numeric" style="width:72px;text-align:center"><input type="hidden" id="meEpR" value=""><div class="rates" style="flex:1">${[...Array(10)].map((_,i)=>`<button type="button" class="rb" data-epr="${i+1}">${i+1}</button>`).join('')}</div></div>
  <textarea class="inp" id="meEpNote" rows="2" placeholder="thoughts on this ${U}…" style="margin-top:8px"></textarea><div class="row" style="justify-content:flex-end;margin-top:6px"><button class="btn p" type="button" id="meEpSave">save ${U}</button></div></div>
  <div class="eplist" id="meEpList">${ns.map(n=>{const e=eps[n];return `<div class="eprow"><button type="button" class="epmain" data-epo="${n}"><b class="num">${U==='episode'?'EP':'CH'} ${n}</b>${e.r?`<span class="epr num">${e.r}/10</span>`:''}<span class="dim">${esc((e.note||'').slice(0,90))}${(e.note||'').length>90?'…':''}</span></button><button class="iconbtn" type="button" data-epd="${n}">✕</button></div>`}).join('')}</div>`}
/* ---- diary (Letterboxd style) ---- */
function mDiary(k){const rows=[];mItems(k).forEach(it=>(it.log||[]).forEach(l=>rows.push({it,l})));rows.sort((a,b)=>a.l.d<b.l.d?1:-1);const max=MK[k].stars;let lastM='';
  $('mBody').innerHTML=`<div class="mdiary">${rows.map(({it,l})=>{const m=l.d.slice(0,7);const head=m!==lastM?`<div class="mdm">${new Date(l.d+'T12:00').toLocaleDateString('en-GB',{month:'long',year:'numeric'})}</div>`:'';lastM=m;
    return head+`<button type="button" class="mdr" data-mkey="${esc(it.key)}"><span class="mdd num">${+l.d.slice(8)}</span>${poster(it,'msp')}<span class="mdt"><b>${esc(it.title)}</b><span class="dim">${esc(String(it.year||''))}</span></span><span>${l.r!=null&&l.r!==''?stars(l.r,max):''}</span><span class="dim">${l.re?'↻':''}${it.review?' ✎':''}${it.fav?' ♥':''}</span></button>`}).join('')||'<div class="dim">Your diary fills in as you log things you finish.</div>'}</div>`;
  $('mBody').onclick=e=>{const b=e.target.closest('[data-mkey]');if(b)mEntry(k,b.dataset.mkey)}}
/* ---- lists ---- */
function mLists(k){const L=MEDIA[k].lists||[];
  $('mBody').innerHTML=`<div class="row" style="justify-content:flex-end;margin-bottom:8px"><button class="iconbtn" type="button" id="mlNew">+ new list</button></div>${L.map(l=>`<div class="panel" style="margin-bottom:10px"><div class="ph"><span class="tag">${esc(l.name)} · ${l.keys.length}</span><span class="row" style="gap:6px"><button class="iconbtn" type="button" data-lren="${esc(l.id)}">rename</button><button class="iconbtn" type="button" data-ldel="${esc(l.id)}">delete</button></span></div><div class="pb"><div class="mgrid sm">${l.keys.map(x=>MEDIA[k].items[x]).filter(Boolean).map(it=>mCard(k,it)).join('')||'<span class="dim">Add titles to this list from their page.</span>'}</div></div></div>`).join('')||'<div class="dim">Make lists like “all-time top 10”, “comfort rewatches” or “2026 to-watch”.</div>'}`;
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
      ${yrLogs.length?`<div><span class="wrl">busiest month</span><b class="wrs">${new Date(yr,bm,1).toLocaleDateString('en-GB',{month:'long'}).toLowerCase()}</b></div>`:''}
      ${re&&re.c>1?`<div><span class="wrl">most re${MK[k].verb==='watch'?'watched':'read'}</span><b class="wrs">${esc(re.it.title)} ×${re.c}</b></div>`:''}
    </div></div></div>`}
/* ---- stats ---- */
function mStats(k){const all=mItems(k);const done=all.filter(x=>x.st==='done');const max=MK[k].stars;const yr=new Date().getFullYear();
  const logs=all.flatMap(it=>(it.log||[]).map(l=>({it,l})));const thisYear=logs.filter(o=>o.l.d.startsWith(String(yr)));
  const rated=all.filter(x=>x.rating!=null&&x.rating!=='');const avg=rated.length?rated.reduce((a,x)=>a+ +x.rating,0)/rated.length:null;
  const buckets=max===10?[...Array(10)].map((_,i)=>i+1):[...Array(10)].map((_,i)=>(i+1)/2);const dist=buckets.map(b=>rated.filter(x=>+x.rating===b).length);const dmx=Math.max(1,...dist);
  const genres={};done.concat(all.filter(x=>x.st==='cur')).forEach(x=>(x.genres||[]).forEach(g=>genres[g]=(genres[g]||0)+1));const gl=Object.entries(genres).sort((a,b)=>b[1]-a[1]).slice(0,10);const gmx=Math.max(1,...gl.map(x=>x[1]));
  const months=[...Array(12)].map((_,i)=>logs.filter(o=>o.l.d.startsWith(`${yr}-${pad(i+1)}`)).length);const mmx=Math.max(1,...months);
  const units=all.reduce((a,x)=>a+(+x.prog||0),0);const hours=k==='anime'?Math.round(all.reduce((a,x)=>a+(+x.prog||0)*(x.dur||24),0)/60):null;
  const W=mWrapped(k,all,logs,yr,genres,months);
  $('mBody').innerHTML=W+`<div class="statcards"><div><span class="dim">completed</span><b class="num">${done.length}</b></div><div><span class="dim">in ${yr}</span><b class="num">${thisYear.length}</b></div><div><span class="dim">avg rating</span><b class="num">${avg==null?'—':kgs(Math.round(avg*10)/10)}<small>${max===10?' /10':' ★'}</small></b></div>${MK[k].unit?`<div><span class="dim">${MK[k].units}</span><b class="num">${units.toLocaleString('en-GB')}</b></div>`:''}${hours!=null?`<div><span class="dim">hours watched</span><b class="num">${hours}</b></div>`:''}<div><span class="dim">plan to ${MK[k].verb}</span><b class="num">${all.filter(x=>x.st==='plan').length}</b></div></div>
  <div class="statsplit"><div class="panel"><div class="ph"><span class="tag">${yr} by month</span></div><div class="pb"><div class="wkbars" style="grid-template-columns:repeat(12,1fr)">${months.map((v,i)=>`<div class="d"><span class="p num">${v||''}</span><div class="b" style="height:${v/mmx*100}%"></div><span class="l">${'jfmamjjasond'[i]}</span></div>`).join('')}</div></div></div>
  <div class="panel"><div class="ph"><span class="tag">ratings</span><span class="dim">${rated.length} rated</span></div><div class="pb"><div class="wkbars" style="grid-template-columns:repeat(10,1fr)">${dist.map((v,i)=>`<div class="d"><span class="p num">${v||''}</span><div class="b" style="height:${v/dmx*100}%;background:var(--cyan)"></div><span class="l">${max===10?buckets[i]:(buckets[i]%1?'½':buckets[i])}</span></div>`).join('')}</div></div></div></div>
  <div class="panel" style="margin-top:12px"><div class="ph"><span class="tag">top genres</span></div><div class="pb"><div class="mbars">${gl.map(([g,v])=>`<div><span>${esc(g)}</span><i style="--w:${v/gmx*100}%"></i><b class="num">${v}</b></div>`).join('')||'<span class="dim">Add a few titles to see your taste.</span>'}</div></div></div>`;
  $('mBody').onclick=e=>{const b=e.target.closest('[data-mkey]');if(b)mEntry(k,b.dataset.mkey)}}
initMediaNav();
