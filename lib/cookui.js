// Cook mode: the kitchen screen (served at /cook). Recipes, a prep check that sends
// missing ingredients to the shopping list, big-text steps with timers, and a rating and
// note at the end that show up the next time.
import { screenPage } from './screen.js';

const CSS = `
.rc{cursor:pointer}
.rc .nm{font-size:17px;font-weight:650}
.rc .meta{font-size:12.5px;color:var(--mute);margin-top:2px}
.rc .lastnote{font-size:13px;color:var(--soft);margin-top:8px}
.lastcard{background:var(--amber-dim);border-radius:12px;padding:10px 12px;margin:0 0 12px;font-size:13.5px;color:var(--amber-ink)}
.serves{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
.stepper{display:flex;align-items:center;gap:6px;background:var(--raised);border-radius:11px}
.stepper button{border:0;background:none;width:40px;height:40px;font-size:20px;color:var(--soft)}
.stepper b{min-width:28px;text-align:center;font-size:17px}
.ing{display:flex;align-items:center;gap:12px;padding:11px 2px;border-top:1px solid var(--line);cursor:pointer}
.ing:first-child{border-top:0}
.ing .box{flex:none;width:24px;height:24px;border-radius:7px;border:2px solid var(--check-line);display:grid;place-items:center;font-size:14px;color:var(--on-accent)}
.ing.have .box{background:var(--accent);border-color:var(--accent)}
.ing .q{flex:none;min-width:64px;font-weight:650;font-variant-numeric:tabular-nums}
.ing .n{flex:1;min-width:0}
.ing .n span{display:block;font-size:12px;color:var(--mute)}
.ing.have .n{color:var(--mute)}
.addmiss{width:100%;border:1px dashed var(--line-strong);background:none;border-radius:11px;padding:11px;font-size:14px;color:var(--soft);margin-top:10px}
.stp{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:14px 16px;margin-bottom:10px;cursor:pointer;transition:opacity .2s}
.stp .k{font-size:11.5px;font-weight:650;letter-spacing:.08em;text-transform:uppercase;color:var(--mute)}
.stp .tx{font-size:15.5px;line-height:1.45;margin-top:2px}
.stp.past{opacity:.45}
.stp.past .tx{text-decoration:line-through}
.stp.cur{border-color:var(--accent);cursor:default}
.stp.cur .tx{font-size:21px;line-height:1.4;font-weight:550}
.stp .acts{display:flex;gap:8px;margin-top:14px}
.stp .acts button{flex:1;border:0;border-radius:12px;padding:14px;font-size:15.5px;font-weight:650;background:var(--raised)}
.stp .acts .nx{background:var(--accent);color:var(--on-accent)}
details.ings{margin-bottom:12px}
details.ings summary{cursor:pointer;color:var(--mute);font-size:13.5px;padding:4px 2px}
.dock{position:fixed;left:0;right:0;bottom:0;z-index:10;background:var(--panel);border-top:1px solid var(--line);padding:8px 16px calc(8px + env(safe-area-inset-bottom))}
.dock:empty{display:none}
.tm{max-width:560px;margin:0 auto;display:flex;align-items:center;gap:12px;padding:6px 0}
.tm b{font-size:24px;font-variant-numeric:tabular-nums;min-width:70px}
.tm span{flex:1;min-width:0;font-size:13px;color:var(--soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tm button{border:0;background:var(--raised);border-radius:9px;width:36px;height:36px;font-size:16px;color:var(--soft)}
.tm.ring b{color:var(--accent);animation:blink 1s steps(2) infinite}
@keyframes blink{50%{opacity:.35}}
.stars{display:flex;justify-content:center;gap:8px;margin:10px 0 16px}
.stars button{border:0;background:none;font-size:36px;color:var(--check-line);padding:0 2px}
.stars button.on{color:var(--amber-ink)}
textarea{width:100%;min-height:90px;border:1px solid var(--line);background:var(--panel);border-radius:12px;padding:12px;font:inherit;color:var(--ink);resize:vertical}
.toast{position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:var(--ink);color:var(--bg);padding:9px 14px;border-radius:10px;font-size:13.5px;z-index:20}
`;

