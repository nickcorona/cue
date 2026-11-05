// Cue Mood (served at /mood): what makes a good day. Rate the day 0-10 at night, add a line if
// something happened; Cue fills in the rest of the day from the calendar and check-offs and
// shows which of those move his days, plus the friends he hasn't seen in a while.
import { screenPage } from './screen.js';

const CSS = `
.scale{display:grid;grid-template-columns:repeat(11,1fr);gap:4px}
.scale button{border:1px solid var(--line);background:var(--raised);border-radius:9px;padding:12px 0;font-size:15px;font-weight:650;font-variant-numeric:tabular-nums}
.scale button:active,.scale button.on{background:var(--accent);color:var(--on-accent);border-color:var(--accent)}
.ends{display:flex;justify-content:space-between;font-size:11.5px;color:var(--mute);margin-top:5px}
.q{font-size:17px;font-weight:650;margin:0 0 12px}
.line{width:100%;border:0;background:var(--raised);border-radius:10px;padding:11px 12px;font:inherit;font-size:15px;color:var(--ink);margin-top:12px}
.done{display:flex;align-items:baseline;gap:12px}
.done b{font-size:34px;font-variant-numeric:tabular-nums}
.note{font-size:14px;color:var(--soft);line-height:1.45}
.chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:4px}
.chip{font-size:11.5px;font-weight:600;color:var(--soft);background:var(--raised);border-radius:6px;padding:2px 7px}
.eff .l{flex:1;min-width:0}
.eff .v{font-weight:700;font-variant-numeric:tabular-nums;min-width:48px;text-align:right}
.eff .up{color:var(--accent)}.eff .down{color:var(--warn-ink)}
.eff.thin{opacity:.45}
.bar{height:4px;border-radius:2px;background:var(--raised);margin-top:6px;overflow:hidden}
.bar i{display:block;height:100%;background:var(--accent)}
.day .d{width:92px;flex:none;font-size:13px;color:var(--mute)}
.day .r{width:28px;flex:none;font-weight:700;font-variant-numeric:tabular-nums}
.day .a{flex:1;min-width:0}
.person .a{flex:1;min-width:0}
.set{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:14px}
.small.on{background:var(--accent);color:var(--on-accent)}
`;

