import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { FastifyPluginCallback } from 'fastify';
import { z } from 'zod';

import { ApiErrorCode } from '@colanode/core';
import { patAuthenticator } from '@colanode/server/api/public/plugins/pat-auth';
import {
  createDatabase,
  createPage,
  createRecord,
  getDatabase,
  getPage,
  getRecord,
  listDatabases,
  listPages,
  listRecords,
  requireCollaborator,
  updatePage,
  updateRecord,
} from '@colanode/server/mcp/nodes';
import { database } from '@colanode/server/data/database';

const mcpSessions = new Map<string, SSEServerTransport>();

const resolveWorkspace = async (accountId: string, workspaceId: string) => {
  const workspace = await database
    .selectFrom('workspaces')
    .innerJoin('users', 'workspaces.id', 'users.workspace_id')
    .select([
      'workspaces.id as workspace_id',
      'workspaces.max_file_size as max_file_size',
      'workspaces.status as status',
      'users.id as user_id',
      'users.role as user_role',
      'users.status as user_status',
    ])
    .where('workspaces.id', '=', workspaceId)
    .where('users.account_id', '=', accountId)
    .executeTakeFirst();

  if (
    !workspace ||
    workspace.user_role === 'none' ||
    workspace.user_status !== 1
  ) {
    return null;
  }

  return {
    id: workspace.workspace_id,
    user: {
      id: workspace.user_id,
      accountId,
      role: workspace.user_role,
    },
  };
};

const workspaceNotFoundError = () => ({
  content: [
    {
      type: 'text' as const,
      text: JSON.stringify({
        error: 'Workspace not found or access denied.',
      }),
    },
  ],
  isError: true,
});

const forbiddenError = () => ({
  content: [
    {
      type: 'text' as const,
      text: JSON.stringify({
        error: 'You do not have permission to perform this action.',
      }),
    },
  ],
  isError: true,
});

const successText = (data: unknown) => ({
  content: [
    {
      type: 'text' as const,
      text: JSON.stringify(data, null, 2),
    },
  ],
});

