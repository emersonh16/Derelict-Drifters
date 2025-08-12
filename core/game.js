const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });

const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
function resize() {
  const w = Math.floor(window.innerWidth);
  const h = Math.floor(window.innerHeight);
  canvas.width = Math.floor(w * DPR);
  canvas.height = Math.floor(h * DPR);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
addEventListener('resize', resize);
resize();

// --- State ---
const state = {
  time: 0, dt: 0,
  keys: new Set(),
  mouse: { x: 0, y: 0, worldX: 0, worldY: 0 },
  camera: { x: 0, y: 0 },
  speed: 200,
  beamOn: false,
  obstacles: []
};

// Seed some rectangles in world space
function seedObstacles(n = 120) {
  const rng = (seed => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2**32)(12345);
  for (let i = 0; i < n; i++) {
    const size = 40 + Math.floor(rng() * 100);
    const x = Math.floor((rng() - 0.5) * 4000);
    const y = Math.floor((rng() - 0.5) * 4000);
    state.obstacles.push({ x, y, w: size, h: size * (0.6 + rng()*0.8) });
  }
}
seedObstacles();

// Input
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.key === 'q' || e.key === 'Q') state.beamOn = !state.beamOn;
  state.keys.add(e.key.toLowerCase());
});
addEventListener('keyup', (e) => state.keys.delete(e.key.toLowerCase()));
addEventListener('mousemove', (e) => {
  const r = canvas.getBoundingClientRect();
  state.mouse.x = e.clientX - r.left;
  state.mouse.y = e.clientY - r.top;
});

function update(dt) {
  // Move world (drifter stays centered)
  let vx = 0, vy = 0;
  if (state.keys.has('w')) vy -= 1;
  if (state.keys.has('s')) vy += 1;
  if (state.keys.has('a')) vx -= 1;
  if (state.keys.has('d')) vx += 1;
  if (vx||vy) {
    const len = Math.hypot(vx, vy) || 1;
    vx /= len; vy /= len;
    state.camera.x += vx * state.speed * dt;
    state.camera.y += vy * state.speed * dt;
  }

  // Mouse world coords
  const cx = canvas.clientWidth * 0.5;
  const cy = canvas.clientHeight * 0.5;
  state.mouse.worldX = state.camera.x + (state.mouse.x - cx);
  state.mouse.worldY = state.camera.y + (state.mouse.y - cy);
}

function draw() {
  const w = canvas.clientWidth, h = canvas.clientHeight;

  // Ground
  ctx.fillStyle = '#1a191f';
  ctx.fillRect(0, 0, w, h);

  // Subtle grid
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  const grid = 80;
  const ox = - (state.camera.x % grid);
  const oy = - (state.camera.y % grid);
  ctx.beginPath();
  for (let x = ox; x < w; x += grid) { ctx.moveTo(x,0); ctx.lineTo(x,h); }
  for (let y = oy; y < h; y += grid) { ctx.moveTo(0,y); ctx.lineTo(w,y); }
  ctx.stroke();

  // Obstacles
  ctx.fillStyle = '#3e5b39';
  for (const o of state.obstacles) {
    const sx = Math.floor(o.x - state.camera.x + w/2);
    const sy = Math.floor(o.y - state.camera.y + h/2);
    if (sx + o.w < 0 || sy + o.h < 0 || sx > w || sy > h) continue;
    ctx.fillRect(sx, sy, o.w, o.h);
  }

  // Drifter (centered)
  const cx = w/2, cy = h/2;
  ctx.fillStyle = '#9a3b31';
  ctx.beginPath();
  ctx.arc(cx, cy, 18, 0, Math.PI*2);
  ctx.fill();

  // Beam (visual only)
  const dx = state.mouse.x - cx;
  const dy = state.mouse.y - cy;
  const ang = Math.atan2(dy, dx);
  if (state.beamOn) {
    const range = 220;
    const halfArc = Math.PI/18; // ~10°
    ctx.fillStyle = 'rgba(210, 206, 255, 0.18)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, range, ang - halfArc, ang + halfArc);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(230, 226, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(ang)*range, cy + Math.sin(ang)*range);
    ctx.stroke();
  }

  // Crosshair
  ctx.strokeStyle = 'rgba(255,255,255,.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(state.mouse.x, state.mouse.y, 8, 0, Math.PI*2);
  ctx.moveTo(state.mouse.x-12, state.mouse.y);
  ctx.lineTo(state.mouse.x+12, state.mouse.y);
  ctx.moveTo(state.mouse.x, state.mouse.y-12);
  ctx.lineTo(state.mouse.x, state.mouse.y+12);
  ctx.stroke();
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
