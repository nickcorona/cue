// One queue UI, two transports:
// - inside Claude it's an MCP App (ui:// resource) and talks to the host over postMessage
//   JSON-RPC, so tool calls go through the existing connector;
// - as the standalone web page (/app/<key>) it calls the MCP endpoint with fetch.
export const UI_URI = 'ui://nick-tasks/queue.html';

export function renderPage({ key = '' } = {}) {
  return PAGE.replace('__KEY__', key ? encodeURIComponent(key) : '');
}

const PAGE = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Queue</title>
<style>
:root{--bg:#f7f6f3;--card:#fff;--ink:#1d1d1b;--mute:#76746e;--line:#e6e3dc;--acc:#2f6f5e;--warn:#b4542d;--chip:#efede8;--font:system-ui,-apple-system,Segoe UI,sans-serif}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#161615;--card:#1f1f1d;--ink:#ecebe6;--mute:#9a978f;--line:#2e2d2a;--acc:#6fbfa6;--warn:#e08a63;--chip:#2a2927}}
:root[data-theme="dark"]{--bg:#161615;--card:#1f1f1d;--ink:#ecebe6;--mute:#9a978f;--line:#2e2d2a;--acc:#6fbfa6;--warn:#e08a63;--chip:#2a2927}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 var(--font)}
body.embedded{background:transparent}
main{max-width:640px;margin:0 auto;padding:20px 16px 40px}
body.embedded main{padding:4px 2px 8px}
header{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;gap:12px}
h1{font-size:18px;margin:0}h2{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--mute);margin:18px 0 8px}
.now{color:var(--mute);font-size:13px}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden}
.row{display:flex;gap:12px;align-items:flex-start;padding:10px 14px;border-top:1px solid var(--line)}.row:first-child{border-top:0}
.row input{margin-top:3px;width:18px;height:18px;accent-color:var(--acc);flex:none;cursor:pointer}
.t{flex:1;min-width:0}.title{word-wrap:break-word;cursor:pointer}.meta{color:var(--mute);font-size:12.5px;margin-top:2px}
.notes{display:none;white-space:pre-wrap;font-size:13px;color:var(--mute);margin-top:6px;border-left:2px solid var(--line);padding-left:8px}
.open .notes{display:block}
.rank{color:var(--mute);font-variant-numeric:tabular-nums;width:18px;text-align:right;flex:none;margin-top:1px}
.flag{color:var(--warn);font-weight:600}.chip{display:inline-block;background:var(--chip);border-radius:5px;padding:0 6px;margin-right:4px;font-size:12px}
.empty{padding:12px 14px;color:var(--mute)}
details summary{cursor:pointer;color:var(--mute);font-size:13px;margin-top:18px}
.done .title{text-decoration:line-through;color:var(--mute)}
button{font:inherit;font-size:13px;background:none;border:1px solid var(--line);color:var(--ink);border-radius:7px;padding:3px 10px;cursor:pointer;margin-top:6px}
.more{display:block;margin:10px auto 0}
.err{color:var(--warn);padding:8px 0}
</style></head>
<body><main>
<header><h1>Queue</h1><span class="now" id="now"></span></header>
<div id="app"><p class="now">Loading…</p></div>
</main>
<script>
const KEY='__KEY__';
const EMBEDDED=!KEY;
let limit=15, last=null;

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
  else if(m.method==='ui/notifications/host-context-changed')applyContext(m.params);
  else if(m.method==='ui/resource-teardown'&&m.id!=null)window.parent.postMessage({jsonrpc:'2.0',id:m.id,result:{}},'*');
  else if(m.method==='ping'&&m.id!=null)window.parent.postMessage({jsonrpc:'2.0',id:m.id,result:{}},'*');
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

// ---------- host integration (embedded only) ----------
function applyContext(ctx){
  if(!ctx)return;
  if(ctx.theme)document.documentElement.dataset.theme=ctx.theme;
  const v=ctx.styles?.variables||{};const map={'--color-background-primary':'--card','--color-text-primary':'--ink','--color-text-secondary':'--mute','--color-border-primary':'--line','--font-sans':'--font'};
  for(const [k,mine] of Object.entries(map))if(v[k])document.documentElement.style.setProperty(mine,v[k]);
}
function reportSize(){if(EMBEDDED){const r=document.documentElement.getBoundingClientRect();notify('ui/notifications/size-changed',{width:Math.ceil(r.width),height:Math.ceil(document.body.scrollHeight)})}}
function onResult(r){try{render(parseResult(r))}catch(e){showErr(e)}}

