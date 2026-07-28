import * as THREE from 'three';

export function createBuggyDamageComponent(state, physics) {
  return {
    explosion(center, radius) {
      if (!state.body || state.destroyed) return;
      const position = new THREE.Vector3().copy(state.body.position);
      if (position.distanceTo(center) > radius + 2.1) return;
      const shardSources = [];
      state.group?.traverse((child) => { if (child.isMesh) shardSources.push(child); });
      for (let index = 0; index < Math.min(18, shardSources.length); index++) {
        const source = shardSources[index % shardSources.length];
        const shardPosition = new THREE.Vector3();
        source.getWorldPosition(shardPosition);
        shardPosition.add(new THREE.Vector3((Math.random() - .5) * .7, Math.random() * .55, (Math.random() - .5) * .7));
        state.spawnShard(shardPosition, center, Array.isArray(source.material) ? source.material[0] : source.material, .9);
      }
      physics.dispose(true);
      state.triggerScreenShake(.38, .32);
      state.onDestroyed();
    },
  };
}
