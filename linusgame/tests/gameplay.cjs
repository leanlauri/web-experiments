const vm = require('node:vm');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const handlers = {}, buttons = {};
const context = new Proxy({}, { get: (_, key) => key === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {} });
const element = () => ({ classList: { add() {}, remove() {} }, addEventListener() {}, textContent: '' });
const elements = Object.fromEntries(['#seeds', '#message', '#toast', '#restart', '#health', '#snakes', '#friends'].map(s => [s, element()]));
elements.canvas = { ...element(), getContext: () => context, getBoundingClientRect: () => ({ width: 1100, height: 650 }) };
for (const name of ['left', 'right', 'jump', 'spin']) buttons[name] = { ...element(), dataset: { control: name }, setPointerCapture() {}, addEventListener(type, fn) { this[type] = fn; } };
const sandbox = {
  window: { devicePixelRatio: 1, addEventListener(type, fn) { handlers[type] = fn; } },
  document: { querySelector: s => elements[s], querySelectorAll: s => s === '[data-control]' ? Object.values(buttons) : [] },
  requestAnimationFrame() {}, console,
};
// Expose state only inside this test VM; the deployed game keeps its private closure.
const source = fs.readFileSync(`${__dirname}/../public/game.js`, 'utf8').replace(/\}\)\(\);\s*$/, `globalThis.game = { update, draw, reset, hurt, get player(){return player}, get friends(){return friends}, get snakes(){return snakes}, get seeds(){return seeds}, get trail(){return trail}, get hearts(){return hearts}, get won(){return won}, get playDate(){return playDate}, get partyTime(){return partyTime} }; })();`);
vm.runInNewContext(source, sandbox);
const g = sandbox.game;
const press = code => handlers.keydown({ code, preventDefault() {}, repeat: false });
const release = code => handlers.keyup({ code });
const step = (n, dt = 1 / 60) => { for (let i = 0; i < n; i++) g.update(dt); };
function defeat(index) {
  g.player.x = g.snakes[index].x - 30;
  g.player.y = 461;
  g.player.spin = .48;
  step(1);
}

defeat(0);
assert.equal(g.friends.length, 1, 'one freed friend per defeated snake');
assert(g.snakes[0].carried, 'defeated snake stays in the basket');
step(30);
assert.equal(g.friends.length, 1, 'dead snakes cannot release duplicate souls');
// Walk and jump in clear ground, comparing the follower to the recorded delayed path.
g.player.x = 100;
press('KeyD'); press('Space'); press('KeyX');
step(30);
release('Space'); release('KeyX'); release('KeyD');
const expected = g.trail[g.trail.length - 24];
assert(Math.abs(g.friends[0].x - expected.x) < 6, 'friend replays horizontal movement');
assert(Math.abs(g.friends[0].y - expected.y) < 7, 'friend copies jump height');
assert(g.friends[0].spin > 0, 'friend copies spin animation');
assert.equal(g.friends[0].face, 1);
step(30);
press('KeyA'); step(35); release('KeyA');
assert.equal(g.friends[0].face, -1, 'friend copies direction changes');
for (let i = 1; i < 4; i++) defeat(i);
assert.equal(g.friends.length, 4);
g.player.x = 3200; g.player.y = 461; g.player.vx = 0; g.player.spin = 0;
step(10);
assert(!g.snakes.some(s => s.eaten), 'supper waits for trailing friends');
step(110);
assert(g.friends.every(f => f.home), 'whole procession arrives at the cave');
assert(g.snakes.every(s => s.homeSafe), 'all snakes delivered');
assert(!g.won, 'delivery alone does not win');
assert(!g.playDate, 'play date waits until supper is shared');
g.draw();
// Leaving the cave pauses the shared meal.
const before = g.snakes[0].meal;
g.player.x = 3000; step(60);
assert.equal(g.snakes[0].meal, before, 'player must join the supper');
g.player.x = 3200;
step(360);
assert(g.snakes.every(s => s.eaten), 'meal consumes the snakes');
assert(g.playDate, 'all reunited families start the play date even with bones still to find');
const partyStart=g.partyTime; step(30);
assert(g.partyTime>partyStart, 'play date keeps animating');
g.draw();
assert(!g.won, 'bones are still required');
for (const bone of g.seeds) bone.taken = true;
step(1);
assert(g.won, 'all friends, supper and bones complete the adventure');
g.draw();
g.reset();
assert.equal(g.friends.length, 0, 'restart clears rescued friends');
assert(!g.playDate, 'restart clears the play date');
assert.equal(g.partyTime, 0);
assert(g.snakes.every(s => s.alive && !s.eaten));
defeat(0);
g.player.x = 980; g.player.y = 800; step(1);
assert.equal(g.trail.length, 2, 'respawn clears unsafe recorded paths');
assert(Math.abs(g.friends[0].x - g.player.x) < 1, 'respawn reunites following friends');
g.reset();
buttons.jump.pointerdown({ pointerId: 1, preventDefault() {} }); step(1);
assert(g.player.vy < 0, 'touch jump still works');
buttons.jump.pointerup({ pointerId: 1 });
g.draw();
console.log('Passed: soul rescue, delayed movement/jump/spin/turn copying, cave arrival, shared supper, win conditions, reset, respawn, touch controls and rendering.');
