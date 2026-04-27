import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { notifyCrmActivityViaWhatsApp } from "@/lib/crm/notifyActivityWhatsApp";
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

interface AddActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
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

export const AddActivityDialog = ({ open, onOpenChange, leadId, onSuccess }: AddActivityDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    type: "call",
    title: "",
    description: "",
    scheduled_at: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error("Título é obrigatório");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("id")
        .eq("user_id", user?.id)
        .single();

      // Interpreta input "datetime-local" como horário de Brasília (-03:00),
      // independente do fuso do navegador. Ex: "2026-04-28T09:15" → "2026-04-28T09:15:00-03:00"
      const scheduledIso = formData.scheduled_at ? `${formData.scheduled_at}:00-03:00` : null;

      const { error } = await supabase
        .from("crm_activities")
        .insert({
          lead_id: leadId,
          type: formData.type,
          title: formData.title,
          description: formData.description || null,
          scheduled_at: scheduledIso,
          responsible_staff_id: staff?.id,
          status: "pending",
        });

      if (error) throw error;

      // Send WhatsApp notification to responsible staff
      if (staff?.id) {
        const { data: leadData } = await supabase
          .from("crm_leads")
          .select("name")
          .eq("id", leadId)
          .maybeSingle();

        notifyCrmActivityViaWhatsApp({
          staffId: staff.id,
          leadId,
          leadName: leadData?.name || "Lead",
          activityTitle: formData.title,
          activityType: formData.type,
          scheduledAt: scheduledIso,
        });
      }

      toast.success("Atividade criada");
      onSuccess();
      onOpenChange(false);
      setFormData({ type: "call", title: "", description: "", scheduled_at: "" });
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar atividade");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Atividade</DialogTitle>
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
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
