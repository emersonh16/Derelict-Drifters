// core/game.js
import { config } from "../core/config.js";
import { beam, miasma, enemies, pickups, world, drill, wind } from "../systems/index.js";
import { hud, devhud, ctx, initCanvas } from "../ui/index.js";
import { createGameState } from "./state.js";
import { applyDevHUD } from "../ui/devhud.js";
import { isoProject } from "./iso.js";
import { createRNG } from "../engine/rng.js";

const canvas = ctx.canvas;

const state = createGameState();
state.miasmaEnabled = true;
state.maxScrap = config.game.winScrap;
state.laserEnergy = state.maxLaserEnergy = config.game.maxLaserEnergy;
state.drillHeat = 0;
state.maxDrillHeat = config.drill.maxHeat;
state.drillOverheated = false;
state.drillCoolTimer = 0;
state.drillDidHit = false;
function togglePause() {
  state.paused = !state.paused;
  if (!state.paused) {
    // commit DevHUD slider values into live state
    applyDevHUD(state);
    // sync mouse back to live
    state.mouse.x = state.pendingMouse.x;
    state.mouse.y = state.pendingMouse.y;
  }
}

function startGame() {
  // --- Base run/reset ---
  const seed = typeof config.seed === "number" ? config.seed : Date.now();
  state.rng = createRNG(seed);
  state.miasmaEnabled = true;
  state.time = 0;
  state.dt = 0;
  state.keys.clear();
  state.paused = false;
  state.gameOver = false;
  state.win = false;
  state.damageFlash = 0;

  // Drill heat state
  state.drillHeat = 0;
  state.maxDrillHeat = config.drill.maxHeat;
  state.drillOverheated = false;
  state.drillCoolTimer = 0;
  state.drillDidHit = false;

  // Player / run stats
  state.health = state.maxHealth;
  state.scrap = 0;
  state.pickups.length = 0;

  // Player starts at origin
  state.player.x = 0;
  state.player.y = 0;

  // Camera starts centered on player
  state.camera.x = state.player.x;
  state.camera.y = state.player.y;
  state.cameraVel.x = 0;
  state.cameraVel.y = 0;

  // Mouse centered (like a fresh load)
  state.mouse.x = canvas.width / 2;
  state.mouse.y = canvas.height / 2;
  state.pendingMouse.x = state.mouse.x;
  state.pendingMouse.y = state.mouse.y;

  // --- Wind first ---
  state.wind = wind.initWind(config.weather.wind, state.rng);

  // --- World + systems ---
  state.miasma = miasma.init(config.dynamicMiasma, state.rng);

  const wInit = world.init(state.miasma, state.player, config.world, state.rng);
  state.world = wInit.world;
  state.obstacleGrid = wInit.obstacleGrid;

  state.beam = beam.init(config.beam);

  state.enemies = enemies.initEnemies(state.miasma, config.enemies);
  state.enemyProjectiles.length = 0;
  enemies.spawnInitialEnemies(state, config.enemies.max);

  hud.initHUD(state, config.hud);
}

initCanvas(state, {
  onWheel: (e) => beam.handleEvent(e, state.beam),
  onTogglePause: togglePause,
  onRestart: startGame,
  onToggleDevHUD: () => devhud.toggleDevHUD(state),
});

// ---- Init ----
startGame();
state.drill = drill.initDrill(state.player);
devhud.initDevHUD(state);

