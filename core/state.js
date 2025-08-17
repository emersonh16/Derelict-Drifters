// core/state.js
// Global game state definitions and factory.

/**
 * @typedef {{x: number, y: number}} Vec2
 */

/**
 * @typedef {Object} BeamState
 * @property {number} t
 * @property {number} step
 * @property {number} tNoBeamEnd
 * @property {number} tBubbleEnd
 * @property {number} tConeEnd
 * @property {number} bubbleRMin
 * @property {number} bubbleRMax
 * @property {number} coneHalfArcWide
 * @property {number} coneHalfArcNarrow
 * @property {number} laserMinHalfArc
 * @property {number} baseRange
 * @property {number} laserRange
 * @property {number} bumpRange
 * @property {number} laserCoreWidth
 * @property {number} laserOutlineMult
 * @property {number} laserTipRadius
 * @property {string} mode
 * @property {number} range
 * @property {number} halfArc
 * @property {number} angle
 * @property {number} radius
 * @property {{main0:string,main1:string,main2:string,laser0:string,laser1:string,laser2:string,tip:string,core:string,halo:string}} color
 */

/**
 * @typedef {Object} MiasmaState
 * @property {number} tile
 * @property {number} halfCols
 * @property {number} halfRows
 * @property {number} cols
 * @property {number} rows
 * @property {number} stride
 * @property {number} size
 * @property {Uint8Array} strength
 * @property {Uint8Array} strengthNext
 * @property {number} regrowDelay
 * @property {number} baseChance
 * @property {number} tickHz
 * @property {Float32Array} lastCleared
 * @property {number} _accum
 * @property {number} laserMinThicknessTiles
 * @property {number} laserFanCount
 * @property {number} laserFanMinDeg
*/

/**
 * @typedef {Object} EnemyProjectile
 * @property {number} x
 * @property {number} y
 * @property {number} dx
 * @property {number} dy
 * @property {number} w
 * @property {number} h
 * @property {number} speed
 */

/**
 * @typedef {Object} EnemyState
 * @property {Array<Object>} list
 * @property {number} max
 * @property {number} worldW
 * @property {number} worldH
 * @property {number} speed
 * @property {number} detectRadius
 * @property {number} size
 * @property {number} baseHP
 * @property {number} laserDPS
 * @property {number} flashTime
 * @property {number} contactDPS
 * @property {number} spawnEvery
 * @property {number} safeDistInitial
 * @property {number} safeDistTrickle
 * @property {number} tankBulletSpeed
 * @property {number} tankBulletCooldown
 * @property {number} tankBulletDamage
 * @property {number} tankBulletWidth
 * @property {number} tankBulletHeight
 * @property {number} spawnTimer
 */

/**
 * @typedef {Object} WorldState
 * @property {number} minX
 * @property {number} maxX
 * @property {number} minY
 * @property {number} maxY
 * @property {number} borderThickness
 * @property {string} borderColor
 */

/**
 * @typedef {Object} DrillState
 * @property {number} length
 * @property {number} width
 * @property {number} offset
 * @property {number} dps
 * @property {string} fill
 * @property {string} stroke
 * @property {string} capFill
 * @property {string} capStroke
 * @property {number} playerRadius
 */

/**
 * @typedef {Object} Pickup
 * @property {number} x
 * @property {number} y
 * @property {string} type
 * @property {number} r
 */

/**
 * @typedef {Object} WindState
 * @property {number} direction
 * @property {number} speed
 * @property {"manual"|"auto"} mode
 * @property {number} driftTimer
 * @property {number} nextShiftAt
 */


/**
 * @typedef {Object} GameState
 * @property {number} time
 * @property {number} dt
 * @property {Vec2} mouse
 * @property {Vec2} pendingMouse
 * @property {Vec2} camera
 * @property {{r:number}} player
 * @property {Set<string>} keys
 * @property {number} health
 * @property {number} maxHealth
 * @property {boolean} gameOver
 * @property {number} scrap
 * @property {Array<Pickup>} pickups
 * @property {number} damageFlash
 * @property {boolean} paused
 * @property {boolean} win
 * @property {number} maxScrap
 * @property {number} laserEnergy
 * @property {number} maxLaserEnergy
 * @property {"beam"|"drill"} activeWeapon
 * @property {number} drillHeat
 * @property {number} maxDrillHeat
 * @property {boolean} drillOverheated
 * @property {number} drillCoolTimer
 * @property {boolean} drillDidHit
 * @property {BeamState} [beam]
 * @property {MiasmaState} [miasma]
 * @property {EnemyState} [enemies]
 * @property {WorldState} [world]
 * @property {Uint8Array} [obstacleGrid]
 * @property {DrillState} [drill]
 * @property {{show?:boolean,perf?:any}} [dev]
 * @property {Array<EnemyProjectile>} enemyProjectiles
 * @property {WindState} [wind]

 */

/**
 * Create a new blank game state.
 * @returns {GameState}
 */
export function createGameState() {
  return {
    time: 0, dt: 0,
    mouse: { x: 0, y: 0 },
    pendingMouse: { x: 0, y: 0 },
    camera: { x: 0, y: 0 },
    player: { r: 18 },
    keys: new Set(),
    health: 100,
    maxHealth: 100,
    gameOver: false,
    scrap: 0,
    pickups: [],
    damageFlash: 0,
    paused: false,
    win: false,
    maxScrap: 0,
    laserEnergy: 0,
    maxLaserEnergy: 0,
    activeWeapon: "beam",
    drillHeat: 0,
    maxDrillHeat: 0,
    drillOverheated: false,
    drillCoolTimer: 0,
    drillDidHit: false,
    enemyProjectiles: [],
  };
}

export {}; // so this file is a module
