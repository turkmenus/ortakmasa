import { useState } from 'react';
import { Check, Copy, Key, ShieldAlert } from 'lucide-react';
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

interface ApiTokenDisplayDialogProps {
  token: ApiToken;
  onClose: () => void;
}

export const ApiTokenDisplayDialog = ({
  token,
  onClose,
}: ApiTokenDisplayDialogProps) => {
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedMcp, setCopiedMcp] = useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://oratakmasa.testedeli.online';
  const mcpUrl = `${origin}/mcp`;

  const mcpConfig = JSON.stringify(
    {
      mcpServers: {
        ortakmasa: {
          url: mcpUrl,
          headers: {
            Authorization: `Bearer ${token.token}`,
          },
        },
      },
    },
    null,
    2
  );

  const handleCopyToken = () => {
    if (token.token) {
      navigator.clipboard.writeText(token.token);
      setCopiedToken(true);
      toast.success('Token copied to clipboard');
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  const handleCopyMcp = () => {
    navigator.clipboard.writeText(mcpConfig);
    setCopiedMcp(true);
    toast.success('MCP configuration copied to clipboard');
    setTimeout(() => setCopiedMcp(false), 2000);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl w-full max-h-[90vh] overflow-y-auto overflow-x-hidden p-6">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-500/10 text-green-500">
              <Key className="h-5 w-5" />
            </div>
            <div className="min-w-0 text-left">
              <DialogTitle className="truncate">Personal Access Token Created</DialogTitle>
              <DialogDescription className="truncate">
                {token.name} was successfully created.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 w-full min-w-0">
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-500 text-xs sm:text-sm w-full min-w-0">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">
              Make sure to copy your personal access token now. You will not be able to see it again!
            </span>
          </div>

          <div className="space-y-1.5 w-full min-w-0">
            <Label className="text-xs text-muted-foreground font-medium">Bearer Token</Label>
            <div className="flex items-center gap-2 w-full min-w-0">
              <Input
                readOnly
                value={token.token || ''}
                className="font-mono text-xs select-all bg-muted/40 min-w-0 flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0 h-9 w-9"
                onClick={handleCopyToken}
                title="Copy token"
              >
                {copiedToken ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {token.workspaceId && (
            <div className="space-y-1.5 w-full min-w-0">
              <Label className="text-xs text-muted-foreground font-medium">Workspace ID</Label>
              <div className="flex items-center gap-2 w-full min-w-0">
                <Input
                  readOnly
                  value={token.workspaceId}
                  className="font-mono text-xs select-all bg-muted/40 min-w-0 flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 h-9 w-9"
                  onClick={() => {
                    navigator.clipboard.writeText(token.workspaceId!);
                    toast.success('Workspace ID copied to clipboard');
                  }}
                  title="Copy workspace ID"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-1.5 w-full min-w-0">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground font-medium">
                MCP Agent Config (Claude Desktop / Cursor)
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={handleCopyMcp}
              >
                {copiedMcp ? (
                  <>
                    <Check className="mr-1 h-3.5 w-3.5 text-green-500" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-1 h-3.5 w-3.5" /> Copy Config
                  </>
                )}
              </Button>
            </div>
            <div className="w-full min-w-0 rounded-md border bg-muted/50 overflow-hidden">
              <pre className="p-3 font-mono text-[11px] leading-relaxed overflow-x-auto text-muted-foreground select-all max-h-48 overflow-y-auto">
                {mcpConfig}
              </pre>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button type="button" onClick={onClose} className="w-full sm:w-auto">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
