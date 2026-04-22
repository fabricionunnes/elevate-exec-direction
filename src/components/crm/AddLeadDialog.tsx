import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { syncLeadToClint } from "@/hooks/useClintSync";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PhoneInput } from "@/components/ui/phone-input";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { LeadNameAutocomplete, type LeadAutocompleteSelection } from "./LeadNameAutocomplete";
import { formatPhone } from "@/lib/utils";

interface AddLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelineId: string;
  onSuccess: () => void;
  initialStageId?: string;
}

// Debounced text input component for smooth typing
const DebouncedInput = ({
  value: externalValue,
  onChange,
  debounceMs = 300,
  ...props
}: React.ComponentProps<typeof Input> & {
  value: string;
  onChange: (value: string) => void;
  debounceMs?: number;
}) => {
  const [localValue, setLocalValue] = useState(externalValue);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!debounceRef.current) {
      setLocalValue(externalValue);
    }
  }, [externalValue]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      onChange(newValue);
    }, debounceMs);
  }, [onChange, debounceMs]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return <Input {...props} value={localValue} onChange={handleChange} />;
};

// Debounced textarea component for smooth typing
const DebouncedTextarea = ({
  value: externalValue,
  onChange,
  debounceMs = 300,
  ...props
}: React.ComponentProps<typeof Textarea> & {
  value: string;
  onChange: (value: string) => void;
  debounceMs?: number;
}) => {
  const [localValue, setLocalValue] = useState(externalValue);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!debounceRef.current) {
      setLocalValue(externalValue);
    }
  }, [externalValue]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      onChange(newValue);
    }, debounceMs);
  }, [onChange, debounceMs]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return <Textarea {...props} value={localValue} onChange={handleChange} />;
};

