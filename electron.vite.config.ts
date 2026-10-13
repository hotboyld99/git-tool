import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    // electron-store is ESM-only; bundle it so the CJS main bundle can load it.
    build: {
      externalizeDeps: { exclude: ['electron-store'] },
      rollupOptions: { input: { index: resolve('src/main/main.ts') } }
    }
  },
  preload: {
    build: { rollupOptions: { input: { index: resolve('src/preload/preload.ts') } } }
  },
  renderer: {
    plugins: [react(), tailwindcss()]
  }
})
