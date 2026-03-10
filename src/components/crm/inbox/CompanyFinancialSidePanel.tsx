import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Building2,
  ChevronRight,
  Receipt,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  ExternalLink,
  Sparkles,
  Send,
} from "lucide-react";
import { format, isPast, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { IdentifiedCompany, CompanyInvoice } from "@/hooks/useCompanyIdentification";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CompanyFinancialSidePanelProps {
  company: IdentifiedCompany | null;
  invoices: CompanyInvoice[];
  loading: boolean;
  loadingInvoices: boolean;
  onAnalyzeReceipt?: (invoiceId: string, mediaUrl: string) => void;
  contactPhone?: string | null;
  instanceId?: string | null;
  officialInstanceId?: string | null;
}

export function CompanyFinancialSidePanel({
  company,
  invoices,
  loading,
  loadingInvoices,
  onAnalyzeReceipt,
  contactPhone,
  instanceId,
  officialInstanceId,
}: CompanyFinancialSidePanelProps) {
  const [companyOpen, setCompanyOpen] = useState(true);
  const [invoicesOpen, setInvoicesOpen] = useState(true);
  const [sendingLinkId, setSendingLinkId] = useState<string | null>(null);

  const handleResendLink = async (invoice: CompanyInvoice) => {
    if (!contactPhone || !invoice.payment_link_url) return;
    
    setSendingLinkId(invoice.id);
    try {
      const amountFormatted = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(invoice.amount_cents / 100);
      const dueDateFormatted = format(parseISO(invoice.due_date), "dd/MM/yyyy");
      const companyName = company?.name || "";
      
      const msg = `Olá ${companyName}!\n\nSegue o link de pagamento da sua fatura:\n\n📄 *${invoice.description}*\n💰 *Valor:* ${amountFormatted}\n📅 *Vencimento:* ${dueDateFormatted}\n\n🔗 ${invoice.payment_link_url}`;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Sessão expirada"); return; }

      // Try Evolution API first, then Official
      if (instanceId) {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-api?action=send-text`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ instanceId, phone: contactPhone, message: msg }),
        });
        if (!response.ok) throw new Error("Erro ao enviar");
      } else if (officialInstanceId) {
        const { error } = await supabase.functions.invoke("whatsapp-official-api", {
          body: { action: "sendText", instanceId: officialInstanceId, phone: contactPhone, message: msg },
        });
        if (error) throw error;
      } else {
        // Fallback: use default instance
        const { data: defaultConfig } = await supabase
          .from("whatsapp_default_config")
          .select("setting_value")
          .eq("setting_key", "default_instance")
          .limit(1)
          .maybeSingle();
        const instanceName = (defaultConfig as any)?.setting_value;
        if (!instanceName) { toast.error("Nenhuma instância configurada"); return; }
        
        const { data: inst } = await supabase.from("whatsapp_instances").select("id").eq("instance_name", instanceName).maybeSingle();
        if (!inst) { toast.error("Instância não encontrada"); return; }

        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-api?action=send-text`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ instanceId: inst.id, phone: contactPhone, message: msg }),
        });
        if (!response.ok) throw new Error("Erro ao enviar");
      }

      toast.success("Link enviado por WhatsApp!");
    } catch (err: any) {
      console.error("Error resending link:", err);
      toast.error(err.message || "Erro ao enviar link");
    } finally {
      setSendingLinkId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-4 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Building2 className="h-5 w-5 text-primary" />
          <span>Identificação Financeira</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Buscando empresa pelo telefone...
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="p-4 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2 text-sm font-medium mb-2">
          <Building2 className="h-5 w-5 text-primary" />
          <span>Identificação Financeira</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-background rounded-md p-2.5 border border-border">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          <span>Nenhuma empresa identificada para este telefone. Verifique se o telefone do contato está cadastrado na empresa.</span>
        </div>
      </div>
    );
  }

  const overdueInvoices = invoices.filter(inv => inv.status === "overdue" || (inv.status === "pending" && isPast(parseISO(inv.due_date))));
  const pendingInvoices = invoices.filter(inv => inv.status === "pending" && !isPast(parseISO(inv.due_date)));
  const paidInvoices = invoices.filter(inv => inv.status === "paid");
  const openInvoices = invoices.filter(inv => inv.status !== "paid");

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  const getStatusBadge = (invoice: CompanyInvoice) => {
    const isOverdue = invoice.status === "overdue" || (invoice.status === "pending" && isPast(parseISO(invoice.due_date)));
    
    if (isOverdue) {
      return (
        <Badge variant="destructive" className="text-[10px] h-5">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Atrasada
        </Badge>
      );
    }
    if (invoice.status === "pending") {
      return (
        <Badge variant="outline" className="text-[10px] h-5 bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
          <Clock className="h-3 w-3 mr-1" />
          Pendente
        </Badge>
      );
    }
    if (invoice.status === "parcial") {
      return (
        <Badge variant="outline" className="text-[10px] h-5 bg-blue-500/10 text-blue-600 border-blue-500/30">
          Parcial
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-[10px] h-5 bg-green-500/10 text-green-600 border-green-500/30">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Pago
      </Badge>
    );
  };

  return (
    <>
      {/* Company Info */}
      <Collapsible open={companyOpen} onOpenChange={setCompanyOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full p-4 border-b border-border flex items-center justify-between hover:bg-muted/50 transition-colors">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Building2 className="h-4 w-4 text-primary" />
              Cliente Identificado
              {overdueInvoices.length > 0 && (
                <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                  {overdueInvoices.length} atrasada{overdueInvoices.length > 1 ? "s" : ""}
                </Badge>
              )}
            </span>
            <ChevronRight className={cn("h-4 w-4 transition-transform", companyOpen && "rotate-90")} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="border-b border-border">
          <div className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <a
                href={`/#/onboarding-tasks/companies/${company.id}?tab=financial`}
                className="font-medium text-sm text-primary hover:underline cursor-pointer truncate"
                title="Ver detalhes da empresa"
              >
                {company.name}
              </a>
              <Badge variant={company.status === "active" ? "default" : "secondary"} className="text-[10px] h-5">
                {company.status === "active" ? "Ativo" : company.status}
              </Badge>
            </div>
            {company.cnpj && (
              <p className="text-xs text-muted-foreground">
                CNPJ: {company.cnpj}
              </p>
            )}
            {company.contract_value && (
              <p className="text-xs text-muted-foreground">
                Contrato: {formatCurrency(company.contract_value * 100)}
              </p>
            )}
            {company.billing_day && (
              <p className="text-xs text-muted-foreground">
                Dia de faturamento: {company.billing_day}
              </p>
            )}
            {company.is_billing_blocked && (
              <Badge variant="destructive" className="text-[10px]">
                ⚠️ Faturamento bloqueado
              </Badge>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Invoices */}
      <Collapsible open={invoicesOpen} onOpenChange={setInvoicesOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full p-4 border-b border-border flex items-center justify-between hover:bg-muted/50 transition-colors">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Receipt className="h-4 w-4" />
              Faturas
              {invoices.length > 0 && (
                <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                  {invoices.length}
                </Badge>
              )}
            </span>
            <ChevronRight className={cn("h-4 w-4 transition-transform", invoicesOpen && "rotate-90")} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="border-b border-border">
          <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto">
            {loadingInvoices ? (
              <div className="flex items-center justify-center py-4">
                <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : invoices.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">
                Nenhuma fatura encontrada
              </p>
            ) : (
              <>
                {/* Open invoices first */}
                {openInvoices.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Em aberto ({openInvoices.length})</p>
                    {openInvoices.map((invoice) => (
                      <div key={invoice.id} className="p-2 rounded-lg border bg-card space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium truncate flex-1 mr-2">{invoice.description}</p>
                          {getStatusBadge(invoice)}
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Venc: {format(parseISO(invoice.due_date), "dd/MM/yyyy")}</span>
                          <span className="font-medium">{formatCurrency(invoice.amount_cents)}</span>
                        </div>
                        {invoice.payment_link_url && (
                          <div className="flex items-center gap-2">
                            <a href={invoice.payment_link_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline">
                              <ExternalLink className="h-3 w-3" />
                              Link de pagamento
                            </a>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 shrink-0"
                              title="Reenviar link por WhatsApp"
                              disabled={sendingLinkId === invoice.id}
                              onClick={() => handleResendLink(invoice)}
                            >
                              {sendingLinkId === invoice.id ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                <Send className="h-3 w-3 text-green-600" />
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Paid invoices */}
                {paidInvoices.length > 0 && (
                  <div className="space-y-2 mt-3">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Pagas ({paidInvoices.length})</p>
                    {paidInvoices.map((invoice) => (
                      <div key={invoice.id} className="p-2 rounded-lg border bg-card/50 space-y-1 opacity-75">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium truncate flex-1 mr-2">{invoice.description}</p>
                          {getStatusBadge(invoice)}
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Venc: {format(parseISO(invoice.due_date), "dd/MM/yyyy")}</span>
                          <span className="font-medium">{formatCurrency(invoice.amount_cents)}</span>
                        </div>
                        {invoice.paid_at && (
                          <p className="text-[10px] text-muted-foreground">
                            Pago em: {format(parseISO(invoice.paid_at), "dd/MM/yyyy")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </>
  );
}
