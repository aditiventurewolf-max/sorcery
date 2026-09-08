/**
 * Thin client for Metabase's REST API using session-token auth
 * (POST /api/session with a username/password), so no Metabase API key
 * or paid tier is required — a normal Metabase login works. If an API key
 * *is* available (Metabase 0.49+, "Settings > Admin > API Keys"), set
 * METABASE_API_KEY instead and it's used directly, skipping login.
 */

// Metabase's {{name}} template-tag syntax — used both to find which tags a
// query references and to validate every one of them has a declaration
// before the query ever reaches Metabase (undeclared tags aren't parsed at
// all: {{x}} and the [[ ]] brackets around it are left as literal text,
// which is what gets sent straight to the database and fails there).
const TAG_REF_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

function extractTagNames(query) {
  return [...new Set([...query.matchAll(TAG_REF_PATTERN)].map((m) => m[1]))];
}

function buildTemplateTags(templateTags, query) {
  const referenced = extractTagNames(query);
  const declared = new Map((templateTags ?? []).map((t) => [t.name, t]));

  const missing = referenced.filter((name) => !declared.has(name));
  if (missing.length > 0) {
    throw new Error(
      `Query references {{${missing.join('}}, {{')}}} but templateTags doesn't declare ${missing.length === 1 ? 'it' : 'them'}. ` +
        'Every {{tag}} in the SQL needs a matching entry in templateTags, or Metabase silently leaves it as literal ' +
        'text (including the surrounding [[ ]] brackets) instead of turning it into a filter — which is what the ' +
        'database then fails on.'
    );
  }

  const tags = {};
  for (const t of templateTags ?? []) {
    if (!referenced.includes(t.name)) continue; // drop tags no longer referenced after an edit
    const tag = {
      id: t.id ?? crypto.randomUUID(),
      name: t.name,
      'display-name': t.displayName ?? t.name,
      type: t.type,
    };
    if (t.type === 'dimension') {
      if (!t.dimensionFieldId) throw new Error(`Template tag "${t.name}" has type "dimension" but no dimensionFieldId`);
      tag.dimension = ['field', t.dimensionFieldId, null];
      tag['widget-type'] = t.widgetType ?? 'string/=';
    }
    if (t.default !== undefined) tag.default = t.default;
    tags[t.name] = tag;
  }
  return tags;
}

function shortId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 8);
}

