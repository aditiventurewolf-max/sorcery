# Metabase & WhatsApp connectors for Claude

Two small MCP ("Model Context Protocol") servers that let Claude Desktop and
Claude Code talk to **Metabase** and **WhatsApp** — without needing a
Metabase API key or WhatsApp Business API access:

- **Metabase** — authenticates the same way you log into the Metabase web UI
  (username + password → session token), which is all the official REST API
  needs. No API key, no paid plan required.
- **WhatsApp** — uses [`whatsapp-web.js`](https://wwebjs.dev/), which drives
  WhatsApp Web the same way a browser would. You link it once by scanning a
  QR code (exactly like adding a linked device in the WhatsApp app) — no
  Business API application or approval needed.

## Why this setup is "cross-device"

Both connectors run as ordinary **remote MCP servers** (the Streamable HTTP
transport) instead of local stdio processes. That means:

- The process — and the WhatsApp login / Metabase session it holds — lives
  on **one host you control** (a small VPS, a $5-7/mo box on Railway/Render/
  Fly.io, or a spare machine on your network).
- Every device's Claude Desktop or Claude Code just points at that host's
  URL. You don't reinstall or re-link anything per device, and you don't
  need to run Node/Chromium on your laptop, work desktop, etc.
- Add a new device by pointing it at the same URL + token. Revoke access
  everywhere at once by rotating the token.

```
┌─────────────┐      ┌──────────────┐      ┌────────────┐
│ Claude on   │──┐   │  metabase-mcp │──────▶  Metabase   │
│ laptop      │  │   │  (your host)  │      │  instance   │
├─────────────┤  ├──▶├──────────────┤      └────────────┘
│ Claude on   │  │   │  whatsapp-mcp │──────▶ WhatsApp Web
│ work PC     │──┘   │  (your host)  │      │ (linked device)
├─────────────┤      └──────────────┘      └────────────┘
│ Claude on   │
│ phone/other │
└─────────────┘
```

## 1. Configure

```bash
cd connectors/metabase-mcp && cp .env.example .env   # fill in METABASE_URL etc.
cd ../whatsapp-mcp        && cp .env.example .env   # fill in a token
```

Generate a strong bearer token for each connector (they can be different):

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

Put it in `CONNECTOR_AUTH_TOKEN` in both `.env` files — this is the password
every Claude client will need to reach your connector, so treat it like one.

## 2. Run

**Locally (for testing):**

```bash
cd connectors/metabase-mcp && npm install && npm start   # http://localhost:8787
cd connectors/whatsapp-mcp && npm install && npm start   # http://localhost:8788
```

**With Docker Compose (for a real always-on deployment):**

```bash
cd connectors
docker compose up -d --build
```

This builds both images, keeps `whatsapp-mcp`'s session in a named volume
(`whatsapp-session`) so it survives restarts/redeploys, and restarts either
service automatically if it crashes.

Each connector is a separate process on its own port (metabase-mcp on
`8787`, whatsapp-mcp on `8788`) — deploy them as two services (e.g. two
Railway/Render/Fly apps, or two containers on one VPS) rather than trying to
merge them behind one path. Whichever way you run them, put a reverse proxy
with a real TLS certificate in front of each (Caddy, nginx + certbot, or
your platform's built-in HTTPS) — Claude Desktop's remote-connector support
and most `mcp-remote` setups expect **https**, and you don't want your
bearer token or WhatsApp messages going over plain HTTP on the internet.
The examples below assume you've mapped them to `https://metabase.your-host`
and `https://whatsapp.your-host`; substitute your actual hosts/ports
(`https://your-host:8787`, `https://your-host:8788`) if you're not using
subdomains.

## 3. Link WhatsApp (one-time)

Open `https://whatsapp.your-host/qr?token=YOUR_TOKEN` (or
`http://localhost:8788/qr?token=...` while testing locally) in a browser.
Scan the QR code from your phone: **WhatsApp → Settings → Linked devices →
Link a device**. The page auto-refreshes; once it says "Already linked"
you're done. Check `/status` any time to see connection state.

## 4. Point Claude at your connectors

### Claude Code (run once per device)

```bash
claude mcp add --transport http metabase https://metabase.your-host/mcp \
  --header "Authorization: Bearer YOUR_METABASE_TOKEN" -s user

claude mcp add --transport http whatsapp https://whatsapp.your-host/mcp \
  --header "Authorization: Bearer YOUR_WHATSAPP_TOKEN" -s user
```

`-s user` registers it for every project on that machine. Run the same two
commands on any other machine you use Claude Code from — they all talk to
the same hosted connector, so Metabase auth and the WhatsApp link only ever
happen once.

### Claude Desktop

First check **Settings → Connectors → Add custom connector** — recent
versions of Claude Desktop can add a remote MCP server URL directly, and
because connectors set up this way live on your Claude.ai account, they
show up automatically on every device (desktop, web, mobile) signed into
that account, with nothing to repeat per machine.

If your version doesn't have that (or doesn't support a plain bearer-token
header yet), use the [`mcp-remote`](https://www.npmjs.com/package/mcp-remote)
bridge in `claude_desktop_config.json` instead — this needs to be added
once per device, but each device still points at the same remote server:

```json
{
  "mcpServers": {
    "metabase": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://metabase.your-host/mcp",
        "--header",
        "Authorization: Bearer YOUR_METABASE_TOKEN"
      ]
    },
    "whatsapp": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://whatsapp.your-host/mcp",
        "--header",
        "Authorization: Bearer YOUR_WHATSAPP_TOKEN"
      ]
    }
  }
}
```

(Run `npx mcp-remote --help` if the flags above have moved on — it's a
third-party package that updates independently of this repo.)

## Tools exposed

**metabase-mcp:** `list_databases`, `list_dashboards`, `get_dashboard`,
`list_questions`, `get_question`, `run_question`, `run_sql`, `search`.

**whatsapp-mcp:** `get_status`, `send_message`, `list_chats`,
`get_messages`, `search_contacts`.

## Security notes

- Anyone with a connector's bearer token has full use of that tool —
  `run_sql` executes with whatever DB permissions the configured Metabase
  account has, and `send_message` sends as your linked WhatsApp account.
  Consider a read-only Metabase account/DB user if you only need reporting.
- Don't commit `.env` files or the `whatsapp-mcp/session/` directory (or the
  `whatsapp-session` Docker volume) — both are already git-ignored, and
  both grant full access if leaked.
- Put both services behind HTTPS and rotate the tokens if you ever suspect
  they've leaked.
