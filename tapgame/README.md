# Tappy’s Wash Shop · 3D

A static WebGL game in a stationery and electronics shop. Play as a tiny chrome tap with eyes, rosy cheeks, and a smile. Four customers bring a notebook, pencils, pens, and headphones to wash stations. Walk near each station and hold Wash or Space to clean the item. Dirt fades as water sprays, customers leave happy, and returning to the green service mat after all four jobs completes the day.

Play at http://localhost/web-experiments/tapgame/.

## Controls

- Arrow keys / WASD, or drag the thumbstick: move. A gentle drag moves more slowly.
- Hold Space or the Wash button: spray water. Stick and Wash support separate simultaneous touches.
- P / Escape or the pause button: pause and resume. Switching away also pauses and releases held controls.
- View shop / Follow Tappy: switch between a whole-store perspective and a following camera.

Washing customer items is welcome. Spraying away from the stations raises the patrolling shopkeeper’s suspicion. Suspicion cools down after three quiet seconds. Reaching 100% ends the run; restart to try again. No time limit.

The scene includes modeled stock, customer belongings, people, shelves, wash tables, window glazing, tiled floors, reflective chrome, shadows, and a service desk. Repeated static meshes are instanced for rendering efficiency.

## Development

Keep browser files in `public/`; no build step, CDN, or external fonts are required. Three.js r160 is vendored in `public/vendor/` with its MIT license. `world.js` contains testable gameplay; `scene.js` builds and renders the 3D shop; `game.js` connects UI and input. WebGL graphics support is required.

Checks:

```sh
node --check public/game.js
node --check public/scene.js
node --check public/world.js
node tests/game.cjs
# Use an installed Playwright package; Chromium defaults to /usr/bin/chromium.
PLAYWRIGHT_MODULE=/path/to/playwright node tests/browser.cjs
```

After changes, run `bash ./finish.sh "Describe the change"` here. It deploys public assets, verifies nginx serves the page, and commits only this project. `deploy.sh` is available for deployment alone. Do not push unless requested.
