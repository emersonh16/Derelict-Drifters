# Derelict Drifters — AGENTS Guide

## Who you’re helping
Solo contributor, “noob coder” acting as game director.  
Keep changes safe and incremental; **`main` must keep running after every commit.**

---

## Repo layout
- `core/` — game loop, config, state  
- `systems/` — gameplay systems (player, world, enemies, etc.)  
- `ui/` — DOM & HUD  
- `docs/` — project docs (this file lives here)  

Future folders (`engine/`, `assets/`, etc.) may appear — update this doc when they do.

---

## Code conventions
- ES modules only  
- Keep style consistent; prefer small functions over classes  
- No strict formatting rules (2-space, semicolons, etc. are fine but not enforced)  

---

## System modules
- **Future goal:** standardize exports to:
  - `init(state, config)`  
  - `update(state, dt)`  
  - `draw(ctx, state, view)`  
  - `handleEvent(evt, state)` (optional)  

- **Current reality:** existing modules use bespoke export names (e.g. `initBeam`, `drawBeam`).  

When adding a new system, use the standard API.  
When refactoring old systems, **do one system at a time** to keep `main` stable.

---

## Cross-system communication
- **Current:** direct imports and calls are allowed  
- **Future goal:** communicate through shared state or an event bus  

---

## RNG & determinism
- **Current:** `Math.random()` is used  
- **Future goal:** replace with a seedable RNG (`engine/rng.js`) for deterministic replays  

---

## Config & constants
- Tunable numbers should live in `core/config.js`  
- **Current reality:** magic numbers are still present in many modules  
- **Rule:** when you touch a module, move its tunables into config  

---

## DOM boundaries
- **Goal:** keep DOM access inside `ui/`
- **Current reality:** canvas setup and input live in `ui/canvas.js`; other DOM code is also contained within `ui/`
- **Plan:** continue migrating any stray DOM usage into `ui/` modules

---

## Event bus
- **Planned:** `engine/eventbus.js` providing `emit/on`  
- Documented now to encourage decoupling, but not yet implemented  
- Example event names:  
  - `enemy:died`  
  - `pickup:spawned`  
  - `miasma:cleared`  

---

## Testing (smoke)
Before committing, always confirm:  
1. Open `index.html` in a modern browser  
2. Move the player (WASD)  
3. Fire beam (wheel cycles modes)  
4. Clear miasma  
5. Spawn and kill enemy → pickup drops  
6. Verify game runs smoothly (~60 FPS)  

---

## Commit / PR template

**Intent**  
(What you changed and why)

**Files touched**  
`path/to/file.js` — create/modify/delete: short note

**Diff (unified)**  
*** minimal patch ***

**Full file(s)**  
(if file is new or largely changed)

**Config updates**  
`core/config.js` — keys added/changed

**How to test**  
1. Open index.html  
2. Basic smoke steps + feature-specific checks  

**Next tiny step**  
- bullet  
- bullet  

---

## Tooling
- “Latest Node LTS” recommended  
- Works in any modern browser; no build step required  

---

## Future AGENTS files
- This root `AGENTS.md` governs the whole repo  
- Add subdirectory `AGENTS.md` only when a folder needs extra rules  
