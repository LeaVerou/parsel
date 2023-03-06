export const enum TokenType {
  Class = 'class',
  Attribute = 'attribute',
  Id = 'id',
  Type = 'type',
  Universal = 'universal',
  PseudoElement = 'pseudo-element',
  PseudoClass = 'pseudo-class',
  Comma = 'comma',
  Combinator = 'combinator'
}

export interface Tokens {
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
  list: Tokens[];
}

export interface List {
  type: 'list';
  list: AST[];
}

export type AST = Complex | Compound | List | Tokens;

export const TOKENS: Record<string, RegExp> = {
  [TokenType.Attribute]:
    /\[\s*(?:(?<namespace>\*|[-\w]*)\|)?(?<name>[-\w\u{0080}-\u{FFFF}]+)\s*(?:(?<operator>\W?=)\s*(?<value>.+?)\s*(\s(?<caseSensitive>[iIsS]))?\s*)?\]/gu,
  [TokenType.Id]: /#(?<name>(?:\\.|[-\w\u{0080}-\u{FFFF}])+)/gu,
  [TokenType.Class]: /\.(?<name>(?:\\.|[-\w\u{0080}-\u{FFFF}])+)/gu,
  [TokenType.Comma]: /\s*,\s*/g, // must be before combinator
  [TokenType.Combinator]: /\s*[\s>+~]\s*/g, // this must be after attribute
  [TokenType.PseudoElement]:
    /::(?<name>[-\w\u{0080}-\u{FFFF}]+)(?:\((?<argument>¶+)\))?/gu, // this must be before pseudo-class
  [TokenType.PseudoClass]:
    /:(?<name>[-\w\u{0080}-\u{FFFF}]+)(?:\((?<argument>¶+)\))?/gu,
  [TokenType.Universal]: /(?:(?<namespace>\*|[-\w]*)\|)?\*/gu,
  [TokenType.Type]:
    /(?:(?<namespace>\*|[-\w]*)\|)?(?<name>[-\w\u{0080}-\u{FFFF}]+)|\*/gu // this must be last
};

export const TOKENS_TO_TRIM = new Set<string>([
  TokenType.Combinator,
  TokenType.Comma
]);

export const RECURSIVE_PSEUDO_CLASSES = new Set<string>([
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
export const RECURSIVE_PSEUDO_CLASSES_ARGS: Record<string, RegExp> = {
  'nth-child': nthChildRegExp,
  'nth-last-child': nthChildRegExp
};

const getTokensForRestore = (type: string) => {
  switch (type) {
    case TokenType.PseudoElement:
    case TokenType.PseudoClass:
      return new RegExp(
        TOKENS[type].source.replace('(?<argument>¶+)', '(?<argument>.+)'),
        'gu'
      );
    default:
      return TOKENS[type];
  }
};

export function tokenizeBy(text: string, grammar = TOKENS): Tokens[] {
  if (!text) {
    return [];
  }

  const tokens: (Tokens | string)[] = [text];
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
      const args: (Tokens | string)[] = [];
      const content = match[0];

      const before = token.slice(0, from + 1);
      if (before) {
        args.push(before);
      }

      args.push({
        ...(match.groups as unknown as Tokens),
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
        throw new Error(
          `Unexpected sequence ${token} found at index ${offset}`
        );
      case 'object':
        offset += token.content.length;
        token.pos = [offset - token.content.length, offset];
        if (TOKENS_TO_TRIM.has(token.type)) {
          token.content = token.content.trim() || ' ';
        }
        break;
    }
  }

  return tokens as Tokens[];
}

export function tokenize(selector: string, grammar = TOKENS) {
  type TokenString = { value: string; offset: number };

  if (!selector) {
    return null;
  }

  // Prevent leading/trailing whitespace be interpreted as combinators
  selector = selector.trim();

  const replacements: TokenString[] = [];

  // Replace strings with whitespace strings (to preserve offsets)
  {
    const state: {
      escaped: boolean;
      quoteState?: [quoteType: string, offset: number];
    } = { escaped: false };
    for (let i = 0; i < selector.length; ++i) {
      if (state.escaped) {
        continue;
      }
      switch (selector[i]) {
        case '\\':
          state.escaped = true;
          break;
        case '"':
        case "'":
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

  // Now that strings are out of the way, extract parens and replace them with parens with whitespace (to preserve offsets)
  {
    const state: {
      escaped: boolean;
      nesting: number;
      offset: number;
    } = { escaped: false, nesting: 0, offset: 0 };
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
        case ')':
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
function nestTokens(tokens: Tokens[]): AST {
  {
    const list: AST[] = [];
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
      right: nestTokens(right)
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
        list: [...tokens] // clone to avoid pointers messing up the AST
      };
  }
}

/**
 * Traverse an AST (or part thereof), in depth-first order
 *
 * @deprecated Use {@link flatten}.
 */
export function walk(
  node: AST | undefined,
  visit: (node: AST, parentNode?: AST) => void,
  /**
   * @internal
   */
  parent?: AST
) {
  for (const [n, p] of flatten(node, parent)) {
    visit(n, p);
  }
}

/**
 * Traverse an AST (or part thereof), in depth-first order
 */
export function* flatten(
  node: AST | undefined,
  parent?: AST
): Generator<[node: AST, parent: AST | undefined]> {
  if (!node) {
    return;
  }

  if ('left' in node && 'right' in node) {
    yield* flatten(node.left, node);
    yield* flatten(node.right, node);
  } else if ('list' in node) {
    for (let child of node.list) {
      yield* flatten(child, node);
    }
  }

  yield [node, parent];
}

export interface ParserOptions {
  /**
   * Whether to parse the arguments of pseudo-classes like :is(), :has() etc.
   *
   * @defaultValue `true`
   */
  recursive?: boolean;
}

/**
 * Parse a CSS selector
 *
 * @param selector - Selector to parse.
 * @param options - Configuration for parsing.
 */
export function parse(
  selector: string,
  { recursive = true }: ParserOptions = {}
): AST | undefined {
  const tokens = tokenize(selector);
  if (!tokens) {
    return;
  }

  const ast = nestTokens(tokens);
  if (!recursive) {
    return ast;
  }

  for (const [node] of flatten(ast)) {
    if (node.type === TokenType.PseudoClass && node.argument) {
      if (RECURSIVE_PSEUDO_CLASSES.has(node.name)) {
        let argument = node.argument;
        const childArg = RECURSIVE_PSEUDO_CLASSES_ARGS[node.name];
        if (childArg) {
          const match = childArg.exec(argument);
          if (!match) {
            continue;
          }

          Object.assign(node, match.groups);
          argument = match.groups!['subtree'];
        }
        if (argument) {
          Object.assign(node, {
            subtree: parse(argument, { recursive })
          });
        }
      }
    }
  }

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
  return specificity[0] * (base << 1) + specificity[1] * base + specificity[2];
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

  if ('list' in ast) {
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
  for (const [node] of flatten(ast)) {
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
        if (node.name === 'nth-child' || node.name === 'nth-last-child') {
          ret[1]++;
        }
      } else {
        ret[1]++;
      }
    }
  }

  return ret;
}
