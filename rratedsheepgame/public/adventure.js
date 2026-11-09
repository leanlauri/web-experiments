import { Game } from "./simulation.mjs";
import { HOME, FARMS, WEAPONS, PARTS, SIZE, dist } from "./region.mjs";
import { createWorld } from "./world.js";
const $ = (id) => document.getElementById(id),
  SAVE = "little-pastures-moon-v1";
let saved;
try {
  saved = JSON.parse(localStorage.getItem(SAVE));
} catch {}
const game = new Game(saved);
let world;
try {
  world = createWorld($("world"));
} catch (e) {
  $("error").hidden = false;
  throw e;
}
const keys = new Set(),
  stick = { x: 0, y: 0 },
  panels = ["help", "atlas"];
let jump = false,
  lastSave = null,
  shopSignature = "",
  hudTime = 0;
function openShop() {
  if (!game.atHome || game.phase !== "heist") {
    game.tell(
      "The workshop opens at your home farm after all twelve sheep are safe.",
    );
    return;
  }
  game.shop = !game.shop;
  shopSignature = "";
}
function action(name) {
  if (name === "shop") {
    openShop();
    return;
  }
  if (!panels.every((id) => $(id).hidden) || game.shop) return;
  if (name === "interact") game.interact();
  if (name === "attack") game.attack();
  if (name === "revive") game.revive();
  if (name === "jump") jump = true;
  if (name === "cycle") {
    const i = game.owned.indexOf(game.weapon);
    game.weapon = game.owned[(i + 1) % game.owned.length];
  }
}
const actions = {
  KeyE: "interact",
  KeyF: "attack",
  KeyR: "revive",
  KeyB: "shop",
  KeyQ: "cycle",
  Space: "jump",
};
addEventListener("keydown", (e) => {
  if (
    ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
      e.code,
    )
  )
    e.preventDefault();
  if (e.target.closest("button") && e.code === "Space") return;
  keys.add(e.code);
  if (e.repeat) return;
  if (e.code === "Escape") {
    for (const id of panels) $(id).hidden = true;
    game.shop = false;
  } else if (e.code === "KeyM") $("atlas").hidden = !$("atlas").hidden;
  else if (actions[e.code]) action(actions[e.code]);
});
addEventListener("keyup", (e) => keys.delete(e.code));
function clearInput() {
  keys.clear();
  stick.x = stick.y = 0;
  jump = false;
  $("stick-knob").style.transform = "";
}
addEventListener("blur", clearInput);
document.addEventListener("visibilitychange", clearInput);
$("world").addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    world.zoom(e.deltaY * 0.001);
  },
  { passive: false },
);
let pointer = null;
function steer(e) {
  const r = $("thumbstick").getBoundingClientRect(),
    x = e.clientX - r.left - r.width / 2,
    y = e.clientY - r.top - r.height / 2,
    d = Math.hypot(x, y),
    limit = 34;
  stick.x = x / Math.max(limit, d);
  stick.y = y / Math.max(limit, d);
  $("stick-knob").style.transform =
    `translate(${stick.x * limit}px,${stick.y * limit}px)`;
}
$("thumbstick").addEventListener("pointerdown", (e) => {
  pointer = e.pointerId;
  e.currentTarget.setPointerCapture(pointer);
  steer(e);
});
$("thumbstick").addEventListener("pointermove", (e) => {
  if (e.pointerId === pointer) steer(e);
});
for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
  $("thumbstick").addEventListener(type, () => {
    pointer = null;
    clearInput();
  });
for (const b of document.querySelectorAll("[data-action]"))
  b.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    action(b.dataset.action);
  });
