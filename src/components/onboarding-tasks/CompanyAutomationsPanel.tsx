import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, MessageSquare, CalendarClock, ClipboardCheck, Star, FileText, Trophy, Bell } from "lucide-react";

// Painel liga/desliga das mensagens automáticas enviadas nos grupos do cliente.
// Sem linha na tabela = LIGADO (default). As edge functions consultam
// company_automation_settings antes de cada envio.
const AUTOMATIONS: {
  key: string;
  label: string;
  description: string;
  schedule: string;
  sender: "Marcelo" | "Fabrício";
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    key: "resumo_diario",
    label: "Resumo diário de indicadores",
    description: "Leitura comercial do dia no grupo de gestão — ou cobrança nominal quando o time não lançou os números.",
    schedule: "19h30 · seg–sex (exceto feriados)",
    sender: "Fabrício",
    icon: MessageSquare,
  },
  {
    key: "fechamento_dia",
    label: "Fechamento do dia",
    description: "Resumo do que foi tratado nas reuniões realizadas no dia, no grupo de gestão.",
    schedule: "20h45 · diário",
    sender: "Marcelo",
    icon: CalendarClock,
  },
  {
    key: "lembretes_reuniao",
    label: "Lembretes de reunião",
    description: "Aviso das reuniões do dia pela manhã e lembrete 30 minutos antes de cada uma.",
    schedule: "8h + 30min antes",
    sender: "Marcelo",
    icon: Bell,
  },
  {
    key: "csat",
    label: "Pesquisa CSAT pós-reunião",
    description: "Pesquisa de satisfação enviada no grupo após cada reunião realizada.",
    schedule: "9h do dia seguinte",
    sender: "Marcelo",
    icon: ClipboardCheck,
  },
  {
    key: "nps",
    label: "Pesquisa NPS",
    description: "Régua de NPS da parceria, enviada no grupo de gestão.",
    schedule: "régua mensal",
    sender: "Marcelo",
    icon: Star,
  },
  {
    key: "relatorio_pdf",
    label: "Relatório de resultados (PDF)",
    description: "Relatório consolidado de todos os projetos da empresa: reuniões, ações e resultados.",
    schedule: "semanal · mensal · trimestral",
    sender: "Marcelo",
    icon: FileText,
  },
  {
    key: "ranking_vendas",
    label: "Ranking diário de vendas",
    description: "Ranking dos vendedores no grupo de vendas, com base nos lançamentos do dia.",
    schedule: "20h30 · diário",
    sender: "Marcelo",
    icon: Trophy,
  },
];

interface Props {
  companyId: string;
}

export function CompanyAutomationsPanel({ companyId }: Props) {
  const [settings, setSettings] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await (supabase as any)
        .from("company_automation_settings")
        .select("automation_key, enabled")
        .eq("company_id", companyId);
      if (error) {
        toast.error("Erro ao carregar configurações de automação");
      } else {
        const map: Record<string, boolean> = {};
        (data || []).forEach((r: any) => { map[r.automation_key] = r.enabled; });
        setSettings(map);
      }
      setLoading(false);
    };
    load();
  }, [companyId]);

  const isOn = (key: string) => settings[key] !== false; // ausente = ligado

  const toggle = async (key: string, next: boolean) => {
    setSaving(key);
    const prev = settings[key];
    setSettings((s) => ({ ...s, [key]: next }));
    const { error } = await (supabase as any)
      .from("company_automation_settings")
      .upsert(
        { company_id: companyId, automation_key: key, enabled: next, updated_at: new Date().toISOString() },
        { onConflict: "company_id,automation_key" },
      );
    if (error) {
      setSettings((s) => ({ ...s, [key]: prev }));
      toast.error("Não foi possível salvar. Tente de novo.");
    } else {
      const a = AUTOMATIONS.find((x) => x.key === key);
      toast.success(`${a?.label || key} ${next ? "ativada" : "desativada"} — vale a partir do próximo envio.`);
    }
    setSaving(null);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando automações...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Automações nos grupos</CardTitle>
        <CardDescription>
          Liga e desliga as mensagens automáticas enviadas nos grupos de WhatsApp desta empresa.
          A mudança vale a partir do próximo horário de envio — não precisa de deploy.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {AUTOMATIONS.map((a) => {
          const Icon = a.icon;
          const on = isOn(a.key);
          return (
            <div
              key={a.key}
              className={`flex items-start justify-between gap-4 rounded-lg border p-4 transition-colors ${on ? "" : "bg-muted/40"}`}
            >
              <div className="flex items-start gap-3 min-w-0">
                <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${on ? "text-primary" : "text-muted-foreground"}`} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{a.label}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">{a.sender}</Badge>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{a.schedule}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{a.description}</p>
                </div>
              </div>
              <Switch
                checked={on}
                disabled={saving === a.key}
                onCheckedChange={(v) => toggle(a.key, v)}
                aria-label={a.label}
              />
            </div>
          );
        })}
        <p className="text-xs text-muted-foreground pt-1">
          Empresa com status inativo não recebe nenhuma automação, independente destes controles.
        </p>
      </CardContent>
    </Card>
  );
}
