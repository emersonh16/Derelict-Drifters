// systems/world.js
/** @typedef {import('../core/state.js').MiasmaState} MiasmaState */
/** @typedef {import('../core/state.js').WorldState} WorldState */
import { isoProject, isoProjectTile, worldFromIso } from "../core/iso.js";

export function init(miasma, player, opts = {}, rng) {
  const t = miasma.tile;

  /** @type {WorldState} */
  const world = {
    minX: -miasma.halfCols * t,
    maxX:  miasma.halfCols * t,
    minY: -miasma.halfRows * t,
    maxY:  miasma.halfRows * t,
    borderThickness: opts.borderThickness,
    borderColor: opts.borderColor
  };

  const obstacleGrid = new Uint8Array(miasma.size).fill(0);

  // Generate irregular rock formations
  generateObstacles(
    miasma,
    obstacleGrid,
    opts.seedCount,
    opts.growthSteps,
    opts.spawnSafeRadius,
    opts.branchChance,
    rng
  );

  // Ensure the spawn area is absolutely clear (in tiles)
  const tilesRadius = opts.spawnSafeRadius;
  if (typeof tilesRadius === 'number') {
    clearSpawnArea(miasma, obstacleGrid, tilesRadius);
  }

  return { world, obstacleGrid };
}

// Random-walk growth algorithm for wonky rock shapes
function generateObstacles(miasma, grid, seedCount, growthSteps, spawnSafeRadius, branchChance, rng) {
  const cols = miasma.cols;
  const rows = miasma.rows;

  const centerCol = Math.floor(cols / 2);
  const centerRow = Math.floor(rows / 2);

  // spawn-safe radius in tiles
  const safeRadius = typeof spawnSafeRadius === 'number' ? spawnSafeRadius : 0;

  for (let i = 0; i < seedCount; i++) {
    let col = Math.floor(rng.next() * cols);
    let row = Math.floor(rng.next() * rows);

    // Skip if starting inside spawn-safe zone
      if (Math.hypot(col - centerCol, row - centerRow) <= safeRadius) continue;

    for (let step = 0; step < growthSteps; step++) {
      // Mark tile as rock (skip if in spawn-safe zone)
      const idx = row * cols + col;
      const dc = col - centerCol, dr = row - centerRow;
      if (dc * dc + dr * dr > safeRadius * safeRadius) {
        grid[idx] = 1;
      }

      // Move in a random cardinal direction
      const dir = Math.floor(rng.next() * 4);
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
      if (rng.next() < branchChance) {
        generateBranch(grid, col, row, cols, rows, Math.floor(growthSteps / 2), centerCol, centerRow, safeRadius, rng);
      }
    }
  }
}

// Helper for branching rock growth (also respects spawn-safe zone)
function generateBranch(grid, col, row, cols, rows, steps, centerCol, centerRow, spawnSafeRadius, rng) {
  const safeR2 = spawnSafeRadius * spawnSafeRadius;

  for (let step = 0; step < steps; step++) {
    const idx = row * cols + col;
    const dc = col - centerCol, dr = row - centerRow;
    if (dc * dc + dr * dr > safeR2) {
      grid[idx] = 1;
    }

    const dir = Math.floor(rng.next() * 4);
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

// Keep the camera within world bounds, factoring in the player's radius so
// they remain visible at the edge of the map.
export function clampCameraToWorld(world, camera, player) {
  if (!world || !camera) return;
  const r = player?.r ?? 0;
  camera.x = clamp(camera.x, world.minX + r, world.maxX - r);
  camera.y = clamp(camera.y, world.minY + r, world.maxY - r);
}

// Clamp any circular entity so it cannot leave the world bounds.
export function clampEntityToWorld(world, entity) {
  if (!world || !entity) return;
  const r = entity.r ?? 0;
  entity.x = clamp(entity.x, world.minX + r, world.maxX - r);
  entity.y = clamp(entity.y, world.minY + r, world.maxY - r);
}

export function drawWorldBorder(ctx, world, camera) {
  if (!world) return;
  const thickness = world.borderThickness;
  const color = world.borderColor;

  const tl = isoProject(world.minX, world.minY, camera);
  const tr = isoProject(world.maxX, world.minY, camera);
  const br = isoProject(world.maxX, world.maxY, camera);
  const bl = isoProject(world.minX, world.maxY, camera);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  ctx.beginPath();
  ctx.moveTo(tl.x, tl.y);
  ctx.lineTo(tr.x, tr.y);
  ctx.lineTo(br.x, br.y);
  ctx.lineTo(bl.x, bl.y);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

// Draw a single isometric tile (diamond) at screen position
export function drawTile(ctx, x, y, size) {
  const half = size / 2;
  ctx.beginPath();
  ctx.moveTo(x + half, y);        // top
  ctx.lineTo(x + size, y + half); // right
  ctx.lineTo(x + half, y + size); // bottom
  ctx.lineTo(x, y + half);        // left
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

// Queue rock tiles for drawing
export function draw(drawables, miasma, obstacleGrid, camera) {
  const t = miasma.tile;
  const cols = miasma.cols;
  const rows = miasma.rows;
  const halfCols = miasma.halfCols;
  const halfRows = miasma.halfRows;

  // Determine visible world bounds from camera and canvas size
  const w = camera.cx * 2;
  const h = camera.cy * 2;
  const corners = [
    worldFromIso(0, 0, camera),
    worldFromIso(w, 0, camera),
    worldFromIso(0, h, camera),
    worldFromIso(w, h, camera),
  ];

  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const c of corners) {
    if (c.x < minX) minX = c.x;
    if (c.x > maxX) maxX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.y > maxY) maxY = c.y;
  }

  let minCol = Math.floor(minX / t) + halfCols;
  let maxCol = Math.ceil(maxX / t) + halfCols;
  let minRow = Math.floor(minY / t) + halfRows;
  let maxRow = Math.ceil(maxY / t) + halfRows;

  // Clamp to grid bounds
  minCol = Math.max(0, minCol);
  maxCol = Math.min(cols - 1, maxCol);
  minRow = Math.max(0, minRow);
  maxRow = Math.min(rows - 1, maxRow);

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const idx = row * cols + col;
      if (obstacleGrid[idx] === 1) {
        const proj = isoProjectTile(col - halfCols, row - halfRows, t, camera);
        drawables.push({
          x: proj.x,
          y: proj.y,
          isoY: proj.y,
          type: "tile",
          size: t,
          color: "#444",
        });
      }
    }
  }
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
