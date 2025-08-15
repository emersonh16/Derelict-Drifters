// core/game.js
import { config } from "../core/config.js";
import { initBeam, drawBeam, onWheelAdjust, getBeamGeom } from "../systems/beam.js";
import {
  initMiasma, updateMiasma, drawMiasma, clearWithBeam,
  worldToIdx, isFog
} from "../systems/miasma.js";
import { initEnemies, spawnInitialEnemies, updateEnemies, drawEnemies } from "../systems/enemies.js";
import { initHUD, updateHUD } from "../ui/hud.js";
import { updatePickups, drawPickups } from "../systems/pickups.js";
import { initWorld, clampToWorld, drawWorldBorder, drawObstacles, collideWithObstacles } from "../systems/world.js";


const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha: false });

const state = {
  time: 0, dt: 0,
  mouse: { x: 0, y: 0 },        // aim used for drawing/beam logic
  pendingMouse: { x: 0, y: 0 }, // tracks mouse while paused
  camera: { x: 0, y: 0 },
  player: { r: 18 },
  keys: new Set(),
  health: 100,
  maxHealth: 100,
  gameOver: false,
  scrap: 0,
  pickups: [], // {x, y, type, r}
  damageFlash: 0,
  paused: false,
  win: false,
  maxScrap: config.game.winScrap,
  laserEnergy: config.game.maxLaserEnergy,   // starts full
  maxLaserEnergy: config.game.maxLaserEnergy
};

// ---- Resize ----
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  state.mouse.x = canvas.width / 2;
  state.mouse.y = canvas.height / 2;
  state.pendingMouse.x = state.mouse.x;
  state.pendingMouse.y = state.mouse.y;
}
window.addEventListener("resize", resize);
resize();

// ---- Input ----
canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  if (state.paused) {
    state.pendingMouse.x = x;
    state.pendingMouse.y = y;
  } else {
    state.mouse.x = x;
    state.mouse.y = y;
  }
});

canvas.addEventListener("wheel", (e) => {
  if (state.paused || state.gameOver) return;
  onWheelAdjust(state, e.deltaY);
  e.preventDefault();
}, { passive: false });

// Restart (R)
window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "r" && state.gameOver) {
    startGame();
  }
});


function togglePause() {
  state.paused = !state.paused;
  if (!state.paused) {
    state.mouse.x = state.pendingMouse.x;
    state.mouse.y = state.pendingMouse.y;
  }
}

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    if (!state.gameOver) togglePause();
    return;
  }
  state.keys.add(e.key.toLowerCase());
});

window.addEventListener("keyup", (e) => {
  state.keys.delete(e.key.toLowerCase());
});

function startGame() {
  // base state
  state.time = 0;
  state.dt = 0;
  state.keys.clear();
  state.paused = false;
  state.gameOver = false;
  state.win = false;
  state.damageFlash = 0;

  // player / run
  state.health = state.maxHealth;
  state.scrap = 0;
  state.pickups.length = 0;
  state.camera.x = 0;
  state.camera.y = 0;

  // keep mouse centered (like a page refresh)
  state.mouse.x = canvas.width / 2;
  state.mouse.y = canvas.height / 2;
  state.pendingMouse.x = state.mouse.x;
  state.pendingMouse.y = state.mouse.y;

  // world + systems (same order as first load)
  initMiasma(state, config.miasma);                 // brand-new fog grid
  initWorld(state, config.world);                   // world depends on miasma size
  initBeam(state, config.beam);
  initEnemies(state, config.enemies);
  spawnInitialEnemies(state, config.enemies.max);
  initHUD(state, config.hud);
}


// ---- Init ----
startGame();


