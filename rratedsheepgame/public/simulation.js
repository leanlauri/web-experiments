import { drive } from "./driving.js?v=directional-drift-1";
import { recordSkidmarks, SKID_LIFETIME } from "./skidmarks.js";
import {
  HOME,
  START,
  FARMS,
  WEAPONS,
  PARTS,
  dist,
  move,
  routeTarget,
  OBSTACLES,
} from "./region.js";
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
    this.revives = 3;
    this.wanted = 0;
    this.escape = 0;
    this.vehicle = null;
    this.cooldown = 0;
    this.jail = 0;
    this.homeInside = false;
    this.homeTimer = 0;
    this.shop = false;
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
    for (let i = 0; i < 24; i++) {
      const f = FARMS[i % 6],
        t = 0.16 + (i % 4) * 0.19;
      this.vehicles.push({
        id: i,
        x: f.x * t - Math.sin(f.angle) * 2,
        z: f.z * t + Math.cos(f.angle) * 2,
        heading: f.angle,
        route: i % 6,
        t,
        dir: i % 2 ? 1 : -1,
        speed: 9 + (i % 4),
        seats: [2, 4, 7, 13][i % 4],
        kind: ["buggy", "car", "van", "bus"][i % 4],
        stolen: false,
        occupied: true,
        disabled: 0,
        previous: null,
      });
    }
    this.vehicles.push({
      id: 24,
      x: -9,
      z: HOME.z + 7,
      heading: 0,
      route: 0,
      t: 0,
      dir: 1,
      speed: 0,
      seats: 7,
      kind: "van",
      stolen: true,
      occupied: false,
      disabled: 0,
      previous: null,
    });
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
        this.money = 25;
        this.tell(
          "The flock is home! Surprise: you are building a moon rocket. Borrow animals from the six big farms to fund it.",
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
    if (this.jail || this.phase === "launch" || this.phase === "credits")
      return;
    if (this.vehicle !== null) {
      const v = this.vehicles[this.vehicle];
      this.player.x = v.x + Math.cos(v.heading + Math.PI / 2) * 3;
      this.player.z = v.z + Math.sin(v.heading + Math.PI / 2) * 3;
      v.driveSpeed = v.currentSpeed = v.vx = v.vz = 0;
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
      .filter((v) => dist(v, this.player) < 6 && v.disabled <= 0)
      .sort((a, b) => dist(a, this.player) - dist(b, this.player))[0];
    if (!v) {
      this.tell("Get closer to a vehicle, then press E to board.");
      return;
    }
    v.driveSpeed = v.currentSpeed || (!v.stolen ? v.speed : 0);
    v.vx = Math.cos(v.heading) * v.driveSpeed;
    v.vz = Math.sin(v.heading) * v.driveSpeed;
    v.skidAnchor = null;
    if (!v.stolen) {
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
    a.down = false;
    this.tell("Wide awake again! Lead your friend home.");
  }
  attack() {
    if (
      this.cooldown > 0 ||
      this.shop ||
      this.jail ||
      this.player.stun > 0 ||
      this.vehicle !== null
    )
      return;
    const w = WEAPONS[this.weapon];
    this.cooldown = w.cooldown;
    const targets = [
      ...this.guards.filter((g) => g.down <= 0),
      ...this.police.filter((p) => p.down <= 0),
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
    g.hp -= power;
    if (g.hp <= 0) {
      g.down = 12;
      g.hp = g.armor || 1;
    }
  }
  hurt() {
    if (
      this.player.invulnerable > 0 ||
      this.jail ||
      this.phase === "launch" ||
      this.phase === "credits"
    )
      return;
    this.player.hp--;
    this.player.invulnerable = 3.5;
    this.player.stun = 1.3;
    this.tell("Oof! A cartoon tumble. You lost a heart.");
    if (this.player.hp <= 0) {
      this.jail = 5;
      this.shop = false;
      this.vehicle = null;
      this.wanted = 0;
      this.police = [];
      for (const a of this.animals)
        if (!a.delivered)
          Object.assign(a, a.origin, {
            following: false,
            down: false,
            boarded: null,
          });
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
    const p = this.player;
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
      v.previous = { x: v.x, z: v.z };
      const inactive = this.shop || p.stun > 0;
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
    } else {
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
      v.previous = { x: v.x, z: v.z };
      v.disabled = Math.max(0, v.disabled - dt);
      if (!v.stolen && v.disabled === 0) {
        const f = FARMS[v.route];
        v.t += (v.dir * v.speed * dt) / 330;
        if (v.t > 0.87 || v.t < 0.06) {
          v.dir *= -1;
          v.t = Math.max(0.06, Math.min(0.87, v.t));
        }
        v.x = f.x * v.t - Math.sin(f.angle) * 2 * v.dir;
        v.z = f.z * v.t + Math.cos(f.angle) * 2 * v.dir;
        v.heading = f.angle + (v.dir < 0 ? Math.PI : 0);
        v.currentSpeed = v.speed;
      } else v.currentSpeed = 0;
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
      if (a.down) continue;
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
        let target = routeTarget(a, p);
        const distance = dist(a, target);
        if (distance > 2.5) {
          let vx = (target.x - a.x) / distance,
            vz = (target.z - a.z) / distance;
          for (const b of this.herd) {
            if (b === a || b.down || b.boarded !== null) continue;
            const dd = dist(a, b);
            if (dd > 0 && dd < 1.5) {
              vx += ((a.x - b.x) / dd) * (1.5 - dd);
              vz += ((a.z - b.z) / dd) * (1.5 - dd);
            }
          }
          const ll = Math.hypot(vx, vz) || 1;
          move(a, (vx / ll) * 9 * dt, (vz / ll) * 9 * dt, 0.45, this.level);
          a.heading = Math.atan2(vz, vx);
        }
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
    if (recruited) {
      this.crime(herdType ? 0.15 : 1);
      this.tell(
        `Herd heist! ${this.herd.length} ${this.herd[0].type} following. Head home or find a vehicle.`,
      );
    }
    for (const v of this.vehicles) {
      if (v.currentSpeed < 5 || dist(v, p) > 100) continue;
      if (this.vehicle !== v.id && p.y < 1.5 && dist(v, p) < 2.1) this.hurt();
      for (const a of this.animals) {
        if (a.delivered || a.down || a.boarded !== null || dist(a, v) > 2)
          continue;
        a.down = true;
        if (a.following)
          this.tell(
            "An animal is snoozing after a bump. Use R nearby with a wake-up snack.",
          );
      }
      if (v.id === this.vehicle && v.currentSpeed > 10) {
        for (const g of [...this.guards, ...this.police])
          if (g.down <= 0 && dist(g, v) < 2) {
            this.hitGuard(g, 5);
            this.crime(0.3);
          }
      }
    }
    this.updateOpponents(dt);
    this.updateShots(dt);
    const home = this.atHome;
    if (home) {
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
  updateOpponents(dt) {
    const p = this.player;
    if (this.wanted > 0) {
      const required = Math.ceil(this.wanted) * 2;
      while (this.police.length < required) {
        const a = this.random() * Math.PI * 2;
        this.police.push({
          id: `p${this.time}-${this.police.length}`,
          x: p.x + Math.cos(a) * 55,
          z: p.z + Math.sin(a) * 55,
          heading: a,
          down: 0,
          hp: 2,
          armor: 2,
          cooldown: 2,
        });
      }
      const seen = this.police.some((g) => g.down <= 0 && dist(g, p) < 33);
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
      if (this.wanted === 0) this.police = [];
    }
    for (const g of [...this.guards, ...this.police]) {
      g.down = Math.max(0, g.down - dt);
      if (g.down > 0) continue;
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
      if (hostile && d < range && g.cooldown <= 0 && !this.atHome) {
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
        if (
          s.owner === "enemy" &&
          dist(s, this.player) < 1.3 &&
          this.player.y < 1.5
        ) {
          if (this.vehicle !== null) {
            const passengers = this.herd.filter(
              (a) => a.boarded === this.vehicle && !a.down,
            );
            if (passengers.length && this.random() < 0.45)
              passengers[0].down = true;
            else this.hurt();
          } else this.hurt();
          s.life = 0;
          break;
        }
        if (s.owner === "player") {
          const g = [...this.guards, ...this.police].find(
            (g) => g.down <= 0 && dist(s, g) < 1.2,
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
