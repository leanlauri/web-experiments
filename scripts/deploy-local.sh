#!/usr/bin/env bash
# Build all experiments and publish them through the local Nginx web root.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
staging=$(mktemp -d)
trap 'rm -rf "$staging"' EXIT
cp index.html "$staging/"
for project_path in */; do
  project=${project_path%/}
  if [[ -f "$project/package.json" ]]; then
    npm ci --prefix "$project" --no-audit --no-fund
    npm run build --prefix "$project"
    mkdir "$staging/$project"
    cp -R "$project/dist/." "$staging/$project/"
  elif [[ -f "$project/index.html" ]]; then
    mkdir "$staging/$project"
    cp -R "$project/." "$staging/$project/"
  fi
done
# Keep previous releases so deployment is reversible. Switch only after all builds pass.
sudo -n mkdir -p /var/www/web-experiments-releases /var/www/html
if [[ -e /var/www/html/web-experiments && ! -L /var/www/html/web-experiments ]]; then
  echo 'Refusing to replace an existing non-symlink deployment.' >&2
  exit 1
fi
release=$(sudo -n mktemp -d /var/www/web-experiments-releases/release.XXXXXXXX)
sudo -n cp -R "$staging/." "$release/"
sudo -n chmod -R a+rX "$release"
link="/var/www/html/.web-experiments-$(basename "$release")"
sudo -n ln -s "$release" "$link"
sudo -n mv -Tf "$link" /var/www/html/web-experiments
echo 'Published at http://localhost/web-experiments/'
