import express from 'express';
import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

/**
 * Boots an Express app that exposes one McpServer over the Streamable HTTP
 * transport at /mcp, protected by a static bearer token. Running this once
 * on a host you control (a VPS, Railway, Fly.io, ...) is what makes the
 * connector reachable from every device: each Claude Desktop / Claude Code
 * install just points at this same URL instead of running its own copy.
 */
export function startMcpHttpServer({ name, port, authToken, createServer, extraRoutes }) {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  app.get('/healthz', (_req, res) => res.status(200).json({ ok: true, service: name }));

  function requireAuth(req, res, next) {
    if (!authToken) return next(); // no token configured -> explicitly open (dev only)
    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme === 'Bearer' && token === authToken) return next();
    // Also accept ?token=... so a human can open /qr or /status directly in a
    // browser tab, where setting an Authorization header isn't practical.
    if (req.method === 'GET' && req.query?.token === authToken) return next();
    res.status(401).json({ error: 'unauthorized' });
  }

  if (extraRoutes) extraRoutes(app, requireAuth);

  const transports = new Map();

  app.all('/mcp', requireAuth, async (req, res) => {
    try {
      const sessionId = req.headers['mcp-session-id'];
      let transport = sessionId && transports.get(sessionId);

      if (!transport) {
        const server = createServer();
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id) => transports.set(id, transport),
        });
        transport.onclose = () => {
          if (transport.sessionId) transports.delete(transport.sessionId);
        };
        await server.connect(transport);
      }

      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error(`[${name}] request failed:`, err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'internal_error', message: String(err?.message ?? err) });
      }
    }
  });

  return app.listen(port, () => {
    console.log(`[${name}] listening on :${port} (mcp endpoint: POST/GET/DELETE /mcp)`);
    if (!authToken) {
      console.warn(`[${name}] WARNING: no auth token set — anyone who can reach this port has full access.`);
    }
  });
}
