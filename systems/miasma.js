// systems/miasma.js
// Big miasma grid with crystal regrowth + beam clearing.
// Laser uses a thick world-space ray (with a tiny fan) so it cleanly sweeps.

export function initMiasma(state, opts = {}) {
  const halfCols = Math.floor((opts.cols ?? 400) / 2);
  const halfRows = Math.floor((opts.rows ?? 400) / 2);
  const cols = halfCols * 2;
  const rows = halfRows * 2;
  const size = cols * rows;

  state.miasma = {
    // grid
    tile: opts.tile ?? 14,
    halfCols, halfRows,
    cols, rows,
    stride: cols,
    size,

    // double buffer (no per-tick allocations)
    strength: new Uint8Array(size).fill(1),       // 1 = fog, 0 = clear
    strengthNext: new Uint8Array(size).fill(1),

    // regrowth
    regrowDelay: opts.regrowDelay ?? 1.0,
    baseChance:  opts.baseChance  ?? 0.20,
    tickHz:      opts.tickHz      ?? 8,
    lastCleared: new Float32Array(size).fill(-1e9),
    _accum: 0,

    // laser sweep tunables (on miasma for perf/caching)
    laserMinThicknessTiles: opts.laserMinThicknessTiles ?? 2.0,
    laserFanCount:          opts.laserFanCount          ?? 3,
    laserFanMinDeg:         opts.laserFanMinDeg         ?? 0.25,

    // NEW: damage per second when the player is in fog
    dps: opts.dps ?? 35

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

  // visible world bounds
  const leftW   = state.camera.x - w / 2;
  const rightW  = state.camera.x + w / 2;
  const topW    = state.camera.y - h / 2;
  const bottomW = state.camera.y + h / 2;

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
  let sy = Math.floor(minGY * t - state.camera.y + cy);
  for (let gy = minGY; gy < maxGY; gy++, sy += t) {
    let sx = Math.floor(minGX * t - state.camera.x + cx);
    for (let gx = minGX; gx < maxGX; gx++, sx += t) {
      if (s.strength[idx(s, gx, gy)] === 1) {
        ctx.rect(sx, sy, t, t);
      }
    }
  }

  ctx.fill();
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
    const core = (b.laserCoreWidth ?? 8);
    const halo = core * (b.laserOutlineMult ?? 2.0);
    const minThick = s.laserMinThicknessTiles * t;
    const thickness = Math.max(minThick, core + halo);

    const fan = Math.max(1, s.laserFanCount | 0);
    const dAng = Math.max(toRad(s.laserFanMinDeg), b.halfArc * 0.5);
    const start = b.angle - dAng * ((fan - 1) * 0.5);

    for (let i = 0; i < fan; i++) {
      const ang = start + i * dAng;
      rayStampWorld(s, state, playerWX, playerWY, ang, b.range + t, thickness, now);
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
        setCleared(s, gx, gy, now);
        continue;
      }

      // dot( norm(dx,dy), beamDir ) >= cos(halfArc)
      const inv = r2 > 0 ? 1 / Math.sqrt(r2) : 0;
      const dot = (dx * inv) * bx + (dy * inv) * by;
      if (dot >= cosThresh) setCleared(s, gx, gy, now);
    }
  }
}

// ---------- Internals ----------
function regrowStep(state) {
  const s = state.miasma, now = state.time;
  const prev = s.strength;
  const next = s.strengthNext;

  // copy current -> next (no new allocation)
  next.set(prev);

  const hc = s.halfCols, hr = s.halfRows;

  for (let gy = -hr; gy < hr; gy++) {
    const gyUpOK = (gy - 1) >= -hr;
    const gyDnOK = (gy + 1) <  hr;
    for (let gx = -hc; gx < hc; gx++) {
      const i = idx(s, gx, gy);
      if (prev[i] === 1) continue;                    // already fog
      if ((now - s.lastCleared[i]) < s.regrowDelay) continue;

      let adj = 0;
      if (gx - 1 >= -hc && prev[idx(s, gx - 1, gy)] === 1) adj++;
      if (gx + 1 <   hc && prev[idx(s, gx + 1, gy)] === 1) adj++;
      if (gyUpOK        && prev[idx(s, gx, gy - 1)] === 1) adj++;
      if (gyDnOK        && prev[idx(s, gx, gy + 1)] === 1) adj++;

      if (adj > 0) {
        const p = 1 - Math.pow(1 - s.baseChance, adj);
        if (Math.random() < p) next[i] = 1;
      }
    }
  }

  // swap buffers
  s.strength = next;
  s.strengthNext = prev;
}

// March a thick ray in WORLD space and clear tiles along it
function rayStampWorld(s, state, oxW, oyW, ang, range, thickness, now) {
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
        if (dx*dx + dy*dy <= r2) setCleared(s, gx, gy, now);
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

function setCleared(s, gx, gy, now) {
  const i = idx(s, gx, gy);
  s.strength[i] = 0;
  s.lastCleared[i] = now;
}

function toRad(deg){ return (deg * Math.PI)/180; }

// --- external helpers for game logic ---
// Convert world coords (wx, wy) to a strength[] index, or -1 if out of bounds
export function worldToIdx(s, wx, wy) {
  if (!s) return -1;
  const gx = Math.floor(wx / s.tile);
  const gy = Math.floor(wy / s.tile);
  if (gx < -s.halfCols || gx >= s.halfCols || gy < -s.halfRows || gy >= s.halfRows) return -1;
  return idx(s, gx, gy);
}

// Is this index fog (true) or clear (false)? Off-map counts as hazardous.
export function isFog(s, i) {
  return i < 0 ? true : s.strength[i] === 1;
}
