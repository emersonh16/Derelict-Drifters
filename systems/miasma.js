import { smoothNoise } from "./smooth-noise.js";

// systems/miasma.js
/**
 * Conveyor-belt style miasma grid + regrowth.
 * - Grid drifts in whole tiles based on wind.
 * - Clearing records timestamps.
 * - Regrowth happens in ticks, using a double buffer and
 *   adjacency-biased probability like your old implementation.
 *
 * Exports:
 *  - initMiasma(cfg)
 *  - updateMiasma(m, wind, dt)
 *  - regrowMiasma(m, cfg, time, dt)   // single regrow path
 *  - drawMiasma(ctx, m, cam, cx, cy, w, h)
 *  - worldToIdx(m, wx, wy)
 *  - isFog(m, idx)
 *  - clearWithBeam(m, beamState, camera, time, cx, cy)
 */

/**
 * @typedef {Object} MiasmaState
 * @property {number} tile
 * @property {number} cols
 * @property {number} rows
 * @property {number} halfCols
 * @property {number} halfRows
 * @property {number} stride
 * @property {number} size
 * @property {Uint8Array} strength       // 1 = fog, 0 = clear
 * @property {Uint8Array} strengthNext   // double buffer
 * @property {Float32Array} lastClear    // game-time when tile was cleared
 * @property {number} spawnProb
 * @property {number} bufferCols
 * @property {number} bufferRows
 * @property {number} offsetX
 * @property {number} offsetY
 * @property {number} regrowTimer        // tick accumulator
 * @property {number} coverage           // current coverage [0,1]
 * @property {number} targetCoverage
 * @property {number} densityT
 * @property {number} densitySeed
 * @property {{minX:number,maxX:number,minY:number,maxY:number}} bubble
 */

export function initMiasma(cfg) {
  const cols = cfg.cols + cfg.bufferCols * 2;
  const rows = cfg.rows + cfg.bufferRows * 2;
  const size = cols * rows;

  const strength = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    strength[i] = Math.random() < cfg.spawnProb ? 1 : 0;
  }

  // Optional "safe" patch in center so the player isn't insta-damaged at t0.
  const safeR = 10;
  const cx = Math.floor(cols / 2);
  const cy = Math.floor(rows / 2);
  for (let dy = -safeR; dy <= safeR; dy++) {
    for (let dx = -safeR; dx <= safeR; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || x >= cols || y < 0 || y >= rows) continue;
      strength[y * cols + x] = 0;
    }
  }

  if (cfg.debugSpawn) {
    let fogCount = 0;
    for (let i = 0; i < size; i++) {
      strength[i] = Math.random() < 0.7 ? 1 : 0;
      if (strength[i] === 1) fogCount++;
    }
    console.log("[miasma] debug spawn → fog tiles:", fogCount, "of", size);
  }

  return {
    tile: cfg.tile,
    cols, rows,
    halfCols: Math.floor(cols / 2),
    halfRows: Math.floor(rows / 2),
    stride: cols,
    size,

    strength,
    strengthNext: new Uint8Array(size).fill(1),
    lastClear: new Float32Array(size).fill(-1e9),

    spawnProb: cfg.spawnProb,
    bufferCols: cfg.bufferCols,
    bufferRows: cfg.bufferRows,

    offsetX: 0,
    offsetY: 0,

    regrowTimer: 0,

    coverage: 0,
    targetCoverage: 0,
    densityT: 0,
    densitySeed: Math.random() * 1000,
    bubble: { minX:0, maxX:0, minY:0, maxY:0 },
  };
}

/**
 * Drift the grid (whole tiles) according to wind.
 */
export function updateMiasma(m, wind, dt) {
  const move = wind.speed * dt;
  m.offsetX += Math.cos(wind.direction) * move;
  m.offsetY += Math.sin(wind.direction) * move;

  const xShift = Math.trunc(m.offsetX / m.tile);
  const yShift = Math.trunc(m.offsetY / m.tile);

  if (xShift !== 0) {
    shift(m, xShift, 0);
    m.offsetX -= xShift * m.tile;
  }

  if (yShift !== 0) {
    shift(m, 0, yShift);
    m.offsetY -= yShift * m.tile;
  }
}

