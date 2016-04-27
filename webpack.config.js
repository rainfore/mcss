module.exports = {
    entry: './test/specs/parser.js',
    watch: true,
    output: {
        filename: 'mcss.js',
        path: __dirname + '/tmp',
        libraryTarget: 'umd'
    },
    devtool: 'eval-source-map',
    module: {
        loaders: [
            { test: /\.js$/, exclude: /node_modules/, loader: 'babel-loader' }
        ]
    }
}
