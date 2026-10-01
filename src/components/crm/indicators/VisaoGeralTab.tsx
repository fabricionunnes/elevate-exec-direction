// Visão geral do digital (aba principal do CRM Comercial, pedido do Fabrício em 30/09/2026):
// da aquisição à receita em um só lugar. Usa os números que as outras abas já calculam
// (crm_visao_geral, crm_atendimento_dashboard, crm_investment_summary + gasto do discador) e
// compara com o período anterior de mesmo tamanho. Visual sóbrio: navy como cor única de
// destaque, tons de azul acinzentado pras séries, verde/vermelho só em variação e alerta.
import { Fragment, Suspense, lazy, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/crm/traffic/SearchableSelect";
import { Loader2, RefreshCw, Download, ArrowUpRight, ArrowDownRight, Minus, AlertTriangle, ChevronRight, Info, Globe2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { duracao } from "@/lib/exportXlsx";
import { toast } from "sonner";
import { carregarMalha, centroUF, corCalor, fundoEscuro, paleta, projetar, useTemaEscuro, type MalhaUF, type PontoUF } from "./mapaCalor";
import { ClientesUfDialog, type FiltrosUf, type TipoListaUf } from "./ClientesUfDialog";
import { n, pct, DOW, moeda, ExportarDialog, PeriodoFiltro, intervalo, useStaffOptions, RodapeEscopo, expedienteTexto, DICA_TEMPO_UTIL, type Periodo } from "./dashboardShared";

// Paleta sóbria: uma cor de destaque e tons acinzentados
// As cores de destaque vêm de variáveis CSS: no tema escuro o navy fixo sumia
// no fundo (números e títulos ficavam invisíveis). Claro = navy da UNV; escuro
// = a mesma família de azul, clareada.
const NAVY = "var(--vg-navy)";
const NAVY_BG = "var(--vg-navy-bg)"; // fundo com texto branco em cima
const AZ = ["var(--vg-navy)", "var(--vg-az2)", "var(--vg-az3)", "var(--vg-az4)"];
const VG_CSS = `
:root{--vg-navy:#0D2B5E;--vg-navy-bg:#0D2B5E;--vg-navy-rgb:13,43,94;--vg-az2:#3B5B8C;--vg-az3:#7C93B8;--vg-az4:#B9C6DA;--vg-mapa-a:#F7F9FC;--vg-mapa-b:#EEF2F8}
.dark{--vg-navy:#A9C3F2;--vg-navy-bg:#2F5296;--vg-navy-rgb:122,160,232;--vg-az2:#86A5DC;--vg-az3:#6384BD;--vg-az4:#46649A;--vg-mapa-a:#162033;--vg-mapa-b:#101827}
`;
const CINZA = "#9CA3AF";
const VERDE = "#16a34a";
const VERMELHO = "#dc2626";
const tip = { fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))" };
const moedaCheia = (v: unknown) => n(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const inteiro = (v: unknown) => n(v).toLocaleString("pt-BR");
const diaCurto = (s: string) => { const [, m, d] = String(s).split("-"); return `${d}/${m}`; };
const SUDESTE = new Set(["SP", "RJ", "MG", "ES"]);

interface Props {
  staffId?: string | null;
  /** Fora da gestão, o painel fica travado no próprio usuário. */
  lockedStaffId?: string | null;
  /** Abre outra aba dos indicadores (detalhe por trás de um card). */
  onNavigate?: (tab: string) => void;
}

interface Invest { meta: number; discador: number; outros: number; total: number; leads: number }

/** Mesmo rateio da seção Investimento e CAC da aba Vendas. */
function calcInvest(inv: any, dialerBrl: number, staffFiltrado: boolean): Invest {
  const leadsTotal = n(inv?.leads_total), leadsCloser = n(inv?.leads_closer);
  const fracao = staffFiltrado ? (leadsTotal > 0 ? leadsCloser / leadsTotal : 0) : 1;
  const porFunil = new Map<string, { total: number; closer: number }>();
  (inv?.leads_by_pipeline || []).forEach((r: any) => porFunil.set(String(r.pipeline_id), { total: n(r.total), closer: n(r.closer) }));
  let meta = 0;
  (inv?.meta_spend_by_pipeline || []).forEach((r: any) => {
    const spend = n(r.spend);
    if (!staffFiltrado) { meta += spend; return; }
    if (!r.pipeline_id) { meta += spend * fracao; return; }
    const f = porFunil.get(String(r.pipeline_id));
    meta += spend * (f && f.total > 0 ? f.closer / f.total : 0);
  });
  const discador = dialerBrl * fracao;
  const outros = n(inv?.manual_costs_total) * fracao;
  return { meta, discador, outros, total: meta + discador + outros, leads: staffFiltrado ? leadsCloser : leadsTotal };
}

function Bloco({ titulo, sub, children, acao, dica }: { titulo: string; sub?: string; children: ReactNode; acao?: ReactNode; dica?: string }) {
  return (
    <Card className="border-border/60 shadow-none">
      <CardContent className="p-4">
        <div className="flex items-start gap-2 mb-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold" style={{ color: NAVY }} title={dica}>{titulo}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
          {acao && <div className="ml-auto shrink-0">{acao}</div>}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function SemDados({ motivo }: { motivo: string }) {
  return <p className="text-sm text-muted-foreground py-6 text-center" title={motivo}>sem dados <Info className="inline h-3 w-3 ml-0.5 opacity-60" /></p>;
}

/** Card de KPI com variação vs período anterior. valor null = sem dados. */
function KpiVar({ label, valor, anterior, formato, dica, onClick, inverso }: {
  label: string; valor: number | null; anterior: number | null; formato: (v: number) => string; dica: string; onClick?: () => void;
  /** menor é melhor (CPL, CAC, custo por reunião) */
  inverso?: boolean;
}) {
  const temBase = valor != null && anterior != null && anterior !== 0;
  const delta = temBase ? ((valor as number) - (anterior as number)) / Math.abs(anterior as number) : null;
  const bom = delta == null ? null : inverso ? delta <= 0 : delta >= 0;
  const cor = delta == null || Math.abs(delta) < 0.005 ? CINZA : bom ? VERDE : VERMELHO;
  const Seta = delta == null || Math.abs(delta) < 0.005 ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <button type="button" onClick={onClick} title={dica}
      className={`text-left rounded-lg border border-border/60 bg-card p-3 transition-colors ${onClick ? "hover:border-[#0D2B5E]/40 cursor-pointer" : "cursor-default"}`}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">{label}</p>
      <p className="text-lg font-semibold tabular-nums mt-1" style={{ color: valor == null ? CINZA : NAVY }}>{valor == null ? "sem dados" : formato(valor)}</p>
      <p className="text-[11px] mt-0.5 flex items-center gap-1 tabular-nums" style={{ color: cor }}>
        <Seta className="h-3 w-3" />
        {delta == null ? (anterior == null || valor == null ? "sem base anterior" : anterior === 0 ? "anterior era zero" : "") : `${delta > 0 ? "+" : ""}${(delta * 100).toFixed(0)}% vs anterior`}
      </p>
    </button>
  );
}

// ------------------------------------------------------------------ Onde estão nossos clientes
// Mapa de calor por UF em 3D (Brasil extrudado, padrão) ou no globo (Mundo); sem WebGL cai num
// SVG 2D com a mesma malha e a mesma escala. O 3D e a malha do IBGE entram por import dinâmico.
const BrasilMapa3D = lazy(() => import("./BrasilMapa3D"));
const ClientesGlobo3D = lazy(() => import("./ClientesGlobo3D"));
type MetricaMapa = "clientes" | "leads";
const UFS = ["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"];

function temWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch { return false; }
}

/** Fallback sem WebGL: os mesmos estados em SVG 2D, com a mesma escala de calor. */
function BrasilMapa2D({ malha, pontos, max, escuro, selecionado, onSelect, onHover }: {
  malha: MalhaUF; pontos: Map<string, PontoUF>; max: number; escuro: boolean; selecionado: string | null; onSelect: (uf: string) => void; onHover: (uf: string | null) => void;
}) {
  const p = paleta(escuro);
  const caminho = (pols: [number, number][][][]) => pols.map((pol) => pol.map((anel) =>
    anel.map(([lng, lat], i) => { const [x, y] = projetar(lng, lat); return `${i ? "L" : "M"}${(x * 100).toFixed(1)},${(-y * 100).toFixed(1)}`; }).join("") + "Z").join("")).join("");
  return (
    <svg viewBox="-112 -112 224 214" className="h-full w-full">
      {Object.keys(malha).map((uf) => {
        const v = pontos.get(uf)?.valor || 0;
        const cor = selecionado === uf ? p.destaque : corCalor(v, max, escuro);
        const c = centroUF(malha[uf]); const [cx, cy] = projetar(c.lng, c.lat);
        return (
          <g key={uf} style={{ cursor: "pointer" }} onMouseEnter={() => onHover(uf)} onMouseLeave={() => onHover(null)} onClick={() => onSelect(uf)}>
            <path d={caminho(malha[uf])} fill={cor} stroke={p.borda} strokeWidth={0.6} fillRule="evenodd" />
            {v > 0 && c.area > 9 && <text x={cx * 100} y={-cy * 100} textAnchor="middle" dominantBaseline="middle" fontSize={5.5} fontWeight={700} fill={fundoEscuro(cor) ? "#fff" : "#0D2B5E"} style={{ pointerEvents: "none" }}>{uf} {v}</text>}
          </g>
        );
      })}
    </svg>
  );
}

/** Onde estão nossos clientes: mapa de calor por UF. Métrica do toggle: clientes (ganho no CRM no histórico
 *  todo + carteira ativa) ou leads do período. Clique no estado ou na linha abre a lista real da UF. */
function MapaClientes({ estados, filtros, periodoTexto }: { estados: any[]; filtros: FiltrosUf; periodoTexto: string }) {
  const [metrica, setMetrica] = useState<MetricaMapa>("clientes");
  const [modo, setModo] = useState<"brasil" | "mundo">("brasil");
  const [resetTick, setResetTick] = useState(0);
  const [hoverUf, setHoverUf] = useState<string | null>(null);
  const [aberta, setAberta] = useState<{ uf: string; tipo: TipoListaUf } | null>(null);
  const [malha, setMalha] = useState<MalhaUF | null>(null);
  const escuro = useTemaEscuro();
  const webgl = useMemo(() => temWebGL(), []);
  useEffect(() => { let vivo = true; carregarMalha().then((m) => { if (vivo) setMalha(m); }).catch(() => undefined); return () => { vivo = false; }; }, []);

  const pontos = useMemo(() => {
    const m = new Map<string, PontoUF>();
    UFS.forEach((uf) => m.set(uf, { uf, valor: 0, leads: 0, clientes: 0, ambos: 0, soCrm: 0, soCarteira: 0, receita: 0 }));
    estados.filter((e) => m.has(e.uf)).forEach((e) => m.set(e.uf, {
      uf: e.uf, valor: n(metrica === "clientes" ? e.clientes : e.leads), leads: n(e.leads), clientes: n(e.clientes), ambos: n(e.ambos), soCrm: n(e.so_crm), soCarteira: n(e.so_carteira), receita: n(e.receita),
    }));
    return m;
  }, [estados, metrica]);
  const lista = [...pontos.values()].filter((p) => p.clientes > 0 || p.leads > 0)
    .sort((a, b) => b.valor - a.valor || b.clientes - a.clientes || b.leads - a.leads);
  const max = Math.max(0, ...lista.map((p) => p.valor));
  const min = lista.filter((p) => p.valor > 0).reduce((m, p) => Math.min(m, p.valor), max);
  const semUf = estados.find((e) => e.uf === "Sem UF");
  const clientesComUf = lista.reduce((s, p) => s + p.clientes, 0);
  const leadsComUf = lista.reduce((s, p) => s + p.leads, 0);
  const sudesteClientes = lista.filter((p) => SUDESTE.has(p.uf)).reduce((s, p) => s + p.clientes, 0);
  const receitaTotal = lista.reduce((s, p) => s + p.receita, 0);
  const info = hoverUf ? pontos.get(hoverUf) || null : null;
  // composição sem dupla contagem: o lead ganho e a empresa em carteira que são o mesmo cliente contam uma vez
  const composicao = (p: { ambos: number; soCrm: number; soCarteira: number }) => `${inteiro(p.ambos)} no CRM e em carteira, ${inteiro(p.soCrm)} só no CRM, ${inteiro(p.soCarteira)} só em carteira`;
  const totais = lista.reduce((t, p) => ({ ambos: t.ambos + p.ambos, soCrm: t.soCrm + p.soCrm, soCarteira: t.soCarteira + p.soCarteira }), { ambos: n(semUf?.ambos), soCrm: n(semUf?.so_crm), soCarteira: n(semUf?.so_carteira) });
  const pal = paleta(escuro);
  const abrir = (uf: string) => setAberta({ uf, tipo: metrica });
  const ufAtiva = aberta?.uf ?? null;
  const carregando3d = <div className="h-full flex items-center justify-center text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin mr-2" />Montando o mapa...</div>;

  return (
    <Bloco titulo="Onde estão nossos clientes"
      sub={`${inteiro(clientesComUf + n(semUf?.clientes))} clientes: ${inteiro(clientesComUf)} com UF, ${pct(sudesteClientes, clientesComUf)} no Sudeste. ${inteiro(n(semUf?.clientes))} sem UF.`}
      dica={`Mapa de calor por estado. Cliente = lead com ganho no CRM Comercial no histórico todo (etapa de ganho ou venda registrada, fora de funis de evento) ou empresa ativa em carteira. Quando o lead ganho e a empresa são o mesmo cliente (vínculo por projeto, telefone ou e-mail), conta uma vez só. Hoje: ${composicao(totais)}. Leads = criados no período. Arraste pra girar, role pra aproximar, clique no estado pra ver a lista`}
      acao={(
        <div className="flex items-center gap-1">
          <div className="flex rounded-md border border-border/60 overflow-hidden mr-1 text-xs" title="O que pinta o mapa">
            <button type="button" className={`px-2 py-1 ${metrica === "clientes" ? "text-white" : "text-muted-foreground"}`} style={metrica === "clientes" ? { background: NAVY_BG } : undefined} onClick={() => setMetrica("clientes")}>Clientes</button>
            <button type="button" className={`px-2 py-1 ${metrica === "leads" ? "text-white" : "text-muted-foreground"}`} style={metrica === "leads" ? { background: NAVY_BG } : undefined} onClick={() => setMetrica("leads")}>Leads do período</button>
          </div>
          {webgl && (
            <>
              <Button variant={modo === "brasil" ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => { setModo("brasil"); setResetTick((t) => t + 1); }} title="Mapa 3D dos estados">Brasil</Button>
              <Button variant={modo === "mundo" ? "default" : "outline"} size="sm" className="h-7 text-xs gap-1" onClick={() => setModo("mundo")} title="Globo, com os estados do Brasil pintados na mesma escala"><Globe2 className="h-3 w-3" /> Mundo</Button>
            </>
          )}
        </div>
      )}>
      <div className="grid grid-cols-5 gap-3">
        <div className="col-span-3">
          <div className="relative rounded-lg border border-border/60 overflow-hidden" style={{ height: 320, background: "linear-gradient(180deg, var(--vg-mapa-a), var(--vg-mapa-b))" }}>
            {!malha ? carregando3d : webgl ? (
              <Suspense fallback={carregando3d}>
                {modo === "brasil"
                  ? <BrasilMapa3D malha={malha} pontos={pontos} max={max} escuro={escuro} selecionado={ufAtiva} onSelect={abrir} onHover={setHoverUf} resetTick={resetTick} />
                  : <ClientesGlobo3D malha={malha} pontos={pontos} max={max} escuro={escuro} selecionado={ufAtiva} onSelect={abrir} onHover={setHoverUf} />}
              </Suspense>
            ) : (
              <BrasilMapa2D malha={malha} pontos={pontos} max={max} escuro={escuro} selecionado={ufAtiva} onSelect={abrir} onHover={setHoverUf} />
            )}
            {info && (
              <div className="absolute left-2 top-2 rounded-md border bg-card/95 px-2.5 py-1.5 text-xs shadow-sm pointer-events-none">
                <p className="font-semibold" style={{ color: NAVY }}>{info.uf}</p>
                <p className="tabular-nums">{inteiro(info.clientes)} clientes</p>
                {info.clientes > 0 && <p className="tabular-nums text-muted-foreground">{composicao(info)}</p>}
                <p className="tabular-nums text-muted-foreground">{inteiro(info.leads)} leads no período{info.receita ? ` · receita ganha ${moeda(info.receita)}` : ""}</p>
                <p className="text-[10px] text-muted-foreground">clique pra ver a lista</p>
              </div>
            )}
          </div>
          {/* legenda da escala */}
          <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground tabular-nums" title="Escala de calor: quanto mais forte, mais do que está selecionado no toggle">
            <span>{metrica === "clientes" ? "Clientes" : "Leads do período"}:</span>
            <span>{max > 0 ? inteiro(min) : 0}</span>
            <span className="h-2 flex-1 max-w-[180px] rounded-full" style={{ background: `linear-gradient(90deg, ${pal.min}, ${pal.max})` }} />
            <span>{inteiro(max)}</span>
            <span className="inline-flex items-center gap-1 ml-2"><span className="h-2 w-3 rounded-sm" style={{ background: pal.vazio }} /> sem dado</span>
          </div>
        </div>
        <div className="col-span-2 overflow-auto max-h-[345px]">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground sticky top-0 bg-card"><tr className="border-b">
              <th className="text-left font-medium py-1">UF</th>
              <th className="text-right font-medium" title="Ganhos no CRM e empresas em carteira, sem contar duas vezes o mesmo cliente">Clientes</th>
              <th className="text-right font-medium">%</th>
              <th className="text-right font-medium" title="Receita ganha (crm_sales) dos clientes da UF">Receita</th>
              <th className="text-right font-medium" title="Leads criados no período">Leads</th>
            </tr></thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.uf} className={`border-b cursor-pointer hover:bg-muted/40 ${ufAtiva === p.uf || hoverUf === p.uf ? "bg-muted/60" : ""}`} onClick={() => abrir(p.uf)}
                  onMouseEnter={() => setHoverUf(p.uf)} onMouseLeave={() => setHoverUf(null)}
                  title={`${p.uf}: ${composicao(p)}. Clique pra ver a lista`}>
                  <td className="py-1 font-medium"><span className="inline-block h-2 w-2 rounded-sm mr-1.5 align-middle" style={{ background: corCalor(p.valor, max, escuro) }} />{p.uf}</td>
                  <td className="text-right tabular-nums font-semibold" style={{ color: p.clientes ? NAVY : undefined }}>{inteiro(p.clientes)}</td>
                  <td className="text-right tabular-nums text-muted-foreground">{pct(p.clientes, clientesComUf)}</td>
                  <td className="text-right tabular-nums">{p.receita ? moeda(p.receita) : "-"}</td>
                  <td className="text-right tabular-nums text-muted-foreground">{inteiro(p.leads)}</td>
                </tr>
              ))}
              {semUf && (n(semUf.clientes) > 0 || n(semUf.leads) > 0) && (
                <tr className={`cursor-pointer hover:bg-muted/40 ${ufAtiva === "Sem UF" ? "bg-muted/60" : ""}`} onClick={() => abrir("Sem UF")} title="Cadastros sem estado. Clique pra ver quem são e corrigir">
                  <td className="py-1 font-medium text-muted-foreground">Sem UF</td>
                  <td className="text-right tabular-nums">{inteiro(semUf.clientes)}</td>
                  <td className="text-right text-muted-foreground">-</td>
                  <td className="text-right tabular-nums">{n(semUf.receita) ? moeda(semUf.receita) : "-"}</td>
                  <td className="text-right tabular-nums text-muted-foreground">{inteiro(semUf.leads)}</td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="text-[10px] text-muted-foreground mt-1.5">Clientes: {composicao(totais)}.</p>
          <p className="text-[10px] text-muted-foreground">Leads do período: {inteiro(leadsComUf)} com UF, {inteiro(n(semUf?.leads))} sem UF. Receita ganha dos clientes com UF: {moeda(receitaTotal)}.</p>
        </div>
      </div>
      <ClientesUfDialog uf={aberta?.uf ?? null} tipo={aberta?.tipo ?? metrica} onTipo={(t) => setAberta((a) => (a ? { ...a, tipo: t } : a))} onClose={() => setAberta(null)} filtros={filtros} periodoTexto={periodoTexto} />
    </Bloco>
  );
}


