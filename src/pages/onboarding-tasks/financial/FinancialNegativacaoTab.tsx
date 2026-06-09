import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShieldAlert, Loader2, MessageSquare, Scale, AlertTriangle, Gavel, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  invoices: any[];
  payables: any[];
  formatCurrency: (v: number) => string;
  formatCurrencyCents: (v: number) => string;
}

interface CompanyDebt {
  company_id: string;
  company_name: string;
  diasAtraso: number;
  totalCents: number;
  invoiceCount: number;
  estagio: "aviso" | "cobranca" | "juridico" | "protesto";
  minDueDate: string;
}

const getEstagio = (dias: number): CompanyDebt["estagio"] => {
  if (dias < 15) return "aviso";
  if (dias < 30) return "cobranca";
  if (dias < 60) return "juridico";
  return "protesto";
};

const ESTAGIOS: { key: CompanyDebt["estagio"]; label: string; range: string; color: string; bg: string; border: string; icon: React.ReactNode }[] = [
  {
    key: "aviso",
    label: "Aviso Amigável",
    range: "1–14 dias",
    color: "text-yellow-700",
    bg: "bg-yellow-50 dark:bg-yellow-950/30",
    border: "border-yellow-300 dark:border-yellow-700",
    icon: <AlertTriangle className="h-4 w-4 text-yellow-600" />,
  },
  {
    key: "cobranca",
    label: "Cobrança Formal",
    range: "15–29 dias",
    color: "text-orange-700",
    bg: "bg-orange-50 dark:bg-orange-950/30",
    border: "border-orange-300 dark:border-orange-700",
    icon: <MessageSquare className="h-4 w-4 text-orange-600" />,
  },
  {
    key: "juridico",
    label: "Jurídico",
    range: "30–59 dias",
    color: "text-purple-700",
    bg: "bg-purple-50 dark:bg-purple-950/30",
    border: "border-purple-300 dark:border-purple-700",
    icon: <Scale className="h-4 w-4 text-purple-600" />,
  },
  {
    key: "protesto",
    label: "Protesto",
    range: "60+ dias",
    color: "text-red-700",
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-300 dark:border-red-700",
    icon: <Gavel className="h-4 w-4 text-red-600" />,
  },
];

