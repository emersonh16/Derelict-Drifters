import { initWorld, drawWorld } from "../systems/world.js";
import { initBeam, drawBeam } from "../systems/beam.js";

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
addEventListener('resize', resize);
resize();

const state = {
  time: 0, dt: 0,
  keys: new Set(),
  mouse: { x: canvas.width * 0.8, y: canvas.height * 0.5 },
  camera: { x: 0, y: 0 },
  speed: 240,
  player: { r: 18 }
};

// Input
addEventListener('keydown', (e) => state.keys.add(e.key.toLowerCase()));
addEventListener('keyup',   (e) => state.keys.delete(e.key.toLowerCase()));
addEventListener('mousemove', (e) => {
  const r = canvas.getBoundingClientRect();
  state.mouse.x = e.clientX - r.left;
  state.mouse.y = e.clientY - r.top;
});

// Systems
initWorld(state, { grid: 80, rocks: 60, span: 4000, seed: 12345 });
initBeam(state, { range: 300, halfArcDeg: 16 });

function update(dt) {
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
}

function draw() {
  const w = canvas.width, h = canvas.height;
  const cx = w / 2, cy = h / 2;

  drawWorld(ctx, state, cx, cy, w, h); // motion cues
  drawBeam(ctx, state, cx, cy);        // golden beam

  // Player (center)
  ctx.fillStyle = '#9a3b31';
  ctx.beginPath(); ctx.arc(cx, cy, state.player.r, 0, Math.PI*2); ctx.fill();
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now; state.time += dt; state.dt = dt;
  update(dt); draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
