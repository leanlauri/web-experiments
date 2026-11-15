import { createMenus } from "./menus.js?v=city-action-2";
import { createController } from "./controller.js?v=city-action-2";
import { createWheel } from "./wheel.js?v=city-action-2";
import { createAudio } from "./audio.js?v=city-action-2";
import { vehicleProfile } from "./vehicles.js?v=city-action-2";
import { Game } from "./simulation.js?v=city-action-2";
import {
  HOME,
  FARMS,
  WEAPONS,
  PARTS,
  SIZE,
  TOWN_STREETS,
  OBSTACLES,
  RIVER_START,
  inTown,
  dist,
} from "./region.js?v=city-action-2";
import { createWorld } from "./world.js?v=city-action-2";
const $ = (id) => document.getElementById(id),
  SAVE = "little-pastures-moon-v1";
let saved;
try {
  saved = JSON.parse(localStorage.getItem(SAVE));
} catch {}
const game = new Game(saved);
const audio = createAudio();
const wheel = createWheel(game, $("wheel"), () => {
  if (menus.active() === "wheel") menus.back();
});
let atlasTown = false,
  selectedFarm = null;
let world;
try {
  world = createWorld($("world"));
} catch (e) {
  $("error").hidden = false;
  throw e;
}
const keys = new Set(),
  stick = { x: 0, y: 0 },
  panels = ["help", "atlas", "menu", "wheel", "shop", "confirm"];
const compactHUD = matchMedia("(max-width: 750px), (pointer: coarse)");
let touchBrake = false;
let jump = false,
  lastSave = null,
  shopSignature = "",
  hudTime = 0;
const menus = createMenus({
  ids: panels,
  clearInput,
  onClose: (id) => {
    if (id === "shop") game.shop = false;
  },
});
function openShop() {
  if (!game.atHome || game.phase !== "heist") {
    game.tell(
      "The workshop opens at your home farm after all twelve sheep are safe.",
    );
    return;
  }
  if (menus.active() === "shop") {
    menus.back();
    return;
  }
  game.shop = true;
  shopSignature = "";
  shop();
  menus.open("shop");
}
function action(name) {
  if (name === "cycle") {
    openWheel("tap");
    return;
  }
  if (name === "shop") {
    openShop();
    return;
  }
  if (!panels.every((id) => $(id).hidden) || game.shop) return;
  if (name === "interact") game.interact();
  if (name === "attack") game.attack();
  if (name === "revive") game.revive();
  if (name === "jump") jump = true;
}
const actions = {
  KeyE: "interact",
  KeyF: "attack",
  KeyR: "revive",
  KeyB: "shop",

  Space: "jump",
};
function togglePause() {
  if (menus.active()) menus.closeAll();
  else menus.open("menu");
}
function inputMode(mode) {
  if (document.body.dataset.input === mode) return;
  document.body.dataset.input = mode;
  for (const hint of document.querySelectorAll(".menu-hints"))
    hint.innerHTML =
      mode === "gamepad"
        ? "<span><kbd>✚ / LS</kbd> Navigate</span><span><kbd>A</kbd> Select</span><span><kbd>B</kbd> Back</span><span><kbd>RS</kbd> Scroll</span>"
        : "<span><kbd>↑ ↓</kbd> Navigate</span><span><kbd>Enter</kbd> Select</span><span><kbd>Esc</kbd> Back</span><span><kbd>PgUp/Dn</kbd> Scroll</span>";
}
addEventListener("keydown", (e) => {
  inputMode("keyboard");
  if (e.code === "Escape") {
    e.preventDefault();
    if (e.repeat) return;
    if (menus.active() === "wheel") wheel.close();
    else if (menus.active()) menus.back();
    else menus.open("menu");
    return;
  }
  if (menus.active() === "wheel" && wheel.key(e.code)) {
    e.preventDefault();
    return;
  }
  if (menus.keydown(e)) return;
  if (menus.active()) return;
  if (
    ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
      e.code,
    )
  )
    e.preventDefault();
  keys.add(e.code);
  if (e.repeat) return;
  if (e.code === "KeyQ") {
    e.preventDefault();
    openWheel("hold");
  } else if (e.code === "KeyM") menus.open("atlas");
  else if (e.code === "Enter" && game.phase === "credits") reset();
  else if (actions[e.code]) action(actions[e.code]);
});
addEventListener("keyup", (e) => {
  keys.delete(e.code);
  if (e.code === "KeyQ") wheel.release();
});
function clearInput() {
  keys.clear();
  stick.x = stick.y = 0;
  jump = false;
  touchBrake = false;
  $("stick-knob").style.transform = "";
}
addEventListener("blur", () => {
  clearInput();
  if (!menus.active() && game.phase !== "credits") menus.open("menu");
  audio.silence();
});
document.addEventListener("visibilitychange", () => {
  clearInput();
  if (!menus.active() && game.phase !== "credits") menus.open("menu");
  audio.silence();
});
addEventListener(
  "pointerdown",
  () => {
    audio.unlock();
    inputMode("touch");
  },
  { passive: true },
);
addEventListener("keydown", () => audio.unlock());
function openWheel(mode) {
  if (
    game.shop ||
    game.jail ||
    game.phase === "launch" ||
    game.phase === "credits"
  )
    return;
  menus.open("wheel");
  wheel.open(mode);
}
$("equipment-button").onclick = $("desktop-equipment").onclick = () =>
  openWheel("tap");
