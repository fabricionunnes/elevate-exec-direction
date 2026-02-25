import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Link2, Loader2, Copy, ExternalLink } from "lucide-react";
import { format } from "date-fns";

interface Props {
  companyId: string;
  companyName: string;
}

interface PaymentLink {
  id: string;
  description: string;
  amount_cents: number;
  payment_method: string;
  installments: number;
  url: string;
  created_at: string;
}

export function CompanyPaymentLinks({ companyId, companyName }: Props) {
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    description: `Serviço - ${companyName}`,
    amount: 0,
    paymentMethod: "pix",
    installments: 1,
  });

  useEffect(() => {
    fetchLinks();
  }, [companyId]);

  const fetchLinks = async () => {
    const { data, error } = await supabase
      .from("payment_links")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (!error) setLinks((data as any) || []);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!form.amount || form.amount <= 0) {
      toast.error("Informe um valor válido");
      return;
    }

    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const linkUrl = `${window.location.origin}/checkout`;
      const { data, error } = await supabase.from("payment_links").insert({
        description: form.description,
        amount_cents: Math.round(form.amount * 100),
        payment_method: form.paymentMethod,
        installments: form.installments,
        url: linkUrl,
        created_by: user?.id,
        company_id: companyId,
      } as any).select().single();

      if (error) throw error;

      const fullUrl = `${window.location.origin}/checkout?link_id=${data.id}`;
      await supabase.from("payment_links").update({ url: fullUrl } as any).eq("id", data.id);

      toast.success("Link criado com sucesso!");
      navigator.clipboard.writeText(fullUrl);
      toast.info("Link copiado para a área de transferência");
      setShowDialog(false);
      fetchLinks();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar link");
    } finally {
      setCreating(false);
    }
  };

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const METHOD_LABELS: Record<string, string> = {
    pix: "PIX",
    credit_card: "Cartão",
    boleto: "Boleto",
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const minInstallmentValue = 5000;
  const maxInstallments = Math.min(12, Math.max(1, Math.floor((form.amount * 100) / minInstallmentValue)));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              Links de Pagamento
            </CardTitle>
            <CardDescription>Gere links para enviar ao cliente</CardDescription>
          </div>
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button type="button" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Novo Link
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Link de Pagamento</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Valor (R$)</Label>
                    <CurrencyInput value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Método</Label>
                    <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v, installments: 1 })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pix">PIX</SelectItem>
                        <SelectItem value="credit_card">Cartão</SelectItem>
                        <SelectItem value="boleto">Boleto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {form.paymentMethod === "credit_card" && maxInstallments > 1 && (
                  <div className="space-y-2">
                    <Label>Parcelas</Label>
                    <Select value={String(form.installments)} onValueChange={(v) => setForm({ ...form, installments: parseInt(v) })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: maxInstallments }, (_, i) => i + 1).map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n}x de R$ {(form.amount / n).toFixed(2).replace(".", ",")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button type="button" onClick={handleCreate} disabled={creating} className="w-full">
                  {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Gerar Link
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {links.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Link2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>Nenhum link de pagamento gerado</p>
          </div>
        ) : (
          <div className="space-y-3">
            {links.map((link) => (
              <div key={link.id} className="flex items-center justify-between p-4 rounded-lg border bg-card">
                <div className="space-y-1 min-w-0 flex-1">
                  <p className="font-medium truncate">{link.description}</p>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span>R$ {(link.amount_cents / 100).toFixed(2).replace(".", ",")}</span>
                    <Badge variant="outline">{METHOD_LABELS[link.payment_method] || link.payment_method}</Badge>
                    {link.installments > 1 && <span>{link.installments}x</span>}
                    <span>{format(new Date(link.created_at), "dd/MM/yyyy")}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="ghost" size="icon" onClick={() => copyLink(link.url)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" asChild>
                    <a href={link.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
