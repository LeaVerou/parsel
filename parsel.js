const COMBINATORS = [">", "+", "~"];
const PSEUDOS_WITH_SELECTOR_ARG = ["not", "is", "where", "matches"];
const SPECIAL = [...COMBINATORS, ..."#.[]=^$*:|()"];
// https://drafts.csswg.org/css-syntax-3/#ident-token-diagram
const IDENT_CHAR = /^[-\w\u{0080}-\u{FFFF}]+$/ui;

/*
TODO:
- attr selectors
- type selectors
- selector lists
- args
- consolidate logic, e.g. escapes should only be implemented in one place
*/

export function tokenize(selector) {
	selector = selector.trim();
	let str = "";
	let stack = [];
	let ret = [];
	let i = 0;
	let escape = false;

	function gobble({test, until, escapes = true}) {
		let str = "";
		let char = selector[i];

		while (i < selector.length) {
			let doBreak;

			if (test && !(test.test? test.test(char) : char === test)) {
				doBreak = true;
			}
			else if (until && (until.test? until.test(char) : char === until)) {
				doBreak = true;
			}

			if (doBreak && (!escapes || selector[i - 1] !== "\\")) {
				break;
			}

			str += char;
			char = selector[++i];
		}

		return str;
	}

	function gobbleIdent() {
		return gobble({test: IDENT_CHAR, escapes: false});
	}

	function gobbleParens() {
		let str = "";
		let stack = [];
		let char = selector[i];

		for (; i < selector.length; i++) {
			if (char === "(" && selector[i - 1] !== "\\") {
				stack.push(char);
			}
			else if (char === ")" && selector[i - 1] !== "\\") {
				if (stack.length > 0) {
					stack.pop();
				}
				else {
					throw new Error("Closing paren without opening paren at " + i);
				}

				if (stack.length === 0) {
					return str.slice(1); // remove "(" at start
				}
			}

			if (char === "'" || char === '"') {
				str += gobbleString(false);
			}
			else {
				str += char;
			}
		}

		return str;
	}

	function gobbleSpaces() {
		gobble({test: /\s/});
	}

	// Read a (potentially unquoted) string
	function gobbleString(quoted) {
		let char = selector[i];

		if (!quoted && (char !== '"' && char !== "'")) {
			// Unquoted string
			return gobbleIdent();
		}

		return gobble({until: char});
	}

	while (i < selector.length) {
		let char = selector[i];

		if (char === "\\") {
			// Next char is literal
			i++;
			str += selector[i];
		}
		else if (char === "#") {
			i++;
			ret.push({
				type: "id",
				name: gobbleIdent()
			});
		}
		else if (char === ".") {
			i++;
			ret.push({
				type: "class",
				name: gobbleIdent()
			});
		}
		else if (char === "[") {
			// TODO handle spaces between parts
			i++;
			let o = {
				type: "attribute",
				name: gobbleIdent(),
				operator: gobble({until: "="}) + "=",
				value: gobbleString()
			};
			gobbleSpaces();
			if (selector[i] === "i") {
				// https://www.w3.org/TR/selectors/#attribute-case
				o.i = true;
			}
			ret.push(o);
			gobbleSpaces();
			i++; // advance past ]
		}
		else if (char === ":") {
			let o = {type: "pseudo-class"};

			if (selector[i + 1] === ":") {
				o.type = "pseudo-element";
				i++;
			}

			i++;

			o.name = gobbleIdent();

			if (selector[i + 1] === "(") {
				o.argument = gobbleParens();
			}

			ret.push(o);
		}
		else if (/\s/.test(char) || COMBINATORS.includes(char)) {
			gobbleSpaces();
			char = selector[i];

			if (COMBINATORS.includes(char)) {
				ret.push({
					type: "combinator",
					combinator: char
				});
				i++;
				gobbleSpaces();
			}
			else {
				ret.push({
					type: "combinator",
					combinator: " "
				});
			}
		}
		else {
			str += char;
			i++;
		}
	}

	return ret;
}

// Convert a flat list of tokens into a tree of complex & compound selectors
function nestTokens(tokens) {
	for (let i=tokens.length - 1; i>=0; i--) {
		let token = tokens[i];

		if (token.type === "combinator") {
			let left = tokens.slice(0, i);
			let right = tokens.slice(i + 1);

			if (Math.min(left.length, right.length) === 0) {
				throw new Error(`Combinator ${token.combinator} used in selector ${left.length === 0? "start" : "end"}`);
			}

			return {
				type: "complex",
				combinator: token.combinator,
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
	let tokens = tokenize(selector);

	return nestTokens(tokens);
}
