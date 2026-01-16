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
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface InterviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  interview: any | null;
  onSuccess: () => void;
}

export function InterviewDialog({
  open,
  onOpenChange,
  interview,
  onSuccess,
}: InterviewDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    status: "scheduled",
    score: 5,
    strengths: "",
    concerns: "",
    detailed_feedback: "",
    recommendation: "",
  });

  useEffect(() => {
    if (interview) {
      setFormData({
        status: interview.status || "scheduled",
        score: interview.score || 5,
        strengths: interview.strengths || "",
        concerns: interview.concerns || "",
        detailed_feedback: interview.detailed_feedback || "",
        recommendation: interview.recommendation || "",
      });
    }
  }, [interview, open]);

  const handleSubmit = async () => {
    if (!interview) return;

    setLoading(true);
    try {
      const updateData: any = {
        status: formData.status,
        strengths: formData.strengths || null,
        concerns: formData.concerns || null,
        detailed_feedback: formData.detailed_feedback || null,
        recommendation: formData.recommendation || null,
      };

      if (formData.status === "completed") {
        updateData.score = formData.score;
        updateData.conducted_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("interviews")
        .update(updateData)
        .eq("id", interview.id);

      if (error) throw error;

      toast.success("Entrevista atualizada!");
      onSuccess();
    } catch (error) {
      console.error("Error updating interview:", error);
      toast.error("Erro ao atualizar entrevista");
    } finally {
      setLoading(false);
    }
  };

  if (!interview) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Feedback da Entrevista</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">Agendada</SelectItem>
                <SelectItem value="completed">Realizada</SelectItem>
                <SelectItem value="cancelled">Cancelada</SelectItem>
                <SelectItem value="no_show">Não compareceu</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.status === "completed" && (
            <>
              <div className="space-y-2">
                <Label>Nota (0 a 10)</Label>
                <div className="flex items-center gap-4">
                  <Slider
                    value={[formData.score]}
                    onValueChange={([value]) => setFormData({ ...formData, score: value })}
                    max={10}
                    step={0.5}
                    className="flex-1"
                  />
                  <span className="text-2xl font-bold w-12 text-center">
                    {formData.score}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Pontos Fortes</Label>
                <Textarea
                  value={formData.strengths}
                  onChange={(e) => setFormData({ ...formData, strengths: e.target.value })}
                  placeholder="O que o candidato demonstrou de positivo..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Pontos de Atenção</Label>
                <Textarea
                  value={formData.concerns}
                  onChange={(e) => setFormData({ ...formData, concerns: e.target.value })}
                  placeholder="Áreas que precisam de desenvolvimento..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Feedback Detalhado</Label>
                <Textarea
                  value={formData.detailed_feedback}
                  onChange={(e) => setFormData({ ...formData, detailed_feedback: e.target.value })}
                  placeholder="Observações gerais sobre a entrevista..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Recomendação Final</Label>
                <Select
                  value={formData.recommendation}
                  onValueChange={(value) => setFormData({ ...formData, recommendation: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Aprovado - Avançar</SelectItem>
                    <SelectItem value="talent_pool">Banco de Talentos</SelectItem>
                    <SelectItem value="rejected">Reprovado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
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
