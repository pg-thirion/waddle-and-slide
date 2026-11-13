# Design Spec: Waddle & Slide

**Date:** 2026-11-13  
**Status:** Approved  
**Platform:** Mobile Web (PWA / Touch-enabled HTML5 Canvas) & Native-ready via Capacitor  
**Language/Runtime:** TypeScript, Node 24+, Vite, Vitest  

---

## 1. Vision & Intent

*Waddle & Slide* is a high-speed, one-touch 2D downhill physics runner starring a penguin escaping an encroaching leopard seal down an endless glacial slope. 

The emotional hook is the immediate tactile contrast between two movement states:
- **Belly Slide (Hold Touch):** Near-zero friction, surging downhill acceleration, massive speed, soaring ramp jumps, but limited steering.
- **Waddle Brake (Release Touch):** High friction, immediate braking deceleration, tight carving control to dodge boulders and sleeping walruses, but at the cost of losing speed and allowing the predator to close in.

Sessions are bite-sized (30 to 60 seconds per run) with instant (< 1 second) restarts and high replayability.

---

## 2. Goals, Non-Goals, & Anti-Goals

### Goals
- **One-touch mastery:** The entire core loop is playable with a single thumb (touch/hold to slide, release to brake/waddle).
- **Juicy tactile momentum:** Physics capture weight, slope acceleration, snow spray particles, and ramp launches.
- **Zero external asset dependencies:** All rendering is procedural 2D canvas vector graphics and all sound effects are generated via the Web Audio API. Zero load screens.
- **Strictly decoupled architecture:** Core physics, terrain generation, and game rules operate headlessly without DOM dependencies, verified by 100% deterministic Vitest unit tests.
- **Instant replay:** Game over transitions directly to a tap-to-restart prompt in less than 500ms.

### Non-Goals
- Complex 3D rendering or skeletal animation rigs.
- Online multiplayer or server-side leaderboards (high scores persist in `localStorage`).
- In-app purchases, ad SDKs, or monetization popups.

### Anti-Goals
- **Floaty physics:** The penguin must not feel like a balloon; gravity and friction curves must provide crisp, snappy feedback.
- **Menu bloat:** No multi-page menus or onboarding tutorials before letting the player play.

---

## 3. Core Mechanics & State Machine

### 3.1 Player State Machine
The player entity operates across three distinct states:
1. `WADDLE_BRAKE` (Default state when screen is NOT touched):
   - Friction coefficient $\mu = 0.35$.
   - Speed decelerates toward a baseline walking speed ($120\text{ px/s}$).
   - High steering precision (lateral adjustment).
   - Animation: upright waddle stance.
2. `BELLY_SLIDE` (Active when screen IS touched and held while grounded):
   - Friction coefficient $\mu = 0.02$.
   - Acceleration driven by slope gradient: $a = g \cdot \sin(\theta) \cdot \text{slopeMultiplier}$.
   - Top speed uncapped on steep descents (terminal clamp at $1400\text{ px/s}$).
   - Animation: flat belly slide, snow spray emitted from tail.
3. `AIRBORNE` (Triggered when terrain drops away or cresting a ramp at speed):
   - Gravity: $g = 980\text{ px/s}^2$.
   - Pitch aligns smoothly toward velocity angle.
   - Downward swipe or tap-hold mid-air activates a "belly dive" to dive faster toward downslopes.
   - Smooth landing bonus: landing tangential to a downhill slope awards a speed boost (`+15%` current velocity) and combo multiplier. Landing flat or uphill incurs speed penalty (`-30%`).

### 3.2 Leopard Seal Chaser System
- The leopard seal tracks behind the player at distance $D$.
- Base initial distance: $350\text{ px}$.
- The seal has an internal speed curve: accelerates when the player slows down, maintaining constant pressure.
- Threat warning:
  - $D > 250\text{ px}$: Calm (no indicator).
  - $100\text{ px} < D \le 250\text{ px}$: Yellow alert (subtle screen border pulse, splashing audio).
  - $D \le 100\text{ px}$: Red alert (intense roar cue, jaws visible at left screen edge).
  - $D \le 0\text{ px}$: Caught! Trigger Game Over sequence.

