import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ApiErrorCode } from '@colanode/core';
import { database } from '@colanode/server/data/database';
import { buildTestApp } from '../helpers/app';
import {
  createAccount,
  createDevice,
  createWorkspace,
} from '../helpers/seed';

const app = buildTestApp();

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('Token Endpoints (/client/v1/tokens)', () => {
  it('creates, lists, and revokes a token successfully with 28-char workspaceId', async () => {
    const account = await createAccount();
    const { token: sessionToken } = await createDevice({ accountId: account.id });
    const workspace = await createWorkspace({ createdBy: account.id });

    // 1. Create token
    const createRes = await app.inject({
      method: 'POST',
      url: '/client/v1/tokens',
      headers: {
        authorization: `Bearer ${sessionToken}`,
      },
      payload: {
        name: 'Test MCP Token',
        workspaceId: workspace.id, // 28-char cuid2 / ulid
        scopes: ['read', 'write'],
      },
    });

    expect(createRes.statusCode).toBe(201);
    const createBody = createRes.json();
    expect(createBody.token).toBeDefined();
    expect(createBody.token.name).toBe('Test MCP Token');
    expect(createBody.token.token).toMatch(/^ort_/);
    expect(createBody.token.workspaceId).toBe(workspace.id);

    const createdId = createBody.token.id;

    // 2. List tokens
    const listRes = await app.inject({
      method: 'GET',
      url: '/client/v1/tokens',
      headers: {
        authorization: `Bearer ${sessionToken}`,
      },
    });

    expect(listRes.statusCode).toBe(200);
    const listBody = listRes.json();
    expect(listBody.tokens).toHaveLength(1);
    expect(listBody.tokens[0].id).toBe(createdId);
    expect(listBody.tokens[0].name).toBe('Test MCP Token');

    // 3. Delete / revoke token
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/client/v1/tokens/${createdId}`,
      headers: {
        authorization: `Bearer ${sessionToken}`,
      },
    });

    expect(deleteRes.statusCode).toBe(204);

    // 4. Verify listed tokens is now empty
    const listAfterDelete = await app.inject({
      method: 'GET',
      url: '/client/v1/tokens',
      headers: {
        authorization: `Bearer ${sessionToken}`,
      },
    });

    expect(listAfterDelete.statusCode).toBe(200);
    expect(listAfterDelete.json().tokens).toHaveLength(0);
  });
});
