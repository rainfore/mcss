import {$, toAssert} from './helper/util.js';

// >>>>>> 待优化
// the more fast version
// let toAssert2 = util.makePredicate;

let isUnit = toAssert('% em ex ch rem vw vh vmin vmax cm mm in pt pc px deg grad rad turn s ms Hz kHz dpi dpcm dppx');
// let isPseudoClass = toAssert2(["dir","lang","any-link", "link", "visited", "local-link","target", "scope", "current", "past", "future", "active", "hover", "focus", "active-drop", "valid-drop", "invalid-drop", "enabled", "disabled", "enabled", "disabled", "read-only", "read-write", "placeholder-shown", "default", "checked", "indeterminate", "valid", "invalid", "in-range", "out-of-range", "required", "optional", "root", "empty", "blank", "nth-child", "nth-last-child", "first-child", "last-child", "only-child", "nth-of-type", "nth-last-of-type", "first-of-type", "last-of-type", "only-of-type", "nth-match", "nth-last-match", 'nth-column', 'nth-last-column', 'not', 'matches', 'before', 'after', '-moz-placeholder']);
// let isBifs = toAssert2(bifs.concat(['rgb', 'rgba', 'url', 'counter', 'attr', 'calc', 'min', 'max', 'cycle', 'linear-gradient', 'radial-gradient', 'repeating-linear-gradient', 'repeating-radial-gradient']), true);
let isPseudoClassWithParen = toAssert('current local-link nth-child nth-last-child nth-of-type nth-last-of-type nth-match nth-last-match column nth-column nth-last-column lang matches not');

// [W3C]: http://dev.w3.org/csswg/css-syntax/
const MAX_ALLOWED_CODEPOINT = parseInt('10FFFF',16);    // [W3C#maximum-allowed-codepoint]
const REPLACEMENT_CHARACTER = parseInt('FFFD', 16);

// Token Types
// ===========================================
// >>>>>> 什么意思
// // inspectToken, get tokenName with TokenType(uid)
// tokenizer.inspect = function(tokenType){
//     let typeType = tokenType.type || tokenType;
//     for(let i in tokenizer){
//         if(typeof tokenizer[i] === 'number' && tokenizer[i] === tokenType) return i;
//     }
// }

$('nl', /\r\n|[\r\f\n]/);    // newline
$('w', /[ \t\r\n\f]/);    // whitespace
$('d', /[0-9]/);    // digital
$('escape', /\\[0-9a-f]{1,6}/);     // escape char
$('nmchar', /[_-\w\u00A1-\uFFFF]|{escape}/);
$('nmstart',/[_a-zA-Z\u00A1-\uFFFF]|{escape}/ );
$('ident', /-?{nmstart}{nmchar}*/);

