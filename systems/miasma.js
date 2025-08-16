// systems/miasma.js
// Stable fog pattern generated once, then drifted with wind offsets.
// Beam clears are permanent and tied to pattern space.

function generateBands(s) {
  const cycle = s.bandSpacing + s.bandThickness;
  for (let row = 0; row < s.rows; row++) {
    const band = (row % cycle) < s.bandThickness;
    for (let col = 0; col < s.cols; col++) {
      s.pattern[row * s.cols + col] = band ? 1 : 0;
    }
  }
}

export function initMiasma(state, opts = {}) {
  const cols = opts.cols ?? 200;
  const rows = opts.rows ?? 200;
  const tile = opts.tile ?? 16;
  const halfCols = Math.floor(cols / 2);
  const halfRows = Math.floor(rows / 2);
  const size = cols * rows;

  const m = {
    cols, rows, tile, halfCols, halfRows, size,
    pattern: new Uint8Array(size).fill(0), // stable base pattern
    grid:    new Uint8Array(size).fill(0), // visible grid after drift + clears
    cleared: new Uint8Array(size).fill(0), // permanent clears (pattern space)

    dps: opts.dps ?? 35,

    // drift offsets (tiles)
    offsetX: 0,
    offsetY: 0,
    fracX: 0,
    fracY: 0,

    viewW: 0,
    viewH: 0,

    bandThickness: opts.bandThickness ?? 24,
    bandSpacing:   opts.bandSpacing ?? 60,

    // wind speed (tiles per sec)
    wind: {
      x: opts.windX ?? 0,
      y: opts.windY ?? (opts.scrollSpeed ?? 10),
    },
  };

  // generate stable band pattern
  generateBands(m);

  state.miasma = m;

  // initialize grid
  updateMiasma(state, 0);
}

export function updateMiasma(state, dt) {
  const s = state.miasma; if (!s) return;

  // advance offsets by wind
  s.offsetX += s.wind.x * dt;
  s.offsetY += s.wind.y * dt;

  const offCol = Math.floor(s.offsetX);
  const offRow = Math.floor(s.offsetY);
  s.fracX = s.offsetX - offCol;
  s.fracY = s.offsetY - offRow;

  const cols = s.cols;
  const rows = s.rows;
  const modCol = ((offCol % cols) + cols) % cols;
  const modRow = ((offRow % rows) + rows) % rows;

  // sample pattern into grid, respecting clears
  for (let row = 0; row < rows; row++) {
    const prow = (row + modRow) % rows;
    for (let col = 0; col < cols; col++) {
      const worldIdx = row * cols + col;
      const pcol = (col + modCol) % cols;
      const patIdx = prow * cols + pcol;

      if (s.cleared[patIdx]) {
        s.grid[worldIdx] = 0; // permanently cleared
      } else {
        s.grid[worldIdx] = s.pattern[patIdx];
      }
    }
  }
}

export function drawMiasma(state, ctx) {
  const s = state.miasma; if (!s) return;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const cx = w / 2, cy = h / 2;
  s.viewW = w;
  s.viewH = h;

  const shiftX = s.fracX * s.tile;
  const shiftY = s.fracY * s.tile;

  ctx.save();
  ctx.fillStyle = "rgba(120,60,160,0.9)";

  for (let row = 0; row < s.rows; row++) {
    for (let col = 0; col < s.cols; col++) {
      const idx = row * s.cols + col;
      if (s.grid[idx] === 0) continue;

      const wx = (col - s.halfCols) * s.tile - state.camera.x + cx - shiftX;
      const wy = (row - s.halfRows) * s.tile - state.camera.y + cy - shiftY;

      ctx.fillRect(wx, wy, s.tile, s.tile);
    }
  }

  ctx.restore();
}

// --- Beam clearing: permanent clears stored in pattern space ---------------
export function clearWithBeam(state, poly) {
  const s = state.miasma;
  if (!s || !poly || poly.length < 3) return;

  const cx = (s.viewW ?? 0) / 2;
  const cy = (s.viewH ?? 0) / 2;

  const offCol = Math.floor(s.offsetX);
  const offRow = Math.floor(s.offsetY);
  const modCol = ((offCol % s.cols) + s.cols) % s.cols;
  const modRow = ((offRow % s.rows) + s.rows) % s.rows;

  for (let row = 0; row < s.rows; row++) {
    for (let col = 0; col < s.cols; col++) {
      const worldIdx = row * s.cols + col;
      if (s.grid[worldIdx] === 0) continue;

      const wx = (col - s.halfCols + 0.5) * s.tile - state.camera.x + cx - s.fracX * s.tile;
      const wy = (row - s.halfRows + 0.5) * s.tile - state.camera.y + cy - s.fracY * s.tile;

      if (pointInPolygon(wx, wy, poly)) {
        // map world cell -> pattern cell
        const prow = (row + modRow) % s.rows;
        const pcol = (col + modCol) % s.cols;
        const patIdx = prow * s.cols + pcol;

        s.cleared[patIdx] = 1;   // permanent clear
        s.grid[worldIdx] = 0;    // immediate feedback
      }
    }
  }
}

// --- Point-in-polygon test -------------------------------------------------
function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / ((yj - yi) + 0.00001) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// --- Helpers ---------------------------------------------------------------
export function worldToIdx(miasma, wx, wy) {
  const col = Math.floor(wx / miasma.tile + miasma.fracX) + miasma.halfCols;
  const row = Math.floor(wy / miasma.tile + miasma.fracY) + miasma.halfRows;
  if (col < 0 || col >= miasma.cols || row < 0 || row >= miasma.rows) return -1;
  return row * miasma.cols + col;
}

export function isFog(miasma, idx) {
  if (idx < 0 || idx >= miasma.size) return false;
  return miasma.grid[idx] === 1;
}

export function isDenseFogAt(state, x, y) {
  const idx = worldToIdx(state.miasma, x, y);
  return isFog(state.miasma, idx);
}
