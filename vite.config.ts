import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    host: true, // Idhu thaan unga mobile-la portal open aaga vazhi seiyum
    port: 5173
  }
})