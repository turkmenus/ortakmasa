export type TokenDeleteMutationInput = {
  type: 'token.delete';
  accountId: string;
  id: string;
};

export type TokenDeleteMutationOutput = {
  success: boolean;
};

declare module '@colanode/client/mutations' {
  interface MutationMap {
    'token.delete': {
      input: TokenDeleteMutationInput;
      output: TokenDeleteMutationOutput;
    };
  }
}
