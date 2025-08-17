// core/game.js
import { config } from "../core/config.js";
import { beam, miasma, enemies, pickups, world, drill, wind } from "../systems/index.js";
import { hud, devhud } from "../ui/index.js";
import { createGameState } from "./state.js";




const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha: false });
ctx.imageSmoothingEnabled = false; // keeps pixels crisp (not required, but nice)


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
  if (e.key.toLowerCase() === "m") state.miasmaEnabled = !state.miasmaEnabled; // TODO: remove once miasma testing is complete
});



function togglePause() {
  state.paused = !state.paused;
  if (!state.paused) {
    state.mouse.x = state.pendingMouse.x;
    state.mouse.y = state.pendingMouse.y;
    devhud.applyDevHUD(state);
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
  // base state
  state.miasmaEnabled = true;
  state.time = 0;
  state.dt = 0;
  state.keys.clear();
  state.paused = false;
  state.gameOver = false;
  state.win = false;
  state.damageFlash = 0;
  state.drillHeat = 0;
  state.maxDrillHeat = config.drill.maxHeat;
  state.drillOverheated = false;
  state.drillCoolTimer = 0;
  state.drillDidHit = false;

  // player / run
  state.health = state.maxHealth;
  state.scrap = 0;
  state.pickups.length = 0;
  state.camera.x = 0;
  state.camera.y = 0;

  // keep mouse centered (like a page refresh)
  state.mouse.x = canvas.width / 2;
  state.mouse.y = canvas.height / 2;
  state.pendingMouse.x = state.mouse.x;
  state.pendingMouse.y = state.mouse.y;

  // world + systems (same order as first load)
  state.miasma = miasma.initMiasma(config.miasma);                 // brand-new fog grid
  state.wind = wind.initWind(config.wind);
  const wInit = world.initWorld(state.miasma, state.player, config.world); // world depends on miasma size
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

  // movement
  let vx = 0, vy = 0;
  if (state.keys.has('w')) vy -= 1;
  if (state.keys.has('s')) vy += 1;
  if (state.keys.has('a')) vx -= 1;
  if (state.keys.has('d')) vx += 1;

  if (vx || vy) {
    const len = Math.hypot(vx, vy) || 1;
    vx /= len; 
    vy /= len;
    const speed = 240;
    state.camera.x += vx * speed * dt;
    state.camera.y += vy * speed * dt;

    // Prevent player from passing through obstacles
    world.collideWithObstacles(state.miasma, state.obstacleGrid, state.camera, state.player.r);
  }

  world.clampToWorld(state.world, state.camera, state.player);


// --- Drill carving using triangle hitbox ---
if (state.activeWeapon === "drill" && state.drill && !state.drillOverheated) {
  const tri = drill.getDrillTriangleWorld(state.drill, state.camera, state.mouse);
  if (world.carveObstaclesWithDrillTri(state.miasma, state.obstacleGrid, tri, dt, 2)) {
    state.drillDidHit = true;
  }
}




  wind.updateWind(state.wind, dt, config.wind);
  if (state.miasmaEnabled) {
    miasma.updateMiasma(state.miasma, state.wind, dt);
  }
  enemies.updateEnemies(state, dt);
  pickups.updatePickups(state.pickups, state.camera, state.player, state, dt);

  // Drill heat accumulation & cooling
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

  // Miasma damage
   if (state.miasmaEnabled) {
    const step = state.miasma.tile * 0.5;
    let inFog = false;
    for (let dy = -state.player.r; dy <= state.player.r && !inFog; dy += step) {
      for (let dx = -state.player.r; dx <= state.player.r; dx += step) {
        if (dx*dx + dy*dy > state.player.r * state.player.r) continue;
        const idx = miasma.worldToIdx(state.miasma, state.camera.x + dx, state.camera.y + dy);
        if (miasma.isFog(state.miasma, idx)) { inFog = true; break; }
      }
    }
    if (inFog) {
      state.health -= state.miasma.dps * dt;
      state.damageFlash = 0.2; // trigger red flash
      if (state.health < 0) state.health = 0;
    }
}


  state.damageFlash = Math.max(0, state.damageFlash - dt);

  if (state.health <= 0 && !state.gameOver) {
    state.health = 0;
    state.gameOver = true;
  }

  // --- Laser energy drain/recharge ---
  const beamState = state.beam;
  if (state.activeWeapon === "beam" && beamState.mode === "laser") {
    state.laserEnergy -= config.game.laserDrainRate * dt;
    if (state.laserEnergy <= 0) {
      state.laserEnergy = 0;
      // auto shut off laser if empty
      beamState.t = beamState.tConeEnd - 0.01; // forces it back to cone mode
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

  // 👇 snap screen center and camera only for rendering (prevents seams)
  const cx = Math.round(w / 2);
  const cy = Math.round(h / 2);
  const camDraw = {
    x: Math.round(state.camera.x),
    y: Math.round(state.camera.y),
  };

  // background
  ctx.fillStyle = "#0c0b10";
  ctx.fillRect(0, 0, w, h);

  // Beam sim/UI stays the same; uses screen center (cx, cy)
  if (state.activeWeapon === "beam") {
    beam.update(state.beam, state.mouse, cx, cy);
    if (state.miasmaEnabled && !state.paused && !state.gameOver) {
      // keep using the REAL camera for gameplay/clearing logic
      miasma.clearWithBeam(state.miasma, state.beam, state.camera, cx, cy);
    }
  }

  // ✅ pass the SNAPPED camera to world-space rendering to avoid seams
  world.drawObstacles(ctx, state.miasma, state.obstacleGrid, camDraw, cx, cy);
  enemies.drawEnemies(ctx, state, cx, cy);                   // unchanged (uses state internally)
  pickups.drawPickups(ctx, state.pickups, camDraw, cx, cy);  // now uses camDraw

  if (state.miasmaEnabled) {
    miasma.drawMiasma(ctx, state.miasma, camDraw, cx, cy, w, h); // now uses camDraw
  }

  world.drawWorldBorder(ctx, state.world, camDraw, cx, cy); // now uses camDraw

  if (state.activeWeapon === "beam") {
    beam.draw(ctx, state.beam, cx, cy);
  } else if (state.activeWeapon === "drill") {
    drill.drawDrill(ctx, state.drill, state.mouse, state.activeWeapon, cx, cy, state.drillOverheated);
  }

  // player at screen center
  ctx.fillStyle = "#9a3b31";
  ctx.beginPath();
  ctx.arc(cx, cy, state.player.r, 0, Math.PI * 2);
  ctx.fill();

  if (state.damageFlash > 0) {
    ctx.fillStyle = `rgba(255,0,0,${state.damageFlash * 0.5})`;
    ctx.fillRect(0, 0, w, h);
  }

  // paused overlay
  if (state.paused && !state.gameOver) {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "white";
    ctx.font = "bold 32px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("PAUSED — press Space", w / 2, 64);
  }

  // game over overlay
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

  // Dev HUD: update numbers, then draw the tiny box (top-right)
  devhud.updateDevHUD(state);
  devhud.drawDevHUD(ctx, state);

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
