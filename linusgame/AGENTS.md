# Game development instructions

- Keep browser-served game files in `public/`. This starts as a static HTML project.
- After every modification to the game, run `bash ./deploy.sh` from this project before marking the work complete. Deployment is part of every game change, not an optional follow-up.
- The script copies `public/` to `/var/www/html/web-experiments/linusgame/`, served by this host's nginx on port 80 at `http://localhost/web-experiments/linusgame/`. It removes stale files only inside that game's deployment directory and verifies the served HTML matches the source.
- Deploy only public game assets; keep instructions, scripts, credentials, and development files outside `public/`.
- Preserve other nginx sites and files. No nginx reload is needed for static file changes.
- If deployment or verification fails, resolve the failure when possible and report any unresolved problem clearly. Do not claim the game is deployed without successful verification.
