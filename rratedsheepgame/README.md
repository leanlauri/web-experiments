# R-rated Sheep — independent Sheep game copy

A self-contained Three.js meadow with twelve grazing sheep. Approach within 2.65 units to recruit a sheep. Followers combine attraction to the shepherd with separation, alignment, and cohesion; they use low hops for small logs, route through fence gates and steer around buildings, trunks and other animals. The shepherd can jump over logs and fences, or land on them. The countryside extends beyond the meadow with no invisible perimeter walls; ground follows the player as they explore. Barn walls and every tree trunk have solid colliders.

WASD / arrow keys move relative to the camera, Space jumps, Shift runs. Walking and running are 40% faster than the initial version (5.18 and 8.4 units/second). Touch devices have an analog thumbstick (drag farther to walk faster) and a jump button. Start afresh resets the flock.

Public files are in `public/`, including Three.js 0.170.0 and its MIT license. No CDN or build step is needed at runtime.

After every change, run `bash rratedsheepgame/deploy.sh` from the repository root. This synchronizes only public game assets and verifies nginx serves the same HTML. Future coding agents must follow `AGENTS.md`, matching Linusgame's deployment convention.

Published at http://localhost/web-experiments/rratedsheepgame/ (replace localhost with this host's address for other devices). The repository-wide local deployment script also includes this project.

Collision and jump checks: `node rratedsheepgame/tests/physics.cjs`.

Browser smoke check: `node rratedsheepgame/tests/smoke.cjs` (uses the Playwright installation at `/home/lauri/node_modules/playwright-core`).

## The evening journey

Start in Clover Meadow, recruit twelve sheep by approaching them, and follow the sandy path north to Evening Farm, about 400 metres away. The map shows the flock, your position and the destination; the compass points toward the open farmhouse doorway. Approach the farmhouse and wait while the flock enters. Each sheep must actually cross the doorway to count as sheltered. Bringing all twelve inside completes the journey and brings on night. There is no time-limit failure; you can explore and collect stragglers at your own pace.

`landscape.js` defines a seeded, reproducible land-use plan: connected roads, a starting pasture, two forests, a pond, crop and flower fields, an orchard farm, a village, a residential lane, a livestock pasture and the destination farm. `countryside.js` decorates those parcels according to their use, reserving the main footpath, keeping trees off roads and leaving gaps in field fences. Static scenery uses instanced meshes to keep rendering affordable. Buildings and trunks remain solid; the pond has a blocked shoreline.

Residents stroll around farms and homes; cows, pigs, deer and rabbits wander their habitats. Cars run in separate opposing lanes. Traffic can knock the shepherd and sheep into recoverable cartoon tumbles. Ambient animals have moving collision bodies and avoid scenery and one another. Clouds drift and weather cycles over three minutes through sunshine, cloud, rain and clearing; the light gradually approaches evening, with night after success. Faraway sheep follow the shepherd's recorded trail instead of cutting directly across parcels.

`node rratedsheepgame/tests/journey.cjs` checks world populations, recruitment, the entire route with actual flock simulation, entry of all twelve sheep, victory, weather and reset. It accelerates simulation through a test-only browser route; no gameplay cheats are published.


The expanded region is 525 × 535 metres, with 29 non-overlapping land-use parcels and eight connected road segments. The western hamlet, eastern village and cottages connect to orchards, livestock farms, several lakes and larger woodland stands. Road/path reservations cut gates into all four sides of field fences. Roofs use closed gable prisms whose eaves meet the wall tops exactly. Ground colors, streets, paths and farm drives are tessellated into a single surface, eliminating competing coplanar overlays; collision queries use spatial buckets for the larger world.

`node rratedsheepgame/tests/layout.cjs` checks map size, parcel separation, roof heights and road surface precedence. The browser journey test also checks every generated fence against roads and completes the longer trip with all twelve sheep.


Terrain now uses a continuous, low-frequency height field in `public/terrain.js`, with smooth normals and a finely sampled mesh. The same height function drives shepherd/sheep ground contact, jumping and landings, elevated obstacle colliders, scenery, residents, vehicles, and camera tracking. Foundation pads and pond surfaces remain level with soft transitions back into the hills; gardens, fields and roads follow the landscape. No giant standalone hill objects are used. `node rratedsheepgame/tests/terrain.cjs` checks height variation, grade bounds, level foundations/water, ground-following movement and jump landings on slopes.


Every sheep, cow, pig, deer, rabbit and duck has a live circular collision body shared with the shepherd and residents. Cows alternate grazing with slow ambling; pigs root and explore; deer graze and flee nearby players; rabbits make short hopping runs; ducks swim within their pond. Individuals use independent phases and destinations, and distant animals continue at a reduced update frequency. Sheep hops are restricted to low logs (up to 0.65 m), with an impulse below fence height. Fences remain solid to sheep even during a log hop. A local path search finds gates or routes around barriers when the shepherd crosses a fence. `node rratedsheepgame/tests/animals.cjs` checks profiles, moving-body collisions, log-only hops and gate routes; the browser journey test additionally exercises a sheep going through a real meadow gate without jumping.


Sheep avoidance commits to a passing side instead of choosing left/right afresh each frame. Active paths keep their waypoints until the destination changes substantially or movement stalls; narrow routes reduce competing flock forces. Resting-distance hysteresis prevents repeated starts and stops near the shepherd. Facing and leg animation follow actual collision-resolved movement, with bounded turning speed. `node rratedsheepgame/tests/steering.cjs` checks progress and direction stability at a meadow gate, a tree, a slightly moving animal and flock arrival.


Cars have moving rectangular collision bodies. Swept relative-motion checks catch contacts with the shepherd and unsheltered sheep; traffic wrapping at road ends never creates a collision sweep across the map. Impacts apply an airborne impulse and angular spin, with floppy limb animation, terrain/scenery collision, small landing bounces and ground drag. After stopping briefly, the character rights itself, resumes normal control or flock following, and keeps circling confusion stars for two seconds. A short recovery immunity prevents repeated launches. Reset clears tumbles and stars, and sheltered sheep are excluded from traffic. `node rratedsheepgame/tests/impacts.cjs` checks body collision, swept contacts and misses, impacts in both traffic directions, recovery, confusion expiry, flock membership and reset.


This project is an independent copy of the current Sheep game. Finish changes with `bash ./finish.sh "Describe the change"` from this directory to verify deployment and commit this project alone.
