import { Vector2 } from './types';
import { vecNormalize, vec2 } from './vector';

export interface TerrainGeneratorConfig {
  segmentWidth: number;
  baseHeight: number;
  hillAmplitude: number;
  seed?: number;
}

const DEFAULT_CONFIG: TerrainGeneratorConfig = {
  segmentWidth: 600,
  baseHeight: 450,
  hillAmplitude: 140,
  seed: 0
};

export class TerrainGenerator {
  readonly config: TerrainGeneratorConfig;

  constructor(config?: Partial<TerrainGeneratorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  getHeightAt(x: number): number {
    const { baseHeight, hillAmplitude, seed = 42 } = this.config;
    const s = seed * 0.1;

    // Multi-octave harmonic landscape
    const wave1 = Math.sin(x / 800 + s) * hillAmplitude;
    const wave2 = Math.cos(x / 360 + s * 1.5) * (hillAmplitude * 0.45);
    const wave3 = Math.sin(x / 180 + s * 2.3) * (hillAmplitude * 0.2);

    return baseHeight + wave1 + wave2 + wave3;
  }

  getNormalAt(x: number): Vector2 {
    const eps = 0.5;
    const hLeft = this.getHeightAt(x - eps);
    const hRight = this.getHeightAt(x + eps);
    const dx = 2 * eps;
    const dy = hRight - hLeft;

    // Tangent is (dx, dy). Upward normal in canvas coords (-y is up) is (dy, -dx)
    return vecNormalize(vec2(dy, -dx));
  }

  getSlopeAngleAt(x: number): number {
    const eps = 0.5;
    const hLeft = this.getHeightAt(x - eps);
    const hRight = this.getHeightAt(x + eps);
    return Math.atan2(hRight - hLeft, 2 * eps);
  }
}
