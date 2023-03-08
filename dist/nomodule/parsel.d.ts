export declare const enum TokenType {
    Class = "class",
    Attribute = "attribute",
    Id = "id",
    Type = "type",
    Universal = "universal",
    PseudoElement = "pseudo-element",
    PseudoClass = "pseudo-class",
    Comma = "comma",
    Combinator = "combinator"
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
export declare const TOKENS: Record<string, RegExp>;
export declare const TOKENS_WITH_PARENS: Set<string>;
export declare const TOKENS_WITH_STRINGS: Set<string>;
export declare const TOKENS_TO_TRIM: Set<string>;
export declare const RECURSIVE_PSEUDO_CLASSES: Set<string>;
export declare const RECURSIVE_PSEUDO_CLASSES_ARGS: Record<string, RegExp>;
export declare function tokenizeBy(text: string, grammar?: Record<string, RegExp>): Tokens[];
export declare function tokenize(selector: string, grammar?: Record<string, RegExp>): Tokens[] | null;
/**
 * Traverse an AST (or part thereof), in depth-first order
 */
export declare function walk(node: AST | undefined, visit: (node: AST, parentNode?: AST) => void, 
/**
 * @internal
 */
parent?: AST): void;
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
export declare function parse(selector: string, { recursive, list }?: ParserOptions): AST | undefined;
/**
 * To convert the specificity array to a number
 */
export declare function specificityToNumber(specificity: number[], base: number): number;
/**
 * Calculate specificity of a selector.
 *
 * If the selector is a list, the max specificity is returned.
 */
export declare function specificity(selector: string | AST): number[];
