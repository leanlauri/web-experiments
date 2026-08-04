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
