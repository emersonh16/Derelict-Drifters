// systems/wind.js
// Simple wind simulation with slow drift and occasional gusts.

export let direction = 0; // radians
export let speed = 0;     // arbitrary units
export let mode = 'steady';

let jumpTimer = randRange(5, 10);

/**
 * Update the global wind values.
 * @param {number} dt
 */
export function updateWind(dt) {
  // small random walk for gentle drifting
  direction += randRange(-0.25, 0.25) * dt;
  speed += randRange(-5, 5) * dt;
  if (speed < 0) speed = 0;
  direction = (direction + Math.PI * 2) % (Math.PI * 2);

  jumpTimer -= dt;
  if (jumpTimer <= 0) {
    // big random jump (gust)
    direction = Math.random() * Math.PI * 2;
    speed = randRange(20, 80);
    mode = 'gust';
    jumpTimer = randRange(5, 10);
  } else {
    mode = 'steady';
  }
}

function randRange(min, max) {
  return Math.random() * (max - min) + min;
}
