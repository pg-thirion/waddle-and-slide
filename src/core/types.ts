export interface Vector2 {
  x: number;
  y: number;
}

export type PlayerState = 'WADDLE_BRAKE' | 'BELLY_SLIDE' | 'AIRBORNE';

export interface PlayerInput {
  isHoldingSlide: boolean;
  isDiveRequested?: boolean;
  jumpPressed?: boolean;
  speedLimit?: number;
}

export type ThreatLevel = 'CALM' | 'YELLOW' | 'RED' | 'CAUGHT';

export type EntityType = 'BOULDER' | 'WALRUS' | 'FISH' | 'SPEED_PAD' | 'RAMP' | 'ICE_HURDLE' | 'GOLD_FISH' | 'SKY_ROCKET' | 'MAGNET' | 'SHIELD';

export interface WorldEntity {
  id: number;
  type: EntityType;
  position: Vector2;
  radius: number;
  collected?: boolean;
  hit?: boolean;
  sealUsed?: boolean;
}

export interface GameStats {
  score: number;
  distanceMeters: number;
  fishCount: number;
  highScore: number;
  gameOver: boolean;
  bestDistance: number;
  elapsedSeconds: number;
  hazardsCleared: number;
}
