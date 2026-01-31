import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Users,
  Search,
  RefreshCw,
  Loader2,
  MessageSquare,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

interface WhatsAppGroup {
  id: string;
  subject: string;
  size: number;
  owner?: string;
  creation?: number;
}

interface GroupSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
  onSelectGroups: (groups: Array<{ id: string; name: string; size: number }>) => void;
}

export const GroupSelector = ({
  open,
  onOpenChange,
  instanceId,
  onSelectGroups,
}: GroupSelectorProps) => {
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && instanceId) {
      fetchGroups();
    }
  }, [open, instanceId]);

  const fetchGroups = async () => {
    if (!instanceId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke("evolution-api", {
        body: {
          action: "fetchGroups",
          instanceId,
        },
      });

      if (fnError) {
        throw new Error(fnError.message || "Erro ao buscar grupos");
      }

      // Handle different response formats from Evolution API
      let groupsList: WhatsAppGroup[] = [];
      
      if (Array.isArray(data)) {
        groupsList = data.map((g: any) => ({
          id: g.id || g.jid || g.groupId,
          subject: g.subject || g.name || g.groupName || "Grupo sem nome",
          size: g.size || g.participants?.length || 0,
          owner: g.owner || g.subjectOwner,
          creation: g.creation,
        }));
      } else if (data?.groups && Array.isArray(data.groups)) {
        groupsList = data.groups.map((g: any) => ({
          id: g.id || g.jid || g.groupId,
          subject: g.subject || g.name || g.groupName || "Grupo sem nome",
          size: g.size || g.participants?.length || 0,
          owner: g.owner || g.subjectOwner,
          creation: g.creation,
        }));
      } else if (data?.error) {
        throw new Error(data.error);
      }

      setGroups(groupsList);
      
      if (groupsList.length === 0) {
        setError("Nenhum grupo encontrado nesta instância");
      }
    } catch (err: any) {
      console.error("Error fetching groups:", err);
      setError(err.message || "Erro ao buscar grupos do WhatsApp");
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (groupId: string) => {
    const newSelected = new Set(selectedGroups);
    if (newSelected.has(groupId)) {
      newSelected.delete(groupId);
    } else {
      newSelected.add(groupId);
    }
    setSelectedGroups(newSelected);
  };

  const handleConfirm = () => {
    const selected = groups
      .filter((g) => selectedGroups.has(g.id))
      .map((g) => ({
        id: g.id,
        name: g.subject,
        size: g.size,
      }));
    
    onSelectGroups(selected);
    setSelectedGroups(new Set());
    onOpenChange(false);
  };

  const filteredGroups = groups.filter((g) =>
    g.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Selecionar Grupos do WhatsApp
          </DialogTitle>
          <DialogDescription>
            Selecione os grupos onde deseja enviar a mensagem
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search and Refresh */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar grupo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={fetchGroups}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {/* Groups List */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mb-2 text-yellow-500" />
              <p className="text-sm text-center">{error}</p>
              <Button variant="link" size="sm" onClick={fetchGroups} className="mt-2">
                Tentar novamente
              </Button>
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">
                {searchQuery ? "Nenhum grupo encontrado" : "Nenhum grupo disponível"}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[300px] border rounded-lg p-2">
              <div className="space-y-2">
                {filteredGroups.map((group) => (
                  <div
                    key={group.id}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedGroups.has(group.id)
                        ? "bg-primary/10 border border-primary"
                        : "bg-muted/50 hover:bg-muted border border-transparent"
                    }`}
                    onClick={() => toggleGroup(group.id)}
                  >
                    <Checkbox
                      checked={selectedGroups.has(group.id)}
                      onCheckedChange={() => toggleGroup(group.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{group.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        {group.size} participantes
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      Grupo
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Selected count */}
          {selectedGroups.size > 0 && (
            <p className="text-sm text-muted-foreground">
              {selectedGroups.size} grupo(s) selecionado(s)
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={selectedGroups.size === 0}>
            <Users className="h-4 w-4 mr-2" />
            Adicionar {selectedGroups.size > 0 ? `(${selectedGroups.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
