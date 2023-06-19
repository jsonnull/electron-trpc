module.exports = {
  trailingComma: 'es5',
  tabWidth: 2,
  singleQuote: true,
  printWidth: 100,
  overrides: [
    {
      files: 'docs/index.md',
      options: {
        printWidth: 60,
      },
    },
  ],
};
