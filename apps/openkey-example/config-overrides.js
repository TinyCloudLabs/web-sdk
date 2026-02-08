const webpack = require('webpack');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const path = require('path');

// Read package versions for display in the app
const openkeySdkVersion = require('@openkey/sdk/package.json').version;
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
              require('tailwindcss'),
              require('autoprefixer'),
              ...(loader.options.postcssOptions.plugins || []),
            ];
          }
        });
      }
    }
  }

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
  
  // Enable code splitting
  if (env === 'production') {
    config.optimization = {
      ...config.optimization,
      splitChunks: {
        chunks: 'all',
        maxInitialRequests: Infinity,
        minSize: 0,
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name(module) {
              // Get the name. E.g. node_modules/packageName/not/this/part.js
              // or node_modules/packageName
              const packageName = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/)[1];
              
              // Create separate chunks for large packages
              return `vendor.${packageName.replace('@', '')}`;
            },
          },
        },
      },
    };
  }
  
  return config;
}
