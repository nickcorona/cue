// Shared core for Cue's purpose-built screens (Lift, Focus): the page shell, base styles,
// and the client helpers every screen needs (server calls, formatting, header, keeping the
// screen awake). A screen supplies its own CSS, body markup and JS on top.
import { THEME_CSS, MARK_SVG } from './ui.js';

const BASE_CSS = `
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html{color-scheme:var(--scheme)}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 var(--font);-webkit-font-smoothing:antialiased}
main{max-width:560px;margin:0 auto;padding:16px 16px 120px}
button{font:inherit;color:inherit;cursor:pointer}
.top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:4px 0 16px}
.brand{display:flex;align-items:center;gap:10px}
.mark{width:30px;height:30px}
.kicker{font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--mute);font-weight:600;line-height:1.2}
.h1{font-size:19px;font-weight:650;line-height:1.2}
.nav{display:flex;gap:14px}
.link{background:none;border:0;color:var(--mute);font-size:13.5px;padding:6px 0;text-decoration:none}
.card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:16px;margin-bottom:12px}
.big{display:block;width:100%;border:0;border-radius:12px;padding:15px;font-size:16px;font-weight:650;background:var(--accent);color:var(--on-accent)}
.big.alt{background:var(--raised);color:var(--ink)}
.big:disabled{opacity:.5}
h2{font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--mute);font-weight:650;margin:22px 2px 10px}
.row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 0;border-top:1px solid var(--line)}
.row:first-child{border-top:0}
.row .sub{font-size:12.5px;color:var(--mute)}
.small{border:0;background:var(--raised);border-radius:9px;padding:8px 12px;font-size:13px;font-weight:600}
.bar-top{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:10px;background:var(--bg);padding:12px 0 10px;margin:-16px 0 8px;border-bottom:1px solid var(--line)}
.bar-top .t{flex:1;min-width:0}
.bar-top .t b{display:block;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bar-top .t span{font-size:12.5px;color:var(--mute);font-variant-numeric:tabular-nums}
.back{border:0;background:var(--raised);width:38px;height:38px;border-radius:10px;font-size:20px;line-height:1}
.done{text-align:center;padding:28px 8px 8px}
.done .ring{width:72px;height:72px;border-radius:50%;background:var(--accent-dim);color:var(--accent);display:grid;place-items:center;font-size:36px;margin:0 auto 14px}
.stats3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:18px 0}
.stats3 div{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px 6px;text-align:center}
.stats3 b{display:block;font-size:20px}
.stats3 span{font-size:12px;color:var(--mute)}
.err{color:var(--warn-ink);background:var(--warn-dim);border-radius:10px;padding:10px 12px;margin-bottom:10px;font-size:13px}
.empty{color:var(--mute);font-size:13.5px}
`;

const BASE_JS = `
const KEY='__KEY__';
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], LONG=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const mmss=s=>Math.floor(s/60)+':'+String(Math.max(0,Math.floor(s%60))).padStart(2,'0');
const cap=s=>s[0].toUpperCase()+s.slice(1);
function clock(hm){const h=+hm.slice(0,2),m=hm.slice(3,5);return ((h+11)%12+1)+(m==='00'?'':':'+m)+(h<12?'am':'pm')}
function niceDate(d){const x=new Date(d+'T12:00:00');return DAYS[x.getDay()]+' '+MONTHS[x.getMonth()]+' '+x.getDate()}
async function call(name,args){
  const r=await fetch('/mcp/'+KEY,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args||{}}})});
  const j=await r.json(); const res=j.result;
  if(!res||res.isError)throw new Error(res&&res.content&&res.content[0].text||'Server error');
  return JSON.parse(res.content[0].text);
}
function err(e){const m=$('#msg');if(m){m.innerHTML='<div class="err">'+esc(e.message||e)+'</div>';setTimeout(()=>{m.innerHTML=''},6000)}}
// Page header: Cue mark, date kicker, screen title, and links to the other screens.
function header(title,date){
  const d=new Date((date||new Date().toISOString().slice(0,10))+'T12:00:00');
  const links=[['/','Queue'],['/focus','Focus'],['/lift','Lift'],['/cook','Cook']].filter(([h])=>h!==location.pathname).map(([h,t])=>'<a class="link" href="'+h+'">'+t+'</a>').join('');
  return '<div class="top"><div class="brand">'+MARK+'<div><div class="kicker">'+LONG[d.getDay()]+', '+MONTHS[d.getMonth()]+' '+d.getDate()+'</div><div class="h1">'+esc(title)+'</div></div></div><div class="nav">'+links+'</div></div><div id="msg"></div>';
}
// Keep the screen on while a session runs, re-acquired when the app comes back.
let wake=null, wantWake=false;
async function keepAwake(){wantWake=true;try{if('wakeLock' in navigator)wake=await navigator.wakeLock.request('screen')}catch(e){}}
function releaseWake(){wantWake=false;try{wake&&wake.release()}catch(e){}wake=null}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&wantWake)keepAwake()});
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
`;

export function screenPage({ title, css = '', body = '', js = '', key = '' }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex"><title>Cue · ${title}</title>
<link rel="manifest" href="/manifest.webmanifest"><meta name="theme-color" content="#111214">
<link rel="icon" href="/icons/icon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/icons/apple-touch-180.png">
<style>${THEME_CSS}${BASE_CSS}${css}</style></head>
<body><main><div id="app"></div></main>${body}
<script>const MARK=${JSON.stringify(MARK_SVG)};${BASE_JS.replace('__KEY__', encodeURIComponent(key))}${js}</script></body></html>`;
}
