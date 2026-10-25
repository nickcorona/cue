// Cue Lift: the phone screen for logging workouts (served at /lift by api/web.js).
// Home shows today's workout and the week's volume; a session lists every exercise with
// last time's numbers and today's targets prefilled, so a set is one tap on ✓.
import { THEME_CSS } from './ui.js';

const CSS = `
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
.link{background:none;border:0;color:var(--mute);font-size:13.5px;padding:6px 0;text-decoration:none}
.card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:16px;margin-bottom:12px}
.today .name{font-size:22px;font-weight:650;letter-spacing:-.01em;margin:2px 0 6px}
.today .list{color:var(--soft);font-size:13.5px;margin-bottom:14px}
.big{display:block;width:100%;border:0;border-radius:12px;padding:15px;font-size:16px;font-weight:650;background:var(--accent);color:var(--on-accent)}
.big.alt{background:var(--raised);color:var(--ink)}
.resume{border-color:var(--accent);background:var(--accent-dim)}
h2{font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--mute);font-weight:650;margin:22px 2px 10px}
.vol{display:grid;grid-template-columns:92px 1fr 44px;gap:8px 10px;align-items:center;font-size:13px}
.vol .bar{height:8px;background:var(--raised);border-radius:8px;overflow:hidden}
.vol .bar i{display:block;height:100%;background:var(--accent);border-radius:8px}
.vol .n{color:var(--mute);text-align:right;font-variant-numeric:tabular-nums}
.vol .ok{color:var(--accent)}
.row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 0;border-top:1px solid var(--line)}
.row:first-child{border-top:0}
.row .sub{font-size:12.5px;color:var(--mute)}
.small{border:0;background:var(--raised);border-radius:9px;padding:8px 12px;font-size:13px;font-weight:600}

/* session */
.bar-top{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:10px;background:var(--bg);padding:12px 0 10px;margin:-16px 0 8px;border-bottom:1px solid var(--line)}
.bar-top .t{flex:1;min-width:0}
.bar-top .t b{display:block;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bar-top .t span{font-size:12.5px;color:var(--mute);font-variant-numeric:tabular-nums}
.back{border:0;background:var(--raised);width:38px;height:38px;border-radius:10px;font-size:20px;line-height:1}
.finish{border:0;background:var(--accent);color:var(--on-accent);border-radius:10px;padding:9px 14px;font-weight:650}
.ex{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:14px 14px 8px;margin-bottom:12px;transition:opacity .2s}
.ex.current{border-color:var(--accent)}
.ex.complete{opacity:.6}
.ex .head{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.ex .nm{font-size:16.5px;font-weight:650}
.ex .scheme{font-size:12.5px;color:var(--mute);white-space:nowrap}
.ex .last{font-size:12.5px;color:var(--soft);margin:3px 0 6px}
.ex .up{display:inline-block;font-size:11.5px;font-weight:650;color:var(--accent);background:var(--accent-dim);border-radius:6px;padding:2px 7px;margin-left:6px}
.ex .note{font-size:12.5px;color:var(--mute)}
.ex .summary{font-size:13px;color:var(--soft);padding:2px 0 8px}
.set{display:flex;align-items:center;gap:6px;padding:7px 0;border-top:1px solid var(--line)}
.set .no{flex:none;width:26px;height:26px;border-radius:50%;background:var(--raised);display:grid;place-items:center;font-size:12px;font-weight:650;color:var(--soft)}
.set.active .no{background:var(--accent);color:var(--on-accent)}
.set.logged .no{background:var(--accent-dim);color:var(--accent)}
.step{display:flex;align-items:center;background:var(--raised);border-radius:11px;height:44px;min-width:0;flex:0 1 auto}
.step button{flex:none;border:0;background:none;width:32px;height:44px;font-size:20px;color:var(--soft)}
.step input{width:44px;min-width:0;border:0;background:none;text-align:center;font:inherit;font-size:16.5px;font-weight:650;color:var(--ink);padding:0;-moz-appearance:textfield}
.step input::-webkit-outer-spin-button,.step input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.step .u{font-size:10.5px;color:var(--mute);margin-right:2px}
.x{color:var(--mute);font-size:13px}
.val{flex:1;font-size:15.5px;font-weight:600}
.val .u{font-size:12px;color:var(--mute);font-weight:500}
.tick{flex:none;margin-left:auto;width:44px;height:44px;border-radius:12px;border:0;background:var(--raised);color:var(--soft);font-size:20px;font-weight:700}
.set.active .tick{background:var(--accent);color:var(--on-accent)}
.set.logged .tick{background:var(--accent-dim);color:var(--accent)}
.set .lbl{flex:1;font-size:14.5px;color:var(--soft)}
.skipex{border:0;background:none;color:var(--mute);font-size:12.5px;padding:8px 0 4px}
.rest{position:fixed;left:0;right:0;bottom:0;z-index:10;background:var(--panel);border-top:1px solid var(--line);padding:12px 16px calc(12px + env(safe-area-inset-bottom));transform:translateY(110%);transition:transform .25s ease}
.rest.on{transform:none}
.rest .in{max-width:560px;margin:0 auto;display:flex;align-items:center;gap:12px}
.rest .clock{font-size:26px;font-weight:700;font-variant-numeric:tabular-nums;min-width:74px}
.rest .info{flex:1;min-width:0;font-size:12.5px;color:var(--mute)}
.rest .info b{display:block;color:var(--ink);font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rest .prog{position:absolute;left:0;top:0;height:3px;background:var(--accent);transition:width 1s linear}
.rest.go .clock{color:var(--accent)}
.sync{font-size:12px;color:var(--mute);text-align:center;margin-top:8px}

/* summary */
.done{text-align:center;padding:28px 8px 8px}
.done .ring{width:72px;height:72px;border-radius:50%;background:var(--accent-dim);color:var(--accent);display:grid;place-items:center;font-size:36px;margin:0 auto 14px}
.stats3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:18px 0}
.stats3 div{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px 6px;text-align:center}
.stats3 b{display:block;font-size:20px}
.stats3 span{font-size:12px;color:var(--mute)}
.pr{display:flex;justify-content:space-between;padding:10px 12px;background:var(--accent-dim);border-radius:10px;margin-bottom:6px;font-size:14px}
.pr b{color:var(--accent)}
.err{color:var(--warn-ink);background:var(--warn-dim);border-radius:10px;padding:10px 12px;margin-bottom:10px;font-size:13px}
.empty{color:var(--mute);font-size:13.5px}
`;

