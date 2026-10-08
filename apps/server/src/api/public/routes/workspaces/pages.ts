import { FastifyPluginCallback } from 'fastify';
import { z } from 'zod';

import { hasWorkspaceRole } from '@colanode/core';
import {
  appendPageContent,
  createPage,
  deletePage,
  getPage,
  listPages,
  updatePage,
} from '@colanode/server/mcp/nodes';

const createPageBodySchema = z.object({
  name: z.string().min(1).max(512),
  parentId: z.string().min(20).max(40).optional(),
  avatar: z.string().max(512).optional(),
  visibility: z.enum(['private', 'public']).optional(),
  content: z.string().optional(),
});

const updatePageBodySchema = z.object({
  name: z.string().min(1).max(512).optional(),
  avatar: z.string().max(512).optional().nullable(),
  visibility: z.enum(['private', 'public']).optional(),
  content: z.string().optional(),
});

const appendPageBodySchema = z.object({
  content: z.string(),
});

export const pageRoutes: FastifyPluginCallback = (instance, _, done) => {
  instance.get('/', async (request) => {
    const workspaceId = request.workspace.id;
    return await listPages(workspaceId);
  });

  instance.post('/', async (request, reply) => {
    const body = createPageBodySchema.parse(request.body);
    const workspace = request.workspace;

    if (!hasWorkspaceRole(workspace.user.role, 'collaborator')) {
      return reply.code(403).send({
        code: 'forbidden',
        message: 'You do not have permission to create pages.',
      });
    }

    const result = await createPage(workspace.id, workspace.user.id, body);
    if (!result.ok) {
      return reply.code(400).send({
        code: 'bad_request',
        message: result.error,
      });
    }

    return reply.code(201).send({
      page: result.page,
    });
  });

  instance.get('/:pageId', async (request, reply) => {
    const { pageId } = request.params as { pageId: string };
    const workspace = request.workspace;

    const result = await getPage(workspace.id, pageId);
    if (!result.ok) {
      return reply.code(404).send({
        code: 'not_found',
        message: result.error,
      });
    }

    return {
      page: result.page,
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

    const result = await updatePage(
      workspace.id,
      workspace.user.id,
      pageId,
      body
    );

    if (!result.ok) {
      return reply.code(400).send({
        code: 'bad_request',
        message: result.error,
      });
    }

    return {
      page: result.page,
    };
  });

  instance.post('/:pageId/append', async (request, reply) => {
    const { pageId } = request.params as { pageId: string };
    const body = appendPageBodySchema.parse(request.body);
    const workspace = request.workspace;

    if (!hasWorkspaceRole(workspace.user.role, 'collaborator')) {
      return reply.code(403).send({
        code: 'forbidden',
        message: 'You do not have permission to update pages.',
      });
    }

    const result = await appendPageContent(
      workspace.id,
      workspace.user.id,
      pageId,
      body.content
    );

    if (!result.ok) {
      return reply.code(400).send({
        code: 'bad_request',
        message: result.error,
      });
    }

    return {
      page: result.page,
    };
  });

  instance.delete('/:pageId', async (request, reply) => {
    const { pageId } = request.params as { pageId: string };
    const workspace = request.workspace;

    if (!hasWorkspaceRole(workspace.user.role, 'collaborator')) {
      return reply.code(403).send({
        code: 'forbidden',
        message: 'You do not have permission to delete pages.',
      });
    }

    const result = await deletePage(workspace.id, workspace.user.id, pageId);
    if (!result.ok) {
      return reply.code(404).send({
        code: 'not_found',
        message: result.error,
      });
    }

    return {
      success: true,
      message: 'Page deleted successfully.',
    };
  });

  done();
};
