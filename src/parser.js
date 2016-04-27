import * as _ from './helper/util.js';
import * as tree from './tree';

const STATES = {
    // 进入filter
    FILTER_DECLARATION: Symbol(),
    // 失败则进入Ruleset
    TRY_DECLARATION: Symbol(),
    TRY_INTERPOLATION: Symbol(),
    // 当遇到特殊属性时
    FUNCTION_CALL: Symbol()
};
const ASSIGNS = {'=': 1, '?=': 2, '^=': 3};
const COMBOS = 'WS > ~ +';

let isSkipStart = _.makePredicate('WS NEWLINE COMMENT ;');
let isWSOrNewLine = _.makePredicate('WS NEWLINE');
let isCombo = _.makePredicate(COMBOS);

// probably selector segment
let isSelectorSep = _.makePredicate('WS > ~ +' + 'PSEUDO_CLASS PSEUDO_ELEMENT ATTRIBUTE CLASS HASH & TEXT * # #{ : . % - compoundident DIMENSION');

let isOperator = _.makePredicate('+ - * /');
let isRelationOp = _.makePredicate('== >= <= < > !=');
let isCommaOrParen = _.makePredicate(', )');
let isDirectOperate = _.makePredicate('DIMENSION STRING BOOLEAN TEXT NULL');

let isColor = _.makePredicate("aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgrey darkgreen darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray grey green greenyellow honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgrey lightgreen lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen")
let isShorthandProp = _.makePredicate('background font margin border border-top border-right border-bottom border-left border-width border-color border-style transition padding list-style border-radius.')

let isMcssAtKeyword = _.makePredicate('mixin extend var');
let isMcssFutureAtKeyword = _.makePredicate('if else css for');
let isCssAtKeyword = _.makePredicate('import page keyframe media font-face charset');




class Parser {
    constructor(options = {}) {
        this.options = options;
    }

    parse(tokens) {
        // return new Promise((resolve, reject) => {
        //     // >>>>>> @TODO: 这些要与import 合并 2013/5/12 0:29:42

        // });
        this._states = {};
        this.lookahead = tokens;
        this.p = 0;
        this.length = this.lookahead.length;
        this.marked = null;
        let ast = this.stylesheet();
        return ast;
    }

    // store intermedia state
    state(state) {
        return this._states[state] === true;
    }

    // enter some state
    enter(state) {
        this._states[state] = true;
    }

    // enter some state
    leave(state) {
        this._states[state] = false;
    }

    lookUpBefore(lookup, before) {
        let i = 1, la;
        while(i++) {
            if((la = this.la(i)) === lookup)
                return true;
            if(la === before || la === 'EOF' || la === '}')
                return false;
        }
        return false;
    }

    // Temporarily set to ll(3) parser,
    ll(k = 1) {
        if(k < 0)
            k++;
        let pos = this.p + k - 1;
        if(pos > this.length - 1)
            pos = this.length - 1;
        // return this.lookahead[(this.p + k - 1) % 3];
        return this.lookahead[pos];
    }

    // read the next token
    // @TODO return to token stream!
    next(k = 1) {
        this.p += k;
    }

    // expect
    // some times we need to ignored some lookahead , etc. NEWLINE
    //
    // while to eat ';'
    // 1. eat ;
    // 2. eat newLine;
    eat(...types) {
        let token = this.ll();
        for(let i = 0; i < types.length; i++) {
            if(token.type === types[i]) {
                this.next();
                return token;
            }
        }
    }

    match(...types) {
        let token = this.eat(...types);
        if(!token) {
            // >>>>>> ?为什么
            token = this.ll();
            this.error('expect: "' + types[0] + '" -> got: "' + token.type + '"', token.lineno);
        } else
            return token;
    }

    //
    skip(type) {
        let skiped = false;
        while(true) {
            let token = this.ll();
            if(typeof type === 'string' ? type === token.type : type(token.type)) {
                this.next();
                skiped = true;
            } else
                break;
        }
        return skiped;
    }

    skipStart() {
        return this.skip(isSkipStart);
    }

    skipWSOrNewline() {
        return this.skip(isWSOrNewLine);
    }



