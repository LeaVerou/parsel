/**
 * Benchmark suite for parsel.
 *
 * Measures wall-clock time for the core public APIs across a range of
 * selector complexities.  Run with:
 *
 *   node bench.mjs
 *
 * The script imports the *unminified* ES build so results reflect the
 * actual code paths (no terser inlining artifacts).
 */

import { tokenize, parse, stringify, specificity, walk } from './dist/parsel.js';

// ── Selector corpus ─────────────────────────────────────────────────

const SELECTORS = {
	// Simple
	simple: [
		'div',
		'.foo',
		'#bar',
		'*',
		'[href]',
		'::before',
		':hover',
	],

	// Moderate — compound & complex
	moderate: [
		'ul > li:nth-of-type(2n+1):not(:last-child) a',
		'.container:not(:first-child) > .row:last-child > .col-3',
		'nav ul li:nth-child(even) a:not([href^="#"])',
		'a[href$=".pdf"][target="_blank"][rel="noopener"]',
		'table tr:not(:first-child):hover td:nth-child(2n+1)',
		'input[type="checkbox"][checked]:indeterminate + label',
	],

	// Heavy — lists, deep nesting, recursive pseudo-classes
	heavy: [
		'ul > li:first-of-type, ul > li:last-of-type',
		'nav ul li:first-child a, nav ul li:last-child a',
		'.container:has(.row:has(.col-4))',
		'.row:has(.col-3):not(:has(.col-4)) > .col-3',
		':not(section):not(header):not(footer) > h1',
		':root:where(:hover, :focus) a',
	],

	// Stress — long selector lists and deeply nested structures
	stress: [
		// 20-item selector list
		Array.from({ length: 20 }, (_, i) => `.item-${i}:nth-child(${i + 1})`).join(', '),
		// deeply nested :is()
		':is(:is(:is(:is(:is(.a, .b), .c), .d), .e), .f)',
		// long compound selector
		'div.a.b.c.d.e.f.g.h.i.j[data-x="1"][data-y="2"][data-z="3"]:hover:focus:active::before',
		// complex chain
		'main > section:first-child > article:nth-of-type(2) > div.content > p:not(:last-child) > span.highlight > a[href^="https"]',
	],
};

const ALL_SELECTORS = Object.values(SELECTORS).flat();

// ── Benchmark harness ───────────────────────────────────────────────

/**
 * Run `fn` for `warmup` iterations (discarded), then `iterations` timed
 * iterations.  Returns { mean, median, min, max, total } in microseconds.
 */
function bench(name, fn, { iterations = 5000, warmup = 500 } = {}) {
	// Warmup
	for (let i = 0; i < warmup; i++) fn();

	const times = new Float64Array(iterations);
	for (let i = 0; i < iterations; i++) {
		const t0 = performance.now();
		fn();
		times[i] = (performance.now() - t0) * 1000; // µs
	}

	times.sort();
	const total = times.reduce((a, b) => a + b, 0);
	const mean = total / iterations;
	const median = times[Math.floor(iterations / 2)];
	const min = times[0];
	const max = times[iterations - 1];

	return { name, mean, median, min, max, total, iterations };
}

function fmtµs(v) {
	if (v >= 1000) return (v / 1000).toFixed(2) + ' ms';
	return v.toFixed(2) + ' µs';
}

function printResult(r) {
	console.log(
		`  ${r.name.padEnd(40)} mean=${fmtµs(r.mean)}  median=${fmtµs(r.median)}  min=${fmtµs(r.min)}  max=${fmtµs(r.max)}  (${r.iterations} iters)`
	);
}

// ── Benchmarks ──────────────────────────────────────────────────────

console.log('=== parsel benchmark ===\n');

// 1. tokenize
console.log('── tokenize ──');
for (const [group, selectors] of Object.entries(SELECTORS)) {
	printResult(bench(`tokenize/${group}`, () => {
		for (const s of selectors) tokenize(s);
	}));
}
printResult(bench('tokenize/ALL', () => {
	for (const s of ALL_SELECTORS) tokenize(s);
}));

// 2. parse (recursive)
console.log('\n── parse (recursive) ──');
for (const [group, selectors] of Object.entries(SELECTORS)) {
	printResult(bench(`parse/${group}`, () => {
		for (const s of selectors) parse(s, { recursive: true });
	}));
}
printResult(bench('parse/ALL', () => {
	for (const s of ALL_SELECTORS) parse(s, { recursive: true });
}));

// 3. parse (non-recursive)
console.log('\n── parse (non-recursive) ──');
for (const [group, selectors] of Object.entries(SELECTORS)) {
	printResult(bench(`parseNR/${group}`, () => {
		for (const s of selectors) parse(s, { recursive: false });
	}));
}

// 4. stringify (from AST)
console.log('\n── stringify ──');
const asts = ALL_SELECTORS.map(s => parse(s, { recursive: true })).filter(Boolean);
printResult(bench('stringify/ALL', () => {
	for (const ast of asts) stringify(ast);
}));

// 5. specificity
console.log('\n── specificity ──');
for (const [group, selectors] of Object.entries(SELECTORS)) {
	printResult(bench(`specificity/${group}`, () => {
		for (const s of selectors) specificity(s);
	}));
}
printResult(bench('specificity/ALL', () => {
	for (const s of ALL_SELECTORS) specificity(s);
}));

// 6. specificity from pre-parsed AST (isolates the walk/calc cost)
console.log('\n── specificity (from AST) ──');
const parsedAsts = ALL_SELECTORS.map(s => parse(s, { recursive: true })).filter(Boolean);
printResult(bench('specificity-ast/ALL', () => {
	for (const ast of parsedAsts) specificity(ast);
}));

// 7. walk
console.log('\n── walk ──');
printResult(bench('walk/ALL', () => {
	for (const ast of parsedAsts) {
		walk(ast, () => {});
	}
}));

// 8. End-to-end: parse + specificity (the most common real-world combo)
console.log('\n── end-to-end: parse + specificity ──');
printResult(bench('e2e/ALL', () => {
	for (const s of ALL_SELECTORS) {
		const ast = parse(s, { recursive: true });
		if (ast) specificity(ast);
	}
}));

console.log('\nDone.');
