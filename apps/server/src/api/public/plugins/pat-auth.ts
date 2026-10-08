import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

import { ApiErrorCode } from '@colanode/core';
import { database } from '@colanode/server/data/database';
import {
  parsePatToken,
  parseToken,
  verifyPatToken,
  verifyToken,
} from '@colanode/server/lib/tokens';
import { AccountContext } from '@colanode/server/types/api';

export type PatContext = {
  tokenId: string;
  accountId: string;
  workspaceId?: string;
  userId?: string;
};

declare module 'fastify' {
  interface FastifyRequest {
    pat: PatContext;
    account: AccountContext;
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
  if (!fastify.hasRequestDecorator('account')) {
    fastify.decorateRequest('account');
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

    // Support PAT tokens (ort_ prefix)
    if (token.startsWith('ort_')) {
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
      request.account = { id: result.accountId, deviceId: 'pat' };
      return;
    }

    // Support standard session tokens (cnd_ prefix)
    if (token.startsWith('cnd_')) {
      const tokenData = parseToken(token);
      if (!tokenData) {
        return reply.code(401).send({
          code: ApiErrorCode.TokenInvalid,
          message: 'Token is invalid or expired',
        });
      }

      const result = await verifyToken(tokenData);
      if (!result.authenticated) {
        return reply.code(401).send({
          code: ApiErrorCode.TokenInvalid,
          message: 'Token is invalid or expired',
        });
      }

      request.account = result.account;
      request.pat = {
        tokenId: 'session',
        accountId: result.account.id,
      };
      return;
    }

    return reply.code(401).send({
      code: ApiErrorCode.TokenInvalid,
      message: 'Token format is unrecognized',
    });
  });

  done();
};

export const patAuthenticator = fp(patAuthenticatorCallback);
