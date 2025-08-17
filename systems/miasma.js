// systems/miasma.js
/**
 * Conveyor-belt style miasma grid.
 * Tiles drift with wind; cleared tiles remain cleared.
 */

/**
 * @typedef {Object} MiasmaState
 * @property {number} tile
 * @property {number} cols
 * @property {number} rows
 * @property {number} stride
 * @property {number} size
 * @property {Uint8Array} tiles
 * @property {number} spawnProb
 * @property {number} bufferCols
 * @property {number} bufferRows
 * @property {number} offsetX
 * @property {number} offsetY
 */

/**
 * Initialize miasma grid.
 * @param {import("../core/config.js").config["dynamicMiasma"]} cfg
 * @returns {MiasmaState}
 */
export function initMiasma(cfg) {
  const cols = cfg.cols + cfg.bufferCols * 2;
  const rows = cfg.rows + cfg.bufferRows * 2;
  const size = cols * rows;

  const tiles = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    tiles[i] = Math.random() < cfg.spawnProb ? 1 : 0;
  }


  // --- force clear a safe zone at center ---
  const safeR = 10; // radius in tiles
  const cx = Math.floor(cols / 2);
  const cy = Math.floor(rows / 2);
  for (let dy = -safeR; dy <= safeR; dy++) {
    for (let dx = -safeR; dx <= safeR; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || x >= cols || y < 0 || y >= rows) continue;
      const idx = y * cols + x;
      tiles[idx] = 0; // clear
    }
  }

  // DEBUG: ensure there's plenty of fog to see (comment out later)
let fogCount = 0;
for (let i = 0; i < tiles.length; i++) {
  // make ~70% of tiles fog so it's obvious
  tiles[i] = Math.random() < 0.7 ? 1 : 0;
  if (tiles[i] === 1) fogCount++;
}
console.log("[miasma] debug spawn → fog tiles:", fogCount, "of", tiles.length);


    return {
    tile: cfg.tile,
    cols,
    rows,
    halfCols: Math.floor(cols / 2),
    halfRows: Math.floor(rows / 2),
    stride: cols,
    size,
    tiles,
    spawnProb: cfg.spawnProb,
    bufferCols: cfg.bufferCols,
    bufferRows: cfg.bufferRows,
    offsetX: 0,
    offsetY: 0,
    dps: 35
  };
}



/**
 * Update conveyor drift.
 * @param {MiasmaState} m
 * @param {import("./wind.js").WindState} wind
 * @param {number} dt
 */
export function updateMiasma(m, wind, dt) {
  // accumulate displacement
  const move = wind.speed * dt;
  m.offsetX += Math.cos(wind.direction) * move;
  m.offsetY += Math.sin(wind.direction) * move;

  // shift whole tiles
 while (m.offsetX >= m.tile) { shift(m, -1, 0); }
  while (m.offsetX <= -m.tile) { shift(m, +1, 0); }
  while (m.offsetY >= m.tile) { shift(m, 0, -1); }
  while (m.offsetY <= -m.tile) { shift(m, 0, +1); }
}

/**
 * Shift the grid and respawn on upwind edge.
 */
function shift(m, dx, dy) {
  const { cols, rows, tiles, spawnProb } = m;
  if (dx) {
    // column shift
    for (let y = 0; y < rows; y++) {
      if (dx > 0) {
        // shift right → fill left col
        for (let x = cols - 1; x > 0; x--) {
          tiles[y * cols + x] = tiles[y * cols + x - 1];
        }
        tiles[y * cols] = Math.random() < spawnProb ? 1 : 0;
      } else {
        // shift left → fill right col
        for (let x = 0; x < cols - 1; x++) {
          tiles[y * cols + x] = tiles[y * cols + x + 1];
        }
        tiles[y * cols + (cols - 1)] = Math.random() < spawnProb ? 1 : 0;
      }
    }
  }
  if (dy) {
    // row shift
    if (dy > 0) {
      // shift down → fill top row
      for (let y = rows - 1; y > 0; y--) {
        for (let x = 0; x < cols; x++) {
          tiles[y * cols + x] = tiles[(y - 1) * cols + x];
        }
      }
      for (let x = 0; x < cols; x++) {
        tiles[x] = Math.random() < spawnProb ? 1 : 0;
      }
    } else {
      // shift up → fill bottom row
      for (let y = 0; y < rows - 1; y++) {
        for (let x = 0; x < cols; x++) {
          tiles[y * cols + x] = tiles[(y + 1) * cols + x];
        }
      }
      for (let x = 0; x < cols; x++) {
        tiles[(rows - 1) * cols + x] = Math.random() < spawnProb ? 1 : 0;
      }
    }
  }
  m.offsetX += dx * m.tile;
  m.offsetY += dy * m.tile;
}

/**
 * Draw miasma.
 */
