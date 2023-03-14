export const TOKENS: Record<string, RegExp> = {
	attribute:
		/\[\s*(?:(?<namespace>\*|[-\w]*)\|)?(?<name>[-\w\u{0080}-\u{FFFF}]+)\s*(?:(?<operator>\W?=)\s*(?<value>.+?)\s*(\s(?<caseSensitive>[iIsS]))?\s*)?\]/gu,
	id: /#(?<name>(?:\\.|[-\w\u{0080}-\u{FFFF}])+)/gu,
	class: /\.(?<name>(?:\\.|[-\w\u{0080}-\u{FFFF}])+)/gu,
	comma: /\s*,\s*/g, // must be before combinator
	combinator: /\s*[\s>+~]\s*/g, // this must be after attribute
	'pseudo-element':
		/::(?<name>[-\w\u{0080}-\u{FFFF}]+)(?:\((?<argument>¶+)\))?/gu, // this must be before pseudo-class
	'pseudo-class':
		/:(?<name>[-\w\u{0080}-\u{FFFF}]+)(?:\((?<argument>¶+)\))?/gu,
	universal: /(?:(?<namespace>\*|[-\w]*)\|)?\*/gu,
	type: /(?:(?<namespace>\*|[-\w]*)\|)?(?<name>[-\w\u{0080}-\u{FFFF}]+)|\*/gu, // this must be last
};

export const TRIM_TOKENS = new Set<string>(['combinator', 'comma']);

export const RECURSIVE_PSEUDO_CLASSES = new Set<string>([
	'not',
	'is',
	'where',
	'has',
	'matches',
	'-moz-any',
	'-webkit-any',
	'nth-child',
	'nth-last-child',
]);

const nthChildRegExp = /(?<index>[\dn+-]+)\s+of\s+(?<subtree>.+)/;
export const RECURSIVE_PSEUDO_CLASSES_ARGS: Record<string, RegExp> = {
	'nth-child': nthChildRegExp,
	'nth-last-child': nthChildRegExp,
};

const getArgumentPatternByType = (type: string) => {
	switch (type) {
		case 'pseudo-element':
		case 'pseudo-class':
			return new RegExp(
				TOKENS[type]!.source.replace(
					'(?<argument>¶+)',
					'(?<argument>.+)'
				),
				'gu'
			);
		default:
			return TOKENS[type];
	}
};

export function gobbleParens(text: string, offset: number): string {
	let nesting = 0;
	let result = '';
	for (; offset < text.length; offset++) {
		const char = text[offset];
		switch (char) {
			case '(':
				++nesting;
				break;
			case ')':
				--nesting;
				break;
		}
		result += char;
		if (nesting === 0) {
			return result;
		}
	}
	throw new Error(`Mismatched parenthesis starting at offset ${offset}`);
}

export function tokenizeBy(text: string, grammar = TOKENS): Token[] {
	if (!text) {
		return [];
	}

	const tokens: (Token | string)[] = [text];
	for (const type in grammar) {
		const pattern = grammar[type];
		for (let i = 0; i < tokens.length; i++) {
			const token = tokens[i];
			if (typeof token !== 'string') {
				continue;
			}

			pattern.lastIndex = 0;
			const match = pattern.exec(token);
			if (!match) {
				continue;
			}

			const from = match.index - 1;
			const args: (Token | string)[] = [];
			const content = match[0];

			const before = token.slice(0, from + 1);
			if (before) {
				args.push(before);
			}

			args.push({
				...(match.groups as unknown as Token),
				type,
				content,
			});

			const after = token.slice(from + content.length + 1);
			if (after) {
				args.push(after);
			}

			tokens.splice(i, 1, ...args);
		}
	}

	let offset = 0;
	for (const token of tokens) {
		switch (typeof token) {
			case 'string':
				throw new Error(
					`Unexpected sequence ${token} found at index ${offset}`
				);
			case 'object':
				offset += token.content.length;
				token.pos = [offset - token.content.length, offset];
				if (TRIM_TOKENS.has(token.type)) {
					token.content = token.content.trim() || ' ';
				}
				break;
		}
	}

	return tokens as Token[];
}