function soundLabel() {
  $("sound-button").textContent = "Sound: " + (audio.enabled ? "on" : "off");
}
$("sound-button").onclick = () => {
  audio.toggle();
  soundLabel();
};
soundLabel();
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
    limit = Math.max(1, (r.width - $("stick-knob").offsetWidth) / 2);
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
  b.addEventListener(b.closest("#menu") ? "click" : "pointerdown", (e) => {
    e.preventDefault();
    if (b.closest("#menu") && b.dataset.action === "revive") menus.closeAll();
    if (b.dataset.action === "jump" && game.vehicle !== null) {
      touchBrake = true;
      b.setPointerCapture(e.pointerId);
    }
    action(b.dataset.action);
  });
for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
  document
    .querySelector('.touch-actions [data-action="jump"]')
    .addEventListener(event, () => {
      touchBrake = false;
    });
$("pause-button").onclick = $("menu-button").onclick = togglePause;
$("menu-close").onclick = $("menu-resume").onclick = () => menus.closeAll();
$("mobile-map-button").onclick =
  $("map-button").onclick =
  $("menu-map").onclick =
    () => menus.open("atlas");
$("menu-help").onclick = $("help-button").onclick = () => menus.open("help");
$("menu-reset").onclick = $("reset").onclick = () => menus.open("confirm");
$("help-close").onclick =
  $("help-done").onclick =
  $("atlas-close").onclick =
  $("shop-close").onclick =
  $("confirm-cancel").onclick =
    () => menus.back();
