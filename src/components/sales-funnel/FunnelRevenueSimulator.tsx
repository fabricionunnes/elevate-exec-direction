import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { DollarSign, Users, TrendingUp, ArrowRight } from "lucide-react";

interface Stage {
  id: string;
  name: string;
  expected_conversion_rate: number | null;
  sort_order: number;
}

interface FunnelRevenueSimulatorProps {
  funnelId: string;
}

export function FunnelRevenueSimulator({ funnelId }: FunnelRevenueSimulatorProps) {
  const [stages, setStages] = useState<Stage[]>([]);
  const [leads, setLeads] = useState(1000);
  const [ticketMedio, setTicketMedio] = useState(2000);
  const [conversionOverrides, setConversionOverrides] = useState<Record<string, number>>({});

  useEffect(() => {
    supabase.from("sales_funnel_stages").select("*").eq("funnel_id", funnelId).order("sort_order")
      .then(({ data }) => {
        setStages(data || []);
        const overrides: Record<string, number> = {};
        (data || []).forEach(s => { overrides[s.id] = s.expected_conversion_rate || 50; });
        setConversionOverrides(overrides);
      });
  }, [funnelId]);

  const simulation = useMemo(() => {
    const sorted = [...stages].sort((a, b) => a.sort_order - b.sort_order);
    let remaining = leads;
    const result: { name: string; leadsIn: number; leadsOut: number; conversionRate: number }[] = [];

    sorted.forEach((stage) => {
      const rate = conversionOverrides[stage.id] || 50;
      const leadsOut = Math.round(remaining * (rate / 100));
      result.push({ name: stage.name, leadsIn: remaining, leadsOut, conversionRate: rate });
      remaining = leadsOut;
    });

    return result;
  }, [stages, leads, conversionOverrides]);

  const totalSales = simulation.length > 0 ? simulation[simulation.length - 1].leadsOut : 0;
  const revenue = totalSales * ticketMedio;
  const overallConversion = leads > 0 ? ((totalSales / leads) * 100).toFixed(2) : "0";

  // Simulate improvement scenarios
  const improvedRevenue10 = useMemo(() => {
    let remaining = leads;
    const sorted = [...stages].sort((a, b) => a.sort_order - b.sort_order);
    sorted.forEach((stage) => {
      const rate = Math.min(100, (conversionOverrides[stage.id] || 50) * 1.1);
      remaining = Math.round(remaining * (rate / 100));
    });
    return remaining * ticketMedio;
  }, [stages, leads, ticketMedio, conversionOverrides]);

  const improvedRevenue20 = useMemo(() => {
    let remaining = leads;
    const sorted = [...stages].sort((a, b) => a.sort_order - b.sort_order);
    sorted.forEach((stage) => {
      const rate = Math.min(100, (conversionOverrides[stage.id] || 50) * 1.2);
      remaining = Math.round(remaining * (rate / 100));
    });
    return remaining * ticketMedio;
  }, [stages, leads, ticketMedio, conversionOverrides]);

  const formatCurrency = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      <h3 className="font-semibold text-lg flex items-center gap-2">
        <DollarSign className="h-5 w-5 text-green-500" />
        Simulador de Receita
      </h3>

      {/* Input Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div>
              <Label>Número de Leads</Label>
              <Input type="number" value={leads} onChange={(e) => setLeads(parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <Label>Ticket Médio (R$)</Label>
              <Input type="number" value={ticketMedio} onChange={(e) => setTicketMedio(parseInt(e.target.value) || 0)} />
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-green-50 dark:bg-green-950/20 border-green-200">
            <CardContent className="pt-4 text-center">
              <DollarSign className="h-6 w-6 mx-auto text-green-500 mb-1" />
              <p className="text-xs text-green-600 font-medium">Receita Estimada</p>
              <p className="text-lg font-bold text-green-700">{formatCurrency(revenue)}</p>
            </CardContent>
          </Card>
          <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200">
            <CardContent className="pt-4 text-center">
              <Users className="h-6 w-6 mx-auto text-blue-500 mb-1" />
              <p className="text-xs text-blue-600 font-medium">Vendas Previstas</p>
              <p className="text-lg font-bold text-blue-700">{totalSales}</p>
              <p className="text-[10px] text-blue-500">{overallConversion}% conversão total</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Conversion per stage */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Conversão por Etapa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {simulation.map((step, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{step.name}</span>
                <span className="text-muted-foreground">
                  {step.leadsIn} → {step.leadsOut} leads
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Slider
                  value={[step.conversionRate]}
                  onValueChange={([v]) => setConversionOverrides(prev => ({ ...prev, [stages.sort((a, b) => a.sort_order - b.sort_order)[idx]?.id || ""]: v }))}
                  min={0}
                  max={100}
                  step={1}
                  className="flex-1"
                />
                <span className="text-xs font-medium w-10 text-right">{step.conversionRate}%</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Improvement Scenarios */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Cenários de Melhoria
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Atual</p>
              <p className="font-bold text-sm">{formatCurrency(revenue)}</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
              <p className="text-xs text-green-600">+10% conversão</p>
              <p className="font-bold text-sm text-green-700">{formatCurrency(improvedRevenue10)}</p>
              <p className="text-[10px] text-green-500">+{formatCurrency(improvedRevenue10 - revenue)}</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20">
              <p className="text-xs text-blue-600">+20% conversão</p>
              <p className="font-bold text-sm text-blue-700">{formatCurrency(improvedRevenue20)}</p>
              <p className="text-[10px] text-blue-500">+{formatCurrency(improvedRevenue20 - revenue)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
