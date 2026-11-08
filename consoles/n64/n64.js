import { play, ctx as audioCtx } from '../../assets/js/sound.js';
import { listRoms, addRom, removeRom, formatBytes, classifyFile } from '../../assets/js/roms.js';
import { runRom } from '../../assets/js/emulator.js';
import { exportConsole } from '../../assets/js/export.js';
import { autoAttach } from '../../assets/js/features.js';
autoAttach('n64');
const AUDIO={on:true};
document.addEventListener('pointerdown', function once(){try{audioCtx();}catch{}}, {once:true});
window.addEventListener('load', () => {
  setTimeout(()=>play('n64','boot'), 400);
  setTimeout(()=>{ document.getElementById('boot').classList.add('done'); document.getElementById('menu').classList.add('on'); }, 3000);
});
async function build() {
  const g = document.getElementById('carts');
  const roms = await listRoms('n64');
  g.innerHTML = '';
  for (const r of roms) {
    const c = document.createElement('div');
    c.className = 'cart';
    c.innerHTML = `<div class="sub">N64</div><div class="label" title="${r.name}">${r.name.replace(/\.(n64|z64|v64)$/i,'').slice(0,20)}</div>`;
    c.onmouseenter = () => AUDIO.on && play('n64','hover');
    c.onclick = () => { play('n64','select'); startEmulator(r.id); };
    g.appendChild(c);
  }
  const add = document.createElement('div');
  add.className = 'cart add';
  add.innerHTML = '＋';
  add.onclick = () => { play('n64','select'); openLibrary(); };
  g.appendChild(add);
}
build();

document.getElementById('settings-btn').onclick = () => { play('n64','select'); openSettings(); };
document.getElementById('library-btn').onclick  = () => { play('n64','select'); openLibrary();  };
document.getElementById('home-btn').onclick     = () => { play('n64','select'); setTimeout(()=>location.href='../../index.html',200); };
document.querySelectorAll('[data-close]').forEach(el=>el.onclick=()=>document.querySelectorAll('.modal').forEach(m=>m.classList.remove('on')));

async function openLibrary() {
  document.getElementById('library-modal').classList.add('on');
  await refreshLibrary();
  document.getElementById('lib-add').onclick = () => document.getElementById('lib-input').click();
  document.getElementById('lib-input').onchange = async e => {
    for (const f of e.target.files) {
      try { const m=classifyFile(f.name); if(!m||m.console!=='n64') continue; await addRom(f);} catch{}
    }
    refreshLibrary(); build();
  };
}
async function refreshLibrary() {
  const list = document.getElementById('lib-list');
  const r = await listRoms('n64');
  if (!r.length) { list.innerHTML = '<p style="color:#fde047;opacity:0.6">No N64 ROMs. Add .n64/.z64/.v64 above.</p>'; return; }
  list.innerHTML = r.map(x=>`<div class="rom-row"><span>${x.name}<br><small style="opacity:0.6">${formatBytes(x.size)}</small></span><button class="play" data-play="${x.id}">PLAY</button><button class="play" style="background:#f43f5e" data-del="${x.id}">✕</button></div>`).join('');
  list.querySelectorAll('[data-play]').forEach(b=>b.onclick=e=>startEmulator(+e.target.dataset.play));
  list.querySelectorAll('[data-del]').forEach(b=>b.onclick=async e=>{ await removeRom(+e.target.dataset.del); refreshLibrary(); build();});
}
function startEmulator(id){
  document.querySelectorAll('.modal').forEach(m=>m.classList.remove('on'));
  const mount = document.getElementById('emu-mount');
  mount.classList.add('on'); document.getElementById('emu-close').style.display='';
  runRom('n64', id, mount).catch(e=>mount.innerHTML=`<div class="emu-unsupported">${e.message}</div>`);
}
document.getElementById('emu-close').onclick=()=>{ const m=document.getElementById('emu-mount'); m.classList.remove('on'); m.innerHTML=''; document.getElementById('emu-close').style.display='none';};

function openSettings(){
  document.getElementById('settings-modal').classList.add('on');
  const n=document.getElementById('n64-user'); n.value=localStorage.getItem('n64-user')||'Player'; n.oninput=()=>localStorage.setItem('n64-user',n.value);
  const t=document.getElementById('n64-sound'); t.classList.toggle('on',AUDIO.on);
  t.onclick=()=>{AUDIO.on=!AUDIO.on; t.classList.toggle('on',AUDIO.on);};
  document.getElementById('n64-export').onclick=async()=>{
    try { await exportConsole({ title:'N64 Menu — Standalone', htmlUrl:'index.html', cssUrls:['n64.css'],
      jsModules:['n64.js','../../assets/js/sound.js','../../assets/js/roms.js','../../assets/js/emulator.js','../../assets/js/export.js','../../assets/js/features.js']});}
    catch(e){ alert('Export failed: '+e.message);}
  };
}