export function tokenize(selector: string, grammar = TOKENS) {
	// Prevent leading/trailing whitespaces from being interpreted as combinators
	selector = selector.trim();
	if (selector === '') {
		return [];
	}

	type Replacement = { value: string; offset: number };
	const replacements: Replacement[] = [];

	// Replace strings with placeholder
	{
		interface State {
			escaped: boolean;
			quoted?: string;
			offset: number;
		}
		const state: State = { escaped: false, offset: 0 };
		for (let i = 0; i < selector.length; ++i) {
			if (state.escaped) {
				continue;
			}
			switch (selector[i]) {
				case '\\':
					state.escaped = true;
					break;
				case '"':
				case "'": {
					if (!state.quoted) {
						state.quoted = selector[i];
						state.offset = i;
						continue;
					}
					const quote = state.quoted;
					if (quote !== selector[i]) {
						continue;
					}
					delete state.quoted;
					const offset = state.offset;
					const value = selector.slice(state.offset, i + 1);
					replacements.push({ value, offset });
					const replacement = `${quote}${'§'.repeat(
						value.length - 2
					)}${quote}`;
					selector =
						selector.slice(0, offset) +
						replacement +
						selector.slice(offset + value.length);
					break;
				}
			}
		}
	}

	// Replace parentheses with placeholder
	{
		interface State {
			escaped: boolean;
			nesting: number;
			offset: number;
		}
		const state: State = { escaped: false, nesting: 0, offset: 0 };
		for (let i = 0; i < selector.length; ++i) {
			if (state.escaped) {
				continue;
			}
			switch (selector[i]) {
				case '\\':
					state.escaped = true;
					break;
				case '(':
					if (++state.nesting !== 1) {
						continue;
					}
					state.offset = i;
					break;
				case ')': {
					if (--state.nesting !== 0) {
						continue;
					}
					const { offset } = state;
					const value = selector.slice(offset, i + 1);
					replacements.push({ value, offset });
					const replacement = `(${'¶'.repeat(value.length - 2)})`;
					selector =
						selector.slice(0, offset) +
						replacement +
						selector.slice(offset + value.length);
					break;
				}
			}
		}
	}

	// Now we have no nested structures and we can parse with regexes
	const tokens = tokenizeBy(selector, grammar);

	// Replace placeholders in reverse order.
	for (const replacement of replacements.reverse()) {
		for (const token of tokens) {
			const { offset, value } = replacement;
			if (
				!(
					token.pos[0] <= offset &&
					offset + value.length <= token.pos[1]
				)
			) {
				continue;
			}

			const { content } = token;
			const tokenOffset = offset - token.pos[0];
			token.content =
				content.slice(0, tokenOffset) +
				value +
				content.slice(tokenOffset + value.length);
			token.__changed = token.content !== content;
		}
	}

	// Rematch tokens with changed content.
	for (const token of tokens) {
		if (!token.__changed) {
			continue;
		}
		delete token.__changed;

		const pattern = getArgumentPatternByType(token.type);
		if (!pattern) {
			throw new Error(`Unknown token type: ${token.type}`);
		}
		pattern.lastIndex = 0;
		const match = pattern.exec(token.content);
		if (!match) {
			throw new Error(
				`Unable to parse content for ${token.type}: ${token.content}`
			);
		}
		Object.assign(token, match.groups);
	}

	return tokens;
}

/**
 *  Convert a flat list of tokens into a tree of complex & compound selectors
 */
function nestTokens(tokens: Token[], { list = true } = {}): AST {
	if (list && tokens.find((t: { type: string }) => t.type === 'comma')) {
		const selectors: AST[] = [];
		const temp = [];

		for (let i = 0; i < tokens.length; i++) {
			if (tokens[i].type === 'comma') {
				if (temp.length === 0) {
					throw new Error('Incorrect comma at ' + i);
				}

				selectors.push(nestTokens(temp, { list: false }));
				temp.length = 0;
			} else {
				temp.push(tokens[i]);
			}
		}

		if (temp.length === 0) {
			throw new Error('Trailing comma');
		} else {
			selectors.push(nestTokens(temp, { list: false }));
		}

		return { type: 'list', list: selectors };
	}

	for (let i = tokens.length - 1; i >= 0; i--) {
		let token = tokens[i];

		if (token.type === 'combinator') {
			let left = tokens.slice(0, i);
			let right = tokens.slice(i + 1);

			return {
				type: 'complex',
				combinator: token.content,
				left: nestTokens(left),
				right: nestTokens(right),
			};
		}
	}

	switch (tokens.length) {
		case 0:
			throw new Error('Could not build AST.');
		case 1:
			// If we're here, there are no combinators, so it's just a list.
			return tokens[0];
		default:
			return {
				type: 'compound',
				list: [...tokens], // clone to avoid pointers messing up the AST
			};
	}
}

