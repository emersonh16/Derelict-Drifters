# Miasma Configuration

The miasma layer is a tile grid that drifts with the wind.
These keys in `core/config.js` control its behaviour:

- `tile` – world size of each tile in pixels.
- `cols`, `rows` – grid dimensions in tiles.
- `spawnProb` – probability that a new tile spawns as fog.
- `spawnJitter` – random ±% variation applied to `spawnProb`.
- `bufferCols`, `bufferRows` – extra off‑screen tiles used when recycling
  columns and rows as the wind shifts.
- `dps` – damage per second dealt to the player while in fog.

The wind settings live in `config.wind` and influence how fast and in
which direction the grid moves.
