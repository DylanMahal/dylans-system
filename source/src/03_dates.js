/* ================= DATES ================= */
const DOW=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const pad=n=>String(n).padStart(2,'0');
const logical=(d=new Date())=>new Date(d.getTime()-5*3600e3);
const ymd=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
function isoWeek(d){const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const dn=t.getUTCDay()||7;t.setUTCDate(t.getUTCDate()+4-dn);const y=t.getUTCFullYear();const w=Math.ceil(((t-Date.UTC(y,0,1))/864e5+1)/7);return `${y}-W${pad(w)}`}
const mins=d=>d.getHours()*60+d.getMinutes();
const parseT=s=>{const m=String(s||'').match(/^(\d{1,2}):(\d{2})/);return m?(+m[1])*60+(+m[2]):null};
const fmtM=m=>pad(Math.floor(m/60)%24)+':'+pad(m%60);
const addDays=(s,n)=>{const d=new Date(s+'T12:00');d.setDate(d.getDate()+n);return ymd(d)};
const nice=s=>new Date(s+'T12:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});

