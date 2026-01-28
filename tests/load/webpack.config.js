const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: {
    'products-load.test': './tests/load/api/products-load.test.ts',
    'user-journey.test': './tests/load/e2e/user-journey.test.ts',
    'search-load.test': './tests/load/api/search-load.test.ts',
  },
  output: {
    path: path.resolve(__dirname, '../load/compiled'),
    filename: '[name].js',
    libraryTarget: 'commonjs',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'babel-loader',
        exclude: /node_modules/,
      },
    ],
  },
  target: 'web',
  externals: /^(k6|https?:\/\/)(\/.*)?/,
  stats: {
    colors: true,
  },
  plugins: [
    new CleanWebpackPlugin(),
  ],
};
