import { describe, it, expect } from 'vitest';
import { LeopardSeal, sealObstacleJumpHeight } from '../src/core/chaser';
import { WorldEntity } from '../src/core/types';

describe('LeopardSeal Chaser System', () => {
  it('closes distance when player speed is below baseline', () => {
    const seal = new LeopardSeal(350);
    seal.update(1.0, 50); // player moving very slowly
    expect(seal.trailingDistance).toBeLessThan(350);
  });

  it('calculates threat levels correctly according to distance thresholds', () => {
    const seal = new LeopardSeal(300);
    expect(seal.threatLevel).toBe('CALM');

    seal.update(1.0, 0); // distance drops
    seal.trailingDistance = 180;
    seal.update(0.01, 100);
    expect(seal.threatLevel).toBe('YELLOW');

    seal.trailingDistance = 80;
    seal.update(0.01, 100);
    expect(seal.threatLevel).toBe('RED');
  });

  it('closes a large gap even at high player speed without teleporting', () => {
    const seal = new LeopardSeal(850);
    for (let i = 0; i < 960; i++) seal.update(1 / 120, 1200, 800);
    expect(seal.trailingDistance).toBeLessThan(850);
    expect(seal.trailingDistance).toBeGreaterThan(0);
  });

  it('uses catch-up power-ups only when sufficiently far behind', () => {
    const seal = new LeopardSeal(500);
    expect(seal.usePowerUp('SPEED_PAD')).toBe(true);
    expect(seal.boostTimer).toBeGreaterThan(0);
    expect(seal.usePowerUp('RAMP')).toBe(true);
    expect(seal.rampTimer).toBeGreaterThan(0);
    seal.trailingDistance = 100;
    expect(seal.usePowerUp('SPEED_PAD')).toBe(false);
  });

  it('leaps over boulders, walruses and ice hurdles before reaching them', () => {
    const hazards: WorldEntity[] = [
      { id: 1, type: 'BOULDER', position: { x: 1000, y: 400 }, radius: 16 },
      { id: 2, type: 'WALRUS', position: { x: 1800, y: 400 }, radius: 32, hit: true },
      { id: 3, type: 'ICE_HURDLE', position: { x: 2600, y: 400 }, radius: 24 }
    ];
    for (const hazard of hazards) {
      const x = hazard.position.x;
      expect(sealObstacleJumpHeight(x - 300, hazards)).toBe(0);
      expect(sealObstacleJumpHeight(x - 120, hazards)).toBeGreaterThan(0);
      expect(sealObstacleJumpHeight(x - 50, hazards)).toBeGreaterThan(80);
      expect(sealObstacleJumpHeight(x, hazards)).toBeGreaterThan(80);
      expect(sealObstacleJumpHeight(x + 50, hazards)).toBeGreaterThan(80);
      expect(sealObstacleJumpHeight(x + 120, hazards)).toBeGreaterThan(0);
      expect(sealObstacleJumpHeight(x + 300, hazards)).toBe(0);
    }
  });

  it('ignores fish and pickups while blending nearby hazard jumps', () => {
    const hazards: WorldEntity[] = [
      { id: 1, type: 'FISH', position: { x: 100, y: 400 }, radius: 16 },
      { id: 2, type: 'WALRUS', position: { x: 600, y: 400 }, radius: 32 },
      { id: 3, type: 'ICE_HURDLE', position: { x: 780, y: 400 }, radius: 24 }
    ];
    expect(sealObstacleJumpHeight(100, hazards)).toBe(0);
    expect(sealObstacleJumpHeight(690, hazards)).toBeGreaterThan(80);
    expect(sealObstacleJumpHeight(1100, hazards)).toBe(0);
  });

  it('Review Focus #4: cleanly clamps distance to 0 and triggers CAUGHT without negative overshoot', () => {
    const seal = new LeopardSeal(20);
    // Player stationary, seal lunges with high speed
    seal.update(1.0, 0);
    expect(seal.trailingDistance).toBe(0);
    expect(seal.threatLevel).toBe('CAUGHT');
    expect(seal.isCaught).toBe(true);
  });
});
