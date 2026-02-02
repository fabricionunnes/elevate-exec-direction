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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trash2, GripVertical, Lock, CreditCard, Building2 } from "lucide-react";
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

interface PaymentMethodOption {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
}

interface BankOption {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
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
  const [activeTab, setActiveTab] = useState("fields");
  const [fields, setFields] = useState<CustomField[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>([]);
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteField, setDeleteField] = useState<CustomField | null>(null);
  const [deletePaymentMethod, setDeletePaymentMethod] = useState<PaymentMethodOption | null>(null);
  const [deleteBank, setDeleteBank] = useState<BankOption | null>(null);
  
  // New field form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState("text");
  const [newFieldSection, setNewFieldSection] = useState("Informações Gerais");
  const [newFieldOptions, setNewFieldOptions] = useState("");

  // New payment method form
  const [showAddPaymentMethod, setShowAddPaymentMethod] = useState(false);
  const [newPaymentMethodName, setNewPaymentMethodName] = useState("");

  // New bank form
  const [showAddBank, setShowAddBank] = useState(false);
  const [newBankName, setNewBankName] = useState("");

  useEffect(() => {
    if (open) {
      loadFields();
      loadPaymentMethods();
      loadBanks();
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

  const loadPaymentMethods = async () => {
    try {
      const { data, error } = await supabase
        .from("crm_payment_method_options")
        .select("*")
        .order("sort_order");

      if (error) throw error;
      setPaymentMethods(data || []);
    } catch (error) {
      console.error("Error loading payment methods:", error);
    }
  };

  const loadBanks = async () => {
    try {
      const { data, error } = await supabase
        .from("crm_bank_options")
        .select("*")
        .order("sort_order");

      if (error) throw error;
      setBanks(data || []);
    } catch (error) {
      console.error("Error loading banks:", error);
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
      await supabase
        .from("crm_custom_field_values")
        .delete()
        .eq("field_id", deleteField.id);

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

  // Payment Methods handlers
  const handleAddPaymentMethod = async () => {
    if (!newPaymentMethodName.trim()) {
      toast.error("Digite o nome da forma de pagamento");
      return;
    }

    setSaving(true);
    try {
      const maxOrder = Math.max(...paymentMethods.map(p => p.sort_order), 0);
      
      const { error } = await supabase
        .from("crm_payment_method_options")
        .insert({
          name: newPaymentMethodName.trim(),
          sort_order: maxOrder + 1,
          is_active: true,
        });

      if (error) throw error;
      
      toast.success("Forma de pagamento adicionada");
      setNewPaymentMethodName("");
      setShowAddPaymentMethod(false);
      loadPaymentMethods();
    } catch (error) {
      console.error("Error adding payment method:", error);
      toast.error("Erro ao adicionar forma de pagamento");
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePaymentMethod = async () => {
    if (!deletePaymentMethod) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("crm_payment_method_options")
        .delete()
        .eq("id", deletePaymentMethod.id);

      if (error) throw error;
      
      toast.success("Forma de pagamento excluída");
      setDeletePaymentMethod(null);
      loadPaymentMethods();
    } catch (error) {
      console.error("Error deleting payment method:", error);
      toast.error("Erro ao excluir forma de pagamento");
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePaymentMethodActive = async (pm: PaymentMethodOption) => {
    try {
      const { error } = await supabase
        .from("crm_payment_method_options")
        .update({ is_active: !pm.is_active })
        .eq("id", pm.id);

      if (error) throw error;
      loadPaymentMethods();
    } catch (error) {
      console.error("Error toggling payment method:", error);
      toast.error("Erro ao atualizar forma de pagamento");
    }
  };

  // Bank handlers
  const handleAddBank = async () => {
    if (!newBankName.trim()) {
      toast.error("Digite o nome do banco");
      return;
    }

    setSaving(true);
    try {
      const maxOrder = Math.max(...banks.map(b => b.sort_order), 0);
      
      const { error } = await supabase
        .from("crm_bank_options")
        .insert({
          name: newBankName.trim(),
          sort_order: maxOrder + 1,
          is_active: true,
        });

      if (error) throw error;
      
      toast.success("Banco adicionado");
      setNewBankName("");
      setShowAddBank(false);
      loadBanks();
    } catch (error) {
      console.error("Error adding bank:", error);
      toast.error("Erro ao adicionar banco");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBank = async () => {
    if (!deleteBank) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("crm_bank_options")
        .delete()
        .eq("id", deleteBank.id);

      if (error) throw error;
      
      toast.success("Banco excluído");
      setDeleteBank(null);
      loadBanks();
    } catch (error) {
      console.error("Error deleting bank:", error);
      toast.error("Erro ao excluir banco");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleBankActive = async (bank: BankOption) => {
    try {
      const { error } = await supabase
        .from("crm_bank_options")
        .update({ is_active: !bank.is_active })
        .eq("id", bank.id);

      if (error) throw error;
      loadBanks();
    } catch (error) {
      console.error("Error toggling bank:", error);
      toast.error("Erro ao atualizar banco");
    }
  };

  const contextLabels: Record<string, string> = {
    contact: "Contato",
    company: "Empresa",
    deal: "Negócio",
  };

  const activeFields = fields.filter(f => f.is_active);
  const inactiveFields = fields.filter(f => !f.is_active);
  const activePaymentMethods = paymentMethods.filter(p => p.is_active);
  const inactivePaymentMethods = paymentMethods.filter(p => !p.is_active);
  const activeBanks = banks.filter(b => b.is_active);
  const inactiveBanks = banks.filter(b => !b.is_active);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Gerenciar Campos - {contextLabels[context]}</DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="fields">Campos</TabsTrigger>
              <TabsTrigger value="payment" className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Pagamento
              </TabsTrigger>
              <TabsTrigger value="banks" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Bancos
              </TabsTrigger>
            </TabsList>

            {/* Fields Tab */}
            <TabsContent value="fields" className="flex-1 overflow-y-auto space-y-4 mt-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : (
                <>
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
            </TabsContent>

            {/* Payment Methods Tab */}
            <TabsContent value="payment" className="flex-1 overflow-y-auto space-y-4 mt-4">
              {!showAddPaymentMethod && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowAddPaymentMethod(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar forma de pagamento
                </Button>
              )}

              {showAddPaymentMethod && (
                <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                  <h4 className="font-medium">Nova Forma de Pagamento</h4>
                  
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input
                      value={newPaymentMethodName}
                      onChange={(e) => setNewPaymentMethodName(e.target.value)}
                      placeholder="Ex: PIX, Cartão de Crédito"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowAddPaymentMethod(false)}
                      disabled={saving}
                    >
                      Cancelar
                    </Button>
                    <Button onClick={handleAddPaymentMethod} disabled={saving}>
                      {saving ? "Salvando..." : "Adicionar"}
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">
                  Formas de Pagamento Ativas ({activePaymentMethods.length})
                </h4>
                <div className="space-y-1">
                  {activePaymentMethods.map(pm => (
                    <div
                      key={pm.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-background"
                    >
                      <div className="flex items-center gap-3">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{pm.name}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTogglePaymentMethodActive(pm)}
                        >
                          Desativar
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeletePaymentMethod(pm)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {inactivePaymentMethods.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Formas de Pagamento Inativas ({inactivePaymentMethods.length})
                  </h4>
                  <div className="space-y-1">
                    {inactivePaymentMethods.map(pm => (
                      <div
                        key={pm.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-muted/50 opacity-60"
                      >
                        <div className="flex items-center gap-3">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{pm.name}</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTogglePaymentMethodActive(pm)}
                          >
                            Ativar
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeletePaymentMethod(pm)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Banks Tab */}
            <TabsContent value="banks" className="flex-1 overflow-y-auto space-y-4 mt-4">
              {!showAddBank && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowAddBank(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar banco
                </Button>
              )}

              {showAddBank && (
                <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                  <h4 className="font-medium">Novo Banco</h4>
                  
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input
                      value={newBankName}
                      onChange={(e) => setNewBankName(e.target.value)}
                      placeholder="Ex: Banco do Brasil, Nubank"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowAddBank(false)}
                      disabled={saving}
                    >
                      Cancelar
                    </Button>
                    <Button onClick={handleAddBank} disabled={saving}>
                      {saving ? "Salvando..." : "Adicionar"}
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">
                  Bancos Ativos ({activeBanks.length})
                </h4>
                <div className="space-y-1">
                  {activeBanks.map(bank => (
                    <div
                      key={bank.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-background"
                    >
                      <div className="flex items-center gap-3">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{bank.name}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleBankActive(bank)}
                        >
                          Desativar
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteBank(bank)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {inactiveBanks.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Bancos Inativos ({inactiveBanks.length})
                  </h4>
                  <div className="space-y-1">
                    {inactiveBanks.map(bank => (
                      <div
                        key={bank.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-muted/50 opacity-60"
                      >
                        <div className="flex items-center gap-3">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{bank.name}</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleBankActive(bank)}
                          >
                            Ativar
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteBank(bank)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Delete Field Confirmation */}
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

      {/* Delete Payment Method Confirmation */}
      <AlertDialog open={!!deletePaymentMethod} onOpenChange={() => setDeletePaymentMethod(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir forma de pagamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{deletePaymentMethod?.name}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePaymentMethod}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Bank Confirmation */}
      <AlertDialog open={!!deleteBank} onOpenChange={() => setDeleteBank(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir banco?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{deleteBank?.name}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBank}
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
