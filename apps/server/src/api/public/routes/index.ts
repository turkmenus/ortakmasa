import { FastifyPluginCallback } from 'fastify';

import { accountAuthenticator } from '@colanode/server/api/client/plugins/account-auth';
import { tokenRoutes } from '@colanode/server/api/public/routes/tokens';

export const publicRoutes: FastifyPluginCallback = (instance, _, done) => {
  instance.register((subInstance, __, subDone) => {
    subInstance.register(accountAuthenticator);
    subInstance.register(tokenRoutes, { prefix: '/tokens' });
    subDone();
  });

  done();
};
