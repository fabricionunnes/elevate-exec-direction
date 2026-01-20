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
import { toast } from "sonner";
import { Candidate } from "../types";

interface JobOption {
  id: string;
  title: string;
}

interface EditCandidateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: Candidate | null;
  jobs: JobOption[];
  onSuccess: () => void;
}

export function EditCandidateDialog({
  open,
  onOpenChange,
  candidate,
  jobs,
  onSuccess,
}: EditCandidateDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    cpf: "",
    linkedin_url: "",
    job_opening_id: "",
    notes: "",
  });

  useEffect(() => {
    if (candidate && open) {
      setFormData({
        full_name: candidate.full_name || "",
        email: candidate.email || "",
        phone: candidate.phone || "",
        cpf: candidate.cpf || "",
        linkedin_url: candidate.linkedin_url || "",
        job_opening_id: candidate.job_opening_id || "",
        notes: candidate.notes || "",
      });
    }
  }, [candidate, open]);

  const handleSubmit = async () => {
    if (!candidate) return;
    if (!formData.full_name.trim() || !formData.email.trim()) {
      toast.error("Preencha nome e email");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("candidates")
        .update({
          full_name: formData.full_name.trim(),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone || null,
          cpf: formData.cpf || null,
          linkedin_url: formData.linkedin_url || null,
          job_opening_id: formData.job_opening_id || null,
          notes: formData.notes || null,
        })
        .eq("id", candidate.id);

      if (error) throw error;

      toast.success("Candidato atualizado com sucesso!");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error updating candidate:", error);
      toast.error(error.message || "Erro ao atualizar candidato");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Candidato</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome Completo *</Label>
              <Input
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>CPF</Label>
              <Input
                value={formData.cpf}
                onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>LinkedIn</Label>
            <Input
              value={formData.linkedin_url}
              onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
            />
          </div>

          {jobs.length > 0 && (
            <div className="space-y-2">
              <Label>Vaga</Label>
              <Select
                value={formData.job_opening_id}
                onValueChange={(value) => setFormData({ ...formData, job_opening_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma vaga (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma</SelectItem>
                  {jobs.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
