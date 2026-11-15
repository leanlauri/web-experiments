import { followAnimal, separateHerd } from "./herding.js?v=console-menu-1";
import {
  FIRST_WANTED_WALK_SPEED,
  createOfficer,
  spawnPatrol,
  patrolStep,
  disembarkPatrol,
} from "./police.js?v=console-menu-1";
import { freeVehicle } from "./vehicle-motion.js?v=console-menu-1";
import {
  initVehicleHealth,
  damageVehicle,
  FIRE_SECONDS,
  BLAST_RADIUS,
} from "./vehicle-damage.js?v=console-menu-1";
import {
  trafficPose,
  nearestTrafficDistance,
} from "./traffic.js?v=console-menu-1";
import { vehicleProfile } from "./vehicles.js?v=console-menu-1";
import { createTraffic, stepTraffic } from "./traffic.js?v=console-menu-1";
import {
  resolveVehicleCollisions,
  vehiclePersonContact,
  circleVehicle,
  vehicleBlocked,
} from "./vehicle-collisions.js?v=console-menu-1";
import {
  startTumble,
  stepTumble,
  clearTumble,
} from "./tumbles.js?v=console-menu-1";
import { drive } from "./driving.js?v=console-menu-1";
import { recordSkidmarks, SKID_LIFETIME } from "./skidmarks.js?v=console-menu-1";
import {
  HOME,
  inHouse,
  START,
  FARMS,
  WEAPONS,
  OPENING_REWARD,
  PARTS,
  dist,
  move,
  routeTarget,
  OBSTACLES,
} from "./region.js?v=console-menu-1";
export const NPC_KNOCKOUT_SECONDS = 60,
  EXIT_ROLL_SPEED = 8;
