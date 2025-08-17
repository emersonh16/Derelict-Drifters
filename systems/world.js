// systems/world.js
/** @typedef {import('../core/state.js').MiasmaState} MiasmaState */
/** @typedef {import('../core/state.js').WorldState} WorldState */

export function initWorld(miasma, player, opts = {}) {
  const t = miasma.tile;

  /** @type {WorldState} */
  const world = {
    minX: -miasma.halfCols * t,
    maxX:  miasma.halfCols * t,
    minY: -miasma.halfRows * t,
    maxY:  miasma.halfRows * t,
    borderThickness: opts.borderThickness ?? 80,
    borderColor: opts.borderColor ?? 'rgba(120, 60, 160, 0.7)'
  };

  const obstacleGrid = new Uint8Array(miasma.size).fill(0);

  // Generate irregular rock formations
  generateObstacles(miasma, obstacleGrid, opts.seedCount ?? 30, opts.growthSteps ?? 700, opts.spawnSafeTiles);

  // Ensure the spawn area is absolutely clear (in tiles)
  const playerR = player?.r ?? 18;
  const tilesRadius = opts?.spawnSafeTiles ?? Math.max(6, Math.ceil(playerR / t) + 3);
  clearSpawnArea(miasma, obstacleGrid, tilesRadius);

  return { world, obstacleGrid };
}

// Random-walk growth algorithm for wonky rock shapes
function generateObstacles(miasma, grid, seedCount = 20, growthSteps = 150, spawnSafeOverride) {
  const cols = miasma.cols;
  const rows = miasma.rows;

  const centerCol = Math.floor(cols / 2);
  const centerRow = Math.floor(rows / 2);

  // spawn-safe radius in tiles
  const spawnSafeRadius =
    typeof spawnSafeOverride === 'number' ? spawnSafeOverride : 8;

  for (let i = 0; i < seedCount; i++) {
    let col = Math.floor(Math.random() * cols);
    let row = Math.floor(Math.random() * rows);

    // Skip if starting inside spawn-safe zone
    if (Math.hypot(col - centerCol, row - centerRow) <= spawnSafeRadius) continue;

    for (let step = 0; step < growthSteps; step++) {
      // Mark tile as rock (skip if in spawn-safe zone)
      const idx = row * cols + col;
      const dc = col - centerCol, dr = row - centerRow;
      if (dc * dc + dr * dr > spawnSafeRadius * spawnSafeRadius) {
        grid[idx] = 1;
      }

      // Move in a random cardinal direction
      const dir = Math.floor(Math.random() * 4);
      if (dir === 0) col++;
      if (dir === 1) col--;
      if (dir === 2) row++;
      if (dir === 3) row--;

      // Keep in bounds
      if (col < 0) col = 0;
      if (col >= cols) col = cols - 1;
      if (row < 0) row = 0;
      if (row >= rows) row = rows - 1;

      // Occasionally branch off into a smaller growth
      if (Math.random() < 0.05) {
        generateBranch(grid, col, row, cols, rows, Math.floor(growthSteps / 2), centerCol, centerRow, spawnSafeRadius);
      }
    }
  }
}

// Helper for branching rock growth (also respects spawn-safe zone)
function generateBranch(grid, col, row, cols, rows, steps, centerCol, centerRow, spawnSafeRadius) {
  const safeR2 = spawnSafeRadius * spawnSafeRadius;

  for (let step = 0; step < steps; step++) {
    const idx = row * cols + col;
    const dc = col - centerCol, dr = row - centerRow;
    if (dc * dc + dr * dr > safeR2) {
      grid[idx] = 1;
    }

    const dir = Math.floor(Math.random() * 4);
    if (dir === 0) col++;
    if (dir === 1) col--;
    if (dir === 2) row++;
    if (dir === 3) row--;

    if (col < 0) col = 0;
    if (col >= cols) col = cols - 1;
    if (row < 0) row = 0;
    if (row >= rows) row = rows - 1;
  }
}

export function clampToWorld(world, camera, player) {
  if (!world) return;
  const r = player?.r ?? 18;
  camera.x = clamp(camera.x, world.minX + r, world.maxX - r);
  camera.y = clamp(camera.y, world.minY + r, world.maxY - r);
}

export function drawWorldBorder(ctx, world, camera, cx, cy) {
  if (!world) return;
  const thickness = world.borderThickness;
  const color = world.borderColor;

  ctx.save();
  ctx.fillStyle = color;

  ctx.fillRect(
    world.minX - camera.x + cx - thickness,
    world.minY - thickness - camera.y + cy,
    (world.maxX - world.minX) + thickness * 2,
    thickness
  );
  ctx.fillRect(
    world.minX - camera.x + cx - thickness,
    world.maxY - camera.y + cy,
    (world.maxX - world.minX) + thickness * 2,
    thickness
  );
  ctx.fillRect(
    world.minX - thickness - camera.x + cx,
    world.minY - camera.y + cy,
    thickness,
    (world.maxY - world.minY)
  );
  ctx.fillRect(
    world.maxX - camera.x + cx,
    world.minY - camera.y + cy,
    thickness,
    (world.maxY - world.minY)
  );

  ctx.restore();
}