$("help-button").onclick = () => {
  $("help").hidden = false;
};
$("help-close").onclick = $("help-done").onclick = () => {
  $("help").hidden = true;
};
$("map-button").onclick = () => {
  $("atlas").hidden = false;
};
$("atlas-close").onclick = () => {
  $("atlas").hidden = true;
};
$("shop-close").onclick = () => (game.shop = false);
function reset() {
  game.reset();
  try {
    localStorage.removeItem(SAVE);
  } catch {}
  lastSave = null;
  shopSignature = "";
  clearInput();
  for (const id of [...panels, "credits"]) $(id).hidden = true;
}
$("reset").onclick = () => {
  if (
    confirm("Start a new adventure? This replaces your saved rocket progress.")
  )
    reset();
};
$("play-again").onclick = reset;
$("launch").onclick = () => game.launch();
$("factions").innerHTML = FARMS.map(
  (f) =>
    `<div class="faction" style="--faction:#${f.color.toString(16)}"><b>${f.name}</b><small>${f.animal} · ${f.weapon}<br>${f.aggression > 1.2 ? "Feisty" : f.aggression < 1 ? "Laid-back" : "Watchful"} guards</small></div>`,
).join("");
function shop() {
  const signature = JSON.stringify([
    game.money,
    game.parts,
    game.delivered,
    game.owned,
    game.player.maxHp,
    game.revives,
  ]);
  if (signature === shopSignature) return;
  shopSignature = signature;
  $("shop-summary").textContent =
    `$${game.money} in your pocket · ${game.delivered} animal credit · ${game.heists} successful trips`;
  const items = [];
  const part = PARTS[game.parts];
  if (part)
    items.push({
      key: "part",
      name: part.name,
      detail: `Part ${game.parts + 1}/5 · ${part.animals} cumulative animal credit`,
      price:
        game.delivered >= part.animals
          ? "Install part"
          : `${part.animals - game.delivered} more animals`,
      disabled: game.delivered < part.animals,
    });
  items.push({
    key: "revive",
    name: "Wake-up snack pack",
    detail: "Revives 3 sleepy animals · use R nearby",
    price: "$15",
    disabled: game.money < 15,
  });
  if (game.player.maxHp < 6)
    items.push({
      key: "heart",
      name: "One extra heart",
      detail: `Permanent upgrade · ${game.player.maxHp}/6 hearts now`,
      price: `$${(game.player.maxHp - 2) * 60}`,
      disabled: game.money < (game.player.maxHp - 2) * 60,
    });
  WEAPONS.forEach((w, i) =>
    items.push({
      key: i,
      name: w.name,
      detail: `${w.range < 6 ? "Melee" : "Projectile"} · ${w.range} m range · cartoon knockout`,
      price: game.owned.includes(i) ? "Owned" : `$${w.cost}`,
      disabled: game.owned.includes(i) || game.money < w.cost,
    }),
  );
  $("shop-items").replaceChildren(
    ...items.map((item) => {
      const row = document.createElement("div");
      row.className = "shop-item";
      const text = document.createElement("div");
      text.innerHTML = `<b>${item.name}</b><small>${item.detail}</small>`;
      const b = document.createElement("button");
      b.textContent = item.price;
      b.disabled = item.disabled;
      b.onclick = () => {
        game.buy(item.key);
        shopSignature = "";
        shop();
      };
      row.append(text, b);
      return row;
    }),
  );
  $("launch").hidden = game.parts < 5;
}
function map(canvas, large = false) {
  const c = canvas.getContext("2d"),
    w = canvas.width,
    h = canvas.height,
    pad = large ? 35 : 9,
    scale = (Math.min(w, h) - pad * 2) / (SIZE * 2);
  const point = (p) => [w / 2 + p.x * scale, h / 2 + p.z * scale];
  const line = (a, b, color, width) => {
    c.strokeStyle = color;
    c.lineWidth = width;
    c.beginPath();
    c.moveTo(...point(a));
    c.lineTo(...point(b));
    c.stroke();
  };
  const dot = (p, color, r) => {
    c.fillStyle = color;
    c.beginPath();
    c.arc(...point(p), r, 0, Math.PI * 2);
    c.fill();
  };
  c.fillStyle = "#a7bc89";
  c.fillRect(0, 0, w, h);
  for (const f of FARMS) {
    const a = f.angle + Math.PI / 6;
    line(
      { x: Math.cos(a) * 68, z: Math.sin(a) * 68 },
      { x: Math.cos(a) * 650, z: Math.sin(a) * 650 },
      "#689faa",
      large ? 7 : 3,
    );
    line({ x: 0, z: 0 }, f, "#5e7163", large ? 5 : 2);
    dot(f, `#${f.color.toString(16)}`, large ? 14 : 6);
    if (large) {
      const [x, y] = point(f);
      c.fillStyle = "#253d31";
      c.font = "bold 11px system-ui";
      c.textAlign = "center";
      c.fillText(f.name, x, y + 28);
      c.font = "10px system-ui";
      c.fillText(f.animal, x, y + 41);
    }
  }
  line({ x: 0, z: 0 }, HOME, "#5e7163", large ? 4 : 2);
  c.strokeStyle = "#637667";
  c.lineWidth = large ? 6 : 2;
  c.beginPath();
  c.arc(w / 2, h / 2, 100 * scale, 0, Math.PI * 2);
  c.stroke();
  dot({ x: 0, z: 0 }, "#ece1bf", large ? 12 : 5);
  dot(HOME, "#ffe194", large ? 9 : 4);
  if (large) {
    c.fillStyle = "#354b38";
    c.textAlign = "center";
    c.fillText("TOWN", w / 2, h / 2 + 26);
    const [x, y] = point(HOME);
    c.fillText("YOUR FARM", x, y - 15);
  }
  for (const a of game.herd)
    dot(a, a.down ? "#9c4f66" : "#f5e8bf", large ? 3 : 1.5);
  for (const g of game.police)
    if (g.down <= 0) dot(g, "#c75350", large ? 4 : 2);
  dot(game.player, "#203b45", large ? 7 : 4);
  dot(game.player, "#fff9e9", large ? 4 : 2);
  const [px, py] = point(game.player);
  line(
    game.player,
    {
      x: game.player.x + Math.cos(game.player.heading) * 28,
      z: game.player.z + Math.sin(game.player.heading) * 28,
    },
    "#fff9e9",
    2,
  );
  c.fillStyle = "#304d3c";
  c.font = `bold ${large ? 12 : 10}px system-ui`;
  c.textAlign = "left";
  c.fillText("N ↑", 9, 18);
}
function hud() {
  const herd = game.herd,
    awake = herd.filter((a) => !a.down),
    intro = game.phase === "intro";
  $("hearts").textContent =
    "♥ ".repeat(game.player.hp) +
    "♡ ".repeat(game.player.maxHp - game.player.hp);
  $("hearts").setAttribute(
    "aria-label",
    `${game.player.hp} of ${game.player.maxHp} hearts`,
  );
  $("cash").textContent = `$${game.money}`;
  const stars = Math.ceil(game.wanted);
  $("wanted").textContent = "★ ".repeat(stars) + "☆ ".repeat(5 - stars);
  $("wanted").setAttribute("aria-label", `Wanted level ${stars} of 5`);
  $("escape").textContent = stars
    ? game.escape > 0
      ? `Out of sight · ${Math.ceil(12 - game.escape)}s to lose a star`
      : "Police searching · break away!"
    : "No trouble. Yet.";
  $("chapter").textContent = intro
    ? "01 / THE EVENING JOURNEY"
    : `02 / THE GREAT MOON HEIST · DEFENSE ${game.level + 1}`;
  $("objective").textContent = intro
    ? "Bring the flock home."
    : game.parts === 5
      ? "Next stop: the Moon."
      : "Small farm. Big ambition.";
  $("description").textContent = intro
    ? `${game.introDelivered}/12 sheep safe at home. Gather the rest and follow the gold marker north.`
    : game.parts === 5
      ? "All five parts installed. Open your home workshop to launch."
      : `Bring one species home per trip. Next: ${PARTS[game.parts].name} at ${PARTS[game.parts].animals} animal credit.`;
  $("count").textContent = intro
    ? `${herd.length} / ${12 - game.introDelivered}`
    : `${awake.length}`;
  $("cargo").textContent =
    `${herd[0]?.type || "animals"} following${herd.some((a) => a.down) ? ` · ${herd.filter((a) => a.down).length} need reviving` : ""}`;
  $("rocket-count").textContent =
    `ROCKET ${game.parts} / 5 · ${game.delivered} ANIMAL CREDIT`;
  $("rocket-fill").style.width = `${(game.parts / 5) * 100}%`;
  $("rocket-progress").hidden = intro;
  $("toast").textContent = game.note;
  $("toast").hidden = game.time > game.noteUntil;
  $("weapon").textContent = WEAPONS[game.weapon].name;
  $("snacks").textContent = `${game.revives} wake-up snacks`;
  $("vehicle").textContent =
    game.vehicle !== null
      ? `${game.vehicles[game.vehicle].kind} · ${herd.filter((a) => a.boarded === game.vehicle).length}/${game.vehicles[game.vehicle].seats - 1} animal seats`
      : "";
  const near = FARMS.find((f) => dist(f, game.player) < 60);
  $("location").textContent = game.atHome
    ? "YOUR BACKYARD SPACEPORT"
    : near
      ? near.name
      : Math.hypot(game.player.x, game.player.z) < 110
        ? "RIVER CROSSING · TOWN"
        : "THE SIX RIVER COUNTIES";
  $("distance").textContent = game.atHome
    ? !game.homeInside && !intro
      ? `Settling trip · ${Math.max(0, Math.ceil(4 - game.homeTimer))}s`
      : "Hearts restored · B for shop"
    : `Home · ${Math.round(dist(game.player, HOME))} m`;
  $("shop").hidden = !game.shop;
  if (game.shop) shop();
  $("jail").hidden = !game.jail;
  $("jail-time").textContent =
    `Back to your farm in ${Math.ceil(game.jail)} seconds.`;
  $("credits").hidden = game.phase !== "credits";
  document.querySelector("footer").style.visibility =
    game.phase === "credits" ? "hidden" : "";
  for (const id of ["mission", "navigation", "status", "loadout", "touch"]) {
    if (game.phase === "credits" || game.phase === "launch")
      $(id).style.visibility = "hidden";
    else $(id).style.visibility = "";
  }
  map($("map"));
  if (!$("atlas").hidden) map($("atlas-map"), true);
  if (game.lastSaved && game.lastSaved !== lastSave) {
    lastSave = game.lastSaved;
    try {
      localStorage.setItem(SAVE, JSON.stringify(lastSave));
    } catch {
      game.tell(
        "Local saving is unavailable. Keep this tab open to preserve your adventure.",
      );
    }
  }
}
let previous = performance.now(),
  accumulator = 0;
