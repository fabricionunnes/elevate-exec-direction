import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Route, Megaphone, ShoppingBag, Heart } from "lucide-react";

interface Funnel {
  id: string;
  name: string;
}

interface Stage {
  id: string;
  name: string;
  stage_type: string;
  color: string;
  sort_order: number;
  expected_conversion_rate: number | null;
}

interface Props {
  projectId: string;
}

const JOURNEY_PHASES = [
  { id: "marketing", label: "Marketing", icon: Megaphone, color: "#3b82f6", stages: ["Campanha", "Anúncio", "Landing Page", "Formulário"] },
  { id: "vendas", label: "Vendas", icon: ShoppingBag, color: "#f59e0b", stages: [] },
  { id: "pos_venda", label: "Pós-Venda", icon: Heart, color: "#22c55e", stages: ["Onboarding", "Sucesso do Cliente", "Renovação", "Indicação"] },
];

export function FunnelCustomerJourney({ projectId }: Props) {
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [selectedFunnel, setSelectedFunnel] = useState<string>("");
  const [stages, setStages] = useState<Stage[]>([]);

  useEffect(() => {
    supabase.from("sales_funnels").select("id, name").eq("project_id", projectId).eq("is_template", false).order("created_at")
      .then(({ data }) => {
        setFunnels(data || []);
        if (data && data.length > 0) setSelectedFunnel(data[0].id);
      });
  }, [projectId]);

  useEffect(() => {
    if (!selectedFunnel) return;
    supabase.from("sales_funnel_stages").select("*").eq("funnel_id", selectedFunnel).order("sort_order")
      .then(({ data }) => setStages(data || []));
  }, [selectedFunnel]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Route className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-lg">Jornada do Cliente</h3>
        </div>
        {funnels.length > 0 && (
          <Select value={selectedFunnel} onValueChange={setSelectedFunnel}>
            <SelectTrigger className="w-60"><SelectValue placeholder="Selecione um funil" /></SelectTrigger>
            <SelectContent>
              {funnels.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Visualize toda a jornada do cliente: Marketing → Vendas → Pós-venda
      </p>

      {/* Journey Flow */}
      <div className="flex flex-col lg:flex-row gap-4 items-stretch">
        {JOURNEY_PHASES.map((phase, phaseIdx) => {
          const Icon = phase.icon;
          const phaseStages = phase.id === "vendas" ? stages : [];
          const displayStages = phase.id === "vendas" 
            ? stages.map(s => ({ name: s.name, color: s.color, conversion: s.expected_conversion_rate }))
            : phase.stages.map(s => ({ name: s, color: phase.color, conversion: null }));

          return (
            <div key={phase.id} className="flex items-center gap-2 flex-1">
              <Card className="flex-1 border-2" style={{ borderColor: `${phase.color}40` }}>
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Icon className="h-4 w-4" style={{ color: phase.color }} />
                    {phase.label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="flex flex-col gap-1.5">
                    {displayStages.map((stage, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        {idx > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                        <Badge
                          variant="outline"
                          className="text-xs"
                          style={{ borderColor: stage.color, color: stage.color }}
                        >
                          {stage.name}
                          {stage.conversion && ` (${stage.conversion}%)`}
                        </Badge>
                      </div>
                    ))}
                    {displayStages.length === 0 && (
                      <p className="text-xs text-muted-foreground italic">Selecione um funil para ver as etapas</p>
                    )}
                  </div>
                </CardContent>
              </Card>
              {phaseIdx < JOURNEY_PHASES.length - 1 && (
                <ArrowRight className="h-6 w-6 text-muted-foreground shrink-0 hidden lg:block" />
              )}
            </div>
          );
        })}
      </div>

      {funnels.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>Crie um funil de vendas para visualizar a jornada completa do cliente</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
