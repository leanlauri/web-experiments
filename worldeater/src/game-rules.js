export function canSwallow({ footprintRadius, openingRadius, distance, height, bodyY }) {
  return footprintRadius <= openingRadius * 0.92
    && distance < openingRadius - footprintRadius * 0.35
    && bodyY < height * 2.8;
}

export function grownHoleRadius(currentRadius, objectSize) {
  return currentRadius + 0.055 + objectSize * 0.16;
}

export function canCancelSinking({ bodyY, distance, cancelRadius }) {
  return bodyY >= -0.04 && distance > cancelRadius;
}
