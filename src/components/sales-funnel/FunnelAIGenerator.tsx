import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onFunnelCreated: (id: string) => void;
}

export function FunnelAIGenerator({ open, onOpenChange, projectId, onFunnelCreated }: Props) {
  const [segment, setSegment] = useState("");
  const [businessModel, setBusinessModel] = useState("b2b_consultivo");
  const [ticketRange, setTicketRange] = useState("medio");
  const [saleType, setSaleType] = useState("consultiva");
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!segment.trim()) { toast.error("Informe o segmento"); return; }
    setGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke("generate-sales-funnel", {
        body: { projectId, segment, businessModel, ticketRange, saleType },
      });

      if (error) throw error;
      if (data?.funnelId) {
        toast.success("Funil gerado pela IA com sucesso!");
        onOpenChange(false);
        onFunnelCreated(data.funnelId);
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar funil. Tente novamente.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            Gerar Funil com IA
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          A IA criará um funil personalizado baseado no perfil da empresa.
        </p>
        <div className="space-y-4">
          <div>
            <Label>Segmento da Empresa *</Label>
            <Input value={segment} onChange={(e) => setSegment(e.target.value)} placeholder="Ex: Clínica Estética, SaaS, Consultoria..." />
          </div>
          <div>
            <Label>Modelo de Negócio</Label>
            <Select value={businessModel} onValueChange={setBusinessModel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="b2b_consultivo">B2B Consultivo</SelectItem>
                <SelectItem value="b2b_transacional">B2B Transacional</SelectItem>
                <SelectItem value="b2c_servicos">B2C Serviços</SelectItem>
                <SelectItem value="b2c_varejo">B2C Varejo</SelectItem>
                <SelectItem value="saas">SaaS</SelectItem>
                <SelectItem value="ecommerce">E-commerce</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Ticket Médio</Label>
            <Select value={ticketRange} onValueChange={setTicketRange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="baixo">Baixo (até R$ 500)</SelectItem>
                <SelectItem value="medio">Médio (R$ 500 - R$ 5.000)</SelectItem>
                <SelectItem value="alto">Alto (R$ 5.000 - R$ 50.000)</SelectItem>
                <SelectItem value="enterprise">Enterprise (acima de R$ 50.000)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo de Venda</Label>
            <Select value={saleType} onValueChange={setSaleType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="consultiva">Consultiva</SelectItem>
                <SelectItem value="transacional">Transacional</SelectItem>
                <SelectItem value="self_service">Self-Service</SelectItem>
                <SelectItem value="mista">Mista</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleGenerate} disabled={generating} className="w-full">
            {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {generating ? "Gerando funil..." : "Gerar Funil"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
