/* ================= MONEY ================= */
const CATC={'Investment & Savings':'#ff2a6d','Personal & Other':'#ffb000','Stack':'#57f5a8','Food':'#e6e6e6','Subscriptions':'#05d9e8','Cat':'#b18cff'};
let billCat=null;
function renderMoney(){
  const I=M.inc;
  $('moneyKv').innerHTML=[['take-home',gbp(I.take),`${I.hours} h · ${gbp(M.rate,2)}/h`,'',true],['outgoings',gbp(M.out),'savings included',''],['left over',gbp(M.left),M.left<0?'budgeted more than you earn':'not yet allocated',M.left<0?'bad':'ok'],['spending',gbp(M.spend),`${Math.round(M.spend/I.take*100)}% of take-home · ${Math.round(M.save/I.take*100)}% saved`,'']]
    .map(([k,v,s,c,ed])=>`<div class="panel"><div class="ph"><span class="tag">${k}</span>${ed?'<button class="ed" type="button" id="incEd">✎</button>':''}</div><div class="pb"><span class="v num ${c}" data-scr="${esc(v)}">${v}</span><span class="s">${s}</span></div></div>`).join('');
  $('incEd').onclick=editIncome;
  const cats=Object.entries(M.cats).map(([cat,m])=>({cat,m})).sort((a,b)=>b.m-a.m);const mx=cats[0].m||1;
  $('cats').innerHTML=cats.map(c=>{const n=Math.max(1,Math.round(c.m/mx*44));return `<div class="cat${billCat===c.cat?' sel':''}" data-c="${esc(c.cat)}" role="button" tabindex="0"><span class="nm">${esc(c.cat==='Investment & Savings'?'savings':c.cat.toLowerCase())}</span><span class="bars"><i style="width:${(c.m/mx*100).toFixed(1)}%;background:${CATC[c.cat]}"></i></span><span class="co num">${gbp(c.m,2)}</span><span class="hr num">${M.rate?(c.m/M.rate).toFixed(1):0}h</span></div>`}).join('');
  if(billCat==='Stack'){$('billsTitle').textContent='stack';$('billsTot').textContent=gbp(M.stackBudget,2)+'/mo';$('bills').innerHTML='<div class="dim">Itemised on the stack view. <button class="iconbtn" type="button" id="goStack">open /stack</button></div>';$('goStack').onclick=()=>go('stack');$('addBill').style.visibility='hidden'}
  else{$('addBill').style.visibility='';
    const list=M.expenses.filter(e=>e.name!=='x'&&(billCat?e.cat===billCat:e.cat!=='Investment & Savings')).sort((a,b)=>b.m-a.m);
    $('billsTitle').textContent=billCat?billCat.toLowerCase():'every bill';$('billsTot').textContent=gbp(list.filter(e=>e.inb!==false).reduce((s,e)=>s+(e.m||0),0),2)+'/mo';
    $('bills').innerHTML=list.map(billRow).join('')}
  const sv=M.expenses.filter(e=>e.cat==='Investment & Savings').sort((a,b)=>b.m-a.m);
  $('saveTot').textContent=gbp(M.save,2)+'/mo';
  $('saves').innerHTML=sv.map(billRow).join('')+`<div class="dim" style="font-size:12px;margin-top:8px">Yearly deposits are shown as their monthly share.</div>`;
  $('rateLbl').textContent=gbp(M.rate,2)+'/h take-home';calc();renderActuals();
}
function billRow(e){return `<div class="bill"><span>${esc(e.name)}${e.edited?'<span class="delta">Δ</span>':''}${e.inb===false?' <span class="dim" style="font-size:11px">(not in budget)</span>':''}<br><span class="s">${esc([e.prov&&e.prov!=='x'?e.prov:null,e.freq&&e.freq!=='x'?e.freq:null,e.day?'on the '+e.day:null,e.notes].filter(Boolean).join(' · '))}</span></span><span class="s num">${e.y?gbp(e.y)+'/yr':''} <button class="ed" type="button" data-xe="${esc(e.key)}">✎</button></span><span class="co num">${e.m?gbp(e.m,2):'<span class="dim">—</span>'}</span></div>`}
function calc(){let v=parseFloat($('calcIn').value)||0;if($('calcCur').textContent==='$')v=usd2gbp(v);const h=M.rate?v/M.rate:0;$('calcOut').textContent=h>=1?`${h.toFixed(1)} h`:`${Math.round(h*60)} min`;$('calcNote').textContent=`That's ${(h/(M.inc.hours/21.7)).toFixed(2)} working days at your take-home rate.`}
$('calcIn').oninput=calc;$('avCur').onclick=()=>{const b=$('avCur');b.textContent=b.textContent==='£'?'$':'£';b.classList.toggle('usd');FXR.get()};$('calcCur').onclick=()=>{const b=$('calcCur');b.textContent=b.textContent==='£'?'$':'£';b.classList.toggle('usd');FXR.get().then(calc);calc()};
$('cats').onclick=e=>{const c=e.target.closest('.cat');if(!c)return;billCat=billCat===c.dataset.c?null:c.dataset.c;renderMoney();glitchAll()};
$('cats').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.target.click()}};
document.getElementById('v-money').addEventListener('click',e=>{const b=e.target.closest('[data-xe]');if(b)editExp(M.expenses.find(x=>x.key===b.dataset.xe))});
$('addBill').onclick=()=>addExp(billCat&&billCat!=='Investment & Savings'?billCat:'Subscriptions');$('addSave').onclick=()=>addExp('Investment & Savings');


