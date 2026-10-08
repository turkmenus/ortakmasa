import { database } from '@colanode/server/data/database';
import { SelectNode } from '@colanode/server/data/schema';
import { createNode, mapNode, updateNode } from '@colanode/server/lib/nodes';
import {
  generateId,
  hasWorkspaceRole,
  IdType,
  NodeType,
} from '@colanode/core';

export const requireCollaborator = (role: string): boolean => {
  return hasWorkspaceRole(role as never, 'collaborator');
};

export const serializeNode = (
  node: SelectNode,
  extra: Record<string, unknown> = {}
): Record<string, unknown> => {
  const mapped = mapNode(node);
  const attrs = mapped as unknown as Record<string, unknown>;
  return {
    id: mapped.id,
    rootId: mapped.rootId,
    parentId: mapped.parentId,
    type: mapped.type,
    name: (attrs.name as string | undefined) ?? null,
    avatar: (attrs.avatar as string | null | undefined) ?? null,
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

  return { ok: true, page: serializeNode(node) } as const;
};

export const createPage = async (
  workspaceId: string,
  userId: string,
  input: {
    name: string;
    parentId?: string;
    avatar?: string | null;
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
    },
  });

  if (!created) {
    return { ok: false, error: 'Failed to create page.' } as const;
  }

  const node = await database
    .selectFrom('nodes')
    .selectAll()
    .where('id', '=', pageId)
    .executeTakeFirstOrThrow();

  return { ok: true, page: serializeNode(node) } as const;
};

export const updatePage = async (
  workspaceId: string,
  userId: string,
  pageId: string,
  input: {
    name?: string;
    avatar?: string | null;
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
      return next;
    },
  });

  if (!updated) {
    return { ok: false, error: 'Failed to update page.' } as const;
  }

  const freshNode = await database
    .selectFrom('nodes')
    .selectAll()
    .where('id', '=', pageId)
    .executeTakeFirstOrThrow();

  return { ok: true, page: serializeNode(freshNode) } as const;
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
