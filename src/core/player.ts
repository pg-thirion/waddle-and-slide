import { Vector2, PlayerState, PlayerInput } from './types';
import { vec2 } from './vector';
import { TerrainGenerator } from './terrain';

export class PenguinPlayer {
  position: Vector2;
  velocity: Vector2;
  state: PlayerState;
  comboMultiplier: number;
  radius: number;

  constructor(startPos: Vector2) {
    this.position = { ...startPos };
    this.velocity = vec2(200, 0);
    this.state = 'WADDLE_BRAKE';
    this.comboMultiplier = 1;
    this.radius = 16;
  }

  update(dt: number, input: PlayerInput, terrain: TerrainGenerator): void {
    // Review Focus #1: Clamp dt to prevent tunneling and NaN during lag spikes
    const clampedDt = Math.max(0.001, Math.min(dt, 0.1));
    const stepSize = 0.016;
    let remaining = clampedDt;

    while (remaining > 0) {
      const step = Math.min(remaining, stepSize);
      this.substep(step, input, terrain);
      remaining -= step;
    }
  }

  private substep(dt: number, input: PlayerInput, terrain: TerrainGenerator): void {
    const g = 980; // gravity px/s^2

    if (this.state === 'AIRBORNE') {
      // Airborne gravity integration
      let gravity = g;
      if (input.isDiveRequested || input.isHoldingSlide) {
        gravity += 450; // extra dive acceleration
      }
      this.velocity.y += gravity * dt;

      this.position.x += this.velocity.x * dt;
      this.position.y += this.velocity.y * dt;

      const groundY = terrain.getHeightAt(this.position.x);

      // Check ground collision
      if (this.position.y >= groundY) {
        this.position.y = groundY;
        const slope = terrain.getSlopeAngleAt(this.position.x);
        const tanX = Math.cos(slope);
        const tanY = Math.sin(slope);

        // Project velocity onto terrain tangent
        const tangentSpeed = this.velocity.x * tanX + this.velocity.y * tanY;

        if (tanY > 0.08) {
          // Smooth downhill landing bonus
          const boost = Math.max(tangentSpeed * 1.15, 250);
          this.velocity.x = Math.max(50, boost * tanX);
          this.velocity.y = this.velocity.x * Math.tan(slope);
          this.comboMultiplier = Math.min(this.comboMultiplier + 1, 5);
        } else {
          // Flat or uphill impact penalty (Review Focus #2: preserve positive direction, no reverse)
          const penalized = Math.max(50, tangentSpeed * 0.7);
          this.velocity.x = Math.max(40, penalized * Math.abs(tanX));
          this.velocity.y = this.velocity.x * Math.tan(slope);
          this.comboMultiplier = 1;
        }

        this.state = input.isHoldingSlide ? 'BELLY_SLIDE' : 'WADDLE_BRAKE';
      }
      return;
    }

    // Grounded physics: WADDLE_BRAKE vs BELLY_SLIDE
    this.state = input.isHoldingSlide ? 'BELLY_SLIDE' : 'WADDLE_BRAKE';
    const slope = terrain.getSlopeAngleAt(this.position.x);
    const sinSlope = Math.sin(slope);
    const cosSlope = Math.cos(slope);

    if (this.state === 'BELLY_SLIDE') {
      const friction = 0.02;
      // Gravity along slope minus friction
      const accel = g * sinSlope - friction * g * cosSlope;
      this.velocity.x += (accel * cosSlope) * dt;
      // Add minimum forward drive so player doesn't freeze on flat terrain
      if (this.velocity.x < 180) {
        this.velocity.x += 120 * dt;
      }
    } else {
      // WADDLE_BRAKE: High friction towards target walking speed (150 px/s)
      const targetSpeed = 150;
      if (this.velocity.x > targetSpeed) {
        const brakeForce = 0.35 * g;
        this.velocity.x = Math.max(targetSpeed, this.velocity.x - brakeForce * dt);
      } else {
        this.velocity.x = targetSpeed;
      }
    }

    // Velocity bounds
    this.velocity.x = Math.max(30, Math.min(this.velocity.x, 1500));

    // Move player along surface
    this.position.x += this.velocity.x * dt;
    const nextGroundY = terrain.getHeightAt(this.position.x);
    const nextSlope = terrain.getSlopeAngleAt(this.position.x);
    this.velocity.y = this.velocity.x * Math.tan(nextSlope);

    // Launch check: cresting ramps or hill crests with strong upward velocity
    if (this.velocity.y < -220 && this.state === 'BELLY_SLIDE') {
      this.state = 'AIRBORNE';
      this.position.y = nextGroundY - 2;
    } else {
      this.position.y = nextGroundY;
    }
  }
}
