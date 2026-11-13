import { Vector2, WorldEntity, EntityType } from './types';
import { TerrainGenerator } from './terrain';

export class ObstacleManager {
  entities: WorldEntity[] = [];
  private lastSpawnX = 100;
  private nextId = 1;
  private slot = 0;

  // Stable pseudo-random pattern, independent of frame rate and spawn batches.
  private random(index: number, salt: number): number {
    const v = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
    return v - Math.floor(v);
  }

  private add(type: EntityType, x: number, offset: number, radius: number, terrain: TerrainGenerator): void {
    this.entities.push({ id: this.nextId++, type,
      position: { x, y: terrain.getHeightAt(x) - offset }, radius });
  }

  spawnAhead(playerX: number, terrain: TerrainGenerator): void {
    const targetAheadX = playerX + 2500;
    while (this.lastSpawnX < targetAheadX) {
      const index = this.slot++;
      const difficulty = Math.min(1, Math.max(0, (this.lastSpawnX - 100) / 25000));
      // Keep enough runway for jumping, even as hazards become more frequent.
      this.lastSpawnX += index === 0 ? 300 : index === 1 ? 350 : Math.round(760 - difficulty * 180 + this.random(index, 1) * 220);
      const x = this.lastSpawnX;
      const roll = this.random(index, 2);
      const slope = terrain.getSlopeAngleAt(x);
      // A gentle opening, then a varied mix with a growing hazard share.
      if (index === 1 || (index > 3 && roll < 0.25 - difficulty * 0.08)) {
        for (let i = 0; i < 3; i++) {
          this.add('FISH', x + i * 40, 25 + Math.sin(i * Math.PI / 2) * 45, 12, terrain);
        }
      } else if (index === 0 || (index > 3 && roll < 0.43 - difficulty * 0.13)) {
        this.add('SPEED_PAD', x, 12, 20, terrain);
      } else if (index === 2 || (index > 3 && roll < 0.56 - difficulty * 0.12 && slope > 0.08)) {
        this.add('RAMP', x, 10, 20, terrain);
      } else if (index === 3 || this.random(index, 3) < 0.46 + difficulty * 0.20) {
        this.add('ICE_HURDLE', x, 24, 24, terrain);
      } else if (Math.abs(slope) < 0.25 && this.random(index, 4) < 0.45) {
        this.add('WALRUS', x, 18, 24, terrain);
      } else {
        this.add('BOULDER', x, 14, 16, terrain);
      }
    }
  }

  cullBehind(playerX: number, sealX = playerX): void {
    const minX = Math.min(playerX, sealX) - 800;
    this.entities = this.entities.filter(e => e.position.x >= minX);
  }

  // Pads and ramps are independent for each racer, even after player collection.
  sealPowerUpsBetween(fromX: number, toX: number): WorldEntity[] {
    return this.entities.filter(e =>
      !e.sealUsed && (e.type === 'SPEED_PAD' || e.type === 'RAMP') &&
      e.position.x >= fromX && e.position.x <= toX
    );
  }

  checkCollisions(playerPos: Vector2, playerRadius: number, previousPos = playerPos): WorldEntity[] {
    const hits: WorldEntity[] = [];
    const vx = playerPos.x - previousPos.x;
    const vy = playerPos.y - previousPos.y;
    const lengthSq = vx * vx + vy * vy;
    for (const entity of this.entities) {
      if (entity.collected || entity.hit) continue;
      // Swept circle collision prevents fast racers tunnelling through hurdles.
      const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1,
        ((entity.position.x - previousPos.x) * vx + (entity.position.y - previousPos.y) * vy) / lengthSq));
      const dx = previousPos.x + t * vx - entity.position.x;
      const dy = previousPos.y + t * vy - entity.position.y;
      const maxDist = playerRadius + entity.radius;
      if (dx * dx + dy * dy <= maxDist * maxDist) hits.push(entity);
    }
    return hits;
  }
}
