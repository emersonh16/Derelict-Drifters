// systems/pickups.js
export function spawnPickup(state, x, y, type = "scrap") {
  state.pickups.push({ x, y, type, r: 6 });
}

export function spawnScrapBurst(state, x, y, count) {
  for (let i = 0; i < count; i++) {
    const nx = x + Math.random() * 10 - 5;
    const ny = y + Math.random() * 10 - 5;
    spawnPickup(state, nx, ny, "scrap");
  }
}

export function updatePickups(state, dt) {
  const px = state.camera.x;
  const py = state.camera.y;
  const pr = state.player.r;

  for (let i = state.pickups.length - 1; i >= 0; i--) {
    const p = state.pickups[i];
    const dist = Math.hypot(px - p.x, py - p.y);
    if (dist <= pr + p.r) {
      if (p.type === "scrap") {
        state.scrap += 1;
      } else if (p.type === "health") {
        state.health = Math.min(state.maxHealth, state.health + 20);
      }
      state.pickups.splice(i, 1);
    }
  }
}

export function drawPickups(ctx, state, cx, cy) {
  const px = state.camera.x;
  const py = state.camera.y;

  for (const p of state.pickups) {
    const sx = p.x - px + cx;
    const sy = p.y - py + cy;
    ctx.beginPath();
    ctx.arc(sx, sy, p.r, 0, Math.PI * 2);
    ctx.fillStyle = (p.type === "scrap") ? "#ff0" : "#0f0";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
