// systems/miasma.js
// Big miasma grid with crystal regrowth + beam clearing.
// Laser uses a thick world-space ray (with a tiny fan) so it cleanly sweeps.

export function initMiasma(state, opts = {}) {
  const halfCols = Math.floor((opts.cols ?? 400) / 2);
  const halfRows = Math.floor((opts.rows ?? 400) / 2);
  const cols = halfCols * 2;                 // <-- added
  const rows = halfRows * 2;                 // <-- added
  const size = cols * rows;                  // (same as halfCols*2 * halfRows*2)

  state.miasma = {
    // grid
    tile: opts.tile ?? 14,
    halfCols,
    halfRows,
    cols,                                    // <-- added
    rows,                                    // <-- added
    strength: new Uint8Array(size).fill(1),  // 1 = fog, 0 = clear

    // regrowth
    regrowDelay: opts.regrowDelay ?? 1.0,    // seconds before a cleared tile may regrow
    baseChance:  opts.baseChance  ?? 0.20,   // per-tick base chance (amplified by adjacent fog)
    tickHz:      opts.tickHz      ?? 8,      // regrowth ticks per second
    lastCleared: new Float32Array(size).fill(-1e9),
    _accum: 0,

    // laser sweep tunables
    laserMinThicknessTiles: opts.laserMinThicknessTiles ?? 2.0, // >= this * tile size
    laserFanCount:          opts.laserFanCount          ?? 3,   // 3–5 recommended if rotating fast
    laserFanMinDeg:         opts.laserFanMinDeg         ?? 0.25 // minimum angular spacing between fan rays
  };
}

export function updateMiasma(state, dt) {
  const s = state.miasma; if (!s) return;
  s._accum += dt;
  const step = 1 / s.tickHz;
  while (s._accum >= step) {
    s._accum -= step;
    regrowStep(state);
  }
}

export function drawMiasma(ctx, state, cx, cy, w, h) {
  const s = state.miasma; if (!s) return;
  const t = s.tile;

  // visible world bounds (world coords)
  const leftW   = state.camera.x - w / 2;
  const rightW  = state.camera.x + w / 2;
  const topW    = state.camera.y - h / 2;
  const bottomW = state.camera.y + h / 2;

  // visible grid range (grid coords centered on 0,0)
  const minGX = Math.max(-s.halfCols, Math.floor(leftW  / t) - 1);
  const maxGX = Math.min( s.halfCols, Math.ceil (rightW / t) + 1);
  const minGY = Math.max(-s.halfRows, Math.floor(topW   / t) - 1);
  const maxGY = Math.min( s.halfRows, Math.ceil (bottomW/ t) + 1);

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = 'rgba(120, 60, 160, 0.50)';

  for (let gy = minGY; gy < maxGY; gy++) {
    for (let gx = minGX; gx < maxGX; gx++) {
      if (tileActive(s, gx, gy)) {
        const sx = Math.floor(gx * t - state.camera.x + cx);
        const sy = Math.floor(gy * t - state.camera.y + cy);
        ctx.fillRect(sx, sy, t, t);
      }
    }
  }
  ctx.restore();
}

