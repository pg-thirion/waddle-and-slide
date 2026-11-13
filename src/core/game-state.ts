import { GameStats } from './types';
import { vec2 } from './vector';
import { TerrainGenerator } from './terrain';
import { PenguinPlayer } from './player';
import { LeopardSeal } from './chaser';
import { ObstacleManager } from './obstacles';

const STORAGE_KEY = 'waddle_and_slide_highscore';

function loadHighScore(): number {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return parseInt(saved, 10) || 0;
    }
  } catch {
    // Ignore storage errors in sandboxed or headless environments
  }
  return 0;
}

function saveHighScore(score: number): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, score.toString());
    }
  } catch {
    // Ignore storage errors
  }
}

export class GameSimulation {
  player: PenguinPlayer;
  terrain: TerrainGenerator;
  chaser: LeopardSeal;
  obstacles: ObstacleManager;
  stats: GameStats;
  boostTimer: number;
  speedBoostPickedUp: boolean;
  private rawScore: number;

  constructor() {
    this.terrain = new TerrainGenerator();
    const startX = 100;
    this.player = new PenguinPlayer(vec2(startX, this.terrain.getHeightAt(startX)));
    this.chaser = new LeopardSeal(350);
    this.obstacles = new ObstacleManager();
    this.boostTimer = 0;
    this.speedBoostPickedUp = false;
    this.rawScore = 0;

    this.stats = {
      score: 0,
      distanceMeters: 0,
      fishCount: 0,
      highScore: loadHighScore(),
      gameOver: false
    };

    // Pre-populate obstacles ahead
    this.obstacles.spawnAhead(startX, this.terrain);
  }

  step(dt: number, input: { isHoldingSlide: boolean; jumpPressed?: boolean }): void {
    if (this.stats.gameOver) return;

    this.speedBoostPickedUp = false;

    // Substep to ensure stable simulation over variable or large dt
    const maxSubstep = 0.05;
    let remaining = Math.min(dt, 1.5);

    while (remaining > 0 && !this.stats.gameOver) {
      const stepDt = Math.min(remaining, maxSubstep);
      this.singleStep(stepDt, input);
      remaining -= stepDt;
    }
  }

  private singleStep(dt: number, input: { isHoldingSlide: boolean; jumpPressed?: boolean }): void {
    if (this.boostTimer > 0) {
      this.boostTimer -= dt;
      this.player.velocity.x = Math.max(this.player.velocity.x, 800);
    }

    this.player.update(dt, input, this.terrain);
    this.obstacles.spawnAhead(this.player.position.x, this.terrain);
    this.obstacles.cullBehind(this.player.position.x);

    // Collision handling
    const hits = this.obstacles.checkCollisions(this.player.position, this.player.radius);
    for (const hit of hits) {
      if (hit.type === 'FISH' && !hit.collected) {
        hit.collected = true;
        this.stats.fishCount++;
        this.rawScore += 100 * this.player.comboMultiplier;
        if (this.stats.fishCount % 10 === 0) {
          this.boostTimer = 2.0; // 2s speed burst
        }
      } else if (hit.type === 'BOULDER') {
        hit.hit = true;
        if (this.boostTimer <= 0) {
          this.player.velocity.x *= 0.5;
          this.player.state = 'WADDLE_BRAKE';
          this.player.comboMultiplier = 1;
        }
      } else if (hit.type === 'WALRUS') {
        hit.hit = true;
        if (this.boostTimer <= 0) {
          this.player.velocity.x = Math.max(30, this.player.velocity.x * 0.3);
          this.player.comboMultiplier = 1;
        }
      } else if (hit.type === 'SPEED_PAD' && !hit.collected) {
        hit.collected = true;
        this.boostTimer = 3.0;
        this.player.velocity.x = Math.max(this.player.velocity.x, 950);
        this.speedBoostPickedUp = true;
      } else if (hit.type === 'RAMP' && !hit.collected) {
        hit.collected = true;
        this.player.velocity.y = -700;
        this.player.state = 'AIRBORNE';
        this.player.comboMultiplier = Math.min(this.player.comboMultiplier + 1, 5);
      }
    }

    // Chaser tracking
    this.chaser.update(dt, this.player.velocity.x);
    if (this.chaser.isCaught) {
      this.stats.gameOver = true;
      if (this.stats.score > this.stats.highScore) {
        this.stats.highScore = this.stats.score;
        saveHighScore(this.stats.highScore);
      }
    }

    // Distance and score metrics
    const distPx = Math.max(0, this.player.position.x - 100);
    this.stats.distanceMeters = Math.floor(distPx / 10);
    this.rawScore += this.player.velocity.x * dt * 0.2 * this.player.comboMultiplier;
    this.stats.score = Math.floor(this.rawScore);
  }

  restart(): void {
    if (this.stats.score > this.stats.highScore) {
      this.stats.highScore = this.stats.score;
      saveHighScore(this.stats.highScore);
    }

    const highScore = this.stats.highScore;
    const startX = 100;
    this.player = new PenguinPlayer(vec2(startX, this.terrain.getHeightAt(startX)));
    this.chaser = new LeopardSeal(350);
    this.obstacles = new ObstacleManager();
    this.obstacles.spawnAhead(startX, this.terrain);
    this.boostTimer = 0;
    this.speedBoostPickedUp = false;
    this.rawScore = 0;

    this.stats = {
      score: 0,
      distanceMeters: 0,
      fishCount: 0,
      highScore,
      gameOver: false
    };
  }
}
