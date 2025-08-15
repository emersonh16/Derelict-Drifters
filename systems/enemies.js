// systems/enemies.js
import { spawnPickup } from "./pickups.js";
import { collideWithObstacles } from "./world.js";

export function initEnemies(state, opts = {}) {
  const cols = state.miasma.cols ?? (state.miasma.halfCols * 2);
  const rows = state.miasma.rows ?? (state.miasma.halfRows * 2);

  state.enemies = {
    list: [],
    max: opts.max ?? 40,
    worldW: cols * state.miasma.tile,
    worldH: rows * state.miasma.tile,

    speed: opts.speed ?? 70,
    detectRadius: opts.detectRadius ?? 400,
    size: opts.size ?? 10,
    baseHP: opts.baseHP ?? 100,
    laserDPS: opts.laserDPS ?? 180,
    flashTime: opts.flashTime ?? 0.1,
    contactDPS: opts.contactDPS ?? 50,

    spawnEvery: opts.spawnEvery ?? 2.5,
    safeDistInitial: opts.safeDistInitial ?? 250,
    safeDistTrickle: opts.safeDistTrickle ?? 200,

    spawnTimer: 0
  };
}

function spawnEnemies(state, count = 1, minDistFromPlayer = 150) {
  const cfg = state.enemies;
  const out = cfg.list;
  const s = state.miasma;
  const t = s.tile;

  const px = state.camera.x;
  const py = state.camera.y;

  const minGX = -s.halfCols, maxGX = s.halfCols - 1;
  const minGY = -s.halfRows, maxGY = s.halfRows - 1;

  for (let i = 0; i < count && out.length < cfg.max; i++) {
    let placed = false;
    for (let tries = 0; tries < 60 && !placed; tries++) {
      const gx = randInt(minGX, maxGX);
      const gy = randInt(minGY, maxGY);

      const x = gx * t + t * 0.5;
      const y = gy * t + t * 0.5;

      if (Math.hypot(px - x, py - y) < minDistFromPlayer) continue;

      out.push({ x, y, r: cfg.size, hp: cfg.baseHP, flash: 0 });
      placed = true;
    }
  }
}

export function spawnInitialEnemies(state, count = 40) {
  spawnEnemies(state, count, state.enemies.safeDistInitial);
}

export function updateEnemies(state, dt) {
  const cfg = state.enemies;
  const list = cfg.list;
  const px = state.camera.x, py = state.camera.y;
  const playerR = state.player?.r ?? 18;

  // trickle spawns
  cfg.spawnTimer += dt;
  if (list.length < cfg.max && cfg.spawnTimer >= cfg.spawnEvery) {
    cfg.spawnTimer = 0;
    spawnEnemies(state, 1, cfg.safeDistTrickle);
  }

  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i];
    let dx = px - m.x, dy = py - m.y;
    const dist = Math.hypot(dx, dy) || 1;

    // chase
    if (dist <= cfg.detectRadius) {
      dx /= dist; dy /= dist;
      m.x += dx * cfg.speed * dt;
      m.y += dy * cfg.speed * dt;

      // Prevent enemy from passing through obstacles
      collideWithObstacles(state, m, m.r);
    }

    // contact damage
    if (dist <= m.r + playerR) {
      state.health -= cfg.contactDPS * dt;
      state.damageFlash = 0.2;
    }

    // laser damage
    applyLaserDamage(state, m, dt);
    m.flash = Math.max(0, m.flash - dt);

    // death + drop
    if (m.hp <= 0) {
      if (Math.random() < 0.1) {
        spawnPickup(state, m.x, m.y, "health");
      } else {
        spawnPickup(state, m.x, m.y, "scrap");
      }
      list.splice(i, 1);
    }
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

// ---- internals ----
function applyLaserDamage(state, m, dt) {
  const b = state.beam;
  if (!b) return;
  const t = b.t ?? 0;
  const tConeEnd = b.tConeEnd ?? 0.88;
  const isLaser = b.mode === 'laser' || t >= tConeEnd;
  if (!isLaser) return;

  const ox = state.camera.x, oy = state.camera.y;
  const tx = ox + Math.cos(b.angle) * b.range;
  const ty = oy + Math.sin(b.angle) * b.range;

  const thickness = 20;
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

function randInt(min, max) {
  return (min + Math.floor(Math.random() * (max - min + 1)));
}
