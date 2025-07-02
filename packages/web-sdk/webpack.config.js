const path = require('path');
const webpack = require('webpack');

const isProduction = process.argv.includes('--mode=production') || process.env.NODE_ENV === 'production';

module.exports = {
  mode: isProduction ? 'production' : 'development',
  entry: './src/index.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    fallback: {
      util: require.resolve('util/'),
      path: require.resolve('path-browserify'),
      buffer: require.resolve('buffer/'),
      os: require.resolve('os-browserify/browser'),
      url: require.resolve('url/'),
      stream: require.resolve('stream-browserify'),
      https: require.resolve('https-browserify'),
      assert: require.resolve('assert/'),
      http: require.resolve('stream-http'),
      fs: false,
      events: require.resolve('events/'),
      process: require.resolve('process/browser'),
    },
  },
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'dist'),
    library: '@tinycloudlabs/web-sdk',
    libraryTarget: 'umd',
    umdNamedDefine: true,
    globalObject: 'this',
  },
  optimization: {
    // Disable HMR and development optimizations in production
    ...(isProduction && {
      minimize: true,
      sideEffects: false,
    }),
  },
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    }),
    // Only add HMR plugin in development
    ...(!isProduction ? [new webpack.HotModuleReplacementPlugin()] : []),
  ],
};
