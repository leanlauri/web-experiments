import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

const buildId = (() => {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
})();

export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  server: {
    open: true,
  },
});
