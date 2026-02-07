import { Engine } from './engine.js';
import { World } from './world.js';
import { InputHandler } from './input-handler.js';

const engine = new Engine();
const world = new World(engine);
engine.setWorld(world);
world.init();
engine.start();
engine.run();

const debugToggle = document.getElementById('debugToggle');
let debugEnabled = false;
let debug = null;
let debugLoading = false;

engine.addPostUpdate(() => {
  if (debugEnabled && debug) debug.update();
});

const setDebug = async (enabled) => {
  debugEnabled = enabled;
  debugToggle?.classList.toggle('active', enabled);

  if (enabled && !debug && !debugLoading) {
    debugLoading = true;
    try {
      const mod = await import('https://unpkg.com/cannon-es-debugger@1.0.0/dist/cannon-es-debugger.js?module');
      debug = mod.default(engine.scene, world.physicsWorld, { color: 0x2c5aa0 });
    } catch (err) {
      console.error('Failed to load physics debugger', err);
      debugEnabled = false;
      debugToggle?.classList.remove('active');
    } finally {
      debugLoading = false;
    }
  }
};

setDebug(false);

if (debugToggle) {
  debugToggle.addEventListener('click', () => {
    setDebug(!debugEnabled);
  });
}

window.addEventListener('keydown', (event) => {
  if (event.key?.toLowerCase() === 'd') {
    setDebug(!debugEnabled);
  }
});

new InputHandler({
  element: window,
  onTapped: () => world.spawnRandomEntity(),
  onSwiped: (direction) => {
    // Placeholder for future controls.
    console.log('Swiped:', direction);
  },
});
