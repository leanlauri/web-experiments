let nextEntityId = 1;

export class Entity {
  constructor(name = 'entity', id = `${name}:${nextEntityId++}`) {
    this.id = id;
    this.name = name;
    this.components = new Map();
    this.world = null;
  }

  add(type, component) {
    if (!type) throw new TypeError('A component type is required');
    if (this.components.has(type)) throw new Error(`Entity "${this.id}" already has component "${type}"`);
    this.components.set(type, component);
    component?.onAttach?.(this);
    return this;
  }

  set(type, component) {
    this.remove(type);
    return this.add(type, component);
  }

  has(type) {
    return this.components.has(type);
  }

  get(type) {
    return this.components.get(type);
  }

  require(type) {
    const component = this.get(type);
    if (!component) throw new Error(`Entity "${this.id}" does not have component "${type}"`);
    return component;
  }

  remove(type) {
    const component = this.components.get(type);
    if (!component) return null;
    component.onDetach?.(this);
    this.components.delete(type);
    return component;
  }

  dispose() {
    for (const [type, component] of [...this.components].reverse()) {
      component.dispose?.();
      this.remove(type);
    }
  }
}
