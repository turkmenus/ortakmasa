import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ApiErrorCode } from '@colanode/core';
import { database } from '@colanode/server/data/database';
import {
  generateApiTokenId,
  generatePatToken,
} from '@colanode/server/lib/tokens';
import { buildTestApp } from '../helpers/app';
import {
  createAccount,
  createUser,
  createWorkspace,
} from '../helpers/seed';
import {
  createDatabase,
  createPage,
  createRecord,
  getDatabase,
  getPage,
  getRecord,
  listDatabases,
  listPages,
  listRecords,
  updatePage,
  updateRecord,
} from '@colanode/server/mcp/nodes';

const app = buildTestApp();

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('MCP SSE routes (/mcp)', () => {
  it('returns 401 when no token is provided on GET', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/mcp',
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      code: ApiErrorCode.TokenMissing,
    });
  });

  it('returns 401 when token is invalid on GET', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/mcp',
      headers: {
        authorization: 'Bearer ort_invalidtoken1234567890123456',
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      code: ApiErrorCode.TokenInvalid,
    });
  });

  it('returns 401 when no token is provided on POST', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/mcp',
      payload: {},
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      code: ApiErrorCode.TokenMissing,
    });
  });

  it('returns 400 when session is not found on POST with valid token', async () => {
    const account = await createAccount();
    const tokenId = generateApiTokenId();
    const pat = generatePatToken(tokenId);

    await database
      .insertInto('api_tokens')
      .values({
        id: pat.id,
        account_id: account.id,
        name: 'MCP Test Token',
        token_hash: pat.hash,
        token_salt: pat.salt,
        scopes: JSON.stringify(['read', 'write']),
        status: 1,
        created_at: new Date(),
      })
      .execute();

    const response = await app.inject({
      method: 'POST',
      url: '/mcp?sessionId=non-existent-session',
      headers: {
        authorization: `Bearer ${pat.token}`,
      },
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: 'bad_request',
      message: 'No active MCP session found.',
    });
  });

  it('authenticates via ?token= query parameter', async () => {
    const account = await createAccount();
    const tokenId = generateApiTokenId();
    const pat = generatePatToken(tokenId);

    await database
      .insertInto('api_tokens')
      .values({
        id: pat.id,
        account_id: account.id,
        name: 'MCP Query Test Token',
        token_hash: pat.hash,
        token_salt: pat.salt,
        scopes: JSON.stringify(['read', 'write']),
        status: 1,
        created_at: new Date(),
      })
      .execute();

    const response = await app.inject({
      method: 'POST',
      url: `/mcp?sessionId=non-existent-session&token=${pat.token}`,
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: 'bad_request',
      message: 'No active MCP session found.',
    });
  });
});

describe('MCP Node operations (pages, databases, records)', () => {
  it('performs full page lifecycle', async () => {
    const account = await createAccount();
    const workspace = await createWorkspace({ createdBy: account.id });
    const user = await createUser({
      workspaceId: workspace.id,
      account,
      role: 'owner',
    });

    // Create page
    const created = await createPage(workspace.id, user.id, {
      name: 'Project Roadmap',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(created.page.name).toBe('Project Roadmap');
    expect(created.page.type).toBe('page');

    // List pages
    const list = await listPages(workspace.id);
    expect(list.pages.length).toBeGreaterThanOrEqual(1);
    expect(list.pages.some((p) => p.id === created.page.id)).toBe(true);

    // Get page
    const fetched = await getPage(workspace.id, created.page.id as string);
    expect(fetched.ok).toBe(true);
    if (fetched.ok) {
      expect(fetched.page.name).toBe('Project Roadmap');
    }

    // Update page to public
    const updated = await updatePage(workspace.id, user.id, created.page.id as string, {
      name: 'Updated Roadmap',
      visibility: 'public',
    });
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.page.name).toBe('Updated Roadmap');
      expect(updated.page.visibility).toBe('public');
      expect(updated.page.isPublic).toBe(true);
    }
  });

  it('controls unauthenticated web access via private/public visibility', async () => {
    const account = await createAccount();
    const workspace = await createWorkspace({ createdBy: account.id });
    const user = await createUser({
      workspaceId: workspace.id,
      account,
      role: 'owner',
    });

    // 1. Create default private page
    const privatePage = await createPage(workspace.id, user.id, {
      name: 'Internal Secret Doc',
      visibility: 'private',
    });
    expect(privatePage.ok).toBe(true);
    if (!privatePage.ok) return;

    // Unauthenticated GET /api/v1/p/:id on private page should be 403
    const privateResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/p/${privatePage.page.id}`,
    });
    expect(privateResponse.statusCode).toBe(403);
    expect(privateResponse.json()).toMatchObject({
      code: 'forbidden',
      message: 'This page is private.',
    });

    // 2. Update page to public
    const makePublic = await updatePage(
      workspace.id,
      user.id,
      privatePage.page.id as string,
      { visibility: 'public' }
    );
    expect(makePublic.ok).toBe(true);

    // Unauthenticated GET /api/v1/p/:id on public page should now be 200
    const publicResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/p/${privatePage.page.id}`,
    });
    expect(publicResponse.statusCode).toBe(200);
    const data = publicResponse.json();
    expect(data.page.name).toBe('Internal Secret Doc');
    expect(data.page.isPublic).toBe(true);
    expect(data.page.visibility).toBe('public');
  });

  it('performs full database & record lifecycle', async () => {
    const account = await createAccount();
    const workspace = await createWorkspace({ createdBy: account.id });
    const user = await createUser({
      workspaceId: workspace.id,
      account,
      role: 'owner',
    });

    // Create database with valid schema
    const dbCreated = await createDatabase(workspace.id, user.id, {
      name: 'Tasks',
      fields: {
        is_done: {
          id: 'is_done',
          type: 'boolean',
          name: 'Done',
          index: '0',
        },
      },
    });
    expect(dbCreated.ok).toBe(true);
    if (!dbCreated.ok) return;

    const dbId = dbCreated.database.id as string;
    expect(dbCreated.database.name).toBe('Tasks');

    // List databases
    const dbList = await listDatabases(workspace.id);
    expect(dbList.databases.some((d) => d.id === dbId)).toBe(true);

    // Get database
    const dbFetched = await getDatabase(workspace.id, dbId);
    expect(dbFetched.ok).toBe(true);

    // Create record
    const recordCreated = await createRecord(workspace.id, user.id, dbId, {
      name: 'Task 1',
      fields: { is_done: { type: 'boolean', value: true } },
    });
    expect(recordCreated.ok).toBe(true);
    if (!recordCreated.ok) return;

    const recordId = recordCreated.record.id as string;
    expect(recordCreated.record.name).toBe('Task 1');

    // List records
    const recordList = await listRecords(workspace.id, dbId);
    expect(recordList.ok).toBe(true);
    if (recordList.ok) {
      expect(recordList.records.some((r) => r.id === recordId)).toBe(true);
    }

    // Get record
    const recordFetched = await getRecord(workspace.id, dbId, recordId);
    expect(recordFetched.ok).toBe(true);

    // Update record
    const recordUpdated = await updateRecord(
      workspace.id,
      user.id,
      dbId,
      recordId,
      {
        name: 'Task 1 Completed',
        fields: { is_done: { type: 'boolean', value: false } },
      }
    );
    expect(recordUpdated.ok).toBe(true);
    if (recordUpdated.ok) {
      expect(recordUpdated.record.name).toBe('Task 1 Completed');
    }
  });
});
