// One queue UI, two transports:
// - inside Claude it's an MCP App (ui:// resource) and talks to the host over postMessage
//   JSON-RPC, so tool calls go through the existing connector;
// - as the standalone web page it calls the MCP endpoint with fetch.
// It always uses its own dark palette so it reads as a deliberate card in either Claude theme.
export const UI_URI = 'ui://nick-tasks/queue.html';

// Install tags only make sense on the real web origin, not inside Claude's sandbox.
const WEB_HEAD = `<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#111214">
<link rel="icon" href="/icons/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icons/icon-192.png">`;

// view: 'full' (default) or 'widget' (compact: what matters now, for home-screen widgets)
export function renderPage({ key = '', view = 'full' } = {}) {
  return PAGE
    .replace('__KEY__', key ? encodeURIComponent(key) : '')
    .replace('__VIEW__', view === 'widget' ? 'widget' : 'full')
    .replace('<!--HEAD-->', key ? WEB_HEAD : '');
}

const PAGE = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex">
<title>Queue</title>
<!--HEAD-->
<style>
:root{
  --bg:#111214;--panel:#18191c;--raised:#202226;--hover:#25272c;
  --ink:#eceae4;--soft:#b9b6ad;--mute:#7f7c75;--line:rgba(255,255,255,.07);
  --accent:#7cc4a8;--accent-dim:rgba(124,196,168,.14);
  --p1:#f07a5f;--p2:#e8b04b;--p3:#6fa8dc;--p4:#5d5b57;
  --warn:#f07a5f;--warn-dim:rgba(240,122,95,.13);--amber-dim:rgba(232,176,75,.13);
  --radius:14px;--font:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 var(--font);-webkit-font-smoothing:antialiased}
body.embedded{background:transparent}
main{max-width:640px;margin:0 auto;padding:22px 16px 40px}
body.embedded main{padding:0;max-width:none}
.shell{background:var(--bg);border-radius:18px}
body.embedded .shell{padding:16px 14px 14px;border:1px solid rgba(255,255,255,.06)}

