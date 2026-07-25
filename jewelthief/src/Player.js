import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clamp, easeInOutSine, easeOutCubic, lerp, moveToward } from "./utils.js";

const CAPSULE_RADIUS = 0.32;
const CAPSULE_HALF_HEIGHT = 0.58;
const FOOT_OFFSET = CAPSULE_RADIUS + CAPSULE_HALF_HEIGHT;
const START_POSITION = new THREE.Vector3(0, 2.2, 0);
const MOVEMENT = {
  coyoteTime: 0.16,
  jumpBufferTime: 0.16,
  parkourBufferTime: 0.18,
  trickBufferTime: 0.12,
  jumpImpulse: 12.4,
  jumpSpeedBoost: 0.18,
  jumpCutVelocity: 5.2,
  groundAcceleration: 50,
  airAcceleration: 20,
  groundFriction: 34,
  runSpeed: 7.8,
  sprintSpeed: 11.2,
};

export class Player {
  constructor(scene, world, rapier, level) {
    this.scene = scene;
    this.world = world;
    this.RAPIER = rapier;
    this.level = level;
    this.group = new THREE.Group();
    this.visual = new THREE.Group();
    this.group.add(this.visual);
    this.scene.add(this.group);

    this.direction = 1;
    this.state = "idle";
    this.movementMode = "grounded";
    this.stateTimer = 0;
    this.landingTimer = 0;
    this.grounded = false;
    this.wasGrounded = false;
    this.groundPlatform = null;
    this.coyoteTimer = 0;
    this.jumpBuffer = 0;
    this.parkourBuffer = 0;
    this.trickBuffer = 0;
    this.airPeakY = START_POSITION.y;
    this.combo = 1;
    this.jewels = 0;
    this.flowEvent = "Idle";
    this.lastSafe = START_POSITION.clone();
    this.action = null;
    this.flipTimer = 0;
    this.failTimer = 0;
    this.runClock = 0;
    this.parts = {
      arms: [],
      body: [],
      cape: null,
      head: [],
      legs: [],
      scarf: [],
      satchel: [],
      shoes: [],
      hood: [],
    };

    const bodyDesc = this.RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0, 2.2, 0)
      .setLinearDamping(0.12)
      .setAngularDamping(8)
      .setCanSleep(false);
    this.body = this.world.createRigidBody(bodyDesc);
    if (typeof this.body.setEnabledRotations === "function") {
      this.body.setEnabledRotations(false, false, false, true);
    }
    if (typeof this.body.setEnabledTranslations === "function") {
      this.body.setEnabledTranslations(true, true, false, true);
    }
    const colliderDesc = this.RAPIER.ColliderDesc.capsule(CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS)
      .setFriction(0)
      .setRestitution(0);
    this.world.createCollider(colliderDesc, this.body);

