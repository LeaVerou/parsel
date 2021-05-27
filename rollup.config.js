import { terser } from 'rollup-plugin-terser';

export default {
  input: 'parsel.js',
  output: [
  {
    file: 'dist/cjs/parsel.js',
    format: 'cjs'
  },
  {
    file: 'dist/cjs/parsel.min.js',
    format: 'cjs',
    plugins: [ terser() ]
  },
  {
    name: 'parsel',
    file: 'dist/nomodule/parsel.js',
    format: 'iife'
  },
  {
    name: 'parsel',
    file: 'dist/nomodule/parsel.min.js',
    format: 'iife',
    plugins: [ terser() ]
  },
  {
    name: 'parsel',
    file: 'dist/umd/parsel.js',
    format: 'umd'
  },
  {
    name: 'parsel',
    file: 'dist/umd/parsel.min.js',
    format: 'umd',
    plugins: [ terser() ]
  },
  {
    name: 'parsel',
    file: 'dist/parsel.js',
    format: 'es'
  },
  {
    name: 'parsel',
    file: 'dist/parsel.min.js',
    format: 'es',
    plugins: [ terser() ]
  },
  ],
};
