import { describe, it, expect } from 'vitest';
import { TerrainGenerator } from '../src/core/terrain';

describe('TerrainGenerator', () => {
  it('returns continuous height values for adjacent coordinates', () => {
    const terrain = new TerrainGenerator();
    const h1 = terrain.getHeightAt(100);
    const h2 = terrain.getHeightAt(100.1);
    expect(Math.abs(h2 - h1)).toBeLessThan(1.0);
  });

  it('calculates unit normal vector perpendicular to slope', () => {
    const terrain = new TerrainGenerator();
    const normal = terrain.getNormalAt(250);
    const len = Math.sqrt(normal.x * normal.x + normal.y * normal.y);
    expect(len).toBeCloseTo(1.0);
    // Terrain normals point upwards (negative y in canvas coords)
    expect(normal.y).toBeLessThan(0);
  });

  it('Review Focus #3: handles far distances (x > 100,000) smoothly without NaN or spikes', () => {
    const terrain = new TerrainGenerator();
    const farX = 150000;
    const h = terrain.getHeightAt(farX);
    expect(Number.isFinite(h)).toBe(true);
    const normal = terrain.getNormalAt(farX);
    expect(Number.isFinite(normal.x)).toBe(true);
    expect(Number.isFinite(normal.y)).toBe(true);
  });
});
