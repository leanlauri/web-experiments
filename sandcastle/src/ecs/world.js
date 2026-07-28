import { Entity } from './entity.js';

export class ECSWorld {
  constructor() {
    this.entities = new Map();
    this.systems = [];
  }

  create(name, id) {
    return this.add(new Entity(name, id));
  }

  add(entity) {
    if (this.entities.has(entity.id)) throw new Error(`Duplicate entity id "${entity.id}"`);
    if (entity.world && entity.world !== this) throw new Error(`Entity "${entity.id}" already belongs to another world`);
    entity.world = this;
    this.entities.set(entity.id, entity);
    return entity;
  }

  remove(entityOrId, { dispose = true } = {}) {
    const entity = typeof entityOrId === 'string' ? this.entities.get(entityOrId) : entityOrId;
    if (!entity || !this.entities.delete(entity.id)) return null;
    if (dispose) entity.dispose();
    entity.world = null;
    return entity;
  }

  query(...types) {
    return [...this.entities.values()].filter((entity) => types.every((type) => entity.has(type)));
  }

  addSystem(system, priority = system.priority ?? 0) {
    this.systems.push({ system, priority });
    this.systems.sort((a, b) => a.priority - b.priority);
    system.onAttach?.(this);
    return system;
  }

  removeSystem(system) {
    const index = this.systems.findIndex((entry) => entry.system === system);
    if (index < 0) return false;
    this.systems.splice(index, 1);
    system.onDetach?.(this);
    return true;
  }

  update(delta, context = {}) {
    for (const { system } of this.systems) system.update(this, delta, context);
  }

  dispose() {
    for (const entity of [...this.entities.values()]) this.remove(entity);
    for (const { system } of [...this.systems].reverse()) system.onDetach?.(this);
    this.systems.length = 0;
  }
}
