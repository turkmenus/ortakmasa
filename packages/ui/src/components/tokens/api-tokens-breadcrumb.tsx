import { BreadcrumbItem } from '@colanode/ui/components/layouts/containers/breadcrumb-item';
import { defaultIcons } from '@colanode/ui/lib/assets';

export const ApiTokensBreadcrumb = () => {
  return (
    <BreadcrumbItem
      id="tokens"
      avatar={defaultIcons.apps}
      name="API Tokens"
    />
  );
};

