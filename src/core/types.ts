export interface Vector2 {
  x: number;
  y: number;
}

export type PlayerState = 'WADDLE_BRAKE' | 'BELLY_SLIDE' | 'AIRBORNE';

export interface PlayerInput {
  isHoldingSlide: boolean;
  isDiveRequested?: boolean;
}

export type ThreatLevel = 'CALM' | 'YELLOW' | 'RED' | 'CAUGHT';

export type EntityType = 'BOULDER' | 'WALRUS' | 'FISH';

export interface WorldEntity {
  id: number;
  type: EntityType;
  position: Vector2;
  radius: number;
  collected?: boolean;
}

export interface GameStats {
  score: number;
  distanceMeters: number;
  fishCount: number;
  highScore: number;
  gameOver: boolean;
}
