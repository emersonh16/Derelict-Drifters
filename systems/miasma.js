
// systems/miasma.js
// Big miasma grid advected by wind with beam clearing.
// Laser uses a thick world-space ray (with a tiny fan) so it cleanly sweeps.
/**
 * @typedef {import('../core/state.js').MiasmaState} MiasmaState
 * @typedef {import('../core/state.js').BeamState} BeamState
 */

export function initMiasma(opts = {}) {
  const halfCols = Math.floor((opts.cols ?? 400) / 2);
  const halfRows = Math.floor((opts.rows ?? 400) / 2);
  const cols = halfCols * 2;
  const rows = halfRows * 2;

  const tiles = Array.from({ length: rows }, () => new Array(cols).fill(true));

  /** @type {MiasmaState} */
  const miasma = {
    // grid
    tile: opts.tile ?? 14,
    halfCols, halfRows,
    cols, rows,
    tiles,

    // track world origin and fractional shifts
    originGX: -halfCols,
    originGY: -halfRows,
    _accumX: 0,
    _accumY: 0,

    // laser sweep tunables (on miasma for perf/caching)
    laserMinThicknessTiles: opts.laserMinThicknessTiles ?? 2.0,
    laserFanCount:          opts.laserFanCount          ?? 3,
    laserFanMinDeg:         opts.laserFanMinDeg         ?? 0.25,

    // damage per second when the player is in fog
    dps: opts.dps ?? 35,

    // seed for procedural noise
    seed: Math.random() * 1e9,
  };

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      tiles[y][x] = generateTile(miasma, miasma.originGX + x, miasma.originGY + y);
    }
  }

  return miasma;
}

export function updateMiasma(s, wind, dt) {
  if (!s || !wind) return;

  s._accumX += Math.cos(wind.direction) * wind.speed * dt;
  s._accumY += Math.sin(wind.direction) * wind.speed * dt;

  const shiftX = s._accumX | 0;
  const shiftY = s._accumY | 0;

  if (shiftX !== 0) {
    shiftCols(s, shiftX);
    s._accumX -= shiftX;
  }
  if (shiftY !== 0) {
    shiftRows(s, shiftY);
    s._accumY -= shiftY;
  }
}

export function drawMiasma(ctx, s, camera, cx, cy, w, h) {
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
      if (tileAt(s, gx, gy)) {
        ctx.rect(sx, sy, t, t);
      }
    }
  }

  ctx.fill();
  ctx.restore();
}

export function clearWithBeam(s, b, camera, time, cx, cy) {
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
function shiftCols(s, dx) {
  if (dx > 0) {
    for (let y = 0; y < s.rows; y++) {
      const row = s.tiles[y];
      for (let i = 0; i < dx; i++) row.pop();
      for (let i = 1; i <= dx; i++) {
        const gx = s.originGX - i;
        const gy = s.originGY + y;
        row.unshift(generateTile(s, gx, gy));
      }
    }
    s.originGX -= dx;
  } else if (dx < 0) {
    const n = -dx;
    for (let y = 0; y < s.rows; y++) {
      const row = s.tiles[y];
      for (let i = 0; i < n; i++) row.shift();
      for (let i = 0; i < n; i++) {
        const gx = s.originGX + s.cols + i;
        const gy = s.originGY + y;
        row.push(generateTile(s, gx, gy));
      }
    }
    s.originGX += n;
  }
}

function shiftRows(s, dy) {
  if (dy > 0) {
    for (let i = 0; i < dy; i++) {
      const row = s.tiles.pop();
      const gy = s.originGY - i - 1;
      fillRow(row, s, gy);
      s.tiles.unshift(row);
    }
    s.originGY -= dy;
  } else if (dy < 0) {
    const n = -dy;
    for (let i = 0; i < n; i++) {
      const row = s.tiles.shift();
      const gy = s.originGY + s.rows + i;
      fillRow(row, s, gy);
      s.tiles.push(row);
    }
    s.originGY += n;
  }
}

function fillRow(row, s, gy) {
  for (let x = 0; x < s.cols; x++) {
    const gx = s.originGX + x;
    row[x] = generateTile(s, gx, gy);
  }
}

function generateTile(s, gx, gy) {
  const freq = 0.08;
  const n = noise2d(gx * freq, gy * freq, s.seed);
  return n > 0.5;
}

function noise2d(x, y, seed) {
  const v = Math.sin((x * 12.9898 + y * 78.233 + seed) * 43758.5453);
  return v - Math.floor(v);
}

// March a thick ray in WORLD space and clear tiles along it
function rayStampWorld(s, oxW, oyW, ang, range, thickness) {
  const t = s.tile;
  const step = t;
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
      for (let gx = Math.max(minGX, -s.halfCols); gx <= Math.min(maxGX, s.halfCols - 1); gx++) {
        const cxW = gx * t + t * 0.5;
        const cyW = gy * t + t * 0.5;
        const dx = cxW - pxW, dy = cyW - pyW;
        if (dx*dx + dy*dy <= r2) setCleared(s, gx, gy);
      }
    }
  }
}

function tileAt(s, gx, gy) {
  const x = gx - s.originGX;
  const y = gy - s.originGY;
  if (x < 0 || x >= s.cols || y < 0 || y >= s.rows) return false;
  return s.tiles[y][x];
}

// ---- helpers ----
function idx(s, gx, gy) {
  const x = gx - s.originGX;
  const y = gy - s.originGY;
  if (x < 0 || x >= s.cols || y < 0 || y >= s.rows) return -1;
  return y * s.cols + x;
}

function setCleared(s, gx, gy) {
  const x = gx - s.originGX;
  const y = gy - s.originGY;
  if (x < 0 || x >= s.cols || y < 0 || y >= s.rows) return;
  s.tiles[y][x] = false;
}

function toRad(deg){ return (deg * Math.PI)/180; }

// --- external helpers for game logic ---
// Convert world coords (wx, wy) to an index in the tile grid, or -1 if out of bounds
export function worldToIdx(s, wx, wy) {
  if (!s) return -1;
  const gx = Math.floor(wx / s.tile);
  const gy = Math.floor(wy / s.tile);
  return idx(s, gx, gy);
}

// Is this index fog (true) or clear (false)? Off-map counts as hazardous.
export function isFog(s, i) {
  if (!s || i < 0) return true;
  const x = i % s.cols;
  const y = Math.floor(i / s.cols);
  return s.tiles[y][x];
}