export class Game {
  constructor(save = null) {
    this.reset(save);
  }
  reset(save) {
    this.time = 0;
    this.phase = "intro";
    this.player = {
      ...START,
      y: 0,
      vy: 0,
      heading: Math.PI,
      hp: 3,
      maxHp: 3,
      invulnerable: 0,
      stun: 0,
    };
    this.money = 0;
    this.delivered = 0;
    this.heists = 0;
    this.parts = 0;
    this.owned = [0];
    this.weapon = 0;
    this.item = "weapon";
    this.revives = 3;
    this.wanted = 0;
    this.escape = 0;
    this.vehicle = null;
    this.cooldown = 0;
    this.jail = 0;
    this.homeInside = false;
    this.homeTimer = 0;
    this.shop = false;
    this.houseInside = false;
    this.note =
      "Walk close to your twelve sheep, then lead them north to your little farm.";
    this.noteUntil = 10;
    this.shots = [];
    this.skidmarks = [];
    this.police = [];
    this.guards = [];
    this.animals = [];
    this.vehicles = [];
    this.deliveryLog = [];
    this.seed = 8221;
    this.lastSaved = null;
    this.introDelivered = 0;
    this.launchTime = 0;
    for (let i = 0; i < 12; i++)
      this.addAnimal(
        "sheep",
        -1,
        START.x + Math.cos(i * 2.4) * (4 + i * 0.65),
        START.z + Math.sin(i * 2.4) * (4 + i * 0.65),
      );
    for (const f of FARMS) {
      for (let i = 0; i < 18; i++)
        this.addAnimal(
          f.animal,
          f.id,
          f.x - 8 + Math.cos(i * 2.4) * (5 + i * 0.48),
          f.z + 8 + Math.sin(i * 2.4) * (5 + i * 0.48),
        );
    }
    this.vehicles = createTraffic();
    this.vehicles.forEach(initVehicleHealth);
    this.explosions = [];
    this.explosionSequence = 0;
    if (
      save &&
      save.version === 1 &&
      Number.isFinite(save.delivered) &&
      save.phase === "heist"
    ) {
      this.phase = "heist";
      this.introDelivered = 12;
      for (const k of ["money", "delivered", "heists", "parts", "revives"])
        this[k] = Math.max(0, Math.min(99999, Number(save[k]) || 0));
      this.parts = Math.min(5, this.parts);
      this.player.maxHp = Math.max(3, Math.min(6, Number(save.maxHp) || 3));
      this.player.hp = this.player.maxHp;
      this.owned = [
        ...new Set([
          0,
          ...(Array.isArray(save.owned) ? save.owned : []).filter(
            (v) => Number.isInteger(v) && v >= 0 && v < WEAPONS.length,
          ),
        ]),
      ];
      this.player.x = HOME.x;
      this.player.z = HOME.z + 10;
      for (const a of this.animals) if (a.farm === -1) a.delivered = true;
      this.note = "Welcome home. Your rocket project is waiting.";
    }
    this.refreshGuards();
  }
  random() {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  addAnimal(type, farm, x, z) {
    this.animals.push({
      id: this.animals.length,
      type,
      farm,
      x,
      z,
      origin: { x, z },
      hp: 3,
      following: false,
      down: false,
      boarded: null,
      delivered: false,
      heading: 0,
      phase: this.animals.length * 2.4,
    });
  }
  get herd() {
    return this.animals.filter((a) => a.following && !a.delivered);
  }
  get level() {
    return Math.min(7, Math.floor(this.heists / 2));
  }
  get atHome() {
    return dist(this.player, HOME) < HOME.r;
  }
  tell(s) {
    this.note = s;
    this.noteUntil = this.time + 7;
  }
  crime(amount = 1) {
    this.wanted = Math.min(5, this.wanted + amount);
    this.escape = 0;
  }
  refreshGuards() {
    this.guards = [];
    for (const f of FARMS)
      for (let i = 0; i < 2 + this.level; i++) {
        const a = f.angle + Math.PI + i * 0.6;
        this.guards.push({
          id: `g${f.id}-${i}`,
          farm: f.id,
          x: f.x + Math.cos(a) * 24,
          z: f.z + Math.sin(a) * 24,
          heading: a,
          down: 0,
          cooldown: i * 0.7,
          armor: 1 + Math.floor(this.level / 3),
          hp: 1 + Math.floor(this.level / 3),
        });
      }
  }
  checkpoint() {
    this.lastSaved = {
      version: 1,
      phase: this.phase === "intro" ? "intro" : "heist",
      money: this.money,
      delivered: this.delivered,
      heists: this.heists,
      parts: this.parts,
      revives: this.revives,
      maxHp: this.player.maxHp,
      owned: this.owned,
    };
  }
  arrive() {
    this.player.hp = this.player.maxHp;
    this.player.stun = 0;
    const delivered = this.herd.filter(
      (a) => !a.down && (a.boarded !== null || dist(a, HOME) < HOME.r + 3),
    );
    if (this.phase === "intro") {
      this.revives = Math.max(3, this.revives);
      for (const a of delivered) {
        a.delivered = true;
        a.following = false;
        a.boarded = null;
        this.introDelivered++;
      }
      if (this.introDelivered === 12) {
        this.phase = "heist";
        this.money = OPENING_REWARD;
        this.tell(
          "The flock is home! You earned $60 — enough for a $50 foam pistol. Build your moon rocket by bringing animals home from the six big farms.",
        );
        this.shop = true;
        this.checkpoint();
      }
      return;
    }
    if (delivered.length) {
      const count = delivered.length;
      this.delivered += count;
      this.money += count * 8;
      this.heists++;
      this.deliveryLog.unshift({
        count,
        type: delivered[0].type,
        reward: count * 8,
      });
      this.tell(
        `${count} ${delivered[0].type} safe! +$${count * 8}. Farms upgraded their defenses. Rocket credit: ${this.delivered}.`,
      );
      this.refreshGuards();
    }
    // A visit resolves the whole trip, including animals left unconscious or behind.
    for (const a of this.animals)
      if (a.farm >= 0) {
        clearTumble(a);
        Object.assign(a, a.origin, {
          following: false,
          down: false,
          boarded: null,
          delivered: false,
        });
      }
    this.checkpoint();
  }
  buy(item) {
    if (!this.atHome || this.phase !== "heist") {
      this.tell(
        "Supplies are available at your home farm after the opening journey.",
      );
      return false;
    }
    if (item === "part") {
      const part = PARTS[this.parts];
      if (!part) return false;
      if (this.delivered < part.animals) {
        this.tell(
          `Deliver ${part.animals - this.delivered} more animals for ${part.name}.`,
        );
        return false;
      }
      this.parts++;
      this.tell(`${part.name} installed! ${this.parts}/5 rocket parts.`);
    } else if (item === "revive") {
      if (this.money < 15) return this.cannotAfford();
      this.money -= 15;
      this.revives += 3;
      this.tell("Three wake-up snacks added.");
    } else if (item === "heart") {
      if (this.player.maxHp >= 6) return false;
      const price = (this.player.maxHp - 2) * 60;
      if (this.money < price) return this.cannotAfford();
      this.money -= price;
      this.player.maxHp++;
      this.player.hp = this.player.maxHp;
      this.tell("Extra heart installed in your very brave spirit.");
    } else {
      const w = WEAPONS[item];
      if (!w || this.owned.includes(item)) return false;
      if (this.money < w.cost) return this.cannotAfford();
      this.money -= w.cost;
      this.owned.push(item);
      this.weapon = item;
      this.tell(`${w.name} equipped. Sweet dreams, troublemakers.`);
    }
    this.checkpoint();
    return true;
  }
  cannotAfford() {
    this.tell("Not enough cash yet. Bring home another herd.");
    return false;
  }
  interact() {
    if (
      this.jail ||
      this.player.ragdoll ||
      this.player.exitRoll ||
      this.phase === "launch" ||
      this.phase === "credits"
    )
      return;
    if (this.vehicle !== null) {
      const v = this.vehicles[this.vehicle];
      this.player.x = v.x + Math.cos(v.heading + Math.PI / 2) * 3;
      this.player.z = v.z + Math.sin(v.heading + Math.PI / 2) * 3;
      this.player.y = v.y || 0;
      const speed = Math.hypot(v.vx || 0, v.vz || 0) || v.currentSpeed || 0;
      if (speed > EXIT_ROLL_SPEED) {
        this.player.exitRoll = {
          age: 0,
          duration: 0.85,
          vy: v.vy || 0,
          vx: (v.vx || 0) * 0.5 + Math.cos(v.heading + Math.PI / 2) * 2,
          vz: (v.vz || 0) * 0.5 + Math.sin(v.heading + Math.PI / 2) * 2,
        };
        this.player.starsUntil = 0;
      } else v.driveSpeed = v.currentSpeed = v.vx = v.vz = 0;
      v.skidAnchor = null;
      v.skidding = false;
      this.vehicle = null;
      for (const a of this.herd)
        if (a.boarded === v.id) {
          a.boarded = null;
          a.x = this.player.x + ((a.id % 3) - 1) * 1.3;
          a.z = this.player.z + 2 + Math.floor((a.id % 9) / 3) * 1.3;
        }
      this.tell("Everyone out! Keep your herd together.");
      return;
    }
    const v = this.vehicles
      .filter(
        (v) =>
          dist(v, this.player) < 6 &&
          v.disabled <= 0 &&
          !v.destroyed &&
          (v.y || 0) < 0.5,
      )
      .sort((a, b) => dist(a, this.player) - dist(b, this.player))[0];
    if (!v) {
      this.tell("Get closer to a vehicle, then press E to board.");
      return;
    }
    v.driveSpeed =
      Math.hypot(v.vx || 0, v.vz || 0) ||
      v.currentSpeed ||
      (!v.stolen ? v.speed : 0);
    v.vx ??= Math.cos(v.heading) * v.driveSpeed;
    v.vz ??= Math.sin(v.heading) * v.driveSpeed;
    v.skidAnchor = null;
    if (v.policeDriving) disembarkPatrol(this, v);
    if (!v.stolen || v.isPolice) {
      v.stolen = true;
      this.crime(1);
      this.tell("Vehicle borrowed without asking! Police have been alerted.");
    }
    v.occupied = false;
    this.vehicle = v.id;
    this.player.heading = v.heading;
    this.player.y = this.player.vy = 0;
    let room = v.seats - 1;
    for (const a of this.herd) {
      if (!a.down && dist(a, this.player) < 18 && room > 0) {
        a.boarded = v.id;
        room--;
      }
    }
    this.player.x = v.x;
    this.player.z = v.z;
    this.tell(
      `${v.kind}: ${v.seats - 1 - room}/${v.seats - 1} animal seats filled. Point the stick or use WASD toward your destination. Momentum carries through turns. Space / Brake stops.`,
    );
  }
  revive() {
    const a = this.animals
      .filter((a) => a.down && !a.delivered && dist(a, this.player) < 7)
      .sort((a, b) => dist(a, this.player) - dist(b, this.player))[0];
    if (!a) {
      this.tell(
        "Stand within 7 m of a sleepy animal to offer a wake-up snack.",
      );
      return;
    }
    if (!this.revives) {
      this.tell("Out of wake-up snacks. Buy a pack at home.");
      return;
    }
    this.revives--;
    this.player.attack = {
      started: this.time,
      weapon: this.weapon,
      kind: "revive",
      duration: 0.5,
    };
    a.down = false;
    a.hp = 3;
    clearTumble(a);
    a.impactImmuneUntil = this.time + 2;
    this.tell("Wide awake again! Lead your friend home.");
  }
  attack() {
    if (
      this.cooldown > 0 ||
      this.shop ||
      this.jail ||
      this.player.stun > 0 ||
      this.player.ragdoll ||
      this.player.exitRoll ||
      this.vehicle !== null
    )
      return;
    if (this.item === "revive") {
      this.cooldown = 0.5;
      this.revive();
      return;
    }
    const w = WEAPONS[this.weapon];
    this.cooldown = w.cooldown;
    this.player.attack = {
      started: this.time,
      weapon: this.weapon,
      kind: w.range < 6 ? "melee" : "shoot",
      duration: w.range < 6 ? 0.42 : 0.3,
    };
    const targets = [
      ...this.guards.filter((g) => g.down <= 0),
      ...this.police.filter((p) => p.down <= 0 && p.inVehicle === undefined),
    ];
    const target = targets
      .filter((t) => dist(t, this.player) < w.range)
      .sort((a, b) => dist(a, this.player) - dist(b, this.player))[0];
    let angle = target
      ? Math.atan2(target.z - this.player.z, target.x - this.player.x)
      : this.player.heading;
    this.player.heading = angle;
    if (w.range < 6) {
      if (target) {
        this.hitGuard(target, w.power);
        this.crime(0.5);
      }
      this.shots.push({
        x: this.player.x + Math.cos(angle) * 2,
        z: this.player.z + Math.sin(angle) * 2,
        vx: 0,
        vz: 0,
        life: 0.2,
        owner: "swing",
        power: 0,
      });
    } else {
      this.shots.push({
        x: this.player.x,
        z: this.player.z,
        vx: Math.cos(angle) * 36,
        vz: Math.sin(angle) * 36,
        life: w.range / 36,
        owner: "player",
        power: w.power,
      });
      this.crime(0.35);
    }
  }
  hitGuard(g, power) {
    g.hitAt = this.time;
    g.hp -= power;
    if (g.hp <= 0) {
      g.down = NPC_KNOCKOUT_SECONDS;
      g.knockoutUntil = this.time + NPC_KNOCKOUT_SECONDS;
      g.hp = g.armor || 1;
    }
  }
  hurt(damage = 1) {
    if (
      this.player.invulnerable > 0 ||
      this.jail ||
      this.phase === "launch" ||
      this.phase === "credits"
    )
      return;
    this.player.hp = Math.max(0, this.player.hp - damage);
    this.player.invulnerable = 3.5;
    this.player.stun = 1.3;
    this.tell("Oof! A cartoon tumble. You lost a heart.");
    if (this.player.hp <= 0) {
      this.jail = 5;
      this.shop = false;
      this.vehicle = null;
      this.wanted = 0;
      for (const car of this.vehicles.filter((v) => v.policeDriving))
        disembarkPatrol(this, car);
      this.police = [];
      clearTumble(this.player);
      this.player.exitRoll = null;
      for (const a of this.animals)
        if (!a.delivered) {
          clearTumble(a);
          Object.assign(a, a.origin, {
            following: false,
            down: false,
            boarded: null,
          });
        }
      this.tell(
        "Time out in the town jail. Release to your farm in five seconds.",
      );
    }
  }
  launch() {
    if (this.parts === 5 && this.atHome && this.phase === "heist") {
      this.phase = "launch";
      this.shop = false;
      this.vehicle = null;
      this.wanted = 0;
      this.launchTime = 0;
      this.checkpoint();
    }
  }
  update(dt, input = {}) {
    dt = Math.min(0.05, Math.max(0, dt));
    this.time += dt;
    this.skidmarks = this.skidmarks.filter(
      (mark) => this.time - mark.born < SKID_LIFETIME,
    );
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.player.invulnerable = Math.max(0, this.player.invulnerable - dt);
    this.player.stun = Math.max(0, this.player.stun - dt);
    if (this.phase === "launch" || this.phase === "credits") {
      this.launchTime += dt;
      if (this.launchTime > 9) this.phase = "credits";
      return;
    }
    this.updateVehicleDamage();
    if (this.jail) {
      this.jail = Math.max(0, this.jail - dt);
      if (!this.jail) {
        Object.assign(this.player, {
          x: HOME.x,
          z: HOME.z + 10,
          hp: this.player.maxHp,
          stun: 0,
        });
        this.homeInside = true;
        this.tell(
          "Released! Your farm restored your hearts. Your lost herd returned home.",
        );
        this.checkpoint();
      }
      return;
    }
    const bodies = [
      this.player,
      ...this.animals.filter((a) => !a.delivered && a.boarded === null),
      ...this.guards,
      ...this.police.filter((g) => g.inVehicle === undefined),
    ];
    const previousBodies = new Map(
      bodies.map((body) => [body, { x: body.x, z: body.z, y: body.y || 0 }]),
    );
    const recovering = new Set();
    for (const body of bodies)
      if (stepTumble(body, dt, this.time, this.level)) recovering.add(body);
    const p = this.player;
    const rolling = !!p.exitRoll;
    if (rolling) {
      const roll = p.exitRoll;
      roll.age += dt;
      roll.vy -= 20 * dt;
      p.y = Math.max(0, p.y + roll.vy * dt);
      move(p, roll.vx * dt, roll.vz * dt, 0.5, this.level);
      roll.vx *= Math.exp(-3 * dt);
      roll.vz *= Math.exp(-3 * dt);
      if (roll.age >= roll.duration) {
        p.vy = p.y > 0 ? roll.vy : 0;
        p.exitRoll = null;
      }
    }
    let dx = input.x || 0,
      dz = input.z || 0;
    const len = Math.hypot(dx, dz);
    if (len > 1) {
      dx /= len;
      dz /= len;
    }
    if (this.shop || p.stun > 0) {
      dx = dz = 0;
    }
    if (this.vehicle !== null) {
      const v = this.vehicles[this.vehicle];
      v.previous = { x: v.x, z: v.z, heading: v.heading, y: v.y || 0 };
      const inactive = this.shop || p.stun > 0;
      v.motionTime = this.time;
      if ((v.y || 0) > 0.05) freeVehicle(v, dt, this.time, this.level);
      else
        drive(
          v,
          dt,
          {
            x: inactive ? 0 : dx,
            z: inactive ? 0 : dz,
            brake: inactive || input.brake,
          },
          this.level,
        );
      recordSkidmarks(this.skidmarks, v, this.time);
      p.x = v.x;
      p.z = v.z;
      p.heading = v.heading;
    } else if (!recovering.has(p) && !rolling) {
      if (dx || dz) {
        p.heading = Math.atan2(dz, dx);
        const speed = input.run ? 10 : 6.6;
        move(p, dx * speed * dt, dz * speed * dt, 0.5, this.level);
      }
      if (input.jump && p.y === 0 && !this.shop) p.vy = 7;
      if (p.y > 0 || p.vy > 0) {
        p.vy -= 20 * dt;
        p.y = Math.max(0, p.y + p.vy * dt);
      }
    }
    for (const v of this.vehicles) {
      if (v.id === this.vehicle) continue;
      v.previous = { x: v.x, z: v.z, heading: v.heading, y: v.y || 0 };
      v.disabled = Math.max(0, v.disabled - dt);
      v.motionTime = this.time;
      const dynamic =
        (v.y || 0) > 0.01 ||
        Math.abs(v.vy || 0) > 0.1 ||
        this.time < (v.physicsUntil || 0) ||
        v.destroyed ||
        v.burnStarted !== undefined ||
        v.stolen;
      if (dynamic) freeVehicle(v, dt, this.time, this.level);
      else if (v.policeDriving) {
        patrolStep(this, v, dt);
      } else if (v.crashRecovering) {
        v.rejoinDistance ??= nearestTrafficDistance(v);
        const target = trafficPose(v.rejoinDistance + 8),
          d = dist(v, target);
        drive(
          v,
          dt,
          {
            x: d ? ((target.x - v.x) / d) * 0.5 : 0,
            z: d ? ((target.z - v.z) / d) * 0.5 : 0,
          },
          this.level,
        );
        const nearest = nearestTrafficDistance(v),
          pose = trafficPose(nearest);
        if (
          dist(v, pose) < 0.8 &&
          Math.abs(
            Math.atan2(
              Math.sin(v.heading - pose.heading),
              Math.cos(v.heading - pose.heading),
            ),
          ) < 0.25 &&
          (v.currentSpeed < 0.25 ||
            Math.abs(
              Math.atan2(
                Math.sin(Math.atan2(v.vz, v.vx) - pose.heading),
                Math.cos(Math.atan2(v.vz, v.vx) - pose.heading),
              ),
            ) < 0.2) &&
          Math.abs(v.omega || 0) < 0.2
        ) {
          v.trafficDistance = nearest;
          v.trafficSpeed = v.currentSpeed;
          v.crashRecovering = false;
        } else if (dist(v, target) < 5) v.rejoinDistance = nearest;
      } else {
        stepTraffic(v, dt, this.vehicles, this.level);
        v.vx = dt ? (v.x - v.previous.x) / dt : 0;
        v.vz = dt ? (v.z - v.previous.z) / dt : 0;
        v.currentSpeed = Math.hypot(v.vx, v.vz);
      }
    }
    for (const v of this.vehicles)
      if (v.wallDamage) {
        this.damageCar(v, v.wallDamage);
        v.wallDamage = 0;
      }
    for (const v of this.vehicles)
      v.impactVelocity = {
        x: dt ? (v.x - v.previous.x) / dt : 0,
        z: dt ? (v.z - v.previous.z) / dt : 0,
      };
    this.vehicleContacts = resolveVehicleCollisions(
      this.vehicles,
      this.time,
      this.level,
      (v, damage) => this.damageCar(v, damage),
    );
    for (const v of this.vehicles)
      if (
        Math.hypot(v.vx || 0, v.vz || 0) >
        Math.hypot(v.impactVelocity.x, v.impactVelocity.z)
      )
        v.impactVelocity = { x: v.vx || 0, z: v.vz || 0 };
    if (this.vehicle !== null) {
      const v = this.vehicles[this.vehicle];
      p.x = v.x;
      p.z = v.z;
      p.heading = v.heading;
    }
    const herdType = this.herd[0]?.type;
    let recruited = false;
    for (const a of this.animals) {
      if (a.delivered) continue;
      if (a.boarded !== null) {
        const v = this.vehicles[a.boarded];
        a.x = v.x;
        a.z = v.z;
        continue;
      }
      if (a.down || recovering.has(a)) continue;
      const d = dist(a, p);
      if (
        !a.following &&
        d < 3.5 &&
        p.y < 1 &&
        this.vehicle === null &&
        (a.farm === -1 || this.phase === "heist")
      ) {
        const type = this.herd[0]?.type || herdType;
        if (!type || type === a.type) {
          a.following = true;
          if (a.farm >= 0) recruited = true;
        } else if (this.time > this.noteUntil)
          this.tell(
            `Only one animal type per trip. Bring your ${type} home first.`,
          );
      }
      if (a.following) {
        followAnimal(a, p, this.herd, this.atHome, dt, this.level);
      } else if (d < 100) {
        const ang = this.time * 0.2 + a.phase;
        move(
          a,
          Math.cos(ang) * dt * 0.3,
          Math.sin(ang) * dt * 0.3,
          0.45,
          this.level,
        );
        a.heading = ang;
      }
    }
    separateHerd(this.herd, this.level);
    if (recruited) {
      this.crime(herdType ? 0.15 : 1);
      this.tell(
        `Herd heist! ${this.herd.length} ${this.herd[0].type} following. Head home or find a vehicle.`,
      );
    }
    this.updateOpponents(dt, recovering);
    this.updateShots(dt);
    for (const body of [p, ...this.animals, ...this.guards, ...this.police]) {
      if (this.jail) break;
      if (
        body.delivered ||
        body.boarded != null ||
        body.ragdoll ||
        body.inVehicle !== undefined ||
        (body === p && p.exitRoll) ||
        (body === p && (this.vehicle !== null || this.jail))
      )
        continue;
      for (const v of this.vehicles) {
        if (dist(v, body) > 14) continue;
        const velocity = v.impactVelocity || { x: 0, z: 0 },
          speed = Math.hypot(velocity.x, velocity.z);
        const from = previousBodies.get(body) || body;
        if (
          speed >= 4 &&
          this.time >= (body.impactImmuneUntil || 0) &&
          !(body === p && p.invulnerable > 0) &&
          vehiclePersonContact(
            v,
            from,
            body,
            body.type === "cow" ? 0.7 : 0.5,
            body.type ? 1.5 : 2.1,
          )
        ) {
          if (body === p) {
            this.hurt();
            if (this.jail) break;
          }
          if (startTumble(body, velocity, this.time)) {
            if (body !== p) body.down = body.type ? true : 6;
            if (v.id === this.vehicle && !body.type && body !== p)
              this.crime(0.3);
            if (body.type && body.following)
              this.tell(
                "A cartoon tumble! Your friend will wake up soon, or use R with a wake-up snack.",
              );
          }
          break;
        }
        if (
          (body.y || 0) < (v.y || 0) + 2.2 &&
          (body.y || 0) + (body.type ? 1.5 : 2.1) > (v.y || 0)
        ) {
          const overlap = circleVehicle(
            body,
            v,
            body.type === "cow" ? 0.7 : 0.5,
          );
          if (overlap)
            move(
              body,
              overlap.x * (overlap.depth + 0.02),
              overlap.z * (overlap.depth + 0.02),
              0.5,
              this.level,
            );
        }
      }
    }
    const inside = this.vehicle === null && inHouse(p);
    if (inside && !this.houseInside && !p.ragdoll && !p.exitRoll) {
      if (this.phase === "heist") this.shop = true;
      else this.tell("Bring your twelve sheep home to open the workshop.");
    }
    this.houseInside = inside;
    const home = this.atHome;
    if (home && !p.ragdoll) {
      this.player.hp = this.player.maxHp;
      this.homeTimer += dt;
      if (this.phase === "intro") this.arrive();
      else if (!this.homeInside && this.homeTimer >= 4) {
        this.arrive();
        this.homeInside = true;
      }
    } else {
      this.homeInside = false;
      this.homeTimer = 0;
    }
  }
  updateOpponents(dt, recovering = new Set()) {
    const p = this.player;
    if (Math.ceil(this.wanted) <= 1)
      for (const car of this.vehicles.filter((v) => v.policeDriving))
        disembarkPatrol(this, car);
    if (this.wanted > 0) {
      const required = Math.ceil(this.wanted) * 2;
      while (this.police.length < required) {
        if (
          Math.ceil(this.wanted) >= 2 &&
          this.police.length % 4 === 2 &&
          required - this.police.length >= 2 &&
          spawnPatrol(this, 2)
        )
          continue;
        const a = this.random() * Math.PI * 2;
        this.police.push(
          createOfficer(this, {
            x: p.x + Math.cos(a) * 55,
            z: p.z + Math.sin(a) * 55,
          }),
        );
      }
      const seen = this.police.some(
        (g) => g.down <= 0 && !g.ragdoll && dist(g, p) < 33,
      );
      this.escape = seen ? 0 : this.escape + dt;
      if (this.escape >= 12) {
        this.wanted = Math.max(0, this.wanted - 1);
        this.escape = 0;
        this.tell(
          this.wanted
            ? "Search cooling down. Stay out of sight!"
            : "All clear. The police gave up.",
        );
      }
      if (this.wanted === 0) {
        for (const car of this.vehicles.filter((v) => v.policeDriving))
          disembarkPatrol(this, car);
        this.police = [];
      }
    }
    for (const g of [...this.guards, ...this.police]) {
      g.down = Math.max(0, g.down - dt, (g.knockoutUntil || 0) - this.time);
      if (g.inVehicle !== undefined) {
        const car = this.vehicles[g.inVehicle];
        g.x = car.x;
        g.z = car.z;
        continue;
      }
      if (g.down > 0 || recovering.has(g) || g.ragdoll) continue;
      g.cooldown -= dt;
      const f = g.farm === undefined ? null : FARMS[g.farm];
      const d = dist(g, p);
      if (d > 120) continue;
      const hostile =
        !f ||
        ((this.herd.some((a) => a.farm === f.id) || this.wanted > 0) &&
          dist(p, f) < 65);
      let target = hostile
        ? p
        : f
          ? {
              x:
                f.x +
                Math.cos(this.time * 0.12 + Number(g.id.split("-")[1])) * 23,
              z:
                f.z +
                Math.sin(this.time * 0.12 + Number(g.id.split("-")[1])) * 23,
            }
          : p;
      target = routeTarget(g, target);
      const len = dist(g, target);
      if (len > (hostile ? 5 : 2)) {
        const speed = hostile
          ? f
            ? 4.5 * f.aggression + this.level * 0.35
            : Math.ceil(this.wanted) <= 1
              ? FIRST_WANTED_WALK_SPEED
              : 8 + this.wanted * 0.55
          : 1.7;
        const dx = (target.x - g.x) / len,
          dz = (target.z - g.z) / len;
        move(g, dx * speed * dt, dz * speed * dt, 0.6, this.level);
        g.heading = Math.atan2(dz, dx);
      }
      const range = f
        ? f.weapon === "Foam bat"
          ? 4
          : 17 + this.level * 2
        : 20;
      if (
        hostile &&
        (f || Math.ceil(this.wanted) >= 2) &&
        d < range &&
        g.cooldown <= 0 &&
        !this.atHome
      ) {
        const a = Math.atan2(p.z - g.z, p.x - g.x);
        this.shots.push({
          x: g.x,
          z: g.z,
          vx: Math.cos(a) * 18,
          vz: Math.sin(a) * 18,
          life: range / 18,
          owner: "enemy",
          power: 1,
        });
        g.cooldown =
          Math.max(0.65, 2.5 - this.level * 0.2) / (f?.aggression || 1);
      }
    }
  }
  damageCar(v, amount) {
    const ignited = damageVehicle(v, amount, this.time);
    if (ignited && v.id === this.vehicle)
      this.tell("Your vehicle is on fire! Exit now — explosion in 5 seconds.");
  }
  updateVehicleDamage() {
    this.explosions = this.explosions.filter((e) => this.time - e.started < 2);
    // Collect first: a chain reaction starts its own five-second fire timer.
    const due = this.vehicles.filter(
      (v) =>
        !v.destroyed &&
        v.burnStarted !== undefined &&
        this.time - v.burnStarted >= FIRE_SECONDS - 1e-8,
    );
    for (const v of due) this.explodeVehicle(v);
  }
  explodeVehicle(v) {
    if (v.destroyed) return;
    const origin = { x: v.x, z: v.z, y: v.y || 0 };
    v.destroyed = true;
    v.health = 0;
    v.burnStarted = undefined;
    v.explodedAt = this.time;
    v.occupied = false;
    v.stolen = true;
    this.explosions.push({
      ...origin,
      id: ++this.explosionSequence,
      started: this.time,
      radius: BLAST_RADIUS,
    });
    if (v.isPolice) disembarkPatrol(this, v);
    const passengers = this.animals.filter(
      (a) => a.boarded === v.id && !a.delivered,
    );
    if (this.vehicle === v.id) {
      this.vehicle = null;
      this.player.x = v.x;
      this.player.z = v.z;
      this.player.y = v.y || 0;
    }
    passengers.forEach((a, i) => {
      a.boarded = null;
      a.x = v.x + ((i % 3) - 1) * 0.7;
      a.z = v.z + Math.floor(i / 3) * 0.35;
      a.y = v.y || 0;
    });
    for (const other of this.vehicles) {
      const d = Math.hypot(
        other.x - origin.x,
        other.z - origin.z,
        (other.y || 0) - origin.y,
      );
      if (
        d > BLAST_RADIUS ||
        Math.abs((other.y || 0) - origin.y) > BLAST_RADIUS
      )
        continue;
      const factor = Math.max(0, 1 - d / BLAST_RADIUS),
        mass = vehicleProfile(other).mass,
        angle =
          d > 0.1
            ? Math.atan2(other.z - origin.z, other.x - origin.x)
            : v.heading;
      if (other !== v) this.damageCar(other, 100 * factor);
      const impulse = (24 * factor) / Math.sqrt(mass);
      other.vx = (other.vx || 0) + Math.cos(angle) * impulse;
      other.vz = (other.vz || 0) + Math.sin(angle) * impulse;
      other.vy = Math.max(
        other.vy || 0,
        other === v ? 11 : (10 * factor) / Math.sqrt(mass),
      );
      other.omega = (other.omega || 0) + (other.id % 2 ? 1 : -1) * factor * 2;
      other.rollVelocity = factor * 3;
      other.pitchVelocity = factor * 2;
      other.physicsUntil = this.time + 3;
      other.crashRecovering = true;
      other.rejoinDistance = undefined;
    }
    const victims = [
      ...(!this.jail && this.vehicle === null ? [this.player] : []),
      ...this.animals.filter((a) => !a.delivered && a.boarded === null),
      ...this.guards,
      ...this.police.filter((g) => g.inVehicle === undefined),
    ];
    for (const body of victims) {
      const d = Math.hypot(
        body.x - origin.x,
        body.z - origin.z,
        (body.y || 0) - origin.y,
      );
      if (d >= BLAST_RADIUS) continue;
      const factor = 1 - d / BLAST_RADIUS,
        angle =
          d > 0.1
            ? Math.atan2(body.z - origin.z, body.x - origin.x)
            : (body.id || 0) * 2.4;
      const damage = Math.max(1, Math.ceil(factor * 2));
      if (body === this.player) {
        this.hurt(damage);
        if (this.jail) continue;
      } else if (body.type) {
        body.hp = Math.max(0, (body.hp ?? 3) - damage);
        body.down = true;
      } else {
        body.hp = Math.max(0, (body.hp || 1) - damage);
        if (body.hp === 0) {
          body.down = 6;
          body.hp = body.armor || 1;
        }
      }
      const force = {
        x: Math.cos(angle) * 24 * factor,
        z: Math.sin(angle) * 24 * factor,
      };
      if (body.ragdoll) {
        Object.assign(body.ragdoll, {
          phase: "flying",
          age: 0,
          vx: body.ragdoll.vx + force.x * 0.6,
          vz: body.ragdoll.vz + force.z * 0.6,
          vy: 9,
          still: 0,
        });
      } else {
        body.impactImmuneUntil = 0;
        startTumble(body, force, this.time);
      }
    }
    if (dist(this.player, origin) < 45)
      this.tell("Cartoon kaboom! Stay clear of burning vehicles.");
  }
  updateShots(dt) {
    for (const s of this.shots) {
      s.life -= dt;
      const steps = 3;
      for (let i = 0; i < steps && s.life > 0; i++) {
        s.x += (s.vx * dt) / steps;
        s.z += (s.vz * dt) / steps;
        if (s.owner === "swing") continue;
        if (
          OBSTACLES.some(
            (b) => Math.abs(s.x - b.x) < b.hx && Math.abs(s.z - b.z) < b.hz,
          )
        ) {
          s.life = 0;
          break;
        }
        const hull = this.vehicles.find(
          (v) =>
            circleVehicle(s, v, 0.12) &&
            (s.y ?? 1.3) >= (v.y || 0) &&
            (s.y ?? 1.3) < (v.y || 0) + 2.5,
        );
        if (hull) {
          this.damageCar(hull, (s.power || 1) * 10);
          s.life = 0;
          break;
        }
        if (
          s.owner === "enemy" &&
          this.vehicle === null &&
          dist(s, this.player) < 1.3 &&
          this.player.y < 1.5
        ) {
          if (this.vehicle === null) this.hurt();
          s.life = 0;
          break;
        }
        if (s.owner === "player") {
          const g = [...this.guards, ...this.police].find(
            (g) => g.down <= 0 && g.inVehicle === undefined && dist(s, g) < 1.2,
          );
          if (g) {
            this.hitGuard(g, s.power);
            s.life = 0;
            break;
          }
        }
        const a = this.animals.find(
          (a) =>
            !a.down && !a.delivered && a.boarded === null && dist(a, s) < 0.8,
        );
        if (a) {
          a.down = true;
          s.life = 0;
          break;
        }
      }
    }
    this.shots = this.shots.filter((s) => s.life > 0);
  }
}
