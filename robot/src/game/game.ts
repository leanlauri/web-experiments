import * as THREE from "three";
import type { FrameSetName } from "./assets";
import { Actor } from "./actor";
import { buildWorld, populateSprites, SCREEN_COUNT, SCREEN_WIDTH, WORLD_LENGTH, type Obstacle } from "./world";
import type { FrameSet } from "./assets";

const GRAVITY = 22;
const RUN_SPEED = 3.25;
const CAMERA_LOOKAHEAD = 3.5;
const FOOT_WIDTH_RATIO = 0.24;
const MIN_JUMP_VELOCITY = 6.1;
const MAX_JUMP_VELOCITY = 11.2;
const MAX_JUMP_CHARGE = 0.72;
const JUMP_TAKEOFF_FRAME_TIME = 0.14;

export type MovementDirection = -1 | 0 | 1;

type Hud = {
  progress: HTMLElement;
  screenChip: HTMLElement;
};

export class RobotGame {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(36, 1, 0.1, 200);
  private readonly obstacles: Obstacle[];
  private readonly player: Actor;
  private readonly creatures: Actor[];
  private readonly plants: Actor[];
  private readonly hud: Hud;
  private animationId = 0;
  private movementInput: MovementDirection = 0;
  private jumpCharging = false;
  private jumpCharge = 0;
  private pendingJumpVelocity = 0;
  private playerJumpAnimationTime = 0;
  private paused = false;
  private worldLap = 0;
  private cameraX = 0;
  private lastTimestamp = performance.now();
  private elapsed = 0;

  constructor(canvas: HTMLCanvasElement, frames: Record<FrameSetName, FrameSet>, hud: Hud) {
    this.hud = hud;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene.fog = new THREE.Fog(0xb8c9c3, 24, 58);
    this.obstacles = buildWorld(this.scene);
    const spritePopulation = populateSprites(this.scene, frames);
    this.creatures = spritePopulation.creatures;
    this.plants = spritePopulation.plants;

    this.player = new Actor({
      name: "robot",
      kind: "player",
      frameSetName: "robot",
      frames: frames.robot,
      height: 1.82,
      x: 2.2,
      speed: RUN_SPEED,
      direction: 1,
      frameRate: 11,
    });
    this.scene.add(this.player.shadow);
    this.scene.add(this.player.sprite);

    this.setupLights();
    this.resize();
    window.addEventListener("resize", this.resize);
  }

  start(): void {
    this.lastTimestamp = performance.now();
    this.animationId = window.requestAnimationFrame(this.tick);
  }

  destroy(): void {
    window.cancelAnimationFrame(this.animationId);
    window.removeEventListener("resize", this.resize);
    this.renderer.dispose();
  }

  setMovementDirection(direction: MovementDirection): void {
    this.movementInput = direction;
  }

  beginJumpCharge(): void {
    if (this.jumpCharging) {
      return;
    }

    this.jumpCharging = true;
    this.jumpCharge = 0;
  }

  releaseJumpCharge(): number {
    if (!this.jumpCharging) {
      return 0;
    }

    const charge = THREE.MathUtils.clamp(this.jumpCharge, 0, MAX_JUMP_CHARGE);
    const chargeRatio = charge / MAX_JUMP_CHARGE;
    this.pendingJumpVelocity = THREE.MathUtils.lerp(
      MIN_JUMP_VELOCITY,
      MAX_JUMP_VELOCITY,
      chargeRatio,
    );
    this.jumpCharging = false;
    this.jumpCharge = 0;
    this.player.visualScaleX = 1;
    this.player.visualScaleY = 1;
    return chargeRatio;
  }

  togglePause(): boolean {
    this.paused = !this.paused;
    return this.paused;
  }

  restart(): void {
    this.player.x = 2.2;
    this.player.y = 0;
    this.player.velocityY = 0;
    this.player.grounded = true;
    this.player.stumbleTimer = 0;
    this.movementInput = 0;
    this.jumpCharging = false;
    this.jumpCharge = 0;
    this.pendingJumpVelocity = 0;
    this.playerJumpAnimationTime = 0;
    this.player.visualScaleX = 1;
    this.player.visualScaleY = 1;
    this.worldLap = 0;
    this.cameraX = 0;

    for (const creature of this.creatures) {
      creature.resetKnockDown();
      creature.stumbleTimer = 0;
    }
  }

