import { FastifyPluginCallback } from 'fastify';

import { accountAuthenticator } from '@colanode/server/api/client/plugins/account-auth';
import { accountRoutes } from '@colanode/server/api/client/routes/accounts';
import { authRoutes } from '@colanode/server/api/client/routes/auth';
import { avatarRoutes } from '@colanode/server/api/client/routes/avatars';
import { socketRoutes } from '@colanode/server/api/client/routes/sockets';
import { workspaceRoutes } from '@colanode/server/api/client/routes/workspaces';
import { tokenRoutes } from '@colanode/server/api/public/routes/tokens';

export const clientRoutes: FastifyPluginCallback = (instance, _, done) => {
  instance.register(socketRoutes, { prefix: '/sockets' });
  instance.register(accountRoutes, { prefix: '/accounts' });
  instance.register(authRoutes, { prefix: '/auth' });
  instance.register(avatarRoutes, { prefix: '/avatars' });
  instance.register(workspaceRoutes, { prefix: '/workspaces' });

  instance.register((subInstance, __, subDone) => {
    subInstance.register(accountAuthenticator);
    subInstance.register(tokenRoutes, { prefix: '/tokens' });
    subDone();
  });

  done();
};