export function getCoveragePercent(m) {
  const b = m.bubble;
  const t = m.tile;
  const originX = -m.halfCols * t;
  const originY = -m.halfRows * t;
  const startX = Math.max(0, Math.floor((b.minX - originX) / t));
  const endX = Math.min(m.cols - 1, Math.floor((b.maxX - originX) / t));
  const startY = Math.max(0, Math.floor((b.minY - originY) / t));
  const endY = Math.min(m.rows - 1, Math.floor((b.maxY - originY) / t));
  let fog = 0, total = 0;
  for (let y = startY; y <= endY; y++) {
    const row = y * m.cols;
    for (let x = startX; x <= endX; x++) {
      total++;
      if (m.strength[row + x] === 1) fog++;
    }
  }
  return total ? fog / total : 0;
}

export function updateTargetCoverage(m, dt, densityCfg) {
  m.densityT += dt;
  const n = smoothNoise(m.densityT, m.densitySeed, densityCfg.noiseScale);
  const desired = densityCfg.min + ((n + 1) * 0.5) * (densityCfg.max - densityCfg.min);
  const k = 1 - Math.exp(-densityCfg.response * dt);
  m.targetCoverage += (desired - m.targetCoverage) * k;
}

/**
 * Regrowth tick (adjacency biased, double buffer).
 * Call this after updateMiasma in the main loop.
 *
 * cfg fields (from config.dynamicMiasma):
 *  - regrowEnabled: boolean
 *  - regrowDelay:   seconds
 *  - baseChance:    probability per tick for each adjacent fog (combined as 1-(1-p)^adj)
 *  - tickHz:        ticks per second
 */
export function regrowMiasma(m, cfg, time, dt) {
  if (!cfg || !cfg.regrowEnabled) return;

  const tickHz = cfg.tickHz || 8;
  const step = 1 / tickHz;
  m.regrowTimer += dt;
  while (m.regrowTimer >= step) {
    m.regrowTimer -= step;
    const diff = m.targetCoverage - m.coverage;
    const chance = Math.max(0, Math.min(1, (cfg.baseChance ?? 0.20) * (1 + diff)));
    regrowStep(m, time, cfg.regrowDelay ?? 1.0, chance);
    m.coverage = getCoveragePercent(m);
  }
}

/**
 * Draw fog tiles aligned to world pixel grid (centered grid).
 */
export function drawMiasma(ctx, m, cam, cx, cy, w, h) {
  ctx.fillStyle = "rgba(180,120,255,1.0)";
  const t = m.tile;
  const cxTiles = Math.floor(m.cols / 2);
  const cyTiles = Math.floor(m.rows / 2);

  const originX = -cxTiles * t;
  const originY = -cyTiles * t;

  for (let y = 0; y < m.rows; y++) {
    const wy = ((originY + y * t - cam.y + cy) | 0);
    for (let x = 0; x < m.cols; x++) {
      if (m.strength[y * m.cols + x] !== 1) continue;
      const wx = ((originX + x * t - cam.x + cx) | 0);
      ctx.fillRect(wx, wy, t, t);
    }
  }
}

/**
 * Convert a world position to a grid index.
 */
export function worldToIdx(m, wx, wy /*, camera */) {
  const t = m.tile;
  const cols = m.cols, rows = m.rows;
  const cxTiles = Math.floor(cols / 2);
  const cyTiles = Math.floor(rows / 2);

  const originX = -cxTiles * t;
  const originY = -cyTiles * t;

  const x = Math.floor((wx - originX) / t);
  const y = Math.floor((wy - originY) / t);

  if (x < 0 || x >= cols || y < 0 || y >= rows) return -1;
  return y * cols + x;
}

