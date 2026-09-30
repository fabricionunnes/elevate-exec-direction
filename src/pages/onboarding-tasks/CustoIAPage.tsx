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
  config: { teto_usd: number; telefone: string; dolar: number; dolar_em: string | null } | null;
  precos: { familia: string; preco_entrada: number; preco_saida: number; observacao: string | null }[];
};

type WaNumero = { id: string; nome: string; telefone: string; status: string; preco_brl: number; hoje: number; ontem: number; mes: number; mes_ia: number; conversas_mes: number; periodo: number; por_dia: { dia: string; msgs: number }[] };
type WaDados = { teto_mes: number; preco_config: number | null; dias_mes: number; dia_mes: number; numeros: WaNumero[] };

const CORES = ["#2a78d6", "#1baf7a", "#4a3aa7", "#eda100", "#eb6834", "#d4321c"];
const usd = (n: number) => `US$ ${(Number(n) || 0).toFixed(2)}`;
const brl = (n: number) => `R$ ${(Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (n: number) => (Number(n) || 0).toLocaleString("pt-BR");
const diaBR = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

export default function CustoIAPage() {
  const navigate = useNavigate();
  const [dias, setDias] = useState(30);
  const [dados, setDados] = useState<Dados | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [teto, setTeto] = useState("");
  const [cotacao, setCotacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [wa, setWa] = useState<WaDados | null>(null);
  const [waTeto, setWaTeto] = useState("");

  const buscar = useCallback(async () => {
    setCarregando(true);
    const ate = new Date();
    const de = new Date(ate.getTime() - (dias - 1) * 86400000);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const { data, error } = await (supabase as any).rpc("ai_custos", { p_de: iso(de), p_ate: iso(ate) });
    if (error) { toast.error("Não consegui carregar o custo de IA"); setCarregando(false); return; }
    setDados(data as Dados);
    // WhatsApp API oficial: a Meta cobra por mensagem enviada (a partir de 01/10/2026)
    const { data: waD } = await (supabase as any).rpc("wa_oficial_custos", { p_de: iso(de), p_ate: iso(ate) });
    if (waD) { setWa(waD as WaDados); setWaTeto(String((waD as WaDados).teto_mes ?? "")); }
    setTeto(String((data as Dados)?.config?.teto_usd ?? ""));
    setCotacao(String((data as Dados)?.config?.dolar ?? ""));
    setCarregando(false);
  }, [dias]);

  useEffect(() => { buscar(); }, [buscar]);

  // cotação do dia pelo navegador: a edge function não consegue sair pra internet aqui,
  // então quem atualiza é a tela, e o valor fica salvo pro alerta do WhatsApp usar.
  useEffect(() => {
    if (!dados?.config) return;
    const salvoEm = dados.config.dolar_em ? new Date(dados.config.dolar_em).getTime() : 0;
    if (Date.now() - salvoEm < 12 * 3600 * 1000) return;
    (async () => {
      try {
        const r = await fetch("https://economia.awesomeapi.com.br/last/USD-BRL");
        const j = await r.json();
        const v = Number(j?.USDBRL?.bid);
        if (!v || v <= 0) return;
        await (supabase as any).from("ai_usage_config").update({ dolar: v, dolar_em: new Date().toISOString() }).eq("id", true);
        setCotacao(String(v));
        setDados((d) => (d ? { ...d, config: { ...d.config!, dolar: v, dolar_em: new Date().toISOString() } } : d));
      } catch { /* fica a cotação salva */ }
    })();
  }, [dados?.config?.dolar_em]);

  const salvarConfig = async () => {
    const v = Number(String(teto).replace(",", "."));
    const c = Number(String(cotacao).replace(",", "."));
    if (!v || v <= 0) { toast.error("Põe um teto maior que zero"); return; }
    if (!c || c <= 0) { toast.error("Põe uma cotação maior que zero"); return; }
    setSalvando(true);
    const { error } = await (supabase as any).from("ai_usage_config")
      .update({ teto_usd: v, dolar: c, dolar_em: new Date().toISOString(), wa_teto_mes: Math.max(0, parseInt(String(waTeto).replace(/\D/g, ""), 10) || 0), updated_at: new Date().toISOString() }).eq("id", true);
    setSalvando(false);
    if (error) { toast.error("Não consegui salvar"); return; }
    toast.success(`Teto em ${usd(v)} por dia, dólar a ${brl(c)}`);
    buscar();
  };

  const media = useMemo(() => {
    const d = dados?.por_dia || [];
    if (!d.length) return 0;
    return d.reduce((s, x) => s + Number(x.custo || 0), 0) / d.length;
  }, [dados]);

  const tetoNum = Number(dados?.config?.teto_usd || 0);
  const dolar = Number(dados?.config?.dolar || 0) || 5.4;
  const emReal = (v: number) => brl((Number(v) || 0) * dolar);
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

        <div className="flex flex-wrap gap-2">
          {[{ d: 1, r: "Hoje" }, { d: 7, r: "7 dias" }, { d: 30, r: "30 dias" }, { d: 90, r: "90 dias" }].map((o) => (
            <Button key={o.d} size="sm" variant={dias === o.d ? "default" : "outline"} onClick={() => setDias(o.d)}>
              {o.r}
            </Button>
          ))}
          <span className="text-xs text-muted-foreground self-center ml-1">Dólar a {brl(dolar)}</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { rot: "Hoje", v: dados?.hoje ?? 0, destaque: (dados?.hoje ?? 0) >= tetoNum && tetoNum > 0 },
            { rot: "Ontem", v: dados?.ontem ?? 0 },
            { rot: "Mês", v: dados?.mes ?? 0 },
            { rot: dias === 1 ? "Período (hoje)" : `Período (${dias}d)`, v: dados?.total ?? 0 },
            { rot: "Média por dia", v: media },
          ].map((c) => (
            <Card key={c.rot}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{c.rot}</p>
                <p className={`text-xl font-bold ${c.destaque ? "text-destructive" : ""}`}>{usd(c.v)}</p>
                <p className="text-xs text-muted-foreground">{emReal(c.v)}</p>
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
                    formatter={(v: any, n: any) => (n === "custo" ? [`${usd(Number(v))} · ${emReal(Number(v))}`, "Custo"] : [num(Number(v)), "Chamadas"])}
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
              <p className="text-xs text-muted-foreground mt-2">Barra vermelha é dia que passou do teto de {usd(tetoNum)} ({emReal(tetoNum)}).</p>
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
                      <span className="font-semibold shrink-0 text-right">
                        {usd(f.custo)}
                        <span className="block text-[11px] font-normal text-muted-foreground">{emReal(f.custo)}</span>
                      </span>
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
                  <span className="shrink-0 text-right">
                    <span className="font-semibold">{usd(m.custo)}</span>
                    <span className="text-muted-foreground text-xs ml-2">{num(m.chamadas)}x</span>
                    <span className="block text-[11px] text-muted-foreground">{emReal(m.custo)}</span>
                  </span>
                </div>
              ))}
              {opusAtivo && (
                <p className="text-xs text-amber-600 flex items-start gap-1 pt-2">
                  <TriangleAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  Teve Opus no período. É o modelo mais caro. O modelo de cada agente se troca em
                  CRM, Configurações, Agentes de IA; se aparecer só nos dias antigos, já foi trocado.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">WhatsApp API oficial (Meta)</CardTitle>
            <p className="text-xs text-muted-foreground">A partir de 01/10/2026 a Meta cobra cada mensagem que a empresa envia, mesmo dentro da janela de 24h. Mensagem do cliente continua grátis. Custo estimado na tarifa de utilidade do número.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {(wa?.numeros || []).length === 0 && <p className="text-sm text-muted-foreground">Nenhum número da API oficial conectado.</p>}
            {(wa?.numeros || []).map((n) => {
              const custoMes = n.mes * Number(n.preco_brl || 0);
              const proj = wa && wa.dia_mes > 0 ? Math.round((n.mes / wa.dia_mes) * wa.dias_mes) : n.mes;
              const teto = Number(wa?.teto_mes || 0);
              const pct = teto > 0 ? Math.min(100, (n.mes / teto) * 100) : 0;
              return (
                <div key={n.id} className="space-y-2 border-b border-border/40 last:border-0 pb-4 last:pb-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-medium">{n.nome} <span className="text-xs text-muted-foreground font-normal">{n.telefone} · {n.status === "connected" ? "conectado" : n.status}</span></span>
                    <span className="text-xs text-muted-foreground">R$ {Number(n.preco_brl || 0).toFixed(3)} por mensagem</span>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    {[
                      { rot: "Hoje", v: num(n.hoje) },
                      { rot: "Ontem", v: num(n.ontem) },
                      { rot: "Mês", v: num(n.mes), sub: `${num(n.mes_ia)} pelo agente de IA · ${num(n.conversas_mes)} conversas` },
                      { rot: "Custo no mês", v: brl(custoMes), sub: `projeção ${brl(proj * Number(n.preco_brl || 0))}` },
                      { rot: "Projeção de mensagens", v: num(proj), sub: teto > 0 ? `teto ${num(teto)}` : "sem teto" },
                    ].map((c) => (
                      <div key={c.rot} className="rounded-lg border border-border/60 p-3">
                        <p className="text-xs text-muted-foreground">{c.rot}</p>
                        <p className={`text-lg font-bold ${c.rot === "Mês" && teto > 0 && n.mes >= teto ? "text-destructive" : ""}`}>{c.v}</p>
                        {c.sub && <p className="text-[11px] text-muted-foreground">{c.sub}</p>}
                      </div>
                    ))}
                  </div>
                  {teto > 0 && (
                    <div className="h-1.5 rounded bg-muted overflow-hidden"><div className={`h-full ${pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.max(1, pct)}%` }} /></div>
                  )}
                  {n.por_dia.length > 0 && (
                    <ResponsiveContainer width="100%" height={140}>
                      <BarChart data={n.por_dia.map((d) => ({ ...d, label: diaBR(d.dia) }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                        <Tooltip formatter={(v: any) => [`${num(Number(v))} mensagens · ${brl(Number(v) * Number(n.preco_brl || 0))}`, "Enviadas"]} labelFormatter={(l) => `Dia ${l}`}
                          contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                        <Bar dataKey="msgs" fill="#1baf7a" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              );
            })}
            <p className="text-[11px] text-muted-foreground">Passou do teto do mês, chega aviso no WhatsApp uma vez por dia. Todo dia 1º vai o fechamento do mês anterior. A tarifa vem do cadastro do número (utilidade); dá pra fixar outra no banco em wa_preco_servico_brl.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Teto e alerta</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Teto por dia, em dólar</p>
                <Input value={teto} onChange={(e) => setTeto(e.target.value)} className="w-32" inputMode="decimal" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Dólar hoje, em real</p>
                <Input value={cotacao} onChange={(e) => setCotacao(e.target.value)} className="w-28" inputMode="decimal" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Teto de mensagens da API oficial, por mês</p>
                <Input value={waTeto} onChange={(e) => setWaTeto(e.target.value)} className="w-32" inputMode="numeric" />
              </div>
              <Button size="sm" onClick={salvarConfig} disabled={salvando}>
                <Save className="h-4 w-4 mr-1" /> Salvar
              </Button>
              <p className="text-xs text-muted-foreground">
                Teto em {usd(Number(String(teto).replace(",", ".")) || 0)} é {emReal(Number(String(teto).replace(",", ".")) || 0)} por dia. Passou disso, chega aviso no WhatsApp {dados?.config?.telefone ? `(${dados.config.telefone})` : ""}. Todo dia às 20h vai o fechamento.
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
