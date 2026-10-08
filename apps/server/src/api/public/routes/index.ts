import { FastifyPluginCallback } from 'fastify';

import { accountAuthenticator } from '@colanode/server/api/client/plugins/account-auth';
import { workspaceAuthenticator } from '@colanode/server/api/client/plugins/workspace-auth';
import { pageRoutes } from '@colanode/server/api/public/routes/workspaces/pages';
import { tokenRoutes } from '@colanode/server/api/public/routes/tokens';

export const publicRoutes: FastifyPluginCallback = (instance, _, done) => {
  instance.register((subInstance, __, subDone) => {
    subInstance.register(accountAuthenticator);
    subInstance.register(tokenRoutes, { prefix: '/tokens' });
    subDone();
  });

  instance.register((subInstance, __, subDone) => {
    subInstance.register(accountAuthenticator);
    subInstance.register(workspaceAuthenticator);
    subInstance.register(pageRoutes, { prefix: '/workspaces/:workspaceId/pages' });
    subDone();
  });

  done();
};
