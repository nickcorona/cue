// Cue Build: project backlogs (served at /build). Capture friction, spec it with done-when
// checks, build it, ship it with commit links. Items rank by how often the friction was hit.
import { screenPage } from './screen.js';

const CSS = `
.projs{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px}
.chip{border:1px solid var(--line);background:var(--panel);border-radius:20px;padding:7px 14px;font-size:14px;font-weight:600;color:var(--soft)}
.chip.on{border-color:var(--accent);background:var(--accent-dim);color:var(--accent)}
.cap{display:flex;gap:8px}
.cap input{flex:1;min-width:0;border:1px solid var(--line);background:var(--panel);border-radius:12px;padding:12px 13px;font:inherit;color:var(--ink)}
.cap button{border:0;border-radius:12px;padding:0 16px;font-weight:650;background:var(--accent);color:var(--on-accent)}
.cap-note{font-size:12.5px;color:var(--mute);margin:6px 2px 0;min-height:18px}
.it{background:var(--panel);border:1px solid var(--line);border-radius:14px;margin-bottom:8px;overflow:hidden}
.it.building{border-color:var(--accent)}
.it-h{display:flex;align-items:flex-start;gap:10px;padding:12px 14px;cursor:pointer}
.it-h .tt{flex:1;min-width:0}
.it-h .tt div{font-size:15px;line-height:1.35}
.it-h .tt span{font-size:12px;color:var(--mute)}
.hits{flex:none;font-size:12px;font-weight:700;color:var(--warn-ink);background:var(--warn-dim);border-radius:8px;padding:2px 7px;margin-top:1px}
.it-b{padding:0 14px 14px;font-size:14px}
.it-b .lab{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--mute);font-weight:650;margin:12px 0 4px}
.it-b p{margin:0;color:var(--soft);white-space:pre-wrap}
.it-b ul{margin:0;padding-left:18px;color:var(--soft)}
.it-b a{color:var(--accent);text-decoration:none;font-family:ui-monospace,monospace;font-size:13px}
.acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
.acts .go{background:var(--accent);color:var(--on-accent)}
.acts .quiet{background:none;color:var(--mute);padding-left:4px;padding-right:4px}
.ed label{display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--mute);font-weight:650;margin:12px 0 4px}
.ed input,.ed textarea{width:100%;border:1px solid var(--line);background:var(--raised);border-radius:9px;padding:9px 11px;font:inherit;font-size:14px;color:var(--ink)}
.ed textarea{min-height:64px;resize:vertical}
.sizes{display:flex;gap:6px}
.sizes button{flex:1;border:1px solid var(--line);background:var(--raised);border-radius:9px;padding:8px 0;font-weight:600;color:var(--soft)}
.sizes button.on{border-color:var(--accent);color:var(--accent);background:var(--accent-dim)}
.more{border:0;background:none;color:var(--mute);font-size:13px;padding:4px 2px}
`;