/**
 * Traverse an AST (or part thereof), in depth-first order
 */
export function walk(
	node: AST | undefined,
	visit: (node: AST, parentNode?: AST) => void,
	/**
	 * @internal
	 */
	parent?: AST
) {
	if (!node) {
		return;
	}

	if ('left' in node && 'right' in node) {
		walk(node.left, visit, node);
		walk(node.right, visit, node);
	} else if ('list' in node) {
		for (let n of node.list) {
			walk(n, visit, node);
		}
	}

	visit(node, parent);
}

export interface ParserOptions {
	recursive?: boolean;
	list?: boolean;
}

/**
 * Parse a CSS selector
 *
 * @param selector - The selector to parse
 * @param options.recursive - Whether to parse the arguments of pseudo-classes like :is(), :has() etc. Defaults to true.
 * @param options.list - Whether this can be a selector list (A, B, C etc). Defaults to true.
 */
export function parse(
	selector: string,
	{ recursive = true, list = true }: ParserOptions = {}
): AST | undefined {
	const tokens = tokenize(selector);
	if (!tokens) {
		return;
	}

	const ast = nestTokens(tokens, { list });

	if (!recursive) {
		return ast;
	}

	walk(ast, (node) => {
		if (node.type === 'pseudo-class' && node.argument) {
			if (RECURSIVE_PSEUDO_CLASSES.has(node.name)) {
				let argument = node.argument;
				const childArg = RECURSIVE_PSEUDO_CLASSES_ARGS[node.name];
				if (childArg) {
					const match = childArg.exec(argument);
					if (!match) {
						return;
					}

					Object.assign(node, match.groups);
					argument = match.groups!['subtree'];
				}
				if (argument) {
					Object.assign(node, {
						subtree: parse(argument, {
							recursive: true,
							list: true,
						}),
					});
				}
			}
		}
	});

	return ast;
}

/**
 * To convert the specificity array to a number
 */
export function specificityToNumber(
	specificity: number[],
	base: number
): number {
	base = base || Math.max(...specificity) + 1;
	return (
		specificity[0] * (base << 1) + specificity[1] * base + specificity[2]
	);
}

/**
 * Calculate specificity of a selector.
 *
 * If the selector is a list, the max specificity is returned.
 */
export function specificity(selector: string | AST): number[] {
	let ast: string | AST | undefined = selector;
	if (typeof ast === 'string') {
		ast = parse(ast, { recursive: true });
	}
	if (!ast) {
		return [];
	}

	if (ast.type === 'list' && 'list' in ast) {
		let base = 10;
		const specificities = ast.list.map((ast) => {
			const sp = specificity(ast);
			base = Math.max(base, ...specificity(ast));
			return sp;
		});
		const numbers = specificities.map((ast) =>
			specificityToNumber(ast, base)
		);
		return specificities[numbers.indexOf(Math.max(...numbers))];
	}

	let ret = [0, 0, 0];
	walk(ast, (node) => {
		if (node.type === 'id') {
			ret[0]++;
		} else if (node.type === 'class' || node.type === 'attribute') {
			ret[1]++;
		} else if (
			(node.type === 'type' && node.content !== '*') ||
			node.type === 'pseudo-element'
		) {
			ret[2]++;
		} else if (node.type === 'pseudo-class' && node.name !== 'where') {
			if (RECURSIVE_PSEUDO_CLASSES.has(node.name) && node.subtree) {
				const sub = specificity(node.subtree);
				sub.forEach((s, i) => (ret[i] += s));
				// :nth-child() & :nth-last-child() add (0, 1, 0) to the specificity of their most complex selector
				if (
					node.name === 'nth-child' ||
					node.name === 'nth-last-child'
				) {
					ret[1]++;
				}
			} else {
				ret[1]++;
			}
		}
	});

	return ret;
}

export interface Token {
	type: string;
	content: string;
	name: string;
	namespace?: string;
	value?: string;
	pos: [number, number];
	operator?: string;
	argument?: string;
	subtree?: AST;
	caseSensitive?: 'i';
	/**
	 * @internal
	 */
	__changed?: boolean;
}

export interface Complex {
	type: 'complex';
	combinator: string;
	right: AST;
	left: AST;
}

export interface Compound {
	type: 'compound';
	list: Token[];
}

export interface List {
	type: 'list';
	list: AST[];
}

export type AST = Complex | Compound | List | Token;
