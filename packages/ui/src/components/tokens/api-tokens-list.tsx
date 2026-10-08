import { useState } from 'react';
import { Copy, Key, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { ApiToken } from '@colanode/client/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@colanode/ui/components/ui/alert-dialog';
import { Badge } from '@colanode/ui/components/ui/badge';
import { Button } from '@colanode/ui/components/ui/button';
import { Spinner } from '@colanode/ui/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@colanode/ui/components/ui/table';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { useMutation } from '@colanode/ui/hooks/use-mutation';
import { useQuery } from '@colanode/ui/hooks/use-query';

import { ApiTokenCreateDialog } from './api-token-create-dialog';
import { ApiTokenDisplayDialog } from './api-token-display-dialog';

export const ApiTokensList = () => {
  const workspace = useWorkspace();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createdToken, setCreatedToken] = useState<ApiToken | null>(null);
  const [tokenToDelete, setTokenToDelete] = useState<ApiToken | null>(null);

  const { data: tokens, isLoading, refetch } = useQuery({
    type: 'token.list',
    accountId: workspace.accountId,
  });

  const { mutate: deleteToken, isPending: isDeleting } = useMutation();

  const handleDelete = () => {
    if (!tokenToDelete) return;

    deleteToken({
      input: {
        type: 'token.delete',
        accountId: workspace.accountId,
        id: tokenToDelete.id,
      },
      onSuccess: () => {
        toast.success(`Token '${tokenToDelete.name}' revoked successfully`);
        setTokenToDelete(null);
        refetch();
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to revoke token');
      },
    });
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'Never';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Personal Access Tokens</h3>
          <p className="text-sm text-muted-foreground">
            Manage Bearer tokens to connect AI agents via MCP or access the REST API.
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Create Token
        </Button>
      </div>

      <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3 text-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Active Workspace ID:
          </span>
          <code className="font-mono text-xs font-semibold text-foreground select-all bg-background px-2 py-0.5 rounded border">
            {workspace.workspaceId}
          </code>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => {
            navigator.clipboard.writeText(workspace.workspaceId);
            toast.success('Workspace ID copied to clipboard');
          }}
        >
          <Copy className="h-3.5 w-3.5" /> Copy ID
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <Spinner className="h-6 w-6 text-muted-foreground" />
        </div>
      ) : tokens && tokens.length > 0 ? (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Token ID</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last Used</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens.map((token) => (
                <TableRow key={token.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4 text-muted-foreground" />
                      <span>{token.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {token.id}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(token.createdAt)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(token.lastUsedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setTokenToDelete(token)}
                      title="Revoke token"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Key className="h-6 w-6" />
          </div>
          <h4 className="mt-4 font-semibold text-foreground">No active tokens</h4>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm">
            You have not created any Personal Access Tokens yet. Create one to connect AI agents via MCP.
          </p>
          <Button
            onClick={() => setIsCreateOpen(true)}
            variant="outline"
            className="mt-4 gap-2"
          >
            <Plus className="h-4 w-4" /> Create Token
          </Button>
        </div>
      )}

      {isCreateOpen && (
        <ApiTokenCreateDialog
          onClose={() => setIsCreateOpen(false)}
          onCreated={(token) => {
            setIsCreateOpen(false);
            setCreatedToken(token);
            refetch();
          }}
        />
      )}

      {createdToken && (
        <ApiTokenDisplayDialog
          token={createdToken}
          onClose={() => setCreatedToken(null)}
        />
      )}

      <AlertDialog
        open={Boolean(tokenToDelete)}
        onOpenChange={(open) => !open && setTokenToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Personal Access Token?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke &quot;{tokenToDelete?.name}&quot;?
              Any applications or AI agents using this token will immediately lose access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Revoking...' : 'Revoke Token'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
