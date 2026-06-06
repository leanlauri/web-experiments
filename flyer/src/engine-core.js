export class EngineCore {
  constructor() {
    this.world = null;
    this.started = false;
    this.postUpdateCallbacks = [];
  }

  setWorld(world) {
    this.world = world;
  }

  addEntity(entity) {
    if (!this.world) throw new Error('Engine world not set');
    this.world.addEntity(entity);
    if (this.started) this.runStart(entity);
  }

  removeEntity(entity) {
    this.runDestroy(entity);
    this.world.removeEntity(entity);
  }

  start() {
    if (this.started) return;
    this.started = true;
    for (const entity of this.world.entities) this.runStart(entity);
  }

  update(dt) {
    for (const entity of this.world.entities) {
      for (const script of entity.scripts) {
        if (typeof script.update === 'function') script.update(dt);
      }
    }

    for (const cb of this.postUpdateCallbacks) cb(dt);
  }

  runStart(entity) {
    for (const script of entity.scripts) {
      if (typeof script.onStart === 'function') script.onStart();
    }
  }

  runDestroy(entity) {
    for (const script of entity.scripts) {
      if (typeof script.onDestroy === 'function') script.onDestroy();
    }
  }

  addPostUpdate(callback) {
    this.postUpdateCallbacks.push(callback);
  }
}
