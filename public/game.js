// game.js — Chronicles of the Shattered Labyrinth (Web MVP, hardened Return-to-Hub)
import { realms, pickRealmByDate } from './realms.js';

// ------- DOM
const hubEl = document.getElementById('hub');
const metaShardsEl = document.getElementById('metaShards');
const metaBestEl = document.getElementById('metaBest');
const unlockedEl = document.getElementById('unlocked');
const classSelect = document.getElementById('classSelect');
const hardModeEl = document.getElementById('hardMode');
const startRunBtn = document.getElementById('startRun');
const resetMetaBtn = document.getElementById('resetMeta');
const hubStatusEl = document.getElementById('hubStatus');

const gameScreenEl = document.getElementById('gameScreen');
const floorEl = document.getElementById('floor');
const relicsEl = document.getElementById('relics');
const hpEl = document.getElementById('hp');
const shardsEl = document.getElementById('shards');
const realmEl = document.getElementById('realm');
const exitBtn = document.getElementById('exitBtn');

const choiceOverlayEl = document.getElementById('choiceOverlay');
const choiceTitleEl = document.getElementById('choiceTitle');
const choiceListEl = document.getElementById('choiceList');

const gameOverEl = document.getElementById('gameOver');
const goStatsEl = document.getElementById('goStats');
const returnHubBtn = document.getElementById('returnHub');

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

// --- Helpers to toggle screens/overlays robustly
function hideOverlays() {
  if (choiceOverlayEl) choiceOverlayEl.classList.add('hidden');
  if (gameOverEl) gameOverEl.classList.add('hidden');
}
function showHub() {
  if (gameScreenEl) gameScreenEl.classList.add('hidden');
  if (hubEl) hubEl.classList.remove('hidden');
  run = null;
  try { renderMeta(); } catch {}
}
function forceReturnToHub() {
  try {
    hideOverlays(); showHub();
    // Validate that hub is visible and game hidden; otherwise fallback
    const ok = hubEl && !hubEl.classList.contains('hidden');
    if (!ok) throw new Error('UI toggle failed');
  } catch (e) {
    // Absolute fallback (guaranteed): reload to reset state
    location.replace('/');
  }
}

// Defensive: ensure overlays are hidden on first load
hideOverlays();

// ------- RNG util (mulberry32)
function rng(seed) {
  let t = seed >>> 0;
  return function() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ t >>> 15, 1 | t);
    r ^= r + Math.imul(r ^ r >>> 7, 61 | r);
    return ((r ^ r >>> 14) >>> 0) / 4294967296;
  };
}

// ------- Meta (legacy) persistence
const DEFAULT_META = {
  shards: 0,
  bestFloor: 0,
  upgrades: { hp: 0, dmg: 0, spd: 0 },
  unlocked: ['Warrior', 'Mage', 'Ranger'],
  lastSeedDate: null
};
function loadMeta() {
  try { return { ...DEFAULT_META, ...JSON.parse(localStorage.getItem('lab_meta') || '{}') }; }
  catch { return { ...DEFAULT_META }; }
}
function saveMeta() { localStorage.setItem('lab_meta', JSON.stringify(meta)); }
let meta = loadMeta();

function renderMeta() {
  if (metaShardsEl) metaShardsEl.textContent = meta.shards;
  if (metaBestEl) metaBestEl.textContent = meta.bestFloor;
  if (unlockedEl) {
    unlockedEl.innerHTML = '';
    meta.unlocked.forEach(u => {
      const c = document.createElement('span');
      c.className = 'chip';
      c.textContent = u;
      unlockedEl.appendChild(c);
    });
  }
  if (classSelect) {
    classSelect.innerHTML = '';
    meta.unlocked.forEach(u => {
      const o = document.createElement('option');
      o.value = u; o.textContent = u;
      classSelect.appendChild(o);
    });
  }
}
renderMeta();

