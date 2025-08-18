import { describe, it, expect } from 'vitest';

import { config } from '../core/config.js';
import { createRNG } from '../engine/rng.js';
import { beam, drill, enemies, miasma, world, wind } from '../systems/index.js';

describe('core systems', () => {
  it('initialize without throwing', () => {
    const rng = createRNG(123);
    const player = { x: 0, y: 0, r: 18 };

    expect(() => {
      const windState = wind.initWind(config.weather.wind, rng);
      const miasmaState = miasma.init(config.dynamicMiasma, rng);
      const worldState = world.init(miasmaState, player, config.world, rng);
      const beamState = beam.init(config.beam);
      const enemyState = enemies.initEnemies(miasmaState, config.enemies);
      drill.initDrill(player);

      // use variables to avoid unused warnings
      void windState;
      void worldState;
      void beamState;
      void enemyState;
    }).not.toThrow();
  });
});

