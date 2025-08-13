// systems/enemies.js
// Minimal enemy system: spawn across map, only chase if close, die to laser

export function initEnemies(state, opts = {}) {
  state.enemies = {
    list: [],
    max: opts.max ?? 24,
    // world bounds (change if your world uses different vars)
    worldW: opts.worldW ?? 2000,
    worldH: opts.worldH ?? 2000,
    // movement
    speed: opts.speed ?? 70,
    detectRadius: opts.detectRadius ?? 400,
    // visuals
    size: opts.size ?? 10,
    // combat
    baseHP: opts.baseHP ?? 100,
    laserDPS: opts.laserDPS ?? 180,
    flashTime: opts.flashTime ?? 0.1
  };
}

export function spawnEnemies(state, count = 8) {
  const cfg = state.enemies;
  const out = cfg.list;

  for (let i = 0; i < count && out.length < cfg.max; i++) {
    out.push({
      x: rand(0, cfg.worldW),
      y: rand(0, cfg.worldH),
      r: cfg.size,
      hp: cfg.baseHP,
      flash: 0
    });
  }
}

export function updateEnemies(state, dt) {
  const cfg = state.enemies;
  const list = cfg.list;
  const px = state.camera.x, py = state.camera.y;

  // Damage settings
  const contactDPS = cfg.contactDPS ?? 50; // damage per second on touch
  const playerR = state.player?.r ?? 18;   // derelict/player radius

  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i];

    // Distance to player
    let dx = px - m.x, dy = py - m.y;
    const dist = Math.hypot(dx, dy) || 1;

    // Only move if within detect radius
    if (dist <= cfg.detectRadius) {
      dx /= dist; dy /= dist;
      m.x += dx * cfg.speed * dt;
      m.y += dy * cfg.speed * dt;
    }

    // Contact damage
    if (dist <= m.r + playerR) {
      state.player.hp -= contactDPS * dt;
      // optional: flash player or knock enemy back
    }

    // Laser damage
    applyLaserDamage(state, m, dt);

    // Hit flash decay
    m.flash = Math.max(0, m.flash - dt);

    // Death cleanup
    if (m.hp <= 0) list.splice(i, 1);
  }
}


export function drawEnemies(ctx, state, cx, cy) {
  const cfg = state.enemies;
  const px = state.camera.x, py = state.camera.y;

  for (const m of cfg.list) {
    const sx = m.x - px + cx;
    const sy = m.y - py + cy;

    ctx.beginPath();
    ctx.arc(sx, sy, m.r, 0, Math.PI * 2);
    ctx.fillStyle = m.flash > 0
      ? `rgba(255,255,255,${m.flash / cfg.flashTime})`
      : 'rgba(200,50,50,0.9)';
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

// -------- internals --------

function applyLaserDamage(state, m, dt) {
  const b = state.beam;
  if (!b) return;

  // Laser active if mode is 'laser' OR t >= tConeEnd
  const t = b.t ?? 0;
  const tConeEnd = b.tConeEnd ?? 0.88;
  const isLaser = b.mode === 'laser' || t >= tConeEnd;
  if (!isLaser) return;

  // Beam origin/tip
  const ox = state.camera.x, oy = state.camera.y;
  const tx = ox + Math.cos(b.angle) * b.range;
  const ty = oy + Math.sin(b.angle) * b.range;

  const thickness = 20; // fixed thickness for now
  const d2 = distPointToSegmentSq(m.x, m.y, ox, oy, tx, ty);

  if (d2 <= (thickness * 0.5) ** 2) {
    m.hp -= state.enemies.laserDPS * dt;
    m.flash = state.enemies.flashTime;
  }
}

function distPointToSegmentSq(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1, vy = y2 - y1;
  const wx = px - x1, wy = py - y1;
  const len2 = vx * vx + vy * vy || 1;
  let t = (wx * vx + wy * vy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + vx * t, cy = y1 + vy * t;
  const dx = px - cx, dy = py - cy;
  return dx * dx + dy * dy;
}

function rand(min, max) { return Math.random() * (max - min) + min; }