// ---- Update ----
function update(dt) {
  state.time += dt;
  state.drillDidHit = false;

  // --- Wind ---
  wind.updateWind(state.wind, dt, config.weather.wind);

  // simulation bubble around viewport
  const bubble = state.miasma.bubble;
  bubble.minX = state.camera.x - canvas.width / 2 - config.weather.bubble.marginX;
  bubble.maxX = state.camera.x + canvas.width / 2 + config.weather.bubble.marginX;
  bubble.minY = state.camera.y - canvas.height / 2 - config.weather.bubble.marginY;
  bubble.maxY = state.camera.y + canvas.height / 2 + config.weather.bubble.marginY;

  miasma.updateTargetCoverage(state.miasma, dt, config.weather.density);

  if (state.miasmaEnabled) {
    miasma.update(state.miasma, state.wind, dt);

    // Single binary regrow path (gated by config.dynamicMiasma.regrowEnabled)
    miasma.regrowMiasma(
      state.miasma,
      config.dynamicMiasma,
      state.time,
      dt
    );
  }

  // movement
  // --- Non-floaty WASD using existing state.keys; move the PLAYER ---
  {
    const ax = (state.keys.has('d') || state.keys.has('arrowright') ? 1 : 0)
             - (state.keys.has('a') || state.keys.has('arrowleft')  ? 1 : 0);
    const ay = (state.keys.has('s') || state.keys.has('arrowdown')  ? 1 : 0)
             - (state.keys.has('w') || state.keys.has('arrowup')    ? 1 : 0);

    if (ax !== 0 || ay !== 0) {
      const len = Math.hypot(ax, ay);
      const nx = ax / len, ny = ay / len; // diagonals not faster
      const speed = 200; // px/sec; make a config knob later if you want

      state.player.x += nx * speed * dt;
      state.player.y += ny * speed * dt;
    }
  }

  // Rock collision for player
  world.collideWithObstacles(
    state.miasma,
    state.obstacleGrid,
    state.player,
    state.player.r
  );

  // Camera smoothly follows player
  const followSpeed = 10; // higher = snappier, lower = floatier
  state.camera.x += (state.player.x - state.camera.x) * followSpeed * dt;
  state.camera.y += (state.player.y - state.camera.y) * followSpeed * dt;

  // Clamp player inside world bounds
  world.update(state.world, state.player, state.player);

  // --- Drill carving ---
  if (state.activeWeapon === "drill" && state.drill && !state.drillOverheated) {
    const tri = drill.getDrillTriangleWorld(state.drill, state.camera, state.mouse);
    if (world.carveObstaclesWithDrillTri(state.miasma, state.obstacleGrid, tri, dt, 2)) {
      state.drillDidHit = true;
    }
  }

  enemies.updateEnemies(state, dt);
  pickups.updatePickups(state.pickups, state.camera, state.player, state, dt);

  // Drill heat
  if (state.drillDidHit && !state.drillOverheated) {
    state.drillHeat += config.drill.heatRate * dt;
    state.drillCoolTimer = 0;
    if (state.drillHeat >= state.maxDrillHeat) {
      state.drillHeat = state.maxDrillHeat;
      state.drillOverheated = true;
    }
  } else {
    state.drillCoolTimer += dt;
    if (state.drillCoolTimer >= config.drill.coolDelay) {
      state.drillHeat = Math.max(0, state.drillHeat - config.drill.coolRate * dt);
    }
  }
  if (state.drillOverheated && state.drillHeat <= config.drill.resumeThreshold) {
    state.drillOverheated = false;
  }

  // Win condition
  if (!state.gameOver && state.scrap >= state.maxScrap) {
    state.win = true;
    state.gameOver = true;
  }

  // --- Miasma damage ---
  if (state.miasmaEnabled) {
    const step = state.miasma.tile * 0.5;
    let inFog = false;

    outer: for (let dy = -state.player.r; dy <= state.player.r; dy += step) {
      for (let dx = -state.player.r; dx <= state.player.r; dx += step) {
        if (dx * dx + dy * dy > state.player.r * state.player.r) continue;
        const idx = miasma.worldToIdx(
          state.miasma,
          state.camera.x + dx,
          state.camera.y + dy,
          state.camera
        );
        if (miasma.isFog(state.miasma, idx)) {
          inFog = true;
          break outer; // ✅ exit both loops
        }
      }
    }

    if (inFog) {
      state.health -= config.dynamicMiasma.dps * dt;
      state.damageFlash = 0.2;
      if (state.health < 0) state.health = 0;
    }
  }

  state.damageFlash = Math.max(0, state.damageFlash - dt);

  if (state.health <= 0 && !state.gameOver) {
    console.log("health dropped", state.health);
    state.health = 0;
    state.gameOver = true;
  }

  // --- Laser energy ---
  const beamState = state.beam;
  if (state.activeWeapon === "beam" && beamState.mode === "laser") {
    state.laserEnergy -= config.game.laserDrainRate * dt;
    if (state.laserEnergy <= 0) {
      state.laserEnergy = 0;
      beamState.t = beamState.tConeEnd - 0.01; // force back to cone
      beam.update(state.beam, state.mouse, canvas.width / 2, canvas.height / 2);
    }
  } else {
    state.laserEnergy = Math.min(
      state.maxLaserEnergy,
      state.laserEnergy + config.game.laserRechargeRate * dt
    );
  }

  hud.updateHUD(state);
}

