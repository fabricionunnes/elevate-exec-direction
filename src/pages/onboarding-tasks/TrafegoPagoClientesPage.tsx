// Tráfego pago dos clientes (Fabrício, 19/10/2026): "um menu novo pra acompanhar o tráfego pago de
// todas as empresas que rodam tráfego com a gente, um geral pra ver o resultado de todas, CAC, ROAS,
// e um filtro pra olhar individual; ver quem está conectado com a Meta, quem não está, conectar de
// lá, olhar saldo". Dados: RPC trafego_pago_painel (série diária trafego_diario, alimentada pela
// edge trafego-pago-sync a cada 2h) + client_traffic_leads (leads/vendas registrados no Nexus).
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { format, parseISO, startOfMonth, endOfMonth, subDays, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { MetaAdsConnect } from "@/components/meta-ads/MetaAdsConnect";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Link2, Loader2, Megaphone, RefreshCw, Wallet, X } from "lucide-react";

type Conta = {
  conectada: boolean; conta?: string | null; conta_id?: string | null; vence_em?: string | null; situacao?: string | null;
  prepaga?: boolean | null; saldo?: number | null; em_aberto?: number | null; forma_pagamento?: string | null;
  saldo_checado_em?: string | null; saldo_erro?: string | null; ultimo_sync?: string | null; sync_erro?: string | null;
};
type Empresa = {
  project_id: string; empresa: string; status_projeto: string; product_name: string; conta: Conta;
  gasto: number; impressoes: number; cliques: number; cliques_link: number; leads: number; conversas: number; compras: number;
  receita_meta: number; leads_nexus: number; vendas_nexus: number; receita_nexus: number; resultados: number;
  vendas: number; receita: number; cpl: number | null; cac: number | null; roas: number | null;
};
type Painel = {
  de: string; ate: string; empresas: Empresa[]; serie: { dia: string; gasto: number; leads: number; conversas: number; compras: number }[];
  campanhas: { campaign_id: string; nome: string; objetivo: string | null; gasto: number; impressoes: number; cliques: number; leads: number; conversas: number; compras: number; receita: number; cpl: number | null; ultimo_dia: string }[];
  leads_nexus: { id: string; nome: string; telefone: string | null; chegou_em: string; origem: string | null; status: string; valor: number | null; fechou_em: string | null }[];
  totais: Record<string, number | null>; gerado_em: string;
};

const PERIODOS = [
  { value: "7", label: "Últimos 7 dias" }, { value: "14", label: "Últimos 14 dias" }, { value: "30", label: "Últimos 30 dias" },
  { value: "mes", label: "Este mês" }, { value: "mes_passado", label: "Mês passado" }, { value: "90", label: "Últimos 90 dias" },
];
const ymd = (d: Date) => format(d, "yyyy-MM-dd");
function intervalo(p: string): { de: string; ate: string } {
  const hoje = new Date();
  if (p === "mes") return { de: ymd(startOfMonth(hoje)), ate: ymd(hoje) };
  if (p === "mes_passado") { const m = subMonths(hoje, 1); return { de: ymd(startOfMonth(m)), ate: ymd(endOfMonth(m)) }; }
  return { de: ymd(subDays(hoje, Number(p) - 1)), ate: ymd(hoje) };
}
const n = (v: unknown) => Number(v || 0);
const brl = (v: unknown, dec = 0) => n(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: dec, minimumFractionDigits: dec });
const num = (v: unknown) => n(v).toLocaleString("pt-BR");
const x = (v: unknown) => (v == null || n(v) === 0 ? "-" : `${n(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}x`);
const dt = (v?: string | null, f = "dd/MM HH:mm") => (v ? format(parseISO(v), f, { locale: ptBR }) : "-");
const STATUS_LEAD: Record<string, string> = { novo: "Novo", em_contato: "Em contato", agendou: "Agendou", compareceu: "Compareceu", fechou: "Fechou", sem_resposta: "Sem resposta", perdido: "Perdido" };