// Upgrades
document.querySelectorAll('.upgrades .btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.upg;
    const cost = 50 * (meta.upgrades[key] + 1);
    if (meta.shards >= cost) {
      meta.shards -= cost;
      meta.upgrades[key]++;
      saveMeta(); renderMeta();
      if (hubStatusEl) hubStatusEl.textContent = `Upgraded ${key} to ${meta.upgrades[key]}!`;
    } else {
      if (hubStatusEl) hubStatusEl.textContent = `Not enough shards (cost ${cost}).`;
    }
  });
});

if (resetMetaBtn) resetMetaBtn.addEventListener('click', () => {
  if (!confirm('Reset all legacy progress?')) return;
  meta = { ...DEFAULT_META };
  saveMeta(); renderMeta();
  if (hubStatusEl) hubStatusEl.textContent = 'Legacy reset.';
});

// ------- Classes
const Classes = {
  Warrior: { hp: 120, dmg: 12, spd: 230, skillCd: 8, skillName: 'Shield Dome' },
  Mage:    { hp: 90,  dmg: 10, spd: 240, skillCd: 6, skillName: 'Chrono Blast' },
  Ranger:  { hp: 100, dmg: 11, spd: 250, skillCd: 7, skillName: 'Snare Trap' },
  Trickster:{hp: 95,  dmg: 9,  spd: 260, skillCd: 6, skillName: 'Decoy' },
  Engineer:{ hp: 110, dmg: 9,  spd: 225, skillCd: 9, skillName: 'Turret' },
  Timekeeper:{hp: 85, dmg: 10, spd: 240, skillCd: 10, skillName: 'Time Slow' },
};

// ------- Input
const input = { left:false, right:false, up:false, down:false, dodge:false, atkL:false, atkH:false, skill:false };
addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft' || e.key === 'a') input.left = true;
  if (e.key === 'ArrowRight' || e.key === 'd') input.right = true;
  if (e.key === 'ArrowUp' || e.key === 'w') input.up = true;
  if (e.key === 'ArrowDown' || e.key === 's') input.down = true;
  if (e.key === ' ') input.dodge = true;
  if (e.key === 'j' || e.key === 'J') input.atkL = true;
  if (e.key === 'k' || e.key === 'K') input.atkH = true;
  if (e.key === 'l' || e.key === 'L') input.skill = true;
});
addEventListener('keyup', e => {
  if (e.key === 'ArrowLeft' || e.key === 'a') input.left = false;
  if (e.key === 'ArrowRight' || e.key === 'd') input.right = false;
  if (e.key === 'ArrowUp' || e.key === 'w') input.up = false;
  if (e.key === 'ArrowDown' || e.key === 's') input.down = false;
  if (e.key === ' ') input.dodge = false;
  if (e.key === 'j' || e.key === 'J') input.atkL = false;
  if (e.key === 'k' || e.key === 'K') input.atkH = false;
  if (e.key === 'l' || e.key === 'L') input.skill = false;
});

// Escape key: if on game over/choice overlay, close to hub
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const overlayOpen = (choiceOverlayEl && !choiceOverlayEl.classList.contains('hidden'))
      || (gameOverEl && !gameOverEl.classList.contains('hidden'));
    if (overlayOpen) forceReturnToHub();
  }
});

// ------- Game State
let run = null;
let R = Math.random;
let realm = { name:'—', bg:'#0b1228' };

