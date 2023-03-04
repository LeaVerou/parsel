import { terser } from 'rollup-plugin-terser';
import typescript from '@rollup/plugin-typescript';

export default [
  {
    input: 'parsel.ts',
    output: [
      {
        file: 'dist/cjs/parsel.js',
        format: 'cjs'
      },
      {
        name: 'parsel',
        file: 'dist/nomodule/parsel.js',
        format: 'iife'
      },
      {
        name: 'parsel',
        file: 'dist/umd/parsel.js',
        format: 'umd'
      },
      {
        name: 'parsel',
        file: 'dist/parsel.js',
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
        format: 'cjs'
      },
      {
        name: 'parsel',
        file: 'dist/nomodule/parsel.min.js',
        format: 'iife'
      },
      {
        name: 'parsel',
        file: 'dist/umd/parsel.min.js',
        format: 'umd'
      },
      {
        name: 'parsel',
        file: 'dist/parsel.min.js',
        format: 'es'
      }
    ],
    plugins: [typescript(), terser()]
  }
];