export default function FinancialNegativacaoTab({ invoices, payables, formatCurrency, formatCurrencyCents }: Props) {
  const [loading, setLoading] = useState(false);
  const [juridicoIds, setJuridicoIds] = useState<Set<string>>(new Set());
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [companyPhones, setCompanyPhones] = useState<Map<string, string>>(new Map());

  const today = new Date().toISOString().split("T")[0];

  // Compute overdue companies from invoices prop
  const overdueCompanies = useMemo<CompanyDebt[]>(() => {
    const overdueInvoices = invoices.filter(
      (inv) => inv.status === "overdue" || (inv.status === "pending" && inv.due_date < today)
    );

    const grouped = new Map<string, { name: string; totalCents: number; count: number; minDueDate: string }>();

    for (const inv of overdueInvoices) {
      if (!inv.company_id) continue;
      const existing = grouped.get(inv.company_id);
      if (existing) {
        existing.totalCents += inv.amount_cents || 0;
        existing.count += 1;
        if (inv.due_date < existing.minDueDate) existing.minDueDate = inv.due_date;
      } else {
        grouped.set(inv.company_id, {
          name: inv.company_name || "Empresa desconhecida",
          totalCents: inv.amount_cents || 0,
          count: 1,
          minDueDate: inv.due_date,
        });
      }
    }

    const now = new Date();
    return Array.from(grouped.entries()).map(([cid, data]) => {
      const diasAtraso = Math.floor(
        (now.getTime() - new Date(data.minDueDate + "T12:00:00").getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        company_id: cid,
        company_name: data.name,
        diasAtraso,
        totalCents: data.totalCents,
        invoiceCount: data.count,
        estagio: getEstagio(diasAtraso),
        minDueDate: data.minDueDate,
      };
    }).sort((a, b) => b.diasAtraso - a.diasAtraso);
  }, [invoices, today]);

  // Load juridico IDs and company phones
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const cids = overdueCompanies.map((c) => c.company_id);
        if (cids.length === 0) { setLoading(false); return; }

        const [jurRes, phonesRes] = await Promise.all([
          supabase.from("juridico_clientes").select("company_id").in("company_id", cids),
          supabase.from("onboarding_companies").select("id, phone").in("id", cids),
        ]);

        setJuridicoIds(new Set((jurRes.data || []).map((r: any) => r.company_id).filter(Boolean)));
        const pMap = new Map<string, string>();
        for (const c of phonesRes.data || []) {
          if (c.phone) pMap.set(c.id, c.phone);
        }
        setCompanyPhones(pMap);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [overdueCompanies]);

  const sendWhatsApp = async (company: CompanyDebt, message: string) => {
    const phone = companyPhones.get(company.company_id);
    if (!phone) {
      toast.error(`Telefone não cadastrado para ${company.company_name}`);
      return;
    }

    setSendingId(company.company_id);
    try {
      // Get WhatsApp instance
      const { data: setting } = await supabase
        .from("crm_settings")
        .select("setting_value")
        .eq("setting_key", "lead_notification_instance_name")
        .maybeSingle();
      const instanceName = (setting as any)?.setting_value || "fabricionunnes";

      const { data: instance } = await supabase
        .from("whatsapp_instances")
        .select("instance_name, api_url, api_key")
        .eq("instance_name", instanceName)
        .maybeSingle();

      if (!instance) {
        toast.error("Instância WhatsApp não encontrada");
        return;
      }

      const res = await fetch(`${(instance as any).api_url}/message/sendText/${(instance as any).instance_name}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: (instance as any).api_key,
        },
        body: JSON.stringify({ number: phone, text: message }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(`Mensagem enviada para ${company.company_name}`);
    } catch (err: any) {
      toast.error(`Erro ao enviar: ${err.message || "erro desconhecido"}`);
    } finally {
      setSendingId(null);
    }
  };

  const buildMessage = (company: CompanyDebt): string => {
    const valor = formatCurrencyCents(company.totalCents);
    const n = company.invoiceCount;
    const dias = company.diasAtraso;
    const nome = company.company_name;

    switch (company.estagio) {
      case "aviso":
        return `Olá ${nome}, identificamos que há ${n} fatura(s) em aberto totalizando ${valor}. Por favor, regularize para evitar restrições. Qualquer dúvida estamos à disposição.`;
      case "cobranca":
        return `${nome}, suas faturas somam ${valor} e estão ${dias} dias em atraso. Solicitamos a regularização urgente para evitar encaminhamento ao setor jurídico.`;
      case "juridico":
        return `${nome}, informamos que seu débito de ${valor} foi encaminhado ao nosso setor jurídico. Para evitar maiores complicações, entre em contato imediatamente.`;
      default:
        return `${nome}, seu débito de ${valor} encontra-se em processo de protesto. Entre em contato imediatamente para regularização.`;
    }
  };

  const handleAction = async (company: CompanyDebt) => {
    if (company.estagio === "juridico") {
      if (juridicoIds.has(company.company_id)) {
        toast.info(`${company.company_name} já está no Jurídico`);
        return;
      }
      setSendingId(company.company_id);
      try {
        await supabase
          .from("juridico_clientes")
          .upsert({ company_id: company.company_id, company_name: company.company_name }, { onConflict: "company_id" });
        setJuridicoIds((prev) => new Set([...prev, company.company_id]));
        toast.success(`${company.company_name} enviada ao Jurídico`);
        // Best-effort WhatsApp notification
        await sendWhatsApp(company, buildMessage(company)).catch(() => {});
      } catch (err: any) {
        toast.error(`Erro: ${err.message}`);
      } finally {
        setSendingId(null);
      }
      return;
    }

    if (company.estagio === "protesto") {
      setSendingId(company.company_id);
      toast.success(`Protesto registrado para ${company.company_name}`);
      setSendingId(null);
      return;
    }

    // aviso or cobranca — send WhatsApp
    await sendWhatsApp(company, buildMessage(company));
  };

  const getActionLabel = (company: CompanyDebt): string => {
    if (company.estagio === "aviso") return "Enviar Aviso";
    if (company.estagio === "cobranca") return "Enviar Cobrança";
    if (company.estagio === "juridico") return juridicoIds.has(company.company_id) ? "No Jurídico" : "Enviar ao Jurídico";
    return "Marcar Protesto";
  };

  const byEstagio = useMemo(() => {
    const map: Record<string, CompanyDebt[]> = { aviso: [], cobranca: [], juridico: [], protesto: [] };
    for (const c of overdueCompanies) map[c.estagio].push(c);
    return map;
  }, [overdueCompanies]);

  const totalInadimplencia = overdueCompanies.reduce((s, c) => s + c.totalCents, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-6 w-6 text-destructive" />
          <div>
            <h2 className="text-lg font-semibold">Régua de Negativação</h2>
            <p className="text-sm text-muted-foreground">
              {overdueCompanies.length} empresa(s) inadimplente(s) —{" "}
              <span className="font-medium text-destructive">{formatCurrencyCents(totalInadimplencia)}</span> em aberto
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {overdueCompanies.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <ShieldAlert className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-base font-medium">Nenhuma inadimplência encontrada</p>
            <p className="text-sm mt-1">Todos os clientes estão em dia.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {ESTAGIOS.map((estagio) => {
            const companies = byEstagio[estagio.key] || [];
            const totalColuna = companies.reduce((s, c) => s + c.totalCents, 0);

            return (
              <div key={estagio.key} className="flex flex-col gap-3">
                {/* Column header */}
                <div className={`rounded-lg border p-3 ${estagio.bg} ${estagio.border}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {estagio.icon}
                      <span className={`text-sm font-semibold ${estagio.color}`}>{estagio.label}</span>
                    </div>
                    <Badge variant="outline" className={`text-xs ${estagio.color} border-current`}>
                      {companies.length}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{estagio.range}</p>
                  {companies.length > 0 && (
                    <p className={`text-sm font-bold mt-1 ${estagio.color}`}>
                      {formatCurrencyCents(totalColuna)}
                    </p>
                  )}
                </div>

                {/* Cards */}
                <div className="flex flex-col gap-2">
                  {companies.length === 0 && (
                    <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                      Nenhum cliente
                    </div>
                  )}
                  {companies.map((company) => {
                    const isSending = sendingId === company.company_id;
                    const isJuridico = estagio.key === "juridico" && juridicoIds.has(company.company_id);
                    const actionLabel = getActionLabel(company);
                    const hasPhone = companyPhones.has(company.company_id);

                    return (
                      <Card
                        key={company.company_id}
                        className={`transition-shadow hover:shadow-md ${estagio.border} border`}
                      >
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold leading-tight line-clamp-2">
                              {company.company_name}
                            </p>
                            <Badge
                              variant="outline"
                              className={`shrink-0 text-xs ${estagio.color} border-current`}
                            >
                              {company.diasAtraso}d
                            </Badge>
                          </div>

                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{company.invoiceCount} fatura(s)</span>
                            <span className="font-medium text-foreground">
                              {formatCurrencyCents(company.totalCents)}
                            </span>
                          </div>

                          {!hasPhone && estagio.key !== "protesto" && (
                            <p className="text-xs text-amber-600">Sem telefone cadastrado</p>
                          )}

                          {isJuridico ? (
                            <Badge
                              variant="outline"
                              className="w-full justify-center text-xs text-purple-700 border-purple-300"
                            >
                              Já no Jurídico
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className={`w-full text-xs h-7 ${estagio.color} border-current hover:bg-current/10`}
                              onClick={() => handleAction(company)}
                              disabled={isSending}
                            >
                              {isSending ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              ) : (
                                <>
                                  {(estagio.key === "aviso" || estagio.key === "cobranca") && (
                                    <MessageSquare className="h-3 w-3 mr-1" />
                                  )}
                                  {estagio.key === "juridico" && <Scale className="h-3 w-3 mr-1" />}
                                  {estagio.key === "protesto" && <Gavel className="h-3 w-3 mr-1" />}
                                </>
                              )}
                              {actionLabel}
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
