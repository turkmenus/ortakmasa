import { sql } from 'kysely';

import { database } from '@colanode/server/data/database';
import { SelectNode } from '@colanode/server/data/schema';
import { blocksToMarkdown, markdownToBlocks } from '@colanode/server/lib/blocks';
import { config } from '@colanode/server/lib/config';
import { createDocument, updateDocument } from '@colanode/server/lib/documents';
import { eventBus } from '@colanode/server/lib/event-bus';
import { createNode, mapNode, updateNode } from '@colanode/server/lib/nodes';
import { storage } from '@colanode/server/lib/storage';
import { jobService } from '@colanode/server/services/job-service';
import {
  Block,
  generateId,
  hasWorkspaceRole,
  IdType,
  NodeType,
} from '@colanode/core';

export const buildPageWebUrl = (
  workspaceId: string,
  pageId: string,
  visibility: 'private' | 'public' = 'private'
): string => {
  const protocol = config.web?.protocol ?? 'http';
  const domain = config.web?.domain ?? 'localhost:4000';
  if (visibility === 'public') {
    return `${protocol}://${domain}/p/${pageId}`;
  }
  return `${protocol}://${domain}/workspace/${workspaceId}/page/${pageId}`;
};

export const requireCollaborator = (role: string): boolean => {
  return hasWorkspaceRole(role as never, 'collaborator');
};

export const serializeNode = (
  node: SelectNode,
  extra: Record<string, unknown> = {}
): Record<string, unknown> => {
  const mapped = mapNode(node);
  const attrs = mapped as unknown as Record<string, unknown>;
  const visibility =
    (attrs.visibility as 'private' | 'public' | undefined) ?? 'private';
  const url = buildPageWebUrl(node.workspace_id, node.id, visibility);

  return {
    id: mapped.id,
    rootId: mapped.rootId,
    parentId: mapped.parentId,
    type: mapped.type,
    name: (attrs.name as string | undefined) ?? null,
    avatar: (attrs.avatar as string | null | undefined) ?? null,
    visibility,
    isPublic: visibility === 'public',
    url,
    createdAt: mapped.createdAt,
    createdBy: mapped.createdBy,
    updatedAt: mapped.updatedAt,
    updatedBy: mapped.updatedBy,
    ...extra,
  };
};

export const listPages = async (workspaceId: string) => {
  const nodes = await database
    .selectFrom('nodes')
    .selectAll()
    .where('workspace_id', '=', workspaceId)
    .where('type', '=', 'page' as NodeType)
    .orderBy('created_at', 'desc')
    .execute();

  return { pages: nodes.map((node) => serializeNode(node)) };
};

export const getPage = async (workspaceId: string, pageId: string) => {
  const node = await database
    .selectFrom('nodes')
    .selectAll()
    .where('id', '=', pageId)
    .where('workspace_id', '=', workspaceId)
    .where('type', '=', 'page' as NodeType)
    .executeTakeFirst();

  if (!node) {
    return { ok: false, error: 'Page not found' } as const;
  }

  const document = await database
    .selectFrom('documents')
    .selectAll()
    .where('id', '=', pageId)
    .where('workspace_id', '=', workspaceId)
    .executeTakeFirst();

  const subpages = await database
    .selectFrom('nodes')
    .select(['id', 'type', 'attributes'])
    .where('parent_id', '=', pageId)
    .where('workspace_id', '=', workspaceId)
    .where('type', '=', 'page' as NodeType)
    .execute();

  let markdown = '';
  if (document?.content) {
    let contentObj: { blocks?: Record<string, Block> } | null = null;
    if (typeof document.content === 'string') {
      try {
        contentObj = JSON.parse(document.content);
      } catch {
        contentObj = null;
      }
    } else if (typeof document.content === 'object') {
      contentObj = document.content as unknown as {
        blocks?: Record<string, Block>;
      };
    }

    if (contentObj?.blocks) {
      markdown = blocksToMarkdown(pageId, contentObj.blocks);
    }
  }

  return {
    ok: true,
    page: {
      ...serializeNode(node),
      content: document?.content ?? null,
      markdown,
      documentUpdatedAt: document?.updated_at ?? null,
      subpages: subpages.map((sp) => {
        const spAttrs = sp.attributes as Record<string, unknown> | null;
        return {
          id: sp.id,
          name: (spAttrs?.name as string | undefined) ?? null,
        };
      }),
    },
  } as const;
};

