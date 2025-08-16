// systems/miasma.js
// Binary fog grid with moving line/band patterns.


export function initMiasma(state, opts = {}) {
  const cols = opts.cols ?? 200;
  const rows = opts.rows ?? 200;
  const tile = opts.tile ?? 16;
  const halfCols = Math.floor(cols / 2);
  const halfRows = Math.floor(rows / 2);
  const size = cols * rows;

  // Start all clear
  const grid = new Uint8Array(size).fill(0);

  state.miasma = {
    cols, rows, tile, halfCols, halfRows, size,
    grid,

    dps: opts.dps ?? 35,

    // movement
    scrollSpeed: opts.scrollSpeed ?? 10, // tiles per second
    offset: 0,

    viewW: 0,
    viewH: 0,

    // line config
    bandThickness: opts.bandThickness ?? 8, // in rows
    bandSpacing: opts.bandSpacing ?? 20,    // gap between bands

    // --- NEW: beam clears persist ---
    clearDuration: opts.clearDuration ?? 1.2,   // seconds to stay clear
    clearTTL: new Float32Array(size).fill(0),   // per-tile timer
  };
}


export function updateMiasma(state, dt) {
  const s = state.miasma; if (!s) return;

  // advance scroll offset
  s.offset += s.scrollSpeed * dt;
  if (s.offset >= s.bandSpacing + s.bandThickness) {
    s.offset = 0;
  }

  // regenerate grid with moving bands
  for (let row = 0; row < s.rows; row++) {
    for (let col = 0; col < s.cols; col++) {
      const idx = row * s.cols + col;

        // decay any previous clears
      if (s.clearTTL[idx] > 0) {
        s.clearTTL[idx] = Math.max(0, s.clearTTL[idx] - dt);
      }

      // Create horizontal bands moving downward
      const bandPos = (row + Math.floor(s.offset)) % (s.bandSpacing + s.bandThickness);
      const bandActive = bandPos < s.bandThickness;

      // only fog if band is active AND not recently cleared
      s.grid[idx] = (bandActive && s.clearTTL[idx] <= 0) ? 1 : 0;

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

  ctx.save();
  ctx.fillStyle = "rgba(120,60,160,0.9)"; // solid purple fog

  for (let row = 0; row < s.rows; row++) {
    for (let col = 0; col < s.cols; col++) {
      const idx = row * s.cols + col;
      if (s.grid[idx] === 0) continue;

      const wx = (col - s.halfCols) * s.tile - state.camera.x + cx;
      const wy = (row - s.halfRows) * s.tile - state.camera.y + cy;

      ctx.fillRect(wx, wy, s.tile, s.tile);
    }
  }

  ctx.restore();
}

// ---- Beam clearing still works (overrides bands locally) ----
// ---- Beam clearing works with beam geometry from getBeamGeom(state, cx, cy)
export function clearWithBeam(state, geom) {
  const s = state.miasma;
  if (!s || !geom) return;

  // beam geom is screen-space; normalize possible shapes
  const poly = normalizeBeamPolygon(geom);
  if (!poly || poly.length < 3) return;

  // need screen center to convert world->screen; drawMiasma stored it
  const cx = (s.viewW ?? 0) / 2;
  const cy = (s.viewH ?? 0) / 2;

  for (let row = 0; row < s.rows; row++) {
    for (let col = 0; col < s.cols; col++) {
      const idx = row * s.cols + col;
      if (s.grid[idx] === 0) continue;

      // world → screen (center of the tile)
      const wx = (col - s.halfCols + 0.5) * s.tile - state.camera.x + cx;
      const wy = (row - s.halfRows + 0.5) * s.tile - state.camera.y + cy;

        if (pointInPolygon(wx, wy, poly)) {
        s.clearTTL[idx] = s.clearDuration;  // keep clear for a while
        s.grid[idx] = 0;                    // clear immediately this frame
      }

    }
  }
}

// Accept several possible shapes of beam geometry and return an array of [x,y]
function normalizeBeamPolygon(geom) {
  // Already a polygon? (e.g., [[x,y], [x,y], ...])
  if (Array.isArray(geom) && geom.length && Array.isArray(geom[0])) {
    return geom;
  }
  // Common property names from beam helpers
  if (Array.isArray(geom?.polygon)) return geom.polygon;
  if (Array.isArray(geom?.poly)) return geom.poly;
  if (Array.isArray(geom?.points)) return geom.points;
  if (Array.isArray(geom?.pts)) return geom.pts;

  // Triangle or cone pieces?
  if (geom?.a && geom?.b && geom?.c) return [geom.a, geom.b, geom.c];
  if (geom?.p0 && geom?.p1 && geom?.p2) return [geom.p0, geom.p1, geom.p2];

  // Unknown shape -> no-op
  return null;
}


// standard point-in-polygon
function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi + 0.00001) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// ---- Helpers -------------------------------------------------------------
export function worldToIdx(miasma, wx, wy) {
  const col = Math.floor(wx / miasma.tile) + miasma.halfCols;
  const row = Math.floor(wy / miasma.tile) + miasma.halfRows;
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
