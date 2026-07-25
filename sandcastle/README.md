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

The terrain is split into 10×10-cell chunks. Terrain edits mutate a voxel-density
field, then only touched chunks are remeshed into a smoothed heightfield surface.
This keeps the boolean edit model compact while avoiding exposed cube-face or
over-tessellated artifacts in the rendered terrain. Three.js renders the scene;
Cannon ES integrates bomb and debris motion. Dynamic pieces use the same smoothed
terrain height as the visible mesh for landing, then their final mesh shape is
sampled back into the terrain voxel volume. The standalone rock mesh is removed
after the merge, so later explosions carve the deposited material through the same
terrain path as the original landscape. Explosions assign roughly 88% of removed
terrain voxels to visible sand debris and treat the rest as blast wastage; each
piece carries that voxel budget until it merges, keeping crater volume, flying
rock volume, and re-added terrain volume in the same rough balance.

The scene also seeds destructible low-poly props across the dunes: rainbow arches,
palm trees, cars, camels, and small mannequin-like people. They are static physics
bodies while intact, so direct hits detonate charges, and nearby blasts break them
into temporary colored fragments.

Silly Mode changes the flying terrain debris visuals from sand rocks into playful
objects such as rainbow arcs, rings, cones, and toy-like blocks while preserving the
same voxel budget for terrain reintegration.
