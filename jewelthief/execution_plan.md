# Jewel Thief Web Game Execution Plan

## Goal

Build a web-delivered, physics-based parkour game about Vex Vale, a low-poly jewel thief freerunning through a stylised city. The world is 3D, but player movement is constrained to a 2D side-on gameplay plane.

## Production Phases

### 1. First Playable Greybox

- Scaffold a browser game using Three.js for rendering and Rapier for physics.
- Import the existing Vex Vale low-poly greybox GLB.
- Build a side-on camera that follows the player through a layered 3D cityscape.
- Create a rigid-body player controller constrained to the X/Y plane.
- Implement running, sprinting, jumping, variable airborne control, landing, tripping, falling recovery, and a trick flip input.
- Add first-pass interactions: rooftop gaps, low vault obstacles, windows/doors, collectibles, scoring, and reset/recovery.
- Use procedural placeholder animation states until rigged animation clips are exported.

### 2. Controller Feel Pass

- Tune acceleration, max speed, jump impulse, gravity, landing friction, and coyote-time.
- Add trick timing windows and score multipliers.
- Replace simple obstacle checks with marker-driven parkour assists: vault start, contact, clear, end, window entry, center, exit, ledge grab, and stand points.
- Add fall-height-based landing outcomes: clean landing, roll, stumble, or fail.
- Add input buffering for jumps, vaults, and tricks.

### 3. Character Art And Animation Pass

- Generate/export the rigged Vex Vale model from the Blender script.
- Convert placeholder Blender actions to engine-ready GLB animation clips.
- Build an animation mixer state machine for idle, run, jump start, rise, fall, land, vault, trip, flip, and roll.
- Add scarf and satchel secondary motion through procedural bone offsets if clip animation is not enough.
- Improve materials while preserving the flat low-poly palette.

### 4. Level And Encounter Systems

- Create reusable level modules: rooftop, short gap, long gap, low vault, chimney cluster, skylight, window corridor, door breach, ledge catch, jewel line, and safehouse exit.
- Add deterministic chunk spawning for endless-runner style testing.
- Add authored challenge routes for hand-tuned parkour sequences.
- Add route grading based on speed, jewels collected, tricks, landings, and collisions.

### 5. Game Loop And Presentation

- Add start, pause, fail, and results states.
- Add UI for jewels, combo, distance, velocity, current action, and best route grade.
- Add audio cues for footsteps, jumps, vault contacts, glass/window traversal, jewel pickups, trips, and landings.
- Add a simple progression loop: route selection, heist target, reward gems, unlock palette variants.

### 6. Polish And Shipping

- Optimize asset loading, shadows, draw calls, and physics colliders.
- Add mobile-responsive camera/framing and optional touch controls.
- Add accessibility settings for camera shake, motion blur, contrast, and input remapping.
- Add automated smoke tests for loading and core input.
- Deploy as a static web app.

## First Playable Acceptance Criteria

- Vex appears as a low-poly jewel thief in a stylised 3D city.
- The player can run, jump, flip, vault, enter window/door openings, collect jewels, trip, recover, and fall/reset.
- Movement remains constrained to a side-on 2D plane.
- Physics, collision, and landing feedback are visible and tunable.
- The web app runs locally with `npm run dev`.
