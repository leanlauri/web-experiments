export function canSwallow({ size, holeRadius, distance, height, bodyY }) {
  return size < holeRadius * 0.72
    && distance < holeRadius * 0.62
    && bodyY < height * 2.8;
}

export function grownHoleRadius(currentRadius, objectSize) {
  return currentRadius + 0.055 + objectSize * 0.16;
}
