// Plan-my-day and weekly-review cards (MCP Apps). Both only render inside Claude: the data comes
// from the tool result, edits go back through the host bridge, and the final decision is either
// applied directly (review) or sent to the chat as Nick's message (plan, since the calendar lives
// in another connector).
import { THEME_CSS } from './ui.js';

export const PLAN_URI = 'ui://nick-tasks/plan.html';
export const REVIEW_URI = 'ui://nick-tasks/review.html';

const BASE_CSS = `
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
body{background:transparent}
.shell{background:var(--bg);border:1px solid var(--line);border-radius:18px;padding:14px 14px 12px}
.top{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:4px}
.kicker{font-size:12px;letter-spacing:.09em;text-transform:uppercase;color:var(--mute);font-weight:600}
.head{font-size:17px;font-weight:650}
.summary{font-size:13px;color:var(--soft);margin:2px 0 4px}
.summary.hot{color:var(--warn-ink)}
h2{display:flex;align-items:center;gap:8px;font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--mute);font-weight:650;margin:16px 2px 8px}
h2 .n{background:var(--raised);color:var(--soft);border-radius:999px;padding:0 7px;font-size:11px;letter-spacing:0}
.list{display:flex;flex-direction:column;gap:6px}
.row{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:10px 12px}
.title{font-size:14.5px;font-weight:550;line-height:1.35;word-wrap:break-word}
.meta{font-size:12px;color:var(--mute);margin-top:3px}
.why{font-size:12.5px;color:var(--soft);margin-top:4px}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;align-items:center}
.chip{font:inherit;font-size:12.5px;color:var(--soft);background:var(--raised);border:1px solid transparent;border-radius:8px;padding:5px 10px;cursor:pointer}
.chip:hover{color:var(--ink)}
.chip.on{color:var(--accent);background:var(--accent-dim);border-color:var(--accent);font-weight:600}
.chip.drop.on{color:var(--warn-ink);background:var(--warn-dim);border-color:var(--warn)}
.chip:disabled{opacity:.5;cursor:default}
input[type=date]{font:inherit;font-size:12.5px;color:var(--ink);background:var(--raised);border:1px solid transparent;border-radius:8px;padding:4px 8px;color-scheme:var(--scheme)}
input[type=date].on{border-color:var(--accent)}
.primary{display:block;width:100%;margin-top:14px;font:inherit;font-size:14px;font-weight:650;color:var(--on-accent);background:var(--accent);border:0;border-radius:10px;padding:10px;cursor:pointer}
.primary:disabled{opacity:.55;cursor:default}
.ghost{font:inherit;font-size:12.5px;color:var(--mute);background:none;border:0;padding:6px 2px;cursor:pointer}
.ghost:hover{color:var(--ink)}
.note{font-size:13px;color:var(--soft);margin-top:10px}
.err{color:var(--warn-ink);background:var(--warn-dim);border-radius:10px;padding:10px 12px;margin-bottom:10px;font-size:13px}
.loading{color:var(--mute);padding:20px 0;text-align:center}
`;

