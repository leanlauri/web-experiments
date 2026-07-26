# Sandcastle

An interactive, chunked voxel-terrain experiment. Click or tap to launch a charge,
drag to orbit, and scroll or pinch to zoom. Explosions subtract a noisy sphere from
the density field and turn part of the removed volume into physical debris. Debris
that remains still for five seconds is voxelized back into the landscape.

## Run

```sh
bun install
bun run dev
```

Use `bun test` for the procedural terrain tests and `bun run build` for a production
bundle.

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

The scene also seeds destructible low-poly props across the dunes: rainbow arches,
palm trees, cars, camels, and small mannequin-like people. They are static physics
bodies while intact, so direct hits detonate charges, and nearby blasts break them
into temporary colored fragments.

Silly Mode changes the flying terrain debris visuals from sand rocks into playful
objects such as rainbow arcs, rings, cones, and toy-like blocks while preserving the
same voxel budget for terrain reintegration.
