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
}

export function CompanyFinancialSidePanel({
  company,
  invoices,
  loading,
  loadingInvoices,
  onAnalyzeReceipt,
}: CompanyFinancialSidePanelProps) {
  const [companyOpen, setCompanyOpen] = useState(true);
  const [invoicesOpen, setInvoicesOpen] = useState(true);

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
              <p className="font-medium text-sm">{company.name}</p>
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
              Faturas em Aberto
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
          <div className="p-3 space-y-2 max-h-[300px] overflow-y-auto">
            {loadingInvoices ? (
              <div className="flex items-center justify-center py-4">
                <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : invoices.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">
                Nenhuma fatura em aberto
              </p>
            ) : (
              invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="p-2 rounded-lg border bg-card space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium truncate flex-1 mr-2">
                      {invoice.description}
                    </p>
                    {getStatusBadge(invoice)}
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      Venc: {format(parseISO(invoice.due_date), "dd/MM/yyyy")}
                    </span>
                    <span className="font-medium">
                      {formatCurrency(invoice.amount_cents)}
                    </span>
                  </div>
                  {invoice.payment_link_url && (
                    <a
                      href={invoice.payment_link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Link de pagamento
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </>
  );
}
