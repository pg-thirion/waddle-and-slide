# Waddle & Slide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a high-speed, one-touch 2D downhill physics runner for mobile where a penguin escapes a leopard seal by toggling between belly-sliding and foot-braking.

**Architecture:** A strictly decoupled headless game simulation core in TypeScript containing vector math, procedural spline terrain, player physics state machine, chaser AI, and obstacle collision. An HTML5 Canvas renderer handles procedural vector rendering, camera follow, and particles, with procedural Web Audio for sound effects and touch events driving the input.

**Tech Stack:** TypeScript 5.x, Node 24+, Vite, Vitest, HTML5 Canvas 2D, Web Audio API.

**Spec:** `docs/superpowers/specs/2026-11-13-waddle-and-slide-design.md`

## Global Constraints

- Target Language: TypeScript 5.x.
- Runtimes: Node 24+, Modern Web Browsers (Mobile Safari, Chrome on Android).
- Build Tool: Vite.
- Test Runner: Vitest (headless, deterministic unit testing).
- Dependencies: Zero runtime libraries outside Vite dev tooling.
- Frame Target: Smooth 60 FPS mobile canvas rendering with zero external asset dependencies.

## Review Focus

1. **Large/variable delta time (lag spike) during physics step:** When `dt > 0.1s` (e.g. background tab switch or mobile stutter), the simulation must clamp `dt` or substep so player does not tunnel through terrain or produce `NaN`. (Owned by Task 3 and Task 6).
2. **Steep uphill landing impact from high airborne drop:** When penguin lands on an uphill slope while airborne, velocity must not invert into negative x or launch backwards; it must clamp speed and transition to `WADDLE_BRAKE` with a 30% penalty. (Owned by Task 3).
3. **Long distance terrain query ($x > 100,000\text{ px}$):** Terrain generator must seamlessly generate chunks ahead and garbage collect behind without memory leaks or coordinate discontinuities. (Owned by Task 2).
4. **Sudden chaser overshoot when player stops dead:** If player hits obstacle and speed drops to 0, chaser distance must clamp cleanly to 0 and immediately trigger game over without negative distance rendering glitches. (Owned by Task 4).
5. **Simultaneous multi-pickup collection in identical physics step:** Picking up multiple fish in one frame must accurately accumulate score and boost gauge without race conditions or dropped multipliers. (Owned by Task 5).

---

### Task 1: Scaffolding & Vector Math Library

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `src/core/types.ts`
- Create: `src/core/vector.ts`
- Test: `tests/vector.test.ts`

**Interfaces:**
- Consumes: None (root foundation).
- Produces:
  ```typescript
  export interface Vector2 {
    x: number;
    y: number;
  }
  export function vec2(x: number, y: number): Vector2;
  export function vecAdd(a: Vector2, b: Vector2): Vector2;
  export function vecSub(a: Vector2, b: Vector2): Vector2;
  export function vecScale(v: Vector2, s: number): Vector2;
  export function vecLength(v: Vector2): number;
  export function vecNormalize(v: Vector2): Vector2;
  export function vecDot(a: Vector2, b: Vector2): number;
  export function vecAngle(v: Vector2): number;
  ```

- [ ] **Step 1: Create package.json, tsconfig.json, and vite.config.ts**

Initialize standard Vite + Vitest + TypeScript configuration.

- [ ] **Step 2: Write failing test in `tests/vector.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { vec2, vecAdd, vecSub, vecScale, vecLength, vecNormalize, vecDot, vecAngle } from '../src/core/vector';

describe('Vector2 Math Library', () => {
  it('adds and subtracts vectors correctly', () => {
    const v1 = vec2(3, 4);
    const v2 = vec2(1, -2);
    expect(vecAdd(v1, v2)).toEqual({ x: 4, y: 2 });
    expect(vecSub(v1, v2)).toEqual({ x: 2, y: 6 });
  });

  it('calculates length and normalization safely', () => {
    const v = vec2(3, 4);
    expect(vecLength(v)).toBe(5);
    const norm = vecNormalize(v);
    expect(norm.x).toBeCloseTo(0.6);
    expect(norm.y).toBeCloseTo(0.8);

    const zero = vecNormalize(vec2(0, 0));
    expect(zero).toEqual({ x: 0, y: 0 });
  });

  it('calculates dot product and angle', () => {
    const a = vec2(1, 0);
    const b = vec2(0, 1);
    expect(vecDot(a, b)).toBe(0);
    expect(vecAngle(a)).toBe(0);
    expect(vecAngle(b)).toBeCloseTo(Math.PI / 2);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test` or `npx vitest run tests/vector.test.ts`  