    // type at pos is some type
    is(pos, type) {
        return this.ll(pos).type === type;
    }

    // 简单版本 只允许mark一次
    mark() {
        this.marked = this.p;
        return this;
    }

    restore() {
        // if(this.marked != undefined) this.p = this.marked;
        // this.marked = null;
        if(this.marked != null) {
            this.p = this.marked;
            this.marked = null;
        }
        return this;
    }

    // parse Function
    // ===================

    // stylesheet(topLevel)
    //  : WS      {skipWhiteSpace}
    //  | stmt EOF
    //  ;
    //
    stylesheet() {
        return this.block(true);
    }

    // statement
    // stmt
    //  : ruleset
    //  | atrule
    //  ;
    stmt() {
        let node = null;
        let token = this.ll();
        if(token.type === 'AT_KEYWORD')
            node = this.atrule();
        else if(token.type === 'VAR') {
            switch(this.ll(2).type) {
                case '(':
                    node = this.fnCall();
                    this.matchSemiColonIfNoBlock();
                    break;
                case ':':
                    node = this.transparentCall();
                    this.matchSemiColonIfNoBlock();
                    break;
                case '=':
                case '?=':
                case '^=':
                    node = this.assign();
                    if(node.value.type !== 'func')
                        this.matchSemiColonIfNoBlock();
                    break;
                default:
                    this.error('UNEXPECT token after VARIABLE', this.ll(2))
            }
        } else if(token.type === 'FUNCTION') {
            node = this.fnCall();
            this.matchSemiColonIfNoBlock();
        } else if(isSelectorSep(token.type))
            node = this.ruleset(true);

        if(node)
            return node;
        else
            this.error('INVALID statementstart ' + token.type, token);
    }

    // atrule
    //  : css-atrule(@import, @charset...)
    //  : bi-atrule(@if, @else, @mixin...)
    //  : directive
    //  ;
    atrule() {
        let node = null;
        let fullname = this.ll().value.toLowerCase();
        let name = this._removePrefix(fullname);
        if(typeof this[name] === 'function')
            node = this[name]();
        else
            node = this.directive();
        node.fullname = fullname;
        return node;
    }

    // >>>>>> 待补充
    // 天然支持document、charset等等
    directive() {
        let token = this.ll();
        let name = token.value.toLowerCase();
        let dhook = directive.getDirective(name);
        if(dhook) {
            // this.error('undefined atrule: "' + this.ll().value + '"')
            //@TODO add customer syntax
            console.log('has hook');
        } else {
            this.match('AT_KEYWORD');
            this.eat('WS')
            var value = this.valuesList();
            this.eat('WS');
            if(this.eat(';')) {
                return tree.directive(name, value);
            } else {
                var block = this.block();
                return tree.directive(name, value, block);
            }
            this.error('invalid customer directive define', ll);
        }
    }

    /**
     * @param  {Boolean} has '{}'
     * @return {[type]}           [description]
     */
    block(noBlock) {
        let node = new tree.Block();
        this.eat('WS');
        if(!noBlock) this.match('{');
        let end = noBlock ? 'EOF' : '}';
        this.skip('WS');
        while(!this.eat(end)) {
            let child;
            if(noBlock)
                child = this.stmt();
            else
                child = this.mark().declaration() || this.restore().stmt();
            node.list.push(child);
            this.skipStart();
        }
        return node;
    }

    // ruleset
    //  : selectorlist '{' rule ((NewLine|;) rule)* '}'

    ruleset() {
        let node = new tree.RuleSet();
        // 1. 是Selector Sep 2
        // 2. 在是IDENT(Selector Sep之一)时后续不接: 代表不是declaration //  &&(la !== 'IDENT'|| this.la(2) !== ':'
        // @changelog: 2 remove 这不需要
        node.selector = this.selectorList();
        this.eat('WS');
        node.block = this.block();
        return node;
    }

    // selectorList
    //  : complexSelector (, complexSelector)*
    //  ;
    selectorList() {
        let node = new tree.SelectorList();
        do {
            node.list.push(this.selector());
        } while(this.eat(','));
        node.lineno = node.list[0].lineno;
        return node;
    }

