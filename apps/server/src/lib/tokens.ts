import { sha256 } from 'js-sha256';

import { database } from '@colanode/server/data/database';
import { uuid } from '@colanode/server/lib/utils';
import { AccountContext } from '@colanode/server/types/api';

const DEVICE_TOKEN_PREFIX = 'cnd_';
const PAT_TOKEN_PREFIX = 'ort_';

interface GenerateTokenResult {
  token: string;
  salt: string;
  hash: string;
}

interface TokenData {
  deviceId: string;
  secret: string;
}

interface PatTokenData {
  tokenId: string;
  secret: string;
}

interface GeneratePatTokenResult extends GenerateTokenResult {
  id: string;
}

type VerifyTokenResult =
  | {
      authenticated: false;
    }
  | {
      authenticated: true;
      account: AccountContext;
    };

type VerifyPatTokenResult =
  | {
      authenticated: false;
    }
  | {
      authenticated: true;
      tokenId: string;
      accountId: string;
      workspaceId?: string;
      userId?: string;
    };

export const generateToken = (deviceId: string): GenerateTokenResult => {
  const salt = uuid();
  const secret = uuid() + uuid();
  const hash = sha256(secret + salt);
  const token = DEVICE_TOKEN_PREFIX + deviceId + secret;

  return {
    token,
    salt,
    hash,
  };
};

export const parseToken = (token: string): TokenData | null => {
  if (!token.startsWith(DEVICE_TOKEN_PREFIX)) {
    return null;
  }

  const tokenWithoutPrefix = token.slice(DEVICE_TOKEN_PREFIX.length);
  const deviceId = tokenWithoutPrefix.slice(0, 28);
  const secret = tokenWithoutPrefix.slice(28);
  return {
    deviceId,
    secret,
  };
};

export const verifyToken = async (
  tokenData: TokenData
): Promise<VerifyTokenResult> => {
  const device = await database
    .selectFrom('devices')
    .selectAll()
    .where('id', '=', tokenData.deviceId)
    .executeTakeFirst();

  if (!device) {
    return {
      authenticated: false,
    };
  }

  if (!verifySecret(tokenData.secret, device.token_salt, device.token_hash)) {
    return {
      authenticated: false,
    };
  }

  return {
    authenticated: true,
    account: {
      id: device.account_id,
      deviceId: device.id,
    },
  };
};

export const generatePatToken = (tokenId: string): GeneratePatTokenResult => {
  const salt = uuid();
  const secret = uuid() + uuid();
  const hash = sha256(secret + salt);
  const token = PAT_TOKEN_PREFIX + tokenId + secret;

  return {
    id: tokenId,
    token,
    salt,
    hash,
  };
};

export const generateApiTokenId = (): string => {
  // We use a 28-char id matching parsePatToken and Colanode 30-char varchar limits.
  return crypto.randomUUID().replace(/-/g, '').slice(0, 28);
};

export const parsePatToken = (token: string): PatTokenData | null => {
  if (!token.startsWith(PAT_TOKEN_PREFIX)) {
    return null;
  }

  const tokenWithoutPrefix = token.slice(PAT_TOKEN_PREFIX.length);
  const tokenId = tokenWithoutPrefix.slice(0, 28);
  const secret = tokenWithoutPrefix.slice(28);
  return {
    tokenId,
    secret,
  };
};

export const verifyPatToken = async (
  tokenData: PatTokenData
): Promise<VerifyPatTokenResult> => {
  const token = await database
    .selectFrom('api_tokens')
    .selectAll()
    .where('id', '=', tokenData.tokenId)
    .where('status', '=', 1)
    .executeTakeFirst();

  if (!token) {
    return {
      authenticated: false,
    };
  }

  if (!verifySecret(tokenData.secret, token.token_salt, token.token_hash)) {
    return {
      authenticated: false,
    };
  }

  return {
    authenticated: true,
    tokenId: token.id,
    accountId: token.account_id,
    workspaceId: token.workspace_id ?? undefined,
    userId: token.user_id ?? undefined,
  };
};

const verifySecret = (secret: string, salt: string, hash: string): boolean => {
  const computedHash = sha256(secret + salt);
  return computedHash === hash;
};