// ---------- rendering ----------
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function row(item,inner,{rank,checkbox=true}={}){
  return '<div class="row">'+(rank?'<span class="rank">'+rank+'</span>':'')+(checkbox?'<input type="checkbox" aria-label="Done" data-i="'+esc(JSON.stringify(item))+'">':'')+'<div class="t">'+inner+'</div></div>';
}
function notes(n){return n?'<div class="notes">'+esc(n)+'</div>':''}
function render(q){
  last=q;
  document.getElementById('now').textContent=q.now||'';
  let h='';
  if(q.routines?.length){h+='<h2>Routines</h2><div class="card">'+q.routines.map(r=>row({kind:'routine',id:r.id,label:r.name},
    '<div class="title">'+esc(r.name)+'</div><div class="meta">'+esc(r.time)+(r.late?' · <span class="flag">late</span>':'')+' · '+esc(r.steps_done)+' steps'+(r.next_step?' · next: '+esc(r.next_step.title):'')+'</div>'+notes(r.next_step?.notes)+
    (r.next_step?'<button data-i="'+esc(JSON.stringify({kind:'routine_step',id:r.id,step:r.next_step.index,label:r.name+': '+r.next_step.title}))+'">Step done</button>':''))).join('')+'</div>'}
  if(q.habits?.length){h+='<h2>Habits</h2><div class="card">'+q.habits.map(x=>row({kind:'habit',id:x.id,label:x.name},
    '<div class="title">'+esc(x.name)+'</div><div class="meta">'+(x.dont_miss_twice?'<span class="flag">don\\'t miss twice</span> · ':'')+esc(x.intention)+(x.rate_28d!=null?' · '+Math.round(x.rate_28d*100)+'% (28d)':'')+'</div>')).join('')+'</div>'}
  const tasks=q.tasks||[];
  h+='<h2>Tasks</h2><div class="card">'+(tasks.length?tasks.map(t=>row({kind:'task',id:t.id,label:t.title},
    '<div class="title">'+esc(t.title)+'</div><div class="meta">'+(t.context?'<span class="chip">'+esc(t.context)+'</span>':'')+(String(t.why).includes('OVERDUE')?'<span class="flag">'+esc(t.why)+'</span>':esc(t.why))+'</div>'+notes(t.notes),{rank:t.rank})).join(''):'<div class="empty">Nothing available right now.</div>')+'</div>';
  if(q.more_tasks)h+='<button class="more" data-more="1">Show more ('+q.more_tasks+')</button>';
  const side=[];
  if(q.claude_can_do?.length)side.push('<h2>Claude can do</h2><div class="card">'+q.claude_can_do.map(t=>row(null,'<div class="title">'+esc(t.title)+'</div>',{checkbox:false})).join('')+'</div>');
  if(q.waiting?.length)side.push('<h2>Waiting on</h2><div class="card">'+q.waiting.map(t=>row(null,'<div class="title">'+esc(t.title)+'</div><div class="meta">'+esc(t.waiting_on||'')+'</div>',{checkbox:false})).join('')+'</div>');
  if(side.length)h+='<details><summary>More</summary>'+side.join('')+'</details>';
  document.getElementById('app').innerHTML=h;
  document.querySelectorAll('[data-i]').forEach(el=>el.addEventListener(el.tagName==='BUTTON'?'click':'change',()=>check(JSON.parse(el.dataset.i),el)));
  document.querySelectorAll('.title').forEach(el=>el.addEventListener('click',()=>{el.closest('.row').classList.toggle('open');reportSize()}));
  document.querySelector('[data-more]')?.addEventListener('click',()=>{limit+=15;load()});
  reportSize();
}
function showErr(e){document.getElementById('app').insertAdjacentHTML('afterbegin','<p class="err">'+esc(e.message)+'</p>');reportSize()}
async function check(item,el){
  el.closest('.row')?.classList.add('done');el.disabled=true;
  const {label,...args}=item;
  try{
    await call('check_off',{items:[args]});
    // Let the conversation know, so Claude doesn't re-suggest what was just done.
    if(EMBEDDED)rpc('ui/update-model-context',{content:[{type:'text',text:'Nick checked off in the queue app: '+label}]}).catch(()=>{});
  }catch(e){showErr(e)}
  load();
}
async function load(){try{render(await call('get_queue',{limit}))}catch(e){showErr(e)}}

// ---------- start ----------
if(EMBEDDED){
  document.body.classList.add('embedded');
  new ResizeObserver(reportSize).observe(document.body);
  rpc('ui/initialize',{appInfo:{name:'nick-tasks-queue',version:'1.0.0'},appCapabilities:{},protocolVersion:'2026-01-26'})
    .then(res=>{applyContext(res?.hostContext);notify('ui/notifications/initialized',{});
      // If the host doesn't push a tool result (e.g. the view was opened later), fetch it ourselves.
      setTimeout(()=>{if(!last)load()},1500)})
    .catch(showErr);
}else{
  load();document.addEventListener('visibilitychange',()=>{if(!document.hidden)load()});
}
</script></body></html>`;
