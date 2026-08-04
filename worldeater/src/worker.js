// Cloudflare's static asset binding serves the Vite output unchanged.
export default {
  fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
