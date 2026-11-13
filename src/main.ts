import { GameSimulation } from './core/game-state';
import { CanvasView } from './render/canvas-view';
import { SoundEngine } from './audio/sound-effects';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) return;

  const game = new GameSimulation();
  const view = new CanvasView(canvas);
  const sound = new SoundEngine();

  view.resize();
  window.addEventListener('resize', () => view.resize());

  let isHoldingSlide = false;
  let lastFishCount = 0;
  let prevThreat = game.chaser.threatLevel;
  let prevGameOver = false;

  // Touch / Pointer controls
  window.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    sound.ensureContext();

    if (game.stats.gameOver) {
      game.restart();
      sound.playJump();
      isHoldingSlide = false;
      lastFishCount = 0;
      prevThreat = game.chaser.threatLevel;
      prevGameOver = false;
      return;
    }

    isHoldingSlide = true;
    sound.playSlideWoosh(game.player.velocity.x / 1000);
  });

  window.addEventListener('pointerup', (e) => {
    e.preventDefault();
    if (isHoldingSlide && !game.stats.gameOver) {
      sound.playBrakingScrape();
    }
    isHoldingSlide = false;
  });

  window.addEventListener('pointercancel', () => {
    isHoldingSlide = false;
  });

  // Keyboard controls for desktop development
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowDown') {
      e.preventDefault();
      sound.ensureContext();

      if (game.stats.gameOver) {
        game.restart();
        sound.playJump();
        isHoldingSlide = false;
        lastFishCount = 0;
        prevThreat = game.chaser.threatLevel;
        prevGameOver = false;
        return;
      }

      if (!isHoldingSlide) {
        sound.playSlideWoosh(game.player.velocity.x / 1000);
      }
      isHoldingSlide = true;
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowDown') {
      e.preventDefault();
      if (isHoldingSlide && !game.stats.gameOver) {
        sound.playBrakingScrape();
      }
      isHoldingSlide = false;
    }
  });

  // Game loop
  let lastTime = performance.now();

  function loop(currentTime: number): void {
    const rawDt = (currentTime - lastTime) / 1000;
    lastTime = currentTime;
    const dt = Math.min(rawDt, 0.1);

    game.step(dt, { isHoldingSlide });

    // Sound effect trigger checks
    if (game.stats.fishCount > lastFishCount) {
      sound.playFishPickup();
      lastFishCount = game.stats.fishCount;
    }

    if (game.chaser.threatLevel === 'RED' && prevThreat !== 'RED') {
      sound.playRoarAlert();
    }
    prevThreat = game.chaser.threatLevel;

    if (game.stats.gameOver && !prevGameOver) {
      sound.playGameOver();
      prevGameOver = true;
    }

    view.render(game, dt);

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
});
