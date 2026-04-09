/* eslint-env node */
/* global process */
import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

const buildId = (() => {
  const ciSha = process.env.GITHUB_SHA || process.env.VERCEL_GIT_COMMIT_SHA || process.env.COMMIT_REF;
  if (ciSha) return ciSha.slice(0, 7);
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