const JS = `
const KEY='__KEY__';
let ST=null, SES=null, SUM=null, editing=null, restT=null, restEnd=0, restTotal=0, tick=null, wake=null;
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], LONG=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const mmss=s=>Math.floor(s/60)+':'+String(Math.max(0,Math.floor(s%60))).padStart(2,'0');
const SHOWN=['chest','side delts','rear delts','back','biceps','triceps'];

// ---------- server ----------
async function call(name,args){
  const r=await fetch('/mcp/'+KEY,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args||{}}})});
  const j=await r.json(); const res=j.result;
  if(!res||res.isError)throw new Error(res&&res.content&&res.content[0].text||'Server error');
  return JSON.parse(res.content[0].text);
}
// Sets are saved in the background; if the gym has no signal they wait here and retry.
const QKEY='cue-lift-pending';
const pend=()=>{try{return JSON.parse(localStorage.getItem(QKEY)||'[]')}catch(e){return []}};
const setPend=a=>{try{localStorage.setItem(QKEY,JSON.stringify(a))}catch(e){}};
let flushing=false;
async function flush(){
  if(flushing)return;flushing=true;
  let q=pend();
  while(q.length){
    try{await call('lift_log',q[0]);q.shift();setPend(q)}catch(e){break}
  }
  flushing=false;syncNote();
}
function syncNote(){const n=pend().length, el=$('#sync');if(el)el.textContent=n?n+' set'+(n===1?'':'s')+' waiting to sync':''}
setInterval(flush,10000);addEventListener('online',flush);

function err(e){const m=$('#msg');if(m){m.innerHTML='<div class="err">'+esc(e.message||e)+'</div>';setTimeout(()=>{m.innerHTML=''},6000)}}

// ---------- home ----------
async function home(){
  SES=null;SUM=null;stopRest();releaseWake();
  try{ST=await call('lift_status')}catch(e){$('#app').innerHTML='<div class="err">'+esc(e.message)+'</div>';return}
  const t=ST.today, d=new Date(t+'T12:00:00');
  let h='<div class="top"><div class="brand">'+MARK+'<div><div class="kicker">'+LONG[d.getDay()]+', '+MONTHS[d.getMonth()]+' '+d.getDate()+'</div><div class="h1">Lift</div></div></div><a class="link" href="/">Queue ›</a></div><div id="msg"></div>';
  if(ST.open){
    const n=ST.open.exercises.reduce((a,e)=>a+e.logged.length,0);
    h+='<div class="card resume"><div class="kicker">In progress</div><div class="h1" style="margin:2px 0 10px">'+esc(ST.open.name)+' · '+n+' set'+(n===1?'':'s')+' logged</div><button class="big" data-start="'+ST.open.habit_id+'">Resume</button></div>';
  }
  const due=ST.due&&ST.programs.find(p=>p.habit_id===ST.due);
  if(due&&!(ST.open&&ST.open.habit_id===due.habit_id)){
    h+='<div class="card today"><div class="kicker">Today</div><div class="name">'+esc(due.name)+'</div><div class="list">'+due.exercises+' exercises'+(due.time?' · planned '+clock(due.time):'')+'</div><button class="big" data-start="'+due.habit_id+'">Start workout</button></div>';
  }else if(!ST.open){
    const dow=new Date(ST.today+'T12:00:00').getDay(), doneToday=ST.programs.find(p=>p.done_today&&p.days.includes(dow));
    const next=nextUp();
    if(doneToday)h+='<div class="card"><div class="kicker">Today</div><div class="h1" style="margin-top:2px">'+esc(doneToday.name)+' done ✓</div><div class="empty" style="margin-top:4px">'+(next?'Next: '+next:'')+'</div></div>';
    else
    h+='<div class="card"><div class="kicker">Today</div><div class="h1" style="margin-top:2px">Rest day</div><div class="empty" style="margin-top:4px">'+(next?'Next: '+next:'No workouts scheduled')+'</div></div>';
  }
  h+='<h2>This week</h2><div class="card"><div class="vol">'+SHOWN.map(m=>{const n=ST.week.sets[m]||0,p=Math.min(100,n/ST.week.target*100);return '<span>'+cap(m)+'</span><div class="bar"><i style="width:'+p+'%"></i></div><span class="n'+(n>=ST.week.target?' ok':'')+'">'+n+'/'+ST.week.target+'</span>'}).join('')+'</div></div>';
  const others=ST.programs.filter(p=>p.habit_id!==ST.due&&!(ST.open&&ST.open.habit_id===p.habit_id));
  if(others.length)h+='<h2>Other workouts</h2><div class="card">'+others.map(p=>'<div class="row"><div><div>'+esc(p.name)+'</div><div class="sub">'+(p.days.length?p.days.map(x=>DAYS[x]).join(', '):'any day')+(p.done_today?' · done today':'')+'</div></div><button class="small" data-start="'+p.habit_id+'">Start</button></div>').join('')+'</div>';
  if(ST.recent.length)h+='<h2>Recent</h2><div class="card">'+ST.recent.map(r=>'<div class="row"><div><div>'+esc(r.name)+'</div><div class="sub">'+niceDate(r.date)+'</div></div><div class="sub">'+r.sets+' sets · '+r.minutes+' min</div></div>').join('')+'</div>';
  $('#app').innerHTML=h;
  document.querySelectorAll('[data-start]').forEach(b=>b.addEventListener('click',()=>start(b.dataset.start)));
}
const cap=s=>s[0].toUpperCase()+s.slice(1);
function clock(hm){const h=+hm.slice(0,2),m=hm.slice(3,5);return ((h+11)%12+1)+(m==='00'?'':':'+m)+(h<12?'am':'pm')}
function niceDate(d){const x=new Date(d+'T12:00:00');return DAYS[x.getDay()]+' '+MONTHS[x.getMonth()]+' '+x.getDate()}
function nextUp(){
  const t=new Date(ST.today+'T12:00:00').getDay();
  for(let k=1;k<=7;k++){const dow=(t+k)%7;const p=ST.programs.find(p=>p.days.includes(dow));if(p)return (k===1?'tomorrow':DAYS[dow])+' · '+p.name}
  return null;
}

// ---------- session ----------
async function start(hid){
  $('#app').innerHTML='<div class="empty" style="padding:30px 0;text-align:center">Loading…</div>';
  try{SES=await call('lift_start',{habit_id:hid})}catch(e){home().then(()=>err(e));return}
  history.replaceState(null,'','/lift?session='+SES.id);
  keepAwake();renderSession();scrollToActive();
  clearInterval(tick);tick=setInterval(()=>{const el=$('#elapsed');if(el&&SES)el.textContent=mmss((Date.now()-Date.parse(SES.started))/1000)},1000);
}
// Value currently shown for a set: what was logged, else the edit buffer, else the target.
const buf={};
function valueOf(ex,i){
  const k=ex.key+':'+i, lg=ex.logged.find(s=>s.i===i);
  if(buf[k])return buf[k];
  if(lg&&editing!==k)return {weight:lg.weight,reps:lg.reps};
  const t=ex.sets[i]||ex.sets[ex.sets.length-1]||{};
  return {weight:t.weight,reps:t.reps};
}
function activeSet(){
  for(const ex of SES.exercises){if(ex.skipped)continue;for(let i=0;i<ex.sets.length;i++)if(!ex.logged.some(s=>s.i===i))return ex.key+':'+i}
  return null;
}
function lastLine(ex){
  if(!ex.last)return ex.kind==='check'?'':ex.kind==='bodyweight'?'First time: as many clean reps as you can, then log them':'First time: pick a weight you could lift about '+(ex.max+2)+' times';
  if(ex.kind==='check')return '';
  return 'Last ('+niceDate(ex.last.date)+'): '+ex.last.sets.map(s=>fmtW(s.weight,ex)+(s.weight||ex.kind!=='bodyweight'?'×':'')+s.reps).join(', ');
}
function fmtW(w,ex){if(ex.kind==='bodyweight')return w?'+'+w:'';return w==null?'?':String(w)}
function renderSession(){
  const act=activeSet(), total=SES.exercises.reduce((a,e)=>a+(e.skipped?0:e.sets.length),0), done=SES.exercises.reduce((a,e)=>a+e.logged.length,0);
  let h='<div class="bar-top"><button class="back" id="back" aria-label="Back">‹</button><div class="t"><b>'+esc(SES.name)+'</b><span><span id="elapsed">'+mmss((Date.now()-Date.parse(SES.started))/1000)+'</span> · '+done+'/'+total+' sets</span></div><button class="finish" id="finish">Finish</button></div><div id="msg"></div>';
  for(const ex of SES.exercises){
    const complete=ex.skipped||ex.logged.length>=ex.sets.length, current=act&&act.startsWith(ex.key+':');
    const scheme=ex.kind==='check'?ex.sets.length+' sets'+(ex.note?' · '+ex.note:''):ex.sets.length+' × '+ex.min+(ex.max!==ex.min?'–'+ex.max:'')+(ex.kind==='bodyweight'?' · bodyweight':'');
    h+='<div class="ex'+(current?' current':'')+(complete&&!current?' complete':'')+'" id="ex-'+ex.key+'"><div class="head"><div class="nm">'+esc(ex.name)+(ex.level_up&&!complete?'<span class="up">↑ heavier</span>':'')+'</div><div class="scheme">'+esc(scheme)+'</div></div>';
    if(ex.kind!=='check'&&ex.note)h+='<div class="note">'+esc(ex.note)+'</div>';
    const ll=lastLine(ex);if(ll&&!complete)h+='<div class="last">'+esc(ll)+'</div>';
    if(complete&&!current&&!ex.open){
      h+='<div class="summary" data-open="'+ex.key+'">'+(ex.skipped?'Skipped':'✓ '+(ex.kind==='check'?ex.logged.length+' sets':ex.logged.map(s=>fmtW(s.weight,ex)+(s.weight||ex.kind!=='bodyweight'?'×':'')+s.reps).join(', ')))+' <span style="color:var(--mute)">· edit</span></div></div>';
      continue;
    }
    for(let i=0;i<ex.sets.length;i++){
      const k=ex.key+':'+i, lg=ex.logged.find(s=>s.i===i), isAct=k===act||k===editing, v=valueOf(ex,i);
      h+='<div class="set'+(isAct?' active':'')+(lg&&k!==editing?' logged':'')+'" data-k="'+k+'"><span class="no">'+(i+1)+'</span>';
      if(ex.kind==='check'){
        h+='<span class="lbl">'+(ex.note?esc(ex.note):'Set '+(i+1))+'</span>';
      }else if(isAct){
        h+='<div class="step"><button data-w="-1" aria-label="Less weight">−</button><input inputmode="decimal" type="number" data-wi="'+k+'" value="'+(v.weight==null?'':v.weight)+'" placeholder="'+(ex.kind==='bodyweight'?'+0':'wt')+'"><span class="u">'+(ex.kind==='bodyweight'?'+':'')+SES.unit+'</span><button data-w="1" aria-label="More weight">+</button></div>'+
           '<div class="step"><button data-r="-1" aria-label="Fewer reps">−</button><input inputmode="numeric" type="number" data-ri="'+k+'" value="'+(v.reps==null?'':v.reps)+'"><button data-r="1" aria-label="More reps">+</button></div>';
      }else{
        h+='<span class="val">'+(ex.kind==='bodyweight'?(v.weight?'+'+v.weight+' <span class="u">'+SES.unit+'</span> × ':'BW × '):(v.weight==null?'<span class="u">set weight</span> × ':v.weight+' <span class="u">'+SES.unit+'</span> × '))+(v.reps==null?'':v.reps)+'</span>';
      }
      h+='<button class="tick" data-tick="'+k+'" aria-label="'+(lg?'Logged':'Log set')+'">✓</button></div>';
    }
    if(!complete)h+='<button class="skipex" data-skip="'+ex.key+'">Skip exercise</button>';
    h+='</div>';
  }
  h+='<div class="sync" id="sync"></div>';
  $('#app').innerHTML=h;syncNote();
  $('#back').onclick=()=>{history.replaceState(null,'','/lift');home()};
  $('#finish').onclick=finish;
  document.querySelectorAll('[data-tick]').forEach(b=>b.addEventListener('click',()=>logSet(b.dataset.tick)));
  document.querySelectorAll('.set:not(.active)').forEach(r=>r.addEventListener('click',e=>{if(e.target.closest('[data-tick]'))return;editing=r.dataset.k;renderSession()}));
  document.querySelectorAll('[data-open]').forEach(r=>r.addEventListener('click',()=>{const ex=SES.exercises.find(e=>e.key===r.dataset.open);ex.open=true;renderSession()}));
  document.querySelectorAll('[data-skip]').forEach(b=>b.addEventListener('click',()=>{const ex=SES.exercises.find(e=>e.key===b.dataset.skip);ex.skipped=true;renderSession();scrollToActive()}));
  document.querySelectorAll('.set.active').forEach(row=>{
    const k=row.dataset.k, [key,i]=k.split(':'), ex=SES.exercises.find(e=>e.key===key);
    const cur=()=>buf[k]||(buf[k]={...valueOf(ex,+i)});
    const inc=SES.unit==='kg'?2.5:5;
    row.querySelectorAll('[data-w]').forEach(b=>b.onclick=()=>{const c=cur();c.weight=Math.max(0,(+c.weight||0)+inc*b.dataset.w);row.querySelector('[data-wi]').value=c.weight});
    row.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{const c=cur();c.reps=Math.max(0,(+c.reps||0)+ +b.dataset.r);row.querySelector('[data-ri]').value=c.reps});
    const wi=row.querySelector('[data-wi]'), ri=row.querySelector('[data-ri]');
    if(wi)wi.oninput=()=>{cur().weight=wi.value===''?null:+wi.value};
    if(ri)ri.oninput=()=>{cur().reps=ri.value===''?null:+ri.value};
  });
}
function scrollToActive(){const a=$('.set.active')||$('.ex.current');if(a)a.scrollIntoView({behavior:'smooth',block:'center'})}

async function logSet(k){
  const [key,is]=k.split(':'), i=+is, ex=SES.exercises.find(e=>e.key===key);
  const lg=ex.logged.find(s=>s.i===i);
  if(lg&&editing!==k){editing=k;renderSession();return} // tap a logged set to edit it
  const v=valueOf(ex,i);
  if(ex.kind==='weight'&&(v.weight==null||v.weight==='')){err(new Error('Enter the weight first'));return}
  if(ex.kind!=='check'&&!v.reps){err(new Error('Enter the reps first'));return}
  const set={key,i,...(ex.kind!=='check'?{weight:+v.weight||0,reps:+v.reps}:{})};
  ex.logged=ex.logged.filter(s=>s.i!==i).concat({...set,at:new Date().toISOString()});
  delete buf[k];const wasEdit=editing===k;editing=null;
  // Carry an adjusted weight forward to the rest of this exercise's sets.
  if(set.weight!=null)for(let j=i+1;j<ex.sets.length;j++)if(!ex.logged.some(s=>s.i===j)&&ex.sets[j].weight!==set.weight&&ex.kind!=='check')ex.sets[j]={...ex.sets[j],weight:set.weight};
  if(navigator.vibrate)navigator.vibrate(15);
  renderSession();
  if(!wasEdit){startRest(ex.rest,nextLabel());scrollToActive()}
  const q=pend();q.push({session_id:SES.id,...set});setPend(q);flush();
}
function nextLabel(){const a=activeSet();if(!a)return 'All sets done';const [key,i]=a.split(':');const ex=SES.exercises.find(e=>e.key===key);return ex.name+' · set '+(+i+1)}

// ---------- rest timer ----------
function startRest(sec,next){
  stopRest();restTotal=sec;restEnd=Date.now()+sec*1000;
  const el=$('#rest');el.classList.add('on');el.classList.remove('go');
  el.querySelector('.info b').textContent=next;
  const step=()=>{
    const left=(restEnd-Date.now())/1000;
    el.querySelector('.clock').textContent=left>0?mmss(Math.ceil(left)):'Go';
    el.querySelector('.prog').style.width=Math.max(0,Math.min(100,(1-left/restTotal)*100))+'%';
    if(left<=0){el.classList.add('go');if(navigator.vibrate)navigator.vibrate([200,100,200]);clearInterval(restT);restT=setTimeout(stopRest,4000)}
  };
  step();restT=setInterval(step,250);
}
function stopRest(){clearInterval(restT);clearTimeout(restT);const el=$('#rest');if(el)el.classList.remove('on','go')}

// ---------- finish ----------
async function finish(){
  const total=SES.exercises.reduce((a,e)=>a+(e.skipped?0:e.sets.length),0), done=SES.exercises.reduce((a,e)=>a+e.logged.length,0);
  if(!done){if(confirm('Nothing logged yet. Discard this workout?')){await call('lift_finish',{session_id:SES.id,discard:true}).catch(()=>{});history.replaceState(null,'','/lift');home()}return}
  if(done<total&&!confirm('Finish with '+done+' of '+total+' sets?'))return;
  stopRest();
  await flush();
  if(pend().length){err(new Error('Some sets have not synced yet. Check the connection and try again.'));return}
  try{SUM=await call('lift_finish',{session_id:SES.id})}catch(e){err(e);return}
  releaseWake();clearInterval(tick);history.replaceState(null,'','/lift');
  let h='<div class="done"><div class="ring">✓</div><div class="h1">'+esc(SUM.name)+' done</div><div class="empty">'+(SUM.habit_checked?'Checked off in Cue':'')+'</div></div>';
  h+='<div class="stats3"><div><b>'+SUM.minutes+'</b><span>minutes</span></div><div><b>'+SUM.sets+'</b><span>sets</span></div><div><b>'+(SUM.volume>=1000?(SUM.volume/1000).toFixed(1)+'k':SUM.volume)+'</b><span>'+SUM.unit+' lifted</span></div></div>';
  if(SUM.prs.length)h+='<h2>Personal records</h2>'+SUM.prs.map(p=>'<div class="pr"><span>'+esc(p.name)+'</span><b>'+(p.weight?p.weight+' '+SUM.unit+' × ':'')+p.reps+'</b></div>').join('');
  h+='<button class="big" style="margin-top:20px" id="ok">Done</button>';
  $('#app').innerHTML=h;$('#ok').onclick=home;
  if(navigator.vibrate)navigator.vibrate([30,60,30]);
}

// Keep the screen on during a workout so the phone doesn't lock between sets.
async function keepAwake(){try{if('wakeLock' in navigator)wake=await navigator.wakeLock.request('screen')}catch(e){}}
function releaseWake(){try{wake&&wake.release()}catch(e){}wake=null}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&SES)keepAwake()});

// ---------- start ----------
const qs=new URLSearchParams(location.search);
if(qs.get('start'))start(qs.get('start'));
else home().then(()=>{if(qs.get('session')&&ST&&ST.open)start(ST.open.habit_id)});
flush();
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
`;

export function renderLift({ key = '', mark = '' } = {}) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex"><title>Cue · Lift</title>
<link rel="manifest" href="/manifest.webmanifest"><meta name="theme-color" content="#111214">
<link rel="icon" href="/icons/icon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/icons/apple-touch-180.png">
<style>${THEME_CSS}${CSS}</style></head>
<body><main><div id="app"></div></main>
<div class="rest" id="rest"><div class="prog"></div><div class="in"><div class="clock">0:00</div><div class="info">Rest, then<b></b></div><button class="small" id="plus30">+30s</button><button class="small" id="skiprest">Skip</button></div></div>
<script>const MARK=${JSON.stringify(mark)};${JS.replace('__KEY__', encodeURIComponent(key))}
document.getElementById('plus30').onclick=()=>{restEnd+=30000;restTotal+=30};
document.getElementById('skiprest').onclick=()=>stopRest();</script></body></html>`;
}
