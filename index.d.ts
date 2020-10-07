    // Type definitions for parsel-js 1.0.1
    // Project: https://github.com/LeaVerou/parsel
    // Definitions by: Naveen DA <https://github.com/NaveenDA>
    // Definitions: https://github.com/LeaVerou/parsel/blob/master/index.d.ts


    interface TokenizeOutput{
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
        right?:Complex|Compound|TokenizeOutput;
        left:Complex|Compound;
        type:"complex"
    }
    interface Compound{
        type:"compound";
        list:TokenizeOutput[]
    }
    interface ParserOutput{
        type:string;
        combinator:string;
        left?:Complex|Compound;
        right?:Complex|Compound;
        subtree?:ParserOutput;
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
    export function parse(selector: string, options: ParserOptions): ParserOutput;

    /**
     * Get list of tokens as a flat array:
     */
    export function tokenize(selector: string):TokenizeOutput[] ;

    /**
     * Traverse all tokens of a (sub)tree:
     */
    export function walk(node: ParserOutput,callback:(node: ParserOutput)=>{}):void ;

    /**
     * Calculate specificity (returns an array of 3 numbers):
     */
    export function specificity(selector: string, options: SpecificityOptions):number[];
    
    /**
     *  To convert the specificity array to a number
     */
    export function specificityToNumber(specificity:any[],base?:number):number;
