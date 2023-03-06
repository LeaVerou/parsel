var TokenType;
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
})(TokenType || (TokenType = {}));
const TOKENS = {
    [TokenType.Attribute]: /\[\s*(?:(?<namespace>(?:\\.|[-\w\P{ASCII}])+|\*)?\|)?(?<name>(?:\\.|[-\w\P{ASCII}])+)\s*(?:(?<operator>\W?=)\s*(?<value>.+?)\s*(\s(?<caseSensitive>[iIsS]))?\s*)?\]/gu,
    [TokenType.Id]: /#(?<name>(?:\\.|[-\w\P{ASCII}])+)/gu,
    [TokenType.Class]: /\.(?<name>(?:\\.|[-\w\P{ASCII}])+)/gu,
    [TokenType.Comma]: /\s*,\s*/g,
    [TokenType.Combinator]: /\s*[\s>+~]\s*/g,
    [TokenType.PseudoElement]: /::(?<name>(?:\\.|[-\w\P{ASCII}])+)(?:\((?<argument>¶+)\))?/gu,
    [TokenType.PseudoClass]: /:(?<name>(?:\\.|[-\w\P{ASCII}])+)(?:\((?<argument>¶+)\))?/gu,
    [TokenType.Universal]: /(?:(?<namespace>\*|(?:\\.|[-\w\P{ASCII}])*)\|)?\*/gu,
    [TokenType.Type]: /(?:(?<namespace>\*|(?:\\.|[-\w\P{ASCII}])*)\|)?(?<name>(?:\\.|[-\w\P{ASCII}])+)/gu, // this must be last
};
const TOKENS_TO_TRIM = new Set([
    TokenType.Combinator,
    TokenType.Comma,
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
    'nth-last-child',
]);
const nthChildRegExp = /(?<index>[\dn+-]+)\s+of\s+(?<subtree>.+)/;
const RECURSIVE_PSEUDO_CLASSES_ARGS = {
    'nth-child': nthChildRegExp,
    'nth-last-child': nthChildRegExp,
};
const getTokensForRestore = (type) => {
    switch (type) {
        case TokenType.PseudoElement:
        case TokenType.PseudoClass:
            return new RegExp(TOKENS[type].source.replace('(?<argument>¶+)', '(?<argument>.+)'), 'gu');
        default:
            return TOKENS[type];
    }
};
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
function tokenize(selector, grammar = TOKENS) {
    if (!selector) {
        return [];
    }
    // Prevent leading/trailing whitespace be interpreted as combinators
    selector = selector.trim();
    const replacements = [];
    // Replace strings with whitespace strings (to preserve offsets)
    {
        const state = { escaped: false };
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
                    if (!state.quoteState) {
                        state.quoteState = [selector[i], i];
                        continue;
                    }
                    const quote = state.quoteState[0];
                    if (quote !== selector[i]) {
                        continue;
                    }
                    const offset = state.quoteState[1];
                    const value = selector.slice(state.quoteState[1], i + 1);
                    replacements.push({ value, offset });
                    const replacement = `${quote}${'§'.repeat(value.length - 2)}${quote}`;
                    selector =
                        selector.slice(0, offset) +
                            replacement +
                            selector.slice(offset + value.length);
                    break;
                }
            }
        }
    }
    // Now that strings are out of the way, extract parens and replace them with parens with whitespace (to preserve offsets)
    {
        const state = { escaped: false, nesting: 0, offset: 0 };
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
    // Restore replacements in reverse order.
    for (const replacement of replacements.reverse()) {
        for (const token of tokens) {
            const { offset, value } = replacement;
            if (!(token.pos[0] <= offset && offset + value.length <= token.pos[1])) {
                continue;
            }
            // Invert replacements
            const content = token.content;
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
        const pattern = getTokensForRestore(token.type);
        pattern.lastIndex = 0;
        const match = pattern.exec(token.content);
        if (!match) {
            throw new Error("This shouldn't be possible!");
        }
        Object.assign(token, match.groups);
    }
    return tokens;
}
/**
 *  Convert a flat list of tokens into a tree of complex & compound selectors
 */
function nestTokens(tokens) {
    {
        const list = [];
        const { length } = tokens;
        let offset = 0;
        for (let limit = offset; limit !== length; ++limit) {
            const token = tokens[limit];
            if (token.type !== TokenType.Comma) {
                continue;
            }
            list.push(nestTokens(tokens.slice(offset, limit)));
            offset = limit + 1;
        }
        if (list.length !== 0) {
            list.push(nestTokens(tokens.slice(offset)));
            return { type: 'list', list };
        }
    }
    for (let index = tokens.length - 1; index >= 0; --index) {
        const token = tokens[index];
        if (token.type !== TokenType.Combinator) {
            continue;
        }
        const left = tokens.slice(0, index);
        const right = tokens.slice(index + 1);
        return {
            type: 'complex',
            combinator: token.content,
            left: nestTokens(left),
            right: nestTokens(right),
        };
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
 *
 * @deprecated Use {@link flatten}.
 */
function walk(node, visit, 
/**
 * @internal
 */
parent) {
    for (const [n, p] of flatten(node, parent)) {
        visit(n, p);
    }
}
/**
 * Traverse an AST (or part thereof), in depth-first order
 */
function* flatten(node, 
/**
 * @internal
 */
parent) {
    if (!node) {
        return;
    }
    if ('left' in node && 'right' in node) {
        yield* flatten(node.left, node);
        yield* flatten(node.right, node);
    }
    else if ('list' in node) {
        for (const child of node.list) {
            yield* flatten(child, node);
        }
    }
    yield [node, parent];
}
/**
 * Parse a CSS selector
 *
 * @param selector - Selector to parse.
 * @param options - Configuration for parsing.
 */
function parse(selector, { recursive = true } = {}) {
    const tokens = tokenize(selector);
    const ast = nestTokens(tokens);
    if (!recursive) {
        return ast;
    }
    for (const [node] of flatten(ast)) {
        if (node.type !== TokenType.PseudoClass || !node.argument) {
            continue;
        }
        if (!RECURSIVE_PSEUDO_CLASSES.has(node.name)) {
            continue;
        }
        let argument = node.argument;
        const pattern = RECURSIVE_PSEUDO_CLASSES_ARGS[node.name];
        if (pattern) {
            const match = pattern.exec(argument);
            if (!match) {
                continue;
            }
            Object.assign(node, match.groups);
            argument = match.groups['subtree'];
        }
        if (argument) {
            Object.assign(node, {
                subtree: parse(argument, { recursive }),
            });
        }
    }
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
        const specificities = ast.list.map(ast => {
            const sp = specificity(ast);
            base = Math.max(base, ...specificity(ast));
            return sp;
        });
        const numbers = specificities.map(ast => specificityToNumber(ast, base));
        return specificities[numbers.indexOf(Math.max(...numbers))];
    }
    const result = [0, 0, 0];
    for (const [node] of flatten(ast)) {
        switch (node.type) {
            case TokenType.Id:
                result[0]++;
                break;
            case TokenType.Class:
            case TokenType.Attribute:
                result[1]++;
                break;
            case TokenType.Type:
            case TokenType.PseudoElement:
                result[2]++;
                break;
            case TokenType.PseudoClass:
                if (node.name === 'where') {
                    break;
                }
                if (!RECURSIVE_PSEUDO_CLASSES.has(node.name) || !node.subtree) {
                    result[1]++;
                    break;
                }
                for (const [index, sub] of specificity(node.subtree).entries()) {
                    result[index] += sub;
                }
                // :nth-child() & :nth-last-child() add (0, 1, 0) to the specificity of their most complex selector
                if (node.name === 'nth-child' || node.name === 'nth-last-child') {
                    result[1]++;
                }
                break;
        }
    }
    return result;
}

export { RECURSIVE_PSEUDO_CLASSES, RECURSIVE_PSEUDO_CLASSES_ARGS, TOKENS, TOKENS_TO_TRIM, TokenType, flatten, parse, specificity, specificityToNumber, tokenize, tokenizeBy, walk };
//# sourceMappingURL=parsel.js.map
