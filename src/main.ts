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

  let started = false;
  let isHoldingSlide = false;
  let lastFishCount = 0;
  let prevThreat = game.chaser.threatLevel;
  let prevGameOver = false;
  let jumpPressed = false;
  let touchStartY = 0;
  let touchStartTime = 0;
  let prevPlayerState = game.player.state;

  // Touch / Pointer controls
  window.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    sound.ensureContext();
    touchStartY = e.clientY;
    touchStartTime = performance.now();

    if (game.stats.gameOver) {
      game.restart();
      sound.playJump();
      isHoldingSlide = false;
      lastFishCount = 0;
      prevThreat = game.chaser.threatLevel;
      prevGameOver = false;
      return;
    }

    started = true;
    isHoldingSlide = true;
    sound.playSlideWoosh(game.player.velocity.x / 1000);
  });

  window.addEventListener('pointerup', (e) => {
    e.preventDefault();
    const dy = touchStartY - e.clientY; // positive = swipe up
    const dt = performance.now() - touchStartTime;

    if (!game.stats.gameOver && dy > 70 && dt < 350) {
      // Swipe up = jump
      jumpPressed = true;
      sound.playJump();
    } else if (isHoldingSlide && !game.stats.gameOver) {
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

      started = true;
      if (!isHoldingSlide) {
        sound.playSlideWoosh(game.player.velocity.x / 1000);
      }
      isHoldingSlide = true;
    }

    if (e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      sound.ensureContext();
      if (!game.stats.gameOver && !e.repeat) {
        started = true;
        jumpPressed = true;
        sound.playJump();
      }
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

  window.addEventListener('blur', () => {
    isHoldingSlide = false;
    jumpPressed = false;
  });

  // Game loop
  let lastTime = performance.now();

  function loop(currentTime: number): void {
    const rawDt = (currentTime - lastTime) / 1000;
    lastTime = currentTime;
    const dt = Math.min(rawDt, 0.1);

    if (started && !document.hidden) game.step(dt, { isHoldingSlide, jumpPressed });
    jumpPressed = false; // consume after one frame

    // Landing sound
    if (game.player.justLanded && prevPlayerState === 'AIRBORNE') {
      sound.playLanding();
    }
    prevPlayerState = game.player.state;

    // Sound effect trigger checks
    if (game.stats.fishCount > lastFishCount) {
      sound.playFishPickup();
      lastFishCount = game.stats.fishCount;
    }

    if (game.crashEvent) {
      sound.playLanding();
      sound.playBrakingScrape();
    }

    if (game.speedBoostPickedUp) {
      sound.playSpeedBoost();
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
    if (!started) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const w = window.innerWidth;
        const h = window.innerHeight;
        ctx.save();
        ctx.fillStyle = 'rgba(10, 30, 48, 0.78)';
        ctx.fillRect(0, 0, w, h);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.min(42, w * 0.085)}px sans-serif`;
        ctx.fillText('WADDLE & SLIDE', w / 2, h * 0.35);
        ctx.font = 'bold 16px sans-serif';
        ctx.fillStyle = '#bdeeff';
        ctx.fillText('Escape the leopard seal!', w / 2, h * 0.44);
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Hold to slide • Release to brake', w / 2, h * 0.53);
        ctx.fillText('Swipe up or press W / ↑ to jump', w / 2, h * 0.59);
        ctx.fillText('Collect fish and aerial power-ups', w / 2, h * 0.65);
        ctx.font = 'bold 17px sans-serif';
        ctx.fillStyle = '#ffe18a';
        ctx.fillText('TAP OR PRESS SPACE TO START', w / 2, h * 0.76);
        ctx.restore();
      }
    }

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
});
