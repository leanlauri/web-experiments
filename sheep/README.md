# Sheep — Little Pastures

A self-contained Three.js meadow with twelve grazing sheep. Approach within 2.65 units to recruit a sheep. Followers combine attraction to the shepherd with separation, alignment, and cohesion; they automatically hop over the three low logs. The shepherd collides with logs unless jumping. The pasture has soft boundaries at its fences.

WASD / arrow keys move relative to the camera, Space jumps, Shift runs. Touch devices have an analog thumbstick (drag farther to walk faster) and a jump button. Start afresh resets the flock.

Public files are in `public/`, including Three.js 0.170.0 and its MIT license. No CDN or build step is needed at runtime.

After every change, run `bash sheep/deploy.sh` from the repository root. This synchronizes only public game assets and verifies nginx serves the same HTML. Future coding agents must follow `AGENTS.md`, matching Linusgame's deployment convention.

Published at http://localhost/web-experiments/sheep/ (replace localhost with this host's address for other devices). The repository-wide local deployment script also includes this project.

Browser smoke check: `node sheep/tests/smoke.cjs` (uses the Playwright installation at `/home/lauri/node_modules/playwright-core`).