$("confirm-restart").onclick = () => reset();
compactHUD.addEventListener("change", clearInput);
function reset() {
  game.reset();
  try {
    localStorage.removeItem(SAVE);
  } catch {}
  lastSave = null;
  shopSignature = "";
  clearInput();
  menus.closeAll();
  $("credits").hidden = true;
}
$("play-again").onclick = reset;
$("launch").onclick = () => {
  game.launch();
  menus.closeAll();
};
const animalIcons = [
  '<path d="M6 14C1 14 2 7 6 7C5 2 12 1 14 5C19 2 23 7 19 11C24 14 20 18 17 17"/><ellipse cx="12" cy="15" rx="5" ry="7"/>',
  '<circle cx="12" cy="13" r="8"/><path d="M6 7L3 2L10 5M14 5L21 2L18 7"/><ellipse cx="12" cy="16" rx="5" ry="3"/><path d="M10 16h.1M14 16h.1"/>',
  '<path d="M7 7C2 7 2 2 3 2M17 7C22 7 22 2 21 2M7 9L2 10L6 13M17 9L22 10L18 13"/><path d="M7 6H17L18 18L15 22H9L6 18Z"/><path d="M9 18h6"/>',
  '<ellipse cx="8" cy="6" rx="2.5" ry="5"/><ellipse cx="16" cy="6" rx="2.5" ry="5"/><ellipse cx="12" cy="17" rx="7" ry="5"/>',
  '<path d="M8 9Q2 4 7 1L10 8M16 9Q22 4 17 1L14 8M6 10L2 8M18 10L22 8"/><path d="M6 9H18L17 18L12 23L7 18Z"/>',
  '<path d="M7 23V13Q4 11 6 7V1L10 6H14L18 1V7Q20 11 17 13V23M7 15H17"/>',
];
for (const f of FARMS) {
  const b = document.createElement("button");
  b.className = "faction-marker";
  b.style.setProperty("--faction", "#" + f.color.toString(16));
  b.setAttribute("aria-label", f.name + " · " + f.animal);
  b.innerHTML = `<span>${f.id + 1}</span><svg viewBox="0 0 24 24" aria-hidden="true">${animalIcons[f.id]}</svg>`;
  b.onclick = () => {
    selectedFarm = f.id;
    $("atlas-selection").textContent = f.name + " · " + f.animal;
    document
      .querySelectorAll(".faction-marker")
      .forEach((n, i) => n.setAttribute("aria-pressed", String(i === f.id)));
  };
  $("factions").append(b);
}
function guide(page) {
  document
    .querySelectorAll(".guide-tabs button")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.id === "help-" + page)),
    );
  const rows =
    page === "controls"
      ? [
          ["LS / WASD", "Move"],
          ["A / Space", "Jump"],
          ["B / E", "Ride / exit"],
          ["X / F", "Use item"],
          ["Y / R", "Revive"],
          ["LB / Q", "Equipment"],
          ["LT / Space", "Brake"],
          ["Start / Esc", "Pause"],
        ]
      : page === "heists"
        ? [
            ["01", "Gather a herd"],
            ["02", "Bring them home"],
            ["03", "Build your rocket"],
            ["04", "Fly to the Moon"],
          ]
        : [
            ["★", "Walk patrols"],
            ["★★", "Armed patrols"],
            ["★★★", "Car pursuit"],
            ["★★★★", "Roadblocks"],
            ["★★★★★", "Full response"],
            ["◆ Home", "Clear wanted"],
          ];
  $("guide-content").innerHTML = rows
    .map(
      ([key, text]) =>
        '<div class="guide-card"><kbd>' +
        key +
        "</kbd><b>" +
        text +
        "</b></div>",
    )
    .join("");
}
for (const page of ["controls", "heists", "wanted"])
  $("help-" + page).onclick = () => guide(page);
