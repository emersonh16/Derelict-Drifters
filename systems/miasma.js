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
  ctx.fillStyle = "rgba(80,40,120,0.4)";

  const t = m.tile;
  const cxTiles = Math.floor(m.cols / 2);
  const cyTiles = Math.floor(m.rows / 2);

  // use sub-tile remainder for smooth motion
   const originX = -cxTiles * t + m.offsetX;
  const originY = -cyTiles * t + m.offsetY;

  for (let y = 0; y < m.rows; y++) {
      const wy = originY + y * m.tile - cam.y + cy;
    for (let x = 0; x < m.cols; x++) {
      if (m.tiles[y * m.cols + x] !== 1) continue;
       const wx = originX + x * m.tile - cam.x + cx;
      ctx.fillRect(wx, wy, t, t);
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


// Clear tiles intersecting the beam shape.
// Origin is the player's world position (camera center).
export function clearWithBeam(m, beamState, camera, time, cx, cy) {
  // Read beam params we need
  const mode     = beamState.mode;        // "bubble" | "cone" | "laser"
  const angle    = beamState.angle;       // radians
  const halfArc  = beamState.halfArc;     // radians
  const maxRange = mode === "bubble" ? (beamState.radius || 0) : (beamState.range || 0);
  if (!maxRange || maxRange <= 0) return;

  // World origin (player)
  const wx0 = camera.x;
  const wy0 = camera.y;

  // Center tile (grid is centered at world 0,0)
  const cxTiles = Math.floor(m.cols / 2);
  const cyTiles = Math.floor(m.rows / 2);

  // Tile index of the player's world position
  const ix0 = Math.floor(wx0 / m.tile) + cxTiles;
  const iy0 = Math.floor(wy0 / m.tile) + cyTiles;

  // Range in tiles
  const rTiles = Math.ceil(maxRange / m.tile);

  // World-space origin of the grid (to compute tile centers)
  const originX = -cxTiles * m.tile;
  const originY = -cyTiles * m.tile;

  // Helper: smallest signed angle difference (-PI..PI)
  const angDiff = (a, b) => {
    let d = a - b;
    while (d >  Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return Math.abs(d);
  };

  const cols = m.cols, rows = m.rows, tiles = m.tiles, t = m.tile;

  // Scan only the local bounding box around the player
  const minY = Math.max(0, iy0 - rTiles);
  const maxY = Math.min(rows - 1, iy0 + rTiles);
  const minX = Math.max(0, ix0 - rTiles);
  const maxX = Math.min(cols - 1, ix0 + rTiles);

  for (let iy = minY; iy <= maxY; iy++) {
    // y center of this tile in world coords
    const wy = originY + iy * t + t * 0.5;
    const dy = wy - wy0;

    for (let ix = minX; ix <= maxX; ix++) {
      const idx = iy * cols + ix;
      if (tiles[idx] === 0) continue; // already clear

      // x center of this tile in world coords
      const wx = originX + ix * t + t * 0.5;
      const dx = wx - wx0;

      const dist = Math.hypot(dx, dy);
      if (dist > maxRange) continue; // outside reach

      if (mode === "bubble") {
        // simple circle
        tiles[idx] = 0;
        continue;
      }

      // cone/laser: also require angle within halfArc
      const a = Math.atan2(dy, dx);
      if (angDiff(a, angle) <= halfArc) {
        tiles[idx] = 0;
      }
    }
  }
}