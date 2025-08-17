# Dynamic Miasma Layer

Wind-driven, conveyor-belt fog layer. Tiles drift with wind; tiles cleared by the beam remain cleared and move with the grid. Designed to be deterministic, cheap, and easy to tune from `core/config.js` and the DevHUD.

---

## Concepts

**World origin**  
- The fog grid is **centered at world (0,0)**. The player spawns at world (0,0).  
- `worldToIdx()` converts world px → tile index by offsetting from the grid center.

**Conveyor drift**  
- Each frame, accumulated displacement = `wind.speed * dt` projected along `wind.direction`.  
- When accumulated displacement passes a tile size, the grid **shifts by whole tiles** (no sub-tile copies).  
- Rows/columns that scroll in on the **upwind edge** are re-seeded using `spawnProb` (with optional jitter).

**Clearing**  
- `clearWithBeam()` stamps a **bubble** in bubble mode and a **sector** in cone/laser modes.  
- Cleared tiles are set to `0` and **do not regrow** (v1). They keep drifting with the grid.

**Damage**  
- Player takes DPS when any sample inside the player radius is fog (`tile==1`).  
- Guarded by `state.spawnGrace` so you’re invulnerable for a few seconds on spawn.

---

## Tunables (`core/config.js`)

```js
// Wind
wind: {
  minSpeed: 0.5,        // tiles/sec
  maxSpeed: 3.0,        // tiles/sec
  smoothTime: 5.0,      // sec to lerp toward targets
  bigShiftInterval: 60, // sec between major shifts
  bigShiftMagnitude: Math.PI / 2 // ~90°
},

// Dynamic miasma grid
dynamicMiasma: {
  tile: 14,        // px per tile (visual + spatial)
  cols: 161,       // tile count (choose with tile*cols ≈ desired world px)
  rows: 161,       // tile count
  spawnProb: 0.20, // chance that a tile on the upwind edge is fog (0..1)
  spawnJitter: 0.05, // not yet used (reserved for future per-row noise)
  bufferCols: 4,   // extra offscreen columns, for smoother shifts
  bufferRows: 4    // extra offscreen rows
}
