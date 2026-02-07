import { Engine } from './engine.js';
import { World } from './world.js';
import { InputHandler } from './input-handler.js';
import cannonDebugger from 'https://unpkg.com/cannon-es-debugger@1.0.0/dist/cannon-es-debugger.js?module';

const engine = new Engine();
const world = new World(engine);
engine.setWorld(world);
world.init();
engine.start();
engine.run();

const debugToggle = document.getElementById('debugToggle');
let debugEnabled = false;
const debug = cannonDebugger(engine.scene, world.physicsWorld, { color: 0x2c5aa0 });

engine.addPostUpdate(() => {
  if (debugEnabled) debug.update();
});

const setDebug = (enabled) => {
  debugEnabled = enabled;
  debugToggle?.classList.toggle('active', enabled);
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
