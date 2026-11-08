# beegame development instructions

- Keep browser-served game files in `public/`. This is a static project with no build step.
- After every completed change, run appropriate checks, then `bash ./finish.sh "Describe the change"` from this project before marking work complete. Deployment and automatic Git commit are required parts of each change.
- `finish.sh` runs `deploy.sh`, then stages and commits only this project's files. Keep unrelated changes and other projects out of the commit. Do not push unless the user requests it.
- `deploy.sh` synchronizes only `public/` to `/var/www/html/web-experiments/beegame/`, served by nginx at `http://localhost/web-experiments/beegame/`, and verifies the served HTML matches the source.
- Keep instructions, scripts, tests, credentials, and development files outside `public/`.
- Preserve other nginx sites and files. No nginx reload is needed for static changes.
- If verification, deployment, or commit fails, resolve it when possible and report anything unresolved. Do not claim deployment or commit succeeded without verification.
- This is an independent project. Do not edit the original Sheep game when working here.
