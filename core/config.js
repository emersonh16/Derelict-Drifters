// core/config.js
export const config = {
   game: {
    miasmaDPS: 35,     // damage per second in fog
    winScrap: 20,      // scrap required to win

    // Laser energy settings
    maxLaserEnergy: 100,   // total capacity
    laserDrainRate: 20,    // energy per second while in laser mode
    laserRechargeRate: 10  // energy per second when not in laser mode
  },

  beam: {
    // Control
    startT: 0.42,
    wheelStep: 0.05,

    // Thresholds
    tNoBeamEnd: 0.08,
    tBubbleEnd: 0.42,
    tConeEnd: 0.88,

    // Bubble shape
    bubbleRMin: 16,
    bubbleRMax: 90,

    // Cone / Laser shape
    coneHalfArcWideDeg: 60,
    coneHalfArcNarrowDeg: 1.6,
    laserMinHalfArcDeg: 0.22,

    // Ranges
    baseRange: 150,
    laserRange: 240,
    bumpRange: 20,

    // Laser visuals
    laserCoreWidth: 8,
    laserOutlineMult: 2.0,
    laserTipRadius: 14
  },

  miasma: {
    tile: 5,
    cols: 450,
    rows: 450,
    regrowDelay: 1.0,
    baseChance: 0.20,
    tickHz: 8,

    // Laser sweep tuning
    laserMinThicknessTiles: 2.0,
    laserFanCount: 3,
    laserFanMinDeg: 0.25,

    dps: 35
  },

  enemies: {
    max: 40,
    speed: 70,
    detectRadius: 400,
    size: 10,
    baseHP: 100,
    laserDPS: 180,
    flashTime: 0.1,
    contactDPS: 50,
    spawnEvery: 2.5,
    safeDistInitial: 250,
    safeDistTrickle: 200
  },

  world: {
    borderThickness: 80,                       // visual wall thickness
    borderColor: 'rgba(120, 60, 160, 0.7)'      // matches miasma but more opaque
  },

  hud: {
    barW: 180,          // health bar width
    barH: 10,           // health bar height
    pad: 14,            // HUD padding from top/left
    fontSize: 12,       // HUD font size
    hpFillColor: '#ff5577cc' // health bar fill color
  },

  // Drill heat and HUD colors
  drill: {
    maxHeat: 100,
    heatRate: 35,
    coolRate: 35,
    coolDelay: 0.5,
    resumeThreshold: 33,
    heatColorCold: '#22cc55',
    heatColorWarm: '#ffcc33',
    heatColorHot: '#ff3333'
  }
};
