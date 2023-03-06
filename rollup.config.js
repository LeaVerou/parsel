import { terser } from 'rollup-plugin-terser';
import typescript from '@rollup/plugin-typescript';

export default [
  {
    input: 'parsel.ts',
    output: {
      name: 'parsel',
      file: 'public/parsel.js',
      sourcemap: true,
      format: 'es'
    },
    plugins: [typescript({ declaration: false })]
  },
  {
    input: 'parsel.ts',
    output: [
      {
        file: 'dist/cjs/parsel.js',
        sourcemap: true,
        format: 'cjs'
      },
      {
        name: 'parsel',
        file: 'dist/nomodule/parsel.js',
        sourcemap: true,
        format: 'iife'
      },
      {
        name: 'parsel',
        file: 'dist/umd/parsel.js',
        sourcemap: true,
        format: 'umd'
      },
      {
        name: 'parsel',
        file: 'dist/parsel.js',
        sourcemap: true,
        format: 'es'
      }
    ],
    plugins: [typescript()]
  },
  {
    input: 'parsel.ts',
    output: [
      {
        file: 'dist/cjs/parsel.min.js',
        sourcemap: true,
        format: 'cjs'
      },
      {
        name: 'parsel',
        file: 'dist/nomodule/parsel.min.js',
        sourcemap: true,
        format: 'iife'
      },
      {
        name: 'parsel',
        file: 'dist/umd/parsel.min.js',
        sourcemap: true,
        format: 'umd'
      },
      {
        name: 'parsel',
        file: 'dist/parsel.min.js',
        sourcemap: true,
        format: 'es'
      }
    ],
    plugins: [typescript(), terser()]
  }
];
