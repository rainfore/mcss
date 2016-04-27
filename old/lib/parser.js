/**
 * lineno 每个node都要
 */



module.exports = Parser;
var tk = require('./tokenizer');
var tree = require('./node');
var directive = require('./node/directive');
var _ = require('./helper/util');
var binop = require('./helper/binop');
var promise = require('./helper/promise');
var options = require('./helper/options');
var path = require('./helper/path');
var fs = require('fs');
var sysUrl = require('url');
var symtab = require('./symtab');
var state = require('./state');
var error = require('./error');
var io = require('./helper/io');
var remoteFileCache = state.remoteFileCache;


var perror = new Error();
var slice = [].slice;
var errors = {
    INTERPOLATE_FAIL: 1,
    DECLARION_FAIL:2,
    FILE_NOT_FOUND: 3
}

var assignMap = {
    '=': 1,
    '?=': 2,
    '^=': 3
}

// nodejs spec API







var isNeg = function(ll){
    return ll.type === 'DIMENSION' && ll.value < 0;
}

var isProbablyModulePath = function(path){
    return /^[-\w]/.test(path) && !(/:/.test(path));
}


Parser.prototype = {

        try{
            var p = new promise();
            // @TODO: 这些要与import 合并 2013/5/12 0:29:42
            if(typeof tks === 'string'){
                var filename = this.get('filename');
                if(filename && !this.get('imports')[filename]){
                    this.get('imports')[filename] = tks;
                }
                tks = tk.tokenize(tks, this.options);
            }
            // symbol table
            this.scope = this.options.scope || new symtab.Scope();
            // this.setInput(input, options)
            this.promises = [];

            var ast = this.stylesheet();
        }catch(e){
            return p.reject(e);
        }
        // callback
        var self = this;
        if(this.promises.length){
            promise.when.apply(this, this.promises).done(function(){
                return p.resolve(ast);
            }).fail(function(err1){
                p.reject(err1);
            })
        }else{
            return p.resolve(ast);
        }
        return p;
    },






    error: function(msg, ll, expect){
        if(typeof msg === 'number') {
            perror.code = msg
            perror.message = 'Uncauched Error'
            throw perror;
        }
        var lineno = ll.lineno || ll;
        var err = new error.SyntaxError(msg, lineno, this.options)
        if(expect) err.expect = expect;
        throw err;
    },
    // parse Function
    // ===================
    // 1.main






    extend: function(){
        var ll = this.match('AT_KEYWORD');
        this.eat('WS');
        var node = tree.extend(this.selectorList());
        node.lineno = ll.lineno;
        this.matchSemiColonIfNoBlock();
        return node;
        // if(la === 'IDENT' || la === 'CLASS'){
        //     var mixin = this.scope.resolve(ll.value);
        //     if(!mixin) {
        //         this.error('undefined mixin -> ' + ll.value);
        //     }
        //     if(mixin.refs === undefined){
        //         this.error('not a expected type mixin -> ' + ll.value);
        //     }else{
        //         this.next();
        //         node = new tree.Extend();
        //         node.mixin = mixin;
        //         this.matcheNewLineOrSemeColon();
        //         return node;
        //     }
        // }
    },
    return: function(){
        this.match('AT_KEYWORD');
        this.eat('WS');
        var value = this.assignExpr(true);
        var node = new tree.ReturnStmt(value);
        this.skip('WS');
        if(value && value.type !== 'func'){
            this.matchSemiColonIfNoBlock();
        }
        return node;
    },
    // @import Ident?  url media_query_list
    // @import xx ()
    import: function(){
        var node, url, queryList,ll,la, self = this;
        this.match('AT_KEYWORD');
        this.eat('WS');
        ll = this.ll();
        la = this.la();

        if(la === 'STRING' || la ==='URL'){
            url = ll;
            this.next();
        }else{
            this.error('expect URL or STRING' + ' got '+ ll.type, ll.lineno);
        }
        this.eat('WS');
        if(!this.eat(';')){
            queryList = this.media_query_list();
            this.matchSemiColonIfNoBlock();
        }
        var node = new tree.Import(url, queryList)
            ,extname = path.extname(url.value),
            filename, stat, p;
        if(extname === '.css'){
            if(this.get('importCSS')){

            }
        }
        if(extname !== '.css' || this.get('importCSS')){
            if(!extname) url.value += '.mcss';
            var p =this._import(url, node).done(function(ast){
                if(ast){
                    node.stylesheet = ast;
                }
            });

            this.promises.push(p);
        }
        return node;
    },
    abstract: function(){
        var la, url, ruleset;
        this.match('AT_KEYWORD');
        this.eat('WS');
        if((la = this.la()) !== '{'){
            // @abstract 'test/url.mcss'
            if(url = this.eat('STRING', 'URL')){
                var node = new tree.Import(url);
                var p =this._import(url, node).done(function(ast){
                    if(ast){
                        node.stylesheet = ast.abstract();
                    }
                });
                this.promises.push(p);
                this.matchSemiColonIfNoBlock();
                return node;
            }else{
                // @absctract tag .classname{
                //      .......
                // }
                ruleset = this.ruleset();
                ruleset.abstract = true;
                return ruleset;
            }
        // @abstarct {
        //   .......
        // }
        }else{
            var list = this.block()
                .abstract().list;
            return list;
        }
    },
    url: function(){
        return this.match('STRING', 'URL');
    },
    // ifStatement(test, cons, alt)
    // test: expression
    // block: block
    // alt: stmt
    if: function(){
        this.match('AT_KEYWORD');
        var test = this.expression(),
            block = this.block(),alt, ll;
        this.eat('WS');
        ll = this.ll();
        if(ll.type == 'AT_KEYWORD'){
            if(ll.value === 'else'){
                this.next();
                this.eat('WS')
                alt = this.block();
            }
            if(ll.value === 'elseif'){
                alt = this.if();
            }
        }
        return new tree.IfStmt(test, block, alt);
    },
    // 'FOR' $item, $i of item1, item2, itme3...
    // 'FOR' $value, $key of key1 value1, key2 value2...
    // WARNING:
    //  mcss's hashmap is fake from valueslist
    //  __for example__
    //  $maps =
    //      name (value, value),
    //      name2 value,
    //      name3 (value31, value32);
    //
    // add 'by' to resolve the while requirement
    // inspired by Roole thx :)
    for: function(){
        var element, index, list,
            of, block, by;
        this.match('AT_KEYWORD');
        this.eat('WS');
        element = this.ll().value;
        this.match('VAR');
        if(this.eat(',')){
            index = this.ll().value;
            this.match('VAR')
        }
        this.eat('WS');
        if(this.ll().value === 'by'){
            this.next();
            this.eat('WS');
            by = this.expression();
            this.eat('WS');
        }
        of = this.match('TEXT');
        if(of.value !== 'of' && of.value !=='in'){
            this.error('for statement need of or in KEYWORD but got:' + of.value, of.lineno)
        }
        list = this.valuesList();
        this.eat('WS');
        block = this.block();
        return new tree.ForStmt(element, index, list, block, of.value == 'in', by)
    },
    // interpolate accept expression
    // inter_exp
    //  : ident
    //  : list literal
    //  ;
        // literal: function(){

    // },
    // // list中只能有基本类型
    // list: function(){
    //     var list = [this.expression()];
    //     while(this.eat(',')){
    //         list.push(this.expression());
    //     }
    //     if(list.length ===1) return list[0];
    //     return new tree.List(list);
    // },
    // range: function(){
    //     var node = tree.Range();
    //     node.start = this.ll().value.number, end;
    //     this.match('DIMENSION');
    //     this.match('...');
    //     node.end = this.ll().value.number;
    //     return node;
    // },


    //      media
    // ==================
    // media
    //   : MEDIA media_query_list;
    //   |
    //
    // media_query_list
    //   : media_query_list , media_query;
    //   |

    // media_query
    //   : media_query_prefixer

    // media_query_prefixer
    //   : media_query_prefixer

    // media_query_keyword
    //   :

    // media_query_expression
    //   :

    media: function(){
        this.match('AT_KEYWORD');
        this.eat('WS');
        var list = this.media_query_list();
        this.skip('WS');
        var block = this.block();
        return new tree.Media(list, block)
    },
    // [<media_query>[',' <media_query>]*]?
    media_query_list: function(){
        var list = [];
        do{
            list.push(this.media_query());
        }while(this.eat(','))
        return list;
    },
    // [only | not]? <media_type> [and <expression>]*
    // | <expression> [and <expression>]*
    media_query: function(){
        var expressions = [], ll, type = '';
        if(this.la() === '('){
            expressions.push(this.media_expression());
        }else{
            ll = this.ll();
            if(ll.value === 'only' || ll.value === 'not'){
                type = ll.value;
                this.next(1);
                this.eat('WS');
                ll = this.ll();
            }
            this.match('TEXT');
            type += (type? ' ': '') + ll.value;
        }
        this.eat('WS');
        while( (ll = this.ll()).type === 'TEXT'&& ll.value === 'and'){
            this.next();
            this.eat('WS');
            expressions.push(this.media_expression());
            this.eat('WS')
        }
        return new tree.MediaQuery(type, expressions);
    },
    // '('<media_feature>[:<value>]?')'
    media_expression: function(){
        var feature,value
        this.match('(');
        this.eat('WS');
        feature = this.expression();
        if(this.eat(':')){
            value = this.valuesList();
        }
        this.eat('WS');
        this.match(')');
        return new tree.MediaExpression(feature, value);
    },
    // @font-face{font-family:name;src:<url>;sRules;}
    // "font-face": function(){
    //     this.match('AT_KEYWORD');
    //     this.eat('WS');
    //     return new tree.FontFace(this.block());
    // },
    // @keyframes <identifier> '{' keyframe* '}'
    keyframes: function(){
        var lineno = this.ll().lineno;
        this.match('AT_KEYWORD');
        this.eat('WS');
        var name = this.expression();
        if(!name) this.error('@keyframes\'s name should specify', lineno);
        if(name.type === 'FUNCTION'){
            this.eat('WS');
            this.match('(');
            this.eat('WS');
        }
        this.eat('WS');
        var block = this.block();
        // this.match('{')
        // this.eat('WS');
        // var list = [];
        // while(!this.eat('}')){
        //     list.push(this.keyframe());
        //     this.eat('WS');
        // }
        var node = new tree.Keyframes(name, block);
        return node
    },
    //
    //[ [ from | to | <percentage> ] [, from | to | <percentage> ]* block ]*
    keyframe: function(){
        var steps = [];
        do{
           steps.push(this.expression());
        }
        while(this.eat(','))
        var block = this.block();
        return new tree.Keyframe(steps, block);
    },
    page: function(){
        var keyword = this.match('AT_KEYWORD');
        this.eat('WS');
        var selector = this.complexSelector().string;
        // if(/^:[-a-zA-Z]+$/.test(selector) === false) this.error('@page only accept PSEUDO_CLASS', keyword.lineno)
        this.eat('WS');
        var block = this.block();
        return tree.directive('page', tk.createToken('TEXT', selector, keyword.lineno), block);
    },
    debug: function(){
        this.match('AT_KEYWORD');
        this.eat('WS');
        var value= this.valuesList();
        var node =new tree.Debug(value);
        this.matchSemiColonIfNoBlock();
        return node;
    },
    // TODO: 对vain中的所有
    // @vain selectorList
    // @vain 'url' | url()
    // @vain block;
    vain: function(){
        var selector, block;
        this.match('AT_KEYWORD');
        this.eat('WS');
        if(this.la() !== '{'){
            selector = this.selectorList();
        }else{
            block = this.block();
        }
    }

    func: function(){
        var params,
            block, lineno = this.ll().lineno;
        if(this.eat('(')){
            this.eat('WS');
            var params = this.params();
            this.match(')');
        }
        block = this.block();
        return new tree.Func(params, block);
    },
    params: function(){
        var rest = 0, params = [];
        if(this.la() !== ')'){
            do{
                var param = this.param();
                if(param.rest) rest++;
                params.push(param);
            }while(this.eat(','))
            if(rest >=2) this.error('can not have more than 2 rest param', lineno);
            this.eat('WS');
        }
        return params
    },
    // mixin' params
    param: function(){
        var ll = this.ll(),
            name = ll.value,
            dft, rest = false;
        this.match('VAR');
        if(this.eat('...')){
            rest = true
        }
        if(this.eat('=')){
            if(rest) this.error('rest type param can"t have default params', ll)
            dft = this.values();
        }
        return new tree.Param(name, dft, rest);
    },












    //@TODO start named arguments
    args: function(end){
        var ll, expr,
            args = [],
            named = null,i = 0;

        do{
            var ll = this.ll();
            if(ll.type === 'VAR' && this.la(2) === '='){
                this.next(2);
                if(!named) named = {};
                named[ll.value] = i;
            }
            args.push(this.assignExpr())
            this.skip('WS');
            i++;
        }while(this.eat(','))

        return {
            args: args,
            named: named
        }
    },
    // stylus inspired feature;
    transparentCall: function(){
        var ll = this.ll();
        var name = ll.value;
        this.match('VAR');
        this.match(':');
        this.eat('WS')
        var pargs = this.args();
        // if(args.type === 'values'){
        //     args = new tree.ValuesList(args.list);
        // }

        // if(args.type !== 'valueslist') args = [args];
        // else args = args.list;
        return tree.call(name, pargs.args, pargs.named, ll.lineno);
    },
    // private function
    // inspect lookahead array
    _lookahead: function(){
        return this.lookahead.map(function(item){
            return item.type
        }).join(',')
    },

    /**
     * pass a filename(any format, nec/reset.mcss, etc) get a promise to detect success
     * any atrule want to load other module will use this method
     * _import also has some operating to exec;
     *
     * @param  {String} url       the file(path or url) to load
     * @return {promise}          the parse promise
     *                            the promise doneCallback will accept a ast parsed by parser
     */
    _import: function(url, node){
        var pathes = this.get('pathes'),
            extname = path.extname(url.value);
        // // the promise passed to this.promises
        //     readyPromise = promise();

        // browser env is not support include
        if(!path.isFake && pathes.length && isProbablyModulePath(url.value)){
            var inModule = pathes.some(function(item){
                filename = path.join(item, url.value);
                try{
                    stat = fs.statSync(filename);
                    if(stat.isFile()) return true;
                }catch(e){}
            })
        }
        if(!inModule){
            //@TODO is abs
            if(/^\/|:\//.test(url.value)){//abs
                var filename = url.value;
                if(/^(https|http):\/\//.test(filename)){
                    var isRemote = true
                }
            }else{//relative
                var base = path.dirname(this.options.filename),filename;
                if(/^(https|http):\/\//.test(base) && sysUrl){
                    filename = sysUrl.resolve(this.options.filename, url.value)
                    isRemote = true;
                }else{
                    filename = path.join(base, url.value);
                }
            }
        }

        filename += (extname? '':'.mcss');
        var options = _.extend({filename: filename}, this.options);
        var self = this;
        // beacuse  parser is stateless(all symbol & scope defined in interpret step)
        // mcss' require-chain's checking is veryeasy
        var _requires = this.get('_requires');
        if(_requires && ~_requires.indexOf(filename)){
            this.error('it is seems file:"' + filename + '" and file: "'+this.get('filename')+'" has Circular dependencies', url.lineno);
        }

        options._requires = _requires?
            _requires.concat([this.get('filename')]):
            [this.get('filename')];

        var pr = promise();
        var imports = this.get('imports'),
            text = imports[filename];
        // in cache now;
        // @TODO, allow import twice?
        if(typeof text === 'string' || (isRemote && (text = remoteFileCache.get(filename))) ){
            new Parser(options).parse(text).always(pr);
        }else{
            io.get(filename).done(function(text){
                if(isRemote){
                    remoteFileCache.set(filename, text);
                }else{
                    imports[filename] = text;
                }

                new Parser(options).parse(text).always(pr).fail(pr);
            }).fail(function(){
                var err = new error.SyntaxError(filename + ' FILE NOT FOUND', url.lineno, self.options);
                pr.reject(err)
            })
        }
        // @TODO 修改为只检查文件 io.get
        return pr.done(function(ast){
                node.filename = filename;
            })
    },

    /**
     * remove at-rule的prefix
     */
    _removePrefix: function(str){
        return str.replace(/^-\w+-/, '');
    }
}

options.mixTo(Parser);