/* header */
.top{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:14px}
.day{font-size:12px;letter-spacing:.09em;text-transform:uppercase;color:var(--mute);font-weight:600}
.date{font-size:22px;font-weight:650;letter-spacing:-.01em;margin-top:2px}
.time{font-size:13px;color:var(--mute);font-variant-numeric:tabular-nums}
.stats{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px}
.stat{background:var(--panel);border:1px solid var(--line);border-radius:999px;padding:4px 11px;font-size:12.5px;color:var(--soft)}
.stat b{color:var(--ink);font-weight:650;margin-right:4px}
.stat.hot{background:var(--warn-dim);border-color:transparent;color:#f5b3a3}
.stat.hot b{color:#ffd4c9}

/* sections */
h2{display:flex;align-items:center;gap:8px;font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--mute);font-weight:650;margin:20px 2px 8px}
h2 .n{background:var(--raised);color:var(--soft);border-radius:999px;padding:0 7px;font-size:11px;letter-spacing:0}
.list{display:flex;flex-direction:column;gap:6px}
.item{position:relative;display:flex;gap:12px;align-items:flex-start;background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:12px 14px;transition:background .15s,opacity .3s,transform .3s}
.item:hover{background:var(--hover)}
.item.p1::before,.item.p2::before,.item.p3::before{content:"";position:absolute;left:0;top:12px;bottom:12px;width:3px;border-radius:0 3px 3px 0}
.item.p1::before{background:var(--p1)}.item.p2::before{background:var(--p2)}.item.p3::before{background:var(--p3)}
.item.done{opacity:.35;transform:scale(.99)}
.item.done .title{text-decoration:line-through}

/* round checkbox */
.check{appearance:none;-webkit-appearance:none;flex:none;width:22px;height:22px;margin:1px 0 0;border-radius:50%;border:2px solid #4a4c51;background:transparent;cursor:pointer;display:grid;place-items:center;transition:border-color .15s,background .15s}
.check:hover{border-color:var(--accent)}
.check:checked{background:var(--accent);border-color:var(--accent)}
.check:checked::after{content:"";width:6px;height:11px;border:solid #0e2a21;border-width:0 2.5px 2.5px 0;transform:translateY(-1px) rotate(45deg)}

.body{flex:1;min-width:0}
.title{font-size:15px;font-weight:550;line-height:1.35;word-wrap:break-word;cursor:pointer}
.sub{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:6px}
.tag{font-size:11.5px;line-height:1;padding:5px 8px;border-radius:7px;background:var(--raised);color:var(--soft);white-space:nowrap}
.tag.due-today,.tag.overdue{background:var(--warn-dim);color:#f5b3a3}
.tag.due-soon{background:var(--amber-dim);color:#f0cf8e}
.tag.hard::before{content:"●";font-size:8px;margin-right:5px;vertical-align:1px;color:var(--warn)}
.tag.ghost{background:transparent;padding-left:0;padding-right:0;color:var(--mute)}
.line{font-size:13px;color:var(--soft);margin-top:4px}
.line.mute{color:var(--mute)}
.flag{display:inline-block;font-size:11px;font-weight:650;letter-spacing:.02em;color:#ffd4c9;background:var(--warn-dim);padding:3px 7px;border-radius:6px;margin-right:6px}
.notes{display:none;white-space:pre-wrap;font-size:13px;line-height:1.5;color:var(--soft);margin-top:10px;padding:10px 12px;background:var(--raised);border-radius:10px}
.open .notes{display:block}
.rank{position:absolute;right:12px;top:12px;font-size:11px;color:var(--mute);font-variant-numeric:tabular-nums}
.item.ranked .title{padding-right:22px}

/* later today: one-line rows */
.mini{display:flex;align-items:center;gap:10px;padding:9px 12px;background:var(--panel);border:1px solid var(--line);border-radius:11px;transition:opacity .3s}
.mini .check{width:18px;height:18px;margin:0}
.mini .check:checked::after{width:5px;height:9px}
.mini .name{flex:1;min-width:0;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mini .when{font-size:12px;color:var(--mute);font-variant-numeric:tabular-nums}
.mini.done{opacity:.35}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:6px}

/* routine progress */
.bar{height:4px;background:var(--raised);border-radius:4px;margin-top:9px;overflow:hidden}
.bar i{display:block;height:100%;background:var(--accent);border-radius:4px}
.step{display:flex;align-items:center;gap:10px;margin-top:10px}
.btn{font:inherit;font-size:12.5px;font-weight:600;color:var(--accent);background:var(--accent-dim);border:0;border-radius:8px;padding:6px 11px;cursor:pointer;white-space:nowrap}
.btn:hover{filter:brightness(1.15)}
.step .line{margin:0;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* manual reorder */
.moves{margin-left:auto;display:inline-flex;gap:4px}
.mv{font:inherit;font-size:10px;line-height:1;color:var(--mute);background:transparent;border:1px solid var(--line);border-radius:7px;width:26px;height:24px;cursor:pointer}
.mv:hover{color:var(--ink);border-color:#3a3c41}
.moves+.later{margin-left:4px}
body.widget .moves{display:none}
/* snooze */
.later{margin-left:auto;font:inherit;font-size:11.5px;color:var(--mute);background:transparent;border:1px solid var(--line);border-radius:7px;padding:4px 9px;cursor:pointer}
.later:hover{color:var(--ink);border-color:#3a3c41}
.snooze{display:none;flex-wrap:wrap;gap:6px;margin-top:10px;align-items:center}
.snz-open .snooze{display:flex}
.chipbtn{font:inherit;font-size:12.5px;color:var(--ink);background:var(--raised);border:0;border-radius:8px;padding:6px 10px;cursor:pointer}
.chipbtn:hover{background:var(--hover)}
.chipbtn.drop{color:#f5b3a3;background:var(--warn-dim)}
.snooze input[type=date]{font:inherit;font-size:12.5px;color:var(--ink);background:var(--raised);border:0;border-radius:8px;padding:5px 8px;color-scheme:dark}
body.widget .later{display:none}
.more{display:block;margin:12px auto 0;font:inherit;font-size:13px;color:var(--soft);background:var(--panel);border:1px solid var(--line);border-radius:999px;padding:7px 16px;cursor:pointer}
details{margin-top:6px}
details summary{list-style:none;cursor:pointer;color:var(--mute);font-size:12.5px;margin:18px 2px 0}
details summary::-webkit-details-marker{display:none}
details summary::before{content:"+ "}
details[open] summary::before{content:"– "}
.empty{padding:16px;color:var(--mute);text-align:center;background:var(--panel);border:1px dashed var(--line);border-radius:var(--radius)}
.err{color:#f5b3a3;background:var(--warn-dim);border-radius:10px;padding:10px 12px;margin-bottom:10px;font-size:13px}
.loading{color:var(--mute);padding:20px 0;text-align:center}

/* widget */
body.widget main{padding:12px 10px}
body.widget .date{font-size:18px}
body.widget h2{margin:14px 2px 6px}
body.widget .item{padding:10px 12px}
body.widget details,body.widget .more,body.widget .notes,body.widget .step,body.widget .stats,body.widget .later{display:none}
body.widget .line{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.open-full{display:none;color:var(--mute);font-size:12.5px;text-align:center;margin-top:12px;text-decoration:none}
body.widget .open-full{display:block}
</style></head>
<body><main><div class="shell">
<div id="app"><div class="loading">Loading your queue…</div></div>
<a class="open-full" href="/" target="_blank" rel="noopener">Open full queue →</a>
</div></main>
<script>
const KEY='__KEY__';
const EMBEDDED=!KEY;
const WIDGET='__VIEW__'==='widget';
const VIA=EMBEDDED?'panel':'web';
let limit=WIDGET?5:12, last=null;

// ---------- transport ----------
let nextId=1;const pending=new Map();
function rpc(method,params){
  const id=nextId++;
  return new Promise((resolve,reject)=>{
    pending.set(id,{resolve,reject});
    window.parent.postMessage({jsonrpc:'2.0',id,method,params},'*');
  });
}
function notify(method,params){window.parent.postMessage({jsonrpc:'2.0',method,params},'*')}
window.addEventListener('message',e=>{
  const m=e.data;if(!m||m.jsonrpc!=='2.0')return;
  if(m.id!=null&&pending.has(m.id)&&!m.method){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(new Error(m.error.message||'Host error')):p.resolve(m.result);return}
  if(m.method==='ui/notifications/tool-result')onResult(m.params);
  else if((m.method==='ui/resource-teardown'||m.method==='ping')&&m.id!=null)window.parent.postMessage({jsonrpc:'2.0',id:m.id,result:{}},'*');
});
function parseResult(r){
  if(r?.isError)throw new Error(r.content?.[0]?.text||'Tool error');
  if(r?.structuredContent)return r.structuredContent;
  return JSON.parse(r?.content?.[0]?.text||'{}');
}
async function call(name,args){
  if(EMBEDDED)return parseResult(await rpc('tools/call',{name,arguments:args||{}}));
  const r=await fetch('/mcp/'+KEY,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args||{}}})});
  return parseResult((await r.json()).result);
}
function reportSize(){if(EMBEDDED)notify('ui/notifications/size-changed',{width:Math.ceil(document.documentElement.getBoundingClientRect().width),height:Math.ceil(document.body.scrollHeight)})}
function onResult(r){try{render(parseResult(r))}catch(e){showErr(e)}}

// ---------- formatting ----------
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const dayNum=d=>Date.UTC(+d.slice(0,4),+d.slice(5,7)-1,+d.slice(8,10))/864e5;
function clock(hm){const h=+hm.slice(0,2),m=hm.slice(3,5);return ((h+11)%12+1)+(m==='00'?'':':'+m)+(h<12?'am':'pm')}
function dueTag(t,today){
  if(!t.due)return '';
  const diff=dayNum(t.due)-dayNum(today);
  const at=t.due.length>10?' '+clock(t.due.slice(11,16)):'';
  let label,cls;
  if(diff<0){label=(diff===-1?'yesterday':(-diff)+'d overdue');cls='overdue'}
  else if(diff===0){label='today'+at;cls='due-today'}
  else if(diff===1){label='tomorrow'+at;cls='due-soon'}
  else if(diff<7){label=DAYS[new Date(dayNum(t.due)*864e5).getUTCDay()].slice(0,3)+at;cls=diff<=3?'due-soon':''}
  else{label=MONTHS[+t.due.slice(5,7)-1]+' '+(+t.due.slice(8,10));cls=''}
  return '<span class="tag '+cls+(t.hard?' hard':'')+'">'+esc(label)+'</span>';
}
const est=t=>{const m=Math.round((t.est_min||30)*(last?.estimate_multiplier||1));return m>=60?(Math.round(m/6)/10)+'h':m+'m'};
function soon(time,nowHM){
  if(!time||time==='anytime')return false;
  const m=t=>+t.slice(0,2)*60+ +t.slice(3,5);
  return m(time)-m(nowHM)<=45;
}

// ---------- rendering ----------
const cb=item=>'<input class="check" type="checkbox" aria-label="Mark done" data-i="'+esc(JSON.stringify(item))+'">';
const notes=n=>n?'<div class="notes">'+esc(n)+'</div>':'';
function header(q,today,nowHM){
  const dow=new Date(dayNum(today)*864e5).getUTCDay();
  const overdue=(q.tasks||[]).filter(t=>t.due&&dayNum(t.due)<dayNum(today)).length;
  const dueToday=(q.tasks||[]).filter(t=>t.due&&t.due.slice(0,10)===today).length;
  const flagged=(q.habits||[]).filter(h=>h.dont_miss_twice).length;
  const stats=[];
  if(overdue)stats.push('<span class="stat hot"><b>'+overdue+'</b>overdue</span>');
  if(dueToday)stats.push('<span class="stat'+(overdue?'':' hot')+'"><b>'+dueToday+'</b>due today</span>');
  if(flagged)stats.push('<span class="stat hot"><b>'+flagged+'</b>don\\'t miss twice</span>');
  const L=q.today_load;
  if(L&&L.due_today_min){const hr=m=>m>=60?(Math.round(m/6)/10)+'h':m+'m';
    stats.push('<span class="stat'+(L.over_capacity?' hot':'')+'"><b>'+hr(L.due_today_min)+'</b>of '+hr(L.capacity_min)+' booked</span>')}
  for(const g of q.goals||[]){if(g.shortfall>0){const hr=m=>m>=60?(Math.round(m/6)/10)+'h':m+'m';stats.push('<span class="stat"><b>'+hr(g.spent_7d_min)+'</b>of '+hr(g.weekly_min)+' '+esc(g.project)+'</span>')}}
  stats.push('<span class="stat"><b>'+(q.habits||[]).length+'</b>habits left</span>');
  stats.push('<span class="stat"><b>'+((q.tasks||[]).length+(q.more_tasks||0))+'</b>tasks open</span>');
  return '<div class="top"><div><div class="day">'+DAYS[dow]+'</div><div class="date">'+MONTHS[+today.slice(5,7)-1]+' '+(+today.slice(8,10))+'</div></div><div class="time">'+clock(nowHM)+'</div></div><div class="stats">'+stats.join('')+'</div>';
}
// Snooze sets a start date: the task hides until then and its due date is untouched.
const plusDays=(d,n)=>new Date((dayNum(d)+n)*864e5).toISOString().slice(0,10);
function snoozeMenu(t,today){
  const dow=new Date(dayNum(today)*864e5).getUTCDay();
  const opt=(label,start)=>'<button class="chipbtn" data-snooze="'+esc(JSON.stringify({id:t.id,start,label:t.title}))+'">'+label+'</button>';
  return '<div class="snooze"><button class="chipbtn" data-move="'+esc(JSON.stringify({id:t.id,direction:'top',label:t.title}))+'">Top today</button>'+opt('Tomorrow',plusDays(today,1))+(dow!==0&&dow!==6?opt('Saturday',plusDays(today,6-dow)):'')+opt('Monday',plusDays(today,((8-dow)%7)||7))+opt('Next week',plusDays(today,7))+
    '<input type="date" aria-label="Pick a date" min="'+plusDays(today,1)+'" data-snooze-date="'+esc(JSON.stringify({id:t.id,label:t.title}))+'">'+
    '<button class="chipbtn drop" data-drop="'+esc(JSON.stringify({id:t.id,label:t.title}))+'">Drop</button></div>';
}
// Now-section items: push to later today, or skip today as an excused day.
function laterMenu(kind,x,nowHM){
  const m=+nowHM.slice(0,2)*60+ +nowHM.slice(3,5);
  const hm=t=>String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');
  const inHour=Math.min(23*60+45,Math.ceil((m+60)/15)*15);
  const opt=(label,extra)=>'<button class="chipbtn" data-later-now="'+esc(JSON.stringify({kind,id:x.id,label:x.name,...extra}))+'">'+label+'</button>';
  return '<div class="snooze">'+opt('In 1 hour',{snooze_until:hm(inHour)})+(m<20*60?opt('Tonight 8pm',{snooze_until:'20:00'}):'')+opt('Skip today',{skip:true})+'</div>';
}
async function laterNow(x,el){
  const card=el.closest('.item');card?.classList.add('done');
  const {label,...args}=x;
  try{
    await call('check_off',{items:[{...args,via:VIA}]});
    if(EMBEDDED)rpc('ui/update-model-context',{content:[{type:'text',text:(args.skip?'Nick skipped today in the queue app: ':'Nick moved to '+args.snooze_until+' in the queue app: ')+label}]}).catch(()=>{});
  }catch(e){card?.classList.remove('done');showErr(e);return}
  setTimeout(load,350);
}
async function move(x,el){
  el.disabled=true;
  const {label,...args}=x;
  try{
    const r=await call('reorder',{...args,via:VIA});
    if(EMBEDDED)rpc('ui/update-model-context',{content:[{type:'text',text:'Nick moved in the queue app ('+args.direction+'): '+label}]}).catch(()=>{});
  }catch(e){el.disabled=false;showErr(e);return}
  load();
}
async function snooze(x,el){
  const card=el.closest('.item');card?.classList.add('done');
  try{
    await call('update_tasks',{updates:[x.status?{id:x.id,status:x.status}:{id:x.id,start:x.start}]});
    if(EMBEDDED)rpc('ui/update-model-context',{content:[{type:'text',text:x.status?'Nick dropped in the queue app: '+x.label:'Nick snoozed in the queue app until '+x.start+': '+x.label}]}).catch(()=>{});
  }catch(e){card?.classList.remove('done');showErr(e);return}
  setTimeout(load,350);
}
function render(q){
  last=q;
  const today=(q.now||'').slice(0,10), nowHM=(q.now||'').slice(11,16);
  // "Now" gets the full cards; everything later today collapses to one-line rows.
  const isNow=(time,flag)=>flag||soon(time,nowHM);
  const all=q.routines||[], allH=q.habits||[];
  const routines=all.filter(r=>isNow(r.time,r.late)), habits=allH.filter(x=>isNow(x.time,x.dont_miss_twice));
  const laterR=all.filter(r=>!routines.includes(r)), laterH=allH.filter(x=>!habits.includes(x));
  let h=header(q,today,nowHM);
  if(routines.length||habits.length)h+='<h2>Now <span class="n">'+(routines.length+habits.length)+'</span></h2>';
  if(routines.length){
    h+='<div class="list">'+routines.map(r=>{
      const [d,n]=String(r.steps_done).split('/').map(Number);
      return '<div class="item">'+cb({kind:'routine',id:r.id,label:r.name})+'<div class="body"><div class="title">'+esc(r.name)+'</div>'+
        '<div class="sub">'+(r.late?'<span class="tag overdue">late · '+esc(clock(r.time))+'</span>':(r.time!=='anytime'?'<span class="tag">'+esc(clock(r.time))+'</span>':'<span class="tag">anytime</span>'))+'<span class="tag ghost">'+d+' of '+n+' steps</span><button class="later" data-later="1">Later</button></div>'+
        laterMenu('routine',r,nowHM)+
        '<div class="bar"><i style="width:'+(n?Math.round(d/n*100):0)+'%"></i></div>'+
        (r.next_step?'<div class="step"><div class="line">Next: '+esc(r.next_step.title)+'</div><button class="btn" data-i="'+esc(JSON.stringify({kind:'routine_step',id:r.id,step:r.next_step.index,label:r.name+': '+r.next_step.title}))+'">Done</button></div>'+notes(r.next_step.notes):'')+
        '</div></div>';
    }).join('')+'</div>';
  }
  if(habits.length){
    h+='<div class="list"'+(routines.length?' style="margin-top:6px"':'')+'>'+habits.map(x=>
      '<div class="item">'+cb({kind:'habit',id:x.id,label:x.name})+'<div class="body"><div class="title">'+esc(x.name)+'</div>'+
      '<div class="line">'+(x.dont_miss_twice?'<span class="flag">Don\\'t miss twice</span>':'')+esc(x.intention)+'</div>'+
      '<div class="sub">'+(x.time&&x.time!=='anytime'?'<span class="tag">'+esc(clock(x.time))+'</span>':'')+(x.rate_28d!=null?'<span class="tag ghost">'+Math.round(x.rate_28d*100)+'% last 28 days</span>':'<span class="tag ghost">new</span>')+'<button class="later" data-later="1">Later</button></div>'+laterMenu('habit',x,nowHM)+'</div></div>'
    ).join('')+'</div>';
  }
  const tasks=q.tasks||[];
  h+='<h2>Up next <span class="n">'+(tasks.length+(q.more_tasks||0))+'</span></h2><div class="list">'+(tasks.length?tasks.map(t=>
    '<div class="item ranked p'+(t.level||t.priority||4)+'">'+cb({kind:'task',id:t.id,label:t.title})+'<div class="body"><div class="title">'+esc(t.title)+'</div>'+
    '<div class="sub">'+dueTag(t,today)+(t.context?'<span class="tag">'+esc(t.context)+'</span>':'')+'<span class="tag ghost">'+est(t)+'</span><span class="moves"><button class="mv" aria-label="Move up" data-move="'+esc(JSON.stringify({id:t.id,direction:'up',label:t.title}))+'">▲</button><button class="mv" aria-label="Move down" data-move="'+esc(JSON.stringify({id:t.id,direction:'down',label:t.title}))+'">▼</button></span><button class="later" data-later="1">Later</button></div>'+
    snoozeMenu(t,today)+notes(t.notes)+'</div><span class="rank">'+t.rank+'</span></div>'
  ).join(''):'<div class="empty">Nothing waiting on you right now.</div>')+'</div>';
  if(q.more_tasks)h+='<button class="more" data-more="1">Show '+Math.min(12,q.more_tasks)+' more</button>';
  const later=[...laterR.map(r=>({kind:'routine',id:r.id,name:r.name,when:r.time,sub:r.steps_done+' steps'})),...laterH.map(x=>({kind:'habit',id:x.id,name:x.name,when:x.time||'anytime'}))]
    .sort((a,b)=>(a.when==='anytime'?'99':a.when).localeCompare(b.when==='anytime'?'99':b.when));
  if(later.length)h+='<div class="later"><h2>Later today <span class="n">'+later.length+'</span></h2><div class="grid">'+later.map(x=>
    '<div class="mini">'+cb({kind:x.kind,id:x.id,label:x.name})+'<span class="name">'+esc(x.name)+'</span><span class="when">'+(x.when==='anytime'?'anytime':esc(clock(x.when)))+'</span></div>').join('')+'</div></div>';
  const side=[];
  if(q.claude_can_do?.length)side.push('<h2>Claude can do</h2><div class="list">'+q.claude_can_do.map(t=>'<div class="item"><div class="body"><div class="title">'+esc(t.title)+'</div></div></div>').join('')+'</div>');
  if(q.waiting?.length)side.push('<h2>Waiting on others</h2><div class="list">'+q.waiting.map(t=>'<div class="item"><div class="body"><div class="title">'+esc(t.title)+'</div><div class="line mute">'+esc(t.waiting_on||'')+'</div></div></div>').join('')+'</div>');
  if(side.length)h+='<details><summary>'+(q.claude_can_do?.length?q.claude_can_do.length+' Claude can do':'')+(q.claude_can_do?.length&&q.waiting?.length?' · ':'')+(q.waiting?.length?q.waiting.length+' waiting':'')+'</summary>'+side.join('')+'</details>';
  document.getElementById('app').innerHTML=h;
  document.querySelectorAll('[data-i]').forEach(el=>el.addEventListener(el.tagName==='BUTTON'?'click':'change',()=>check(JSON.parse(el.dataset.i),el)));
  document.querySelectorAll('.title').forEach(el=>el.addEventListener('click',()=>{el.closest('.item').classList.toggle('open');reportSize()}));
  document.querySelector('[data-more]')?.addEventListener('click',()=>{limit+=12;load()});
  document.querySelectorAll('[data-later]').forEach(el=>el.addEventListener('click',()=>{el.closest('.item').classList.toggle('snz-open');reportSize()}));
  document.querySelectorAll('[data-snooze]').forEach(el=>el.addEventListener('click',()=>snooze(JSON.parse(el.dataset.snooze),el)));
  document.querySelectorAll('[data-snooze-date]').forEach(el=>el.addEventListener('change',()=>{if(el.value)snooze({...JSON.parse(el.dataset.snoozeDate),start:el.value},el)}));
  document.querySelectorAll('[data-move]').forEach(el=>el.addEventListener('click',()=>move(JSON.parse(el.dataset.move),el)));
  document.querySelectorAll('[data-later-now]').forEach(el=>el.addEventListener('click',()=>laterNow(JSON.parse(el.dataset.laterNow),el)));
  document.querySelectorAll('[data-drop]').forEach(el=>el.addEventListener('click',()=>snooze({...JSON.parse(el.dataset.drop),status:'dropped'},el)));
  document.querySelector('details')?.addEventListener('toggle',reportSize);
  reportSize();
}
function showErr(e){document.getElementById('app').insertAdjacentHTML('afterbegin','<div class="err">'+esc(e.message)+'</div>');reportSize()}
async function check(item,el){
  const card=el.closest('.item,.mini');card?.classList.add('done');el.disabled=true;
  const {label,...args}=item;
  try{
    await call('check_off',{items:[{...args,via:VIA}]});
    // Let the conversation know, so Claude doesn't re-suggest what was just done.
    if(EMBEDDED)rpc('ui/update-model-context',{content:[{type:'text',text:'Nick checked off in the queue app: '+label}]}).catch(()=>{});
  }catch(e){card?.classList.remove('done');el.disabled=false;showErr(e);return}
  setTimeout(load,350);
}
async function load(){try{render(await call('get_queue',{limit}))}catch(e){showErr(e)}}

// ---------- start ----------
if(EMBEDDED){
  document.body.classList.add('embedded');
  new ResizeObserver(reportSize).observe(document.body);
  rpc('ui/initialize',{appInfo:{name:'nick-tasks-queue',version:'1.1.0'},appCapabilities:{},protocolVersion:'2026-01-26'})
    .then(()=>{notify('ui/notifications/initialized',{});
      // If the host doesn't push a tool result (e.g. the view was opened later), fetch it ourselves.
      setTimeout(()=>{if(!last)load()},1500)})
    .catch(showErr);
}else{
  if(WIDGET)document.body.classList.add('widget');
  load();document.addEventListener('visibilitychange',()=>{if(!document.hidden)load()});
  if(WIDGET)setInterval(load,5*60*1000); // widgets stay open, so keep it fresh
  if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
}
</script></body></html>`;
