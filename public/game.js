import { realms, pickRealmByDate } from './realms.js';

const hubEl = document.getElementById('hub');
const gameEl = document.getElementById('gameScreen');
const overEl = document.getElementById('gameOver');
const startBtn = document.getElementById('startRun');
const exitBtn = document.getElementById('exitBtn');
const returnBtn = document.getElementById('returnHub');

const floorEl = document.getElementById('floor');
const relicsEl = document.getElementById('relics');
const hpEl = document.getElementById('hp');
const shardsEl = document.getElementById('shards');
const realmEl = document.getElementById('realm');

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

// If we landed on /hub via the link, reset UI and rewrite URL back to '/'
if (location.pathname === '/hub') {
  if (overEl) overEl.classList.add('hidden');
  if (gameEl) gameEl.classList.add('hidden');
  if (hubEl) hubEl.classList.remove('hidden');
  try { history.replaceState(null, '', '/'); } catch {}
}

// ----- Simple RNG
function rng(seed){ let t=seed>>>0; return function(){ t+=0x6D2B79F5; let r=Math.imul(t^t>>>15,1|t); r^=r+Math.imul(r^r>>>7,61|r); return ((r^r>>>14)>>>0)/4294967296; }; }

// ----- Meta (minimal for demo)
let meta = { shards: 0, best: 0 };

// ----- Run state
let run=null, R=Math.random, realm={ name:'—', bg:'#0b1228' };
const playerBase = { hp: 100, dmg: 10, spd: 240 };

function startRun(){
  run = {
    floor:1, stage:1, time:0,
    shards:0, relics:[],
    player:{ x:W/2, y:H-80, r:14, hp:playerBase.hp, maxhp:playerBase.hp, dmg:playerBase.dmg, spd:playerBase.spd, inv:0 },
    enemies:[], projectiles:[], effects:[], boss:null, over:false,
    timers:{ spawn:0, relic:12, boss:0 }
  };
  fetch('/api/daily-seed').then(r=>r.json()).then(info=>{
    R = rng(info.seed);
    realm = pickRealmByDate(info.date);
    applyRealm();
    show(gameEl); hide(hubEl); updateHud();
    lastTime = performance.now(); requestAnimationFrame(loop);
  }).catch(()=>{
    const d=new Date().toISOString().slice(0,10);
    R = rng([...d].reduce((a,c)=>a+c.charCodeAt(0),0));
    realm = pickRealmByDate(d);
    applyRealm();
    show(gameEl); hide(hubEl); updateHud();
    lastTime = performance.now(); requestAnimationFrame(loop);
  });
}

function applyRealm(){
  if (realmEl) realmEl.textContent = `Realm: ${realm.name}`;
  if (canvas) canvas.style.background = realm.bg;
}

function endRun(reason='Fallen'){
  if (!run || run.over) return;
  run.over = true;
  overEl && overEl.classList.remove('hidden');
}

function show(el){ el && el.classList.remove('hidden'); }
function hide(el){ el && el.classList.add('hidden'); }

// ----- Input
const input={left:false,right:false,up:false,down:false,dodge:false, atkL:false, atkH:false, skill:false};
addEventListener('keydown',e=>{ if(e.key==='a'||e.key==='ArrowLeft')input.left=true; if(e.key==='d'||e.key==='ArrowRight')input.right=true;
  if(e.key==='w'||e.key==='ArrowUp')input.up=true; if(e.key==='s'||e.key==='ArrowDown')input.down=true;
  if(e.key===' ')input.dodge=true; if(e.key==='j'||e.key==='J')input.atkL=true; if(e.key==='k'||e.key==='K')input.atkH=true; if(e.key==='l'||e.key==='L')input.skill=true; });
addEventListener('keyup',e=>{ if(e.key==='a'||e.key==='ArrowLeft')input.left=false; if(e.key==='d'||e.key==='ArrowRight')input.right=false;
  if(e.key==='w'||e.key==='ArrowUp')input.up=false; if(e.key==='s'||e.key==='ArrowDown')input.down=false;
  if(e.key===' ')input.dodge=false; if(e.key==='j'||e.key==='J')input.atkL=false; if(e.key==='k'||e.key==='K')input.atkH=false; if(e.key==='l'||e.key==='L')input.skill=false; });

// ----- Loop
let lastTime=0;
function loop(ts){
  if(!run||run.over) return;
  const dt=Math.min(0.033,(ts-lastTime)/1000); lastTime=ts; run.time+=dt;
  update(dt); draw(); requestAnimationFrame(loop);
}

