import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { WhatsAppConnector } from './whatsappClient.js';
import { startMcpHttpServer } from './httpServer.js';

const PORT = Number(process.env.PORT ?? 8788);
const AUTH_TOKEN = process.env.CONNECTOR_AUTH_TOKEN;

const whatsapp = new WhatsAppConnector({
  dataPath: process.env.WHATSAPP_SESSION_PATH || './session',
  puppeteerExecutablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
});

function createServer() {
  const server = new McpServer({ name: 'whatsapp-mcp', version: '1.0.0' });

  server.registerTool(
    'get_status',
    {
      title: 'WhatsApp connection status',
      description: 'Check whether this connector is linked to a WhatsApp account and ready to send/read messages.',
    },
    async () => asText(whatsapp.getStatus())
  );

  server.registerTool(
    'send_message',
    {
      title: 'Send a WhatsApp message',
      description: 'Send a text message to a phone number (with country code, e.g. +14155551234) or an existing chat ID.',
      inputSchema: {
        to: z.string().describe('Phone number with country code, or a WhatsApp chat ID like 1234567890@c.us'),
        message: z.string().describe('Text to send'),
      },
    },
    async ({ to, message }) => asText(await whatsapp.sendMessage(to, message))
  );

  server.registerTool(
    'list_chats',
    {
      title: 'List WhatsApp chats',
      description: 'List recent chats (individual and group), most recently active first.',
      inputSchema: { limit: z.number().int().min(1).max(100).default(20).optional() },
    },
    async ({ limit }) => asText(await whatsapp.listChats(limit))
  );

  server.registerTool(
    'get_messages',
    {
      title: 'Get messages from a WhatsApp chat',
      description: 'Fetch recent messages from a specific chat by its ID (see list_chats for IDs).',
      inputSchema: {
        chatId: z.string().describe('Chat ID, e.g. 1234567890@c.us or ...@g.us for a group'),
        limit: z.number().int().min(1).max(200).default(20).optional(),
      },
    },
    async ({ chatId, limit }) => asText(await whatsapp.getMessages(chatId, limit))
  );

  server.registerTool(
    'search_contacts',
    {
      title: 'Search WhatsApp contacts',
      description: 'Search contacts by name or phone number substring.',
      inputSchema: { query: z.string() },
    },
    async ({ query }) => asText(await whatsapp.searchContacts(query))
  );

  return server;
}

function asText(value) {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

startMcpHttpServer({
  name: 'whatsapp-mcp',
  port: PORT,
  authToken: AUTH_TOKEN,
  createServer,
  extraRoutes(app, requireAuth) {
    app.get('/status', requireAuth, (_req, res) => res.json(whatsapp.getStatus()));

    app.get('/qr', requireAuth, (_req, res) => {
      const { status, qrDataUrl } = whatsapp.state;
      if (status === 'ready') {
        return res.send(page('<h1>Already linked ✅</h1><p>This connector is already connected to WhatsApp.</p>'));
      }
      if (!qrDataUrl) {
        return res.send(page(`<h1>Waiting…</h1><p>Status: <code>${status}</code>. Refresh in a few seconds.</p><script>setTimeout(()=>location.reload(),3000)</script>`));
      }
      res.send(
        page(
          `<h1>Scan to link WhatsApp</h1>
           <p>Open WhatsApp on your phone &rarr; Settings &rarr; Linked devices &rarr; Link a device, then scan this code.</p>
           <img src="${qrDataUrl}" width="300" height="300" alt="WhatsApp QR code" />
           <script>setTimeout(()=>location.reload(),15000)</script>`
        )
      );
    });
  },
});

function page(body) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>whatsapp-mcp</title>
    <style>body{font-family:system-ui,sans-serif;max-width:480px;margin:48px auto;text-align:center;color:#222}</style>
  </head><body>${body}</body></html>`;
}
