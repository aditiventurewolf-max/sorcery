/**
 * Thin client for Metabase's REST API using session-token auth
 * (POST /api/session with a username/password), so no Metabase API key
 * or paid tier is required — a normal Metabase login works. If an API key
 * *is* available (Metabase 0.49+, "Settings > Admin > API Keys"), set
 * METABASE_API_KEY instead and it's used directly, skipping login.
 */
export class MetabaseClient {
  constructor({ baseUrl, username, password, apiKey }) {
    if (!baseUrl) throw new Error('METABASE_URL is required');
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.username = username;
    this.password = password;
    this.apiKey = apiKey;
    this.sessionToken = null;
    this.loginPromise = null;

    if (!apiKey && !(username && password)) {
      throw new Error('Set either METABASE_API_KEY, or METABASE_USERNAME + METABASE_PASSWORD');
    }
  }

  async _login() {
    const res = await fetch(`${this.baseUrl}/api/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: this.username, password: this.password }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Metabase login failed (${res.status}): ${text}`);
    }
    const data = await res.json();
    this.sessionToken = data.id;
    return this.sessionToken;
  }

  async _authHeaders() {
    if (this.apiKey) return { 'X-API-Key': this.apiKey };
    if (!this.sessionToken) {
      this.loginPromise ??= this._login().finally(() => { this.loginPromise = null; });
      await this.loginPromise;
    }
    return { 'X-Metabase-Session': this.sessionToken };
  }

  async _request(path, { method = 'GET', body, query, retrying = false } = {}) {
    const url = new URL(`${this.baseUrl}${path}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, v);
      }
    }

    const headers = { 'Content-Type': 'application/json', ...(await this._authHeaders()) };
    const res = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });

    if (res.status === 401 && !this.apiKey && !retrying) {
      // session expired (they last ~14 days by default) — relogin once and retry
      this.sessionToken = null;
      return this._request(path, { method, body, query, retrying: true });
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Metabase API ${method} ${path} failed (${res.status}): ${text}`);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  listDatabases() {
    return this._request('/api/database', { query: { include: 'tables' } });
  }

  listDashboards() {
    return this._request('/api/dashboard');
  }

  getDashboard(id) {
    return this._request(`/api/dashboard/${encodeURIComponent(id)}`);
  }

  listCards() {
    return this._request('/api/card');
  }

  getCard(id) {
    return this._request(`/api/card/${encodeURIComponent(id)}`);
  }

  runCard(id, parameters) {
    return this._request(`/api/card/${encodeURIComponent(id)}/query`, {
      method: 'POST',
      body: parameters ? { parameters } : {},
    });
  }

  runNativeQuery({ databaseId, query, templateTags }) {
    return this._request('/api/dataset', {
      method: 'POST',
      body: {
        type: 'native',
        native: { query, 'template-tags': templateTags ?? {} },
        database: databaseId,
      },
    });
  }

  search(q, { models } = {}) {
    return this._request('/api/search', { query: { q, models } });
  }
}