function Kpi({ rot, valor, sub, alerta }: { rot: string; valor: string; sub?: string; alerta?: boolean }) {
  return (
    <Card className={alerta ? "border-amber-400/60" : undefined}>
      <CardContent className="p-4">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{rot}</div>
        <div className="text-2xl font-bold mt-1 leading-tight">{valor}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function ConexaoBadge({ c }: { c: Conta }) {
  if (!c?.conectada) return <Badge variant="outline" className="border-red-400 text-red-600">Sem conexão</Badge>;
  if (c.sync_erro && /token|session|invalid/i.test(c.sync_erro)) return <Badge variant="outline" className="border-red-400 text-red-600">Reconectar</Badge>;
  if (c.sync_erro && !/mesma conta/i.test(c.sync_erro)) return <Badge variant="outline" className="border-amber-400 text-amber-700">Erro no sync</Badge>;
  if (c.situacao && c.situacao !== "Ativa") return <Badge variant="outline" className="border-amber-400 text-amber-700">{c.situacao}</Badge>;
  return <Badge variant="outline" className="border-emerald-500 text-emerald-700">Conectada</Badge>;
}
function Saldo({ c }: { c: Conta }) {
  if (!c?.conectada) return <span className="text-muted-foreground">-</span>;
  if (c.prepaga) {
    const s = n(c.saldo);
    const cor = s <= 1 ? "text-red-600 font-semibold" : s < 150 ? "text-amber-700 font-semibold" : "";
    return <span className={cor} title={c.forma_pagamento || ""}>{c.saldo == null ? "?" : brl(c.saldo, 2)} <span className="text-[10px] text-muted-foreground">pré-paga</span></span>;
  }
  return <span title={c.forma_pagamento || ""}>{c.forma_pagamento ? "Cartão/fatura" : "-"}{n(c.em_aberto) > 0 ? <span className="text-[10px] text-muted-foreground"> · {brl(c.em_aberto, 2)} em aberto</span> : null}</span>;
}

export default function TrafegoPagoClientesPage() {
  const navigate = useNavigate();
  const { loading: authLoading, currentStaff, isMaster } = useStaffPermissions();
  const podeVer = isMaster || currentStaff?.role === "admin";
  const [periodo, setPeriodo] = useState("30");
  const [projeto, setProjeto] = useState("");
  const [dados, setDados] = useState<Painel | null>(null);
  const [loading, setLoading] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [conectar, setConectar] = useState<{ project_id: string; empresa: string } | null>(null);
  const { de, ate } = useMemo(() => intervalo(periodo), [periodo]);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    const { data, error } = await (supabase as any).rpc("trafego_pago_painel", { p_from: de, p_to: ate, p_project: projeto || null });
    if (error) toast.error("Não consegui carregar o tráfego: " + error.message);
    else setDados(data as Painel);
    setLoading(false);
  }, [de, ate, projeto]);
  useEffect(() => { if (podeVer) carregar(); }, [carregar, podeVer]);

  // Lista de empresas pro filtro: sempre a lista completa (sem o filtro de projeto)
  const [todas, setTodas] = useState<Empresa[]>([]);
  useEffect(() => {
    if (!podeVer) return;
    (supabase as any).rpc("trafego_pago_painel", { p_from: de, p_to: ate, p_project: null })
      .then(({ data }: any) => setTodas(((data as Painel)?.empresas || []) as Empresa[]));
  }, [de, ate, podeVer]);

  // Voltou do OAuth da Meta: abre o conector do projeto pra escolher a conta (ou confirmar)
  useEffect(() => {
    const stored = sessionStorage.getItem("meta_ads_callback");
    if (!stored) return;
    try {
      const d = JSON.parse(stored);
      if (d?.project_id) {
        const e = todas.find((t) => t.project_id === d.project_id);
        setConectar({ project_id: d.project_id, empresa: e?.empresa || "Empresa" });
      }
    } catch { /* ignora */ }
  }, [todas]);

  const sincronizar = async (project_id?: string) => {
    setSincronizando(true);
    try {
      const { data, error } = await supabase.functions.invoke("trafego-pago-sync", { body: { days: 3, project_id: project_id || undefined } });
      if (error || data?.error) throw new Error(data?.error || error?.message || "falha");
      const erros = (data?.resultados || []).filter((r: any) => !r.ok);
      toast.success(`Sincronizado: ${data?.contas || 0} conta(s)${erros.length ? `, ${erros.length} com erro` : ""}`);
      await carregar(true);
    } catch (e: any) {
      toast.error("Não consegui sincronizar: " + (e.message || e));
    } finally { setSincronizando(false); }
  };

  const abrirConectar = (e: Empresa) => {
    sessionStorage.setItem("meta_ads_return_to", "/onboarding-tasks/trafego-pago");
    setConectar({ project_id: e.project_id, empresa: e.empresa });
  };

  if (!authLoading && !podeVer) return <Navigate to="/onboarding-tasks" replace />;

  const t = dados?.totais || {};
  const empresas = dados?.empresas || [];
  const selecionada = projeto ? empresas.find((e) => e.project_id === projeto) : null;
  const serie = (dados?.serie || []).map((s) => ({ ...s, dia: format(parseISO(s.dia), "dd/MM"), resultados: n(s.leads) + n(s.conversas) }));
  const semConexao = todas.filter((e) => !e.conta?.conectada);
  const saldoBaixo = todas.filter((e) => e.conta?.conectada && e.conta?.prepaga && n(e.conta?.saldo) < 150);
  const reconectar = todas.filter((e) => e.conta?.conectada && e.conta?.sync_erro && /token|session|invalid/i.test(e.conta.sync_erro));

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card/60 sticky top-0 z-10">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/onboarding-tasks")} title="Voltar"><ArrowLeft className="h-4 w-4" /></Button>
          <Megaphone className="h-5 w-5 text-primary" />
          <div className="mr-auto">
            <h1 className="text-lg font-bold leading-tight">Tráfego pago</h1>
            <p className="text-xs text-muted-foreground">Resultado de todas as empresas que rodam tráfego com a UNV. {dados?.gerado_em ? `Atualizado ${dt(dados.gerado_em)}.` : ""}</p>
          </div>
          <SearchableSelect value={periodo} onValueChange={setPeriodo} options={PERIODOS} placeholder="Período" className="w-[170px]" />
          <SearchableSelect
            value={projeto} onValueChange={(v) => setProjeto(v)} allowNone noneLabel="Todas as empresas" placeholder="Empresa" className="w-[260px]"
            options={todas.map((e) => ({ value: e.project_id, label: e.empresa, hint: e.conta?.conectada ? "" : "sem conexão" }))}
          />
          <Button variant="outline" size="sm" onClick={() => sincronizar(projeto || undefined)} disabled={sincronizando} className="gap-1.5">
            {sincronizando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sincronizar agora
          </Button>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 py-4 space-y-4">
        {(semConexao.length > 0 || saldoBaixo.length > 0 || reconectar.length > 0) && (
          <div className="flex flex-wrap gap-2 text-xs">
            {reconectar.map((e) => (
              <button key={e.project_id} onClick={() => abrirConectar(e)} className="flex items-center gap-1 rounded-md border border-red-400/60 bg-red-50 dark:bg-red-950/30 px-2 py-1 text-red-700 dark:text-red-300">
                <AlertTriangle className="h-3 w-3" /> {e.empresa}: token da Meta venceu, reconectar
              </button>
            ))}
            {saldoBaixo.map((e) => (
              <button key={e.project_id} onClick={() => setProjeto(e.project_id)} className="flex items-center gap-1 rounded-md border border-amber-400/60 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 text-amber-800 dark:text-amber-200">
                <Wallet className="h-3 w-3" /> {e.empresa}: saldo {brl(e.conta.saldo, 2)}
              </button>
            ))}
            {semConexao.map((e) => (
              <button key={e.project_id} onClick={() => abrirConectar(e)} className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-muted-foreground hover:text-foreground">
                <Link2 className="h-3 w-3" /> {e.empresa}: sem conta Meta, conectar
              </button>
            ))}
          </div>
        )}

        {loading && !dados ? (
          <div className="py-20 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
              <Kpi rot="Investimento" valor={brl(t.gasto)} sub={`${num(t.impressoes)} impressões · ${num(t.cliques)} cliques`} />
              <Kpi rot="Resultados" valor={num(t.resultados)} sub={`${num(t.leads)} leads · ${num(t.conversas)} conversas`} />
              <Kpi rot="Custo por resultado" valor={t.cpl == null ? "-" : brl(t.cpl, 2)} sub="investimento ÷ resultados" />
              <Kpi rot="Vendas" valor={num(t.vendas)} sub="registradas no Nexus ou compras na Meta" />
              <Kpi rot="Receita" valor={brl(t.receita)} sub="das vendas atribuídas" />
              <Kpi rot="CAC" valor={t.cac == null ? "-" : brl(t.cac, 2)} sub="investimento ÷ vendas" />
              <Kpi rot="ROAS" valor={x(t.roas)} sub="receita ÷ investimento" />
              <Kpi rot="Conexões Meta" valor={`${num(t.conectadas)}/${num(t.empresas)}`} sub={`${num(t.sem_conexao)} sem conexão · ${num(t.saldo_alerta)} saldo baixo`} alerta={n(t.sem_conexao) > 0 || n(t.saldo_alerta) > 0} />
            </div>

            <Card>
              <CardHeader className="py-3"><CardTitle className="text-sm">Investimento e resultados por dia{selecionada ? ` · ${selecionada.empresa}` : ""}</CardTitle></CardHeader>
              <CardContent className="h-[260px] pt-0">
                {serie.length === 0 ? <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Sem dados no período. Clique em "Sincronizar agora".</div> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={serie} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="g" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${Math.round(v)}`} />
                      <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} />
                      <RTooltip formatter={(v: any, nome: any) => (nome === "Investimento" ? brl(v, 2) : num(v))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar yAxisId="g" dataKey="gasto" name="Investimento" fill="#2a78d6" radius={[3, 3, 0, 0]} />
                      <Line yAxisId="r" dataKey="resultados" name="Resultados (leads + conversas)" stroke="#1baf7a" strokeWidth={2} dot={false} />
                      <Line yAxisId="r" dataKey="compras" name="Compras" stroke="#eda100" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {!selecionada && (
              <Card>
                <CardHeader className="py-3"><CardTitle className="text-sm">Por empresa · {dt(dados?.de, "dd/MM")} a {dt(dados?.ate, "dd/MM")}</CardTitle></CardHeader>
                <CardContent className="pt-0 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[11px] uppercase text-muted-foreground border-b">
                        <th className="text-left py-2 pr-2">Empresa</th><th className="text-left py-2 pr-2">Conexão</th><th className="text-left py-2 pr-2">Saldo</th>
                        <th className="text-right py-2 pr-2">Investimento</th><th className="text-right py-2 pr-2">Leads</th><th className="text-right py-2 pr-2">Conversas</th>
                        <th className="text-right py-2 pr-2">Custo/res.</th><th className="text-right py-2 pr-2">Vendas</th><th className="text-right py-2 pr-2">Receita</th>
                        <th className="text-right py-2 pr-2">CAC</th><th className="text-right py-2 pr-2">ROAS</th><th className="text-left py-2 pr-2">Sync</th><th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {empresas.length === 0 && <tr><td colSpan={13} className="py-6 text-center text-muted-foreground">Nenhuma empresa com tráfego no período.</td></tr>}
                      {empresas.map((e) => (
                        <tr key={e.project_id} className="border-b last:border-0 hover:bg-muted/40 cursor-pointer" onClick={() => setProjeto(e.project_id)}>
                          <td className="py-2 pr-2 font-medium">
                            {e.empresa}
                            {e.product_name !== "UNV Ads" && <span className="ml-1 text-[10px] text-muted-foreground">({e.product_name})</span>}
                            {e.status_projeto !== "active" && <span className="ml-1 text-[10px] text-muted-foreground">· {e.status_projeto === "notice_period" ? "aviso prévio" : e.status_projeto}</span>}
                          </td>
                          <td className="py-2 pr-2"><ConexaoBadge c={e.conta} /></td>
                          <td className="py-2 pr-2 whitespace-nowrap"><Saldo c={e.conta} /></td>
                          <td className="py-2 pr-2 text-right font-semibold">{brl(e.gasto, 2)}</td>
                          <td className="py-2 pr-2 text-right">{num(e.leads)}{n(e.leads_nexus) > 0 && <span className="text-[10px] text-muted-foreground"> · {num(e.leads_nexus)} no Nexus</span>}</td>
                          <td className="py-2 pr-2 text-right">{num(e.conversas)}</td>
                          <td className="py-2 pr-2 text-right">{e.cpl == null ? "-" : brl(e.cpl, 2)}</td>
                          <td className="py-2 pr-2 text-right">{num(e.vendas)}</td>
                          <td className="py-2 pr-2 text-right">{brl(e.receita)}</td>
                          <td className="py-2 pr-2 text-right">{e.cac == null ? "-" : brl(e.cac, 2)}</td>
                          <td className="py-2 pr-2 text-right">{x(e.roas)}</td>
                          <td className="py-2 pr-2 text-xs text-muted-foreground whitespace-nowrap" title={e.conta?.sync_erro || ""}>{dt(e.conta?.ultimo_sync)}</td>
                          <td className="py-2 text-right">
                            <Button size="sm" variant={e.conta?.conectada ? "ghost" : "outline"} className="h-7 text-xs gap-1" onClick={(ev) => { ev.stopPropagation(); abrirConectar(e); }}>
                              <Link2 className="h-3 w-3" /> {e.conta?.conectada ? "Reconectar" : "Conectar"}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}

            {selecionada && (
              <>
                <Card>
                  <CardHeader className="py-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm">Conta Meta · {selecionada.empresa}</CardTitle>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => abrirConectar(selecionada)}><Link2 className="h-3 w-3" /> {selecionada.conta?.conectada ? "Reconectar" : "Conectar"}</Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setProjeto("")}><X className="h-3 w-3" /> Todas</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div><div className="text-[11px] uppercase text-muted-foreground">Situação</div><ConexaoBadge c={selecionada.conta} /> <span className="text-xs text-muted-foreground">{selecionada.conta?.conta || ""}</span></div>
                    <div><div className="text-[11px] uppercase text-muted-foreground">Saldo / pagamento</div><Saldo c={selecionada.conta} /><div className="text-xs text-muted-foreground">{selecionada.conta?.forma_pagamento || ""}</div></div>
                    <div><div className="text-[11px] uppercase text-muted-foreground">Token vence em</div>{dt(selecionada.conta?.vence_em, "dd/MM/yyyy")}</div>
                    <div><div className="text-[11px] uppercase text-muted-foreground">Último sync</div>{dt(selecionada.conta?.ultimo_sync)}{selecionada.conta?.sync_erro && <div className="text-xs text-red-600">{selecionada.conta.sync_erro}</div>}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="py-3"><CardTitle className="text-sm">Campanhas · {dt(dados?.de, "dd/MM")} a {dt(dados?.ate, "dd/MM")}</CardTitle></CardHeader>
                  <CardContent className="pt-0 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="text-[11px] uppercase text-muted-foreground border-b">
                        <th className="text-left py-2 pr-2">Campanha</th><th className="text-left py-2 pr-2">Objetivo</th><th className="text-right py-2 pr-2">Investimento</th>
                        <th className="text-right py-2 pr-2">Impressões</th><th className="text-right py-2 pr-2">Cliques</th><th className="text-right py-2 pr-2">Leads</th>
                        <th className="text-right py-2 pr-2">Conversas</th><th className="text-right py-2 pr-2">Custo/res.</th><th className="text-right py-2 pr-2">Compras</th><th className="text-right py-2 pr-2">Receita</th><th className="text-left py-2">Último dia</th>
                      </tr></thead>
                      <tbody>
                        {(dados?.campanhas || []).length === 0 && <tr><td colSpan={11} className="py-6 text-center text-muted-foreground">Sem campanhas com entrega no período.</td></tr>}
                        {(dados?.campanhas || []).map((c) => (
                          <tr key={c.campaign_id} className="border-b last:border-0">
                            <td className="py-2 pr-2 font-medium max-w-[360px] truncate" title={c.nome}>{c.nome}</td>
                            <td className="py-2 pr-2 text-xs text-muted-foreground">{(c.objetivo || "").replace(/^OUTCOME_/, "").toLowerCase()}</td>
                            <td className="py-2 pr-2 text-right font-semibold">{brl(c.gasto, 2)}</td>
                            <td className="py-2 pr-2 text-right">{num(c.impressoes)}</td><td className="py-2 pr-2 text-right">{num(c.cliques)}</td>
                            <td className="py-2 pr-2 text-right">{num(c.leads)}</td><td className="py-2 pr-2 text-right">{num(c.conversas)}</td>
                            <td className="py-2 pr-2 text-right">{c.cpl == null ? "-" : brl(c.cpl, 2)}</td>
                            <td className="py-2 pr-2 text-right">{num(c.compras)}</td><td className="py-2 pr-2 text-right">{brl(c.receita)}</td>
                            <td className="py-2 text-xs text-muted-foreground">{dt(c.ultimo_dia, "dd/MM")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="py-3"><CardTitle className="text-sm">Leads registrados no Nexus · {num(selecionada.leads_nexus)} no período · {num(selecionada.vendas_nexus)} fechou</CardTitle></CardHeader>
                  <CardContent className="pt-0 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="text-[11px] uppercase text-muted-foreground border-b">
                        <th className="text-left py-2 pr-2">Nome</th><th className="text-left py-2 pr-2">Telefone</th><th className="text-left py-2 pr-2">Chegou</th><th className="text-left py-2 pr-2">Origem</th><th className="text-left py-2 pr-2">Status</th><th className="text-right py-2">Valor</th>
                      </tr></thead>
                      <tbody>
                        {(dados?.leads_nexus || []).length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">Nenhum lead registrado no Nexus neste período. Eles entram pela aba Leads do Tráfego Pago do projeto (formulário da Meta, planilha ou manual).</td></tr>}
                        {(dados?.leads_nexus || []).map((l) => (
                          <tr key={l.id} className="border-b last:border-0">
                            <td className="py-2 pr-2 font-medium">{l.nome}</td><td className="py-2 pr-2 text-xs">{l.telefone || "-"}</td>
                            <td className="py-2 pr-2 text-xs">{dt(l.chegou_em)}</td><td className="py-2 pr-2 text-xs text-muted-foreground">{l.origem || "-"}</td>
                            <td className="py-2 pr-2"><Badge variant={l.status === "fechou" ? "default" : "secondary"} className="text-[10px]">{STATUS_LEAD[l.status] || l.status}</Badge></td>
                            <td className="py-2 text-right">{l.valor ? brl(l.valor, 2) : "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}
      </div>

      <Dialog open={!!conectar} onOpenChange={(o) => { if (!o) { setConectar(null); sessionStorage.removeItem("meta_ads_callback"); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Conectar Meta Ads · {conectar?.empresa}</DialogTitle></DialogHeader>
          {conectar && (
            <MetaAdsConnect
              projectId={conectar.project_id}
              onConnected={async () => {
                toast.success("Conta conectada. Puxando os últimos 35 dias…");
                setConectar(null);
                try { await supabase.functions.invoke("trafego-pago-sync", { body: { days: 35, project_id: conectar.project_id } }); } catch { /* o cron pega depois */ }
                await carregar(true);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
