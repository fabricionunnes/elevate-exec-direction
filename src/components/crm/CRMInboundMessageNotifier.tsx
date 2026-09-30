// Aviso de mensagem recebida no WhatsApp (toast + som) pra quem está em qualquer
// tela do CRM. É o emissor da preferência "Novas mensagens" do Atendimento:
// - só avisa conversas atribuídas a mim (admin/master/head também as sem dono);
// - respeita a janela de horário e o som das preferências;
// - agrupa: no máximo um aviso por conversa a cada group_minutes;
// - não avisa a conversa que já está aberta na tela de Atendimento.
import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { playNotificationSound } from "@/lib/notificationSound";
import { isWithinNotifyWindow, useCrmNotificationPrefs } from "@/hooks/useCrmNotificationPrefs";

interface Props {
  staffId: string | null;
  isAdmin: boolean;
  isMaster?: boolean;
}

export const CRMInboundMessageNotifier = ({ staffId, isAdmin, isMaster = false }: Props) => {
  const prefs = useCrmNotificationPrefs(staffId);
  const prefsRef = useRef(prefs);
  useEffect(() => { prefsRef.current = prefs; }, [prefs]);

  const location = useLocation();
  const locRef = useRef(location);
  useEffect(() => { locRef.current = location; }, [location]);
  const navigate = useNavigate();

  // conversa -> instante do último aviso (agrupamento)
  const lastNotified = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!staffId) return;
    const channel = supabase
      .channel(`crm-inbound-notifier-${staffId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "crm_whatsapp_messages", filter: "direction=eq.inbound" },
        async (payload) => {
          const msg = payload.new as { id: string; conversation_id: string; content: string | null; type: string | null; created_at: string };
          const p = prefsRef.current;
          if (!p.notify_new_message) return;
          if (!isWithinNotifyWindow(p)) return;

          // conversa aberta na tela de Atendimento: o próprio chat já mostra
          const loc = locRef.current;
          if (loc.pathname.includes("/crm/inbox")) {
            const aberta = new URLSearchParams(loc.search).get("conversation");
            if (aberta === msg.conversation_id) return;
          }

          // agrupamento por conversa
          const now = Date.now();
          const last = lastNotified.current.get(msg.conversation_id) || 0;
          if (now - last < p.group_minutes * 60_000) return;

          const { data: conv } = await supabase
            .from("crm_whatsapp_conversations")
            .select("id, assigned_to, instance_id, official_instance_id, contact:crm_whatsapp_contacts(name, phone), instance:whatsapp_instances(show_in_inbox), official:whatsapp_official_instances(show_in_inbox)")
            .eq("id", msg.conversation_id)
            .maybeSingle();
          if (!conv) return;
          // Mesma regra de visibilidade do Atendimento: número com "Visível no
          // Atendimento" desligado não avisa ninguém (nem master), e quem não é
          // master só recebe das instâncias a que tem acesso.
          const c: any = conv;
          const oficial = !!c.official_instance_id && !c.instance_id;
          const visivel = oficial ? c.official?.show_in_inbox : c.instance_id ? c.instance?.show_in_inbox : isAdmin;
          if (!visivel) return;
          if (!isMaster && (c.instance_id || c.official_instance_id)) {
            const tabela = oficial ? "whatsapp_official_instance_access" : "whatsapp_instance_access";
            const instId = oficial ? c.official_instance_id : c.instance_id;
            const { data: acesso } = await (supabase as any).from(tabela).select("id").eq("staff_id", staffId).eq("instance_id", instId).eq("can_view", true).limit(1);
            if (!acesso?.length) return;
          }
          const minha = conv.assigned_to === staffId;
          const semDono = !conv.assigned_to;
          if (!minha && !(semDono && isAdmin)) return;

          lastNotified.current.set(msg.conversation_id, now);
          const contato = (conv as any).contact?.name || (conv as any).contact?.phone || "Contato";
          const preview = msg.type && msg.type !== "text"
            ? `Enviou ${msg.type === "image" ? "uma imagem" : msg.type === "audio" ? "um áudio" : msg.type === "document" ? "um documento" : "uma mídia"}`
            : (msg.content || "").slice(0, 120);
          toast.info(`Nova mensagem de ${contato}${semDono ? " (sem responsável)" : ""}`, {
            description: preview,
            duration: 8000,
            action: { label: "Abrir", onClick: () => navigate(`/crm/inbox?conversation=${msg.conversation_id}`) },
          });
          if (p.notify_sound) playNotificationSound();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [staffId, isAdmin, isMaster, navigate]);

  return null;
};
