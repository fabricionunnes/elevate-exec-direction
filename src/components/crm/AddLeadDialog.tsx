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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface AddLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelineId: string;
  onSuccess: () => void;
  initialStageId?: string;
}

export const AddLeadDialog = ({ open, onOpenChange, pipelineId, onSuccess, initialStageId }: AddLeadDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [stages, setStages] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [originsList, setOriginsList] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    company: "",
    role: "",
    city: "",
    state: "",
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

      const { error } = await supabase
        .from("crm_leads")
        .insert({
          name: formData.name,
          phone: formData.phone || null,
          email: formData.email || null,
          company: formData.company || null,
          role: formData.role || null,
          city: formData.city || null,
          state: formData.state || null,
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
        });

      if (error) throw error;

      toast.success("Lead criado com sucesso");
      onSuccess();
      onOpenChange(false);
      setFormData({
        name: "",
        phone: "",
        email: "",
        company: "",
        role: "",
        city: "",
        state: "",
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
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Nome do lead"
              />
            </div>

            <div>
              <Label htmlFor="phone">Telefone/WhatsApp</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="(11) 99999-9999"
              />
            </div>

            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="email@empresa.com"
              />
            </div>

            <div>
              <Label htmlFor="company">Empresa</Label>
              <Input
                id="company"
                value={formData.company}
                onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                placeholder="Nome da empresa"
              />
            </div>

            <div>
              <Label htmlFor="role">Cargo</Label>
              <Input
                id="role"
                value={formData.role}
                onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                placeholder="Cargo"
              />
            </div>

            <div>
              <Label htmlFor="city">Cidade</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                placeholder="Cidade"
              />
            </div>

            <div>
              <Label htmlFor="state">UF</Label>
              <Input
                id="state"
                value={formData.state}
                onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
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
              <Input
                id="opportunity_value"
                type="number"
                value={formData.opportunity_value}
                onChange={(e) => setFormData(prev => ({ ...prev, opportunity_value: e.target.value }))}
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
              <Input
                id="segment"
                value={formData.segment}
                onChange={(e) => setFormData(prev => ({ ...prev, segment: e.target.value }))}
                placeholder="Ex: Tecnologia, Varejo, Serviços..."
              />
            </div>

            <div>
              <Label htmlFor="main_pain">Dor Principal</Label>
              <Textarea
                id="main_pain"
                value={formData.main_pain}
                onChange={(e) => setFormData(prev => ({ ...prev, main_pain: e.target.value }))}
                placeholder="Qual o principal problema que o lead quer resolver?"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
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