/**
 * True iff the index is in-bounds and fogged.
 */
export function isFog(m, idx) {
  if (idx < 0 || idx >= m.size) return false;
  return m.strength[idx] === 1;
}

// March a thick ray in WORLD space and clear tiles along it
function rayStampWorld(s, oxW, oyW, ang, range, thickness, now) {
  const t = s.tile;
  const step = t; // tile-sized step (fan rays cover rotation gaps)
  const cos = Math.cos(ang), sin = Math.sin(ang);
  const r2 = (thickness * 0.5) ** 2;

  // Grid origin in world coords (centered grid)
  const originX = -s.halfCols * t;
  const originY = -s.halfRows * t;

  for (let d = 0; d <= range; d += step) {
    const pxW = oxW + cos * d;
    const pyW = oyW + sin * d;

    // Tight AABB around the current disc
    const minGX = Math.max(0, Math.floor((pxW - thickness - originX) / t));
    const maxGX = Math.min(s.cols - 1, Math.ceil((pxW + thickness - originX) / t));
    const minGY = Math.max(0, Math.floor((pyW - thickness - originY) / t));
    const maxGY = Math.min(s.rows - 1, Math.ceil((pyW + thickness - originY) / t));

    for (let gy = minGY; gy <= maxGY; gy++) {
      const cyW = originY + gy * t + t * 0.5;
      for (let gx = minGX; gx <= maxGX; gx++) {
        const cxW = originX + gx * t + t * 0.5;
        const dx = cxW - pxW, dy = cyW - pyW;
        if (dx*dx + dy*dy <= r2) {
          const i = gy * s.cols + gx;
          if (s.strength[i] === 1) {
            s.strength[i]  = 0;
            s.lastClear[i] = now;
          }
        }
      }
    }
  }
}

/**
 * Clear tiles intersecting the beam shape in world space.
 * Records lastClear for regrowDelay.
 */
export function clearWithBeam(m, beamState, camera, time, cx, cy) {
  const mode     = beamState.mode;     // "bubble" | "cone" | "laser"
  const angleW   = beamState.angle;    // world angle (radians)
  const halfArc  = beamState.halfArc;
  const maxRange = mode === "bubble" ? (beamState.radius || 0) : (beamState.range || 0);
  if (!maxRange || maxRange <= 0) return;

  const t   = m.tile;
  const px  = camera.x;    // player world X
  const py  = camera.y;    // player world Y

  // -------- LASER: carve a thick, continuous ray (plus a tiny fan) --------
  if (mode === "laser") {
    // Minimum thickness in tiles so the cut stays chunky even on small tile sizes
    const minThick = Math.max(1, (4.0 /* tiles */)) * t;
    const core = (beamState.laserCoreWidth   ?? 8);
    const halo = core * (beamState.laserOutlineMult ?? 2.0);
    const thickness = Math.max(minThick, core + halo);

    // Tiny fan to fill rotation gaps at high angular speeds
    const fanCount = Math.max(1, (m.laserFanCount | 0) || 3);
    const minDeg   = (m.laserFanMinDeg ?? 0.25) * (Math.PI / 180);
    const dAng     = Math.max(minDeg, halfArc * 0.5);
    const start    = angleW - dAng * ((fanCount - 1) * 0.5);

    for (let i = 0; i < fanCount; i++) {
      const ang = start + i * dAng;
      rayStampWorld(m, px, py, ang, maxRange + t, thickness, time);
    }
    return;
  }

  // -------- BUBBLE & CONE: sector test on tile centers (dot product; no atan2) --------
  const originX = -m.halfCols * t;
  const originY = -m.halfRows * t;
  const maxR2   = (maxRange + t) ** 2;

  // Clamp a search window around the player
  const minGX = Math.max(0, Math.floor((px - maxRange - originX) / t));
  const maxGX = Math.min(m.cols - 1, Math.ceil((px + maxRange - originX) / t));
  const minGY = Math.max(0, Math.floor((py - maxRange - originY) / t));
  const maxGY = Math.min(m.rows - 1, Math.ceil((py + maxRange - originY) / t));

  // Beam direction + cosine threshold
  const bx = Math.cos(angleW);
  const by = Math.sin(angleW);
  const cosThresh = Math.cos(halfArc);

  for (let gy = minGY; gy <= maxGY; gy++) {
    const wy = originY + gy * t + t * 0.5;
    for (let gx = minGX; gx <= maxGX; gx++) {
      const i  = gy * m.cols + gx;
      if (m.strength[i] === 0) continue;

      const wx = originX + gx * t + t * 0.5;
      const dx = wx - px, dy = wy - py;
      const r2 = dx*dx + dy*dy;
      if (r2 > maxR2) continue;

      if (mode === "bubble") {
        m.strength[i]  = 0;
        m.lastClear[i] = time;
        continue;
      }

      // CONE: dot( norm(dx,dy), beamDir ) >= cos(halfArc)
      const inv = r2 > 0 ? 1 / Math.sqrt(r2) : 0;
      const dot = (dx * inv) * bx + (dy * inv) * by;
      if (dot >= cosThresh) {
        m.strength[i]  = 0;
        m.lastClear[i] = time;
      }
    }
  }
}

