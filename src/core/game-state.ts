import { GameStats, PlayerInput } from './types';
import { vec2 } from './vector';
import { TerrainGenerator } from './terrain';
import { PenguinPlayer } from './player';
import { LeopardSeal } from './chaser';
import { ObstacleManager } from './obstacles';

const STORAGE_KEY = 'waddle_and_slide_highscore';
const DISTANCE_KEY = 'waddle_and_slide_bestdistance';

function loadBestDistance(): number {
  try {
    return Math.max(0, Number(localStorage.getItem(DISTANCE_KEY)) || 0);
  } catch { return 0; }
}

function saveBestDistance(distance: number): void {
  try { localStorage.setItem(DISTANCE_KEY, String(distance)); } catch { /* unavailable */ }
}

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
  magnetTimer = 0;
  shieldActive = false;
  crashTimer = 0;
  crashEvent = false;
  pickupMessage = '';
  pickupMessageTimer = 0;
  airTime = 0;
  landedEvent = false;
  jumpEvent = false;
  private lastMilestone = 0;
  private clearedHazards = new Set<number>();

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
      bestDistance: loadBestDistance(),
      elapsedSeconds: 0,
      hazardsCleared: 0,
      gameOver: false
    };

    // Pre-populate obstacles ahead
    this.obstacles.spawnAhead(startX, this.terrain);
  }

  step(dt: number, input: PlayerInput): void {
    this.crashEvent = false;
    this.speedBoostPickedUp = false;
    this.landedEvent = false;
    this.jumpEvent = false;
    if (this.stats.gameOver) return;
    if (!Number.isFinite(dt) || dt <= 0) return;

    // Substep to ensure stable simulation over variable or large dt
    const maxSubstep = 1 / 120;
    let remaining = Math.min(dt, 1.5);

    while (remaining > 1e-9 && !this.stats.gameOver) {
      const stepDt = Math.min(remaining, maxSubstep);
      this.singleStep(stepDt, input);
      input = { ...input, jumpPressed: false };
      remaining -= stepDt;
    }
  }

  private singleStep(dt: number, input: PlayerInput): void {
    this.stats.elapsedSeconds += dt;
    const recovering = this.crashTimer > 0;
    this.magnetTimer = Math.max(0, this.magnetTimer - dt);
    this.crashTimer = Math.max(0, this.crashTimer - dt);
    this.pickupMessageTimer = Math.max(0, this.pickupMessageTimer - dt);
    if (recovering) this.boostTimer = 0;
    if (this.boostTimer > 0) {
      this.boostTimer = Math.max(0, this.boostTimer - dt);
      this.player.velocity.x = Math.max(this.player.velocity.x, 800);
    }

    const previousPos = { ...this.player.position };
    const previousSealX = previousPos.x - this.chaser.trailingDistance;
    this.player.update(dt, { ...input, speedLimit: recovering ? 95 : 1500 }, this.terrain);
    this.landedEvent ||= this.player.justLanded;
    this.jumpEvent ||= this.player.justJumped;
    if (this.player.state === 'AIRBORNE') this.airTime += dt;
    else if (this.airTime > 0) {
      if (this.airTime >= 0.8) {
        this.rawScore += Math.floor(this.airTime * 150) * this.player.comboMultiplier;
        this.announce('AIRTIME BONUS');
      }
      this.airTime = 0;
    }
    this.obstacles.spawnAhead(this.player.position.x, this.terrain);


    // Collision handling
    const hits = this.obstacles.checkCollisions(this.player.position, this.player.radius, previousPos, this.magnetTimer > 0 ? 145 : 0);
    for (const hit of hits) {
      if ((hit.type === 'FISH' || hit.type === 'GOLD_FISH') && !hit.collected) {
        hit.collected = true;
        const gold = hit.type === 'GOLD_FISH';
        this.stats.fishCount++;
        this.rawScore += (gold ? 500 : 100) * this.player.comboMultiplier;
        if (this.crashTimer <= 0) {
          this.player.velocity.x = Math.min(1500, this.player.velocity.x + (gold ? 125 : 38));
          if (this.stats.fishCount % 5 === 0) {
            this.boostTimer = Math.max(this.boostTimer, 1.2);
            this.speedBoostPickedUp = true;
            this.announce('FISH FRENZY!');
          } else this.announce(`${gold ? 'GOLD FISH' : 'FISH'} +${(gold ? 500 : 100) * this.player.comboMultiplier}`, false);
        }
      } else if (hit.type === 'SKY_ROCKET' && !hit.collected) {
        hit.collected = true;
        if (recovering) continue;
        this.boostTimer = Math.max(this.boostTimer, 2.2);
        this.player.velocity.x = Math.max(this.player.velocity.x, 1100);
        this.speedBoostPickedUp = true;
        this.announce('SKY ROCKET!');
      } else if (hit.type === 'MAGNET' && !hit.collected) {
        hit.collected = true;
        this.magnetTimer = 6;
        this.announce('FISH MAGNET!');
      } else if (hit.type === 'SHIELD' && !hit.collected) {
        hit.collected = true;
        this.shieldActive = true;
        this.announce('ICE SHIELD!');
      } else if (hit.type === 'BOULDER' || hit.type === 'WALRUS' || hit.type === 'ICE_HURDLE') {
        hit.hit = true;
        if (this.shieldActive) {
          this.shieldActive = false;
          this.announce('SHIELD SAVED YOU');
          continue;
        }
        this.boostTimer = 0;
        const walrus = hit.type === 'WALRUS';
        const factor = hit.type === 'BOULDER' ? 0.5 : walrus ? 0.18 : 0.4;
        this.player.velocity.x = Math.max(30, this.player.velocity.x * factor);
        this.player.stumbleTimer = walrus ? 0.95 : hit.type === 'ICE_HURDLE' ? 0.45 : 0.25;
        if (walrus) {
          this.crashTimer = 0.95;
          this.player.velocity.x = Math.min(95, this.player.velocity.x);
        }
        this.crashEvent = true;
        this.announce(walrus ? 'WALRUS CRASH!' : 'WATCH OUT!');
        if (this.player.state !== 'AIRBORNE') this.player.state = 'WADDLE_BRAKE';
        this.player.comboMultiplier = 1;
      } else if (hit.type === 'SPEED_PAD' && !hit.collected) {
        hit.collected = true;
        if (recovering) continue;
        this.boostTimer = 3.0;
        this.player.velocity.x = Math.max(this.player.velocity.x, 950);
        this.speedBoostPickedUp = true;
      } else if (hit.type === 'RAMP' && !hit.collected) {
        hit.collected = true;
        if (recovering || this.crashTimer > 0) continue;
        this.player.velocity.y = -800;
        this.player.velocity.x = Math.max(480, this.player.velocity.x);
        this.player.state = 'AIRBORNE';
        this.player.position.y -= 2;
        this.jumpEvent = true;
        this.announce('RAMP LAUNCH!');
        this.player.comboMultiplier = Math.min(this.player.comboMultiplier + 1, 5);
      }
    }

    if (this.crashTimer > 0) {
      this.boostTimer = 0;
      this.player.velocity.x = Math.min(95, this.player.velocity.x);
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
    // Reward clean clears once, even when several simulation steps happen in one frame.
    for (const entity of this.obstacles.entities) {
      if (entity.type !== 'BOULDER' && entity.type !== 'WALRUS' && entity.type !== 'ICE_HURDLE') continue;
      const exitX = entity.position.x + entity.radius + 18;
      if (!entity.hit && !this.clearedHazards.has(entity.id) && previousPos.x < exitX && this.player.position.x >= exitX) {
        this.clearedHazards.add(entity.id);
        this.stats.hazardsCleared++;
        this.rawScore += 150 * this.player.comboMultiplier;
        this.announce('CLEAN CLEAR!', false);
      }
    }
    this.obstacles.cullBehind(this.player.position.x, sealX);
    const liveIds = new Set(this.obstacles.entities.map(e => e.id));
    for (const id of this.clearedHazards) if (!liveIds.has(id)) this.clearedHazards.delete(id);
    if (this.chaser.isCaught) this.stats.gameOver = true;

    // Distance and score metrics
    const distPx = Math.max(0, this.player.position.x - 100);
    this.stats.distanceMeters = Math.floor(distPx / 10);
    this.rawScore += Math.max(0, this.player.position.x - previousPos.x) * 0.2 * this.player.comboMultiplier;
    const milestone = Math.floor(this.stats.distanceMeters / 500);
    if (milestone > this.lastMilestone) {
      this.lastMilestone = milestone;
      this.rawScore += 250;
      this.announce(`${milestone * 500} m! +250`, false);
    }
    this.stats.score = Math.floor(this.rawScore);
    if (this.stats.gameOver) this.saveRecords();
  }

  private announce(message: string, priority = true): void {
    if (!priority && this.pickupMessageTimer > 0.25) return;
    this.pickupMessage = message;
    this.pickupMessageTimer = 0.9;
  }

  private saveRecords(): void {
    if (this.stats.score > this.stats.highScore) {
      this.stats.highScore = this.stats.score;
      saveHighScore(this.stats.highScore);
    }
    if (this.stats.distanceMeters > this.stats.bestDistance) {
      this.stats.bestDistance = this.stats.distanceMeters;
      saveBestDistance(this.stats.bestDistance);
    }
  }

  restart(): void {
    this.saveRecords();
    const highScore = this.stats.highScore;
    const bestDistance = this.stats.bestDistance;
    const startX = 100;
    this.player = new PenguinPlayer(vec2(startX, this.terrain.getHeightAt(startX)));
    this.chaser = new LeopardSeal(350);
    this.obstacles = new ObstacleManager();
    this.obstacles.spawnAhead(startX, this.terrain);
    this.magnetTimer = 0;
    this.shieldActive = false;
    this.crashTimer = 0;
    this.crashEvent = false;
    this.pickupMessage = '';
    this.pickupMessageTimer = 0;
    this.airTime = 0;
    this.landedEvent = false;
    this.jumpEvent = false;
    this.lastMilestone = 0;
    this.clearedHazards.clear();
    this.boostTimer = 0;
    this.speedBoostPickedUp = false;
    this.rawScore = 0;

    this.stats = {
      score: 0,
      distanceMeters: 0,
      fishCount: 0,
      highScore,
      bestDistance,
      elapsedSeconds: 0,
      hazardsCleared: 0,
      gameOver: false
    };
  }
}
