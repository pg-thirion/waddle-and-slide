import { GameSimulation } from './core/game-state';
import { CanvasView } from './render/canvas-view';
import { SoundEngine } from './audio/sound-effects';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) return;
  const game = new GameSimulation();
  const view = new CanvasView(canvas);
  const sound = new SoundEngine();
  const pauseButton = document.getElementById('pause-button') as HTMLButtonElement;
  const muteButton = document.getElementById('mute-button') as HTMLButtonElement;
  const jumpButton = document.getElementById('jump-button') as HTMLButtonElement;
  const keys = new Set<string>();
  const slideKeys = ['Space', 'ArrowDown', 'KeyS'];
  let pointerId: number | null = null;
  let pointerY = 0;
  let pointerTime = 0;
  let jumpPressed = false;
  let started = false;
  let paused = false;
  let lastTime = performance.now();

  const holding = () => pointerId !== null || slideKeys.some(key => keys.has(key));
  const clearInput = () => {
    keys.clear();
    pointerId = null;
    jumpPressed = false;
  };
  const reset = () => {
    if (game.stats.gameOver) game.restart();
    view.reset(game);
    started = true;
    paused = false;
    lastTime = performance.now();
    pauseButton.textContent = 'Pause';
  };
  const startIfNeeded = () => {
    if (!started || game.stats.gameOver) reset();
  };
  const togglePause = () => {
    if (!started || game.stats.gameOver) return;
    paused = !paused;
    clearInput();
    lastTime = performance.now();
    pauseButton.textContent = paused ? 'Resume' : 'Pause';
    pauseButton.setAttribute('aria-label', paused ? 'Resume game' : 'Pause game');
  };
  const requestJump = () => {
    if (paused) return;
    startIfNeeded();
    sound.ensureContext();
    jumpPressed = true;
  };
  view.resize();
  view.reset(game);
  window.addEventListener('resize', () => {
    view.resize();
    // Do not reset effects; the camera adapts on the next render.
  });

  canvas.addEventListener('pointerdown', e => {
    if (e.button !== 0 || pointerId !== null) return;
    e.preventDefault();
    sound.ensureContext();
    if (paused) { togglePause(); return; }
    startIfNeeded();
    pointerId = e.pointerId;
    pointerY = e.clientY;
    pointerTime = performance.now();
    canvas.setPointerCapture(e.pointerId);
    sound.playSlideWoosh(game.player.velocity.x / 1000);
  });
  const releasePointer = (e: PointerEvent, cancelled = false) => {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    if (cancelled || paused || game.stats.gameOver) return;
    if (pointerY - e.clientY > 55 && performance.now() - pointerTime < 550) requestJump();
    else if (!holding()) sound.playBrakingScrape();
  };
  canvas.addEventListener('pointerup', e => releasePointer(e));
  canvas.addEventListener('pointercancel', e => releasePointer(e, true));
  canvas.addEventListener('lostpointercapture', e => releasePointer(e, true));
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  window.addEventListener('keydown', e => {
    if (e.target instanceof HTMLButtonElement && (e.code === 'Space' || e.code === 'Enter')) return;
    if (e.code === 'Escape' || e.code === 'KeyP') {
      e.preventDefault();
      if (!e.repeat) togglePause();
      return;
    }
    if (slideKeys.includes(e.code)) {
      e.preventDefault();
      if (e.repeat) return;
      sound.ensureContext();
      if (paused) { togglePause(); return; }
      startIfNeeded();
      if (!holding()) sound.playSlideWoosh(game.player.velocity.x / 1000);
      keys.add(e.code);
    } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      if (!e.repeat) requestJump();
    }
  });
  window.addEventListener('keyup', e => {
    if (!slideKeys.includes(e.code)) return;
    e.preventDefault();
    const wasHolding = holding();
    keys.delete(e.code);
    if (wasHolding && !holding() && !paused && !game.stats.gameOver) sound.playBrakingScrape();
  });

  pauseButton.addEventListener('click', () => {
    togglePause();
    pauseButton.blur();
  });
  muteButton.addEventListener('click', () => {
    sound.setMuted(!sound.muted);
    if (!sound.muted) sound.ensureContext();
    muteButton.textContent = sound.muted ? 'Sound off' : 'Sound on';
    muteButton.setAttribute('aria-pressed', String(sound.muted));
    try { localStorage.setItem('waddle_muted', String(sound.muted)); } catch { /* storage unavailable */ }
    muteButton.blur();
  });
  try {
    if (localStorage.getItem('waddle_muted') === 'true') {
      sound.setMuted(true);
      muteButton.textContent = 'Sound off';
      muteButton.setAttribute('aria-pressed', 'true');
    }
  } catch { /* storage unavailable */ }
  jumpButton.addEventListener('pointerdown', e => {
    e.preventDefault();
    requestJump();
  });
  jumpButton.addEventListener('click', e => {
    if (e.detail === 0) requestJump();
  });
  const suspend = () => {
    clearInput();
    if (started && !paused && !game.stats.gameOver) togglePause();
  };
  window.addEventListener('blur', suspend);
  document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); });

  function overlay(title: string, subtitle: string, instructions: string[]): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const center = w / 2;
    const top = h * 0.30;
    const line = Math.min(32, h * 0.065);
    ctx.save();
    ctx.fillStyle = 'rgba(10,30,48,.82)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.min(42, w * 0.085)}px sans-serif`;
    ctx.fillText(title, center, top, w - 24);
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = '#bdeeff';
    ctx.fillText(subtitle, center, top + line * 1.5, w - 24);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#fff';
    instructions.forEach((text, i) => ctx.fillText(text, center, top + line * (3 + i), w - 24));
    ctx.restore();
  }

  function loop(now: number): void {
    const dt = Math.max(0, Math.min((now - lastTime) / 1000, 0.1));
    lastTime = now;
    const active = started && !paused && !document.hidden && !game.stats.gameOver;
    if (active && dt > 0) {
      const fishBefore = game.stats.fishCount;
      const threatBefore = game.chaser.threatLevel;
      game.step(dt, { isHoldingSlide: holding(), jumpPressed });
      jumpPressed = false;
      if (game.jumpEvent) sound.playJump();
      if (game.landedEvent) sound.playLanding();
      if (game.stats.fishCount > fishBefore) sound.playFishPickup();
      if (game.crashEvent) { sound.playLanding(); sound.playBrakingScrape(); }
      if (game.speedBoostPickedUp) sound.playSpeedBoost();
      if (game.chaser.threatLevel === 'RED' && threatBefore !== 'RED') sound.playRoarAlert();
      if (game.stats.gameOver) { sound.playGameOver(); clearInput(); }
    }
    view.render(game, active ? dt : 0);
    pauseButton.disabled = !started || game.stats.gameOver;
    if (!started) overlay('WADDLE & SLIDE', 'Escape the leopard seal!', [
      'Hold the screen or Space to slide', 'Release to brake • Swipe up, W or Jump to leap',
      'Collect fish and dodge ice and walruses', 'TAP OR PRESS SPACE TO START'
    ]);
    else if (paused) overlay('PAUSED', 'Take a breather', ['Tap the screen, press Space or Resume']);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
});
