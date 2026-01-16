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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { 
  JobOpening, 
  JOB_AREAS, 
  JOB_TYPES, 
  SENIORITY_LEVELS, 
  CONTRACT_MODELS 
} from "../types";

interface JobOpeningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  companyId?: string;
  job: JobOpening | null;
  onSuccess: () => void;
}

export function JobOpeningDialog({
  open,
  onOpenChange,
  projectId,
  companyId,
  job,
  onSuccess,
}: JobOpeningDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    area: "",
    job_type: "",
    description: "",
    requirements: "",
    differentials: "",
    seniority: "",
    contract_model: "",
    salary_range: "",
    location: "",
    is_remote: false,
  });

  useEffect(() => {
    if (job) {
      setFormData({
        title: job.title || "",
        area: job.area || "",
        job_type: job.job_type || "",
        description: job.description || "",
        requirements: job.requirements || "",
        differentials: job.differentials || "",
        seniority: job.seniority || "",
        contract_model: job.contract_model || "",
        salary_range: job.salary_range || "",
        location: job.location || "",
        is_remote: job.is_remote || false,
      });
    } else {
      setFormData({
        title: "",
        area: "",
        job_type: "",
        description: "",
        requirements: "",
        differentials: "",
        seniority: "",
        contract_model: "",
        salary_range: "",
        location: "",
        is_remote: false,
      });
    }
  }, [job, open]);

  const handleSubmit = async () => {
    if (!formData.title.trim() || !formData.area || !formData.job_type) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    setLoading(true);
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        toast.error("Você precisa estar logado para salvar a vaga");
        return;
      }

      // If the logged user is staff, keep created_by filled.
      // For client users, created_by stays null (allowed by schema).
      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      const payload = {
        ...formData,
        project_id: projectId,
        company_id: companyId || null,
        created_by: staff?.id ?? null,
      };

      if (job) {
        const { error } = await supabase
          .from("job_openings")
          .update(payload)
          .eq("id", job.id);

        if (error) throw error;
        toast.success("Vaga atualizada com sucesso");
      } else {
        const { error } = await supabase.from("job_openings").insert(payload);

        if (error) throw error;
        toast.success("Vaga criada com sucesso");
      }

      onSuccess();
    } catch (error: any) {
      console.error("Error saving job:", error);

      const message =
        typeof error?.message === "string" ? error.message : "Erro ao salvar vaga";

      if (message.includes("row-level security") || error?.code === "42501") {
        toast.error("Sem permissão para salvar a vaga", {
          description:
            "Confirme se você está logado e possui acesso a este projeto.",
        });
        return;
      }

      toast.error("Erro ao salvar vaga", {
        description: message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{job ? "Editar Vaga" : "Nova Vaga"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Título da Vaga *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ex: Consultor de Vendas"
              />
            </div>

            <div className="space-y-2">
              <Label>Área *</Label>
              <Select
                value={formData.area}
                onValueChange={(value) => setFormData({ ...formData, area: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a área" />
                </SelectTrigger>
                <SelectContent>
                  {JOB_AREAS.map((area) => (
                    <SelectItem key={area} value={area}>
                      {area}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Vaga *</Label>
              <Select
                value={formData.job_type}
                onValueChange={(value) => setFormData({ ...formData, job_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {JOB_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Senioridade</Label>
              <Select
                value={formData.seniority}
                onValueChange={(value) => setFormData({ ...formData, seniority: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {SENIORITY_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Modelo de Contratação</Label>
              <Select
                value={formData.contract_model}
                onValueChange={(value) => setFormData({ ...formData, contract_model: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {CONTRACT_MODELS.map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Faixa Salarial</Label>
              <Input
                value={formData.salary_range}
                onChange={(e) => setFormData({ ...formData, salary_range: e.target.value })}
                placeholder="Ex: R$ 5.000 - R$ 8.000"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Localização</Label>
              <Input
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Ex: São Paulo, SP"
              />
            </div>

            <div className="flex items-center gap-3 pt-6">
              <Switch
                checked={formData.is_remote}
                onCheckedChange={(checked) => setFormData({ ...formData, is_remote: checked })}
              />
              <Label>Vaga Remota</Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição da Vaga</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descreva as responsabilidades e atividades..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Requisitos Obrigatórios</Label>
            <Textarea
              value={formData.requirements}
              onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
              placeholder="Liste os requisitos necessários..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Diferenciais</Label>
            <Textarea
              value={formData.differentials}
              onChange={(e) => setFormData({ ...formData, differentials: e.target.value })}
              placeholder="Liste os diferenciais desejados..."
              rows={2}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Salvando..." : job ? "Salvar" : "Criar Vaga"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
