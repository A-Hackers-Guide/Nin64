import { play, ctx as audioCtx } from '../../assets/js/sound.js';
import { listRoms, addRom, removeRom, formatBytes, classifyFile } from '../../assets/js/roms.js';
import { runRom } from '../../assets/js/emulator.js';
import { exportConsole } from '../../assets/js/export.js';
import { autoAttach } from '../../assets/js/features.js';
autoAttach('ps1');
const AUDIO={on:true};
document.addEventListener('pointerdown', function once(){try{audioCtx();}catch{}}, {once:true});
window.addEventListener('load',()=>{
  setTimeout(()=>play('n64','boot'), 400);
  setTimeout(()=>{ document.getElementById('boot').classList.add('done'); document.getElementById('memcard').classList.add('on'); }, 2400);
});

async function build(){
  const g=document.getElementById('slots');
  const roms=await listRoms('ps1');
  g.innerHTML='';
  for(const r of roms){
    const s=document.createElement('div'); s.className='slot';
    s.innerHTML=`<div class="icon">💿</div>
      <div><div class="name">${r.name.replace(/\.(iso|cue|bin|pbp|chd)$/i,'').slice(0,34)}</div>
      <div class="sub">PlayStation · ${formatBytes(r.size)}</div></div>`;
    s.onmouseenter=()=>AUDIO.on&&play('n64','hover');
    s.onclick=()=>{ play('n64','select'); startEmulator(r.id);};
    g.appendChild(s);
  }
  const add=document.createElement('div'); add.className='slot add';
  add.innerHTML='<div class="icon">＋</div><div><div class="name">Insert disc</div><div class="sub">Add .cue / .pbp / .chd</div></div>';
  add.onclick=()=>{ play('n64','select'); openLibrary();};
  g.appendChild(add);
}
build();

document.getElementById('settings-btn').onclick=()=>{ play('n64','select'); openSettings();};
document.getElementById('library-btn').onclick=()=>{ play('n64','select'); openLibrary();};
document.getElementById('home-btn').onclick=()=>{ play('n64','select'); setTimeout(()=>location.href='../../index.html',200);};
document.querySelectorAll('[data-close]').forEach(el=>el.onclick=()=>document.querySelectorAll('.modal').forEach(m=>m.classList.remove('on')));

async function openLibrary(){
  document.getElementById('library-modal').classList.add('on');
  await refreshLibrary();
  document.getElementById('lib-add').onclick=()=>document.getElementById('lib-input').click();
  document.getElementById('lib-input').onchange=async e=>{
    for(const f of e.target.files){
      try{ const m=classifyFile(f.name); if(!m||m.console!=='ps1') continue; await addRom(f);}catch(err){ alert(err.message);}
    }
    refreshLibrary(); build();
  };
}
async function refreshLibrary(){
  const list=document.getElementById('lib-list');
  const r=await listRoms('ps1');
  if(!r.length){ list.innerHTML='<p style="color:#a3a3a3;font-size:13px">No PS1 ROMs. Add .cue / .pbp / .chd above. Note: .bin files are matched to .cue — drop the .cue, not the .bin.</p>'; return;}
  list.innerHTML=r.map(x=>`<div class="rom-row"><span><b>${x.name}</b><br><small style="color:#737373">${formatBytes(x.size)}</small></span><button class="play" data-play="${x.id}">PLAY</button><button class="play" style="background:#525252" data-del="${x.id}">✕</button></div>`).join('');
  list.querySelectorAll('[data-play]').forEach(b=>b.onclick=e=>startEmulator(+e.target.dataset.play));
  list.querySelectorAll('[data-del]').forEach(b=>b.onclick=async e=>{ await removeRom(+e.target.dataset.del); refreshLibrary(); build();});
}
function startEmulator(id){
  document.querySelectorAll('.modal').forEach(m=>m.classList.remove('on'));
  const mount=document.getElementById('emu-mount'); mount.classList.add('on'); document.getElementById('emu-close').style.display='';
  runRom('ps1',id,mount).catch(e=>mount.innerHTML=`<div class="emu-unsupported">${e.message}</div>`);
}
document.getElementById('emu-close').onclick=()=>{ const m=document.getElementById('emu-mount'); m.classList.remove('on'); m.innerHTML=''; document.getElementById('emu-close').style.display='none';};

function openSettings(){
  document.getElementById('settings-modal').classList.add('on');
  const n=document.getElementById('ps1-user'); n.value=localStorage.getItem('ps1-user')||'Player'; n.oninput=()=>localStorage.setItem('ps1-user',n.value);
  const t=document.getElementById('ps1-sound'); t.classList.toggle('on',AUDIO.on);
  t.onclick=()=>{AUDIO.on=!AUDIO.on; t.classList.toggle('on',AUDIO.on);};
  document.getElementById('ps1-export').onclick=async()=>{
    try{ await exportConsole({ title:'PlayStation — Standalone', htmlUrl:'index.html', cssUrls:['ps1.css'],
      jsModules:['ps1.js','../../assets/js/sound.js','../../assets/js/roms.js','../../assets/js/emulator.js','../../assets/js/export.js','../../assets/js/features.js','../../assets/js/storage.js']});}
    catch(e){ alert('Export failed: '+e.message);}
  };
}
