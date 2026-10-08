import { FastifyPluginCallback } from 'fastify';

import { accountAuthenticator } from '@colanode/server/api/client/plugins/account-auth';
import { workspaceAuthenticator } from '@colanode/server/api/client/plugins/workspace-auth';
import { databaseRoutes } from '@colanode/server/api/public/routes/workspaces/databases';
import { pageRoutes } from '@colanode/server/api/public/routes/workspaces/pages';
import {
  acceptInvitationRoute,
  invitationRoutes,
} from '@colanode/server/api/public/routes/invitations';
import { tokenRoutes } from '@colanode/server/api/public/routes/tokens';

export const publicRoutes: FastifyPluginCallback = (instance, _, done) => {
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

  done();
};
