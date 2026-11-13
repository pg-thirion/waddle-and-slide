import { Vector2, WorldEntity } from '../core/types';
import { GameSimulation } from '../core/game-state';
import { sealObstacleJumpHeight } from '../core/chaser';
import { HudRenderer } from './hud';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

export class CanvasView {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private hud: HudRenderer;
  private camera: Vector2;
  private particles: Particle[];
  private shakeTimer: number;
  private shakeIntensity: number;
  private comboFlashTimer: number;
  private prevCombo: number;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D context not available');
    this.ctx = context;
    this.hud = new HudRenderer();
    this.camera = { x: 100, y: 300 };
    this.particles = [];
    this.shakeTimer = 0;
    this.shakeIntensity = 0;
    this.comboFlashTimer = 0;
    this.prevCombo = 1;
  }

  resize(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.resetTransform();
    this.ctx.scale(dpr, dpr);
  }

  reset(game: GameSimulation): void {
    this.camera = { x: game.player.position.x - this.worldWidth() * 0.24,
      y: game.player.position.y - this.worldHeight() * 0.58 };
    this.particles = [];
    this.shakeTimer = 0;
    this.shakeIntensity = 0;
    this.comboFlashTimer = 0;
    this.prevCombo = 1;
  }

  private worldScale(): number {
    return Math.min(1, window.innerWidth / 760);
  }

  private worldWidth(): number { return window.innerWidth / this.worldScale(); }
  private worldHeight(): number { return window.innerHeight / this.worldScale(); }

  render(game: GameSimulation, dt: number): void {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Camera follow lerp
    const scale = this.worldScale();
    const worldWidth = this.worldWidth();
    const worldHeight = this.worldHeight();
    const targetCamX = game.player.position.x - worldWidth * 0.24;
    const targetCamY = game.player.position.y - worldHeight * 0.58;
    this.camera.x += (targetCamX - this.camera.x) * (1 - Math.exp(-dt * 12));
    this.camera.y += (targetCamY - this.camera.y) * (1 - Math.exp(-dt * 8));
    // Avoid the penguin drifting towards the right edge at maximum speed.
    this.camera.x = Math.max(this.camera.x, game.player.position.x - worldWidth * 0.38);

    // Screen shake
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      this.shakeIntensity *= Math.exp(-dt * 10);
    } else {
      this.shakeIntensity = 0;
    }
    const shakeX = this.shakeIntensity > 0 ? (Math.random() - 0.5) * this.shakeIntensity * 2 : 0;
    const shakeY = this.shakeIntensity > 0 ? (Math.random() - 0.5) * this.shakeIntensity * 2 : 0;

    // Trigger shake on boulder hit (velocity loss is a proxy)
    // Trigger landing burst
    const justLanded = dt > 0 && game.landedEvent;
    if (justLanded) {
      this.triggerLandingBurst(game.player.position);
    }

    if (dt > 0 && game.crashEvent) {
      this.shakeTimer = 0.32;
      this.shakeIntensity = game.crashTimer > 0 ? 15 : 8;
      this.triggerLandingBurst(game.player.position);
    }

    // Combo flash
    if (game.player.comboMultiplier > this.prevCombo) {
      this.comboFlashTimer = 0.6;
    }
    if (this.comboFlashTimer > 0) this.comboFlashTimer -= dt;
    this.prevCombo = game.player.comboMultiplier;

    this.ctx.clearRect(0, 0, width, height);

    // 1. Sky & Parallax Mountains
    this.renderSkyAndMountains(width, height);

    // 2. World Space Transformation
    this.ctx.save();
    this.ctx.scale(scale, scale);
    this.ctx.translate(-this.camera.x + shakeX, -this.camera.y + shakeY);

    // Terrain
    this.renderTerrain(game, worldWidth, worldHeight);

    // Pickups and Obstacles
    this.renderEntities(game.obstacles.entities);

    // Particles
    this.updateAndRenderParticles(game, dt);

    // Speed lines (in world space, behind player)
    if (!game.stats.gameOver && (game.player.velocity.x > 650 || game.boostTimer > 0)) {
      this.renderSpeedLines(game, worldWidth, worldHeight);
    }

    // Leopard Seal
    this.renderSeal(game);

    // Penguin Player
    if (game.magnetTimer > 0 || game.shieldActive) {
      this.ctx.save();
      this.ctx.strokeStyle = game.shieldActive ? '#8effff' : '#ffd45b';
      this.ctx.globalAlpha = 0.75;
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.arc(game.player.position.x, game.player.position.y - 12, 30 + Math.sin(Date.now() / 150) * 3, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();
    }
    this.renderPenguin(game);

    this.ctx.restore();

    // 3. Combo flash text (screen space)
    if (this.comboFlashTimer > 0 && game.player.comboMultiplier > 1) {
      const alpha = Math.min(1, this.comboFlashTimer / 0.3);
      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      this.ctx.font = `bold ${28 + (game.player.comboMultiplier - 1) * 4}px sans-serif`;
      this.ctx.fillStyle = '#ffdf00';
      this.ctx.textAlign = 'center';
      this.ctx.shadowColor = '#ff8800';
      this.ctx.shadowBlur = 10;
      this.ctx.fillText(`x${game.player.comboMultiplier}!`, width * 0.5, height * 0.35);
      this.ctx.restore();
    }

    if (game.pickupMessageTimer > 0 && !game.stats.gameOver) {
      this.ctx.save();
      this.ctx.globalAlpha = Math.min(1, game.pickupMessageTimer / 0.25);
      this.ctx.font = 'bold 20px sans-serif';
      this.ctx.fillStyle = game.crashTimer > 0 ? '#ff6a55' : '#fff0a8';
      this.ctx.strokeStyle = '#203747';
      this.ctx.lineWidth = 4;
      this.ctx.textAlign = 'center';
      const messageY = Math.max(176, height * 0.29);
      this.ctx.strokeText(game.pickupMessage, width / 2, messageY, width - 24);
      this.ctx.fillText(game.pickupMessage, width / 2, messageY, width - 24);
      this.ctx.restore();
    }

    // 4. UI HUD Overlay
    this.hud.render(
      this.ctx,
      width,
      height,
      game.stats,
      game.chaser.threatLevel,
      game.player.comboMultiplier,
      game.boostTimer,
      game.chaser.trailingDistance,
      game.chaser.boostTimer > 0 || game.chaser.rampTimer > 0,
      this.nextHazardDistance(game),
      game.magnetTimer,
      game.shieldActive,
      game.crashTimer,
      game.player.velocity.x
    );
  }

  private nextHazardDistance(game: GameSimulation): number | undefined {
    const x = game.player.position.x;
    let nearest = Infinity;
    for (const entity of game.obstacles.entities) {
      if (!entity.hit && (entity.type === 'ICE_HURDLE' || entity.type === 'BOULDER' || entity.type === 'WALRUS') && entity.position.x > x) {
        nearest = Math.min(nearest, entity.position.x - x);
      }
    }
    return Number.isFinite(nearest) ? nearest : undefined;
  }

  private renderSkyAndMountains(width: number, height: number): void {
    // Arctic sky gradient
    const sky = this.ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#5487a3');
    sky.addColorStop(0.5, '#92bdd1');
    sky.addColorStop(1, '#dfeff5');
    this.ctx.fillStyle = sky;
    this.ctx.fillRect(0, 0, width, height);

    // Distant mountain ridge (slow parallax)
    this.ctx.fillStyle = 'rgba(150, 185, 205, 0.45)';
    this.ctx.beginPath();
    this.ctx.moveTo(0, height);
    const mtnOffset = this.camera.x * 0.08;
    for (let x = 0; x <= width + 60; x += 60) {
      const worldX = x + mtnOffset;
      const y = height * 0.45 + Math.sin(worldX / 300) * 80 + Math.cos(worldX / 140) * 35;
      this.ctx.lineTo(x, y);
    }
    this.ctx.lineTo(width, height);
    this.ctx.closePath();
    this.ctx.fill();

    // Midground ice ridge (medium parallax)
    this.ctx.fillStyle = 'rgba(185, 215, 230, 0.65)';
    this.ctx.beginPath();
    this.ctx.moveTo(0, height);
    const iceOffset = this.camera.x * 0.22;
    for (let x = 0; x <= width + 40; x += 40) {
      const worldX = x + iceOffset;
      const y = height * 0.6 + Math.sin(worldX / 220) * 50 + Math.cos(worldX / 90) * 25;
      this.ctx.lineTo(x, y);
    }
    this.ctx.lineTo(width, height);
    this.ctx.closePath();
    this.ctx.fill();
  }

  private renderTerrain(game: GameSimulation, width: number, height: number): void {
    const startX = Math.floor((this.camera.x - 50) / 20) * 20;
    const endX = this.camera.x + width + 50;
    const bottomY = this.camera.y + height + 200;

    this.ctx.beginPath();
    this.ctx.moveTo(startX, bottomY);

    for (let x = startX; x <= endX; x += 15) {
      const y = game.terrain.getHeightAt(x);
      this.ctx.lineTo(x, y);
    }

    this.ctx.lineTo(endX, bottomY);
    this.ctx.closePath();

    // Deep glacier blue fill
    const glacierGrad = this.ctx.createLinearGradient(0, this.camera.y, 0, bottomY);
    glacierGrad.addColorStop(0, '#eaf7fc');
    glacierGrad.addColorStop(0.15, '#c5e5f2');
    glacierGrad.addColorStop(0.6, '#5a96b8');
    glacierGrad.addColorStop(1, '#1b3b55');
    this.ctx.fillStyle = glacierGrad;
    this.ctx.fill();

    // Crisp top snow crust
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 5;
    this.ctx.stroke();
  }

  private renderEntities(entities: WorldEntity[]): void {
    for (const ent of entities) {
      if (ent.position.x < this.camera.x - 100 || ent.position.x > this.camera.x + this.worldWidth() + 100) continue;
      const reusable = ent.type === 'SPEED_PAD' || ent.type === 'RAMP';
      if (ent.collected && (!reusable || ent.sealUsed)) continue;

      this.ctx.save();
      if (ent.collected) this.ctx.globalAlpha = 0.45;
      this.ctx.translate(ent.position.x, ent.position.y);

      if (ent.type === 'FISH' || ent.type === 'GOLD_FISH') {
        if (ent.type === 'GOLD_FISH') {
          this.ctx.scale(1.5, 1.5);
          this.ctx.shadowColor = '#ffbc30';
          this.ctx.shadowBlur = 15;
        }
        // Golden Krill / Fish
        this.ctx.fillStyle = '#ffd700';
        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, 10, 6, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Fish tail
        this.ctx.beginPath();
        this.ctx.moveTo(-8, 0);
        this.ctx.lineTo(-15, -6);
        this.ctx.lineTo(-15, 6);
        this.ctx.closePath();
        this.ctx.fill();

        // Eye
        this.ctx.fillStyle = '#222';
        this.ctx.beginPath();
        this.ctx.arc(4, -1, 1.5, 0, Math.PI * 2);
        this.ctx.fill();
      } else if (ent.type === 'SKY_ROCKET' || ent.type === 'MAGNET' || ent.type === 'SHIELD') {
        const color = ent.type === 'SKY_ROCKET' ? '#eaa0ff' : ent.type === 'MAGNET' ? '#ffd65b' : '#7dfbff';
        this.ctx.shadowColor = color;
        this.ctx.shadowBlur = 16;
        this.ctx.fillStyle = '#213e5a';
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 19, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
        this.ctx.fillStyle = color;
        this.ctx.font = 'bold 22px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(ent.type === 'SKY_ROCKET' ? '↑' : ent.type === 'MAGNET' ? 'M' : 'S', 0, 1);
      } else if (ent.type === 'BOULDER') {
        // Jagged ice rock
        this.ctx.fillStyle = '#657e93';
        this.ctx.beginPath();
        this.ctx.moveTo(-16, 12);
        this.ctx.lineTo(-12, -12);
        this.ctx.lineTo(4, -16);
        this.ctx.lineTo(16, -4);
        this.ctx.lineTo(14, 12);
        this.ctx.closePath();
        this.ctx.fill();

        // Snow dusting on top
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.moveTo(-12, -12);
        this.ctx.lineTo(4, -16);
        this.ctx.lineTo(16, -4);
        this.ctx.lineTo(12, -2);
        this.ctx.lineTo(2, -10);
        this.ctx.lineTo(-10, -8);
        this.ctx.closePath();
        this.ctx.fill();
      } else if (ent.type === 'ICE_HURDLE') {
        // Bright ice barrier with a contrasting top edge.
        this.ctx.fillStyle = '#4e9bbd';
        this.ctx.fillRect(-22, -24, 44, 48);
        this.ctx.fillStyle = '#a5e5f8';
        this.ctx.fillRect(-18, -20, 36, 40);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(-22, -24, 44, 5);
        this.ctx.strokeStyle = '#32799d';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(-22, -24, 44, 48);
      } else if (ent.type === 'SPEED_PAD') {
        // Glowing speed pad
        const pulse = 0.7 + Math.sin(Date.now() / 150) * 0.3;
        this.ctx.fillStyle = `rgba(0, 220, 255, ${pulse.toFixed(2)})`;
        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, 18, 8, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.fillStyle = '#ffff00';
        this.ctx.font = 'bold 16px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('⚡', 0, -1);
      } else if (ent.type === 'RAMP') {
        // Ramp kicker — angled snow wedge
        this.ctx.fillStyle = '#c5e5f2';
        this.ctx.beginPath();
        this.ctx.moveTo(-20, 10);
        this.ctx.lineTo(-20, 0);
        this.ctx.lineTo(20, -14);
        this.ctx.lineTo(20, 10);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
      } else if (ent.type === 'WALRUS') {
        // Slumbering Walrus
        this.ctx.scale(1.2, 1.2);
        this.ctx.fillStyle = ent.hit ? '#a57655' : '#8b5a3c';
        this.ctx.beginPath();
        this.ctx.ellipse(0, 4, 22, 14, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Head
        this.ctx.beginPath();
        this.ctx.arc(12, -2, 10, 0, Math.PI * 2);
        this.ctx.fill();

        // White tusks
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(16, 2, 3, 9);
        this.ctx.fillRect(20, 2, 3, 8);

        // Sleepy eye
        this.ctx.strokeStyle = '#222';
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.arc(14, -5, 3, 0, Math.PI);
        this.ctx.stroke();
      }

      this.ctx.restore();
    }
  }

  private triggerLandingBurst(pos: Vector2): void {
    for (let i = 0; i < 18; i++) {
      const angle = Math.PI + (Math.random() - 0.5) * Math.PI; // spray left/upward
      const speed = 80 + Math.random() * 220;
      this.particles.push({
        x: pos.x,
        y: pos.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        life: 0,
        maxLife: 0.3 + Math.random() * 0.3,
        size: 2 + Math.random() * 4
      });
    }
  }

  private renderSpeedLines(game: GameSimulation, width: number, height: number): void {
    const camRight = this.camera.x + width;
    const camMid = this.camera.y + height * 0.5;
    const count = game.boostTimer > 0 ? 14 : 8;
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    this.ctx.lineWidth = 1.5;
    for (let i = 0; i < count; i++) {
      const lineY = camMid + (Math.random() - 0.5) * height * 0.9;
      const len = 60 + Math.random() * 120;
      const end = camRight - Math.random() * 160;
      this.ctx.beginPath();
      this.ctx.moveTo(end - len, lineY);
      this.ctx.lineTo(end, lineY);
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  private updateAndRenderParticles(game: GameSimulation, dt: number): void {
    // Spawn snow particles from penguin feet/belly
    if (!game.stats.gameOver && game.player.state !== 'AIRBORNE' && game.player.velocity.x > 80 &&
        this.particles.length < 160 && Math.random() < 1 - Math.exp(-dt * 65)) {
      this.particles.push({
        x: game.player.position.x - 12,
        y: game.player.position.y - 2,
        vx: -game.player.velocity.x * 0.2 + (Math.random() - 0.5) * 60,
        vy: -Math.random() * 90 - 20,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.2,
        size: 2 + Math.random() * 3
      });
    }

    // Update and draw particles
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 200 * dt; // light gravity

      const alpha = 1 - p.life / p.maxLife;
      this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(2)})`;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  private renderSeal(game: GameSimulation): void {
    const sealX = game.player.position.x - game.chaser.trailingDistance;
    const groundY = game.terrain.getHeightAt(sealX);

    // Only render if within camera view
    if (sealX < this.camera.x - 100 || sealX > this.camera.x + this.worldWidth() + 100) return;

    const entities = game.obstacles.entities;
    const obstacleLift = sealObstacleJumpHeight(sealX, entities);
    const rampLift = game.chaser.rampTimer > 0 ? Math.sin(game.chaser.rampTimer / 0.8 * Math.PI) * 65 : 0;
    const lift = Math.max(obstacleLift, rampLift);

    // A ground shadow makes the height of the leap clear.
    if (lift > 0) {
      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0.12, 0.38 - lift / 400);
      this.ctx.fillStyle = '#263c50';
      this.ctx.beginPath();
      this.ctx.ellipse(sealX, groundY + 1, 28 - lift * 0.07, 5, 0, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }

    this.ctx.save();
    this.ctx.translate(sealX, groundY - 14 - lift);
    if (lift > 0) {
      // Nose up during takeoff and down during descent.
      const left = sealObstacleJumpHeight(sealX - 3, entities);
      const right = sealObstacleJumpHeight(sealX + 3, entities);
      const arcSlope = (left - right) / 6;
      const rampPitch = rampLift > obstacleLift
        ? Math.cos(game.chaser.rampTimer / 0.8 * Math.PI) * 0.35 : 0;
      const pitch = rampLift > obstacleLift ? rampPitch : Math.atan(arcSlope);
      this.ctx.rotate(Math.max(-0.55, Math.min(0.55, pitch)));
    }
    if (game.chaser.boostTimer > 0 || game.chaser.rampTimer > 0) {
      this.ctx.strokeStyle = 'rgba(100, 230, 255, 0.85)';
      this.ctx.lineWidth = 4;
      for (let i = 0; i < 3; i++) {
        this.ctx.beginPath();
        this.ctx.moveTo(-28, -8 + i * 8);
        this.ctx.lineTo(-65 - i * 8, -8 + i * 8);
        this.ctx.stroke();
      }
    }

    // Sleek dark leopard seal body
    this.ctx.fillStyle = '#2f3c48';
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, 32, 16, 0.1, 0, Math.PI * 2);
    this.ctx.fill();

    // Seal spots
    this.ctx.fillStyle = '#1c242c';
    this.ctx.beginPath();
    this.ctx.arc(-8, -4, 3, 0, Math.PI * 2);
    this.ctx.arc(4, 2, 3, 0, Math.PI * 2);
    this.ctx.arc(-18, 2, 2.5, 0, Math.PI * 2);
    this.ctx.fill();

    // Sharp predator snout & teeth
    this.ctx.fillStyle = '#ffffff';
    this.ctx.beginPath();
    this.ctx.moveTo(24, 2);
    this.ctx.lineTo(28, 6);
    this.ctx.lineTo(22, 6);
    this.ctx.closePath();
    this.ctx.fill();

    // Intense eye
    this.ctx.fillStyle = '#ff3333';
    this.ctx.beginPath();
    this.ctx.arc(16, -6, 2.5, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.restore();
  }

  private renderPenguin(game: GameSimulation): void {
    const { position, velocity, state } = game.player;

    this.ctx.save();
    this.ctx.translate(position.x, position.y);

    let angle = 0;
    if (state === 'AIRBORNE') {
      angle = Math.atan2(velocity.y, velocity.x);
    } else {
      angle = game.terrain.getSlopeAngleAt(position.x);
    }
    this.ctx.rotate(angle);

    if (state === 'BELLY_SLIDE' || state === 'AIRBORNE') {
      // Horizontal belly slider
      this.ctx.fillStyle = '#1e242b'; // Dark back
      this.ctx.beginPath();
      this.ctx.ellipse(0, -6, 16, 8, 0, 0, Math.PI * 2);
      this.ctx.fill();

      // White belly against ice
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.ellipse(2, -3, 11, 4, 0, 0, Math.PI * 2);
      this.ctx.fill();

      // Orange beak
      this.ctx.fillStyle = '#ff7b00';
      this.ctx.beginPath();
      this.ctx.moveTo(14, -7);
      this.ctx.lineTo(22, -6);
      this.ctx.lineTo(14, -4);
      this.ctx.closePath();
      this.ctx.fill();

      // Eye
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(10, -9, 2, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = '#000000';
      this.ctx.beginPath();
      this.ctx.arc(11, -9, 1, 0, Math.PI * 2);
      this.ctx.fill();
    } else {
      // Upright waddle stance
      this.ctx.fillStyle = '#1e242b';
      this.ctx.beginPath();
      this.ctx.ellipse(0, -16, 10, 16, 0, 0, Math.PI * 2);
      this.ctx.fill();

      // White chest
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.ellipse(3, -14, 6, 11, 0, 0, Math.PI * 2);
      this.ctx.fill();

      // Orange beak
      this.ctx.fillStyle = '#ff7b00';
      this.ctx.beginPath();
      this.ctx.moveTo(8, -25);
      this.ctx.lineTo(16, -23);
      this.ctx.lineTo(8, -21);
      this.ctx.closePath();
      this.ctx.fill();

      // Feet (flared to brake)
      this.ctx.fillStyle = '#ff7b00';
      this.ctx.fillRect(-6, -3, 8, 4);
      this.ctx.fillRect(2, -3, 8, 4);

      // Eye
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(5, -26, 2.5, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = '#000000';
      this.ctx.beginPath();
      this.ctx.arc(6, -26, 1.2, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.restore();
  }
}