export function clearWithBeam(state, cx, cy) {
  const s = state.miasma; const b = state.beam;
  if (!s || !b || b.mode === 'none') return;

  const t = s.tile;
  const playerWX = state.camera.x;
  const playerWY = state.camera.y;
  const now = state.time;

  // -------- LASER: carve a thick, continuous ray (plus a tiny fan) --------
  if (b.mode === 'laser') {
    // Thickness tied to visuals (core + halo) with a minimum in tile units
    const core = (b.laserCoreWidth ?? 8);
    const halo = core * (b.laserOutlineMult ?? 2.0);
    const minThick = s.laserMinThicknessTiles * t;
    const thickness = Math.max(minThick, core + halo);

    // Fan a few rays to avoid gaps while rotating quickly
    const fan = Math.max(1, s.laserFanCount | 0);
    const dAng = Math.max(toRad(s.laserFanMinDeg), b.halfArc * 0.5); // keep small
    const start = b.angle - dAng * ((fan - 1) * 0.5);

    for (let i = 0; i < fan; i++) {
      const ang = start + i * dAng;
      rayStampWorld(s, state, playerWX, playerWY, ang, b.range + t, thickness, now);
    }
    return;
  }

  // -------- BUBBLE & CONE: sector test on tile centers --------
  const maxR2 = (b.range + t) ** 2;

  const minGX = Math.floor((playerWX - b.range) / t);
  const maxGX = Math.ceil ((playerWX + b.range) / t);
  const minGY = Math.floor((playerWY - b.range) / t);
  const maxGY = Math.ceil ((playerWY + b.range) / t);

  for (let gy = minGY; gy <= maxGY; gy++) {
    if (gy < -s.halfRows || gy >= s.halfRows) continue;
    for (let gx = minGX; gx <= maxGX; gx++) {
      if (gx < -s.halfCols || gx >= s.halfCols) continue;

      const wx = gx * t + t * 0.5;
      const wy = gy * t + t * 0.5;
      const dx = wx - playerWX, dy = wy - playerWY;
      if (dx*dx + dy*dy > maxR2) continue;

      if (b.mode === 'bubble') {
        setCleared(s, gx, gy, now);
        continue;
      }
      const ang = Math.atan2(dy, dx);
      if (Math.abs(angleDiff(ang, b.angle)) <= b.halfArc) {
        setCleared(s, gx, gy, now);
      }
    }
  }
}

// ---------- Internals ----------
function regrowStep(state) {
  const s = state.miasma, now = state.time;
  const next = s.strength.slice();

  for (let gy = -s.halfRows; gy < s.halfRows; gy++) {
    for (let gx = -s.halfCols; gx < s.halfCols; gx++) {
      const i = idx(s, gx, gy);
      if (s.strength[i] === 1) continue;                         // already fog
      if ((now - s.lastCleared[i]) < s.regrowDelay) continue;    // respect cooldown

      // 4-neighborhood crystal growth
      let adj = 0;
      if (gx - 1 >= -s.halfCols && s.strength[idx(s, gx - 1, gy)] === 1) adj++;
      if (gx + 1 <   s.halfCols && s.strength[idx(s, gx + 1, gy)] === 1) adj++;
      if (gy - 1 >= -s.halfRows && s.strength[idx(s, gx, gy - 1)] === 1) adj++;
      if (gy + 1 <   s.halfRows && s.strength[idx(s, gx, gy + 1)] === 1) adj++;

      if (adj > 0) {
        // Probability increases with adjacent fog
        const p = 1 - Math.pow(1 - s.baseChance, adj);
        if (Math.random() < p) next[i] = 1;
      }
    }
  }
  s.strength = next;
}

// March a thick ray in WORLD space and clear tiles along it
function rayStampWorld(s, state, oxW, oyW, ang, range, thickness, now) {
  const t = s.tile;
  const step = t * 0.6; // small step to avoid holes
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
        if (dx*dx + dy*dy <= r2) setCleared(s, gx, gy, now);
      }
    }
  }
}

// ---- helpers ----
function idx(s, gx, gy) {
  const x = gx + s.halfCols;
  const y = gy + s.halfRows;
  return y * (s.halfCols * 2) + x;
}
function tileActive(s, gx, gy) { return s.strength[idx(s, gx, gy)] === 1; }
function setCleared(s, gx, gy, now) {
  const i = idx(s, gx, gy);
  s.strength[i] = 0;
  s.lastCleared[i] = now;
}
function angleDiff(a, b) {
  let d = a - b;
  while (d >  Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
function toRad(deg){ return (deg * Math.PI)/180; }

// --- external helpers for game logic ---
// Convert world coords (wx, wy) to a strength[] index, or -1 if out of bounds
export function worldToIdx(s, wx, wy) {
  if (!s) return -1;
  const gx = Math.floor(wx / s.tile);
  const gy = Math.floor(wy / s.tile);
  if (gx < -s.halfCols || gx >= s.halfCols || gy < -s.halfRows || gy >= s.halfRows) return -1;
  // reuse the module's own indexing so we never drift from drawMiasma()
  return idx(s, gx, gy);
}

// Is this index fog (true) or clear (false)? Off-map counts as hazardous.
export function isFog(s, i) {
  return i < 0 ? true : s.strength[i] === 1;
}
