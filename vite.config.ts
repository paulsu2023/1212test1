
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Phase 1 Protection: Disable Source Maps to prevent full source code reconstruction in browser DevTools
    sourcemap: false, 
  },
});
