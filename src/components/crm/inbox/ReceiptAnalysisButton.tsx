import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sparkles, CheckCircle2, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CompanyInvoice } from "@/hooks/useCompanyIdentification";
import { cn } from "@/lib/utils";

interface ReceiptAnalysisResult {
  found_payment: boolean;
  amount_found: number | null;
  date_found: string | null;
  matched_invoice_id: string | null;
  confidence: "high" | "medium" | "low";
  summary: string;
}

interface ReceiptAnalysisButtonProps {
  mediaUrl: string;
  invoices: CompanyInvoice[];
  companyName: string;
  onConfirmPayment?: (invoiceId: string) => void;
}

export function ReceiptAnalysisButton({
  mediaUrl,
  invoices,
  companyName,
  onConfirmPayment,
}: ReceiptAnalysisButtonProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<ReceiptAnalysisResult | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  const handleAnalyze = async () => {
    if (invoices.length === 0) {
      toast.error("Não há faturas em aberto para comparar");
      return;
    }

    setAnalyzing(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("analyze-payment-receipt", {
        body: {
          media_url: mediaUrl,
          invoices: invoices.map(inv => ({
            id: inv.id,
            description: inv.description,
            amount_cents: inv.amount_cents,
            due_date: inv.due_date,
            status: inv.status,
          })),
          company_name: companyName,
        },
      });

      if (error) throw error;

      if (data?.analysis) {
        setResult(data.analysis);
        setShowDialog(true);
      } else if (data?.error) {
        toast.error(data.error);
      }
    } catch (err: any) {
      console.error("Error analyzing receipt:", err);
      toast.error("Erro ao analisar comprovante");
    } finally {
      setAnalyzing(false);
    }
  };

  const getConfidenceBadge = (confidence: string) => {
    switch (confidence) {
      case "high":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/30 text-[10px]">Alta confiança</Badge>;
      case "medium":
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30 text-[10px]">Confiança média</Badge>;
      default:
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/30 text-[10px]">Baixa confiança</Badge>;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-[10px] gap-1 text-primary hover:text-primary"
        onClick={handleAnalyze}
        disabled={analyzing || invoices.length === 0}
      >
        {analyzing ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Sparkles className="h-3 w-3" />
        )}
        {analyzing ? "Analisando..." : "Analisar comprovante"}
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Análise do Comprovante
            </DialogTitle>
          </DialogHeader>

          {result && (
            <div className="space-y-4">
              {/* Status */}
              <div className={cn(
                "flex items-center gap-3 p-3 rounded-lg border",
                result.found_payment
                  ? "bg-green-500/5 border-green-500/20"
                  : "bg-destructive/5 border-destructive/20"
              )}>
                {result.found_payment ? (
                  <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0" />
                ) : (
                  <XCircle className="h-6 w-6 text-destructive shrink-0" />
                )}
                <div>
                  <p className="text-sm font-medium">
                    {result.found_payment ? "Pagamento identificado" : "Pagamento não identificado"}
                  </p>
                  {getConfidenceBadge(result.confidence)}
                </div>
              </div>

              {/* Details */}
              {result.found_payment && (
                <div className="space-y-2 text-sm">
                  {result.amount_found && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Valor encontrado:</span>
                      <span className="font-medium">{formatCurrency(result.amount_found)}</span>
                    </div>
                  )}
                  {result.date_found && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Data:</span>
                      <span className="font-medium">{result.date_found}</span>
                    </div>
                  )}
                  {result.matched_invoice_id && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Fatura correspondente:</span>
                      <Badge variant="outline" className="text-[10px]">
                        {invoices.find(i => i.id === result.matched_invoice_id)?.description || "Encontrada"}
                      </Badge>
                    </div>
                  )}
                </div>
              )}

              {/* Summary */}
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">{result.summary}</p>
              </div>

              {/* Action */}
              {result.found_payment && result.matched_invoice_id && result.confidence !== "low" && (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
                  <p className="text-xs text-muted-foreground flex-1">
                    Confirme o pagamento manualmente na tela de faturas após verificar o comprovante.
                  </p>
                </div>
              )}

              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowDialog(false)}
              >
                Fechar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
