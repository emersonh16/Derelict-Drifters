// systems/enemies.js
import { spawnPickup } from "./pickups.js";
import { collideWithObstacles, pointInTriangle } from "./world.js";
import { getDrillTriangleWorld } from "./drill.js";
import { isoProject } from "../core/iso.js";
/** @typedef {import('../core/state.js').GameState} GameState */

export function initEnemies(miasma, opts = {}) {
  const cols = miasma.cols ?? (miasma.halfCols * 2);
  const rows = miasma.rows ?? (miasma.halfRows * 2);

  return {
    list: [],
    max: opts.max ?? 40,
    worldW: cols * miasma.tile,
    worldH: rows * miasma.tile,

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

    tankBulletSpeed: opts.tankBulletSpeed ?? 160,
    tankBulletCooldown: opts.tankBulletCooldown ?? 2.5,
    tankBulletDamage: opts.tankBulletDamage ?? 20,
    tankBulletWidth: opts.tankBulletWidth ?? 18, // larger
    tankBulletHeight: opts.tankBulletHeight ?? 6, // thicker

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

      // Skip too close to player
      if (Math.hypot(px - x, py - y) < minDistFromPlayer) continue;

      // Convert grid coords to obstacleGrid index
      const col = gx + s.halfCols;
      const row = gy + s.halfRows;
      const idx = row * s.cols + col;

      // Skip if out of bounds or inside a rock
      if (col < 0 || col >= s.cols || row < 0 || row >= s.rows) continue;
      if (state.obstacleGrid && state.obstacleGrid[idx] === 1) continue;

      // Type & stats
      let roll = Math.random();
      let type = "normal";
      if (roll < 0.2) type = "fast";
      else if (roll < 0.4) type = "tank";

      let hp = cfg.baseHP;
      let radius = cfg.size;
      let cooldown = 0;
      if (type === "fast") {
        hp = cfg.baseHP * 0.5;
      } else if (type === "tank") {
        hp = cfg.baseHP * 2.5;
        radius = state.player.r;
        cooldown = 0;
      }

      out.push({
        x, y,
        r: radius,
        hp,
        flash: 0,
        type,
        shootCooldown: cooldown
      });
      placed = true;
    }
  }
}

/** @param {GameState} state */
export function spawnInitialEnemies(state, count = 40) {
  spawnEnemies(state, count, state.enemies.safeDistInitial);
}

/** @param {GameState} state */
export function updateEnemies(state, dt) {
  const cfg = state.enemies;
  const list = cfg.list;
  const px = state.camera.x, py = state.camera.y;
  const playerR = state.player?.r ?? 18;

  // Compute the drill triangle once per frame (only if drill is selected)
  const tri = (state.activeWeapon === "drill" && state.drill)
    ? getDrillTriangleWorld(state.drill, state.camera, state.mouse)
    : null;

  cfg.spawnTimer += dt;
  if (list.length < cfg.max && cfg.spawnTimer >= cfg.spawnEvery) {
    cfg.spawnTimer = 0;
    spawnEnemies(state, 1, cfg.safeDistTrickle);
  }

  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i];
    let dx = px - m.x, dy = py - m.y;
    const dist = Math.hypot(dx, dy) || 1;

    if (dist <= cfg.detectRadius) {
      dx /= dist;
      dy /= dist;

      if (m.type === "fast") {
        m.x -= dx * cfg.speed * 1.5 * dt;
        m.y -= dy * cfg.speed * 1.5 * dt;
      } else if (m.type === "tank") {
        m.x += dx * (cfg.speed * 0.5) * dt;
        m.y += dy * (cfg.speed * 0.5) * dt;

        m.shootCooldown -= dt;
        if (m.shootCooldown <= 0) {
          spawnTankBullet(state, m.x, m.y, dx, dy);
          m.shootCooldown = cfg.tankBulletCooldown;
        }
      } else {
        m.x += dx * cfg.speed * dt;
        m.y += dy * cfg.speed * dt;
      }

      collideWithObstacles(state.miasma, state.obstacleGrid, m, m.r);
      m.x = Math.max(state.world.minX + m.r, Math.min(state.world.maxX - m.r, m.x));
      m.y = Math.max(state.world.minY + m.r, Math.min(state.world.maxY - m.r, m.y));
    }

    // Contact damage (tanks/normal)
    if (m.type !== "fast" && dist <= m.r + playerR) {
      state.health -= cfg.contactDPS * dt;
      state.damageFlash = 0.2;
    }

    // Drill damage if enemy overlaps the drill triangle
    if (tri && !state.drillOverheated) {
      // quick AABB reject
      if (
        m.x >= tri.aabb.minX && m.x <= tri.aabb.maxX &&
        m.y >= tri.aabb.minY && m.y <= tri.aabb.maxY
      ) {
        if (pointInTriangle(m.x, m.y, tri.a, tri.b, tri.c)) {
          const dps = state.drill.dps ?? 180;
          m.hp -= dps * dt;
          m.flash = cfg.flashTime;
          if (m.hp < 0) m.hp = 0;
          state.drillDidHit = true;
        }
      }
    }

    // Laser damage (existing)
    applyLaserDamage(state, m, dt);

    // Flash decay
    m.flash = Math.max(0, m.flash - dt);

    // Death & drops
    if (m.hp <= 0) {
      if (m.type === "fast") {
        for (let k = 0; k < 5; k++) {
          spawnPickup(state.pickups, m.x + Math.random() * 10 - 5, m.y + Math.random() * 10 - 5, "scrap");
        }
      } else if (m.type === "tank") {
        for (let k = 0; k < 5; k++) {
          spawnPickup(state.pickups, m.x + Math.random() * 10 - 5, m.y + Math.random() * 10 - 5, "scrap");
        }
      } else {
        if (Math.random() < 0.1) {
          spawnPickup(state.pickups, m.x, m.y, "health");
        } else {
          spawnPickup(state.pickups, m.x, m.y, "scrap");
        }
      }
      list.splice(i, 1);
    }
  }

  updateEnemyProjectiles(state, dt);
}

