# Performance strategy

## Goal

Keep interaction responsive as terrain, destructible structures, and simulation
state grow. The engine should spend frame time only on content that can affect
the player or is visible to the camera.

## Spatial ownership

Every streamed object belongs to a terrain chunk. Chunk state is deliberately
split into three independent sets:

| Set | Anchor | Responsibility |
| --- | --- | --- |
| Render-visible | Camera | Render and shadow work only for visible, in-range chunks. |
| Prewarm | Camera/player | Keep nearby assets ready so entering a region does not hitch. |
| Simulation-active | Player/interaction anchor | Run Cannon bodies, actor AI, terrain contact, debris, and effects; it never controls render visibility. |

Simulation enters at a two-chunk radius and exits at a three-chunk radius. This
hysteresis prevents loading/unloading on chunk boundaries. Projectiles, recently
exploded debris, and the controlled buggy remain in an explicit always-active set.

## Delivery phases

1. **Instrumentation** — expose frame p95, physics phase p95, draw calls,
   triangle count, and live physics bodies. Use the numbers as the acceptance
   baseline.
2. **Chunk registry** — assign props, buildings, dynamic parts, debris, and
   projectiles to chunks; pause their evaluation and remove their Cannon bodies
   outside the simulation-active set while preserving state for reactivation.
3. **Render culling** — cull chunk groups against the camera frustum and distance
   budget; suppress shadows outside the close range; apply reduced update rates
   to rendered-but-inactive content.
4. **Streaming budget** — queue and coalesce terrain rebuilds. Prioritize visible
   chunks, then simulation chunks, and defer background LOD work to a bounded
   per-frame budget.

## Non-negotiable behaviour

- Destroyed terrain and building state must persist after a chunk unloads.
- Returning to a chunk must not cause a physics burst, object duplication, or
  visible terrain gap.
- Offscreen work may pause; it must not be silently discarded unless it is an
  intentionally short-lived effect.
- Each phase is tested, committed, pushed, and recorded before the next phase.

## Performance acceptance targets

- No global per-frame update loop over unloaded actors, props, or debris.
- Physics body count scales with the active area, not total world content.
- Camera turns do not render or shadow content behind the camera.
- Median frame time remains within 16.7 ms and p95 below 33 ms on the target
  hardware after a sustained destruction sequence.
- Terrain edit rebuild work is bounded per frame after the streaming-budget phase.

## Implemented

- The telemetry panel reports frame p95, physics p95, active physics bodies,
  draw calls, and triangles from the live renderer.
- Props, actors, destructible building pieces, debris, and projectiles are
  registered to simulation chunks. Distant entries lose their Cannon body and
  pause evaluation until they return to the active ring.
- Terrain, buildings, props, debris, and the buggy are explicitly culled by the
  camera frustum and distance budget. Shadow casting is retained only near the
  camera.
- Actor animation and particle vertex updates pause when their visual is outside
  the camera budget; effect lifetime and cleanup continue normally.
- Terrain edits are coalesced and rebuilt under a two-high-detail/one-LOD
  per-frame budget, prioritising the streamed anchor.

## Validation

The complete automated suite and production build must pass for each delivery.
The in-app telemetry is the source of truth for checking the 16.7 ms median and
33 ms p95 targets on the deployment hardware after a sustained destruction run.
