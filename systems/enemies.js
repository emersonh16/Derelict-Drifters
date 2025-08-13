// systems/enemies.js
// Spawn simple seekers that the laser can slice through.

export function initEnemies(state, opts = {}) {
  state.enemies = {
    list: [],

    // compat with your current init call
    max:           opts.max ?? opts.maxCount ?? 24,
    spawnRadius:   opts.spawnRadius ?? 520,
    minSpawnDist:  opts.minSpawnDist ?? 280,

    // movement
    speedMin: opts.speedMin ?? opts.speed ?? 60,
    speedMax: opts.speedMax ?? (opts.speed ? opts.speed : 80),

    // rendering
    size: opts.size ?? 10,

    // combat
    baseHP:       opts.baseHP ?? 120,
    laserDPS:     opts.laserDPS ?? 180,     // damage per second inside laser thickness
    hitFlashTime: opts.hitFlashTime ?? 0.12 // seconds
  };
}

export function spawnEnemies(state, count = 8) {
  const cfg = state.enemies; if (!cfg) return;
  const out = cfg.list;
  const cx = state.camera.x, cy = state.camera.y;

  for (let i = 0; i < count && out.length < cfg.max; i++) {
    const r = rand(cfg.minSpawnDist, cfg.spawnRadius);
    const a = rand(0, Math.PI * 2);
    out.push({
      x: cx + Math.cos(a) * r,
      y: cy + Math.sin(a) * r,
      r: cfg.size,
      hp: cfg.baseHP,
      flash: 0
    });
  }
}

export function updateEnemies(state, dt) {
  const cfg = state.enemies; if (!cfg) return;
  const list = cfg.list;
  const px = state.camera.x, py = state.camera.y;

  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i];

    // seek player
    let dx = px - m.x, dy = py - m.y;
    const d = Math.hypot(dx, dy) || 1;
    dx /= d; dy /= d;
    const spd = lerp(cfg.speedMin, cfg.speedMax, 0.5);
    m.x += dx * spd * dt;
    m.y += dy * spd * dt;

    // laser damage (matches your laser visual thickness)
    applyLaserDamage(state, m, dt);

    // hit flash decay
    m.flash = Math.max(0, m.flash - dt);

    // death cleanup
    if (m.hp <= 0) list.splice(i, 1);
  }
}

export function drawEnemies(ctx, state, cx, cy) {
  const cfg = state.enemies; if (!cfg) return;
  const px = state.camera.x, py = state.camera.y;

  for (const m of cfg.list) {
    const sx = m.x - px + cx;
    const sy = m.y - py + cy;

    // body fill
    ctx.save();
    ctx.beginPath();
    ctx.arc(sx, sy, m.r, 0, Math.PI * 2);
    if (m.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${clamp01(m.flash / cfg.hitFlashTime)})`;
    } else {
      ctx.fillStyle = 'rgba(60,200,180,0.9)';
    }
    ctx.fill();

    // subtle outline to read under fog
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.stroke();
    ctx.restore();
  }
}

// ---------------- internals ----------------

function applyLaserDamage(state, m, dt) {
  const b = state.beam; if (!b || b.mode !== 'laser') return;

  // Beam segment from player origin to tip
  const ox = state.camera.x, oy = state.camera.y;
  const tx = ox + Math.cos(b.angle) * b.range;
  const ty = oy + Math.sin(b.angle) * b.range;

  // Visual-matching thickness: core + halo, with a minimum in tile units
  const core = b.laserCoreWidth ?? 8;
  const halo = core * (b.laserOutlineMult ?? 2.0);
  const tile = state.miasma?.tile ?? 12;
  const thickness = Math.max(tile * 2.0, core + halo);

  // Distance from enemy center to beam segment
  const d2 = distPointToSegmentSq(m.x, m.y, ox, oy, tx, ty);
  if (d2 <= (thickness * 0.5) ** 2) {
    m.hp -= (state.enemies.laserDPS ?? 180) * dt;
    m.flash = state.enemies.hitFlashTime ?? 0.12;
  }
}

function distPointToSegmentSq(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1, vy = y2 - y1;
  const wx = px - x1, wy = py - y1;
  const len2 = vx*vx + vy*vy || 1;
  let t = (wx*vx + wy*vy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + vx * t, cy = y1 + vy * t;
  const dx = px - cx, dy = py - cy;
  return dx*dx + dy*dy;
}

function rand(min, max) { return Math.random() * (max - min) + min; }
function lerp(a,b,t){ return a + (b-a)*t; }
function clamp01(x){ return Math.max(0, Math.min(1, x)); }
