import { describe, expect, it } from 'vitest';
import { cameraRelativeMovement } from '../src/camera-input.js';

describe('camera-relative keyboard movement', () => {
  it('maps up and right to the camera’s ground-plane forward and right vectors', () => {
    expect(cameraRelativeMovement({ forwardX: 0, forwardZ: -1, horizontal: 0, vertical: 1, speed: 4 })).toEqual({ x: 0, z: -4 });
    expect(cameraRelativeMovement({ forwardX: 0, forwardZ: -1, horizontal: 1, vertical: 0, speed: 4 })).toEqual({ x: 4, z: 0 });
  });

  it('does not make diagonal movement faster', () => {
    const movement = cameraRelativeMovement({ forwardX: 0, forwardZ: -1, horizontal: 1, vertical: 1, speed: 4 });
    expect(Math.hypot(movement.x, movement.z)).toBeCloseTo(4);
  });
});
