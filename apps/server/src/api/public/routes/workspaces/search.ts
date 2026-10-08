import { FastifyPluginCallback } from 'fastify';
import { z } from 'zod';

import { searchWorkspace } from '@colanode/server/mcp/nodes';

const searchQuerySchema = z.object({
  query: z.string().min(1).max(512),
  type: z.enum(['page', 'database', 'record', 'folder']).optional(),
});

export const searchRoutes: FastifyPluginCallback = (instance, _, done) => {
  instance.get('/search', async (request) => {
    const queryParams = searchQuerySchema.parse(request.query);
    const workspace = request.workspace;

    const result = await searchWorkspace(
      workspace.id,
      queryParams.query,
      queryParams.type
    );

    return result;
  });

  done();
};