// ---- Draw ----
function draw() {
  const w = canvas.width, h = canvas.height;
  state.camera.cx = Math.round(w / 2);
  state.camera.cy = Math.round(h / 2);

  // Two coordinate spaces: one for grid/collision, one for smooth drawing
  const camDraw = {
    x: state.camera.x,
    y: state.camera.y,
    cx: state.camera.cx,
    cy: state.camera.cy,
    isoX: state.camera.isoX,
    isoY: state.camera.isoY,
  };

  ctx.fillStyle = "#0c0b10";
  ctx.fillRect(0, 0, w, h);

  if (state.activeWeapon === "beam") {
    beam.update(state.beam, state.mouse, state.camera.cx, state.camera.cy);
    if (state.miasmaEnabled && !state.paused && !state.gameOver) {
      miasma.clearWithBeam(state.miasma, state.beam, state.camera, state.time, state.camera.cx, state.camera.cy);
    }
  }

  world.draw(ctx, state.miasma, state.obstacleGrid, camDraw);
  enemies.drawEnemies(ctx, state);
  pickups.drawPickups(ctx, state.pickups, camDraw);

  if (state.miasmaEnabled) {
    miasma.draw(ctx, state.miasma, camDraw, w, h);
  }

  world.drawWorldBorder(ctx, state.world, camDraw);

  if (state.activeWeapon === "beam") {
    beam.draw(ctx, state.beam, state.camera.cx, state.camera.cy);
  } else if (state.activeWeapon === "drill") {
    drill.drawDrill(ctx, state.drill, state.mouse, state.activeWeapon, state.camera.cx, state.camera.cy, state.drillOverheated);
  }

  // Player sprite rendered via projection helper.
  const playerPos = isoProject(state.camera.x, state.camera.y, camDraw);
  ctx.fillStyle = "#9a3b31";
  ctx.beginPath();
  ctx.arc(playerPos.x, playerPos.y, state.player.r, 0, Math.PI * 2);
  ctx.fill();

  if (state.damageFlash > 0) {
    ctx.fillStyle = `rgba(255,0,0,${state.damageFlash * 0.5})`;
    ctx.fillRect(0, 0, w, h);
  }

  if (state.paused && !state.gameOver) {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "white";
    ctx.font = "bold 32px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("PAUSED — press Space", w / 2, 64);
  }

  if (state.gameOver) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "white";
    ctx.font = "bold 64px sans-serif";
    ctx.textAlign = "center";
    const title = state.win ? "YOU WIN" : "GAME OVER";
    ctx.fillText(title, w / 2, h / 2);
    if (!state.win) {
      ctx.font = "24px sans-serif";
      ctx.fillText("Press R to Restart", w / 2, h / 2 + 50);
    }
  }
}

// ---- Main Loop ----
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  state.dt = dt;

  if (!state.gameOver && !state.paused) {
    update(dt);
  }

  draw();

  devhud.updateDevHUD(state, state.dt);
  devhud.drawDevHUD(ctx, state);

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
