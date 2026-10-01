// Conversa de um chamado de suporte do CRM (crm_support_tickets + crm_support_ticket_messages).
// Usada pelo widget (quem abriu) e pela aba Suporte das Configurações (time da UNV).
// Responder e encerrar passam pelas RPCs crm_support_ticket_reply / crm_support_ticket_close.
import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SupportTicket {
  id: string;
  staff_id: string;
  subject: string;
  message: string;
  page_url: string | null;
  status: "open" | "answered" | "closed";
  created_at: string;
  updated_at: string;
}

interface Mensagem {
  id: string;
  staff_id: string | null;
  from_support: boolean;
  body: string;
  created_at: string;
}

export const SUPPORT_STATUS: Record<string, { label: string; className: string }> = {
  open: { label: "Aguardando suporte", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  answered: { label: "Respondido", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  closed: { label: "Encerrado", className: "bg-muted text-muted-foreground" },
};

const dataHora = (iso: string) => format(new Date(iso), "dd/MM HH:mm", { locale: ptBR });

interface Props {
  ticket: SupportTicket;
  /** true na tela do time de suporte: as mensagens do suporte ficam do lado direito */
  viewerIsSupport: boolean;
  /** nome de quem abriu, mostrado pro suporte */
  authorName?: string | null;
  onChanged: () => void;
  compact?: boolean;
}

export function SupportTicketThread({ ticket, viewerIsSupport, authorName, onChanged, compact }: Props) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [encerrando, setEncerrando] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("crm_support_ticket_messages")
      .select("id, staff_id, from_support, body, created_at")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true });
    const linhas = (data as Mensagem[]) || [];
    setMensagens(linhas);
    const ids = [...new Set(linhas.filter((m) => m.from_support && m.staff_id).map((m) => m.staff_id as string))];
    if (ids.length) {
      const { data: staff } = await supabase.from("onboarding_staff").select("id, name").in("id", ids);
      setNomes(Object.fromEntries((staff || []).map((s: any) => [s.id, s.name])));
    }
  }, [ticket.id]);

  // recarrega ao abrir e a cada 20 s enquanto a conversa está na tela
  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 20000);
    return () => clearInterval(t);
  }, [carregar]);

  useEffect(() => { fimRef.current?.scrollIntoView({ block: "end" }); }, [mensagens.length]);

  const enviar = async () => {
    const corpo = texto.trim();
    if (!corpo) return;
    setEnviando(true);
    const { error } = await (supabase as any).rpc("crm_support_ticket_reply", { p_ticket_id: ticket.id, p_body: corpo });
    setEnviando(false);
    if (error) { toast.error(`Não consegui enviar: ${error.message}`); return; }
    setTexto("");
    await carregar();
    onChanged();
  };

  const encerrar = async () => {
    setEncerrando(true);
    const { error } = await (supabase as any).rpc("crm_support_ticket_close", { p_ticket_id: ticket.id });
    setEncerrando(false);
    if (error) { toast.error(`Não consegui encerrar: ${error.message}`); return; }
    toast.success("Chamado encerrado");
    onChanged();
  };

  const bolha = (id: string, doSuporte: boolean, autor: string, corpo: string, quando: string) => {
    const minha = doSuporte === viewerIsSupport;
    return (
      <div key={id} className={cn("flex", minha ? "justify-end" : "justify-start")}>
        <div className={cn("max-w-[85%] rounded-lg px-3 py-2 text-sm", minha ? "bg-primary/10 text-foreground" : "bg-muted text-foreground")}>
          <p className="text-[10px] text-muted-foreground mb-0.5">{autor} · {dataHora(quando)}</p>
          <p className="whitespace-pre-wrap break-words">{corpo}</p>
        </div>
      </div>
    );
  };

  const st = SUPPORT_STATUS[ticket.status] || SUPPORT_STATUS.open;
  const nomeAutor = viewerIsSupport ? (authorName || "Usuário") : "Você";

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="px-3 py-2 border-b border-border space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold leading-tight">{ticket.subject}</p>
          <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0", st.className)}>{st.label}</span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Aberto em {dataHora(ticket.created_at)}
          {viewerIsSupport && authorName ? ` por ${authorName}` : ""}
          {ticket.page_url ? ` · tela: ${ticket.page_url}` : ""}
        </p>
      </div>

      <div className={cn("flex-1 overflow-y-auto px-3 py-3 space-y-2", compact ? "min-h-[140px]" : "min-h-[220px]")}>
        {bolha("inicial", false, nomeAutor, ticket.message, ticket.created_at)}
        {mensagens.map((m) =>
          bolha(m.id, m.from_support, m.from_support ? (viewerIsSupport ? (m.staff_id && nomes[m.staff_id]) || "Suporte" : "Suporte UNV") : nomeAutor, m.body, m.created_at),
        )}
        <div ref={fimRef} />
      </div>

      <div className="border-t border-border p-3 space-y-2">
        {ticket.status === "closed" && (
          <p className="text-xs text-muted-foreground">Chamado encerrado. Se precisar, escreva de novo que ele reabre.</p>
        )}
        <Textarea
          rows={2}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={viewerIsSupport ? "Responder ao usuário" : "Escreva sua mensagem"}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) enviar(); }}
        />
        <div className="flex items-center justify-between gap-2">
          {ticket.status !== "closed" ? (
            <Button size="sm" variant="ghost" onClick={encerrar} disabled={encerrando}>
              {encerrando && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Encerrar chamado
            </Button>
          ) : <span />}
          <Button size="sm" onClick={enviar} disabled={enviando || !texto.trim()}>
            {enviando ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />}
            Enviar
          </Button>
        </div>
      </div>
    </div>
  );
}
