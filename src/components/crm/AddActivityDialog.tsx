import { useEffect, useState } from "react";
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
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useActivityTypes } from "@/hooks/useActivityTypes";
import { LeadPicker, PickedLead } from "@/components/crm/activities/LeadPicker";
import { GoogleAgendaOption } from "@/components/crm/activities/GoogleAgendaOption";
import { createActivityEvent } from "@/lib/crm/activityGoogleSync";
import { getPublicBaseUrl } from "@/lib/publicDomain";

interface AddActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** sem lead (botão da tela de Atividades, clique no calendário): o diálogo pede o lead */
  leadId?: string;
  onSuccess: () => void;
  /** data e hora já preenchidas, "yyyy-MM-ddTHH:mm" em horário de Brasília (clique num dia do calendário) */
  dataPadrao?: string;
  /** Tarefa obrigatória: exige data/hora, esconde o Cancelar e explica o porquê. */
  exigirDataHora?: boolean;
  tituloDialogo?: string;
  aviso?: string;
  tipoPadrao?: string;
  tituloPadrao?: string;
}


// Papéis que podem atribuir a tarefa a outro usuário
const ASSIGN_ROLES = ["master", "admin", "head_comercial"];

export const AddActivityDialog = ({
  open, onOpenChange, leadId, onSuccess,
  exigirDataHora = false, tituloDialogo, aviso, tipoPadrao, tituloPadrao, dataPadrao,
}: AddActivityDialogProps) => {
  const [loading, setLoading] = useState(false);
  // Tipos configuráveis (crm_activity_types), com a lista fixa de reserva.
  const { types: activityTypes } = useActivityTypes();
  const [formData, setFormData] = useState({
    type: tipoPadrao || "call",
    title: tituloPadrao || "",
    description: "",
    scheduled_at: dataPadrao || "",
  });
  // Lead escolhido aqui, quando o diálogo abre sem lead
  const [pickedLead, setPickedLead] = useState<PickedLead | null>(null);
  // "Enviar pra minha agenda Google" (só com data e hora)
  const [sendGoogle, setSendGoogle] = useState(false);

  // Abriu de novo (outro dia do calendário): começa com a data clicada
  useEffect(() => {
    if (!open) return;
    setFormData((p) => ({ ...p, scheduled_at: dataPadrao || "" }));
    setPickedLead(null);
    setSendGoogle(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dataPadrao]);

  // Responsável pela atividade (admin/master/head podem escolher outro usuário)
  const [myStaffId, setMyStaffId] = useState<string | null>(null);
  const [canAssign, setCanAssign] = useState(false);
  const [staffOptions, setStaffOptions] = useState<{ id: string; name: string }[]>([]);
  const [responsibleId, setResponsibleId] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("id, role")
        .eq("user_id", user?.id)
        .single();
      if (!active || !staff) return;
      setMyStaffId(staff.id);
      setResponsibleId(staff.id);
      const allowed = ASSIGN_ROLES.includes(staff.role);
      setCanAssign(allowed);
      if (allowed) {
        const { data: list } = await supabase
          .from("onboarding_staff")
          .select("id, name")
          .eq("is_active", true)
          .in("role", ["master", "admin", "head_comercial", "closer", "sdr"])
          .order("name");
        if (active) setStaffOptions(list || []);
      }
    })();
    return () => { active = false; };
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error("Título é obrigatório");
      return;
    }
    if (exigirDataHora && !formData.scheduled_at) {
      toast.error("Coloque a data e a hora do follow-up");
      return;
    }
    const targetLeadId = leadId || pickedLead?.id;
    if (!targetLeadId) {
      toast.error("Escolha o lead da atividade");
      return;
    }

    setLoading(true);
    try {
      const assignedTo = (canAssign && responsibleId) ? responsibleId : myStaffId;

      // Interpreta input "datetime-local" como horário de Brasília (-03:00),
      // independente do fuso do navegador. Ex: "2026-04-28T09:15" → "2026-04-28T09:15:00-03:00"
      const scheduledIso = formData.scheduled_at ? `${formData.scheduled_at}:00-03:00` : null;

      const { data: created, error } = await supabase
        .from("crm_activities")
        .insert({
          lead_id: targetLeadId,
          type: formData.type,
          title: formData.title,
          description: formData.description || null,
          scheduled_at: scheduledIso,
          responsible_staff_id: assignedTo,
          created_by: myStaffId,
          status: "pending",
        })
        .select("id")
        .single();

      if (error) throw error;

      const { data: leadData } = await supabase
        .from("crm_leads")
        .select("name")
        .eq("id", targetLeadId)
        .maybeSingle();

      // Google Agenda de quem está criando: evento no horário da atividade
      if (sendGoogle && formData.scheduled_at && created?.id) {
        const ev = await createActivityEvent({
          title: `${formData.title}${leadData?.name ? ` (${leadData.name})` : ""}`,
          description: [formData.description, `Lead no CRM: ${getPublicBaseUrl()}/#/crm/leads/${targetLeadId}`].filter(Boolean).join("\n\n"),
          startLocal: formData.scheduled_at,
        });
        if (ev.ok && ev.data) {
          await supabase.from("crm_activities").update({
            google_calendar_event_id: ev.data.eventId,
            google_calendar_user_id: ev.data.userId,
            ...(formData.type === "meeting" && ev.data.meetingLink ? { meeting_link: ev.data.meetingLink } : {}),
          } as any).eq("id", created.id);
        } else {
          toast.error(ev.needsAuth
            ? "A atividade foi criada, mas não foi pra agenda: reconecte o Google em CRM, Escritório"
            : `A atividade foi criada, mas não foi pra agenda Google: ${ev.error || "erro desconhecido"}`);
        }
      }

      // Notifica no WhatsApp o responsável pela atividade
      if (assignedTo) {
        notifyCrmActivityViaWhatsApp({
          staffId: assignedTo,
          leadId: targetLeadId,
          leadName: leadData?.name || "Lead",
          activityTitle: formData.title,
          activityType: formData.type,
          scheduledAt: scheduledIso,
        });
      }

      toast.success("Atividade criada");
      onSuccess();
      onOpenChange(false);
      setFormData({ type: tipoPadrao || "call", title: tituloPadrao || "", description: "", scheduled_at: "" });
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
          <DialogTitle>{tituloDialogo || "Nova Atividade"}</DialogTitle>
        </DialogHeader>
        {aviso && (
          <p className="text-sm text-muted-foreground border-l-2 border-primary pl-3">{aviso}</p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          {!leadId && (
            <div>
              <Label>Lead *</Label>
              <LeadPicker value={pickedLead} onChange={setPickedLead} />
            </div>
          )}
          <div>
            <Label>Tipo</Label>
            <SearchableSelect
              value={formData.type}
              onValueChange={(v) => setFormData(p => ({ ...p, type: v }))}
              options={(activityTypes.some(t => t.value === formData.type) ? activityTypes : [...activityTypes, { value: formData.type, label: formData.type }])
                .map(t => ({ value: t.value, label: t.label }))}
              placeholder="Tipo da atividade"
              emptyMessage="Nenhum tipo com esse nome."
            />
          </div>
          {canAssign && (
            <div>
              <Label>Responsável</Label>
              <SearchableSelect
                value={responsibleId}
                onValueChange={setResponsibleId}
                options={staffOptions.map((s) => ({ value: s.id, label: s.id === myStaffId ? `${s.name} (você)` : s.name }))}
                placeholder="Selecionar responsável"
                emptyMessage="Ninguém com esse nome."
              />
            </div>
          )}
          <div>
            <Label>Título *</Label>
            <Input value={formData.title} onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))} />
          </div>
          <div>
            <Label>Data/Hora{exigirDataHora ? " *" : ""}</Label>
            <Input type="datetime-local" step={900} required={exigirDataHora}
              min={exigirDataHora ? new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : undefined}
              value={formData.scheduled_at} onChange={(e) => setFormData(p => ({ ...p, scheduled_at: e.target.value }))} />
          </div>
          <GoogleAgendaOption
            id="add-activity-google"
            checked={sendGoogle}
            onCheckedChange={setSendGoogle}
            hasDateTime={!!formData.scheduled_at}
            disabled={loading}
          />
          <div>
            <Label>Descrição</Label>
            <Textarea value={formData.description} onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))} rows={3} />
          </div>
          <div className="flex justify-end gap-2">
            {!exigirDataHora && (
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            )}
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
