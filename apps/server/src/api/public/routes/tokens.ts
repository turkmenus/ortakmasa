import { FastifyInstance, FastifyPluginCallback } from 'fastify';
import { z } from 'zod';

import { database } from '@colanode/server/data/database';
import { SelectApiToken } from '@colanode/server/data/schema';
import { generateApiTokenId, generatePatToken } from '@colanode/server/lib/tokens';
import { uuid } from '@colanode/server/lib/utils';

const createTokenBodySchema = z.object({
  name: z.string().min(1).max(256),
  workspaceId: z.string().length(30).optional(),
  userId: z.string().length(30).optional(),
  scopes: z.array(z.string()).default(['read', 'write']),
});

const maskToken = (token: string): string => {
  if (token.length <= 12) {
    return token;
  }
  return `${token.slice(0, 6)}...${token.slice(-6)}`;
};

const serializeApiToken = (
  token: SelectApiToken,
  plainToken?: string
): Record<string, unknown> => {
  const result: Record<string, unknown> = {
    id: token.id,
    accountId: token.account_id,
    workspaceId: token.workspace_id,
    userId: token.user_id,
    name: token.name,
    scopes: token.scopes,
    status: token.status,
    lastUsedAt: token.last_used_at?.toISOString() ?? null,
    createdAt: token.created_at.toISOString(),
  };

  if (plainToken) {
    result.token = plainToken;
  } else {
    result.token = maskToken(token.token_hash);
  }

  return result;
};

export const tokenRoutes: FastifyPluginCallback = (instance, _, done) => {
  instance.get('/', async (request) => {
    const tokens = await database
      .selectFrom('api_tokens')
      .selectAll()
      .where('account_id', '=', request.account.id)
      .where('status', '=', 1)
      .orderBy('created_at', 'desc')
      .execute();

    return {
      tokens: tokens.map((token) => serializeApiToken(token)),
    };
  });

  instance.post('/', async (request, reply) => {
    const body = createTokenBodySchema.parse(request.body);

    const tokenId = generateApiTokenId();
    const generated = generatePatToken(tokenId);

    await database
      .insertInto('api_tokens')
      .values({
        id: generated.id,
        account_id: request.account.id,
        workspace_id: body.workspaceId ?? null,
        user_id: body.userId ?? null,
        name: body.name,
        token_hash: generated.hash,
        token_salt: generated.salt,
        scopes: JSON.stringify(body.scopes) as never,
        status: 1,
        created_at: new Date(),
      })
      .execute();

    const token = await database
      .selectFrom('api_tokens')
      .selectAll()
      .where('id', '=', generated.id)
      .executeTakeFirstOrThrow();

    return reply.code(201).send({
      token: serializeApiToken(token, generated.token),
    });
  });

  instance.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    await database
      .updateTable('api_tokens')
      .set({
        status: 0,
        revoked_at: new Date(),
        updated_at: new Date(),
      })
      .where('id', '=', id)
      .where('account_id', '=', request.account.id)
      .execute();

    return reply.code(204).send();
  });

  done();
};
