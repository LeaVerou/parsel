const TOKENS = {
	attribute: /\[\s*(?<name>[-\w\u{0080}-\u{FFFF}]+)\s*(?:(?<operator>\W?=)\s*(?<value>.+?)\s*(?<i>i)?\s*)?\]/gu,
	id: /#(?<name>[-\w\u{0080}-\u{FFFF}]+)/gu,
	class: /\.(?<name>[-\w\u{0080}-\u{FFFF}]+)/gu,
	combinator: /\s*[\s>+~]\s*/g, // this must be after attribute
	comma: /\s*,\s*/g,
	"pseudo-element": /::(?<name>[-\w\u{0080}-\u{FFFF}]+)(?:\((?<argument>¶+)\))?/gu, // this must be before pseudo-class
	"pseudo-class": /:(?<name>[-\w\u{0080}-\u{FFFF}]+)(?:\((?<argument>¶+)\))?/gu,
	type: /(?:(?<namespace>\*|[-\w]*)\|)?(?<name>[-\w\u{0080}-\u{FFFF}]+)|\*/gu // this must be last
};

const TOKENS_WITH_PARENS = new Set(["pseudo-class", "pseudo-element"]);
const TOKENS_WITH_STRINGS = new Set([...TOKENS_WITH_PARENS, "attribute"]);
const TRIM_TOKENS = new Set(["combinator", "comma"]);

const TOKENS_FOR_RESTORE = Object.assign({}, TOKENS);
TOKENS_FOR_RESTORE["pseudo-element"] = RegExp(TOKENS["pseudo-element"].source.replace("(?<argument>¶+)", "(?<argument>.+?)"), "gu")
TOKENS_FOR_RESTORE["pseudo-class"] = RegExp(TOKENS["pseudo-class"].source.replace("(?<argument>¶+)", "(?<argument>.+)"), "gu")

function gobbleParens(text, i) {
	let str = "", stack = [];

	for (; i < text.length; i++) {
		let char = text[i];

		if (char === "(") {
			stack.push(char);
		}
		else if (char === ")") {
			if (stack.length > 0) {
				stack.pop();
			}
			else {
				throw new Error("Closing paren without opening paren at " + i);
			}
		}

		str += char;

		if (stack.length === 0) {
			return str;
		}
	}

	throw new Error("Opening paren without closing paren");
}

export function tokenize(text, grammar) {
	var strarr = [text];

	tokenloop: for (var token in grammar) {
		let pattern = grammar[token];

		for (var i=0; i < strarr.length; i++) { // Don’t cache length as it changes during the loop
			var str = strarr[i];

			if (typeof str === "string") {
				pattern.lastIndex = 0;

				var match = pattern.exec(str);

				if (match) {
					let from = match.index - 1;
					let args = [];
					let content = match[0];

					let before = str.slice(0, from + 1);
					if (before) {
						args.push(before);
					}

					args.push({
						type: token,
						content,
						...match.groups
					});

					let after = str.slice(from + content.length + 1);
					if (after) {
						args.push(after);
					}

					strarr.splice(i, 1, ...args);
				}

			}
		}
	}

	let offset = 0;
	for (let i=0; i<strarr.length; i++) {
		let token = strarr[i];
		let length = token.length || token.content.length;

		if (typeof token === "object") {
			token.pos = [offset, offset + length];

			if (TRIM_TOKENS.has(token.type)) {
				token.content = token.content.trim() || " ";
			}
		}

		offset += length;
	}

	return strarr;
}

export function tokenizeSelector(selector) {
	selector = selector.trim(); // prevent leading/trailing whitespace be interpreted as combinators

	// Replace strings with whitespace strings (to preserve offsets)
	let strings = [];
	// FIXME Does not account for escaped backslashes before a quote
	selector = selector.replace(/(['"])(\\\1|.)+?\1/g, (str, quote, content, start) => {
		strings.push({str, start});
		return quote + "§".repeat(content.length) + quote;
	});

	// Now that strings are out of the way, extract parens and replace them with parens with whitespace (to preserve offsets)
	let parens = [], offset = 0, start;
	while ((start = selector.indexOf("(", offset)) > -1) {
		let str = gobbleParens(selector, start);
		parens.push({str, start});
		selector = selector.substring(0, start) + "(" + "¶".repeat(str.length - 2) + ")" + selector.substring(start + str.length);
		offset += start + str.length;
	}

	// Now we have no nested structures and we can parse with regexes
	let tokens = tokenize(selector, TOKENS);

	// Now restore parens and strings in reverse order
	function restoreNested(strings, regex, types) {
		for (let str of strings) {
			for (let token of tokens) {
				if (types.has(token.type) && token.pos[0] < str.start && str.start < token.pos[1]) {
					let content = token.content;
					token.content = token.content.replace(regex, str.str);

					if (token.content !== content) { // actually changed?
						// Re-evaluate groups
						TOKENS_FOR_RESTORE[token.type].lastIndex = 0;
						let match = TOKENS_FOR_RESTORE[token.type].exec(token.content);
						let groups = match.groups;
						Object.assign(token, groups);
					}
				}
			}
		}
	}

	restoreNested(parens, /\(¶+\)/, TOKENS_WITH_PARENS);
	restoreNested(strings, /(['"])§+?\1/, TOKENS_WITH_STRINGS);

	return tokens;
}

// Convert a flat list of tokens into a tree of complex & compound selectors
function nestTokens(tokens) {
	for (let i=tokens.length - 1; i>=0; i--) {
		let token = tokens[i];

		if (token.type === "combinator") {
			let left = tokens.slice(0, i);
			let right = tokens.slice(i + 1);

			if (left.length === 0 || right.length === 0) {
				throw new Error(`Combinator ${token.content} used in selector ${left.length === 0? "start" : "end"}`);
			}

			return {
				type: "complex",
				combinator: token.content,
				left: nestTokens(left),
				right: nestTokens(right)
			};
		}
	}

	// If we're here, there are no combinators, so it's just a list
	return tokens.length === 1? tokens[0] : {
		type: "compound",
		list: tokens
	};
}

export function parseSelector(selector) {
	let tokens = tokenizeSelector(selector);

	return nestTokens(tokens);
}