export const createPage = async (
  workspaceId: string,
  userId: string,
  input: {
    name: string;
    parentId?: string;
    avatar?: string | null;
    visibility?: 'private' | 'public';
    content?: string;
  }
) => {
  const pageId = generateId(IdType.Page);

  let parentId = input.parentId ?? null;
  let rootId = pageId;

  if (parentId) {
    const parent = await database
      .selectFrom('nodes')
      .select(['id', 'root_id'])
      .where('id', '=', parentId)
      .where('workspace_id', '=', workspaceId)
      .executeTakeFirst();

    if (!parent) {
      return { ok: false, error: 'Parent node not found in workspace.' } as const;
    }

    rootId = parent.root_id;
  }

  const created = await createNode({
    nodeId: pageId,
    rootId,
    workspaceId,
    userId,
    attributes: {
      type: 'page',
      name: input.name,
      parentId: parentId ?? rootId,
      avatar: input.avatar ?? null,
      visibility: input.visibility ?? 'private',
    },
  });

  if (!created) {
    return { ok: false, error: 'Failed to create page.' } as const;
  }

  if (input.content) {
    const blocks = markdownToBlocks(pageId, input.content);
    await createDocument({
      nodeId: pageId,
      workspaceId,
      userId,
      content: {
        type: 'rich_text',
        blocks,
      },
    });
  }

  const node = await database
    .selectFrom('nodes')
    .selectAll()
    .where('id', '=', pageId)
    .executeTakeFirstOrThrow();

  return {
    ok: true,
    page: {
      ...serializeNode(node),
      markdown: input.content ?? '',
    },
  } as const;
};

export const updatePage = async (
  workspaceId: string,
  userId: string,
  pageId: string,
  input: {
    name?: string;
    avatar?: string | null;
    visibility?: 'private' | 'public';
    content?: string;
  }
) => {
  const node = await database
    .selectFrom('nodes')
    .selectAll()
    .where('id', '=', pageId)
    .where('workspace_id', '=', workspaceId)
    .where('type', '=', 'page' as NodeType)
    .executeTakeFirst();

  if (!node) {
    return { ok: false, error: 'Page not found.' } as const;
  }

  if (
    input.name !== undefined ||
    input.avatar !== undefined ||
    input.visibility !== undefined
  ) {
    const updated = await updateNode({
      nodeId: pageId,
      userId,
      workspaceId,
      updater: (attributes) => {
        if (attributes.type !== 'page') {
          return null;
        }

        const next = { ...attributes };
        if (input.name !== undefined) {
          next.name = input.name;
        }
        if (input.avatar !== undefined) {
          next.avatar = input.avatar;
        }
        if (input.visibility !== undefined) {
          next.visibility = input.visibility;
        }
        return next;
      },
    });

    if (!updated) {
      return { ok: false, error: 'Failed to update page attributes.' } as const;
    }
  }

  if (input.content !== undefined) {
    const existingDoc = await database
      .selectFrom('documents')
      .select('id')
      .where('id', '=', pageId)
      .where('workspace_id', '=', workspaceId)
      .executeTakeFirst();

    const blocks = markdownToBlocks(pageId, input.content);

    if (existingDoc) {
      await updateDocument({
        documentId: pageId,
        workspaceId,
        userId,
        updater: () => ({
          type: 'rich_text',
          blocks,
        }),
      });
    } else {
      await createDocument({
        nodeId: pageId,
        workspaceId,
        userId,
        content: {
          type: 'rich_text',
          blocks,
        },
      });
    }
  }

  return getPage(workspaceId, pageId);
};

export const listDatabases = async (workspaceId: string) => {
  const nodes = await database
    .selectFrom('nodes')
    .selectAll()
    .where('workspace_id', '=', workspaceId)
    .where('type', '=', 'database' as NodeType)
    .orderBy('created_at', 'desc')
    .execute();

  return {
    databases: nodes.map((node) => {
      const attrs = node.attributes as Record<string, unknown> | null;
      return serializeNode(node, {
        fields: attrs?.fields ?? {},
        locked: attrs?.locked ?? null,
      });
    }),
  };
};