export function VisaoGeralTab({ staffId, lockedStaffId, onNavigate }: Props) {
  const [periodo, setPeriodo] = useState<Periodo>({ key: "mes" });
  const [origem, setOrigem] = useState("all");
  const [campanha, setCampanha] = useState("all");
  const [produto, setProduto] = useState("all");
  const [equipe, setEquipe] = useState<string>(lockedStaffId || "all");
  const [origens, setOrigens] = useState<{ id: string; name: string }[]>([]);
  const [produtos, setProdutos] = useState<{ id: string; name: string }[]>([]);
  const [dados, setDados] = useState<any>(null);
  const [atend, setAtend] = useState<any>(null);
  const [invest, setInvest] = useState<any>(null);
  const [investPrev, setInvestPrev] = useState<any>(null);
  const [dialer, setDialer] = useState<{ atual: number; anterior: number }>({ atual: 0, anterior: 0 });
  const [carregando, setCarregando] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [lista, setLista] = useState<{ titulo: string; sub?: string; itens: any[] } | null>(null);
  const staff = useStaffOptions();
  // Rateio do investimento por pessoa: quando a equipe está filtrada OU quando o banco já recortou
  // (closer/sdr veem só o próprio, head só a equipe; a RPC devolve isso em escopo.mostrando).
  const escopo = dados?.escopo || invest?.escopo || null;
  const staffFiltrado = equipe !== "all" || (!!escopo && escopo.mostrando !== "tudo");

  useEffect(() => {
    supabase.from("crm_origins").select("id, name").eq("is_active", true).order("name").then(({ data }) => setOrigens((data || []) as any));
    supabase.from("onboarding_services").select("id, name").eq("is_active", true).order("name").then(({ data }) => setProdutos((data || []) as any));
  }, []);

  const carregar = useCallback(async () => {
    if (periodo.key === "custom" && (!periodo.from || !periodo.to)) return;
    setCarregando(true);
    const { from, to } = intervalo(periodo);
    const prevFrom = new Date(from.getTime() - (to.getTime() - from.getTime()));
    const filtros = { p_origin: origem === "all" ? null : origem, p_campaign: campanha === "all" ? null : campanha, p_product: produto === "all" ? null : produto, p_staff: equipe !== "all" ? equipe : null };
    const closer = equipe !== "all" ? equipe : null;
    const [vg, at, inv, invPrev] = await Promise.all([
      (supabase as any).rpc("crm_visao_geral", { p_from: from.toISOString(), p_to: to.toISOString(), ...filtros }),
      (supabase as any).rpc("crm_atendimento_dashboard", { p_from: from.toISOString(), p_to: to.toISOString(), p_atendente: closer, p_setor: null }),
      (supabase as any).rpc("crm_investment_summary", { p_from: from.toISOString(), p_to: new Date(to.getTime() - 1000).toISOString(), p_closer: closer }),
      (supabase as any).rpc("crm_investment_summary", { p_from: prevFrom.toISOString(), p_to: new Date(from.getTime() - 1000).toISOString(), p_closer: closer }),
    ]);
    if (vg.error) toast.error("Erro ao carregar a visão geral: " + vg.error.message);
    setDados(vg.data || null); setAtend(at.data || null); setInvest(inv.data || null); setInvestPrev(invPrev.data || null);
    setCarregando(false);
    // Gasto do discador (Twilio) nas duas janelas, mesma edge da aba Vendas. Sem bloquear a tela.
    try {
      const days = Math.min(370, Math.max(1, Math.ceil((Date.now() - prevFrom.getTime()) / 86400000) + 1));
      const { data: usage } = await supabase.functions.invoke("dialer-usage", { body: { days } });
      if (usage) {
        const recs: any[] = (usage as any).records || [];
        const rate = (usage as any).currency === "USD" ? n((usage as any).brlRate) : 1;
        const soma = (a: Date, b: Date) => {
          const ai = a.toISOString().slice(0, 10), bi = new Date(b.getTime() - 1000).toISOString().slice(0, 10);
          return recs.filter((r) => r.date >= ai && r.date <= bi).reduce((s, r) => s + n(r.spend), 0) * rate;
        };
        setDialer({ atual: soma(from, to), anterior: soma(prevFrom, from) });
      }
    } catch { /* sem custo do discador */ }
  }, [periodo, origem, campanha, produto, equipe, staffFiltrado]);
  useEffect(() => { carregar(); }, [carregar]);

  const { texto } = intervalo(periodo);
  // filtros da tela, pro diálogo de lista por UF do mapa (mesmos parâmetros da RPC principal)
  const filtrosUf = useMemo<FiltrosUf>(() => {
    const { from, to } = intervalo(periodo);
    return { from: from.toISOString(), to: to.toISOString(), origin: origem === "all" ? null : origem, campaign: campanha === "all" ? null : campanha, product: produto === "all" ? null : produto, staff: equipe !== "all" ? equipe : null };
  }, [periodo, origem, campanha, produto, equipe]);
  const A = dados?.atual || {}, B = dados?.anterior || {};
  const invA = useMemo(() => calcInvest(invest, dialer.atual, staffFiltrado), [invest, dialer.atual, staffFiltrado]);
  const invB = useMemo(() => calcInvest(investPrev, dialer.anterior, staffFiltrado), [investPrev, dialer.anterior, staffFiltrado]);
  const div = (a: number, b: number) => (b > 0 ? a / b : null);
  const kpis = useMemo(() => ({
    receita: [n(A.receita), n(B.receita)],
    vendas: [n(A.vendas), n(B.vendas)],
    leads: [n(A.leads), n(B.leads)],
    invest: [invest ? invA.total : null, investPrev ? invB.total : null],
    roas: [invest ? div(n(A.receita_pagos), invA.total) : null, investPrev ? div(n(B.receita_pagos), invB.total) : null],
    cpl: [invest ? div(invA.total, n(A.leads_pagos)) : null, investPrev ? div(invB.total, n(B.leads_pagos)) : null],
    conversao: [div(n(A.vendas), n(A.leads)), div(n(B.vendas), n(B.leads))],
    ticket: [div(n(A.receita), n(A.vendas)), div(n(B.receita), n(B.vendas))],
    cac: [invest ? div(invA.total, n(A.vendas)) : null, investPrev ? div(invB.total, n(B.vendas)) : null],
    custoRealizada: [invest ? div(invA.total, n(A.realizados)) : null, investPrev ? div(invB.total, n(B.realizados)) : null],
  }), [A, B, invA, invB, invest, investPrev]);

  // receita acumulada x meta pró-rata
  const metaProrata = n(dados?.meta?.prorata);
  const receitaSerie = useMemo(() => {
    if (!dados) return [] as any[];
    const { from, to } = intervalo(periodo);
    const dias = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000));
    const porDia = new Map<string, number>();
    (dados.receita_dia || []).forEach((r: any) => porDia.set(r.dia, n(r.receita)));
    let acc = 0;
    const hoje = new Date().toISOString().slice(0, 10);
    return Array.from({ length: dias }, (_, i) => {
      const d = new Date(from); d.setDate(d.getDate() + i);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      acc += porDia.get(k) || 0;
      return { dia: diaCurto(k), receita: k <= hoje ? acc : null, meta: metaProrata > 0 ? (metaProrata / dias) * (i + 1) : null };
    });
  }, [dados, periodo, metaProrata]);

  const funil = dados?.funil || {};
  const etapasFunil = [
    { k: "leads", label: "Leads", v: n(funil.leads) }, { k: "contatados", label: "Contatados", v: n(funil.contatados) },
    { k: "qualificados", label: "Qualificados", v: n(funil.qualificados) }, { k: "agendados", label: "Agendados", v: n(funil.agendados) },
    { k: "realizados", label: "Realizados", v: n(funil.realizados) }, { k: "vendas", label: "Vendas", v: n(funil.vendas) },
  ];
  const origensLista: any[] = dados?.origens || [];
  const pagos = n(A.leads_pagos), leadsTot = n(A.leads);
  const estados: any[] = dados?.estados || [];
  const clientesComUf = estados.filter((e) => e.uf !== "Sem UF").reduce((s, e) => s + n(e.clientes), 0);

  const mapa = useMemo(() => {
    const m = new Map<string, number>(); let max = 0, pico = { dow: 0, hora: 0, v: 0 };
    for (const x of atend?.mapa_calor || []) { const v = n(x.n); m.set(`${x.dow}-${x.hora}`, v); if (v > max) { max = v; pico = { dow: n(x.dow), hora: n(x.hora), v }; } }
    return { m, max, pico };
  }, [atend]);
  const ak = atend?.kpis || {};
  const interacoes = n(A.msgs_wa) + n(A.msgs_ig) + n(A.ligacoes);
  // SLA de 5 min: principal em tempo útil (dentro do expediente), corrido ao lado
  const slaPct = n(ak.recebidas) > 0 ? n(ak.respondidas_5min_util ?? ak.respondidas_5min) / n(ak.recebidas) : null;
  const slaCorridoPct = n(ak.recebidas) > 0 ? n(ak.respondidas_5min) / n(ak.recebidas) : null;
  const SLA_META = 0.8;

  const campanhas = useMemo(() => {
    const spend = new Map<string, { nome: string; spend: number }>();
    (invest?.meta_campaigns || []).forEach((c: any) => spend.set(String(c.campaign_id), { nome: c.nome, spend: n(c.spend) }));
    const leads = new Map<string, any>((dados?.campanhas || []).map((c: any) => [String(c.campaign_id), c]));
    const ids = new Set([...spend.keys(), ...leads.keys()]);
    const rows = [...ids].map((id) => {
      const s = spend.get(id), l = leads.get(id);
      const gasto = s?.spend || 0, nl = n(l?.leads), rec = n(l?.receita);
      return { id, nome: s?.nome || l?.nome || id, gasto, leads: nl, vendas: n(l?.vendas), receita: rec, cpl: nl > 0 && gasto > 0 ? gasto / nl : null, roas: gasto > 0 ? rec / gasto : null };
    });
    return rows.sort((a, b) => b.gasto - a.gasto || b.leads - a.leads);
  }, [invest, dados]);
  const cplMedio = useMemo(() => { const c = campanhas.filter((c) => c.cpl != null); return c.length ? c.reduce((s, x) => s + (x.cpl as number), 0) / c.length : 0; }, [campanhas]);
  const leadsSemana = (dados?.leads_semana || []).map((s: any) => ({ semana: diaCurto(s.semana), pagos: n(s.pagos), organicos: n(s.organicos) }));
  const sdrs: any[] = dados?.sdrs || [];
  const closers: any[] = dados?.closers || [];
  const comparecimento = n(A.realizados) + n(A.no_show) > 0 ? n(A.realizados) / (n(A.realizados) + n(A.no_show)) : null;
  const noShowPct = comparecimento == null ? null : 1 - comparecimento;
  const fechamento = div(n(A.vendas), n(A.realizados));
  const pipelineEtapas: any[] = dados?.pipeline_etapas || [];
  const receitaCanal = origensLista.filter((o) => n(o.receita) > 0).sort((a, b) => n(b.receita) - n(a.receita));

  const atencao = useMemo(() => {
    if (!dados) return [] as { texto: string; detalhe: string; nivel: "alto" | "medio" | "ok"; onClick: () => void }[];
    const itens: { texto: string; detalhe: string; nivel: "alto" | "medio" | "ok"; onClick: () => void }[] = [];
    if (noShowPct != null) itens.push({ texto: `No-show em ${Math.round(noShowPct * 100)}% das reuniões`, detalhe: `${n(A.no_show)} não realizadas de ${n(A.realizados) + n(A.no_show)}`, nivel: noShowPct > 0.3 ? "alto" : noShowPct > 0.15 ? "medio" : "ok", onClick: () => onNavigate?.("presales") });
    if (atend) itens.push({ texto: `${inteiro(ak.aguardando)} atendimentos aguardando resposta`, detalhe: `meta: zero na fila. ${inteiro(ak.sem_resposta)} sem nenhuma resposta`, nivel: n(ak.aguardando) > 20 ? "alto" : n(ak.aguardando) > 0 ? "medio" : "ok", onClick: () => onNavigate?.("atendimento") });
    if (metaProrata > 0) { const falta = Math.max(0, metaProrata - n(A.receita)); itens.push({ texto: falta > 0 ? `Faltam ${moeda(falta)} pra meta do período` : "Meta do período batida", detalhe: `${moeda(A.receita)} de ${moeda(metaProrata)} (${pct(n(A.receita), metaProrata)})`, nivel: falta > metaProrata * 0.5 ? "alto" : falta > 0 ? "medio" : "ok", onClick: () => onNavigate?.("sales") }); }
    itens.push({ texto: `${inteiro(dados.leads_sem_dono_total)} leads do período sem dono`, detalhe: "abertos e sem responsável", nivel: n(dados.leads_sem_dono_total) > 10 ? "alto" : n(dados.leads_sem_dono_total) > 0 ? "medio" : "ok", onClick: () => setLista({ titulo: "Leads sem dono", sub: `${inteiro(dados.leads_sem_dono_total)} no total, os 30 mais recentes`, itens: dados.leads_sem_dono || [] }) });
    itens.push({ texto: `${inteiro(dados.leads_parados_total)} leads parados há mais de 7 dias na etapa`, detalhe: "base viva: abertos, criados nos últimos 120 dias", nivel: n(dados.leads_parados_total) > 50 ? "alto" : n(dados.leads_parados_total) > 0 ? "medio" : "ok", onClick: () => setLista({ titulo: "Leads parados na etapa", sub: `${inteiro(dados.leads_parados_total)} no total, os 30 de maior valor`, itens: dados.leads_parados || [] }) });
    const caras = campanhas.filter((c) => c.cpl != null && cplMedio > 0 && (c.cpl as number) > cplMedio * 1.3);
    if (campanhas.some((c) => c.cpl != null)) itens.push({ texto: caras.length ? `${caras.length} campanha(s) com CPL acima da média` : "Nenhuma campanha com CPL fora da média", detalhe: caras.length ? caras.map((c) => `${c.nome}: ${moedaCheia(c.cpl)}`).join(", ") : `CPL médio ${moedaCheia(cplMedio)}`, nivel: caras.length ? "medio" : "ok", onClick: () => onNavigate?.("traffic") });
    return itens;
  }, [dados, atend, ak, A, noShowPct, metaProrata, campanhas, cplMedio, onNavigate]);

  const blocosExport = useMemo(() => {
    const kv = (k: keyof typeof kpis) => ({ atual: kpis[k][0] ?? "", anterior: kpis[k][1] ?? "" });
    return [
      { chave: "kpis", rotulo: "KPIs", linhas: dados ? Object.entries({ "Receita": kv("receita"), "Vendas": kv("vendas"), "Leads": kv("leads"), "Investimento": kv("invest"), "ROAS pago": kv("roas"), "CPL pago": kv("cpl"), "Conversao": kv("conversao"), "Ticket medio": kv("ticket"), "CAC": kv("cac"), "Custo por reuniao realizada": kv("custoRealizada") }).map(([k, v]) => ({ Indicador: k, Periodo: texto, Atual: v.atual, Anterior: v.anterior })) : [] },
      { chave: "receita", rotulo: "Receita e meta", linhas: receitaSerie.map((r) => ({ Dia: r.dia, "Receita acumulada": r.receita ?? "", "Meta acumulada": r.meta ?? "" })) },
      { chave: "funil", rotulo: "Funil", linhas: etapasFunil.map((e, i) => ({ Etapa: e.label, Quantidade: e.v, "Conversao da etapa anterior": i > 0 && etapasFunil[i - 1].v > 0 ? Number(((e.v / etapasFunil[i - 1].v) * 100).toFixed(1)) : "" })) },
      { chave: "origens", rotulo: "Origem dos leads", linhas: origensLista.map((o) => ({ Origem: o.nome, Grupo: o.grupo || "", "Midia paga": o.pago ? "sim" : "nao", Leads: n(o.leads), "%": leadsTot ? Number(((n(o.leads) / leadsTot) * 100).toFixed(1)) : "", Vendas: n(o.vendas), Receita: n(o.receita) })) },
      { chave: "estados", rotulo: "Clientes por estado", linhas: estados.map((e) => ({ UF: e.uf, Clientes: n(e.clientes), "%": clientesComUf ? Number(((n(e.clientes) / clientesComUf) * 100).toFixed(1)) : "", "No CRM e em carteira": n(e.ambos), "So ganho no CRM": n(e.so_crm), "So em carteira": n(e.so_carteira), "Receita ganha": n(e.receita), "Leads no periodo": n(e.leads) })) },
      { chave: "calor", rotulo: "Mapa de calor", linhas: (atend?.mapa_calor || []).map((x: any) => ({ "Dia da semana": DOW[n(x.dow)], Hora: `${String(x.hora).padStart(2, "0")}h`, "Mensagens recebidas": n(x.n) })) },
      { chave: "atendimento", rotulo: "Atendimento", linhas: atend ? [{ Interacoes: interacoes, WhatsApp: n(A.msgs_wa), Instagram: n(A.msgs_ig), Telefone: n(A.ligacoes), "1a resposta util (media)": duracao(ak.inicio_util_medio_s), "1a resposta corrida (media)": duracao(ak.inicio_medio_s), "SLA ate 5 min util %": slaPct != null ? Number((slaPct * 100).toFixed(1)) : "", "SLA ate 5 min corrido %": slaCorridoPct != null ? Number((slaCorridoPct * 100).toFixed(1)) : "", "Fora do expediente": n(ak.fora_expediente), "Horario de trabalho": expedienteTexto(atend?.expediente), Pendentes: n(ak.aguardando), "Sem resposta": n(ak.sem_resposta) }] : [] },
      { chave: "campanhas", rotulo: "Trafego e campanhas", linhas: campanhas.map((c) => ({ Campanha: c.nome, Midia: c.gasto, Leads: c.leads, CPL: c.cpl ?? "", Vendas: c.vendas, Receita: c.receita, ROAS: c.roas != null ? Number(c.roas.toFixed(2)) : "" })) },
      { chave: "semanas", rotulo: "Leads por semana", linhas: leadsSemana.map((s: any) => ({ Semana: s.semana, Pagos: s.pagos, Organicos: s.organicos })) },
      { chave: "sdrs", rotulo: "Pre-vendas", linhas: sdrs.map((s) => ({ SDR: s.nome, Leads: n(s.leads), Agendados: n(s.agendados), Realizados: n(s.realizados), "No-show": n(s.no_show) })) },
      { chave: "closers", rotulo: "Vendas por consultor", linhas: closers.map((c) => ({ Closer: c.nome, Vendas: n(c.vendas), Receita: n(c.receita), "Reunioes realizadas": n(c.realizados), "Fechamento %": n(c.realizados) ? Number(((n(c.vendas) / n(c.realizados)) * 100).toFixed(1)) : "" })) },
      { chave: "pipeline", rotulo: "Pipeline em aberto", linhas: pipelineEtapas.map((e) => ({ Funil: e.funil, Etapa: e.etapa, Oportunidades: n(e.qtd), "Com valor": n(e.com_valor), Valor: n(e.valor) })) },
      { chave: "atencao", rotulo: "Pontos de atencao", linhas: atencao.map((a) => ({ Ponto: a.texto, Detalhe: a.detalhe, Nivel: a.nivel })) },
    ];
  }, [dados, kpis, texto, receitaSerie, etapasFunil, origensLista, leadsTot, estados, clientesComUf, atend, interacoes, A, ak, slaPct, slaCorridoPct, campanhas, leadsSemana, sdrs, closers, pipelineEtapas, atencao]);

  const campanhasOpcoes = [{ value: "all", label: "Todas as campanhas" }, ...campanhas.map((c) => ({ value: c.id, label: c.nome }))];
  const vazio = !dados || (!n(A.leads) && !n(A.vendas) && !n(A.receita));

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl">
      <style>{VG_CSS}</style>
      <div className="flex flex-wrap items-start gap-2">
        <div>
          <h2 className="text-lg font-bold" style={{ color: NAVY }}>Visão geral</h2>
          <p className="text-xs text-muted-foreground">Da aquisição à receita, em um só lugar. {texto}{dados?.periodo ? `, comparado com os ${n(dados.periodo.dias)} dias anteriores` : ""}.</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="w-[180px]"><SearchableSelect value={origem} onChange={setOrigem} options={[{ value: "all", label: "Todas as origens" }, ...origens.map((o) => ({ value: o.id, label: o.name }))]} /></div>
          <div className="w-[200px]"><SearchableSelect value={campanha} onChange={setCampanha} options={campanhasOpcoes} /></div>
          <div className="w-[170px]"><SearchableSelect value={produto} onChange={setProduto} options={[{ value: "all", label: "Todos os produtos" }, ...produtos.map((p) => ({ value: p.name, label: p.name }))]} /></div>
          {!lockedStaffId && escopo?.mostrando !== "proprio" && <div className="w-[180px]"><SearchableSelect value={equipe} onChange={setEquipe} options={[{ value: "all", label: escopo?.mostrando === "equipe" ? "Toda a minha equipe" : "Toda a equipe" }, ...staff.map((s) => ({ value: s.id, label: s.name }))]} /></div>}
          <PeriodoFiltro value={periodo} onChange={setPeriodo} />
          <Button variant="outline" size="sm" className="gap-1.5" onClick={carregar} disabled={carregando}><RefreshCw className={`h-3.5 w-3.5 ${carregando ? "animate-spin" : ""}`} /> Atualizar</Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setExportOpen(true)} disabled={!dados}><Download className="h-3.5 w-3.5" /> Exportar</Button>
        </div>
      </div>
      <ExportarDialog open={exportOpen} onOpenChange={setExportOpen} blocos={blocosExport} nomeArquivo={`visao-geral-${periodo.key}`} />

      <Dialog open={!!lista} onOpenChange={(v) => { if (!v) setLista(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{lista?.titulo}</DialogTitle>{lista?.sub && <DialogDescription>{lista.sub}</DialogDescription>}</DialogHeader>
          <div className="max-h-[420px] overflow-auto divide-y">
            {(lista?.itens || []).map((i: any) => (
              <Link key={i.id} to={`/crm/leads/${i.id}`} className="flex items-center gap-2 py-2 text-sm hover:bg-muted/40 -mx-1 px-1 rounded">
                <span className="flex-1 min-w-0"><span className="font-medium">{i.nome}</span>{i.sub && <span className="text-xs text-muted-foreground ml-1.5">{i.sub}</span>}</span>
                {i.dias != null && <span className="text-xs tabular-nums" style={{ color: VERMELHO }}>{i.dias}d</span>}
                {n(i.valor) > 0 && <span className="text-xs tabular-nums">{moeda(i.valor)}</span>}
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </Link>
            ))}
            {!lista?.itens?.length && <p className="text-sm text-muted-foreground py-4 text-center">Nada aqui.</p>}
          </div>
        </DialogContent>
      </Dialog>

      {carregando && !dados ? (
        <div className="py-16 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" />Carregando a visão geral...</div>
      ) : vazio ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Nenhum lead, venda ou receita no período com esses filtros.</CardContent></Card>
      ) : (
        <>
          {/* 1. KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            <KpiVar label="Receita total" valor={kpis.receita[0]} anterior={kpis.receita[1]} formato={moeda} dica="Vendas ganhas no período (crm_sales, fora de funis de evento), igual à aba Vendas" onClick={() => onNavigate?.("sales")} />
            <KpiVar label="Vendas" valor={kpis.vendas[0]} anterior={kpis.vendas[1]} formato={inteiro} dica="Quantidade de vendas no período" onClick={() => setLista({ titulo: "Vendas do período", itens: dados.vendas_lista || [] })} />
            <KpiVar label="Leads gerados" valor={kpis.leads[0]} anterior={kpis.leads[1]} formato={inteiro} dica="Leads criados no período, fora das etapas que não contam (Pessoal, Fora do ICP)" onClick={() => onNavigate?.("negocios")} />
            <KpiVar label="Investimento em mídia" valor={kpis.invest[0]} anterior={kpis.invest[1]} formato={moeda} dica={`Tráfego Meta ${moeda(invA.meta)} + discador ${moeda(invA.discador)} + outros custos ${moeda(invA.outros)}${staffFiltrado ? " (rateado por leads do closer)" : ""}`} onClick={() => onNavigate?.("sales")} inverso />
            <KpiVar label="ROAS pago" valor={kpis.roas[0]} anterior={kpis.roas[1]} formato={(v) => `${v.toFixed(2)}x`} dica={`Receita de leads de mídia paga (${moeda(A.receita_pagos)}) sobre o investimento`} onClick={() => onNavigate?.("traffic")} />
            <KpiVar label="CPL pago" valor={kpis.cpl[0]} anterior={kpis.cpl[1]} formato={moedaCheia} dica={`Investimento sobre leads de mídia paga (${inteiro(A.leads_pagos)})`} onClick={() => onNavigate?.("traffic")} inverso />
            <KpiVar label="Conversão de leads" valor={kpis.conversao[0]} anterior={kpis.conversao[1]} formato={(v) => `${(v * 100).toFixed(1)}%`} dica="Vendas sobre leads gerados no período" onClick={() => onNavigate?.("negocios")} />
            <KpiVar label="Ticket médio" valor={kpis.ticket[0]} anterior={kpis.ticket[1]} formato={moeda} dica="Receita sobre quantidade de vendas" onClick={() => onNavigate?.("sales")} />
            <KpiVar label="CAC" valor={kpis.cac[0]} anterior={kpis.cac[1]} formato={moeda} dica="Investimento total sobre vendas" onClick={() => onNavigate?.("sales")} inverso />
            <KpiVar label="Custo / reunião realizada" valor={kpis.custoRealizada[0]} anterior={kpis.custoRealizada[1]} formato={moeda} dica={`Investimento sobre reuniões realizadas (${inteiro(A.realizados)})`} onClick={() => onNavigate?.("sales")} inverso />
          </div>

          {/* 2. Receita e meta + 3. Funil */}
          <div className="grid gap-3 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <Bloco titulo="Receita e meta" sub="Receita acumulada no período contra a meta de Vendas (pró-rata)" dica="Meta = soma das metas de Vendas do time nos meses do período, proporcional aos dias"
                acao={metaProrata > 0 ? <span className="text-xs font-semibold tabular-nums" style={{ color: n(A.receita) >= metaProrata ? VERDE : NAVY }}>{pct(n(A.receita), metaProrata)} da meta</span> : <span className="text-xs text-muted-foreground" title="Nenhuma meta de Vendas cadastrada pros meses do período">sem meta</span>}>
                {receitaSerie.length === 0 ? <SemDados motivo="Sem vendas no período" /> : (
                  <div style={{ height: 240 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={receitaSerie} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.25} />
                        <XAxis dataKey="dia" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={64} tickFormatter={(v) => moeda(v)} />
                        <RTooltip contentStyle={tip} formatter={(v: any) => moeda(v)} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line type="monotone" dataKey="receita" name="Receita" stroke={NAVY} strokeWidth={2.5} dot={false} connectNulls={false} />
                        {metaProrata > 0 && <Line type="monotone" dataKey="meta" name="Meta" stroke={CINZA} strokeWidth={1.5} strokeDasharray="6 4" dot={false} />}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Bloco>
            </div>
            <div className="lg:col-span-2">
              <Bloco titulo="Funil comercial" sub="Conversão etapa a etapa" dica="Contatado = teve atividade, ligação ou mensagem enviada. Qualificado = passou da 1ª etapa ou tem reunião"
                acao={<span className="text-xs font-semibold tabular-nums" style={{ color: NAVY }}>{pct(n(funil.vendas), n(funil.leads))} total</span>}>
                <div className="space-y-1.5">
                  {etapasFunil.map((e, i) => {
                    const base = etapasFunil[0].v || 1;
                    const prev = i > 0 ? etapasFunil[i - 1].v : 0;
                    return (
                      <button type="button" key={e.k} className="w-full text-left group" onClick={() => onNavigate?.(e.k === "vendas" ? "sales" : e.k === "agendados" || e.k === "realizados" ? "presales" : "negocios")} title={`${e.label}: ${inteiro(e.v)}${i > 0 ? `, ${pct(e.v, prev)} da etapa anterior` : ""}`}>
                        <div className="flex items-center justify-between text-xs mb-0.5">
                          <span>{e.label}</span>
                          <span className="tabular-nums"><span className="font-semibold" style={{ color: NAVY }}>{inteiro(e.v)}</span>{i > 0 && <span className="text-muted-foreground ml-1.5">{pct(e.v, prev)}</span>}</span>
                        </div>
                        <div className="h-4 rounded-sm bg-muted overflow-hidden"><div className="h-full rounded-sm group-hover:opacity-80" style={{ width: `${Math.max(2, (e.v / base) * 100)}%`, background: AZ[Math.min(3, Math.floor(i / 2))] }} /></div>
                      </button>
                    );
                  })}
                </div>
              </Bloco>
            </div>
          </div>

          {/* 4. Origem + 5. Estados */}
          <div className="grid gap-3 lg:grid-cols-2">
            <Bloco titulo="Origem dos leads" sub={leadsTot ? `${pct(pagos, leadsTot)} dos leads vêm de mídia paga` : undefined} dica="Mídia paga = lead com campanha/lead da Meta, fbclid, utm_source, ou origem com tráfego no nome">
              {origensLista.length === 0 ? <SemDados motivo="Nenhum lead no período" /> : (
                <div className="grid grid-cols-5 gap-3 items-center">
                  <div className="col-span-2" style={{ height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={origensLista.slice(0, 8)} dataKey="leads" nameKey="nome" innerRadius={48} outerRadius={80} paddingAngle={2} stroke="hsl(var(--background))" strokeWidth={2}>
                          {origensLista.slice(0, 8).map((_: any, i: number) => <Cell key={i} fill={i < 4 ? AZ[i] : CINZA} fillOpacity={i < 4 ? 1 : 1 - (i - 4) * 0.18} />)}
                        </Pie>
                        <RTooltip contentStyle={tip} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="col-span-3 overflow-auto max-h-[220px]">
                    <table className="w-full text-xs">
                      <thead className="text-muted-foreground"><tr className="border-b"><th className="text-left font-medium py-1">Origem</th><th className="text-right font-medium">Leads</th><th className="text-right font-medium">%</th><th className="text-right font-medium">Vendas</th></tr></thead>
                      <tbody>
                        {origensLista.map((o: any, i: number) => (
                          <tr key={o.id || o.nome} className="border-b last:border-0 cursor-pointer hover:bg-muted/40" onClick={() => setOrigem(o.id || "all")} title="Filtrar por esta origem">
                            <td className="py-1"><span className="inline-block h-2 w-2 rounded-sm mr-1.5" style={{ background: i < 4 ? AZ[i] : CINZA }} />{o.nome}{o.pago && <span className="ml-1 text-[9px] uppercase text-muted-foreground">pago</span>}</td>
                            <td className="text-right tabular-nums">{inteiro(o.leads)}</td>
                            <td className="text-right tabular-nums text-muted-foreground">{pct(n(o.leads), leadsTot)}</td>
                            <td className="text-right tabular-nums">{inteiro(o.vendas)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </Bloco>
            <MapaClientes estados={estados} filtros={filtrosUf} periodoTexto={texto} />
          </div>

          {/* 6. Mapa de calor + 7. Atendimento e velocidade */}
          <div className="grid gap-3 lg:grid-cols-2">
            <Bloco titulo="Mapa de calor de atendimentos" sub={mapa.max ? `Pico de atividade: ${DOW[mapa.pico.dow]} às ${mapa.pico.hora}h (${inteiro(mapa.pico.v)} mensagens)` : undefined} dica="Mensagens recebidas no WhatsApp e Instagram por dia da semana e hora (Brasília). Não filtra por origem, campanha ou produto"
              acao={<button type="button" className="text-xs text-primary hover:underline" onClick={() => onNavigate?.("atendimento")}>ver Atendimento</button>}>
              {!mapa.max ? <SemDados motivo="Nenhuma mensagem recebida no período" /> : (
                <div className="grid gap-[2px]" style={{ gridTemplateColumns: "28px repeat(24, 1fr)" }}>
                  <div />
                  {Array.from({ length: 24 }, (_, h) => <div key={h} className="text-[8px] text-muted-foreground text-center">{h % 3 === 0 ? h : ""}</div>)}
                  {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                    <Fragment key={d}>
                      <div className="text-[10px] text-muted-foreground leading-[16px]">{DOW[d]}</div>
                      {Array.from({ length: 24 }, (_, h) => {
                        const v = mapa.m.get(`${d}-${h}`) || 0;
                        const a = mapa.max ? v / mapa.max : 0;
                        return <div key={`${d}-${h}`} title={`${DOW[d]} ${h}h: ${v}`} className="h-[16px] rounded-[2px]" style={{ background: v ? `rgba(var(--vg-navy-rgb), ${0.12 + a * 0.88})` : "hsl(var(--muted))" }} />;
                      })}
                    </Fragment>
                  ))}
                </div>
              )}
            </Bloco>
            <Bloco titulo="Atendimento e velocidade" sub="Interações recebidas e tempo de resposta" dica="Interações = mensagens recebidas (WhatsApp, Instagram) + ligações. 1ª resposta e SLA vêm das conversas iniciadas no período"
              acao={<button type="button" className="text-xs text-primary hover:underline" onClick={() => onNavigate?.("atendimento")}>ver Atendimento</button>}>
              {!atend ? <SemDados motivo="Painel de atendimento indisponível" /> : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { l: "Interações", v: inteiro(interacoes), t: "mensagens recebidas + ligações" },
                      { l: "1ª resposta (útil)", v: n(ak.recebidas) ? duracao(ak.inicio_util_medio_s) : "sem dados", s: n(ak.recebidas) ? `corrido: ${duracao(ak.inicio_medio_s)}` : "", t: `Tempo útil: mediana ${duracao(ak.inicio_util_mediana_s)}. Corrido: média ${duracao(ak.inicio_medio_s)}, mediana ${duracao(ak.inicio_mediana_s)}. Pessoa ou IA. ${DICA_TEMPO_UTIL}` },
                      { l: "SLA até 5 min (útil)", v: slaPct == null ? "sem dados" : `${Math.round(slaPct * 100)}%`, s: slaCorridoPct == null ? "" : `corrido: ${Math.round(slaCorridoPct * 100)}%`, t: `${inteiro(ak.respondidas_5min_util)} de ${inteiro(ak.recebidas)} conversas em que o cliente escreveu, em tempo útil (${inteiro(ak.respondidas_5min)} em tempo corrido). ${DICA_TEMPO_UTIL}` },
                      { l: "Pendentes", v: inteiro(ak.aguardando), s: `${inteiro(ak.fora_expediente)} chegaram fora do expediente`, t: `Conversas em que o cliente falou por último. ${inteiro(ak.fora_expediente)} conversas do período começaram fora do horário de trabalho (${pct(n(ak.fora_expediente), n(ak.recebidas))}), espera corrida média ${duracao(ak.fora_expediente_espera_media_s)}` },
                    ].map((x: { l: string; v: string; t: string; s?: string }) => (
                      <div key={x.l} className="rounded-lg border border-border/60 p-2.5" title={x.t}>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{x.l}</p>
                        <p className="text-base font-semibold tabular-nums" style={{ color: x.l === "Pendentes" && n(ak.aguardando) > 0 ? VERMELHO : NAVY }}>{x.v}</p>
                        {x.s && <p className="text-[10px] text-muted-foreground tabular-nums">{x.s}</p>}
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1.5">
                    {[{ l: "WhatsApp", v: n(A.msgs_wa) }, { l: "Instagram", v: n(A.msgs_ig) }, { l: "Telefone (discador)", v: n(A.ligacoes) }].map((c, i) => (
                      <div key={c.l} className="flex items-center gap-2 text-xs" title={`${c.l}: ${inteiro(c.v)} (${pct(c.v, interacoes)})`}>
                        <span className="w-[120px] shrink-0">{c.l}</span>
                        <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full" style={{ width: `${interacoes ? Math.max(1, (c.v / interacoes) * 100) : 0}%`, background: AZ[i] }} /></div>
                        <span className="w-[60px] text-right tabular-nums">{inteiro(c.v)}</span>
                      </div>
                    ))}
                    <p className="text-[10px] text-muted-foreground">E-mail: sem dados, o CRM não registra e-mails recebidos.</p>
                  </div>
                  <div title={`Meta de SLA: ${Math.round(SLA_META * 100)}% das conversas respondidas em até 5 minutos de tempo útil. Horário de trabalho: ${expedienteTexto(atend?.expediente)}`}>
                    <div className="flex items-center justify-between text-xs mb-1"><span>Meta de SLA (5 min, tempo útil)</span><span className="tabular-nums">{slaPct == null ? "-" : `${Math.round(slaPct * 100)}%`} de {Math.round(SLA_META * 100)}%{slaCorridoPct != null && <span className="text-muted-foreground"> · corrido {Math.round(slaCorridoPct * 100)}%</span>}</span></div>
                    <div className="h-2.5 rounded-full bg-muted overflow-hidden relative">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, (slaPct || 0) * 100)}%`, background: slaPct != null && slaPct >= SLA_META ? VERDE : NAVY }} />
                      <div className="absolute top-0 h-full w-[2px]" style={{ left: `${SLA_META * 100}%`, background: CINZA }} />
                    </div>
                  </div>
                </div>
              )}
            </Bloco>
          </div>

          {/* 8. Tráfego e campanhas */}
          <Bloco titulo="Tráfego e campanhas" sub={invest?.meta_last_sync ? `Meta sincronizado em ${new Date(invest.meta_last_sync).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : undefined} dica="Mídia = gasto das campanhas Meta no período. Leads e receita = leads criados com o id da campanha e as vendas deles"
            acao={<button type="button" className="text-xs text-primary hover:underline" onClick={() => onNavigate?.("traffic")}>ver Tráfego Pago</button>}>
            <div className="grid gap-3 lg:grid-cols-5">
              <div className="lg:col-span-3 overflow-auto max-h-[260px]">
                {campanhas.length === 0 ? <SemDados motivo="Nenhuma campanha com gasto ou lead no período" /> : (
                  <table className="w-full text-xs">
                    <thead className="text-muted-foreground sticky top-0 bg-card"><tr className="border-b"><th className="text-left font-medium py-1">Campanha</th><th className="text-right font-medium">Mídia</th><th className="text-right font-medium">Leads</th><th className="text-right font-medium">CPL</th><th className="text-right font-medium">Receita</th><th className="text-right font-medium">ROAS</th></tr></thead>
                    <tbody>
                      {campanhas.map((c) => (
                        <tr key={c.id} className="border-b last:border-0 cursor-pointer hover:bg-muted/40" onClick={() => setCampanha(c.id)} title="Filtrar por esta campanha">
                          <td className="py-1 max-w-[260px] truncate">{c.nome}</td>
                          <td className="text-right tabular-nums">{c.gasto ? moedaCheia(c.gasto) : "-"}</td>
                          <td className="text-right tabular-nums">{inteiro(c.leads)}</td>
                          <td className="text-right tabular-nums" style={{ color: c.cpl != null && cplMedio > 0 && c.cpl > cplMedio * 1.3 ? VERMELHO : undefined }} title={c.cpl == null ? "sem leads ou sem gasto" : ""}>{c.cpl != null ? moedaCheia(c.cpl) : "-"}</td>
                          <td className="text-right tabular-nums">{c.receita ? moeda(c.receita) : "-"}</td>
                          <td className="text-right tabular-nums" title={c.roas == null ? "sem gasto" : ""}>{c.roas != null ? `${c.roas.toFixed(2)}x` : "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="lg:col-span-2">
                <p className="text-xs text-muted-foreground mb-1">Leads por semana: pagos x orgânicos</p>
                {leadsSemana.length === 0 ? <SemDados motivo="Nenhum lead no período" /> : (
                  <div style={{ height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={leadsSemana} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.25} />
                        <XAxis dataKey="semana" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                        <RTooltip contentStyle={tip} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="pagos" name="Pagos" stackId="a" fill={NAVY} />
                        <Bar dataKey="organicos" name="Orgânicos" stackId="a" fill={AZ[2]} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          </Bloco>

          {/* 9. Pré-vendas + 10. Vendas por consultor */}
          <div className="grid gap-3 lg:grid-cols-2">
            <Bloco titulo="Pré-vendas: desempenho" sub={`${inteiro(A.agendados)} agendamentos, comparecimento ${comparecimento == null ? "sem dados" : `${Math.round(comparecimento * 100)}%`}`} dica="Agendados, realizados e no-show creditados a quem agendou (crm_meeting_events). Leads = leads do período cujo dono ou SDR é a pessoa"
              acao={<button type="button" className="text-xs text-primary hover:underline" onClick={() => onNavigate?.("presales")}>ver Pré vendas</button>}>
              {sdrs.length === 0 ? <SemDados motivo="Nenhum agendamento creditado no período" /> : (
                <div className="space-y-3">
                  <table className="w-full text-xs">
                    <thead className="text-muted-foreground"><tr className="border-b"><th className="text-left font-medium py-1">SDR</th><th className="text-right font-medium">Leads</th><th className="text-right font-medium">Agendados</th><th className="text-right font-medium">Realizados</th><th className="text-right font-medium">No-show</th></tr></thead>
                    <tbody>
                      {sdrs.map((s) => (
                        <tr key={s.id} className="border-b last:border-0"><td className="py-1">{s.nome}</td><td className="text-right tabular-nums">{inteiro(s.leads)}</td><td className="text-right tabular-nums font-semibold" style={{ color: NAVY }}>{inteiro(s.agendados)}</td><td className="text-right tabular-nums">{inteiro(s.realizados)}</td><td className="text-right tabular-nums" style={{ color: n(s.no_show) ? VERMELHO : undefined }}>{inteiro(s.no_show)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                  <div title={`${inteiro(A.no_show)} no-show em ${inteiro(n(A.realizados) + n(A.no_show))} reuniões com desfecho`}>
                    <div className="flex items-center justify-between text-xs mb-1"><span>No-show</span><span className="tabular-nums">{noShowPct == null ? "sem dados" : `${Math.round(noShowPct * 100)}%`}</span></div>
                    <div className="h-2.5 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(noShowPct || 0) * 100}%`, background: noShowPct != null && noShowPct > 0.3 ? VERMELHO : AZ[1] }} /></div>
                  </div>
                </div>
              )}
            </Bloco>
            <Bloco titulo="Vendas por consultor" sub={`Fechamento sobre reuniões: ${fechamento == null ? "sem dados" : `${Math.round(fechamento * 100)}%`}`} dica="Vendas e receita por closer (crm_sales). Fechamento = vendas sobre reuniões realizadas"
              acao={<button type="button" className="text-xs text-primary hover:underline" onClick={() => onNavigate?.("sales")}>ver Vendas</button>}>
              {closers.length === 0 ? <SemDados motivo="Nenhuma venda ou reunião realizada no período" /> : (
                <div style={{ height: Math.max(160, 30 + closers.length * 36) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={closers.map((c) => ({ ...c, receita: n(c.receita), vendas: n(c.vendas) }))} layout="vertical" margin={{ top: 4, right: 60, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.25} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={(v) => moeda(v)} />
                      <YAxis type="category" dataKey="nome" width={110} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                      <RTooltip contentStyle={tip} formatter={(v: any, name: any, p: any) => [name === "Receita" ? `${moeda(v)} (${inteiro(p.payload.vendas)} vendas, ${inteiro(p.payload.realizados)} reuniões)` : v, name]} />
                      <Bar dataKey="receita" name="Receita" fill={NAVY} radius={[0, 4, 4, 0]} barSize={16} label={{ position: "right", fontSize: 11, fill: "hsl(var(--foreground))", formatter: (v: any) => moeda(v) }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Bloco>
          </div>

          {/* 11. Pipeline em aberto + 12. Receita por canal */}
          <div className="grid gap-3 lg:grid-cols-2">
            <Bloco titulo="Pipeline em aberto" sub={dados.pipeline_total ? `${inteiro(dados.pipeline_total.qtd)} oportunidades, ${moeda(dados.pipeline_total.valor)} (${inteiro(dados.pipeline_total.com_valor)} com valor)` : undefined} dica="Leads abertos em funis ativos, criados nos últimos 120 dias, agrupados por etapa. Os 12 maiores em valor"
              acao={<button type="button" className="text-xs text-primary hover:underline" onClick={() => onNavigate?.("negocios")}>ver Negócios</button>}>
              {pipelineEtapas.length === 0 ? <SemDados motivo="Nenhuma oportunidade em aberto com esses filtros" /> : (
                <div style={{ height: Math.max(180, 20 + pipelineEtapas.length * 26) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={pipelineEtapas.map((e) => ({ ...e, valor: n(e.valor), qtd: n(e.qtd), nome: `${e.etapa} (${e.funil})` }))} layout="vertical" margin={{ top: 4, right: 60, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.25} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={(v) => moeda(v)} />
                      <YAxis type="category" dataKey="nome" width={150} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                      <RTooltip contentStyle={tip} formatter={(v: any, _n: any, p: any) => [`${moeda(v)}, ${inteiro(p.payload.qtd)} oportunidades`, "Valor"]} />
                      <Bar dataKey="valor" name="Valor" fill={AZ[1]} radius={[0, 4, 4, 0]} barSize={12} label={{ position: "right", fontSize: 10, fill: "hsl(var(--foreground))", formatter: (v: any) => moeda(v) }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Bloco>
            <Bloco titulo="Receita por canal" sub="Receita ganha por origem do lead" dica="Vendas do período agrupadas pela origem do lead"
              acao={<button type="button" className="text-xs text-primary hover:underline" onClick={() => onNavigate?.("sales")}>ver Vendas</button>}>
              {receitaCanal.length === 0 ? <SemDados motivo="Nenhuma venda no período" /> : (
                <div style={{ height: Math.max(160, 20 + receitaCanal.length * 32) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={receitaCanal.map((o) => ({ nome: o.nome, receita: n(o.receita), vendas: n(o.vendas) }))} layout="vertical" margin={{ top: 4, right: 60, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.25} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={(v) => moeda(v)} />
                      <YAxis type="category" dataKey="nome" width={130} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                      <RTooltip contentStyle={tip} formatter={(v: any, _n: any, p: any) => [`${moeda(v)}, ${inteiro(p.payload.vendas)} vendas`, "Receita"]} />
                      <Bar dataKey="receita" name="Receita" fill={NAVY} radius={[0, 4, 4, 0]} barSize={14} label={{ position: "right", fontSize: 11, fill: "hsl(var(--foreground))", formatter: (v: any) => moeda(v) }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Bloco>
          </div>

          {/* 13. Pontos de atenção */}
          <Bloco titulo="Pontos de atenção" sub="Calculado a partir dos números acima. Clique pra ir onde resolve" dica="Cada linha aponta pra aba ou lista onde o problema se resolve">
            <div className="divide-y">
              {atencao.map((a, i) => (
                <button key={i} type="button" onClick={a.onClick} className="w-full flex items-center gap-3 py-2 text-left hover:bg-muted/40 -mx-1 px-1 rounded">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: a.nivel === "alto" ? VERMELHO : a.nivel === "medio" ? "#d97706" : VERDE }} />
                  <span className="min-w-0 flex-1">
                    <span className="text-sm block truncate">{a.nivel !== "ok" && <AlertTriangle className="inline h-3.5 w-3.5 mr-1 -mt-0.5" style={{ color: a.nivel === "alto" ? VERMELHO : "#d97706" }} />}{a.texto}</span>
                    <span className="text-xs text-muted-foreground block truncate">{a.detalhe}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              ))}
              {atencao.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Nada pra sinalizar.</p>}
            </div>
          </Bloco>
          <RodapeEscopo escopo={escopo} />
        </>
      )}
    </div>
  );
}
