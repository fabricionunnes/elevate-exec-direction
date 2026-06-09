import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  FileCheck, Loader2, Send, RefreshCw, DollarSign, Users, UserMinus,
  Star, AlertTriangle, Landmark, TrendingUp,
} from "lucide-react";
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  subWeeks, subMonths, format,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface Props {
  invoices: any[];
  payables: any[];
  formatCurrency: (v: number) => string;
  formatCurrencyCents: (v: number) => string;
}

type PeriodOption = "this_week" | "last_week" | "this_month" | "last_month";

const PERIOD_LABELS: Record<PeriodOption, string> = {
  this_week: "Esta semana",
  last_week: "Semana passada",
  this_month: "Este mês",
  last_month: "Mês passado",
};

function getPeriodRange(period: PeriodOption): { start: Date; end: Date } {
  const now = new Date();
  switch (period) {
    case "this_week":
      return { start: startOfWeek(now, { locale: ptBR }), end: endOfWeek(now, { locale: ptBR }) };
    case "last_week": {
      const prev = subWeeks(now, 1);
      return { start: startOfWeek(prev, { locale: ptBR }), end: endOfWeek(prev, { locale: ptBR }) };
    }
    case "this_month":
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case "last_month": {
      const prev = subMonths(now, 1);
      return { start: startOfMonth(prev), end: endOfMonth(prev) };
    }
  }
}

