# Little Pastures — The Great Moon Heist

An independent, child-friendly 3D farm-heist adventure. Open **http://localhost/web-experiments/rratedsheepgame/** after deployment. It is a static Three.js project with no build step, CDN, or runtime network dependencies. The original `sheep/` project is separate.

## Adventure

Begin in Clover Meadow with twelve sheep. Walk close to recruit them and lead them north into the gold circle at your little home farm. Once all twelve arrive, the backyard rocket workshop opens, with $60, enough for the $50 foam pistol, and a free seven-seat van (six seats available for animals).

The 920 × 920 m region has a 236 × 212 m central town with 48 larger, street-aligned buildings: houses, signed shops, gas stations and warehouses. Country approaches meet the outer grid intersections at right angles, with their bends outside town. Residential blocks have front yards and paths, central blocks have shops facing the streets, and the outer blocks include warehouse yards and service stations. Ten grid streets connect the blocks with sidewalks and building-aware herd routes. The atlas offers Region and Town streets views, and the minimap follows the player with a nearby view and an edge marker for home. Six large faction farms connect to town by road. Six rivers divide the outer farms, with their headwaters outside town; the town street grid connects the counties. Farm gates face town. Sunflower Union raises sheep, Rosewood Riders pigs, Bluebell Dairy cows, Copper Carrot Co. rabbits, Mint Meadow goats, and Violet Valley alpacas. Each has its own colors, guard temperament and weapon preference.

Recruit one species per trip. Followers keep a loose three-column formation with separation sized to the species: cows need more room than rabbits. A vehicle reserves one seat for the driver and one for each animal. Nearby conscious followers board automatically; overflow follows on foot. Forty-eight traffic vehicles follow continuous closed routes along all six farm roads and the rectangular town streets. Farm-end turns use smooth curves; cars keep their heading through route seams, slow for corners, follow queues and yield when merging. Their vehicles can be hijacked. Stealing an occupied moving vehicle ejects its driver into a nonlethal tumble; drivers recover and flee. The former inner and outer circular roads have been removed. Your own van is free to use without committing a vehicle crime.

Animal theft, vehicle theft and weapon use raise wanted stars. At one wanted star, police pursue on foot at walking pace and never shoot. Higher wanted levels add faster officers with foam projectiles and marked patrol cars. At lower levels, patrol cars drive toward the scene and drop off officers. At three or more stars, car units keep pursuing a driven vehicle, flank it, and steer into its side using the existing collision physics. Four and five stars can periodically send pairs of cars ahead to drive into roadblock positions and deploy officers; they do not teleport into place. Parked patrol cars can be hijacked. Keep more than 33 m from every conscious police officer for 12 uninterrupted seconds to lose one star; repeat until clear. Reaching home clears wanted stars, stops police and farmer pursuit, and restores hearts. Taking animals also dispatches faction-colored cars, pickups, trucks and tractors from that farm. Farmers pursue independently of wanted stars until you reach home; they try to intercept vehicles and dismount near players on foot.

Stop inside the home farm to unload. Animals leave the vehicle one at a time, walk around it, queue through the open barn gate, and enter the barn before they count. Followers on foot join the same queue. A completed delivery earns $8 per conscious animal and permanent rocket credit. Every other animal from a big farm, including lost and unconscious animals, resets to its original location. Successful trips increase guard numbers, armor, pursuit speed and firing frequency; later upgrades narrow gates and add fence rails. Difficulty caps at eight defense tiers.

