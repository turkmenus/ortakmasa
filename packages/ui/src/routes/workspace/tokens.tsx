import { createRoute, redirect } from '@tanstack/react-router';

import { ApiTokensContainer } from '@colanode/ui/components/tokens/api-tokens-container';
import { ApiTokensTab } from '@colanode/ui/components/tokens/api-tokens-tab';
import { getWorkspaceUserId } from '@colanode/ui/routes/utils';
import {
  workspaceRoute,
  workspaceMaskRoute,
} from '@colanode/ui/routes/workspace';

export const apiTokensRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/tokens',
  component: ApiTokensContainer,
  context: () => {
    return {
      tab: <ApiTokensTab />,
    };
  },
});

export const apiTokensMaskRoute = createRoute({
  getParentRoute: () => workspaceMaskRoute,
  path: '/tokens',
  component: () => null,
  beforeLoad: (ctx) => {
    const userId = getWorkspaceUserId(ctx.params.workspaceId);
    if (userId) {
      throw redirect({
        to: '/workspace/$userId/tokens',
        params: { userId },
        replace: true,
      });
    }
  },
});
