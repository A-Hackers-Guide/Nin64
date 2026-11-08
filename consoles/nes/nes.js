import { play, ctx as audioCtx } from '../../assets/js/sound.js';
import { listRoms, addRom, removeRom, formatBytes, classifyFile } from '../../assets/js/roms.js';
import { runRom } from '../../assets/js/emulator.js';
import { exportConsole } from '../../assets/js/export.js';
const AUDIO={on:true};
document.addEventListener('pointerdown', function once(){try{audioCtx();}catch{}}, {once:true});

window.addEventListener('load', () => setTimeout(()=>play('nes','boot'), 300));
window.addEventListener('keydown', e => { if (e.key === 'Enter') startMenu(); });
document.getElementById('boot').addEventListener('click', startMenu);
function startMenu() {
  play('nes','select');
  document.getElementById('boot').classList.add('done');
  document.getElementById('menu').classList.add('on');
}

async function build() {
  const g = document.getElementById('carts');
  const roms = await listRoms('nes');
  g.innerHTML = '';
  for (const r of roms) {
    const c = document.createElement('div');
    c.className = 'cart';
    c.innerHTML = `<div class="sub">NES</div><div class="label" title="${r.name}">${r.name.replace(/\.(nes|fds)$/i,'').slice(0,20)}</div>`;
    c.onmouseenter = () => AUDIO.on && play('nes','hover');
    c.onclick = () => { play('nes','select'); startEmulator(r.id); };
    g.appendChild(c);
  }
  const add = document.createElement('div'); add.className = 'cart add'; add.innerHTML = '＋';
  add.onclick = () => { play('nes','select'); openLibrary(); };
  g.appendChild(add);
}
build();

document.getElementById('settings-btn').onclick = () => { play('nes','select'); openSettings(); };
document.getElementById('library-btn').onclick  = () => { play('nes','select'); openLibrary();  };
document.getElementById('home-btn').onclick     = () => { play('nes','select'); setTimeout(()=>location.href='../../index.html',200); };
document.querySelectorAll('[data-close]').forEach(el=>el.onclick=()=>document.querySelectorAll('.modal').forEach(m=>m.classList.remove('on')));

async function openLibrary(){
  document.getElementById('library-modal').classList.add('on');
  await refreshLibrary();
  document.getElementById('lib-add').onclick = () => document.getElementById('lib-input').click();
  document.getElementById('lib-input').onchange = async e => {
    for (const f of e.target.files) {
      try { const m = classifyFile(f.name); if (!m || m.console !== 'nes') continue; await addRom(f);} catch{}
    }
    refreshLibrary(); build();
  };
}
async function refreshLibrary(){
  const list = document.getElementById('lib-list');
  const r = await listRoms('nes');
  if (!r.length) { list.innerHTML = '<p style="color:#9ca3af">No NES ROMs. Add .nes/.fds above.</p>'; return; }
  list.innerHTML = r.map(x=>`<div class="rom-row"><span>${x.name}<br><small style="color:#9ca3af">${formatBytes(x.size)}</small></span><button class="play" data-play="${x.id}">PLAY</button><button class="play" style="background:#4b5563" data-del="${x.id}">✕</button></div>`).join('');
  list.querySelectorAll('[data-play]').forEach(b=>b.onclick=e=>startEmulator(+e.target.dataset.play));
  list.querySelectorAll('[data-del]').forEach(b=>b.onclick=async e=>{ await removeRom(+e.target.dataset.del); refreshLibrary(); build();});
}
function startEmulator(id){
  document.querySelectorAll('.modal').forEach(m=>m.classList.remove('on'));
  const mount = document.getElementById('emu-mount');
  mount.classList.add('on'); document.getElementById('emu-close').style.display='';
  runRom('nes', id, mount).catch(e=>mount.innerHTML=`<div class="emu-unsupported">${e.message}</div>`);
}
document.getElementById('emu-close').onclick=()=>{ const m=document.getElementById('emu-mount'); m.classList.remove('on'); m.innerHTML=''; document.getElementById('emu-close').style.display='none';};

function openSettings(){
  document.getElementById('settings-modal').classList.add('on');
  const n=document.getElementById('nes-user'); n.value=localStorage.getItem('nes-user')||'Player'; n.oninput=()=>localStorage.setItem('nes-user',n.value);
  const t=document.getElementById('nes-sound'); t.classList.toggle('on',AUDIO.on);
  t.onclick=()=>{AUDIO.on=!AUDIO.on; t.classList.toggle('on',AUDIO.on);};
  document.getElementById('nes-export').onclick=async()=>{
    try { await exportConsole({ title:'NES Menu — Standalone', htmlUrl:'index.html', cssUrls:['nes.css'],
      jsModules:['nes.js','../../assets/js/sound.js','../../assets/js/roms.js','../../assets/js/emulator.js','../../assets/js/export.js']});}
    catch(e){ alert('Export failed: '+e.message);}
  };
}
