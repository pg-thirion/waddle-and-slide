import { ThreatLevel, WorldEntity } from './types';

// A world-space jump arc is independent of frame rate and pursuit speed.
// Keep the seal airborne until its entire body has cleared the obstacle.
export function sealObstacleJumpHeight(sealX: number, entities: readonly WorldEntity[]): number {
  let height = 0;
  const smooth = (t: number): number => {
    const u = Math.max(0, Math.min(1, t));
    return u * u * (3 - 2 * u);
  };

  for (const entity of entities) {
    // A player collision does not remove the physical obstacle.
    if (entity.type !== 'BOULDER' && entity.type !== 'WALRUS' && entity.type !== 'ICE_HURDLE') continue;
    const relativeX = sealX - entity.position.x;
    const clear = entity.radius + 42;
    const approach = clear + 150;
    const departure = clear + 125;
    if (relativeX <= -approach || relativeX >= departure) continue;

    const peak = entity.type === 'WALRUS' ? 110 : entity.type === 'ICE_HURDLE' ? 105 : 90;
    const rise = smooth((relativeX + approach) / (approach - clear));
    const fall = smooth((departure - relativeX) / (departure - clear));
    // Blend overlapping obstacle arcs without snapping back to the ground.
    height = Math.max(height, peak * Math.min(rise, fall));
  }
  return height;
}

export class LeopardSeal {
  trailingDistance: number;
  speed: number;
  threatLevel: ThreatLevel;
  isCaught: boolean;
  boostTimer = 0;
  rampTimer = 0;

  constructor(initialDistance: number = 350) {
    this.trailingDistance = initialDistance;
    this.speed = 180;
    this.isCaught = initialDistance <= 0;
    this.threatLevel = this.computeThreatLevel();
  }

  usePowerUp(type: 'SPEED_PAD' | 'RAMP'): boolean {
    // Catch-up tools, not unavoidable attacks at close range.
    if (this.isCaught || this.trailingDistance < 320) return false;
    if (type === 'SPEED_PAD') this.boostTimer = Math.max(this.boostTimer, 1.8);
    else this.rampTimer = Math.max(this.rampTimer, 0.8);
    return true;
  }

  update(dt: number, playerSpeed: number, distanceMeters = 0): void {
    if (this.isCaught) {
      this.trailingDistance = 0;
      this.threatLevel = 'CAUGHT';
      return;
    }

    // Gradual progression and gap-dependent pursuit. No teleporting or distance cap.
    const difficulty = Math.min(1, Math.max(0, distanceMeters / 4500));
    const catchUp = Math.max(0, Math.min(1, (this.trailingDistance - 220) / 330));
    const opening = Math.min(1, Math.max(0, (distanceMeters - 500) / 1000));
    const lunge = 85 + 150 * Math.max(0, 1 - this.trailingDistance / 100);
    const base = Math.max(lunge, 85 + opening * 105 + difficulty * 310);
    const relative = playerSpeed * (0.55 + 0.19 * opening + (0.45 - 0.19 * opening) * catchUp)
      + 10 + opening * 15 + difficulty * 75 + catchUp * 100;
    const power = (this.boostTimer > 0 ? 240 : 0) + (this.rampTimer > 0 ? 100 : 0);
    const target = Math.min(1850, Math.max(base, relative) + power * catchUp);
    // Accelerate smoothly, and back off quickly when the penguin earns an escape.
    const rate = target > this.speed ? 950 : 1600;
    this.speed += Math.max(-rate * dt, Math.min(rate * dt, target - this.speed));
    this.boostTimer = Math.max(0, this.boostTimer - dt);
    this.rampTimer = Math.max(0, this.rampTimer - dt);
    this.trailingDistance += (playerSpeed - this.speed) * dt;

    if (this.trailingDistance <= 0) {
      this.trailingDistance = 0;
      this.isCaught = true;
    }
    this.threatLevel = this.computeThreatLevel();
  }

  private computeThreatLevel(): ThreatLevel {
    if (this.trailingDistance <= 0) return 'CAUGHT';
    if (this.trailingDistance <= 100) return 'RED';
    if (this.trailingDistance <= 250) return 'YELLOW';
    return 'CALM';
  }
}
