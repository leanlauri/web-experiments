import assert from "node:assert/strict";
import { createController, stickAxis } from "../public/controller.js";
assert.equal(stickAxis(0.15), 0);
assert.equal(stickAxis(-0.2), 0);
assert.equal(stickAxis(1), 1);
assert.equal(stickAxis(-1), -1);
let pad = {
    index: 0,
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  },
  screen = null,
  events = [];
const controller = createController({
  getPads: () => (pad ? [pad] : []),
  menu: () => screen,
  pause: () => {
    events.push("pause");
    screen = screen ? null : "menu";
  },
  back: () => events.push("back"),
  confirm: () => events.push("confirm"),
  move: (d) => events.push(d),
  scroll: (n) => events.push(["scroll", n]),
  wheel: {
    point: (x, z) => events.push(["point", x, z]),
    release: () => events.push("release"),
  },
  action: (a) => events.push(a),
  wake: () => {},
  disconnect: () => events.push("disconnect"),
});
const button = (i, value) => {
  pad.buttons[i] = { pressed: value, value: Number(value) };
};
controller.poll(0);
button(9, true);
controller.poll(10);
controller.poll(20);
assert.deepEqual(events, ["pause"], "held Start must not toggle repeatedly");
button(9, false);
controller.poll(30);
events = [];
button(13, true);
controller.poll(40);
controller.poll(100);
controller.poll(399);
assert.deepEqual(events, ["down"]);
controller.poll(401);
assert.deepEqual(events, ["down", "down"]);
button(13, false);
controller.poll(410);
button(0, true);
controller.poll(420);
controller.poll(430);
assert.equal(events.filter((e) => e === "confirm").length, 1);
button(0, false);
controller.poll(440);
button(1, true);
controller.poll(450);
assert(events.includes("back"));
button(1, false);
controller.poll(460);
screen = "wheel";
events = [];
button(4, true);
pad.axes = [1, 0, 0, 0];
controller.poll(500);
assert(events.some((e) => Array.isArray(e) && e[0] === "point"));
assert(
  !events.includes("right"),
  "radial stick does not also step the selection",
);
button(4, false);
controller.poll(510);
assert(events.includes("release"));
screen = null;
events = [];
pad.axes = [0.1, -1, 0, 0];
button(2, true);
button(5, true);
button(6, true);
let state = controller.poll(600);
assert.equal(state.x, 0);
assert.equal(state.z, -1);
assert(state.run && state.brake && state.attack);
button(0, true);
controller.poll(610);
assert(events.includes("jump"));
pad = null;
controller.poll(620);
controller.poll(630);
assert.equal(
  events.filter((e) => e === "disconnect").length,
  1,
  "disconnect pauses once",
);
console.log(
  "PASS: stick deadzone, Start edges, menu repeat, confirm/back, radial selection/release, gameplay controls and disconnect.",
);
