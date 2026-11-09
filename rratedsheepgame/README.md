# Little Pastures — The Great Moon Heist

An independent, child-friendly 3D farm-heist adventure. Open **http://localhost/web-experiments/rratedsheepgame/** after deployment. It is a static Three.js project with no build step, CDN, or runtime network dependencies. The original `sheep/` project is separate.

## Adventure

Begin in Clover Meadow with twelve sheep. Walk close to recruit them and lead them north into the gold circle at your little home farm. Once all twelve arrive, the backyard rocket workshop opens, with $25 and a free seven-seat van (six seats available for animals).

The 920 × 920 m region has a central town and six large faction farms connected by roads. Six rivers divide the outer farms; the town ring road bridges the rivers. Farm gates face town. Sunflower Union raises sheep, Rosewood Riders pigs, Bluebell Dairy cows, Copper Carrot Co. rabbits, Mint Meadow goats, and Violet Valley alpacas. Each has its own colors, guard temperament and weapon preference.

Recruit one species per trip. A vehicle reserves one seat for the driver and one for each animal. Nearby conscious followers board automatically; overflow follows on foot. Traffic continually runs on the six main roads, and its vehicles can be hijacked. Your own van is free to use without committing a vehicle crime.

Animal theft, vehicle theft and weapon use raise wanted stars. Police pursue on foot and fire foam projectiles. Keep more than 33 m from every conscious police officer for 12 uninterrupted seconds to lose one star; repeat until clear. Home prevents hostile shots and restores hearts, but does not erase a police search.

Stay at home for four seconds to settle a trip. Conscious animals inside the home area or riding in your vehicle earn $8 each and permanent rocket credit. Every other animal from a big farm, including lost and unconscious animals, resets to its original location. Successful trips increase guard numbers, armor, pursuit speed and firing frequency; later upgrades narrow gates and add fence rails. Difficulty caps at eight defense tiers.

All combat is nonlethal. Guards and police wake after twelve seconds. Animals knocked out by traffic or projectiles need wake-up snacks (R nearby) or reset when you return home. Snacks cost $15 per three; the opening journey replenishes a minimum of three at home to prevent getting stuck. Start with three hearts and buy upgrades to six. A knockout costs one heart and briefly stuns the player. At zero, spend five seconds in jail, lose the current herd, then return home healed.

Buy a cushion club, foam bat, bubble wand, foam blaster and pillow launcher. Melee attacks target the nearest opponent in reach; projectiles auto-aim at the nearest opponent in range and can hit animals along their path. Buildings stop projectiles. Five rocket parts unlock at 12, 20, 30, 42 and 56 cumulative animal deliveries. These credits are not consumed. Install each part at home, then launch to see the rocket orbiting the Moon as the credits roll.

## Controls

- WASD / arrows: camera-relative movement. Shift: run. Space: jump.
- E: enter the nearest vehicle within 6 m, or exit with passengers.
- F: use equipped weapon; Q: cycle owned weapons.
- R: revive an animal within 7 m; B: home workshop.
- M: region map and faction guide. Escape: close a panel. Mouse wheel: zoom.
- Touch: analog joystick and Jump, Ride, Bonk, Revive, Shop and Weapon buttons.

The help and region-map panels pause the simulation. The workshop stops player movement; the home area protects the player. Local progress is saved at home and after purchases. Reload resumes from the last home checkpoint. Trips in progress are not saved. New adventure replaces the local save after confirmation.

## Implementation and performance

`public/index.html`, `style.css` and `adventure.js` provide controls, HUD, map, workshop and local saves. `simulation.js` owns gameplay state independently of rendering. `region.js` defines the shared map, collision shapes, roads, rivers and farm gates. `world.js` renders the world and Moon sequence with the locally vendored Three.js.

The renderer maintains at most 49 nearby 64 m scenery chunks. Trees use instanced meshes; departing chunks are removed and their instance resources disposed. Actors beyond 150 m are hidden, distant ambient animals and guards skip AI movement, and static geometry uses frustum culling. Actor meshes and geometry/materials are reused; no remote assets are streamed. The map remains lightweight simulation data. The view is fog-limited with adjustable zoom and capped pixel density. Buildings, farm fences, water and region boundaries block movement; decorative trees and crops do not.

The previous countryside implementation and its standalone physics tests remain in the project as reference modules; they are not loaded by this new entry point. Old journey/layout browser assertions describe the former map. The active adventure checks below cover the replacement game. Published diagnostics expose read-only state, with no gameplay teleport or progression cheats.

## Verification and deployment

Run from the repository root:

```sh
node rratedsheepgame/tests/adventure.mjs
node rratedsheepgame/tests/adventure-browser.cjs
```

The first checks the six roads and bridges, opening journey, one-species rule, capacity, theft, revival, payouts, resetting lost animals, wanted decay, jail, upgrades, defense scaling, save/load, collisions, friendly fire and the rocket ending. It walks actual flock simulations through all six farm gates and town to home.

The browser check uses `/home/lauri/node_modules/playwright-core` and loads the deployed nginx site directly, including checks for JavaScript module response types. Deploy before running it. Pass `--source` to test unpublished source with intercepted requests instead. It checks rendering, keyboard movement/jump, the atlas, checkpoint restoration, workshop purchases, launch, credits, restart, desktop/mobile layouts and console errors. Screenshots go to `/tmp/rratedsheepgame-*.png`.

Finish changes from this project directory with:

```sh
bash ./finish.sh "Describe the change"
```

This deploys `public/` to `/var/www/html/web-experiments/rratedsheepgame/`, verifies nginx serves the source HTML, and commits only this project. No push is performed.
