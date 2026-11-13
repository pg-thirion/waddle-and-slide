import { GameStats, ThreatLevel } from '../core/types';

export class HudRenderer {
  render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    stats: GameStats,
    threatLevel: ThreatLevel,
    comboMultiplier: number,
    boostTimer: number,
    sealDistance = 350,
    sealBoosting = false,
    nextHazard?: number,
    magnetTimer = 0,
    shieldActive = false,
    crashTimer = 0,
    playerSpeed = 0
  ): void {
    ctx.save();

    // 1. Threat Vignette
    this.renderThreatVignette(ctx, width, height, threatLevel);

    // 2. In-Game HUD Elements
    ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textBaseline = 'top';

    // Top Left: Distance & Score
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 4;
    ctx.fillText(`${stats.distanceMeters} m`, 20, 20);

    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#b0e0e6';
    ctx.fillText(`SCORE: ${stats.score}`, 20, 48);
    ctx.font = '12px sans-serif';
    ctx.fillText(`SPEED ${Math.round(playerSpeed * 0.36)} km/h`, 20, 67);

    // Combo streak banner
    if (comboMultiplier > 1 && !stats.gameOver) {
      ctx.font = 'bold 15px sans-serif';
      ctx.fillStyle = '#ffdf00';
      ctx.fillText(`COMBO x${comboMultiplier}`, 20, 86);
    }

    // Top Right: Fish & Boost
    ctx.textAlign = 'right';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = '#ffd700';
    ctx.fillText(`★ ${stats.fishCount}`, width - 20, 20);

    if (boostTimer > 0) {
      ctx.font = 'bold 14px sans-serif';
      ctx.fillStyle = '#ff4500';
      ctx.fillText(`BOOST ${boostTimer.toFixed(1)}s`, width - 20, 48);
    }

    if (!stats.gameOver) {
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'right';
      if (magnetTimer > 0) {
        ctx.fillStyle = '#ffd65b';
        ctx.fillText(`MAGNET ${magnetTimer.toFixed(1)}s`, width - 20, 72);
      }
      if (shieldActive) {
        ctx.fillStyle = '#7dfbff';
        ctx.fillText('SHIELD READY', width - 20, 90);
      }
      ctx.textAlign = 'center';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = sealBoosting ? '#ffb34d' : '#ffffff';
      const center = width / 2;
      const barWidth = Math.min(150, width * 0.38);
      ctx.fillStyle = '#193548';
      ctx.fillRect(center - barWidth / 2, 114, barWidth, 6);
      ctx.fillStyle = threatLevel === 'RED' ? '#ff5252' : threatLevel === 'YELLOW' ? '#ffc354' : '#7ce0ee';
      ctx.fillRect(center - barWidth / 2, 114, barWidth * Math.min(1, sealDistance / 600), 6);
      ctx.fillStyle = sealBoosting ? '#ffb34d' : '#ffffff';
      ctx.fillText(sealBoosting ? 'SEAL BOOSTING!' : `SEAL: ${Math.ceil(sealDistance / 10)} m`, center, 96);
      if (crashTimer > 0) {
        ctx.fillStyle = '#ff7968';
        ctx.fillText('RECOVERING...', width / 2, 158);
      }
      if (nextHazard !== undefined && nextHazard < 900) {
        ctx.fillStyle = '#ffe18a';
        ctx.fillText(`HAZARD AHEAD: ${Math.ceil(nextHazard / 10)} m`, width / 2, 130);
      }
    }

    // 3. Game Over Screen
    if (stats.gameOver) {
      this.renderGameOver(ctx, width, height, stats);
    }

    ctx.restore();
  }

  private renderThreatVignette(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    threat: ThreatLevel
  ): void {
    if (threat === 'CALM') return;

    let color = 'rgba(255, 200, 0, 0.25)';
    if (threat === 'RED') {
      const pulse = 0.35 + Math.sin(Date.now() / 120) * 0.2;
      color = `rgba(255, 30, 30, ${pulse.toFixed(2)})`;
    } else if (threat === 'CAUGHT') {
      color = 'rgba(180, 0, 0, 0.6)';
    }

    const gradient = ctx.createRadialGradient(
      width / 2, height / 2, Math.min(width, height) * 0.35,
      width / 2, height / 2, Math.max(width, height) * 0.75
    );
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, color);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    if (threat === 'RED') {
      ctx.font = 'bold 16px sans-serif';
      ctx.fillStyle = '#ff2222';
      ctx.textAlign = 'center';
      ctx.fillText('SEAL CLOSING IN!', width / 2, 6, Math.min(width * 0.50, 230));
    }
  }

  private renderGameOver(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    stats: GameStats
  ): void {
    // Backdrop dimming
    ctx.fillStyle = 'rgba(10, 25, 45, 0.85)';
    ctx.fillRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;

    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 8;

    // Header
    ctx.font = `bold ${Math.min(28, width * 0.066)}px -apple-system, sans-serif`;
    ctx.fillStyle = '#ff4d4d';
    ctx.fillText('CAUGHT BY THE SEAL!', centerX, centerY - 90);

    // Metrics
    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`Distance: ${stats.distanceMeters} meters`, centerX, centerY - 45);
    ctx.fillText(`Score: ${stats.score}`, centerX, centerY - 15);

    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = '#ffd700';
    ctx.fillText(`BEST SCORE: ${stats.highScore}`, centerX, centerY + 15);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#bdeeff';
    ctx.fillText(`BEST DISTANCE: ${stats.bestDistance} m`, centerX, centerY + 38);
    ctx.fillText(`${stats.fishCount} fish  •  ${stats.hazardsCleared} clears  •  ${Math.floor(stats.elapsedSeconds)}s`, centerX, centerY + 60);

    // Call to Action
    const pulseAlpha = 0.5 + Math.sin(Date.now() / 250) * 0.5;
    ctx.fillStyle = `rgba(255, 255, 255, ${pulseAlpha.toFixed(2)})`;
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('TAP OR PRESS SPACE TO RETRY', centerX, centerY + 94, width - 32);
  }
}
