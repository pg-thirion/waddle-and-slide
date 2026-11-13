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

  it('detects a swept hurdle collision at high speed', () => {
    const manager = new ObstacleManager();
    manager.entities = [{ id: 1, type: 'ICE_HURDLE', position: { x: 100, y: 100 }, radius: 24 }];
    expect(manager.checkCollisions({ x: 200, y: 100 }, 16, { x: 0, y: 100 })).toHaveLength(1);
    expect(manager.checkCollisions({ x: 200, y: 20 }, 16, { x: 0, y: 20 })).toHaveLength(0);
  });

  it('keeps collected pads until the pursuing seal passes', () => {
    const manager = new ObstacleManager();
    manager.entities = [{ id: 1, type: 'SPEED_PAD', position: { x: 100, y: 100 }, radius: 20, collected: true }];
    manager.cullBehind(2000, 50);
    expect(manager.sealPowerUpsBetween(50, 150)).toHaveLength(1);
    manager.entities[0].sealUsed = true;
    expect(manager.sealPowerUpsBetween(50, 150)).toHaveLength(0);
  });

  it('spawns high aerial rewards and magnet attracts only fish', () => {
    const terrain = new TerrainGenerator();
    const manager = new ObstacleManager();
    manager.spawnAhead(5000, terrain);
    expect(manager.entities.some(e => terrain.getHeightAt(e.position.x) - e.position.y >= 150)).toBe(true);
    expect(manager.entities.some(e => e.type === 'MAGNET')).toBe(true);
    expect(manager.entities.some(e => e.type === 'WALRUS')).toBe(true);
    expect(manager.entities.some(e => e.type === 'SHIELD')).toBe(true);
    manager.entities = [
      { id: 1, type: 'FISH', position: { x: 120, y: 0 }, radius: 16 },
      { id: 2, type: 'WALRUS', position: { x: 120, y: 0 }, radius: 32 }
    ];
    expect(manager.checkCollisions({ x: 0, y: 0 }, 16, { x: 0, y: 0 }, 145).map(e => e.id)).toEqual([1]);
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
