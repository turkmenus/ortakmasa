import { ChangeCheckResult, QueryHandler } from '@colanode/client/lib/types';
import { QueryError, QueryErrorCode } from '@colanode/client/queries';
import {
  TokenListQueryInput,
  TokenListQueryOutput,
} from '@colanode/client/queries/tokens/token-list';
import { AppService } from '@colanode/client/services/app-service';
import { ApiToken } from '@colanode/client/types/tokens';
import { Event } from '@colanode/client/types/events';

export class TokenListQueryHandler
  implements QueryHandler<TokenListQueryInput>
{
  private readonly app: AppService;

  constructor(appService: AppService) {
    this.app = appService;
  }

  async handleQuery(
    input: TokenListQueryInput
  ): Promise<TokenListQueryOutput> {
    const accountService = this.app.getAccount(input.accountId);

    if (!accountService) {
      throw new QueryError(
        QueryErrorCode.AccountNotFound,
        'Account not found or has been logged out.'
      );
    }

    try {
      const response = await accountService.client
        .get('v1/tokens')
        .json<{ tokens: ApiToken[] }>();

      return response.tokens;
    } catch (error) {
      throw new QueryError(
        QueryErrorCode.ApiError,
        `Failed to fetch API tokens: ${error}`
      );
    }
  }

  public async checkForChanges(
    _event: Event,
    _input: TokenListQueryInput,
    _output: TokenListQueryOutput
  ): Promise<ChangeCheckResult<TokenListQueryInput>> {
    return {
      hasChanges: false,
    };
  }
}
