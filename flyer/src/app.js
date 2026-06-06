import { Engine } from './engine.js';
import { FlightComponent, MeshComponent } from './entity.js';
import { InputState } from './input.js';
import { World } from './world.js';

const showFatalError = (error) => {
  const overlay = document.getElementById('fatalOverlay');
  const message = document.getElementById('fatalMessage');
  const detail = error instanceof Error ? error.message : String(error);
  if (message) {
    message.textContent = `The 3D scene could not start.\n\n${detail}`;
  }
  if (overlay) {
    overlay.style.display = 'flex';
  }
};

try {
  const input = new InputState(window);
  const engine = new Engine();
  const world = new World(engine, { input });
  engine.setWorld(world);
  world.init();
  engine.start();
  engine.run();

  const speedLabel = document.getElementById('speed');
  const altitudeLabel = document.getElementById('altitude');
  const biomeLabel = document.getElementById('biome');
  const chunksLabel = document.getElementById('chunks');

  engine.addPostUpdate(() => {
    const birdMesh = world.player?.getComponent(MeshComponent.type)?.mesh;
    const flight = world.player?.getComponent(FlightComponent.type);
    if (!birdMesh || !flight) return;
    const altitude = birdMesh.position.y - world.getHeight(birdMesh.position.x, birdMesh.position.z);
    if (speedLabel) speedLabel.textContent = `Speed ${Math.round(flight.speed)}`;
    if (altitudeLabel) altitudeLabel.textContent = `Altitude ${Math.round(altitude)} m`;
    if (biomeLabel) biomeLabel.textContent = world.lastBiome;
    if (chunksLabel) chunksLabel.textContent = `Chunks ${world.stats.chunks} / fixtures ${world.stats.fixtures}`;
  });
} catch (error) {
  showFatalError(error);
}
