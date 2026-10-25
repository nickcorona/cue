// Cue Focus: pick a task, run a timed block, log how it went (served at /focus).
import { screenPage } from './screen.js';

const CSS = `
.pick{display:flex;align-items:center;gap:12px;padding:12px 4px;border-top:1px solid var(--line);cursor:pointer}
.pick:first-child{border-top:0}
.pick .dot{flex:none;width:22px;height:22px;border-radius:50%;border:2px solid var(--check-line)}
.pick.on .dot{border:7px solid var(--accent)}
.pick .tt{flex:1;min-width:0}
.pick .tt div{font-size:15px;line-height:1.35}
.pick .tt span{font-size:12px;color:var(--mute)}
.pick input{width:100%;border:0;background:var(--raised);border-radius:9px;padding:9px 11px;font:inherit;color:var(--ink)}
.chips{display:flex;gap:8px;margin:4px 0 14px}
.chip{flex:1;border:1px solid var(--line);background:var(--panel);border-radius:11px;padding:11px 0;font-size:15px;font-weight:600;color:var(--soft)}
.chip.on{border-color:var(--accent);background:var(--accent-dim);color:var(--accent)}
.timer{text-align:center;padding:10px 0 0}
.timer .what{font-size:17px;font-weight:600;margin:6px 16px 18px;line-height:1.35}
.ring{position:relative;width:260px;height:260px;margin:0 auto}
.ring svg{transform:rotate(-90deg)}
.ring .left{position:absolute;inset:0;display:grid;place-items:center;align-content:center}
.ring .left b{font-size:54px;font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.ring .left span{font-size:13px;color:var(--mute)}
.ctrls{display:flex;gap:10px;justify-content:center;margin:22px 0 10px}
.ctrls button{border:0;background:var(--raised);border-radius:12px;padding:13px 18px;font-weight:650;font-size:15px}
.ctrls .fin{background:var(--accent);color:var(--on-accent)}
.paused .ring .left b{color:var(--mute)}
.out{display:grid;gap:10px;margin-top:6px}
.out button{border:0;border-radius:13px;padding:15px;font-size:16px;font-weight:650;text-align:left;background:var(--raised);color:var(--ink)}
.out button span{display:block;font-size:12.5px;font-weight:500;color:var(--mute);margin-top:2px}
.out .primary{background:var(--accent);color:var(--on-accent)}
.out .primary span{color:var(--on-accent);opacity:.75}
.mins{display:flex;align-items:center;justify-content:center;gap:14px;margin:6px 0 18px}
.mins button{border:0;background:var(--raised);width:44px;height:44px;border-radius:12px;font-size:20px}
.mins b{font-size:28px;min-width:70px;text-align:center;font-variant-numeric:tabular-nums}
.proj{display:flex;justify-content:space-between;font-size:13.5px;padding:6px 0;color:var(--soft)}
`;

