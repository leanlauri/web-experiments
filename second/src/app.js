import { Engine } from './engine.js';
import { World } from './world.js';

const engine = new Engine();
const world = new World(engine);
engine.setWorld(world);
world.init();
engine.start();
engine.run();
