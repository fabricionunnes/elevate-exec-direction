import { useState, useEffect, useMemo, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  FileText, CalendarIcon, ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevronRightSmall,
  Download, Info, AlertTriangle, TrendingUp, TrendingDown, Minus, Wallet, Target, Receipt, Box, BarChart3, FileDown, Loader2,
} from "lucide-react";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { FinCategory, isVariableCategory } from "@/pages/onboarding-tasks/financial/financeClassification";
import DreGrafico3D from "./DreGrafico3D";
import { gerarDrePdf, type LinhaPdf } from "./gerarDrePdf";
import { toast } from "sonner";

// DRE gerencial (30/10/2026, Fabrício: "esse DRE está muito básico, quero que melhore drasticamente").
// Estrutura: Receita bruta por linha de negócio → Deduções → Receita líquida → Custos variáveis →
// Margem de contribuição → Despesas fixas (pessoal, administrativas, comerciais) → EBITDA →
// Resultado financeiro → Investimentos → Resultado líquido. Colunas: mês, % da receita líquida,
// mês anterior, variação, acumulado do ano. Regime de caixa (pago) ou competência (vencimento).
// Toda linha abre a lista de lançamentos que formam o número.

interface Props {
  invoices: any[];
  payables: any[];
  formatCurrency: (v: number) => string;
  formatCurrencyCents: (v: number) => string;
}

interface ManualEntry {
  id: string;
  type: string;
  category_id: string | null;
  amount_cents: number;
  due_date: string;
  paid_at: string | null;
  status: string;
  paid_amount_cents: number | null;
  description: string | null;
  company_id: string | null;
}

interface ProjetoMin { onboarding_company_id: string | null; product_name: string | null; status: string }

type Regime = "caixa" | "competencia";

/** Um lançamento já classificado numa linha do DRE. Valor sempre positivo; o sinal vem da linha. */
interface Movimento {
  id: string;
  linha: string;        // id da sub-linha (ex.: rev_ads, cat:<uuid>)
  grupo: string;        // id do grupo (ex.: rev, op_admin)
  valor: number;        // em reais
  data: string;         // yyyy-mm-dd
  descricao: string;
  parte: string;        // empresa ou fornecedor
  categoria: string;    // nome da categoria
  origem: "fatura" | "conta_a_pagar" | "manual";
}

interface LinhaDef {
  id: string;
  label: string;
  tipo: "grupo" | "sub" | "total";
  grupo?: string;            // pra sub: a que grupo pertence
  natureza: "receita" | "despesa" | "neutro";
  mostraPct?: boolean;       // total com margem %
  dica?: string;
}

const GRUPOS: { id: string; label: string; natureza: "receita" | "despesa"; dica?: string }[] = [
  { id: "rev", label: "RECEITA BRUTA", natureza: "receita", dica: "Valor de face das faturas, por linha de negócio. Fatura sem categoria é classificada pela descrição e pelo produto contratado da empresa." },
  { id: "ded", label: "(-) DEDUÇÕES DA RECEITA", natureza: "despesa", dica: "Impostos sobre a receita, devoluções/estornos e descontos concedidos no pagamento." },
  { id: "var", label: "(-) CUSTOS VARIÁVEIS", natureza: "despesa", dica: "Custos que sobem e descem com a receita: taxas de cobrança, comissões, tráfego e categorias marcadas como variáveis em Categorias." },
  { id: "op_pessoal", label: "(-) DESPESAS COM PESSOAL", natureza: "despesa" },
  { id: "op_admin", label: "(-) DESPESAS ADMINISTRATIVAS", natureza: "despesa" },
  { id: "op_comercial", label: "(-) DESPESAS COMERCIAIS E MARKETING", natureza: "despesa" },
  { id: "op_outros", label: "(-) SEM CATEGORIA", natureza: "despesa", dica: "Contas a pagar sem categoria. Categorize em Contas a Pagar pra elas caírem na linha certa." },
  { id: "fin", label: "(-) RESULTADO FINANCEIRO", natureza: "despesa", dica: "Juros, multas e tarifas pagos, parcelas de empréstimos e ajustes de conciliação, menos juros e multas recebidos de clientes." },
  { id: "inv", label: "(-) INVESTIMENTOS (CAPEX)", natureza: "despesa", dica: "Equipamentos, reformas e melhorias. Contabilmente é investimento, não despesa, mas sai do caixa do mês." },
];

// Sub-linhas fixas (as demais nascem das categorias presentes no período)
const SUBS_FIXAS: Record<string, { id: string; label: string }[]> = {
  rev: [
    { id: "rev_consultoria", label: "Consultoria comercial (Sales Acceleration)" },
    { id: "rev_partners", label: "UNV Partners / Conselho" },
    { id: "rev_ads", label: "UNV Ads" },
    { id: "rev_social", label: "UNV Social" },
    { id: "rev_saas", label: "UNV Sales (CRM, módulos, créditos, instâncias)" },
    { id: "rev_treinamentos", label: "Treinamentos e in company" },
    { id: "rev_eventos", label: "Eventos (Mansão, Imersão, palestras)" },
    { id: "rev_outras", label: "Outras receitas" },
  ],
  ded: [
    { id: "ded_impostos", label: "Impostos sobre a receita" },
    { id: "ded_devolucoes", label: "Devoluções e estornos" },
    { id: "ded_descontos", label: "Descontos concedidos" },
  ],
  var: [
    { id: "var_taxas", label: "Taxas de cobrança (Pix, cartão, boleto)" },
  ],
  fin: [
    { id: "fin_receitas", label: "(+) Juros e multas recebidos" },
    { id: "fin_ajustes", label: "Ajustes de conciliação bancária" },
  ],
};

