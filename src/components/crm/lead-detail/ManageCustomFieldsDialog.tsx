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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { 
  Plus, 
  Trash2, 
  ChevronDown, 
  User, 
  Building2, 
  Briefcase,
  Type,
  Hash,
  DollarSign,
  FileText,
  Phone,
  List,
  ListChecks,
  MoreVertical,
  CreditCard,
  Search
} from "lucide-react";
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
  { value: "text", label: "Texto", icon: Type },
  { value: "number", label: "Número", icon: Hash },
  { value: "currency", label: "Monetário", icon: DollarSign },
  { value: "textarea", label: "Texto Rico", icon: FileText },
  { value: "phone", label: "Telefone", icon: Phone },
  { value: "select", label: "Seleção", icon: List },
  { value: "multiselect", label: "Múltipla seleção", icon: ListChecks },
];

const CONTEXT_OPTIONS = [
  { value: "contact", label: "Contato", icon: User },
  { value: "company", label: "Empresa", icon: Building2 },
  { value: "deal", label: "Negócio", icon: Briefcase },
];

const DEFAULT_SECTIONS = [
  "Informações Gerais",
  "Informações Adicionais",
  "Qualificação",
  "Financeiro",
];

export const ManageCustomFieldsDialog = ({
  open,
  onOpenChange,
  context: initialContext,
  onFieldsUpdated,
}: ManageCustomFieldsDialogProps) => {
  const [activeTab, setActiveTab] = useState<string>(initialContext);
  const [fields, setFields] = useState<CustomField[]>([]);
  const [sections, setSections] = useState<string[]>(DEFAULT_SECTIONS);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>([]);
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteField, setDeleteField] = useState<CustomField | null>(null);
  const [deletePaymentMethod, setDeletePaymentMethod] = useState<PaymentMethodOption | null>(null);
  const [deleteBank, setDeleteBank] = useState<BankOption | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(DEFAULT_SECTIONS));
  const [searchTerm, setSearchTerm] = useState("");
  
  // Add field modal
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);
  const [newFieldContext, setNewFieldContext] = useState<string>(initialContext);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState("text");
  const [newFieldSection, setNewFieldSection] = useState("Informações Gerais");
  const [newFieldOptions, setNewFieldOptions] = useState("");

  // Add section modal
  const [showAddSectionModal, setShowAddSectionModal] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");

  // Add payment/bank modal
  const [showAddPaymentMethod, setShowAddPaymentMethod] = useState(false);
  const [showAddBank, setShowAddBank] = useState(false);
  const [newPaymentMethodName, setNewPaymentMethodName] = useState("");
  const [newBankName, setNewBankName] = useState("");

  // Config tab
  const [configTab, setConfigTab] = useState<"fields" | "payment" | "banks">("fields");

  useEffect(() => {
    if (open) {
      setActiveTab(initialContext);
      setNewFieldContext(initialContext);
      loadAllData();
    }
  }, [open, initialContext]);

  useEffect(() => {
    if (open) {
      loadFields(activeTab as "contact" | "company" | "deal");
    }
  }, [activeTab, open]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadFields(activeTab as "contact" | "company" | "deal"),
        loadPaymentMethods(),
        loadBanks(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadFields = async (ctx: "contact" | "company" | "deal") => {
    try {
      const { data, error } = await supabase
        .from("crm_custom_fields")
        .select("*")
        .eq("context", ctx)
        .order("section")
        .order("sort_order");

      if (error) throw error;
      setFields(data || []);

      // Extract unique sections
      const uniqueSections = new Set(DEFAULT_SECTIONS);
      data?.forEach(f => uniqueSections.add(f.section));
      setSections(Array.from(uniqueSections));
    } catch (error) {
      console.error("Error loading fields:", error);
    }
  };

  const loadPaymentMethods = async () => {
    const { data } = await supabase
      .from("crm_payment_method_options")
      .select("*")
      .order("sort_order");
    setPaymentMethods(data || []);
  };

  const loadBanks = async () => {
    const { data } = await supabase
      .from("crm_bank_options")
      .select("*")
      .order("sort_order");
    setBanks(data || []);
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
      const contextFields = fields.filter(f => f.context === newFieldContext);
      const maxOrder = Math.max(...contextFields.map(f => f.sort_order), 0);
      
      let options = null;
      if ((newFieldType === "select" || newFieldType === "multiselect") && newFieldOptions.trim()) {
        options = newFieldOptions.split(",").map(o => o.trim()).filter(Boolean);
      }

      const { error } = await supabase
        .from("crm_custom_fields")
        .insert({
          context: newFieldContext,
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
      resetAddFieldForm();
      setShowAddFieldModal(false);
      loadFields(activeTab as "contact" | "company" | "deal");
      onFieldsUpdated();
    } catch (error) {
      console.error("Error adding field:", error);
      toast.error("Erro ao adicionar campo");
    } finally {
      setSaving(false);
    }
  };

  const resetAddFieldForm = () => {
    setNewFieldLabel("");
    setNewFieldType("text");
    setNewFieldSection("Informações Gerais");
    setNewFieldOptions("");
    setNewFieldContext(activeTab);
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
      
      toast.success("Campo excluído");
      setDeleteField(null);
      loadFields(activeTab as "contact" | "company" | "deal");
      onFieldsUpdated();
    } catch (error) {
      console.error("Error deleting field:", error);
      toast.error("Erro ao excluir campo");
    } finally {
      setSaving(false);
    }
  };

  const handleAddSection = () => {
    if (!newSectionName.trim()) {
      toast.error("Digite o nome do grupo");
      return;
    }
    if (sections.includes(newSectionName.trim())) {
      toast.error("Esse grupo já existe");
      return;
    }
    setSections(prev => [...prev, newSectionName.trim()]);
    setNewFieldSection(newSectionName.trim());
    setNewSectionName("");
    setShowAddSectionModal(false);
    toast.success("Grupo adicionado");
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
      toast.error("Erro ao excluir");
    } finally {
      setSaving(false);
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
      toast.error("Erro ao excluir");
    } finally {
      setSaving(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const getFieldTypeLabel = (type: string) => {
    return FIELD_TYPES.find(t => t.value === type)?.label || type;
  };

  // Group fields by section
  const fieldsBySection = fields.reduce((acc, field) => {
    if (!acc[field.section]) {
      acc[field.section] = [];
    }
    acc[field.section].push(field);
    return acc;
  }, {} as Record<string, CustomField[]>);

  // Filter fields by search
  const filteredSections = searchTerm
    ? Object.entries(fieldsBySection).reduce((acc, [section, sectionFields]) => {
        const filtered = sectionFields.filter(f => 
          f.field_label.toLowerCase().includes(searchTerm.toLowerCase()) ||
          f.field_name.toLowerCase().includes(searchTerm.toLowerCase())
        );
        if (filtered.length > 0) {
          acc[section] = filtered;
        }
        return acc;
      }, {} as Record<string, CustomField[]>)
    : fieldsBySection;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle>Gerenciamento de campos</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Main Tabs: Contato, Empresa, Negócio + Config */}
            <div className="flex items-center justify-between px-6 py-3 border-b bg-muted/30">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
                <TabsList className="bg-transparent gap-4 h-auto p-0">
                  {CONTEXT_OPTIONS.map(opt => (
                    <TabsTrigger 
                      key={opt.value} 
                      value={opt.value}
                      className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-2"
                    >
                      {opt.label}
                    </TabsTrigger>
                  ))}
                  <TabsTrigger 
                    value="config"
                    className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-2 flex items-center gap-1"
                  >
                    <CreditCard className="h-4 w-4" />
                    Configurações
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {activeTab !== "config" && (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Buscar..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 w-48 h-9"
                    />
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowAddSectionModal(true)}
                  >
                    Adicionar grupo
                  </Button>
                  <Button 
                    size="sm"
                    onClick={() => {
                      setNewFieldContext(activeTab);
                      setShowAddFieldModal(true);
                    }}
                  >
                    Adicionar campo
                  </Button>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : activeTab === "config" ? (
                // Config Tab Content
                <div className="p-6">
                  <Tabs value={configTab} onValueChange={(v) => setConfigTab(v as any)}>
                    <TabsList className="mb-4">
                      <TabsTrigger value="payment">Formas de Pagamento</TabsTrigger>
                      <TabsTrigger value="banks">Bancos</TabsTrigger>
                    </TabsList>

                    <TabsContent value="payment" className="space-y-4">
                      <div className="flex justify-end">
                        <Button size="sm" onClick={() => setShowAddPaymentMethod(true)}>
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar
                        </Button>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead className="w-20">Status</TableHead>
                            <TableHead className="w-12"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paymentMethods.map(pm => (
                            <TableRow key={pm.id}>
                              <TableCell className="font-medium">{pm.name}</TableCell>
                              <TableCell>
                                <span className={cn(
                                  "text-xs px-2 py-1 rounded-full",
                                  pm.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                                )}>
                                  {pm.is_active ? "Ativo" : "Inativo"}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => setDeletePaymentMethod(pm)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TabsContent>

                    <TabsContent value="banks" className="space-y-4">
                      <div className="flex justify-end">
                        <Button size="sm" onClick={() => setShowAddBank(true)}>
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar
                        </Button>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead className="w-20">Status</TableHead>
                            <TableHead className="w-12"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {banks.map(bank => (
                            <TableRow key={bank.id}>
                              <TableCell className="font-medium">{bank.name}</TableCell>
                              <TableCell>
                                <span className={cn(
                                  "text-xs px-2 py-1 rounded-full",
                                  bank.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                                )}>
                                  {bank.is_active ? "Ativo" : "Inativo"}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => setDeleteBank(bank)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TabsContent>
                  </Tabs>
                </div>
              ) : (
                // Fields Tab Content
                <div className="px-6 py-4 space-y-2">
                  {Object.entries(filteredSections).map(([section, sectionFields]) => (
                    <Collapsible 
                      key={section} 
                      open={expandedSections.has(section)}
                      onOpenChange={() => toggleSection(section)}
                    >
                      <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 hover:bg-muted/50 rounded-lg px-2">
                        <ChevronDown className={cn(
                          "h-4 w-4 transition-transform",
                          !expandedSections.has(section) && "-rotate-90"
                        )} />
                        <span className="font-medium text-sm">{section}</span>
                        <span className="text-xs text-muted-foreground">({sectionFields.length})</span>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="text-xs text-muted-foreground font-normal">Nome do campo</TableHead>
                              <TableHead className="text-xs text-muted-foreground font-normal w-32">Tipo</TableHead>
                              <TableHead className="text-xs text-muted-foreground font-normal w-48">Identificador</TableHead>
                              <TableHead className="text-xs text-muted-foreground font-normal w-32 text-center">Usar como variável</TableHead>
                              <TableHead className="w-12"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sectionFields.map(field => (
                              <TableRow key={field.id} className="hover:bg-muted/30">
                                <TableCell className="font-medium">{field.field_label}</TableCell>
                                <TableCell className="text-muted-foreground">{getFieldTypeLabel(field.field_type)}</TableCell>
                                <TableCell className="text-muted-foreground font-mono text-xs">{field.field_name}</TableCell>
                                <TableCell className="text-center">
                                  <Checkbox 
                                    disabled={field.is_system}
                                    className={cn(field.is_system && "opacity-50")}
                                  />
                                </TableCell>
                                <TableCell>
                                  {!field.is_system && (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                          <MoreVertical className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem 
                                          className="text-destructive focus:text-destructive"
                                          onClick={() => setDeleteField(field)}
                                        >
                                          <Trash2 className="h-4 w-4 mr-2" />
                                          Excluir
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}

                  {Object.keys(filteredSections).length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      {searchTerm ? "Nenhum campo encontrado" : "Nenhum campo cadastrado"}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Field Modal */}
      <Dialog open={showAddFieldModal} onOpenChange={setShowAddFieldModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar campo customizado</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div>
              <p className="text-sm font-medium mb-3">Criação de um novo campo</p>
              <p className="text-sm text-muted-foreground mb-4">Estou criando um campo para:</p>
              
              <div className="grid grid-cols-3 gap-3">
                {CONTEXT_OPTIONS.map(opt => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setNewFieldContext(opt.value)}
                      className={cn(
                        "flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 transition-colors",
                        newFieldContext === opt.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/50"
                      )}
                    >
                      <Icon className={cn(
                        "h-6 w-6",
                        newFieldContext === opt.value ? "text-primary" : "text-muted-foreground"
                      )} />
                      <span className={cn(
                        "text-sm font-medium",
                        newFieldContext === opt.value ? "text-primary" : "text-foreground"
                      )}>
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nome do campo</Label>
              <Input
                value={newFieldLabel}
                onChange={(e) => setNewFieldLabel(e.target.value)}
                placeholder="Ex: Data de Nascimento"
              />
            </div>

            <div className="space-y-2">
              <Label>Grupo</Label>
              <div className="flex gap-2">
                <Select value={newFieldSection} onValueChange={setNewFieldSection}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sections.map(section => (
                      <SelectItem key={section} value={section}>
                        {section}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => setShowAddSectionModal(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tipo do campo</Label>
              <div className="grid grid-cols-4 gap-2">
                {FIELD_TYPES.map(type => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setNewFieldType(type.value)}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg border-2 transition-colors",
                        newFieldType === type.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/50"
                      )}
                    >
                      <Icon className={cn(
                        "h-5 w-5",
                        newFieldType === type.value ? "text-primary" : "text-muted-foreground"
                      )} />
                      <span className={cn(
                        "text-xs font-medium",
                        newFieldType === type.value ? "text-primary" : "text-foreground"
                      )}>
                        {type.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {(newFieldType === "select" || newFieldType === "multiselect") && (
              <div className="space-y-2">
                <Label>Opções (separadas por vírgula)</Label>
                <Input
                  value={newFieldOptions}
                  onChange={(e) => setNewFieldOptions(e.target.value)}
                  placeholder="Ex: Opção 1, Opção 2, Opção 3"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowAddFieldModal(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleAddField} disabled={saving}>
              {saving ? "Adicionando..." : "Adicionar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Section Modal */}
      <Dialog open={showAddSectionModal} onOpenChange={setShowAddSectionModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adicionar grupo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome do grupo</Label>
              <Input
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                placeholder="Ex: Dados Adicionais"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowAddSectionModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddSection}>
              Adicionar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Payment Method Modal */}
      <Dialog open={showAddPaymentMethod} onOpenChange={setShowAddPaymentMethod}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adicionar forma de pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={newPaymentMethodName}
                onChange={(e) => setNewPaymentMethodName(e.target.value)}
                placeholder="Ex: PIX, Cartão de Crédito"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowAddPaymentMethod(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleAddPaymentMethod} disabled={saving}>
              {saving ? "Adicionando..." : "Adicionar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Bank Modal */}
      <Dialog open={showAddBank} onOpenChange={setShowAddBank}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adicionar banco</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={newBankName}
                onChange={(e) => setNewBankName(e.target.value)}
                placeholder="Ex: Banco do Brasil, Nubank"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowAddBank(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleAddBank} disabled={saving}>
              {saving ? "Adicionando..." : "Adicionar"}
            </Button>
          </div>
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
