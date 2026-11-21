import { WEAPONS } from "./region.js?v=performance-1";
import { equipmentIcon } from "./equipment.js?v=performance-1";
export function createWheel(
  game,
  root,
  onClose = () =>
    document.querySelector("#world").focus({ preventScroll: true }),
) {
  let items = [],
    selected = 0,
    mode = "tap";
  const ring = root.querySelector(".wheel-ring"),
    title = root.querySelector(".wheel-selected"),
    detail = root.querySelector(".wheel-detail");
  function highlight(index) {
    root
      .querySelectorAll(".menu-selected")
      .forEach((b) => b.classList.remove("menu-selected"));
    selected = (index + items.length) % items.length;
    items.forEach((item, i) => {
      item.button.classList.toggle("selected", i === selected);
      item.button.setAttribute("aria-selected", String(i === selected));
    });
    const item = items[selected];
    title.textContent = item.name;
    ring.setAttribute("aria-activedescendant", item.button.id);
    detail.textContent = item.owned ? item.description : item.cost;
  }
  function close(commit = false) {
    if (root.hidden) return;
    if (commit) {
      const item = items[selected];
      if (item.owned) {
        game.item = item.id === "revive" ? "revive" : "weapon";
        if (item.id !== "revive") game.weapon = item.id;
      }
    }
    root.hidden = true;
    onClose();
  }
  function open(kind = "tap") {
    if (game.jail || game.phase === "launch" || game.phase === "credits")
      return;
    mode = kind;
    items = WEAPONS.map((w, id) => ({
      id,
      name: w.name,
      owned: game.owned.includes(id),
      cost: "$" + w.cost + " · buy at home",
      description:
        (w.range < 6 ? "Melee" : "Foam projectile") +
        " · " +
        w.range +
        " m range",
    }));
    items.push({
      id: "revive",
      name: "Wake-up snacks",
      owned: game.revives > 0,
      cost: "Out of snacks · buy at home",
      description:
        game.revives +
        " remaining · use the action button near a sleepy animal",
    });
    ring.querySelectorAll(".wheel-item").forEach((b) => b.remove());
    items.forEach((item, i) => {
      const b = document.createElement("button");
      b.className = "wheel-item";
      b.id = "wheel-option-" + item.id;
      b.dataset.item = item.id;
      b.setAttribute("role", "option");
      b.setAttribute(
        "aria-label",
        item.name + (item.owned ? "" : " — " + item.cost),
      );
      b.disabled = !item.owned;
      const a = (i / items.length) * Math.PI * 2;
      b.style.setProperty("--x", Math.sin(a) * 36 + "%");
      b.style.setProperty("--y", -Math.cos(a) * 36 + "%");
      b.innerHTML =
        equipmentIcon(item.id) +
        "<span>" +
        item.name +
        "</span><small>" +
        (item.id === "revive"
          ? game.revives
          : item.owned
            ? "Owned"
            : item.cost.split(" · ")[0]) +
        "</small>";
      b.addEventListener("pointerenter", () => highlight(i));
      b.addEventListener("focus", () => highlight(i));
      b.addEventListener("click", () => {
        highlight(i);
        close(true);
      });
      ring.append(b);
      item.button = b;
    });
    root.hidden = false;
    highlight(
      items.findIndex(
        (i) => i.id === (game.item === "revive" ? "revive" : game.weapon),
      ),
    );
    root
      .querySelectorAll(".menu-selected")
      .forEach((b) => b.classList.remove("menu-selected"));
    ring.tabIndex = -1;
    ring.focus({ preventScroll: true });
  }
  ring.addEventListener("pointermove", (e) => {
    const rect = ring.getBoundingClientRect(),
      dx = e.clientX - rect.left - rect.width / 2,
      dy = e.clientY - rect.top - rect.height / 2;
    if (Math.hypot(dx, dy) < 30) return;
    const a = (Math.atan2(dx, -dy) + Math.PI * 2) % (Math.PI * 2);
    highlight(Math.round((a / (Math.PI * 2)) * items.length) % items.length);
  });
  root.querySelector(".wheel-close").onclick = () => close(false);
  return {
    open,
    close,
    release() {
      if (!root.hidden && mode === "hold") close(true);
    },
    point(x, y) {
      if (root.hidden || Math.hypot(x, y) < 0.35) return;
      const a = (Math.atan2(x, -y) + Math.PI * 2) % (Math.PI * 2);
      highlight(Math.round((a / (Math.PI * 2)) * items.length) % items.length);
      ring.focus({ preventScroll: true });
    },
    key(code) {
      code =
        {
          KeyW: "ArrowUp",
          KeyS: "ArrowDown",
          KeyA: "ArrowLeft",
          KeyD: "ArrowRight",
        }[code] || code;
      if (root.hidden) return false;
      if (code === "Escape") {
        close();
        return true;
      }
      if (code === "Enter" || code === "Space") {
        close(true);
        return true;
      }
      if (["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"].includes(code)) {
        highlight(
          selected + (code === "ArrowLeft" || code === "ArrowUp" ? -1 : 1),
        );
        ring.focus({ preventScroll: true });
        return true;
      }
      return false;
    },
  };
}
