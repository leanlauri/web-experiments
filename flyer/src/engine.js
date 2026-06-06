import * as THREE from 'three';
import { EngineCore } from './engine-core.js';
import { MeshComponent } from './entity.js';

export class Engine extends EngineCore {
  constructor({ mount = document.body, headless = false } = {}) {
    super();
    const hasWindow = typeof window !== 'undefined';
    const width = hasWindow ? window.innerWidth : 800;
    const height = hasWindow ? window.innerHeight : 600;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xb9d9e8);
    this.scene.fog = new THREE.FogExp2(0xb9d9e8, 0.0045);

    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1200);
    this.camera.position.set(0, 22, 48);

    this.renderer = null;
    this.lastTime = null;

    if (!headless) {
      try {
        this.renderer = new THREE.WebGLRenderer({
          antialias: true,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: true,
        });
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`WebGL renderer initialization failed: ${detail}`);
      }

      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(hasWindow ? Math.min(2, window.devicePixelRatio) : 1);
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      mount.appendChild(this.renderer.domElement);

      if (hasWindow) {
        window.addEventListener('resize', () => {
          this.camera.aspect = window.innerWidth / window.innerHeight;
          this.camera.updateProjectionMatrix();
          this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
      }
    }
  }

  addEntity(entity) {
    if (entity.hasComponents(MeshComponent.type)) {
      this.scene.add(entity.getComponent(MeshComponent.type).mesh);
    }
    super.addEntity(entity);
  }

  removeEntity(entity) {
    if (entity.hasComponents(MeshComponent.type)) {
      this.scene.remove(entity.getComponent(MeshComponent.type).mesh);
    }
    super.removeEntity(entity);
  }

  run() {
    const animate = (time) => {
      requestAnimationFrame(animate);
      if (this.lastTime != null) {
        const dt = Math.min(0.04, (time - this.lastTime) / 1000);
        this.update(dt);
      }
      this.lastTime = time;
      if (this.renderer) this.renderer.render(this.scene, this.camera);
    };
    requestAnimationFrame(animate);
  }
}