export const getDatabase = async (workspaceId: string, databaseId: string) => {
  const node = await database
    .selectFrom('nodes')
    .selectAll()
    .where('id', '=', databaseId)
    .where('workspace_id', '=', workspaceId)
    .where('type', '=', 'database' as NodeType)
    .executeTakeFirst();

  if (!node) {
    return { ok: false, error: 'Database not found.' } as const;
  }

  const attrs = node.attributes as Record<string, unknown> | null;
  return {
    ok: true,
    database: serializeNode(node, {
      fields: attrs?.fields ?? {},
      locked: attrs?.locked ?? null,
    }),
  } as const;
};

export const createDatabase = async (
  workspaceId: string,
  userId: string,
  input: {
    name: string;
    parentId?: string;
    avatar?: string | null;
    fields?: Record<string, unknown>;
  }
) => {
  const databaseId = generateId(IdType.Database);
  const parentId = input.parentId ?? workspaceId;

  const parent = await database
    .selectFrom('nodes')
    .select(['id', 'root_id'])
    .where('id', '=', parentId)
    .where('workspace_id', '=', workspaceId)
    .executeTakeFirst();

  const rootId = parent?.root_id ?? databaseId;
  const actualParentId = parent?.id ?? parentId;

  const created = await createNode({
    nodeId: databaseId,
    rootId,
    workspaceId,
    userId,
    attributes: {
      type: 'database',
      name: input.name,
      parentId: actualParentId,
      avatar: input.avatar ?? null,
      fields: (input.fields ?? {}) as never,
      nameField: null,
      locked: false,
    },
  });

  if (!created) {
    return { ok: false, error: 'Failed to create database.' } as const;
  }

  const node = await database
    .selectFrom('nodes')
    .selectAll()
    .where('id', '=', databaseId)
    .executeTakeFirstOrThrow();

  const attrs = node.attributes as Record<string, unknown> | null;
  return {
    ok: true,
    database: serializeNode(node, {
      fields: attrs?.fields ?? {},
      locked: attrs?.locked ?? null,
    }),
  } as const;
};

export const listRecords = async (workspaceId: string, databaseId: string) => {
  const databaseNode = await database
    .selectFrom('nodes')
    .select(['id'])
    .where('id', '=', databaseId)
    .where('workspace_id', '=', workspaceId)
    .where('type', '=', 'database' as NodeType)
    .executeTakeFirst();

  if (!databaseNode) {
    return { ok: false, error: 'Database not found.' } as const;
  }

  const records = await database
    .selectFrom('nodes')
    .selectAll()
    .where('workspace_id', '=', workspaceId)
    .where('type', '=', 'record' as NodeType)
    .where('parent_id', '=', databaseId)
    .orderBy('created_at', 'desc')
    .execute();

  return {
    ok: true,
    records: records.map((node) => {
      const attrs = node.attributes as Record<string, unknown> | null;
      return serializeNode(node, {
        databaseId: attrs?.databaseId ?? node.parent_id,
        fields: attrs?.fields ?? {},
      });
    }),
  } as const;
};

export const getRecord = async (
  workspaceId: string,
  databaseId: string,
  recordId: string
) => {
  const node = await database
    .selectFrom('nodes')
    .selectAll()
    .where('id', '=', recordId)
    .where('workspace_id', '=', workspaceId)
    .where('type', '=', 'record' as NodeType)
    .where('parent_id', '=', databaseId)
    .executeTakeFirst();

  if (!node) {
    return { ok: false, error: 'Record not found.' } as const;
  }

  const attrs = node.attributes as Record<string, unknown> | null;
  return {
    ok: true,
    record: serializeNode(node, {
      databaseId,
      fields: attrs?.fields ?? {},
    }),
  } as const;
};

