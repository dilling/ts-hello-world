import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    // Must come before react(): it generates routeTree.gen.ts from src/web/routes.
    tanstackRouter({
      target: 'react',
      routesDirectory: './src/web/routes',
      generatedRouteTree: './src/web/routeTree.gen.ts',
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
  ],
  // Vite 8 reads the `paths` from tsconfig.json natively (@server/*, @web/*, ...).
  resolve: { tsconfigPaths: true },
  build: {
    outDir: 'dist/web',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    // The frontend always calls relative '/api/...'. In dev that lands here and is
    // proxied to Hono; in production Hono serves the bundle and handles it directly.
    // Same-origin either way, so there is no CORS config anywhere in this repo.
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
})