### 3.3 Terrain Generation
- Infinite 2D procedural slope based on chained cubic Hermite splines or multi-octave sine curves.
- Terrain features:
  - **Gentle Rollers:** safe beginner slopes for building rhythm.
  - **Steep Drops:** maximum speed gain zones.
  - **Launch Ramps:** angled kickers designed to launch player into air over gaps.
  - **Crevasses / Water Gaps:** bottomless drops where player must maintain enough speed to clear. Falling into water triggers instant seal catch.
- Terrain sampling interface:
  - `getHeightAt(x: number): number`
  - `getNormalAt(x: number): Vector2`
  - `getSlopeAngleAt(x: number): number`

### 3.4 Obstacles & Pickups
- **Ice Boulders:** Static hazards placed on terrain. Colliding while sliding knocks player upright and bleeds $50\%$ speed.
- **Sleeping Walruses:** Wide obstacles; sliding into them bounces the player backward.
- **Krill / Golden Fish:** Suspended in arcs matching jump trajectories. Collecting adds points ($+100$ pts) and fills a "Speed Burst" meter. When full, awards $2$ seconds of invulnerable rocket slide.

---

## 4. Technical Specifications & Architecture

### Directory Layout
```
voxel/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── docs/
│   └── superpowers/
│       ├── specs/
│       │   └── 2026-11-13-waddle-and-slide-design.md
│       └── plans/
│           └── 2026-11-13-waddle-and-slide.md
├── src/
│   ├── core/
│   │   ├── types.ts          # Game entities, states, math interfaces
│   │   ├── vector.ts         # 2D vector math operations
│   │   ├── terrain.ts        # Procedural spline terrain generator
│   │   ├── player.ts         # Penguin physics & state machine
│   │   ├── chaser.ts         # Leopard seal distance & threat logic
│   │   ├── obstacles.ts      # Obstacle spawner & AABB/circle collision
│   │   └── game-state.ts     # Master simulation controller (step, scoring, restart)
│   ├── audio/
│   │   └── sound-effects.ts  # Web Audio API procedural sound synthesizers
│   ├── render/
│   │   ├── canvas-view.ts    # 2D Canvas viewport, camera follow, particles
│   │   └── hud.ts            # Score, distance, threat vignette renderer
│   └── main.ts               # Entry point, touch listeners, requestAnimationFrame loop
└── tests/
    ├── vector.test.ts
    ├── terrain.test.ts
    ├── player.test.ts
    ├── chaser.test.ts
    ├── obstacles.test.ts
    └── game-state.test.ts
```

### Global Constraints
- Target Language: TypeScript 5.x.
- Runtimes: Node 24+, Modern Web Browsers (Mobile Safari, Chrome on Android).
- Build Tool: Vite.
- Test Runner: Vitest (headless, fast unit tests).
- Dependencies: Zero runtime libraries outside Vite build tooling.

---

## 5. User Interface & Controls
- **Display:** Responsive portrait/landscape HTML5 `<canvas>` filling viewport with automatic pixel ratio scaling (`window.devicePixelRatio`).
- **Touch Input:**
  - `pointerdown`: Activate belly slide (`BELLY_SLIDE`).
  - `pointerup`: Deactivate belly slide (`WADDLE_BRAKE`).
  - Keyboard fallback for desktop dev: Spacebar / Down Arrow.
- **HUD:**
  - Top Left: Distance (meters) & Current Score.
  - Top Right: Fish collected.
  - Bottom Bar / Left Vignette: Chaser Threat warning gauge.
  - Center (on Death): High Score display + "TAP TO SLIDE AGAIN" prompt.