/* ---------------- Internals ---------------- */

function regrowStep(s, now, regrowDelay, baseChance) {
  const prev = s.strength;
  const next = s.strengthNext;

  // copy current → next (no allocation)
  next.set(prev);

  const cols = s.cols, rows = s.rows;

  for (let y = 0; y < rows; y++) {
    const yUpOK = (y - 1) >= 0;
    const yDnOK = (y + 1) < rows;
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (prev[i] === 1) continue;                        // already fog
      if ((now - s.lastClear[i]) < regrowDelay) continue; // not yet eligible

      let adj = 0;
      if (x - 1 >= 0     && prev[i - 1]         === 1) adj++;
      if (x + 1 < cols   && prev[i + 1]         === 1) adj++;
      if (yUpOK          && prev[i - cols]      === 1) adj++;
      if (yDnOK          && prev[i + cols]      === 1) adj++;

      if (adj > 0) {
        // Combine chance from neighbors: p = 1 - (1 - base)^adj
        const p = 1 - Math.pow(1 - baseChance, adj);
        if (Math.random() < p) next[i] = 1;
      }
    }
  }

  // swap buffers
  s.strength = next;
  s.strengthNext = prev;
}

function shift(m, dx, dy) {
  const { cols, rows, strength, strengthNext, lastClear, spawnProb } = m;
  const diff = m.targetCoverage - m.coverage;
  const spawnChance = Math.max(0, Math.min(1, spawnProb * (1 + diff)));

  // When shifting, we must move both strength and lastClear.
  // We don't need strengthNext during shifting, but keep it in sync by ignoring it here;
  // it’s only used as a double buffer during regrow ticks.

  // Create temporary buffers to write the shifted result.
  const tmpStrength = new Uint8Array(m.size);
  const tmpLastClear = new Float32Array(m.size);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const srcX = x - dx;
      const srcY = y - dy;

      const di = y * cols + x;

      if (srcX >= 0 && srcX < cols && srcY >= 0 && srcY < rows) {
        const si = srcY * cols + srcX;
        tmpStrength[di]  = strength[si];
        tmpLastClear[di] = lastClear[si];
      } else {
        // Spawn new content on the entering edge.
        tmpStrength[di]  = Math.random() < spawnChance ? 1 : 0;
        tmpLastClear[di] = -1e9; // effectively "long ago"
      }
    }
  }

  // Commit the shifted data back.
  strength.set(tmpStrength);
  lastClear.set(tmpLastClear);

  // Recompute coverage in the active bubble after shifts.
  m.coverage = getCoveragePercent(m);
}
