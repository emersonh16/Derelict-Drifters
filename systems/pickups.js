// systems/pickups.js
/** @typedef {import('../core/state.js').Pickup} Pickup */
import { isoProject } from "../core/iso.js";

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

export function drawPickups(drawables, pickups, camera) {
  for (const p of pickups) {
    const proj = isoProject(p.x, p.y, camera);
    drawables.push({
      x: proj.x,
      y: proj.y,
      isoY: proj.y,
      type: "pickup",
      r: p.r,
      color: p.type === "scrap" ? "#ff0" : "#0f0",
    });
  }
}
