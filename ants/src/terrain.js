import * as THREE from 'three';

export const TERRAIN_CONFIG = Object.freeze({
  width: 40,
  depth: 40,
  widthSegments: 72,
  depthSegments: 72,
  maxHeight: 2.4,
});

export const createToonGradient = () => {
  const colors = new Uint8Array([
    36, 63, 96, 255,
    97, 138, 171, 255,
    162, 195, 216, 255,
    231, 243, 250, 255,
  ]);
  const texture = new THREE.DataTexture(colors, 4, 1, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
};

const sampleHeight = (x, z, maxHeight) => {
  const ridge = Math.sin(x * 0.28) * Math.cos(z * 0.24) * 0.8;
  const terraces = Math.sin((x + z) * 0.14) * 0.45;
  const dome = Math.max(0, 1 - Math.sqrt(x * x + z * z) / 24);
  return (ridge + terraces + dome) * maxHeight;
};

export const createTerrainGeometry = ({
  width = TERRAIN_CONFIG.width,
  depth = TERRAIN_CONFIG.depth,
  widthSegments = TERRAIN_CONFIG.widthSegments,
  depthSegments = TERRAIN_CONFIG.depthSegments,
  maxHeight = TERRAIN_CONFIG.maxHeight,
} = {}) => {
  const geometry = new THREE.PlaneGeometry(width, depth, widthSegments, depthSegments);
  geometry.rotateX(-Math.PI / 2);

  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const z = position.getZ(i);
    position.setY(i, sampleHeight(x, z, maxHeight));
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
};

export const createTerrainMaterial = () => new THREE.MeshToonMaterial({
  color: 0xb7d7ee,
  gradientMap: createToonGradient(),
});

export const createTerrainMesh = (options = {}) => {
  const geometry = createTerrainGeometry(options);
  const material = createTerrainMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  return mesh;
};

export const getTriangleCount = (geometry) => {
  if (geometry.index) return geometry.index.count / 3;
  return geometry.attributes.position.count / 3;
};
