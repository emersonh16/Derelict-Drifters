export function initMiasma(state, opts = {}) {
  const halfCols = Math.floor((opts.cols ?? 400) / 2); // much larger
  const halfRows = Math.floor((opts.rows ?? 400) / 2);
  const size = halfCols * 2 * halfRows * 2;
  state.miasma = {
    tile: opts.tile ?? 14,
    halfCols, halfRows,
    strength: new Uint8Array(size).fill(1), // full fog
    regrowDelay: opts.regrowDelay ?? 1.0,   // seconds before tile can regrow
    baseChance: opts.baseChance ?? 0.2,     // growth probability
    lastCleared: new Float32Array(size).fill(-1e9),
    _accum: 0,
    tickHz: opts.tickHz ?? 8
  };
}

export function updateMiasma(state, dt) {
  const s = state.miasma;
  s._accum += dt;
  const step = 1 / s.tickHz;
  while (s._accum >= step) {
    s._accum -= step;
    regrowStep(state);
  }
}

export function drawMiasma(ctx, state, cx, cy, w, h) {
  const s = state.miasma;
  const t = s.tile;
  const leftW   = state.camera.x - w / 2;
  const rightW  = state.camera.x + w / 2;
  const topW    = state.camera.y - h / 2;
  const bottomW = state.camera.y + h / 2;

  const minGX = Math.max(-s.halfCols, Math.floor(leftW  / t) - 1);
  const maxGX = Math.min( s.halfCols, Math.ceil (rightW / t) + 1);
  const minGY = Math.max(-s.halfRows, Math.floor(topW   / t) - 1);
  const maxGY = Math.min( s.halfRows, Math.ceil (bottomW/ t) + 1);

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = 'rgba(120, 60, 160, 0.5)';

  for (let gy = minGY; gy < maxGY; gy++) {
    for (let gx = minGX; gx < maxGX; gx++) {
      if (tileActive(s, gx, gy)) {
        const sx = gx * t - state.camera.x + cx;
        const sy = gy * t - state.camera.y + cy;
        ctx.fillRect(sx, sy, t, t);
      }
    }
  }
  ctx.restore();
}

export function clearWithBeam(state, cx, cy) {
  const s = state.miasma;
  const b = state.beam;
  if (!s || !b || b.mode === 'none') return;

  const t = s.tile;
  const playerWX = state.camera.x;
  const playerWY = state.camera.y;
  const maxR2 = (b.range + t) ** 2;
  const now = state.time;

  function angleDiff(a, b) {
    let d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  const minGX = Math.floor((playerWX - b.range) / t);
  const maxGX = Math.ceil ((playerWX + b.range) / t);
  const minGY = Math.floor((playerWY - b.range) / t);
  const maxGY = Math.ceil ((playerWY + b.range) / t);

  for (let gy = minGY; gy <= maxGY; gy++) {
    if (gy < -s.halfRows || gy >= s.halfRows) continue;
    for (let gx = minGX; gx <= maxGX; gx++) {
      if (gx < -s.halfCols || gx >= s.halfCols) continue;

      const wx = gx * t + t / 2;
      const wy = gy * t + t / 2;
      const dx = wx - playerWX, dy = wy - playerWY;
      if (dx * dx + dy * dy > maxR2) continue;

      if (b.mode === 'bubble') {
        setCleared(s, gx, gy, now);
        continue;
      }
      if (Math.abs(angleDiff(Math.atan2(dy, dx), b.angle)) <= b.halfArc) {
        setCleared(s, gx, gy, now);
      }
    }
  }
}

// ---- Internals ----
function regrowStep(state) {
  const s = state.miasma, now = state.time;
  const cols = s.halfCols * 2, rows = s.halfRows * 2;
  const next = s.strength.slice();

  for (let gy = -s.halfRows; gy < s.halfRows; gy++) {
    for (let gx = -s.halfCols; gx < s.halfCols; gx++) {
      const i = idx(s, gx, gy);
      if (s.strength[i] === 1) continue;
      if ((now - s.lastCleared[i]) < s.regrowDelay) continue;

      // count adjacent miasma
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

function tileActive(s, gx, gy) {
  return s.strength[idx(s, gx, gy)] === 1;
}
function setCleared(s, gx, gy, now) {
  const i = idx(s, gx, gy);
  s.strength[i] = 0;
  s.lastCleared[i] = now;
}
function idx(s, gx, gy) {
  const x = gx + s.halfCols;
  const y = gy + s.halfRows;
  return y * (s.halfCols * 2) + x;
}
