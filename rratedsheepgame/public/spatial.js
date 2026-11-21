// Shared broad phase. Exact shape tests remain responsible for collision response.
export class SpatialGrid {
  constructor(size = 24) {
    this.size = size;
    this.cells = new Map();
    this.keys = new Map();
  }
  clear() {
    this.cells.clear();
    this.keys.clear();
  }
  insert(item, hx = 0, hz = hx) {
    if (hx === 0 && hz === 0) {
      const key =
        Math.floor(item.x / this.size) + "," + Math.floor(item.z / this.size);
      const old = this.keys.get(item);
      if (old?.length === 1 && old[0] === key) return;
    }
    this.remove(item);
    const keys = [];
    for (
      let x = Math.floor((item.x - hx) / this.size);
      x <= Math.floor((item.x + hx) / this.size);
      x++
    )
      for (
        let z = Math.floor((item.z - hz) / this.size);
        z <= Math.floor((item.z + hz) / this.size);
        z++
      ) {
        const key = x + "," + z;
        if (!this.cells.has(key)) this.cells.set(key, new Set());
        this.cells.get(key).add(item);
        keys.push(key);
      }
    this.keys.set(item, keys);
  }
  remove(item) {
    for (const key of this.keys.get(item) || []) {
      const cell = this.cells.get(key);
      cell.delete(item);
      if (!cell.size) this.cells.delete(key);
    }
    this.keys.delete(item);
  }
  query(p, radius = 0) {
    const result = new Set();
    for (
      let x = Math.floor((p.x - radius) / this.size);
      x <= Math.floor((p.x + radius) / this.size);
      x++
    )
      for (
        let z = Math.floor((p.z - radius) / this.size);
        z <= Math.floor((p.z + radius) / this.size);
        z++
      )
        for (const item of this.cells.get(x + "," + z) || []) result.add(item);
    return [...result];
  }
}
