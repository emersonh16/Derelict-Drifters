// systems/wind.js

/**
 * @typedef {Object} WindState
 * @property {number} direction   // radians
 * @property {number} speed       // tiles/sec
 * @property {"manual"|"auto"} mode
 * @property {number} driftTimer
 * @property {number} targetDir
 * @property {number} targetSpeed
 */

/**
 * Initialize the wind system.
 * @param {import("../core/config.js").config["wind"]} cfg
 * @returns {WindState}
 */
export function initWind(cfg) {
  return {
    direction: 0,
    speed: cfg.minSpeed,
    mode: "auto",
    driftTimer: 0,
    targetDir: 0,
    targetSpeed: cfg.minSpeed
  };
}

/**
 * Update the wind state.
 * @param {WindState} wind
 * @param {number} dt
 * @param {import("../core/config.js").config["wind"]} cfg
 */
export function updateWind(wind, dt, cfg) {
  if (wind.mode === "manual") return; // do nothing

  wind.driftTimer += dt;

  // Apply small random jitter each frame
  wind.targetDir += (Math.random() * 2 - 1) * cfg.smallJitter * dt;

 // When timer exceeds interval, add a large shift and randomize speed
  if (wind.driftTimer >= cfg.bigShiftInterval) {
    wind.driftTimer = 0;

    wind.targetDir += (Math.random() * 2 - 1) * cfg.bigShiftMagnitude;
    wind.targetSpeed = cfg.minSpeed + Math.random() * (cfg.maxSpeed - cfg.minSpeed);

    // Debug log
       console.log("[wind] big shift:", wind.targetDir.toFixed(2), wind.targetSpeed.toFixed(2));
  }

  // Smoothly interpolate current toward target
  const lerp = dt / cfg.smoothTime;
  wind.direction += (wind.targetDir - wind.direction) * lerp;
  wind.speed += (wind.targetSpeed - wind.speed) * lerp;
}