export const createRecord = async (
  workspaceId: string,
  userId: string,
  databaseId: string,
  input: {
    name: string;
    avatar?: string | null;
    fields?: Record<string, unknown>;
  }
) => {
  const databaseNode = await database
    .selectFrom('nodes')
    .select(['id', 'root_id'])
    .where('id', '=', databaseId)
    .where('workspace_id', '=', workspaceId)
    .where('type', '=', 'database' as NodeType)
    .executeTakeFirst();

  if (!databaseNode) {
    return { ok: false, error: 'Database not found.' } as const;
  }

  const recordId = generateId(IdType.Record);

  const created = await createNode({
    nodeId: recordId,
    rootId: databaseNode.root_id,
    workspaceId,
    userId,
    attributes: {
      type: 'record',
      parentId: databaseId,
      databaseId,
      name: input.name,
      avatar: input.avatar ?? null,
      fields: (input.fields ?? {}) as never,
    },
  });

  if (!created) {
    return { ok: false, error: 'Failed to create record.' } as const;
  }

  const node = await database
    .selectFrom('nodes')
    .selectAll()
    .where('id', '=', recordId)
    .executeTakeFirstOrThrow();

  const attrs = node.attributes as Record<string, unknown> | null;
  return {
    ok: true,
    record: serializeNode(node, {
      databaseId,
      fields: attrs?.fields ?? {},
    }),
  } as const;
};

export const updateRecord = async (
  workspaceId: string,
  userId: string,
  databaseId: string,
  recordId: string,
  input: {
    name?: string;
    avatar?: string | null;
    fields?: Record<string, unknown>;
  }
) => {
  const node = await database
    .selectFrom('nodes')
    .selectAll()
    .where('id', '=', recordId)
    .where('workspace_id', '=', workspaceId)
    .where('type', '=', 'record' as NodeType)
    .where('parent_id', '=', databaseId)
    .executeTakeFirst();

  if (!node) {
    return { ok: false, error: 'Record not found.' } as const;
  }

  const updated = await updateNode({
    nodeId: recordId,
    userId,
    workspaceId,
    updater: (attributes) => {
      if (attributes.type !== 'record') {
        return null;
      }
      const next = { ...attributes } as Record<string, unknown>;
      if (input.name !== undefined) next.name = input.name;
      if (input.avatar !== undefined) next.avatar = input.avatar;
      if (input.fields !== undefined) next.fields = input.fields;
      return next as typeof attributes;
    },
  });

  if (!updated) {
    return { ok: false, error: 'Failed to update record.' } as const;
  }

  const freshNode = await database
    .selectFrom('nodes')
    .selectAll()
    .where('id', '=', recordId)
    .executeTakeFirstOrThrow();

  const attrs = freshNode.attributes as Record<string, unknown> | null;
  return {
    ok: true,
    record: serializeNode(freshNode, {
      databaseId,
      fields: attrs?.fields ?? {},
    }),
  } as const;
};

export const appendPageContent = async (
  workspaceId: string,
  userId: string,
  pageId: string,
  markdownToAppend: string
) => {
  const node = await database
    .selectFrom('nodes')
    .selectAll()
    .where('id', '=', pageId)
    .where('workspace_id', '=', workspaceId)
    .where('type', '=', 'page' as NodeType)
    .executeTakeFirst();

  if (!node) {
    return { ok: false, error: 'Page not found.' } as const;
  }

  const existingDoc = await database
    .selectFrom('documents')
    .selectAll()
    .where('id', '=', pageId)
    .where('workspace_id', '=', workspaceId)
    .executeTakeFirst();

  if (!existingDoc) {
    const blocks = markdownToBlocks(pageId, markdownToAppend);
    await createDocument({
      nodeId: pageId,
      workspaceId,
      userId,
      content: {
        type: 'rich_text',
        blocks,
      },
    });
  } else {
    let currentBlocks: Record<string, Block> = {};
    let contentObj: { blocks?: Record<string, Block> } | null = null;
    if (typeof existingDoc.content === 'string') {
      try {
        contentObj = JSON.parse(existingDoc.content);
      } catch {
        contentObj = null;
      }
    } else if (typeof existingDoc.content === 'object') {
      contentObj = existingDoc.content as unknown as {
        blocks?: Record<string, Block>;
      };
    }

    if (contentObj?.blocks) {
      currentBlocks = contentObj.blocks;
    }

    const rootBlocks = Object.values(currentBlocks)
      .filter((b) => b.parentId === pageId)
      .sort((a, b) => a.index.localeCompare(b.index));
    const lastIndex =
      rootBlocks.length > 0 ? rootBlocks[rootBlocks.length - 1]?.index : undefined;

    const newBlocks = markdownToBlocks(pageId, markdownToAppend, lastIndex);

    await updateDocument({
      documentId: pageId,
      workspaceId,
      userId,
      updater: (content) => {
        const mergedBlocks = {
          ...(content.blocks || {}),
          ...newBlocks,
        };
        return {
          type: 'rich_text',
          blocks: mergedBlocks,
        };
      },
    });
  }

  return getPage(workspaceId, pageId);
};