Expected: FAIL with missing module error.

- [ ] **Step 4: Implement vector functions in `src/core/vector.ts` and types in `src/core/types.ts`**

Implement pure, allocation-conscious 2D vector operations.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/vector.test.ts`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json vite.config.ts src/core/types.ts src/core/vector.ts tests/vector.test.ts
git commit -m "feat: add project scaffolding and 2D vector math library"
```

---

### Task 2: Procedural Spline Terrain Generator

**Files:**
- Create: `src/core/terrain.ts`
- Test: `tests/terrain.test.ts`

**Interfaces:**
- Consumes: `Vector2`, `vec2`, `vecNormalize` from `src/core/vector.ts`
- Produces:
  ```typescript
  export interface TerrainGeneratorConfig {
    segmentWidth: number;
    baseHeight: number;
    hillAmplitude: number;
    seed?: number;
  }
  export class TerrainGenerator {
    constructor(config?: Partial<TerrainGeneratorConfig>);
    getHeightAt(x: number): number;
    getNormalAt(x: number): Vector2;
    getSlopeAngleAt(x: number): number;
  }
  ```

- [ ] **Step 1: Write failing tests in `tests/terrain.test.ts` including Review Focus #3**

```typescript
import { describe, it, expect } from 'vitest';
import { TerrainGenerator } from '../src/core/terrain';

describe('TerrainGenerator', () => {
  it('returns continuous height values for adjacent coordinates', () => {
    const terrain = new TerrainGenerator();
    const h1 = terrain.getHeightAt(100);
    const h2 = terrain.getHeightAt(100.1);
    expect(Math.abs(h2 - h1)).toBeLessThan(1.0);
  });

  it('calculates unit normal vector perpendicular to slope', () => {
    const terrain = new TerrainGenerator();
    const normal = terrain.getNormalAt(250);
    const len = Math.sqrt(normal.x * normal.x + normal.y * normal.y);
    expect(len).toBeCloseTo(1.0);
    // Terrain normals point upwards (negative y in canvas coords)
    expect(normal.y).toBeLessThan(0);
  });

  it('Review Focus #3: handles far distances (x > 100,000) smoothly without NaN or spikes', () => {
    const terrain = new TerrainGenerator();
    const farX = 150000;
    const h = terrain.getHeightAt(farX);
    expect(Number.isFinite(h)).toBe(true);
    const normal = terrain.getNormalAt(farX);
    expect(Number.isFinite(normal.x)).toBe(true);
    expect(Number.isFinite(normal.y)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/terrain.test.ts`  
Expected: FAIL with missing `TerrainGenerator`.

- [ ] **Step 3: Implement `TerrainGenerator` in `src/core/terrain.ts`**

Implement smooth procedural curves using multi-frequency harmonic sines or seeded Hermite cubic splines with central difference approximation for slope angles and normal vectors.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/terrain.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/terrain.ts tests/terrain.test.ts
git commit -m "feat: implement procedural spline terrain generator"
```

---

### Task 3: Penguin Player Physics & State Machine

**Files:**
- Create: `src/core/player.ts`
- Test: `tests/player.test.ts`

**Interfaces:**
- Consumes:
  - `Vector2`, `vec2`, `vecAdd`, `vecScale`, `vecDot` from `src/core/vector.ts`
  - `TerrainGenerator` from `src/core/terrain.ts`
- Produces:
  ```typescript
  export type PlayerState = 'WADDLE_BRAKE' | 'BELLY_SLIDE' | 'AIRBORNE';
  export interface PlayerInput {
    isHoldingSlide: boolean;
    isDiveRequested?: boolean;
  }
  export class PenguinPlayer {
    position: Vector2;
    velocity: Vector2;
    state: PlayerState;
    comboMultiplier: number;
    constructor(startPos: Vector2);
    update(dt: number, input: PlayerInput, terrain: TerrainGenerator): void;
  }
  ```

- [ ] **Step 1: Write failing tests in `tests/player.test.ts` including Review Focus #1 & #2**

```typescript
import { describe, it, expect } from 'vitest';
import { PenguinPlayer } from '../src/core/player';
import { TerrainGenerator } from '../src/core/terrain';

