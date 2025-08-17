// systems/wind.js
/**
 * @typedef {Object} WindState
 * @property {number} direction   // radians
 * @property {number} speed       // tiles/sec
 * @property {"manual"|"auto"} mode
 * @property {number} driftTimer
 * @property {number} nextShiftAt
 */

/**
 * Initialize the wind system.
 * @param {import("../core/config.js").config["wind"]} cfg
 * @returns {WindState}
 */
export function initWind(cfg) {
  return {
    direction: 0,
    speed: 0,
    mode: "auto",
    driftTimer: 0,
    nextShiftAt: cfg.bigShiftInterval
  };
}