Cars have oriented solid colliders matched to their body sizes, swept collision checks and mass-dependent linear and angular impulse response, contact friction and persistent post-crash motion. Glancing hits cause spin; parked cars slide after being struck, and traffic rejoins its lane after settling instead of discarding the impulse. They block one another and pedestrians; traffic pauses and rejoins its existing route after a crash. Each vehicle has its own hull health. Bullets hit vehicle hulls before occupants, so the player and boarded animals are protected. Hard crashes and bullets damage the hull. At 20% health or lower, flames and smoke appear and an irreversible five-second gameplay-time fuse starts. The driving HUD shows hull percentage and the fire countdown; use E / Exit to get out. A blast destroys the car, ejects its occupants, and applies distance-based damage and flight impulses to nearby vehicles and characters within 16 m. Other damaged cars can ignite, with their own full five-second fuse. Wrecks become black crushed shells with all wheels and intact bodywork removed, stay undrivable and remain solid, and blasts keep the existing nonlethal ragdoll/recovery and jail rules. Vehicle hits send people, the player and animals through airborne cartoon tumbles with floppy limbs, a short get-up animation and orbiting stars. Traffic victims recover automatically after settling, with two seconds of stars and impact protection afterward. Wake-up snacks can revive animals sooner. Animals knocked out by weapons still need snacks or a home reset.

All combat is nonlethal. Guards and police knocked out by a weapon stay down for sixty seconds (five times the previous duration); the player's recovery time is unchanged. Animals knocked out by projectiles need wake-up snacks (R nearby) or reset when you return home; traffic tumbles also recover automatically. Snacks cost $15 per three; the opening journey replenishes a minimum of three at home to prevent getting stuck. Start with five hearts and buy an upgrade to six; older saves with fewer hearts migrate to five. A knockout costs one heart and briefly stuns the player. At zero, spend five seconds in jail, lose the current herd, then return home healed.

Start with a visible cushion club. Buy a foam bat, $50 foam pistol, bubble wand, foam blaster or pillow launcher. Held models change with the equipped item. Ranged attacks plant the character’s feet for 0.28 seconds of aiming, followed by a short recoil pause. Both player and enemy weapons raise their arms, recoil, and show a bright muzzle flash. All projectiles travel at 90 m/s with swept scenery/entity collision checks. Enemies hold fire if a teammate is in the line of fire; a teammate who moves into an already fired shot still takes normal damage. Melee swings, foam trails and hit flinches show each action. Melee attacks target the nearest opponent in reach; projectiles auto-aim at the nearest opponent in range and can hit animals along their path. Buildings stop projectiles. Five rocket parts unlock at 12, 20, 30, 42 and 56 cumulative animal deliveries. These credits are not consumed. The home farm has a permanent marked launch pad, gantry and wireframe outline of missing rocket stages; purchased parts replace their outlines with solid construction. Install each part at home, then launch to see the rocket orbiting the Moon as the credits roll.

## Controls

- On foot: WASD / arrows move relative to the camera; Shift runs; Space jumps.
- Driving: the same camera-relative WASD / arrows or joystick directions aim and accelerate the car toward your destination. The body turns smoothly, but velocity carries through turns and tire grip gradually redirects it. Release to coast; hold Space / Brake to stop. Hard braking and sharp turns break traction and leave paired rear-tire marks that fade after eight seconds. Grass has lower grip and speed; heavier vehicles accelerate and turn more slowly. Exiting at 8 m/s or less applies the parking brake. Above 8 m/s, the car coasts onward and the player performs a short harmless roll with no lost hearts or recovery stars.
- E: enter the nearest vehicle within 6 m, or exit with passengers.
- F: use equipped weapon/item. Hold Q to open the paused radial equipment wheel; point at an owned item and release Q, or tap it. Arrow keys and Enter also select; Escape cancels. Wake-up snacks can be equipped alongside weapons.
- R: revive an animal within 7 m; B: home workshop. Walking through the open doorway of your house also opens the shop; the roof cuts away while you are inside.
- Escape / pause icon: pause or resume; inside a menu, Escape goes back. M: region map and faction guide. Mouse wheel: zoom.
- Menus: D-pad / left stick or arrow keys / WASD navigate; A / Enter selects; B / Escape goes back. Selected options have a gold highlight. Tab stays inside the active screen. Right stick or Page Up / Down scrolls. Child screens return to their parent with the previous selection restored. Restart uses an in-game confirmation.
- Standard controller: left stick moves, A jumps, B rides/exits, X / RT uses the equipped item, Y revives, hold LB for the radial wheel and release to select, RB or L3 runs, LT brakes, View opens the map, Start pauses/resumes. Menus work entirely through the controller. Controller disconnect, window blur and tab switching pause the game.
- Touch: analog joystick and Jump, Ride and Bonk buttons. Map opens Region/Town views; Items opens the radial wheel; Menu pauses the game and shows mission/rocket progress, equipment, Revive, Home shop, the item wheel, sound toggle, help and restart. The compact HUD shows hearts, cash, active wanted stars and herd/home distance. The large mission card is hidden on every screen size; mission details remain in Menu.