const JS = `
let ST=null, CUR=null, sel=null, other='', mins=25, tick=null, mlog=0;
const R=118, C=2*Math.PI*R;
const fmtMin=m=>m>=60?Math.floor(m/60)+'h'+(m%60?' '+(m%60)+'m':''):m+'m';

// The running block, stamped with when we received it so elapsed time stays live.
function setCur(x){CUR=x;if(x)CUR._at=Date.now()}
const workedNow=()=>CUR.paused?CUR.worked_s:CUR.worked_s+(Date.now()-CUR._at)/1000;

async function home(){
  setCur(null);clearInterval(tick);
  try{ST=await call('focus_status')}catch(e){$('#app').innerHTML='<div class="err">'+esc(e.message)+'</div>';return}
  if(ST.running){setCur(ST.running);return running()}
  if(sel===null&&qs.get('task'))sel=qs.get('task');
  picker();
}
function picker(){
  clearInterval(tick);
  if(sel===null&&ST.suggestions[0])sel=ST.suggestions[0].id;
  let h=header('Focus');
  if(ST.brk){h+='<div class="card"><div class="kicker">On a break</div><div class="h1" id="brk" style="margin:2px 0 10px">…</div><button class="small" id="skipbrk">Skip the break</button></div>'}
  h+='<h2>What are you working on?</h2><div class="card" style="padding:4px 14px">'+ST.suggestions.map(t=>'<div class="pick'+(sel===t.id?' on':'')+'" data-pick="'+t.id+'"><span class="dot"></span><div class="tt"><div>'+esc(t.title)+'</div><span>~'+fmtMin(t.est_min)+(t.focus==='deep'?' · deep':'')+(t.focused_min?' · '+fmtMin(t.focused_min)+' focused so far':'')+(t.project?' · '+esc(t.project):'')+'</span></div></div>').join('')+
    '<div class="pick'+(sel==='other'?' on':'')+'" data-pick="other"><span class="dot"></span><div class="tt">'+(sel==='other'?'<input id="other" placeholder="Something else…" value="'+esc(other)+'">':'<div>Something else…</div>')+'</div></div></div>';
  h+='<h2>How long?</h2><div class="chips">'+[15,25,50,90].map(m=>'<button class="chip'+(mins===m?' on':'')+'" data-m="'+m+'">'+m+'m</button>').join('')+'</div>';
  h+='<button class="big" id="go">Start focus</button>';
  h+='<h2>Today</h2><div class="card">'+(ST.today_min?'<div class="h1">'+fmtMin(ST.today_min)+' focused</div>'+ST.today_sessions.map(s=>'<div class="proj"><span>'+esc(s.title)+'</span><span>'+s.minutes+'m'+(s.outcome==='done'?' ✓':'')+'</span></div>').join(''):'<div class="empty">Nothing yet today.</div>')+'</div>';
  const wk=Object.entries(ST.week_by_project);
  if(wk.length)h+='<h2>Last 7 days</h2><div class="card">'+wk.sort((a,b)=>b[1]-a[1]).map(([p,m])=>'<div class="proj"><span>'+esc(p)+'</span><span>'+fmtMin(m)+'</span></div>').join('')+'</div>';
  $('#app').innerHTML=h;
  document.querySelectorAll('[data-pick]').forEach(el=>el.addEventListener('click',e=>{if(e.target.id==='other')return;sel=el.dataset.pick;picker()}));
  document.querySelectorAll('[data-m]').forEach(el=>el.addEventListener('click',()=>{mins=+el.dataset.m;picker()}));
  const o=$('#other');if(o){o.oninput=()=>{other=o.value};if(sel==='other'&&!other)o.focus()}
  $('#go').onclick=start;
  if(ST.brk){const end=Date.parse(ST.brk.until);const upd=()=>{const l=(end-Date.now())/1000;const el=$('#brk');if(!el)return;if(l<=0){el.textContent='Break over';clearInterval(tick);return}el.textContent=mmss(Math.ceil(l))+' left'};upd();tick=setInterval(upd,500);$('#skipbrk').onclick=()=>{ST.brk=null;picker()}}
}

async function start(){
  const args={minutes:mins};
  if(sel==='other'){if(!other.trim()){err(new Error('Type what you are working on'));return}args.title=other.trim()}
  else if(sel)args.task_id=sel; else {err(new Error('Pick a task'));return}
  $('#go').disabled=true;
  try{setCur(await call('focus_start',args))}catch(e){err(e);$('#go').disabled=false;return}
  running();
}

function remaining(){return CUR.planned_min*60-workedNow()}
function running(){
  clearInterval(tick);
  const h='<div class="bar-top"><button class="back" id="back" aria-label="Back">‹</button><div class="t"><b>Focus</b><span id="sub">'+CUR.planned_min+' min block</span></div></div><div id="msg"></div>'+
    '<div class="timer'+(CUR.paused?' paused':'')+'"><div class="what">'+esc(CUR.title)+'</div><div class="ring"><svg width="260" height="260"><circle cx="130" cy="130" r="'+R+'" fill="none" stroke="var(--raised)" stroke-width="12"/><circle id="arc" cx="130" cy="130" r="'+R+'" fill="none" stroke="var(--accent)" stroke-width="12" stroke-linecap="round" stroke-dasharray="'+C+'" stroke-dashoffset="0"/></svg><div class="left"><b id="left">'+mmss(Math.max(0,remaining()))+'</b><span id="state">'+(CUR.paused?'paused':'remaining')+'</span></div></div>'+
    '<div class="ctrls"><button id="pause">'+(CUR.paused?'Resume':'Pause')+'</button><button id="plus5">+5 min</button><button class="fin" id="fin">Finish</button></div></div>';
  $('#app').innerHTML=h;
  $('#back').onclick=()=>{location.href='/'};
  $('#pause').onclick=async()=>{try{setCur(await call('focus_pause',{session_id:CUR.id,resume:CUR.paused}));running()}catch(e){err(e)}};
  $('#plus5').onclick=async()=>{try{setCur(await call('focus_pause',{session_id:CUR.id,extend_min:5}));running()}catch(e){err(e)}};
  $('#fin').onclick=outcome;
  let buzzed=false;
  const upd=()=>{
    const l=remaining(), total=CUR.planned_min*60;
    const el=$('#left');if(!el)return clearInterval(tick);
    el.textContent=l>0?mmss(Math.ceil(l)):'0:00';
    $('#arc').setAttribute('stroke-dashoffset',String(C*Math.max(0,Math.min(1,1-l/total))));
    if(l<=0&&!buzzed&&!CUR.paused){buzzed=true;$('#state').textContent="time's up";if(navigator.vibrate)navigator.vibrate([300,150,300]);outcome()}
  };
  upd();tick=setInterval(upd,500);
}

function outcome(){
  clearInterval(tick);
  const worked=Math.max(1,Math.round(workedNow()/60));
  mlog=Math.min(worked,CUR.planned_min+60);
  const hasTask=!!CUR.task_id;
  let h='<div class="bar-top"><button class="back" id="back" aria-label="Back to timer">‹</button><div class="t"><b>How did it go?</b><span>'+esc(CUR.title)+'</span></div></div><div id="msg"></div>';
  h+='<div class="kicker" style="text-align:center;margin-top:14px">Minutes worked</div><div class="mins"><button id="mm">−</button><b id="mv">'+mlog+'</b><button id="mp">+</button></div>';
  h+='<div class="out">'+(hasTask?'<button class="primary" data-o="done">Done ✓<span>Check it off with '+'the real time</span></button>':'')+
     '<button data-o="progress">'+(hasTask?'Made progress':'Log it')+'<span>'+(hasTask?'Log the time, keep the task open':'Log the time')+'</span></button>'+
     '<button data-o="stopped">Didn\\u2019t happen<span>Stop without counting it as progress</span></button></div>';
  $('#app').innerHTML=h;
  $('#back').onclick=running;
  $('#mm').onclick=()=>{mlog=Math.max(0,mlog-5);$('#mv').textContent=mlog};
  $('#mp').onclick=()=>{mlog+=5;$('#mv').textContent=mlog};
  document.querySelectorAll('[data-o]').forEach(b=>b.addEventListener('click',()=>finish(b.dataset.o)));
}

async function finish(o){
  let r;
  try{r=await call('focus_stop',{session_id:CUR.id,outcome:o,minutes:mlog})}catch(e){err(e);return}
  const done=o==='done';
  let h='<div class="done"><div class="ring" style="width:72px;height:72px">'+(done?'✓':'⏱')+'</div><div class="h1">'+(done?'Checked off':o==='stopped'?'Stopped':mlog+' min logged')+'</div><div class="empty">'+esc(r.task||CUR.title)+(r.task_total_min&&r.task?' · '+fmtMin(r.task_total_min)+' total':'')+'</div></div>';
  h+='<div class="out" style="margin-top:20px"><button class="primary" id="brk5">Take a 5-min break<span>Cue pings you when it\\u2019s over</span></button>'+(done?'':'<button id="again">Another block on this<span>'+esc(CUR.title)+'</span></button>')+'<button id="back2">Back to Focus<span>Pick something else</span></button></div>';
  $('#app').innerHTML=h;
  const prev=CUR;
  $('#brk5').onclick=async()=>{await call('focus_stop',{session_id:prev.id,outcome:o,minutes:mlog,break_min:5}).catch(()=>{});sel=prev.task_id||'other';home()};
  const ag=$('#again');if(ag)ag.onclick=async()=>{try{setCur(await call('focus_start',prev.task_id?{task_id:prev.task_id,minutes:prev.planned_min}:{title:prev.title,minutes:prev.planned_min}));running()}catch(e){err(e)}};
  $('#back2').onclick=()=>{sel=null;home()};
}

const qs=new URLSearchParams(location.search);
home();
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!CUR)home()});
`;

export function renderFocus({ key = '' } = {}) {
  return screenPage({ title: 'Focus', css: CSS, key, js: JS });
}
