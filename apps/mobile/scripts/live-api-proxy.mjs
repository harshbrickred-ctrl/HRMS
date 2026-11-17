import http from 'node:http';
import https from 'node:https';

const PORT = 3099;
const TARGET = 'peopleos-api.vercel.app';

function corsHeaders(req) {
  return {
    'access-control-allow-origin': req.headers.origin || 'http://localhost:8081',
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers':
      req.headers['access-control-request-headers'] || 'content-type,authorization',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    vary: 'Origin',
  };
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(req));
    res.end();
    return;
  }

  const headers = { ...req.headers, host: TARGET };
  delete headers.origin;
  delete headers.referer;

  const upstream = https.request(
    {
      hostname: TARGET,
      path: req.url,
      method: req.method,
      headers,
    },
    (upstreamRes) => {
      const responseHeaders = { ...upstreamRes.headers, ...corsHeaders(req) };
      delete responseHeaders['content-length'];
      res.writeHead(upstreamRes.statusCode || 502, responseHeaders);
      upstreamRes.pipe(res);
    },
  );

  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(502, corsHeaders(req));
    res.end('Upstream unavailable');
  });
  req.pipe(upstream);
});

server.listen(PORT, '127.0.0.1');