function update(dt){
  const p=run.player;
  // Movement
  let vx=(input.left?-1:0)+(input.right?1:0), vy=(input.up?-1:0)+(input.down?1:0);
  if(vx||vy){ const l=Math.hypot(vx,vy)||1; vx/=l; vy/=l; }
  const sp=input.dodge?p.spd*1.7:p.spd; p.x=Math.max(p.r,Math.min(W-p.r,p.x+vx*sp*dt)); p.y=Math.max(p.r,Math.min(H-p.r,p.y+vy*sp*dt));

  // Spawn enemies
  run.timers.spawn+=dt;
  if(run.timers.spawn>=Math.max(0.15,0.8-run.floor*0.03-run.stage*0.02)){ run.timers.spawn=0; spawnEnemy(); }

  // Enemies move + collide
  run.enemies.forEach(e=>{ e.t+=dt; e.y+=e.speed*dt; const dx=p.x-e.x, dy=p.y-e.y, d=Math.hypot(dx,dy)||1; e.x+=dx/d*e.speed*0.3*dt; });
  run.enemies = run.enemies.filter(e=> e.y<H+60 && e.hp>0);
  run.enemies.forEach(e=>{ if(circleHit(p.x,p.y,p.r,e.x,e.y,e.r)) damagePlayer( e.kind==='brute'?16:8 ); });

  // Boss timing
  run.timers.boss+=dt; if(!run.boss && run.timers.boss>30) spawnBoss();

  updateHud();
  if(p.hp<=0) endRun('Fallen');
}

function spawnEnemy(){ const r=R(); const kind=r<0.7?'grunt':r<0.9?'skitter':'brute';
  const size=kind==='grunt'?16:kind==='skitter'?12:20; const speed=kind==='grunt'?90:kind==='skitter'?140:70;
  run.enemies.push({ kind, x:20+R()*(W-40), y:-30, r:size, hp:kind==='brute'?40:kind==='skitter'?18:25, speed, t:0 });
}
function spawnBoss(){ run.boss={ x:W/2, y:100, r:40, hp:600+run.floor*120, phase:1, t:0 }; }

function damagePlayer(n){ const p=run.player; if(p.inv>0) return; p.hp-=n; p.inv=0.8; }

function updateHud(){ floorEl.textContent=`Floor ${run.floor}-${run.stage}`; relicsEl.textContent=`Relics: ${run.relics.length}`; hpEl.textContent=`HP: ${Math.max(0,Math.floor(run.player.hp))}/${run.player.maxhp}`; shardsEl.textContent=`Shards: ${run.shards}`; }

function circleHit(ax,ay,ar,bx,by,br){ const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy <= (ar+br)*(ar+br); }

function draw(){
  ctx.clearRect(0,0,W,H);
  ctx.globalAlpha=0.12; ctx.fillStyle='#64748b'; for(let x=0;x<W;x+=40) ctx.fillRect(x,0,1,H); for(let y=0;y<H;y+=40) ctx.fillRect(0,y,W,1); ctx.globalAlpha=1;
  const p=run.player; ctx.beginPath(); ctx.fillStyle='#9ece6a'; ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
  run.enemies.forEach(e=>{ ctx.beginPath(); ctx.fillStyle=e.kind==='brute'?'#d97706':'#7aa2f7'; ctx.arc(e.x,e.y,e.r,0,Math.PI*2); ctx.fill(); });
}

// ----- Return to Hub (robust)
// 1) The anchor navigates to /hub (real navigation).
// 2) JS also forces navigation if needed.
// 3) On /hub load, UI shows hub and URL is replaced back to /.
// 4) Capture-phase delegate ensures clicks can't be swallowed.
window.__returnHub = function(){ tryReturnHub('manual'); };

function tryReturnHub(tag){
  // try UI toggle first
  if (overEl) overEl.classList.add('hidden');
  if (gameEl) gameEl.classList.add('hidden');
  if (hubEl) hubEl.classList.remove('hidden');
  // ensure we actually navigate if UI is stuck
  setTimeout(()=>{ if (location.pathname !== '/hub') location.assign('/hub?via='+encodeURIComponent(tag)); }, 0);
}

if (returnBtn) {
  returnBtn.addEventListener('click', () => { /* don't preventDefault so native nav works */ tryReturnHub('btn'); });
}
document.addEventListener('click', (ev)=>{
  const t=ev.target; if(t && (t.id==='returnHub' || (t.closest && t.closest('#returnHub')))) { tryReturnHub('cap'); }
}, true);

startBtn && startBtn.addEventListener('click', startRun);
exitBtn && exitBtn.addEventListener('click', ()=> overEl && overEl.classList.remove('hidden'));
