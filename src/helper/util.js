// import fs from 'fs';
// import mkdirp from 'mkdirp';
// import path from 'path';
// import tpl from './tpl';
// import tpl from './tpl';

const returnTrue = () => true;

let _ = {
    accept(fn, list) {
        if(!list || !list.length)
            return;

        let tlist = list.map((item) => {
            if(!item)
                return returnTrue;

            if(typeof item === 'function')
                return item;

            return _.makePredicate(item);
        });


    },



};

/**
 * register regexp pattern
 * @return {[type]} [description]
 */
let $ = (function() {
    let table = {};
    return (name, pattern) => {
        if(!pattern) {
            if(/^[a-zA-Z]+$/.test(name))    // $('WS');
                return table[name];
            else {  // $(/.../);
                pattern = name;
                name = null;
            }
        }

        if(typeof pattern !== 'string')
            pattern = String(pattern).slice(1, -1);

        pattern = pattern.replace(/\{([a-zA-Z]+)}/g, (all, name) => {
            let p = table[name];
            if(!p)
                throw Error(`no register pattern ${name} before`);
            let pstart = p.charAt(0), pend = p.charAt(p.length - 1);
            if(!(pstart === '[' && pend === ']') && !(pstart === '(' && pend === ')'))
                p = '(?:' + p + ')';
            return p;
        });

        // register
        name && (table[name] = pattern);
        return new RegExp(pattern);
    }
})();

let toAssert = function(str) {
    let arr = typeof str === 'string' ? str.split(/\s+/) : str;
    return (word) => arr.includes(word);
}

let makePredicate = toAssert;

export {$, toAssert, makePredicate}
