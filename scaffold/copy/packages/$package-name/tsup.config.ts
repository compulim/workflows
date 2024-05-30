import { defineConfig } from 'tsup';

export default defineConfig([
  {
    dts: true,
    entry: {
      '$package-name': './src/index.ts'
    },
    format: ['cjs', 'esm'],
    sourcemap: true
  }
]);
