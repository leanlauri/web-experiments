import { Engine } from './engine.js';
import { World } from './world.js';

const engine = new Engine();
const world = new World(engine);
engine.setWorld(world);
world.init();
engine.start();
engine.run();

const addSphereFromInput = (event) => {
  if (event?.button && event.button !== 0) return;
  world.addSphere();
};

window.addEventListener('pointerdown', addSphereFromInput);
window.addEventListener('touchstart', (event) => {
  event.preventDefault();
  addSphereFromInput(event);
}, { passive: false });