function startRun() {
  const chosenClass = (classSelect && classSelect.value) || 'Warrior';
  const base = Classes[chosenClass] || Classes.Warrior;
  const hpBonus = meta.upgrades.hp * 10;
  const dmgBonus = meta.upgrades.dmg * 2;
  const spdBonus = meta.upgrades.spd * 8;

  run = {
    className: chosenClass,
    floor: 1,
    stage: 1,
    shards: 0,
    relics: [],
    curses: [],
    hard: !!(hardModeEl && hardModeEl.checked),
    timers: { spawn: 0, relic: 15, boss: 0 },
    player: {
      x: W/2, y: H-80, r: 14,
      vx:0, vy:0,
      maxhp: base.hp + hpBonus,
      hp: base.hp + hpBonus,
      dmg: base.dmg + dmgBonus,
      spd: base.spd + spdBonus,
      invul: 0,
      cdL: 0, cdH: 0, cdSkill: 0,
      skillName: base.skillName
    },
    enemies: [],
    projectiles: [],
    effects: [],
    boss: null,
    over: false,
    time: 0
  };

  // seed RNG from server daily-seed, fallback to date string
  fetch('/api/daily-seed').then(r=>r.json()).then(info => {
    meta.lastSeedDate = info.date;
    saveMeta();
    R = rng(info.seed ^ (chosenClass.length * 7919));
    realm = pickRealmByDate(info.date);
    setupRunUI();
  }).catch(() => {
    const dateStr = new Date().toISOString().slice(0,10);
    R = rng([...dateStr].reduce((a,c)=>a+c.charCodeAt(0),0) ^ (chosenClass.length*7919));
    realm = pickRealmByDate(dateStr);
    setupRunUI();
  });
}

function setupRunUI() {
  if (hubEl) hubEl.classList.add('hidden');
  if (gameScreenEl) gameScreenEl.classList.remove('hidden');
  if (realmEl) realmEl.textContent = `Realm: ${realm.name}`;
  if (canvas) canvas.style.background = realm.bg;
  updateHud();
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function endRun(reason='Fallen') {
  if (!run || run.over) return;
  run.over = true;
  const floorVal = run.floor * 10 + run.stage;
  const shardsGain = Math.max(5, Math.floor(run.time/10) + run.relics.length*3 + floorVal);
  meta.shards += shardsGain;
  meta.bestFloor = Math.max(meta.bestFloor, floorVal);
  saveMeta();

  if (goStatsEl) goStatsEl.textContent = `${reason}. You reached Floor ${run.floor}-${run.stage}, gained ${shardsGain} shards, relics ${run.relics.length}.`;
  if (gameOverEl) {
    gameOverEl.classList.remove('hidden');
    // clicking backdrop closes to hub
    gameOverEl.addEventListener('click', (e) => {
      if (e.target === gameOverEl) forceReturnToHub();
    }, { once: true });
  }
}

if (typeof document !== 'undefined') {
  // Multiple bindings to be extra safe
  if (returnHubBtn) {
    returnHubBtn.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      forceReturnToHub();
    });
  }
  // Also guard the Exit Run button
  if (exitBtn) exitBtn.addEventListener('click', () => endRun('Exit'));
}

if (startRunBtn) startRunBtn.addEventListener('click', startRun);

// Global event delegation to guarantee Return-to-Hub works even if direct binding failed
document.addEventListener('click', (ev) => {
  const t = ev.target;
  if (!t) return;
  const btn = (t.id === 'returnHub') ? t : (t.closest ? t.closest('#returnHub') : null);
  if (btn) {
    ev.preventDefault();
    forceReturnToHub();
  }
});


// ------- Entities & Combat
function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

function spawnEnemy(kind='grunt') {
  const size = kind==='grunt'? 16 : kind==='skitter'? 12 : 20;
  const speed = kind==='grunt'? 90 : kind==='skitter'? 140 : 70;
  const hp = kind==='grunt'? 25 : kind==='skitter'? 18 : 40;
  const x = 20 + R()*(W-40), y = -30;
  run.enemies.push({ kind, x, y, r: size, hp, speed, t: 0 });
}

function spawnBoss() {
  run.boss = { x: W/2, y: 100, r: 40, hp: 600 + run.floor*120, phase: 1, t: 0 };
}

function damageEnemy(e, dmg) {
  e.hp -= dmg;
  run.effects.push({ type:'hit', x:e.x, y:e.y, t:0 });
  if (e.hp <= 0) {
    run.shards += 2 + (run.hard?1:0);
    if (R()<0.08) run.relics.push('Shard of Fate');
  }
}

function circleHit(ax,ay,ar,bx,by,br){ const dx=ax-bx, dy=ay-by; return (dx*dx+dy*dy) <= (ar+br)*(ar+br); }