export const AddLeadDialog = ({ open, onOpenChange, pipelineId, onSuccess, initialStageId }: AddLeadDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [stages, setStages] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [originsList, setOriginsList] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    document: "",
    company: "",
    role: "",
    city: "",
    state: "",
    address: "",
    address_number: "",
    address_complement: "",
    address_neighborhood: "",
    zipcode: "",
    origin_id: "",
    stage_id: "",
    opportunity_value: "",
    segment: "",
    main_pain: "",
    urgency: "medium",
    notes: "",
    owner_staff_id: "",
  });

  useEffect(() => {
    if (pipelineId && open) {
      loadStages();
      loadStaff();
      loadOrigins();
    }
  }, [pipelineId, open]);

  const loadStages = async () => {
    const { data } = await supabase
      .from("crm_stages")
      .select("*")
      .eq("pipeline_id", pipelineId)
      .order("sort_order");
    
    setStages(data || []);
    if (data && data.length > 0) {
      // Use initialStageId if provided, otherwise use the first stage
      const defaultStageId = initialStageId || data[0].id;
      setFormData(prev => ({ ...prev, stage_id: defaultStageId }));
    }
  };

  const loadStaff = async () => {
    const { data } = await supabase
      .from("onboarding_staff")
      .select("id, name, role")
      .eq("is_active", true)
      .in("role", ["master", "admin", "head_comercial", "closer", "sdr"])
      .order("name");
    
    setStaffList(data || []);
  };

  const loadOrigins = async () => {
    const { data } = await supabase
      .from("crm_origins")
      .select("id, name, pipeline_id")
      .eq("is_active", true)
      .eq("pipeline_id", pipelineId)
      .order("sort_order");
    
    setOriginsList(data || []);
    // Auto-select first origin if only one exists
    if (data && data.length === 1) {
      setFormData(prev => ({ ...prev, origin_id: data[0].id }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    if (!formData.stage_id) {
      toast.error("Selecione uma etapa");
      return;
    }

    setLoading(true);
    try {
      // Get current staff
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();

      if (!staff) throw new Error("Staff não encontrado");

      const { data: newLead, error } = await supabase
        .from("crm_leads")
        .insert({
          name: formData.name,
          phone: formData.phone || null,
          email: formData.email || null,
          document: formData.document || null,
          company: formData.company || null,
          role: formData.role || null,
          city: formData.city || null,
          state: formData.state || null,
          address: formData.address || null,
          address_number: formData.address_number || null,
          address_complement: formData.address_complement || null,
          address_neighborhood: formData.address_neighborhood || null,
          zipcode: formData.zipcode || null,
          origin_id: formData.origin_id || null,
          pipeline_id: pipelineId,
          stage_id: formData.stage_id,
          opportunity_value: formData.opportunity_value ? parseFloat(formData.opportunity_value) : 0,
          segment: formData.segment || null,
          main_pain: formData.main_pain || null,
          urgency: formData.urgency,
          notes: formData.notes || null,
          owner_staff_id: formData.owner_staff_id || staff.id,
          created_by: staff.id,
          entered_pipeline_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (error) throw error;

      // Sync to Clint in background
      if (newLead?.id) {
        syncLeadToClint(newLead.id, "create");

        // Get pipeline name for notifications
        const { data: pipelineData } = await supabase
          .from("crm_pipelines")
          .select("name")
          .eq("id", pipelineId)
          .maybeSingle();
        const pipelineName = pipelineData?.name || "Desconhecido";

        // Fire automation engine for lead_created (notifications, WhatsApp, etc.)
        try {
          await supabase.functions.invoke("automation-engine", {
            body: {
              trigger_type: "lead_created",
              trigger_data: {
                lead_id: newLead.id,
                lead_name: formData.name,
                lead_phone: formData.phone || "",
                company_name: formData.company || "",
                pipeline_id: pipelineId,
                pipeline_name: pipelineName,
              },
            },
          });
        } catch (autoErr) {
          console.error("[AddLeadDialog] Automation engine error:", autoErr);
        }

        // Send WhatsApp notifications to staff
        try {
          const APP_URL = window.location.origin;
          const leadLink = `${APP_URL}/#/crm/leads/${newLead.id}`;

          const message = `🚀 *Novo Lead CRM!*\n\n` +
            `📊 *Funil:* ${pipelineName}\n` +
            `👤 *Nome:* ${formData.name}\n` +
            (formData.phone ? `📞 *Telefone:* ${formatPhone(formData.phone) || formData.phone}\n` : '') +
            (formData.email ? `📧 *Email:* ${formData.email}\n` : '') +
            (formData.company ? `🏢 *Empresa:* ${formData.company}\n` : '') +
            `\n🔗 *Ver no CRM:* ${leadLink}`;

          const { data: instance } = await supabase
            .from("whatsapp_instances")
            .select("instance_name, api_url, api_key")
            .eq("instance_name", "fabricio-nunnes")
            .maybeSingle();

          if (instance?.api_url && instance?.api_key && instance?.instance_name) {
            // Get staff numbers to notify
            const { data: staffNumbers } = await supabase
              .from("onboarding_staff")
              .select("phone")
              .eq("is_active", true)
              .in("role", ["master", "head_comercial", "sdr"])
              .not("phone", "is", null);

            const { data: notifNumbers } = await supabase
              .from("crm_lead_notification_numbers")
              .select("phone")
              .eq("is_active", true);

            const normalizeBRPhone = (p: string) => {
              let clean = p.replace(/\D/g, "");
              if (clean.length === 10 || clean.length === 11) clean = "55" + clean;
              if (clean.length === 12 && clean.startsWith("55")) {
                clean = clean.slice(0, 4) + "9" + clean.slice(4);
              }
              return clean;
            };

            const numbersToNotify: string[] = [];
            for (const s of (staffNumbers || [])) {
              const clean = normalizeBRPhone(s.phone || "");
              if (clean && !numbersToNotify.includes(clean)) numbersToNotify.push(clean);
            }
            for (const n of (notifNumbers || [])) {
              const clean = normalizeBRPhone(n.phone || "");
              if (clean && !numbersToNotify.includes(clean)) numbersToNotify.push(clean);
            }

            // Send via edge function to avoid CORS
            for (const phone of numbersToNotify) {
              try {
                await supabase.functions.invoke("evolution-api", {
                  body: {
                    action: "send-text",
                    instanceName: instance.instance_name,
                    number: phone,
                    text: message,
                  },
                });
              } catch (whatsappErr) {
                console.error(`[AddLeadDialog] WhatsApp error for ${phone}:`, whatsappErr);
              }
            }
          }
        } catch (notifErr) {
          console.error("[AddLeadDialog] Notification error:", notifErr);
        }

        // Enqueue CRM message rules (régua de mensagens para o cliente)
        if (formData.phone) {
          try {
            await supabase.functions.invoke("crm-message-queue", {
              body: {
                action: "enqueue",
                trigger_type: "lead_created",
                lead_id: newLead.id,
                lead_name: formData.name,
                lead_phone: formData.phone,
                lead_email: formData.email || "",
                company_name: formData.company || "",
                pipeline_id: pipelineId,
                pipeline_name: pipelineName,
                stage_id: formData.stage_id,
                stage_name: stages.find(s => s.id === formData.stage_id)?.name || "",
              },
            });
          } catch (queueErr) {
            console.error("[AddLeadDialog] Message queue error:", queueErr);
          }
        }
      }

      toast.success("Lead criado com sucesso");
      onSuccess();
      onOpenChange(false);
      setFormData({
        name: "",
        phone: "",
        email: "",
        document: "",
        company: "",
        role: "",
        city: "",
        state: "",
        address: "",
        address_number: "",
        address_complement: "",
        address_neighborhood: "",
        zipcode: "",
        origin_id: originsList[0]?.id || "",
        stage_id: stages[0]?.id || "",
        opportunity_value: "",
        segment: "",
        main_pain: "",
        urgency: "medium",
        notes: "",
        owner_staff_id: "",
      });
    } catch (error: any) {
      console.error("Error creating lead:", error);
      toast.error(error.message || "Erro ao criar lead");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Lead</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="name">Nome *</Label>
              <LeadNameAutocomplete
                id="name"
                value={formData.name}
                onChange={(value) => setFormData(prev => ({ ...prev, name: value }))}
                onSelect={(sel: LeadAutocompleteSelection) => {
                  setFormData(prev => ({
                    ...prev,
                    name: sel.name || prev.name,
                    phone: sel.phone || prev.phone,
                    email: sel.email || prev.email,
                    document: sel.document || prev.document,
                    company: sel.company || prev.company,
                    role: sel.role || prev.role,
                    city: sel.city || prev.city,
                    state: sel.state || prev.state,
                    segment: sel.segment || prev.segment,
                    address: sel.address || prev.address,
                    address_number: sel.address_number || prev.address_number,
                    address_complement: sel.address_complement || prev.address_complement,
                    address_neighborhood: sel.address_neighborhood || prev.address_neighborhood,
                    zipcode: sel.zipcode || prev.zipcode,
                  }));
                  toast.success(
                    sel.source === "company"
                      ? "Dados da empresa preenchidos"
                      : "Dados do lead preenchidos"
                  );
                }}
                placeholder="Nome do lead"
              />
            </div>

            <div>
              <Label htmlFor="phone">Telefone/WhatsApp</Label>
              <PhoneInput
                id="phone"
                value={formData.phone}
                onChange={(value) => setFormData(prev => ({ ...prev, phone: value }))}
              />
            </div>

            <div>
              <Label htmlFor="email">E-mail</Label>
              <DebouncedInput
                id="email"
                type="email"
                value={formData.email}
                onChange={(value) => setFormData(prev => ({ ...prev, email: value }))}
                placeholder="email@empresa.com"
              />
            </div>

            <div>
              <Label htmlFor="document">CPF/CNPJ</Label>
              <DebouncedInput
                id="document"
                value={formData.document}
                onChange={(value) => setFormData(prev => ({ ...prev, document: value }))}
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
              />
            </div>

            <div>
              <Label htmlFor="company">Empresa</Label>
              <DebouncedInput
                id="company"
                value={formData.company}
                onChange={(value) => setFormData(prev => ({ ...prev, company: value }))}
                placeholder="Nome da empresa"
              />
            </div>

            <div>
              <Label htmlFor="role">Cargo</Label>
              <DebouncedInput
                id="role"
                value={formData.role}
                onChange={(value) => setFormData(prev => ({ ...prev, role: value }))}
                placeholder="Cargo"
              />
            </div>

            <div>
              <Label htmlFor="city">Cidade</Label>
              <DebouncedInput
                id="city"
                value={formData.city}
                onChange={(value) => setFormData(prev => ({ ...prev, city: value }))}
                placeholder="Cidade"
              />
            </div>

            <div>
              <Label htmlFor="state">UF</Label>
              <DebouncedInput
                id="state"
                value={formData.state}
                onChange={(value) => setFormData(prev => ({ ...prev, state: value }))}
                placeholder="SP"
                maxLength={2}
              />
            </div>
          </div>

          {/* Pipeline Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="stage">Etapa *</Label>
              <Select
                value={formData.stage_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, stage_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map(stage => (
                    <SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="origin">Origem/Funil *</Label>
              <Select
                value={formData.origin_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, origin_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a origem" />
                </SelectTrigger>
                <SelectContent>
                  {originsList.map(origin => (
                    <SelectItem key={origin.id} value={origin.id}>{origin.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="opportunity_value">Valor da Oportunidade (R$)</Label>
              <DebouncedInput
                id="opportunity_value"
                type="number"
                value={formData.opportunity_value}
                onChange={(value) => setFormData(prev => ({ ...prev, opportunity_value: value }))}
                placeholder="0"
              />
            </div>

            <div>
              <Label htmlFor="urgency">Urgência</Label>
              <Select
                value={formData.urgency}
                onValueChange={(value) => setFormData(prev => ({ ...prev, urgency: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label htmlFor="owner">Responsável</Label>
              <Select
                value={formData.owner_staff_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, owner_staff_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o responsável" />
                </SelectTrigger>
                <SelectContent>
                  {staffList.map(staff => (
                    <SelectItem key={staff.id} value={staff.id}>
                      {staff.name} ({staff.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Qualification */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="segment">Segmento</Label>
              <DebouncedInput
                id="segment"
                value={formData.segment}
                onChange={(value) => setFormData(prev => ({ ...prev, segment: value }))}
                placeholder="Ex: Tecnologia, Varejo, Serviços..."
              />
            </div>

            <div>
              <Label htmlFor="main_pain">Dor Principal</Label>
              <DebouncedTextarea
                id="main_pain"
                value={formData.main_pain}
                onChange={(value) => setFormData(prev => ({ ...prev, main_pain: value }))}
                placeholder="Qual o principal problema que o lead quer resolver?"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="notes">Observações</Label>
              <DebouncedTextarea
                id="notes"
                value={formData.notes}
                onChange={(value) => setFormData(prev => ({ ...prev, notes: value }))}
                placeholder="Anotações gerais sobre o lead..."
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Lead
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