// ---- Update ----
function update(dt) {
  state.time += dt;

  // movement
  let vx = 0, vy = 0;
  if (state.keys.has('w')) vy -= 1;
  if (state.keys.has('s')) vy += 1;
  if (state.keys.has('a')) vx -= 1;
  if (state.keys.has('d')) vx += 1;

  if (vx || vy) {
    const len = Math.hypot(vx, vy) || 1;
    vx /= len; 
    vy /= len;
    const speed = 240;
    state.camera.x += vx * speed * dt;
    state.camera.y += vy * speed * dt;

    // Prevent player from passing through obstacles
    collideWithObstacles(state, state.camera, state.player.r);
  }

  clampToWorld(state);

  updateMiasma(state, dt);
  updateEnemies(state, dt);
  updatePickups(state, dt);


  // Win condition
  if (!state.gameOver && state.scrap >= state.maxScrap) {
    state.win = true;
    state.gameOver = true;
  }

  // Miasma damage
  const step = state.miasma.tile * 0.5;
  let inFog = false;
  for (let dy = -state.player.r; dy <= state.player.r && !inFog; dy += step) {
    for (let dx = -state.player.r; dx <= state.player.r; dx += step) {
      if (dx*dx + dy*dy > state.player.r * state.player.r) continue;
      const idx = worldToIdx(state.miasma, state.camera.x + dx, state.camera.y + dy);
      if (isFog(state.miasma, idx)) { inFog = true; break; }
    }
  }
  if (inFog) {
  state.health -= state.miasma.dps * dt;
  state.damageFlash = 0.2; // trigger red flash
  if (state.health < 0) state.health = 0;
}


  state.damageFlash = Math.max(0, state.damageFlash - dt);

  if (state.health <= 0 && !state.gameOver) {
    state.health = 0;
    state.gameOver = true;
  }

  // --- Laser energy drain/recharge ---
  const beam = state.beam;
  if (beam.mode === "laser") {
    state.laserEnergy -= config.game.laserDrainRate * dt;
    if (state.laserEnergy <= 0) {
      state.laserEnergy = 0;
      // auto shut off laser if empty
      beam.t = beam.tConeEnd - 0.01; // forces it back to cone mode
      getBeamGeom(state, canvas.width / 2, canvas.height / 2);
    }
  } else {
    state.laserEnergy = Math.min(
      state.maxLaserEnergy,
      state.laserEnergy + config.game.laserRechargeRate * dt
    );
  }


  updateHUD(state);
}

// ---- Draw ----
function draw() {
  const w = canvas.width, h = canvas.height;
  const cx = w / 2, cy = h / 2;

  ctx.fillStyle = "#0c0b10";
  ctx.fillRect(0, 0, w, h);

  getBeamGeom(state, cx, cy);

  if (!state.paused && !state.gameOver) {
    clearWithBeam(state, cx, cy);
  }

drawObstacles(ctx, state, cx, cy); // draw terrain first
drawEnemies(ctx, state, cx, cy);
drawPickups(ctx, state, cx, cy);
drawMiasma(ctx, state, cx, cy, w, h);
drawWorldBorder(ctx, state, cx, cy);
drawBeam(ctx, state, cx, cy);

  ctx.fillStyle = "#9a3b31";
  ctx.beginPath();
  ctx.arc(cx, cy, state.player.r, 0, Math.PI * 2);
  ctx.fill();

  if (state.damageFlash > 0) {
    ctx.fillStyle = `rgba(255,0,0,${state.damageFlash * 0.5})`;
    ctx.fillRect(0, 0, w, h);
  }

  // paused overlay
  if (state.paused && !state.gameOver) {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "white";
    ctx.font = "bold 32px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("PAUSED — press Space", w / 2, 64);
  }

  // game over overlay
  if (state.gameOver) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "white";
    ctx.font = "bold 64px sans-serif";
    ctx.textAlign = "center";
    const title = state.win ? "YOU WIN" : "GAME OVER";
    ctx.fillText(title, w / 2, h / 2);

    if (!state.win) {
      ctx.font = "24px sans-serif";
      ctx.fillText("Press R to Restart", w / 2, h / 2 + 50);
    }
  }
}

// ---- Main Loop ----
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  state.dt = dt;

  if (!state.gameOver && !state.paused) {
    update(dt);
  }
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
