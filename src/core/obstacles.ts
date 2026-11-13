import { Vector2, WorldEntity } from './types';
import { TerrainGenerator } from './terrain';

export class ObstacleManager {
  entities: WorldEntity[];
  private lastSpawnX: number;
  private nextId: number;

  constructor() {
    this.entities = [];
    this.lastSpawnX = 300;
    this.nextId = 1;
  }

  spawnAhead(playerX: number, terrain: TerrainGenerator): void {
    const targetAheadX = playerX + 2500;

    while (this.lastSpawnX < targetAheadX) {
      this.lastSpawnX += 300;
      const x = this.lastSpawnX;
      const groundY = terrain.getHeightAt(x);
      const slope = terrain.getSlopeAngleAt(x);

      // Alternating spawn patterns based on distance
      const pattern = Math.floor(this.lastSpawnX / 300) % 6;

      if (pattern === 0 || pattern === 2) {
        // Arc of airborne krill/fish
        for (let i = 0; i < 3; i++) {
          const fishX = x + i * 40;
          const arcOffset = Math.sin((i / 2) * Math.PI) * 45;
          const fishY = terrain.getHeightAt(fishX) - 35 - arcOffset;
          this.entities.push({
            id: this.nextId++,
            type: 'FISH',
            position: { x: fishX, y: fishY },
            radius: 12,
            collected: false
          });
        }
      } else if (pattern === 1) {
        // Ice boulder hazard
        this.entities.push({
          id: this.nextId++,
          type: 'BOULDER',
          position: { x, y: groundY - 14 },
          radius: 16
        });
      } else if (pattern === 3 && Math.abs(slope) < 0.25) {
        // Sleeping walrus on flatter slopes
        this.entities.push({
          id: this.nextId++,
          type: 'WALRUS',
          position: { x, y: groundY - 18 },
          radius: 24
        });
      } else if (pattern === 4) {
        // Speed pad pickup
        this.entities.push({
          id: this.nextId++,
          type: 'SPEED_PAD',
          position: { x, y: groundY - 20 },
          radius: 18,
          collected: false
        });
      } else if (pattern === 5 && slope > 0.1) {
        // Ramp kicker — only on downhill sections
        this.entities.push({
          id: this.nextId++,
          type: 'RAMP',
          position: { x, y: groundY - 10 },
          radius: 20,
          collected: false
        });
      }
    }
  }

  cullBehind(playerX: number): void {
    const minX = playerX - 800;
    this.entities = this.entities.filter(e => e.position.x >= minX);
  }

  checkCollisions(playerPos: Vector2, playerRadius: number): WorldEntity[] {
    const hits: WorldEntity[] = [];

    for (const entity of this.entities) {
      if (entity.collected || entity.hit) continue;

      const dx = playerPos.x - entity.position.x;
      const dy = playerPos.y - entity.position.y;
      const distSq = dx * dx + dy * dy;
      const maxDist = playerRadius + entity.radius;

      if (distSq <= maxDist * maxDist) {
        hits.push(entity);
      }
    }

    return hits;
  }
}