guide("controls");
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
    `$${game.money} · ${game.delivered} credit · Rocket ${game.parts}/5`;
  const items = [];
  const part = PARTS[game.parts];
  if (part)
    items.push({
      key: "part",
      name: part.name,
      detail: `Rocket ${game.parts + 1}/5`,
      costLabel: `${part.animals} animal credit`,
      price:
        game.delivered >= part.animals
          ? "Install part"
          : `${part.animals - game.delivered} more animals`,
      disabled: game.delivered < part.animals,
    });
  items.push({
    key: "revive",
    name: "Wake-up snacks",
    detail: "Pack of 3",
    costLabel: "$15",
    price: "$15",
    disabled: game.money < 15,
  });
  if (game.player.maxHp < 6)
    items.push({
      key: "heart",
      name: "One extra heart",
      detail: `${game.player.maxHp}/6 hearts`,
      costLabel: `$${(game.player.maxHp - 4) * 60}`,
      price: `$${(game.player.maxHp - 4) * 60}`,
      disabled: game.money < (game.player.maxHp - 4) * 60,
    });
  WEAPONS.map((w, i) => ({ w, i }))
    .sort((a, b) => a.w.cost - b.w.cost)
    .forEach(({ w, i }) =>
      items.push({
        key: i,
        name: w.name,
        detail: `${w.range < 6 ? "Melee" : "Foam"} · ${w.range} m`,
        costLabel: w.cost ? `$${w.cost}` : "Free",
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
      b.dataset.menuKey = "shop-" + item.key;
      b.setAttribute("aria-label", item.name + " · " + item.price);
      b.textContent = item.price;
      b.disabled = item.disabled;
      b.onclick = () => {
        game.buy(item.key);
        shopSignature = "";
        shop();
      };
      const actions = document.createElement("div");
      actions.className = "shop-actions";
      const price = document.createElement("strong");
      price.className = "shop-price";
      price.textContent = item.costLabel;
      actions.append(price, b);
      row.append(text, actions);
      return row;
    }),
  );
  $("launch").hidden = game.parts < 5;
  if (menus.active() === "shop") menus.refresh();
}
function atlasView(town) {
  atlasTown = town;
  $("factions").hidden = town;
  $("atlas-selection").hidden = town;
  $("atlas-title").textContent = town ? "Town." : "Map.";
  $("atlas-town").setAttribute("aria-pressed", String(town));
  $("atlas-region").setAttribute("aria-pressed", String(!town));
}
$("atlas-town").onclick = () => atlasView(true);
$("atlas-region").onclick = () => atlasView(false);
function map(canvas, large = false) {
  const c = canvas.getContext("2d"),
    w = canvas.width,
    h = canvas.height,
    pad = large ? 35 : 9,
    scale =
      (Math.min(w, h) - pad * 2) / (large ? (atlasTown ? 270 : SIZE * 2) : 280);
  const center = large ? { x: 0, z: 0 } : game.player;
  const point = (p) => [
    w / 2 + (p.x - center.x) * scale,
    h / 2 + (p.z - center.z) * scale,
  ];
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
      { x: Math.cos(a) * RIVER_START, z: Math.sin(a) * RIVER_START },
      { x: Math.cos(a) * 650, z: Math.sin(a) * 650 },
      "#689faa",
      large ? 7 : 3,
    );
    line({ x: 0, z: 0 }, f, "#5e7163", large ? 5 : 2);
    dot(f, `#${f.color.toString(16)}`, large ? 14 : 6);
    if (large && !atlasTown) {
      const [x, y] = point(f);
      c.fillStyle = "#fff8df";
      c.font = "bold 14px system-ui";
      c.textAlign = "center";
      c.fillText(String(f.id + 1), x, y + 5);
      if (selectedFarm === f.id) {
        c.strokeStyle = "#fff8df";
        c.lineWidth = 3;
        c.beginPath();
        c.arc(x, y, 19, 0, Math.PI * 2);
        c.stroke();
      }
    }
  }
  line({ x: 0, z: 0 }, HOME, "#5e7163", large ? 4 : 2);
  for (const street of TOWN_STREETS)
    line(street.a, street.b, "#68796a", Math.max(1, street.width * scale));
  for (const b of OBSTACLES.filter((b) => b.type === "town")) {
    c.fillStyle =
      b.kind === "gas"
        ? "#ce9b43"
        : b.kind === "shop"
          ? "#ae7686"
          : b.kind === "warehouse"
            ? "#6c8d99"
            : "#dec5a2";
    const [x, y] = point({ x: b.x - b.hx, z: b.z - b.hz });
    c.fillRect(
      x,
      y,
      Math.max(1, b.hx * 2 * scale),
      Math.max(1, b.hz * 2 * scale),
    );
  }
  if (large) dot(HOME, "#ffe194", 9);
  else {
    const [hx, hy] = point(HOME);
    c.fillStyle = "#ffe194";
    c.beginPath();
    c.arc(
      Math.max(10, Math.min(w - 10, hx)),
      Math.max(10, Math.min(h - 10, hy)),
      4,
      0,
      Math.PI * 2,
    );
    c.fill();
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
  $("toast").hidden = game.time > game.noteUntil - (compactHUD.matches ? 4 : 0);
  $("weapon").textContent =
    game.item === "revive" ? "Wake-up snacks" : WEAPONS[game.weapon].name;
  document.querySelector('.touch-actions [data-action="attack"]').textContent =
    game.item === "revive"
      ? "Revive"
      : WEAPONS[game.weapon].range < 6
        ? "Hit"
        : "Shoot";
  $("snacks").textContent = `${game.revives} wake-up snacks`;
  $("vehicle").textContent =
    game.vehicle !== null
      ? `${vehicleProfile(game.vehicles[game.vehicle]).name} · ${herd.filter((a) => a.boarded === game.vehicle).length}/${game.vehicles[game.vehicle].seats - 1} animal seats`
      : "";
  const near = FARMS.find((f) => dist(f, game.player) < 60);
  $("location").textContent = game.atHome
    ? "YOUR BACKYARD SPACEPORT"
    : near
      ? near.name
      : inTown(game.player)
        ? "RIVER CROSSING · TOWN"
        : "THE SIX RIVER COUNTIES";
  $("distance").textContent = game.atHome
    ? !game.homeInside && !intro
      ? `Settling trip · ${Math.max(0, Math.ceil(4 - game.homeTimer))}s`
      : "Hearts restored · B for shop"
    : `Home · ${Math.round(dist(game.player, HOME))} m`;
  document.querySelector('.touch-actions [data-action="jump"]').textContent =
    game.vehicle === null ? "Jump" : "Brake";
  document.querySelector(
    '.touch-actions [data-action="interact"]',
  ).textContent = game.vehicle === null ? "Ride" : "Exit";
  $("status").dataset.wanted = stars > 0 ? "active" : "clear";
  $("mobile-summary").textContent =
    `${intro ? `${herd.length}/${12 - game.introDelivered} sheep` : `${awake.length} ${herd[0]?.type || "animals"}`}${herd.some((a) => a.down) ? " · needs revival" : ""} · ${game.atHome ? (!game.homeInside && !intro ? (game.delivery ? "Unloading → Barn" : "At home") : "At home") : `Home ${Math.round(dist(game.player, HOME))}m`}`;
  $("menu-objective").textContent = intro
    ? "Bring sheep home"
    : game.parts === 5
      ? "Launch your rocket"
      : "Bring animals home";
  $("menu-description").textContent = intro
    ? `${game.introDelivered}/12 sheep safe`
    : `Next: ${PARTS[game.parts]?.name || "the Moon"}`;
  $("menu-progress").textContent =
    `${awake.length} following · Rocket ${game.parts}/5`;
  $("menu-loadout").textContent = $("weapon").textContent;
  $("menu-button").setAttribute("aria-expanded", String(!$("menu").hidden));
  $("pause-button").setAttribute("aria-expanded", String(!!menus.active()));
  if (game.vehicle !== null) {
    const v = game.vehicles[game.vehicle],
      percent = Math.round((v.health / v.maxHealth) * 100),
      fire = v.burnStarted !== undefined;
    const condition = fire
      ? "FIRE " +
        Math.max(0, Math.ceil(5 - (game.time - v.burnStarted))) +
        "s — Exit!"
      : "Car " + percent + "%";
    $("mobile-summary").textContent += " · " + condition;
    $("vehicle").textContent += " · " + condition;
    $("mobile-summary").dataset.danger = fire ? "true" : "false";
  } else $("mobile-summary").dataset.danger = "false";
  if (game.shop) {
    shop();
    if (!menus.contains("shop")) menus.open("shop");
  }
  $("menu-shop").disabled = !game.atHome || game.phase !== "heist";
  $("menu-shop").setAttribute(
    "aria-label",
    game.atHome ? "Shop" : "Shop · At home",
  );
  menus.refresh();
  document.body.dataset.phase = game.phase;
  $("jail").hidden = !game.jail;
  $("jail-time").textContent =
    `Back to your farm in ${Math.ceil(game.jail)} seconds.`;
  $("credits").hidden = game.phase !== "credits";
  document.querySelector("footer").style.visibility =
    game.phase === "credits" ? "hidden" : "";
  for (const id of [
    "mission",
    "navigation",
    "status",
    "loadout",
    "touch",
    "mobile-summary",
  ]) {
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
const controller = createController({
  menu: () => menus.active(),
  pause: togglePause,
  back: () => (menus.active() === "wheel" ? wheel.close() : menus.back()),
  confirm: () =>
    menus.active() === "wheel" ? wheel.close(true) : menus.confirm(),
  move: (direction) =>
    menus.active() === "wheel"
      ? wheel.key(
          {
            up: "ArrowUp",
            down: "ArrowDown",
            left: "ArrowLeft",
            right: "ArrowRight",
          }[direction],
        )
      : menus.move(direction),
  scroll: (amount) => menus.scroll(amount),
  wheel,
  action: (name) => {
    if (game.phase === "credits" && name === "jump") {
      reset();
      return;
    }
    if (name === "wheel") openWheel("hold");
    else if (name === "map") menus.open("atlas");
    else action(name);
  },
  wake: () => {
    if (document.body.dataset.input !== "gamepad") audio.unlock();
    inputMode("gamepad");
  },
  disconnect: () => {
    clearInput();
    if (!menus.active()) menus.open("menu");
  },
});
inputMode("keyboard");
let previous = performance.now(),
  accumulator = 0;
function frame(now) {
  const elapsed = Math.min(0.15, (now - previous) / 1000);
  previous = now;
  if (game.shop && !menus.contains("shop")) {
    shop();
    menus.open("shop");
  }
  const pad = controller.poll(now);
  if (!document.hidden && !menus.active()) {
    accumulator += elapsed;
    while (accumulator >= 1 / 60) {
      let x = stick.x + pad.x,
        z = stick.y + pad.z;
      if (keys.has("KeyW") || keys.has("ArrowUp")) z -= 1;
      if (keys.has("KeyS") || keys.has("ArrowDown")) z += 1;
      if (keys.has("KeyA") || keys.has("ArrowLeft")) x -= 1;
      if (keys.has("KeyD") || keys.has("ArrowRight")) x += 1;
      game.update(1 / 60, {
        brake: touchBrake || keys.has("Space") || pad.brake,
        x: x * 0.768 + z * 0.64,
        z: -x * 0.64 + z * 0.768,
        run:
          pad.run ||
          keys.has("ShiftLeft") ||
          keys.has("ShiftRight") ||
          Math.hypot(stick.x, stick.y) > 0.85,
        jump,
      });
      jump = false;
      if (keys.has("KeyF") || pad.attack) game.attack();
      accumulator -= 1 / 60;
      if (game.shop) {
        shop();
        menus.open("shop");
        accumulator = 0;
        break;
      }
    }
  } else accumulator = 0;
  audio.update(game, !!menus.active());
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
    aiming: !!game.player.aim,
    civilians: game.civilians.length,
    delivering: game.animals.filter((a) => a.delivering).length,
    farmerCars: game.vehicles.filter((v) => v.farmerDriving).length,
    civilianTumbles: game.civilians.filter((c) => c.ragdoll).length,
    policeCars: {
      pursuit: game.vehicles.filter(
        (v) => v.policeDriving && v.policeMode === "pursuit",
      ).length,
      ramming: game.vehicles.filter((v) => v.policeDriving && v.ramming).length,
      roadblocks: game.roadblocks,
    },
    time: game.time,
    paused: !!menus.active(),
    menu: menus.active(),
    input: document.body.dataset.input,
    player: [game.player.x, game.player.y, game.player.z],
    followers: game.herd.length,
    sheep: game.animals
      .filter((a) => a.farm === -1)
      .map((a) => ({ position: [a.x, 0, a.z], following: a.following })),
    vehicle:
      game.vehicle === null
        ? null
        : {
            id: game.vehicle,
            heading: game.vehicles[game.vehicle].heading,
            speed: game.vehicles[game.vehicle].driveSpeed || 0,
            health: game.vehicles[game.vehicle].health,
            maxHealth: game.vehicles[game.vehicle].maxHealth,
            burning: game.vehicles[game.vehicle].burnStarted !== undefined,
            fireRemaining:
              game.vehicles[game.vehicle].burnStarted === undefined
                ? null
                : Math.max(
                    0,
                    5 - (game.time - game.vehicles[game.vehicle].burnStarted),
                  ),
            vx: game.vehicles[game.vehicle].vx || 0,
            vz: game.vehicles[game.vehicle].vz || 0,
            skidding: !!game.vehicles[game.vehicle].skidding,
          },
    wanted: game.wanted,
    hearts: game.player.hp,
    exitRoll: !!game.player.exitRoll,
    houseInside: game.houseInside,
    police: {
      onFoot: game.police.filter((p) => p.inVehicle === undefined).length,
      riding: game.police.filter((p) => p.inVehicle !== undefined).length,
    },
    recovery: game.player.ragdoll
      ? {
          phase: game.player.ragdoll.phase,
          height: game.player.y,
          rx: game.player.ragdoll.rx,
          rz: game.player.ragdoll.rz,
        }
      : null,
    money: game.money,
    parts: game.parts,
    tumbling: {
      player: !!game.player.ragdoll,
      animals: game.animals.filter((a) => a.ragdoll).length,
      people: [...game.guards, ...game.police].filter((g) => g.ragdoll).length,
    },
    vehicleContacts: game.vehicleContacts || 0,
    explosions: game.explosions.length,
    skidmarks: game.skidmarks.length,
    selectedItem: game.item || "weapon",
    equippedWeapon: game.weapon,
    audio: audio.stats(),
    stats: world.stats(),
  }),
};