const TOTAIS: Record<string, LinhaDef> = {
  rl: { id: "rl", label: "= RECEITA LÍQUIDA", tipo: "total", natureza: "neutro" },
  mc: { id: "mc", label: "= MARGEM DE CONTRIBUIÇÃO", tipo: "total", natureza: "neutro", mostraPct: true, dica: "Receita líquida menos custos variáveis. É o que sobra pra pagar a estrutura fixa." },
  ebitda: { id: "ebitda", label: "= EBITDA", tipo: "total", natureza: "neutro", mostraPct: true, dica: "Resultado operacional antes de juros, impostos sobre lucro, depreciação e amortização." },
  resultado: { id: "resultado", label: "= RESULTADO LÍQUIDO", tipo: "total", natureza: "neutro", mostraPct: true },
};

const ORDEM: string[] = ["rev", "ded", "rl", "var", "mc", "op_pessoal", "op_admin", "op_comercial", "op_outros", "ebitda", "fin", "inv", "resultado"];

const mesKey = (d: string | null | undefined) => (d && d.length >= 7 ? d.substring(0, 7) : null);
const addMeses = (ym: string, n: number) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const rotuloMes = (ym: string, curto = false) => {
  const d = parse(ym, "yyyy-MM", new Date());
  const s = format(d, curto ? "MMM/yy" : "MMMM yyyy", { locale: ptBR });
  return s.replace(/^./, (c) => c.toUpperCase());
};
const pct = (v: number, base: number) => (base ? (v / base) * 100 : null);
const fmtPct = (p: number | null, casas = 1) => (p == null || !isFinite(p) ? "—" : `${p.toFixed(casas).replace(".", ",")}%`);

// Linha de receita a partir da descrição/categoria da fatura; sem pista, cai no produto da empresa
function linhaReceita(desc: string, catNome: string | null, produtos: string[]): string {
  const d = (desc || "").toLowerCase();
  const c = (catNome || "").toLowerCase();
  if (/mans[ãa]o|evento|imers[ãa]o|palestra|mesa empreendedora|gp /.test(d) || c === "eventos") return "rev_eventos";
  if (/unv social|social media/.test(d)) return "rev_social";
  if (/unv ads|tr[áa]fego|gest[ãa]o de an[úu]ncios/.test(d)) return "rev_ads";
  if (/unv sales|\bcrm\b|inst[âa]ncia|cr[ée]dito|m[óo]dulo/.test(d) || /unv sales/.test(c)) return "rev_saas";
  if (/treinamento|in ?company|curso|workshop/.test(d) || c.includes("treinamento")) return "rev_treinamentos";
  if (/partners|conselho|mastermind/.test(d) || produtos.some((p) => /partners|board|conselho/i.test(p))) return "rev_partners";
  if (c === "outras receitas") return "rev_outras";
  if (produtos.some((p) => /unv ads/i.test(p)) && !produtos.some((p) => /acceleration|partners/i.test(p))) return "rev_ads";
  if (produtos.some((p) => /unv social/i.test(p)) && !produtos.some((p) => /acceleration|partners/i.test(p))) return "rev_social";
  if (produtos.some((p) => /^crm$/i.test(p)) && produtos.length === 1) return "rev_saas";
  return "rev_consultoria";
}

