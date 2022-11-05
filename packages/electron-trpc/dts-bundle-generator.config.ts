const config = {
  compilationOptions: {
    preferredConfigPath: './tsconfig.json',
  },
  entries: [
    {
      filePath: './src/renderer/index.ts',
      outFile: `./renderer.d.ts`,
      noCheck: true,
    },
    {
      filePath: './src/main/index.ts',
      outFile: `./main.d.ts`,
      noCheck: true
    },
  ],
};

module.exports = config;