The pause screen, workshop, help, map, confirmation and equipment wheel freeze the entire simulation, including traffic, pursuit, projectiles and fire fuses. The home area protects the player. Local progress is saved at home and after purchases. Reload resumes from the last home checkpoint. Trips in progress are not saved. New adventure replaces the local save after confirmation.

## Implementation and performance

`public/index.html`, `style.css` and `adventure.js` provide controls, HUD, map, workshop and local saves. `menus.js` manages the screen stack, focus trapping and stable selection; `controller.js` polls standard gamepads with a stick deadzone, button edges and menu repeat. Menus use a shared console style with short labels and a selection rail. The atlas uses numbered faction markers and one selected-farm caption instead of paragraphs. Help is split into short Controls, Heists and Wanted cards. `vehicles.js` shares nine vehicle profiles across handling, mass, collision size, models, seating and sound: dune buggy, hatchback, herd van, county bus, pickup, sports coupe, electric city car, livestock truck and tractor. Vehicle top speeds are roughly 18% higher; patrol cars have stronger acceleration and more mass. `audio.js` synthesizes distinct engines and action sounds through WebAudio after the first user gesture, limits nearby engines to three voices, and mutes when hidden or paused. Sound can be toggled in Menu. `wheel.js` and `equipment.js` handle the radial selector and held/animated equipment. `combat.js` handles aim timing and enemy firing discipline; `civilians.js` handles ejected drivers; `delivery.js` routes animals through the barn gate; `farmers.js` manages vehicle pursuit by farm factions. `herding.js` controls flock formations and separation; `police.js` handles patrol dispatch, driving and disembarking. `traffic.js` defines arc-length sampled traffic routes and following/merge behavior. `vehicle-motion.js` integrates persistent vehicle velocity, spin, gravity and static impacts; `vehicle-damage.js` defines hull damage and fire timing. `driving.js` simulates directional steering, independent planar momentum, tire traction, braking and solid vehicle collisions. `skidmarks.js` records bounded tire trails with an eight-second lifetime; the renderer draws them in one instanced call with per-segment fading. The camera tracks ground position during jumps. Shop prices remain visible as separate labels, including on unaffordable or owned items. `simulation.js` owns gameplay state independently of rendering. `region.js` defines the shared map, collision shapes, roads, rivers and farm gates. `world.js` renders the world and Moon sequence with the locally vendored Three.js.

`scenery.js` supplies deterministic tree placements and indexed prop colliders to both simulation and rendering. Collision queries use nearby 16 m prop cells and 64 m tree chunks, independent of the camera; tree placement caches are bounded by the finite map. The renderer maintains at most 49 nearby 64 m scenery chunks. Trees use instanced meshes; departing chunks are removed and their instance resources disposed. Actors beyond 150 m are hidden, distant ambient animals and guards skip AI movement, and static geometry uses frustum culling. Actor meshes and geometry/materials are reused; no remote assets are streamed. The map remains lightweight simulation data. The view is fog-limited with adjustable zoom and capped pixel density. Buildings, farm fences, water and region boundaries block movement. Tree trunks, flagpoles, crates, workshop counters, rocket stands and gantries, fuel pumps, and canopy supports share solid colliders with their rendered geometry. Cars use full oriented hull tests against trunks and props, including height clearance; hard impacts damage the hull. Projectiles and melee swings stop at solid scenery. Built rocket stages gain colliders while their wireframe previews stay intangible. Grass, crop leaves, tree foliage and flat ground markings remain walkable. Trees stay clear of roads and farm entrances, and followers use local detours around trunks.

