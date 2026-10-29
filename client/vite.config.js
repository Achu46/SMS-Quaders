import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      'firebase/app': path.resolve(import.meta.dirname, 'src/firebase/mockFirebaseApp.js'),
      'firebase/firestore': path.resolve(import.meta.dirname, 'src/firebase/mockFirestore.js'),
    }
  },
  server: {
    host: true,
    allowedHosts: true,
  },
})
