var tk = require('./tokenizer');
var functions = require('./functions');
var path = require('./helper/path');
var _ = require('./helper/util');
var io = require('./helper/io');
var options = require('./helper/options');
var error = require('./error');
var hooks = require('./hooks');
var helper = require('./helper');
var state = require('./state');


/**
 * 包装成stylus一样的接口口
 */


function Mcss(options){

    var walkers = this.get('walkers');
    if(!Array.isArray(walkers)) walkers = [walkers]
    this.set('walkers' , walkers.map(function(hook){
        if(typeof hook === 'string'){
            hook = hooks[hook];
        }
        return hook;
    }));
}

m.include = function(path){
    var pathes = this.get('pathes');
    if(Array.isArray(path)){
        this.set('pathes', pathes.concat(path))
    }else{
        pathes.push(path);
    }

    return this;
}


/**
 * define 变量或函数, 一般在初始化环境时调用
 */
m.define = _.msetter(function(key, value){
    if(typeof value === 'function'){
        functions[key] === value;
    }
    return this;
});

m.var2text = function(){
    var variables = this.options.variables;
    if(!variables)
        return '';

    var arr = [];
    for(var key in variables)
        if(variables.hasOwnProperty(key))
            arr.push('$' + key + '=' + variables[key] + ';');

    return arr.join('');
}



m.parse = function(text){
    var options = this.options,
        parser = new Parser(this.options),
        pr = promise(),
        var2text = this.var2text;

    if(text === undefined){
        if(this.get('filename')){

            io.get(this.options.filename).done(function(text){
                new Parser(options).parse(var2text() + text).always(pr);
            }).fail(pr)
        }else{
            throw Error('text or filename is required')
        }
    }else{
        parser.parse(this.var2text() + text).always(pr);
    }
    return pr;
}

var mcss = module.exports = function(options){
    return new Mcss(options || {})
}

// constructor
mcss.Parser = Parser;
mcss.Interpreter = Interpreter;
mcss.Translator = Translator;
mcss.Tokenizer = tk.Tokenizer;
mcss.node =  require('./node');


// usefull util
mcss.io = io;
mcss.promise = promise;
mcss._ = _;
mcss.error = error;
mcss.path = path;
mcss.helper = helper;
mcss.state = state;

// @TODO  connenct middle wire
mcss.connect = function(options){

    return function(){

    }
}

