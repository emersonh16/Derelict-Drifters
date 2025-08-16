// systems/pickups.js
/** @typedef {import('../core/state.js').Pickup} Pickup */

export function spawnPickup(pickups, x, y, type = "scrap") {
  pickups.push({ x, y, type, r: 6 });
}

export function updatePickups(pickups, camera, player, state, dt) {
  const px = camera.x;
  const py = camera.y;
  const pr = player.r;

  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    const dist = Math.hypot(px - p.x, py - p.y);
    if (dist <= pr + p.r) {
      if (p.type === "scrap") {
        state.scrap += 1;
      } else if (p.type === "health") {
        state.health = Math.min(state.maxHealth, state.health + 20);
      }
      pickups.splice(i, 1);
    }
  }
}

export function drawPickups(ctx, pickups, camera, cx, cy) {
  const px = camera.x;
  const py = camera.y;

  for (const p of pickups) {
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