const JS = `
let ST=null, R=null, CK=null, serves=1, have={}, cur=0, rating=0, tick=null;
const qs=new URLSearchParams(location.search);
let link=qs.get('routine')?{routine_id:qs.get('routine'),step_id:qs.get('step')}:{};
let openRecipe=qs.get('recipe'); // a deep link opens that recipe once

// Quantities scaled to the servings, shown as kitchen fractions.
function fmtQty(q){
  if(q==null)return '';
  const w=Math.floor(q), f=q-w, fr=[[0,''],[.25,'¼'],[1/3,'⅓'],[.5,'½'],[2/3,'⅔'],[.75,'¾'],[1,'']];
  let best=fr[0];for(const x of fr)if(Math.abs(f-x[0])<Math.abs(f-best[0]))best=x;
  if(Math.abs(f-best[0])<.06){const ww=best[0]===1?w+1:w;return (ww||'')+(best[1]||'')||'0'}
  return String(Math.round(q*10)/10);
}
const scaled=i=>i.qty==null?'':fmtQty(i.qty*serves/R.serves)+(i.unit?' '+i.unit:'');
function toast(t){const d=document.createElement('div');d.className='toast';d.textContent=t;document.body.appendChild(d);setTimeout(()=>d.remove(),2200)}
const stars=n=>n?'★'.repeat(n)+'☆'.repeat(5-n):'';

async function home(){
  clearInterval(tick);releaseWake();CK=null;
  try{ST=await call('cook_status')}catch(e){$('#app').innerHTML='<div class="err">'+esc(e.message)+'</div>';return}
  if(openRecipe){const r=ST.recipes.find(x=>x.id===openRecipe);openRecipe=null;if(r){history.replaceState(null,'','/cook');return prep(r)}}
  let h=header('Cook');
  if(ST.active&&ST.active.recipe)h+='<div class="card" style="border-color:var(--accent);background:var(--accent-dim)"><div class="kicker">Cooking now</div><div class="h1" style="margin:2px 0 10px">'+esc(ST.active.recipe.name)+'</div><button class="big" id="resume">Back to the stove</button></div>';
  h+='<h2>Recipes</h2>';
  if(!ST.recipes.length)h+='<div class="card empty">No recipes yet. Ask Claude to save one, e.g. "save my salmon and potatoes as a recipe".</div>';
  h+=ST.recipes.map(r=>'<div class="card rc" data-r="'+r.id+'"><div class="nm">'+esc(r.name)+'</div><div class="meta">'+[r.minutes?r.minutes+' min':'',r.protein_g?r.protein_g+' g protein':'',r.times_cooked?'cooked '+r.times_cooked+'×':'',r.last&&r.last.rating?stars(r.last.rating):''].filter(Boolean).join(' · ')+'</div>'+(r.last&&r.last.note?'<div class="lastnote">Last time: '+esc(r.last.note)+'</div>':'')+'</div>').join('');
  $('#app').innerHTML=h;
  document.querySelectorAll('[data-r]').forEach(el=>el.addEventListener('click',()=>prep(ST.recipes.find(x=>x.id===el.dataset.r))));
  const rs=$('#resume');if(rs)rs.onclick=()=>{R=ST.active.recipe;CK=ST.active;serves=CK.servings;cooking()};
}

function prep(r){
  R=r;serves=serves&&R===r?serves:r.serves;have={};
  render();
  function render(){
    const missing=R.ingredients.filter((_,i)=>!have[i]);
    let h='<div class="bar-top"><button class="back" id="back" aria-label="Back">‹</button><div class="t"><b>'+esc(R.name)+'</b><span>'+[R.minutes?R.minutes+' min':'',R.protein_g?Math.round(R.protein_g)+' g protein per serving':''].filter(Boolean).join(' · ')+'</span></div></div><div id="msg"></div>';
    if(R.last&&(R.last.note||R.last.rating))h+='<div class="lastcard">Last time ('+niceDate(R.last.date)+')'+(R.last.rating?' '+stars(R.last.rating):'')+(R.last.note?': '+esc(R.last.note):'')+'</div>';
    h+='<div class="card"><div class="serves"><div><div class="kicker">Servings</div></div><div class="stepper"><button id="sm" aria-label="Fewer">−</button><b>'+serves+'</b><button id="sp" aria-label="More">+</button></div></div></div>';
    h+='<h2>Do you have everything?</h2><div class="card" style="padding:4px 14px">'+R.ingredients.map((g,i)=>'<div class="ing'+(have[i]?' have':'')+'" data-i="'+i+'"><span class="box">'+(have[i]?'✓':'')+'</span><span class="q">'+esc(scaled(g))+'</span><span class="n">'+esc(g.name)+(g.note?'<span>'+esc(g.note)+'</span>':'')+'</span></div>').join('')+'</div>';
    if(missing.length&&missing.length<R.ingredients.length)h+='<button class="addmiss" id="addmiss">Add '+missing.length+' missing to the shopping list</button>';
    h+='<button class="big" id="go" style="margin-top:16px">Start cooking</button>';
    $('#app').innerHTML=h;
    $('#back').onclick=()=>{R=null;home()};
    $('#sm').onclick=()=>{serves=Math.max(1,serves-1);render()};
    $('#sp').onclick=()=>{serves+=1;render()};
    document.querySelectorAll('[data-i]').forEach(el=>el.addEventListener('click',()=>{have[el.dataset.i]=!have[el.dataset.i];render()}));
    const am=$('#addmiss');if(am)am.onclick=async()=>{
      const by={};for(const g of missing)(by[g.store||'No Frills']||(by[g.store||'No Frills']=[])).push({title:g.name,...(g.qty!=null?{note:scaled(g)}:{})});
      try{for(const [list,items] of Object.entries(by))await call('add_to_list',{list,items});toast('Added to '+Object.keys(by).join(' and '));missing.forEach(g=>{have[R.ingredients.indexOf(g)]=true});render()}catch(e){err(e)}
    };
    $('#go').onclick=async()=>{
      $('#go').disabled=true;
      try{CK=await call('cook_start',{recipe_id:R.id,servings:serves,...link})}catch(e){err(e);$('#go').disabled=false;return}
      cur=0;cooking();
    };
  }
}

function cooking(){
  keepAwake();
  const h=()=>{
    let s='<div class="bar-top"><button class="back" id="back" aria-label="Back">‹</button><div class="t"><b>'+esc(R.name)+'</b><span>Serves '+serves+'</span></div><button class="small" id="fin" style="background:var(--accent);color:var(--on-accent)">Finish</button></div><div id="msg"></div>';
    s+='<details class="ings"><summary>Ingredients</summary><div class="card" style="padding:4px 14px;margin-top:8px">'+R.ingredients.map(g=>'<div class="ing" style="cursor:default"><span class="q">'+esc(scaled(g))+'</span><span class="n">'+esc(g.name)+'</span></div>').join('')+'</div></details>';
    s+=R.steps.map((st,i)=>{
      const running=(CK.timers||[]).find(t=>t.step===i);
      return '<div class="stp'+(i<cur?' past':'')+(i===cur?' cur':'')+'" data-s="'+i+'"><div class="k">Step '+(i+1)+' of '+R.steps.length+(st.timer_min?' · '+st.timer_min+' min':'')+'</div><div class="tx">'+esc(st.text)+'</div>'+
        (i===cur?'<div class="acts">'+(st.timer_min&&!running?'<button id="tmr">Start '+st.timer_min+'-min timer</button>':'')+'<button class="nx" id="next">'+(i===R.steps.length-1?'All done':'Next step')+'</button></div>':'')+'</div>';
    }).join('');
    $('#app').innerHTML=s;
    $('#back').onclick=()=>{history.replaceState(null,'','/cook');home()};
    $('#fin').onclick=finish;
    document.querySelectorAll('.stp:not(.cur)').forEach(el=>el.addEventListener('click',()=>{cur=+el.dataset.s;h()}));
    const nx=$('#next');if(nx)nx.onclick=()=>{if(cur>=R.steps.length-1)return finish();cur++;h();const c=$('.stp.cur');if(c)c.scrollIntoView({behavior:'smooth',block:'center'})};
    const tm=$('#tmr');if(tm)tm.onclick=async()=>{
      const st=R.steps[cur];
      try{const r=await call('cook_timer',{cook_id:CK.id,step:cur,minutes:st.timer_min});CK.timers=r.timers;h();dock()}catch(e){err(e)}
    };
  };
  h();dock();
  clearInterval(tick);tick=setInterval(dock,500);
}

// Running timers sit in a dock at the bottom; when one runs out it blinks until dismissed.
const rung={};
function dock(){
  const el=$('#dock');if(!el)return;
  if(!CK){el.innerHTML='';return}
  el.innerHTML=(CK.timers||[]).map(t=>{
    const left=(Date.parse(t.ends)-Date.now())/1000;
    if(left<=0&&!rung[t.ends]){rung[t.ends]=1;if(navigator.vibrate)navigator.vibrate([300,150,300,150,300])}
    return '<div class="tm'+(left<=0?' ring':'')+'"><b>'+(left>0?mmss(Math.ceil(left)):'Done')+'</b><span>'+esc(t.label)+'</span><button data-x="'+esc(t.ends)+'" aria-label="Dismiss">✕</button></div>';
  }).join('');
  el.querySelectorAll('[data-x]').forEach(b=>b.onclick=async()=>{const ends=b.dataset.x;CK.timers=CK.timers.filter(t=>t.ends!==ends);dock();call('cook_timer',{cook_id:CK.id,cancel:true,ends}).catch(()=>{})});
}

function finish(){
  clearInterval(tick);
  let s='<div class="bar-top"><button class="back" id="back" aria-label="Back">‹</button><div class="t"><b>How was it?</b><span>'+esc(R.name)+'</span></div></div><div id="msg"></div>';
  s+='<div class="stars">'+[1,2,3,4,5].map(n=>'<button data-st="'+n+'" class="'+(n<=rating?'on':'')+'" aria-label="'+n+' stars">★</button>').join('')+'</div>';
  s+='<textarea id="note" placeholder="Anything to change next time? (e.g. potatoes needed 5 more min)"></textarea>';
  s+='<button class="big" id="save" style="margin-top:14px">Save</button>';
  $('#app').innerHTML=s;$('#dock').innerHTML='';
  $('#back').onclick=cooking;
  document.querySelectorAll('[data-st]').forEach(b=>b.onclick=()=>{rating=+b.dataset.st;document.querySelectorAll('[data-st]').forEach(x=>x.classList.toggle('on',+x.dataset.st<=rating))});
  $('#save').onclick=async()=>{
    const note=$('#note').value.trim();
    let r;try{r=await call('cook_finish',{cook_id:CK.id,...(rating?{rating}:{}),...(note?{note}:{})})}catch(e){err(e);return}
    releaseWake();CK=null;
    $('#app').innerHTML='<div class="done"><div class="ring">✓</div><div class="h1">Enjoy</div><div class="empty">'+esc(r.recipe||'')+(r.routine_step?' · ticked in your routine':'')+(note?' · note saved for next time':'')+'</div></div><button class="big" id="ok" style="margin-top:20px">Done</button>';
    $('#ok').onclick=()=>{rating=0;link={};home()};
  };
}

home();
`;

export function renderCook({ key = '' } = {}) {
  return screenPage({ title: 'Cook', css: CSS, key, js: JS, body: '<div class="dock" id="dock"></div>' });
}