const JS = `
let G=null, pick=null, editing=false;
const fmt=x=>(x>0?'+':x<0?'\\u2212':'')+Math.abs(x).toFixed(1);
const scale=on=>'<div class="scale">'+[0,1,2,3,4,5,6,7,8,9,10].map(n=>'<button data-r="'+n+'"'+(on===n?' class="on"':'')+'>'+n+'</button>').join('')+'</div><div class="ends"><span>worst</span><span>best</span></div>';

async function home(){
  try{G=await call('good_days')}catch(e){$('#app').innerHTML='<div class="err">'+esc(e.message)+'</div>';return}
  render();
}
function today(){
  const d=G.recent.find(x=>x.date===G.today);
  if(d&&d.rating!=null&&!editing)return '<div class="card"><div class="done"><b>'+d.rating+'</b><span class="note">Today'+(d.note?': '+esc(d.note):'')+'</span></div>'+
    (d.tags.length?'<div class="chips">'+d.tags.map(t=>'<span class="chip">'+esc(t)+'</span>').join('')+'</div>':'')+
    '<div style="margin-top:10px"><button class="small" id="redo">Change</button></div></div>';
  return '<div class="card"><div class="q">How was today?</div>'+scale(pick)+
    (pick!=null?'<input class="line" id="note" autocomplete="off" placeholder="Anything happen? Who you saw, what you did (optional)" value="'+esc(d&&d.note||'')+'">'+
      '<button class="big" id="save" style="margin-top:12px">Save</button>':'')+'</div>';
}
function render(){
  let h=header('Mood')+today();
  const m=G.model;
  h+='<h2>What makes your good days</h2>';
  if(m.need)h+='<div class="card note">'+(m.n?m.n+' day'+(m.n===1?'':'s')+' rated. ':'')+'Rate '+m.need+' more and this starts to fill in. It needs a few weeks to be sure of anything.</div>';
  else if(!m.effects.length)h+='<div class="card note">Your days are rated, but nothing varies enough yet to compare.</div>';
  else h+='<div class="card" style="padding:4px 16px"><div class="note" style="padding:10px 0 4px">Average day '+m.mean+'. Each line is how much that shifts a day, after the others are accounted for.</div>'+m.effects.map(eff).join('')+'</div>';
  const S=G.social;
  h+='<h2>People</h2><div class="card" style="padding:4px 16px"><div class="row"><span>'+S.week+' day'+(S.week===1?'':'s')+' with people this week'+(S.usual!=null?' <span class="sub">(usually '+S.usual+')</span>':'')+'</span></div>'+
    (G.people.length?G.people.slice(0,8).map(p=>'<div class="row person"><span class="a">'+esc(p.name)+'<div class="sub">'+(p.days_ago===0?'today':p.days_ago===1?'yesterday':p.days_ago+' days ago')+' \\u00b7 '+p.days+' day'+(p.days===1?'':'s')+'</div></span>'+
      (p.days_ago>=7?'<button class="small" data-plan="'+esc(p.name)+'">Make plans</button>':'')+'</div>').join('')
      :'<div class="row empty">Put plans with friends on your calendar, or name who you saw when you rate the day, and they show up here.</div>')+'</div>';
  const past=G.recent.filter(d=>d.date!==G.today);
  if(past.length)h+='<h2>Last two weeks</h2><div class="card" style="padding:4px 16px">'+past.map(d=>'<div class="row day"><span class="d">'+niceDate(d.date)+'</span><span class="r">'+(d.rating!=null?d.rating:'\\u2013')+'</span><span class="a">'+
    (d.tags.length?'<div class="chips" style="margin:0">'+d.tags.map(t=>'<span class="chip">'+esc(t)+'</span>').join('')+'</div>':'')+(d.note?'<div class="sub">'+esc(d.note)+'</div>':'')+'</span></div>').join('')+'</div>';
  $('#app').innerHTML=h;
  wire();
}
function eff(e){
  const thin=e.sure<0.8, dir=e.effect>0?'up':e.effect<0?'down':'';
  return '<div class="row eff'+(thin?' thin':'')+'"><div class="l">'+esc(e.label)+'<div class="sub">'+(thin?'not sure yet':Math.round(e.sure*100)+'% sure')+(e.unit?' \\u00b7 '+esc(e.unit):' \\u00b7 '+e.days+' days')+'</div>'+
    '<div class="bar"><i style="width:'+Math.round(Math.max(0,(e.sure-0.5)*2)*100)+'%"></i></div></div><span class="v'+(thin?'':' '+dir)+'">'+fmt(e.effect)+'</span></div>';
}
function wire(){
  document.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{pick=+b.dataset.r;render();const n=$('#note');if(n)n.focus()});
  if($('#save'))$('#save').onclick=save;
  if($('#note'))$('#note').onkeydown=e=>{if(e.key==='Enter')save()};
  if($('#redo'))$('#redo').onclick=()=>{editing=true;pick=(G.recent.find(x=>x.date===G.today)||{}).rating;render()};
  document.querySelectorAll('[data-plan]').forEach(b=>b.onclick=()=>plan(b.dataset.plan,b));
}
async function save(){
  const note=($('#note')&&$('#note').value||'').trim();
  $('#save').disabled=true;
  try{await call('rate_day',{rating:pick,...(note?{note}:{})});pick=null;editing=false;home()}catch(e){err(e);$('#save').disabled=false}
}
// The first step only: Claude drafts the text with a concrete plan, he sends it.
async function plan(name,b){
  b.disabled=true;
  try{
    await call('add_tasks',{tasks:[{title:'Make plans with '+name,who:'claude',est_min:5,project:'Health & fitness',family:'make social plans',focus:'light',context:'phone',
      impact:{consequence:'health',magnitude:2},notes:'Draft a text to '+name+' with one concrete plan (activity, day, time). Once they agree, put it on the Google Calendar.'}]});
    b.textContent='Added';
  }catch(e){err(e);b.disabled=false}
}
home().then(()=>{if(new URLSearchParams(location.search).get('rate')){const s=document.querySelector('.scale');if(s)s.scrollIntoView({block:'center'})}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&pick==null)home()});
`;

export function renderMood({ key = '' } = {}) {
  return screenPage({ title: 'Mood', css: CSS, key, js: JS });
}