function lightAttack() {
  const p = run.player;
  if (p.cdL > 0) return;
  p.cdL = 0.35;
  run.effects.push({ type:'slash', x:p.x, y:p.y, r:50, t:0.15 });
  run.enemies.forEach(e => { if (circleHit(p.x,p.y,50,e.x,e.y,e.r)) damageEnemy(e, p.dmg); });
  if (run.boss && circleHit(p.x,p.y,50, run.boss.x, run.boss.y, run.boss.r)) run.boss.hp -= p.dmg;
}

function heavyAttack() {
  const p = run.player;
  if (p.cdH > 0) return;
  p.cdH = 1.0;
  run.effects.push({ type:'boom', x:p.x, y:p.y, r:70, t:0.25 });
  run.enemies.forEach(e => { if (circleHit(p.x,p.y,70,e.x,e.y,e.r)) damageEnemy(e, p.dmg*2); });
  if (run.boss && circleHit(p.x,p.y,70, run.boss.x, run.boss.y, run.boss.r)) run.boss.hp -= p.dmg*2;
}

function useSkill() {
  const p = run.player;
  if (p.cdSkill > 0) return;
  switch (run.className) {
    case 'Warrior': p.invul = Math.max(p.invul, 1.8); p.cdSkill = 8; break;
    case 'Mage':
      p.cdSkill = 6;
      let target = nearestEnemy(p.x, p.y);
      if (target) run.projectiles.push({ x:p.x, y:p.y, vx:(target.x-p.x)/300, vy:(target.y-p.y)/300, r:6, dmg:p.dmg*2, t:0 });
      break;
    case 'Ranger':
      p.cdSkill = 7;
      run.effects.push({ type:'trap', x:p.x, y:p.y, r:40, t:4 });
      break;
    default: p.cdSkill = 8;
  }
}

function nearestEnemy(x,y){
  let best=null, bd=1e9;
  run.enemies.forEach(e=>{
    const d=(e.x-x)*(e.x-x)+(e.y-y)*(e.y-y);
    if (d<bd){bd=d;best=e;}
  });
  return best;
}

