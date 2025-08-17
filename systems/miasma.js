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
 * @property {number} accX
 * @property {number} accY
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

  const m = {
    tile: cfg.tile,
    cols,
    rows,
    stride: cols,
    size,
    tiles,
    spawnProb: cfg.spawnProb,
    bufferCols: cfg.bufferCols,
    bufferRows: cfg.bufferRows,
    offsetX: 0,
    offsetY: 0,
    accX: 0,
    accY: 0
  };

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
    accX: 0,
    accY: 0,
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
  m.accX += Math.cos(wind.direction) * move;
  m.accY += Math.sin(wind.direction) * move;

  // shift whole tiles
  while (m.accX >= m.tile) { shift(m, -1, 0); m.accX -= m.tile; }
  while (m.accX <= -m.tile) { shift(m, +1, 0); m.accX += m.tile; }
  while (m.accY >= m.tile) { shift(m, 0, -1); m.accY -= m.tile; }
  while (m.accY <= -m.tile) { shift(m, 0, +1); m.accY += m.tile; }
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
}

/**
 * Draw miasma.
 */
export function drawMiasma(ctx, m, cam, cx, cy, w, h) {
  ctx.fillStyle = "rgba(80,40,120,0.4)";

  // Center the grid at world (0,0) to match worldToIdx
  const originX = -Math.floor(m.cols / 2) * m.tile;
  const originY = -Math.floor(m.rows / 2) * m.tile;

  for (let y = 0; y < m.rows; y++) {
    const wy = originY + y * m.tile - cam.y + cy;
    for (let x = 0; x < m.cols; x++) {
      if (m.tiles[y * m.cols + x] !== 1) continue;
      const wx = originX + x * m.tile - cam.x + cx;
      ctx.fillRect(wx, wy, m.tile, m.tile);
    }
  }
}


export function worldToIdx(m, wx, wy) {
  const cx = Math.floor(m.cols / 2);
  const cy = Math.floor(m.rows / 2);

  const x = Math.floor(wx / m.tile) + cx;
  const y = Math.floor(wy / m.tile) + cy;

  if (x < 0 || x >= m.cols || y < 0 || y >= m.rows) return -1;
  return y * m.cols + x;
}


export function isFog(m, idx) {
  if (idx < 0 || idx >= m.size) return false;
  return m.tiles[idx] === 1;
}


export function clearWithBeam(m, beam, camera, time, cx, cy) {
  // No-op for now — real clearing comes in Step 4
}
