import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    // Em desenvolvimento a UI fala com a API pelo mesmo host, evitando CORS.
    proxy: { '/api': process.env.VITE_API_URL || 'http://127.0.0.1:8078' },
  },
})
