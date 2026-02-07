export class CloudController {
  constructor(world) {
    this.world = world;
    this.elapsed = 0;
    this.nextDrop = 0;
  }

  onStart() {
    this.elapsed = 0;
    this.nextDrop = 1.5 + Math.random() * 3.5;
  }

  update(dt) {
    this.elapsed += dt;
    if (this.elapsed >= this.nextDrop) {
      this.elapsed = 0;
      this.nextDrop = 1.5 + Math.random() * 3.5;

      if (!this.world || !this.entity) return;
      const mesh = this.entity.getComponent?.('mesh')?.mesh;
      const pos = mesh?.position;
      if (!pos) return;

      this.world.addCoin(
        pos.x + (Math.random() - 0.5) * 1.2,
        pos.y - 0.3,
        pos.z + (Math.random() - 0.5) * 1.2,
      );
    }
  }
}
