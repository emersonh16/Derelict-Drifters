// systems/world.js

export function initWorld(state, opts = {}) {
  const s = state.miasma;
  const t = s.tile;

  // World bounds from miasma size
  state.world = {
    minX: -s.halfCols * t,
    maxX:  s.halfCols * t,
    minY: -s.halfRows * t,
    maxY:  s.halfRows * t,
    borderThickness: opts.borderThickness ?? 80,
    borderColor: opts.borderColor ?? 'rgba(120, 60, 160, 0.7)'
  };

  // New obstacle grid
  state.obstacleGrid = new Uint8Array(s.size).fill(0);

  // Generate irregular rock formations
  generateObstacles(state, opts.seedCount ?? 30, opts.growthSteps ?? 700);

  // Keep for compatibility (empty)
  state.obstacles = [];
}

// Random-walk growth algorithm for wonky rock shapes
function generateObstacles(state, seedCount = 20, growthSteps = 150) {
  const cols = state.miasma.cols;
  const rows = state.miasma.rows;
  const grid = state.obstacleGrid;
  const spawnSafeRadius = 8;
  const centerCol = Math.floor(cols / 2);
  const centerRow = Math.floor(rows / 2);

  for (let i = 0; i < seedCount; i++) {
    let col = Math.floor(Math.random() * cols);
    let row = Math.floor(Math.random() * rows);

    // Skip if starting inside spawn-safe zone
    if (Math.hypot(col - centerCol, row - centerRow) <= spawnSafeRadius) continue;

    for (let step = 0; step < growthSteps; step++) {
      // Mark tile as rock
      const idx = row * cols + col;
      grid[idx] = 1;

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
        generateBranch(grid, col, row, cols, rows, Math.floor(growthSteps / 2));
      }
    }
  }
}

// Helper for branching rock growth
function generateBranch(grid, col, row, cols, rows, steps) {
  for (let step = 0; step < steps; step++) {
    const idx = row * cols + col;
    grid[idx] = 1;
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

export function clampToWorld(state) {
  const w = state.world; if (!w) return;
  const r = state.player?.r ?? 18;
  state.camera.x = clamp(state.camera.x, w.minX + r, w.maxX - r);
  state.camera.y = clamp(state.camera.y, w.minY + r, w.maxY - r);
}

export function drawWorldBorder(ctx, state, cx, cy) {
  const w = state.world; if (!w) return;
  const thickness = w.borderThickness;
  const color = w.borderColor;

  ctx.save();
  ctx.fillStyle = color;

  ctx.fillRect(
    w.minX - state.camera.x + cx - thickness,
    w.minY - thickness - state.camera.y + cy,
    (w.maxX - w.minX) + thickness * 2,
    thickness
  );
  ctx.fillRect(
    w.minX - state.camera.x + cx - thickness,
    w.maxY - state.camera.y + cy,
    (w.maxX - w.minX) + thickness * 2,
    thickness
  );
  ctx.fillRect(
    w.minX - thickness - state.camera.x + cx,
    w.minY - state.camera.y + cy,
    thickness,
    (w.maxY - w.minY)
  );
  ctx.fillRect(
    w.maxX - state.camera.x + cx,
    w.minY - state.camera.y + cy,
    thickness,
    (w.maxY - w.minY)
  );

  ctx.restore();
}

// Draw rock tiles
export function drawObstacles(ctx, state, cx, cy) {
  const t = state.miasma.tile;
  const cols = state.miasma.cols;
  const rows = state.miasma.rows;
  const px = state.camera.x;
  const py = state.camera.y;

  ctx.save();
  ctx.fillStyle = "#444";

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      if (state.obstacleGrid[idx] === 1) {
        const x = col * t - state.miasma.halfCols * t;
        const y = row * t - state.miasma.halfRows * t;
        ctx.fillRect(x - px + cx, y - py + cy, t, t);
      }
    }
  }

  ctx.restore();
}

// Collision detection for grid-based rocks
export function collideWithObstacles(state, entity, radius) {
  const t = state.miasma.tile;
  const cols = state.miasma.cols;
  const rows = state.miasma.rows;
  const grid = state.obstacleGrid;

  // Calculate bounding box in tile coordinates
  const minX = Math.floor((entity.x - radius + state.miasma.halfCols * t) / t);
  const maxX = Math.floor((entity.x + radius + state.miasma.halfCols * t) / t);
  const minY = Math.floor((entity.y - radius + state.miasma.halfRows * t) / t);
  const maxY = Math.floor((entity.y + radius + state.miasma.halfRows * t) / t);

  for (let ty = minY; ty <= maxY; ty++) {
    for (let tx = minX; tx <= maxX; tx++) {
      if (tx < 0 || tx >= cols || ty < 0 || ty >= rows) continue;
      const idx = ty * cols + tx;
      if (grid[idx] === 1) {
        const tileCenterX = tx * t - state.miasma.halfCols * t + t / 2;
        const tileCenterY = ty * t - state.miasma.halfRows * t + t / 2;
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

// Drill carving placeholder
export function carveObstaclesWithDrillTri(state, tri, dt, pad = 2) {}

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
