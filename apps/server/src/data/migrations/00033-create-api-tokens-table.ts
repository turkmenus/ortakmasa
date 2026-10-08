import { Migration } from 'kysely';

export const createApiTokensTable: Migration = {
  up: async (db) => {
    await db.schema
      .createTable('api_tokens')
      .addColumn('id', 'varchar(30)', (col) => col.notNull().primaryKey())
      .addColumn('account_id', 'varchar(30)', (col) => col.notNull())
      .addColumn('workspace_id', 'varchar(30)')
      .addColumn('user_id', 'varchar(30)')
      .addColumn('name', 'varchar(256)', (col) => col.notNull())
      .addColumn('token_hash', 'varchar(256)', (col) => col.notNull())
      .addColumn('token_salt', 'varchar(256)', (col) => col.notNull())
      .addColumn('scopes', 'jsonb', (col) => col.notNull().defaultTo('[]'))
      .addColumn('status', 'integer', (col) => col.notNull().defaultTo(1))
      .addColumn('last_used_at', 'timestamptz')
      .addColumn('revoked_at', 'timestamptz')
      .addColumn('created_at', 'timestamptz', (col) => col.notNull())
      .addColumn('updated_at', 'timestamptz')
      .execute();

    await db.schema
      .createIndex('api_tokens_account_id_idx')
      .on('api_tokens')
      .columns(['account_id'])
      .execute();
  },
  down: async (db) => {
    await db.schema.dropIndex('api_tokens_account_id_idx').execute();
    await db.schema.dropTable('api_tokens').execute();
  },
};
