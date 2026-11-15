const pressed = (pad, i) =>
  !!pad.buttons?.[i]?.pressed || pad.buttons?.[i]?.value > 0.5;
export function stickAxis(value = 0) {
  const magnitude = Math.abs(value);
  return magnitude <= 0.2
    ? 0
    : Math.sign(value) * Math.min(1, (magnitude - 0.2) / 0.8);
}
export function createController({
  getPads = () => navigator.getGamepads?.() || [],
  menu,
  pause,
  back,
  confirm,
  move,
  scroll,
  wheel,
  action,
  wake,
  disconnect,
}) {
  let previous = [],
    index = null,
    wasUsed = false,
    repeatDirection = null,
    repeatAt = 0;
  const empty = () => ({ x: 0, z: 0, run: false, brake: false, attack: false });
  function poll(now) {
    let pads;
    try {
      pads = getPads();
    } catch {
      return empty();
    }
    const pad = [...pads].find((p) => p?.connected !== false && p);
    if (!pad) {
      if (index !== null && wasUsed) disconnect();
      index = null;
      previous = [];
      wasUsed = false;
      return empty();
    }
    if (index !== pad.index) {
      previous = [];
      index = pad.index;
    }
    const held = Array.from({ length: 17 }, (_, i) => pressed(pad, i)),
      last = previous,
      edge = (i) => held[i] && !last[i],
      released = (i) => !held[i] && last[i];
    const x = stickAxis(pad.axes?.[0]),
      z = stickAxis(pad.axes?.[1]);
    if (held.some((h, i) => h && !previous[i]) || Math.hypot(x, z) > 0.2) {
      wasUsed = true;
      wake();
    }
    const releasedWheel = released(4);
    previous = held;
    if (edge(9)) {
      pause();
      return empty();
    }
    const screen = menu();
    if (screen) {
      if (edge(1)) {
        back();
        return empty();
      }
      if (screen === "wheel") {
        if (Math.hypot(x, z) > 0.35) wheel.point(x, z);
        if (releasedWheel) {
          wheel.release();
          return empty();
        }
      }
      let direction = held[12]
        ? "up"
        : held[13]
          ? "down"
          : held[14]
            ? "left"
            : held[15]
              ? "right"
              : Math.max(Math.abs(x), Math.abs(z)) < 0.5
                ? null
                : Math.abs(x) > Math.abs(z)
                  ? x < 0
                    ? "left"
                    : "right"
                  : z < 0
                    ? "up"
                    : "down";
      if (
        screen === "wheel" &&
        Math.hypot(x, z) > 0.35 &&
        !held.slice(12, 16).some(Boolean)
      )
        direction = null;
      if (direction && (direction !== repeatDirection || now >= repeatAt)) {
        move(direction);
        repeatAt = now + (direction === repeatDirection ? 140 : 360);
      }
      repeatDirection = direction;
      const right = stickAxis(pad.axes?.[3]);
      if (right) scroll(right * 12);
      if (edge(0)) confirm();
      return empty();
    }
    repeatDirection = null;
    if (edge(4)) {
      action("wheel");
      return empty();
    }
    if (edge(8)) {
      action("map");
      return empty();
    }
    if (edge(0)) action("jump");
    if (edge(1)) action("interact");
    if (edge(3)) action("revive");
    return {
      x,
      z,
      run: held[5] || held[10],
      brake: held[6],
      attack: held[2] || held[7],
    };
  }
  return { poll };
}
