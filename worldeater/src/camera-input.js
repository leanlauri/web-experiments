export function cameraRelativeMovement({ forwardX, forwardZ, horizontal, vertical, speed }) {
  const rightX = -forwardZ;
  const rightZ = forwardX;
  let x = forwardX * vertical + rightX * horizontal;
  let z = forwardZ * vertical + rightZ * horizontal;
  const length = Math.hypot(x, z);
  if (length > 0) {
    x = (x / length) * speed;
    z = (z / length) * speed;
  }
  return { x, z };
}

export function moveTowardsTarget({ x, z, targetX, targetZ, speed }) {
  const deltaX = targetX - x;
  const deltaZ = targetZ - z;
  const distance = Math.hypot(deltaX, deltaZ);
  if (distance <= speed || distance === 0) return { x: targetX, z: targetZ };
  return { x: x + deltaX / distance * speed, z: z + deltaZ / distance * speed };
}
