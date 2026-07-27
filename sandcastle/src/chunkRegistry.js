export class ChunkRegistry {
  constructor({ world, chunkSize, activeRadius = 2, releaseRadius = 3 }) {
    if (releaseRadius < activeRadius) throw new Error('releaseRadius must be at least activeRadius');
    this.world = world;
    this.chunkSize = chunkSize;
    this.activeRadius = activeRadius;
    this.releaseRadius = releaseRadius;
    this.items = new Set();
    this.anchor = null;
  }

  chunkFor(position) {
    return {
      x: Math.floor(position.x / this.chunkSize),
      z: Math.floor(position.z / this.chunkSize),
    };
  }

  register(item) {
    const entry = { active: true, alwaysActive: false, ...item };
    if (!entry.position) entry.position = () => entry.body.position;
    this.items.add(entry);
    entry.owner = this;
    return entry;
  }

  unregister(entry) {
    if (!entry || !this.items.delete(entry)) return;
    if (entry.active && entry.body && this.world.bodies.includes(entry.body)) this.world.removeBody(entry.body);
    entry.owner = null;
  }

  update(anchor) {
    this.anchor = this.chunkFor(anchor);
    for (const entry of this.items) {
      const position = entry.position();
      const chunk = this.chunkFor(position);
      const radius = entry.active ? this.releaseRadius : this.activeRadius;
      const shouldBeActive = entry.alwaysActive
        || (Math.abs(chunk.x - this.anchor.x) <= radius && Math.abs(chunk.z - this.anchor.z) <= radius);
      if (shouldBeActive === entry.active) continue;
      this.setActive(entry, shouldBeActive);
    }
  }

  setActive(entry, active) {
    if (entry.active === active) return;
    entry.active = active;
    // Physics activation is intentionally independent from rendering. A chunk
    // can be outside the interaction ring yet still be in the camera view.
    // Rendering is owned by the camera culler, so rotating the camera can never
    // leave a simulation-paused visual permanently hidden.
    if (active) {
      if (entry.body && !this.world.bodies.includes(entry.body)) this.world.addBody(entry.body);
      entry.onActivate?.(entry);
    } else {
      entry.onDeactivate?.(entry);
      if (entry.body && this.world.bodies.includes(entry.body)) this.world.removeBody(entry.body);
    }
  }

  clear() {
    for (const entry of [...this.items]) this.unregister(entry);
  }
}