The previous countryside implementation and its standalone physics tests remain in the project as reference modules; they are not loaded by this new entry point. Old journey/layout browser assertions describe the former map. The active adventure checks below cover the replacement game. Published diagnostics expose read-only state, with no gameplay teleport or progression cheats.

Performance settings are available in the pause menu through **Graphics: Auto / Low / High**, using touch, keyboard or controller. Auto starts phones at a 30 FPS rendering target and adapts resolution under load; High targets 60 FPS. Physics continues at 60 Hz in every preset. Low uses fewer tree chunks and projectile trails. Returning to High restores the larger scenery budget. The selection is saved separately from game progress.

Nearby traffic, stolen cars, crashes and pursuits keep full physics. Ordinary traffic outside 210 m plans at 10 Hz with continuous movement between plans; it returns to full detail within 180 m, before becoming visible. Spatial grids narrow collision candidates while retaining exact shapes and swept contacts. Static scenery and fences are instanced by material and region. Hidden models leave the scene immediately, with only 24 (Low) or 48 (High) recently used inactive models retained, for at most 20 seconds of game time. Projectile visuals are pooled. Paused and hidden scenes stop continuous drawing; long stalls cannot request more than four simulation steps in one frame.

## Verification and deployment

Run from the repository root:

```sh
node rratedsheepgame/tests/performance.mjs
node rratedsheepgame/tests/performance.mjs --benchmark
node rratedsheepgame/tests/performance-browser.cjs
node rratedsheepgame/tests/town-layout.mjs
node rratedsheepgame/tests/city-action.mjs
node rratedsheepgame/tests/city-action-browser.cjs
node rratedsheepgame/tests/scenery.mjs
node rratedsheepgame/tests/scenery-browser.cjs
node rratedsheepgame/tests/controller.mjs
node rratedsheepgame/tests/menus-browser.cjs
node rratedsheepgame/tests/home-police.mjs
node rratedsheepgame/tests/home-police-browser.cjs
node rratedsheepgame/tests/expansion.mjs
node rratedsheepgame/tests/traffic.mjs
node rratedsheepgame/tests/vehicle-damage.mjs
node rratedsheepgame/tests/vehicle-impacts.mjs
node rratedsheepgame/tests/driving.mjs
node rratedsheepgame/tests/adventure.mjs
node rratedsheepgame/tests/adventure-browser.cjs
node rratedsheepgame/tests/driving-browser.cjs
node rratedsheepgame/tests/vehicle-damage-browser.cjs
node rratedsheepgame/tests/vehicle-impacts-browser.cjs
node rratedsheepgame/tests/traffic-browser.cjs
node rratedsheepgame/tests/expansion-browser.cjs
node rratedsheepgame/tests/expansion-visuals.cjs
```

The adventure simulation check covers the six roads and bridges, opening journey, one-species rule, capacity, theft, revival, payouts, resetting lost animals, wanted decay, jail, upgrades, defense scaling, save/load, collisions, friendly fire and the rocket ending. It walks actual flock simulations through all six farm gates and town to home.

The menu checks exercise keyboard-only routes and an emulated standard gamepad through the actual browser Gamepad API, frozen gameplay time, shop focus after purchases, the restart confirmation, input repeat, controller disconnect, and portrait/landscape touch layouts.

The browser check uses `/home/lauri/node_modules/playwright-core` and loads the deployed nginx site directly, including checks for JavaScript module response types. Deploy before running it. Pass `--source` to test unpublished source with intercepted requests instead. It checks rendering, keyboard movement/jump, the atlas, checkpoint restoration, workshop purchases, launch, credits, restart, desktop/mobile layouts and console errors. Screenshots go to `/tmp/rratedsheepgame-*.png`.

Finish changes from this project directory with:

```sh
bash ./finish.sh "Describe the change"
```

This deploys `public/` to `/var/www/html/web-experiments/rratedsheepgame/`, verifies nginx serves the source HTML, and commits only this project. No push is performed.
