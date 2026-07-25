import "./styles.css";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { Input } from "./Input.js";
import { Level } from "./Level.js";
import { Player } from "./Player.js";
import { lerp } from "./utils.js";

class JewelThiefGame {
  constructor() {
    this.canvas = document.querySelector("#game-canvas");
    this.loadingEl = document.querySelector("#loading");
    this.hud = {
      jewels: document.querySelector("#jewel-count"),
      combo: document.querySelector("#combo-count"),
      flow: document.querySelector("#flow-state"),
    };

    this.clock = new THREE.Clock();
    this.input = new Input();
    this.cameraTarget = new THREE.Vector3(0, 2.8, 0);
    this.cameraLook = new THREE.Vector3(0, 2.1, 0);
    this.debugZoom = 1;
    document.documentElement.dataset.debugZoom = this.debugZoom.toFixed(2);
  }

  async start() {
    await RAPIER.init({});
    this.setupRenderer();
    this.setupScene();
    this.setupPhysics();
    this.setupWorld();
    this.resize();
    window.addEventListener("resize", () => this.resize());

    await this.player.loadModel("/assets/vex_vale_lowpoly_blockout_static.glb");
    this.loadingEl.classList.add("is-hidden");
    window.setTimeout(() => {
      this.loadingEl.hidden = true;
    }, 220);

    this.renderer.setAnimationLoop(() => this.update());
  }

  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  setupScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x081018);
    this.scene.fog = new THREE.Fog(0x081018, 18, 78);

    this.camera = new THREE.PerspectiveCamera(47, 1, 0.1, 160);
    this.camera.position.set(0, 4.2, 15);

    const hemi = new THREE.HemisphereLight(0x9fefff, 0x0c1520, 1.85);
    this.scene.add(hemi);

    const moon = new THREE.DirectionalLight(0xb8ecff, 2.6);
    moon.position.set(-8, 14, 12);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    moon.shadow.camera.left = -26;
    moon.shadow.camera.right = 26;
    moon.shadow.camera.top = 20;
    moon.shadow.camera.bottom = -12;
    moon.shadow.camera.near = 0.5;
    moon.shadow.camera.far = 60;
    this.scene.add(moon);

    const accent = new THREE.PointLight(0x2fffe8, 2.1, 18, 2);
    accent.position.set(8, 4, 5);
    this.scene.add(accent);
  }

  setupPhysics() {
    this.world = new RAPIER.World({ x: 0, y: -24, z: 0 });
    this.world.integrationParameters.dt = 1 / 60;
  }

  setupWorld() {
    this.level = new Level(this.scene, this.world, RAPIER);
    this.level.build();
    this.player = new Player(this.scene, this.world, RAPIER, this.level);
  }

  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.fov = width < 720 ? 56 : 47;
    this.camera.updateProjectionMatrix();
  }

  update() {
    const rawDelta = this.clock.getDelta();
    const delta = Math.min(rawDelta, 1 / 30);
    const fixed = 1 / 60;
    let accumulator = delta;

    while (accumulator > 0) {
      const step = Math.min(fixed, accumulator);
      this.player.update(step, this.input);
      this.world.timestep = step;
      this.world.step();
      accumulator -= step;
    }

    this.updateDebugZoom();
    const position = this.player.position;
    this.level.update(delta, position);
    this.updateCamera(delta);
    this.updateHud();
    this.input.endFrame();
    this.renderer.render(this.scene, this.camera);
  }

  updateCamera(delta) {
    const position = this.player.position;
    const velocity = this.player.velocity;
    const lookAhead = Math.max(-5, Math.min(5, velocity.x * 0.42));
    const desiredX = position.x + lookAhead;
    const desiredY = Math.max(2.5, position.y + 1.2);
    const t = 1 - Math.pow(0.001, delta);

    this.cameraTarget.x = lerp(this.cameraTarget.x, desiredX, t);
    this.cameraTarget.y = lerp(this.cameraTarget.y, desiredY, t);
    this.cameraTarget.z = 0;

    const baseDistance = window.innerWidth < 720 ? 17.2 : 14.2;
    const distance = baseDistance / this.debugZoom;
    this.camera.position.x = this.cameraTarget.x;
    this.camera.position.y = this.cameraTarget.y + 1.8;
    this.camera.position.z = distance;

    this.cameraLook.x = lerp(this.cameraLook.x, position.x + lookAhead * 0.35, t);
    this.cameraLook.y = lerp(this.cameraLook.y, Math.max(1.8, position.y + 0.5), t);
    this.cameraLook.z = 0;
    this.camera.lookAt(this.cameraLook);
  }

  updateDebugZoom() {
    const previousZoom = this.debugZoom;
    if (this.input.zoomInPressed) {
      this.debugZoom = Math.min(2.8, this.debugZoom + 0.25);
    }
    if (this.input.zoomOutPressed) {
      this.debugZoom = Math.max(0.65, this.debugZoom - 0.25);
    }
    if (this.debugZoom !== previousZoom) {
      document.documentElement.dataset.debugZoom = this.debugZoom.toFixed(2);
    }
  }

  updateHud() {
    this.hud.jewels.textContent = String(this.player.jewels);
    this.hud.combo.textContent = `${this.player.combo}x`;
    this.hud.flow.textContent = this.player.flowEvent;
    document.documentElement.dataset.playerY = this.player.position.y.toFixed(2);
    document.documentElement.dataset.lastSafeY = this.player.lastSafe.y.toFixed(2);
    document.documentElement.dataset.groundType = this.player.groundPlatform?.type ?? "air";
    document.documentElement.dataset.movementMode = this.player.movementMode;
    document.documentElement.dataset.actionType = this.player.action?.type ?? "none";
  }
}

const game = new JewelThiefGame();
window.__jewelThiefGame = game;
game.start().catch((error) => {
  console.error(error);
  const loading = document.querySelector("#loading");
  loading.textContent = "Route failed to load";
});
