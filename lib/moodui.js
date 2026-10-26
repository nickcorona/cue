// Cue Mood: log what you're doing and how you feel, see which activities lift it (served at /mood).
import { screenPage } from './screen.js';

const CSS = `
.act{width:100%;border:0;background:var(--raised);border-radius:10px;padding:11px 12px;font:inherit;font-size:15px;color:var(--ink);margin-bottom:12px}
.scale{display:grid;grid-template-columns:repeat(11,1fr);gap:4px}
.scale button{border:1px solid var(--line);background:var(--raised);border-radius:9px;padding:11px 0;font-size:15px;font-weight:650;font-variant-numeric:tabular-nums}
.scale button:active,.scale button.on{background:var(--accent);color:var(--on-accent);border-color:var(--accent)}
.ends{display:flex;justify-content:space-between;font-size:11.5px;color:var(--mute);margin-top:5px}
.tl .row{justify-content:flex-start}
.tl .t{font-size:13px;color:var(--mute);width:58px;flex:none;font-variant-numeric:tabular-nums}
.tl .m{width:30px;flex:none;font-weight:700;font-variant-numeric:tabular-nums}
.tl .a{flex:1;min-width:0}
.tl .x{border:0;background:none;color:var(--mute);font-size:18px;padding:0 4px}
.chart svg{display:block;width:100%;height:auto}
.chart .lbl{display:flex;justify-content:space-between;font-size:11.5px;color:var(--mute);margin-top:4px}
.fam .l{flex:1;min-width:0}
.fam .lift{font-weight:700;font-variant-numeric:tabular-nums;min-width:44px;text-align:right}
.fam .up{color:var(--accent)}
.fam .down{color:var(--warn-ink)}
.fam.thin{opacity:.45}
.fam .acts{display:flex;gap:6px}
.base{font-size:13px;color:var(--mute);margin:-4px 2px 10px}
.set{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:14px}
.set input[type=time]{font:inherit;background:var(--raised);border:0;border-radius:8px;padding:5px 8px;color:var(--ink);color-scheme:var(--scheme)}
.small.on{background:var(--accent);color:var(--on-accent)}
`;

