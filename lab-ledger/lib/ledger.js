// כל המסכים של קופת המעבדה. נבנה מהתצוגה המקדימה שאושרה, ורץ בדפדפן בלבד.
import * as api from './api';

const KINDS={
 stock:{icon:"📦",name:"מלאי וחלקים",short:"קונים שוב ושוב",desc:"חלקים שמרכיבים אצל לקוחות (מסכים, סוללות, שקעים) ואביזרים למכירה. נכנסים למלאי, ויורדים ממנו בכל תיקון. זה כסף שחוזר אליך כשהחלק נמכר.",cats:["מסכים","סוללות","שקעים","חלקים אחרים","אביזרים למכירה","מתכלים"]},
 fixed:{icon:"🔁",name:"הוצאות קבועות",short:"כל חודש",desc:"תשלומים שחוזרים כל חודש בערך באותו סכום: שכירות, חשמל, אינטרנט, ביטוח, רואה חשבון. צריך לכסות אותם גם בחודש חלש.",cats:["שכירות","חשמל","אינטרנט וטלפון","ביטוח","רואה חשבון","אחר"]},
 other:{icon:"🧾",name:"הוצאות משתנות",short:"לפי הצורך",desc:"כל השאר: פרסום, משלוחים, כלים קטנים שנשחקים. משתנה מחודש לחודש.",cats:["פרסום","משלוחים","כלים קטנים","אחר"]},
 setup:{icon:"🛠",name:"השקעה בהקמה",short:"פעם אחת",desc:"דברים שקונים פעם אחת כדי לפתוח את המעבדה: מכשירים, ריהוט, כלים גדולים, שיפוץ. לא מורידים מהרווח החודשי, אלא נספרים ב\"החזר ההשקעה\".",cats:["מכשירים","ריהוט","כלים","שיפוץ","אחר"]},
};
const KORDER=["stock","fixed","other","setup"];
const IN_CATS=["תיקון מסך","סוללה","שקע טעינה","תיקון לוח","מכירת אביזר","אחר"];
const PAY=["מזומן","אשראי","ביט","העברה"];
const MONTHS=["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
let data={budget:0,min:{},adj:[],tx:[]};
const now=new Date();let cur={y:now.getFullYear(),m:now.getMonth()},tab="home",filter="all",q="",sfilter="all",sq="";
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};
const uid=()=>crypto.randomUUID?crypto.randomUUID():"10000000-1000-4000-8000-100000000000".replace(/[018]/g,c=>(c^Math.random()*16>>c/4).toString(16));
const fmt=n=>"₪"+Math.round(n).toLocaleString("he-IL");
const N=n=>`<span class="num">${fmt(n)}</span>`;
const ym=d=>d.slice(0,7);
const key=()=>`${cur.y}-${String(cur.m+1).padStart(2,"0")}`;
const sum=a=>a.reduce((s,t)=>s+t.amount,0);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const margin=t=>t.parts!=null&&t.amount>0?(t.amount-t.parts)/t.amount:null;
const $=s=>document.querySelector(s);
const norm=s=>String(s||"").toLowerCase().replace(/[\s"'׳״\-]+/g," ").trim();
const unit=t=>t.qty>1?t.amount/t.qty:t.amount;
const host=u=>{try{return new URL(u).hostname.replace(/^www\./,"")}catch(e){return u}};
const dm=d=>`${d.slice(8)}/${d.slice(5,7)}`;
const kindTag=k=>`<span class="ktag k-${k}">${KINDS[k].icon} ${KINDS[k].name}</span>`;

function products(query){
  const qq=norm(query);const g={};
  data.tx.filter(t=>t.type==="out"&&(!qq||norm(t.desc).includes(qq)||norm(t.supplier).includes(qq))).forEach(t=>{(g[norm(t.desc)]||(g[norm(t.desc)]={name:t.desc,buys:[]})).buys.push(t)});
  return Object.values(g).map(p=>{p.buys.sort((a,b)=>b.date.localeCompare(a.date));p.last=p.buys[0];p.best=p.buys.reduce((a,b)=>unit(b)<unit(a)?b:a);return p}).sort((a,b)=>b.last.date.localeCompare(a.last.date));
}
function stock(){ // every "stock" expense becomes a shelf item; repairs and manual removals take from it
  const it={};
  data.tx.filter(t=>t.type==="out"&&t.kind==="stock").forEach(t=>{const k=norm(t.desc);const o=it[k]||(it[k]={k,name:t.desc,cat:t.cat,bought:0,cost:0,used:0,lost:0,buys:[],uses:[],adjs:[]});
    o.bought+=t.qty||1;o.cost+=t.amount;o.buys.push(t)});
  data.tx.filter(t=>t.type==="in").forEach(t=>(t.use||[]).forEach(u=>{const o=it[norm(u.k)];if(o){o.used+=u.qty;o.uses.push(t)}}));
  data.adj.forEach(a=>{const o=it[norm(a.k)];if(o){o.lost+=a.qty;o.adjs.push(a)}});
  return Object.values(it).map(o=>{o.buys.sort((a,b)=>b.date.localeCompare(a.date));o.last=o.buys[0];o.best=o.buys.reduce((a,b)=>unit(b)<unit(a)?b:a);
    o.left=o.bought-o.used-o.lost;o.avg=o.cost/o.bought;o.value=Math.max(0,o.left)*o.avg;o.min=data.min[o.k]??2;
    o.state=o.left<=0?"out":o.left<=o.min?"low":"ok";return o}).sort((a,b)=>({out:0,low:1,ok:2}[a.state]-{out:0,low:1,ok:2}[b.state])||a.name.localeCompare(b.name));
}

function render(){
  $("#mLabel").textContent=`${MONTHS[cur.m]} ${cur.y}`;
  $(".month").style.visibility=tab==="stock"?"hidden":"visible";
  document.querySelectorAll(".tabs [data-tab]").forEach(b=>b.classList.toggle("on",b.dataset.tab===tab));
  $("#view").innerHTML=({home,list,stock:stockView,reports})[tab]();
  bind();
}

function home(){
  const mt=data.tx.filter(t=>ym(t.date)===key()),outs=mt.filter(t=>t.type==="out");
  const inc=sum(mt.filter(t=>t.type==="in"));
  const by={};KORDER.forEach(k=>by[k]=sum(outs.filter(t=>t.kind===k)));
  const run=by.stock+by.fixed+by.other, profit=inc-run;
  const pill=profit>=0?`<span class="pill good">▲ ברווח</span>`:`<span class="pill bad">▼ בהפסד</span>`;
  const st=stock(),shelf=st.reduce((s,o)=>s+o.value,0),alerts=st.filter(o=>o.state!=="ok");
  // payback
  const setupAll=sum(data.tx.filter(t=>t.type==="out"&&t.kind==="setup"));
  const opAll=sum(data.tx.filter(t=>t.type==="in"))-sum(data.tx.filter(t=>t.type==="out"&&t.kind!=="setup"))+shelf;
  const pct=setupAll?Math.max(0,Math.min(1,opAll/setupAll)):1;
  const months=[...new Set(data.tx.map(t=>ym(t.date)))].length||1,perMonth=opAll/months,left=setupAll-opAll;
  const eta=!setupAll?"עוד לא נרשמה השקעה בהקמה. רשום הוצאה מסוג 🛠 כדי לעקוב.":left<=0?"ההשקעה כוסתה במלואה 🎉":perMonth>0?`בקצב הנוכחי: עוד כ־${Math.ceil(left/perMonth)} חודשים`:"עדיין אין רווח שמכסה את ההשקעה";
  // budget (running costs only)
  const b=data.budget||0,bp=b?run/b:0,bcol=bp>=1?"var(--out)":bp>=.8?"var(--warn)":"var(--accent)";
  const bmsg=!b?`<span class="hint">לחץ "הגדר" כדי לקבל התראה לפני חריגה</span>`:bp>=1?`<span class="pill bad">חרגת ב־${N(run-b)}</span>`:bp>=.8?`<span class="pill mid">נשארו רק ${N(b-run)}</span>`:`<span class="pill good">נשארו ${N(b-run)}</span>`;
  // fixed reminder: last month's fixed costs not yet recorded this month
  const pd=new Date(cur.y,cur.m-1,1),pk=`${pd.getFullYear()}-${String(pd.getMonth()+1).padStart(2,"0")}`;
  const haveCats=new Set(outs.filter(t=>t.kind==="fixed").map(t=>t.cat));
  const missing=data.tx.filter(t=>t.type==="out"&&t.kind==="fixed"&&ym(t.date)===pk&&!haveCats.has(t.cat));
  const low=mt.filter(t=>t.type==="in"&&margin(t)!=null&&margin(t)<.4);
  const totOut=KORDER.reduce((s,k)=>s+by[k],0)||1;
  return `<div class="wrap">
  <section class="hero">
    <div class="split" style="color:var(--hero-muted)"><span class="lbl">רווח ב${MONTHS[cur.m]}</span>${pill}</div>
    <div class="big num" style="color:${profit>=0?"var(--hero-ink)":"#ffb3a4"}">${profit<0?"−":""}${fmt(Math.abs(profit))}</div>
    <div class="row2"><div><span class="lbl">נכנס</span><span class="v">${N(inc)}</span></div><div><span class="lbl">יצא על השוטף</span><span class="v">${N(run)}</span></div></div>
    <div class="lbl">הכנסות פחות מלאי, קבועות ומשתנות.${by.setup?` ההשקעה בציוד (${N(by.setup)}) לא נכללת כאן.`:""}</div>
  </section>

  ${missing.length?`<section class="card alert-warn"><h2>🔁 חסרות הוצאות קבועות החודש</h2>
    ${missing.map(t=>`<div class="split"><span>${esc(t.cat)}</span>${N(t.amount)}</div>`).join("")}
    <button class="primary sm" id="copyFixed">הוסף את כולן כמו בחודש שעבר</button></section>`:""}

  ${alerts.length?`<section class="card alert-warn" data-go="stock" role="button" tabindex="0"><div class="split" style="color:var(--ink)"><h2>📦 ${alerts.length} חלקים צריך להזמין</h2><span class="hint">למלאי ›</span></div>
    ${alerts.slice(0,3).map(o=>`<div class="split"><span>${esc(o.name)}</span><span class="pill ${o.state==="out"?"bad":"mid"}">${o.state==="out"?"נגמר":`נשארו <span class="num">${o.left}</span>`}</span></div>`).join("")}</section>`:""}

  <section class="card">
    <div class="split" style="color:var(--ink)"><h2>לאן הלך הכסף החודש</h2><button class="link" id="explain">מה ההבדל?</button></div>
    <div class="bar stack">${KORDER.map(k=>by[k]?`<i class="k-bg-${k}" style="width:${by[k]/totOut*100}%"></i>`:"").join("")}</div>
    <div class="kinds">${KORDER.map(k=>`<div class="krow"><span class="dot k-bg-${k}"></span><div class="kname"><b>${KINDS[k].icon} ${KINDS[k].name}</b><span class="hint">${KINDS[k].short}${k==="setup"?" · לא נכלל ברווח":""}</span></div><span class="num kv">${fmt(by[k])}</span></div>`).join("")}</div>
  </section>

  <section class="card">
    <div class="split" style="color:var(--ink)"><h2>מלאי על המדף</h2><b class="num">${fmt(shelf)}</b></div>
    <div class="hint">כסף שכבר הוצאת על חלקים שעוד לא הורכבו. הוא יחזור אליך כשתשתמש בהם בתיקונים.</div>
  </section>

  <section class="card">
    <div class="split" style="color:var(--ink)"><h2>תקציב הוצאות שוטפות</h2><button class="ghost" id="editBudget" style="padding:4px 10px">${b?N(b):"הגדר"}</button></div>
    <div class="bar"><i style="width:${Math.min(100,bp*100)}%;background:${bcol}"></i></div>
    <div class="split"><span>הוצאת ${N(run)}${b?` מתוך ${N(b)}`:""}</span>${bmsg}</div>
  </section>

  <section class="card">
    <h2>🛠 החזר ההשקעה בהקמה</h2>
    ${setupAll?`<div class="bar"><i style="width:${pct*100}%;background:var(--in)"></i></div>
    <div class="split"><span>כוסה ${N(Math.max(0,opAll))} מתוך ${N(setupAll)}</span><b class="num" style="color:var(--in)">${Math.round(pct*100)}%</b></div>`:""}
    <div class="hint">${eta}</div>
  </section>

  ${low.length?`<section class="card" style="border-color:var(--out)"><h2 style="color:var(--out)">⚠️ ${low.length} תיקונים עם רווח נמוך</h2>
    ${low.map(t=>`<div class="split"><span>${esc(t.desc)}</span><span>נשאר לך ${N(t.amount-t.parts)} (<span class="num">${Math.round(margin(t)*100)}%</span>)</span></div>`).join("")}
    <div class="hint">החלק עלה יותר מ־60% מהמחיר. שווה להעלות מחיר או לחפש ספק זול יותר.</div></section>`:""}

  <section class="card"><div class="split" style="color:var(--ink)"><h2>אחרונות</h2><button class="ghost" data-go="list" style="padding:4px 10px">הכול</button></div>
    <div>${txRows(mt.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5))}</div></section>
  </div>`;
}

function txRows(arr){
  if(!arr.length)return `<div class="empty">אין תנועות. לחץ על + כדי להוסיף.</div>`;
  return arr.map(t=>{const m=margin(t);return `<div class="tx" data-open="${t.id}" role="button" tabindex="0">
    ${t.photos?.length?`<img src="${t.photos[0]}" alt="">`:`<div class="ic ${t.type==="in"?"in":"k-soft-"+t.kind}">${t.type==="in"?"+":KINDS[t.kind].icon}</div>`}
    <div class="mid"><div class="t">${esc(t.desc)}${t.qty>1?` <span class="hint">×<span class="num">${t.qty}</span></span>`:""}</div><div class="s"><span>${dm(t.date)}</span>${t.type==="out"?`<span class="ktag k-${t.kind}">${KINDS[t.kind].name}</span>`:`<span>· ${esc(t.cat)}</span>`}${t.supplier?`<span>· ${esc(t.supplier)}</span>`:""}${t.use?.length?`<span class="ktag k-stock">📦 מהמלאי</span>`:""}${m!=null?`<span class="tag ${m<.4?"low":""}">רווח <span class="num">${Math.round(m*100)}%</span></span>`:""}</div></div>
    <div class="amt ${t.type} num">${t.type==="in"?"+":"−"}${fmt(t.amount)}</div></div>`}).join("");
}

function list(){
  let mt=data.tx.filter(t=>ym(t.date)===key());
  if(filter==="in")mt=mt.filter(t=>t.type==="in");else if(filter!=="all")mt=mt.filter(t=>t.type==="out"&&t.kind===filter);
  mt.sort((a,b)=>b.date.localeCompare(a.date));
  const f=(k,l)=>`<button data-filter="${k}" class="${filter===k?"on":""}">${l}</button>`;
  return `<div class="wrap"><div class="search"><span aria-hidden="true">🔍</span><input id="q" type="search" placeholder="חיפוש מוצר או ספק, למשל: סוללה 12" value="${esc(q)}" autocomplete="off"></div>
  <div id="qRes">${q?searchRes():""}</div>
  <div id="monthList" ${q?"hidden":""}><div class="chips filter">${f("all","הכול")}${f("in","הכנסות")}${KORDER.map(k=>f(k,KINDS[k].icon+" "+KINDS[k].name)).join("")}</div>
  <section class="card" style="margin-top:14px"><div>${txRows(mt)}</div></section>
  <button class="ghost" id="exportBtn" style="margin-top:14px;width:100%">העתקה לאקסל / לרואה החשבון</button></div></div>`;
}

function searchRes(){
  const ps=products(q);
  if(!ps.length)return `<div class="card empty">לא נמצאה קנייה בשם "${esc(q)}"</div>`;
  const st=Object.fromEntries(stock().map(o=>[o.k,o]));
  return `<div class="hint" style="margin-bottom:8px">מכל הזמן · <span class="num">${ps.length}</span> מוצרים</div><div class="wrap">`+ps.map(p=>{const l=p.last,b=p.best,up=unit(l)>unit(b)+.5,s=st[norm(p.name)];
   return `<section class="card prod">
    <div class="ph">${l.photos?.[0]?`<img src="${l.photos[0]}" alt="">`:`<div class="ic k-soft-${l.kind}">${KINDS[l.kind].icon}</div>`}<div class="mid"><div class="t">${esc(p.name)}</div><div class="hint">נקנה <span class="num">${p.buys.length}</span> פעמים · אחרון ${dm(l.date)}/${l.date.slice(2,4)}${s?` · במלאי: <b class="num">${s.left}</b>`:""}</div></div></div>
    <div class="grid2 facts"><div><span class="hint">מחיר אחרון</span><b>${N(unit(l))}${l.qty>1?` <span class="hint">ליח׳</span>`:""}</b><span class="hint">${esc(l.supplier||"ספק לא צוין")}</span></div>
     <div><span class="hint">הכי זול שקנית</span><b style="color:var(--in)">${N(unit(b))}</b><span class="hint">${esc(b.supplier||"ספק לא צוין")}</span></div></div>
    ${up?`<div class="marginbox" style="background:var(--warn-soft);color:var(--warn)">בפעם האחרונה שילמת ${N(unit(l)-unit(b))} יותר ליחידה מאשר ב${esc(b.supplier||"קנייה הזולה")}</div>`:""}
    ${buyBtns(b.link?b:l)}
    <details><summary class="hint">כל הקניות</summary>${p.buys.map(t=>`<div class="split" data-open="${t.id}" role="button" tabindex="0" style="padding-block:6px"><span>${dm(t.date)} · ${esc(t.supplier||"—")}${t.qty>1?` · <span class="num">${t.qty}</span> יח׳`:""}</span>${N(t.amount)}</div>`).join("")}</details>
   </section>`}).join("")+"</div>";
}
const buyBtns=t=>`<div class="grid2">${t.link?`<a class="ghost btn" href="${esc(t.link)}" target="_blank" rel="noopener">🔗 להזמנה (${esc(host(t.link))})</a>`:`<span class="ghost btn dis">אין קישור שמור</span>`}
     <button class="primary sm" data-rebuy="${t.id}">+ רשום קנייה</button></div>`;

function stockView(){
  const st=stock(),shelf=st.reduce((s,o)=>s+o.value,0),nOut=st.filter(o=>o.state==="out").length,nLow=st.filter(o=>o.state==="low").length;
  const f=(k,l)=>`<button data-sf="${k}" class="${sfilter===k?"on":""}">${l}</button>`;
  return `<div class="wrap">
  <section class="hero"><span class="lbl">📦 מלאי על המדף</span><div class="big num">${fmt(shelf)}</div>
   <div class="lbl">כסף שכבר שילמת על חלקים שעוד לא הורכבו. כל חלק שמרכיבים בתיקון יורד מכאן לבד.</div>
   <div style="display:flex;gap:6px;flex-wrap:wrap">${nOut?`<span class="pill bad">${nOut} נגמרו</span>`:""}${nLow?`<span class="pill mid">${nLow} עומדים להיגמר</span>`:""}${!nOut&&!nLow?`<span class="pill good">הכול במלאי</span>`:""}</div></section>
  <div class="search"><span aria-hidden="true">🔍</span><input id="sq" type="search" placeholder="חיפוש חלק, למשל: מסך 13" value="${esc(sq)}" autocomplete="off"></div>
  <div class="chips">${f("all",`הכול (${st.length})`)}${f("order",`להזמין (${nOut+nLow})`)}</div>
  <div id="sRes" class="wrap">${stockList(st)}</div>
  <div class="hint">איך זה עובד: הוצאה מסוג 📦 מלאי מוסיפה יחידות. בהכנסה על תיקון בוחרים את החלק מהמלאי, והוא יורד לבד. לחיצה על חלק פותחת פרטים, הורדה ידנית והגדרת התראה.</div>
  </div>`;
}
function stockList(st){
  const qq=norm(sq);let shown=sfilter==="order"?st.filter(o=>o.state!=="ok"):st;
  if(qq)shown=shown.filter(o=>qq.split(" ").every(w=>norm(o.name+" "+o.cat+" "+o.buys.map(b=>b.supplier||"").join(" ")).includes(w)));
  return shown.length?shown.map(o=>`<section class="card item s-${o.state}">
    <div class="ihead" data-item="${esc(o.k)}" role="button" tabindex="0">
      <div class="mid"><div class="t">${esc(o.name)}</div><div class="hint">${esc(o.cat)} · ממוצע ${N(o.avg)} ליח׳ · שווי ${N(o.value)}</div></div>
      <div class="count"><b class="num">${Math.max(0,o.left)}</b><span>${o.state==="out"?"נגמר":o.state==="low"?"להזמין":"במלאי"}</span></div>
    </div>
    <div class="hint">קנית <span class="num">${o.bought}</span> · הורכבו בתיקונים <span class="num">${o.used}</span>${o.lost?` · פגום/אבד <span class="num">${o.lost}</span>`:""}</div>
    ${o.state!=="ok"?buyBtns(o.best.link?o.best:o.last):""}
  </section>`).join(""):(qq?`<div class="card empty">לא נמצא במלאי "${esc(sq)}"<br><button class="link" id="sqClear">נקה חיפוש</button></div>`:`<div class="card empty">${sfilter==="order"?"אין מה להזמין כרגע ✓":"עוד אין מלאי. כשרושמים הוצאה מסוג \"מלאי וחלקים\" היא מופיעה כאן."}</div>`);
}

function itemSheet(k){
  const o=stock().find(x=>x.k===k);if(!o)return;
  const hist=[...o.buys.map(t=>({d:t.date,txt:`קנייה · ${esc(t.supplier||"")}`,n:`+${t.qty||1}`,c:"in",id:t.id})),...o.uses.map(t=>({d:t.date,txt:`תיקון · ${esc(t.device||t.desc)}`,n:`−${(t.use.find(u=>norm(u.k)===k)||{}).qty||1}`,c:"out",id:t.id})),...o.adjs.map(a=>({d:a.date,txt:esc(a.note),n:`−${a.qty}`,c:"out"}))].sort((a,b)=>b.d.localeCompare(a.d));
  sheet(`<div class="split" style="color:var(--ink)"><h2>${esc(o.name)}</h2><button class="ghost" id="x" style="padding:4px 12px">סגור</button></div>
   <div class="grid2 facts"><div><span class="hint">במלאי</span><b class="num">${Math.max(0,o.left)}</b></div><div><span class="hint">שווי</span><b>${N(o.value)}</b></div></div>
   ${buyBtns(o.best.link?o.best:o.last)}
   <label>התרע כשנשארות (יח׳)<input id="iMin" inputmode="numeric" value="${o.min}"></label>
   <div><div class="hint" style="font-weight:600;margin-bottom:6px">הורדה ידנית של יחידה (לא בתיקון)</div>
    <div class="chips">${["פגום","אבד","שימוש במעבדה"].map(r=>`<button data-adj="${r}">−1 ${r}</button>`).join("")}</div></div>
   <div><div class="hint" style="font-weight:600">היסטוריה</div>${hist.map(h=>`<div class="split" ${h.id?`data-open="${h.id}" role="button"`:""} style="padding-block:6px;border-top:1px solid var(--line)"><span>${dm(h.d)} · ${h.txt}</span><b class="num" style="color:var(--${h.c})">${h.n}</b></div>`).join("")}</div>`);
  $("#x").onclick=close;
  $("#iMin").onchange=()=>{data.min[k]=Math.max(0,parseInt($("#iMin").value)||0);persist(api.updateBook({min:data.min}));render()};
  document.querySelectorAll("[data-adj]").forEach(b=>b.onclick=()=>{const a={k:o.name,qty:1,date:today(),note:b.dataset.adj};data.adj.push(a);persist(api.addAdj(a));render();itemSheet(k);toast("ירד יחידה מהמלאי")});
  bindDyn(); document.querySelectorAll(".sheet [data-open]").forEach(el=>el.onclick=()=>openTx(el.dataset.open));
}

function reports(){
  const ms=[];for(let i=5;i>=0;i--){const d=new Date(cur.y,cur.m-i,1);ms.push({k:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`,l:MONTHS[d.getMonth()].slice(0,3)})}
  ms.forEach(m=>{const t=data.tx.filter(x=>ym(x.date)===m.k);m.i=sum(t.filter(x=>x.type==="in"));m.o=sum(t.filter(x=>x.type==="out"&&x.kind!=="setup"))});
  const max=Math.max(1000,...ms.map(m=>Math.max(m.i,m.o)));const top=Math.ceil(max/2000)*2000;
  const W=340,H=200,L=40,B=24,ch=H-B-10,cw=(W-L)/6;
  let g="";for(let v=0;v<=top;v+=top/4){const y=10+ch-ch*v/top;g+=`<line x1="${L}" x2="${W}" y1="${y}" y2="${y}" stroke="var(--line)"/><text x="${L-6}" y="${y+4}" text-anchor="end">${v>=1000?v/1000+"K":v}</text>`}
  ms.forEach((m,i)=>{const x=W-(i+1)*cw+cw*.18,bw=cw*.3;const hi=ch*m.i/top,ho=ch*m.o/top;
    g+=`<rect x="${x}" y="${10+ch-hi}" width="${bw}" height="${hi}" rx="3" fill="var(--in)"/><rect x="${x+bw+3}" y="${10+ch-ho}" width="${bw}" height="${ho}" rx="3" fill="var(--out)"/><text x="${x+bw}" y="${H-6}" text-anchor="middle">${m.l}</text>`});
  const totIn=sum(data.tx.filter(t=>t.type==="in"));
  const tk={};KORDER.forEach(k=>tk[k]=sum(data.tx.filter(t=>t.type==="out"&&t.kind===k)));
  const r=data.tx.filter(t=>t.type==="in"&&t.parts!=null);
  const byCat={};r.forEach(t=>{const o=byCat[t.cat]||(byCat[t.cat]={n:0,inc:0,parts:0});o.n++;o.inc+=t.amount;o.parts+=t.parts});
  const rows=Object.entries(byCat).sort((a,b)=>(b[1].inc-b[1].parts)-(a[1].inc-a[1].parts));
  return `<div class="wrap"><section class="card"><h2>6 חודשים אחרונים</h2>
  <div style="overflow-x:auto"><svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="הכנסות מול הוצאות שוטפות לפי חודש">${g}</svg></div>
  <div class="split"><span><span style="color:var(--in)">■</span> הכנסות</span><span><span style="color:var(--out)">■</span> הוצאות שוטפות (בלי ציוד)</span></div></section>
  <section class="card"><h2>מאז הפתיחה</h2>
   <div class="split"><span>סך הכנסות</span>${N(totIn)}</div>
   ${KORDER.map(k=>`<div class="split"><span>${KINDS[k].icon} ${KINDS[k].name}</span><span class="num">−${fmt(tk[k])}</span></div>`).join("")}
   <div class="split"><span>📦 מלאי שעוד על המדף (שווה כסף)</span><span class="num">+${fmt(stock().reduce((s,o)=>s+o.value,0))}</span></div>
   <div class="split" style="color:var(--ink);font-weight:700;border-top:1px solid var(--line);padding-top:8px"><span>מזומן נטו (כמה נכנס פחות כמה יצא)</span>${(()=>{const n=totIn-KORDER.reduce((s,k)=>s+tk[k],0);return `<span class="num" style="color:${n>=0?"var(--in)":"var(--out)"}">${n<0?"−":""}${fmt(Math.abs(n))}</span>`})()}</div></section>
  <section class="card"><h2>🔧 כמה נשאר לך מכל סוג תיקון</h2><div class="hint">מחיר ללקוח פחות עלות החלקים</div>
  ${rows.map(([c,o])=>{const m=(o.inc-o.parts)/o.inc;return `<div class="cat"><span>${c} · <span class="num">${o.n}</span> תיקונים</span><span>${N(o.inc-o.parts)} <span class="tag ${m<.4?"low":""}"><span class="num">${Math.round(m*100)}%</span></span></span>
   <div class="bar"><i style="width:${(1-m)*100}%;background:var(--out);border-radius:0"></i><i style="width:${m*100}%;background:var(--in);border-radius:0"></i></div></div>`}).join("")}
  <div class="split"><span><span style="color:var(--out)">■</span> חלקים</span><span><span style="color:var(--in)">■</span> נשאר לך</span></div></section>
  <section class="card"><h2>הוצאות קבועות בחודש</h2><div class="hint">כמה צריך להכניס כל חודש רק כדי לכסות אותן</div>
   ${(()=>{const last={};data.tx.filter(t=>t.type==="out"&&t.kind==="fixed").forEach(t=>{if(!last[t.cat]||t.date>last[t.cat].date)last[t.cat]=t});const v=Object.values(last);
    return v.map(t=>`<div class="split"><span>${esc(t.cat)}</span>${N(t.amount)}</div>`).join("")+`<div class="split" style="color:var(--ink);font-weight:700"><span>סה״כ לחודש</span>${N(sum(v))}</div>`})()}</section>
</div>`;
}

function explainSheet(){
  sheet(`<div class="split" style="color:var(--ink)"><h2>ארבעה סוגי הוצאות</h2><button class="ghost" id="x" style="padding:4px 12px">סגור</button></div>
  ${KORDER.map(k=>`<div class="explain k-line-${k}"><b>${KINDS[k].icon} ${KINDS[k].name} <span class="hint">· ${KINDS[k].short}</span></b><div>${KINDS[k].desc}</div><div class="hint">למשל: ${KINDS[k].cats.slice(0,4).join(", ")}</div></div>`).join("")}
  <div class="hint">רווח החודש = הכנסות פחות מלאי, קבועות ומשתנות. ההשקעה בהקמה מוצגת בנפרד, כדי שחודש שקנית בו מכשיר יקר לא ייראה כמו הפסד.</div>`);
  $("#x").onclick=close;
}

function bindDyn(){
  document.querySelectorAll("[data-rebuy]").forEach(el=>el.onclick=()=>{const t=data.tx.find(x=>x.id===el.dataset.rebuy);addSheet(null,{...t,id:undefined,photos:[],note:"",date:today()})});
  document.querySelectorAll("#qRes [data-open]").forEach(el=>el.onclick=()=>openTx(el.dataset.open));
}
function bindItems(){
  document.querySelectorAll("[data-item]").forEach(el=>{const f=()=>itemSheet(el.dataset.item);el.onclick=f;el.onkeydown=e=>{if(e.key==="Enter")f()}});
  $("#sqClear")&&($("#sqClear").onclick=()=>{sq="";render()});
}
function bind(){
  document.querySelectorAll("#view [data-open]").forEach(el=>{const f=()=>openTx(el.dataset.open);el.onclick=f;el.onkeydown=e=>{if(e.key==="Enter")f()}});
  document.querySelectorAll("#view [data-go]").forEach(el=>{const f=()=>{tab=el.dataset.go;render()};el.onclick=f;el.onkeydown=e=>{if(e.key==="Enter")f()}});
  document.querySelectorAll("[data-filter]").forEach(el=>el.onclick=()=>{filter=el.dataset.filter;render()});
  document.querySelectorAll("[data-sf]").forEach(el=>el.onclick=()=>{sfilter=el.dataset.sf;render()});
  bindItems();
  if($("#sq")){const si=$("#sq");si.oninput=()=>{sq=si.value;$("#sRes").innerHTML=stockList(stock());bindItems();bindDyn()}}
  if($("#q")){const qi=$("#q");qi.oninput=()=>{q=qi.value;$("#qRes").innerHTML=q?searchRes():"";$("#monthList").hidden=!!q;bindDyn()}}
  bindDyn();
  $("#explain")&&($("#explain").onclick=explainSheet);
  $("#editBudget")&&($("#editBudget").onclick=budgetSheet);
  $("#exportBtn")&&($("#exportBtn").onclick=exportCsv);
  $("#copyFixed")&&($("#copyFixed").onclick=()=>{
    const pd=new Date(cur.y,cur.m-1,1),pk=`${pd.getFullYear()}-${String(pd.getMonth()+1).padStart(2,"0")}`;
    const have=new Set(data.tx.filter(t=>t.type==="out"&&t.kind==="fixed"&&ym(t.date)===key()).map(t=>t.cat));
    const add=data.tx.filter(t=>t.type==="out"&&t.kind==="fixed"&&ym(t.date)===pk&&!have.has(t.cat));
    add.forEach(t=>{const n={...t,id:uid(),photos:[],note:"",date:key()+t.date.slice(7),desc:t.desc.replace(MONTHS[pd.getMonth()],MONTHS[cur.m])};data.tx.push(n);persist(api.saveTx(n))});
    render();toast(`נוספו ${add.length} הוצאות קבועות`)});
}

function sheet(html){
  $("#layer").innerHTML=`<div class="sheet-bg" id="bg"><div class="sheet" role="dialog">${html}</div></div>`;
  $("#bg").onclick=e=>{if(e.target.id==="bg")close()};
}
const close=()=>$("#layer").innerHTML="";
function toast(m){const d=document.createElement("div");d.className="toast";d.textContent=m;document.body.appendChild(d);setTimeout(()=>d.remove(),1800)}

function addSheet(edit,prefill){
  const uploads=new Set();
  const st=edit?{...edit,photos:[...(edit.photos||[])],use:(edit.use||[]).map(u=>({...u}))}:prefill?{...prefill}:{type:"out",kind:null,pay:"אשראי",date:today(),photos:[],use:[]};
  st.use=st.use||[];
  if(!edit&&!prefill&&key()!==st.date.slice(0,7))st.date=key()+"-15";
  const draw=()=>{
    const isIn=st.type==="in",K=st.kind&&KINDS[st.kind];
    const shelf=isIn?stock():[];
    const head=`<div class="split" style="color:var(--ink)"><h2>${edit?"עריכה":prefill?"קנייה חוזרת":"תנועה חדשה"}</h2><button class="ghost" id="x" style="padding:4px 12px">סגור</button></div>
    <div class="seg"><button class="out ${!isIn?"on":""}" data-t="out">הוצאה</button><button class="in ${isIn?"on":""}" data-t="in">הכנסה</button></div>`;
    if(!isIn&&!K){ // step 1: what kind of expense
      sheet(head+`<div class="hint" style="font-weight:600">איזו הוצאה זו?</div><div class="kpick">${KORDER.map(k=>`<button data-k="${k}" class="k-line-${k}"><span class="ki">${KINDS[k].icon}</span><b>${KINDS[k].name}</b><span class="hint">${KINDS[k].short}</span></button>`).join("")}</div>
       <button class="link" id="explain2">לא בטוח? הסבר על כל סוג</button>`);
      $("#x").onclick=close;$("#explain2").onclick=()=>{explainSheet();const b=document.createElement("button");b.className="primary";b.textContent="הבנתי, חזרה";b.onclick=draw;$(".sheet").appendChild(b)};
      document.querySelectorAll("[data-t]").forEach(b=>b.onclick=()=>{st.type=b.dataset.t;if(st.type==="in")st.cat=IN_CATS[0];draw()});
      document.querySelectorAll("[data-k]").forEach(b=>b.onclick=()=>{st.kind=b.dataset.k;st.cat=KINDS[st.kind].cats[0];draw()});
      return;
    }
    const cats=isIn?IN_CATS:K.cats;
    sheet(head+(isIn?"":`<button class="kchosen k-line-${st.kind}" id="chgKind"><span>${K.icon} <b>${K.name}</b> · ${K.short}</span><span class="hint">שנה</span></button>
      <div class="hint">${st.kind==="stock"?"היחידות ייכנסו למלאי, ויירדו ממנו כשתבחר את החלק בתיקון.":st.kind==="setup"?"לא יורד מהרווח החודשי. נספר בהחזר ההשקעה.":st.kind==="fixed"?"בחודש הבא אפשר להוסיף את כל הקבועות בלחיצה אחת.":"נכלל בהוצאות השוטפות של החודש."}</div>`)+`
    <div class="grid2 ${isIn||st.kind!=="stock"?"one":""}"><label>סכום ${!isIn&&st.kind==="stock"?"כולל ":""}(₪)<input id="fAmt" class="amount-in" inputmode="decimal" placeholder="0" value="${st.amount??""}"></label>
     ${!isIn&&st.kind==="stock"?`<label>כמה יחידות<input id="fQty" class="amount-in" inputmode="numeric" placeholder="1" value="${st.qty??""}"></label>`:""}</div>
    <div id="unitBox" class="hint"></div>
    <label>${isIn?"מה תיקנת / מכרת?":"שם המוצר"}<input id="fDesc" autocomplete="off" placeholder="${isIn?"למשל: מסך אייפון 13":st.kind==="stock"?"למשל: סוללה אייפון 12":st.kind==="fixed"?"למשל: שכירות":"למשל: מיקרוסקופ"}" value="${esc(st.desc)}"></label>
    <div id="sugg"></div>
    <div><div class="hint" style="margin-bottom:6px;font-weight:600">קטגוריה</div><div class="chips" id="fCat">${cats.map(c=>`<button data-c="${c}" class="${st.cat===c?"on":""}">${c}</button>`).join("")}</div></div>
    ${isIn?`<div><div class="hint" style="margin-bottom:6px;font-weight:600">📦 חלקים מהמלאי ששמת בתיקון</div>
      ${st.use.length?`<div class="used">${st.use.map((u,i)=>{const o=shelf.find(x=>x.k===norm(u.k));return `<div class="split"><span>${esc(u.k)} ×<span class="num">${u.qty}</span></span><span>${o?N(o.avg*u.qty):""} <button class="rm" data-urm="${i}" aria-label="הסר">×</button></span></div>`}).join("")}</div>`:""}
      <div class="chips">${shelf.filter(o=>o.left-(st.use.find(u=>norm(u.k)===o.k)?.qty||0)+((edit?.use||[]).find(u=>norm(u.k)===o.k)?.qty||0)>0).map(o=>`<button data-use="${esc(o.k)}">+ ${esc(o.name)} <span class="hint num">(${o.left})</span></button>`).join("")||`<span class="hint">אין חלקים במלאי</span>`}</div></div>
      <div class="grid2"><label>עלות החלקים (₪)<input id="fParts" inputmode="decimal" placeholder="0" value="${st.parts??""}"></label><label>דגם המכשיר<input id="fDev" placeholder="iPhone 13" value="${esc(st.device)}"></label></div><div id="mBox"></div>`:
    `<div class="grid2"><label>ספק / חנות<input id="fSup" list="supList" placeholder="AliExpress" value="${esc(st.supplier)}"></label>
      <label>קישור למוצר<input id="fLink" type="url" inputmode="url" dir="ltr" placeholder="https://…" value="${esc(st.link)}"></label></div>
      <datalist id="supList">${[...new Set(data.tx.map(t=>t.supplier).filter(Boolean))].map(s=>`<option value="${esc(s)}">`).join("")}</datalist>
      ${st.link?`<a class="hint" href="${esc(st.link)}" target="_blank" rel="noopener" style="color:var(--accent)">🔗 פתח את ${esc(host(st.link))}</a>`:""}`}
    <div class="grid2"><label>תאריך<input type="date" id="fDate" value="${st.date}"></label><label>אמצעי תשלום<select id="fPay">${PAY.map(p=>`<option ${st.pay===p?"selected":""}>${p}</option>`).join("")}</select></label></div>
    <div><div class="hint" style="margin-bottom:6px;font-weight:600">${isIn?"תמונות של המכשיר / התיקון":"חשבונית, צילום מסך של ההזמנה או תמונה של המוצר"}</div>
     <div class="thumbs">${st.photos.map((p,i)=>`<div class="th"><img src="${p}" alt="" data-view="${i}"><button data-rm="${i}" aria-label="הסר">×</button></div>`).join("")}
      <label class="th add" for="fPhoto">📷<span>הוסף</span><input type="file" id="fPhoto" accept="image/*" multiple hidden></label></div>
     ${isIn?`<div class="hint">טיפ: צלם לפני ואחרי. שומר עליך אם לקוח טוען שהמכשיר הגיע תקין.</div>`:""}</div>
    <label>הערה<input id="fNote" placeholder="${isIn?"שם לקוח, אחריות…":"מספר הזמנה, איכות…"}" value="${esc(st.note)}"></label>
    <button class="primary" id="fSave">${edit?"שמור שינויים":"שמור"}</button>
    ${edit?`<button class="ghost" id="fDel" style="color:var(--out)">מחק תנועה</button>`:""}`);
    const v=s=>$(s)?$(s).value:undefined;
    const sync=()=>{st.amount=parseFloat(v("#fAmt"))||null;st.desc=v("#fDesc");st.date=v("#fDate");st.pay=v("#fPay");st.note=v("#fNote");
      if($("#fParts")){st.parts=v("#fParts")===""?null:parseFloat(v("#fParts"));st.device=v("#fDev")}
      if($("#fSup")){st.supplier=v("#fSup");st.link=v("#fLink").trim()}
      if($("#fQty"))st.qty=parseInt(v("#fQty"))||null};
    const live=()=>{sync();
      const b=$("#mBox");if(b){if(st.amount&&st.parts!=null){const m=(st.amount-st.parts)/st.amount;
        b.className="marginbox";b.style.background=m<.4?"var(--out-soft)":"var(--in-soft)";b.style.color=m<.4?"var(--out)":"var(--in)";
        b.innerHTML=`נשאר לך ${N(st.amount-st.parts)} · רווח <span class="num">${Math.round(m*100)}%</span>${m<.4?" — נמוך":""}`}else{b.innerHTML="";b.className=""}}
      const u=$("#unitBox"),prev=!isIn&&st.desc?products(st.desc).find(p=>norm(p.name)===norm(st.desc)):null;
      const others=prev?prev.buys.filter(t=>t.id!==st.id):[];
      let h="";if(!isIn&&st.amount&&st.qty>1)h=`מחיר ליחידה: ${N(st.amount/st.qty)}`;
      if(others.length&&st.amount){const best=others.reduce((a,b)=>unit(b)<unit(a)?b:a),mine=st.qty>1?st.amount/st.qty:st.amount,d=mine-unit(best);
        h+=(h?" · ":"")+(d>.5?`<span style="color:var(--warn);font-weight:600">יקר ב־${N(d)} מהפעם הזולה (${esc(best.supplier||"")})</span>`:`<span style="color:var(--in);font-weight:600">המחיר הכי טוב שקיבלת ✓</span>`)}
      u.innerHTML=h};
    const sugg=()=>{const box=$("#sugg");if(isIn||!st.desc||st.desc.length<2){box.innerHTML="";return}
      const ps=products(st.desc).filter(p=>norm(p.name)!==norm(st.desc)).slice(0,3);
      box.innerHTML=ps.length?`<div class="hint" style="margin-bottom:4px">קנית בעבר:</div><div class="chips">${ps.map((p,i)=>`<button data-sg="${i}">${esc(p.name)} · <span class="num">${fmt(unit(p.best))}</span></button>`).join("")}</div>`:"";
      box.querySelectorAll("[data-sg]").forEach(bt=>bt.onclick=()=>{const t=ps[+bt.dataset.sg].best;sync();Object.assign(st,{desc:t.desc,kind:t.kind,cat:t.cat,supplier:t.supplier,link:t.link,qty:t.qty,amount:t.amount});draw()})};
    $("#x").onclick=close;
    $("#chgKind")&&($("#chgKind").onclick=()=>{sync();st.kind=null;draw()});
    document.querySelectorAll("[data-t]").forEach(b=>b.onclick=()=>{sync();st.type=b.dataset.t;st.cat=st.type==="in"?IN_CATS[0]:null;if(st.type==="out")st.kind=null;draw()});
    document.querySelectorAll("#fCat button").forEach(b=>b.onclick=()=>{sync();st.cat=b.dataset.c;draw()});
    const recost=()=>{st.parts=Math.round(st.use.reduce((s,u)=>{const o=shelf.find(x=>x.k===norm(u.k));return s+(o?o.avg*u.qty:0)},0))||null};
    document.querySelectorAll("[data-use]").forEach(b=>b.onclick=()=>{sync();const k=b.dataset.use,o=shelf.find(x=>x.k===k),u=st.use.find(x=>norm(x.k)===k);
      if(u)u.qty++;else st.use.push({k:o.name,qty:1});recost();if(!st.desc)st.desc=o.name.replace(/\s*OLED$/,"");if(!st.device){const m=o.name.match(/(אייפון|גלקסי)\s*([\w\s]+?)(\s|$)/);if(m)st.device=(m[1]==="אייפון"?"iPhone ":"Galaxy ")+m[2]}draw()});
    document.querySelectorAll("[data-urm]").forEach(b=>b.onclick=()=>{sync();st.use.splice(+b.dataset.urm,1);recost();draw()});
    ["#fAmt","#fParts","#fQty"].forEach(s=>$(s)&&($(s).oninput=live));
    $("#fDesc").oninput=()=>{live();sugg()};live();
    document.querySelectorAll("[data-rm]").forEach(b=>b.onclick=()=>{sync();st.photos.splice(+b.dataset.rm,1);draw()});
    document.querySelectorAll("[data-view]").forEach(im=>im.onclick=()=>{sync();const i=+im.dataset.view;
      sheet(`<img class="viewer" src="${st.photos[i]}" alt=""><button class="ghost" id="back">חזרה</button>`);$("#back").onclick=draw});
    $("#fPhoto").onchange=e=>{sync();const files=[...e.target.files];let left=files.length;files.forEach(f=>{const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{
      const c=document.createElement("canvas"),k=Math.min(1,900/Math.max(im.width,im.height));c.width=im.width*k;c.height=im.height*k;c.getContext("2d").drawImage(im,0,0,c.width,c.height);
      const tmp=c.toDataURL("image/jpeg",.6);st.photos.push(tmp);
      const job=new Promise(res=>c.toBlob(res,"image/jpeg",.75)).then(bl=>api.uploadPhoto(bl)).then(url=>{const i=st.photos.indexOf(tmp);if(i>=0)st.photos[i]=url})
        .catch(()=>{const i=st.photos.indexOf(tmp);if(i>=0)st.photos.splice(i,1);toast("התמונה לא עלתה. בדוק אינטרנט ונסה שוב")}).finally(()=>{uploads.delete(job);if($("#fSave"))draw()});
      uploads.add(job);if(--left===0)draw()};im.src=r.result};r.readAsDataURL(f)});e.target.value=""};
    if(uploads.size){$("#fSave").disabled=true;$("#fSave").textContent="מעלה תמונות…"}
    $("#fSave").onclick=()=>{sync();if(uploads.size)return;if(!st.amount||st.amount<=0){$("#fAmt").focus();toast("צריך להזין סכום");return}
      if(st.link&&!/^https?:\/\//.test(st.link))st.link="https://"+st.link;
      if(!st.desc)st.desc=st.cat;
      if(st.type==="out"){delete st.parts;delete st.use;delete st.device;if(st.kind!=="stock")delete st.qty}else{delete st.kind;delete st.supplier;delete st.link;delete st.qty}
      if(st.amount!=null)st.amount=Math.round(st.amount*100)/100;
      let saved;if(edit){const t=data.tx.find(t=>t.id===edit.id);Object.keys(t).forEach(k=>delete t[k]);Object.assign(t,st,{id:edit.id});saved=t}else{saved={...st,id:uid()};data.tx.push(saved)}
      persist(api.saveTx(saved));close();const d=st.date.split("-");cur={y:+d[0],m:+d[1]-1};render();toast(edit?"נשמר":"נוסף ✓")};
    $("#fDel")&&($("#fDel").onclick=()=>{$("#fDel").outerHTML=`<button class="primary" id="fDel2" style="background:var(--out)">כן, למחוק</button>`;
      $("#fDel2").onclick=()=>{data.tx=data.tx.filter(t=>t.id!==edit.id);persist(api.deleteTx(edit.id));close();render();toast("נמחק")}});
    if(!edit&&!prefill)setTimeout(()=>$("#fAmt").focus(),50);
  };draw();
}
function openTx(i){addSheet(data.tx.find(t=>t.id===i))}
function budgetSheet(){sheet(`<h2>כמה מותר להוציא בחודש?</h2><div class="hint">על השוטף: מלאי, קבועות ומשתנות. בלי ציוד להקמה. נתריע ב־80% ובחריגה.</div>
  <input id="bAmt" class="amount-in" inputmode="decimal" value="${data.budget||""}"><button class="primary" id="bSave">שמור</button><button class="ghost" id="x">ביטול</button>`);
  $("#x").onclick=close;$("#bSave").onclick=()=>{data.budget=parseFloat($("#bAmt").value)||0;persist(api.updateBook({budget:data.budget}));close();render()}}
function exportCsv(){const rows=[["תאריך","סוג","סוג הוצאה","תיאור","קטגוריה","כמות","סכום","עלות חלקים","ספק","אמצעי תשלום"]].concat(
  data.tx.filter(t=>ym(t.date)===key()).sort((a,b)=>a.date.localeCompare(b.date)).map(t=>[t.date,t.type==="in"?"הכנסה":"הוצאה",t.kind?KINDS[t.kind].name:"",t.desc,t.cat,t.qty??"",t.amount,t.parts??"",t.supplier??"",t.pay]));
  const txt=rows.map(r=>r.join("\t")).join("\n");
  navigator.clipboard.writeText(txt).then(()=>toast("הועתק — הדבק באקסל")).catch(()=>{sheet(`<h2>העתק ידנית</h2><textarea id="cp" rows="8">${esc(txt)}</textarea><button class="ghost" id="x">סגור</button>`);$("#cp").select();$("#x").onclick=close})}


// ---------- שמירה, טעינה ופתיחה ----------
const BOOK_KEY = 'll_book', CACHE_KEY = 'll_cache';
const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} };
let bookId = null;

function cache() { lsSet(CACHE_KEY, JSON.stringify({ id: bookId, data })); }
function persist(p) {
  cache();
  p.catch(() => { toast('לא נשמר. בדוק את החיבור לאינטרנט'); setTimeout(load, 2000); });
}
function apply(res) {
  const b = res.book;
  data = { name: b.name, budget: +b.budget || 0, min: b.min || {}, adj: b.adj || [], tx: (res.tx || []).map(t => ({ photos: [], ...t })) };
  cache();
}
async function load() {
  try {
    const res = await api.getBook(bookId);
    if (!res) { lsSet(BOOK_KEY, null); lsSet(CACHE_KEY, null); welcome('הקישור לא נמצא. אפשר לפתוח קופה חדשה.'); return; }
    apply(res);
    if (!$('#layer').innerHTML) render();
  } catch (e) { if (!data.tx.length) $('#view').innerHTML = `<div class="card empty">אין חיבור כרגע. נסה שוב בעוד רגע.<br><button class="link" id="retry">נסה שוב</button></div>`, $('#retry').onclick = load; }
}

function shell() {
  return `<div class="wrap">
    <div class="top">
      <h1>קופת המעבדה</h1>
      <div style="display:flex;gap:6px;align-items:center">
        <div class="month"><button id="mPrev" aria-label="חודש קודם">›</button><span id="mLabel"></span><button id="mNext" aria-label="חודש הבא">‹</button></div>
        <button class="iconbtn" id="settings" aria-label="הגדרות">⚙️</button>
      </div>
    </div>
    <main id="view"></main>
  </div>
  <nav class="tabs">
    <button data-tab="home" class="on"><span>🏠</span>ראשי</button>
    <button data-tab="list"><span>📋</span>תנועות</button>
    <button class="add" id="addBtn" aria-label="הוספת תנועה">+</button>
    <button data-tab="stock"><span>📦</span>מלאי</button>
    <button data-tab="reports"><span>📊</span>דוחות</button>
  </nav>
  <div id="layer"></div>`;
}

function settingsSheet() {
  const link = `${location.origin}/?b=${bookId}`;
  sheet(`<div class="split" style="color:var(--ink)"><h2>הגדרות</h2><button class="ghost" id="x" style="padding:4px 12px">סגור</button></div>
    <div class="card"><h2>📱 פתיחה במכשיר נוסף</h2>
      <div class="hint">פתח את הקישור הזה בטלפון או במחשב השני, והנתונים יהיו זהים בשניהם. שמור אותו במקום בטוח: מי שיש לו את הקישור רואה את הקופה.</div>
      <input id="lnk" dir="ltr" readonly value="${esc(link)}"><button class="primary sm" id="cpy">העתק קישור</button></div>
    <div class="card"><h2>תקציב הוצאות שוטפות לחודש</h2><button class="ghost" id="bud">${data.budget ? N(data.budget) : 'הגדר תקציב'}</button></div>
    <button class="ghost" id="exp">העתקת החודש לאקסל</button>`);
  $('#x').onclick = close;
  $('#cpy').onclick = () => navigator.clipboard.writeText(link).then(() => toast('הקישור הועתק')).catch(() => { $('#lnk').select(); });
  $('#bud').onclick = budgetSheet;
  $('#exp').onclick = exportCsv;
}

function welcome(msg) {
  document.querySelector('.tabs').hidden = true;
  $('.month').style.visibility = 'hidden'; $('#settings').hidden = true;
  $('#view').innerHTML = `<section class="hero"><span class="lbl">ברוך הבא</span><div class="big" style="font-size:28px">כל שקל של המעבדה, במקום אחד</div>
    <div class="lbl">רושמים כל קנייה וכל תיקון, והאפליקציה מחשבת לבד: רווח בכל חודש, כמה מההשקעה כבר כיסית, מה נשאר במלאי ומה צריך להזמין.</div></section>
    ${msg ? `<div class="card alert-warn">${esc(msg)}</div>` : ''}
    <button class="primary" id="newBook">פתח קופה חדשה</button>
    <div class="hint">כבר פתחת קופה במכשיר אחר? פתח שם ⚙️ הגדרות והעתק את הקישור לכאן.</div>`;
  $('#newBook').onclick = async () => {
    $('#newBook').disabled = true; $('#newBook').textContent = 'פותח…';
    try { bookId = await api.createBook('קופת המעבדה'); lsSet(BOOK_KEY, bookId); boot(); }
    catch (e) { $('#newBook').disabled = false; $('#newBook').textContent = 'פתח קופה חדשה'; toast('אין חיבור. נסה שוב'); }
  };
}

function boot() {
  api.setBook(bookId);
  document.querySelector('.tabs').hidden = false; $('#settings').hidden = false;
  try { const c = JSON.parse(lsGet(CACHE_KEY) || 'null'); if (c && c.id === bookId) data = c.data; } catch (e) {}
  render();
  load();
}

export function start(root) {
  root.innerHTML = shell();
  $('#mPrev').onclick = () => { cur.m--; if (cur.m < 0) { cur.m = 11; cur.y--; } render(); };
  $('#mNext').onclick = () => { cur.m++; if (cur.m > 11) { cur.m = 0; cur.y++; } render(); };
  document.querySelectorAll('.tabs [data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; render(); });
  $('#addBtn').onclick = () => addSheet();
  $('#settings').onclick = settingsSheet;
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && bookId) load(); });

  const u = new URL(location.href), fromUrl = u.searchParams.get('b');
  if (fromUrl && /^[0-9a-f-]{36}$/i.test(fromUrl)) {
    if (fromUrl !== lsGet(BOOK_KEY)) lsSet(CACHE_KEY, null);
    lsSet(BOOK_KEY, fromUrl); u.searchParams.delete('b'); history.replaceState(null, '', u.pathname + u.search);
  }
  bookId = lsGet(BOOK_KEY);
  if (bookId) boot(); else welcome();
}
