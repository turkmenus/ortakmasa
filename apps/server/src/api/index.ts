import { FastifyPluginCallback } from 'fastify';

import { clientRoutes } from '@colanode/server/api/client/routes';
import { configGetRoute } from '@colanode/server/api/config';
import { homeRoute } from '@colanode/server/api/home';
import { publicRoutes } from '@colanode/server/api/public/routes';
import { mcpRoute } from '@colanode/server/mcp/server';
import { config } from '@colanode/server/lib/config';

export const apiRoutes: FastifyPluginCallback = (instance, _, done) => {
  const prefix = config.pathPrefix ? `/${config.pathPrefix}` : '';

  instance.register(homeRoute, { prefix });
  instance.register(configGetRoute, { prefix });
  instance.register(clientRoutes, { prefix: `${prefix}/client/v1` });
  instance.register(publicRoutes, { prefix: `${prefix}/api/v1` });
  instance.register(mcpRoute, { prefix: `${prefix}/mcp` });
  instance.register(mcpRoute, { prefix: `${prefix}/api/v1/mcp` });

  done();
};
