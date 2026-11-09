# Tappy’s Supermarket

A cozy static canvas game starring a smiling tap. Collect eight groceries, dodge shopping carts, splash to stun nearby carts, and bring the full basket to checkout. Customers push trolleys and pause to browse. Splashing customers or splashing in the shopkeeper’s sight raises suspicion. Shelves block sight; suspicion cools after four quiet seconds. At 60% suspicion the shopkeeper walks faster and catches you if you get too close. Three hearts, no time limit, and a fresh run whenever you want.

Play at http://localhost/web-experiments/tapgame/.

Use arrow keys or WASD to move, Space to splash, and P or Escape to pause. Drag the thumbstick to move in any direction; drag farther to walk faster. Release it to stop. The splash button works alongside the stick. The game pauses when the window loses focus.

Browser files live in `public/`; no build step or runtime dependencies are needed. Google Fonts are optional, with local font fallbacks.

Check with `node --check public/game.js` and `node tests/game.cjs`.

After changes, run `bash ./finish.sh "Describe the change"` from this directory. It deploys public assets, verifies nginx serves the page, and commits only this project. `deploy.sh` is also available for deployment alone.
