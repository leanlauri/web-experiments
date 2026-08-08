# Sandcastle

An interactive modular world experiment. Terrain, the dune buggy, and the procedural
city are independently selectable. The city generator builds blocks into neighborhoods,
neighborhoods into boroughs, and boroughs into a connected city, with road-following
vehicles, people, and animals.

## Run

```sh
bun install
bun run dev
```

Use `bun test` for the procedural terrain tests and `bun run build` for a production
bundle.

## Feature Switches

Use URL parameters to choose the active world modules:

```text
?terrain=false
?buggy=false
?city=false
?citySize=small
?citySize=medium
?citySize=large
?terrainPlugin=voxel
?terrainPlugin=flat
?cityPlugin=procedural
?cityPlugin=settlements
```

## Architecture

`src/main.js` is only the browser entry point. `src/engine.js` owns application
setup, the frame loop, input, and the current world. Game objects live in the
renderer-independent ECS under `src/ecs/`; physics, visuals, input, camera behavior,
and damage are separate components. The buggy is an entity-first feature under
`src/objects/buggy/`, where each component owns its implementation and the engine
accesses it through ECS component queries.

Large replaceable features use `src/plugins/registry.js`. Terrain and city plugins
are selected by ID, activated into stable slots, and expose their content through
an `api`. Built-in implementations live below `src/plugins/terrain/` and
`src/plugins/city/`. Registering another implementation with the same `type` is
enough to make it selectable without changing engine consumers.

For server-side tests or batch runs, `createHeadlessSimulation()` from
`src/headless.js` constructs Cannon physics, ECS entities, and a terrain API without
a Three.js scene, renderer, camera, or visual components.

The procedural city remains split into `src/city/layout.js`, `src/city/agents.js`,
and `src/city/city.js`. Its awake chunks use the existing piece-built destructible
building factory, while sleeping chunks release those detailed physics structures
until the player returns.

## Implementation

The terrain is split into 10×10-cell chunks. Terrain edits still mutate a compact
coarse voxel-density field for material accounting, debris budgets, and
reintegration. Separately, edited chunks record smooth constructive-solid-geometry
operations and remesh through a local signed-distance-field surface extractor.
Untouched chunks remain the original lightweight smoothed heightfield, while blast
and merge zones get sub-cell visual/collision detail without shrinking every voxel
in the world. Three.js renders the scene; Cannon ES integrates bomb and debris
motion. Dynamic pieces resolve against the same signed-distance surface used by
edited terrain chunks, then their final mesh shape is sampled back into the coarse
terrain voxel volume. The standalone rock mesh is removed after the merge, so later
explosions carve the deposited material through the same terrain path as the
original landscape. Explosions assign roughly 88% of removed terrain voxels to
visible sand debris and treat the rest as blast wastage; each piece carries that
voxel budget until it merges, keeping crater volume, flying rock volume, and
re-added terrain volume in the same rough balance.

Additive Mode switches the click/tap and spacebar tool from a charge launcher to
a terrain dropper. It releases a heavy cylindrical sand-and-rock block above the
selected point, so its fall can crush building parts before it comes to rest and
is sampled back into the same voxel terrain volume as ordinary boulders.

The scene also seeds destructible low-poly props across the dunes: rainbow arches,
palm trees, cars, camels, and small mannequin-like people. They are static physics
bodies while intact, so direct hits detonate charges, and nearby blasts break them
into temporary colored fragments.

Silly Mode changes the flying terrain debris visuals from sand rocks into playful
objects such as rainbow arcs, rings, cones, and toy-like blocks while preserving the
same voxel budget for terrain reintegration.
