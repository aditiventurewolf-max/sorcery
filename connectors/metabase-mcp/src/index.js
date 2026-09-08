import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { MetabaseClient } from './metabaseClient.js';
import { startMcpHttpServer } from './httpServer.js';

const PORT = Number(process.env.PORT ?? 8787);
const AUTH_TOKEN = process.env.CONNECTOR_AUTH_TOKEN;

const metabase = new MetabaseClient({
  baseUrl: process.env.METABASE_URL,
  username: process.env.METABASE_USERNAME,
  password: process.env.METABASE_PASSWORD,
  apiKey: process.env.METABASE_API_KEY,
});

const templateTagSchema = z
  .array(
    z.object({
      name: z.string().describe('Must exactly match the {{name}} used in the SQL'),
      type: z
        .enum(['text', 'number', 'date', 'dimension'])
        .describe(
          '"text"/"number"/"date" substitute a single literal value where {{name}} appears. "dimension" is a ' +
            'Field Filter bound to a real column (needs dimensionFieldId, from list_table_fields) — required for ' +
            'a proper relative-date dropdown ("past 7 days" etc.) via add_dashboard_filter, and for the tag to be ' +
            'used as a whole boolean condition like "WHERE {{name}}" rather than a scalar substitution.'
        ),
      displayName: z.string().optional(),
      default: z.any().optional(),
      dimensionFieldId: z.number().int().optional().describe('Required when type is "dimension" — the column\'s field ID from list_table_fields'),
      widgetType: z
        .string()
        .optional()
        .describe('Widget for a dimension tag, e.g. "date/all-options" for the full relative-date picker (defaults to "string/=")'),
    })
  )
  .optional()
  .describe(
    'Declare one entry per {{tag}} referenced in the SQL. Required whenever the query contains {{...}} — ' +
      'without a matching declaration Metabase leaves it as literal text (including any surrounding [[ ]] ' +
      'brackets) instead of parsing it as a filter, and the raw SQL sent to the database breaks.'
  );

