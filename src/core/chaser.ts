import { ThreatLevel } from './types';

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
    const difficulty = Math.min(1, Math.max(0, distanceMeters / 2500));
    const catchUp = Math.max(0, Math.min(1, (this.trailingDistance - 220) / 330));
    const base = 190 + difficulty * 310;
    const relative = playerSpeed * (0.74 + 0.26 * catchUp)
      + 25 + difficulty * 75 + catchUp * 100;
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
