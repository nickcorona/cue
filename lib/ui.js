// One queue UI, two transports:
// - inside Claude it's an MCP App (ui:// resource) and talks to the host over postMessage
//   JSON-RPC, so tool calls go through the existing connector;
// - as the standalone web page it calls the MCP endpoint with fetch.
// The web view is always dark; inside Claude it follows the host's theme and style variables
// and starts as a compact card, with Expand opening the full queue fullscreen.
export const UI_URI = 'ui://nick-tasks/queue.html';

// The Cue mark, inline (also used by the Lift screen).
export const MARK_SVG = "<svg class=\"mark\" viewBox=\"0 0 512 512\" aria-hidden=\"true\"><defs><linearGradient id=\"cueg\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\"><stop offset=\"0\" stop-color=\"#2f6f5e\"/><stop offset=\"1\" stop-color=\"#1b4237\"/></linearGradient></defs><rect width=\"512\" height=\"512\" rx=\"116\" fill=\"url(#cueg)\"/><path d=\"M348.3 358.6 A138 138 0 1 1 348.3 153.4\" fill=\"none\" stroke=\"#f4f1ea\" stroke-width=\"62\" stroke-linecap=\"round\"/><circle cx=\"372\" cy=\"256\" r=\"34\" fill=\"#9be0c3\"/></svg>";

// Palette tokens (dark default, light under data-theme=light), shared with the plan and review cards.
export const THEME_CSS = `:root{
  --bg:#111214;--panel:#18191c;--raised:#202226;--hover:#25272c;
  --ink:#eceae4;--soft:#b9b6ad;--mute:#7f7c75;--line:rgba(255,255,255,.07);
  --accent:#7cc4a8;--accent-dim:rgba(124,196,168,.14);
  --p1:#f07a5f;--p2:#e8b04b;--p3:#6fa8dc;--p4:#5d5b57;
  --warn:#f07a5f;--warn-dim:rgba(240,122,95,.13);--amber-dim:rgba(232,176,75,.13);
  --warn-ink:#f5b3a3;--warn-strong:#ffd4c9;--amber-ink:#f0cf8e;
  --check-line:#4a4c51;--on-accent:#0e2a21;--line-strong:#3a3c41;--scheme:dark;
  --radius:14px;--font:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
}
:root[data-theme=light]{
  --bg:#ffffff;--panel:#f7f6f3;--raised:#efede8;--hover:#ebe9e3;
  --ink:#1f1e1c;--soft:#55524c;--mute:#8a867e;--line:rgba(0,0,0,.08);
  --accent:#2f6f5e;--accent-dim:rgba(47,111,94,.12);
  --warn:#d2553a;--warn-dim:rgba(210,85,58,.11);--amber-dim:rgba(200,140,30,.14);
  --warn-ink:#a83a20;--warn-strong:#8e2c14;--amber-ink:#85560a;
  --check-line:#b9b6ad;--on-accent:#ffffff;--line-strong:#c9c6be;--scheme:light;
}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html{color-scheme:var(--scheme)}
html,body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 var(--font);-webkit-font-smoothing:antialiased}
`;

// Install tags only make sense on the real web origin, not inside Claude's sandbox.
// The installed app (standalone) gets everything 10% larger: phone-sized taps and text.
export const APP_CSS = '@media (display-mode:standalone){html{zoom:1.1}}';
const WEB_HEAD = `<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#111214"><meta name="color-scheme" content="dark">
<style>${APP_CSS}</style>
<link rel="icon" href="/icons/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icons/apple-touch-180.png">`;

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
<title>Cue</title>
<!--HEAD-->
<style>
${THEME_CSS}body.embedded{background:transparent}
main{max-width:640px;margin:0 auto;padding:22px 16px 40px}
body.embedded main{padding:0;max-width:none}
.shell{background:var(--bg);border-radius:18px}
body.embedded .shell{padding:14px 14px 12px;border:1px solid var(--line)}
body.fullscreen main{max-width:680px;margin:0 auto;padding:max(12px,var(--safe-top,0px)) 12px max(16px,var(--safe-bottom,0px))}
body.fullscreen .shell{border:0}

/* expand / collapse */
.top-r{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}
/* web app: date on its own line, the time and screen links in one row under it (scrolls sideways if it must) */
body:not(.embedded) .top{flex-wrap:wrap}
body:not(.embedded) .top .date{white-space:nowrap}
body:not(.embedded) .top-r{flex:1 1 100%;flex-wrap:nowrap;justify-content:flex-start;overflow-x:auto;scrollbar-width:none}
body:not(.embedded) .top-r>*{flex:none}
body:not(.embedded) .top-r .time{margin-right:auto}
.expand{font:inherit;font-size:12px;font-weight:600;color:var(--soft);background:var(--raised);border:0;border-radius:8px;padding:5px 10px;cursor:pointer}
.expand:hover{color:var(--ink)}
.full-link{display:block;width:100%;margin-top:10px;font:inherit;font-size:13px;color:var(--soft);background:transparent;border:1px solid var(--line);border-radius:10px;padding:8px;cursor:pointer;text-align:center}
.full-link:hover{color:var(--ink)}