function frame(now) {
  const elapsed = Math.min(0.15, (now - previous) / 1000);
  previous = now;
  if (!document.hidden && panels.every((id) => $(id).hidden)) {
    accumulator += elapsed;
    while (accumulator >= 1 / 60) {
      let x = stick.x,
        z = stick.y;
      if (keys.has("KeyW") || keys.has("ArrowUp")) z -= 1;
      if (keys.has("KeyS") || keys.has("ArrowDown")) z += 1;
      if (keys.has("KeyA") || keys.has("ArrowLeft")) x -= 1;
      if (keys.has("KeyD") || keys.has("ArrowRight")) x += 1;
      game.update(1 / 60, {
        x: x * 0.768 + z * 0.64,
        z: -x * 0.64 + z * 0.768,
        run:
          keys.has("ShiftLeft") ||
          keys.has("ShiftRight") ||
          Math.hypot(stick.x, stick.y) > 0.85,
        jump,
      });
      jump = false;
      if (keys.has("KeyF")) game.attack();
      accumulator -= 1 / 60;
    }
  } else accumulator = 0;
  world.render(game);
  hudTime += elapsed;
  if (hudTime > 0.1) {
    hud();
    hudTime = 0;
  }
  requestAnimationFrame(frame);
}
hud();
requestAnimationFrame(frame);
// Read-only diagnostics. Tests inject their controls through a separate, unpublished test page.
window.sheepGame = {
  getState: () => ({
    phase: game.phase,
    player: [game.player.x, game.player.y, game.player.z],
    followers: game.herd.length,
    sheep: game.animals
      .filter((a) => a.farm === -1)
      .map((a) => ({ position: [a.x, 0, a.z], following: a.following })),
    wanted: game.wanted,
    hearts: game.player.hp,
    money: game.money,
    parts: game.parts,
    stats: world.stats(),
  }),
};