    // 简化处理，允许id、class、type插值
    selector() {
        let node = new tree.Selector();
        let selectorString = '';
        let token;
        let i = 0;
        while(true) {
            token = this.ll();
            if(token.type === '#{' && this.ll(2).type !== '}') {
                let interpolation = this.interpolation();
                if(interpolation) {
                    selectorString += '#{' + (i++) + '}';
                    node.interpolations.push(interpolation);
                } else
                    break;
            } else if(isSelectorSep(token.type)) {
                // >>>>>> 可以优化
                let value = token.type === 'DIMENSION' ? tree.toStr(token) : (token.value || (token.type === 'WS' ? ' ' : token.type));
                selectorString += value;
                this.next();
            } else
                break;
        }
        node.string = selectorString;
        node.lineno = token.lineno;
        return node;
    }

    declaration(noEnd) {
        let node = new tree.Declaration();
        let token1 = this.ll(1), token2 = this.ll(2);
        if(token1.type === '*' && token2.type === 'TEXT') {
            this.next(1);
            token2.value = '*' + token2.value;
        }
        // >>>>>>
        node.property = this.compoundIdent();
        // don't start with tag or don't ll(2) !== ':'
        if(!node.property)
            return;
        this.eat('WS');
        if(!this.eat(':'))
            return;

        // filter_declaration在IE下是支持一些不规则的语法
        if(node.property.value && /filter$/.test(node.property.value.toLowerCase()))
            this.enter(STATES.FILTER_DECLARATION);
        this.enter(STATES.TRY_DECLARATION);

        try {
            node.value = this.valuesList();
            this.leave(STATES.TRY_DECLARATION);
        }catch(error){
            this.leave(STATES.TRY_DECLARATION);
            if(error.code === errors.DECLARION_FAIL)
                return;
            else
                throw error;
        }

        if(this.eat('IMPORTANT'))
            node.important = true;
        if(!noEnd)
            this.matchSemiColonIfNoBlock();
        this.leave(STATES.FILTER_DECLARATION);
        return node;
    }

    assign() {
        let token = this.ll();
        this.match('VAR');
        let op = this.match('=', '?=', '^=').type;
        let value = this.assignExpr(true);
        //@FIXIT conflict with parenExpr
        return new tree.Assign(token.value, value, ASSIGNS[op] || 1);
    }

    /**function();
     * can be assign expression
     * function | valueslist | values
     * @param  {Boolean} hasComma whether has comma in the expression
     * @return {mixin}
     */
    assignExpr(hasComma) {
        let node = null;
        let token = this.ll();
        let fn = hasComma ? 'valuesList' : 'values';
        if(token.type === '{')    // 可能是parenExpr 也可能是function
            return this.func();
        else if(token.type === '(') {
            this.mark();
            try{
                return this.func();
            }catch(e){
                if(e.expect && e.expect == '{' || e.expect =='VAR' || e.expect == ')') {
                    this.restore();
                    return this[fn]();
                }else{
                    throw e;
                }
            }
        }else{
            return this[fn]();
        }
    }

    // 1px 1px #fff, 1px 1px #fff ...
    // comma separated values
    // valuesList
    valuesList() {
        let list = [];
        do {
            let values = this.values();
            if(values)
                list.push(values);
            else
                break;
        } while(this.eat(','));

        if(list.length === 1)
            return list[0];
        else
            return new tree.ValuesList(list);
    }
    // component Values
    values() {
        let list = [];
        while(true) {
            let value = this.expression();
            if(value)
                list.push(value);
            else
                break;
        }

        if(list.length === 0)
            return null;
        else if(list.length === 1)
            return list[0];
        else
            return new tree.Values(list);
    }

    expression() {
        this.eat('WS');
        return this.logicOrExpr();
    }

    // ||
    logicOrExpr() {
        let left = this.logicAndExpr(), right;
        let token;
        while((token = this.ll()).type === '||') {
            this.next();
            right = this.logicAndExpr();
            if(!right)
                this.error(token.type + ' require right operand', left);

            let bValue = tree.toBoolean(left);
            if(bValue !== null) {
                if(bValue === false)
                    left = right;
            } else
                left = new tree.Operator(token.type, left, right);
            this.eat('WS');
        }
        return left;
    }

