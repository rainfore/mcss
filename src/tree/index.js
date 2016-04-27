class Node {
    constructor() {

    }

    clone() {

    }
}

class StyleSheet {
    constructor(list = []) {
        this.list = list;
    }

    clone() {
        // >>>>>> cloneNode没有实现
        return new StyleSheet(cloneNode(this.list));
    }

    // >>>>>> 不知道作用
    exclude() {
        var ret = [];
        for(let i = this.list.length; i--;) {
            let item = this.list[i];
            if(item.type === 'media')
                ret.unshift(list.splice(i, 1)[0]);
        }
        return ret;
    }

    abstract() {
        this.list.forEach((ruleset) => ruleset && (ruleset.abstract = true));
        return this;
    }
}

class SelectorList {
    constructor(list = [], lineno) {
        this.list = list;
        this.lineno = lineno;
    }

    clone() {
        return new SelectorList(cloneNode(this.list));
    }

    length() {
        return this.list.length;
    }
}

// 复选择器
class Selector {
    constructor(string, interpolations = []) {
        this.string = string;
        this.interpolations = interpolations;
    }

    clone() {
        return new ComplexSelector(this.string, cloneNode(this.interpolations));
    }
}

class RuleSet {
    constructor(selector, block, abstract = false) {
        this.selector = selector;
        this.block = block;
        // >>>>>> @TODO for mixin
        this.ref = [];
        this.abstract = abstract;
    }

    addRef(ruleset) {
        if(!this.ref.includes(item))
            this.ref.push(ruleset);
    }

    getSelectors() {
        if(this.selector._compute === true)
            return this.selector.list;

        let selectors = this.selector.list;
        let plist;
        if(this.parent && (plist = this.parent.getSelectors()) && plist.length)
            selectors = this._concatSelector(selectors, plist);

        if(!this.parent)
            this.selector.list.forEach((selector) =>
                selector.string = selector.string.replace(/&/g, ''));

        if(this.ref.length) {
            this.ref.forEach((ruleset) =>
                selectors = [...selectors, ...ruleset.getSelectors()]);
            this.ref = [];
        }

        this.selector.list = selectors;
        this.selector._compute = true;
        return selectors;
    }

}

class Block {
    constructor(list = []) {
        this.list = list;
    }

    exclude(isMedia) {
        let ret = [];
    }
}

class Declaration {
    constructor(property, value, important = false) {
        Object.assign(this, {property, value, important});
    }
}

class ValuesList {
    constructor(list = [], lineno) {
        this.list = list;
        this.lineno = lineno;
    }

    flatten() {
        var list = this.list,
            i = list.length,
            values;
        for(;i--;){
            values = list[i];
            if(values.type == 'valueslist'){
                splice.apply(list, [i, 1].concat(values.list));
            }
        }
        return this;
    }

    first() {
        return this.list[0].list[0];
    }
}

class Values {
    constructor(list = []) {
        this.list = list;
    }

    flatten() {
        var list = this.list,
            i = list.length,
            value;
        for(;i--;){
            value = list[i];
            if(value.type == 'values'){
                splice.apply(this, [i, 1].concat(value.list));
            }
        }
        return this;
    }
}

// 所有侦测不出的类似统一放置在这里
class Unknown {
    constructor(name) {
        this.name = name;
    }
}

class Assign {
    constructor(name, value, mode = 1) {
        Object.assign(this, {name, value, mode});
    }
}

class Operator {
    constructor(op, left, right) {
        Object.assign(this, {op, left, right});
    }
}

class Range {
    constructor(left, right) {
        this.left = left;
        this.right = right;
    }
}

class Unary {
    constructor(value, op) {
        this.value = value;
        this.op = op;
    }
}

class Dimension {
    constructor(value, unit) {
        this.value = value;
        this.unit = unit;
    }

    toString() {
        return this.value + (this.unit || '');
    }
}

class CompoundIdent {
    constructor(list = []) {
        this.list = list;
    }

    toString() {
        return this.list.join('');
    }
}


export {
    Node,
    StyleSheet,
    RuleSet,
    SelectorList,
    Selector,
    Block,
    Declaration,
    ValuesList,
    Values,
    Unknown,
    Assign,
    Operator,
    Range,
    Unary,
    Dimension
}
