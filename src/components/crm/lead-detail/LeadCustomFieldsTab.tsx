import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Settings, EyeOff, Flag } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ManageCustomFieldsDialog } from "./ManageCustomFieldsDialog";

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
}

interface FieldValue {
  field_id: string;
  value: string | null;
}

interface LeadCustomFieldsTabProps {
  leadId: string;
  context: "contact" | "company" | "deal";
  leadData: Record<string, any>;
  onUpdate: () => void;
}

// Wrapper component for currency field with debounced save
const CurrencyFieldWrapper = ({
  field,
  value,
  onSave,
  isSaving,
}: {
  field: CustomField;
  value: string;
  onSave: (field: CustomField, value: string) => void;
  isSaving: boolean;
}) => {
  const [localValue, setLocalValue] = useState<number>(value ? parseFloat(value) : 0);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setLocalValue(value ? parseFloat(value) : 0);
  }, [value]);

  const handleChange = useCallback((newValue: number) => {
    setLocalValue(newValue);
    
    // Debounce the save
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      onSave(field, newValue.toString());
    }, 500);
  }, [field, onSave]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
        R$
      </span>
      <CurrencyInput
        value={localValue}
        onChange={handleChange}
        disabled={isSaving}
        className="pl-10"
        placeholder="0,00"
      />
    </div>
  );
};

