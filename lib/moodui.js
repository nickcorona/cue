// Cue Mood: plan activities with a predicted mood, rate them after, and see what actually lifts
// mood and builds accomplishment (served at /mood). Logging happens on the queue.
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
.prow .t{font-size:13px;color:var(--mute);width:58px;flex:none;font-variant-numeric:tabular-nums}
.prow .a{flex:1;min-width:0}
.prow .r{font-size:13px;color:var(--soft);text-align:right;white-space:nowrap}
.rate{padding:4px 0 12px}
.rate .q{font-size:13px;color:var(--soft);margin:2px 0 8px}
.form label{display:block;font-size:12.5px;color:var(--mute);margin:10px 0 5px}
.form .act{margin-bottom:0}
.form input[type=datetime-local],.form input[type=time]{font:inherit;font-size:15px;background:var(--raised);border:0;border-radius:10px;padding:10px 12px;color:var(--ink);color-scheme:var(--scheme);width:100%}
.seg{display:flex;gap:6px}
.seg button{flex:1}
.tag{display:inline-block;font-size:11px;font-weight:650;color:var(--accent);background:var(--accent-dim);border-radius:6px;padding:1px 6px;margin-left:6px;vertical-align:1px}
.note{font-size:14px;color:var(--soft);line-height:1.45}
`;

const JS = `
let ST=null, rating=null, form=null;
const fmt=x=>(x>0?'+':x<0?'\\u2212':'')+Math.abs(x).toFixed(1);
const scale=(attr,on)=>'<div class="scale">'+[0,1,2,3,4,5,6,7,8,9,10].map(n=>'<button data-'+attr+'="'+n+'"'+(on===n?' class="on"':'')+'>'+n+'</button>').join('')+'</div>';
const pad=n=>String(n).padStart(2,'0');
function nextHour(){const d=new Date();d.setMinutes(0,0,0);d.setHours(d.getHours()+1);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':00'}

