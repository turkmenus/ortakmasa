import { FastifyPluginCallback, FastifyReply } from 'fastify';
import { z } from 'zod';

import { generateId, hasWorkspaceRole, IdType, NodeType } from '@colanode/core';
import { database } from '@colanode/server/data/database';
import { SelectNode } from '@colanode/server/data/schema';
import { createNode, mapNode, updateNode } from '@colanode/server/lib/nodes';
import {
  deleteDatabaseNode,
  deleteRecord,
} from '@colanode/server/mcp/nodes';

const createDatabaseBodySchema = z.object({
  name: z.string().min(1).max(512),
  parentId: z.string().min(20).max(40).optional(),
  avatar: z.string().max(512).optional(),
  fields: z.record(z.string(), z.any()).optional(),
});

const updateDatabaseBodySchema = z.object({
  name: z.string().min(1).max(512).optional(),
  avatar: z.string().max(512).optional().nullable(),
  fields: z.record(z.string(), z.any()).optional(),
  locked: z.boolean().optional().nullable(),
});

const createRecordBodySchema = z.object({
  name: z.string().min(1).max(512),
  avatar: z.string().max(512).optional(),
  fields: z.record(z.string(), z.any()).default({}),
});

const updateRecordBodySchema = z.object({
  name: z.string().min(1).max(512).optional(),
  avatar: z.string().max(512).optional().nullable(),
  fields: z.record(z.string(), z.any()).optional(),
});

const serializeNode = (
  node: SelectNode,
  extra: Record<string, unknown> = {}
): Record<string, unknown> => {
  const mapped = mapNode(node);
  const attrs = mapped as unknown as Record<string, unknown>;
  return {
    id: mapped.id,
    rootId: mapped.rootId,
    parentId: mapped.parentId,
    type: mapped.type,
    name: (attrs.name as string | undefined) ?? null,
    avatar: (attrs.avatar as string | null | undefined) ?? null,
    createdAt: mapped.createdAt,
    createdBy: mapped.createdBy,
    updatedAt: mapped.updatedAt,
    updatedBy: mapped.updatedBy,
    ...extra,
  };
};

const requireCollaborator = (
  workspace: { user: { role: string } },
  reply: FastifyReply
): boolean => {
  if (!hasWorkspaceRole(workspace.user.role as never, 'collaborator')) {
    reply.code(403).send({
      code: 'forbidden',
      message: 'You do not have permission to perform this action.',
    });
    return false;
  }
  return true;
};

