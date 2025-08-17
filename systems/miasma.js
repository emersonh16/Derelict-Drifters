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
      angle: 0,
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

  // NEW: lock visual rotation to wind
  m.angle = wind.direction;
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
  // Bright + solid while testing; switch back to translucent later if you want
  ctx.fillStyle = "rgba(180,120,255,1.0)";

  const t = m.tile;
  const cxTiles = Math.floor(m.cols / 2);
  const cyTiles = Math.floor(m.rows / 2);

  // Quantized sub-tile drift (no shimmer)
  const subX = ((m.offsetX % t) + t) % t;
  const subY = ((m.offsetY % t) + t) % t;
  const ox = Math.round(subX);
  const oy = Math.round(subY);

  // World origin of grid BEFORE rotation
  const originX = -cxTiles * t + ox;
  const originY = -cyTiles * t + oy;

  // Rotate around player (screen center)
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(m.angle);
  ctx.translate(-cx, -cy);

  for (let y = 0; y < m.rows; y++) {
    const wy = ((originY + y * t - cam.y + cy) | 0);  // integer pixel
    for (let x = 0; x < m.cols; x++) {
      if (m.tiles[y * m.cols + x] !== 1) continue;
      const wx = ((originX + x * t - cam.x + cx) | 0); // integer pixel
      ctx.fillRect(wx, wy, t, t);
    }
  }

  ctx.restore();
}





export function worldToIdx(m, wx, wy, camera) {
  const t = m.tile;
  const cols = m.cols, rows = m.rows;
  const cxTiles = Math.floor(cols / 2);
  const cyTiles = Math.floor(rows / 2);

  // Same quantized origin as draw
  const subX = ((m.offsetX % t) + t) % t;
  const subY = ((m.offsetY % t) + t) % t;
  const ox = Math.round(subX);
  const oy = Math.round(subY);
  const originX = -cxTiles * t + ox;
  const originY = -cyTiles * t + oy;

  // Inverse-rotate the world point around the player to grid space
  const a = -m.angle;
  const ca = Math.cos(a), sa = Math.sin(a);
  const px = camera.x, py = camera.y;       // rotate around player (camera center)
  const dx = wx - px, dy = wy - py;
  const gx = px + (dx * ca - dy * sa);
  const gy = py + (dx * sa + dy * ca);

  // Convert to tile coords
  const x = Math.floor((gx - originX) / t);
  const y = Math.floor((gy - originY) / t);

  if (x < 0 || x >= cols || y < 0 || y >= rows) return -1;
  return y * cols + x;
}




export function isFog(m, idx) {
  if (idx < 0 || idx >= m.size) return false;
  return m.tiles[idx] === 1;
}


// Clear tiles intersecting the beam shape.
// Origin is the player's world position (camera center).
export function clearWithBeam(m, beamState, camera, time, cx, cy) {
  const mode     = beamState.mode;                    // "bubble" | "cone" | "laser"
  const angleW   = beamState.angle;                   // world angle (radians)
  const halfArc  = beamState.halfArc;
  const maxRange = mode === "bubble" ? (beamState.radius || 0) : (beamState.range || 0);
  if (!maxRange || maxRange <= 0) return;

  // Grid + origin (same as draw)
  const t = m.tile, cols = m.cols, rows = m.rows;
  const cxTiles = Math.floor(cols / 2), cyTiles = Math.floor(rows / 2);
  const subX = ((m.offsetX % t) + t) % t, subY = ((m.offsetY % t) + t) % t;
  const ox = Math.round(subX), oy = Math.round(subY);
  const originX = -cxTiles * t + ox;
  const originY = -cyTiles * t + oy;

  // Player in world
  const px = camera.x, py = camera.y;

  // Work in grid space: inverse-rotate the beam and vectors
  const aInv = -m.angle;
  const ca = Math.cos(aInv), sa = Math.sin(aInv);
  const angleGrid = angleW + aInv; // rotate beam angle into grid space

  // Player tile
  const ix0 = Math.floor((px - originX) / t);
  const iy0 = Math.floor((py - originY) / t);
  const rTiles = Math.ceil(maxRange / t) + 1;

  const minY = Math.max(0, iy0 - rTiles);
  const maxY = Math.min(rows - 1, iy0 + rTiles);
  const minX = Math.max(0, ix0 - rTiles);
  const maxX = Math.min(cols - 1, ix0 + rTiles);

  const angDiff = (a, b) => {
    let d = a - b;
    while (d >  Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return Math.abs(d);
  };

  for (let iy = minY; iy <= maxY; iy++) {
    const wy = originY + iy * t + t * 0.5;
    for (let ix = minX; ix <= maxX; ix++) {
      const idx = iy * cols + ix;
      if (m.tiles[idx] === 0) continue;

      const wx = originX + ix * t + t * 0.5;

      // Vector from player to tile center in WORLD...
      const dxW = wx - px, dyW = wy - py;
      // ...then inverse-rotate into GRID space
      const gx = dxW * ca - dyW * sa;
      const gy = dxW * sa + dyW * ca;

      const dist = Math.hypot(gx, gy);
      if (dist > maxRange) continue;

      if (mode === "bubble") {
        m.tiles[idx] = 0;
        continue;
      }

      const aTile = Math.atan2(gy, gx);
      if (angDiff(aTile, angleGrid) <= halfArc) {
        m.tiles[idx] = 0;
      }
    }
  }
}
