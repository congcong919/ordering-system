const { Router } = require('express');
const http = require('http');
const logger = require('../utils/logger');

const router = Router();

function getAiOptions(method, aiPath) {
  const base = new URL(process.env.AI_AGENT_URL || 'http://localhost:8000');
  return {
    hostname: base.hostname,
    port: parseInt(base.port) || 8000,
    path: aiPath,
    method,
    headers: { 'content-type': 'application/json' },
  };
}

function proxy(method, aiPath) {
  return (req, res, next) => {
    const options = getAiOptions(method, aiPath);
    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });
    proxyReq.on('error', (err) => {
      logger.error('AI proxy error: %s', err.message);
      if (!res.headersSent) next(err);
    });
    if (method === 'POST' && req.body) {
      proxyReq.write(JSON.stringify(req.body));
    }
    proxyReq.end();
  };
}

// POST /api/ai/chat  →  FastAPI POST /api/chat  (SSE stream)
router.post('/chat', proxy('POST', '/api/chat'));

// DELETE /api/ai/session/:id  →  FastAPI DELETE /api/session/:id
router.delete('/session/:id', (req, res, next) =>
  proxy('DELETE', `/api/session/${req.params.id}`)(req, res, next)
);

module.exports = router;
