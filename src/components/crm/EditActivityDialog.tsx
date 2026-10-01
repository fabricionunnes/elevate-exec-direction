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
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useActivityTypes } from "@/hooks/useActivityTypes";
import { GoogleAgendaOption } from "@/components/crm/activities/GoogleAgendaOption";
import {
  createActivityEvent, deleteActivityEvent, isoToBrasiliaLocal, moveActivityEvent, updateActivityEvent,
} from "@/lib/crm/activityGoogleSync";
import { getPublicBaseUrl } from "@/lib/publicDomain";

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


export const EditActivityDialog = ({ open, onOpenChange, activity, onSuccess }: EditActivityDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Tipos configuráveis (crm_activity_types); o tipo atual entra na lista mesmo se inativo.
  const { types: activityTypes, labelOf } = useActivityTypes();
  const [formData, setFormData] = useState({
    type: "call",
    title: "",
    description: "",
    scheduled_at: "",
  });
  // Evento do Google ligado à atividade (lido do banco ao abrir: quem chama o diálogo
  // nem sempre manda essas colunas)
  const [gcal, setGcal] = useState<{ eventId: string | null; userId: string | null; leadId: string | null; meetingLink: string | null }>(
    { eventId: null, userId: null, leadId: null, meetingLink: null },
  );
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [keepGoogle, setKeepGoogle] = useState(false);

  useEffect(() => {
    if (!open || !activity) return;
    let vivo = true;
    setGcal({ eventId: null, userId: null, leadId: null, meetingLink: null });
    setKeepGoogle(false);
    (async () => {
      const [{ data: row }, { data: auth }] = await Promise.all([
        supabase.from("crm_activities")
          .select("google_calendar_event_id, google_calendar_user_id, lead_id, meeting_link")
          .eq("id", activity.id).maybeSingle(),
        supabase.auth.getUser(),
      ]);
      if (!vivo) return;
      const r = (row || {}) as any;
      setGcal({ eventId: r.google_calendar_event_id || null, userId: r.google_calendar_user_id || null, leadId: r.lead_id || null, meetingLink: r.meeting_link || null });
      setKeepGoogle(!!r.google_calendar_event_id);
      setMyUserId(auth.user?.id || null);
    })();
    return () => { vivo = false; };
  }, [open, activity]);

  useEffect(() => {
    if (activity) {
      setFormData({
        type: activity.type,
        title: activity.title,
        description: activity.description || "",
        // Exibe sempre no fuso de Brasília (-03:00), independente do fuso do navegador
        scheduled_at: activity.scheduled_at ? isoToBrasiliaLocal(activity.scheduled_at) : "",
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
      // Interpreta o input como horário de Brasília (-03:00), independente do fuso do navegador
      const nextScheduledAt = formData.scheduled_at
        ? new Date(`${formData.scheduled_at}:00-03:00`).toISOString()
        : null;

      const scheduledAtChanged =
        (activity.scheduled_at ? new Date(activity.scheduled_at).toISOString() : null) !== nextScheduledAt;

      // Google Agenda: o que muda no evento ligado a esta atividade
      const gPatch: Record<string, string | null> = {};
      let gAviso: string | null = null;
      const wantGoogle = keepGoogle && !!nextScheduledAt;
      const textChanged = formData.title !== activity.title || (formData.description || "") !== (activity.description || "");
      if (gcal.eventId && !wantGoogle) {
        // desmarcou (ou tirou a data): o evento sai da agenda
        const res = await deleteActivityEvent(gcal.eventId, gcal.userId);
        if (res.ok) { gPatch.google_calendar_event_id = null; gPatch.google_calendar_user_id = null; }
        else gAviso = res.needsAuth ? "não consegui tirar o evento: reconecte o Google em CRM, Escritório" : `não consegui tirar o evento do Google: ${res.error || "erro"}`;
      } else if (gcal.eventId && wantGoogle && (scheduledAtChanged || textChanged)) {
        // Reunião com Meet e convidados: só move o horário (regravar o evento apagaria os dois).
        // Demais atividades: regrava título, descrição e horário.
        const isMeetingWithLink = (formData.type === "meeting" || activity.type === "meeting") && !!gcal.meetingLink;
        const res = isMeetingWithLink
          ? (scheduledAtChanged ? await moveActivityEvent(gcal.eventId, nextScheduledAt!, gcal.userId) : { ok: true })
          : await updateActivityEvent(gcal.eventId, {
              title: formData.title,
              description: [formData.description, gcal.leadId ? `Lead no CRM: ${getPublicBaseUrl()}/#/crm/leads/${gcal.leadId}` : ""].filter(Boolean).join("\n\n"),
              startLocal: formData.scheduled_at,
            }, gcal.userId);
        if (!res.ok) gAviso = (res as any).needsAuth ? "o evento do Google não foi atualizado: reconecte o Google em CRM, Escritório" : `o evento do Google não foi atualizado: ${(res as any).error || "erro"}`;
      } else if (!gcal.eventId && wantGoogle) {
        const res = await createActivityEvent({
          title: formData.title,
          description: [formData.description, gcal.leadId ? `Lead no CRM: ${getPublicBaseUrl()}/#/crm/leads/${gcal.leadId}` : ""].filter(Boolean).join("\n\n"),
          startLocal: formData.scheduled_at,
        });
        if (res.ok && res.data) { gPatch.google_calendar_event_id = res.data.eventId; gPatch.google_calendar_user_id = res.data.userId; }
        else gAviso = res.needsAuth ? "não foi pra agenda: reconecte o Google em CRM, Escritório" : `não foi pra agenda Google: ${res.error || "erro"}`;
      }

      const { error } = await supabase
        .from("crm_activities")
        .update({
          type: formData.type,
          title: formData.title,
          description: formData.description || null,
          scheduled_at: nextScheduledAt,
          ...(scheduledAtChanged ? { notified_at: null } : {}),
          ...gPatch,
        } as any)
        .eq("id", activity.id);

      if (error) throw error;

      if (gAviso) toast.error(`Atividade salva, mas ${gAviso}`);
      else toast.success("Atividade atualizada");
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
      // tira antes o evento da agenda Google, senão ele fica órfão lá
      if (gcal.eventId) {
        const res = await deleteActivityEvent(gcal.eventId, gcal.userId);
        if (!res.ok) toast.error("O evento continua na agenda Google: apague por lá" + (res.needsAuth ? " ou reconecte o Google em CRM, Escritório" : ""));
      }
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
            <SearchableSelect
              value={formData.type}
              onValueChange={(v) => setFormData(p => ({ ...p, type: v }))}
              options={(activityTypes.some(t => t.value === formData.type) ? activityTypes : [...activityTypes, { value: formData.type, label: labelOf(formData.type) }])
                .map(t => ({ value: t.value, label: t.label }))}
              placeholder="Tipo da atividade"
              emptyMessage="Nenhum tipo com esse nome."
            />
          </div>
          <div>
            <Label>Título *</Label>
            <Input value={formData.title} onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))} />
          </div>
          <div>
            <Label>Data/Hora</Label>
            <Input type="datetime-local" step={900} value={formData.scheduled_at} onChange={(e) => setFormData(p => ({ ...p, scheduled_at: e.target.value }))} />
          </div>
          <GoogleAgendaOption
            id="edit-activity-google"
            checked={keepGoogle}
            onCheckedChange={setKeepGoogle}
            hasDateTime={!!formData.scheduled_at}
            hasEvent={!!gcal.eventId}
            onOtherCalendar={!!gcal.eventId && !!gcal.userId && !!myUserId && gcal.userId !== myUserId}
            disabled={loading || deleting}
          />
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
