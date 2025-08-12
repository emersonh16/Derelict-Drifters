// systems/miasma.js
// Binary miasma grid with world-space clearing for ALL beam modes.

export function initMiasma(state, opts = {}) {
  const halfCols = Math.floor((opts.cols ?? 220) / 2);
  const halfRows = Math.floor((opts.rows ?? 220) / 2);

  state.miasma = {
    tile: opts.tile ?? 14,
    halfCols,
    halfRows,
    regrowDelay: opts.regrowDelay ?? 1.2,
    tickHz: opts.tickHz ?? 8,
    baseChance: opts.baseChance ?? 0.14,
    strength: null,         // Uint8Array (1=fog, 0=clear)
    lastCleared: null,      // Float32Array timestamps
    _accum: 0
  };

  const cols = halfCols * 2, rows = halfRows * 2, N = cols * rows;
  const strength = new Uint8Array(N);
  const lastCleared = new Float32Array(N);
  for (let i = 0; i < N; i++) { strength[i] = 1; lastCleared[i] = -1e9; }
  state.miasma.strength = strength;
  state.miasma.lastCleared = lastCleared;
}

export function updateMiasma(state, dt) {
  const s = state.miasma; if (!s) return;
  s._accum += dt;
  const step = 1 / s.tickHz;
  while (s._accum >= step) { s._accum -= step; regrowStep(state); }
}

export function drawMiasma(ctx, state, cx, cy, w, h) {
  const s = state.miasma; if (!s) return;
  const t = s.tile;

  // Visible world bounds (in world coords)
  const leftW   = state.camera.x - w / 2;
  const rightW  = state.camera.x + w / 2;
  const topW    = state.camera.y - h / 2;
  const bottomW = state.camera.y + h / 2;

  // Visible grid range (grid coords centered on 0,0)
  const minGX = Math.max(-s.halfCols, Math.floor(leftW  / t) - 1);
  const maxGX = Math.min( s.halfCols, Math.ceil (rightW / t) + 1);
  const minGY = Math.max(-s.halfRows, Math.floor(topW   / t) - 1);
  const maxGY = Math.min( s.halfRows, Math.ceil (bottomW/ t) + 1);

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = 'rgba(120, 60, 160, 0.50)';

  for (let gy = minGY; gy < maxGY; gy++) {
    for (let gx = minGX; gx < maxGX; gx++) {
      const i = idx(s, gx, gy);
      if (s.strength[i] === 0) continue;

      // tile top-left in world coords
      const wx = gx * t;
      const wy = gy * t;

      // world → screen
      const sx = Math.floor(wx - state.camera.x + cx);
      const sy = Math.floor(wy - state.camera.y + cy);
      if (sx > w || sy > h || sx + t < 0 || sy + t < 0) continue;

      ctx.fillRect(sx, sy, t, t);
    }
  }
  ctx.restore();
}

export function clearWithBeam(state, cx, cy) {
  const s = state.miasma; if (!s) return;

  // --- world-space center & mouse ---
  const playerWX = state.camera.x;                      // world coords at screen center
  const playerWY = state.camera.y;
  const mouseWX  = state.camera.x + (state.mouse.x - cx);
  const mouseWY  = state.camera.y + (state.mouse.y - cy);
  const aimAng   = Math.atan2(mouseWY - playerWY, mouseWX - playerWX);

  // Beam mode
  const mode = beamMode(state);
  if (mode === 'none') return;

  const t = s.tile;
  const pad = t * 1.0; // over-clear one tile around edges

  if (mode === 'bubble') {
    const R = bubbleRadiusFromT(state.beam) + pad;

    // Iterate tiles near the circle in WORLD space
    const minGX = Math.floor((playerWX - R) / t);
    const maxGX = Math.ceil ((playerWX + R) / t);
    const minGY = Math.floor((playerWY - R) / t);
    const maxGY = Math.ceil ((playerWY + R) / t);

    for (let gy = clampInt(minGY, -s.halfRows, s.halfRows - 1);
             gy <= clampInt(maxGY, -s.halfRows, s.halfRows - 1); gy++) {
      for (let gx = clampInt(minGX, -s.halfCols, s.halfCols - 1);
               gx <= clampInt(maxGX, -s.halfCols, s.halfCols - 1); gx++) {
        const i = idx(s, gx, gy);
        const cxW = gx * t + t * 0.5;                   // tile center world
        const cyW = gy * t + t * 0.5;
        const dx = cxW - playerWX, dy = cyW - playerWY; // world delta to player
        if (dx*dx + dy*dy <= R*R) setCleared(state, i);
      }
    }
    return;
  }

  // Cone or Laser
  const params = coneParamsFromT(state.beam);
  const halfArc = params.halfArc;
  const range   = params.range + pad;
  const angPad  = Math.atan2(pad, Math.max(32, range)); // edge insurance

  const minGX = Math.floor((playerWX - range) / t);
  const maxGX = Math.ceil ((playerWX + range) / t);
  const minGY = Math.floor((playerWY - range) / t);
  const maxGY = Math.ceil ((playerWY + range) / t);

  for (let gy = clampInt(minGY, -s.halfRows, s.halfRows - 1);
           gy <= clampInt(maxGY, -s.halfRows, s.halfRows - 1); gy++) {
    for (let gx = clampInt(minGX, -s.halfCols, s.halfCols - 1);
             gx <= clampInt(maxGX, -s.halfCols, s.halfCols - 1); gx++) {
      const i = idx(s, gx, gy);
      const cxW = gx * t + t * 0.5;
      const cyW = gy * t + t * 0.5;
      const dx = cxW - playerWX, dy = cyW - playerWY;
      const dist2 = dx*dx + dy*dy;
      if (dist2 > range*range) continue;

      const a = Math.atan2(dy, dx);
      const d = angleDiff(a, aimAng);
      if (Math.abs(d) <= (halfArc + angPad)) setCleared(state, i);
    }
  }

  // Laser gets an extra crisp “ray” down the center
  if (mode === 'laser') {
    const thickness = Math.max(t * 0.7, 6);
    rayStampWorld(s, state, playerWX, playerWY, aimAng, range, thickness);
  }
}

