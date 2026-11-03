import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['react', 'react-dom', 'three', 'three/addons/loaders/GLTFLoader.js', '@react-three/fiber'],
  },
});
