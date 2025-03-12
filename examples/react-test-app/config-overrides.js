const webpack = require('webpack');

// You can modify the webpack config in here, for instance to add polyfills.
module.exports = function override(config, env) {
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

  // Handle webpack fallbacks
  config.resolve.fallback = {
    os: require.resolve('os-browserify/browser'),
    https: require.resolve('https-browserify'),
    http: require.resolve('stream-http'),
    stream: require.resolve('stream-browserify'),
    buffer: require.resolve('buffer/'),
  };
  
  config.ignoreWarnings = [/Failed to parse source map/];
  
  config.plugins.push(
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
    }),
  );
  
  return config;
}