const JS = `
const qs=new URLSearchParams(location.search);
let ST=null, NOTE='', PROJ=null, OPEN=qs.get('item'), EDIT=null, SIZE='M', SHOWALL=false;
const SIZE_LAB={S:'small',M:'medium',L:'large'};
const SEC=[['building','Building'],['ready','Ready'],['inbox','Inbox'],['shipped','Recently shipped']];

async function load(){
  try{ST=await call('build_status')}catch(e){$('#app').innerHTML=header('Build')+'<div class="err">'+esc(e.message)+'</div>';return}
  if(OPEN&&!PROJ){const p=ST.projects.find(p=>SEC.some(([k])=>p[k].some(i=>i.id===OPEN)));if(p)PROJ=p.id}
  if(!ST.projects.some(p=>p.id===PROJ))PROJ=ST.projects[0]&&ST.projects[0].id;
  render();
}
const proj=()=>ST.projects.find(p=>p.id===PROJ);

function render(){
  let h=header('Build');
  if(!ST.projects.length){$('#app').innerHTML=h+'<div class="card empty">No projects yet. Ask Claude to set one up (build_project).</div>';return}
  if(ST.projects.length>1)h+='<div class="projs">'+ST.projects.map(p=>'<button class="chip'+(p.id===PROJ?' on':'')+'" data-proj="'+p.id+'">'+esc(p.name)+'</button>').join('')+'</div>';
  const p=proj();
  h+='<form class="cap" id="cap"><input id="capin" placeholder="Bug, friction or idea for '+esc(p.name)+'…" autocomplete="off"><button>Add</button></form><div class="cap-note" id="capnote">'+esc(NOTE)+'</div>';
  for(const [k,label] of SEC){
    let its=p[k];
    if(!its.length&&k!=='ready')continue;
    const n=its.length;
    if(k==='shipped'&&!SHOWALL)its=its.slice(0,3);
    h+='<h2>'+label+(n?' · '+n:'')+'</h2>';
    if(!n)h+='<div class="empty" style="margin:0 2px 8px">Nothing specced. Open an inbox item and write what done looks like.</div>';
    h+=its.map(item).join('');
    if(k==='shipped'&&n>3)h+='<button class="more" id="more">'+(SHOWALL?'Show fewer':'Show all '+n)+'</button>';
  }
  $('#app').innerHTML=h;
  bind();
}

function item(it){
  const sub=[SIZE_LAB[it.size]||'medium'];
  if(it.done_when.length)sub.push(it.done_when.length+' check'+(it.done_when.length>1?'s':''));
  if(it.commits.length)sub.push(it.commits.length+' commit'+(it.commits.length>1?'s':''));
  if(it.stage==='shipped'&&it.shipped_at)sub.push('shipped '+niceDate(it.shipped_at.slice(0,10)));
  if(it.not_before)sub.push('not before '+niceDate(it.not_before));
  let h='<div class="it '+it.stage+'" id="i_'+it.id+'"><div class="it-h" data-open="'+it.id+'"><div class="tt"><div>'+esc(it.title)+'</div><span>'+sub.join(' · ')+'</span></div>'+(it.hits>1&&it.stage!=='shipped'?'<span class="hits" title="Times this came up in the last 60 days">×'+it.hits+'</span>':'')+'</div>';
  if(OPEN===it.id)h+='<div class="it-b">'+(EDIT===it.id?editor(it):detail(it))+'</div>';
  return h+'</div>';
}

function detail(it){
  let h='';
  if(it.problem)h+='<div class="lab">Problem</div><p>'+esc(it.problem)+'</p>';
  if(it.why)h+='<div class="lab">Why</div><p>'+esc(it.why)+'</p>';
  h+='<div class="lab">Done when</div>'+(it.done_when.length?'<ul>'+it.done_when.map(d=>'<li>'+esc(d)+'</li>').join('')+'</ul>':'<p style="color:var(--mute)">Not specced yet.</p>');
  if(it.notes)h+='<div class="lab">Notes</div><p>'+esc(it.notes)+'</p>';
  if(it.commits.length)h+='<div class="lab">Commits</div>'+it.commits.map(c=>'<div>'+(c.url?'<a href="'+esc(c.url)+'" target="_blank" rel="noopener">'+esc(c.sha.slice(0,7))+'</a>':esc(c.sha.slice(0,7)))+(c.msg?' <span style="color:var(--soft)">'+esc(c.msg)+'</span>':'')+'</div>').join('');
  const b=(act,label,cls)=>'<button class="small'+(cls?' '+cls:'')+'" data-act="'+act+'" data-id="'+it.id+'">'+label+'</button>';
  const acts=[];
  if(it.stage==='inbox')acts.push(b('edit','Write done-when','go'));
  if(it.stage==='ready')acts.push(b('building','Start building','go'),b('brief','Copy brief'));
  if(it.stage==='building')acts.push(b('shipped','Ship it','go'),b('brief','Copy brief'),b('ready','Back to ready'));
  if(it.stage==='shipped')acts.push(b('ready','Reopen'));
  if(it.stage!=='shipped')acts.push(b('hit','I hit this again'));
  if(it.stage!=='inbox')acts.push(b('edit','Edit'));
  if(it.stage!=='shipped')acts.push(b('dropped','Drop','quiet'));
  return h+'<div class="acts">'+acts.join('')+'</div>';
}

function editor(it){
  SIZE=it.size||'M';
  return '<div class="ed"><label>Title</label><input id="e_title" value="'+esc(it.title)+'">'+
    '<label>Problem</label><textarea id="e_problem">'+esc(it.problem||'')+'</textarea>'+
    '<label>Why it matters</label><textarea id="e_why">'+esc(it.why||'')+'</textarea>'+
    '<label>Done when (one check per line)</label><textarea id="e_done" style="min-height:96px">'+esc(it.done_when.join('\\n'))+'</textarea>'+
    '<label>Size</label><div class="sizes">'+['S','M','L'].map(s=>'<button data-size="'+s+'"'+(s===SIZE?' class="on"':'')+'>'+cap(SIZE_LAB[s])+'</button>').join('')+'</div>'+
    '<div class="acts"><button class="small go" data-act="save" data-id="'+it.id+'">Save</button><button class="small quiet" data-act="cancel" data-id="'+it.id+'">Cancel</button></div></div>';
}

function find(id){const p=proj();for(const [k] of SEC){const it=p[k].find(i=>i.id===id);if(it)return it}return null}

async function act(a,id){
  const it=find(id);
  try{
    if(a==='edit'){EDIT=id;return render()}
    if(a==='cancel'){EDIT=null;return render()}
    if(a==='brief'){
      const r=await call('build_brief',{id});
      try{await navigator.clipboard.writeText(r.brief);toast(id,'Brief copied. Paste it into a Claude Code session.')}
      catch(e){prompt('Copy the brief:',r.brief)}
      return;
    }
    if(a==='hit'){await call('build_update',{id,hit:true});toast(id,'Counted. That makes '+(it.hits+1)+'.');return load()}
    if(a==='save'){
      const v=s=>$(s).value.trim();
      const args={id,title:v('#e_title')||it.title,problem:v('#e_problem')||null,why:v('#e_why')||null,done_when:v('#e_done').split('\\n').map(s=>s.replace(/^[-*•]\\s*/,'').trim()).filter(Boolean),size:SIZE};
      await call('build_update',args);EDIT=null;return load();
    }
    if(['building','ready','shipped','dropped'].includes(a)){
      await call('build_update',{id,stage:a});
      if(a==='dropped'||a==='shipped')OPEN=null;
      return load();
    }
  }catch(e){err(e)}
}

function toast(id,msg){NOTE=msg;const n=$('#capnote');if(n)n.textContent=msg;setTimeout(()=>{if(NOTE===msg){NOTE='';const n=$('#capnote');if(n)n.textContent=''}},5000)}

function bind(){
  document.querySelectorAll('[data-proj]').forEach(el=>el.onclick=()=>{PROJ=el.dataset.proj;OPEN=null;EDIT=null;render()});
  document.querySelectorAll('[data-open]').forEach(el=>el.onclick=()=>{const id=el.dataset.open;if(EDIT&&EDIT!==id)EDIT=null;OPEN=OPEN===id?null:id;render()});
  document.querySelectorAll('[data-act]').forEach(el=>el.onclick=e=>{e.stopPropagation();el.disabled=true;act(el.dataset.act,el.dataset.id)});
  document.querySelectorAll('[data-size]').forEach(el=>el.onclick=()=>{SIZE=el.dataset.size;document.querySelectorAll('[data-size]').forEach(x=>x.classList.toggle('on',x===el))});
  const m=$('#more');if(m)m.onclick=()=>{SHOWALL=!SHOWALL;render()};
  $('#cap').onsubmit=async e=>{
    e.preventDefault();
    const inp=$('#capin'),title=inp.value.trim();if(!title)return;
    inp.disabled=true;
    try{
      const r=await call('build_add',{project:PROJ,title});
      inp.value='';
      await load();
      toast(null,r.merged_into?'Already on the list: "'+r.merged_into.title+'" (×'+r.merged_into.hits+')':'Added to the inbox.');
      const id=(r.merged_into||r.added).id;const el=$('#i_'+id);if(el)el.scrollIntoView({block:'nearest'});
    }catch(e){err(e)}
    const i2=$('#capin');if(i2){i2.disabled=false;i2.focus()}
  };
}
load();
`;

export function renderBuild({ key }) {
  return screenPage({ title: 'Build', css: CSS, js: JS, key });
}
