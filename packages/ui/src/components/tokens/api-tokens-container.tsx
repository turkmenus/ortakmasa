import { Container } from '@colanode/ui/components/layouts/containers/container';
import { Separator } from '@colanode/ui/components/ui/separator';

import { ApiTokensBreadcrumb } from './api-tokens-breadcrumb';
import { ApiTokensList } from './api-tokens-list';

export const ApiTokensContainer = () => {
  return (
    <Container type="full" breadcrumb={<ApiTokensBreadcrumb />}>
      <div className="max-w-4xl space-y-8">
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">API Tokens</h2>
            <Separator className="mt-3" />
          </div>
          <ApiTokensList />
        </div>
      </div>
    </Container>
  );
};
