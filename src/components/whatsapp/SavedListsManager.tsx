import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Save,
  FolderOpen,
  Loader2,
  Users,
  MessageSquare,
  Trash2,
  Edit3,
  Plus,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SavedList {
  id: string;
  name: string;
  list_type: "contacts" | "groups";
  instance_id: string;
  items: any[];
  item_count: number;
  created_at: string;
  updated_at: string;
}

interface Contact {
  phone_number: string;
  name: string;
  company: string;
  [key: string]: string;
}

interface Group {
  id: string;
  name: string;
  size: number;
}

interface SavedListsManagerProps {
  instanceId: string;
  currentContacts: Contact[];
  currentGroups: Group[];
  onLoadContacts: (contacts: Contact[]) => void;
  onLoadGroups: (groups: Group[]) => void;
}

export const SavedListsManager = ({
  instanceId,
  currentContacts,
  currentGroups,
  onLoadContacts,
  onLoadGroups,
}: SavedListsManagerProps) => {
  const [savedLists, setSavedLists] = useState<SavedList[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [listToDelete, setListToDelete] = useState<SavedList | null>(null);
  const [listToEdit, setListToEdit] = useState<SavedList | null>(null);
  const [saving, setSaving] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [saveType, setSaveType] = useState<"contacts" | "groups">("contacts");

  useEffect(() => {
    if (instanceId) {
      loadSavedLists();
    }
  }, [instanceId]);

  const loadSavedLists = async () => {
    if (!instanceId) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from("whatsapp_saved_lists" as any)
      .select("*")
      .eq("instance_id", instanceId)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error loading saved lists:", error);
    } else {
      // Parse items JSON
      const parsedLists = (data || []).map((list: any) => ({
        ...list,
        items: typeof list.items === 'string' ? JSON.parse(list.items) : list.items,
      }));
      setSavedLists(parsedLists);
    }
    setLoading(false);
  };

  const handleSaveList = async () => {
    if (!newListName.trim()) {
      toast.error("Digite um nome para a lista");
      return;
    }

    const items = saveType === "contacts" ? currentContacts : currentGroups;
    if (items.length === 0) {
      toast.error(`Nenhum ${saveType === "contacts" ? "contato" : "grupo"} para salvar`);
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("whatsapp_saved_lists" as any)
        .insert({
          name: newListName.trim(),
          list_type: saveType,
          instance_id: instanceId,
          items: JSON.stringify(items),
          item_count: items.length,
          created_by: user?.id,
        });

      if (error) throw error;

      toast.success("Lista salva com sucesso!");
      setShowSaveDialog(false);
      setNewListName("");
      loadSavedLists();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar lista");
    } finally {
      setSaving(false);
    }
  };

  const handleLoadList = (list: SavedList) => {
    if (list.list_type === "contacts") {
      onLoadContacts(list.items as Contact[]);
      toast.success(`${list.item_count} contatos carregados`);
    } else {
      onLoadGroups(list.items as Group[]);
      toast.success(`${list.item_count} grupos carregados`);
    }
    setShowLoadDialog(false);
  };

  const handleUpdateList = async () => {
    if (!listToEdit) return;

    const items = listToEdit.list_type === "contacts" ? currentContacts : currentGroups;
    if (items.length === 0) {
      toast.error(`Nenhum ${listToEdit.list_type === "contacts" ? "contato" : "grupo"} para salvar`);
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("whatsapp_saved_lists" as any)
        .update({
          items: JSON.stringify(items),
          item_count: items.length,
          updated_at: new Date().toISOString(),
        })
        .eq("id", listToEdit.id);

      if (error) throw error;

      toast.success("Lista atualizada com sucesso!");
      setShowEditDialog(false);
      setListToEdit(null);
      loadSavedLists();
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar lista");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteList = async () => {
    if (!listToDelete) return;

    try {
      const { error } = await supabase
        .from("whatsapp_saved_lists" as any)
        .delete()
        .eq("id", listToDelete.id);

      if (error) throw error;

      toast.success("Lista excluída");
      setListToDelete(null);
      loadSavedLists();
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir lista");
    }
  };

  const hasContacts = currentContacts.length > 0;
  const hasGroups = currentGroups.length > 0;
  const canSave = hasContacts || hasGroups;

  return (
    <>
      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowLoadDialog(true)}
          disabled={!instanceId}
        >
          <FolderOpen className="h-4 w-4 mr-2" />
          Carregar Lista
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (!canSave) {
              toast.error("Adicione contatos ou grupos primeiro");
              return;
            }
            setSaveType(hasGroups ? "groups" : "contacts");
            setShowSaveDialog(true);
          }}
          disabled={!instanceId || !canSave}
        >
          <Save className="h-4 w-4 mr-2" />
          Salvar Lista
        </Button>
      </div>

      {/* Save List Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Save className="h-5 w-5" />
              Salvar Lista
            </DialogTitle>
            <DialogDescription>
              Salve a lista atual para usar em futuras campanhas
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome da Lista</Label>
              <Input
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="Ex: Clientes VIP"
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de Lista</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={saveType === "contacts" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSaveType("contacts")}
                  disabled={!hasContacts}
                  className="flex-1"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Contatos ({currentContacts.length})
                </Button>
                <Button
                  type="button"
                  variant={saveType === "groups" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSaveType("groups")}
                  disabled={!hasGroups}
                  className="flex-1"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Grupos ({currentGroups.length})
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveList} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load List Dialog */}
      <Dialog open={showLoadDialog} onOpenChange={setShowLoadDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Carregar Lista Salva
            </DialogTitle>
            <DialogDescription>
              Selecione uma lista para carregar os contatos ou grupos
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : savedLists.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nenhuma lista salva</p>
                <p className="text-sm">Salve contatos ou grupos para usar em futuras campanhas</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {savedLists.map((list) => (
                    <div
                      key={list.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {list.list_type === "contacts" ? (
                          <Users className="h-5 w-5 text-blue-500" />
                        ) : (
                          <MessageSquare className="h-5 w-5 text-green-500" />
                        )}
                        <div>
                          <p className="font-medium">{list.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {list.item_count} {list.list_type === "contacts" ? "contatos" : "grupos"} • 
                            Atualizado em {format(new Date(list.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleLoadList(list)}
                          title="Carregar"
                          className="text-primary"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setListToEdit(list);
                            setShowLoadDialog(false);
                            setShowEditDialog(true);
                          }}
                          title="Atualizar com lista atual"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setListToDelete(list)}
                          title="Excluir"
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLoadDialog(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit/Update List Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="h-5 w-5" />
              Atualizar Lista
            </DialogTitle>
            <DialogDescription>
              Substituir o conteúdo da lista "{listToEdit?.name}" com os {listToEdit?.list_type === "contacts" ? "contatos" : "grupos"} atuais?
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {listToEdit && (
              <div className="space-y-3">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium">Conteúdo atual da lista:</p>
                  <p className="text-sm text-muted-foreground">
                    {listToEdit.item_count} {listToEdit.list_type === "contacts" ? "contatos" : "grupos"}
                  </p>
                </div>
                <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                  <p className="text-sm font-medium">Novo conteúdo:</p>
                  <p className="text-sm text-muted-foreground">
                    {listToEdit.list_type === "contacts" ? currentContacts.length : currentGroups.length}{" "}
                    {listToEdit.list_type === "contacts" ? "contatos" : "grupos"}
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateList} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Edit3 className="h-4 w-4 mr-2" />}
              Atualizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!listToDelete} onOpenChange={() => setListToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Lista?</AlertDialogTitle>
            <AlertDialogDescription>
              A lista "{listToDelete?.name}" será excluída permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteList} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
