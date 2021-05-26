import { terser } from 'rollup-plugin-terser';

export default {
  input: 'parsel.js',
  output: [
  {
    file: 'dist/parsel.cmd.js',
    format: 'cjs'
  },
  {
    file: 'dist/parsel.cmd.min.js',
    format: 'cjs',
    plugins: [ terser() ]
  },
  {
    name: 'parsel',
    file: 'dist/parsel_nomodule.js',
    format: 'iife'
  },
  {
    name: 'parsel',
    file: 'dist/parsel_nomodule.min.js',
    format: 'iife',
    plugins: [ terser() ]
  },
  {
    name: 'parsel',
    file: 'dist/parsel.umd.js',
    format: 'umd'
  },
  {
    name: 'parsel',
    file: 'dist/parsel.umd.min.js',
    format: 'umd',
    plugins: [ terser() ]
  },
  {
    name: 'parsel',
    file: 'dist/parsel.esm.js',
    format: 'es'
  },
  {
    name: 'parsel',
    file: 'dist/parsel.esm.min.js',
    format: 'es',
    plugins: [ terser() ]
  },
  ],
};
