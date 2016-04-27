import Tokenizer from '../../src/tokenizer.js';
import Parser from '../../src/parser.js';

let content = `
.u-btn {
    background: red;
}
`;
let content2 = '$test = $abc; $test = 4px;';
let content3 = `
.u-btn, .test {}
`;

let tokenizer = new Tokenizer();
let parser = new Parser();

let tokens = tokenizer.tokenize(content);
let ast = parser.parse(tokens);

console.log(ast);