const createMcpServer = (accountId: string): McpServer => {
  const server = new McpServer(
    {
      name: 'ortakmasa-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // list_workspaces
  server.tool(
    'list_workspaces',
    'List all workspaces accessible by the authenticated user with their IDs, names, and roles.',
    {},
    async () => {
      const workspaces = await database
        .selectFrom('workspaces')
        .innerJoin('users', 'workspaces.id', 'users.workspace_id')
        .select([
          'workspaces.id as id',
          'workspaces.name as name',
          'workspaces.description as description',
          'workspaces.avatar as avatar',
          'workspaces.created_at as createdAt',
          'users.id as userId',
          'users.role as role',
        ])
        .where('users.account_id', '=', accountId)
        .where('users.status', '=', 1)
        .where('users.role', '!=', 'none')
        .execute();

      return successText(workspaces);
    }
  );

  // list_pages
  server.tool(
    'list_pages',
    'List all pages in a workspace.',
    {
      workspaceId: z.string().min(20).max(40).describe('Workspace ID'),
    },
    async (args) => {
      const workspace = await resolveWorkspace(accountId, args.workspaceId);
      if (!workspace) return workspaceNotFoundError();

      const result = await listPages(args.workspaceId);
      return successText(result);
    }
  );

  // get_page
  server.tool(
    'get_page',
    'Get details of a specific page.',
    {
      workspaceId: z.string().min(20).max(40).describe('Workspace ID'),
      pageId: z.string().min(20).max(40).describe('Page ID'),
    },
    async (args) => {
      const workspace = await resolveWorkspace(accountId, args.workspaceId);
      if (!workspace) return workspaceNotFoundError();

      const result = await getPage(args.workspaceId, args.pageId);
      if (!result.ok) return workspaceNotFoundError();
      return successText(result.page);
    }
  );

  // create_page
  server.tool(
    'create_page',
    'Create a new page in a workspace.',
    {
      workspaceId: z.string().min(20).max(40).describe('Workspace ID'),
      name: z.string().min(1).max(512).describe('Page name'),
      parentId: z.string().min(20).max(40).optional().describe('Optional parent page ID'),
      avatar: z.string().max(512).optional().describe('Optional avatar URL'),
      visibility: z
        .enum(['private', 'public'])
        .default('private')
        .optional()
        .describe("Page visibility ('private' for workspace members only, 'public' for web accessible link)"),
    },
    async (args) => {
      const workspace = await resolveWorkspace(accountId, args.workspaceId);
      if (!workspace) return workspaceNotFoundError();

      if (!requireCollaborator(workspace.user.role)) {
        return forbiddenError();
      }

      const result = await createPage(args.workspaceId, workspace.user.id, {
        name: args.name,
        parentId: args.parentId,
        avatar: args.avatar,
        visibility: args.visibility,
      });

      if (!result.ok) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ error: result.error }),
            },
          ],
          isError: true,
        };
      }

      return successText(result.page);
    }
  );

  // update_page
  server.tool(
    'update_page',
    'Update an existing page.',
    {
      workspaceId: z.string().min(20).max(40).describe('Workspace ID'),
      pageId: z.string().min(20).max(40).describe('Page ID'),
      name: z.string().min(1).max(512).optional().describe('New page name'),
      avatar: z
        .string()
        .max(512)
        .optional()
        .nullable()
        .describe('New avatar URL or null to clear'),
      visibility: z
        .enum(['private', 'public'])
        .optional()
        .describe("Change page visibility ('private' or 'public')"),
    },
    async (args) => {
      const workspace = await resolveWorkspace(accountId, args.workspaceId);
      if (!workspace) return workspaceNotFoundError();

      if (!requireCollaborator(workspace.user.role)) {
        return forbiddenError();
      }

      const result = await updatePage(
        args.workspaceId,
        workspace.user.id,
        args.pageId,
        {
          name: args.name,
          avatar: args.avatar,
          visibility: args.visibility,
        }
      );

      if (!result.ok) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ error: result.error }),
            },
          ],
          isError: true,
        };
      }

      return successText(result.page);
    }
  );

  // list_databases
  server.tool(
    'list_databases',
    'List all databases in a workspace.',
    {
      workspaceId: z.string().min(20).max(40).describe('Workspace ID'),
    },
    async (args) => {
      const workspace = await resolveWorkspace(accountId, args.workspaceId);
      if (!workspace) return workspaceNotFoundError();

      const result = await listDatabases(args.workspaceId);
      return successText(result);
    }
  );

  // get_database
  server.tool(
    'get_database',
    'Get details of a specific database.',
    {
      workspaceId: z.string().min(20).max(40).describe('Workspace ID'),
      databaseId: z.string().min(20).max(40).describe('Database ID'),
    },
    async (args) => {
      const workspace = await resolveWorkspace(accountId, args.workspaceId);
      if (!workspace) return workspaceNotFoundError();

      const result = await getDatabase(args.workspaceId, args.databaseId);
      if (!result.ok) return workspaceNotFoundError();
      return successText(result.database);
    }
  );

  // create_database
  server.tool(
    'create_database',
    'Create a new database in a workspace.',
    {
      workspaceId: z.string().min(20).max(40).describe('Workspace ID'),
      name: z.string().min(1).max(512).describe('Database name'),
      parentId: z.string().min(20).max(40).optional().describe('Optional parent node ID'),
      avatar: z.string().max(512).optional().describe('Optional avatar URL'),
      fields: z
        .record(z.string(), z.any())
        .optional()
        .describe('Optional field schema map'),
    },
    async (args) => {
      const workspace = await resolveWorkspace(accountId, args.workspaceId);
      if (!workspace) return workspaceNotFoundError();

      if (!requireCollaborator(workspace.user.role)) {
        return forbiddenError();
      }

      const result = await createDatabase(
        args.workspaceId,
        workspace.user.id,
        {
          name: args.name,
          parentId: args.parentId,
          avatar: args.avatar,
          fields: args.fields,
        }
      );

      if (!result.ok) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ error: result.error }),
            },
          ],
          isError: true,
        };
      }

      return successText(result.database);
    }
  );

  // list_records
  server.tool(
    'list_records',
    'List records in a database.',
    {
      workspaceId: z.string().min(20).max(40).describe('Workspace ID'),
      databaseId: z.string().min(20).max(40).describe('Database ID'),
    },
    async (args) => {
      const workspace = await resolveWorkspace(accountId, args.workspaceId);
      if (!workspace) return workspaceNotFoundError();

      const result = await listRecords(args.workspaceId, args.databaseId);
      if (!result.ok) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ error: result.error }),
            },
          ],
          isError: true,
        };
      }

      return successText({ records: result.records });
    }
  );

  // get_record
  server.tool(
    'get_record',
    'Get details of a specific record.',
    {
      workspaceId: z.string().min(20).max(40).describe('Workspace ID'),
      databaseId: z.string().min(20).max(40).describe('Database ID'),
      recordId: z.string().min(20).max(40).describe('Record ID'),
    },
    async (args) => {
      const workspace = await resolveWorkspace(accountId, args.workspaceId);
      if (!workspace) return workspaceNotFoundError();

      const result = await getRecord(
        args.workspaceId,
        args.databaseId,
        args.recordId
      );
      if (!result.ok) return workspaceNotFoundError();
      return successText(result.record);
    }
  );

  // create_record
  server.tool(
    'create_record',
    'Create a new record in a database.',
    {
      workspaceId: z.string().min(20).max(40).describe('Workspace ID'),
      databaseId: z.string().min(20).max(40).describe('Database ID'),
      name: z.string().min(1).max(512).describe('Record name'),
      avatar: z.string().max(512).optional().describe('Optional avatar URL'),
      fields: z
        .record(z.string(), z.any())
        .optional()
        .describe('Optional field values map'),
    },
    async (args) => {
      const workspace = await resolveWorkspace(accountId, args.workspaceId);
      if (!workspace) return workspaceNotFoundError();

      if (!requireCollaborator(workspace.user.role)) {
        return forbiddenError();
      }

      const result = await createRecord(
        args.workspaceId,
        workspace.user.id,
        args.databaseId,
        {
          name: args.name,
          avatar: args.avatar ?? null,
          fields: args.fields,
        }
      );

      if (!result.ok) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ error: result.error }),
            },
          ],
          isError: true,
        };
      }

      return successText(result.record);
    }
  );

  // update_record
  server.tool(
    'update_record',
    'Update an existing record.',
    {
      workspaceId: z.string().min(20).max(40).describe('Workspace ID'),
      databaseId: z.string().min(20).max(40).describe('Database ID'),
      recordId: z.string().min(20).max(40).describe('Record ID'),
      name: z.string().min(1).max(512).optional().describe('New record name'),
      avatar: z
        .string()
        .max(512)
        .optional()
        .nullable()
        .describe('New avatar URL or null to clear'),
      fields: z
        .record(z.string(), z.any())
        .optional()
        .describe('Updated field values map'),
    },
    async (args) => {
      const workspace = await resolveWorkspace(accountId, args.workspaceId);
      if (!workspace) return workspaceNotFoundError();

      if (!requireCollaborator(workspace.user.role)) {
        return forbiddenError();
      }

      const result = await updateRecord(
        args.workspaceId,
        workspace.user.id,
        args.databaseId,
        args.recordId,
        {
          name: args.name,
          avatar: args.avatar,
          fields: args.fields,
        }
      );

      if (!result.ok) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ error: result.error }),
            },
          ],
          isError: true,
        };
      }

      return successText(result.record);
    }
  );

  return server;
};

