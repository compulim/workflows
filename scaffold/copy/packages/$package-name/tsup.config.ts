import { defineConfig } from 'tsup';

export default defineConfig([
  {
    dts: true,
    entry: {
      ['$package-name'.replace(/\//, '-')]: './src/index.ts'
    },
    format: ['cjs', 'esm'],
    sourcemap: true
  }
]);