export const databaseRoutes: FastifyPluginCallback = (instance, _, done) => {
  // ─────────────────────────────────────────────────────────────────────────
  // DATABASES
  // ─────────────────────────────────────────────────────────────────────────

  instance.get('/databases', async (request) => {
    const workspace = request.workspace;

    const nodes = await database
      .selectFrom('nodes')
      .selectAll()
      .where('workspace_id', '=', workspace.id)
      .where('type', '=', 'database' as NodeType)
      .orderBy('created_at', 'desc')
      .execute();

    return {
      databases: nodes.map((node) => serializeNode(node)),
    };
  });

  instance.post('/databases', async (request, reply) => {
    const body = createDatabaseBodySchema.parse(request.body);
    const workspace = request.workspace;

    if (!requireCollaborator(workspace, reply)) {
      return;
    }

    const databaseId = generateId(IdType.Database);
    const parentId = body.parentId ?? workspace.id;

    const parent = await database
      .selectFrom('nodes')
      .select(['id', 'root_id'])
      .where('id', '=', parentId)
      .where('workspace_id', '=', workspace.id)
      .executeTakeFirst();

    const rootId = parent?.root_id ?? databaseId;
    const actualParentId = parent?.id ?? parentId;

    const created = await createNode({
      nodeId: databaseId,
      rootId,
      workspaceId: workspace.id,
      userId: workspace.user.id,
      attributes: {
        type: 'database',
        name: body.name,
        parentId: actualParentId,
        avatar: body.avatar ?? null,
        fields: body.fields ?? {},
        nameField: null,
        locked: false,
      },
    });

    if (!created) {
      return reply.code(500).send({
        code: 'unknown',
        message: 'Failed to create database.',
      });
    }

    const node = await database
      .selectFrom('nodes')
      .selectAll()
      .where('id', '=', databaseId)
      .executeTakeFirstOrThrow();

    const attrs = node.attributes as Record<string, unknown> | null;
    return reply.code(201).send({
      database: serializeNode(node, {
        fields: attrs?.fields ?? {},
        locked: attrs?.locked ?? null,
      }),
    });
  });

  instance.get('/databases/:databaseId', async (request, reply) => {
    const { databaseId } = request.params as { databaseId: string };
    const workspace = request.workspace;

    const node = await database
      .selectFrom('nodes')
      .selectAll()
      .where('id', '=', databaseId)
      .where('workspace_id', '=', workspace.id)
      .where('type', '=', 'database' as NodeType)
      .executeTakeFirst();

    if (!node) {
      return reply.code(404).send({
        code: 'not_found',
        message: 'Database not found.',
      });
    }

    const attrs = node.attributes as Record<string, unknown> | null;
    return {
      database: serializeNode(node, {
        fields: attrs?.fields ?? {},
        locked: attrs?.locked ?? null,
      }),
    };
  });

  instance.patch('/databases/:databaseId', async (request, reply) => {
    const { databaseId } = request.params as { databaseId: string };
    const body = updateDatabaseBodySchema.parse(request.body);
    const workspace = request.workspace;

    if (!requireCollaborator(workspace, reply)) {
      return;
    }

    const node = await database
      .selectFrom('nodes')
      .selectAll()
      .where('id', '=', databaseId)
      .where('workspace_id', '=', workspace.id)
      .where('type', '=', 'database' as NodeType)
      .executeTakeFirst();

    if (!node) {
      return reply.code(404).send({
        code: 'not_found',
        message: 'Database not found.',
      });
    }

    const updated = await updateNode({
      nodeId: databaseId,
      userId: workspace.user.id,
      workspaceId: workspace.id,
      updater: (attributes) => {
        if (attributes.type !== 'database') {
          return null;
        }
        const next = { ...attributes } as Record<string, unknown>;
        if (body.name !== undefined) next.name = body.name;
        if (body.avatar !== undefined) next.avatar = body.avatar;
        if (body.fields !== undefined) next.fields = body.fields;
        if (body.locked !== undefined) next.locked = body.locked;
        return next as typeof attributes;
      },
    });

    if (!updated) {
      return reply.code(500).send({
        code: 'unknown',
        message: 'Failed to update database.',
      });
    }

    const freshNode = await database
      .selectFrom('nodes')
      .selectAll()
      .where('id', '=', databaseId)
      .executeTakeFirstOrThrow();

    const attrs = freshNode.attributes as Record<string, unknown> | null;
    return {
      database: serializeNode(freshNode, {
        fields: attrs?.fields ?? {},
        locked: attrs?.locked ?? null,
      }),
    };
  });

  instance.delete('/databases/:databaseId', async (request, reply) => {
    const { databaseId } = request.params as { databaseId: string };
    const workspace = request.workspace;

    if (!requireCollaborator(workspace, reply)) {
      return;
    }

    const result = await deleteDatabaseNode(
      workspace.id,
      workspace.user.id,
      databaseId
    );

    if (!result.ok) {
      return reply.code(404).send({
        code: 'not_found',
        message: result.error,
      });
    }

    return {
      success: true,
      message: 'Database deleted successfully.',
    };
  });

  // ─────────────────────────────────────────────────────────────────────────
  // RECORDS
  // ─────────────────────────────────────────────────────────────────────────

  instance.get('/databases/:databaseId/records', async (request, reply) => {
    const { databaseId } = request.params as { databaseId: string };
    const workspace = request.workspace;

    const databaseNode = await database
      .selectFrom('nodes')
      .select(['id'])
      .where('id', '=', databaseId)
      .where('workspace_id', '=', workspace.id)
      .where('type', '=', 'database' as NodeType)
      .executeTakeFirst();

    if (!databaseNode) {
      return reply.code(404).send({
        code: 'not_found',
        message: 'Database not found.',
      });
    }

    const records = await database
      .selectFrom('nodes')
      .selectAll()
      .where('workspace_id', '=', workspace.id)
      .where('type', '=', 'record' as NodeType)
      .where('parent_id', '=', databaseId)
      .orderBy('created_at', 'desc')
      .execute();

    return {
      records: records.map((node) => {
        const attrs = node.attributes as Record<string, unknown> | null;
        return serializeNode(node, {
          databaseId: attrs?.databaseId ?? node.parent_id,
          fields: attrs?.fields ?? {},
        });
      }),
    };
  });

  instance.post('/databases/:databaseId/records', async (request, reply) => {
    const { databaseId } = request.params as { databaseId: string };
    const body = createRecordBodySchema.parse(request.body);
    const workspace = request.workspace;

    if (!requireCollaborator(workspace, reply)) {
      return;
    }

    const databaseNode = await database
      .selectFrom('nodes')
      .select(['id', 'root_id'])
      .where('id', '=', databaseId)
      .where('workspace_id', '=', workspace.id)
      .where('type', '=', 'database' as NodeType)
      .executeTakeFirst();

    if (!databaseNode) {
      return reply.code(404).send({
        code: 'not_found',
        message: 'Database not found.',
      });
    }

    const recordId = generateId(IdType.Record);

    const created = await createNode({
      nodeId: recordId,
      rootId: databaseNode.root_id,
      workspaceId: workspace.id,
      userId: workspace.user.id,
      attributes: {
        type: 'record',
        parentId: databaseId,
        databaseId,
        name: body.name,
        avatar: body.avatar ?? null,
        fields: body.fields,
      },
    });

    if (!created) {
      return reply.code(500).send({
        code: 'unknown',
        message: 'Failed to create record.',
      });
    }

    const node = await database
      .selectFrom('nodes')
      .selectAll()
      .where('id', '=', recordId)
      .executeTakeFirstOrThrow();

    const attrs = node.attributes as Record<string, unknown> | null;
    return reply.code(201).send({
      record: serializeNode(node, {
        databaseId,
        fields: attrs?.fields ?? {},
      }),
    });
  });

  instance.get(
    '/databases/:databaseId/records/:recordId',
    async (request, reply) => {
      const { databaseId, recordId } = request.params as {
        databaseId: string;
        recordId: string;
      };
      const workspace = request.workspace;

      const node = await database
        .selectFrom('nodes')
        .selectAll()
        .where('id', '=', recordId)
        .where('workspace_id', '=', workspace.id)
        .where('type', '=', 'record' as NodeType)
        .where('parent_id', '=', databaseId)
        .executeTakeFirst();

      if (!node) {
        return reply.code(404).send({
          code: 'not_found',
          message: 'Record not found.',
        });
      }

      const attrs = node.attributes as Record<string, unknown> | null;
      return {
        record: serializeNode(node, {
          databaseId,
          fields: attrs?.fields ?? {},
        }),
      };
    }
  );

  instance.patch(
    '/databases/:databaseId/records/:recordId',
    async (request, reply) => {
      const { databaseId, recordId } = request.params as {
        databaseId: string;
        recordId: string;
      };
      const body = updateRecordBodySchema.parse(request.body);
      const workspace = request.workspace;

      if (!requireCollaborator(workspace, reply)) {
        return;
      }

      const node = await database
        .selectFrom('nodes')
        .selectAll()
        .where('id', '=', recordId)
        .where('workspace_id', '=', workspace.id)
        .where('type', '=', 'record' as NodeType)
        .where('parent_id', '=', databaseId)
        .executeTakeFirst();

      if (!node) {
        return reply.code(404).send({
          code: 'not_found',
          message: 'Record not found.',
        });
      }

      const updated = await updateNode({
        nodeId: recordId,
        userId: workspace.user.id,
        workspaceId: workspace.id,
        updater: (attributes) => {
          if (attributes.type !== 'record') {
            return null;
          }
          const next = { ...attributes } as Record<string, unknown>;
          if (body.name !== undefined) next.name = body.name;
          if (body.avatar !== undefined) next.avatar = body.avatar;
          if (body.fields !== undefined) next.fields = body.fields;
          return next as typeof attributes;
        },
      });

      if (!updated) {
        return reply.code(500).send({
          code: 'unknown',
          message: 'Failed to update record.',
        });
      }

      const freshNode = await database
        .selectFrom('nodes')
        .selectAll()
        .where('id', '=', recordId)
        .executeTakeFirstOrThrow();

      const attrs = freshNode.attributes as Record<string, unknown> | null;
      return {
        record: serializeNode(freshNode, {
          databaseId,
          fields: attrs?.fields ?? {},
        }),
      };
    }
  );

  instance.delete(
    '/databases/:databaseId/records/:recordId',
    async (request, reply) => {
      const { recordId } = request.params as {
        databaseId: string;
        recordId: string;
      };
      const workspace = request.workspace;

      if (!requireCollaborator(workspace, reply)) {
        return;
      }

      const result = await deleteRecord(
        workspace.id,
        workspace.user.id,
        recordId
      );

      if (!result.ok) {
        return reply.code(404).send({
          code: 'not_found',
          message: result.error,
        });
      }

      return {
        success: true,
        message: 'Record deleted successfully.',
      };
    }
  );

  done();
};
