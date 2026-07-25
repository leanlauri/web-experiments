# Vex Vale — Animation Manifest

**Asset:** Vex Vale / The Facet Fox  
**Version:** 0.1 greybox  
**Rig type:** Rigid low-poly body-part rig with placeholder armature actions  
**Frame rate:** 30 FPS  
**Movement axis:** `+X` forward/right, `Z` up, `Y` depth/camera side  

These clips are placeholders intended for gameplay testing, scale checks, and animation direction. They are not final polished animation.

| Action name | Frames | Loop | Intended use |
|---|---:|---|---|
| `ACT_Vex_Idle_60f_loop` | 60 | Yes | Standing idle with slight body/scarf movement |
| `ACT_Vex_Run_20f_loop_in_place` | 20 | Yes | Main in-place run cycle for side-scrolling movement |
| `ACT_Vex_JumpStart_08f` | 8 | No | Squash/anticipation and takeoff pose |
| `ACT_Vex_JumpRise_16f_hold` | 16 | No/hold | Upward jump pose after takeoff |
| `ACT_Vex_FallLoop_16f_loop` | 16 | Yes | Falling loop for normal drops |
| `ACT_Vex_LandLight_10f` | 10 | No | Light landing and recovery |
| `ACT_Vex_VaultLow_24f` | 24 | No | Low obstacle vault placeholder |
| `ACT_Vex_Trip_30f` | 30 | No | Obstacle trip/stumble placeholder |
| `ACT_Vex_FrontFlip_30f` | 30 | No | Forward trick flip placeholder |
| `ACT_Vex_RollLanding_28f` | 28 | No | Landing roll/tumble recovery placeholder |

## Recommended engine mapping

| Gameplay state | Suggested animation |
|---|---|
| Idle | `ACT_Vex_Idle_60f_loop` |
| Run | `ACT_Vex_Run_20f_loop_in_place` |
| Jump button pressed | `ACT_Vex_JumpStart_08f` |
| Vertical velocity > 0 | `ACT_Vex_JumpRise_16f_hold` |
| Vertical velocity < 0 | `ACT_Vex_FallLoop_16f_loop` |
| Grounded after small drop | `ACT_Vex_LandLight_10f` |
| Vault trigger entered | `ACT_Vex_VaultLow_24f` |
| Hit low obstacle | `ACT_Vex_Trip_30f` |
| Trick input while airborne | `ACT_Vex_FrontFlip_30f` |
| High landing with safe recovery | `ACT_Vex_RollLanding_28f` |

## Notes for iteration

- Keep gameplay motion controlled by code, not root motion, until the controller feels good.
- The run clip is in-place by design.
- The scarf is segmented so it can later be converted to bone-driven secondary motion.
- The current rig is intentionally rigid. Once the proportions are approved, replace it with a single skinned mesh and proper deformation weights.
