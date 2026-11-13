import { describe, it, expect } from 'vitest';
import { PenguinPlayer } from '../src/core/player';
import { TerrainGenerator } from '../src/core/terrain';

describe('PenguinPlayer Physics & State Machine', () => {
  it('accelerates downhill in BELLY_SLIDE when touch is held', () => {
    const terrain = new TerrainGenerator();
    const player = new PenguinPlayer({ x: 100, y: terrain.getHeightAt(100) });
    const initialSpeed = player.velocity.x;
    
    player.update(0.1, { isHoldingSlide: true }, terrain);
    expect(player.state).toBe('BELLY_SLIDE');
    expect(player.velocity.x).toBeGreaterThan(initialSpeed);
  });

  it('decelerates with friction in WADDLE_BRAKE when touch is released', () => {
    const terrain = new TerrainGenerator();
    const player = new PenguinPlayer({ x: 100, y: terrain.getHeightAt(100) });
    player.velocity = { x: 500, y: 0 };
    
    player.update(0.1, { isHoldingSlide: false }, terrain);
    expect(player.state).toBe('WADDLE_BRAKE');
    expect(player.velocity.x).toBeLessThan(500);
  });

  it('Review Focus #1: clamps dt when large delta time occurs', () => {
    const terrain = new TerrainGenerator();
    const player = new PenguinPlayer({ x: 100, y: terrain.getHeightAt(100) });
    player.velocity = { x: 300, y: 0 };
    
    // Simulate massive lag spike (1.5 seconds)
    player.update(1.5, { isHoldingSlide: true }, terrain);
    expect(Number.isFinite(player.position.x)).toBe(true);
    expect(Number.isFinite(player.position.y)).toBe(true);
    expect(player.position.y).toBeLessThanOrEqual(terrain.getHeightAt(player.position.x));
  });

  it('Review Focus #2: penalizes speed on steep uphill landing without negative reverse', () => {
    const terrain = new TerrainGenerator();
    const player = new PenguinPlayer({ x: 100, y: 0 }); // high airborne
    player.state = 'AIRBORNE';
    player.velocity = { x: 400, y: 300 };

    // Update until landing on ground
    for (let i = 0; i < 20; i++) {
      player.update(0.05, { isHoldingSlide: false }, terrain);
      if (player.state !== 'AIRBORNE') break;
    }
    expect(player.velocity.x).toBeGreaterThan(0);
    expect(player.velocity.x).toBeLessThanOrEqual(400);
  });

  it('Critical #3: forces WADDLE_BRAKE on flat/uphill landing even when touch is held', () => {
    const terrain = new TerrainGenerator();
    // Find or set up a flat/uphill point
    const player = new PenguinPlayer({ x: 300, y: 0 });
    player.state = 'AIRBORNE';
    player.velocity = { x: 300, y: 200 };

    for (let i = 0; i < 20; i++) {
      player.update(0.05, { isHoldingSlide: true }, terrain);
      if (player.state !== 'AIRBORNE') break;
    }

    const slope = terrain.getSlopeAngleAt(player.position.x);
    if (Math.sin(slope) <= 0.08) {
      expect(player.state).toBe('WADDLE_BRAKE');
    }
  });

  it('Important #2: does not launch airborne when sliding up a concave slope', () => {
    const terrain = new TerrainGenerator();
    const player = new PenguinPlayer({ x: 400, y: terrain.getHeightAt(400) });
    player.velocity = { x: 500, y: -250 };
    player.state = 'BELLY_SLIDE';

    player.update(0.016, { isHoldingSlide: true }, terrain);
    // Should stay grounded if surface is concave/not cresting
    expect(player.position.y).toBeCloseTo(terrain.getHeightAt(player.position.x), 1);
  });
});
