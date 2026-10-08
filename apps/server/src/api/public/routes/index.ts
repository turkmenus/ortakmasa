import { FastifyPluginCallback } from 'fastify';

import { database } from '@colanode/server/data/database';
import { accountAuthenticator } from '@colanode/server/api/client/plugins/account-auth';
import { workspaceAuthenticator } from '@colanode/server/api/client/plugins/workspace-auth';
import { patAuthenticator } from '@colanode/server/api/public/plugins/pat-auth';
import { databaseRoutes } from '@colanode/server/api/public/routes/workspaces/databases';
import { pageRoutes } from '@colanode/server/api/public/routes/workspaces/pages';
import {
  acceptInvitationRoute,
  invitationRoutes,
} from '@colanode/server/api/public/routes/invitations';
import { tokenRoutes } from '@colanode/server/api/public/routes/tokens';

export const publicRoutes: FastifyPluginCallback = (instance, _, done) => {
  instance.register((subInstance, __, subDone) => {
    subInstance.register(patAuthenticator);
    subInstance.get('/workspaces', async (request) => {
      const accountId = request.pat?.accountId || request.account?.id;
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

      return {
        workspaces,
      };
    });
    subDone();
  });

  instance.register((subInstance, __, subDone) => {
    subInstance.register(accountAuthenticator);
    subInstance.register(tokenRoutes, { prefix: '/tokens' });
    subInstance.register(acceptInvitationRoute, {
      prefix: '/invitations',
    });
    subDone();
  });

  instance.register((subInstance, __, subDone) => {
    subInstance.register(accountAuthenticator);
    subInstance.register(workspaceAuthenticator);
    subInstance.register(pageRoutes, { prefix: '/workspaces/:workspaceId/pages' });
    subDone();
  });

  instance.register((subInstance, __, subDone) => {
    subInstance.register(accountAuthenticator);
    subInstance.register(workspaceAuthenticator);
    subInstance.register(databaseRoutes, { prefix: '/workspaces/:workspaceId' });
    subDone();
  });

  instance.register((subInstance, __, subDone) => {
    subInstance.register(accountAuthenticator);
    subInstance.register(workspaceAuthenticator);
    subInstance.register(invitationRoutes, {
      prefix: '/workspaces/:workspaceId/invitations',
    });
    subDone();
  });

  // Publicly accessible page viewer (unauthenticated)
  instance.get('/p/:pageId', async (request, reply) => {
    const { pageId } = request.params as { pageId: string };
    const node = await database
      .selectFrom('nodes')
      .selectAll()
      .where('id', '=', pageId)
      .where('type', '=', 'page' as never)
      .executeTakeFirst();

    if (!node) {
      return reply.code(404).send({
        code: 'not_found',
        message: 'Page not found.',
      });
    }

    const attrs = (node.attributes ?? {}) as Record<string, unknown>;
    if (attrs.visibility !== 'public') {
      return reply.code(403).send({
        code: 'forbidden',
        message: 'This page is private.',
      });
    }

    const document = await database
      .selectFrom('documents')
      .selectAll()
      .where('id', '=', pageId)
      .executeTakeFirst();

    return {
      page: {
        id: node.id,
        name: attrs.name ?? null,
        avatar: attrs.avatar ?? null,
        visibility: 'public',
        isPublic: true,
        createdAt: node.created_at,
        updatedAt: node.updated_at,
        content: document?.content ?? null,
      },
    };
  });

  done();
};