function slugify(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

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

  runNativeQuery({ databaseId, query, templateTags, parameters }) {
    const tags = buildTemplateTags(templateTags, query);
    return this._request('/api/dataset', {
      method: 'POST',
      body: {
        type: 'native',
        native: { query, 'template-tags': tags },
        database: databaseId,
        parameters: (parameters ?? []).map((p) => ({
          type: tags[p.name]?.type === 'dimension' ? tags[p.name]['widget-type'] ?? 'category' : tags[p.name]?.type ?? 'category',
          target: ['variable', ['template-tag', p.name]],
          value: p.value,
        })),
      },
    });
  }

  search(q, { models } = {}) {
    return this._request('/api/search', { query: { q, models } });
  }

  listTableFields(tableId) {
    return this._request(`/api/table/${encodeURIComponent(tableId)}/query_metadata`);
  }

  createQuestion({ name, databaseId, query, templateTags, display, description, collectionId }) {
    const tags = buildTemplateTags(templateTags, query);
    return this._request('/api/card', {
      method: 'POST',
      body: {
        name,
        description: description ?? null,
        dataset_query: { type: 'native', native: { query, 'template-tags': tags }, database: databaseId },
        display: display ?? 'table',
        visualization_settings: {},
        collection_id: collectionId ?? null,
      },
    });
  }

  async updateQuestion(id, { name, description, query, databaseId, templateTags, display }) {
    const body = {};
    if (name !== undefined) body.name = name;
    if (description !== undefined) body.description = description;
    if (display !== undefined) body.display = display;
    if (query !== undefined) {
      // dataset_query isn't a partial-mergeable field — Metabase needs the
      // whole query object, so pull the current database + tags forward
      // unless the caller is also changing them.
      const current = databaseId === undefined || templateTags === undefined ? await this.getCard(id) : null;
      // GET returns the newer pMBQL shape (dataset_query.stages[0]) even
      // though POST/PUT still accept the legacy {type,native,database}
      // shape for writes — read from whichever is present.
      const currentTags = current && (current.dataset_query.stages?.[0]?.['template-tags'] ?? current.dataset_query.native?.['template-tags']);
      const tagsInput =
        templateTags ??
        Object.values(currentTags ?? {}).map((t) => ({
          name: t.name,
          type: t.type,
          displayName: t['display-name'],
          default: t.default,
          dimensionFieldId: t.dimension?.[1],
          widgetType: t['widget-type'],
        }));
      body.dataset_query = {
        type: 'native',
        native: { query, 'template-tags': buildTemplateTags(tagsInput, query) },
        database: databaseId ?? current.dataset_query.database,
      };
    }
    return this._request(`/api/card/${encodeURIComponent(id)}`, { method: 'PUT', body });
  }

  archiveQuestion(id) {
    return this._request(`/api/card/${encodeURIComponent(id)}`, { method: 'PUT', body: { archived: true } });
  }

  restoreQuestion(id) {
    return this._request(`/api/card/${encodeURIComponent(id)}`, { method: 'PUT', body: { archived: false } });
  }

  createDashboard({ name, description, collectionId }) {
    return this._request('/api/dashboard', {
      method: 'POST',
      body: { name, description: description ?? null, collection_id: collectionId ?? null },
    });
  }

  archiveDashboard(id) {
    return this._request(`/api/dashboard/${encodeURIComponent(id)}`, { method: 'PUT', body: { archived: true } });
  }

  restoreDashboard(id) {
    return this._request(`/api/dashboard/${encodeURIComponent(id)}`, { method: 'PUT', body: { archived: false } });
  }

  async addQuestionToDashboard({ dashboardId, questionId, row, col, sizeX, sizeY, dashboardTabId }) {
    const dashboard = await this.getDashboard(dashboardId);
    const existing = (dashboard.dashcards ?? []).map((dc) => ({
      id: dc.id,
      card_id: dc.card_id,
      row: dc.row,
      col: dc.col,
      size_x: dc.size_x,
      size_y: dc.size_y,
      series: dc.series ?? [],
      parameter_mappings: dc.parameter_mappings ?? [],
      visualization_settings: dc.visualization_settings ?? {},
      dashboard_tab_id: dc.dashboard_tab_id ?? null,
    }));

    const targetTabId = dashboardTabId ?? existing[0]?.dashboard_tab_id ?? null;
    const cardsOnTargetTab = existing.filter((dc) => dc.dashboard_tab_id === targetTabId);
    const defaultRow = cardsOnTargetTab.reduce((max, dc) => Math.max(max, dc.row + dc.size_y), 0);

    const newCard = {
      id: -1,
      card_id: questionId,
      row: row ?? defaultRow,
      col: col ?? 0,
      size_x: sizeX ?? 12,
      size_y: sizeY ?? 8,
      series: [],
      parameter_mappings: [],
      visualization_settings: {},
      dashboard_tab_id: targetTabId,
    };

    return this._request(`/api/dashboard/${encodeURIComponent(dashboardId)}`, {
      method: 'PUT',
      body: { dashcards: [...existing, newCard] },
    });
  }

  /**
   * Adds a dashboard-level filter widget (e.g. Metabase's "All Options"
   * relative-date picker — the "Previous 7 days / Previous 30 days / All
   * time" dropdown) and wires it to one or more cards' template tags in one
   * call. This is what actually produces that dropdown; a plain question
   * template tag on its own only gets a single value/date input.
   */
  async addDashboardFilter({ dashboardId, name, type, sectionId, default: defaultValue, mapTo }) {
    const dashboard = await this.getDashboard(dashboardId);
    const parameterId = shortId();
    const parameter = {
      id: parameterId,
      name,
      slug: slugify(name),
      type,
      ...(sectionId ? { sectionId } : {}),
      ...(defaultValue !== undefined ? { default: defaultValue } : {}),
    };

    const mapToByCard = new Map(mapTo.map((m) => [m.dashcardId ?? `card:${m.cardId}`, m]));

    const dashcards = (dashboard.dashcards ?? []).map((dc) => {
      const mapping = mapToByCard.get(dc.id) ?? mapToByCard.get(`card:${dc.card_id}`);
      const parameterMappings = [...(dc.parameter_mappings ?? [])];
      if (mapping) {
        parameterMappings.push({
          parameter_id: parameterId,
          card_id: dc.card_id,
          target: ['variable', ['template-tag', mapping.tagName]],
        });
      }
      return {
        id: dc.id,
        card_id: dc.card_id,
        row: dc.row,
        col: dc.col,
        size_x: dc.size_x,
        size_y: dc.size_y,
        series: dc.series ?? [],
        parameter_mappings: parameterMappings,
        visualization_settings: dc.visualization_settings ?? {},
        dashboard_tab_id: dc.dashboard_tab_id ?? null,
      };
    });

    return this._request(`/api/dashboard/${encodeURIComponent(dashboardId)}`, {
      method: 'PUT',
      body: { parameters: [...(dashboard.parameters ?? []), parameter], dashcards },
    });
  }
}
