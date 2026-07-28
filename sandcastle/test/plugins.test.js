import { describe, expect, it, vi } from 'vitest';
import { PluginRegistry } from '../src/plugins/registry.js';

describe('plugin registry', () => {
  it('replaces a feature implementation behind the same API slot', () => {
    const firstDispose = vi.fn();
    const registry = new PluginRegistry()
      .register({
        id: 'first',
        type: 'terrain',
        create: () => ({ api: { surfaceY: () => 1 }, dispose: firstDispose }),
      })
      .register({
        id: 'second',
        type: 'terrain',
        create: () => ({ api: { surfaceY: () => 2 } }),
      });

    expect(registry.activate('ground', 'terrain', 'first').api.surfaceY()).toBe(1);
    expect(registry.activate('ground', 'terrain', 'second').api.surfaceY()).toBe(2);
    expect(firstDispose).toHaveBeenCalledOnce();
  });
});
