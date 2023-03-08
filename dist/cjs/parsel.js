'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

exports.TokenType = void 0;
(function (TokenType) {
    TokenType["Class"] = "class";
    TokenType["Attribute"] = "attribute";
    TokenType["Id"] = "id";
    TokenType["Type"] = "type";
    TokenType["Universal"] = "universal";
    TokenType["PseudoElement"] = "pseudo-element";
    TokenType["PseudoClass"] = "pseudo-class";
    TokenType["Comma"] = "comma";
    TokenType["Combinator"] = "combinator";
})(exports.TokenType || (exports.TokenType = {}));
const TOKENS = {
    [exports.TokenType.Attribute]: /\[\s*(?:(?<namespace>\*|[-\w]*)\|)?(?<name>[-\w\u{0080}-\u{FFFF}]+)\s*(?:(?<operator>\W?=)\s*(?<value>.+?)\s*(\s(?<caseSensitive>[iIsS]))?\s*)?\]/gu,
    [exports.TokenType.Id]: /#(?<name>(?:\\.|[-\w\u{0080}-\u{FFFF}])+)/gu,
    [exports.TokenType.Class]: /\.(?<name>(?:\\.|[-\w\u{0080}-\u{FFFF}])+)/gu,
    [exports.TokenType.Comma]: /\s*,\s*/g,
    [exports.TokenType.Combinator]: /\s*[\s>+~]\s*/g,
    [exports.TokenType.PseudoElement]: /::(?<name>[-\w\u{0080}-\u{FFFF}]+)(?:\((?<argument>¶+)\))?/gu,
    [exports.TokenType.PseudoClass]: /:(?<name>[-\w\u{0080}-\u{FFFF}]+)(?:\((?<argument>¶+)\))?/gu,
    [exports.TokenType.Universal]: /(?:(?<namespace>\*|[-\w]*)\|)?\*/gu,
    [exports.TokenType.Type]: /(?:(?<namespace>\*|[-\w]*)\|)?(?<name>[-\w\u{0080}-\u{FFFF}]+)|\*/gu // this must be last
};
const TOKENS_WITH_PARENS = new Set([
    exports.TokenType.PseudoClass,
    exports.TokenType.PseudoElement
]);
const TOKENS_WITH_STRINGS = new Set([
    ...TOKENS_WITH_PARENS,
    exports.TokenType.Attribute
]);
const TOKENS_TO_TRIM = new Set([
    exports.TokenType.Combinator,
    exports.TokenType.Comma
]);
const RECURSIVE_PSEUDO_CLASSES = new Set([
    'not',
    'is',
    'where',
    'has',
    'matches',
    '-moz-any',
    '-webkit-any',
    'nth-child',
    'nth-last-child'
]);
const nthChildRegExp = /(?<index>[\dn+-]+)\s+of\s+(?<subtree>.+)/;
const RECURSIVE_PSEUDO_CLASSES_ARGS = {
    'nth-child': nthChildRegExp,
    'nth-last-child': nthChildRegExp
};
const TOKENS_FOR_RESTORE = { ...TOKENS };
for (const pseudoType of [
    exports.TokenType.PseudoElement,
    exports.TokenType.PseudoClass
]) {
    TOKENS_FOR_RESTORE[pseudoType] = RegExp(TOKENS[pseudoType].source.replace('(?<argument>¶+)', '(?<argument>.+)'), 'gu');
}
function scanParentheses(text, offset) {
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
function tokenizeBy(text, grammar = TOKENS) {
    if (!text) {
        return [];
    }
    const tokens = [text];
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
            const args = [];
            const content = match[0];
            const before = token.slice(0, from + 1);
            if (before) {
                args.push(before);
            }
            args.push({
                ...match.groups,
                type,
                content
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
                throw new Error(`Unexpected sequence ${token} found at index ${offset}`);
            case 'object':
                offset += token.content.length;
                token.pos = [offset - token.content.length, offset];
                if (TOKENS_TO_TRIM.has(token.type)) {
                    token.content = token.content.trim() || ' ';
                }
                break;
        }
    }
    return tokens;
}
const STRING_PATTERN = /(['"])((?:\\.|\\\n|[^\\\n])+?)\1/g;
function tokenize(selector, grammar = TOKENS) {
    if (!selector) {
        return null;
    }
    // Prevent leading/trailing whitespace be interpreted as combinators
    selector = selector.trim();
    // Replace strings with whitespace strings (to preserve offsets)
    const stringExpressions = [];
    selector = selector.replace(STRING_PATTERN, (value, quote, content, offset) => {
        stringExpressions.push({ value, offset });
        return `${quote}${'§'.repeat(content.length)}${quote}`;
    });
    // Now that strings are out of the way, extract parens and replace them with parens with whitespace (to preserve offsets)
    const parenthesisExpressions = [];
    {
        let pos = 0;
        let offset;
        while ((offset = selector.indexOf('(', pos)) > -1) {
            const value = scanParentheses(selector, offset);
            parenthesisExpressions.push({ value, offset });
            selector = `${selector.substring(0, offset)}(${'¶'.repeat(value.length - 2)})${selector.substring(offset + value.length)}`;
            pos = offset + value.length;
        }
    }
    // Now we have no nested structures and we can parse with regexes
    const tokens = tokenizeBy(selector, grammar);
    // Now restore parens and strings in reverse order
    function restoreNested(strings, regex, types) {
        for (const str of strings) {
            for (const token of tokens) {
                if (!types.has(token.type) ||
                    token.pos[0] >= str.offset ||
                    str.offset >= token.pos[1]) {
                    continue;
                }
                const content = token.content;
                token.content = token.content.replace(regex, str.value);
                if (token.content !== content) {
                    // actually changed?
                    // Re-evaluate groups
                    TOKENS_FOR_RESTORE[token.type].lastIndex = 0;
                    const match = TOKENS_FOR_RESTORE[token.type].exec(token.content);
                    Object.assign(token, match.groups);
                }
            }
        }
    }
    restoreNested(parenthesisExpressions, /\(¶+\)/, TOKENS_WITH_PARENS);
    restoreNested(stringExpressions, /(['"])§+?\1/, TOKENS_WITH_STRINGS);
    return tokens;
}
/**
 *  Convert a flat list of tokens into a tree of complex & compound selectors
 */
function nestTokens(tokens, { list = true } = {}) {
    if (list && tokens.find((t) => t.type === 'comma')) {
        const selectors = [];
        const temp = [];
        for (let i = 0; i < tokens.length; i++) {
            if (tokens[i].type === 'comma') {
                if (temp.length === 0) {
                    throw new Error('Incorrect comma at ' + i);
                }
                selectors.push(nestTokens(temp, { list: false }));
                temp.length = 0;
            }
            else {
                temp.push(tokens[i]);
            }
        }
        if (temp.length === 0) {
            throw new Error('Trailing comma');
        }
        else {
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
                right: nestTokens(right)
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
                list: [...tokens] // clone to avoid pointers messing up the AST
            };
    }
}
/**
 * Traverse an AST (or part thereof), in depth-first order
 */
function walk(node, visit, 
/**
 * @internal
 */
parent) {
    if (!node) {
        return;
    }
    if ('left' in node && 'right' in node) {
        walk(node.left, visit, node);
        walk(node.right, visit, node);
    }
    else if ('list' in node) {
        for (let n of node.list) {
            walk(n, visit, node);
        }
    }
    visit(node, parent);
}
/**
 * Parse a CSS selector
 *
 * @param selector - The selector to parse
 * @param options.recursive - Whether to parse the arguments of pseudo-classes like :is(), :has() etc. Defaults to true.
 * @param options.list - Whether this can be a selector list (A, B, C etc). Defaults to true.
 */
function parse(selector, { recursive = true, list = true } = {}) {
    const tokens = tokenize(selector);
    if (!tokens) {
        return;
    }
    const ast = nestTokens(tokens, { list });
    if (!recursive) {
        return ast;
    }
    walk(ast, (node) => {
        if (node.type === exports.TokenType.PseudoClass && node.argument) {
            if (RECURSIVE_PSEUDO_CLASSES.has(node.name)) {
                let argument = node.argument;
                const childArg = RECURSIVE_PSEUDO_CLASSES_ARGS[node.name];
                if (childArg) {
                    const match = childArg.exec(argument);
                    if (!match) {
                        return;
                    }
                    Object.assign(node, match.groups);
                    argument = match.groups['subtree'];
                }
                if (argument) {
                    Object.assign(node, {
                        subtree: parse(argument, { recursive: true, list: true })
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
function specificityToNumber(specificity, base) {
    base = base || Math.max(...specificity) + 1;
    return specificity[0] * (base << 1) + specificity[1] * base + specificity[2];
}
/**
 * Calculate specificity of a selector.
 *
 * If the selector is a list, the max specificity is returned.
 */
function specificity(selector) {
    let ast = selector;
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
        const numbers = specificities.map((ast) => specificityToNumber(ast, base));
        return specificities[numbers.indexOf(Math.max(...numbers))];
    }
    let ret = [0, 0, 0];
    walk(ast, (node) => {
        if (node.type === 'id') {
            ret[0]++;
        }
        else if (node.type === 'class' || node.type === 'attribute') {
            ret[1]++;
        }
        else if ((node.type === 'type' && node.content !== '*') ||
            node.type === 'pseudo-element') {
            ret[2]++;
        }
        else if (node.type === 'pseudo-class' && node.name !== 'where') {
            if (RECURSIVE_PSEUDO_CLASSES.has(node.name) && node.subtree) {
                const sub = specificity(node.subtree);
                sub.forEach((s, i) => (ret[i] += s));
                // :nth-child() & :nth-last-child() add (0, 1, 0) to the specificity of their most complex selector
                if (node.name === 'nth-child' || node.name === 'nth-last-child') {
                    ret[1]++;
                }
            }
            else {
                ret[1]++;
            }
        }
    });
    return ret;
}

exports.RECURSIVE_PSEUDO_CLASSES = RECURSIVE_PSEUDO_CLASSES;
exports.RECURSIVE_PSEUDO_CLASSES_ARGS = RECURSIVE_PSEUDO_CLASSES_ARGS;
exports.TOKENS = TOKENS;
exports.TOKENS_TO_TRIM = TOKENS_TO_TRIM;
exports.TOKENS_WITH_PARENS = TOKENS_WITH_PARENS;
exports.TOKENS_WITH_STRINGS = TOKENS_WITH_STRINGS;
exports.parse = parse;
exports.specificity = specificity;
exports.specificityToNumber = specificityToNumber;
exports.tokenize = tokenize;
exports.tokenizeBy = tokenizeBy;
exports.walk = walk;
//# sourceMappingURL=parsel.js.map
