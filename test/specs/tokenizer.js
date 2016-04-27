import Tokenizer from '../../src/tokenizer.js';

let tokenizer = new Tokenizer();
let tokens = tokenizer.tokenize(`
.u-btn {
    background: red;
}
`);

console.log(tokens.map((token) =>
    typeof token.value === 'string' ? token.value : '').join(''));