// registed macros
// =====================
let $rules = [
    {       // multiline comment | singleline comment
        regexp: /\/\*([^\x00]+?)\*\/|\/\/([^\n\r]*)/,
        action(yytext, mcomment, scomment) {
            let isSingle = mcomment === undefined;
            // >>>>>> ? 这个方法是怎么用的
            this.options.comment && this.options.comment({
                type: isSingle ? 'singleline': 'multiline',
                content: isSingle ? scomment : mcomment
            });
        }
    }, {    // url [W3C]
        regexp: $(/(url|url\-prefix|domain|regexp){w}*\((['"])?{w}*([^\r\n\f]*?)\2{w}*\)/),
        action(yytext, name , quote, url) {
            if(name === 'url')
                return {type: 'URL', value: url};
            else
                return {type: 'FUNCTION', value: name, args: [{ type: 'STRING', value: url }]};
        }
    }, {   // function [W3C]
        regexp: $(/(?:\$?-?[_A-Za-z][-_\w]*)(?=\()/),
        action(value) {
            return {type: 'FUNCTION', value};
        }
    }, {    // $variable
        regexp: /\$(-?[_A-Za-z][-_\w]*)/,
        action(yytext, value) {
            return {type: 'VAR', value};
        }
    }, {    // ident [W3C], 即 -o-webkit-xx 是允许的
        regexp: $(/{ident}/),
        action(value) {
            if(value === 'false' || value === 'true')
                return {type: 'BOOLEAN', value: value === 'true'};
            else if(value === 'null')
                return {type: 'NULL', value: null};
            else
                return {type: 'TEXT', value};
        }
    },
    // {    // @css at-rule no parse
    //     reg: /@css{w}*{/,
    //     action(yytext) {
    //     }
    // },
    {       // dimension: number + unit
        regexp: $(/(-?(?:{d}*\.{d}+|{d}+))(\w*|%)?/),
        action(yytext, value, unit) {
            if(unit && !isUnit(unit))
                this.error('Unexcept unit: "' + unit + '"');
            return {type: 'DIMENSION', value: +value, unit};
        }
    }, {    // class
        regexp: $(/\.({nmchar}+)/),
        action(value) {
            return {type: 'CLASS', value};
        }
    }, {    // at-keyword, @
        regexp: /@(-?[_A-Za-z][-_\w]*)/,
        action(yytext, value) {
            return {type: 'AT_KEYWORD', value};
        }
    }, {    // !important
        regexp: $(/!{w}*important/),
        action(yytext) {
            return {type: 'IMPORTANT'};
        }
    }, {    // pesudo-class
        regexp: $(':([-_a-zA-Z]+)' + // 伪类名
            '(?:\\(' + // 括号开始
            '([^\\(\\)]*' + // 第一种无括号
            '|(?:' + // 有括号(即伪类中仍有伪类并且是带括号的)
            '\\([^\\)]+\\)' + // 括号部分
            /*'|[^\\(\\)]*' +*/ ')+)' + // 关闭有括号
            '\\))'),
        action(yytext, value) {
            // >>>>>> ?什么意思
            // false 使用其它方式再token一次
            if(!yytext.includes('(') && !isPseudoClassWithParen(value))
                return null;

            return {type: 'PSEUDO_CLASS' , value: yytext};
        }
    }, {    // pesudo-element
        regexp: $('::({nmchar}+)'),
        action(value) {
            return {type: 'PSEUDO_ELEMENT', value};
        }
    }, {    // attribute, [title=haha]
        regexp: $('\\[\\s*(?:{nmchar}+)\\s*(?:([*^$|~!]?=)\\s*[\'\"]?(?:[^\'\"\\[]*)[\'\"]?)?\\s*\\]'),
        action(value) {
            return {type: 'ATTRIBUTE', value};
        }
    }, {    // #hash
        regexp: $(/#{nmchar}+/),
        action(value) {
            return {type: 'HASH', value};
        }
    }, {    // string
        regexp: /(['"])([^\r\n\f]*?)\1/,
        action(yytext, quote, value = ''){
            return {type: 'STRING', value};
        }
    }, {    // punctuator can ignore 'WS'
        regexp: $(/{w}*(&&|\|\||[\*\$\^~\|>=<!?]?=|\.\.\.|[\{;,><]){w}*/),
        action(yytext, value) {
            return {type: value};
            // return {type: 'PUNCTUATOR', value};
        }
    }, {    // whitespace
        regexp: $('WS', /{w}+/),
        action(value) {
            return {type: 'WS', value};
        }
    }, {
        // punctuator | operator | logic | other
        // .. ::
        // []{}() ; , : & #
        // ->
        // *= // $= // ^= ~= |=
        // >= <= == != =
        // < > / * + -
        // ..  or .
        regexp: /($|#\{|:|::|[~!#()\[\]&\.]|[\}%\-+*\/])/,
        action(value) {
            return {type: value ? value : 'EOF'};
        }
    }, {    // convert escaped unicode to TEXT
        regexp: $(/\\([0-9a-fA-F]{1,6})/),
        action(yytext, value) {
            let hex = parseInt(value, 16);
            if(hex > MAX_ALLOWED_CODEPOINT)
                hex = '\uFFFD';
            hex = '\\' + hex.toString(16);
            return {type: 'TEXT', value: hex};
        }
    }
];

$rules.forEach((rule) => {
    let reg = typeof rule.regexp !== 'string' ? String(rule.regexp).slice(1, -1) : rule.regexp;
    if(!reg.startsWith('^(?'))
        rule.regexp = new RegExp('^(?:' + reg + ')');
});

/**
 * Tokenizer Class
 * @param {object}  options
 * @param {boolean} ignoreComment
 */
class Tokenizer {
    constructor(options = {}) {
        this.options = options;
        this.options.ignoreComment = true;
    }

    tokenize(input = '') {
        // simplify newline token detect
        this.input = input;
        // remained input
        this.remained = input;
        this.lineno = 1;
        this.states = ['init'];
        this.state = 'init';
        return this.pump();
    }

    // 一次性输出所有tokens
    pump() {
        let tokens = [];
        let token;
        while(token = this.lex()) {
            tokens.push(token);
            if(token.type === 'EOF')
                break;
        }
        return tokens;
    }

    // >>>>>> 一定会有跳过的问题吗？
    // 依赖next
    lex() {
        let token = this.next();
        return token ? token : this.lex(); // >>>>>> undefined;
    }

    next() {
        let tmp, token;

        for(let i = 0; i < $rules.length; i++) {
            let rule = $rules[i]; //[link[i]];
            // 匹配
            tmp = this.remained.match(rule.regexp);
            if(!tmp)
                continue;
            // 生成token
            token = rule.action.apply(this, tmp);
            if(token)
                break;
        }

        if(tmp && token) {
            let lines = tmp[0].match(/(?:\r\n|[\n\r\f]).*/g);
            if(lines)
                this.lineno += lines.length;
            token.lineno = this.lineno;
            this.remained = this.remained.slice(tmp[0].length);
            if(token.type === 'WS') {
                if(this._preIsWS)
                    token = undefined;
                this._preIsWS = true;
            } else
                this._preIsWS = false;
            return token;
        } else
            this.error('Unexpect token start');
    }

    pushState(condition) {
        this.states.push(condition);
        this.state = condition;
    }

    popState() {
        this.states.pop();
        this.state = this.states[this.states.length - 1];
    }

    error(message) {
        let err = new error.SyntaxError(message, this.lineno, this.options);
        err.column = this._getColumn();
        throw err;
    }

    _getColumn() {
        const newline = /^[\n\f\r]/;
        let n = this.input.length - this.remained.length;
        let column = 0;
        for(; n--;) {
            if(newline.test(this.input.charAt(n)) && n >= 0)
                break;
            column++
        }
    }

    // _traceError: function(message){
    //     let matchLength = this.length - this.remained.length;
    //     let offset = matchLength - 10;
    //     if(offset < 0) offset = 0;
    //     let pointer = matchLength - offset;
    //     let posMessage = this.input.slice(offset, offset + 20)
    //     // TODO: 加上trace info
    //     return 'Error on line ' + (this.lineno + 1) + " " +
    //         (message || '. Unrecognized input.') + "\n" + (offset === 0? '':'...') +
    //         posMessage + "...\n" + new Array(pointer + (offset === 0? 0 : 3) ).join(' ') + new Array(10).join("^");
    // }
}

export default Tokenizer;
