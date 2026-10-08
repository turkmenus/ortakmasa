import { useState } from 'react';
import { toast } from 'sonner';

import { ApiToken } from '@colanode/client/types';
import { Button } from '@colanode/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@colanode/ui/components/ui/dialog';
import { Input } from '@colanode/ui/components/ui/input';
import { Label } from '@colanode/ui/components/ui/label';
import { Spinner } from '@colanode/ui/components/ui/spinner';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { useMutation } from '@colanode/ui/hooks/use-mutation';

interface ApiTokenCreateDialogProps {
  onClose: () => void;
  onCreated: (token: ApiToken) => void;
}

export const ApiTokenCreateDialog = ({
  onClose,
  onCreated,
}: ApiTokenCreateDialogProps) => {
  const workspace = useWorkspace();
  const [name, setName] = useState('');
  const { mutate, isPending } = useMutation();

  const handleCreate = () => {
    if (!name.trim()) {
      toast.error('Token name is required');
      return;
    }

    mutate({
      input: {
        type: 'token.create',
        accountId: workspace.accountId,
        name: name.trim(),
        workspaceId: workspace.workspaceId,
        scopes: ['read', 'write'],
      },
      onSuccess: (data) => {
        toast.success('Token created successfully');
        onCreated(data.token);
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to create token');
      },
    });
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Personal Access Token</DialogTitle>
          <DialogDescription>
            Personal Access Tokens (Bearer tokens) grant API and MCP access to your Ortakmasa account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="token-name">Token Name</Label>
            <Input
              id="token-name"
              placeholder="e.g. Claude Code, Cursor, Antigravity, CI/CD"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreate();
                }
              }}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              What is this token for? A descriptive name helps you identify it later.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" onClick={handleCreate} disabled={isPending || !name.trim()}>
            {isPending && <Spinner className="mr-2 h-4 w-4" />}
            Create Token
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
