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
import { Loader2, Trash2 } from "lucide-react";

interface EditActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity: {
    id: string;
    type: string;
    title: string;
    description: string | null;
    scheduled_at: string | null;
  } | null;
  onSuccess: () => void;
}

const ACTIVITY_TYPES = [
  { value: "call", label: "Ligação" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "E-mail" },
  { value: "meeting", label: "Reunião" },
  { value: "followup", label: "Follow-up" },
  { value: "proposal", label: "Proposta" },
  { value: "other", label: "Outro" },
];

export const EditActivityDialog = ({ open, onOpenChange, activity, onSuccess }: EditActivityDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState({
    type: "call",
    title: "",
    description: "",
    scheduled_at: "",
  });

  useEffect(() => {
    if (activity) {
      setFormData({
        type: activity.type,
        title: activity.title,
        description: activity.description || "",
        scheduled_at: activity.scheduled_at
          ? (() => {
              // Exibe sempre no fuso de Brasília (-03:00), independente do fuso do navegador
              const parts = new Intl.DateTimeFormat("en-CA", {
                timeZone: "America/Sao_Paulo",
                year: "numeric", month: "2-digit", day: "2-digit",
                hour: "2-digit", minute: "2-digit", hour12: false,
              }).formatToParts(new Date(activity.scheduled_at));
              const get = (t: string) => parts.find(p => p.type === t)?.value || "00";
              return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
            })()
          : "",
      });
    }
  }, [activity]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activity || !formData.title.trim()) {
      toast.error("Título é obrigatório");
      return;
    }

    setLoading(true);
    try {
      const nextScheduledAt = formData.scheduled_at
        ? new Date(formData.scheduled_at).toISOString()
        : null;

      const scheduledAtChanged = (activity.scheduled_at || null) !== nextScheduledAt;

      const { error } = await supabase
        .from("crm_activities")
        .update({
          type: formData.type,
          title: formData.title,
          description: formData.description || null,
          scheduled_at: nextScheduledAt,
          ...(scheduledAtChanged ? { notified_at: null } : {}),
        })
        .eq("id", activity.id);

      if (error) throw error;

      toast.success("Atividade atualizada");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar atividade");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!activity) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("crm_activities")
        .delete()
        .eq("id", activity.id);

      if (error) throw error;

      toast.success("Atividade excluída");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir atividade");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Atividade</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Tipo</Label>
            <Select value={formData.type} onValueChange={(v) => setFormData(p => ({ ...p, type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACTIVITY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Título *</Label>
            <Input value={formData.title} onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))} />
          </div>
          <div>
            <Label>Data/Hora</Label>
            <Input type="datetime-local" value={formData.scheduled_at} onChange={(e) => setFormData(p => ({ ...p, scheduled_at: e.target.value }))} />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={formData.description} onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))} rows={3} />
          </div>
          <div className="flex justify-between">
            <Button type="button" variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Excluir
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
