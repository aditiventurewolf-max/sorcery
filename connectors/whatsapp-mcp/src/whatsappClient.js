import pkg from 'whatsapp-web.js';
import QRCode from 'qrcode';

const { Client, LocalAuth } = pkg;

/**
 * Wraps whatsapp-web.js (an unofficial client that drives WhatsApp Web the
 * same way your browser would) so no WhatsApp Business API access, token,
 * or approval is required — just linking a device once by scanning a QR
 * code, exactly like adding a linked device in the WhatsApp app.
 *
 * The session is persisted to disk (LocalAuth) so a restart does not
 * require re-scanning, as long as the data directory survives.
 */
export class WhatsAppConnector {
  constructor({ dataPath, puppeteerExecutablePath }) {
    this.state = { status: 'starting', qrDataUrl: null, info: null, lastError: null };

    this.client = new Client({
      authStrategy: new LocalAuth({ dataPath }),
      puppeteer: {
        headless: true,
        executablePath: puppeteerExecutablePath || undefined,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
    });

    this.client.on('qr', async (qr) => {
      this.state.status = 'awaiting_qr_scan';
      this.state.qrDataUrl = await QRCode.toDataURL(qr);
    });

    this.client.on('authenticated', () => {
      this.state.status = 'authenticated';
      this.state.qrDataUrl = null;
    });

    this.client.on('ready', () => {
      this.state.status = 'ready';
      this.state.qrDataUrl = null;
      this.state.info = this.client.info ?? null;
    });

    this.client.on('auth_failure', (msg) => {
      this.state.status = 'auth_failure';
      this.state.lastError = String(msg);
    });

    this.client.on('disconnected', (reason) => {
      this.state.status = 'disconnected';
      this.state.lastError = String(reason);
    });

    this.readyPromise = this.client.initialize().catch((err) => {
      this.state.status = 'init_failed';
      this.state.lastError = String(err?.message ?? err);
    });
  }

  getStatus() {
    const { qrDataUrl, ...rest } = this.state;
    return { ...rest, hasQrPending: Boolean(qrDataUrl) };
  }

  _ensureReady() {
    if (this.state.status !== 'ready') {
      throw new Error(
        `WhatsApp is not linked yet (status: ${this.state.status}). Open the connector's /qr page in a browser ` +
          'and scan it from WhatsApp on your phone (Settings > Linked devices > Link a device).'
      );
    }
  }

  async _resolveChatId(to) {
    if (to.includes('@')) return to;
    const digits = to.replace(/[^\d]/g, '');
    const numberId = await this.client.getNumberId(digits);
    if (!numberId) throw new Error(`"${to}" is not a WhatsApp number (or isn't reachable from this account)`);
    return numberId._serialized;
  }

  async sendMessage(to, message) {
    this._ensureReady();
    const chatId = await this._resolveChatId(to);
    const sent = await this.client.sendMessage(chatId, message);
    return { id: sent.id?._serialized ?? sent.id, to: chatId, timestamp: sent.timestamp };
  }

  async listChats(limit = 20) {
    this._ensureReady();
    const chats = await this.client.getChats();
    return chats.slice(0, limit).map((chat) => ({
      id: chat.id._serialized,
      name: chat.name,
      isGroup: chat.isGroup,
      unreadCount: chat.unreadCount,
      lastMessage: chat.lastMessage
        ? { body: chat.lastMessage.body, fromMe: chat.lastMessage.fromMe, timestamp: chat.lastMessage.timestamp }
        : null,
    }));
  }

  async getMessages(chatId, limit = 20) {
    this._ensureReady();
    const chat = await this.client.getChatById(chatId);
    const messages = await chat.fetchMessages({ limit });
    return messages.map((m) => ({
      id: m.id._serialized,
      from: m.from,
      fromMe: m.fromMe,
      body: m.body,
      timestamp: m.timestamp,
      hasMedia: m.hasMedia,
    }));
  }

  async searchContacts(query) {
    this._ensureReady();
    const contacts = await this.client.getContacts();
    const q = query.toLowerCase();
    return contacts
      .filter((c) => (c.name?.toLowerCase().includes(q) || c.pushname?.toLowerCase().includes(q) || c.number?.includes(query)))
      .slice(0, 25)
      .map((c) => ({ id: c.id._serialized, name: c.name ?? c.pushname ?? null, number: c.number, isMyContact: c.isMyContact }));
  }
}