export function drawMiasma(ctx, m, cam, cx, cy, w, h) {
  // Solid color while testing; switch back to rgba(...,0.4) later if you want
  ctx.fillStyle = "rgba(180,120,255,1.0)";

  const t = m.tile;
  const cxTiles = Math.floor(m.cols / 2);
  const cyTiles = Math.floor(m.rows / 2);

  // Use the SAME quantized sub-tile remainder everywhere
  const subX = ((m.offsetX % t) + t) % t;
  const subY = ((m.offsetY % t) + t) % t;
  const ox = Math.round(subX);
  const oy = Math.round(subY);

  const originX = -cxTiles * t + ox;
  const originY = -cyTiles * t + oy;

  for (let y = 0; y < m.rows; y++) {
    const wy = ((originY + y * t - cam.y + cy) | 0);  // integer pixel
    for (let x = 0; x < m.cols; x++) {
      if (m.tiles[y * m.cols + x] !== 1) continue;
      const wx = ((originX + x * t - cam.x + cx) | 0); // integer pixel
      ctx.fillRect(wx, wy, t, t);
    }
  }
}





export function worldToIdx(m, wx, wy) {
  const t = m.tile;
  const cxTiles = Math.floor(m.cols / 2);
  const cyTiles = Math.floor(m.rows / 2);

  const subX = ((m.offsetX % t) + t) % t;
  const subY = ((m.offsetY % t) + t) % t;
  const ox = Math.round(subX);
  const oy = Math.round(subY);

  const originX = -cxTiles * t + ox;
  const originY = -cyTiles * t + oy;

  const x = Math.floor((wx - originX) / t);
  const y = Math.floor((wy - originY) / t);

  if (x < 0 || x >= m.cols || y < 0 || y >= m.rows) return -1;
  return y * m.cols + x;
}



export function isFog(m, idx) {
  if (idx < 0 || idx >= m.size) return false;
  return m.tiles[idx] === 1;
}


// Clear tiles intersecting the beam shape.
// Origin is the player's world position (camera center).
export function clearWithBeam(m, beamState, camera, time, cx, cy) {
  // --- Read beam params we need ---
  const mode     = beamState.mode;        // "bubble" | "cone" | "laser"
  const angle    = beamState.angle;       // radians
  const halfArc  = beamState.halfArc;     // radians
  const maxRange = mode === "bubble" ? (beamState.radius || 0) : (beamState.range || 0);
  if (!maxRange || maxRange <= 0) return;

  // --- Player world position (beam origin) ---
  const wx0 = camera.x;
  const wy0 = camera.y;

  // --- Grid basics ---
  const t = m.tile;
  const cols = m.cols;
  const rows = m.rows;
  const cxTiles = Math.floor(cols / 2);
  const cyTiles = Math.floor(rows / 2);

  // --- Use the SAME quantized origin as draw() to avoid mismatch/jitter ---
  const subX = ((m.offsetX % t) + t) % t;
  const subY = ((m.offsetY % t) + t) % t;
  const ox = Math.round(subX);
  const oy = Math.round(subY);
  const originX = -cxTiles * t + ox;   // world-space of grid (0,0) tile
  const originY = -cyTiles * t + oy;

  // --- Convert player to tile coords and bound scan to a small box ---
  const ix0 = Math.floor((wx0 - originX) / t);
  const iy0 = Math.floor((wy0 - originY) / t);
  const rTiles = Math.ceil(maxRange / t) + 1;

  const minY = Math.max(0, iy0 - rTiles);
  const maxY = Math.min(rows - 1, iy0 + rTiles);
  const minX = Math.max(0, ix0 - rTiles);
  const maxX = Math.min(cols - 1, ix0 + rTiles);

  // Small helper: smallest signed angle difference (-PI..PI), absolute value
  const angDiff = (a, b) => {
    let d = a - b;
    while (d >  Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return Math.abs(d);
  };

  // --- Scan local tiles and clear those inside the beam shape ---
  for (let iy = minY; iy <= maxY; iy++) {
    const wy = originY + iy * t + t * 0.5;       // tile center (world y)
    const dy = wy - wy0;

    for (let ix = minX; ix <= maxX; ix++) {
      const idx = iy * cols + ix;
      if (m.tiles[idx] === 0) continue;          // already clear

      const wx = originX + ix * t + t * 0.5;     // tile center (world x)
      const dx = wx - wx0;

      const dist = Math.hypot(dx, dy);
      if (dist > maxRange) continue;             // outside beam length

      if (mode === "bubble") {
        // Circle around player
        m.tiles[idx] = 0;
        continue;
      }

      // Cone / Laser: must also be within angular arc
      const a = Math.atan2(dy, dx);
      if (angDiff(a, angle) <= halfArc) {
        m.tiles[idx] = 0;
      }
    }
  }
}
