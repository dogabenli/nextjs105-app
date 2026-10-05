import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      lib: path.resolve(__dirname, 'src/lib'),
      components: path.resolve(__dirname, 'src/components'),
      src: path.resolve(__dirname, 'src'),
      temp: path.resolve(__dirname, 'src/temp'),
    },
  },
});
