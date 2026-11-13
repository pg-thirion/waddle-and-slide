import { describe, it, expect } from 'vitest';
import { ObstacleManager } from '../src/core/obstacles';
import { TerrainGenerator } from '../src/core/terrain';

describe('ObstacleManager', () => {
  it('spawns entities ahead of player and removes entities behind', () => {
    const terrain = new TerrainGenerator();
    const manager = new ObstacleManager();
    manager.spawnAhead(500, terrain);
    expect(manager.entities.length).toBeGreaterThan(0);

    const initialCount = manager.entities.length;
    manager.cullBehind(2000);
    expect(manager.entities.length).toBeLessThan(initialCount);
  });

  it('detects collisions between player and entities within radius', () => {
    const manager = new ObstacleManager();
    manager.entities = [
      { id: 1, type: 'BOULDER', position: { x: 100, y: 100 }, radius: 20 },
      { id: 2, type: 'FISH', position: { x: 500, y: 500 }, radius: 10 }
    ];

    const hits = manager.checkCollisions({ x: 110, y: 100 }, 15);
    expect(hits.length).toBe(1);
    expect(hits[0].id).toBe(1);
  });

  it('Review Focus #5: handles multiple simultaneous pickup collisions in one step', () => {
    const manager = new ObstacleManager();
    manager.entities = [
      { id: 10, type: 'FISH', position: { x: 200, y: 200 }, radius: 15 },
      { id: 11, type: 'FISH', position: { x: 205, y: 200 }, radius: 15 }
    ];

    const hits = manager.checkCollisions({ x: 202, y: 200 }, 20);
    expect(hits.length).toBe(2);
    hits.forEach(h => { h.collected = true; });
    const remainingUncollected = manager.entities.filter(e => !e.collected);
    expect(remainingUncollected.length).toBe(0);
  });
});
