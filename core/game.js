import { initWorld, drawWorld } from "../systems/world.js";
import { initBeam, drawBeam, onWheelAdjust } from "../systems/beam.js";
import { initMiasma, updateMiasma, drawMiasma, clearWithBeam } from "../systems/miasma.js";

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
addEventListener('resize', resize);
resize();

// ---- State ----
const state = {
  time: 0, dt: 0,
  keys: new Set(),
  mouse: { x: canvas.width * 0.8, y: canvas.height * 0.5 },
  camera: { x: 0, y: 0 },
  speed: 240,
  player: { r: 18 }
};

// ---- Input ----
addEventListener('keydown', (e) => state.keys.add(e.key.toLowerCase()));
addEventListener('keyup',   (e) => state.keys.delete(e.key.toLowerCase()));
addEventListener('mousemove', (e) => {
  const r = canvas.getBoundingClientRect();
  state.mouse.x = e.clientX - r.left;
  state.mouse.y = e.clientY - r.top;
});
addEventListener('wheel', (e) => {
  onWheelAdjust(state, e.deltaY); // scroll morphs beam (no-beam ↔ bubble ↔ cone ↔ laser)
  e.preventDefault();
}, { passive: false });

// ---- Systems init ----
initWorld(state, { grid: 80, rocks: 60, span: 4000, seed: 12345 });
initBeam(state, {
  // these should match what we used earlier in systems/beam.js
  startT: 0.7, wheelStep: 0.05,
  tNoBeamEnd: 0.08, tBubbleEnd: 0.42, tConeEnd: 0.88,
  bubbleRMin: 32, bubbleRMax: 180,
  coneHalfArcWideDeg: 60, coneHalfArcNarrowDeg: 1.6,
  baseRange: 300, laserRange: 480
});
initMiasma(state, {
  tile: 14, cols: 220, rows: 220,
  regrowDelay: 1.2, tickHz: 8, baseChance: 0.14
});

// ---- Update & Draw ----
function update(dt) {
  // camera move (player locked center)
  let vx = 0, vy = 0;
  if (state.keys.has('w')) vy -= 1;
  if (state.keys.has('s')) vy += 1;
  if (state.keys.has('a')) vx -= 1;
  if (state.keys.has('d')) vx += 1;
  if (vx || vy) {
    const len = Math.hypot(vx, vy) || 1;
    vx /= len; vy /= len;
    state.camera.x += vx * state.speed * dt;
    state.camera.y += vy * state.speed * dt;
  }

  // miasma regrowth ticks
  updateMiasma(state, dt);
}

function draw() {
  const w = canvas.width, h = canvas.height;
  const cx = w / 2, cy = h / 2;

  // background & motion cues
  drawWorld(ctx, state, cx, cy, w, h);

  // clear miasma using current beam shape (instant effect)
  clearWithBeam(state, cx, cy);

  // draw remaining miasma tiles (overlay)
  drawMiasma(ctx, state, cx, cy, w, h);

  // render beam (visual on top)
  drawBeam(ctx, state, cx, cy);

  // player (centered)
  ctx.fillStyle = '#9a3b31';
  ctx.beginPath();
  ctx.arc(cx, cy, state.player.r, 0, Math.PI * 2);
  ctx.fill();
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  state.time += dt;
  state.dt = dt;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
