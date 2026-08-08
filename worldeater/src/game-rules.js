export const HOLE_OPENING_RATIO = 0.68;

export function holeOpeningRadius(holeRadius) {
  return holeRadius * HOLE_OPENING_RATIO;
}

export function stackActivationRadius({ openingRadius, maxFootprint, settleMargin = 1.25 }) {
  return openingRadius + maxFootprint + settleMargin;
}

export function compareStackLevels(a, b) {
  return Number(a.type === 'cone') - Number(b.type === 'cone')
    || b.footprint - a.footprint;
}

export function canSwallow({ footprintRadius, openingRadius, distance, height, bodyY }) {
  return footprintRadius <= openingRadius * 0.92
    && distance < openingRadius - footprintRadius * 0.35
    && bodyY < height * 2.8;
}

export function grownHoleRadius(currentRadius, objectSize) {
  return currentRadius + 0.012 + objectSize * 0.035;
}

export function canCancelSinking({ bodyY, distance, cancelRadius, recoverHeight = 0 }) {
  return bodyY >= Math.max(-0.04, recoverHeight) && distance > cancelRadius;
}

export function shouldConsumeAtDepth({ bodyY, consumeDepth }) {
  return bodyY <= consumeDepth;
}

// The rim is the only physical part of the hole. Once an object clears it,
// it enters the visual void and must not collide with other swallowed props.
export function shouldReleaseIntoVoid({ bodyY, rimDepth }) {
  return bodyY <= -rimDepth;
}

export function shaftContainment({ offsetX, offsetZ, openingRadius, footprintRadius }) {
  const distance = Math.hypot(offsetX, offsetZ);
  const maximumDistance = Math.max(0, openingRadius - footprintRadius * 1.05);
  if (distance === 0 || distance <= maximumDistance) return { x: 0, z: 0 };
  const correction = distance - maximumDistance;
  const x = -offsetX / distance * correction;
  const z = -offsetZ / distance * correction;
  return { x: x || 0, z: z || 0 };
}
