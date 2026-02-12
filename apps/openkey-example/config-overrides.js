const webpack = require('webpack');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const path = require('path');

// Read package versions for display in the app
const openkeySdkPkgPath = path.join(path.dirname(require.resolve('@openkey/sdk')), '..', 'package.json');
const openkeySdkVersion = require(openkeySdkPkgPath).version;
const webSdkVersion = require(path.resolve(__dirname, '../../packages/web-sdk/package.json')).version;

// You can modify the webpack config in here, for instance to add polyfills.
module.exports = function override(config, env) {
  // Remove ModuleScopePlugin to allow imports from hoisted monorepo node_modules
  config.resolve.plugins = config.resolve.plugins.filter(
    plugin => plugin.constructor.name !== 'ModuleScopePlugin'
  );
  // Add bundle analyzer in analyze mode
  if (process.env.ANALYZE) {
    config.plugins.push(
      new BundleAnalyzerPlugin({
        analyzerMode: 'server',
        analyzerPort: 8888,
      })
    );
  }
  // Add PostCSS with Tailwind
  const oneOfRule = config.module.rules.find(rule => rule.oneOf);
  if (oneOfRule) {
    const cssRule = oneOfRule.oneOf.find(
      rule => rule.test && rule.test.toString().includes('css')
    );
    if (cssRule) {
      if (cssRule.use) {
        cssRule.use.forEach(loader => {
          if (loader.options && loader.options.postcssOptions) {
            loader.options.postcssOptions.plugins = [
              require('@tailwindcss/postcss'),
              require('autoprefixer'),
            ];
          }
        });
      }
    }
  }

  // Force single React instance — in a monorepo, multiple resolution paths
  // can cause libs like next-themes to get a different React than the app,
  // breaking useContext(). require.resolve finds the actual installed copy.
  config.resolve.alias = {
    ...config.resolve.alias,
    react: path.dirname(require.resolve('react/package.json')),
    'react-dom': path.dirname(require.resolve('react-dom/package.json')),
  };

  // Handle webpack fallbacks - only include essential ones
  config.resolve.fallback = {
    buffer: require.resolve('buffer/'),
    process: require.resolve('process/browser'),
  };

  // Handle ESM modules
  config.resolve.extensionAlias = {
    ".js": [".js", ".ts", ".tsx"]
  };
  
  config.ignoreWarnings = [/Failed to parse source map/];
  
  config.plugins.push(
    new webpack.ProvidePlugin({
      process: 'process/browser.js',
      Buffer: ['buffer', 'Buffer'],
    }),
    new webpack.DefinePlugin({
      'window.__OPENKEY_SDK_VERSION__': JSON.stringify(openkeySdkVersion),
      'window.__WEB_SDK_VERSION__': JSON.stringify(webSdkVersion),
    }),
  );

  // Add specific handling for framer-motion ESM issues
  config.module.rules.push({
    test: /\.m?js$/,
    resolve: {
      fullySpecified: false
    }
  });
  
  return config;
}
