import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative asset URLs, so the built site works wherever it is served from.
  // GitHub Pages puts a project site under /<repo-name>/, and an absolute base
  // would have to name the repo and break if the repo were ever renamed. There
  // is no client-side routing here, so relative paths have nothing to trip on.
  base: './',
  plugins: [react()],
})
