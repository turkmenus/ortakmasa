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
  appendPageContent,
  createDatabase,
  createFolder,
  createPage,
  createRecord,
  deleteDatabaseNode,
  deletePage,
  deleteRecord,
  getDatabase,
  getPage,
  getRecord,
  listDatabases,
  listPages,
  listRecords,
  moveNode,
  searchWorkspace,
  updateDatabase,
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

    // Delete record
    const recordDeleted = await deleteRecord(workspace.id, user.id, recordId);
    expect(recordDeleted.ok).toBe(true);

    const recordAfterDelete = await getRecord(workspace.id, dbId, recordId);
    expect(recordAfterDelete.ok).toBe(false);

    // Update database
    const dbUpdated = await updateDatabase(workspace.id, user.id, dbId, {
      name: 'Tasks Updated',
    });
    expect(dbUpdated.ok).toBe(true);
    if (dbUpdated.ok) {
      expect(dbUpdated.database.name).toBe('Tasks Updated');
    }

    // Delete database
    const dbDeleted = await deleteDatabaseNode(workspace.id, user.id, dbId);
    expect(dbDeleted.ok).toBe(true);

    const dbAfterDelete = await getDatabase(workspace.id, dbId);
    expect(dbAfterDelete.ok).toBe(false);
  });

  it('handles rich text markdown creation, retrieval, and appending', async () => {
    const account = await createAccount();
    const workspace = await createWorkspace({ createdBy: account.id });
    const user = await createUser({
      workspaceId: workspace.id,
      account,
      role: 'owner',
    });

    const initialMarkdown = '# Welcome to Ortakmasa\n\nThis is a test paragraph with **bold** content.\n\n- [ ] Task 1\n- [x] Task 2';

    // 1. Create page with markdown content
    const created = await createPage(workspace.id, user.id, {
      name: 'Project Plan',
      content: initialMarkdown,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const pageId = created.page.id as string;
    expect(created.page.name).toBe('Project Plan');

    // 2. Fetch page and verify markdown is reconstituted
    const fetched = await getPage(workspace.id, pageId);
    expect(fetched.ok).toBe(true);
    if (!fetched.ok) return;

    expect(fetched.page.markdown).toContain('# Welcome to Ortakmasa');
    expect(fetched.page.markdown).toContain('Task 1');

    // 3. Append content to page
    const appendMarkdown = '## Next Steps\n\n- [ ] Finalize deployment';
    const appended = await appendPageContent(
      workspace.id,
      user.id,
      pageId,
      appendMarkdown
    );
    expect(appended.ok).toBe(true);
    if (!appended.ok) return;

    expect(appended.page.markdown).toContain('# Welcome to Ortakmasa');
    expect(appended.page.markdown).toContain('## Next Steps');
    expect(appended.page.markdown).toContain('Finalize deployment');

    // 4. Overwrite content via updatePage
    const updated = await updatePage(workspace.id, user.id, pageId, {
      content: '# Brand New Title\n\nFresh paragraph',
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;

    expect(updated.page.markdown).toContain('# Brand New Title');
    expect(updated.page.markdown).toContain('Fresh paragraph');
    expect(updated.page.markdown).not.toContain('Welcome to Ortakmasa');

    // 5. Delete page
    const deleted = await deletePage(workspace.id, user.id, pageId);
    expect(deleted.ok).toBe(true);

    const afterDelete = await getPage(workspace.id, pageId);
    expect(afterDelete.ok).toBe(false);
  });

  it('supports folder hierarchy and moving nodes', async () => {
    const account = await createAccount();
    const workspace = await createWorkspace({ createdBy: account.id });
    const user = await createUser({
      workspaceId: workspace.id,
      account,
      role: 'owner',
    });

    // 1. Create folder
    const folderRes = await createFolder(workspace.id, user.id, {
      name: 'Projects',
    });
    expect(folderRes.ok).toBe(true);
    if (!folderRes.ok) return;
    const folderId = folderRes.folder.id as string;

    // 2. Create subfolder
    const subfolderRes = await createFolder(workspace.id, user.id, {
      name: '2026',
      parentId: folderId,
    });
    expect(subfolderRes.ok).toBe(true);
    if (!subfolderRes.ok) return;
    const subfolderId = subfolderRes.folder.id as string;

    // 3. Create a page at root
    const pageRes = await createPage(workspace.id, user.id, {
      name: 'Roadmap',
    });
    expect(pageRes.ok).toBe(true);
    if (!pageRes.ok) return;
    const pageId = pageRes.page.id as string;

    // 4. Move page into subfolder
    const moveRes = await moveNode(workspace.id, user.id, pageId, subfolderId);
    expect(moveRes.ok).toBe(true);
    if (!moveRes.ok) return;

    expect(moveRes.node.parentId).toBe(subfolderId);

    // 5. Test move into itself fails
    const invalidMove = await moveNode(workspace.id, user.id, folderId, folderId);
    expect(invalidMove.ok).toBe(false);

    // 6. Test circular hierarchy move fails (moving parent into descendant)
    const circularMove = await moveNode(workspace.id, user.id, folderId, subfolderId);
    expect(circularMove.ok).toBe(false);
  });

  it('searches workspace by name and document content', async () => {
    const account = await createAccount();
    const workspace = await createWorkspace({ createdBy: account.id });
    const user = await createUser({
      workspaceId: workspace.id,
      account,
      role: 'owner',
    });

    // Create page with specific keyword in name
    const page1 = await createPage(workspace.id, user.id, {
      name: 'SuperSecretProjectAlpha',
      content: 'Regular notes here',
    });
    expect(page1.ok).toBe(true);

    // Create page with keyword ONLY in document content
    const page2 = await createPage(workspace.id, user.id, {
      name: 'Weekly Sync',
      content: 'We need to discuss QuantumLeapAlgorithm in today meeting.',
    });
    expect(page2.ok).toBe(true);

    // Search by title keyword
    const titleSearch = await searchWorkspace(workspace.id, 'SecretProjectAlpha');
    expect(titleSearch.results.some((r) => r.name === 'SuperSecretProjectAlpha')).toBe(true);

    // Search by document body keyword
    const contentSearch = await searchWorkspace(workspace.id, 'QuantumLeapAlgorithm');
    expect(contentSearch.results.some((r) => r.name === 'Weekly Sync')).toBe(true);
  });

  it('exposes page markdown, append, delete, and search via REST API using PAT', async () => {
    const account = await createAccount();
    const workspace = await createWorkspace({ createdBy: account.id });
    await createUser({
      workspaceId: workspace.id,
      account,
      role: 'owner',
    });

    const tokenId = generateApiTokenId();
    const pat = generatePatToken(tokenId);

    await database
      .insertInto('api_tokens')
      .values({
        id: pat.id,
        account_id: account.id,
        name: 'REST API PAT',
        token_hash: pat.hash,
        token_salt: pat.salt,
        scopes: JSON.stringify(['read', 'write']),
        status: 1,
        created_at: new Date(),
      })
      .execute();

    const headers = {
      authorization: `Bearer ${pat.token}`,
    };

    // 1. POST /api/v1/workspaces/:workspaceId/pages with markdown content
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${workspace.id}/pages`,
      headers,
      payload: {
        name: 'REST Document',
        content: '# REST Heading\n\nSome paragraph text here.',
      },
    });
    expect(createRes.statusCode).toBe(201);
    const createdPage = createRes.json().page;
    expect(createdPage.name).toBe('REST Document');

    // 2. GET /api/v1/workspaces/:workspaceId/pages/:pageId returns markdown
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${workspace.id}/pages/${createdPage.id}`,
      headers,
    });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().page.markdown).toContain('# REST Heading');

    // 3. POST /api/v1/workspaces/:workspaceId/pages/:pageId/append
    const appendRes = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${workspace.id}/pages/${createdPage.id}/append`,
      headers,
      payload: {
        content: '## Appended Subheading\n\nAppended paragraph.',
      },
    });
    expect(appendRes.statusCode).toBe(200);
    expect(appendRes.json().page.markdown).toContain('## Appended Subheading');

    // 4. GET /api/v1/workspaces/:workspaceId/search
    const searchRes = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${workspace.id}/search?query=Appended`,
      headers,
    });
    expect(searchRes.statusCode).toBe(200);
    expect(searchRes.json().results.some((r: { id: string }) => r.id === createdPage.id)).toBe(true);

    // 5. DELETE /api/v1/workspaces/:workspaceId/pages/:pageId
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/workspaces/${workspace.id}/pages/${createdPage.id}`,
      headers,
    });
    expect(deleteRes.statusCode).toBe(200);
    expect(deleteRes.json().success).toBe(true);

    // Verify 404 after delete
    const afterDeleteRes = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${workspace.id}/pages/${createdPage.id}`,
      headers,
    });
    expect(afterDeleteRes.statusCode).toBe(404);
  });
});

