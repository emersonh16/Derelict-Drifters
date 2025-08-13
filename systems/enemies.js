import { spawnPickup } from "./pickups.js";

export function initEnemies(state, opts = {}) {
  const worldW = state.miasma.cols * state.miasma.tile;
  const worldH = state.miasma.rows * state.miasma.tile;

  state.enemies = {
    list: [],
    max: opts.max ?? 40, // total enemies allowed
    worldW,
    worldH,
    speed: opts.speed ?? 70,
    detectRadius: opts.detectRadius ?? 400,
    size: opts.size ?? 10,
    baseHP: opts.baseHP ?? 100,
    laserDPS: opts.laserDPS ?? 180,
    flashTime: opts.flashTime ?? 0.1,
    contactDPS: opts.contactDPS ?? 50,
    spawnTimer: 0
  };
}

// General safe spawn helper
function spawnEnemies(state, count = 1, minDistFromPlayer = 150, area = null) {
  const cfg = state.enemies;
  const out = cfg.list;
  const px = state.camera.x;
  const py = state.camera.y;

  for (let i = 0; i < count && out.length < cfg.max; i++) {
    let tries = 0;
    while (tries < 50) {
      tries++;
      let x, y;
      if (area) {
        // Inside a specific rectangle
        x = area.x + Math.random() * area.w;
        y = area.y + Math.random() * area.h;
      } else {
        // Anywhere in the world
        x = rand(0, cfg.worldW);
        y = rand(0, cfg.worldH);
      }
      const dist = Math.hypot(px - x, py - y);
      if (dist >= minDistFromPlayer) {
        out.push({
          x,
          y,
          r: cfg.size,
          hp: cfg.baseHP,
          flash: 0
        });
        break;
      }
    }
  }
}

// Call this once at game start
export function spawnInitialEnemies(state, count = 40) {
  spawnEnemies(state, count, 150); // anywhere in world
}

export function updateEnemies(state, dt) {
  const cfg = state.enemies;
  const list = cfg.list;
  const px = state.camera.x, py = state.camera.y;
  const playerR = state.player?.r ?? 18;

  // Timed respawn in the (5,5)-(455,455) square
  cfg.spawnTimer += dt;
  if (cfg.spawnTimer >= 2 && list.length < cfg.max) { // every 2s
    cfg.spawnTimer = 0;
    spawnEnemies(state, 2, 150, { x: 5, y: 5, w: 450, h: 450 });
  }

  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i];
    let dx = px - m.x, dy = py - m.y;
    const dist = Math.hypot(dx, dy) || 1;

    if (dist <= cfg.detectRadius) {
      dx /= dist; dy /= dist;
      m.x += dx * cfg.speed * dt;
      m.y += dy * cfg.speed * dt;
    }

    if (dist <= m.r + playerR) {
      state.health -= cfg.contactDPS * dt;
    }

    applyLaserDamage(state, m, dt);
    m.flash = Math.max(0, m.flash - dt);

    if (m.hp <= 0) {
      spawnPickup(state, m.x, m.y, "scrap");
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

function rand(min, max) {
  return Math.random() * (max - min) + min;
}
