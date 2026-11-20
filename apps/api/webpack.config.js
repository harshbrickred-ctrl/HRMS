module.exports = (options, webpack) => {
  const lazyImports = [
    '@nestjs/microservices/microservices-module',
    '@nestjs/websockets/socket-module',
    'class-transformer/storage',
  ];

  return {
    ...options,
    externals: {
      '@prisma/client': 'commonjs @prisma/client',
      '.prisma/client': 'commonjs .prisma/client',
      '@prisma/adapter-neon': 'commonjs @prisma/adapter-neon',
      '@neondatabase/serverless': 'commonjs @neondatabase/serverless',
      ws: 'commonjs ws',
      // Keep validators outside the bundle so whitelist metadata matches ValidationPipe.
      'class-validator': 'commonjs class-validator',
      'class-transformer': 'commonjs class-transformer',
    },
    output: {
      ...options.output,
      libraryTarget: 'commonjs2',
    },
    plugins: [
      ...options.plugins,
      new webpack.IgnorePlugin({
        checkResource(resource) {
          if (!lazyImports.includes(resource)) {
            return false;
          }
          try {
            require.resolve(resource);
          } catch {
            return true;
          }
          return false;
        },
      }),
    ],
  };
};
