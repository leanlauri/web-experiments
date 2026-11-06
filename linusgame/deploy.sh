#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
destination="/var/www/html/web-experiments/linusgame"

# Only public game files are deployed. Keep this project's server copy in sync.
sudo -n mkdir -p "$destination"
sudo -n rsync -rlt --delete --chmod=D755,F644 "$project_dir/public/" "$destination/"
curl --fail --silent --show-error http://localhost:80/web-experiments/linusgame/ | cmp -s "$project_dir/public/index.html" -
printf 'Deployed and verified: http://localhost/web-experiments/linusgame/\n'