export const deleteNode = async (
  workspaceId: string,
  userId: string,
  nodeId: string,
  expectedType?: NodeType
) => {
  const node = await database
    .selectFrom('nodes')
    .selectAll()
    .where('id', '=', nodeId)
    .where('workspace_id', '=', workspaceId)
    .executeTakeFirst();

  if (!node) {
    return { ok: false, error: 'Node not found.' } as const;
  }

  if (expectedType && node.type !== expectedType) {
    return { ok: false, error: `Node is not a ${expectedType}.` } as const;
  }

  await database.transaction().execute(async (trx) => {
    await trx
      .deleteFrom('nodes')
      .where('id', '=', nodeId)
      .where('workspace_id', '=', workspaceId)
      .execute();

    await trx
      .insertInto('node_tombstones')
      .values({
        id: node.id,
        root_id: node.root_id,
        workspace_id: node.workspace_id,
        deleted_at: new Date(),
        deleted_by: userId,
      })
      .onConflict((oc) => oc.doNothing())
      .execute();
  });

  if (node.type === 'file') {
    const upload = await database
      .selectFrom('uploads')
      .selectAll()
      .where('file_id', '=', nodeId)
      .executeTakeFirst();

    if (upload) {
      await storage.delete(upload.path);
      await database
        .deleteFrom('uploads')
        .where('file_id', '=', nodeId)
        .execute();
    }
  }

  eventBus.publish({
    type: 'node.deleted',
    nodeId: node.id,
    rootId: node.root_id,
    workspaceId: node.workspace_id,
  });

  try {
    await jobService.addJob({
      type: 'node.clean',
      nodeId: node.id,
      parentId: node.parent_id,
      workspaceId: node.workspace_id,
      userId,
    });
  } catch {
    // Job queue might not be initialized in test or standalone environments.
  }

  return { ok: true, success: true } as const;
};

export const deletePage = (workspaceId: string, userId: string, pageId: string) =>
  deleteNode(workspaceId, userId, pageId, 'page' as NodeType);

export const deleteDatabaseNode = (
  workspaceId: string,
  userId: string,
  databaseId: string
) => deleteNode(workspaceId, userId, databaseId, 'database' as NodeType);

export const deleteRecord = (
  workspaceId: string,
  userId: string,
  recordId: string
) => deleteNode(workspaceId, userId, recordId, 'record' as NodeType);

export const updateDatabase = async (
  workspaceId: string,
  userId: string,
  databaseId: string,
  input: {
    name?: string;
    avatar?: string | null;
    fields?: Record<string, unknown>;
  }
) => {
  const node = await database
    .selectFrom('nodes')
    .selectAll()
    .where('id', '=', databaseId)
    .where('workspace_id', '=', workspaceId)
    .where('type', '=', 'database' as NodeType)
    .executeTakeFirst();

  if (!node) {
    return { ok: false, error: 'Database not found.' } as const;
  }

  const updated = await updateNode({
    nodeId: databaseId,
    userId,
    workspaceId,
    updater: (attributes) => {
      if (attributes.type !== 'database') {
        return null;
      }
      const next = { ...attributes } as Record<string, unknown>;
      if (input.name !== undefined) next.name = input.name;
      if (input.avatar !== undefined) next.avatar = input.avatar;
      if (input.fields !== undefined) next.fields = input.fields;
      return next as typeof attributes;
    },
  });

  if (!updated) {
    return { ok: false, error: 'Failed to update database.' } as const;
  }

  const freshNode = await database
    .selectFrom('nodes')
    .selectAll()
    .where('id', '=', databaseId)
    .executeTakeFirstOrThrow();

  const attrs = freshNode.attributes as Record<string, unknown> | null;
  return {
    ok: true,
    database: serializeNode(freshNode, {
      fields: attrs?.fields ?? {},
      locked: attrs?.locked ?? null,
    }),
  } as const;
};

