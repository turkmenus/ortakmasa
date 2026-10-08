import { MutationHandler } from '@colanode/client/lib/types';
import { MutationError, MutationErrorCode } from '@colanode/client/mutations';
import {
  TokenCreateMutationInput,
  TokenCreateMutationOutput,
} from '@colanode/client/mutations/tokens/token-create';
import { AppService } from '@colanode/client/services/app-service';
import { ApiToken } from '@colanode/client/types/tokens';

export class TokenCreateMutationHandler
  implements MutationHandler<TokenCreateMutationInput>
{
  private readonly app: AppService;

  constructor(appService: AppService) {
    this.app = appService;
  }

  async handleMutation(
    input: TokenCreateMutationInput
  ): Promise<TokenCreateMutationOutput> {
    const accountService = this.app.getAccount(input.accountId);

    if (!accountService) {
      throw new MutationError(
        MutationErrorCode.AccountNotFound,
        'Account not found or has been logged out.'
      );
    }

    try {
      const response = await accountService.client
        .post('v1/tokens', {
          json: {
            name: input.name,
            workspaceId: input.workspaceId,
            userId: input.userId,
            scopes: input.scopes ?? ['read', 'write'],
          },
        })
        .json<{ token: ApiToken }>();

      return response;
    } catch (error) {
      throw new MutationError(
        MutationErrorCode.ApiError,
        `Failed to create API token: ${error}`
      );
    }
  }
}
