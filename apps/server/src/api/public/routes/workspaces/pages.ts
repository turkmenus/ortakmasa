import { FastifyPluginCallback } from 'fastify';
import { z } from 'zod';

import { hasWorkspaceRole } from '@colanode/core';
import {
  generateId,
  IdType,
  NodeType,
} from '@colanode/core';
import { database } from '@colanode/server/data/database';
import { SelectNode } from '@colanode/server/data/schema';
import { createNode, mapNode, updateNode } from '@colanode/server/lib/nodes';

const createPageBodySchema = z.object({
  name: z.string().min(1).max(512),
  parentId: z.string().length(30).optional(),
  avatar: z.string().max(512).optional(),
});

const updatePageBodySchema = z.object({
  name: z.string().min(1).max(512).optional(),
  avatar: z.string().max(512).optional().nullable(),
});

const serializePage = (node: SelectNode): Record<string, unknown> => {
  const mapped = mapNode(node);
  const attrs = mapped as unknown as { name?: string; avatar?: string | null };
  return {
    id: mapped.id,
    rootId: mapped.rootId,
    parentId: mapped.parentId,
    type: mapped.type,
    name: attrs.name ?? null,
    avatar: attrs.avatar ?? null,
    createdAt: mapped.createdAt,
    createdBy: mapped.createdBy,
    updatedAt: mapped.updatedAt,
    updatedBy: mapped.updatedBy,
  };
};

export const pageRoutes: FastifyPluginCallback = (instance, _, done) => {
  instance.get('/', async (request) => {
    const workspaceId = request.workspace.id;

    const nodes = await database
      .selectFrom('nodes')
      .selectAll()
      .where('workspace_id', '=', workspaceId)
      .where('type', '=', 'page' as NodeType)
      .orderBy('created_at', 'desc')
      .execute();

    return {
      pages: nodes.map((node) => serializePage(node)),
    };
  });

  instance.post('/', async (request, reply) => {
    const body = createPageBodySchema.parse(request.body);
    const workspace = request.workspace;

    // Only owner/admin/editor can create pages.
    if (!hasWorkspaceRole(workspace.user.role, 'collaborator')) {
      return reply.code(403).send({
        code: 'forbidden',
        message: 'You do not have permission to create pages.',
      });
    }

    const pageId = generateId(IdType.Page);

    let parentId = body.parentId ?? null;
    let rootId = pageId;

    if (parentId) {
      const parent = await database
        .selectFrom('nodes')
        .select(['id', 'root_id'])
        .where('id', '=', parentId)
        .where('workspace_id', '=', workspace.id)
        .executeTakeFirst();

      if (!parent) {
        return reply.code(400).send({
          code: 'invalid_parent',
          message: 'Parent node not found in workspace.',
        });
      }

      rootId = parent.root_id;
    }

    const created = await createNode({
      nodeId: pageId,
      rootId,
      workspaceId: workspace.id,
      userId: workspace.user.id,
      attributes: {
        type: 'page',
        name: body.name,
        parentId: parentId ?? rootId,
        avatar: body.avatar ?? null,
      },
    });

    if (!created) {
      return reply.code(500).send({
        code: 'unknown',
        message: 'Failed to create page.',
      });
    }

    const node = await database
      .selectFrom('nodes')
      .selectAll()
      .where('id', '=', pageId)
      .executeTakeFirstOrThrow();

    return reply.code(201).send({
      page: serializePage(node),
    });
  });

  instance.get('/:pageId', async (request, reply) => {
    const { pageId } = request.params as { pageId: string };
    const workspace = request.workspace;

    const node = await database
      .selectFrom('nodes')
      .selectAll()
      .where('id', '=', pageId)
      .where('workspace_id', '=', workspace.id)
      .where('type', '=', 'page' as NodeType)
      .executeTakeFirst();

    if (!node) {
      return reply.code(404).send({
        code: 'not_found',
        message: 'Page not found.',
      });
    }

    return {
      page: serializePage(node),
    };
  });

  instance.patch('/:pageId', async (request, reply) => {
    const { pageId } = request.params as { pageId: string };
    const body = updatePageBodySchema.parse(request.body);
    const workspace = request.workspace;

    if (!hasWorkspaceRole(workspace.user.role, 'collaborator')) {
      return reply.code(403).send({
        code: 'forbidden',
        message: 'You do not have permission to update pages.',
      });
    }

    const node = await database
      .selectFrom('nodes')
      .selectAll()
      .where('id', '=', pageId)
      .where('workspace_id', '=', workspace.id)
      .where('type', '=', 'page' as NodeType)
      .executeTakeFirst();

    if (!node) {
      return reply.code(404).send({
        code: 'not_found',
        message: 'Page not found.',
      });
    }

    const updated = await updateNode({
      nodeId: pageId,
      userId: workspace.user.id,
      workspaceId: workspace.id,
      updater: (attributes) => {
        if (attributes.type !== 'page') {
          return null;
        }

        const next = { ...attributes };
        if (body.name !== undefined) {
          next.name = body.name;
        }
        if (body.avatar !== undefined) {
          next.avatar = body.avatar;
        }
        return next;
      },
    });

    if (!updated) {
      return reply.code(500).send({
        code: 'unknown',
        message: 'Failed to update page.',
      });
    }

    const freshNode = await database
      .selectFrom('nodes')
      .selectAll()
      .where('id', '=', pageId)
      .executeTakeFirstOrThrow();

    return {
      page: serializePage(freshNode),
    };
  });

  done();
};
