import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Target, Loader2, RefreshCw, Lightbulb, User, TrendingUp } from "lucide-react";
import { toast } from "sonner";

// Botão em destaque + painel "Estratégia pra Bater a Meta".
// O nível (gestão/closer/SDR) é decidido no servidor pelo papel de quem chama —
// cada um vê o plano da sua alçada, com dados reais do CRM. Cache diário.

interface Strategy {
  resumo?: string;
  gap?: { meta?: number; realizado?: number; falta?: number; dias_uteis?: number; cenario_realista?: string };
  estrategias?: { titulo: string; como_executar: string; embasamento?: string; impacto_estimado?: string; prioridade?: number }[];
  por_pessoa?: { nome: string; papel?: string; meta?: string | number; realizado?: string | number; plano?: string[] }[];
}

const brl = (v?: number) => v == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
const LEVEL_LABEL: Record<string, string> = { gestao: "Visão Gestão", closer: "Seu plano (Closer)", sdr: "Seu plano (SDR)" };

export function CRMGoalStrategyDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [level, setLevel] = useState<string>("");
  const [generatedAt, setGeneratedAt] = useState<string>("");
  const [strategy, setStrategy] = useState<Strategy | null>(null);

  const load = async (force = false) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("crm-goal-strategy", { body: { force } });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      setStrategy(data.strategy); setLevel(data.level); setGeneratedAt(data.generated_at);
    } catch (e: any) {
      toast.error(e.message || "Não consegui montar a estratégia");
    } finally { setLoading(false); }
  };

  const onOpenChange = (o: boolean) => {
    setOpen(o);
    if (o && !strategy) load(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2 text-white shadow-md hover:shadow-lg transition-all"
          style={{ background: "linear-gradient(135deg, #7c3aed, #db2777)" }}>
          <Target className="h-4 w-4" /> Estratégia da Meta
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <Target className="h-5 w-5 text-primary" /> Estratégia pra Bater a Meta
            {level && <Badge variant="secondary" className="text-[11px]">{LEVEL_LABEL[level] || level}</Badge>}
            {generatedAt && <span className="text-[11px] font-normal text-muted-foreground">gerada {new Date(generatedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>}
            <Button variant="ghost" size="sm" className="ml-auto gap-1.5 text-xs" disabled={loading} onClick={() => load(true)}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar análise
            </Button>
          </DialogTitle>
        </DialogHeader>

        {loading && !strategy ? (
          <div className="py-16 text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Analisando metas, leads, calls e contratos do CRM…</p>
          </div>
        ) : !strategy ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Sem análise ainda. Clique em "Atualizar análise".</p>
        ) : (
          <div className="space-y-5">
            {strategy.resumo && <p className="text-sm leading-relaxed border-l-2 border-primary pl-3">{strategy.resumo}</p>}

            {strategy.gap && (
              <div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { l: "Meta", v: brl(strategy.gap.meta) },
                    { l: "Realizado", v: brl(strategy.gap.realizado), cls: "text-emerald-500" },
                    { l: "Falta", v: brl(strategy.gap.falta), cls: "text-amber-500" },
                    { l: "Dias úteis", v: String(strategy.gap.dias_uteis ?? "—") },
                  ].map(c => (
                    <div key={c.l} className="rounded-lg border border-border p-2.5 text-center">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{c.l}</div>
                      <div className={`text-base font-bold ${c.cls || ""}`}>{c.v}</div>
                    </div>
                  ))}
                </div>
                {strategy.gap.cenario_realista && (
                  <div className="mt-2 rounded-lg bg-muted/60 p-3 text-sm flex gap-2">
                    <TrendingUp className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span><b>Cenário realista:</b> {strategy.gap.cenario_realista}</span>
                  </div>
                )}
              </div>
            )}

            {!!strategy.estrategias?.length && (
              <div className="space-y-2.5">
                <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2"><Lightbulb className="h-4 w-4 text-amber-500" /> Estratégias (por prioridade)</h3>
                {strategy.estrategias.map((e, i) => (
                  <div key={i} className="rounded-xl border border-border p-3.5">
                    <div className="flex items-start gap-2">
                      <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-black flex items-center justify-center shrink-0">{e.prioridade ?? i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-sm">{e.titulo}</span>
                          {e.impacto_estimado && <Badge className="bg-emerald-500/15 text-emerald-500 border-0 text-[10px]">{e.impacto_estimado}</Badge>}
                        </div>
                        <p className="text-sm text-foreground/90 mt-1 whitespace-pre-wrap">{e.como_executar}</p>
                        {e.embasamento && <p className="text-[11px] text-muted-foreground mt-1.5 italic">Embasamento: {e.embasamento}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!!strategy.por_pessoa?.length && (
              <div className="space-y-2.5">
                <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2"><User className="h-4 w-4 text-blue-500" /> Plano por pessoa</h3>
                <div className="grid sm:grid-cols-2 gap-2.5">
                  {strategy.por_pessoa.map((p, i) => (
                    <div key={i} className="rounded-xl border border-border p-3.5">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="font-semibold text-sm">{p.nome}</span>
                        {p.papel && <Badge variant="outline" className="text-[10px]">{p.papel === "sdr" ? "SDR" : "Closer"}</Badge>}
                        <span className="ml-auto text-[11px] text-muted-foreground">{p.realizado} / {p.meta}</span>
                      </div>
                      <ul className="space-y-1">
                        {(p.plano || []).map((a, k) => (
                          <li key={k} className="text-[13px] flex gap-1.5"><span className="text-primary mt-1.5 h-1 w-1 rounded-full bg-primary shrink-0" />{a}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
