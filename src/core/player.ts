import { Vector2, PlayerState, PlayerInput } from './types';
import { vec2 } from './vector';
import { TerrainGenerator } from './terrain';

export class PenguinPlayer {
  position: Vector2;
  velocity: Vector2;
  state: PlayerState;
  comboMultiplier: number;
  radius: number;
  stumbleTimer: number;
  jumpCooldown: number;
  justLanded: boolean;

  constructor(startPos: Vector2) {
    this.position = { ...startPos };
    this.velocity = vec2(200, 0);
    this.state = 'WADDLE_BRAKE';
    this.comboMultiplier = 1;
    this.radius = 16;
    this.stumbleTimer = 0;
    this.jumpCooldown = 0;
    this.justLanded = false;
  }

  update(dt: number, input: PlayerInput, terrain: TerrainGenerator): void {
    // Review Focus #1: Clamp dt to prevent tunneling and NaN during lag spikes
    const clampedDt = Math.max(0.001, Math.min(dt, 0.1));
    const stepSize = 0.016;
    let remaining = clampedDt;
    this.justLanded = false;

    while (remaining > 0) {
      const step = Math.min(remaining, stepSize);
      this.substep(step, input, terrain);
      remaining -= step;
    }
  }

  private substep(dt: number, input: PlayerInput, terrain: TerrainGenerator): void {
    const g = 980; // gravity px/s^2

    // Decrement jump cooldown
    if (this.jumpCooldown > 0) this.jumpCooldown -= dt;

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
          this.state = input.isHoldingSlide ? 'BELLY_SLIDE' : 'WADDLE_BRAKE';
        } else {
          // Flat or uphill impact penalty (Review Focus #2): clamp speed, 30% penalty, force WADDLE_BRAKE
          this.velocity.x = Math.max(40, this.velocity.x * 0.7);
          this.velocity.y = this.velocity.x * Math.tan(slope);
          this.comboMultiplier = 1;
          this.stumbleTimer = 0.3; // Stumble duration forcing brake
          this.state = 'WADDLE_BRAKE';
        }
        this.justLanded = true;
        this.jumpCooldown = 0.3;
      }
      return;
    }

    // Grounded physics: WADDLE_BRAKE vs BELLY_SLIDE
    if (this.stumbleTimer > 0) {
      this.stumbleTimer -= dt;
      this.state = 'WADDLE_BRAKE';
    } else {
      this.state = input.isHoldingSlide ? 'BELLY_SLIDE' : 'WADDLE_BRAKE';
    }

    // Jump: only when grounded, cooldown expired, and jump input received
    if (input.jumpPressed && this.jumpCooldown <= 0 && this.stumbleTimer <= 0) {
      this.velocity.y = -700; // upward impulse in canvas coords (up = negative y)
      this.velocity.x = Math.max(this.velocity.x, 180); // ensure forward momentum
      this.state = 'AIRBORNE';
      this.jumpCooldown = 0.4;
      return;
    }

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

    // Launch check: only launch if cresting convex terrain or kicker ramp where ground drops away
    const slopeDelta = nextSlope - slope;
    if (this.velocity.y < -220 && this.state === 'BELLY_SLIDE' && slopeDelta <= 0.05) {
      this.state = 'AIRBORNE';
      this.position.y = nextGroundY - 2;
    } else {
      this.position.y = nextGroundY;
    }
  }
}