// ---------- internals ----------
function regrowStep(state) {
  const s = state.miasma, now = state.time;
  const cols = s.halfCols * 2, rows = s.halfRows * 2;
  const next = s.strength.slice();

  for (let gy = -s.halfRows; gy < s.halfRows; gy++) {
    for (let gx = -s.halfCols; gx < s.halfCols; gx++) {
      const i = idx(s, gx, gy);
      if (s.strength[i] === 1) continue;
      if ((now - s.lastCleared[i]) < s.regrowDelay) continue;

      let adj = 0;
      if (gx - 1 >= -s.halfCols && s.strength[idx(s, gx - 1, gy)] === 1) adj++;
      if (gx + 1 <   s.halfCols && s.strength[idx(s, gx + 1, gy)] === 1) adj++;
      if (gy - 1 >= -s.halfRows && s.strength[idx(s, gx, gy - 1)] === 1) adj++;
      if (gy + 1 <   s.halfRows && s.strength[idx(s, gx, gy + 1)] === 1) adj++;

      if (adj > 0) {
        const p = 1 - Math.pow(1 - s.baseChance, adj);
        if (Math.random() < p) next[i] = 1;
      }
    }
  }
  s.strength = next;
}

function bubbleRadiusFromT(b) {
  const u = invLerp(b.tNoBeamEnd, b.tBubbleEnd, b.t);
  return lerp(b.bubbleRMin, b.bubbleRMax, u);
}

function coneParamsFromT(b) {
  if (b.t <= b.tConeEnd) {
    const u = invLerp(b.tBubbleEnd, b.tConeEnd, b.t);
    return { halfArc: lerp(b.coneHalfArcWide, b.coneHalfArcNarrow, u), range: b.baseRange };
  }
  const u = invLerp(b.tConeEnd, 1, b.t);
  const halfArc = Math.max(b.laserMinHalfArc ?? toRad(0.22), lerp(b.coneHalfArcNarrow, toRad(0.22), 0.8 + 0.2*u));
  const range   = lerp(b.baseRange, b.laserRange, 0.9);
  return { halfArc, range };
}

function beamMode(state) {
  const t = state.beam.t;
  if (t <= state.beam.tNoBeamEnd) return 'none';
  if (t <= state.beam.tBubbleEnd) return 'bubble';
  if (t <= state.beam.tConeEnd)   return 'cone';
  return 'laser';
}

function setCleared(state, i) {
  const s = state.miasma;
  s.strength[i] = 0;
  s.lastCleared[i] = state.time;
}

// March a thick ray in WORLD space and clear tiles along it
function rayStampWorld(s, state, oxW, oyW, ang, range, thickness) {
  const t = s.tile, step = t * 0.6;
  const cos = Math.cos(ang), sin = Math.sin(ang);
  const rad2 = (thickness * 0.5) ** 2;

  for (let d = 0; d <= range; d += step) {
    const pxW = oxW + cos * d;
    const pyW = oyW + sin * d;

    const minGX = Math.floor((pxW - thickness) / t);
    const maxGX = Math.ceil ((pxW + thickness) / t);
    const minGY = Math.floor((pyW - thickness) / t);
    const maxGY = Math.ceil ((pyW + thickness) / t);

    for (let gy = clampInt(minGY, -s.halfRows, s.halfRows - 1); gy <= clampInt(maxGY, -s.halfRows, s.halfRows - 1); gy++) {
      for (let gx = clampInt(minGX, -s.halfCols, s.halfCols - 1); gx <= clampInt(maxGX, -s.halfCols, s.halfCols - 1); gx++) {
        const i = idx(s, gx, gy);
        const cxW = gx * t + t * 0.5;
        const cyW = gy * t + t * 0.5;
        const dx = cxW - pxW, dy = cyW - pyW;
        if (dx*dx + dy*dy <= rad2) setCleared(state, i);
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
function clampInt(v, a, z) { return Math.max(a, Math.min(z, v)); }
function toRad(deg){ return (deg * Math.PI)/180; }
function lerp(a,b,t){ return a + (b-a)*t; }
function invLerp(a,b,v){ return Math.max(0, Math.min(1, (v-a)/(b-a))); }
function angleDiff(a, b) {
  let d = a - b;
  while (d >  Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