export const createFolder = async (
  workspaceId: string,
  userId: string,
  input: {
    name: string;
    parentId?: string;
    avatar?: string | null;
  }
) => {
  const folderId = generateId(IdType.Folder);
  let parentId = input.parentId ?? null;
  let rootId = folderId;

  if (parentId) {
    const parent = await database
      .selectFrom('nodes')
      .select(['id', 'root_id'])
      .where('id', '=', parentId)
      .where('workspace_id', '=', workspaceId)
      .executeTakeFirst();

    if (!parent) {
      return { ok: false, error: 'Parent node not found in workspace.' } as const;
    }

    rootId = parent.root_id;
  }

  const created = await createNode({
    nodeId: folderId,
    rootId,
    workspaceId,
    userId,
    attributes: {
      type: 'folder',
      name: input.name,
      parentId: parentId ?? rootId,
      avatar: input.avatar ?? null,
    },
  });

  if (!created) {
    return { ok: false, error: 'Failed to create folder.' } as const;
  }

  const node = await database
    .selectFrom('nodes')
    .selectAll()
    .where('id', '=', folderId)
    .executeTakeFirstOrThrow();

  return { ok: true, folder: serializeNode(node) } as const;
};

export const moveNode = async (
  workspaceId: string,
  userId: string,
  nodeId: string,
  newParentId: string
) => {
  const node = await database
    .selectFrom('nodes')
    .selectAll()
    .where('id', '=', nodeId)
    .where('workspace_id', '=', workspaceId)
    .executeTakeFirst();

  if (!node) {
    return { ok: false, error: 'Node not found.' } as const;
  }

  if (newParentId === nodeId) {
    return { ok: false, error: 'Cannot move node into itself.' } as const;
  }

  const parent = await database
    .selectFrom('nodes')
    .selectAll()
    .where('id', '=', newParentId)
    .where('workspace_id', '=', workspaceId)
    .executeTakeFirst();

  if (!parent) {
    return { ok: false, error: 'Target parent node not found in workspace.' } as const;
  }

  const descendant = await database
    .selectFrom('node_paths')
    .select('descendant_id')
    .where('ancestor_id', '=', nodeId)
    .where('descendant_id', '=', newParentId)
    .executeTakeFirst();

  if (descendant) {
    return { ok: false, error: 'Cannot move node into its descendant.' } as const;
  }

  const updated = await updateNode({
    nodeId,
    userId,
    workspaceId,
    updater: (attributes) => {
      return {
        ...attributes,
        parentId: newParentId,
      };
    },
  });

  if (!updated) {
    return { ok: false, error: 'Failed to move node.' } as const;
  }

  const freshNode = await database
    .selectFrom('nodes')
    .selectAll()
    .where('id', '=', nodeId)
    .executeTakeFirstOrThrow();

  return { ok: true, node: serializeNode(freshNode) } as const;
};

export const searchWorkspace = async (
  workspaceId: string,
  query: string,
  type?: string
) => {
  const trimmed = query.trim();
  if (!trimmed) {
    return { results: [] };
  }

  let nodesQuery = database
    .selectFrom('nodes')
    .selectAll()
    .where('workspace_id', '=', workspaceId)
    .where(sql<boolean>`attributes->>'name' ILIKE ${'%' + trimmed + '%'}`);

  if (type) {
    nodesQuery = nodesQuery.where('type', '=', type as NodeType);
  }

  const matchedNodes = await nodesQuery.limit(25).execute();

  let matchedDocNodes: SelectNode[] = [];
  if (!type || type === 'page' || type === 'record') {
    const matchedDocs = await database
      .selectFrom('documents')
      .select(['id', 'content'])
      .where('workspace_id', '=', workspaceId)
      .where(sql<boolean>`content::text ILIKE ${'%' + trimmed + '%'}`)
      .limit(25)
      .execute();

    const existingIds = new Set(matchedNodes.map((n) => n.id));
    const newDocIds = matchedDocs
      .map((d) => d.id)
      .filter((id) => !existingIds.has(id));

    if (newDocIds.length > 0) {
      let docNodesQuery = database
        .selectFrom('nodes')
        .selectAll()
        .where('workspace_id', '=', workspaceId)
        .where('id', 'in', newDocIds);

      if (type) {
        docNodesQuery = docNodesQuery.where('type', '=', type as NodeType);
      }

      matchedDocNodes = await docNodesQuery.execute();
    }
  }

  const allNodes = [...matchedNodes, ...matchedDocNodes];
  return {
    results: allNodes.map((n) => serializeNode(n)),
  };
};

