// systems/miasma.js
// Fog grid that drifts with the wind and can be cleared by the beam.

import * as wind from "./wind.js";

/**
 * @typedef {import('../core/state.js').MiasmaState} MiasmaState
 * @typedef {import('../core/state.js').BeamState} BeamState
 */

/**
 * Initialize a new miasma state.
 * @param {object} [opts]
 * @returns {MiasmaState}
 */
export function init(opts = {}) {
  const halfCols = Math.floor((opts.cols ?? 400) / 2);
  const halfRows = Math.floor((opts.rows ?? 400) / 2);
  const cols = halfCols * 2;
  const rows = halfRows * 2;
  const size = cols * rows;

  /** @type {MiasmaState} */
  const miasma = {
    tile: opts.tile ?? 14,
    halfCols, halfRows,
    cols, rows,
    stride: cols,
    size,

    // boolean grid: 1 = fog, 0 = clear
    cells: new Uint8Array(size).fill(1),

    // spawn probability for new rows/cols (0-100%)
    spawnChance: opts.spawnChance ?? 80,

    // drift accumulators in tile units
    _driftX: 0,
    _driftY: 0,

    // laser sweep tunables (on miasma for perf/caching)
    laserMinThicknessTiles: opts.laserMinThicknessTiles ?? 2.0,
    laserFanCount:          opts.laserFanCount          ?? 3,
    laserFanMinDeg:         opts.laserFanMinDeg         ?? 0.25,

    // damage per second when the player is in fog
    dps: opts.dps ?? 35
  };
  return miasma;
}

/**
 * Advance the miasma grid according to current wind values.
 * @param {MiasmaState} s
 * @param {number} dt
 */
export function update(s, dt) {
  if (!s) return;

  // wind vector in tiles
  const vx = Math.cos(wind.direction) * wind.speed;
  const vy = Math.sin(wind.direction) * wind.speed;

  s._driftX += (vx * dt) / s.tile;
  s._driftY += (vy * dt) / s.tile;

  const shiftX = s._driftX | 0; // truncate toward zero
  const shiftY = s._driftY | 0;

  if (shiftY) {
    shiftRows(s, shiftY);
    s._driftY -= shiftY;
  }
  if (shiftX) {
    shiftCols(s, shiftX);
    s._driftX -= shiftX;
  }
}

/**
 * Draw the miasma grid.
 */
export function draw(ctx, s, camera, cx, cy, w, h) {
  if (!s) return;
  const t = s.tile;

  // visible world bounds
  const leftW   = camera.x - w / 2;
  const rightW  = camera.x + w / 2;
  const topW    = camera.y - h / 2;
  const bottomW = camera.y + h / 2;

  // clamp to grid (grid coords centered on 0,0)
  const minGX = Math.max(-s.halfCols, Math.floor(leftW  / t) - 1);
  const maxGX = Math.min( s.halfCols, Math.ceil (rightW / t) + 1);
  const minGY = Math.max(-s.halfRows, Math.floor(topW   / t) - 1);
  const maxGY = Math.min( s.halfRows, Math.ceil (bottomW/ t) + 1);

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = 'rgba(120, 60, 160, 0.50)';
  ctx.beginPath();

  // compute first screen row start, then increment by tile size
  let sy = Math.floor(minGY * t - camera.y + cy);
  for (let gy = minGY; gy < maxGY; gy++, sy += t) {
    let sx = Math.floor(minGX * t - camera.x + cx);
    for (let gx = minGX; gx < maxGX; gx++, sx += t) {
      if (s.cells[idx(s, gx, gy)] === 1) {
        ctx.rect(sx, sy, t, t);
      }
    }
  }

  ctx.fill();
  ctx.restore();
}

/**
 * Clear fog along the current beam volume.
 */
export function clearWithBeam(s, b, camera, cx, cy) {
  if (!s || !b || b.mode === 'none') return;

  const t = s.tile;
  const playerWX = camera.x;
  const playerWY = camera.y;

  // -------- LASER: carve a thick, continuous ray (plus a tiny fan) --------
  if (b.mode === 'laser') {
    const core = (b.laserCoreWidth ?? 8);
    const halo = core * (b.laserOutlineMult ?? 2.0);
    const minThick = s.laserMinThicknessTiles * t;
    const thickness = Math.max(minThick, core + halo);

    const fan = Math.max(1, s.laserFanCount | 0);
    const dAng = Math.max(toRad(s.laserFanMinDeg), b.halfArc * 0.5);
    const start = b.angle - dAng * ((fan - 1) * 0.5);

    for (let i = 0; i < fan; i++) {
      const ang = start + i * dAng;
      rayStampWorld(s, playerWX, playerWY, ang, b.range + t, thickness);
    }
    return;
  }

  // -------- BUBBLE & CONE: sector test on tile centers (dot product, no atan2) --------
  const maxR2 = (b.range + t) ** 2;

  const minGX = Math.floor((playerWX - b.range) / t);
  const maxGX = Math.ceil ((playerWX + b.range) / t);
  const minGY = Math.floor((playerWY - b.range) / t);
  const maxGY = Math.ceil ((playerWY + b.range) / t);

  // cache beam direction + cosine threshold
  const bx = Math.cos(b.angle);
  const by = Math.sin(b.angle);
  const cosThresh = Math.cos(b.halfArc);

  for (let gy = Math.max(minGY, -s.halfRows); gy <= Math.min(maxGY, s.halfRows - 1); gy++) {
    for (let gx = Math.max(minGX, -s.halfCols); gx <= Math.min(maxGX, s.halfCols - 1); gx++) {
      const wx = gx * t + t * 0.5;
      const wy = gy * t + t * 0.5;
      const dx = wx - playerWX, dy = wy - playerWY;
      const r2 = dx*dx + dy*dy;
      if (r2 > maxR2) continue;

      if (b.mode === 'bubble') {
        setCleared(s, gx, gy);
        continue;
      }

      // dot( norm(dx,dy), beamDir ) >= cos(halfArc)
      const inv = r2 > 0 ? 1 / Math.sqrt(r2) : 0;
      const dot = (dx * inv) * bx + (dy * inv) * by;
      if (dot >= cosThresh) setCleared(s, gx, gy);
    }
  }
}

