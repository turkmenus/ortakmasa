import { ApiToken } from '@colanode/client/types/tokens';

export type TokenCreateMutationInput = {
  type: 'token.create';
  accountId: string;
  name: string;
  workspaceId?: string | null;
  userId?: string | null;
  scopes?: string[];
};

export type TokenCreateMutationOutput = {
  token: ApiToken;
};

declare module '@colanode/client/mutations' {
  interface MutationMap {
    'token.create': {
      input: TokenCreateMutationInput;
      output: TokenCreateMutationOutput;
    };
  }
}
