const webpack = require('webpack');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

// You can modify the webpack config in here, for instance to add polyfills.
module.exports = function override(config, env) {
  // Remove ModuleScopePlugin to allow imports from monorepo root node_modules
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

  // Force all react imports to resolve to the app's local React 18
  // (prevents dual-React when hoisted root has React 19)
  const path = require('path');
  const localReact = path.resolve(__dirname, 'node_modules/react');
  const localReactDom = path.resolve(__dirname, 'node_modules/react-dom');
  config.resolve.alias = {
    ...config.resolve.alias,
    'react': localReact,
    'react/jsx-runtime': path.resolve(localReact, 'jsx-runtime.js'),
    'react/jsx-dev-runtime': path.resolve(localReact, 'jsx-dev-runtime.js'),
    'react-dom': localReactDom,
    'react-dom/client': path.resolve(localReactDom, 'client.js'),
  };

  // Handle webpack fallbacks - only include essential ones
  config.resolve.fallback = {
    buffer: require.resolve('buffer/'),
    process: require.resolve('process/browser'),
    // MetaMask SDK includes React Native code paths not needed in browser
    '@react-native-async-storage/async-storage': false,
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