describe('PenguinPlayer Physics & State Machine', () => {
  it('accelerates downhill in BELLY_SLIDE when touch is held', () => {
    const terrain = new TerrainGenerator();
    const player = new PenguinPlayer({ x: 100, y: terrain.getHeightAt(100) });
    const initialSpeed = player.velocity.x;
    
    player.update(0.1, { isHoldingSlide: true }, terrain);
    expect(player.state).toBe('BELLY_SLIDE');
    expect(player.velocity.x).toBeGreaterThan(initialSpeed);
  });

  it('decelerates with friction in WADDLE_BRAKE when touch is released', () => {
    const terrain = new TerrainGenerator();
    const player = new PenguinPlayer({ x: 100, y: terrain.getHeightAt(100) });
    player.velocity = { x: 500, y: 0 };
    
    player.update(0.1, { isHoldingSlide: false }, terrain);
    expect(player.state).toBe('WADDLE_BRAKE');
    expect(player.velocity.x).toBeLessThan(500);
  });

  it('Review Focus #1: clamps dt when large delta time occurs', () => {
    const terrain = new TerrainGenerator();
    const player = new PenguinPlayer({ x: 100, y: terrain.getHeightAt(100) });
    player.velocity = { x: 300, y: 0 };
    
    // Simulate massive lag spike (1.5 seconds)
    player.update(1.5, { isHoldingSlide: true }, terrain);
    expect(Number.isFinite(player.position.x)).toBe(true);
    expect(Number.isFinite(player.position.y)).toBe(true);
    expect(player.position.y).toBeLessThanOrEqual(terrain.getHeightAt(player.position.x));
  });

  it('Review Focus #2: penalizes speed on steep uphill landing without negative reverse', () => {
    const terrain = new TerrainGenerator();
    const player = new PenguinPlayer({ x: 100, y: 0 }); // high airborne
    player.state = 'AIRBORNE';
    player.velocity = { x: 400, y: 300 };

    // Update until landing on ground
    for (let i = 0; i < 20; i++) {
      player.update(0.05, { isHoldingSlide: false }, terrain);
      if (player.state !== 'AIRBORNE') break;
    }
    expect(player.velocity.x).toBeGreaterThan(0);
    expect(player.velocity.x).toBeLessThanOrEqual(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/player.test.ts`  
Expected: FAIL with missing `PenguinPlayer`.

- [ ] **Step 3: Implement `PenguinPlayer` in `src/core/player.ts`**

Implement friction ($\mu=0.02$ for slide, $\mu=0.35$ for brake), slope acceleration along normal tangent, airborne gravity integration, terrain collision snap, and landing angle evaluation.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/player.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/player.ts tests/player.test.ts
git commit -m "feat: implement penguin player physics and state machine"
```

---

### Task 4: Leopard Seal Chaser System

**Files:**
- Create: `src/core/chaser.ts`
- Test: `tests/chaser.test.ts`

**Interfaces:**
- Consumes: `PenguinPlayer` from `src/core/player.ts`
- Produces:
  ```typescript
  export type ThreatLevel = 'CALM' | 'YELLOW' | 'RED' | 'CAUGHT';
  export class LeopardSeal {
    trailingDistance: number;
    speed: number;
    threatLevel: ThreatLevel;
    isCaught: boolean;
    constructor(initialDistance?: number);
    update(dt: number, playerSpeed: number): void;
  }
  ```

- [ ] **Step 1: Write failing tests in `tests/chaser.test.ts` including Review Focus #4**

```typescript
import { describe, it, expect } from 'vitest';
import { LeopardSeal } from '../src/core/chaser';

describe('LeopardSeal Chaser System', () => {
  it('closes distance when player speed is below baseline', () => {
    const seal = new LeopardSeal(350);
    seal.update(1.0, 50); // player moving very slowly
    expect(seal.trailingDistance).toBeLessThan(350);
  });

  it('calculates threat levels correctly according to distance thresholds', () => {
    const seal = new LeopardSeal(300);
    expect(seal.threatLevel).toBe('CALM');

    seal.update(1.0, 0); // distance drops
    seal.trailingDistance = 180;
    seal.update(0.01, 100);
    expect(seal.threatLevel).toBe('YELLOW');

    seal.trailingDistance = 80;
    seal.update(0.01, 100);
    expect(seal.threatLevel).toBe('RED');
  });

  it('Review Focus #4: cleanly clamps distance to 0 and triggers CAUGHT without negative overshoot', () => {
    const seal = new LeopardSeal(20);
    // Player stationary, seal lunges with high speed
    seal.update(1.0, 0);
    expect(seal.trailingDistance).toBe(0);
    expect(seal.threatLevel).toBe('CAUGHT');
    expect(seal.isCaught).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/chaser.test.ts`  
Expected: FAIL with missing `LeopardSeal`.

- [ ] **Step 3: Implement `LeopardSeal` in `src/core/chaser.ts`**

Implement distance tracking, catch-up acceleration curve, distance clamping, and threat state classification (`CALM` > 250, `YELLOW` 100-250, `RED` <= 100, `CAUGHT` <= 0).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/chaser.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/chaser.ts tests/chaser.test.ts
git commit -m "feat: implement leopard seal chaser system"
```

---

### Task 5: Obstacles, Pickups & Collision Detection

**Files:**
- Create: `src/core/obstacles.ts`
- Test: `tests/obstacles.test.ts`

**Interfaces:**
- Consumes: `Vector2` from `src/core/vector.ts`, `TerrainGenerator` from `src/core/terrain.ts`
- Produces:
  ```typescript
  export type EntityType = 'BOULDER' | 'WALRUS' | 'FISH';
  export interface WorldEntity {
    id: number;
    type: EntityType;
    position: Vector2;
    radius: number;
    collected?: boolean;
  }
  export class ObstacleManager {
    entities: WorldEntity[];
    spawnAhead(playerX: number, terrain: TerrainGenerator): void;
    cullBehind(playerX: number): void;
    checkCollisions(playerPos: Vector2, playerRadius: number): WorldEntity[];
  }
  ```

- [ ] **Step 1: Write failing tests in `tests/obstacles.test.ts` including Review Focus #5**

```typescript
import { describe, it, expect } from 'vitest';
import { ObstacleManager } from '../src/core/obstacles';
import { TerrainGenerator } from '../src/core/terrain';

describe('ObstacleManager', () => {
  it('spawns entities ahead of player and removes entities behind', () => {
    const terrain = new TerrainGenerator();
    const manager = new ObstacleManager();
    manager.spawnAhead(500, terrain);
    expect(manager.entities.length).toBeGreaterThan(0);

    const initialCount = manager.entities.length;
    manager.cullBehind(2000);
    expect(manager.entities.length).toBeLessThan(initialCount);
  });

  it('detects collisions between player and entities within radius', () => {
    const manager = new ObstacleManager();
    manager.entities = [
      { id: 1, type: 'BOULDER', position: { x: 100, y: 100 }, radius: 20 },
      { id: 2, type: 'FISH', position: { x: 500, y: 500 }, radius: 10 }
    ];

    const hits = manager.checkCollisions({ x: 110, y: 100 }, 15);
    expect(hits.length).toBe(1);
    expect(hits[0].id).toBe(1);
  });

  it('Review Focus #5: handles multiple simultaneous pickup collisions in one step', () => {
    const manager = new ObstacleManager();
    manager.entities = [
      { id: 10, type: 'FISH', position: { x: 200, y: 200 }, radius: 15 },
      { id: 11, type: 'FISH', position: { x: 205, y: 200 }, radius: 15 }
    ];

    const hits = manager.checkCollisions({ x: 202, y: 200 }, 20);
    expect(hits.length).toBe(2);
    hits.forEach(h => { h.collected = true; });
    const remainingUncollected = manager.entities.filter(e => !e.collected);
    expect(remainingUncollected.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/obstacles.test.ts`  
Expected: FAIL with missing `ObstacleManager`.

- [ ] **Step 3: Implement `ObstacleManager` in `src/core/obstacles.ts`**

Implement deterministic chunk-based obstacle/fish spawner, circle-circle collision test, and cleanup of off-screen items behind camera.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/obstacles.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/obstacles.ts tests/obstacles.test.ts
git commit -m "feat: implement obstacle manager and collision detection"
```

---

### Task 6: Master Simulation GameState & Scoring Loop

**Files:**
- Create: `src/core/game-state.ts`
- Test: `tests/game-state.test.ts`

**Interfaces:**
- Consumes: `PenguinPlayer`, `TerrainGenerator`, `LeopardSeal`, `ObstacleManager`
- Produces:
  ```typescript
  export interface GameStats {
    score: number;
    distanceMeters: number;
    fishCount: number;
    highScore: number;
    gameOver: boolean;
  }
  export class GameSimulation {
    player: PenguinPlayer;
    terrain: TerrainGenerator;
    chaser: LeopardSeal;
    obstacles: ObstacleManager;
    stats: GameStats;
    boostTimer: number;
    constructor();
    step(dt: number, input: { isHoldingSlide: boolean }): void;
    restart(): void;
  }
  ```

- [ ] **Step 1: Write failing tests in `tests/game-state.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { GameSimulation } from '../src/core/game-state';

describe('GameSimulation Master Controller', () => {
  it('initializes with default starting state', () => {
    const game = new GameSimulation();
    expect(game.stats.score).toBe(0);
    expect(game.stats.distanceMeters).toBe(0);
    expect(game.stats.gameOver).toBe(false);
  });

  it('updates distance, score, and advances player on step', () => {
    const game = new GameSimulation();
    game.step(0.1, { isHoldingSlide: true });
    expect(game.stats.distanceMeters).toBeGreaterThan(0);
    expect(game.stats.score).toBeGreaterThan(0);
  });

  it('ends game when chaser catches player', () => {
    const game = new GameSimulation();
    game.chaser.trailingDistance = 5;
    // Step with player stopped
    game.player.velocity = { x: 0, y: 0 };
    game.step(1.0, { isHoldingSlide: false });
    expect(game.stats.gameOver).toBe(true);
  });

  it('restarts game cleanly resetting positions and chaser distance', () => {
    const game = new GameSimulation();
    game.stats.gameOver = true;
    game.stats.score = 500;
    game.restart();
    expect(game.stats.gameOver).toBe(false);
    expect(game.stats.score).toBe(0);
    expect(game.stats.highScore).toBe(500);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game-state.test.ts`  
Expected: FAIL with missing `GameSimulation`.

- [ ] **Step 3: Implement `GameSimulation` in `src/core/game-state.ts`**

Coordinate player updates, chaser tracking, obstacle spawning/collisions, score aggregation, boost meter triggering, and `localStorage` high score persistence.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/game-state.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/game-state.ts tests/game-state.test.ts
git commit -m "feat: implement game simulation controller and scoring loop"
```

---

### Task 7: Procedural Audio Engine (Web Audio API)

**Files:**
- Create: `src/audio/sound-effects.ts`
- Test: `tests/audio.test.ts`

**Interfaces:**
- Consumes: None (Web Audio API standard oscillators / noise buffers).
- Produces:
  ```typescript
  export class SoundEngine {
    constructor(audioContext?: AudioContext);
    playSlideWoosh(speedRatio: number): void;
    playFishPickup(): void;
    playBrakingScrape(): void;
    playJump(): void;
    playRoarAlert(): void;
    playGameOver(): void;
  }
  ```

- [ ] **Step 1: Write test in `tests/audio.test.ts`**

Verify sound trigger interfaces without throwing when AudioContext is uninitialized or mocked.

```typescript
import { describe, it, expect } from 'vitest';
import { SoundEngine } from '../src/audio/sound-effects';

describe('SoundEngine', () => {
  it('instantiates safely without audio context in headless environment', () => {
    const sound = new SoundEngine();
    expect(() => sound.playFishPickup()).not.toThrow();
    expect(() => sound.playSlideWoosh(0.5)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/audio.test.ts`  
Expected: FAIL with missing module.

- [ ] **Step 3: Implement `SoundEngine` in `src/audio/sound-effects.ts`**

Build synthesizer effects using `OscillatorNode`, `GainNode`, and generated white noise buffer for snow slide wind and braking scrapes.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/audio.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/audio/sound-effects.ts tests/audio.test.ts
git commit -m "feat: implement procedural web audio sound engine"
```

---

### Task 8: Canvas 2D Viewport, Parallax Renderer, HUD & Main Entry

**Files:**
- Create: `index.html`
- Create: `src/render/canvas-view.ts`
- Create: `src/render/hud.ts`
- Create: `src/main.ts`

**Interfaces:**
- Consumes: `GameSimulation` from `src/core/game-state.ts`, `SoundEngine` from `src/audio/sound-effects.ts`.
- Produces:
  - Responsive full-screen canvas viewport with device pixel ratio scaling.
  - Parallax mountain silhouettes and snow gradient sky.
  - Smooth camera tracking centered slightly ahead of penguin.
  - Procedural penguin drawing (belly sliding vs upright waddle).
  - Snow spray particle emitter.
  - HUD overlays: Distance, Score, Fish count, Chaser Threat vignette, Game Over restart modal.
  - One-touch event handling (`pointerdown`, `pointerup`).

- [ ] **Step 1: Create `src/render/hud.ts` and `src/render/canvas-view.ts`**

Implement smooth camera lerp, procedural terrain polygonal fill with snow caps, parallax mountain backdrop, and particle management.

- [ ] **Step 2: Create `index.html` and `src/main.ts`**

Bind canvas viewport resizing, wire up `pointerdown` / `pointerup` and keyboard listeners (`Space`, `ArrowDown`), run `requestAnimationFrame` loop stepping `GameSimulation` and invoking `CanvasView.render()`.

- [ ] **Step 3: Verify build and run verification**

Run: `npx vite build`  
Expected: Vite bundles cleanly without TypeScript errors to `dist/`.

- [ ] **Step 4: Commit**

```bash
git add index.html src/render/canvas-view.ts src/render/hud.ts src/main.ts
git commit -m "feat: implement 2D canvas renderer, parallax camera, HUD and game loop"
```