/** @param {GameState} state */
export function drawEnemies(ctx, state) {
  const cfg = state.enemies;
  const cam = state.camera;

  for (const m of cfg.list) {
    const proj = isoProject(m.x, m.y, cam);
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, m.r, 0, Math.PI * 2);

    if (m.type === "fast") {
      ctx.fillStyle = m.flash > 0 ? `rgba(255,255,255,${m.flash / cfg.flashTime})` : 'rgba(50,50,200,0.9)';
    } else if (m.type === "tank") {
      ctx.fillStyle = m.flash > 0 ? `rgba(255,255,255,${m.flash / cfg.flashTime})` : 'rgba(255,165,0,0.9)';
    } else {
      ctx.fillStyle = m.flash > 0 ? `rgba(255,255,255,${m.flash / cfg.flashTime})` : 'rgba(200,50,50,0.9)';
    }

    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  drawEnemyProjectiles(ctx, state);
}

function spawnTankBullet(state, x, y, dx, dy) {
  const cfg = state.enemies;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;

  state.enemyProjectiles.push({
    x,
    y,
    dx,
    dy,
    w: cfg.tankBulletWidth,
    h: cfg.tankBulletHeight,
    speed: cfg.tankBulletSpeed
  });
}

function updateEnemyProjectiles(state, dt) {
  const cfg = state.enemies;
  const px = state.camera.x;
  const py = state.camera.y;
  const pr = state.player.r;

  for (let i = state.enemyProjectiles.length - 1; i >= 0; i--) {
    const p = state.enemyProjectiles[i];
    p.x += p.dx * p.speed * dt;
    p.y += p.dy * p.speed * dt;

    const dist = Math.hypot(p.x - px, p.y - py);
    if (dist < pr) {
      state.health -= cfg.tankBulletDamage;
      state.damageFlash = 0.2;
      state.enemyProjectiles.splice(i, 1);
      continue;
    }

    if (
      p.x < state.world.minX || p.x > state.world.maxX ||
      p.y < state.world.minY || p.y > state.world.maxY
    ) {
      state.enemyProjectiles.splice(i, 1);
    }
  }
}

function drawEnemyProjectiles(ctx, state) {
  const cam = state.camera;

  for (const p of state.enemyProjectiles) {
    const proj = isoProject(p.x, p.y, cam);
    ctx.save();
    ctx.translate(proj.x, proj.y);
    ctx.rotate(Math.atan2(p.dy, p.dx));

    ctx.fillStyle = 'rgba(255,0,0,0.9)';
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);

    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h);

    ctx.restore();
  }
}

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

  const thickness = 20; // visual beam width in px
  const d2 = distPointToSegmentSq(m.x, m.y, ox, oy, tx, ty);
  // enemy circle (radius m.r) vs thick beam (radius thickness/2)
  const combined = m.r + thickness * 0.5;
  if (d2 <= combined * combined) {
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

// Used by drill damage AABB pass
