// Painel de custo de IA (24/09/2026). Responde "onde foi parar o crédito da API":
// gasto por dia, por função e por modelo, com o teto do alerta no mesmo lugar.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw, Save, TriangleAlert } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

type Dados = {
  total: number; chamadas: number; hoje: number; ontem: number; mes: number;
  por_dia: { dia: string; custo: number; chamadas: number }[];
  por_fn: { nome: string; custo: number; chamadas: number; entrada: number; saida: number; cache_lido: number }[];
  por_modelo: { nome: string; custo: number; chamadas: number }[];
  config: { teto_usd: number; telefone: string } | null;
  precos: { familia: string; preco_entrada: number; preco_saida: number; observacao: string | null }[];
};

const CORES = ["#2a78d6", "#1baf7a", "#4a3aa7", "#eda100", "#eb6834", "#d4321c"];
const usd = (n: number) => `US$ ${(Number(n) || 0).toFixed(2)}`;
const num = (n: number) => (Number(n) || 0).toLocaleString("pt-BR");
const diaBR = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

export default function CustoIAPage() {
  const navigate = useNavigate();
  const [dias, setDias] = useState(30);
  const [dados, setDados] = useState<Dados | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [teto, setTeto] = useState("");
  const [salvando, setSalvando] = useState(false);

  const buscar = useCallback(async () => {
    setCarregando(true);
    const ate = new Date();
    const de = new Date(ate.getTime() - (dias - 1) * 86400000);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const { data, error } = await (supabase as any).rpc("ai_custos", { p_de: iso(de), p_ate: iso(ate) });
    if (error) { toast.error("Não consegui carregar o custo de IA"); setCarregando(false); return; }
    setDados(data as Dados);
    setTeto(String((data as Dados)?.config?.teto_usd ?? ""));
    setCarregando(false);
  }, [dias]);

  useEffect(() => { buscar(); }, [buscar]);

  const salvarTeto = async () => {
    const v = Number(String(teto).replace(",", "."));
    if (!v || v <= 0) { toast.error("Põe um valor maior que zero"); return; }
    setSalvando(true);
    const { error } = await (supabase as any).from("ai_usage_config").update({ teto_usd: v, updated_at: new Date().toISOString() }).eq("id", true);
    setSalvando(false);
    if (error) { toast.error("Não consegui salvar o teto"); return; }
    toast.success(`Teto ajustado para ${usd(v)} por dia`);
    buscar();
  };

  const media = useMemo(() => {
    const d = dados?.por_dia || [];
    if (!d.length) return 0;
    return d.reduce((s, x) => s + Number(x.custo || 0), 0) / d.length;
  }, [dados]);

  const tetoNum = Number(dados?.config?.teto_usd || 0);
  const opusAtivo = (dados?.por_modelo || []).some((m) => /opus/i.test(m.nome) && Number(m.custo) > 0);

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-semibold">Custo de IA</h1>
            <p className="text-sm text-muted-foreground">Quanto os agentes consumiram da API, por dia, por função e por modelo.</p>
          </div>
          <Button variant="outline" size="sm" onClick={buscar} disabled={carregando}>
            <RefreshCw className={`h-4 w-4 mr-1 ${carregando ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>

        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <Button key={d} size="sm" variant={dias === d ? "default" : "outline"} onClick={() => setDias(d)}>
              {d} dias
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { rot: "Hoje", v: dados?.hoje ?? 0, destaque: (dados?.hoje ?? 0) >= tetoNum && tetoNum > 0 },
            { rot: "Ontem", v: dados?.ontem ?? 0 },
            { rot: "Mês", v: dados?.mes ?? 0 },
            { rot: `Período (${dias}d)`, v: dados?.total ?? 0 },
            { rot: "Média por dia", v: media },
          ].map((c) => (
            <Card key={c.rot}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{c.rot}</p>
                <p className={`text-xl font-bold ${c.destaque ? "text-destructive" : ""}`}>{usd(c.v)}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Gasto por dia</CardTitle>
          </CardHeader>
          <CardContent>
            {(dados?.por_dia || []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Nada registrado no período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={(dados?.por_dia || []).map((d) => ({ ...d, label: diaBR(d.dia) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    formatter={(v: any, n: any) => (n === "custo" ? [usd(Number(v)), "Custo"] : [num(Number(v)), "Chamadas"])}
                    labelFormatter={(l) => `Dia ${l}`}
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="custo" radius={[4, 4, 0, 0]}>
                    {(dados?.por_dia || []).map((d, i) => (
                      <Cell key={i} fill={tetoNum > 0 && Number(d.custo) >= tetoNum ? "#d4321c" : "#2a78d6"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
            {tetoNum > 0 && (
              <p className="text-xs text-muted-foreground mt-2">Barra vermelha é dia que passou do teto de {usd(tetoNum)}.</p>
            )}
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Onde gastou</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(dados?.por_fn || []).length === 0 && <p className="text-sm text-muted-foreground">Sem dados.</p>}
              {(dados?.por_fn || []).map((f, i) => {
                const pct = dados?.total ? (Number(f.custo) / Number(dados.total)) * 100 : 0;
                return (
                  <div key={f.nome} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium truncate">{f.nome}</span>
                      <span className="font-semibold shrink-0">{usd(f.custo)}</span>
                    </div>
                    <div className="h-1.5 rounded bg-muted overflow-hidden">
                      <div className="h-full rounded" style={{ width: `${Math.max(2, pct)}%`, background: CORES[i % CORES.length] }} />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {num(f.chamadas)} chamadas · entrada {num(f.entrada)} · saída {num(f.saida)} · cache {num(f.cache_lido)}
                    </p>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Por modelo</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(dados?.por_modelo || []).length === 0 && <p className="text-sm text-muted-foreground">Sem dados.</p>}
              {(dados?.por_modelo || []).map((m, i) => (
                <div key={m.nome} className="flex items-center justify-between gap-2 text-sm border-b border-border/40 last:border-0 py-1.5">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: CORES[i % CORES.length] }} />
                    <span className="truncate">{m.nome}</span>
                  </span>
                  <span className="shrink-0">
                    <span className="font-semibold">{usd(m.custo)}</span>
                    <span className="text-muted-foreground text-xs ml-2">{num(m.chamadas)}x</span>
                  </span>
                </div>
              ))}
              {opusAtivo && (
                <p className="text-xs text-amber-600 flex items-start gap-1 pt-2">
                  <TriangleAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  Tem Opus rodando. É o modelo mais caro, use só onde faz diferença.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Teto e alerta</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Teto por dia, em dólar</p>
                <Input value={teto} onChange={(e) => setTeto(e.target.value)} className="w-32" inputMode="decimal" />
              </div>
              <Button size="sm" onClick={salvarTeto} disabled={salvando}>
                <Save className="h-4 w-4 mr-1" /> Salvar
              </Button>
              <p className="text-xs text-muted-foreground">
                Passou do teto, chega aviso no WhatsApp {dados?.config?.telefone ? `(${dados.config.telefone})` : ""}. Todo dia às 20h vai o fechamento.
              </p>
            </div>
            <div className="pt-2 border-t border-border/40">
              <p className="text-xs text-muted-foreground mb-2">Preço usado na conta, por milhão de tokens:</p>
              <div className="flex flex-wrap gap-2">
                {(dados?.precos || []).map((p) => (
                  <Badge key={p.familia} variant="outline" className="text-[11px]">
                    {p.familia}: entrada {p.preco_entrada} · saída {p.preco_saida}
                    {p.observacao?.toUpperCase().includes("ESTIMATIVA") ? " (estimado)" : ""}
                  </Badge>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                O número da fatura do console é o oficial. Se divergir, é só corrigir o preço aqui que todo o histórico recalcula.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