// ---------- Internals ----------

function shiftCols(s, n) {
  const cols = s.cols;
  const rows = s.rows;
  const grid = s.cells;
  const chance = s.spawnChance;

  if (n > 0) { // wind blowing east, fill west edge
    for (let row = 0; row < rows; row++) {
      const start = row * cols;
      grid.copyWithin(start + n, start, start + cols - n);
      for (let x = 0; x < n; x++) {
        grid[start + x] = rollSpawn(chance);
      }
    }
  } else if (n < 0) { // wind blowing west, fill east edge
    const shift = -n;
    for (let row = 0; row < rows; row++) {
      const start = row * cols;
      grid.copyWithin(start, start + shift, start + cols);
      for (let x = cols - shift; x < cols; x++) {
        grid[start + x] = rollSpawn(chance);
      }
    }
  }
}

function shiftRows(s, n) {
  const cols = s.cols;
  const grid = s.cells;
  const chance = s.spawnChance;
  const size = s.size;

  if (n > 0) { // wind blowing south, fill north edge
    grid.copyWithin(n * cols, 0, size - n * cols);
    for (let i = 0; i < n * cols; i++) {
      grid[i] = rollSpawn(chance);
    }
  } else if (n < 0) { // wind blowing north, fill south edge
    const shift = -n;
    grid.copyWithin(0, shift * cols, size);
    for (let i = size - shift * cols; i < size; i++) {
      grid[i] = rollSpawn(chance);
    }
  }
}

function rollSpawn(baseChance) {
  const jitter = (Math.random() * 20) - 10; // [-10,10)
  const p = Math.max(0, Math.min(100, baseChance + jitter));
  return Math.random() * 100 < p ? 1 : 0;
}

// March a thick ray in WORLD space and clear tiles along it
function rayStampWorld(s, oxW, oyW, ang, range, thickness) {
  const t = s.tile;
  const step = t; // tile-sized step (fan rays cover rotation gaps)
  const cos = Math.cos(ang), sin = Math.sin(ang);
  const r2 = (thickness * 0.5) ** 2;

  for (let d = 0; d <= range; d += step) {
    const pxW = oxW + cos * d;
    const pyW = oyW + sin * d;

    const minGX = Math.floor((pxW - thickness) / t);
    const maxGX = Math.ceil ((pxW + thickness) / t);
    const minGY = Math.floor((pyW - thickness) / t);
    const maxGY = Math.ceil ((pyW + thickness) / t);

    for (let gy = Math.max(minGY, -s.halfRows); gy <= Math.min(maxGY, s.halfRows - 1); gy++) {
      const cyW = gy * t + t * 0.5;
      for (let gx = Math.max(minGX, -s.halfCols); gx <= Math.min(maxGX, s.halfCols - 1); gx++) {
        const cxW = gx * t + t * 0.5;
        const dx = cxW - pxW, dy = cyW - pyW;
        if (dx*dx + dy*dy <= r2) setCleared(s, gx, gy);
      }
    }
  }
}

// ---- helpers ----
function idx(s, gx, gy) {
  const x = gx + s.halfCols;
  const y = gy + s.halfRows;
  return y * s.stride + x; // cached stride
}

function setCleared(s, gx, gy) {
  const i = idx(s, gx, gy);
  s.cells[i] = 0;
}

function toRad(deg){ return (deg * Math.PI)/180; }

// --- external helpers for game logic ---
// Convert world coords (wx, wy) to a cells[] index, or -1 if out of bounds
export function worldToIdx(s, wx, wy) {
  if (!s) return -1;
  const gx = Math.floor(wx / s.tile);
  const gy = Math.floor(wy / s.tile);
  if (gx < -s.halfCols || gx >= s.halfCols || gy < -s.halfRows || gy >= s.halfRows) return -1;
  return idx(s, gx, gy);
}

// Is this index fog (true) or clear (false)? Off-map counts as hazardous.
export function isFog(s, i) {
  return i < 0 ? true : s.cells[i] === 1;
}

