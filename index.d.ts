// Type definitions for parsel-js 1.0.1
// Project: https://github.com/LeaVerou/parsel
// Definitions by: Naveen DA <https://github.com/NaveenDA>
// Definitions: https://github.com/LeaVerou/parsel/blob/master/index.d.ts


interface Tokens{
    content:string;
    name:string;
    type:string;
    namespace?:string;
    pos:number[];
    operator?:string;
    argument?:string;
}

interface Complex{
    combinator:string;
    right?:Complex|Compound|Tokens;
    left:Complex|Compound;
    type:"complex"
}
interface Compound{
    type:"compound";
    list:Tokens[]
}
interface AST{
    type:string;
    combinator?:string;
    left?:Complex|Compound;
    right?:Complex|Compound;
    subtree?:AST;
}
interface ParserOptions{
    recursive?:boolean;
    list?:boolean;
}
interface SpecificityOptions{
    format?:string;
}



/**
* Get AST:
*/
export function parse(selector: string, options: ParserOptions): AST;

/**
 * Get list of tokens as a flat array:
 */
export function tokenize(selector: string):Tokens[] ;

/**
 * Traverse all tokens of a (sub)tree:
 */
export function walk(node: AST,callback:(node: AST,parentNode: AST)=>{}):void ;

/**
 * Calculate specificity (returns an array of 3 numbers):
 */
export function specificity(selector: string| AST, options: SpecificityOptions):number[];

/**
 *  To convert the specificity array to a number
 */
export function specificityToNumber(specificity:number[],base?:number):number;
