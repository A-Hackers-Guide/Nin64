import { play, ctx as audioCtx } from '../../assets/js/sound.js';
import { listRoms, addRom, removeRom, formatBytes, classifyFile } from '../../assets/js/roms.js';
import { runRom } from '../../assets/js/emulator.js';
import { exportConsole } from '../../assets/js/export.js';
import { autoAttach } from '../../assets/js/features.js';
autoAttach('gba');

const AUDIO={on:true};
document.addEventListener('pointerdown', function once(){try{audioCtx();}catch{}}, {once:true});
window.addEventListener('load', () => setTimeout(()=>play('snes','boot'), 300));

async function build() {
  const menu = document.getElementById('menu');
  const roms = await listRoms('gba');
  const items = [];
  for (const r of roms) items.push({ label: r.name.replace(/\.gba$/i,'').slice(0,28), action: () => startEmulator(r.id) });
  items.push({ label: 'Add ROM…', action: openLibrary });
  items.push({ label: 'Options',  action: openSettings });
  items.push({ label: 'Exit',     action: () => { play('snes','select'); setTimeout(()=>location.href='../../index.html', 200); } });
  menu.innerHTML = items.map((it, i) => `<div class="menu-item ${i === 0 ? 'sel' : ''}" data-i="${i}">${it.label}</div>`).join('');
  menu.querySelectorAll('.menu-item').forEach(el => {
    el.onmouseenter = () => { menu.querySelectorAll('.menu-item').forEach(x => x.classList.remove('sel')); el.classList.add('sel'); AUDIO.on && play('snes','hover'); };
    el.onclick = () => { play('snes','select'); items[+el.dataset.i].action(); };
  });
}
build();

document.querySelectorAll('[data-close]').forEach(el=>el.onclick=()=>document.querySelectorAll('.modal').forEach(m=>m.classList.remove('on')));

async function openLibrary(){
  document.getElementById('library-modal').classList.add('on');
  await refreshLibrary();
  document.getElementById('lib-add').onclick = () => document.getElementById('lib-input').click();
  document.getElementById('lib-input').onchange = async e => {
    for (const f of e.target.files) {
      try { const m = classifyFile(f.name); if (!m || m.console !== 'gba') continue; await addRom(f);} catch(err){ alert(err.message);}
    }
    refreshLibrary(); build();
  };
}
async function refreshLibrary(){
  const list = document.getElementById('lib-list');
  const r = await listRoms('gba');
  if (!r.length) { list.innerHTML = '<p>No GBA ROMs yet.</p>'; return; }
  list.innerHTML = r.map(x=>`<div class="rom-row"><span>${x.name}<br><small style="opacity:0.6">${formatBytes(x.size)}</small></span><button class="play" data-play="${x.id}">PLAY</button><button class="play" style="background:#ef4444;color:#fff" data-del="${x.id}">✕</button></div>`).join('');
  list.querySelectorAll('[data-play]').forEach(b=>b.onclick=e=>startEmulator(+e.target.dataset.play));
  list.querySelectorAll('[data-del]').forEach(b=>b.onclick=async e=>{ await removeRom(+e.target.dataset.del); refreshLibrary(); build();});
}
function startEmulator(id){
  document.querySelectorAll('.modal').forEach(m=>m.classList.remove('on'));
  const mount = document.getElementById('emu-mount');
  mount.classList.add('on'); document.getElementById('emu-close').style.display='';
  runRom('gba', id, mount).catch(e=>mount.innerHTML=`<div class="emu-unsupported">${e.message}</div>`);
}
document.getElementById('emu-close').onclick=()=>{ const m=document.getElementById('emu-mount'); m.classList.remove('on'); m.innerHTML=''; document.getElementById('emu-close').style.display='none';};

function openSettings(){
  document.getElementById('settings-modal').classList.add('on');
  const n=document.getElementById('gba-user'); n.value=localStorage.getItem('gba-user')||'Player'; n.oninput=()=>localStorage.setItem('gba-user',n.value);
  const t=document.getElementById('gba-sound'); t.classList.toggle('on',AUDIO.on);
  t.onclick=()=>{AUDIO.on=!AUDIO.on; t.classList.toggle('on',AUDIO.on);};
  document.getElementById('gba-export').onclick=async()=>{
    try { await exportConsole({ title:'GBA — Standalone', htmlUrl:'index.html', cssUrls:['gba.css'],
      jsModules:['gba.js','../../assets/js/sound.js','../../assets/js/roms.js','../../assets/js/emulator.js','../../assets/js/export.js','../../assets/js/features.js','../../assets/js/storage.js']});}
    catch(e){ alert('Export failed: '+e.message);}
  };
}
