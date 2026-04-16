import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, subMonths, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Users,
  Repeat,
  DollarSign,
  Target,
  Download,
  FileSpreadsheet,
  FileText as FileTextIcon,
  Sparkles,
  Filter,
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  Legend,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

interface SaleRow {
  id: string;
  date: string; // ISO
  amount: number;
  company_id: string | null;
  company_name: string;
  product_name: string | null;
  consultant_id: string | null;
  consultant_name: string;
  source: "project" | "invoice";
  classification: "new" | "existing";
  // for existing — heuristic subtype
  existing_subtype?: "renewal" | "upsell";
}

interface Consultant {
  id: string;
  name: string;
}

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444"];

type PeriodPreset = "current" | "previous" | "custom";

export default function SalesReportPage() {
  const navigate = useNavigate();

  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  // filters
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("current");
  const [customStart, setCustomStart] = useState<string>(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [customEnd, setCustomEnd] = useState<string>(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [consultantFilter, setConsultantFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "new" | "existing">("all");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [minAmount, setMinAmount] = useState<string>("");
  const [maxAmount, setMaxAmount] = useState<string>("");

  // data
  const [allSales, setAllSales] = useState<SaleRow[]>([]); // current period
  const [previousTotal, setPreviousTotal] = useState<number>(0);
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);

  // ------ Auth check (Admin/Master only) ------
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setAuthorized(false);
          return;
        }
        const { data: staff } = await supabase
          .from("onboarding_staff")
          .select("id, role, is_active")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .maybeSingle();
        const role = staff?.role || "";
        const ok = role === "admin" || role === "master";
        setAuthorized(ok);
      } catch (e) {
        console.error(e);
        setAuthorized(false);
      }
    })();
  }, []);

  // ------ Period resolution ------
  const { startDate, endDate, prevStart, prevEnd } = useMemo(() => {
    let s: Date;
    let e: Date;
    if (periodPreset === "current") {
      s = startOfMonth(new Date());
      e = endOfMonth(new Date());
    } else if (periodPreset === "previous") {
      const prev = subMonths(new Date(), 1);
      s = startOfMonth(prev);
      e = endOfMonth(prev);
    } else {
      s = new Date(customStart + "T00:00:00");
      e = new Date(customEnd + "T23:59:59");
    }
    const ps = startOfMonth(subMonths(s, 1));
    const pe = endOfMonth(subMonths(s, 1));
    return { startDate: s, endDate: e, prevStart: ps, prevEnd: pe };
  }, [periodPreset, customStart, customEnd]);

  // ------ Fetch data ------
  useEffect(() => {
    if (authorized !== true) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, startDate.getTime(), endDate.getTime()]);

  async function fetchData() {
    setLoading(true);
    try {
      // Consultants & companies for filters
      const [{ data: staffList }, { data: companiesList }] = await Promise.all([
        supabase.from("onboarding_staff").select("id, name").eq("is_active", true).order("name"),
        supabase.from("onboarding_companies").select("id, name").order("name"),
      ]);
      setConsultants((staffList || []) as Consultant[]);
      setCompanies((companiesList || []) as { id: string; name: string }[]);

      // ── Paid invoices in period (these carry the actual sale value) ──
      const { data: paidInvoices } = await supabase
        .from("financial_receivables")
        .select("id, company_id, description, paid_amount, amount, paid_date, contract_id")
        .in("status", ["paid", "received"])
        .gte("paid_date", format(startDate, "yyyy-MM-dd"))
        .lte("paid_date", format(endDate, "yyyy-MM-dd"));

      // ── Resolve project_id of each invoice via financial_contracts ──
      const contractIds = Array.from(
        new Set((paidInvoices || []).map((i: any) => i.contract_id).filter(Boolean) as string[]),
      );
      const contractToProject = new Map<string, string | null>();
      if (contractIds.length > 0) {
        const { data: contractsData } = await supabase
          .from("financial_contracts")
          .select("id, project_id")
          .in("id", contractIds);
        (contractsData || []).forEach((c: any) =>
          contractToProject.set(c.id, c.project_id || null),
        );
      }

      // ── Fetch all referenced projects (from contracts) + projects created in period ──
      const projectIdsFromInvoices = Array.from(
        new Set(Array.from(contractToProject.values()).filter(Boolean) as string[]),
      );

      const { data: projectsInPeriodRaw } = await supabase
        .from("onboarding_projects")
        .select("id, company_id, onboarding_company_id, product_name, consultant_id, created_at")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      // Normalize: use onboarding_company_id as fallback for company_id
      const projectsInPeriod = (projectsInPeriodRaw || []).map((p: any) => ({
        ...p,
        company_id: p.company_id || p.onboarding_company_id || null,
      }));

      let invoiceProjects: any[] = [];
      if (projectIdsFromInvoices.length > 0) {
        const { data: ip } = await supabase
          .from("onboarding_projects")
          .select("id, company_id, onboarding_company_id, product_name, consultant_id, created_at")
          .in("id", projectIdsFromInvoices);
        invoiceProjects = (ip || []).map((p: any) => ({
          ...p,
          company_id: p.company_id || p.onboarding_company_id || null,
        }));
      }
      const projectMap = new Map<string, any>();
      [...projectsInPeriod, ...invoiceProjects].forEach((p: any) =>
        projectMap.set(p.id, p),
      );

      // For classification: a company is "new" if it has NO project before this period
      const allInvolvedCompanyIds = Array.from(
        new Set([
          ...((projectsInPeriod || []).map((p: any) => p.company_id).filter(Boolean) as string[]),
          ...((paidInvoices || []).map((i: any) => i.company_id).filter(Boolean) as string[]),
        ]),
      );

      let companyHasPriorProject: Record<string, boolean> = {};
      if (allInvolvedCompanyIds.length > 0) {
        const { data: priorProjects } = await supabase
          .from("onboarding_projects")
          .select("company_id, created_at")
          .in("company_id", allInvolvedCompanyIds)
          .lt("created_at", startDate.toISOString());
        (priorProjects || []).forEach((p: any) => {
          if (p.company_id) companyHasPriorProject[p.company_id] = true;
        });
      }

      // ── Previous month total (paid invoices) for growth comparison ──
      const { data: prevPaid } = await supabase
        .from("financial_receivables")
        .select("paid_amount, amount")
        .in("status", ["paid", "received"])
        .gte("paid_date", format(prevStart, "yyyy-MM-dd"))
        .lte("paid_date", format(prevEnd, "yyyy-MM-dd"));

      const prevTotal = (prevPaid || []).reduce(
        (acc: number, r: any) => acc + Number(r.paid_amount || r.amount || 0),
        0,
      );
      setPreviousTotal(prevTotal);

      // Build staff name map
      const staffMap = new Map<string, string>();
      (staffList || []).forEach((s: any) => staffMap.set(s.id, s.name));
      const companyMap = new Map<string, string>();
      (companiesList || []).forEach((c: any) => companyMap.set(c.id, c.name));

      // Also fetch company consultant_id + created_at (used for new/existing classification)
      const { data: companiesFull } = await supabase
        .from("onboarding_companies")
        .select("id, consultant_id, created_at");
      const companyConsultant = new Map<string, string | null>();
      const companyCreatedAt = new Map<string, string>();
      (companiesFull || []).forEach((c: any) => {
        companyConsultant.set(c.id, c.consultant_id || null);
        if (c.created_at) companyCreatedAt.set(c.id, c.created_at);
      });

      // A company is considered NEW only if:
      //  1) it has no project created BEFORE the start of the period, AND
      //  2) it has no paid invoice BEFORE the start of the period, AND
      //  3) onboarding_companies.created_at falls within the period.
      // Otherwise it is EXISTING — even if a brand new project (e.g. an
      // additional service like "Sales Force") was opened during the period.
      const companiesWithPriorInvoice = new Set<string>();
      if (allInvolvedCompanyIds.length > 0) {
        const { data: priorPaid } = await supabase
          .from("financial_receivables")
          .select("company_id")
          .in("company_id", allInvolvedCompanyIds)
          .in("status", ["paid", "received"])
          .lt("paid_date", format(startDate, "yyyy-MM-dd"));
        (priorPaid || []).forEach((r: any) => {
          if (r.company_id) companiesWithPriorInvoice.add(r.company_id);
        });
      }

      const isCompanyNew = (cid: string | null): boolean => {
        if (!cid) return false;
        if (companyHasPriorProject[cid]) return false;
        if (companiesWithPriorInvoice.has(cid)) return false;
        const created = companyCreatedAt.get(cid);
        if (!created) return false;
        const createdDate = new Date(created);
        return createdDate >= startDate && createdDate <= endDate;
      };

      const sales: SaleRow[] = [];

      // Track which company_ids already had an invoice in this period (for upsell heuristic)
      const invoiceCountInPeriod: Record<string, number> = {};
      (paidInvoices || []).forEach((i: any) => {
        if (i.company_id) {
          invoiceCountInPeriod[i.company_id] = (invoiceCountInPeriod[i.company_id] || 0) + 1;
        }
      });

      // ── Build sales rows from PAID INVOICES (real sale value) ──
      // Classification rule:
      //  - The invoice belongs to a contract → contract → project.
      //  - If that project was created within the period AND the company had no
      //    prior project before the period → NEW CLIENT sale.
      //  - Otherwise → EXISTING CLIENT sale.
      //  - If the invoice has no contract/project, fall back to the company:
      //    company has prior project → existing; else → new.
      const projectsCovered = new Set<string>();

      (paidInvoices || []).forEach((i: any) => {
        const cid = i.company_id as string | null;
        const projectId = i.contract_id ? contractToProject.get(i.contract_id) || null : null;
        const project = projectId ? projectMap.get(projectId) : null;
        if (projectId) projectsCovered.add(projectId);

        // Classification depends ONLY on the company history,
        // not on whether a new project was opened in the period.
        const isNew = isCompanyNew(cid);

        const consId =
          (project?.consultant_id as string | null) ||
          (cid ? companyConsultant.get(cid) || null : null);
        const value = Number(i.paid_amount || i.amount || 0);

        let subtype: "renewal" | "upsell" | undefined;
        if (!isNew) {
          subtype = cid && invoiceCountInPeriod[cid] > 1 ? "upsell" : "renewal";
        }

        sales.push({
          id: `inv-${i.id}`,
          date: i.paid_date,
          amount: value,
          company_id: cid,
          company_name: cid ? companyMap.get(cid) || "—" : i.description || "—",
          product_name: project?.product_name || i.description || null,
          consultant_id: consId,
          consultant_name: consId ? staffMap.get(consId) || "—" : "—",
          source: "invoice",
          classification: isNew ? "new" : "existing",
          existing_subtype: subtype,
        });
      });

      // ── Add projects created in period that have NO paid invoice yet ──
      (projectsInPeriod || []).forEach((p: any) => {
        if (projectsCovered.has(p.id)) return;
        const cid = p.company_id;
        const isNew = isCompanyNew(cid);
        const consId = p.consultant_id || (cid ? companyConsultant.get(cid) : null) || null;
        sales.push({
          id: `proj-${p.id}`,
          date: p.created_at,
          amount: 0,
          company_id: cid,
          company_name: cid ? companyMap.get(cid) || "—" : "—",
          product_name: p.product_name || null,
          consultant_id: consId,
          consultant_name: consId ? staffMap.get(consId) || "—" : "—",
          source: "project",
          classification: isNew ? "new" : "existing",
        });
      });

      setAllSales(sales);
    } catch (err) {
      console.error("Failed to load sales report:", err);
      toast.error("Erro ao carregar relatório");
    } finally {
      setLoading(false);
    }
  }

  // ------ Apply secondary filters in memory ------
  const filteredSales = useMemo(() => {
    let rows = allSales;
    if (consultantFilter !== "all") {
      rows = rows.filter((r) => r.consultant_id === consultantFilter);
    }
    if (typeFilter !== "all") {
      rows = rows.filter((r) => r.classification === typeFilter);
    }
    if (companyFilter !== "all") {
      rows = rows.filter((r) => r.company_id === companyFilter);
    }
    const min = Number(minAmount);
    const max = Number(maxAmount);
    if (!Number.isNaN(min) && minAmount !== "") rows = rows.filter((r) => r.amount >= min);
    if (!Number.isNaN(max) && maxAmount !== "") rows = rows.filter((r) => r.amount <= max);
    return rows;
  }, [allSales, consultantFilter, typeFilter, companyFilter, minAmount, maxAmount]);

  // ------ KPIs ------
  const kpis = useMemo(() => {
    const withValue = filteredSales.filter((r) => r.amount > 0);
    const total = withValue.reduce((a, r) => a + r.amount, 0);
    const newRows = withValue.filter((r) => r.classification === "new");
    const existingRows = withValue.filter((r) => r.classification === "existing");

    // Distinct new clients (companies with project created in period AND no prior project)
    const newClientsSet = new Set(
      filteredSales
        .filter((r) => r.classification === "new" && r.source === "project")
        .map((r) => r.company_id)
        .filter(Boolean) as string[],
    );

    const newTotal = newRows.reduce((a, r) => a + r.amount, 0);
    const existingTotal = existingRows.reduce((a, r) => a + r.amount, 0);
    const avgTicket = withValue.length ? total / withValue.length : 0;
    const avgNew = newRows.length ? newTotal / newRows.length : 0;
    const avgExisting = existingRows.length ? existingTotal / existingRows.length : 0;
    const growth = previousTotal > 0 ? ((total - previousTotal) / previousTotal) * 100 : 0;

    return {
      total,
      newClientsCount: newClientsSet.size,
      newTotal,
      newCount: newRows.length,
      existingCount: existingRows.length,
      existingTotal,
      avgTicket,
      avgNew,
      avgExisting,
      growth,
    };
  }, [filteredSales, previousTotal]);

  // ------ Per company aggregation ------
  const perCompany = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number; type: "new" | "existing" }>();
    filteredSales
      .filter((r) => r.amount > 0)
      .forEach((r) => {
        const key = r.company_id || r.company_name;
        const cur = map.get(key);
        if (cur) {
          cur.total += r.amount;
          cur.count += 1;
          if (r.classification === "existing") cur.type = "existing";
        } else {
          map.set(key, { name: r.company_name, total: r.amount, count: 1, type: r.classification });
        }
      });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredSales]);

  // ------ Per consultant ------
  const perConsultant = useMemo(() => {
    const map = new Map<
      string,
      { name: string; count: number; total: number; newClients: Set<string>; existingCount: number }
    >();
    filteredSales.forEach((r) => {
      const key = r.consultant_id || "—";
      const name = r.consultant_name || "—";
      const cur = map.get(key) || {
        name,
        count: 0,
        total: 0,
        newClients: new Set<string>(),
        existingCount: 0,
      };
      cur.total += r.amount;
      if (r.amount > 0) cur.count += 1;
      if (r.classification === "new" && r.company_id) cur.newClients.add(r.company_id);
      if (r.classification === "existing" && r.amount > 0) cur.existingCount += 1;
      map.set(key, cur);
    });
    return Array.from(map.values())
      .map((v) => ({
        name: v.name,
        count: v.count,
        total: v.total,
        newClients: v.newClients.size,
        existingCount: v.existingCount,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredSales]);

  // ------ Charts data ------
  const chartTypeData = useMemo(
    () => [
      { name: "Novos Clientes", value: kpis.newTotal },
      { name: "Clientes Existentes", value: kpis.existingTotal },
    ],
    [kpis],
  );

  const chartDailyData = useMemo(() => {
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    const dayMap = new Map<string, number>();
    days.forEach((d) => dayMap.set(format(d, "yyyy-MM-dd"), 0));
    filteredSales
      .filter((r) => r.amount > 0)
      .forEach((r) => {
        const k = r.date.slice(0, 10);
        if (dayMap.has(k)) dayMap.set(k, (dayMap.get(k) || 0) + r.amount);
      });
    return Array.from(dayMap.entries()).map(([k, v]) => ({
      day: format(new Date(k + "T00:00:00"), "dd/MM"),
      receita: v,
    }));
  }, [filteredSales, startDate, endDate]);

  const chartProductData = useMemo(() => {
    const map = new Map<string, number>();
    filteredSales
      .filter((r) => r.amount > 0 && r.product_name)
      .forEach((r) => {
        const k = r.product_name as string;
        map.set(k, (map.get(k) || 0) + r.amount);
      });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filteredSales]);

  // ------ Insights ------
  const insights = useMemo(() => {
    const out: string[] = [];
    if (previousTotal > 0) {
      if (kpis.growth >= 0) {
        out.push(
          `Crescimento de ${kpis.growth.toFixed(1)}% em relação ao mês anterior (${formatBRL(previousTotal)} → ${formatBRL(kpis.total)}).`,
        );
      } else {
        out.push(
          `Queda de ${Math.abs(kpis.growth).toFixed(1)}% em relação ao mês anterior. Atenção à pipeline.`,
        );
      }
    }
    if (kpis.total > 0) {
      const existingShare = (kpis.existingTotal / kpis.total) * 100;
      if (existingShare >= 60) {
        out.push(
          `${existingShare.toFixed(0)}% do faturamento veio de clientes já existentes — base recorrente forte.`,
        );
      } else if (existingShare <= 30) {
        out.push(
          `${(100 - existingShare).toFixed(0)}% do faturamento veio de novos clientes — operação puxada por aquisição.`,
        );
      }
    }
    if (kpis.newClientsCount > 0) {
      out.push(`${kpis.newClientsCount} novo(s) cliente(s) adquirido(s) no período.`);
    } else {
      out.push("Nenhum novo cliente adquirido no período.");
    }
    // concentration: top 3 share
    if (perCompany.length >= 3 && kpis.total > 0) {
      const top3 = perCompany.slice(0, 3).reduce((a, c) => a + c.total, 0);
      const share = (top3 / kpis.total) * 100;
      if (share >= 60) {
        out.push(`Concentração: top 3 clientes = ${share.toFixed(0)}% da receita do período.`);
      }
    }
    return out;
  }, [kpis, previousTotal, perCompany]);

  // ------ Exports ------
  function exportExcel() {
    const wb = XLSX.utils.book_new();
    const summary = [
      ["Relatório de Vendas do Mês"],
      ["Período", `${format(startDate, "dd/MM/yyyy")} a ${format(endDate, "dd/MM/yyyy")}`],
      [],
      ["Total no Mês", kpis.total],
      ["Novos Clientes (qtd)", kpis.newClientsCount],
      ["Faturamento - Novos Clientes", kpis.newTotal],
      ["Vendas Existentes (qtd)", kpis.existingCount],
      ["Faturamento - Existentes", kpis.existingTotal],
      ["Ticket Médio", kpis.avgTicket],
      ["Crescimento vs Mês Anterior (%)", Number(kpis.growth.toFixed(2))],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Resumo");

    const salesSheet = filteredSales.map((r) => ({
      Data: format(new Date(r.date), "dd/MM/yyyy"),
      Empresa: r.company_name,
      Tipo: r.classification === "new" ? "Novo Cliente" : "Cliente Existente",
      Subtipo: r.existing_subtype || (r.source === "project" ? "Aquisição" : "—"),
      Produto: r.product_name || "—",
      Consultor: r.consultant_name,
      Valor: r.amount,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(salesSheet), "Vendas");

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        perConsultant.map((c) => ({
          Consultor: c.name,
          "Nº Vendas": c.count,
          "Valor Total": c.total,
          "Novos Clientes": c.newClients,
          "Vendas em Existentes": c.existingCount,
        })),
      ),
      "Por Consultor",
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        perCompany.map((c) => ({
          Empresa: c.name,
          Tipo: c.type === "new" ? "Novo" : "Recorrente",
          Compras: c.count,
          "Valor Total": c.total,
        })),
      ),
      "Por Cliente",
    );

    XLSX.writeFile(wb, `relatorio-vendas-${format(startDate, "yyyy-MM")}.xlsx`);
    toast.success("Excel exportado");
  }

  function exportPDF() {
    const doc = new jsPDF();
    let y = 15;
    doc.setFontSize(16);
    doc.text("Relatório de Vendas do Mês", 14, y);
    y += 7;
    doc.setFontSize(10);
    doc.text(
      `Período: ${format(startDate, "dd/MM/yyyy")} a ${format(endDate, "dd/MM/yyyy")}`,
      14,
      y,
    );
    y += 10;

    doc.setFontSize(12);
    doc.text("Indicadores principais", 14, y);
    y += 6;
    doc.setFontSize(10);
    const lines = [
      `Total no mês: ${formatBRL(kpis.total)}`,
      `Novos clientes: ${kpis.newClientsCount} (${formatBRL(kpis.newTotal)})`,
      `Vendas existentes: ${kpis.existingCount} (${formatBRL(kpis.existingTotal)})`,
      `Ticket médio: ${formatBRL(kpis.avgTicket)}`,
      `Crescimento vs mês anterior: ${kpis.growth.toFixed(1)}%`,
    ];
    lines.forEach((l) => {
      doc.text(l, 14, y);
      y += 6;
    });

    y += 4;
    doc.setFontSize(12);
    doc.text("Insights", 14, y);
    y += 6;
    doc.setFontSize(10);
    insights.forEach((i) => {
      const wrapped = doc.splitTextToSize(`• ${i}`, 180);
      doc.text(wrapped, 14, y);
      y += wrapped.length * 5;
    });

    y += 4;
    doc.setFontSize(12);
    doc.text("Top empresas (faturamento)", 14, y);
    y += 6;
    doc.setFontSize(10);
    perCompany.slice(0, 10).forEach((c) => {
      if (y > 280) {
        doc.addPage();
        y = 15;
      }
      doc.text(`${c.name} — ${formatBRL(c.total)} (${c.count} compras)`, 14, y);
      y += 5;
    });

    doc.save(`relatorio-vendas-${format(startDate, "yyyy-MM")}.pdf`);
    toast.success("PDF exportado");
  }

  // ------ Render ------
  if (authorized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  if (authorized === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Acesso restrito</CardTitle>
            <CardDescription>
              Este relatório está disponível apenas para Administradores e Master.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/onboarding-tasks")}>Voltar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const newSales = filteredSales.filter((r) => r.classification === "new");
  const existingSales = filteredSales.filter(
    (r) => r.classification === "existing" && r.amount > 0,
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Relatório de Vendas do Mês</h1>
              <p className="text-sm text-muted-foreground">
                Aquisição vs expansão, performance comercial e crescimento
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </Button>
            <Button variant="outline" size="sm" onClick={exportPDF}>
              <FileTextIcon className="h-4 w-4 mr-2" />
              PDF
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Período</label>
              <Select value={periodPreset} onValueChange={(v) => setPeriodPreset(v as PeriodPreset)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">Mês atual</SelectItem>
                  <SelectItem value="previous">Mês anterior</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {periodPreset === "custom" && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">De</label>
                  <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Até</label>
                  <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
                </div>
              </>
            )}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Consultor</label>
              <Select value={consultantFilter} onValueChange={setConsultantFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {consultants.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="new">Novos clientes</SelectItem>
                  <SelectItem value="existing">Clientes existentes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Empresa</label>
              <Select value={companyFilter} onValueChange={setCompanyFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Valor mín.</label>
              <Input type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Valor máx.</label>
              <Input type="number" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} placeholder="∞" />
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <KpiCard icon={DollarSign} label="Total no Mês" value={formatBRL(kpis.total)} color="text-primary" />
              <KpiCard
                icon={Users}
                label="Novos Clientes"
                value={`${kpis.newClientsCount}`}
                sub={formatBRL(kpis.newTotal)}
                color="text-emerald-500"
              />
              <KpiCard
                icon={Repeat}
                label="Vendas Existentes"
                value={`${kpis.existingCount}`}
                sub={formatBRL(kpis.existingTotal)}
                color="text-blue-500"
              />
              <KpiCard
                icon={Target}
                label="Ticket Médio"
                value={formatBRL(kpis.avgTicket)}
                sub={`Novos: ${formatBRL(kpis.avgNew)} • Exist.: ${formatBRL(kpis.avgExisting)}`}
                color="text-purple-500"
              />
              <KpiCard
                icon={kpis.growth >= 0 ? TrendingUp : TrendingDown}
                label="Crescimento vs Mês Anterior"
                value={`${kpis.growth >= 0 ? "+" : ""}${kpis.growth.toFixed(1)}%`}
                sub={`Anterior: ${formatBRL(previousTotal)}`}
                color={kpis.growth >= 0 ? "text-emerald-500" : "text-red-500"}
              />
            </div>

            {/* Insights */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  Insights do Mês
                </CardTitle>
              </CardHeader>
              <CardContent>
                {insights.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem dados suficientes para gerar insights.</p>
                ) : (
                  <ul className="space-y-2">
                    {insights.map((i, idx) => (
                      <li key={idx} className="flex gap-2 text-sm">
                        <span className="text-amber-500">•</span>
                        <span>{i}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Vendas por Tipo</CardTitle>
                </CardHeader>
                <CardContent style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={chartTypeData} dataKey="value" nameKey="name" outerRadius={80} label>
                        {chartTypeData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <RTooltip formatter={(v: any) => formatBRL(Number(v))} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Evolução de Receita</CardTitle>
                </CardHeader>
                <CardContent style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartDailyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis />
                      <RTooltip formatter={(v: any) => formatBRL(Number(v))} />
                      <Line type="monotone" dataKey="receita" stroke="hsl(var(--primary))" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="lg:col-span-3">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Receita por Produto (Top 8)</CardTitle>
                </CardHeader>
                <CardContent style={{ height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartProductData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} height={60} />
                      <YAxis />
                      <RTooltip formatter={(v: any) => formatBRL(Number(v))} />
                      <Bar dataKey="value" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Blocos novos vs existentes */}
            <Tabs defaultValue="new" className="w-full">
              <TabsList>
                <TabsTrigger value="new">Vendas para Novos Clientes</TabsTrigger>
                <TabsTrigger value="existing">Vendas para Clientes Existentes</TabsTrigger>
                <TabsTrigger value="byClient">Receita por Cliente</TabsTrigger>
                <TabsTrigger value="byConsultant">Performance por Consultor</TabsTrigger>
              </TabsList>

              <TabsContent value="new">
                <Card>
                  <CardHeader>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div><span className="text-muted-foreground">Total de vendas:</span> <strong>{newSales.length}</strong></div>
                      <div><span className="text-muted-foreground">Valor total:</span> <strong>{formatBRL(kpis.newTotal)}</strong></div>
                      <div><span className="text-muted-foreground">Ticket médio:</span> <strong>{formatBRL(kpis.avgNew)}</strong></div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <SalesTable rows={newSales} variant="new" />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="existing">
                <Card>
                  <CardHeader>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div><span className="text-muted-foreground">Total de vendas:</span> <strong>{existingSales.length}</strong></div>
                      <div><span className="text-muted-foreground">Valor total:</span> <strong>{formatBRL(kpis.existingTotal)}</strong></div>
                      <div><span className="text-muted-foreground">Ticket médio:</span> <strong>{formatBRL(kpis.avgExisting)}</strong></div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <SalesTable rows={existingSales} variant="existing" />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="byClient">
                <Card>
                  <CardContent className="pt-6 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Empresa</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead className="text-right">Compras</TableHead>
                          <TableHead className="text-right">Faturamento</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {perCompany.length === 0 ? (
                          <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Sem dados</TableCell></TableRow>
                        ) : perCompany.map((c, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{c.name}</TableCell>
                            <TableCell>
                              <Badge variant={c.type === "new" ? "default" : "secondary"}>
                                {c.type === "new" ? "Novo" : "Recorrente"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{c.count}</TableCell>
                            <TableCell className="text-right font-semibold">{formatBRL(c.total)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="byConsultant">
                <Card>
                  <CardContent className="pt-6 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Consultor</TableHead>
                          <TableHead className="text-right">Nº Vendas</TableHead>
                          <TableHead className="text-right">Valor Total</TableHead>
                          <TableHead className="text-right">Novos Clientes</TableHead>
                          <TableHead className="text-right">Vendas em Existentes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {perConsultant.length === 0 ? (
                          <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sem dados</TableCell></TableRow>
                        ) : perConsultant.map((c, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{c.name}</TableCell>
                            <TableCell className="text-right">{c.count}</TableCell>
                            <TableCell className="text-right font-semibold">{formatBRL(c.total)}</TableCell>
                            <TableCell className="text-right">{c.newClients}</TableCell>
                            <TableCell className="text-right">{c.existingCount}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "text-primary",
}: {
  icon: any;
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function SalesTable({ rows, variant }: { rows: SaleRow[]; variant: "new" | "existing" }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Sem vendas no período.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Empresa</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Produto</TableHead>
            {variant === "existing" && <TableHead>Tipo</TableHead>}
            <TableHead>Consultor</TableHead>
            <TableHead className="text-right">Valor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.company_name}</TableCell>
              <TableCell>{format(new Date(r.date), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
              <TableCell>{r.product_name || "—"}</TableCell>
              {variant === "existing" && (
                <TableCell>
                  <Badge variant="outline">
                    {r.existing_subtype === "upsell" ? "Upsell" : "Renovação"}
                  </Badge>
                </TableCell>
              )}
              <TableCell>{r.consultant_name}</TableCell>
              <TableCell className="text-right font-semibold">
                {r.amount > 0 ? formatBRL(r.amount) : <span className="text-muted-foreground text-xs">— (projeto)</span>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
