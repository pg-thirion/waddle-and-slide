import { ThreatLevel } from './types';

export class LeopardSeal {
  trailingDistance: number;
  speed: number;
  threatLevel: ThreatLevel;
  isCaught: boolean;

  constructor(initialDistance: number = 350) {
    this.trailingDistance = initialDistance;
    this.speed = 180; // Baseline pursuit speed in px/s
    this.isCaught = initialDistance <= 0;
    this.threatLevel = this.computeThreatLevel();
  }

  update(dt: number, playerSpeed: number): void {
    if (this.isCaught) {
      this.trailingDistance = 0;
      this.threatLevel = 'CAUGHT';
      return;
    }

    // Dynamic seal aggression: catches up faster if player is crawling
    let effectiveSealSpeed = this.speed;
    if (playerSpeed < 100) {
      effectiveSealSpeed += (100 - playerSpeed) * 0.5;
    }

    const deltaDist = (playerSpeed - effectiveSealSpeed) * dt;
    this.trailingDistance += deltaDist;

    // Review Focus #4: Clean clamp to 0 and trigger CAUGHT without negative overshoot
    if (this.trailingDistance <= 0) {
      this.trailingDistance = 0;
      this.isCaught = true;
      this.threatLevel = 'CAUGHT';
      return;
    }

    // Max distance clamp so player doesn't leave seal behind forever
    this.trailingDistance = Math.min(this.trailingDistance, 600);
    this.threatLevel = this.computeThreatLevel();
  }

  private computeThreatLevel(): ThreatLevel {
    if (this.trailingDistance <= 0) {
      return 'CAUGHT';
    }
    if (this.trailingDistance <= 100) {
      return 'RED';
    }
    if (this.trailingDistance <= 250) {
      return 'YELLOW';
    }
    return 'CALM';
  }
}
