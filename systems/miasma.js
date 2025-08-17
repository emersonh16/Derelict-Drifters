// systems/miasma.js
// Wind-driven conveyor belt miasma layer.

/** @typedef {import('../core/state.js').MiasmaState} MiasmaState */
/** @typedef {import('../core/state.js').BeamState} BeamState */
/** @typedef {import('../core/state.js').WindState} WindState */

export function initMiasma(opts = {}) {
  const tile = opts.tile ?? 14;
  const halfCols = Math.floor((opts.cols ?? 200) / 2);
  const halfRows = Math.floor((opts.rows ?? 200) / 2);
  const cols = halfCols * 2;
  const rows = halfRows * 2;
  const size = cols * rows;

  /** @type {MiasmaState} */
  const s = {
    tile,
    halfCols,
    halfRows,
    cols,
    rows,
    stride: cols,
    size,
    tiles: new Uint8Array(size).fill(1),
    spawnProb: opts.spawnProb ?? 0.5,
    spawnJitter: opts.spawnJitter ?? 0.1,
    bufferCols: opts.bufferCols ?? 0,
    bufferRows: opts.bufferRows ?? 0,
    dps: opts.dps ?? 35,
    _accumX: 0,
    _accumY: 0,
  };
  return s;
}

export function updateMiasma(s, wind, dt) {
  if (!s || !wind) return;
  const move = wind.speed * dt;
  const dx = move * Math.cos(wind.direction);
  const dy = move * Math.sin(wind.direction);
  s._accumX += dx;
  s._accumY += dy;

  while (s._accumX >= 1) { shiftX(s, 1); s._accumX -= 1; }
  while (s._accumX <= -1) { shiftX(s, -1); s._accumX += 1; }
  while (s._accumY >= 1) { shiftY(s, 1); s._accumY -= 1; }
  while (s._accumY <= -1) { shiftY(s, -1); s._accumY += 1; }
}

export function drawMiasma(ctx, s, camera, cx, cy, w, h) {
  if (!s) return;
  const t = s.tile;
  const leftW = camera.x - w / 2;
  const rightW = camera.x + w / 2;
  const topW = camera.y - h / 2;
  const bottomW = camera.y + h / 2;
  const minGX = Math.max(-s.halfCols, Math.floor(leftW / t) - 1);
  const maxGX = Math.min( s.halfCols, Math.ceil(rightW / t) + 1);
  const minGY = Math.max(-s.halfRows, Math.floor(topW / t) - 1);
  const maxGY = Math.min( s.halfRows, Math.ceil(bottomW / t) + 1);

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = 'rgba(120, 60, 160, 0.50)';
  ctx.beginPath();

  let sy = Math.floor(minGY * t - camera.y + cy);
  for (let gy = minGY; gy < maxGY; gy++, sy += t) {
    let sx = Math.floor(minGX * t - camera.x + cx);
    for (let gx = minGX; gx < maxGX; gx++, sx += t) {
      if (s.tiles[idx(s, gx, gy)] === 1) {
        ctx.rect(sx, sy, t, t);
      }
    }
  }
  ctx.fill();
  ctx.restore();
}

export function clearWithBeam(s, b, camera, cx, cy) {
  if (!s || !b || b.mode === 'none') return;
  const t = s.tile;
  const playerWX = camera.x;
  const playerWY = camera.y;

  if (b.mode === 'laser') {
    const core = b.laserCoreWidth ?? 8;
    const halo = core * (b.laserOutlineMult ?? 2.0);
    const thickness = Math.max(t, core + halo);
    const fan = Math.max(1, b.laserFanCount | 0);
    const dAng = Math.max(toRad(b.laserFanMinDeg ?? 0.25), b.halfArc * 0.5);
    const start = b.angle - dAng * ((fan - 1) * 0.5);
    for (let i = 0; i < fan; i++) {
      const ang = start + i * dAng;
      rayStampWorld(s, playerWX, playerWY, ang, b.range + t, thickness);
    }
    return;
  }

  const maxR2 = (b.range + t) ** 2;
  const minGX = Math.floor((playerWX - b.range) / t);
  const maxGX = Math.ceil((playerWX + b.range) / t);
  const minGY = Math.floor((playerWY - b.range) / t);
  const maxGY = Math.ceil((playerWY + b.range) / t);
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
      if (b.mode === 'bubble') { setClear(s, gx, gy); continue; }
      const inv = r2 > 0 ? 1 / Math.sqrt(r2) : 0;
      const dot = (dx * inv) * bx + (dy * inv) * by;
      if (dot >= cosThresh) setClear(s, gx, gy);
    }
  }
}

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
      const cyW = gy * t + t * 0.5;
      for (let gx = Math.max(minGX, -s.halfCols); gx <= Math.min(maxGX, s.halfCols - 1); gx++) {
        const cxW = gx * t + t * 0.5;
        const dx = cxW - pxW, dy = cyW - pyW;
        if (dx*dx + dy*dy <= r2) setClear(s, gx, gy);
      }
    }
  }
}

function shiftX(s, dir) {
  const cols = s.cols, rows = s.rows, stride = s.stride;
  const spawn = () => spawnVal(s);
  if (dir > 0) { // move east
    for (let row = 0; row < rows; row++) {
      const off = row * stride;
      for (let col = cols - 1; col > 0; col--) {
        s.tiles[off + col] = s.tiles[off + col - 1];
      }
      s.tiles[off] = spawn();
    }
  } else { // move west
    for (let row = 0; row < rows; row++) {
      const off = row * stride;
      for (let col = 0; col < cols - 1; col++) {
        s.tiles[off + col] = s.tiles[off + col + 1];
      }
      s.tiles[off + cols - 1] = spawn();
    }
  }
}

function shiftY(s, dir) {
  const cols = s.cols, rows = s.rows;
  const spawn = () => spawnVal(s);
  if (dir > 0) { // move south
    for (let row = rows - 1; row > 0; row--) {
      for (let col = 0; col < cols; col++) {
        s.tiles[row * cols + col] = s.tiles[(row - 1) * cols + col];
      }
    }
    for (let col = 0; col < cols; col++) s.tiles[col] = spawn();
  } else { // move north
    for (let row = 0; row < rows - 1; row++) {
      for (let col = 0; col < cols; col++) {
        s.tiles[row * cols + col] = s.tiles[(row + 1) * cols + col];
      }
    }
    for (let col = 0; col < cols; col++) s.tiles[(rows - 1) * cols + col] = spawn();
  }
}

function spawnVal(s) {
  const jitter = 1 + (Math.random() * 2 - 1) * (s.spawnJitter ?? 0);
  return Math.random() < s.spawnProb * jitter ? 1 : 0;
}

function idx(s, gx, gy) {
  const x = gx + s.halfCols;
  const y = gy + s.halfRows;
  return y * s.stride + x;
}

function setClear(s, gx, gy) {
  const i = idx(s, gx, gy);
  s.tiles[i] = 0;
}

export function worldToIdx(s, wx, wy) {
  if (!s) return -1;
  const gx = Math.floor(wx / s.tile);
  const gy = Math.floor(wy / s.tile);
  if (gx < -s.halfCols || gx >= s.halfCols || gy < -s.halfRows || gy >= s.halfRows) return -1;
  return idx(s, gx, gy);
}

export function isFog(s, i) {
  return i < 0 ? true : s.tiles[i] === 1;
}

function toRad(deg){ return (deg * Math.PI)/180; }

export {}; // module
