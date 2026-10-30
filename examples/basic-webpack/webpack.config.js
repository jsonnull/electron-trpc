const path = require('node:path');

module.exports = [
  {
    mode: 'production',
    target: 'electron-main',
    entry: './electron/index.js',
    output: { path: path.resolve(__dirname, '.webpack/main'), filename: 'index.js' },
  },
  {
    mode: 'production',
    target: 'web',
    entry: './src/index.js',
    output: { path: path.resolve(__dirname, '.webpack/renderer'), filename: 'index.js' },
  },
];
