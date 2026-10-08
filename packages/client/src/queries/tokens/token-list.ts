import { ApiToken } from '@colanode/client/types/tokens';

export type TokenListQueryInput = {
  type: 'token.list';
  accountId: string;
};

export type TokenListQueryOutput = ApiToken[];

declare module '@colanode/client/queries' {
  interface QueryMap {
    'token.list': {
      input: TokenListQueryInput;
      output: TokenListQueryOutput;
    };
  }
}
