/* ================= SHEET PARSER (raw Excel cells → model) ================= */
const p2=n=>String(n).padStart(2,'0');
const gc=(g,r,c)=>{const row=g&&g[r-1];if(!row)return null;const v=row[c-1];return v===undefined?null:v};
const ttl=s=>String(s).toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
const nn=v=>typeof v==='number'&&isFinite(v)?v:0;
function tv(v){if(typeof v==='number'&&v>=0&&v<1){const m=Math.round(v*1440);return p2(Math.floor(m/60)%24)+':'+p2(m%60)}return v===undefined?null:v}
function rowHas(g,r,x){const row=g[r-1]||[];return row.some(v=>v===x)}
function parseGrids(G){
  const out={stack:[],expenses:[],income:{},incRows:{},stackCatRows:{},expCatRows:{}};
  // Stack
  const S=G['Stack']||[];let cat=null;
  for(let r=5;r<=S.length;r++){const a=gc(S,r,1);
    if(a==='BUDGETED TOTAL'){out.stackTotalRow=r;continue}
    if(a==='Not in budget (optional)')continue;if(a==='If you bought everything')break;
    if(a&&rowHas(S,r,'Budgeted:')){cat=ttl(a);out.stackCatRows[cat]=r;continue}
    if(a===null||a===''||a===LX('hdr','#'))continue;
    out.stack.push({row:r,name:String(a).trim(),dose:gc(S,r,2),route:gc(S,r,3),sched:gc(S,r,4),notes:gc(S,r,7),price:gc(S,r,8),units:gc(S,r,9),perweek:gc(S,r,10),weekly:nn(gc(S,r,11)),monthly:nn(gc(S,r,12)),inb:gc(S,r,13)==='Yes',src:gc(S,r,14),cat});
  }
  // Expenses
  const E=G['Expenses']||[];cat=null;
  for(let r=5;r<=E.length;r++){const a=gc(E,r,1);
    if(a==='BUDGETED TOTAL'){out.expTotalRow=r;continue}
    if(a==='Not in budget (optional)')continue;if(a==='If you paid for everything')break;
    if(a&&rowHas(E,r,'Budgeted:')){cat=ttl(a);out.expCatRows[cat]=r;continue}
    if(a===null||a===''||a==='Expense')continue;
    const per=gc(E,r,7);
    out.expenses.push({row:r,name:String(a).trim(),prov:gc(E,r,2),freq:gc(E,r,3),day:gc(E,r,4),method:gc(E,r,5),notes:gc(E,r,6),per:typeof per==='number'?per:null,m:nn(gc(E,r,8)),y:nn(gc(E,r,9)),inb:gc(E,r,10)==='Yes',cat});
  }
  // Expenses Summary inputs
  const X=G['Expenses Summary']||[];
  for(let r=1;r<=X.length;r++){const a=gc(X,r,1);
    if(a==='Hours worked per month'){out.income['Hours worked per month']=gc(X,r,2);out.incRows.hours=r}
    if(a==='Take-home pay'){out.income['Take-home pay']=gc(X,r,2);out.incRows.take=r}}
  // Day plans
  const plan=g=>{const blocks=[],extra={},extraRows={};let sec=null;g=g||[];
    for(let r=4;r<=g.length;r++){const c=[];for(let k=1;k<=8;k++)c.push(tv(gc(g,r,k)));const c9=gc(g,r,9);
      if(c.every(x=>x===null||x==='')&&(c9===null||c9===''))continue;
      const restEmpty=c.slice(1).every(x=>x===null||x==='');
      if(c[0]!==null&&c[0]!==''&&restEmpty){const s=String(c[0]);
        if(s.includes('·')&&/^\d\d/.test(s)){blocks.push({title:s,row:r,items:[]});sec=null;continue}
        sec=s;extra[sec]=[];extraRows[sec]=r;continue}
      if(sec){extra[sec].push({row:r,cells:c});continue}
      if(!blocks.length)continue;
      blocks[blocks.length-1].items.push({row:r,time:c[0],item:c[1],type:c[2],dose:c[3],route:c[4],sched:c[5],notes:c[6],caution:c[7]});
    }
    return {blocks,extra,extraRows}};
  out.weekday=plan(G['Day Plan v2']);out.weekend=plan(G['Weekend Plan']);
  const t1=(G['Day Plan v2']||[])[0],t2=(G['Weekend Plan']||[])[0];
  out.weekdayTitle=(t1&&t1[0])||'Day Plan v2';out.weekendTitle=(t2&&t2[0])||'Weekend Plan';
  return out;
}
let GR={};let GMETA={at:null,mtime:null,src:'none'};
let D=parseGrids(GR);

const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const gbp=(n,d=0)=>(n<0?'−':'')+'£'+Math.abs(Number(n)||0).toLocaleString('en-GB',{minimumFractionDigits:d,maximumFractionDigits:d});
const norm=s=>String(s||'').trim().toLowerCase();
const LS={get(k){try{return JSON.parse(localStorage.getItem('ds3:'+k))}catch(e){return null}},set(k,v){try{localStorage.setItem('ds3:'+k,JSON.stringify(v))}catch(e){}}};
/* private word list: personal labels live in the account (kv sys/lex), never in this public code.
   LX(key,fallback) for values, LW(key,fallback) for UI words; [data-lx] elements are filled at boot. */
let LEX=LS.get('sys/lex')||{};
const LX=(k,d)=>LEX[k]!=null?LEX[k]:d,LW=(k,d)=>(LEX.w&&LEX.w[k])||d;
function applyLex(root){(root||document).querySelectorAll('[data-lx]').forEach(el=>{const v=LW(el.dataset.lx,null);if(v==null)return;if(el.dataset.lxa)el.setAttribute(el.dataset.lxa,v);else el.textContent=v})}
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const rid=()=>Math.random().toString(36).slice(2,8);
const isNum=v=>typeof v==='number'&&isFinite(v);

