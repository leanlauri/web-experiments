// One visible screen, with a back stack and stable selection across shop rebuilds.
export function createMenus({ ids, clearInput, onClose = () => {} }) {
  const screens = ids.map((id) => document.getElementById(id)),
    stack = [];
  const visible = (button) =>
    !button.disabled && button.getClientRects().length > 0;
  const buttons = () => {
    const root = document.getElementById(active());
    if (!root) return [];
    const all = [...root.querySelectorAll("button")].filter(visible);
    return [
      ...all.filter((b) => !b.classList.contains("close")),
      ...all.filter((b) => b.classList.contains("close")),
    ];
  };
  const key = (button) => button?.dataset.menuKey || button?.id;
  function active() {
    return stack.at(-1)?.id || null;
  }
  function select(button, scroll = false) {
    screens.forEach((root) =>
      root
        .querySelectorAll(".menu-selected")
        .forEach((b) => b.classList.remove("menu-selected")),
    );
    if (!button) return;
    button.classList.add("menu-selected");
    stack.at(-1).selection = key(button);
    button.focus({ preventScroll: true });
    if (scroll) button.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
  function refresh() {
    if (!active()) return;
    if (active() === "wheel") return;
    const list = buttons(),
      entry = stack.at(-1);
    const focused = list.includes(document.activeElement)
      ? document.activeElement
      : null;
    select(
      focused ||
        list.find((b) => key(b) === entry.selection) ||
        list.find((b) => b.hasAttribute("data-menu-default")) ||
        list[0],
    );
  }
  function show() {
    for (const root of screens) root.hidden = root.id !== active();
    document.body.dataset.menu = active() || "";
    clearInput();
    if (active()) refresh();
    else document.getElementById("world").focus({ preventScroll: true });
  }
  function open(id) {
    if (active() === id) return;
    if (stack.length)
      stack.at(-1).selection =
        key(document.activeElement) || stack.at(-1).selection;
    stack.push({ id, selection: null });
    show();
  }
  function back() {
    const removed = stack.pop();
    if (removed) onClose(removed.id);
    show();
  }
  function closeAll() {
    while (stack.length) onClose(stack.pop().id);
    show();
  }
  function move(direction) {
    const panel = document.querySelector("#" + active() + " .panel");
    if (
      active() === "help" &&
      panel?.scrollHeight > panel?.clientHeight + 2 &&
      (direction === "up" || direction === "down")
    ) {
      scroll(direction === "up" ? -100 : 100);
      return;
    }
    const list = buttons();
    if (!list.length) return;
    const index = Math.max(0, list.indexOf(document.activeElement));
    select(
      list[
        (index +
          (direction === "up" || direction === "left" ? -1 : 1) +
          list.length) %
          list.length
      ],
      true,
    );
  }
  function scroll(amount) {
    document
      .querySelector("#" + active() + " .panel")
      ?.scrollBy({ top: amount, behavior: "instant" });
  }
  function keydown(e) {
    if (!active()) return false;
    const directions = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      KeyW: "up",
      KeyS: "down",
      KeyA: "left",
      KeyD: "right",
    };
    if (directions[e.code]) move(directions[e.code]);
    else if (e.code === "Enter" || e.code === "Space") {
      if (!e.repeat) document.activeElement?.click();
    } else if (e.code === "Tab") {
      const list = buttons(),
        index = list.indexOf(document.activeElement);
      if (list.length)
        select(
          list[(index + (e.shiftKey ? -1 : 1) + list.length) % list.length],
          true,
        );
    } else if (e.code === "PageDown" || e.code === "PageUp")
      scroll(e.code === "PageDown" ? 240 : -240);
    else return false;
    e.preventDefault();
    return true;
  }
  for (const root of screens) {
    root.addEventListener("focusin", (e) => {
      if (
        e.target.matches("button") &&
        active() === root.id &&
        root.id !== "wheel"
      )
        select(e.target);
    });
    root.addEventListener("pointermove", (e) => {
      const b = e.target.closest("button");
      if (b && visible(b) && active() === root.id && root.id !== "wheel")
        select(b);
    });
  }
  return {
    active,
    open,
    back,
    closeAll,
    refresh,
    move,
    scroll,
    keydown,
    contains: (id) => stack.some((s) => s.id === id),
    confirm: () => document.activeElement?.click(),
  };
}
