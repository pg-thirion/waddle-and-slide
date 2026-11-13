import { Vector2, WorldEntity } from '../core/types';
import { GameSimulation } from '../core/game-state';
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
  private prevPlayerState: string;
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
    this.prevPlayerState = 'WADDLE_BRAKE';
    this.comboFlashTimer = 0;
    this.prevCombo = 1;
  }

  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.resetTransform();
    this.ctx.scale(dpr, dpr);
  }

  render(game: GameSimulation, dt: number): void {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Camera follow lerp
    const targetCamX = game.player.position.x - width * 0.28;
    const targetCamY = game.player.position.y - height * 0.55;
    this.camera.x += (targetCamX - this.camera.x) * 0.12;
    this.camera.y += (targetCamY - this.camera.y) * 0.08;

    // Screen shake
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      this.shakeIntensity *= 0.85;
    } else {
      this.shakeIntensity = 0;
    }
    const shakeX = this.shakeIntensity > 0 ? (Math.random() - 0.5) * this.shakeIntensity * 2 : 0;
    const shakeY = this.shakeIntensity > 0 ? (Math.random() - 0.5) * this.shakeIntensity * 2 : 0;

    // Trigger shake on boulder hit (velocity loss is a proxy)
    // Trigger landing burst
    const justLanded = game.player.justLanded && this.prevPlayerState === 'AIRBORNE';
    if (justLanded) {
      this.triggerLandingBurst(game.player.position);
    }

    // Trigger shake on hazard hit: detected via state change to WADDLE_BRAKE at low speed
    if (game.player.state === 'WADDLE_BRAKE' && this.prevPlayerState === 'BELLY_SLIDE'
        && game.player.velocity.x < 250 && game.player.velocity.x > 30) {
      this.shakeTimer = 0.2;
      this.shakeIntensity = 5;
    }
    this.prevPlayerState = game.player.state;

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
    this.ctx.translate(-this.camera.x + shakeX, -this.camera.y + shakeY);

    // Terrain
    this.renderTerrain(game, width, height);

    // Pickups and Obstacles
    this.renderEntities(game.obstacles.entities);

    // Particles
    this.updateAndRenderParticles(game, dt);

    // Speed lines (in world space, behind player)
    if (game.player.velocity.x > 650 || game.boostTimer > 0) {
      this.renderSpeedLines(game, width, height);
    }

    // Leopard Seal
    this.renderSeal(game);

    // Penguin Player
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

    // 4. UI HUD Overlay
    this.hud.render(
      this.ctx,
      width,
      height,
      game.stats,
      game.chaser.threatLevel,
      game.player.comboMultiplier,
      game.boostTimer
    );
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
      if (ent.collected) continue;

      this.ctx.save();
      this.ctx.translate(ent.position.x, ent.position.y);

      if (ent.type === 'FISH') {
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
        this.ctx.fillStyle = '#8b5a3c';
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
      this.ctx.beginPath();
      this.ctx.moveTo(camRight - len - Math.random() * 300, lineY);
      this.ctx.lineTo(camRight - Math.random() * 80, lineY);
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  private updateAndRenderParticles(game: GameSimulation, dt: number): void {
    // Spawn snow particles from penguin feet/belly
    if (game.player.velocity.x > 80 && Math.random() < 0.7) {
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
    if (sealX < this.camera.x - 100 || sealX > this.camera.x + window.innerWidth + 100) return;

    this.ctx.save();
    this.ctx.translate(sealX, groundY - 14);

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

    if (state === 'BELLY_SLIDE') {
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
