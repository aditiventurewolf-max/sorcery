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
        'whatever permissions the configured Metabase account has.',
      inputSchema: {
        databaseId: z.number().int().describe('Numeric database ID from list_databases'),
        query: z.string().describe('Raw SQL to execute'),
      },
    },
    async ({ databaseId, query }) => asText(await metabase.runNativeQuery({ databaseId, query }))
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