export default function FinancialDRETab({ invoices, payables, formatCurrency }: Props) {
  const [categories, setCategories] = useState<FinCategory[]>([]);
  const [entries, setEntries] = useState<ManualEntry[]>([]);
  const [projetos, setProjetos] = useState<ProjetoMin[]>([]);
  const [regime, setRegime] = useState<Regime>("caixa");
  const [fechados, setFechados] = useState<Set<string>>(new Set());
  const [detalhe, setDetalhe] = useState<{ titulo: string; itens: Movimento[] } | null>(null);
  const [grafico3d, setGrafico3d] = useState(true);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const hoje = new Date();
  const [mes, setMes] = useState(`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`);

  useEffect(() => {
    (async () => {
      const [catRes, entRes, projRes] = await Promise.all([
        supabase.from("staff_financial_categories").select("*").order("sort_order"),
        supabase.from("staff_financial_entries").select("*").order("due_date"),
        (supabase as any).from("onboarding_projects").select("onboarding_company_id, product_name, status"),
      ]);
      if (catRes.data) setCategories(catRes.data as any);
      if (entRes.data) setEntries(entRes.data as any);
      if (projRes.data) setProjetos(projRes.data as any);
    })();
  }, []);

  const catPorId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const produtosPorEmpresa = useMemo(() => {
    const m = new Map<string, string[]>();
    // ativos primeiro, pra decidir o produto principal
    const ordenados = [...projetos].sort((a, b) => (a.status === "active" ? 0 : 1) - (b.status === "active" ? 0 : 1));
    for (const p of ordenados) {
      if (!p.onboarding_company_id || !p.product_name) continue;
      const arr = m.get(p.onboarding_company_id) || [];
      if (!arr.includes(p.product_name)) arr.push(p.product_name);
      m.set(p.onboarding_company_id, arr);
    }
    return m;
  }, [projetos]);

  // ------------------------------------------------------------------ classificação
  // Transforma faturas, contas a pagar e lançamentos manuais em movimentos por mês (no regime escolhido)
  const movimentosPorMes = useMemo(() => {
    const porMes = new Map<string, Movimento[]>();
    const add = (ym: string | null, mv: Movimento) => {
      if (!ym) return;
      const arr = porMes.get(ym) || [];
      arr.push(mv);
      porMes.set(ym, arr);
    };

    const classificaDespesa = (cat: FinCategory | undefined, desc: string, fornecedor: string): { linha: string; grupo: string } => {
      const nome = (cat?.name || "").toLowerCase();
      const d = (desc || "").toLowerCase();
      if (/ajuste autom[áa]tico asaas|saldo oficial|res[íi]duo/.test(d)) return { linha: "fin_ajustes", grupo: "fin" };
      if (!cat && /^asaas$/i.test(fornecedor) && /^taxa/.test(d)) return { linha: "var_taxas", grupo: "var" };
      if (!cat) return { linha: "cat:none", grupo: "op_outros" };
      if (nome === "imposto" || /imposto/.test(nome)) return { linha: "ded_impostos", grupo: "ded" };
      if (/estorno|devolu/.test(nome)) return { linha: "ded_devolucoes", grupo: "ded" };
      if (cat.dre_line === "investimentos") return { linha: `cat:${cat.id}`, grupo: "inv" };
      if (cat.dre_line === "despesas_financeiras") return { linha: `cat:${cat.id}`, grupo: "fin" };
      if (isVariableCategory(cat)) return { linha: `cat:${cat.id}`, grupo: "var" };
      if (cat.dre_line === "despesas_pessoal") return { linha: `cat:${cat.id}`, grupo: "op_pessoal" };
      if (cat.dre_line === "despesas_comerciais") return { linha: `cat:${cat.id}`, grupo: "op_comercial" };
      return { linha: `cat:${cat.id}`, grupo: "op_admin" };
    };

    // Faturas (receita)
    for (const inv of invoices) {
      if (inv.status === "cancelled") continue;
      const ym = regime === "caixa" ? (inv.status === "paid" ? mesKey(inv.paid_at) : null) : mesKey(inv.due_date);
      if (!ym) continue;
      const cat = inv.category_id ? catPorId.get(inv.category_id) : undefined;
      const bruto = Number(inv.amount_cents || 0) / 100;
      const pago = inv.paid_amount_cents != null ? Number(inv.paid_amount_cents) / 100 : bruto;
      const parte = inv.company_name || inv.custom_receiver_name || "—";
      const base: Omit<Movimento, "linha" | "grupo" | "valor"> = {
        id: inv.id, data: (regime === "caixa" ? inv.paid_at : inv.due_date) || inv.due_date, descricao: inv.description || "Fatura",
        parte, categoria: cat?.name || "Sem categoria", origem: "fatura",
      };
      if (cat && /empr[ée]stimo/i.test(cat.name)) {
        // dinheiro de empréstimo não é receita: fica fora do resultado, só informado
        add(ym, { ...base, linha: "nonop_in", grupo: "memo", valor: regime === "caixa" ? pago : bruto });
        continue;
      }
      const linha = linhaReceita(inv.description, cat?.name || null, produtosPorEmpresa.get(inv.company_id) || []);
      add(ym, { ...base, linha, grupo: "rev", valor: bruto });
      if (regime === "caixa") {
        if (pago < bruto - 0.004) add(ym, { ...base, linha: "ded_descontos", grupo: "ded", valor: bruto - pago, descricao: `Desconto em: ${base.descricao}` });
        if (pago > bruto + 0.004) add(ym, { ...base, linha: "fin_receitas", grupo: "fin", valor: pago - bruto, descricao: `Juros/multa em: ${base.descricao}` });
      } else if (Number(inv.discount_cents || 0) > 0) {
        add(ym, { ...base, linha: "ded_descontos", grupo: "ded", valor: Number(inv.discount_cents) / 100, descricao: `Desconto em: ${base.descricao}` });
      }
      const taxa = Number(inv.payment_fee_cents || 0) / 100;
      if (taxa > 0) add(ym, { ...base, linha: "var_taxas", grupo: "var", valor: taxa, descricao: `Taxa de cobrança: ${base.descricao}` });
    }

    // Contas a pagar (despesa)
    for (const p of payables) {
      if (p.status === "cancelled") continue;
      let ym: string | null; let valor: number;
      if (regime === "caixa") {
        if (p.status !== "paid" && p.status !== "partial") continue;
        ym = mesKey(p.paid_date);
        valor = Number(p.paid_amount ?? p.amount ?? 0);
      } else {
        ym = mesKey(p.due_date);
        valor = Number(p.amount ?? 0);
      }
      if (!ym || !(valor > 0)) continue;
      const cat = p.category_id ? catPorId.get(p.category_id) : undefined;
      const cls = classificaDespesa(cat, p.description || "", p.supplier_name || "");
      add(ym, {
        id: p.id, linha: cls.linha, grupo: cls.grupo, valor,
        data: (regime === "caixa" ? p.paid_date : p.due_date) || p.due_date,
        descricao: p.description || "Conta a pagar", parte: p.supplier_name || "—",
        categoria: cat?.name || "Sem categoria", origem: "conta_a_pagar",
      });
    }

    // Lançamentos manuais (receita ou despesa)
    for (const e of entries) {
      if (e.status === "cancelled") continue;
      const ym = regime === "caixa" ? (e.status === "paid" ? mesKey(e.paid_at || e.due_date) : null) : mesKey(e.due_date);
      if (!ym) continue;
      const cat = e.category_id ? catPorId.get(e.category_id) : undefined;
      const valor = Number((regime === "caixa" ? e.paid_amount_cents ?? e.amount_cents : e.amount_cents) || 0) / 100;
      if (!(valor > 0)) continue;
      const base = { id: e.id, valor, data: e.due_date, descricao: e.description || "Lançamento manual", parte: "Lançamento manual", categoria: cat?.name || "Sem categoria", origem: "manual" as const };
      if (e.type === "receita") {
        if (cat?.dre_line === "deducoes") add(ym, { ...base, linha: /imposto/i.test(cat.name) ? "ded_impostos" : "ded_devolucoes", grupo: "ded" });
        else if (cat && /empr[ée]stimo/i.test(cat.name)) add(ym, { ...base, linha: "nonop_in", grupo: "memo" });
        else add(ym, { ...base, linha: linhaReceita(e.description || "", cat?.name || null, []), grupo: "rev" });
      } else {
        const cls = classificaDespesa(cat, e.description || "", "");
        add(ym, { ...base, linha: cls.linha, grupo: cls.grupo });
      }
    }
    return porMes;
  }, [invoices, payables, entries, regime, catPorId, produtosPorEmpresa]);

  // ------------------------------------------------------------------ totais
  type Totais = { porLinha: Record<string, number>; porGrupo: Record<string, number>; rl: number; mc: number; ebitda: number; resultado: number; fixos: number; despesasTotais: number };
  const totaisDe = useCallback((meses: string[]): Totais => {
    const porLinha: Record<string, number> = {};
    const porGrupo: Record<string, number> = {};
    for (const ym of meses) {
      for (const mv of movimentosPorMes.get(ym) || []) {
        porLinha[mv.linha] = (porLinha[mv.linha] || 0) + mv.valor;
        porGrupo[mv.grupo] = (porGrupo[mv.grupo] || 0) + mv.valor;
      }
    }
    const g = (id: string) => porGrupo[id] || 0;
    // receitas financeiras abatem o grupo "fin" (entram com sinal trocado)
    const finLiquido = g("fin") - 2 * (porLinha["fin_receitas"] || 0);
    const rl = g("rev") - g("ded");
    const mc = rl - g("var");
    const fixos = g("op_pessoal") + g("op_admin") + g("op_comercial") + g("op_outros");
    const ebitda = mc - fixos;
    const resultado = ebitda - finLiquido - g("inv");
    return { porLinha, porGrupo: { ...porGrupo, fin: finLiquido }, rl, mc, ebitda, resultado, fixos, despesasTotais: g("ded") + g("var") + fixos + finLiquido + g("inv") };
  }, [movimentosPorMes]);

  const mesAnterior = addMeses(mes, -1);
  const mesesAno = useMemo(() => { const out: string[] = []; const ano = mes.slice(0, 4); for (let m = 1; m <= Number(mes.slice(5, 7)); m++) out.push(`${ano}-${String(m).padStart(2, "0")}`); return out; }, [mes]);
  const atual = useMemo(() => totaisDe([mes]), [totaisDe, mes]);
  const anterior = useMemo(() => totaisDe([mesAnterior]), [totaisDe, mesAnterior]);
  const acumulado = useMemo(() => totaisDe(mesesAno), [totaisDe, mesesAno]);

  // Série de 12 meses pro gráfico, terminando no mês escolhido
  const serie12 = useMemo(() => {
    const out: { ym: string; label: string; receita: number; despesas: number; resultado: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const ym = addMeses(mes, -i);
      const t = totaisDe([ym]);
      out.push({ ym, label: rotuloMes(ym, true), receita: t.rl, despesas: t.despesasTotais, resultado: t.resultado });
    }
    return out;
  }, [mes, totaisDe]);

  // Sub-linhas de cada grupo: fixas + categorias que apareceram em qualquer coluna
  const subsPorGrupo = useMemo(() => {
    const out: Record<string, { id: string; label: string }[]> = {};
    const nomesCat = (id: string) => (id === "cat:none" ? "Sem categoria" : catPorId.get(id.slice(4))?.name || "Categoria removida");
    for (const grp of GRUPOS) {
      const fixas = SUBS_FIXAS[grp.id] || [];
      const vistas = new Set<string>();
      for (const t of [atual, anterior, acumulado]) {
        for (const mv of Object.keys(t.porLinha)) {
          if (mv.startsWith("cat:")) {
            // descobre o grupo da categoria pelo movimento (mesma regra da classificação)
            const algum = [mes, mesAnterior, ...mesesAno].some((ym) => (movimentosPorMes.get(ym) || []).some((m) => m.linha === mv && m.grupo === grp.id));
            if (algum) vistas.add(mv);
          }
        }
      }
      const dinamicas = [...vistas].map((id) => ({ id, label: nomesCat(id) }))
        .sort((a, b) => (atual.porLinha[b.id] || 0) - (atual.porLinha[a.id] || 0) || a.label.localeCompare(b.label));
      out[grp.id] = [...fixas, ...dinamicas];
    }
    return out;
  }, [atual, anterior, acumulado, catPorId, movimentosPorMes, mes, mesAnterior, mesesAno]);

  // ------------------------------------------------------------------ helpers de exibição
  const valorLinha = (t: Totais, id: string) => {
    if (id in TOTAIS) return (t as any)[id] as number;
    if (GRUPOS.some((g) => g.id === id)) return t.porGrupo[id] || 0;
    return t.porLinha[id] || 0;
  };
  const toggleGrupo = (id: string) => setFechados((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const abrirDetalhe = (titulo: string, filtro: (m: Movimento) => boolean) => {
    const itens = (movimentosPorMes.get(mes) || []).filter(filtro).sort((a, b) => b.valor - a.valor);
    setDetalhe({ titulo, itens });
  };

  const mesLabel = rotuloMes(mes);
  const semCategoria = useMemo(() => (movimentosPorMes.get(mes) || []).filter((m) => m.linha === "cat:none"), [movimentosPorMes, mes]);
  const emprestimosRecebidos = atual.porLinha["nonop_in"] || 0;
  const pontoEquilibrio = atual.rl > 0 && atual.mc > 0 ? atual.fixos / (atual.mc / atual.rl) : null;
  const deltaRL = anterior.rl ? ((atual.rl - anterior.rl) / anterior.rl) * 100 : null;

  // mesma lista de linhas que a tabela mostra, pro CSV e pro PDF
  const linhasExport = useMemo((): LinhaPdf[] => {
    const out: LinhaPdf[] = [];
    const push = (label: string, id: string, nivel: LinhaPdf["nivel"], natureza: LinhaPdf["natureza"], final = false) => {
      const a = valorLinha(atual, id), p = valorLinha(anterior, id), y = valorLinha(acumulado, id);
      out.push({ label, nivel, natureza, atual: a, pct: id === "rl" ? 100 : pct(Math.abs(a), atual.rl), anterior: p,
        delta: p ? ((a - p) / Math.abs(p)) * 100 : null, acumulado: y, pctAcum: id === "rl" ? 100 : pct(Math.abs(y), acumulado.rl), final });
    };
    for (const id of ORDEM) {
      if (id in TOTAIS) { push(TOTAIS[id].label, id, "total", "neutro", id === "resultado"); continue; }
      const g = GRUPOS.find((x) => x.id === id)!;
      const a = valorLinha(atual, g.id), p = valorLinha(anterior, g.id), y = valorLinha(acumulado, g.id);
      if (g.id === "op_outros" && !a && !p && !y) continue;
      push(g.label, g.id, "grupo", g.natureza);
      for (const s of subsPorGrupo[g.id] || []) {
        if (!valorLinha(atual, s.id) && !valorLinha(anterior, s.id) && !valorLinha(acumulado, s.id)) continue;
        push(s.label, s.id, "sub", s.id === "fin_receitas" ? "receita" : g.natureza);
      }
    }
    return out;
  }, [atual, anterior, acumulado, subsPorGrupo]);

  const exportarPDF = async () => {
    setGerandoPdf(true);
    try {
      await gerarDrePdf({
        mesLabel, mesCurto: rotuloMes(mes, true), mesAnteriorCurto: rotuloMes(mesAnterior, true), ano: mes.slice(0, 4), regime,
        linhas: linhasExport,
        kpis: { rl: atual.rl, mc: atual.mc, ebitda: atual.ebitda, resultado: atual.resultado, rlAnterior: anterior.rl },
        serie: serie12.map((s) => ({ label: s.label, receita: s.receita, despesas: s.despesas, resultado: s.resultado })),
        leitura: { pontoEquilibrio, fixos: atual.fixos, variaveis: atual.porGrupo["var"] || 0, semCategoriaN: semCategoria.length,
          semCategoriaTotal: semCategoria.reduce((s, m) => s + m.valor, 0), emprestimos: emprestimosRecebidos },
        formatCurrency,
      });
    } catch (e) {
      console.error(e);
      toast.error("Não consegui gerar o PDF");
    } finally { setGerandoPdf(false); }
  };

  const exportarCSV = () => {
    const linhas: string[][] = [["Linha", rotuloMes(mes), "% RL", rotuloMes(mesAnterior), "Variação", `Acumulado ${mes.slice(0, 4)}`, "% RL acumulado"]];
    const num = (v: number) => v.toFixed(2).replace(".", ",");
    for (const l of linhasExport) {
      const sinal = l.natureza === "despesa" ? -1 : 1;
      linhas.push([(l.nivel === "sub" ? "  " : "") + l.label, num(l.atual * sinal), fmtPct(l.pct), num(l.anterior * sinal), l.delta == null ? "—" : fmtPct(l.delta), num(l.acumulado * sinal), fmtPct(l.pctAcum)]);
    }
    linhas.push([]);
    linhas.push([`Regime: ${regime === "caixa" ? "caixa (pago no mês)" : "competência (vencimento no mês)"}`]);
    const csv = "﻿" + linhas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `DRE-${mes}-${regime}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const Delta = ({ a, p, invertido = false }: { a: number; p: number; invertido?: boolean }) => {
    if (!p && !a) return <span className="text-muted-foreground">—</span>;
    if (!p) return <span className="text-muted-foreground text-xs">novo</span>;
    const d = ((a - p) / Math.abs(p)) * 100;
    const bom = invertido ? d < 0 : d > 0;
    const Icon = Math.abs(d) < 0.05 ? Minus : d > 0 ? TrendingUp : TrendingDown;
    return (
      <span className={cn("inline-flex items-center gap-1 tabular-nums text-xs font-medium", Math.abs(d) < 0.05 ? "text-muted-foreground" : bom ? "text-emerald-600" : "text-destructive")}>
        <Icon className="h-3 w-3" />{d > 0 ? "+" : ""}{fmtPct(d)}
      </span>
    );
  };

  const corValor = (v: number, natureza: LinhaDef["natureza"]) => {
    if (natureza === "receita") return "text-emerald-600";
    if (natureza === "despesa") return v ? "text-destructive" : "text-muted-foreground";
    return v >= 0 ? "text-emerald-600" : "text-destructive";
  };
  const mostraValor = (v: number, natureza: LinhaDef["natureza"]) => (natureza === "despesa" && v ? `(${formatCurrency(v)})` : formatCurrency(v));

  // ------------------------------------------------------------------ render
  const dataSel = parse(mes, "yyyy-MM", new Date());
  const kpis = [
    { titulo: "Receita líquida", valor: formatCurrency(atual.rl), sub: <Delta a={atual.rl} p={anterior.rl} />, icone: Receipt, cor: "text-emerald-600" },
    { titulo: "Margem de contribuição", valor: formatCurrency(atual.mc), sub: <span className="text-xs text-muted-foreground">{fmtPct(pct(atual.mc, atual.rl))} da receita líquida</span>, icone: Target, cor: atual.mc >= 0 ? "text-emerald-600" : "text-destructive" },
    { titulo: "EBITDA", valor: formatCurrency(atual.ebitda), sub: <span className="text-xs text-muted-foreground">margem {fmtPct(pct(atual.ebitda, atual.rl))}</span>, icone: TrendingUp, cor: atual.ebitda >= 0 ? "text-emerald-600" : "text-destructive" },
    { titulo: "Resultado líquido", valor: formatCurrency(atual.resultado), sub: <span className="text-xs text-muted-foreground">margem {fmtPct(pct(atual.resultado, atual.rl))} · <Delta a={atual.resultado} p={anterior.resultado} /></span>, icone: Wallet, cor: atual.resultado >= 0 ? "text-emerald-600" : "text-destructive" },
  ];

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        {/* Cabeçalho */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              DRE - Demonstração do Resultado
            </h2>
            <p className="text-sm text-muted-foreground">
              {regime === "caixa" ? "Regime de caixa: o que foi recebido e pago no mês." : "Regime de competência: faturas e contas pelo vencimento, pagas ou não."} Clique em qualquer linha pra ver os lançamentos.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-md border overflow-hidden">
              {(["caixa", "competencia"] as Regime[]).map((r) => (
                <button key={r} type="button" onClick={() => setRegime(r)}
                  className={cn("px-3 py-1.5 text-sm transition-colors", regime === r ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted")}>
                  {r === "caixa" ? "Caixa" : "Competência"}
                </button>
              ))}
            </div>
            <div className="inline-flex items-center rounded-md border">
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setMes(addMeses(mes, -1))} aria-label="Mês anterior"><ChevronLeft className="h-4 w-4" /></Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" className="h-9 min-w-[170px] justify-center font-normal"><CalendarIcon className="mr-2 h-4 w-4" />{mesLabel}</Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar mode="single" selected={dataSel} onSelect={(d) => d && setMes(format(d, "yyyy-MM"))} locale={ptBR}
                    captionLayout="dropdown-buttons" fromYear={2024} toYear={2030} className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setMes(addMeses(mes, 1))} aria-label="Próximo mês"><ChevronRight className="h-4 w-4" /></Button>
            </div>
            <Button variant="outline" size="sm" onClick={exportarCSV}><Download className="h-4 w-4 mr-2" />CSV</Button>
            <Button size="sm" onClick={exportarPDF} disabled={gerandoPdf} className="bg-[#0D2B5E] hover:bg-[#0D2B5E]/90 text-white">
              {gerandoPdf ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}PDF
            </Button>
          </div>
        </div>

        {/* Indicadores */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {kpis.map((k) => (
            <Card key={k.titulo}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{k.titulo}</p>
                  <k.icone className={cn("h-4 w-4", k.cor)} />
                </div>
                <p className={cn("text-xl font-semibold tabular-nums mt-1", k.cor)}>{k.valor}</p>
                <div className="mt-0.5">{k.sub}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Evolução 12 meses */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Evolução nos últimos 12 meses</p>
              <div className="inline-flex rounded-md border overflow-hidden text-xs">
                <button type="button" onClick={() => setGrafico3d(true)} className={cn("px-2.5 py-1 inline-flex items-center gap-1", grafico3d ? "bg-primary text-primary-foreground" : "hover:bg-muted")}><Box className="h-3.5 w-3.5" />3D</button>
                <button type="button" onClick={() => setGrafico3d(false)} className={cn("px-2.5 py-1 inline-flex items-center gap-1", !grafico3d ? "bg-primary text-primary-foreground" : "hover:bg-muted")}><BarChart3 className="h-3.5 w-3.5" />2D</button>
              </div>
            </div>
            {grafico3d ? (
              <DreGrafico3D serie={serie12} mesSel={mes} onMes={setMes} formatCurrency={formatCurrency} altura={320} />
            ) : (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={serie12} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} onClick={(e: any) => { const ym = e?.activePayload?.[0]?.payload?.ym; if (ym) setMes(ym); }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={64} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <ChartTooltip formatter={(v: any, name: any) => [formatCurrency(Number(v)), name]} labelClassName="text-xs" contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.4} />
                  <Bar dataKey="receita" name="Receita líquida" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={28} cursor="pointer" />
                  <Bar dataKey="despesas" name="Despesas e custos" fill="#dc2626" fillOpacity={0.75} radius={[4, 4, 0, 0]} maxBarSize={28} cursor="pointer" />
                  <Line type="monotone" dataKey="resultado" name="Resultado líquido" stroke="#0D2B5E" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            )}
          </CardContent>
        </Card>

        {/* Demonstrativo */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="text-left font-medium px-4 py-2.5 min-w-[260px]">
                      <button type="button" className="hover:underline" onClick={() => setFechados(fechados.size ? new Set() : new Set(GRUPOS.map((g) => g.id)))}>
                        {fechados.size ? "Expandir tudo" : "Recolher tudo"}
                      </button>
                    </th>
                    <th className="text-right font-medium px-3 py-2.5 min-w-[130px]">{rotuloMes(mes, true)}</th>
                    <th className="text-right font-medium px-3 py-2.5 min-w-[70px]">
                      <Tooltip><TooltipTrigger className="inline-flex items-center gap-1">% RL <Info className="h-3 w-3" /></TooltipTrigger><TooltipContent>Participação na receita líquida do mês (análise vertical)</TooltipContent></Tooltip>
                    </th>
                    <th className="text-right font-medium px-3 py-2.5 min-w-[120px] hidden md:table-cell">{rotuloMes(mesAnterior, true)}</th>
                    <th className="text-right font-medium px-3 py-2.5 min-w-[80px] hidden md:table-cell">Variação</th>
                    <th className="text-right font-medium px-3 py-2.5 min-w-[130px] hidden lg:table-cell">Acum. {mes.slice(0, 4)}</th>
                    <th className="text-right font-medium px-3 py-2.5 min-w-[70px] hidden lg:table-cell">% RL</th>
                  </tr>
                </thead>
                <tbody>
                  {ORDEM.map((id) => {
                    if (id in TOTAIS) {
                      const def = TOTAIS[id];
                      const a = valorLinha(atual, id), p = valorLinha(anterior, id), y = valorLinha(acumulado, id);
                      const final = id === "resultado";
                      return (
                        <tr key={id} className={cn("border-b font-semibold", final ? "bg-primary/10 text-base" : "bg-primary/5")}>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1.5">{def.label}
                              {def.dica && <Tooltip><TooltipTrigger><Info className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger><TooltipContent className="max-w-xs">{def.dica}</TooltipContent></Tooltip>}
                            </span>
                          </td>
                          <td className={cn("px-3 py-3 text-right tabular-nums", corValor(a, "neutro"))}>{formatCurrency(a)}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-xs text-muted-foreground">{id === "rl" ? "100%" : fmtPct(pct(a, atual.rl))}</td>
                          <td className={cn("px-3 py-3 text-right tabular-nums hidden md:table-cell text-muted-foreground")}>{formatCurrency(p)}</td>
                          <td className="px-3 py-3 text-right hidden md:table-cell"><Delta a={a} p={p} /></td>
                          <td className={cn("px-3 py-3 text-right tabular-nums hidden lg:table-cell", corValor(y, "neutro"))}>{formatCurrency(y)}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-xs text-muted-foreground hidden lg:table-cell">{id === "rl" ? "100%" : fmtPct(pct(y, acumulado.rl))}</td>
                        </tr>
                      );
                    }
                    const g = GRUPOS.find((x) => x.id === id)!;
                    const subs = (subsPorGrupo[g.id] || []).filter((s) => valorLinha(atual, s.id) || valorLinha(anterior, s.id) || valorLinha(acumulado, s.id));
                    const a = valorLinha(atual, g.id), p = valorLinha(anterior, g.id), y = valorLinha(acumulado, g.id);
                    if (g.id === "op_outros" && !a && !p && !y) return null;
                    const aberto = !fechados.has(g.id);
                    return (
                      <FragmentRows key={g.id}>
                        <tr className="border-b bg-muted/30 font-semibold hover:bg-muted/60 cursor-pointer" onClick={() => abrirDetalhe(g.label.replace(/^\(-\) /, ""), (m) => m.grupo === g.id)}>
                          <td className="px-4 py-2.5">
                            <span className="inline-flex items-center gap-1.5">
                              <button type="button" className="p-0.5 rounded hover:bg-muted" onClick={(e) => { e.stopPropagation(); toggleGrupo(g.id); }} aria-label={aberto ? "Recolher" : "Expandir"}>
                                {aberto ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRightSmall className="h-3.5 w-3.5" />}
                              </button>
                              {g.label}
                              {g.dica && <Tooltip><TooltipTrigger onClick={(e) => e.stopPropagation()}><Info className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger><TooltipContent className="max-w-xs">{g.dica}</TooltipContent></Tooltip>}
                              {g.id === "op_outros" && <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700">categorizar</Badge>}
                            </span>
                          </td>
                          <td className={cn("px-3 py-2.5 text-right tabular-nums", corValor(a, g.natureza))}>{mostraValor(a, g.natureza)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-xs text-muted-foreground">{fmtPct(pct(Math.abs(a), atual.rl))}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums hidden md:table-cell text-muted-foreground">{mostraValor(p, g.natureza)}</td>
                          <td className="px-3 py-2.5 text-right hidden md:table-cell"><Delta a={a} p={p} invertido={g.natureza === "despesa"} /></td>
                          <td className={cn("px-3 py-2.5 text-right tabular-nums hidden lg:table-cell", corValor(y, g.natureza))}>{mostraValor(y, g.natureza)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-xs text-muted-foreground hidden lg:table-cell">{fmtPct(pct(Math.abs(y), acumulado.rl))}</td>
                        </tr>
                        {aberto && subs.map((s) => {
                          const sa = valorLinha(atual, s.id), sp = valorLinha(anterior, s.id), sy = valorLinha(acumulado, s.id);
                          const natureza: LinhaDef["natureza"] = s.id === "fin_receitas" ? "receita" : g.natureza;
                          return (
                            <tr key={s.id} className="border-b last:border-b-0 hover:bg-muted/40 cursor-pointer text-muted-foreground" onClick={() => abrirDetalhe(s.label, (m) => m.linha === s.id)}>
                              <td className="pl-12 pr-4 py-2 text-[13px] text-foreground/80">{s.label}</td>
                              <td className={cn("px-3 py-2 text-right tabular-nums text-[13px]", natureza === "despesa" ? "text-foreground/80" : "text-emerald-700")}>{natureza === "despesa" && sa ? `(${formatCurrency(sa)})` : formatCurrency(sa)}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-xs">{fmtPct(pct(sa, atual.rl))}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-[13px] hidden md:table-cell">{natureza === "despesa" && sp ? `(${formatCurrency(sp)})` : formatCurrency(sp)}</td>
                              <td className="px-3 py-2 text-right hidden md:table-cell"><Delta a={sa} p={sp} invertido={natureza === "despesa"} /></td>
                              <td className="px-3 py-2 text-right tabular-nums text-[13px] hidden lg:table-cell">{natureza === "despesa" && sy ? `(${formatCurrency(sy)})` : formatCurrency(sy)}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-xs hidden lg:table-cell">{fmtPct(pct(sy, acumulado.rl))}</td>
                            </tr>
                          );
                        })}
                      </FragmentRows>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Leitura do mês */}
        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <CardContent className="p-4 space-y-1">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Ponto de equilíbrio operacional</p>
              <p className="text-lg font-semibold tabular-nums">{pontoEquilibrio != null ? formatCurrency(pontoEquilibrio) : "—"}</p>
              <p className="text-xs text-muted-foreground">
                {pontoEquilibrio != null
                  ? atual.rl >= pontoEquilibrio
                    ? `Receita líquida ${formatCurrency(atual.rl - pontoEquilibrio)} acima do necessário pra cobrir os custos fixos.`
                    : `Faltam ${formatCurrency(pontoEquilibrio - atual.rl)} de receita líquida pra cobrir os custos fixos de ${formatCurrency(atual.fixos)}.`
                  : "Sem margem de contribuição positiva no mês, não dá pra calcular."}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 space-y-1">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Estrutura de custos</p>
              <p className="text-lg font-semibold tabular-nums">{formatCurrency(atual.fixos)} <span className="text-xs font-normal text-muted-foreground">fixos</span></p>
              <p className="text-xs text-muted-foreground">
                Variáveis {formatCurrency(atual.porGrupo["var"] || 0)} ({fmtPct(pct(atual.porGrupo["var"] || 0, atual.rl))} da RL) · Pessoal {fmtPct(pct(atual.porGrupo["op_pessoal"] || 0, atual.fixos))} dos fixos
                {deltaRL != null && <> · Receita líquida {deltaRL >= 0 ? "subiu" : "caiu"} {fmtPct(Math.abs(deltaRL))} contra {rotuloMes(mesAnterior, true)}</>}
              </p>
            </CardContent>
          </Card>
          <Card className={cn(semCategoria.length ? "border-amber-300" : "")}>
            <CardContent className="p-4 space-y-1">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Qualidade dos dados</p>
              {semCategoria.length ? (
                <button type="button" className="text-left" onClick={() => abrirDetalhe("Lançamentos sem categoria", (m) => m.linha === "cat:none")}>
                  <p className="text-lg font-semibold tabular-nums text-amber-700 inline-flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" />{semCategoria.length} sem categoria</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(semCategoria.reduce((s, m) => s + m.valor, 0))} entraram em "Sem categoria". Clique pra ver e categorize em Contas a Pagar.</p>
                </button>
              ) : (
                <>
                  <p className="text-lg font-semibold text-emerald-600">Tudo categorizado</p>
                  <p className="text-xs text-muted-foreground">Nenhum lançamento do mês ficou fora das linhas do DRE.</p>
                </>
              )}
              {emprestimosRecebidos > 0 && (
                <p className="text-xs text-muted-foreground pt-1 border-t mt-2">
                  Fora do resultado: {formatCurrency(emprestimosRecebidos)} de empréstimos recebidos (entrada de caixa, não é receita).
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Receita de faturas e recebíveis pelo valor de face; descontos no pagamento viram dedução e juros/multas recebidos viram receita financeira.
          Despesas vêm de Contas a Pagar e lançamentos manuais, pela categoria configurada em Categorias (tipo de custo decide o que é variável).
        </p>

        {/* Lançamentos da linha */}
        <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>{detalhe?.titulo}</DialogTitle>
              <DialogDescription>
                {detalhe ? `${detalhe.itens.length} lançamento(s) em ${mesLabel}, regime de ${regime === "caixa" ? "caixa" : "competência"} · total ${formatCurrency(detalhe.itens.reduce((s, m) => s + m.valor, 0))}` : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-auto -mx-6 px-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[90px]">Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Empresa / Fornecedor</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detalhe?.itens.length ? detalhe.itens.map((m, i) => (
                    <TableRow key={`${m.id}-${m.linha}-${i}`}>
                      <TableCell className="text-xs text-muted-foreground tabular-nums">{m.data ? format(new Date(m.data.length === 10 ? `${m.data}T12:00:00` : m.data), "dd/MM/yy") : "—"}</TableCell>
                      <TableCell className="text-sm">{m.descricao}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.parte}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{m.categoria}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(m.valor)}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">Nenhum lançamento nessa linha em {mesLabel}.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

// <tbody> não aceita Fragment com key em alguns linters; wrapper explícito
function FragmentRows({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
