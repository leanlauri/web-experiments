import * as THREE from "three";
import type { FrameSet, FrameSetName } from "./assets";

export type ActorKind = "player" | "ground" | "flyer" | "enemy" | "plant";

export type ActorOptions = {
  name: string;
  kind: ActorKind;
  frames: FrameSet;
  frameSetName: FrameSetName;
  height: number;
  x: number;
  y?: number;
  z?: number;
  speed?: number;
  direction?: 1 | -1;
  patrol?: [number, number];
  frameRate?: number;
  bob?: number;
  visualFlip?: boolean;
  visualDirection?: 1 | -1;
};

type FrameRange = {
  from: number;
  to: number;
};

export class Actor {
  readonly name: string;
  readonly kind: ActorKind;
  readonly frameSetName: FrameSetName;
  readonly sprite: THREE.Sprite;
  readonly shadow: THREE.Mesh;
  readonly height: number;
  readonly width: number;
  readonly patrol?: [number, number];
  readonly baseY: number;
  readonly bob: number;
  readonly frameRate: number;
  readonly visualFlip: boolean;
  readonly visualDirectionOverride?: 1 | -1;
  x: number;
  y: number;
  z: number;
  velocityY = 0;
  ragdollVelocityX = 0;
  ragdollVelocityY = 0;
  ragdollAngularVelocity = 0;
  ragdollAngle = 0;
  visualScaleX = 1;
  visualScaleY = 1;
  speed: number;
  direction: 1 | -1;
  grounded = true;
  tripTimer = 0;
  stumbleTimer = 0;
  private readonly textures: THREE.CanvasTexture[];
  private readonly material: THREE.SpriteMaterial;
  private frame = 0;
  private frameClock = 0;
  private activeFrameFrom = 0;
  private activeFrameTo = 0;

  constructor(options: ActorOptions) {
    this.name = options.name;
    this.kind = options.kind;
    this.frameSetName = options.frameSetName;
    this.textures = options.frames.textures;
    this.height = options.height;
    this.width = options.height * options.frames.aspect;
    this.x = options.x;
    this.y = options.y ?? 0;
    this.baseY = this.y;
    this.z = options.z ?? 0.04;
    this.speed = options.speed ?? 0;
    this.direction = options.direction ?? 1;
    this.patrol = options.patrol;
    this.frameRate = options.frameRate ?? 10;
    this.bob = options.bob ?? 0;
    this.visualFlip = options.visualFlip ?? false;
    this.visualDirectionOverride = options.visualDirection;
    this.activeFrameTo = this.textures.length - 1;

    this.material = new THREE.SpriteMaterial({
      map: this.textures[0],
      transparent: true,
      alphaTest: 0.05,
      depthWrite: false,
    });
    this.sprite = new THREE.Sprite(this.material);
    this.sprite.center.set(0.5, 0);
    this.sprite.scale.set(this.width * this.visualDirection(), this.height, 1);

    const shadowMaterial = new THREE.MeshBasicMaterial({
      color: 0x111820,
      transparent: true,
      opacity: options.kind === "flyer" ? 0.16 : 0.28,
      depthWrite: false,
    });
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 28), shadowMaterial);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.scale.set(Math.max(0.35, this.width * 0.38), Math.max(0.18, this.width * 0.14), 1);

    this.syncSprite(0);
  }

  get frameCount(): number {
    return this.textures.length;
  }

  setFrame(index: number): void {
    const nextFrame = THREE.MathUtils.clamp(Math.floor(index), 0, this.textures.length - 1);
    this.activeFrameFrom = nextFrame;
    this.activeFrameTo = nextFrame;
    this.frameClock = 0;
    if (nextFrame !== this.frame) {
      this.frame = nextFrame;
      this.material.map = this.textures[this.frame];
      this.material.needsUpdate = true;
    }
  }

  updateAnimation(delta: number, activity = 1, frameRange?: FrameRange): void {
    const nextRange = this.normalizeRange(frameRange);
    if (nextRange.from !== this.activeFrameFrom || nextRange.to !== this.activeFrameTo) {
      this.activeFrameFrom = nextRange.from;
      this.activeFrameTo = nextRange.to;
      this.frameClock = 0;
      this.frame = nextRange.from;
      this.material.map = this.textures[this.frame];
      this.material.needsUpdate = true;
    }

    if (activity <= 0) {
      return;
    }

    this.frameClock += delta * this.frameRate * Math.max(0.4, activity);
    const frameCount = this.activeFrameTo - this.activeFrameFrom + 1;
    const nextFrame = this.activeFrameFrom + (Math.floor(this.frameClock) % frameCount);
    if (nextFrame !== this.frame) {
      this.frame = nextFrame;
      this.material.map = this.textures[this.frame];
      this.material.needsUpdate = true;
    }
  }

  syncSprite(time: number): void {
    const bobY = this.bob > 0 && this.tripTimer <= 0 ? Math.sin(time * 3.2 + this.x) * this.bob : 0;
    this.sprite.position.set(this.x, this.y + bobY, this.z);
    this.sprite.scale.x = Math.abs(this.width) * this.visualScaleX * this.visualDirection();
    this.sprite.scale.y = this.height * this.visualScaleY;

    const stumbleTilt = Math.sin(this.stumbleTimer * 24) * Math.min(0.16, this.stumbleTimer * 0.1);
    this.material.rotation = this.tripTimer > 0 ? this.ragdollAngle : stumbleTilt;

    this.shadow.position.set(this.x, 0.025, this.z - 0.02);
    const lift = Math.max(0, this.y - this.baseY);
    const groundAlpha = this.kind === "flyer" ? 0.14 : 0.28;
    const shadowMaterial = this.shadow.material as THREE.MeshBasicMaterial;
    shadowMaterial.opacity = Math.max(0.06, groundAlpha - lift * 0.04);
  }

  knockDown(impactDirection: 1 | -1): void {
    this.tripTimer = this.kind === "flyer" ? 4.2 : 3.1;
    this.ragdollVelocityX = impactDirection * (this.kind === "flyer" ? 1.8 : 1.05);
    this.ragdollVelocityY = this.kind === "flyer" ? -0.4 : 1.8;
    this.ragdollAngularVelocity = -impactDirection * (this.kind === "flyer" ? 7.2 : 4.8);
    this.ragdollAngle = -impactDirection * 0.7;
    this.grounded = false;
  }

  resetKnockDown(): void {
    this.tripTimer = 0;
    this.ragdollVelocityX = 0;
    this.ragdollVelocityY = 0;
    this.ragdollAngularVelocity = 0;
    this.ragdollAngle = 0;
    this.grounded = true;
    this.y = this.baseY;
  }

  bounds() {
    const collisionHeight = this.kind === "flyer" ? this.height * 0.55 : this.height * 0.78;
    return {
      left: this.x - this.width * 0.34,
      right: this.x + this.width * 0.34,
      bottom: this.y,
      top: this.y + collisionHeight,
    };
  }

  private normalizeRange(frameRange?: FrameRange): FrameRange {
    const from = THREE.MathUtils.clamp(Math.floor(frameRange?.from ?? 0), 0, this.textures.length - 1);
    const to = THREE.MathUtils.clamp(Math.floor(frameRange?.to ?? this.textures.length - 1), from, this.textures.length - 1);
    return { from, to };
  }

  private visualDirection(): 1 | -1 {
    if (this.visualDirectionOverride) {
      return this.visualDirectionOverride;
    }

    const flip = this.visualFlip ? -1 : 1;
    return (this.direction * flip) as 1 | -1;
  }
}