// Draw rock tiles
export function drawObstacles(ctx, miasma, obstacleGrid, camera, cx, cy) {
  const t = miasma.tile;
  const cols = miasma.cols;
  const rows = miasma.rows;
  const px = camera.x;
  const py = camera.y;

  ctx.save();
  ctx.fillStyle = "#444";

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      if (obstacleGrid[idx] === 1) {
        const x = col * t - miasma.halfCols * t;
        const y = row * t - miasma.halfRows * t;
        ctx.fillRect(x - px + cx, y - py + cy, t, t);
      }
    }
  }

  ctx.restore();
}

// Collision detection for grid-based rocks
export function collideWithObstacles(miasma, obstacleGrid, entity, radius) {
  const t = miasma.tile;
  const cols = miasma.cols;
  const rows = miasma.rows;
  const grid = obstacleGrid;

  // Calculate bounding box in tile coordinates
  const minX = Math.floor((entity.x - radius + miasma.halfCols * t) / t);
  const maxX = Math.floor((entity.x + radius + miasma.halfCols * t) / t);
  const minY = Math.floor((entity.y - radius + miasma.halfRows * t) / t);
  const maxY = Math.floor((entity.y + radius + miasma.halfRows * t) / t);

  for (let ty = minY; ty <= maxY; ty++) {
    for (let tx = minX; tx <= maxX; tx++) {
      if (tx < 0 || tx >= cols || ty < 0 || ty >= rows) continue;
      const idx = ty * cols + tx;
      if (grid[idx] === 1) {
        const tileCenterX = tx * t - miasma.halfCols * t + t / 2;
        const tileCenterY = ty * t - miasma.halfRows * t + t / 2;
        const dx = entity.x - tileCenterX;
        const dy = entity.y - tileCenterY;
        const dist = Math.hypot(dx, dy) || 1;
        const minDist = radius + t / 2;
        if (dist < minDist) {
          const overlap = minDist - dist;
          entity.x += (dx / dist) * overlap;
          entity.y += (dy / dist) * overlap;
        }
      }
    }
  }
}

  // Drill carving (triangle-accurate; no corridor thickening)
export function carveObstaclesWithDrillTri(miasma, obstacleGrid, tri, dt, pad = 0) {
  const t = miasma.tile;
  const cols = miasma.cols;
  const rows = miasma.rows;
  const grid = obstacleGrid;
  if (!grid) return false;

  // AABB for quick bounds (pad=0 keeps it tight)
  const minCol = Math.max(0, Math.floor((tri.aabb.minX - pad + miasma.halfCols * t) / t));
  const maxCol = Math.min(cols - 1, Math.floor((tri.aabb.maxX + pad + miasma.halfCols * t) / t));
  const minRow = Math.max(0, Math.floor((tri.aabb.minY - pad + miasma.halfRows * t) / t));
  const maxRow = Math.min(rows - 1, Math.floor((tri.aabb.maxY + pad + miasma.halfRows * t) / t));

  let carved = false;
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      // Tile center in world space
      const cx = col * t - miasma.halfCols * t + t * 0.5;
      const cy = row * t - miasma.halfRows * t + t * 0.5;

      // Only clear if the tile center is inside the drill triangle
      if (pointInTriangle(cx, cy, tri.a, tri.b, tri.c)) {
        const idx = row * cols + col;
        if (grid[idx] === 1) {
          grid[idx] = 0;
          carved = true;
        }
      }
    }
  }
  return carved;
}

// Barycentric point-in-triangle (robust & fast)
export function pointInTriangle(px, py, a, b, c) {
  const v0x = c.x - a.x, v0y = c.y - a.y;
  const v1x = b.x - a.x, v1y = b.y - a.y;
  const v2x = px - a.x, v2y = py - a.y;

  const dot00 = v0x*v0x + v0y*v0y;
  const dot01 = v0x*v1x + v0y*v1y;
  const dot02 = v0x*v2x + v0y*v2y;
  const dot11 = v1x*v1x + v1y*v1y;
  const dot12 = v1x*v2x + v1y*v2y;

  const denom = dot00 * dot11 - dot01 * dot01 || 1;
  const invDen = 1 / denom;
  const u = (dot11 * dot02 - dot01 * dot12) * invDen;
  const v = (dot00 * dot12 - dot01 * dot02) * invDen;

  return u >= 0 && v >= 0 && (u + v) <= 1;
}

// Clear a circular spawn area at the world center (radius in tiles)
function clearSpawnArea(miasma, grid, tilesRadius = 8) {
  const { cols, rows } = miasma;
  const cx = Math.floor(cols / 2);
  const cy = Math.floor(rows / 2);

  const r2 = tilesRadius * tilesRadius;
  const minC = Math.max(0, cx - tilesRadius);
  const maxC = Math.min(cols - 1, cx + tilesRadius);
  const minR = Math.max(0, cy - tilesRadius);
  const maxR = Math.min(rows - 1, cy + tilesRadius);

  for (let row = minR; row <= maxR; row++) {
    for (let col = minC; col <= maxC; col++) {
      const dc = col - cx, dr = row - cy;
      if (dc * dc + dr * dr <= r2) {
        grid[row * cols + col] = 0;
      }
    }
  }
}

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
