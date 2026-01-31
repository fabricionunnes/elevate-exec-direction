import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
  CheckSquare,
} from "lucide-react";

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

  const filteredGroups = groups.filter((g) =>
    g.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectAll = () => {
    const allFilteredIds = new Set(filteredGroups.map((g) => g.id));
    setSelectedGroups(allFilteredIds);
  };

  const deselectAll = () => {
    setSelectedGroups(new Set());
  };

  const allFilteredSelected = filteredGroups.length > 0 && 
    filteredGroups.every((g) => selectedGroups.has(g.id));

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader className="space-y-3">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5 text-primary" />
            Selecionar Grupos
          </DialogTitle>
          <DialogDescription className="text-sm">
            Escolha os grupos para enviar a mensagem
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Search and Actions */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar grupo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={fetchGroups}
              disabled={loading}
              className="h-10 w-10 shrink-0"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {/* Select All / Deselect All */}
          {!loading && !error && filteredGroups.length > 0 && (
            <div className="flex items-center justify-between px-1">
              <span className="text-sm text-muted-foreground">
                {filteredGroups.length} grupo(s) encontrado(s)
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={allFilteredSelected ? deselectAll : selectAll}
                className="h-8 text-xs gap-1.5 text-primary hover:text-primary"
              >
                <CheckSquare className="h-3.5 w-3.5" />
                {allFilteredSelected ? "Desmarcar todos" : "Selecionar todos"}
              </Button>
            </div>
          )}

          {/* Groups List */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
              <p className="text-sm">Carregando grupos...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <AlertCircle className="h-10 w-10 mb-3 text-amber-500" />
              <p className="text-sm text-center mb-3">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchGroups}>
                Tentar novamente
              </Button>
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <MessageSquare className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">
                {searchQuery ? "Nenhum grupo encontrado" : "Nenhum grupo disponível"}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[280px] rounded-lg border bg-muted/20">
              <div className="p-2 space-y-1.5">
                {filteredGroups.map((group) => {
                  const isSelected = selectedGroups.has(group.id);
                  return (
                    <div
                      key={group.id}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-150 ${
                        isSelected
                          ? "bg-primary/10 border border-primary/40 shadow-sm"
                          : "bg-background hover:bg-muted/60 border border-transparent"
                      }`}
                      onClick={() => toggleGroup(group.id)}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleGroup(group.id)}
                        className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{group.subject}</p>
                        <p className="text-xs text-muted-foreground">
                          {group.size} participante{group.size !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-[10px] px-2 py-0.5 shrink-0">
                        Grupo
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          {/* Selected count */}
          {selectedGroups.size > 0 && (
            <div className="flex items-center justify-center">
              <Badge variant="default" className="text-xs px-3 py-1">
                {selectedGroups.size} grupo{selectedGroups.size !== 1 ? "s" : ""} selecionado{selectedGroups.size !== 1 ? "s" : ""}
              </Badge>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
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