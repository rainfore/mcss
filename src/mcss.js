import Parser from './parser';
import Interpreter from './interpreter';
import Translator from './translator';
// import {tokenize}

/**
 * @class MCSS
 * @classdesc
 *
 * @constructor
 */
class MCSS {
    constructor(options = {}) {
        // >>>>>>> ?
        if(typeof options.prefix === 'string')
            options.prefix = options.prefix.split(/\s+/);

        this.options = Object.assign({
            imports: {},
            importCSS: false,
            pathes: [],
            walkers: [],
            format: 1,
            sourcemap: false,
            variables: {}
        }, options);

        // let walkers >>>>>>>>
        this.options.walkers = this.options.walkers.map((hook) => {
            if(typeof hook === 'string')
                hook = hooks[hook];
            return hook;
        });


    }

    include(path) {
        let pathes = this.options.pathes;
        if(Array.isArray(path))
            this.options.pathes = [...pathes, ...path];
        else
            pathes.push(path);
        return this;
    }

    walk(type) {
        if(typeof type === 'string') {
            let walker = {};
            walker[type] = arguments[1];
        } else
            walker = type;

        this.options.walkers.push(walker);
        return this;
    }

    /**
     * 词法分析
     * @param  {[type]} text [description]
     * @return {[type]}      [description]
     */
     tokenize(text) {
        return tk.tokenize(text, this.options);
     }

    /**
     * 解析Parser
     * @param  {String} text 如果已经在mcss实例中传入了filename并且存在可以不传入text
     * @return {[type]}
     */
    parse(text) {
        let parser = new Parser(this.options);
        // var2text

        return new Promise((resolve, reject) => {
            if(text === undefined) {}

        });
    }

    /**
     * 解析并输出AST，ast中只包含标准CSS的节点
     * @param  {String|Null} text 如果已经在mcss实例中传入了filename并且存在可以不传入text
     * @return {Stylesheet}
     */
     interpret(text) {
        let interpreter = new Interpreter(this.options);

        this.walker.forEach(function(hook) {
            hook && interpreter.on(hook);
        });

        return this.parse(text).then((ast) => {
            return interpreter.interpret(ast);
        });
     }

     translate(text) {
        let translator = new Translator(options);

        return this.interpret(text).then((ast) => {
            return translator.translate(ast);
        });
     }
}

export default MCSS;