    // &&
    logicAndExpr() {
        let node = this.relationExpr(), right;
        let token;
        while((token = this.ll()).type === '&&') {
            this.next();
            right = this.relationExpr();
            if(!right)
                this.error(token.type + ' require right operand', node);

            let bValue = tree.toBoolean(node);
            if(bValue != null) {
                if(bValue === true)
                    node = right;
            } else
                node = new tree.Operator(token.type, node, right)
            this.eat('WS');
        }
        return node;
    }

    // ==
    // !=
    // >=
    // <=
    // >
    // <
    relationExpr() {
        let left = this.binop1(), right;
        let token;
        while(isRelationOp(token = this.ll().type)){
            this.next();
            this.eat('WS');
            right = this.binop1();
            if(!right)
                this.error(token.type + ' require right operand', left);

            if(tree.isPrimary(left.type) && tree.isPrimary(right.type))
                left = binop.relation.call(this,left, right, token.type);
            else
                left = new tree.Operator(token.type, left, right)
            this.eat('WS');
        }
        return left;
    }

    // + -
    binop1() {
        let left = this.binop2(), right;
        let token;
        this.eat('WS');
        while((token = this.ll()).type === '+' || token.type === '-') {
            this.next();
            this.eat('WS');
            right = this.binop2();
            if(!right)
                this.error(la + ' require right operand', left)

            if(right.type === 'DIMENSION' && left.type === 'DIMENSION')
                left = binop[token.type].call(this, left, right);
            else
                left = new tree.Operator(token.type, left, right);
            this.eat('WS');
        }
        return left;
    }

    // * / % ... (@TODO 将range与binop2结合, 即同一优先级)
    binop2() {
        let left = this.unary(), right;
        let ws = !!this.eat('WS');

        let token = this.ll();
        // >>>>>>
        if(token.type === '...') {
            this.next();
            this.eat('WS');
            right = this.unary();
            return tree.range(left, right, left.lineno);
        }
        while(token.type === '*' || token.type === '/' || token.type === '%') {
            // 即一个空格也没有
            if(token.type == '/' && !ws && this.ll(2).type !== 'WS')
                return left;
            this.next();
            this.eat('WS');
            right = this.unary();
            if(!right)
                this.error(token.type + ' require right operand', left);

            if(right.type === 'DIMENSION' && left.type === 'DIMENSION')
                left = binop[token.type].call(this, left, right);
            else
                left = new tree.Operator(token.type, left, right);
            this.eat('WS');
            token = this.ll();
        }
        return left;
    }

    // range: function(){
    //     var left = this.ll(),
    //         node = new tree.ValuesList(),
    //         right, lc, rc, reverse;
    //     this.match('DIMENSION')
    //     this.eat('...');
    //     right = this.ll();
    //     this.match(left.type);
    //     lc = left.value;
    //     rc = right.value;
    //     reverse = lc > rc;

    //     for(; lc != rc ;){
    //         node.list.push({
    //             type: left.type,
    //             value: lc
    //         })
    //         if(reverse)  lc -= 1
    //         else lc += 1
    //     }
    //     node.list.push({
    //         type: left.type,
    //         value: lc
    //     })
    //     return node;
    // },

    // 一元数
    // @TODO : 加入 ！一元数
    unary() {
        let token = this.ll();
        if(token.type === '-' || token.type === '+' || token.type === '!' ) {
            this.next();
            this.eat('WS');
            let value = this.unary();
            var node = new tree.Unary(value, token.type);
            node.lineno = token.lineno;
            return node;
        } else
            return this.primary();
    }

