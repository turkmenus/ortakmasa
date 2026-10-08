import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

import { ApiErrorCode } from '@colanode/core';
import { database } from '@colanode/server/data/database';
import {
  parsePatToken,
  verifyPatToken,
} from '@colanode/server/lib/tokens';

export type PatContext = {
  tokenId: string;
  accountId: string;
  workspaceId?: string;
  userId?: string;
};

declare module 'fastify' {
  interface FastifyRequest {
    pat: PatContext;
  }
}

const patAuthenticatorCallback: FastifyPluginCallback = (
  fastify,
  _,
  done
) => {
  if (!fastify.hasRequestDecorator('pat')) {
    fastify.decorateRequest('pat');
  }

  fastify.addHook('onRequest', async (request, reply) => {
    let token: string | undefined;

    const auth = request.headers.authorization;
    if (auth) {
      const parts = auth.split(' ');
      token = parts.length === 2 ? parts[1] : parts[0];
    } else if (request.query && typeof request.query === 'object') {
      const query = request.query as Record<string, string>;
      token = query.token || query.apiKey || query.pat;
    }

    if (!token) {
      return reply.code(401).send({
        code: ApiErrorCode.TokenMissing,
        message: 'No token provided',
      });
    }

    const tokenData = parsePatToken(token);
    if (!tokenData) {
      return reply.code(401).send({
        code: ApiErrorCode.TokenInvalid,
        message: 'Token is invalid or expired',
      });
    }

    const result = await verifyPatToken(tokenData);
    if (!result.authenticated) {
      return reply.code(401).send({
        code: ApiErrorCode.TokenInvalid,
        message: 'Token is invalid or expired',
      });
    }

    await database
      .updateTable('api_tokens')
      .set({
        last_used_at: new Date(),
        updated_at: new Date(),
      })
      .where('id', '=', result.tokenId)
      .execute();

    request.pat = result;
  });

  done();
};

export const patAuthenticator = fp(patAuthenticatorCallback);
