#!/usr/bin/env bash
# Publish and commit this project without including changes from other projects.
set -euo pipefail
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(git -C "$project_dir" rev-parse --show-toplevel)"
project_path="${project_dir#"$repo_root/"}"
message="${1:-Update $project_path}"
bash "$project_dir/deploy.sh"
git -C "$repo_root" add -- "$project_path"
if ! git -C "$repo_root" diff --cached --quiet -- "$project_path"; then
  git -C "$repo_root" commit --only -m "$message" -- "$project_path"
else
  printf 'No changes to commit in %s.\n' "$project_path"
fi
