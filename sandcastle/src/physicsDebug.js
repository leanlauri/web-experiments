import * as THREE from 'three';
import * as CANNON from 'cannon-es';

const colorForBody = (body) => {
  if (body.userData?.kind === 'cityAgent') return '#ff4fb2';
  return body.mass > 0 ? '#59dcff' : '#ffc857';
};

function createShapeLine(shape, color) {
  let geometry = null;
  if (shape.type === CANNON.Shape.types.BOX) {
    const { x, y, z } = shape.halfExtents;
    geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(x * 2, y * 2, z * 2));
  } else if (shape.type === CANNON.Shape.types.SPHERE) {
    geometry = new THREE.WireframeGeometry(new THREE.SphereGeometry(shape.radius, 10, 7));
  }
  if (!geometry) return null;
  const line = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, opacity: .82 }));
  line.renderOrder = 20;
  return line;
}

// Cannon bodies are otherwise invisible, which makes it very difficult to
// tune the streamed town's lightweight collider proxies against their models.
export class PhysicsColliderDebug {
  constructor(scene) {
    this.root = new THREE.Group();
    this.root.name = 'physics-collider-debug';
    this.root.visible = false;
    this.lines = new Map();
    scene.add(this.root);
  }

  set enabled(value) {
    this.root.visible = value;
  }

  get enabled() {
    return this.root.visible;
  }

  update(world) {
    if (!this.enabled) return;
    const live = new Set();
    for (const body of world.bodies) {
      for (let index = 0; index < body.shapes.length; index++) {
        const shape = body.shapes[index];
        const key = `${body.id}:${index}`;
        let line = this.lines.get(key);
        if (!line) {
          line = createShapeLine(shape, colorForBody(body));
          if (!line) continue;
          this.lines.set(key, line);
          this.root.add(line);
        }
        live.add(key);
        const offset = body.shapeOffsets[index];
        const orientation = body.shapeOrientations[index];
        const worldOffset = body.quaternion.vmult(offset, new CANNON.Vec3());
        const worldOrientation = body.quaternion.mult(orientation, new CANNON.Quaternion());
        line.position.set(body.position.x + worldOffset.x, body.position.y + worldOffset.y, body.position.z + worldOffset.z);
        line.quaternion.set(worldOrientation.x, worldOrientation.y, worldOrientation.z, worldOrientation.w);
      }
    }
    for (const [key, line] of this.lines) {
      if (live.has(key)) continue;
      line.geometry.dispose();
      line.material.dispose();
      line.removeFromParent();
      this.lines.delete(key);
    }
  }

  dispose() {
    for (const line of this.lines.values()) {
      line.geometry.dispose();
      line.material.dispose();
    }
    this.lines.clear();
    this.root.removeFromParent();
  }
}