export const mcpRoute: FastifyPluginCallback = (instance, _, done) => {
  instance.register(patAuthenticator);

  instance.get('/', async (request, reply) => {
    if (!request.pat) {
      return reply.code(401).send({
        code: ApiErrorCode.TokenMissing,
        message: 'No token provided',
      });
    }

    const accountId = request.pat.accountId;
    const prefix = instance.prefix || '/mcp';
    const postEndpoint = `${prefix}?sessionId=placeholder`;

    const transport = new SSEServerTransport(postEndpoint, reply.raw);
    // SSEServerTransport generates its own sessionId and rewrites the URL's
    // query parameter. We must key our session map by transport.sessionId so
    // that incoming POST requests can be routed to the correct transport.
    mcpSessions.set(transport.sessionId, transport);

    reply.raw.on('close', () => {
      mcpSessions.delete(transport.sessionId);
    });

    const server = createMcpServer(accountId);
    await server.connect(transport);

    return reply.hijack();
  });

  instance.post('/', async (request, reply) => {
    if (!request.pat) {
      return reply.code(401).send({
        code: ApiErrorCode.TokenMissing,
        message: 'No token provided',
      });
    }

    const sessionId =
      (request.query as { sessionId?: string }).sessionId ??
      (mcpSessions.size === 1 ? Array.from(mcpSessions.keys())[0] : undefined);

    const transport = sessionId ? mcpSessions.get(sessionId) : undefined;
    if (!transport) {
      return reply.code(400).send({
        code: 'bad_request',
        message: 'No active MCP session found.',
      });
    }

    await transport.handlePostMessage(request.raw, reply.raw, request.body);
    return reply.hijack();
  });

  done();
};