const JS = `
let ST=null;
const fmt=x=>(x>0?'+':x<0?'\\u2212':'')+Math.abs(x).toFixed(1);

async function home(){
  try{ST=await call('mood_status')}catch(e){$('#app').innerHTML='<div class="err">'+esc(e.message)+'</div>';return}
  render();
}
function render(){
  const keep=$('#act')?$('#act').value:'';
  let h=header('Mood');
  h+='<div class="card"><input class="act" id="act" list="fams" autocomplete="off" placeholder="What are you doing?" value="'+esc(keep)+'"><datalist id="fams">'+ST.families.map(f=>'<option value="'+esc(f)+'">').join('')+'</datalist>'+
    '<div class="scale">'+[0,1,2,3,4,5,6,7,8,9,10].map(n=>'<button data-m="'+n+'">'+n+'</button>').join('')+'</div><div class="ends"><span>awful</span><span>great</span></div></div>';
  h+='<h2>Today</h2><div class="card tl" style="padding:4px 16px">'+(ST.entries_today.length?ST.entries_today.map(e=>'<div class="row"><span class="t">'+clock(e.time)+'</span><span class="m">'+e.mood+'</span><span class="a">'+esc(e.activity)+(e.family&&e.family!==e.activity.toLowerCase()?'<div class="sub">'+esc(e.family)+'</div>':'')+'</span><button class="x" aria-label="Delete" data-del="'+esc(e.id)+'">\\u00d7</button></div>').join(''):'<div class="row empty">Nothing logged yet today.</div>')+'</div>';
  h+='<h2>Last 14 days</h2><div class="card chart">'+chart(ST.daily,ST.insights.baseline)+'</div>';
  const ins=ST.insights;
  h+='<h2>What moves your mood</h2>';
  if(!ins.families.length)h+='<div class="card empty">Log a few entries and this fills in.</div>';
  else{
    h+='<div class="base">Against your 14-day average of '+ins.baseline.toFixed(1)+' ('+ins.entries+' entries). Families need 3+ entries to count.</div><div class="card" style="padding:4px 16px">'+ins.families.map(fam).join('')+'</div>';
  }
  h+='<h2>Check-in pings</h2><div class="card"><div class="set"><span>Every 2 hours, from 2 hours after waking until an hour before bed'+(ST.pings.bedtime?' ('+clock(ST.pings.bedtime)+')':'')+'</span><button class="small'+(ST.pings.on?' on':'')+'" id="ping">'+(ST.pings.on?'On':'Off')+'</button></div>'+
    '<div class="set" style="margin-top:10px"><span>I usually wake at</span><input type="time" id="wake" value="'+esc(ST.pings.wake)+'"></div></div>';
  $('#app').innerHTML=h;
  document.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>log(+b.dataset.m,b));
  document.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>del(b.dataset.del));
  document.querySelectorAll('[data-sched]').forEach(b=>b.onclick=()=>{const a=b.parentNode;a.innerHTML='<button class="small" data-as="habit">Habit</button><button class="small" data-as="task">Task</button>';a.querySelectorAll('[data-as]').forEach(x=>x.onclick=()=>schedule(b.dataset.sched,x.dataset.as,a))});
  $('#ping').onclick=async()=>{try{await call('settings',{push:{mood:!ST.pings.on}});home()}catch(e){err(e)}};
  $('#wake').onchange=async e=>{try{await call('settings',{wake:e.target.value});home()}catch(x){err(x)}};
}
function fam(f){
  const lifter=!f.low_n&&f.lift>0;
  return '<div class="row fam'+(f.low_n?' thin':'')+'"><div class="l">'+esc(f.family)+'<div class="sub">'+f.n+' entr'+(f.n===1?'y':'ies')+' \\u00b7 avg '+f.avg.toFixed(1)+'</div></div>'+
    (lifter?'<span class="acts">'+(ST.scheduled.includes(f.family)?'<span class="sub">Scheduled</span>':'<button class="small" data-sched="'+esc(f.family)+'">Schedule</button>')+'</span>':'')+
    '<span class="lift'+(f.low_n?'':f.lift>0?' up':f.lift<0?' down':'')+'">'+fmt(f.lift)+'</span></div>';
}
// Daily averages as a line on a 0-10 scale, broken on days with no entries; dashed baseline.
function chart(days,base){
  const W=320,H=120,P=8,x=i=>P+i*(W-2*P)/(days.length-1),y=v=>P+(10-v)*(H-2*P)/10;
  let path='',pen=false,dots='';
  days.forEach((d,i)=>{if(d.avg==null){pen=false;return}path+=(pen?'L':'M')+x(i).toFixed(1)+' '+y(d.avg).toFixed(1);pen=true;dots+='<circle cx="'+x(i).toFixed(1)+'" cy="'+y(d.avg).toFixed(1)+'" r="3" fill="var(--accent)"/>'});
  const grid=[0,5,10].map(v=>'<line x1="'+P+'" x2="'+(W-P)+'" y1="'+y(v)+'" y2="'+y(v)+'" stroke="var(--line)"/>').join('');
  const bl=base==null?'':'<line x1="'+P+'" x2="'+(W-P)+'" y1="'+y(base)+'" y2="'+y(base)+'" stroke="var(--mute)" stroke-dasharray="3 4"/>';
  const any=days.some(d=>d.avg!=null);
  return '<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Daily average mood">'+grid+bl+'<path d="'+path+'" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>'+dots+'</svg>'+
    '<div class="lbl"><span>'+niceDate(days[0].date)+'</span><span>'+(any?'':'No entries yet')+'</span><span>Today</span></div>';
}
async function log(m,b){
  const act=$('#act').value.trim();
  if(!act){err('Say what you\\u2019re doing first');$('#act').focus();return}
  b.classList.add('on');
  try{await call('log_mood',{mood:m,activity:act,via:'web'});$('#act').value='';home()}catch(e){b.classList.remove('on');err(e)}
}
async function del(id){
  if(!confirm('Delete this entry?'))return;
  try{await call('delete_mood',{id});home()}catch(e){err(e)}
}
async function schedule(f,as,el){
  try{
    if(as==='habit')await call('save_habit',{name:cap(f),behavior:f,notes:'Scheduled from Mood: lifts mood above baseline.'});
    else await call('add_tasks',{tasks:[{title:'Make time for '+f,est_min:30,project:'Health & fitness',impact:{consequence:'health',magnitude:1},family:f,who:'me',due:ST.today,notes:'Scheduled from Mood: lifts mood above baseline.'}]});
    el.innerHTML='<span class="sub">Added as '+as+'</span>';ST.scheduled.push(f);
  }catch(e){err(e)}
}

const qs=new URLSearchParams(location.search);
home().then(()=>{if(qs.get('log')&&$('#act'))$('#act').focus()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!(document.activeElement&&document.activeElement.id==='act'))home()});
`;

export function renderMood({ key = '' } = {}) {
  return screenPage({ title: 'Mood', css: CSS, key, js: JS });
}
