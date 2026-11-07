import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // acessível pelo celular na mesma rede
    proxy: { '/api': 'http://localhost:4000' },
  },
});