/* ---- actual vs budget, kept in the app (doc money/actuals: {months:{'YYYY-MM':{cat:amount}}}) ---- */
let ACT={months:{}},AVM=new Date().toISOString().slice(0,7);
async function loadActuals(){const d=await load('money/actuals');ACT={months:{},...(d||{})}}
watch('money/actuals',d=>{if(d){ACT={months:{},...d};if(!document.activeElement||!document.activeElement.closest||!document.activeElement.closest('#avBody'))renderActuals()}});
function avShift(n){const [y,m]=AVM.split('-').map(Number);const d=new Date(y,m-1+n,1);AVM=d.getFullYear()+'-'+pad(d.getMonth()+1);renderActuals()}
function renderActuals(){const el=$('avBody');if(!el||!M.cats)return;
  $('avMon').textContent=new Date(AVM+'-01T12:00').toLocaleDateString('en-GB',{month:'short',year:'numeric'}).toLowerCase();
  const cats=Object.entries(M.cats).filter(([c])=>c!=='Investment & Savings').sort((a,b)=>b[1]-a[1]);const mon=ACT.months[AVM]||{};
  const tb=cats.reduce((a,[,b])=>a+b,0),ta=cats.reduce((a,[c])=>a+(+mon[c]||0),0),logged=cats.some(([c])=>mon[c]!=null&&mon[c]!=='');
  const hist=[...Array(6)].map((_,i)=>{const [y,m]=AVM.split('-').map(Number);const d=new Date(y,m-6+i,1);const k=d.getFullYear()+'-'+pad(d.getMonth()+1);const mm=ACT.months[k]||{};return {k,a:cats.reduce((s,[c])=>s+(+mm[c]||0),0)}});const hmx=Math.max(tb,...hist.map(h=>h.a))||1;
  el.innerHTML=`<div class="av">${cats.map(([c,b])=>{const a=mon[c];const has=a!=null&&a!=='';const pct=has?Math.min(150,(+a)/(b||1)*100):0;const over=has&&+a>b;
    return `<div class="avr"><span class="avn">${esc(c==='Personal & Other'?'personal':c.toLowerCase())}</span><span class="avbar"><i class="${over?'over':''}" style="width:${Math.min(100,pct)}%;background:${over?'var(--bad)':CATC[c]||'var(--cyan)'}"></i></span><input class="inp num avin" data-avc="${esc(c)}" inputmode="decimal" placeholder="£${Math.round(b)}" value="${has?a:''}"><span class="avd num ${over?'bad':has?'ok':'dim'}">${has?(over?'+':'−')+gbp(Math.abs(+a-b),0):gbp(b,0)}</span></div>`}).join('')}
    <div class="avtot"><span>${logged?`spent <b class="num">${gbp(ta,0)}</b> of <b class="num">${gbp(tb,0)}</b> budgeted`:'type what you actually spent in each category this month'}</span>${logged?`<b class="num ${ta>tb?'bad':'ok'}">${ta>tb?'over by '+gbp(ta-tb,0):gbp(tb-ta,0)+' under'}</b>`:''}</div>
    <div class="avhist">${hist.map(h=>`<div class="${h.k===AVM?'on':''}"><span class="b" style="height:${h.a/hmx*100}%;${h.a>tb?'background:var(--bad)':''}"></span><span class="l">${new Date(h.k+'-01T12:00').toLocaleDateString('en-GB',{month:'short'}).toLowerCase()}</span></div>`).join('')}<i class="avline" style="bottom:${tb/hmx*100}%"></i></div></div>`;
  el.onchange=e=>{const c=e.target.dataset.avc;if(!c)return;const raw=e.target.value.replace(/[,\s]/g,'');const u=parseUsd(raw)??($('avCur').textContent==='$'&&raw!==''&&isFinite(+raw)?usd2gbp(+raw):null);if(u!=null){e.target.value=u;e.target.dispatchEvent(new Event('input',{bubbles:true}))}};
  el.oninput=e=>{const c=e.target.dataset.avc;if(!c||(e.isTrusted&&(/\$|usd/i.test(e.target.value)||$('avCur').textContent==='$')))return;const v=e.target.value.replace(/[£,\s]/g,'');ACT.months[AVM]={...(ACT.months[AVM]||{}),[c]:v===''?null:+v};clearTimeout(renderActuals.t);renderActuals.t=setTimeout(()=>{save('money/actuals',ACT);const f=document.activeElement&&document.activeElement.dataset.avc;renderActuals();if(f){const n=el.querySelector(`[data-avc="${CSS.escape(f)}"]`);if(n){n.focus();n.setSelectionRange(n.value.length,n.value.length)}}},700)}}
$('avPrev').onclick=()=>avShift(-1);$('avNext').onclick=()=>avShift(1);
