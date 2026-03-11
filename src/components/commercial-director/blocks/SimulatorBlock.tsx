import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Calculator, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface SimulatorBlockProps {
  companyId: string;
}

export const SimulatorBlock = ({ companyId }: SimulatorBlockProps) => {
  const [baseLeads, setBaseLeads] = useState(100);
  const [baseConversion, setBaseConversion] = useState(10);
  const [baseTicket, setBaseTicket] = useState(1000);

  const [leads, setLeads] = useState(100);
  const [conversion, setConversion] = useState(10);
  const [ticket, setTicket] = useState(1000);

  useEffect(() => {
    loadCompanyDefaults();
  }, [companyId]);

  const loadCompanyDefaults = async () => {
    const { data } = await supabase
      .from("onboarding_companies")
      .select("average_ticket, conversion_rate")
      .eq("id", companyId)
      .single();

    if (data) {
      const t = parseFloat(data.average_ticket) || 1000;
      const c = parseFloat(data.conversion_rate) || 10;
      setBaseTicket(t);
      setBaseConversion(c);
      setTicket(t);
      setConversion(c);
    }
  };

  const currentRevenue = baseLeads * (baseConversion / 100) * baseTicket;
  const projectedRevenue = leads * (conversion / 100) * ticket;
  const diff = projectedRevenue - currentRevenue;
  const diffPercent = currentRevenue > 0 ? ((diff / currentRevenue) * 100).toFixed(1) : "0";

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calculator className="h-5 w-5 text-purple-600" />
          Simulador de Crescimento Comercial
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Sliders */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Leads / mês</span>
              <span className="font-bold text-primary">{leads}</span>
            </div>
            <Slider
              value={[leads]}
              onValueChange={([v]) => setLeads(v)}
              min={10}
              max={1000}
              step={10}
            />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Taxa de Conversão</span>
              <span className="font-bold text-primary">{conversion}%</span>
            </div>
            <Slider
              value={[conversion]}
              onValueChange={([v]) => setConversion(v)}
              min={1}
              max={50}
              step={1}
            />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Ticket Médio</span>
              <span className="font-bold text-primary">{formatCurrency(ticket)}</span>
            </div>
            <Slider
              value={[ticket]}
              onValueChange={([v]) => setTicket(v)}
              min={100}
              max={50000}
              step={100}
            />
          </div>
        </div>

        {/* Results */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-muted/30 rounded-xl p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Faturamento Atual</p>
            <p className="text-lg font-bold">{formatCurrency(currentRevenue)}</p>
          </div>
          <div className="flex items-center justify-center">
            <ArrowRight className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Faturamento Projetado</p>
            <p className="text-lg font-bold text-primary">{formatCurrency(projectedRevenue)}</p>
          </div>
        </div>

        {diff !== 0 && (
          <div className={`text-center py-3 rounded-lg ${diff > 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            <p className="text-sm font-semibold">
              {diff > 0 ? "+" : ""}{formatCurrency(diff)} ({diff > 0 ? "+" : ""}{diffPercent}%)
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
