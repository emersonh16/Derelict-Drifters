// core/game.js
import { config } from "../core/config.js";
import { beam, miasma, enemies, pickups, world, drill, wind } from "../systems/index.js";
import { hud, devhud } from "../ui/index.js";
import { createGameState } from "./state.js";
import { applyDevHUD } from "../ui/devhud.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha: false });
ctx.imageSmoothingEnabled = false; // keeps pixels crisp

const state = createGameState();
state.miasmaEnabled = true;
state.maxScrap = config.game.winScrap;
state.laserEnergy = state.maxLaserEnergy = config.game.maxLaserEnergy;
state.drillHeat = 0;
state.maxDrillHeat = config.drill.maxHeat;
state.drillOverheated = false;
state.drillCoolTimer = 0;
state.drillDidHit = false;

// ---- Resize ----
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  state.mouse.x = canvas.width / 2;
  state.mouse.y = canvas.height / 2;
  state.pendingMouse.x = state.mouse.x;
  state.pendingMouse.y = state.mouse.y;
}
window.addEventListener("resize", resize);
resize();

// ---- Input ----
canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  if (state.paused) {
    state.pendingMouse.x = x;
    state.pendingMouse.y = y;
  } else {
    state.mouse.x = x;
    state.mouse.y = y;
  }
});

canvas.addEventListener("wheel", (e) => {
  if (state.paused || state.gameOver) return;
  beam.handleEvent(e, state.beam);
  e.preventDefault();
}, { passive: false });

// Restart (R)
window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "r" && state.gameOver) {
    startGame();
  }
});

window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (e.key === "1") state.activeWeapon = "beam";
  if (e.key === "2") state.activeWeapon = "drill";
  if (e.key.toLowerCase() === "m") state.miasmaEnabled = !state.miasmaEnabled; // testing toggle
});

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

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    if (!state.gameOver) togglePause();
    return;
  }
  state.keys.add(e.key.toLowerCase());
});

window.addEventListener("keyup", (e) => {
  state.keys.delete(e.key.toLowerCase());
});

window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (e.key.toLowerCase() === "p") devhud.toggleDevHUD(state);
});

function startGame() {
  // --- Base run/reset ---
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
  state.camera.x = 0;
  state.camera.y = 0;
  state.cameraVel.x = 0;
  state.cameraVel.y = 0;

  // Mouse centered (like a fresh load)
  state.mouse.x = canvas.width / 2;
  state.mouse.y = canvas.height / 2;
  state.pendingMouse.x = state.mouse.x;
  state.pendingMouse.y = state.mouse.y;

  // --- Wind first ---
  state.wind = wind.initWind(config.wind);

  // --- World + systems ---
  state.miasma = miasma.initMiasma(config.dynamicMiasma);

  const wInit = world.initWorld(state.miasma, state.player, config.world);
  state.world = wInit.world;
  state.obstacleGrid = wInit.obstacleGrid;

  state.beam = beam.init(config.beam);

  state.enemies = enemies.initEnemies(state.miasma, config.enemies);
  state.enemyProjectiles.length = 0;
  enemies.spawnInitialEnemies(state, config.enemies.max);

  hud.initHUD(state, config.hud);
}

// ---- Init ----
startGame();
state.drill = drill.initDrill(state.player);
devhud.initDevHUD(state);

// ---- Update ----
function update(dt) {
  state.time += dt;
  state.drillDidHit = false;

  // --- Wind ---
  wind.updateWind(state.wind, dt, config.wind);

  if (state.miasmaEnabled) {
    miasma.updateMiasma(state.miasma, state.wind, dt);
  }

  // movement
  let ax = 0, ay = 0;
  if (state.keys.has('w')) ay -= 1;
  if (state.keys.has('s')) ay += 1;
  if (state.keys.has('a')) ax -= 1;
  if (state.keys.has('d')) ax += 1;

  if (ax || ay) {
    const len = Math.hypot(ax, ay) || 1;
    ax /= len;
    ay /= len;
  }

  const accel = 960;
  const damping = 4;

  state.cameraVel.x += ax * accel * dt;
  state.cameraVel.y += ay * accel * dt;

  state.cameraVel.x -= state.cameraVel.x * damping * dt;
  state.cameraVel.y -= state.cameraVel.y * damping * dt;

  state.camera.x += state.cameraVel.x * dt;
  state.camera.y += state.cameraVel.y * dt;

  world.collideWithObstacles(state.miasma, state.obstacleGrid, state.camera, state.player.r);
  world.clampToWorld(state.world, state.camera, state.player);

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
  const cx = Math.round(w / 2);
  const cy = Math.round(h / 2);
  const camDraw = {
    x: Math.round(state.camera.x),
    y: Math.round(state.camera.y),
  };

  ctx.fillStyle = "#0c0b10";
  ctx.fillRect(0, 0, w, h);

  if (state.activeWeapon === "beam") {
    beam.update(state.beam, state.mouse, cx, cy);
    if (state.miasmaEnabled && !state.paused && !state.gameOver) {
      miasma.clearWithBeam(state.miasma, state.beam, state.camera, state.time, cx, cy);
    }
  }

  world.drawObstacles(ctx, state.miasma, state.obstacleGrid, camDraw, cx, cy);
  enemies.drawEnemies(ctx, state, cx, cy);
  pickups.drawPickups(ctx, state.pickups, camDraw, cx, cy);

  if (state.miasmaEnabled) {
    miasma.drawMiasma(ctx, state.miasma, camDraw, cx, cy, w, h);
  }

  world.drawWorldBorder(ctx, state.world, camDraw, cx, cy);

  if (state.activeWeapon === "beam") {
    beam.draw(ctx, state.beam, cx, cy);
  } else if (state.activeWeapon === "drill") {
    drill.drawDrill(ctx, state.drill, state.mouse, state.activeWeapon, cx, cy, state.drillOverheated);
  }

  ctx.fillStyle = "#9a3b31";
  ctx.beginPath();
  ctx.arc(cx, cy, state.player.r, 0, Math.PI * 2);
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
