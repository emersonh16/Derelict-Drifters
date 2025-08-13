import { initBeam, drawBeam, onWheelAdjust, getBeamGeom } from "../systems/beam.js";
import {
  initMiasma, updateMiasma, drawMiasma, clearWithBeam,
  worldToIdx, isFog
} from "../systems/miasma.js";
import { initEnemies, spawnEnemies, updateEnemies, drawEnemies } from "../systems/enemies.js";
import { initHUD, updateHUD } from "../ui/hud.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha: false });

// miasma damage per second (TOP-LEVEL, not inside state)
const MIASMA_DPS = 35;

const state = {
  time: 0, dt: 0,
  mouse: { x: 0, y: 0 },
  camera: { x: 0, y: 0 },
  player: { r: 18 },
  keys: new Set(),
  health: 100,
  maxHealth: 100,
};

// ---- Resize ----
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  state.mouse.x = canvas.width / 2;
  state.mouse.y = canvas.height / 2;
}
window.addEventListener("resize", resize);
resize();

// ---- Input ----
window.addEventListener("keydown", (e) => state.keys.add(e.key.toLowerCase()));
window.addEventListener("keyup",   (e) => state.keys.delete(e.key.toLowerCase()));

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  state.mouse.x = e.clientX - rect.left;
  state.mouse.y = e.clientY - rect.top;
});
canvas.addEventListener("wheel", (e) => {
  onWheelAdjust(state, e.deltaY);
  e.preventDefault();
}, { passive: false });

// ---- Init ----
initBeam(state, { 
  startT: 0.7,
  bubbleRMin: 16, bubbleRMax: 90,
  baseRange: 150, laserRange: 240, bumpRange: 20
});

initMiasma(state, { tile: 7, cols: 400, rows: 400 });

// NEW: enemies
initEnemies(state, {
  max: 24,
  spawnRadius: 520,
  minSpawnDist: 280,
  baseHP: 120,
  laserDPS: 180
});
spawnEnemies(state, 12);

// HUD (one time)
initHUD(state);

// ---- Update ----
function update(dt) {
  state.time += dt;

  let vx = 0, vy = 0;
  if (state.keys.has('w')) vy -= 1;
  if (state.keys.has('s')) vy += 1;
  if (state.keys.has('a')) vx -= 1;
  if (state.keys.has('d')) vx += 1;

  if (vx || vy) {
    const len = Math.hypot(vx, vy) || 1;
    vx /= len; vy /= len;
    const speed = 240;
    state.camera.x += vx * speed * dt;
    state.camera.y += vy * speed * dt;
  }

  updateMiasma(state, dt);
  updateEnemies(state, dt);

  // Miasma damage
  const idx = worldToIdx(state.miasma, state.camera.x, state.camera.y);
  if (isFog(state.miasma, idx)) {
    state.health -= MIASMA_DPS * dt;
    if (state.health < 0) state.health = 0;
  }

  // HUD last
  updateHUD(state);
}

// ---- Draw ----
function draw() {
  const w = canvas.width, h = canvas.height;
  const cx = w / 2, cy = h / 2;

  ctx.fillStyle = "#0c0b10";
  ctx.fillRect(0, 0, w, h);

  getBeamGeom(state, cx, cy);
  clearWithBeam(state, cx, cy);

  // enemies first (under fog)
  drawEnemies(ctx, state, cx, cy);

  // then fog over them
  drawMiasma(ctx, state, cx, cy, w, h);

  // beam on top
  drawBeam(ctx, state, cx, cy);

  // player
  ctx.fillStyle = "#9a3b31";
  ctx.beginPath();
  ctx.arc(cx, cy, state.player.r, 0, Math.PI * 2);
  ctx.fill();
}

// ---- Main Loop ----
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  state.dt = dt;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
