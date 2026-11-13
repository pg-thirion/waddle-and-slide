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
});
