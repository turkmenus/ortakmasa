export type ApiToken = {
  id: string;
  accountId: string;
  workspaceId: string | null;
  userId: string | null;
  name: string;
  scopes: string[];
  status: number;
  lastUsedAt: string | null;
  createdAt: string;
  token?: string;
};
