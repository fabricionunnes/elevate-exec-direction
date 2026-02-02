import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Plus, 
  Trash2, 
  Loader2, 
  GripVertical,
  ListChecks,
  ChevronUp,
  ChevronDown,
  Phone,
  MessageCircle,
  FileText,
  Pencil,
  X,
  Check,
  Calendar
} from "lucide-react";
import { toast } from "sonner";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";

interface ChecklistItem {
  id: string;
  stage_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  item_type: string;
  whatsapp_template: string | null;
}

interface StageChecklistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stageId: string;
  stageName: string;
}

const ITEM_TYPES = [
  { value: 'instruction', label: 'Instrução', icon: FileText },
  { value: 'call', label: 'Ligação', icon: Phone },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { value: 'meeting', label: 'Agendamento', icon: Calendar },
];

const AVAILABLE_VARIABLES = [
  { key: '{{nome_cliente}}', label: 'Nome do Cliente' },
  { key: '{{empresa}}', label: 'Empresa' },
  { key: '{{email}}', label: 'E-mail' },
  { key: '{{telefone}}', label: 'Telefone' },
];

export function StageChecklistDialog({ 
  open, 
  onOpenChange, 
  stageId, 
  stageName 
}: StageChecklistDialogProps) {
  const { isMaster, currentStaff } = useStaffPermissions();
  const isAdmin = isMaster || currentStaff?.role === 'admin';

  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // New item form
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemDescription, setNewItemDescription] = useState("");
  const [newItemType, setNewItemType] = useState("instruction");
  const [newWhatsAppTemplate, setNewWhatsAppTemplate] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const whatsappTemplateRef = useRef<HTMLTextAreaElement>(null);

  // Edit item form
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editItemType, setEditItemType] = useState("instruction");
  const [editWhatsAppTemplate, setEditWhatsAppTemplate] = useState("");
  const editWhatsappTemplateRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open && stageId) {
      loadItems();
    }
  }, [open, stageId]);

  const loadItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("crm_stage_checklists")
        .select("*")
        .eq("stage_id", stageId)
        .eq("is_active", true)
        .order("sort_order");

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error("Error loading checklist items:", error);
      toast.error("Erro ao carregar checklist");
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async () => {
    if (!newItemTitle.trim()) {
      toast.error("Título é obrigatório");
      return;
    }

    setSaving(true);
    try {
      const maxOrder = items.length > 0 
        ? Math.max(...items.map(i => i.sort_order)) + 1 
        : 0;

      const { error } = await supabase
        .from("crm_stage_checklists")
        .insert({
          stage_id: stageId,
          title: newItemTitle,
          description: newItemDescription || null,
          sort_order: maxOrder,
          is_active: true,
          item_type: newItemType,
          whatsapp_template: newItemType === 'whatsapp' ? newWhatsAppTemplate : null,
        });

      if (error) throw error;
      
      toast.success("Item adicionado ao checklist");
      resetForm();
      loadItems();
    } catch (error: any) {
      toast.error(error.message || "Erro ao adicionar item");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from("crm_stage_checklists")
        .delete()
        .eq("id", itemId);

      if (error) throw error;
      
      toast.success("Item removido");
      setItems(items.filter(i => i.id !== itemId));
    } catch (error: any) {
      toast.error(error.message || "Erro ao remover item");
    }
  };

  const handleMoveItem = async (itemId: string, direction: 'up' | 'down') => {
    const currentIndex = items.findIndex(i => i.id === itemId);
    if (currentIndex === -1) return;
    
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const newItems = [...items];
    const temp = newItems[currentIndex];
    newItems[currentIndex] = newItems[targetIndex];
    newItems[targetIndex] = temp;

    // Update sort_order values
    const updates = newItems.map((item, index) => ({
      id: item.id,
      sort_order: index,
    }));

    try {
      for (const update of updates) {
        await supabase
          .from("crm_stage_checklists")
          .update({ sort_order: update.sort_order })
          .eq("id", update.id);
      }
      
      setItems(newItems.map((item, index) => ({ ...item, sort_order: index })));
    } catch (error: any) {
      toast.error("Erro ao reordenar itens");
      loadItems();
    }
  };

  const insertVariable = (variable: string) => {
    const textarea = whatsappTemplateRef.current;
    if (!textarea) {
      setNewWhatsAppTemplate(prev => prev + variable);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = newWhatsAppTemplate.substring(0, start) + variable + newWhatsAppTemplate.substring(end);
    const cursorPosition = start + variable.length;

    setNewWhatsAppTemplate(newText);

    // Restore focus and cursor position after state update
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(cursorPosition, cursorPosition);
    }, 0);
  };

  const resetForm = () => {
    setNewItemTitle("");
    setNewItemDescription("");
    setNewItemType("instruction");
    setNewWhatsAppTemplate("");
    setShowNewForm(false);
  };

  const startEditing = (item: ChecklistItem) => {
    setEditingItemId(item.id);
    setEditTitle(item.title);
    setEditDescription(item.description || "");
    setEditItemType(item.item_type);
    setEditWhatsAppTemplate(item.whatsapp_template || "");
  };

  const cancelEditing = () => {
    setEditingItemId(null);
    setEditTitle("");
    setEditDescription("");
    setEditItemType("instruction");
    setEditWhatsAppTemplate("");
  };

  const handleUpdateItem = async () => {
    if (!editingItemId || !editTitle.trim()) {
      toast.error("Título é obrigatório");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("crm_stage_checklists")
        .update({
          title: editTitle,
          description: editDescription || null,
          item_type: editItemType,
          whatsapp_template: editItemType === 'whatsapp' ? editWhatsAppTemplate : null,
        })
        .eq("id", editingItemId);

      if (error) throw error;

      toast.success("Item atualizado com sucesso");
      cancelEditing();
      loadItems();
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar item");
    } finally {
      setSaving(false);
    }
  };

  const insertEditVariable = (variable: string) => {
    const textarea = editWhatsappTemplateRef.current;
    if (!textarea) {
      setEditWhatsAppTemplate(prev => prev + variable);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = editWhatsAppTemplate.substring(0, start) + variable + editWhatsAppTemplate.substring(end);
    const cursorPosition = start + variable.length;

    setEditWhatsAppTemplate(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(cursorPosition, cursorPosition);
    }, 0);
  };

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'call': return <Phone className="h-4 w-4 text-green-600" />;
      case 'whatsapp': return <MessageCircle className="h-4 w-4 text-emerald-600" />;
      case 'meeting': return <Calendar className="h-4 w-4 text-purple-600" />;
      default: return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getItemTypeLabel = (type: string) => {
    return ITEM_TYPES.find(t => t.value === type)?.label || 'Instrução';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            Checklist da Etapa: {stageName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Configure instruções e lembretes que aparecem no painel lateral quando o lead está nesta etapa.
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Existing Items */}
              <div className="space-y-2">
                {items.length === 0 && !showNewForm ? (
                  <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg">
                    Nenhum item de checklist configurado
                  </p>
                ) : (
                  items.map((item, index) => (
                    editingItemId === item.id ? (
                      // Edit mode
                      <div
                        key={item.id}
                        className="p-4 rounded-lg border-2 border-primary bg-muted/30 space-y-4"
                      >
                        <div>
                          <Label>Tipo do Item</Label>
                          <Select value={editItemType} onValueChange={setEditItemType}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ITEM_TYPES.map(type => (
                                <SelectItem key={type.value} value={type.value}>
                                  <div className="flex items-center gap-2">
                                    <type.icon className="h-4 w-4" />
                                    {type.label}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Título do Item *</Label>
                          <Input
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            placeholder="Título do item"
                          />
                        </div>

                        <div>
                          <Label>Descrição (opcional)</Label>
                          <Textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            placeholder="Detalhes adicionais..."
                            rows={2}
                            className="resize-none"
                          />
                        </div>

                        {editItemType === 'whatsapp' && (
                          <div className="space-y-2">
                            <Label>Mensagem Padrão do WhatsApp</Label>
                            <div className="flex flex-wrap gap-1 mb-2">
                              {AVAILABLE_VARIABLES.map(v => (
                                <Button
                                  key={v.key}
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-7"
                                  onClick={() => insertEditVariable(v.key)}
                                >
                                  {v.label}
                                </Button>
                              ))}
                            </div>
                            <Textarea
                              ref={editWhatsappTemplateRef}
                              value={editWhatsAppTemplate}
                              onChange={(e) => setEditWhatsAppTemplate(e.target.value)}
                              placeholder="Olá {{nome_cliente}}, tudo bem?..."
                              rows={3}
                              className="resize-none"
                            />
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Button
                            onClick={handleUpdateItem}
                            disabled={saving}
                            className="flex-1"
                          >
                            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            <Check className="h-4 w-4 mr-2" />
                            Salvar
                          </Button>
                          <Button
                            variant="outline"
                            onClick={cancelEditing}
                          >
                            <X className="h-4 w-4 mr-2" />
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // View mode
                      <div
                        key={item.id}
                        className="p-3 rounded-lg border border-border flex items-center gap-2"
                      >
                        <div className="flex flex-col gap-0.5 shrink-0">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleMoveItem(item.id, 'up')}
                            disabled={index === 0}
                          >
                            <ChevronUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleMoveItem(item.id, 'down')}
                            disabled={index === items.length - 1}
                          >
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </div>
                        
                        <div className="shrink-0">
                          {getItemIcon(item.item_type)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{item.title}</span>
                            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              {getItemTypeLabel(item.item_type)}
                            </span>
                          </div>
                          {item.description && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {item.description}
                            </p>
                          )}
                          {item.item_type === 'whatsapp' && item.whatsapp_template && (
                            <p className="text-xs text-emerald-600 mt-1 bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded">
                              📝 {item.whatsapp_template}
                            </p>
                          )}
                        </div>

                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                            onClick={() => startEditing(item)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive shrink-0"
                          onClick={() => handleDeleteItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )
                  ))
                )}
              </div>

              {/* Add New Item Form */}
              {showNewForm ? (
                <div className="p-4 rounded-lg border-2 border-dashed border-primary/50 bg-muted/30 space-y-4">
                  <div>
                    <Label>Tipo do Item</Label>
                    <Select value={newItemType} onValueChange={setNewItemType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ITEM_TYPES.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                              <type.icon className="h-4 w-4" />
                              {type.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Título do Item *</Label>
                    <Input
                      value={newItemTitle}
                      onChange={(e) => setNewItemTitle(e.target.value)}
                      placeholder={
                        newItemType === 'call' ? "Ex: Ligar para confirmar interesse" :
                        newItemType === 'whatsapp' ? "Ex: Enviar mensagem de boas-vindas" :
                        "Ex: Confirmar dados de contato"
                      }
                    />
                  </div>

                  <div>
                    <Label>Descrição (opcional)</Label>
                    <Textarea
                      value={newItemDescription}
                      onChange={(e) => setNewItemDescription(e.target.value)}
                      placeholder="Detalhes adicionais sobre esta instrução..."
                      rows={2}
                      className="resize-none"
                    />
                  </div>

                  {newItemType === 'whatsapp' && (
                    <div className="space-y-2">
                      <Label>Mensagem Padrão do WhatsApp</Label>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {AVAILABLE_VARIABLES.map(v => (
                          <Button
                            key={v.key}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => insertVariable(v.key)}
                          >
                            {v.label}
                          </Button>
                        ))}
                      </div>
                      <Textarea
                        ref={whatsappTemplateRef}
                        value={newWhatsAppTemplate}
                        onChange={(e) => setNewWhatsAppTemplate(e.target.value)}
                        placeholder="Olá {{nome_cliente}}, tudo bem? Aqui é da empresa..."
                        rows={3}
                        className="resize-none"
                      />
                      <p className="text-xs text-muted-foreground">
                        Use as variáveis acima para personalizar a mensagem automaticamente.
                      </p>
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={handleAddItem}
                      disabled={saving}
                      className="flex-1"
                    >
                      {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Adicionar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={resetForm}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowNewForm(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Item ao Checklist
                </Button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
