# Vex Vale / The Facet Fox — Low-Poly Greybox Asset Package

This package contains the first production blockout for the player character: a stylised low-poly jewel thief built for a 3D environment with side-on 2D movement.

## Included files

| File | Purpose |
|---|---|
| `vex_vale_lowpoly_blockout_static.glb` | Static coloured GLB preview/import mesh generated in this runtime |
| `vex_vale_combined_static_mesh.glb` | Combined single-mesh GLB for quick preview or triangle-count checks |
| `vex_vale_lowpoly_blockout_static.obj` | Static OBJ fallback; some viewers may ignore vertex colours |
| `vex_vale_blender_rigged_blockout_generator.py` | Blender script that builds the rigged greybox and placeholder animation Actions |
| `vex_vale_animation_manifest.md` | Clip list, frame counts, and intended gameplay mapping |
| `vex_vale_blockout_stats.json` | Basic mesh stats and orientation notes |

## Character design summary

- **Name:** Vex Vale
- **Alias:** The Facet Fox
- **Role:** Player-controlled jewel thief / freerunner
- **Style:** Low-poly stylised
- **Silhouette features:** pointed hood, fox-like ears, scarf/sash, satchel, chunky parkour shoes
- **Palette:** dark navy, deep purple, charcoal, teal, gold, cyan gem accents
- **Tone:** agile, theatrical, playful, non-gritty

## Technical notes

- **Axis setup:** `Z` up, `+X` forward/right, `Y` depth/camera side
- **Approximate scale:** human-sized, feet on ground plane
- **Static package triangle count:** about 818 triangles
- **Mesh-part count:** 39 separate named pieces
- **Materials:** flat colour only, no texture maps
- **Rig style in Blender script:** rigid body-part parenting to a simple armature

## How to generate the rigged Blender version

1. Open Blender.
2. Open `vex_vale_blender_rigged_blockout_generator.py` in the Text Editor.
3. Run the script.
4. Select `RIG_Vex_Armature`.
5. Open the Dope Sheet / Action Editor to preview the generated placeholder Actions.

At the top of the script, you can set:

```python
SAVE_BLEND_ON_RUN = True
EXPORT_FBX_ON_RUN = True
```

Then run the script again to save a `.blend` or export an `.fbx` locally.

## Current limitations

This is not final art. It is a greybox asset for movement testing.

- The static GLB/OBJ files do not contain animations.
- The Blender script creates placeholder animation Actions, but they are not polished.
- The rig is rigid body-part parenting, not a final skinned mesh.
- The scarf is segmented for readability and later bone animation, not simulated cloth.
- The `CH_Vex_Ground_Reference_DeleteMe` object is only a scale/contact marker and should be removed before final export.

## Recommended next production step

Import the rigged version into the game engine and test only the core controller first:

1. Idle
2. Run
3. Jump start
4. Jump rise
5. Fall loop
6. Land light
7. Vault low
8. Trip

Do not polish the model until the run speed, jump arc, landing timing, vault trigger, and silhouette readability feel good in-game.