async function home(){
  try{ST=await call('mood_status')}catch(e){$('#app').innerHTML='<div class="err">'+esc(e.message)+'</div>';return}
  render();
}
function render(){
  // Logging lives in the queue (Log mood, and the bar after each check-off); this screen is plans and insights.
  let h=header('Mood');
  h+='<datalist id="fams">'+ST.families.map(f=>'<option value="'+esc(f)+'">').join('')+'</datalist>';
  h+='<h2>Planned</h2>'+(form?planForm():'');
  const plans=ST.plans_today.concat(ST.plans_upcoming.map(p=>({...p,status:'later'})));
  h+='<div class="card" style="padding:4px 16px">'+(plans.length?plans.map(planRow).join(''):'<div class="row empty">Nothing planned. Pick something that lifts you (below) and give it a time.</div>')+
    (form?'':'<div class="row"><button class="small" id="planbtn">Plan something</button></div>')+'</div>';
  h+='<h2>Today</h2><div class="card tl" style="padding:4px 16px">'+(ST.entries_today.length?ST.entries_today.map(e=>'<div class="row"><span class="t">'+clock(e.time)+'</span><span class="m">'+(e.mood!=null?e.mood:['\\u2193','=','\\u2191'][(e.change!=null?e.change:e.vs_predicted!=null?e.vs_predicted:0)+1])+'</span><span class="a">'+esc(e.activity)+'<div class="sub">'+[e.family&&e.family!==e.activity.toLowerCase()?esc(e.family):'',e.mastery!=null?'accomplishment '+e.mastery:'',e.predicted?'predicted '+e.predicted.mood:''].filter(Boolean).join(' \\u00b7 ')+'</div></span><button class="x" aria-label="Delete" data-del="'+esc(e.id)+'">\\u00d7</button></div>').join(''):'<div class="row empty">Nothing logged yet today.</div>')+'</div>';
  h+='<h2>Last 14 days</h2><div class="card chart">'+chart(ST.daily,ST.insights.baseline)+'</div>';
  const ins=ST.insights;
  h+='<h2>What moves your mood</h2>';
  if(!ins.families.length)h+='<div class="card empty">Log a few entries and this fills in.</div>';
  else h+='<div class="base">'+(ins.baseline!=null?'Mood against your 14-day average of '+ins.baseline.toFixed(1):'How each activity left your mood')+(ins.baseline_mastery!=null?', accomplishment against '+ins.baseline_mastery.toFixed(1):'')+'. Families need 3+ entries to count.</div><div class="card" style="padding:4px 16px">'+ins.families.map(fam).join('')+'</div>';
  const pr=ins.predictions;
  if(pr){
    h+='<h2>Predicted vs actual</h2><div class="card"><div class="note">Planned activities averaged '+pr.actual.toFixed(1)+' against a predicted '+pr.predicted.toFixed(1)+' ('+fmt(pr.gap)+' over '+pr.n+' rated).</div>'+
      (pr.by_family.length>1?'<div style="margin-top:6px">'+pr.by_family.map(f=>'<div class="row"><span>'+esc(f.family)+'<div class="sub">'+f.n+' rated</div></span><span class="sub">'+f.predicted.toFixed(1)+' \\u2192 '+f.actual.toFixed(1)+'</span></div>').join('')+'</div>':'')+'</div>';
  }
  const ft=ST.follow_through;
  if(ft.planned){
    h+='<h2>Follow-through</h2><div class="card"><div class="note">'+ft.done+' of '+ft.planned+' planned in the last 14 days got done.</div>'+
      (ft.by_family.some(f=>f.missed)?'<div style="margin-top:6px">'+ft.by_family.filter(f=>f.missed).map(f=>'<div class="row"><span>'+esc(f.family)+'</span><span class="sub">'+f.done+' of '+f.planned+'</span></div>').join('')+'</div>':'')+'</div>';
  }
  h+='<h2>Check-in pings</h2><div class="card"><div class="set"><span>Every 2 hours, from 2 hours after waking until an hour before bed'+(ST.pings.bedtime?' ('+clock(ST.pings.bedtime)+')':'')+'</span><button class="small'+(ST.pings.on?' on':'')+'" id="ping">'+(ST.pings.on?'On':'Off')+'</button></div>'+
    '<div class="set" style="margin-top:10px"><span>I usually wake at</span><input type="time" id="wake" value="'+esc(ST.pings.wake)+'"></div></div>';
  $('#app').innerHTML=h;
  wire();
}
function planRow(p){
  const when=p.status==='later'?niceDate(p.date)+', '+clock(p.time):clock(p.time);
  let right='';
  if(p.status==='later')right='predicted '+p.predicted.mood;
  else if(p.rated)right='done';
  else if(p.status==='done')right='<button class="small" data-rate="'+esc(p.plan_id)+'">Rate</button>';
  else if(p.status==='skipped')right='skipped';
  else right='<button class="small" data-rate="'+esc(p.plan_id)+'">Done, rate it</button>';
  let h='<div class="row prow"><span class="t">'+when+'</span><span class="a">'+esc(p.activity)+'<div class="sub">'+esc(p.family)+(p.status!=='later'?' \\u00b7 predicted '+p.predicted.mood:'')+'</div></span><span class="r">'+right+'</span></div>';
  if(rating&&rating.plan_id===p.plan_id){
    h+=rating.entry?'<div class="rate"><div class="q">'+rating.mood+' against a predicted '+p.predicted.mood+'. Sense of accomplishment?</div>'+scale('rms')+'<div class="ends"><span>none</span><button class="link" id="rmskip" style="padding:0">Skip</button><span>a lot</span></div></div>'
      :'<div class="rate"><div class="q">How did it feel? You predicted '+p.predicted.mood+'.</div>'+scale('rm')+'</div>';
  }
  return h;
}
function planForm(){
  const f=form;
  return '<div class="card form"><label>Activity family</label><input class="act" id="pf-fam" list="fams" autocomplete="off" placeholder="walk, gym, call a friend" value="'+esc(f.family||'')+'">'+
    '<label>What exactly (optional)</label><input class="act" id="pf-act" autocomplete="off" placeholder="Walk to the lake and back" value="'+esc(f.activity||'')+'">'+
    '<label>As</label><div class="seg"><button class="small'+(f.as==='task'?' on':'')+'" data-pas="task">Once</button><button class="small'+(f.as==='habit'?' on':'')+'" data-pas="habit">Every day</button></div>'+
    '<label>When</label>'+(f.as==='task'?'<input type="datetime-local" id="pf-at" value="'+esc(f.at)+'">':'<input type="time" id="pf-at" value="'+esc(f.at.slice(-5))+'">')+
    '<label>How good do you think it\\u2019ll feel?</label>'+scale('pm',f.pm)+
    '<div class="seg" style="margin-top:14px"><button class="big alt" id="pf-x">Cancel</button><button class="big" id="pf-go"'+(f.pm==null?' disabled':'')+'>Plan it</button></div></div>';
}
function fam(f){
  // Rated as a 0-10 (lift over the average) or after doing it (worse/same/better: mean change).
  const eff=f.lift!=null?f.lift:f.change_avg!=null?f.change_avg:0;
  const builder=!f.low_n&&eff<=0&&f.mastery_n>=3&&f.mastery_lift>0, lifter=!f.low_n&&(eff>0||builder);
  const sub=[f.n+' entr'+(f.n===1?'y':'ies'),f.avg!=null?'avg '+f.avg.toFixed(1):'',f.change_n?Math.round(f.better*100)+'% left you better':'',f.mastery_n?'accomplishment '+fmt(f.mastery_lift):''].filter(Boolean).join(' \\u00b7 ');
  return '<div class="row fam'+(f.low_n?' thin':'')+'"><div class="l">'+esc(f.family)+(builder?'<span class="tag">builds</span>':'')+'<div class="sub">'+sub+'</div></div>'+
    (lifter?'<span class="acts">'+(ST.scheduled.includes(f.family)?'<span class="sub">Planned</span>':'<button class="small" data-plan="'+esc(f.family)+'">Plan</button>')+'</span>':'')+
    '<span class="lift'+(f.low_n?'':eff>0?' up':eff<0&&!builder?' down':'')+'">'+(f.lift!=null?fmt(f.lift):Math.round(f.better*100)+'%')+'</span></div>';
}
function wire(){
  const on=(sel,fn)=>document.querySelectorAll(sel).forEach(b=>b.onclick=()=>fn(b));
  on('[data-del]',b=>del(b.dataset.del));
  on('[data-rate]',b=>{rating={plan_id:b.dataset.rate};render()});
  on('[data-rm]',b=>rate(+b.dataset.rm));
  on('[data-rms]',b=>rateMastery(+b.dataset.rms));
  if($('#rmskip'))$('#rmskip').onclick=()=>{rating=null;home()};
  on('[data-plan]',b=>{form={family:b.dataset.plan,as:'task',at:nextHour(),pm:null};render();$('#pf-act').focus()});
  if($('#planbtn'))$('#planbtn').onclick=()=>{form={family:'',as:'task',at:nextHour(),pm:null};render();$('#pf-fam').focus()};
  if(form){
    const keep=()=>{form.family=$('#pf-fam').value;form.activity=$('#pf-act').value;const v=$('#pf-at').value;form.at=form.as==='task'?v:(form.at.slice(0,11)+v)};
    on('[data-pas]',b=>{keep();form.as=b.dataset.pas;render()});
    on('[data-pm]',b=>{keep();form.pm=+b.dataset.pm;render()});
    $('#pf-x').onclick=()=>{form=null;render()};
    $('#pf-go').onclick=()=>{keep();plan()};
  }
  $('#ping').onclick=async()=>{try{await call('settings',{push:{mood:!ST.pings.on}});home()}catch(e){err(e)}};
  $('#wake').onchange=async e=>{try{await call('settings',{wake:e.target.value});home()}catch(x){err(x)}};
}
async function rate(m){
  try{const r=await call('log_mood',{plan_id:rating.plan_id,mood:m,via:'web'});rating={plan_id:rating.plan_id,entry:r.logged.id,mood:m};render()}catch(e){err(e)}
}
async function rateMastery(n){
  try{await call('update_mood',{id:rating.entry,mastery:n})}catch(e){err(e)}
  rating=null;home();
}
async function plan(){
  const f=form;
  if(!f.family.trim()){err('Give it a family (walk, gym, call a friend)');return}
  if(!f.at){err('Pick a time');return}
  try{
    await call('plan_activity',{activity_family:f.family.trim(),...(f.activity&&f.activity.trim()?{activity:f.activity.trim()}:{}),at:f.as==='task'?f.at:f.at.slice(-5),predicted_mood:f.pm,as:f.as});
    form=null;home();
  }catch(e){err(e)}
}
async function del(id){
  if(!confirm('Delete this entry?'))return;
  try{await call('delete_mood',{id});home()}catch(e){err(e)}
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

const qs=new URLSearchParams(location.search);
if(qs.get('log'))location.replace('/?mood=1'); // old check-in links: logging is on the queue now
if(qs.get('plan'))rating={plan_id:qs.get('plan')};
home().then(()=>{const r=document.querySelector('.rate');if(r)r.scrollIntoView({block:'center'})});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!rating&&!form)home()});
`;

export function renderMood({ key = '' } = {}) {
  return screenPage({ title: 'Mood', css: CSS, key, js: JS });
}
