import { terser } from 'rollup-plugin-terser';
import typescript from '@rollup/plugin-typescript';

export default [
  {
    input: 'parsel.ts',
    output: {
      file: 'public/parsel.js',
      sourcemap: true,
      format: 'es'
    },
    plugins: [typescript({ declaration: false, outputToFilesystem: true })]
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
        file: 'dist/parsel.js',
        sourcemap: true,
        format: 'es'
      }
    ].concat(
      [
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
          file: 'dist/parsel.min.js',
          sourcemap: true,
          format: 'es'
        }
      ].map((output) => Object.assign(output, { plugins: [terser()] }))
    ),
    plugins: [typescript({ outputToFilesystem: true })]
  }
];
