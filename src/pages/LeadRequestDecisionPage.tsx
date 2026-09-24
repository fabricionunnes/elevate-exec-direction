// Página do link "Pedido de lead" que chega no WhatsApp (24/09/2026).
// Fica no app porque o Supabase devolve qualquer HTML de edge function como texto puro.
// Abrir a página só CONSULTA; a transferência acontece no clique do botão (o WhatsApp
// abre o link sozinho pra gerar a pré-visualização).
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Loader2, ShieldQuestion, X } from "lucide-react";

type Dados = {
  lead?: { id: string; nome: string; empresa: string | null; funil: string | null; etapa: string | null };
  quem_pediu?: string | null;
  quem_decide?: string | null;
  link_lead?: string;
  status?: string;
  ja_respondido?: boolean;
  respondido_por?: string | null;
  feito_agora?: boolean;
  avisado?: boolean;
  erro?: string;
  detalhe?: string;
};

const ERRO_TEXTO: Record<string, string> = {
  link_invalido: "Esse link não parece certo. Abra o pedido de novo pelo WhatsApp.",
  nao_encontrado: "Não achei esse pedido. Ele pode ter sido apagado.",
  lead_nao_encontrado: "O lead desse pedido não existe mais.",
  falha_transferencia: "Não consegui transferir o lead.",
  falha: "Deu um erro aqui. Tente de novo em instantes.",
};

export default function LeadRequestDecisionPage() {
  const [params] = useSearchParams();
  const token = params.get("t") || "";
  const [dados, setDados] = useState<Dados | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState<"sim" | "nao" | null>(null);

  const chamar = useCallback(async (decisao?: "sim" | "nao") => {
    const { data, error } = await supabase.functions.invoke("crm-lead-decide", {
      body: decisao ? { token, decisao } : { token },
    });
    if (error) {
      let corpo: any = null;
      try { corpo = await (error as any).context?.json?.(); } catch { /* sem corpo */ }
      return (corpo || { erro: "falha" }) as Dados;
    }
    return (data || {}) as Dados;
  }, [token]);

  useEffect(() => {
    if (!token) { setDados({ erro: "link_invalido" }); setCarregando(false); return; }
    (async () => { setDados(await chamar()); setCarregando(false); })();
  }, [token, chamar]);

  const decidir = async (decisao: "sim" | "nao") => {
    setEnviando(decisao);
    setDados(await chamar(decisao));
    setEnviando(null);
  };

  const l = dados?.lead;
  const aceito = dados?.status === "accepted";
  const recusado = dados?.status === "declined";

  return (
    <div className="min-h-screen bg-muted/40 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          {carregando ? (
            <div className="py-10 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin inline mr-2" />Abrindo o pedido...
            </div>
          ) : dados?.erro ? (
            <>
              <h1 className="text-lg font-semibold">Não deu pra abrir</h1>
              <p className="text-sm text-muted-foreground mt-2">{ERRO_TEXTO[dados.erro] || ERRO_TEXTO.falha}</p>
              {dados.detalhe && <p className="text-xs text-muted-foreground mt-1">{dados.detalhe}</p>}
            </>
          ) : (
            <>
              <div className="flex items-start gap-2">
                {aceito ? <Check className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
                  : recusado ? <X className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                  : <ShieldQuestion className="h-5 w-5 text-primary mt-0.5 shrink-0" />}
                <div>
                  <h1 className="text-lg font-semibold leading-tight">
                    {dados?.feito_agora && aceito ? "Pronto, lead transferido"
                      : dados?.feito_agora && recusado ? "Pedido recusado"
                      : dados?.ja_respondido && aceito ? "Esse pedido já foi aceito"
                      : dados?.ja_respondido && recusado ? "Esse pedido já foi recusado"
                      : "Pedido de lead"}
                  </h1>
                  {!dados?.ja_respondido && !dados?.feito_agora && (
                    <p className="text-sm text-muted-foreground">{dados?.quem_pediu || "Alguém"} pediu acesso a este lead.</p>
                  )}
                </div>
              </div>

              <div className="rounded-lg bg-muted/60 p-3 mt-4 text-sm">
                <p className="font-medium">{l?.nome}{l?.empresa ? <span className="font-normal text-muted-foreground"> · {l.empresa}</span> : null}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Funil: {l?.funil || "—"}{l?.etapa ? ` · ${l.etapa}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">Pedido de: <span className="text-foreground font-medium">{dados?.quem_pediu || "—"}</span></p>
              </div>

              {dados?.ja_respondido && (
                <p className="text-xs text-muted-foreground mt-3">Respondido por {dados.respondido_por || "alguém do time"}.</p>
              )}
              {dados?.feito_agora && aceito && (
                <p className="text-sm text-muted-foreground mt-3">
                  Agora o lead está com {dados.quem_pediu}
                  {dados.avisado
                    ? ", e ele já recebeu no WhatsApp o aviso com o link do lead."
                    : ". Não consegui avisar no WhatsApp, fale com ele."}
                </p>
              )}
              {dados?.feito_agora && recusado && (
                <p className="text-sm text-muted-foreground mt-3">
                  O lead continua com quem estava.{dados.avisado ? ` ${dados.quem_pediu} foi avisado no WhatsApp.` : ""}
                </p>
              )}

              {!dados?.ja_respondido && !dados?.feito_agora ? (
                <>
                  <p className="text-xs text-muted-foreground mt-3">
                    Se você aceitar, o lead passa para o nome de {dados?.quem_pediu || "quem pediu"} na hora.
                  </p>
                  <Button className="w-full mt-4 h-12 text-base" onClick={() => decidir("sim")} disabled={!!enviando}>
                    {enviando === "sim" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                    Aceitar e transferir
                  </Button>
                  <Button variant="outline" className="w-full mt-2 h-12 text-base text-destructive" onClick={() => decidir("nao")} disabled={!!enviando}>
                    {enviando === "nao" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <X className="h-4 w-4 mr-2" />}
                    Recusar
                  </Button>
                </>
              ) : (
                <Button asChild className="w-full mt-4 h-12 text-base">
                  <a href={dados?.link_lead || "#"}>Abrir o lead</a>
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
