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
    if (!Number.isFinite(dt) || dt <= 0) return;

    // Substep to ensure stable simulation over variable or large dt
    const maxSubstep = 1 / 120;
    let remaining = Math.min(dt, 1.5);

    while (remaining > 0 && !this.stats.gameOver) {
      const stepDt = Math.min(remaining, maxSubstep);
      this.singleStep(stepDt, input);
      input = { ...input, jumpPressed: false };
      remaining -= stepDt;
    }
  }

  private singleStep(dt: number, input: { isHoldingSlide: boolean; jumpPressed?: boolean }): void {
    if (this.boostTimer > 0) {
      this.boostTimer -= dt;
      this.player.velocity.x = Math.max(this.player.velocity.x, 800);
    }

    const previousPos = { ...this.player.position };
    const previousSealX = previousPos.x - this.chaser.trailingDistance;
    this.player.update(dt, input, this.terrain);
    this.obstacles.spawnAhead(this.player.position.x, this.terrain);


    // Collision handling
    const hits = this.obstacles.checkCollisions(this.player.position, this.player.radius, previousPos);
    for (const hit of hits) {
      if (hit.type === 'FISH' && !hit.collected) {
        hit.collected = true;
        this.stats.fishCount++;
        this.rawScore += 100 * this.player.comboMultiplier;
        if (this.stats.fishCount % 10 === 0) {
          this.boostTimer = 2.0; // 2s speed burst
        }
      } else if (hit.type === 'BOULDER' || hit.type === 'WALRUS' || hit.type === 'ICE_HURDLE') {
        hit.hit = true;
        // Boosts are useful, but careless collisions still cost momentum.
        this.boostTimer = 0;
        const factor = hit.type === 'BOULDER' ? 0.5 : hit.type === 'WALRUS' ? 0.35 : 0.4;
        this.player.velocity.x = Math.max(30, this.player.velocity.x * factor);
        this.player.stumbleTimer = hit.type === 'ICE_HURDLE' ? 0.45 : 0.25;
        if (this.player.state !== 'AIRBORNE') this.player.state = 'WADDLE_BRAKE';
        this.player.comboMultiplier = 1;
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
    const distanceMeters = Math.max(0, (this.player.position.x - 100) / 10);
    // Use actual movement, not post-collision velocity, to keep the seal's world position consistent.
    this.chaser.update(dt, (this.player.position.x - previousPos.x) / dt, distanceMeters);
    const sealX = this.player.position.x - this.chaser.trailingDistance;
    for (const powerUp of this.obstacles.sealPowerUpsBetween(previousSealX, sealX)) {
      powerUp.sealUsed = true;
      if (powerUp.type === 'SPEED_PAD' || powerUp.type === 'RAMP') {
        this.chaser.usePowerUp(powerUp.type);
      }
    }
    this.obstacles.cullBehind(this.player.position.x, sealX);
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
