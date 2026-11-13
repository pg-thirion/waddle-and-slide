import { describe, it, expect } from 'vitest';
import { LeopardSeal } from '../src/core/chaser';

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

  it('Review Focus #4: cleanly clamps distance to 0 and triggers CAUGHT without negative overshoot', () => {
    const seal = new LeopardSeal(20);
    // Player stationary, seal lunges with high speed
    seal.update(1.0, 0);
    expect(seal.trailingDistance).toBe(0);
    expect(seal.threatLevel).toBe('CAUGHT');
    expect(seal.isCaught).toBe(true);
  });
});