// Host bridge shared by both cards: JSON-RPC over postMessage, host theming, tool calls.
const BRIDGE = `
let nextId=1;const pending=new Map();let data=null;
function rpc(method,params){const id=nextId++;return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});window.parent.postMessage({jsonrpc:'2.0',id,method,params},'*')})}
function notify(method,params){window.parent.postMessage({jsonrpc:'2.0',method,params},'*')}
const HOST_VARS={'--bg':'--color-background-primary','--panel':'--color-background-secondary','--raised':'--color-background-tertiary','--hover':'--color-background-tertiary',
  '--ink':'--color-text-primary','--soft':'--color-text-secondary','--mute':'--color-text-tertiary','--line':'--color-border-tertiary','--font':'--font-sans'};
function applyHost(ctx){
  if(!ctx)return;const root=document.documentElement;
  if(ctx.theme)root.dataset.theme=ctx.theme;
  const v=ctx.styles&&ctx.styles.variables||{};
  for(const k in HOST_VARS)if(v[HOST_VARS[k]])root.style.setProperty(k,v[HOST_VARS[k]]);
  if(ctx.styles&&ctx.styles.css&&ctx.styles.css.fonts&&!document.getElementById('host-fonts'))document.head.insertAdjacentHTML('beforeend','<style id="host-fonts">'+ctx.styles.css.fonts+'</style>');
}
function parseResult(r){
  if(r&&r.isError)throw new Error(r.content&&r.content[0]&&r.content[0].text||'Tool error');
  if(r&&r.structuredContent)return r.structuredContent;
  return JSON.parse(r&&r.content&&r.content[0]&&r.content[0].text||'{}');
}
window.addEventListener('message',e=>{
  const m=e.data;if(!m||m.jsonrpc!=='2.0')return;
  if(m.id!=null&&pending.has(m.id)&&!m.method){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(new Error(m.error.message||'Host error')):p.resolve(m.result);return}
  if(m.method==='ui/notifications/tool-result'){try{data=parseResult(m.params);start(data);render()}catch(err){showErr(err)}}
  else if(m.method==='ui/notifications/host-context-changed')applyHost(m.params);
  else if((m.method==='ui/resource-teardown'||m.method==='ping')&&m.id!=null)window.parent.postMessage({jsonrpc:'2.0',id:m.id,result:{}},'*');
});
async function call(name,args){return parseResult(await rpc('tools/call',{name,arguments:args||{}}))}
// Posts into the chat as Nick's own message, so Claude picks up from there.
function say(text){return rpc('ui/message',{role:'user',content:[{type:'text',text}]})}
function reportSize(){notify('ui/notifications/size-changed',{height:Math.ceil(document.body.scrollHeight)})}
function showErr(err){document.getElementById('app').insertAdjacentHTML('afterbegin','<div class="err">'+esc(err.message)+'</div>');reportSize()}
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const dayNum=d=>Date.UTC(+d.slice(0,4),+d.slice(5,7)-1,+d.slice(8,10))/864e5;
const plusDays=(d,n)=>new Date((dayNum(d)+n)*864e5).toISOString().slice(0,10);
const niceDate=d=>DAYS[new Date(dayNum(d)*864e5).getUTCDay()].slice(0,3)+' '+MONTHS[+d.slice(5,7)-1]+' '+(+d.slice(8,10));
const toMin=hm=>+hm.slice(0,2)*60+ +hm.slice(3,5);
const fromMin=m=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
function clock(hm){const h=+hm.slice(0,2),m=hm.slice(3,5);return ((h+11)%12+1)+(m==='00'?'':':'+m)+(h<12?'am':'pm')}
const dur=m=>m>=60?Math.floor(m/60)+'h'+(m%60?' '+m%60+'m':''):m+'m';
new ResizeObserver(reportSize).observe(document.body);
rpc('ui/initialize',{appInfo:{name:'nick-tasks-card',version:'1.0.0'},appCapabilities:{},protocolVersion:'2026-01-26'})
  .then(r=>{applyHost(r&&r.hostContext);notify('ui/notifications/initialized',{})}).catch(showErr);
`;

