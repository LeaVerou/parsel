import { terser } from 'rollup-plugin-terser';
import typescript from '@rollup/plugin-typescript';

export default [
	{
		input: 'parsel.ts',
		output: [
			{
				file: 'dist/cjs/parsel.js',
				format: 'cjs',
			},
			{
				name: 'parsel',
				file: 'dist/nomodule/parsel.js',
				format: 'iife',
			},
			{
				name: 'parsel',
				file: 'dist/umd/parsel.js',
				format: 'umd',
			},
			{
				file: 'dist/parsel.js',
				format: 'es',
			},
		].concat(
			[
				{
					file: 'dist/cjs/parsel.min.js',
					format: 'cjs',
				},
				{
					name: 'parsel',
					file: 'dist/nomodule/parsel.min.js',
					format: 'iife',
				},
				{
					name: 'parsel',
					file: 'dist/umd/parsel.min.js',
					format: 'umd',
				},
				{
					file: 'dist/parsel.min.js',
					format: 'es',
				},
			].map((output) => Object.assign(output, { plugins: [terser()] }))
		),
		plugins: [typescript({ outputToFilesystem: true })],
	},
];