    // primary
    //  : Ident
    //  : Dimension
    //  : function
    //  : Var
    primary() {
        let node = null;
        let token = this.ll();
        switch(token.type) {
            case '(':
                return this.parenExpr();
            case '=':
                // filter: alpha(xx=80, xx=xx, ddd=xx)
                if(this.state(STATES.FILTER_DECLARATION)
                    && this.state(STATES.FUNCTION_CALL)){
                    this.next();
                    return token;
                }
                break;
            case '/':
                this.next();
                return token;
            case '-':
                let token2 = this.ll(2);
                if(token2.type === 'TEXT' || token2.type === '#{')
                    return this.compoundIdent();
            case '#{':
            case 'TEXT':
                return this.compoundIdent();
            case 'FUNCTION':
                return this.fnCall();
            case 'HASH':
                this.next();
                let value = token.value;
                if(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)) {
                    node = new tree.Color(value);
                    node.lineno = token.lineno;
                } else
                    node = new tree.Unknown(token.value);
                return node;
            // TODO 插值
            case 'STRING':
            case 'DIMENSION':
            case 'BOOLEAN':
            case 'VAR':
            case 'NULL':
            case 'URL':
                this.next();
                return token;
            case '>':
            case '~':
            case '+':
            case '.':
            case '#':
            case '&':
            case '{':
            case ':':
            case '*':
            case 'PSEUDO_CLASS':
            case 'CLASS':
            case 'ATTRIBUTE':
                if(this.state(STATES.TRY_DECLARATION)) {
                    this.error(errors.DECLARION_FAIL);
                    break;
                }
            default:
                return null;
        }

    }


    //  : '#{' values '}'
    interpolation() {
        this.match('#{');
        let node = this.valuesList();
        this.match('}');
        return node;
    }

    // parenExpr
    //  : '(' expresion ')'
    parenExpr() {
        this.match('(');
        this.eat('WS');
        let node = this.valuesList();
        node.lineno = this.ll().lineno;
        this.eat('WS');
        this.match(')');
        return node;
    }

    // compoundIdent 组合Ident
    //  : (interpolation | TEXT) +
    compoundIdent() {
        let node;
        let list = [];
        let token;
        let sep;
        while(true) {
            token = this.ll();
            if(token.type === '#{') {
                sep = this.interpolation();
                list.push(sep);
            } else if(token.type === 'TEXT' || token.type === '-') {
                this.next();
                list.push(token.value || token.type);
            } else
                break;
        }
        if(!sep) {
            if(!list.length)
                return null;
            else
                return {type: 'TEXT', value: list[0], lineno: token.lineno};
        } else {
            node = new tree.CompoundIdent(list);
            node.lineno = token.lineno;
            return node;
        }
    }

    // fnCall
    //  : CALL FUNCTION '('  expresion * ')'
    fnCall() {
        let token = this.ll();
        this.match('FUNCTION', 'VAR');
        if(token.args)
            return new tree.Call(token.value, token.args, null, token.lineno);
        this.eat('WS');
        this.match('(');
        this.enter(STATES.FUNCTION_CALL);
        this.eat('WS');
        let pargs = this.ll().type !== ')' ? this.args() : {args:[]};
        this.leave(states.FUNCTION_CALL);
        this.match(')');
        return new tree.Call(token.value, pargs.args, pargs.named, token.lineno);
    }

    //@TODO start named arguments
    args(end) {
        let token;
        let named = null;
        let args = [];
        let i = 0;
        do {
            token = this.ll();
            if(token.type === 'VAR' && this.ll(2).type === '=') {
                this.next(2);
                if(!named) named = {};
                named[token.value] = i;
            }
            args.push(this.assignExpr());
            this.skip('WS');
            i++;
        } while(this.eat(','));

        return {args, named};
    }

    // stylus inspired feature;
    transparentCall() {
        let token = this.ll();
        this.match('VAR');
        this.match(':');
        this.eat('WS')
        var pargs = this.args();
        // if(args.type === 'values'){
        //     args = new tree.ValuesList(args.list);
        // }

        // if(args.type !== 'valueslist') args = [args];
        // else args = args.list;
        return tree.Call(token.value, pargs.args, pargs.named, token.lineno);
    }

    /**
     * remove at-rule prefix
     */
    _removePrefix(str) {
        return str.replace(/^-\w+-/, '');
    }

    matchSemiColonIfNoBlock() {
        this.eat('WS');
        if(this.ll().type !== '}')
            this.match(';');
    }
}

export default Parser;
