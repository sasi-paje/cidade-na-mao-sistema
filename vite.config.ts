import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  assetsInclude: ['**/*.svg'],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    historyApiFallback: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/react')) return 'vendor-react'
          if (id.includes('node_modules/@supabase')) return 'vendor-supabase'
          if (id.includes('node_modules/lucide-react')) return 'vendor-lucide'
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})
