import { FastifyPluginCallback, FastifyReply } from 'fastify';
import { z } from 'zod';

import {
  generateId,
  hasWorkspaceRole,
  IdType,
  UserStatus,
} from '@colanode/core';
import { database } from '@colanode/server/data/database';
import { eventBus } from '@colanode/server/lib/event-bus';
import {
  generateApiTokenId,
  generateInvitationToken,
} from '@colanode/server/lib/tokens';
import { getNameFromEmail } from '@colanode/server/lib/utils';

const workspaceRoleSchema = z.enum([
  'owner',
  'admin',
  'collaborator',
  'guest',
  'none',
]);

const createInvitationBodySchema = z.object({
  email: z.string().email().optional(),
  role: workspaceRoleSchema.default('collaborator'),
  expiresInHours: z.number().int().min(1).max(720).optional(),
});

const maskToken = (hash: string): string => {
  if (hash.length <= 12) return hash;
  return `${hash.slice(0, 6)}...${hash.slice(-6)}`;
};

const requireAdmin = (
  workspace: { user: { role: string } },
  reply: FastifyReply
): boolean => {
  if (!hasWorkspaceRole(workspace.user.role as never, 'admin')) {
    reply.code(403).send({
      code: 'forbidden',
      message: 'Only workspace owner or admin can manage invitations.',
    });
    return false;
  }
  return true;
};

const serializeInvitation = (
  invitation: {
    id: string;
    workspace_id: string;
    created_by: string;
    email: string | null;
    role: string;
    status: number;
    expires_at: Date | null;
    accepted_at: Date | null;
    accepted_by: string | null;
    created_at: Date;
    updated_at: Date | null;
    token_hash?: string;
  },
  plainToken?: string
): Record<string, unknown> => {
  const result: Record<string, unknown> = {
    id: invitation.id,
    workspaceId: invitation.workspace_id,
    createdBy: invitation.created_by,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    expiresAt: invitation.expires_at?.toISOString() ?? null,
    acceptedAt: invitation.accepted_at?.toISOString() ?? null,
    acceptedBy: invitation.accepted_by,
    createdAt: invitation.created_at.toISOString(),
    updatedAt: invitation.updated_at?.toISOString() ?? null,
  };

  if (plainToken) {
    result.token = plainToken;
  } else {
    result.token = maskToken(invitation.token_hash ?? '');
  }

  return result;
};

export const invitationRoutes: FastifyPluginCallback = (instance, _, done) => {
  // Create invitation
  instance.post('/', async (request, reply) => {
    const body = createInvitationBodySchema.parse(request.body);
    const workspace = request.workspace;

    if (!requireAdmin(workspace, reply)) {
      return;
    }

    const invitationId = generateApiTokenId();
    const generated = generateInvitationToken(invitationId);

    const expiresAt = body.expiresInHours
      ? new Date(Date.now() + body.expiresInHours * 60 * 60 * 1000)
      : null;

    await database
      .insertInto('workspace_invitations')
      .values({
        id: generated.id,
        workspace_id: workspace.id,
        created_by: workspace.user.id,
        email: body.email ?? null,
        role: body.role,
        token_hash: generated.hash,
        token_salt: generated.salt,
        status: 1,
        expires_at: expiresAt,
        created_at: new Date(),
      })
      .execute();

    const invitation = await database
      .selectFrom('workspace_invitations')
      .selectAll()
      .where('id', '=', generated.id)
      .executeTakeFirstOrThrow();

    return reply.code(201).send({
      invitation: serializeInvitation(invitation, generated.token),
    });
  });

  // List invitations
  instance.get('/', async (request) => {
    const workspace = request.workspace;

    const invitations = await database
      .selectFrom('workspace_invitations')
      .selectAll()
      .where('workspace_id', '=', workspace.id)
      .where('status', '=', 1)
      .orderBy('created_at', 'desc')
      .execute();

    return {
      invitations: invitations.map((inv) => serializeInvitation(inv)),
    };
  });

  // Revoke invitation
  instance.delete('/:invitationId', async (request, reply) => {
    const { invitationId } = request.params as { invitationId: string };
    const workspace = request.workspace;

    if (!requireAdmin(workspace, reply)) {
      return;
    }

    await database
      .updateTable('workspace_invitations')
      .set({
        status: 0,
        updated_at: new Date(),
      })
      .where('id', '=', invitationId)
      .where('workspace_id', '=', workspace.id)
      .execute();

    return reply.code(204).send();
  });

  done();
};

export const acceptInvitationRoute: FastifyPluginCallback = (
  instance,
  _,
  done
) => {
  instance.post('/:token/accept', async (request, reply) => {
    const { token } = request.params as { token: string };
    const accountId = request.account.id;

    if (!token.startsWith('oinv_')) {
      return reply.code(400).send({
        code: 'invalid_token',
        message: 'Invalid invitation token.',
      });
    }

    const tokenWithoutPrefix = token.slice('oinv_'.length);
    const tokenId = tokenWithoutPrefix.slice(0, 28);
    const secret = tokenWithoutPrefix.slice(28);

    const invitation = await database
      .selectFrom('workspace_invitations')
      .selectAll()
      .where('id', '=', tokenId)
      .executeTakeFirst();

    if (!invitation || invitation.status !== 1) {
      return reply.code(400).send({
        code: 'invalid_token',
        message: 'Invitation not found or already used.',
      });
    }

    if (
      invitation.expires_at !== null &&
      new Date(invitation.expires_at) < new Date()
    ) {
      await database
        .updateTable('workspace_invitations')
        .set({ status: 0, updated_at: new Date() })
        .where('id', '=', tokenId)
        .execute();

      return reply.code(400).send({
        code: 'expired_token',
        message: 'Invitation has expired.',
      });
    }

    const account = await database
      .selectFrom('accounts')
      .selectAll()
      .where('id', '=', accountId)
      .executeTakeFirst();

    if (!account) {
      return reply.code(401).send({
        code: 'unauthorized',
        message: 'Account not found.',
      });
    }

    const existingUser = await database
      .selectFrom('users')
      .selectAll()
      .where('account_id', '=', accountId)
      .where('workspace_id', '=', invitation.workspace_id)
      .executeTakeFirst();

    if (existingUser) {
      return reply.code(400).send({
        code: 'already_member',
        message: 'You are already a member of this workspace.',
      });
    }

    const userId = generateId(IdType.User);
    const newUser = await database
      .insertInto('users')
      .returningAll()
      .values({
        id: userId,
        account_id: accountId,
        workspace_id: invitation.workspace_id,
        role: invitation.role as never,
        name: account.name,
        email: account.email,
        avatar: account.avatar,
        created_at: new Date(),
        created_by: accountId,
        status: UserStatus.Active,
        max_file_size: '0',
        storage_limit: '0',
      })
      .executeTakeFirst();

    if (!newUser) {
      return reply.code(500).send({
        code: 'unknown',
        message: 'Failed to join workspace.',
      });
    }

    await database
      .updateTable('workspace_invitations')
      .set({
        status: 0,
        accepted_at: new Date(),
        accepted_by: accountId,
        updated_at: new Date(),
      })
      .where('id', '=', tokenId)
      .execute();

    eventBus.publish({
      type: 'user.created',
      accountId,
      userId,
      workspaceId: invitation.workspace_id,
    });

    return {
      user: {
        id: newUser.id,
        accountId: newUser.account_id,
        workspaceId: newUser.workspace_id,
        role: newUser.role,
        name: newUser.name,
        email: newUser.email,
        avatar: newUser.avatar,
        createdAt: newUser.created_at.toISOString(),
      },
    };
  });

  done();
};