const page = (title, css, js) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>${THEME_CSS}${BASE_CSS}${css}</style></head>
<body><div class="shell"><div id="app"><div class="loading">Loading…</div></div></div>
<script>${BRIDGE}${js}</script></body></html>`;

// ---------- plan my day ----------
const PLAN_CSS = `
.blk{display:flex;gap:12px;align-items:flex-start}
.blk .when{flex:none;width:92px;font-size:12.5px;color:var(--soft);font-variant-numeric:tabular-nums;padding-top:1px}
.blk .body{flex:1;min-width:0}
.row.fixed{background:transparent;border-style:dashed}
.row.fixed .title{font-weight:450;color:var(--soft)}
.row.task{border-left:3px solid var(--accent)}
.row.clash{border-color:var(--warn)}
.clash-note{font-size:12px;color:var(--warn-ink);margin-top:4px}
.tools{display:flex;gap:6px;margin-top:8px}
.tools .chip{padding:4px 9px}
.out .title{color:var(--mute);text-decoration:line-through}
.sent{margin-top:14px;text-align:center;font-size:13px;color:var(--accent)}
`;

const PLAN_JS = `
let blocks=[], sent=false;
const EDITABLE=k=>k==='task'||k==='break';
function start(d){
  if(blocks.length)return;
  blocks=(d.blocks||[]).map((b,i)=>({...b,i,s:toMin(b.start),e:b.end?toMin(b.end):toMin(b.start)+(b.est_min||30),out:false,moved:0}));
}
function clashes(b){
  return blocks.filter(o=>o!==b&&!o.out&&o.s<b.e&&b.s<o.e).map(o=>o.title);
}
function render(){
  const live=blocks.filter(b=>!b.out).sort((a,b)=>a.s-b.s), out=blocks.filter(b=>b.out);
  const taskMin=live.filter(b=>b.kind==='task').reduce((a,b)=>a+b.e-b.s,0);
  const cap=data.capacity_min||0, over=cap&&taskMin>cap;
  let h='<div class="top"><div><div class="kicker">Plan</div><div class="head">'+esc(niceDate(data.date))+'</div></div></div>';
  h+='<div class="summary'+(over?' hot':'')+'">'+dur(taskMin)+' of tasks'+(cap?' · capacity '+dur(cap):'')+(over?' · over by '+dur(taskMin-cap):'')+'</div>';
  if(data.note)h+='<div class="note">'+esc(data.note)+'</div>';
  h+='<div class="list" style="margin-top:10px">'+live.map(b=>{
    const c=EDITABLE(b.kind)?clashes(b):[];
    return '<div class="row '+(EDITABLE(b.kind)?'task':'fixed')+(c.length?' clash':'')+'"><div class="blk"><div class="when">'+clock(fromMin(b.s))+'–'+clock(fromMin(b.e))+'</div><div class="body">'+
      '<div class="title">'+esc(b.title)+'</div>'+
      (b.detail?'<div class="meta">'+esc(b.detail)+'</div>':'')+
      (c.length?'<div class="clash-note">Overlaps '+esc(c.join(', '))+'</div>':'')+
      (EDITABLE(b.kind)&&!sent?'<div class="tools"><button class="chip" data-shift="'+b.i+':-15">−15</button><button class="chip" data-shift="'+b.i+':15">+15</button><button class="chip drop" data-out="'+b.i+'">Remove</button></div>':'')+
      '</div></div></div>';
  }).join('')+'</div>';
  if(out.length)h+='<h2>Left out <span class="n">'+out.length+'</span></h2><div class="list">'+out.map(b=>'<div class="row out"><div class="blk"><div class="body"><div class="title">'+esc(b.title)+'</div></div>'+(sent?'':'<button class="chip" data-in="'+b.i+'">Add back</button>')+'</div></div>').join('')+'</div>';
  if(data.left_out&&data.left_out.length)h+='<h2>Doesn’t fit today</h2><div class="list">'+data.left_out.map(t=>'<div class="row"><div class="title">'+esc(t.title)+'</div>'+(t.reason?'<div class="meta">'+esc(t.reason)+'</div>':'')+'</div>').join('')+'</div>';
  h+=sent?'<div class="sent">Sent to Claude to add to your calendar</div>':'<button class="primary" data-accept="1"'+(live.some(b=>EDITABLE(b.kind))?'':' disabled')+'>Looks good, add to calendar</button>';
  document.getElementById('app').innerHTML=h;
  document.querySelectorAll('[data-shift]').forEach(el=>el.addEventListener('click',()=>{const [i,d]=el.dataset.shift.split(':').map(Number);const b=blocks[i];
    if(b.s+d<0||b.e+d>24*60)return;b.s+=d;b.e+=d;b.moved+=d;render()}));
  document.querySelectorAll('[data-out]').forEach(el=>el.addEventListener('click',()=>{blocks[+el.dataset.out].out=true;render()}));
  document.querySelectorAll('[data-in]').forEach(el=>el.addEventListener('click',()=>{blocks[+el.dataset.in].out=false;render()}));
  document.querySelector('[data-accept]')?.addEventListener('click',accept);
  reportSize();
}
async function accept(el){
  const live=blocks.filter(b=>!b.out&&EDITABLE(b.kind)).sort((a,b)=>a.s-b.s), out=blocks.filter(b=>b.out);
  const ids=b=>b.task_ids&&b.task_ids.length?' ['+b.task_ids.join(', ')+']':'';
  let text='Plan approved for '+data.date+'. Create these calendar events:\\n'+live.map(b=>'- '+fromMin(b.s)+'–'+fromMin(b.e)+' '+b.title+ids(b)+(b.moved?' (I moved this '+(b.moved>0?'+':'')+b.moved+' min)':'')).join('\\n');
  if(out.length)text+='\\nLeft out today: '+out.map(b=>b.title+ids(b)).join('; ');
  sent=true;render();
  try{await say(text)}catch(err){sent=false;render();showErr(err)}
}
`;

// ---------- weekly review triage ----------
const REVIEW_CSS = `
.prog{font-size:12.5px;color:var(--mute);margin-top:2px}
.done-msg{margin-top:14px;text-align:center;font-size:13px;color:var(--accent)}
`;

const REVIEW_JS = `
const dec={}; let showStale=10, applied=false, busy=false;
// Decision: {a:'keep'|'drop'|'done'|'due'|'start', d:'YYYY-MM-DD'}
function start(d){
  if(Object.keys(dec).length)return;
  for(const t of [...(d.overdue||[]),...(d.stale||[])]){
    const s=t.suggest;if(!s)continue;
    const a={reschedule:'due',defer:'start'}[s.action]||s.action;
    if(['keep','drop','done','due','start'].includes(a))dec[t.id]={a,d:s.date||null};
  }
}
function chip(id,label,a,d,cls){
  const x=dec[id], on=x&&x.a===a&&(d==null||x.d===d);
  return '<button class="chip'+(cls?' '+cls:'')+(on?' on':'')+'" data-dec="'+esc(JSON.stringify({id,a,d:d||null}))+'"'+(applied?' disabled':'')+'>'+label+'</button>';
}
function picker(id,a){
  const x=dec[id], on=x&&x.a===a&&x.d&&!presets(a).includes(x.d);
  return '<input type="date" min="'+plusDays(data.today,1)+'" aria-label="Pick a date"'+(on?' class="on" value="'+x.d+'"':'')+' data-pick="'+esc(JSON.stringify({id,a}))+'"'+(applied?' disabled':'')+'>';
}
function presets(a){const t=data.today;return a==='due'?[plusDays(t,1),plusDays(t,7)]:[plusDays(t,7),plusDays(t,30)]}
function why(t){return t.suggest&&t.suggest.reason?'<div class="why">Claude: '+esc(t.suggest.reason)+'</div>':''}
function render(){
  const od=data.overdue||[], st=data.stale||[], t=data.today;
  const n=Object.keys(dec).length, total=od.length+st.length;
  let h='<div class="top"><div><div class="kicker">Weekly review</div><div class="head">Triage</div></div></div>';
  h+='<div class="prog">'+n+' of '+total+' decided</div>';
  if(od.length){
    const [tom,wk]=presets('due');
    h+='<h2>Overdue <span class="n">'+od.length+'</span></h2><div class="list">'+od.map(x=>
      '<div class="row"><div class="title">'+esc(x.title)+'</div><div class="meta">due '+esc(niceDate(x.due.slice(0,10)))+(x.hard?' · hard deadline':'')+(x.project?' · '+esc(x.project):'')+'</div>'+why(x)+
      '<div class="chips">'+chip(x.id,'Done','done')+chip(x.id,'Tomorrow','due',tom)+chip(x.id,'Next week','due',wk)+picker(x.id,'due')+chip(x.id,'Drop','drop',null,'drop')+'</div></div>').join('')+'</div>';
  }
  if(st.length){
    const [wk,mo]=presets('start'), shown=st.slice(0,showStale);
    h+='<h2>Stale <span class="n">'+st.length+'</span></h2><div class="list">'+shown.map(x=>
      '<div class="row"><div class="title">'+esc(x.title)+'</div><div class="meta">added '+esc(niceDate(x.created))+' · untouched 30+ days</div>'+why(x)+
      '<div class="chips">'+chip(x.id,'Keep','keep')+chip(x.id,'Next week','start',wk)+chip(x.id,'Next month','start',mo)+picker(x.id,'start')+chip(x.id,'Done','done')+chip(x.id,'Drop','drop',null,'drop')+'</div></div>').join('')+'</div>';
    if(st.length>showStale)h+='<button class="ghost" data-more="1">Next '+Math.min(10,st.length-showStale)+' stale tasks</button>';
  }
  if(!total)h+='<div class="note">Nothing overdue or stale. Nice.</div>';
  h+=applied?'<div class="done-msg">Applied. Back to Claude for the rest of the review.</div>'
    :(total?'<button class="primary" data-apply="1"'+(n&&!busy?'':' disabled')+'>'+(busy?'Applying…':'Apply '+n+' decision'+(n===1?'':'s'))+'</button>':'');
  document.getElementById('app').innerHTML=h;
  document.querySelectorAll('[data-dec]').forEach(el=>el.addEventListener('click',()=>{const x=JSON.parse(el.dataset.dec),c=dec[x.id];
    if(c&&c.a===x.a&&c.d===x.d)delete dec[x.id];else dec[x.id]={a:x.a,d:x.d};render()}));
  document.querySelectorAll('[data-pick]').forEach(el=>el.addEventListener('change',()=>{const x=JSON.parse(el.dataset.pick);if(el.value){dec[x.id]={a:x.a,d:el.value};render()}}));
  document.querySelector('[data-more]')?.addEventListener('click',()=>{showStale+=10;render()});
  document.querySelector('[data-apply]')?.addEventListener('click',apply);
  reportSize();
}
async function apply(){
  busy=true;render();
  const title={};for(const x of [...(data.overdue||[]),...(data.stale||[])])title[x.id]=x.title;
  const updates=[], dones=[], lines={keep:[],drop:[],done:[],due:[],start:[]};
  for(const [id,x] of Object.entries(dec)){
    if(x.a==='done')dones.push({kind:'task',id,via:'review'});
    else updates.push(x.a==='keep'?{id}:x.a==='drop'?{id,status:'dropped'}:x.a==='due'?{id,due:x.d}:{id,start:x.d});
    lines[x.a].push(title[id]+(x.d?' → '+x.d:''));
  }
  try{
    if(updates.length)await call('update_tasks',{updates});
    if(dones.length)await call('check_off',{items:dones});
  }catch(err){busy=false;render();showErr(err);return}
  applied=true;busy=false;render();
  const part=(k,label)=>lines[k].length?'\\n'+label+' ('+lines[k].length+'): '+lines[k].join('; '):'';
  say('Triage applied.'+part('done','Done')+part('due','Rescheduled')+part('start','Deferred')+part('drop','Dropped')+part('keep','Kept')+'\\nContinue the weekly review with the waiting-on items.').catch(()=>{});
}
`;

export const renderPlan = () => page('Plan', PLAN_CSS, PLAN_JS);
export const renderReview = () => page('Review', REVIEW_CSS, REVIEW_JS);
