import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, GripVertical, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface CustomField {
  id: string;
  context: string;
  section: string;
  field_name: string;
  field_label: string;
  field_type: string;
  options: any;
  is_required: boolean;
  is_system: boolean;
  sort_order: number;
  is_active: boolean;
}

interface ManageCustomFieldsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: "contact" | "company" | "deal";
  onFieldsUpdated: () => void;
}

const FIELD_TYPES = [
  { value: "text", label: "Texto" },
  { value: "textarea", label: "Texto Longo" },
  { value: "number", label: "Número" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
  { value: "url", label: "URL" },
  { value: "select", label: "Seleção" },
];

const SECTIONS = [
  "Informações Gerais",
  "Informações Adicionais",
  "Qualificação",
  "Financeiro",
];

export const ManageCustomFieldsDialog = ({
  open,
  onOpenChange,
  context,
  onFieldsUpdated,
}: ManageCustomFieldsDialogProps) => {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteField, setDeleteField] = useState<CustomField | null>(null);
  
  // New field form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState("text");
  const [newFieldSection, setNewFieldSection] = useState("Informações Gerais");
  const [newFieldOptions, setNewFieldOptions] = useState("");

  useEffect(() => {
    if (open) {
      loadFields();
    }
  }, [open, context]);

  const loadFields = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("crm_custom_fields")
        .select("*")
        .eq("context", context)
        .order("sort_order");

      if (error) throw error;
      setFields(data || []);
    } catch (error) {
      console.error("Error loading fields:", error);
      toast.error("Erro ao carregar campos");
    } finally {
      setLoading(false);
    }
  };

  const generateFieldName = (label: string) => {
    return label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  };

  const handleAddField = async () => {
    if (!newFieldLabel.trim()) {
      toast.error("Digite o nome do campo");
      return;
    }

    setSaving(true);
    try {
      const fieldName = generateFieldName(newFieldLabel);
      const maxOrder = Math.max(...fields.map(f => f.sort_order), 0);
      
      let options = null;
      if (newFieldType === "select" && newFieldOptions.trim()) {
        options = newFieldOptions.split(",").map(o => o.trim()).filter(Boolean);
      }

      const { error } = await supabase
        .from("crm_custom_fields")
        .insert({
          context,
          section: newFieldSection,
          field_name: fieldName,
          field_label: newFieldLabel.trim(),
          field_type: newFieldType,
          options,
          is_required: false,
          is_system: false,
          sort_order: maxOrder + 1,
          is_active: true,
        });

      if (error) throw error;
      
      toast.success("Campo adicionado com sucesso");
      setNewFieldLabel("");
      setNewFieldType("text");
      setNewFieldSection("Informações Gerais");
      setNewFieldOptions("");
      setShowAddForm(false);
      loadFields();
      onFieldsUpdated();
    } catch (error) {
      console.error("Error adding field:", error);
      toast.error("Erro ao adicionar campo");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteField = async () => {
    if (!deleteField) return;

    setSaving(true);
    try {
      // Delete field values first
      await supabase
        .from("crm_custom_field_values")
        .delete()
        .eq("field_id", deleteField.id);

      // Delete the field
      const { error } = await supabase
        .from("crm_custom_fields")
        .delete()
        .eq("id", deleteField.id);

      if (error) throw error;
      
      toast.success("Campo excluído com sucesso");
      setDeleteField(null);
      loadFields();
      onFieldsUpdated();
    } catch (error) {
      console.error("Error deleting field:", error);
      toast.error("Erro ao excluir campo");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (field: CustomField) => {
    try {
      const { error } = await supabase
        .from("crm_custom_fields")
        .update({ is_active: !field.is_active })
        .eq("id", field.id);

      if (error) throw error;
      loadFields();
      onFieldsUpdated();
    } catch (error) {
      console.error("Error toggling field:", error);
      toast.error("Erro ao atualizar campo");
    }
  };

  const contextLabels: Record<string, string> = {
    contact: "Campos de Contato",
    company: "Campos de Empresa",
    deal: "Campos de Negócio",
  };

  const activeFields = fields.filter(f => f.is_active);
  const inactiveFields = fields.filter(f => !f.is_active);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Gerenciar {contextLabels[context]}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : (
              <>
                {/* Add New Field Button */}
                {!showAddForm && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowAddForm(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar novo campo
                  </Button>
                )}

                {/* Add New Field Form */}
                {showAddForm && (
                  <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                    <h4 className="font-medium">Novo Campo</h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nome do campo</Label>
                        <Input
                          value={newFieldLabel}
                          onChange={(e) => setNewFieldLabel(e.target.value)}
                          placeholder="Ex: Data de Nascimento"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Tipo</Label>
                        <Select value={newFieldType} onValueChange={setNewFieldType}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FIELD_TYPES.map(type => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Seção</Label>
                      <Select value={newFieldSection} onValueChange={setNewFieldSection}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SECTIONS.map(section => (
                            <SelectItem key={section} value={section}>
                              {section}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {newFieldType === "select" && (
                      <div className="space-y-2">
                        <Label>Opções (separadas por vírgula)</Label>
                        <Input
                          value={newFieldOptions}
                          onChange={(e) => setNewFieldOptions(e.target.value)}
                          placeholder="Ex: Opção 1, Opção 2, Opção 3"
                        />
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setShowAddForm(false)}
                        disabled={saving}
                      >
                        Cancelar
                      </Button>
                      <Button onClick={handleAddField} disabled={saving}>
                        {saving ? "Salvando..." : "Adicionar"}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Active Fields */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Campos Ativos ({activeFields.length})
                  </h4>
                  <div className="space-y-1">
                    {activeFields.map(field => (
                      <div
                        key={field.id}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg border bg-background",
                          field.is_system && "bg-muted/30"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{field.field_label}</span>
                              {field.is_system && (
                                <Badge variant="secondary" className="text-xs">
                                  <Lock className="h-3 w-3 mr-1" />
                                  Sistema
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {FIELD_TYPES.find(t => t.value === field.field_type)?.label || field.field_type}
                              {" • "}{field.section}
                            </span>
                          </div>
                        </div>
                        
                        {!field.is_system && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteField(field)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Inactive Fields */}
                {inactiveFields.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">
                      Campos Inativos ({inactiveFields.length})
                    </h4>
                    <div className="space-y-1">
                      {inactiveFields.map(field => (
                        <div
                          key={field.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-muted/50 opacity-60"
                        >
                          <div className="flex items-center gap-3">
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <span className="font-medium">{field.field_label}</span>
                              <span className="text-xs text-muted-foreground block">
                                {FIELD_TYPES.find(t => t.value === field.field_type)?.label || field.field_type}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleActive(field)}
                            >
                              Ativar
                            </Button>
                            {!field.is_system && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDeleteField(field)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteField} onOpenChange={() => setDeleteField(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campo?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o campo "{deleteField?.field_label}"? 
              Todos os valores salvos neste campo serão perdidos. 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteField}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
