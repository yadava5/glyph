import { defineConfig, type Plugin, type ViteDevServer, type PreviewServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Mirror the production `vercel.json` rewrite `/system-card` ->
 * `/system-card/index.html` for the dev and preview servers. The System
 * Card is a separate static build under `public/system-card/`; the app
 * links to the bare `/system-card` path. On Vercel the rewrite serves the
 * card, but vite's own SPA history fallback would otherwise shadow that
 * bare path with the landing's index.html. This middleware keeps local
 * dev/preview faithful to production so the "Read the System Card" link
 * (and its e2e coverage) actually resolves. The trailing-slash and
 * explicit index.html forms are already served as static files.
 */
function systemCardRewrite(): Plugin {
  const attach = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use((req, _res, next) => {
      const raw = req.url ?? '';
      const [path, query] = raw.split('?');
      if (path === '/system-card') {
        req.url = '/system-card/index.html' + (query ? `?${query}` : '');
      }
      next();
    });
  };
  return {
    name: 'system-card-rewrite',
    // No return value: register the middleware BEFORE vite's internal
    // SPA-fallback middleware so the rewrite wins.
    configureServer: attach,
    configurePreviewServer: attach,
  };
}

// https://vite.dev/config/
// The landing redesign is WebGL-free: no three.js, no manual vendor
// chunking. scripts/check-bundle-budget.mjs guards the entry size and
// fails the build if a three-vendor chunk ever reappears.
export default defineConfig({
  plugins: [react(), tailwindcss(), systemCardRewrite()],
  build: {
    // Keep unprefixed modern properties (backdrop-filter) in the output:
    // the default conservative target rewrote the nav's glass blur to a
    // -webkit- only rule, silently shipping no blur to Chromium/Firefox.
    cssTarget: ['chrome111', 'safari16', 'firefox128'],
  },
});