    this.createFallbackCharacter();
  }

  async loadModel(url) {
    const loader = new GLTFLoader();
    try {
      const gltf = await loader.loadAsync(url);
      this.visual.clear();
      this.parts = {
        arms: [],
        body: [],
        cape: null,
        head: [],
        legs: [],
        scarf: [],
        satchel: [],
        shoes: [],
        hood: [],
      };
      const model = gltf.scene;
      model.scale.setScalar(0.82);
      // The greybox asset is Z-up; the game world and Rapier use Y-up.
      model.rotation.x = -Math.PI / 2;
      model.position.set(0, -FOOT_OFFSET, 0);
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          child.frustumCulled = false;
        }
        const name = child.name.toLowerCase();
        if (name.includes("ground_reference") || name.includes("deleteme")) {
          child.visible = false;
          return;
        }
        if (name.includes("scarf") || name.includes("sash")) {
          child.visible = false;
          this.parts.scarf.push(child);
        }
        if (name.includes("arm") || name.includes("glove")) this.parts.arms.push(child);
        if (name.includes("leg")) this.parts.legs.push(child);
        if (name.includes("satchel")) this.parts.satchel.push(child);
        if (name.includes("shoe") || name.includes("foot")) this.parts.shoes.push(child);
        if (name.includes("head") || name.includes("mask") || name.includes("eye")) this.parts.head.push(child);
        if (name.includes("torso") || name.includes("jacket") || name.includes("pelvis")) this.parts.body.push(child);
        if (name.includes("hood")) this.parts.hood.push(child);
      });
      this.visual.add(model);
      this.model = model;
      this.parts.cape = this.createConnectedCape();
      this.visual.add(this.parts.cape);
      this.captureBaseTransforms();
    } catch (error) {
      console.warn("Unable to load Vex Vale GLB, using fallback character.", error);
    }
  }

  captureBaseTransforms() {
    const animatedParts = [
      ...this.parts.arms,
      ...this.parts.body,
      ...this.parts.head,
      ...this.parts.hood,
      ...this.parts.legs,
      ...this.parts.satchel,
      ...this.parts.shoes,
      this.parts.cape,
    ].filter(Boolean);
    for (const part of animatedParts) {
      part.userData.basePosition = part.position.clone();
      part.userData.baseRotation = part.rotation.clone();
    }
  }

  createConnectedCape() {
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      -0.2, 0.38, -0.32,
      -0.2, 0.38, 0.32,
      -0.48, 0.18, -0.34,
      -0.48, 0.18, 0.34,
      -0.72, -0.08, -0.28,
      -0.72, -0.08, 0.28,
      -0.96, -0.34, -0.2,
      -0.96, -0.34, 0.2,
    ]);
    const indices = [0, 2, 1, 1, 2, 3, 2, 4, 3, 3, 4, 5, 4, 6, 5, 5, 6, 7];
    geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({
      color: 0x20d8c8,
      emissive: 0x063b38,
      roughness: 0.55,
      side: THREE.DoubleSide,
    });
    const cape = new THREE.Mesh(geometry, material);
    cape.name = "CH_Vex_Connected_DebugCape";
    cape.castShadow = true;
    return cape;
  }

  createFallbackCharacter() {
    const materials = {
      navy: new THREE.MeshStandardMaterial({ color: 0x182333, roughness: 0.72 }),
      purple: new THREE.MeshStandardMaterial({ color: 0x302052, roughness: 0.72 }),
      teal: new THREE.MeshStandardMaterial({ color: 0x20d8c8, roughness: 0.45 }),
      gold: new THREE.MeshStandardMaterial({ color: 0xe6b449, roughness: 0.38 }),
      charcoal: new THREE.MeshStandardMaterial({ color: 0x0f151d, roughness: 0.8 }),
    };

    const root = new THREE.Group();
    root.position.y = -FOOT_OFFSET;
    this.visual.add(root);
    this.model = root;

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.72, 0.44), materials.navy);
    body.position.y = 1.22;
    root.add(body);

    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 0), materials.charcoal);
    head.position.y = 1.8;
    root.add(head);

    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.5, 5), materials.navy);
    hood.position.set(-0.08, 2.07, 0);
    hood.rotation.z = -0.45;
    root.add(hood);
    this.parts.hood.push(hood);

    const scarf = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 0.16), materials.teal);
    scarf.position.set(-0.42, 1.62, -0.02);
    root.add(scarf);
    this.parts.scarf.push(scarf);

    const satchel = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 0.28), materials.gold);
    satchel.position.set(-0.22, 0.86, 0.32);
    root.add(satchel);
    this.parts.satchel.push(satchel);

    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.68, 0.22), materials.purple);
      leg.position.set(0.12 * side, 0.5, 0);
      root.add(leg);
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.18, 0.26), materials.charcoal);
      shoe.position.set(0.16 * side + 0.08, 0.1, 0);
      root.add(shoe);
      this.parts.shoes.push(shoe);

      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.18), materials.navy);
      arm.position.set(0.42 * side, 1.16, 0);
      root.add(arm);
    }
  }

  reset(full = false) {
    this.respawnAt(START_POSITION, full);
    this.direction = 1;
  }

  respawnAt(position, full = false) {
    this.body.setTranslation({ x: position.x, y: position.y, z: 0 }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.state = "idle";
    this.movementMode = "grounded";
    this.stateTimer = 0;
    this.landingTimer = 0;
    this.combo = 1;
    this.flowEvent = "Idle";
    this.action = null;
    this.flipTimer = 0;
    this.failTimer = 0;
    if (full) {
      this.jewels = 0;
      this.level.resetCollectibles();
      this.lastSafe.copy(START_POSITION);
    }
  }

  update(delta, input) {
    this.stateTimer += delta;
    this.runClock += delta;
    this.wasGrounded = this.grounded;

    if (input.resetPressed) {
      this.reset(true);
    }

    const pos = this.body.translation();
    const vel = this.body.linvel();
    const footY = pos.y - FOOT_OFFSET;
    this.groundPlatform = this.level.findGround(pos, footY, 0.36);
    this.grounded = Boolean(this.groundPlatform && vel.y <= 2.5);
    if (!this.grounded) {
      this.airPeakY = Math.max(this.airPeakY, pos.y);
    }

    if (this.grounded) {
      if (!this.wasGrounded) {
        this.handleLanding(vel);
      }
      this.snapToGround(pos, footY);
      this.coyoteTimer = MOVEMENT.coyoteTime;
      this.airPeakY = pos.y;
      this.lastSafe.set(pos.x, this.groundPlatform.top + FOOT_OFFSET + 0.04, 0);
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - delta);
    }

    if (input.jumpPressed) {
      this.jumpBuffer = MOVEMENT.jumpBufferTime;
    } else {
      this.jumpBuffer = Math.max(0, this.jumpBuffer - delta);
    }
    if (input.parkourPressed) {
      this.parkourBuffer = MOVEMENT.parkourBufferTime;
    } else {
      this.parkourBuffer = Math.max(0, this.parkourBuffer - delta);
    }
    if (input.trickPressed) {
      this.trickBuffer = MOVEMENT.trickBufferTime;
    } else {
      this.trickBuffer = Math.max(0, this.trickBuffer - delta);
    }
    this.landingTimer = Math.max(0, this.landingTimer - delta);

    if (this.failTimer > 0) {
      this.failTimer -= delta;
      if (this.failTimer <= 0) this.respawnAt(this.lastSafe, false);
    }

    if (this.action) {
      this.updateAssistedAction(delta);
    } else {
      this.updateMovement(delta, input);
      this.checkInteractions(input);
    }

    const freshPos = this.body.translation();
    const freshVel = this.body.linvel();
    if (Math.abs(freshPos.z) > 0.001) {
      this.body.setTranslation({ x: freshPos.x, y: freshPos.y, z: 0 }, false);
    }
    if (Math.abs(freshVel.z) > 0.001) {
      this.body.setLinvel({ x: freshVel.x, y: freshVel.y, z: 0 }, true);
    }

    if (freshPos.y < -8) {
      this.respawnAt(this.lastSafe, false);
      this.flowEvent = "Recovered";
      this.combo = 1;
      this.updateVisual(delta);
      return;
    }

    const pickups = this.level.collectNear(freshPos);
    if (pickups > 0) {
      this.jewels += pickups;
      this.combo = clamp(this.combo + pickups, 1, 9);
      this.flowEvent = "Gem";
    }

    this.updateStateFromVelocity();
    this.updateVisual(delta);
  }

  updateMovement(delta, input) {
    const vel = this.body.linvel();
    const axis = input.axisX;
    if (axis !== 0) this.direction = axis;

    const maxSpeed = input.sprinting ? MOVEMENT.sprintSpeed : MOVEMENT.runSpeed;
    const targetX = axis * maxSpeed;
    const acceleration = this.grounded ? MOVEMENT.groundAcceleration : MOVEMENT.airAcceleration;
    const friction = this.grounded && axis === 0 ? MOVEMENT.groundFriction : 0;
    let nextX = moveToward(vel.x, targetX, acceleration * delta);
    if (friction) nextX = moveToward(nextX, 0, friction * delta);

    let nextY = vel.y;
    if (this.jumpBuffer > 0 && this.coyoteTimer > 0) {
      nextY = MOVEMENT.jumpImpulse + Math.min(Math.abs(nextX) * MOVEMENT.jumpSpeedBoost, 1.5);
      this.jumpBuffer = 0;
      this.coyoteTimer = 0;
      this.state = "jump";
      this.movementMode = "airborne";
      this.stateTimer = 0;
      this.flowEvent = "Jump";
    } else if (!input.jumpHeld && nextY > MOVEMENT.jumpCutVelocity) {
      nextY = MOVEMENT.jumpCutVelocity;
    }

    if (this.trickBuffer > 0 && !this.grounded && this.flipTimer <= 0) {
      this.flipTimer = 0.72;
      this.trickBuffer = 0;
      this.combo = clamp(this.combo + 1, 1, 9);
      this.flowEvent = "Flip";
    }

    if (this.flipTimer > 0) {
      this.flipTimer -= delta;
    }

    this.body.setLinvel({ x: nextX, y: nextY, z: 0 }, true);
  }

  checkInteractions(input) {
    const pos = this.body.translation();
    const vel = this.body.linvel();
    const speedDirection = Math.sign(vel.x) || this.direction;

    const vault = this.level.findVaultCandidate(pos, speedDirection);
    if (vault && this.grounded && (this.parkourBuffer > 0 || this.jumpBuffer > 0)) {
      this.beginVault(vault, speedDirection);
      this.parkourBuffer = 0;
      this.jumpBuffer = 0;
      return;
    }

    if (vault && this.grounded && Math.abs(vel.x) > 2 && pos.x > vault.left - 0.04 && pos.x < vault.right + 0.04) {
      this.beginTrip(speedDirection, vault);
      return;
    }

    const gate = this.level.findGateCandidate(pos, speedDirection);
    if (gate && (this.parkourBuffer > 0 || Math.abs(vel.x) > 7.5)) {
      this.beginGateRun(gate, speedDirection);
      this.parkourBuffer = 0;
      return;
    }

    const ladder = this.level.findLadderCandidate(pos);
    if (ladder && (this.parkourBuffer > 0 || input.axisY > 0)) {
      this.beginLadderClimb(ladder);
      this.parkourBuffer = 0;
      return;
    }

    const balconyHop = this.level.findBalconyHopCandidate(pos);
    if (balconyHop && (this.parkourBuffer > 0 || input.axisY > 0 || this.jumpBuffer > 0)) {
      this.beginBalconyHop(balconyHop);
      this.parkourBuffer = 0;
      this.jumpBuffer = 0;
    }
  }

  snapToGround(position, footY) {
    if (!this.groundPlatform) return;
    const targetY = this.groundPlatform.top + FOOT_OFFSET + 0.02;
    if (Math.abs(targetY - position.y) > 0.001 && Math.abs(footY - this.groundPlatform.top) < 0.42) {
      this.body.setTranslation({ x: position.x, y: targetY, z: 0 }, true);
    }
    const velocity = this.body.linvel();
    if (velocity.y < 0) {
      this.body.setLinvel({ x: velocity.x, y: 0, z: 0 }, true);
    }
  }

  handleLanding(velocity) {
    const dropDistance = Math.max(0, this.airPeakY - this.groundPlatform.top - FOOT_OFFSET);
    this.landingTimer = clamp(dropDistance * 0.08, 0.08, 0.36);
    if (dropDistance > 4.2 || velocity.y < -15) {
      this.state = "roll";
      this.flowEvent = "Roll";
      this.combo = clamp(this.combo + 1, 1, 9);
    } else {
      this.state = "land";
      this.flowEvent = "Land";
    }
    this.stateTimer = 0;
  }

  beginVault(obstacle, direction) {
    obstacle.cleared = true;
    const start = this.body.translation();
    this.action = {
      type: "vault",
      elapsed: 0,
      duration: 0.46,
      direction,
      startX: start.x,
      startY: start.y,
      endX: obstacle.x + direction * (obstacle.width * 0.5 + 1.0),
      peakY: obstacle.top + FOOT_OFFSET + 0.48,
    };
    this.state = "vault";
    this.movementMode = "assisted";
    this.stateTimer = 0;
    this.combo = clamp(this.combo + 1, 1, 9);
    this.flowEvent = "Vault";
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  }

  beginGateRun(gate, direction) {
    gate.used = true;
    const start = this.body.translation();
    this.action = {
      type: gate.type,
      elapsed: 0,
      duration: gate.type === "window" ? 0.36 : 0.3,
      direction,
      startX: start.x,
      startY: start.y,
      endX: gate.x + direction * 1.5,
      peakY: gate.type === "window" ? Math.max(start.y + 0.32, gate.y + FOOT_OFFSET + 0.45) : start.y + 0.1,
    };
    this.state = gate.type === "window" ? "window" : "door";
    this.movementMode = "assisted";
    this.stateTimer = 0;
    this.combo = clamp(this.combo + 1, 1, 9);
    this.flowEvent = gate.type === "window" ? "Window" : "Door";
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  }

  beginLadderClimb(ladder) {
    const start = this.body.translation();
    this.action = {
      type: "ladder",
      elapsed: 0,
      duration: clamp((ladder.top.y - start.y) * 0.18, 0.45, 1.25),
      direction: this.direction,
      startX: start.x,
      startY: start.y,
      endX: ladder.top.x,
      endY: ladder.top.y,
    };
    this.state = "climb";
    this.movementMode = "assisted";
    this.stateTimer = 0;
    this.combo = clamp(this.combo + 1, 1, 9);
    this.flowEvent = "Ladder";
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  }

  beginBalconyHop(hop) {
    const start = this.body.translation();
    const direction = Math.sign(hop.to.climbPoint.x - start.x) || this.direction;
    this.direction = direction;
    this.action = {
      type: "balcony-hop",
      elapsed: 0,
      duration: 0.42,
      direction,
      startX: start.x,
      startY: start.y,
      endX: hop.to.climbPoint.x,
      endY: hop.to.climbPoint.y,
      peakY: Math.max(start.y, hop.to.climbPoint.y) + 0.52,
    };
    this.state = "balcony";
    this.movementMode = "assisted";
    this.stateTimer = 0;
    this.combo = clamp(this.combo + 1, 1, 9);
    this.flowEvent = "Balcony";
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  }

  beginTrip(direction, obstacle) {
    obstacle.tripped = true;
    this.action = {
      type: "trip",
      elapsed: 0,
      duration: 0.58,
      direction,
    };
    this.state = "trip";
    this.movementMode = "recovery";
    this.stateTimer = 0;
    this.flowEvent = "Trip";
    this.combo = 1;
    this.body.setLinvel({ x: -direction * 1.6, y: 3.2, z: 0 }, true);
  }

  updateAssistedAction(delta) {
    this.action.elapsed += delta;
    const t = clamp(this.action.elapsed / this.action.duration, 0, 1);
    const eased = easeInOutSine(t);

    if (this.action.type === "trip") {
      if (t >= 1) {
        this.action = null;
        this.movementMode = this.grounded ? "grounded" : "airborne";
      }
      return;
    }

    if (this.action.type === "ladder") {
      const x = lerp(this.action.startX, this.action.endX, eased);
      const y = lerp(this.action.startY, this.action.endY, eased);
      this.body.setTranslation({ x, y, z: 0 }, true);
      this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      if (t >= 1) {
        this.body.setLinvel({ x: this.direction * 1.4, y: 0.2, z: 0 }, true);
        this.action = null;
        this.movementMode = "grounded";
        this.state = "idle";
        this.stateTimer = 0;
      }
      return;
    }

    if (this.action.type === "balcony-hop") {
      const x = lerp(this.action.startX, this.action.endX, eased);
      const arc = Math.sin(Math.PI * t);
      const y = lerp(this.action.startY, this.action.endY, eased) + arc * 0.34;
      this.body.setTranslation({ x, y, z: 0 }, true);
      this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      if (t >= 1) {
        this.body.setLinvel({ x: this.action.direction * 1.2, y: 0.1, z: 0 }, true);
        this.action = null;
        this.movementMode = "grounded";
        this.state = "idle";
        this.stateTimer = 0;
      }
      return;
    }

    const x = lerp(this.action.startX, this.action.endX, eased);
    const arc = Math.sin(Math.PI * t);
    const y = lerp(this.action.startY, this.action.peakY, arc);
    this.body.setTranslation({ x, y, z: 0 }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);

    if (t >= 1) {
      this.body.setLinvel({ x: this.action.direction * 6.8, y: this.action.type === "vault" ? 1.2 : 0.2, z: 0 }, true);
      this.action = null;
      this.movementMode = "grounded";
      this.state = "run";
      this.stateTimer = 0;
    }
  }

  updateStateFromVelocity() {
    if (this.action || this.failTimer > 0) return;
    const vel = this.body.linvel();
    if (this.landingTimer > 0 && this.grounded) {
      this.movementMode = "grounded";
      return;
    }
    if (!this.grounded) {
      this.movementMode = "airborne";
      this.state = vel.y > 0.5 ? "jump" : "fall";
      this.flowEvent = vel.y > 0.5 ? this.flowEvent : "Fall";
    } else if (Math.abs(vel.x) > 1.2) {
      this.movementMode = "grounded";
      this.state = "run";
      if (!["Gem", "Flip", "Vault", "Window", "Door", "Ladder", "Balcony", "Land", "Roll"].includes(this.flowEvent)) {
        this.flowEvent = "Run";
      }
    } else {
      this.movementMode = "grounded";
      this.state = "idle";
      if (this.stateTimer > 0.25) this.flowEvent = "Idle";
    }
  }

  updateVisual(delta) {
    const pos = this.body.translation();
    const vel = this.body.linvel();
    this.group.position.set(pos.x, pos.y, 0);

    const speed = clamp(Math.abs(vel.x) / MOVEMENT.sprintSpeed, 0, 1);
    const bob = Math.sin(this.runClock * 15) * 0.06 * speed;
    const lean = this.state === "run" ? -0.24 * this.direction * speed : this.state === "fall" ? 0.12 * this.direction : 0;
    const flipProgress = this.flipTimer > 0 ? 1 - this.flipTimer / 0.72 : 0;
    const flipSpin = this.flipTimer > 0 ? easeOutCubic(flipProgress) * Math.PI * 2 * this.direction : 0;
    const actionSpin =
      this.action && this.action.type === "vault"
        ? Math.sin((this.action.elapsed / this.action.duration) * Math.PI) * 0.95 * this.direction
        : this.action && this.action.type === "balcony-hop"
          ? Math.sin((this.action.elapsed / this.action.duration) * Math.PI) * 0.42 * this.direction
        : 0;

    this.visual.rotation.set(0, this.direction < 0 ? Math.PI : 0, lean + flipSpin + actionSpin);

    const squash =
      this.state === "trip"
        ? 0.9
        : this.state === "idle"
          ? 1 + Math.sin(this.runClock * 2.2) * 0.018
          : this.grounded
            ? 1
            : 0.98;
    this.visual.position.y = bob + FOOT_OFFSET * (squash - 1);
    this.visual.scale.set(1, squash, 1);

    const actionIntensity = this.action ? 0.85 : 0;
    const strideRate = this.action?.type === "ladder" ? 11 : 15;
    const stride = this.runClock * strideRate;
    const animationWeight = Math.max(speed, actionIntensity);
    const climbWeight = this.action?.type === "ladder" ? 1 : 0;
    const armSwing = Math.sin(stride) * (climbWeight ? 0.62 : 0.46) * animationWeight;
    const legSwing = Math.sin(stride) * (climbWeight ? 0.48 : 0.34) * animationWeight;
    for (const [index, arm] of this.parts.arms.entries()) {
      const base = arm.userData.baseRotation;
      arm.rotation.set(
        base.x + (index % 2 === 0 ? armSwing : -armSwing) * 0.18,
        base.y + (index % 2 === 0 ? armSwing : -armSwing) * this.direction,
        base.z + (index % 2 === 0 ? -armSwing : armSwing) * 0.34,
      );
    }
    for (const [index, leg] of this.parts.legs.entries()) {
      const base = leg.userData.baseRotation;
      leg.rotation.set(base.x, base.y, base.z + (index % 2 === 0 ? legSwing : -legSwing) * this.direction);
    }
    for (const [index, body] of this.parts.body.entries()) {
      const base = body.userData.baseRotation;
      body.rotation.set(base.x, base.y, base.z + Math.sin(this.runClock * 7 + index) * 0.025 * speed);
    }
    for (const [index, head] of this.parts.head.entries()) {
      const base = head.userData.basePosition;
      head.position.set(base.x, base.y + Math.sin(this.runClock * 5 + index) * 0.02 * speed, base.z);
    }
    if (this.parts.cape) {
      const base = this.parts.cape.userData.baseRotation;
      this.parts.cape.rotation.set(
        base.x,
        base.y + Math.sin(this.runClock * 5.4) * 0.08,
        base.z - 0.18 * speed * this.direction + Math.sin(this.runClock * 6) * 0.08,
      );
    }
    for (const [index, satchel] of this.parts.satchel.entries()) {
      const base = satchel.userData.baseRotation;
      satchel.rotation.set(base.x, base.y, base.z + Math.sin(this.runClock * 10 + index) * 0.08 * speed);
    }
    for (const [index, shoe] of this.parts.shoes.entries()) {
      const base = shoe.userData.baseRotation;
      shoe.rotation.set(base.x, base.y, base.z + Math.sin(this.runClock * 15 + index * Math.PI) * 0.12 * speed);
    }
  }

  get position() {
    return this.body.translation();
  }

  get velocity() {
    return this.body.linvel();
  }
}
