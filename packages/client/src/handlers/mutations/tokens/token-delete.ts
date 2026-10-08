import { MutationHandler } from '@colanode/client/lib/types';
import { MutationError, MutationErrorCode } from '@colanode/client/mutations';
import {
  TokenDeleteMutationInput,
  TokenDeleteMutationOutput,
} from '@colanode/client/mutations/tokens/token-delete';
import { AppService } from '@colanode/client/services/app-service';

export class TokenDeleteMutationHandler
  implements MutationHandler<TokenDeleteMutationInput>
{
  private readonly app: AppService;

  constructor(appService: AppService) {
    this.app = appService;
  }

  async handleMutation(
    input: TokenDeleteMutationInput
  ): Promise<TokenDeleteMutationOutput> {
    const accountService = this.app.getAccount(input.accountId);

    if (!accountService) {
      throw new MutationError(
        MutationErrorCode.AccountNotFound,
        'Account not found or has been logged out.'
      );
    }

    try {
      await accountService.client.delete(`v1/tokens/${input.id}`);
      return { success: true };
    } catch (error) {
      throw new MutationError(
        MutationErrorCode.ApiError,
        `Failed to delete API token: ${error}`
      );
    }
  }
}
