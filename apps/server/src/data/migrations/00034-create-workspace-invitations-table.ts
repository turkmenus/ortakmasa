import { Migration } from 'kysely';

export const createWorkspaceInvitationsTable: Migration = {
  up: async (db) => {
    await db.schema
      .createTable('workspace_invitations')
      .addColumn('id', 'varchar(30)', (col) => col.notNull().primaryKey())
      .addColumn('workspace_id', 'varchar(30)', (col) => col.notNull())
      .addColumn('created_by', 'varchar(30)', (col) => col.notNull())
      .addColumn('email', 'varchar(512)')
      .addColumn('role', 'varchar(32)', (col) => col.notNull())
      .addColumn('token_hash', 'varchar(256)', (col) => col.notNull())
      .addColumn('token_salt', 'varchar(256)', (col) => col.notNull())
      .addColumn('status', 'integer', (col) => col.notNull().defaultTo(1))
      .addColumn('expires_at', 'timestamptz')
      .addColumn('accepted_at', 'timestamptz')
      .addColumn('accepted_by', 'varchar(30)')
      .addColumn('created_at', 'timestamptz', (col) => col.notNull())
      .addColumn('updated_at', 'timestamptz')
      .execute();

    await db.schema
      .createIndex('workspace_invitations_workspace_id_idx')
      .on('workspace_invitations')
      .columns(['workspace_id'])
      .execute();

    await db.schema
      .createIndex('workspace_invitations_token_hash_idx')
      .on('workspace_invitations')
      .columns(['token_hash'])
      .execute();
  },
  down: async (db) => {
    await db.schema.dropIndex('workspace_invitations_token_hash_idx').execute();
    await db.schema
      .dropIndex('workspace_invitations_workspace_id_idx')
      .execute();
    await db.schema.dropTable('workspace_invitations').execute();
  },
};
