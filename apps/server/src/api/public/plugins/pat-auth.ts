import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

import { ApiErrorCode } from '@colanode/core';
import { database } from '@colanode/server/data/database';
import {
  parsePatToken,
  verifyPatToken,
} from '@colanode/server/lib/tokens';

declare module 'fastify' {
  interface FastifyRequest {
    pat: {
      tokenId: string;
      accountId: string;
      workspaceId?: string;
      userId?: string;
    };
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
    const auth = request.headers.authorization;
    if (!auth) {
      return reply.code(401).send({
        code: ApiErrorCode.TokenMissing,
        message: 'No token provided',
      });
    }

    const parts = auth.split(' ');
    const token = parts.length === 2 ? parts[1] : parts[0];

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
