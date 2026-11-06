# Web Experiments

Eleven client-side experiments, linked from `index.html`. Projects with a
`package.json` are built with Vite; the others are served as static HTML.

## Local server deployment

This machine uses Debian's Nginx service on port 80, with `/var/www/html` as
its document root. The experiments are published under `/web-experiments/`.
Nginx starts automatically at boot.

From this repository, run:

```sh
./scripts/deploy-local.sh
```

Requires Node.js 24, npm, and passwordless sudo for the publishing commands.
The script installs locked dependencies, builds every project, and assembles
only build outputs and plain HTML projects. It switches
`/var/www/html/web-experiments` to a new release only after every build passes.
Prior releases stay in `/var/www/web-experiments-releases/`.

Open <http://localhost/web-experiments/> on the server, or use the machine's
LAN address from another device. Each experiment has its own subfolder, such
as `/web-experiments/ants/`. Source edits require running the script again.

Useful server commands:

```sh
systemctl status nginx
sudo nginx -t
sudo systemctl reload nginx
```

GitHub Pages deployment is also configured in `.github/workflows/`.
