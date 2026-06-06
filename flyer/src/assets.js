import * as THREE from 'three';

const materials = {
  trunk: new THREE.MeshStandardMaterial({ color: 0x6b4d35, roughness: 0.9 }),
  leaves: new THREE.MeshStandardMaterial({ color: 0x2f7044, roughness: 0.82 }),
  darkLeaves: new THREE.MeshStandardMaterial({ color: 0x1f5136, roughness: 0.86 }),
  rock: new THREE.MeshStandardMaterial({ color: 0x7d8077, roughness: 0.95 }),
  road: new THREE.MeshStandardMaterial({ color: 0x7b7469, roughness: 0.95 }),
  roof: new THREE.MeshStandardMaterial({ color: 0x8f4a3b, roughness: 0.78 }),
  wall: new THREE.MeshStandardMaterial({ color: 0xd9c59e, roughness: 0.8 }),
  barn: new THREE.MeshStandardMaterial({ color: 0xa64232, roughness: 0.82 }),
  wheat: new THREE.MeshStandardMaterial({ color: 0xcda85d, roughness: 0.9 }),
  crop: new THREE.MeshStandardMaterial({ color: 0x5f8c47, roughness: 0.9 }),
  tilled: new THREE.MeshStandardMaterial({ color: 0x7b5b3e, roughness: 0.95 }),
  feather: new THREE.MeshStandardMaterial({ color: 0x2a3941, roughness: 0.66 }),
  chest: new THREE.MeshStandardMaterial({ color: 0xd7c090, roughness: 0.6 }),
  beak: new THREE.MeshStandardMaterial({ color: 0xd7a23b, roughness: 0.5 }),
  leg: new THREE.MeshStandardMaterial({ color: 0xb8893a, roughness: 0.65 }),
};

export class AssetFactory {
  createBird() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.95, 18, 12), materials.feather);
    body.scale.set(0.75, 0.52, 1.25);
    body.castShadow = true;

    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 10), materials.chest);
    chest.scale.set(0.62, 0.34, 0.9);
    chest.position.set(0, -0.12, -0.18);
    chest.castShadow = true;

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.43, 16, 10), materials.feather);
    head.position.set(0, 0.28, -1.05);
    head.castShadow = true;

    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.45, 8), materials.beak);
    beak.rotation.x = -Math.PI / 2;
    beak.position.set(0, 0.22, -1.47);
    beak.castShadow = true;

    const wingGeom = new THREE.BoxGeometry(2.4, 0.08, 0.55);
    const leftWing = new THREE.Group();
    const rightWing = new THREE.Group();
    const leftFeathers = new THREE.Mesh(wingGeom, materials.feather);
    const rightFeathers = new THREE.Mesh(wingGeom, materials.feather);
    leftWing.position.set(-0.55, 0.02, -0.05);
    rightWing.position.set(0.55, 0.02, -0.05);
    leftFeathers.position.set(-1.2, 0, 0);
    rightFeathers.position.set(1.2, 0, 0);
    leftWing.rotation.z = 0.12;
    rightWing.rotation.z = -0.12;
    leftFeathers.castShadow = true;
    rightFeathers.castShadow = true;
    leftWing.name = 'leftWing';
    rightWing.name = 'rightWing';
    leftWing.add(leftFeathers);
    rightWing.add(rightFeathers);

    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.8, 4), materials.feather);
    tail.rotation.x = Math.PI / 2;
    tail.rotation.z = Math.PI / 4;
    tail.position.set(0, 0.02, 1.18);
    tail.castShadow = true;

    const legGeom = new THREE.CylinderGeometry(0.035, 0.035, 0.55, 6);
    const footGeom = new THREE.BoxGeometry(0.12, 0.035, 0.34);
    const leftLeg = new THREE.Mesh(legGeom, materials.leg);
    const rightLeg = new THREE.Mesh(legGeom, materials.leg);
    const leftFoot = new THREE.Mesh(footGeom, materials.leg);
    const rightFoot = new THREE.Mesh(footGeom, materials.leg);
    leftLeg.position.set(-0.18, -0.62, 0.06);
    rightLeg.position.set(0.18, -0.62, 0.06);
    leftFoot.position.set(-0.18, -0.91, -0.05);
    rightFoot.position.set(0.18, -0.91, -0.05);
    leftFoot.rotation.x = 0.18;
    rightFoot.rotation.x = 0.18;
    leftLeg.castShadow = true;
    rightLeg.castShadow = true;
    leftFoot.castShadow = true;
    rightFoot.castShadow = true;

    group.add(body, chest, head, beak, leftWing, rightWing, tail, leftLeg, rightLeg, leftFoot, rightFoot);
    group.scale.setScalar(0.42);
    return group;
  }

  createTree(rng = Math.random) {
    const group = new THREE.Group();
    const height = 2.7 + rng() * 2.6;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, height * 0.58, 7), materials.trunk);
    trunk.position.y = height * 0.29;
    trunk.castShadow = true;

    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(0.9 + rng() * 0.7, height * 0.74, 9),
      rng() > 0.25 ? materials.leaves : materials.darkLeaves,
    );
    crown.position.y = height * 0.72;
    crown.castShadow = true;
    group.add(trunk, crown);
    return group;
  }

  createRock(rng = Math.random) {
    const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(1 + rng() * 1.8, 0), materials.rock);
    mesh.scale.set(1 + rng(), 0.5 + rng() * 0.8, 0.8 + rng() * 1.2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  createHouse(rng = Math.random) {
    const group = new THREE.Group();
    const w = 2.4 + rng() * 2.4;
    const d = 2.2 + rng() * 2.2;
    const h = 1.8 + rng() * 1.6;
    const wallMat = rng() > 0.24 ? materials.wall : materials.barn;
    const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    walls.position.y = h / 2;
    walls.castShadow = true;
    walls.receiveShadow = true;

    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.72, 1.2, 4), materials.roof);
    roof.position.y = h + 0.5;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    group.add(walls, roof);
    return group;
  }

  createField(width, depth, rng = Math.random) {
    const mat = [materials.wheat, materials.crop, materials.tilled][Math.floor(rng() * 3)];
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, 0.06, depth), mat);
    mesh.receiveShadow = true;
    return mesh;
  }

  createRoadRibbon(points, width = 4) {
    const positions = [];
    const indices = [];
    const up = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i < points.length; i++) {
      const prev = points[Math.max(0, i - 1)];
      const next = points[Math.min(points.length - 1, i + 1)];
      const tangent = new THREE.Vector3().subVectors(next, prev).normalize();
      const side = new THREE.Vector3().crossVectors(up, tangent).normalize().multiplyScalar(width / 2);
      const left = new THREE.Vector3().copy(points[i]).add(side);
      const right = new THREE.Vector3().copy(points[i]).sub(side);
      positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
      if (i < points.length - 1) {
        const base = i * 2;
        indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    const mesh = new THREE.Mesh(geom, materials.road);
    mesh.receiveShadow = true;
    return mesh;
  }
}
