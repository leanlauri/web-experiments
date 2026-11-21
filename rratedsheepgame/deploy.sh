#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
destination="/var/www/html/web-experiments/rratedsheepgame"

# Only public game files are deployed. Keep this project's server copy in sync.
sudo -n mkdir -p "$destination"
sudo -n rsync -rlt --delete --chmod=D755,F644 "$project_dir/public/" "$destination/"
curl --fail --silent --show-error http://localhost:80/web-experiments/rratedsheepgame/ | cmp -s "$project_dir/public/index.html" -
# Module scripts require a JavaScript MIME type; a successful download alone is insufficient.
for asset in spatial.js quality.js adventure.js simulation.js region.js world.js driving.js skidmarks.js vehicle-collisions.js tumbles.js traffic.js vehicles.js equipment.js wheel.js audio.js vehicle-motion.js vehicle-damage.js herding.js police.js menus.js controller.js scenery.js combat.js civilians.js delivery.js farmers.js vendor/three.module.js; do
  mime="$(curl --fail --silent --show-error -o /dev/null -w '%{content_type}' "http://localhost:80/web-experiments/rratedsheepgame/$asset")"
  case "$mime" in
    application/javascript*|text/javascript*|application/ecmascript*|text/ecmascript*) ;;
    *) printf 'Invalid module content type for %s: %s\n' "$asset" "$mime" >&2; exit 1 ;;
  esac
done
printf 'Deployed and verified: http://localhost/web-experiments/rratedsheepgame/\n'
