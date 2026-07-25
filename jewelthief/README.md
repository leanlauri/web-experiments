# Jewel Thief

First playable prototype for a low-poly, side-on 3D parkour game starring Vex Vale, The Facet Fox.

## Run

```bash
npm install
npm run dev
```

## Prototype Controls

- `A/D` or arrow keys: move
- `Shift`: sprint
- `Space`: variable-height jump or vault near a low obstacle
- `E`: parkour through vault/window/door/ladder/balcony markers
- `Q` or `F`: flip while airborne
- `1/2`: debug camera zoom in/out
- `R`: reset route

## Current Slice

- Three.js city scene with layered low-poly rooftops.
- Rapier physics for player gravity and rooftop collisions.
- 2D side-plane movement inside a 3D environment.
- Imported Vex Vale greybox GLB with procedural placeholder action posing.
- Buffered running, sprinting, variable jumps, landing/roll feedback, falling, flipping, vaulting, ladder climbs, balcony hops, door/window traversal, tripping, jewel pickup, combo, and reset loop.
- Authored route districts: night-market awnings, fire escapes, ladders, balcony zig-zags, clock tower ledges, rooftop garden, construction scaffold/crane, museum skylights/security beams, safehouse finale, and jewel trails.

The supplied GLB is static, so proper animation clips are represented procedurally until the Blender rig exports animated GLB/FBX actions.
