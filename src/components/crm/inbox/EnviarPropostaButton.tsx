// Botão "Enviar proposta" (Fabrício, 06/11/2026): manda pro cliente o PDF da proposta MAIS RECENTE
// gerada no lead (crm_lead_proposals), com a mensagem "Segue a proposta conforme combinado.".
// Usado no Atendimento e na conversa dentro do lead; quem usa passa a função de envio de mídia
// da própria tela (mesmo número/instância da conversa).
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const MENSAGEM_PROPOSTA = "Segue a proposta conforme combinado.";

type Props = {
  leadId: string | null | undefined;
  /** envia o arquivo como documento com a legenda; devolve false (ou lança) se não enviou */
  onEnviar: (file: File, caption: string) => Promise<boolean | void>;
  disabled?: boolean;
  /** só o ícone (telas estreitas) */
  compacto?: boolean;
};

export function EnviarPropostaButton({ leadId, onEnviar, disabled, compacto }: Props) {
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    if (!leadId) { toast.error("Essa conversa não tem negócio vinculado, então não há proposta pra enviar."); return; }
    setEnviando(true);
    try {
      // sempre a última gerada no sistema
      const { data: prop, error } = await (supabase as any)
        .from("crm_lead_proposals")
        .select("id, title, file_url, created_at")
        .eq("lead_id", leadId)
        .not("file_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!prop?.file_url) { toast.error("Esse lead ainda não tem proposta gerada. Gere na aba Proposta do lead."); return; }
      const quando = format(new Date(prop.created_at), "dd/MM 'às' HH:mm", { locale: ptBR });
      if (!window.confirm(`Enviar "${prop.title || "Proposta"}" (gerada em ${quando}) pro cliente, com a mensagem "${MENSAGEM_PROPOSTA}"?`)) return;

      const resp = await fetch(prop.file_url);
      if (!resp.ok) throw new Error("Não consegui baixar o PDF da proposta");
      const blob = await resp.blob();
      const nome = `${String(prop.title || "Proposta UNV").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim()}.pdf`;
      const file = new File([blob], nome, { type: "application/pdf" });

      const ok = await onEnviar(file, MENSAGEM_PROPOSTA);
      if (ok !== false) toast.success("Proposta enviada");
    } catch (e) {
      toast.error((e as Error).message || "Erro ao enviar a proposta");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size={compacto ? "icon" : "default"}
      className="shrink-0 gap-2"
      onClick={enviar}
      disabled={disabled || enviando || !leadId}
      title={leadId ? "Enviar a última proposta gerada deste lead, com a mensagem padrão" : "Conversa sem negócio vinculado"}
    >
      {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
      {!compacto && <span className="hidden sm:inline">Enviar proposta</span>}
    </Button>
  );
}