function createServer() {
  const server = new McpServer({ name: 'metabase-mcp', version: '1.0.0' });

  server.registerTool(
    'list_databases',
    {
      title: 'List Metabase databases',
      description: 'List every database connection configured in Metabase, including their tables.',
    },
    async () => asText(await metabase.listDatabases())
  );

  server.registerTool(
    'list_dashboards',
    { title: 'List Metabase dashboards', description: 'List all dashboards visible to this Metabase account.' },
    async () => asText(await metabase.listDashboards())
  );

  server.registerTool(
    'get_dashboard',
    {
      title: 'Get a Metabase dashboard',
      description: 'Fetch a dashboard by ID, including its layout and the questions/cards placed on it.',
      inputSchema: { dashboardId: z.number().int().describe('Numeric dashboard ID') },
    },
    async ({ dashboardId }) => asText(await metabase.getDashboard(dashboardId))
  );

  server.registerTool(
    'list_questions',
    {
      title: 'List Metabase questions',
      description: 'List all saved questions (cards) visible to this Metabase account.',
    },
    async () => asText(await metabase.listCards())
  );

  server.registerTool(
    'get_question',
    {
      title: 'Get a Metabase question',
      description: 'Fetch a saved question (card) definition by ID, including its underlying query.',
      inputSchema: { questionId: z.number().int().describe('Numeric question/card ID') },
    },
    async ({ questionId }) => asText(await metabase.getCard(questionId))
  );

  server.registerTool(
    'run_question',
    {
      title: 'Run a saved Metabase question',
      description: 'Execute a saved question (card) by ID and return its result rows. Optionally pass Metabase dashboard/question filter parameters.',
      inputSchema: {
        questionId: z.number().int().describe('Numeric question/card ID'),
        parameters: z.array(z.record(z.any())).optional().describe('Metabase parameter objects, same shape as the Metabase API expects'),
      },
    },
    async ({ questionId, parameters }) => asText(await metabase.runCard(questionId, parameters))
  );

  server.registerTool(
    'run_sql',
    {
      title: 'Run raw SQL against a Metabase database',
      description:
        'Run a native SQL query against one of the databases connected to Metabase and return the result rows. ' +
        'Use list_databases first to find the databaseId. Prefer read-only queries — this executes with ' +
        'whatever permissions the configured Metabase account has. If the SQL uses {{tags}}, declare them in ' +
        'templateTags and pass their values in parameters.',
      inputSchema: {
        databaseId: z.number().int().describe('Numeric database ID from list_databases'),
        query: z.string().describe('Raw SQL to execute'),
        templateTags: templateTagSchema,
        parameters: z
          .array(z.object({ name: z.string(), value: z.any() }))
          .optional()
          .describe('Values for the declared templateTags — falls back to each tag\'s default if omitted'),
      },
    },
    async ({ databaseId, query, templateTags, parameters }) =>
      asText(await metabase.runNativeQuery({ databaseId, query, templateTags, parameters }))
  );

  server.registerTool(
    'list_table_fields',
    {
      title: 'List a table\'s columns',
      description:
        'List a table\'s columns with their Metabase field IDs — needed to set up a "dimension" (Field Filter) ' +
        'template tag. Get tableId from list_databases (each database\'s tables array).',
      inputSchema: { tableId: z.number().int() },
    },
    async ({ tableId }) => asText(await metabase.listTableFields(tableId))
  );

  server.registerTool(
    'search',
    {
      title: 'Search Metabase',
      description: 'Search dashboards, questions, collections, etc. by name.',
      inputSchema: { query: z.string().describe('Search text') },
    },
    async ({ query }) => asText(await metabase.search(query))
  );

  server.registerTool(
    'create_question',
    {
      title: 'Create a saved Metabase question',
      description:
        'Save a SQL query as a new Metabase question (card), so it can be re-run or edited later instead of ' +
        're-pasting the query every time. Use list_databases first to find the databaseId. If the SQL uses ' +
        '{{tags}}, declare them in templateTags.',
      inputSchema: {
        name: z.string().describe('Question name, as it will appear in Metabase'),
        databaseId: z.number().int().describe('Numeric database ID from list_databases'),
        query: z.string().describe('SQL to save'),
        templateTags: templateTagSchema,
        display: z
          .enum(['table', 'scalar', 'line', 'bar', 'row', 'pie', 'area', 'combo'])
          .optional()
          .describe('Visualization type (defaults to table)'),
        description: z.string().optional(),
        collectionId: z.number().int().optional().describe('Collection to save it into (defaults to root)'),
      },
    },
    async (args) => asText(await metabase.createQuestion(args))
  );

  server.registerTool(
    'update_question',
    {
      title: 'Edit a saved Metabase question',
      description:
        'Update an existing question (card) in place — change its SQL, name, or description without creating a ' +
        'new question or breaking dashboards/links that reference it. If query changes and templateTags is ' +
        'omitted, the question\'s existing tags are kept as-is (any no longer referenced in the new SQL are ' +
        'dropped); pass templateTags to change the tags themselves.',
      inputSchema: {
        questionId: z.number().int().describe('Numeric question/card ID to update'),
        query: z.string().optional().describe('New SQL, if changing it'),
        templateTags: templateTagSchema,
        name: z.string().optional(),
        description: z.string().optional(),
        databaseId: z.number().int().optional().describe('Only needed if moving the question to a different database'),
      },
    },
    async ({ questionId, ...updates }) => asText(await metabase.updateQuestion(questionId, updates))
  );

  server.registerTool(
    'archive_question',
    {
      title: 'Archive a Metabase question',
      description: 'Archive (soft-delete) a question. It can be restored from Metabase\'s trash later.',
      inputSchema: { questionId: z.number().int() },
    },
    async ({ questionId }) => asText(await metabase.archiveQuestion(questionId))
  );

  server.registerTool(
    'restore_question',
    {
      title: 'Restore an archived Metabase question',
      description: 'Un-archive a question, restoring it from Metabase\'s trash.',
      inputSchema: { questionId: z.number().int() },
    },
    async ({ questionId }) => asText(await metabase.restoreQuestion(questionId))
  );

  server.registerTool(
    'create_dashboard',
    {
      title: 'Create a Metabase dashboard',
      description: 'Create a new, empty dashboard. Use add_question_to_dashboard to place questions on it.',
      inputSchema: {
        name: z.string(),
        description: z.string().optional(),
        collectionId: z.number().int().optional().describe('Collection to save it into (defaults to root)'),
      },
    },
    async (args) => asText(await metabase.createDashboard(args))
  );

  server.registerTool(
    'archive_dashboard',
    {
      title: 'Archive a Metabase dashboard',
      description: 'Archive (soft-delete) a dashboard. It can be restored from Metabase\'s trash later.',
      inputSchema: { dashboardId: z.number().int() },
    },
    async ({ dashboardId }) => asText(await metabase.archiveDashboard(dashboardId))
  );

  server.registerTool(
    'restore_dashboard',
    {
      title: 'Restore an archived Metabase dashboard',
      description: 'Un-archive a dashboard, restoring it from Metabase\'s trash.',
      inputSchema: { dashboardId: z.number().int() },
    },
    async ({ dashboardId }) => asText(await metabase.restoreDashboard(dashboardId))
  );

  server.registerTool(
    'add_question_to_dashboard',
    {
      title: 'Add a question to a dashboard',
      description:
        'Place an existing saved question onto a dashboard. Without row/col/sizeX/sizeY it auto-places the ' +
        'card below whatever is already there (half-width by default) — layout can always be fine-tuned ' +
        "afterward by dragging cards around in Metabase's own UI.",
      inputSchema: {
        dashboardId: z.number().int(),
        questionId: z.number().int(),
        row: z.number().int().optional(),
        col: z.number().int().optional(),
        sizeX: z.number().int().optional().describe('Width in grid units (defaults to 12, half of a 24-wide grid)'),
        sizeY: z.number().int().optional().describe('Height in grid units (defaults to 8)'),
        dashboardTabId: z.number().int().optional().describe('Which tab to add it to, for dashboards that use tabs'),
      },
    },
    async (args) => asText(await metabase.addQuestionToDashboard(args))
  );

  server.registerTool(
    'add_dashboard_filter',
    {
      title: 'Add a dashboard filter widget',
      description:
        'Add a dashboard-level filter (e.g. a relative-date dropdown with "Previous 7 days / Previous 30 days / ' +
        'All time" presets) and wire it to one or more cards\' template tags. This is what produces that ' +
        'dropdown — for it to actually filter a query, that query\'s tag should usually be a "dimension" ' +
        '(Field Filter) tag; see create_question\'s templateTags.',
      inputSchema: {
        dashboardId: z.number().int(),
        name: z.string().describe('Filter name shown on the dashboard, e.g. "Date range"'),
        type: z
          .string()
          .describe(
            'Metabase parameter type, e.g. "date/all-options" (the full relative-date picker), "date/single", ' +
              '"date/range", "string/=", "string/contains", "number/=", "category"'
          ),
        sectionId: z.string().optional().describe('Grouping shown in the filter picker, e.g. "date", "string", "number", "location", "id"'),
        default: z.any().optional(),
        mapTo: z
          .array(
            z.object({
              cardId: z.number().int().describe('The question\'s ID (use dashcardId instead if the same question appears twice on this dashboard)'),
              dashcardId: z.number().int().optional(),
              tagName: z.string().describe('The {{tag}} name on that question this filter should control'),
            })
          )
          .describe('Which question(s)/tag(s) this filter controls'),
      },
    },
    async (args) => asText(await metabase.addDashboardFilter(args))
  );

  return server;
}

function asText(value) {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

startMcpHttpServer({
  name: 'metabase-mcp',
  port: PORT,
  authToken: AUTH_TOKEN,
  createServer,
});
