/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  // Relative base: works for both username.github.io/<repo>/ and a custom domain.
  base: './',
  plugins: [preact()],
  worker: { format: 'es' },
  test: { environment: 'node' },
});
