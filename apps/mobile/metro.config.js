const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Metro's file index misses some newly added files under the hoisted
// node_modules tree (notably @expo/vector-icons glyph maps). Fall back to disk.
const assetExts = new Set(config.resolver.assetExts ?? []);
config.resolver.resolveRequest = (context, moduleName, platform) => {
  try {
    return context.resolveRequest(context, moduleName, platform);
  } catch (error) {
    if (moduleName.startsWith('.')) {
      const filePath = path.resolve(path.dirname(context.originModulePath), moduleName);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).slice(1).toLowerCase();
        if (assetExts.has(ext)) return { type: 'assetFiles', filePaths: [filePath] };
        return { type: 'sourceFile', filePath };
      }
    }
    throw error;
  }
};
const apiTarget = process.env.EXPO_PUBLIC_API_PROXY ?? 'https://peopleos-henna.vercel.app';

config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    const url = req.url ?? '';
    if (!url.startsWith('/api/')) return middleware(req, res, next);

    const target = new URL(apiTarget);
    const transport = target.protocol === 'https:' ? https : http;
    const proxyReq = transport.request(
      {
        hostname: target.hostname,
        port: target.port || (target.protocol === 'https:' ? 443 : 80),
        path: url,
        method: req.method,
        headers: {
          ...req.headers,
          host: target.host,
        },
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
        proxyRes.pipe(res);
      },
    );
    proxyReq.on('error', (error) => {
      if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' });
      res.end(error.message);
    });
    req.pipe(proxyReq);
  };
};

module.exports = config;
