export function layoutStackLevels(
  levels,
  { groundY = 0, groundMargin = 0.04, levelMargin = 0.08 } = {},
) {
  let previousTop = groundY;

  return levels.map((level, index) => {
    if (!Number.isFinite(level.halfHeight) || level.halfHeight < 0) {
      throw new RangeError('Stack level halfHeight must be a non-negative finite number.');
    }

    const margin = index === 0 ? groundMargin : levelMargin;
    const bottom = previousTop + margin;
    const y = bottom + level.halfHeight;
    const top = y + level.halfHeight;
    previousTop = top;

    return { ...level, y, bottom, top };
  });
}