// Staff select wrapper for closer and SDR fields
const StaffSelectWrapper = ({
  field,
  value,
  onSave,
  isSaving,
  staffList,
}: {
  field: CustomField;
  value: string;
  onSave: (field: CustomField, value: string) => void;
  isSaving: boolean;
  staffList: { id: string; name: string; role: string }[];
}) => {
  const selectedStaff = staffList.find(s => s.id === value);
  
  return (
    <Select
      value={value || "none"}
      onValueChange={(v) => onSave(field, v === "none" ? "" : v)}
      disabled={isSaving}
    >
      <SelectTrigger>
        <SelectValue placeholder="Selecionar">
          {selectedStaff?.name || "Selecionar"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Nenhum</SelectItem>
        {staffList.map((staff) => (
          <SelectItem key={staff.id} value={staff.id}>
            {staff.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

// Generic select wrapper for products and plans
const EntitySelectWrapper = ({
  field,
  value,
  onSave,
  isSaving,
  options,
  placeholder = "Selecionar",
}: {
  field: CustomField;
  value: string;
  onSave: (field: CustomField, value: string) => void;
  isSaving: boolean;
  options: { id: string; name: string }[];
  placeholder?: string;
}) => {
  const selectedOption = options.find(o => o.id === value);
  
  return (
    <Select
      value={value || "none"}
      onValueChange={(v) => onSave(field, v === "none" ? "" : v)}
      disabled={isSaving}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder}>
          {selectedOption?.name || placeholder}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Nenhum</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export const LeadCustomFieldsTab = ({
  leadId,
  context,
  leadData,
  onUpdate,
}: LeadCustomFieldsTabProps) => {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [values, setValues] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [hideEmptyFields, setHideEmptyFields] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["Informações Gerais"]));
  const [closerStaff, setCloserStaff] = useState<{ id: string; name: string; role: string }[]>([]);
  const [sdrStaff, setSdrStaff] = useState<{ id: string; name: string; role: string }[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [plans, setPlans] = useState<{ id: string; name: string }[]>([]);
  const [isMaster, setIsMaster] = useState(false);
  const [showManageFields, setShowManageFields] = useState(false);

  useEffect(() => {
    loadFields();
    checkMasterRole();
    if (context === "deal") {
      loadStaff();
      loadProductsAndPlans();
    }
  }, [leadId, context]);

  const checkMasterRole = async () => {
    try {
      const { data } = await supabase.rpc("is_master");
      setIsMaster(data === true);
    } catch (error) {
      console.error("Error checking master role:", error);
    }
  };

  const loadStaff = async () => {
    // Load closers
    const { data: closers } = await supabase
      .from("onboarding_staff")
      .select("id, name, role")
      .eq("is_active", true)
      .eq("role", "closer")
      .order("name");
    
    setCloserStaff(closers || []);

    // Load SDRs, Social Setters, and BDRs
    const { data: sdrs } = await supabase
      .from("onboarding_staff")
      .select("id, name, role")
      .eq("is_active", true)
      .in("role", ["sdr", "social_setter", "bdr"])
      .order("name");
    
    setSdrStaff(sdrs || []);
  };

  const loadProductsAndPlans = async () => {
    // Load active services from onboarding_services
    const { data: servicesData } = await supabase
      .from("onboarding_services")
      .select("id, name")
      .eq("is_active", true)
      .order("name");
    
    setProducts(servicesData || []);

    // Load active plans
    const { data: plansData } = await supabase
      .from("crm_plans")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order");
    
    setPlans(plansData || []);
  };

  const loadFields = async () => {
    setLoading(true);
    try {
      // Load custom fields for this context
      const { data: fieldsData, error: fieldsError } = await supabase
        .from("crm_custom_fields")
        .select("*")
        .eq("context", context)
        .eq("is_active", true)
        .order("sort_order");

      if (fieldsError) throw fieldsError;
      setFields(fieldsData || []);

      // Load field values for this lead
      const { data: valuesData, error: valuesError } = await supabase
        .from("crm_custom_field_values")
        .select("field_id, value")
        .eq("lead_id", leadId);

      if (valuesError) throw valuesError;

      const valuesMap: Record<string, string | null> = {};
      valuesData?.forEach(v => {
        valuesMap[v.field_id] = v.value;
      });
      setValues(valuesMap);
    } catch (error) {
      console.error("Error loading fields:", error);
    } finally {
      setLoading(false);
    }
  };

  const getSystemValue = (fieldName: string) => {
    // Map system fields to lead data
    const mapping: Record<string, string> = {
      name: "name",
      email: "email",
      phone: "phone",
      company: "company",
      company_name: "company",
      city: "city",
      state: "state",
      segment: "segment",
      employee_count: "employee_count",
      opportunity_value: "opportunity_value",
      origin_name: "origin",
      notes: "notes",
      closer_staff_id: "closer_staff_id",
      sdr_staff_id: "sdr_staff_id",
      product_id: "product_id",
      plan_id: "plan_id",
    };

    const key = mapping[fieldName];
    if (key && leadData[key] !== undefined) {
      return leadData[key]?.toString() || "";
    }
    return null;
  };

  const getFieldValue = (field: CustomField) => {
    // First check system fields
    if (field.is_system) {
      const sysValue = getSystemValue(field.field_name);
      if (sysValue !== null) return sysValue;
    }
    // Then check custom values
    return values[field.id] || "";
  };

  const handleFieldChange = async (field: CustomField, value: string) => {
    if (field.is_system) {
      // Update lead directly for system fields
      const fieldMapping: Record<string, string> = {
        name: "name",
        email: "email",
        phone: "phone",
        company: "company",
        company_name: "company",
        city: "city",
        state: "state",
        segment: "segment",
        employee_count: "employee_count",
        opportunity_value: "opportunity_value",
        notes: "notes",
        closer_staff_id: "closer_staff_id",
        sdr_staff_id: "sdr_staff_id",
        product_id: "product_id",
        plan_id: "plan_id",
      };

      const dbField = fieldMapping[field.field_name];
      if (!dbField) return;

      setSaving(field.id);
      try {
        const updateData: Record<string, any> = {};
        if (field.field_type === "number") {
          updateData[dbField] = value ? parseFloat(value) : null;
        } else if (["closer_staff_id", "sdr_staff_id", "product_id", "plan_id"].includes(field.field_name)) {
          updateData[dbField] = value || null;
        } else {
          updateData[dbField] = value || null;
        }

        const { error } = await supabase
          .from("crm_leads")
          .update(updateData)
          .eq("id", leadId);

        if (error) throw error;
        onUpdate();
      } catch (error) {
        console.error("Error updating field:", error);
        toast.error("Erro ao salvar");
      } finally {
        setSaving(null);
      }
    } else {
      // Update custom field value
      setSaving(field.id);
      try {
        const { error } = await supabase
          .from("crm_custom_field_values")
          .upsert({
            lead_id: leadId,
            field_id: field.id,
            value: value || null,
          }, { onConflict: "lead_id,field_id" });

        if (error) throw error;
        setValues(prev => ({ ...prev, [field.id]: value }));
      } catch (error) {
        console.error("Error updating field:", error);
        toast.error("Erro ao salvar");
      } finally {
        setSaving(null);
      }
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

  // Group fields by section
  const fieldsBySection = fields.reduce((acc, field) => {
    if (!acc[field.section]) {
      acc[field.section] = [];
    }
    acc[field.section].push(field);
    return acc;
  }, {} as Record<string, CustomField[]>);

  const contextLabels: Record<string, string> = {
    contact: "Campos de contato",
    company: "Campos de empresa",
    deal: "Campos de negócio",
  };

  const renderFieldInput = (field: CustomField) => {
    const value = getFieldValue(field);
    const isSaving = saving === field.id;
    const isEmpty = !value;

    if (hideEmptyFields && isEmpty) return null;

    switch (field.field_type) {
      case "textarea":
        return (
          <Textarea
            value={value}
            onChange={(e) => handleFieldChange(field, e.target.value)}
            placeholder="Clique aqui para adicionar"
            className="min-h-[80px] resize-none"
            disabled={isSaving}
          />
        );
      case "select":
        // Special handling for closer and SDR fields
        if (field.field_name === "closer_staff_id") {
          return (
            <StaffSelectWrapper
              field={field}
              value={value}
              onSave={handleFieldChange}
              isSaving={isSaving}
              staffList={closerStaff}
            />
          );
        }
        if (field.field_name === "sdr_staff_id") {
          return (
            <StaffSelectWrapper
              field={field}
              value={value}
              onSave={handleFieldChange}
              isSaving={isSaving}
              staffList={sdrStaff}
            />
          );
        }
        // Special handling for product field
        if (field.field_name === "product_id") {
          return (
            <EntitySelectWrapper
              field={field}
              value={value}
              onSave={handleFieldChange}
              isSaving={isSaving}
              options={products}
              placeholder="Selecionar produto"
            />
          );
        }
        // Special handling for plan field
        if (field.field_name === "plan_id") {
          return (
            <EntitySelectWrapper
              field={field}
              value={value}
              onSave={handleFieldChange}
              isSaving={isSaving}
              options={plans}
              placeholder="Selecionar plano"
            />
          );
        }
        return (
          <Select
            value={value}
            onValueChange={(v) => handleFieldChange(field, v)}
            disabled={isSaving}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecionar campo" />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((opt: string) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              )) || (
                <SelectItem value="option1">Opção 1</SelectItem>
              )}
            </SelectContent>
          </Select>
        );
      case "phone":
        return (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2 py-1.5 border rounded-md bg-muted text-sm">
              🇧🇷 <span className="text-muted-foreground">▾</span>
            </div>
            <Input
              type="tel"
              value={value}
              onChange={(e) => handleFieldChange(field, e.target.value)}
              placeholder="+55"
              className="flex-1"
              disabled={isSaving}
            />
          </div>
        );
      case "number":
        // Check if this is a currency field (opportunity_value)
        const isCurrencyField = field.field_name === "opportunity_value";
        if (isCurrencyField) {
          return (
            <CurrencyFieldWrapper
              field={field}
              value={value}
              onSave={handleFieldChange}
              isSaving={isSaving}
            />
          );
        }
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) => handleFieldChange(field, e.target.value)}
            placeholder="0"
            disabled={isSaving}
          />
        );
      case "url":
        return (
          <Input
            type="url"
            value={value}
            onChange={(e) => handleFieldChange(field, e.target.value)}
            placeholder="Clique aqui para adicionar"
            disabled={isSaving}
          />
        );
      default:
        return (
          <Input
            type={field.field_type === "email" ? "email" : "text"}
            value={value}
            onChange={(e) => handleFieldChange(field, e.target.value)}
            placeholder="Clique aqui para adicionar"
            disabled={isSaving}
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <h3 className="font-medium">{contextLabels[context]}</h3>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setHideEmptyFields(!hideEmptyFields)}
            className="text-muted-foreground"
          >
            <EyeOff className="h-4 w-4 mr-2" />
            {hideEmptyFields ? "Mostrar todos" : "Ocultar Campos vazios"}
          </Button>
          {isMaster && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-muted-foreground"
              onClick={() => setShowManageFields(true)}
            >
              <Settings className="h-4 w-4 mr-2" />
              Gerenciar campos
            </Button>
          )}
        </div>
      </div>

      {/* Manage Fields Dialog */}
      <ManageCustomFieldsDialog
        open={showManageFields}
        onOpenChange={setShowManageFields}
        context={context}
        onFieldsUpdated={loadFields}
      />

      {/* Fields by Section */}
      <div className="p-6">
        {Object.entries(fieldsBySection).map(([section, sectionFields]) => (
          <Collapsible
            key={section}
            open={expandedSections.has(section)}
            onOpenChange={() => toggleSection(section)}
          >
            <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 text-left hover:bg-muted/50 rounded transition-colors">
              <ChevronDown className={cn(
                "h-4 w-4 transition-transform",
                !expandedSections.has(section) && "-rotate-90"
              )} />
              <span className="font-medium text-sm">{section}</span>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="space-y-1 mt-2">
                {sectionFields.map(field => {
                  const value = getFieldValue(field);
                  const isEmpty = !value;

                  if (hideEmptyFields && isEmpty) return null;

                  return (
                    <div
                      key={field.id}
                      className="grid grid-cols-2 gap-4 py-3 px-4 hover:bg-muted/30 rounded transition-colors items-center"
                    >
                      <Label className="text-sm text-muted-foreground">
                        {field.field_label}
                      </Label>
                      <div className="relative">
                        {renderFieldInput(field)}
                        {saving === field.id && (
                          <div className="absolute right-2 top-1/2 -translate-y-1/2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </div>
  );
};
