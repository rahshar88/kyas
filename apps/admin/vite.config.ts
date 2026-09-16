import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * The console is a static single-page app.
 *
 * No server, no server-side secrets, and — the point — **no service-role key**. Everything
 * privileged happens in the `admin-console` and `admin-review-registration` Edge Functions,
 * which authorise against `admin_users` in the database. A bundle that cannot escalate is
 * worth more than any amount of care about where a key is stored (§5.3, §13.1).
 */
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: { outDir: 'dist', sourcemap: true },
});