  private readonly tick = (timestamp: number) => {
    const rawDelta = (timestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestamp;
    const delta = Math.min(rawDelta, 0.033);
    if (!this.paused) {
      this.elapsed += delta;
      this.update(delta, this.elapsed);
    }

    this.renderer.render(this.scene, this.camera);
    this.animationId = window.requestAnimationFrame(this.tick);
  };

  private update(delta: number, elapsed: number): void {
    this.updatePlayer(delta);
    this.updateCreatures(delta, elapsed);
    this.checkBumps();
    this.updateCamera(delta);
    this.updateHud();

    this.updatePlayerAnimation(delta);
    this.player.syncSprite(elapsed);
    for (const plant of this.plants) {
      plant.updateAnimation(delta, 0.55);
      plant.syncSprite(elapsed);
    }
  }

  private updatePlayer(delta: number): void {
    if (this.player.stumbleTimer > 0) {
      this.player.stumbleTimer = Math.max(0, this.player.stumbleTimer - delta);
    }

    if (this.jumpCharging) {
      this.jumpCharge = Math.min(MAX_JUMP_CHARGE, this.jumpCharge + delta);
    }

    if (this.pendingJumpVelocity > 0 && this.player.grounded) {
      this.player.velocityY = this.pendingJumpVelocity;
      this.player.grounded = false;
      this.playerJumpAnimationTime = 0;
    }
    this.pendingJumpVelocity = 0;

    const previousY = this.player.y;
    this.player.velocityY -= GRAVITY * delta;
    this.player.y += this.player.velocityY * delta;

    const speedPenalty = this.player.stumbleTimer > 0 ? 0.38 : 1;
    const previousX = this.player.x;
    if (this.movementInput !== 0) {
      this.player.direction = this.movementInput;
    }
    this.player.x += this.movementInput * RUN_SPEED * speedPenalty * delta;
    this.player.x = THREE.MathUtils.clamp(this.player.x, 1.4, WORLD_LENGTH - 1.4);
    this.resolvePlayerGround(previousY);

    for (const obstacle of this.obstacles) {
      if (this.collidesObstacle(obstacle)) {
        const obstacleLeft = obstacle.x - obstacle.width / 2;
        const obstacleRight = obstacle.x + obstacle.width / 2;
        if (this.movementInput > 0 && previousX + this.player.width * 0.25 <= obstacleLeft) {
          this.player.x = obstacleLeft - this.player.width * 0.26;
          this.player.stumbleTimer = 0.7;
          if (this.player.y < 0.08) {
            this.player.y = 0;
            this.player.velocityY = 0;
            this.player.grounded = true;
          }
        } else if (this.movementInput < 0 && previousX - this.player.width * 0.25 >= obstacleRight) {
          this.player.x = obstacleRight + this.player.width * 0.26;
          this.player.stumbleTimer = 0.7;
          if (this.player.y < 0.08) {
            this.player.y = 0;
            this.player.velocityY = 0;
            this.player.grounded = true;
          }
        }
      }
    }

    if (this.player.x > WORLD_LENGTH - 3) {
      this.worldLap += 1;
      this.player.x = 2.2;
      this.player.y = 0;
      this.player.velocityY = 0;
      this.cameraX = 0;
    }
  }

  private updatePlayerAnimation(delta: number): void {
    if (this.jumpCharging && this.player.grounded) {
      const chargeRatio = THREE.MathUtils.clamp(this.jumpCharge / MAX_JUMP_CHARGE, 0, 1);
      const chargeFrame = chargeRatio > 0.72 ? 4 : chargeRatio > 0.34 ? 3 : 2;
      this.player.visualScaleX = THREE.MathUtils.lerp(1, 1.3, chargeRatio);
      this.player.visualScaleY = THREE.MathUtils.lerp(1, 0.82, chargeRatio);
      this.player.setFrame(chargeFrame);
      return;
    }

    this.player.visualScaleX = THREE.MathUtils.lerp(this.player.visualScaleX, 1, 0.3);
    this.player.visualScaleY = THREE.MathUtils.lerp(this.player.visualScaleY, 1, 0.3);

    if (!this.player.grounded) {
      this.playerJumpAnimationTime += delta;
      if (this.playerJumpAnimationTime < JUMP_TAKEOFF_FRAME_TIME) {
        this.player.setFrame(2);
      } else if (this.player.velocityY > 0.8) {
        this.player.setFrame(3);
      } else {
        this.player.setFrame(4);
      }
      return;
    }

    this.playerJumpAnimationTime = 0;
    if (this.movementInput === 0) {
      this.player.setFrame(0);
      return;
    }

    this.player.updateAnimation(delta, 1, { from: 0, to: this.player.frameCount - 1 });
  }

  private updateCreatures(delta: number, elapsed: number): void {
    for (const creature of this.creatures) {
      if (creature.tripTimer > 0) {
        this.updateRagdoll(creature, delta);
        creature.updateAnimation(delta, 0.2);
        creature.syncSprite(elapsed);
        continue;
      }

      if (creature.patrol) {
        const nextX = creature.x + creature.speed * creature.direction * delta;
        if (this.creatureWouldHitObstacle(creature, nextX)) {
          creature.direction *= -1;
        } else {
          creature.x = nextX;
        }

        const [min, max] = creature.patrol;
        if (creature.x <= min || creature.x >= max) {
          creature.direction *= -1;
          creature.x = THREE.MathUtils.clamp(creature.x, min, max);
        }
      }

      if (creature.kind === "flyer") {
        creature.y = creature.baseY + Math.sin(elapsed * 1.65 + creature.x * 0.2) * 0.34;
      }

      creature.updateAnimation(delta, 1);
      creature.syncSprite(elapsed);
    }

    for (let index = 0; index < this.creatures.length - 1; index += 1) {
      const left = this.creatures[index];
      const right = this.creatures[index + 1];
      if (Math.abs(left.x - right.x) < 0.45 && left.tripTimer <= 0 && right.tripTimer <= 0) {
        left.direction *= -1;
        right.direction *= -1;
      }
    }
  }

  private checkBumps(): void {
    for (const creature of this.creatures) {
      if (creature.tripTimer > 0) {
        continue;
      }

      if (intersects(this.player.bounds(), creature.bounds())) {
        const impactDirection = this.player.x < creature.x ? 1 : -1;
        creature.knockDown(impactDirection);
        creature.direction = impactDirection;
        this.player.stumbleTimer = Math.max(this.player.stumbleTimer, 0.32);
        if (this.player.grounded) {
          this.player.velocityY = 2.1;
          this.player.grounded = false;
        }
      }
    }
  }

  private collidesObstacle(obstacle: Obstacle): boolean {
    if (this.player.velocityY > 0 || this.player.y >= obstacle.height - 0.22) {
      return false;
    }

    const bounds = this.player.bounds();
    return (
      bounds.right > obstacle.x - obstacle.width / 2 &&
      bounds.left < obstacle.x + obstacle.width / 2 &&
      bounds.bottom < obstacle.height - 0.08 &&
      bounds.top > 0.16
    );
  }

  private resolvePlayerGround(previousY: number): void {
    const groundY = this.surfaceHeightAt(this.player.x, this.player.width * FOOT_WIDTH_RATIO);
    const fallingOntoSurface = this.player.velocityY <= 0 && previousY >= groundY - 0.08 && this.player.y <= groundY;

    if (fallingOntoSurface) {
      this.player.y = groundY;
      this.player.velocityY = 0;
      this.player.grounded = true;
      return;
    }

    if (this.player.y <= 0) {
      this.player.y = 0;
      this.player.velocityY = 0;
      this.player.grounded = true;
      return;
    }

    this.player.grounded = false;
  }

  private surfaceHeightAt(x: number, halfWidth: number): number {
    let groundY = 0;
    for (const obstacle of this.obstacles) {
      const left = obstacle.x - obstacle.width / 2;
      const right = obstacle.x + obstacle.width / 2;
      if (x + halfWidth > left && x - halfWidth < right) {
        groundY = Math.max(groundY, obstacle.height);
      }
    }

    return groundY;
  }

  private updateRagdoll(creature: Actor, delta: number): void {
    creature.tripTimer = Math.max(0, creature.tripTimer - delta);
    creature.ragdollVelocityY -= GRAVITY * delta;
    creature.x += creature.ragdollVelocityX * delta;
    creature.y += creature.ragdollVelocityY * delta;
    creature.ragdollAngle += creature.ragdollAngularVelocity * delta;

    const groundY = this.surfaceHeightAt(creature.x, creature.width * 0.22);
    if (creature.y <= groundY) {
      creature.y = groundY;
      if (Math.abs(creature.ragdollVelocityY) > 1.3) {
        creature.ragdollVelocityY = -creature.ragdollVelocityY * 0.26;
      } else {
        creature.ragdollVelocityY = 0;
      }
      creature.ragdollVelocityX *= 0.94;
      creature.ragdollAngularVelocity *= 0.9;
      creature.grounded = true;
    }

    if (creature.x < 1.2 || creature.x > WORLD_LENGTH - 1.2) {
      creature.ragdollVelocityX *= -0.45;
      creature.x = THREE.MathUtils.clamp(creature.x, 1.2, WORLD_LENGTH - 1.2);
    }

    if (creature.tripTimer <= 0) {
      creature.resetKnockDown();
    }
  }

  private creatureWouldHitObstacle(creature: Actor, nextX: number): boolean {
    if (creature.kind === "flyer") {
      return this.obstacles.some((obstacle) => {
        const left = obstacle.x - obstacle.width / 2 - creature.width * 0.28;
        const right = obstacle.x + obstacle.width / 2 + creature.width * 0.28;
        return nextX > left && nextX < right && creature.y < obstacle.height + 0.75;
      });
    }

    return this.obstacles.some((obstacle) => {
      const left = obstacle.x - obstacle.width / 2 - creature.width * 0.22;
      const right = obstacle.x + obstacle.width / 2 + creature.width * 0.22;
      return nextX > left && nextX < right && creature.y < obstacle.height;
    });
  }

  private updateCamera(delta: number): void {
    const targetX = THREE.MathUtils.clamp(
      this.player.x + CAMERA_LOOKAHEAD,
      9,
      WORLD_LENGTH - 9,
    );
    this.cameraX = THREE.MathUtils.lerp(this.cameraX || targetX, targetX, 1 - Math.pow(0.001, delta));
    this.camera.position.set(this.cameraX, 5.6, 13.6);
    this.camera.lookAt(this.cameraX + 1.6, 2.05, 0);
  }

  private updateHud(): void {
    const progress = (this.player.x / WORLD_LENGTH) * 100;
    this.hud.progress.style.width = `${THREE.MathUtils.clamp(progress, 0, 100)}%`;
    const screen = Math.min(SCREEN_COUNT, Math.floor(this.player.x / SCREEN_WIDTH) + 1);
    const prefix = screen < 10 ? "0" : "";
    this.hud.screenChip.textContent = `${prefix}${screen}/${SCREEN_COUNT < 10 ? "0" : ""}${SCREEN_COUNT}`;
  }

  private readonly resize = () => {
    const canvas = this.renderer.domElement;
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  };

  private setupLights(): void {
    const hemi = new THREE.HemisphereLight(0xdff5ff, 0x304336, 2.35);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffe7ad, 2.8);
    sun.position.set(8, 14, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 45;
    sun.shadow.camera.left = -24;
    sun.shadow.camera.right = 24;
    sun.shadow.camera.top = 18;
    sun.shadow.camera.bottom = -10;
    this.scene.add(sun);
  }
}

function intersects(
  a: { left: number; right: number; bottom: number; top: number },
  b: { left: number; right: number; bottom: number; top: number },
): boolean {
  return a.left < b.right && a.right > b.left && a.bottom < b.top && a.top > b.bottom;
}
