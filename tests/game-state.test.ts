import { describe, it, expect } from 'vitest';
import { GameSimulation } from '../src/core/game-state';

describe('GameSimulation Master Controller', () => {
  it('initializes with default starting state', () => {
    const game = new GameSimulation();
    expect(game.stats.score).toBe(0);
    expect(game.stats.distanceMeters).toBe(0);
    expect(game.stats.gameOver).toBe(false);
  });

  it('updates distance, score, and advances player on step', () => {
    const game = new GameSimulation();
    game.step(0.1, { isHoldingSlide: true });
    expect(game.stats.distanceMeters).toBeGreaterThan(0);
    expect(game.stats.score).toBeGreaterThan(0);
  });

  it('ends game when chaser catches player', () => {
    const game = new GameSimulation();
    game.chaser.trailingDistance = 5;
    // Step with player stopped
    game.player.velocity = { x: 0, y: 0 };
    game.step(1.0, { isHoldingSlide: false });
    expect(game.stats.gameOver).toBe(true);
  });

  it('restarts game cleanly resetting positions and chaser distance', () => {
    const game = new GameSimulation();
    game.stats.gameOver = true;
    game.stats.score = 500;
    game.restart();
    expect(game.stats.gameOver).toBe(false);
    expect(game.stats.score).toBe(0);
    expect(game.stats.highScore).toBe(500);
  });

  it('Critical #2: obstacle collision penalty is applied once per encounter without multi-frame crush', () => {
    const game = new GameSimulation();
    // Place a boulder right in front of player
    game.obstacles.entities = [
      { id: 99, type: 'BOULDER', position: { x: 120, y: game.terrain.getHeightAt(120) }, radius: 25 }
    ];
    game.player.velocity = { x: 400, y: 0 };

    // Step across the boulder across several frames
    for (let i = 0; i < 5; i++) {
      game.step(0.016, { isHoldingSlide: true });
    }

    // Speed should have taken single 50% hit (~200 px/s), NOT 0.5^5 (~12.5 px/s)
    expect(game.player.velocity.x).toBeGreaterThan(120);
  });

  it('allows a forgiving opening before increasing pursuit pressure', () => {
    const game = new GameSimulation();
    for (let i = 0; i < 180; i++) game.step(1 / 60, { isHoldingSlide: true });
    expect(game.stats.gameOver).toBe(false);
    expect(game.stats.distanceMeters).toBeGreaterThan(50);
  });

  it('a hurdle cancels a player boost and slows the player', () => {
    const game = new GameSimulation();
    game.obstacles.entities = [
      { id: 99, type: 'ICE_HURDLE', position: { x: 125, y: game.terrain.getHeightAt(125) - 24 }, radius: 24 }
    ];
    game.boostTimer = 3;
    game.step(0.05, { isHoldingSlide: true });
    expect(game.boostTimer).toBe(0);
    expect(game.player.velocity.x).toBeLessThan(500);
  });

  it('the seal can use a pad already collected by the penguin', () => {
    const game = new GameSimulation();
    game.chaser.trailingDistance = 500;
    game.obstacles.entities = [
      { id: 99, type: 'SPEED_PAD', position: { x: -399, y: 0 }, radius: 20, collected: true }
    ];
    game.step(0.05, { isHoldingSlide: true });
    expect(game.chaser.boostTimer).toBeGreaterThan(0);
    expect(game.obstacles.entities[0].sealUsed).toBe(true);
  });

  it('Important #1: accumulates score at baseline walking speed at 60 FPS', () => {
    const game = new GameSimulation();
    game.player.velocity = { x: 150, y: 0 };

    // 60 frames of 16ms
    for (let i = 0; i < 60; i++) {
      game.step(0.016, { isHoldingSlide: false });
    }

    expect(game.stats.score).toBeGreaterThan(0);
  });
});
