// Aba "Suporte" das Configurações do CRM: onde o time da UNV (master/admin) responde e
// encerra os chamados abertos pelo widget de ajuda. ?chamado=<id> abre direto na conversa
// (é o link que vai na notificação do sino).
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/crm/traffic/SearchableSelect";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { SupportTicketThread, SUPPORT_STATUS, type SupportTicket } from "@/components/crm/support/SupportTicketThread";

const FILTROS = [
  { value: "pendentes", label: "Em aberto (aguardando e respondidos)" },
  { value: "open", label: "Aguardando suporte" },
  { value: "answered", label: "Respondidos" },
  { value: "closed", label: "Encerrados" },
  { value: "todos", label: "Todos" },
];
const dataCurta = (iso: string) => format(new Date(iso), "dd/MM HH:mm", { locale: ptBR });

export function CRMSupportTicketsTab() {
  const [searchParams] = useSearchParams();
  const [filtro, setFiltro] = useState("pendentes");
  const [chamados, setChamados] = useState<SupportTicket[]>([]);
  const [autores, setAutores] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [atualId, setAtualId] = useState<string | null>(searchParams.get("chamado"));

  const carregar = useCallback(async () => {
    setCarregando(true);
    let q = (supabase as any)
      .from("crm_support_tickets")
      .select("id, staff_id, subject, message, page_url, status, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(100);
    if (filtro === "pendentes") q = q.in("status", ["open", "answered"]);
    else if (filtro !== "todos") q = q.eq("status", filtro);
    const { data, error } = await q;
    if (error) toast.error(`Não consegui carregar os chamados: ${error.message}`);
    let linhas = (data as SupportTicket[]) || [];

    // chamado do link pode estar fora do filtro (ex.: já encerrado): busca à parte
    const doLink = searchParams.get("chamado");
    if (doLink && !linhas.some((c) => c.id === doLink)) {
      const { data: um } = await (supabase as any)
        .from("crm_support_tickets")
        .select("id, staff_id, subject, message, page_url, status, created_at, updated_at")
        .eq("id", doLink)
        .maybeSingle();
      if (um) linhas = [um as SupportTicket, ...linhas];
    }
    setChamados(linhas);
    setCarregando(false);

    const ids = [...new Set(linhas.map((c) => c.staff_id))];
    if (ids.length) {
      const { data: staff } = await supabase.from("onboarding_staff").select("id, name").in("id", ids);
      setAutores(Object.fromEntries((staff || []).map((s: any) => [s.id, s.name])));
    }
  }, [filtro, searchParams]);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { const id = searchParams.get("chamado"); if (id) setAtualId(id); }, [searchParams]);

  const atual = useMemo(() => chamados.find((c) => c.id === atualId) || null, [chamados, atualId]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Chamados de suporte</CardTitle>
        <CardDescription>Abertos pelo botão de ajuda do CRM. Quem abriu é avisado no sino quando você responde.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <SearchableSelect className="sm:w-80" value={filtro} onChange={setFiltro} options={FILTROS} />
          <Button size="sm" variant="outline" className="h-9" onClick={carregar} disabled={carregando}>
            <RefreshCw className={cn("h-4 w-4 mr-1", carregando && "animate-spin")} />Atualizar
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3">
          <div className="rounded-md border border-border divide-y divide-border max-h-[560px] overflow-y-auto">
            {carregando && chamados.length === 0 ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : chamados.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4">Nenhum chamado neste filtro.</p>
            ) : chamados.map((c) => {
              const st = SUPPORT_STATUS[c.status] || SUPPORT_STATUS.open;
              return (
                <button key={c.id} type="button" onClick={() => setAtualId(c.id)}
                  className={cn("w-full text-left px-3 py-2.5 hover:bg-muted/60", atualId === c.id && "bg-muted")}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium leading-tight">{c.subject}</span>
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0", st.className)}>{st.label}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{autores[c.staff_id] || "Usuário"} · atualizado em {dataCurta(c.updated_at)}</p>
                </button>
              );
            })}
          </div>

          <div className="rounded-md border border-border h-[560px] flex flex-col">
            {atual ? (
              <SupportTicketThread key={atual.id} ticket={atual} viewerIsSupport authorName={autores[atual.staff_id]} onChanged={carregar} />
            ) : (
              <div className="flex-1 flex items-center justify-center p-6">
                <p className="text-sm text-muted-foreground text-center">Escolha um chamado na lista pra ver a conversa.</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
