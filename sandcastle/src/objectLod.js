// Terrain detail begins to simplify well before the fog. Keep full objects
// longer than the terrain's high-detail ring, then use a hysteresis band so a
// slow camera movement cannot make them flicker between representations.
export const OBJECT_LOD_ENTER_DISTANCE = 140;
export const OBJECT_LOD_EXIT_DISTANCE = 116;
export const OBJECT_CULL_DISTANCE = 180;

export function shouldUseObjectLod(distance, usingLod = false, {
  enterDistance = OBJECT_LOD_ENTER_DISTANCE,
  exitDistance = OBJECT_LOD_EXIT_DISTANCE,
} = {}) {
  return usingLod ? distance > exitDistance : distance >= enterDistance;
}

export function updateObjectLod({ full, low, distance, usingLod = false, radius = 0, culler }) {
  const nextUsingLod = shouldUseObjectLod(distance, usingLod);
  const visible = culler.updateObject(nextUsingLod ? low : full, radius);
  full.visible = visible && !nextUsingLod;
  low.visible = visible && nextUsingLod;
  return nextUsingLod;
}
