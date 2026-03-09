
const path = require("path");
const webpack = require("webpack");

const modeIdx = process.argv.indexOf('--mode');
const isProduction = process.env.NODE_ENV === "production" ||
  (modeIdx >= 0 && process.argv[modeIdx + 1] === 'production') ||
  process.argv.includes('--mode=production');

const rules = [
  {
    test: /\.tsx?$/,
    use: "ts-loader",
    exclude: /node_modules/,
  },
  {
    // Handle ES modules properly
    test: /\.m?js$/,
    resolve: {
      fullySpecified: false,
    },
  },
];

const plugins = [
  new webpack.ProvidePlugin({
    Buffer: ["buffer", "Buffer"],
    process: "process/browser",
  }),
  // Handle node: scheme imports by removing the node: prefix
  new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
    resource.request = resource.request.replace(/^node:/, "");
  }),
  // Replace @noble/hashes/crypto import to use browser version
  new webpack.NormalModuleReplacementPlugin(
    /@noble\/hashes\/crypto$/,
    path.resolve(__dirname, "src/polyfills/noble-crypto-browser.mjs")
  ),
];

const resolveConfig = {
  extensions: [".tsx", ".ts", ".js", ".mjs"],
  // Add conditionNames to properly resolve ES modules with browser support
  conditionNames: ["browser", "import", "require", "default"],
  // Enable browser field support
  mainFields: ["browser", "module", "main"],
  fallback: {
    // Existing polyfills
    util: require.resolve("util/"),
    path: require.resolve("path-browserify"),
    buffer: require.resolve("buffer/"),
    os: require.resolve("os-browserify/browser"),
    url: require.resolve("url/"),
    stream: require.resolve("stream-browserify"),
    https: require.resolve("https-browserify"),
    assert: require.resolve("assert/"),
    http: require.resolve("stream-http"),
    events: require.resolve("events/"),
    process: require.resolve("process/browser"),

    // Additional polyfills for missing modules
    crypto: require.resolve("crypto-browserify"),
    zlib: require.resolve("browserify-zlib"),
    vm: require.resolve("vm-browserify"),

    // These modules don't work in browsers, so we disable them
    fs: false,
    net: false,
    tls: false,
    child_process: false,

    // Handle node: scheme imports
    "node:crypto": false,  // Disable node:crypto entirely for browser
    "node:buffer": require.resolve("buffer/"),
    "node:util": require.resolve("util/"),
    "node:stream": require.resolve("stream-browserify"),
    "node:path": require.resolve("path-browserify"),
    "node:events": require.resolve("events/"),
    "node:url": require.resolve("url/"),
    "node:vm": require.resolve("vm-browserify"),
    "node:fs": false,
    "node:net": false,
    "node:tls": false,
    "node:os": require.resolve("os-browserify/browser"),
  },
};

const baseConfig = {
  mode: isProduction ? "production" : "development",
  entry: "./src/index.ts",
  devtool: isProduction ? false : 'eval-source-map',
  module: { rules },
  resolve: resolveConfig,
  optimization: {
    // Disable HMR and development optimizations in production
    ...(isProduction && {
      minimize: true,
      sideEffects: false,
    }),
  },
  plugins,
};

const cjsConfig = {
  ...baseConfig,
  output: {
    filename: "index.cjs",
    path: path.resolve(__dirname, "dist"),
    library: {
      type: "commonjs2",
    },
  },
};

module.exports = cjsConfig;
