export class PluginRegistry {
  constructor() {
    this.plugins = new Map();
    this.active = new Map();
  }

  register(plugin) {
    if (!plugin?.id || !plugin?.type || typeof plugin.create !== 'function') {
      throw new TypeError('Plugins require id, type, and create(context)');
    }
    const key = this.key(plugin.type, plugin.id);
    if (this.plugins.has(key)) throw new Error(`Plugin "${key}" is already registered`);
    this.plugins.set(key, plugin);
    return this;
  }

  get(type, id) {
    return this.plugins.get(this.key(type, id));
  }

  list(type) {
    return [...this.plugins.values()].filter((plugin) => !type || plugin.type === type);
  }

  activate(slot, type, id, context = {}) {
    const plugin = this.get(type, id);
    if (!plugin) {
      const available = this.list(type).map((candidate) => candidate.id).join(', ') || 'none';
      throw new Error(`Unknown ${type} plugin "${id}". Available: ${available}`);
    }
    this.deactivate(slot);
    const instance = plugin.create(context) ?? {};
    if (!instance.api) throw new Error(`Plugin "${type}:${id}" did not expose an api`);
    const handle = { slot, plugin, ...instance };
    this.active.set(slot, handle);
    return handle;
  }

  deactivate(slot) {
    const handle = this.active.get(slot);
    if (!handle) return false;
    handle.dispose?.();
    this.active.delete(slot);
    return true;
  }

  dispose() {
    for (const slot of [...this.active.keys()]) this.deactivate(slot);
  }

  key(type, id) {
    return `${type}:${id}`;
  }
}