export default function FinancialRelatorioExecutivoTab({ invoices, payables, formatCurrency, formatCurrencyCents }: Props) {
  const [period, setPeriod] = useState<PeriodOption>("this_month");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Extra data fetched here
  const [banks, setBanks] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [npsAvg, setNpsAvg] = useState<number | null>(null);
  const [masterPhone, setMasterPhone] = useState<string | null>(null);
  const [whatsappInstance, setWhatsappInstance] = useState<any>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [banksRes, companiesRes, staffRes] = await Promise.all([
        supabase.from("financial_banks").select("id, name, current_balance_cents, is_active").eq("is_active", true),
        supabase.from("onboarding_companies").select("id, name, status, created_at, updated_at, consultant_id, cs_id, contract_value").eq("is_simulator" as any, false),
        supabase.from("onboarding_staff").select("id, name, role, phone").eq("is_active", true).in("role", ["master", "admin", "consultant", "cs"]),
      ]);

      if (!banksRes.error) setBanks(banksRes.data || []);
      if (!companiesRes.error) setCompanies((companiesRes.data as any) || []);
      if (!staffRes.error) setStaff(staffRes.data || []);

      // NPS - try nps_responses first, then nps_results
      try {
        const { data: npsData, error: npsErr } = await (supabase as any)
          .from("nps_responses")
          .select("score")
          .limit(1000);
        if (!npsErr && npsData && npsData.length > 0) {
          const avg = npsData.reduce((s: number, r: any) => s + (r.score || 0), 0) / npsData.length;
          setNpsAvg(Math.round(avg * 10) / 10);
        } else {
          throw new Error("try nps_results");
        }
      } catch {
        try {
          const { data: npsData2 } = await (supabase as any)
            .from("nps_results")
            .select("score")
            .limit(1000);
          if (npsData2 && npsData2.length > 0) {
            const avg = npsData2.reduce((s: number, r: any) => s + (r.score || 0), 0) / npsData2.length;
            setNpsAvg(Math.round(avg * 10) / 10);
          }
        } catch { /* silent */ }
      }

      // Master phone
      try {
        const { data: masterData } = await supabase
          .from("onboarding_staff")
          .select("phone")
          .eq("role" as any, "master")
          .eq("is_active", true)
          .limit(1)
          .single();
        if (masterData) setMasterPhone((masterData as any).phone || null);
      } catch { /* silent */ }

      // WhatsApp instance from crm_settings -> whatsapp_instances
      try {
        const { data: settingData } = await (supabase as any)
          .from("crm_settings")
          .select("setting_value")
          .eq("setting_key", "lead_notification_instance_name")
          .maybeSingle();
        if (settingData?.setting_value) {
          const { data: instanceData } = await (supabase as any)
            .from("whatsapp_instances")
            .select("*")
            .eq("instance_name", settingData.setting_value)
            .maybeSingle();
          if (instanceData) setWhatsappInstance(instanceData);
        }
      } catch { /* silent */ }
    } catch (err) {
      console.error("Erro ao carregar relatório executivo:", err);
      toast.error("Erro ao carregar relatório");
    } finally {
      setLoading(false);
    }
  };

  const { start, end } = useMemo(() => getPeriodRange(period), [period]);

  // Receita do período (paid invoices)
  const periodRevenueCents = useMemo(() => {
    return invoices
      .filter((inv) => {
        if (inv.status !== "paid" && inv.status !== "partial") return false;
        const paidAt = inv.paid_at;
        if (!paidAt) return false;
        const d = new Date(paidAt.substring(0, 10) + "T12:00:00");
        return d >= start && d <= end;
      })
      .reduce((s, inv) => s + (inv.paid_amount_cents || inv.amount_cents || 0), 0);
  }, [invoices, start, end]);

  // Novos clientes no período
  const newClients = useMemo(() => {
    return companies.filter((c) => {
      if (!c.created_at) return false;
      const d = new Date(c.created_at);
      return d >= start && d <= end;
    });
  }, [companies, start, end]);

  // Churn no período
  const churnedClients = useMemo(() => {
    return companies.filter((c) => {
      const isChurned = c.status === "churned" || c.status === "cancelled" || c.status === "inactive";
      if (!isChurned) return false;
      if (!c.updated_at) return true;
      const d = new Date(c.updated_at);
      return d >= start && d <= end;
    });
  }, [companies, start, end]);

  // Inadimplência total (overdue)
  const overdueAmountCents = useMemo(() => {
    return invoices
      .filter((inv) => inv.status === "overdue")
      .reduce((s, inv) => s + (inv.amount_cents || 0), 0);
  }, [invoices]);

  // Caixa atual
  const totalCashCents = useMemo(() => {
    return banks.reduce((s, b) => s + (b.current_balance_cents || 0), 0);
  }, [banks]);

  // KPIs do time UNV (consultores e CS) — clientes ativos + MRR por pessoa
  const teamKpis = useMemo(() => {
    if (!staff.length) return [];
    const activeCompanies = companies.filter(c => c.status === "active" || c.status === "onboarding");
    return staff.map((member) => {
      const myCompanies = activeCompanies.filter(c =>
        c.consultant_id === member.id || c.cs_id === member.id
      );
      const mrr = myCompanies.reduce((s: number, c: any) => s + (c.contract_value || 0), 0);
      // Novos clientes no período atribuídos a este membro
      const newInPeriod = myCompanies.filter(c => {
        if (!c.created_at) return false;
        const d = new Date(c.created_at);
        return d >= start && d <= end;
      }).length;
      return { name: member.name, role: member.role, totalClients: myCompanies.length, mrr, newInPeriod };
    }).filter(r => r.totalClients > 0);
  }, [staff, companies, start, end]);

  // Clientes em risco (NPS baixo ou pagamentos atrasados)
  const atRiskCompanies = useMemo(() => {
    const overdueCompanyIds = new Set(
      invoices
        .filter((inv) => inv.status === "overdue" && inv.company_id)
        .map((inv) => inv.company_id)
    );
    return companies
      .filter((c) => {
        return overdueCompanyIds.has(c.id);
      })
      .map((c) => {
        const overdueCount = invoices.filter(
          (inv) => inv.status === "overdue" && inv.company_id === c.id
        ).length;
        return { name: c.name, overdueCount, nps: null as number | null };
      })
      .slice(0, 10);
  }, [companies, invoices]);

  const periodLabel = useMemo(() => {
    const fmt = (d: Date) => format(d, "dd/MM", { locale: ptBR });
    return `${fmt(start)} a ${fmt(end)}`;
  }, [start, end]);

  const buildWhatsAppMessage = () => {
    const header = `📊 *RELATÓRIO EXECUTIVO UNV*\n_${PERIOD_LABELS[period]} | ${periodLabel}_\n\n`;
    const cards = [
      `💰 *Receita:* ${formatCurrencyCents(periodRevenueCents)}`,
      `👥 *Novos clientes:* ${newClients.length}`,
      `❌ *Churn:* ${churnedClients.length}`,
      npsAvg !== null ? `⭐ *NPS médio:* ${npsAvg.toFixed(1)}` : null,
      `🏦 *Caixa atual:* ${formatCurrencyCents(totalCashCents)}`,
      overdueAmountCents > 0 ? `⚠️ *Inadimplência:* ${formatCurrencyCents(overdueAmountCents)}` : null,
    ].filter(Boolean).join("\n");

    let kpisSection = "";
    if (teamKpis.length > 0) {
      const lines = teamKpis.map(
        (k) => `• ${k.name}: ${k.totalClients} cliente(s) | MRR R$ ${k.mrr.toLocaleString("pt-BR")}${k.newInPeriod > 0 ? ` | +${k.newInPeriod} novo(s)` : ""}`
      );
      kpisSection = `\n\n👥 *TIME UNV*\n${lines.join("\n")}`;
    }

    let riskSection = "";
    if (atRiskCompanies.length > 0) {
      const lines = atRiskCompanies.map(
        (c) =>
          `• ${c.name}${c.overdueCount > 0 ? ` - ${c.overdueCount} fatura(s) em atraso` : ""}${c.nps !== null ? ` - NPS: ${c.nps}` : ""}`
      );
      riskSection = `\n\n🔴 *CLIENTES EM RISCO*\n${lines.join("\n")}`;
    }

    return header + cards + kpisSection + riskSection;
  };

  const handleSendWhatsApp = async () => {
    if (!masterPhone) {
      toast.error("Telefone do usuário master não encontrado");
      return;
    }
    setSending(true);
    try {
      const message = buildWhatsAppMessage();

      if (whatsappInstance?.api_url && whatsappInstance?.instance_name && whatsappInstance?.api_key) {
        const resp = await fetch(
          `${whatsappInstance.api_url}/message/sendText/${whatsappInstance.instance_name}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: whatsappInstance.api_key,
            },
            body: JSON.stringify({ number: masterPhone, text: message }),
          }
        );
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        toast.success("Relatório enviado por WhatsApp!");
      } else {
        // Fallback: use edge function
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Não autenticado");
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-api?action=send-text`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({ number: masterPhone, text: message }),
          }
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        toast.success("Relatório enviado por WhatsApp!");
      }
    } catch (err: any) {
      toast.error("Erro ao enviar: " + (err.message || "erro desconhecido"));
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileCheck className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">Relatório Executivo</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodOption)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(PERIOD_LABELS) as [PeriodOption, string][]).map(([k, label]) => (
                <SelectItem key={k} value={k}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Atualizar
          </Button>
          <Button size="sm" onClick={handleSendWhatsApp} disabled={sending}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Enviar por WhatsApp
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {PERIOD_LABELS[period]} — {periodLabel}
      </p>

      {/* Cards de destaque */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              <p className="text-xs text-muted-foreground">Receita</p>
            </div>
            <p className="text-lg font-bold text-emerald-600">{formatCurrencyCents(periodRevenueCents)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-blue-500" />
              <p className="text-xs text-muted-foreground">Novos Clientes</p>
            </div>
            <p className="text-lg font-bold text-blue-600">{newClients.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <UserMinus className="h-4 w-4 text-red-500" />
              <p className="text-xs text-muted-foreground">Churn</p>
            </div>
            <p className="text-lg font-bold text-red-600">{churnedClients.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Star className="h-4 w-4 text-amber-500" />
              <p className="text-xs text-muted-foreground">NPS Médio</p>
            </div>
            <p className="text-lg font-bold text-amber-600">
              {npsAvg !== null ? npsAvg.toFixed(1) : "—"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Landmark className="h-4 w-4 text-indigo-500" />
              <p className="text-xs text-muted-foreground">Caixa Atual</p>
            </div>
            <p className="text-lg font-bold text-indigo-600">{formatCurrencyCents(totalCashCents)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <p className="text-xs text-muted-foreground">Inadimplência</p>
            </div>
            <p className="text-lg font-bold text-orange-600">{formatCurrencyCents(overdueAmountCents)}</p>
          </CardContent>
        </Card>
      </div>

      {/* KPIs do Time */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Time UNV — Clientes & MRR
          </CardTitle>
        </CardHeader>
        <CardContent>
          {teamKpis.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum dado de KPI encontrado para o período.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Consultor / CS</TableHead>
                  <TableHead className="text-right">Clientes Ativos</TableHead>
                  <TableHead className="text-right">MRR</TableHead>
                  <TableHead className="text-right">Novos no período</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamKpis.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">
                      <div>
                        <p>{row.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{row.role}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{row.totalClients}</TableCell>
                    <TableCell className="text-right text-emerald-500 font-semibold">
                      {formatCurrency(row.mrr)}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.newInPeriod > 0 ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                          +{row.newInPeriod}
                        </Badge>
                      ) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Clientes em risco */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            Clientes em Risco
          </CardTitle>
        </CardHeader>
        <CardContent>
          {atRiskCompanies.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum cliente em risco identificado.
            </p>
          ) : (
            <div className="space-y-2">
              {atRiskCompanies.map((c, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg border bg-red-500/5 border-red-500/20">
                  <span className="font-medium text-sm">{c.name}</span>
                  <div className="flex items-center gap-2">
                    {c.overdueCount > 0 && (
                      <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20 text-xs">
                        {c.overdueCount} fatura{c.overdueCount > 1 ? "s" : ""} em atraso
                      </Badge>
                    )}
                    {c.nps !== null && c.nps < 7 && (
                      <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20 text-xs">
                        NPS: {c.nps}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
