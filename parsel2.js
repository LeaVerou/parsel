export const TOKENS = {
	id: /#(?<name>[-\w\u{0080}-\u{FFFF}]+)/gu,
	class: /\.(?<name>[-\w\u{0080}-\u{FFFF}]+)/gu,
	attribute: /\[\s*(?<name>[-\w\u{0080}-\u{FFFF}]+)\s*(?:(?<operator>\W?=)\s*(?<value>.+?)\s*(?<i>i)?\s*)?\]/gu,
	combinator: /\s*[\s>+~]\s*/g,
	"pseudo-element": /::(?<name>[-\w\u{0080}-\u{FFFF}]+)(?:\((?<argument>.+)\))?/gu,
	"pseudo-class": /:(?<name>[-\w\u{0080}-\u{FFFF}]+)(?:\((?<argument>.+)\))?/gu,
	type: /(?<name>[-\w\u{0080}-\u{FFFF}]+)|\*/gu
};

const TOKENS_WITH_PARENS = new Set(["pseudo-class", "pseudo-element"]);
const TOKENS_WITH_STRINGS = new Set([...TOKENS_WITH_PARENS, "attribute"]);

function gobbleParens(text, i) {
	let str = "";
	let stack = [];


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

			if (stack.length === 0) {
				return str + char;
			}
		}

		str += char;
	}

	return str;
}

export function splitByTokens(text, grammar) {
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
		}

		offset += length;
	}

	return strarr;
}

export function tokenize(selector) {
	// Replace strings with whitespace strings (to preserve offsets)
	let strings = [];
	// FIXME Does not account for escaped backslashes before a quote
	selector = selector.replace(/(['"])(\\\1|.)+?\1/g, (str, quote, content, start) => {
		strings.push({str, start});
		return quote + "§".repeat(content.length) + quote;
	});

	console.log(selector);

	// Now that strings are out of the way, extract parens and replace them with parens with whitespace (to preserve offsets)
	let parens = [], offset = 0, start;
	while ((start = selector.indexOf("(", offset)) > -1) {
		let str = gobbleParens(selector, start);
		parens.push({str, start});
		selector = selector.substring(0, start) + "(" + "¶".repeat(str.length - 2) + ")" + selector.substring(start + str.length);
		offset += start + str.length;
	}

	// Now we have no nested structures and we can parse with regexes
	let tokens = splitByTokens(selector, TOKENS);

	// Now restore parens and strings in reverse order

	for (let paren of parens) {
		for (let token of tokens) {
			if (TOKENS_WITH_PARENS.has(token.type) && token.pos[0] < paren.start && paren.start < token.pos[1]) {
				let content = token.content;
				token.content = token.content.replace(/\(¶+\)/, paren.str);

				if (token.content !== content) { // actually changed?
					// Re-evaluate groups
					TOKENS[token.type].lastIndex = 0;
					let match = TOKENS[token.type].exec(token.content);
					let groups = match.groups;
					Object.assign(token, groups);
				}
			}
		}
	}

	for (let i=0; i<strings.length; i++) {
		let str = strings[i];

		for (let token of tokens) {
			if (TOKENS_WITH_STRINGS.has(token.type) && token.pos[0] < str.start && str.start < token.pos[1]) {
				let content = token.content;
				token.content = token.content.replace(/(['"])§+?\1/, str.str);

				if (token.content !== content) { // actually changed?
					// Re-evaluate groups
					let match = TOKENS[token.type].exec(token.content);
					let groups = match.groups;
					Object.assign(token, groups);
				}
			}
		}
	}

	return tokens;
}
