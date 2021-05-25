import { terser } from 'rollup-plugin-terser';

export default {
  input: 'parsel.js',
  output: [
  {
    file: 'dist/parsel.cmd.js',
    format: 'cjs'
  },
  {
    name: 'parsel',
    file: 'dist/parsel_nomodule.js',
    format: 'iife'
  },
  {
    name: 'parsel',
    file: 'dist/parsel.umd.js',
    format: 'umd'
  },
  ],
  plugins: [ terser() ]
};
