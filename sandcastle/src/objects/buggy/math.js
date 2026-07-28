import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export function velocityAtPoint(body, point) {
  const rx = point.x - body.position.x;
  const ry = point.y - body.position.y;
  const rz = point.z - body.position.z;
  const ax = body.angularVelocity.x;
  const ay = body.angularVelocity.y;
  const az = body.angularVelocity.z;
  return new CANNON.Vec3(
    body.velocity.x + ay * rz - az * ry,
    body.velocity.y + az * rx - ax * rz,
    body.velocity.z + ax * ry - ay * rx,
  );
}

export function projectOnPlane(vector, normal) {
  const projected = vector.clone().addScaledVector(normal, -vector.dot(normal));
  if (projected.lengthSq() < 0.0001) return null;
  return projected.normalize();
}

export function cannonToThree(vector) {
  return new THREE.Vector3(vector.x, vector.y, vector.z);
}
