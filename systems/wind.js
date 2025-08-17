// systems/wind.js

/**
 * @typedef {Object} WindState
 * @property {number} direction   // radians
 * @property {number} speed       // tiles/sec
 * @property {"manual"|"auto"} mode
 * @property {number} driftTimer
 * @property {number} nextShiftAt
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
    nextShiftAt: cfg.bigShiftInterval,
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

  // Every bigShiftInterval, pick a new target
  if (wind.driftTimer >= wind.nextShiftAt) {
    wind.driftTimer = 0;
    wind.nextShiftAt = cfg.bigShiftInterval;

    // Turn by ± bigShiftMagnitude
    const turn = (Math.random() * 2 - 1) * cfg.bigShiftMagnitude;
    wind.targetDir = wind.direction + turn;

    // Pick random speed in range
    wind.targetSpeed = cfg.minSpeed + Math.random() * (cfg.maxSpeed - cfg.minSpeed);

    // Debug log
    console.log("[wind] new target:", wind.targetDir.toFixed(2), wind.targetSpeed.toFixed(2));
  }

  // Smoothly interpolate current toward target
  const lerp = dt / cfg.smoothTime;
  wind.direction += (wind.targetDir - wind.direction) * lerp;
  wind.speed += (wind.targetSpeed - wind.speed) * lerp;
}