/* compact inline card */
body.compact .top{align-items:center;margin-bottom:10px}
body.compact .brand>div{display:flex;align-items:baseline;gap:8px}
body.compact .date{font-size:17px;margin:0}
body.compact .stats{flex-wrap:nowrap;overflow:hidden;mask-image:linear-gradient(90deg,#000 85%,transparent)}
body.compact .stat{white-space:nowrap}
body.compact h2{margin:14px 2px 6px}
body.compact .moves,body.compact details,body.compact .more{display:none}
.later-sum{font-size:13px;color:var(--mute);margin:12px 2px 0}

/* header */
.top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
.brand{display:flex;align-items:center;gap:10px;min-width:0}
.mark{flex:none;width:30px;height:30px;display:block}
.day{font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--mute);font-weight:600;line-height:1.2}
.date{font-size:19px;font-weight:650;letter-spacing:-.01em;line-height:1.2}
.time{font-size:13px;color:var(--mute);font-variant-numeric:tabular-nums}
.stats{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px}
@media (max-width:560px){
  .stats{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;margin-right:-16px;padding-right:16px;mask-image:linear-gradient(90deg,#000 88%,transparent)}
  .stats::-webkit-scrollbar{display:none}
  .stat{white-space:nowrap;flex:none}
}
.stat{background:var(--panel);border:1px solid var(--line);border-radius:999px;padding:4px 11px;font-size:12.5px;color:var(--soft)}
.stat b{color:var(--ink);font-weight:650;margin-right:4px}
.stat.hot{background:var(--warn-dim);border-color:transparent;color:var(--warn-ink)}
.stat.hot b{color:var(--warn-strong)}
.bedtime{background:var(--accent-dim);color:var(--ink);border-radius:12px;padding:10px 13px;margin-bottom:10px;font-size:13.5px}
.bedtime b{font-weight:650;margin-right:8px}
.bedtime.late{background:var(--warn-dim);color:var(--warn-ink)}
.bedtime.late b{color:var(--warn-strong)}

/* sections */
h2{display:flex;align-items:center;gap:8px;font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--mute);font-weight:650;margin:20px 2px 8px}
h2 .n{background:var(--raised);color:var(--soft);border-radius:999px;padding:0 7px;font-size:11px;letter-spacing:0}
.list{display:flex;flex-direction:column;gap:6px}
.item{position:relative;display:flex;gap:12px;align-items:flex-start;background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:12px 14px;transition:background .15s,opacity .3s,transform .3s}
.item:hover{background:var(--hover)}
.item.p1::before,.item.p2::before,.item.p3::before{content:"";position:absolute;left:0;top:12px;bottom:12px;width:3px;border-radius:0 3px 3px 0}
.item.p1::before{background:var(--p1)}.item.p2::before{background:var(--p2)}.item.p3::before{background:var(--p3)}
.item.done,.mini.done{opacity:.55}
.item.done>.check,.mini.done>.check{animation:pop .28s ease-out}
@keyframes pop{0%{transform:scale(.8)}55%{transform:scale(1.18)}100%{transform:scale(1)}}
/* completed cards slide out and collapse so the list closes up smoothly */
.item.gone,.mini.gone{opacity:0;transform:translateX(18px);padding-top:0!important;padding-bottom:0!important;border-width:0!important;margin-bottom:-6px;
  transition:max-height .3s ease,opacity .22s ease,transform .22s ease,padding .3s ease,margin .3s ease}
.item.done .title{text-decoration:line-through}

/* round checkbox */
.check{appearance:none;-webkit-appearance:none;flex:none;width:22px;height:22px;margin:1px 0 0;border-radius:50%;border:2px solid var(--check-line);background:transparent;cursor:pointer;display:grid;place-items:center;transition:border-color .15s,background .15s}
.check:hover{border-color:var(--accent)}
.check:checked{background:var(--accent);border-color:var(--accent)}
.check:checked::after{content:"";width:6px;height:11px;border:solid var(--on-accent);border-width:0 2.5px 2.5px 0;transform:translateY(-1px) rotate(45deg)}

.body{flex:1;min-width:0}
.title{font-size:15px;font-weight:550;line-height:1.35;word-wrap:break-word;cursor:pointer}
.sub{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:6px}
.tag{font-size:11.5px;line-height:1;padding:5px 8px;border-radius:7px;background:var(--raised);color:var(--soft);white-space:nowrap}
.tag.lift{color:var(--accent);background:var(--accent-dim)}
.mq-act{width:100%;font:inherit;font-size:14px;color:var(--ink);background:var(--raised);border:0;border-radius:8px;padding:9px 10px;margin-bottom:8px}
.tag.due-today,.tag.overdue{background:var(--warn-dim);color:var(--warn-ink)}
.tag.due-soon{background:var(--amber-dim);color:var(--amber-ink)}
.tag.hard::before{content:"●";font-size:8px;margin-right:5px;vertical-align:1px;color:var(--warn)}
.tag.ghost{background:transparent;padding-left:0;padding-right:0;color:var(--mute)}
.line{font-size:13px;color:var(--soft);margin-top:4px}
.line.mute{color:var(--mute)}
.flag{display:inline-block;font-size:11px;font-weight:650;letter-spacing:.02em;color:var(--warn-strong);background:var(--warn-dim);padding:3px 7px;border-radius:6px;margin-right:6px}
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
/* routine steps: done ones fold into one line; next step gets Skip/Done; a few upcoming listed */
.steps{margin-top:8px;display:flex;flex-direction:column}
.srow{display:flex;align-items:center;gap:10px;padding:5px 0;font-size:13.5px;color:var(--soft);transition:opacity .17s,transform .17s}
.srow .check{width:18px;height:18px;margin:0}
.srow .check:checked::after{width:5px;height:9px}
.srow .st{flex:1;min-width:0}
.srow .sm{font-size:11.5px;color:var(--mute);font-variant-numeric:tabular-nums;white-space:nowrap}
.srow .sm.wait{color:var(--amber-ink)}
.srow.done .st,.srow.skipped .st{text-decoration:line-through;color:var(--mute)}
.srow.skipped .check:checked{background:transparent;border-color:var(--check-line)}
.srow.skipped .check:checked::after{width:8px;height:0;border-width:0 0 2.5px 0;border-color:var(--mute);transform:none}
.srow.skipped .st::after{content:" · skipped";text-decoration:none;display:inline-block;margin-left:4px;font-size:11.5px}
.srow.next{color:var(--ink);font-weight:600;padding:8px 10px;margin:2px -10px;border-radius:10px;background:var(--raised)}
.srow.next .st::before{content:"Next";font-size:10.5px;font-weight:650;letter-spacing:.06em;text-transform:uppercase;color:var(--accent);margin-right:8px}
.srow.next.waiting .st::before{content:"Up next";color:var(--amber-ink)}
.srow .skip{font:inherit;font-size:12.5px;color:var(--mute);background:none;border:0;padding:6px 6px;cursor:pointer}
.srow .skip:hover{color:var(--ink)}
.srow.leaving{opacity:0;transform:translateX(14px)}
.srow.promoted,.item.promoted{animation:promote .7s ease-out}
@keyframes promote{from{box-shadow:0 0 0 2px var(--accent)}to{box-shadow:0 0 0 2px transparent}}
.bar i{transition:width .35s ease}
.item.complete{opacity:.4;transition:opacity .4s}
.steps-more{align-self:flex-start;font:inherit;font-size:12.5px;color:var(--mute);background:none;border:0;padding:4px 0 0 28px;cursor:pointer}
.steps-more:hover{color:var(--ink)}
.done-sum{padding-left:0;margin-bottom:2px}
body.widget .steps{display:none}

/* manual reorder */
.moves{margin-left:auto;display:inline-flex;gap:4px}
.mv{font:inherit;font-size:10px;line-height:1;color:var(--mute);background:transparent;border:0;border-radius:7px;width:28px;height:26px;cursor:pointer;opacity:.7}
.mv:hover{color:var(--ink);background:var(--raised);opacity:1}
.moves+.later{margin-left:4px}
body.widget .moves{display:none}
/* snooze */
.later{margin-left:auto;font:inherit;font-size:12px;color:var(--mute);background:var(--raised);border:0;border-radius:8px;padding:5px 10px;cursor:pointer}
.later:hover{color:var(--ink);background:var(--hover)}
.snooze{display:none;flex-wrap:wrap;gap:6px;margin-top:10px;align-items:center}
.snz-open .snooze{display:flex}
.chipbtn{font:inherit;font-size:12.5px;color:var(--ink);background:var(--raised);border:0;border-radius:8px;padding:6px 10px;cursor:pointer}
.chipbtn:hover{background:var(--hover)}
.chipbtn.drop{color:var(--warn-ink);background:var(--warn-dim)}
.snooze input[type=date]{font:inherit;font-size:12.5px;color:var(--ink);background:var(--raised);border:0;border-radius:8px;padding:5px 8px;color-scheme:var(--scheme)}
body.widget .later{display:none}
.more{display:block;margin:12px auto 0;font:inherit;font-size:13px;color:var(--soft);background:var(--panel);border:1px solid var(--line);border-radius:999px;padding:7px 16px;cursor:pointer}
details{margin-top:6px}
details summary{list-style:none;cursor:pointer;color:var(--mute);font-size:12.5px;margin:18px 2px 0}
details summary::-webkit-details-marker{display:none}
details summary::before{content:"+ "}
details[open] summary::before{content:"– "}
.empty{padding:16px;color:var(--mute);text-align:center;background:var(--panel);border:1px dashed var(--line);border-radius:var(--radius)}
.err{color:var(--warn-ink);background:var(--warn-dim);border-radius:10px;padding:10px 12px;margin-bottom:10px;font-size:13px}
.moodq{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:10px 12px;margin-top:10px}
body:not(.embedded) #moodq{position:fixed;left:0;right:0;bottom:max(12px,env(safe-area-inset-bottom));z-index:20;max-width:640px;margin:0 auto;padding:0 12px}
body:not(.embedded) .moodq{box-shadow:0 6px 24px rgba(0,0,0,.35)}
.mq-top{display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:13.5px;font-weight:600;margin-bottom:8px}
.mq-l{font-weight:400;color:var(--mute)}
.mq-skip{font:inherit;font-size:12.5px;color:var(--mute);background:none;border:0;cursor:pointer}
.mq-s{display:grid;grid-template-columns:repeat(11,1fr);gap:3px}
.mq-s button{font:inherit;font-size:14px;font-weight:650;color:var(--ink);background:var(--raised);border:0;border-radius:8px;padding:9px 0;cursor:pointer;font-variant-numeric:tabular-nums}
@media (hover:hover){.mq-s button:hover{background:var(--accent);color:var(--on-accent)}}
.loading{color:var(--mute);padding:20px 0;text-align:center}
.sk{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);margin-bottom:10px;animation:skp 1.4s ease-in-out infinite}
.sk.top{height:54px;background:none;border:0;display:flex;gap:10px;align-items:center}
.sk.top i{display:block;height:30px;width:96px;border-radius:999px;background:var(--panel)}
@keyframes skp{50%{opacity:.55}}

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
<div id="app"><div class="sk top"><i></i><i></i><i></i></div><div class="sk" style="height:180px"></div><div class="sk" style="height:96px"></div><div class="sk" style="height:96px"></div></div><div id="moodq"></div>
<a class="open-full" href="/" target="_blank" rel="noopener">Open full queue →</a>
</div></main>
<script>
const KEY='__KEY__';
const EMBEDDED=!KEY;
const WIDGET='__VIEW__'==='widget';
const VIA=EMBEDDED?'panel':'web';
let limit=WIDGET?5:12, last=null;
// Inside Claude: 'inline' renders the compact card, 'fullscreen' the full queue.
let display='inline', canFull=false, expanded=false;
const openSteps=new Set(); // routines whose full step list is shown
const compact=()=>EMBEDDED&&display!=='fullscreen'&&!expanded;
// Map our tokens onto the host's standard style variables when it sends them.
const HOST_VARS={'--bg':'--color-background-primary','--panel':'--color-background-secondary','--raised':'--color-background-tertiary','--hover':'--color-background-tertiary',
  '--ink':'--color-text-primary','--soft':'--color-text-secondary','--mute':'--color-text-tertiary','--line':'--color-border-tertiary','--font':'--font-sans'};
function applyHost(ctx){
  if(!ctx)return;
  const root=document.documentElement;
  if(ctx.theme)root.dataset.theme=ctx.theme;
  const v=ctx.styles?.variables||{};
  for(const [mine,theirs] of Object.entries(HOST_VARS))if(v[theirs])root.style.setProperty(mine,v[theirs]);
  if(ctx.styles?.css?.fonts&&!document.getElementById('host-fonts'))document.head.insertAdjacentHTML('beforeend','<style id="host-fonts">'+ctx.styles.css.fonts+'</style>');
  if(ctx.safeAreaInsets){root.style.setProperty('--safe-top',(ctx.safeAreaInsets.top||0)+'px');root.style.setProperty('--safe-bottom',(ctx.safeAreaInsets.bottom||0)+'px')}
  if(ctx.availableDisplayModes)canFull=ctx.availableDisplayModes.includes('fullscreen');
  if(ctx.displayMode&&ctx.displayMode!==display){display=ctx.displayMode;if(last)render(last)}
}
async function setFull(on){
  if(canFull){
    try{const r=await rpc('ui/request-display-mode',{mode:on?'fullscreen':'inline'});display=r?.mode||display}catch(e){expanded=on}
  }else expanded=on;
  if(last)render(last);
}

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
  else if(m.method==='ui/notifications/host-context-changed')applyHost(m.params);
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
const MARK='<svg class="mark" viewBox="0 0 512 512" aria-hidden="true"><defs><linearGradient id="cueg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2f6f5e"/><stop offset="1" stop-color="#1b4237"/></linearGradient></defs><rect width="512" height="512" rx="116" fill="url(#cueg)"/><path d="M348.3 358.6 A138 138 0 1 1 348.3 153.4" fill="none" stroke="#f4f1ea" stroke-width="62" stroke-linecap="round"/><circle cx="372" cy="256" r="34" fill="#9be0c3"/></svg>';
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
    stats.push('<span class="stat'+(L.over_capacity?' hot':'')+'"><b>'+hr(L.due_today_min)+'</b>of '+hr(L.capacity_min)+' booked'+(L.calendar_busy_min?' · '+hr(L.calendar_busy_min)+' on calendar':'')+'</span>')}
  for(const g of q.goals||[])if(g.needs_next_action||g.stalled)stats.push('<span class="stat hot" title="'+esc(g.title||'')+'"><b>'+esc(g.project)+'</b>'+(g.needs_next_action?'no next step':'stalled')+'</span>');
  for(const g of q.goals||[]){if(g.shortfall>0){const hr=m=>m>=60?(Math.round(m/6)/10)+'h':m+'m';stats.push('<span class="stat"><b>'+hr(g.spent_7d_min)+'</b>of '+hr(g.weekly_min)+' '+esc(g.project)+'</span>')}}
  if(!compact()){
  stats.push('<span class="stat"><b>'+(q.habits||[]).length+'</b>habits left</span>');
  stats.push('<span class="stat"><b>'+((q.tasks||[]).length+(q.more_tasks||0))+'</b>tasks open</span>');
  }
  const btn='<button class="expand" data-logmood="1">Log mood</button>'+(!EMBEDDED?'<a class="expand" href="/focus" style="text-decoration:none">Focus</a><a class="expand" href="/lift" style="text-decoration:none">Lift</a><a class="expand" href="/cook" style="text-decoration:none">Cook</a><a class="expand" href="/build" style="text-decoration:none">Build</a><a class="expand" href="/mood" style="text-decoration:none">Mood</a>'+(pushState==='off'?'<button class="expand" data-push="1">Turn on notifications</button>':''):compact()?'<button class="expand" data-full="1">Expand</button>':'<button class="expand" data-full="0">Collapse</button>');
  const B=q.bedtime;let bed='';
  if(B&&B.phase==='wind_down')bed='<div class="bedtime'+(B.min_left<=20?' late':'')+'"><b>Wind down</b>Bed at '+clock(B.time)+', '+B.min_left+' min left.'+(B.routine_done===false?' Start the night routine.':'')+'</div>';
  else if(B&&B.phase==='past')bed='<div class="bedtime late"><b>Past bedtime</b>'+(B.min_over>=60?Math.floor(B.min_over/60)+'h '+(B.min_over%60)+'m':B.min_over+' min')+' over '+clock(B.time)+'.'+(B.routine_done===false?' Core night steps only, then bed.':' Go to bed.')+'</div>';
  else if(B&&nowHM>='17:00')stats.push('<span class="stat"><b>'+clock(B.time)+'</b>bed</span>');
  return '<div class="top"><div class="brand">'+MARK+'<div><div class="day">'+DAYS[dow]+'</div><div class="date">'+MONTHS[+today.slice(5,7)-1]+' '+(+today.slice(8,10))+'</div></div></div><div class="top-r"><div class="time">'+clock(nowHM)+'</div>'+btn+'</div></div>'+bed+'<div class="stats">'+stats.join('')+'</div>';
}
// Snooze sets a start date: the task hides until then and its due date is untouched.
const plusDays=(d,n)=>new Date((dayNum(d)+n)*864e5).toISOString().slice(0,10);
function snoozeMenu(t,today){
  const dow=new Date(dayNum(today)*864e5).getUTCDay();
  const opt=(label,start)=>'<button class="chipbtn" data-snooze="'+esc(JSON.stringify({id:t.id,start,label:t.title}))+'">'+label+'</button>';
  return '<div class="snooze"><button class="chipbtn" data-focus="'+esc(t.id)+'">Focus on it</button><button class="chipbtn" data-move="'+esc(JSON.stringify({id:t.id,direction:'top',label:t.title}))+'">Top today</button>'+opt('Tomorrow',plusDays(today,1))+(dow!==0&&dow!==6?opt('Saturday',plusDays(today,6-dow)):'')+opt('Monday',plusDays(today,((8-dow)%7)||7))+opt('Next week',plusDays(today,7))+
    '<input type="date" aria-label="Pick a date" min="'+plusDays(today,1)+'" data-snooze-date="'+esc(JSON.stringify({id:t.id,label:t.title}))+'">'+
    '<button class="chipbtn drop" data-drop="'+esc(JSON.stringify({id:t.id,label:t.title}))+'">Drop</button></div>';
}
// Now-section items: push to later today, or skip today as an excused day.
function laterMenu(kind,x,nowHM){
  const m=+nowHM.slice(0,2)*60+ +nowHM.slice(3,5);
  const hm=t=>String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');
  const inHour=Math.min(23*60+45,Math.ceil((m+60)/15)*15);
  const opt=(label,extra)=>'<button class="chipbtn" data-later-now="'+esc(JSON.stringify({kind,id:x.id,label:x.name,...extra}))+'">'+label+'</button>';
  const short=kind==='routine'&&x.has_core?(x.short_day?opt('Full routine',{short:true,undo:true}):opt('Short version',{short:true})):'';
  // Only offer times after both now and its own set time, so Later never moves it earlier.
  const own=x.time&&x.time!=='anytime'?+x.time.slice(0,2)*60+ +x.time.slice(3,5):0, floor=Math.max(m,own);
  const times=[['In 1 hour',inHour],['Tonight 8pm',20*60],['9:30pm',21*60+30]].filter(([,t])=>t>floor).slice(0,2);
  return '<div class="snooze">'+short+times.map(([l,t])=>opt(l,{snooze_until:hm(t)})).join('')+opt('Skip today',{skip:true})+'</div>';
}
// Every change shows instantly on the card, then saves. edit() brackets the save so any
// refresh that read the server before it landed is discarded instead of undoing the change.
async function edit(apply,save,undo){
  begin();apply();
  try{await save()}catch(e){end();undo();render(last);showErr(e);return false}
  end();load();return true;
}
const say=t=>{if(EMBEDDED)rpc('ui/update-model-context',{content:[{type:'text',text:t}]}).catch(()=>{})};
async function laterNow(x,el){
  const card=el.closest('.item');
  const {label,...args}=x;
  const list=last[x.kind==='routine'?'routines':'habits']||[], item=list.find(y=>y.id===x.id);
  const prev=item&&{time:item.time,snoozed_to:item.snoozed_to};
  if(args.skip){recentlyDone.set(x.id,Date.now());await collapse(card)}
  else if(args.snooze_until&&item){await collapse(card)} // it moves down to Later today
  await edit(()=>{if(args.snooze_until&&item){item.time=args.snooze_until;item.snoozed_to=args.snooze_until}render(last)},
    async()=>{await call('check_off',{items:[{...args,via:VIA}]});
      say((args.short?(args.undo?'Nick switched back to the full routine in Cue: ':'Nick chose the short version in Cue: '):args.skip?'Nick skipped today in Cue: ':'Nick moved to '+args.snooze_until+' in Cue: ')+label)},
    ()=>{recentlyDone.delete(x.id);if(item&&prev){item.time=prev.time;item.snoozed_to=prev.snoozed_to}});
}
let moved=null;
async function move(x,el){
  const {label,...args}=x, tasks=last.tasks||[], i=tasks.findIndex(t=>t.id===x.id);
  if(i<0)return;
  const before=tasks.slice();
  const j=args.direction==='top'?0:args.direction==='up'?Math.max(0,i-1):Math.min(tasks.length-1,i+1);
  await edit(()=>{const [t]=tasks.splice(i,1);tasks.splice(j,0,t);tasks.forEach((t,k)=>t.rank=k+1);moved=x.id;render(last);moved=null},
    async()=>{await call('reorder',{...args,via:VIA});say('Nick moved in Cue ('+args.direction+'): '+label)},
    ()=>{last.tasks=before});
}
async function snooze(x,el){
  recentlyDone.set(x.id,Date.now());await collapse(el.closest('.item'));
  await edit(()=>render(last),
    async()=>{await call('update_tasks',{updates:[x.status?{id:x.id,status:x.status}:{id:x.id,start:x.start}]});
      say(x.status?'Nick dropped in Cue: '+x.label:'Nick snoozed in Cue until '+x.start+': '+x.label)},
    ()=>recentlyDone.delete(x.id));
}
// Done and skipped steps fold into one line; the next step gets Skip and Done; two upcoming
// steps are listed (with their wait time if gated). "All steps" opens everything.
let promoted=null;
function stepsBlock(r){
  const steps=r.steps||[], all=openSteps.has(r.id);
  const resolved=steps.filter(x=>x.done||x.skipped), open=steps.filter(x=>!x.done&&!x.skipped);
  const next=r.next_step&&open.find(x=>x.id===r.next_step.id)||open[0];
  const upcoming=open.filter(x=>x!==next);
  const data=(x,extra)=>esc(JSON.stringify({id:r.id,step_id:x.id,label:r.name+': '+x.title,...extra}));
  const canAsk=!EMBEDDED&&'Notification' in window&&Notification.permission==='default';
  const wait=x=>x.wait_until?'<span class="sm wait">ready '+esc(clock(x.wait_until))+'</span>'+(canAsk?'<button class="skip" data-notify="1">Notify me</button>':''):'';
  const row=x=>'<div class="srow'+(x.done?' done':'')+(x.skipped?' skipped':'')+'"><input class="check" type="checkbox"'+(x.done||x.skipped?' checked':'')+' aria-label="'+(x.done||x.skipped?'Undo':'Mark done')+'" data-step="'+data(x,{mark:x.done||x.skipped?'undo':'done'})+'">'+
    '<span class="st">'+esc(x.title)+'</span>'+(wait(x)||(x.est_min?'<span class="sm">'+x.est_min+'m</span>':''))+'</div>';
  let h='<div class="steps">';
  if(resolved.length){
    const nd=resolved.filter(x=>x.done).length, ns=resolved.length-nd;
    h+='<button class="steps-more done-sum" data-steps="'+esc(r.id)+'">✓ '+nd+' done'+(ns?' · '+ns+' skipped':'')+(all?' · hide':' · show')+'</button>';
    if(all)h+=resolved.map(row).join('');
  }
  if(next){
    h+='<div class="srow next'+(next.wait_until?' waiting':'')+(promoted===next.id?' promoted':'')+'"><span class="st">'+esc(next.title)+'</span>'+(wait(next)||(next.est_min?'<span class="sm">'+next.est_min+'m</span>':''))+
      (next.recipe_id?'<button class="skip" style="color:var(--accent);font-weight:650" data-cook="'+esc(JSON.stringify({recipe:next.recipe_id,routine:r.id,step:next.id}))+'">Cook</button>':'')+'<button class="skip" data-step="'+data(next,{mark:'skip'})+'">Skip</button><button class="btn" data-step="'+data(next,{mark:'done'})+'">Done</button></div>'+notes(r.next_step&&r.next_step.id===next.id?r.next_step.notes:null);
  }
  const shown=all?upcoming:upcoming.slice(0,2);
  h+=shown.map(row).join('');
  if(upcoming.length>shown.length)h+='<button class="steps-more" data-steps="'+esc(r.id)+'">+'+(upcoming.length-shown.length)+' more</button>';
  else if(all&&!resolved.length&&upcoming.length>2)h+='<button class="steps-more" data-steps="'+esc(r.id)+'">Fewer</button>';
  return h+'</div>';
}
// Mirror of the server's next-step rule, so a tap updates the card instantly.
function recompute(r){
  const open=r.steps.filter(x=>!x.done&&!x.skipped);
  const nx=open.find(x=>!x.wait_until)||open[0]||null;
  r.next_step=nx?{id:nx.id,index:nx.index,title:nx.title,notes:nx.id===r.next_step?.id?r.next_step.notes:undefined}:null;
  r.steps_done=(r.steps.length-open.length)+'/'+r.steps.length;
  return open.length;
}
const pause=ms=>new Promise(res=>setTimeout(res,ms));
// Server push (installed app): subscribe this device so wait timers and nudges arrive even
// when Cue is closed.
let pushState='unknown';
const b64u=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(s.length/4)*4,'=')),c=>c.charCodeAt(0));
async function checkPush(){
  if(EMBEDDED||!('serviceWorker' in navigator)||!('PushManager' in window)){pushState='unsupported';return}
  try{const reg=await navigator.serviceWorker.ready;pushState=(await reg.pushManager.getSubscription())?'on':'off'}catch(e){pushState='unsupported'}
  if(last)render(last);
}
async function enablePush(){
  try{
    if(await Notification.requestPermission()!=='granted')throw new Error('Notifications are blocked for Cue: allow them in Android settings → Apps → Cue → Notifications');
    const {publicKey}=await (await fetch('/push?action=key')).json();
    if(!publicKey)throw new Error('Notifications are not set up on the server yet');
    const reg=await navigator.serviceWorker.ready;
    const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u(publicKey)});
    const r=await fetch('/push?action=subscribe',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(sub)});
    if(!r.ok)throw new Error('Could not register this device ('+r.status+')');
    pushState='on';render(last);
  }catch(e){showErr(e)}
}
// Installed app only: a local notification when a step's wait ends (works while the app is
// alive in the background; from chat, Claude sets a calendar reminder instead).
const gateTimers={};
function scheduleGatePings(q){
  if(EMBEDDED||pushState==='on'||!('Notification' in window)||Notification.permission!=='granted')return; // server push covers it
  for(const r of q.routines||[])for(const st of r.steps||[]){
    const key=r.id+':'+st.id+':'+st.wait_until;
    if(!st.wait_until||st.done||st.skipped||gateTimers[key])continue;
    const t=new Date();t.setHours(+st.wait_until.slice(0,2),+st.wait_until.slice(3,5),0,0);
    const ms=t-Date.now();if(ms<=0)continue;
    gateTimers[key]=setTimeout(()=>{
      const show=()=>new Notification('Ready: '+st.title,{body:r.name,tag:key});
      navigator.serviceWorker?navigator.serviceWorker.ready.then(reg=>reg.showNotification('Ready: '+st.title,{body:r.name,tag:key,data:{url:'/',check:{kind:'routine_step',id:r.id,step_id:st.id}},actions:[{action:'done',title:'Done'}]})).catch(show):show();
    },ms);
  }
}
async function stepAct(x,el){
  const r=(last.routines||[]).find(y=>y.id===x.id), st=r&&(r.steps||[]).find(y=>y.id===x.step_id);
  if(!st)return;
  const prev={done:st.done,skipped:st.skipped}, wasNext=r.next_step?.id===st.id;begin();
  st.done=x.mark==='done';st.skipped=x.mark==='skip';
  const left=recompute(r);
  promoted=wasNext&&r.next_step?r.next_step.id:null;
  const row=el.closest('.srow');
  if(row&&x.mark!=='undo'){row.classList.add('leaving');await pause(170)}
  if(!left){recentlyDone.set(r.id,Date.now());await pause(200);await collapse(el.closest('.item'))}
  render(last);promoted=null;
  try{
    await call('check_off',{items:[{kind:'routine_step',id:x.id,step_id:x.step_id,...(x.mark==='skip'?{skip:true}:{}),...(x.mark==='undo'?{undo:true}:{}),via:VIA}]});
    if(EMBEDDED)rpc('ui/update-model-context',{content:[{type:'text',text:(x.mark==='skip'?'Nick skipped in Cue: ':x.mark==='undo'?'Nick unchecked in Cue: ':'Nick checked off in Cue: ')+x.label}]}).catch(()=>{});
  }catch(e){end();st.done=prev.done;st.skipped=prev.skipped;recompute(r);recentlyDone.delete(r.id);render(last);showErr(e);return}
  end();
  setTimeout(load,left?150:700); // quiet refresh picks up wait gates the server just started
  if(x.mark==='done')askMood(x.step_id,x.label);
}
function render(q){
  q=hideRecent(q);last=q;
  const C=compact();
  document.body.classList.toggle('compact',C);
  document.body.classList.toggle('fullscreen',EMBEDDED&&display==='fullscreen');
  const today=(q.now||'').slice(0,10), nowHM=(q.now||'').slice(11,16);
  // "Now" gets the full cards; everything later today collapses to one-line rows.
  // Something he snoozed waits for its new time, even if it's late or flagged don't-miss-twice.
  const isNow=(x,flag)=>x.snoozed_to?soon(x.time,nowHM):(flag||soon(x.time,nowHM));
  const all=q.routines||[], allH=q.habits||[];
  const routines=all.filter(r=>isNow(r,r.late)), habits=allH.filter(x=>isNow(x,x.dont_miss_twice));
  const laterR=all.filter(r=>!routines.includes(r)), laterH=allH.filter(x=>!habits.includes(x));
  let h=header(q,today,nowHM);
  if(routines.length||habits.length)h+='<h2>Now <span class="n">'+(routines.length+habits.length)+'</span></h2>';
  if(routines.length){
    h+='<div class="list">'+routines.map(r=>{
      const [d,n]=String(r.steps_done).split('/').map(Number);
      return '<div class="item'+(r.complete?' complete':'')+'">'+cb({kind:'routine',id:r.id,label:r.name})+'<div class="body"><div class="title">'+esc(r.name)+'</div>'+
        '<div class="sub">'+(r.late?'<span class="tag overdue">late · '+esc(clock(r.time))+'</span>':(r.time!=='anytime'?'<span class="tag">'+esc(clock(r.time))+'</span>':'<span class="tag">anytime</span>'))+moodTag(r)+'<span class="tag ghost">'+d+' of '+n+' steps'+(r.short_day?' · short version':'')+'</span><button class="later" data-later="1">Later</button></div>'+
        laterMenu('routine',r,nowHM)+
        '<div class="bar"><i style="width:'+(n?Math.round(d/n*100):0)+'%"></i></div>'+
        (r.steps?stepsBlock(r):r.next_step?'<div class="step"><div class="line">Next: '+esc(r.next_step.title)+'</div><button class="btn" data-i="'+esc(JSON.stringify({kind:'routine_step',id:r.id,step:r.next_step.index,label:r.name+': '+r.next_step.title}))+'">Done</button></div>'+notes(r.next_step.notes):'')+
        '</div></div>';
    }).join('')+'</div>';
  }
  if(habits.length){
    h+='<div class="list"'+(routines.length?' style="margin-top:6px"':'')+'>'+habits.map(x=>
      '<div class="item">'+cb({kind:'habit',id:x.id,label:x.name})+'<div class="body"><div class="title">'+esc(x.name)+'</div>'+
      '<div class="line">'+(x.dont_miss_twice?'<span class="flag">Don\\'t miss twice</span>':'')+esc(x.intention)+'</div>'+
      '<div class="sub">'+(x.time&&x.time!=='anytime'?'<span class="tag">'+esc(clock(x.time))+'</span>':'')+(x.rate_28d!=null?'<span class="tag ghost">'+Math.round(x.rate_28d*100)+'% last 28 days</span>':'<span class="tag ghost">new</span>')+moodTag(x)+(x.lift?'<button class="btn" data-lift="'+esc(x.id)+'">Log workout</button>':'')+'<button class="later" data-later="1"'+(x.lift?' style="margin-left:6px"':'')+'>Later</button></div>'+laterMenu('habit',x,nowHM)+'</div></div>'
    ).join('')+'</div>';
  }
  const tasks=C?(q.tasks||[]).slice(0,3):(q.tasks||[]);
  h+='<h2>Up next <span class="n">'+((q.tasks||[]).length+(q.more_tasks||0))+'</span></h2><div class="list">'+(tasks.length?tasks.map(t=>t.list_id?runRow(t,today):
    '<div class="item ranked p'+(t.level||t.priority||4)+(moved===t.id?' promoted':'')+'">'+cb({kind:'task',id:t.id,label:t.title})+'<div class="body"><div class="title">'+esc(t.title)+'</div>'+
    '<div class="sub">'+dueTag(t,today)+moodTag(t)+(t.focus==='deep'?'<span class="tag">deep</span>':'')+(t.context?'<span class="tag">'+esc(t.context)+'</span>':'')+'<span class="tag ghost">'+est(t)+'</span><span class="moves"><button class="mv" aria-label="Move up" data-move="'+esc(JSON.stringify({id:t.id,direction:'up',label:t.title}))+'">▲</button><button class="mv" aria-label="Move down" data-move="'+esc(JSON.stringify({id:t.id,direction:'down',label:t.title}))+'">▼</button></span><button class="later" data-later="1">Later</button></div>'+
    snoozeMenu(t,today)+notes(t.notes)+'</div><span class="rank">'+t.rank+'</span></div>'
  ).join(''):'<div class="empty">Nothing waiting on you right now.</div>')+'</div>';
  if(q.more_tasks)h+='<button class="more" data-more="1">Show '+Math.min(12,q.more_tasks)+' more</button>';
  const later=[...laterR.map(r=>({kind:'routine',id:r.id,name:r.name,when:r.time,sub:r.steps_done+' steps'})),...laterH.map(x=>({kind:'habit',id:x.id,name:x.name,when:x.time||'anytime'}))]
    .sort((a,b)=>(a.when==='anytime'?'99':a.when).localeCompare(b.when==='anytime'?'99':b.when));
  if(C){
    if(later.length)h+='<div class="later-sum">Later today: '+later.length+' more</div>';
    h+='<button class="full-link" data-full="1">Full queue'+(((q.tasks||[]).length+(q.more_tasks||0))>3?' · '+((q.tasks||[]).length+(q.more_tasks||0)-3)+' more tasks':'')+'</button>';
  }
  else if(later.length)h+='<div class="later"><h2>Later today <span class="n">'+later.length+'</span></h2><div class="grid">'+later.map(x=>
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
  document.querySelector('[data-push]')?.addEventListener('click',enablePush);
  document.querySelectorAll('[data-cook]').forEach(el=>el.addEventListener('click',()=>{
    const x=JSON.parse(el.dataset.cook), path='/cook?recipe='+encodeURIComponent(x.recipe)+'&routine='+encodeURIComponent(x.routine)+'&step='+encodeURIComponent(x.step);
    if(EMBEDDED)rpc('ui/open-link',{url:'https://nick-cue.vercel.app'+path}).catch(()=>window.open('https://nick-cue.vercel.app'+path,'_blank'));else location.href=path;
  }));
  document.querySelectorAll('[data-focus]').forEach(el=>el.addEventListener('click',()=>{
    const url='https://nick-cue.vercel.app/focus?task='+encodeURIComponent(el.dataset.focus);
    if(EMBEDDED)rpc('ui/open-link',{url}).catch(()=>window.open(url,'_blank'));else location.href='/focus?task='+encodeURIComponent(el.dataset.focus);
  }));
  document.querySelectorAll('[data-lift]').forEach(el=>el.addEventListener('click',()=>{
    const url='https://nick-cue.vercel.app/lift?start='+encodeURIComponent(el.dataset.lift);
    if(EMBEDDED)rpc('ui/open-link',{url}).catch(()=>window.open(url,'_blank'));else location.href='/lift?start='+encodeURIComponent(el.dataset.lift);
  }));
  document.querySelectorAll('[data-notify]').forEach(el=>el.addEventListener('click',()=>Notification.requestPermission().then(()=>{render(last)})));
  scheduleGatePings(q);
  document.querySelectorAll('[data-li]').forEach(el=>el.addEventListener('change',()=>gotItem(JSON.parse(el.dataset.li),el)));
  document.querySelectorAll('[data-step]').forEach(el=>el.addEventListener(el.tagName==='BUTTON'?'click':'change',()=>stepAct(JSON.parse(el.dataset.step),el)));
  document.querySelectorAll('[data-steps]').forEach(el=>el.addEventListener('click',()=>{const id=el.dataset.steps;openSteps.has(id)?openSteps.delete(id):openSteps.add(id);render(last)}));
  document.querySelectorAll('[data-full]').forEach(el=>el.addEventListener('click',()=>setFull(el.dataset.full==='1')));
  document.querySelectorAll('[data-logmood]').forEach(el=>el.addEventListener('click',()=>askMood(null,'')));
  reportSize();
}
function showErr(e){document.getElementById('app').insertAdjacentHTML('afterbegin','<div class="err">'+esc(e.message)+'</div>');reportSize()}
// A shopping run: one ranked errand with its items ticked off one by one (or all via the circle).
function runRow(t,today){
  const head=t.title.split(':')[0], items=t.items||[], all=openSteps.has(t.id), shown=all?items:items.slice(0,4);
  const nice=d=>MONTHS[+d.slice(5,7)-1]+' '+(+d.slice(8,10));
  return '<div class="item ranked p'+(t.level||4)+(t.complete?' complete':'')+'">'+cb({kind:'list',id:t.list_id,label:head})+'<div class="body"><div class="title">'+esc(head)+'</div>'+
    '<div class="sub">'+dueTag(t,today)+'<span class="tag">'+esc(t.context||'errands')+'</span><span class="tag ghost">'+est(t)+' · '+items.length+' item'+(items.length===1?'':'s')+'</span></div>'+
    '<div class="steps">'+shown.map(it=>'<div class="srow"><input class="check" type="checkbox" aria-label="Got it" data-li="'+esc(JSON.stringify({id:t.id,list:t.list_id,item:it.id,label:head+': '+it.title}))+'">'+
      '<span class="st">'+esc(it.title)+(it.note?' <span class="sm">'+esc(it.note)+'</span>':'')+'</span>'+(it.need_by?'<span class="sm">by '+esc(nice(it.need_by))+'</span>':'')+'</div>').join('')+
    (items.length>shown.length?'<button class="steps-more" data-steps="'+esc(t.id)+'">+'+(items.length-shown.length)+' more</button>':'')+'</div>'+
    '</div><span class="rank">'+t.rank+'</span></div>';
}
async function gotItem(x,el){
  const t=(last.tasks||[]).find(y=>y.id===x.id);if(!t)return;
  const prev=t.items;begin();
  const row=el.closest('.srow');row?.classList.add('leaving');await pause(170);
  t.items=t.items.filter(i=>i.id!==x.item);
  if(!t.items.length){recentlyDone.set(x.list,Date.now());await collapse(el.closest('.item'))}
  render(last);
  try{
    await call('check_off',{items:[{kind:'list',id:x.list,item_ids:[x.item],via:VIA}]});
    if(EMBEDDED)rpc('ui/update-model-context',{content:[{type:'text',text:'Nick got in Cue: '+x.label}]}).catch(()=>{});
  }catch(e){end();t.items=prev;recentlyDone.delete(x.list);render(last);showErr(e);return}
  end();
  setTimeout(load,t.complete?600:150);
}
// Things just completed stay hidden for a minute, so a refresh that reads slightly stale
// data can't bring them back.
const recentlyDone=new Map();
function hideRecent(q){
  const now=Date.now();
  for(const [k,t] of recentlyDone)if(now-t>60000)recentlyDone.delete(k);
  if(!recentlyDone.size||!q)return q;
  const keep=x=>!recentlyDone.has(x.id)&&!(x.list_id&&recentlyDone.has(x.list_id));
  return {...q,tasks:(q.tasks||[]).filter(keep),habits:(q.habits||[]).filter(keep),routines:(q.routines||[]).filter(keep)};
}
// Slide a card out and collapse its height, then resolve.
function collapse(el){
  return new Promise(res=>{
    if(!el)return res();
    el.style.maxHeight=el.offsetHeight+'px';el.style.overflow='hidden';
    requestAnimationFrame(()=>requestAnimationFrame(()=>{el.classList.add('gone');el.style.maxHeight='0px'}));
    setTimeout(res,320);
  });
}
// Mood tag on a card: the activity reliably lifts mood ("usually +1.5") or builds accomplishment.
const moodTag=x=>x.mood?'<span class="tag lift">'+(x.mood.builds?'builds':'usually +'+x.mood.lift.toFixed(1))+'</span>':'';
// The mood bar: after a check-off, an optional "mood now?" 0-10 linked to what was just done
// (goes away on its own); or, with nothing linked, a logger for whatever he's doing (Log mood,
// or a check-in ping). Then an optional accomplishment rating on the same entry. Never blocks.
let moodTimer=null;
function askMood(linked,label){
  const box=document.getElementById('moodq');if(!box||WIDGET)return;
  const free=!linked;
  const close=()=>{clearTimeout(moodTimer);box.innerHTML='';reportSize()};
  const bar=(q,sub,attr,input)=>{
    clearTimeout(moodTimer);
    box.innerHTML='<div class="moodq"><div class="mq-top"><span>'+q+' <span class="mq-l">'+esc(sub||'')+'</span></span><button class="mq-skip" aria-label="Skip">'+(input?'Close':'Skip')+'</button></div>'+
      (input?'<input class="mq-act" id="mq-act" list="mq-fams" autocomplete="off" placeholder="What are you doing?"><datalist id="mq-fams">'+((last&&last.mood_families)||[]).map(f=>'<option value="'+esc(f)+'">').join('')+'</datalist>':'')+
      '<div class="mq-s">'+[0,1,2,3,4,5,6,7,8,9,10].map(n=>'<button data-'+attr+'="'+n+'">'+n+'</button>').join('')+'</div></div>';
    box.querySelector('.mq-skip').onclick=close;
    if(!input)moodTimer=setTimeout(close,12000);
    reportSize();
  };
  bar('Mood now?',label,'mq',free);
  if(free)box.querySelector('#mq-act').focus();
  box.querySelectorAll('[data-mq]').forEach(b=>b.onclick=async()=>{
    const act=free?box.querySelector('#mq-act').value.trim():'';
    if(free&&!act){box.querySelector('#mq-act').focus();box.querySelector('#mq-act').placeholder='Say what you’re doing first';return}
    let r;try{r=await call('log_mood',{mood:+b.dataset.mq,...(free?{activity:act}:{linked_id:linked}),via:VIA})}catch(e){close();showErr(e);return}
    bar('Sense of accomplishment?',r.predicted?'mood '+r.logged.mood+', you predicted '+r.predicted.mood:(free?act:''),'ms');
    box.querySelectorAll('[data-ms]').forEach(x=>x.onclick=()=>{close();call('update_mood',{id:r.logged.id,mastery:+x.dataset.ms}).catch(showErr)});
  });
}
async function check(item,el){
  const card=el.closest('.item,.mini');card?.classList.add('done');el.disabled=true;
  const {label,...args}=item;
  recentlyDone.set(args.id,Date.now());begin();
  const req=call('check_off',{items:[{...args,via:VIA}]}); // save while the tick plays
  await pause(260);await collapse(card);
  render(last);
  try{
    await req;
    // Let the conversation know, so Claude doesn't re-suggest what was just done.
    if(EMBEDDED)rpc('ui/update-model-context',{content:[{type:'text',text:'Nick checked off in Cue: '+label}]}).catch(()=>{});
  }catch(e){end();recentlyDone.delete(args.id);render(last);showErr(e);return}
  end();load();
  if(['task','habit','routine','routine_step'].includes(args.kind)&&!args.skip&&!args.undo&&!args.snooze_until)askMood(args.step_id||args.id,label);
}
// A refresh is dropped if a change happened while it was in flight (it may predate the save)
// or if a newer refresh was started after it; a fresh one follows.
let mutSeq=0,loadSeq=0,inflight=0;
const begin=()=>{inflight++;mutSeq++}, end=()=>{inflight=Math.max(0,inflight-1);mutSeq++};
const QKEY='cue-queue-'+(WIDGET?'widget':'full');
function cachedQueue(){
  try{const q=JSON.parse(localStorage.getItem(QKEY)||'null'),d=new Date(),p=n=>String(n).padStart(2,'0');
    return q&&q.now&&q.now.slice(0,10)===d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())?q:null}catch(e){return null}
}
async function load(){
  const m=mutSeq,n=++loadSeq;
  try{
    const q=await call('get_queue',{limit});
    if(n!==loadSeq)return;
    if(inflight>0||m!==mutSeq){if(!inflight)setTimeout(load,300);return} // the last save to finish refreshes
    if(!EMBEDDED)try{localStorage.setItem(QKEY,JSON.stringify(q))}catch(e){}
    render(q);
  }catch(e){showErr(e)}
}

// ---------- start ----------
if(EMBEDDED){
  document.body.classList.add('embedded');
  new ResizeObserver(reportSize).observe(document.body);
  rpc('ui/initialize',{appInfo:{name:'cue-queue',version:'1.1.0'},appCapabilities:{},protocolVersion:'2026-01-26'})
    .then(r=>{applyHost(r?.hostContext);notify('ui/notifications/initialized',{});
      // If the host doesn't push a tool result (e.g. the view was opened later), fetch it ourselves.
      setTimeout(()=>{if(!last)load()},1500)})
    .catch(showErr);
}else{
  if(WIDGET)document.body.classList.add('widget');
  // Coming back after a while reloads the whole page, so the installed app picks up new
  // versions instead of running yesterday's code with fresh data.
  let hiddenAt=0;
  // Open on the last queue seen today (stored on this device) while the live one loads.
  const c=cachedQueue();if(c)render(c);
  load().then(()=>{if(new URLSearchParams(location.search).get('mood')){history.replaceState(null,'','/');askMood(null,'')}}); // a check-in ping opens the loggerdocument.addEventListener('visibilitychange',()=>{if(document.hidden){hiddenAt=Date.now();return}if(hiddenAt&&Date.now()-hiddenAt>10*60*1000)location.reload();else load()});
  if(WIDGET)setInterval(load,5*60*1000); // widgets stay open, so keep it fresh
  if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').then(()=>checkPush()).catch(()=>{});
}
</script></body></html>`;