// ------- Loop
let lastTime = 0;
function loop(ts){
  if (!run || run.over) return;
  const dt = Math.min(0.033, (ts-lastTime)/1000);
  lastTime = ts;
  run.time += dt;

  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function update(dt){
  const p = run.player;
  // cooldowns
  p.cdL = Math.max(0, p.cdL - dt);
  p.cdH = Math.max(0, p.cdH - dt);
  p.cdSkill = Math.max(0, p.cdSkill - dt);
  p.invul = Math.max(0, p.invul - dt);

  // inputs
  let vx = (input.left?-1:0) + (input.right?1:0);
  let vy = (input.up?-1:0) + (input.down?1:0);
  if (vx||vy){ const len = Math.hypot(vx,vy) || 1; vx/=len; vy/=len; }
  const speed = input.dodge ? p.spd*1.7 : p.spd;
  p.x = clamp(p.x + vx*speed*dt, p.r, W-p.r);
  p.y = clamp(p.y + vy*speed*dt, p.r, H-p.r);

  if (input.atkL) { lightAttack(); input.atkL=false; }
  if (input.atkH) { heavyAttack(); input.atkH=false; }
  if (input.skill) { useSkill(); input.skill=false; }

  // spawn enemies
  run.timers.spawn += dt;
  const baseSpawn = run.hard ? 0.55 : 0.7;
  const spawnEvery = Math.max(0.15, baseSpawn - run.floor*0.02 - run.stage*0.01);
  if (run.timers.spawn >= spawnEvery){
    run.timers.spawn = 0;
    const r = R();
    spawnEnemy(r<0.7?'grunt' : r<0.9?'skitter':'brute');
  }

  // enemies move
  run.enemies.forEach(e=>{
    e.t += dt;
    e.y += e.speed*dt;
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx,dy)||1;
    e.x += (dx/d)*e.speed*0.35*dt;
  });
  run.enemies = run.enemies.filter(e => e.y < H+60 && e.hp > 0);

  // projectiles
  run.projectiles.forEach(pr => { pr.t+=dt; pr.x+=pr.vx*300*dt; pr.y+=pr.vy*300*dt; });
  run.projectiles = run.projectiles.filter(pr => pr.t < 2 && pr.x>-20 && pr.x<W+20 && pr.y>-20 && pr.y<H+20);
  run.projectiles.forEach(pr => {
    run.enemies.forEach(e => {
      if (circleHit(pr.x,pr.y,pr.r, e.x,e.y,e.r)) { damageEnemy(e, pr.dmg); pr.t=100; }
    });
    if (run.boss && circleHit(pr.x,pr.y,pr.r, run.boss.x, run.boss.y, run.boss.r)) { run.boss.hp -= pr.dmg; pr.t=100; }
  });

  // effects (trap slow)
  run.effects.forEach(ef => {
    ef.t -= dt;
    if (ef.type==='trap'){
      run.enemies.forEach(e=>{
        if (circleHit(ef.x,ef.y,ef.r, e.x,e.y,e.r)) e.y -= e.speed*0.6*dt;
      });
    }
  });
  run.effects = run.effects.filter(ef => ef.t>0);

  // boss logic
  if (!run.boss && run.stage>=3) spawnBoss();
  if (run.boss){
    const b = run.boss;
    b.t += dt;
    const hpPct = b.hp / (600 + run.floor*120);
    if (hpPct < 0.33) b.phase = 3;
    else if (hpPct < 0.66) b.phase = 2;

    const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx,dy)||1;
    const chase = (b.phase===1? 60 : b.phase===2? 90 : 120);
    b.x += (dx/d)*chase*dt;
    if (Math.random()< (b.phase===1?0.01 : b.phase===2?0.02:0.03)) {
      run.enemies.push({ kind:'meteor', x:Math.random()*W, y:-40, r:14, hp: 20, speed: 200, t:0 });
    }
    if (circleHit(p.x,p.y,p.r, b.x,b.y,b.r)) damagePlayer(14);
    if (b.hp <= 0){
      run.shards += 30;
      run.relics.push('Godspark');
      run.boss = null;
      nextStage();
    }
  }

  // enemy collisions
  run.enemies.forEach(e => {
    if (circleHit(p.x,p.y,p.r, e.x,e.y,e.r)) damagePlayer(e.kind==='brute'? 16 : e.kind==='meteor'? 12 : 8);
  });

  // periodic relic/curse choices
  run.timers.relic -= dt;
  if (run.timers.relic <= 0){
    run.timers.relic = 18 + Math.random()*6;
    openChoice();
  }

  // advance stage after time
  run.timers.boss += dt;
  if (!run.boss && run.timers.boss > 30) nextStage();

  updateHud();
  if (p.hp <= 0) endRun('Fallen');
}

function damagePlayer(amount){
  const p = run.player;
  if (p.invul > 0) return;
  // fragile curse support
  const extra = run.curseFragile ? (1+run.curseFragile) : 1;
  p.hp -= amount * extra;
  p.invul = 0.8;
}

function nextStage(){
  run.stage++;
  run.timers.boss = 0;
  if (run.stage > 3){
    run.stage = 1;
    run.floor++;
    run.player.hp = Math.min(run.player.maxhp, run.player.hp + 20);
  }
}

function updateHud(){
  if (!run) return;
  if (floorEl) floorEl.textContent = `Floor ${run.floor}-${run.stage}`;
  if (relicsEl) relicsEl.textContent = `Relics: ${run.relics.length}`;
  if (hpEl) hpEl.textContent = `HP: ${Math.max(0,Math.floor(run.player.hp))}/${run.player.maxhp}`;
  if (shardsEl) shardsEl.textContent = `Shards: ${run.shards}`;
}

