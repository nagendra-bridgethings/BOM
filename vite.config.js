import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// '/' suits local dev and S3 (served from the bucket root). GitHub Pages serves
// this project from /BOM/, so CI sets VITE_BASE=/BOM/ before building.
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    open: true,
  },
})