function draw(){
  ctx.clearRect(0,0,W,H);
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#64748b';
  for (let x=0;x<W;x+=40) ctx.fillRect(x,0,1,H);
  for (let y=0;y<H;y+=40) ctx.fillRect(0,y,W,1);
  ctx.globalAlpha = 1;

  const p = run.player;
  ctx.beginPath();
  ctx.fillStyle = '#9ece6a';
  ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
  if (p.invul>0){
    ctx.strokeStyle = '#9ece6a';
    ctx.setLineDash([6,4]); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r+6,0,Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);
  }

  run.enemies.forEach(e => {
    ctx.beginPath();
    ctx.fillStyle = e.kind==='brute' ? '#d97706' : e.kind==='meteor' ? '#a855f7' : '#7aa2f7';
    ctx.arc(e.x,e.y,e.r,0,Math.PI*2); ctx.fill();
  });

  if (run.boss){
    const b = run.boss;
    ctx.beginPath();
    ctx.fillStyle = '#ef4444';
    ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.fillRect(W*0.2, 20, W*0.6, 10);
    ctx.fillStyle = '#ef4444';
    const maxHp = 600 + run.floor*120;
    ctx.fillRect(W*0.2, 20, (b.hp/maxHp)*W*0.6, 10);
  }

  run.projectiles.forEach(pr => {
    ctx.beginPath();
    ctx.fillStyle = '#60a5fa';
    ctx.arc(pr.x,pr.y,pr.r,0,Math.PI*2); ctx.fill();
  });

  run.effects.forEach(ef => {
    if (ef.type==='slash'){
      ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.fillStyle = '#a7f3d0';
      ctx.arc(ef.x,ef.y,ef.r,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    } else if (ef.type==='boom'){
      ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.fillStyle = '#fde68a';
      ctx.arc(ef.x,ef.y,ef.r,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    } else if (ef.type==='trap'){
      ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2;
      ctx.arc(ef.x,ef.y,ef.r,0,Math.PI*2); ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (ef.type==='hit'){
      ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.fillStyle = '#fca5a5';
      ctx.arc(ef.x,ef.y,10,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  });
}

// ------- Choice overlay (relics / curses)
const RELIC_POOL = [
  { name:'Chrono Blade', desc:'Speed up, but lose a bit of HP over time.', apply:(run)=>{ run.player.spd+=40; run.effects.push({type:"curseTick",t:9999}); } },
  { name:'Shard Magnet', desc:'Gain extra shards from kills.', apply:(run)=>{ run.shardBonus=(run.shardBonus||0)+1; } },
  { name:'Aegis Core', desc:'+30 Max HP.', apply:(run)=>{ run.player.maxhp+=30; run.player.hp+=30; } },
];
const CURSE_POOL = [
  { name:'Silenced', desc:'Heavy attack cooldown +50%.', apply:(run)=>{ run.curseHeavy = (run.curseHeavy||0)+0.5; } },
  { name:'Fragile', desc:'Take +20% damage.', apply:(run)=>{ run.curseFragile = (run.curseFragile||0)+0.2; } },
];

function openChoice(){
  if (!choiceListEl || !choiceOverlayEl) return;
  choiceListEl.innerHTML='';
  choiceTitleEl.textContent = 'Choose a Relic or accept a Curse for more shards';
  const opts = [];
  const picks = new Set();
  while (picks.size < 2) picks.add(Math.floor(Math.random()*RELIC_POOL.length));
  [...picks].forEach(i => opts.push({ type:'relic', ...RELIC_POOL[i] }));
  const curse = CURSE_POOL[Math.floor(Math.random()*CURSE_POOL.length)];
  opts.push({ type:'curse', ...curse });

  opts.forEach(o => {
    const div = document.createElement('div');
    div.className = 'option';
    div.innerHTML = `<strong>${o.name}</strong><br><small>${o.desc}</small>`;
    div.addEventListener('click', () => {
      if (o.type==='relic'){
        o.apply(run);
        run.relics.push(o.name);
      } else {
        o.apply(run);
        run.shards += 8;
      }
      choiceOverlayEl.classList.add('hidden');
    });
    choiceListEl.appendChild(div);
  });
  choiceOverlayEl.classList.remove('hidden');
}

// ------- Initialize on hub
hubEl && hubEl.classList.remove('hidden');
gameScreenEl && gameScreenEl.classList.add('hidden');
gameOverEl && gameOverEl.classList.add('hidden');