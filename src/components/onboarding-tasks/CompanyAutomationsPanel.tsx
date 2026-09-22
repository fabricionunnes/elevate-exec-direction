import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, MessageSquare, CalendarClock, ClipboardCheck, Star, FileText, Trophy, Bell, Megaphone, BarChart3 } from "lucide-react";

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
  /** só aparece pra empresa com projeto UNV Ads */
  onlyUnvAds?: boolean;
  /** horário padrão (Brasília) — quando existe, a empresa pode escolher outro (22/09/2026) */
  defaultTime?: string;
  timeNote?: string;
}[] = [
  {
    key: "resumo_diario",
    label: "Resumo diário de indicadores",
    description: "Leitura comercial do dia no grupo de gestão — ou cobrança nominal quando o time não lançou os números.",
    schedule: "horário configurável · exceto feriados",
    sender: "Fabrício",
    icon: MessageSquare,
    defaultTime: "19:30",
  },
  {
    key: "fechamento_dia",
    label: "Fechamento do dia",
    description: "Resumo do que foi tratado nas reuniões realizadas no dia, no grupo de gestão.",
    schedule: "diário · horário configurável",
    sender: "Marcelo",
    icon: CalendarClock,
    defaultTime: "20:45",
  },
  {
    key: "lembretes_reuniao",
    label: "Lembretes de reunião",
    description: "Aviso das reuniões do dia pela manhã e lembrete 30 minutos antes de cada uma.",
    schedule: "manhã (configurável) + 30min antes",
    sender: "Marcelo",
    icon: Bell,
    defaultTime: "08:00",
    timeNote: "hora do aviso da manhã; o lembrete de 30 min antes de cada reunião não muda",
  },
  {
    key: "csat",
    label: "Pesquisa CSAT pós-reunião",
    description: "Pesquisa de satisfação enviada no grupo após cada reunião realizada.",
    schedule: "dia seguinte · horário configurável",
    sender: "Marcelo",
    icon: ClipboardCheck,
    defaultTime: "09:00",
  },
  {
    key: "nps",
    label: "Pesquisa NPS",
    description: "Régua de NPS da parceria, enviada no grupo de gestão.",
    schedule: "régua mensal · horário configurável",
    sender: "Marcelo",
    icon: Star,
    defaultTime: "09:00",
  },
  {
    key: "relatorio_pdf",
    label: "Relatório de resultados (PDF)",
    description: "Relatório consolidado de todos os projetos da empresa: reuniões, ações e resultados.",
    schedule: "segunda · dia 1º · horário configurável",
    sender: "Marcelo",
    icon: FileText,
    defaultTime: "08:00",
  },
  {
    key: "trafego_diario",
    label: "Resumo diário de tráfego pago (interno)",
    description: "Inclui esta empresa no resumo de ontem enviado no grupo interno UNV Ads (todas as contas numa mensagem): investimento, conversas ou leads com custo, total do mês e vendas com CAC quando houver rastreamento. Não vai pro grupo do cliente.",
    schedule: "8h · diário · grupo UNV Ads",
    sender: "Marcelo",
    icon: Megaphone,
    onlyUnvAds: true,
  },
  {
    key: "trafego_semanal",
    label: "Resumo da semana de tráfego (PDF)",
    description: "Semana fechada (segunda a domingo) comparada com a anterior, por campanha, com vendas e CAC quando houver rastreamento, no grupo UNV ADS do cliente.",
    schedule: "segunda · horário configurável",
    sender: "Marcelo",
    icon: BarChart3,
    onlyUnvAds: true,
    defaultTime: "08:00",
  },
  {
    key: "trafego_resumo",
    label: "Resumo de tráfego em texto",
    description: "Mensagem com os últimos 7 dias (investido, conversas ou leads com custo, cliques, alcance, campanha que mais rodou) e o acumulado do mês, no grupo UNV ADS do cliente.",
    schedule: "quarta · horário configurável",
    sender: "Marcelo",
    icon: Megaphone,
    onlyUnvAds: true,
    defaultTime: "08:00",
  },
  {
    key: "ranking_vendas",
    label: "Ranking diário de vendas",
    description: "Ranking dos vendedores no grupo de vendas, com base nos lançamentos do dia.",
    schedule: "seg–sáb · horário configurável",
    sender: "Marcelo",
    icon: Trophy,
    defaultTime: "20:30",
  },
];

interface Props {
  companyId: string;
}

export function CompanyAutomationsPanel({ companyId }: Props) {
  const [settings, setSettings] = useState<Record<string, boolean>>({});
  const [variants, setVariants] = useState<Record<string, string | null>>({});
  const [sendTimes, setSendTimes] = useState<Record<string, string | null>>({});
  const [instances, setInstances] = useState<Record<string, string | null>>({});
  const [availableInstances, setAvailableInstances] = useState<{ name: string; connected: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasUnvAds, setHasUnvAds] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await (supabase as any)
        .from("company_automation_settings")
        .select("automation_key, enabled, variant, instance_name, send_time")
        .eq("company_id", companyId);
      if (error) {
        toast.error("Erro ao carregar configurações de automação");
      } else {
        const map: Record<string, boolean> = {};
        const vmap: Record<string, string | null> = {};
        const imap: Record<string, string | null> = {};
        const tmap: Record<string, string | null> = {};
        (data || []).forEach((r: any) => { map[r.automation_key] = r.enabled; vmap[r.automation_key] = r.variant; imap[r.automation_key] = r.instance_name; tmap[r.automation_key] = r.send_time; });
        setSettings(map);
        setVariants(vmap);
        setInstances(imap);
        setSendTimes(tmap);
      }
      const { data: insts } = await (supabase as any)
        .from("whatsapp_instances")
        .select("instance_name, status")
        .order("instance_name");
      setAvailableInstances((insts || []).map((i: any) => ({ name: i.instance_name, connected: i.status === "connected" })));
      // relatórios de tráfego só fazem sentido pra quem tem projeto UNV Ads
      const { data: ads } = await (supabase as any)
        .from("onboarding_projects")
        .select("id")
        .eq("onboarding_company_id", companyId)
        .eq("product_name", "UNV Ads")
        .neq("status", "closed")
        .limit(1);
      setHasUnvAds((ads || []).length > 0);
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
        { company_id: companyId, automation_key: key, enabled: next, variant: variants[key] ?? null, instance_name: instances[key] ?? null, send_time: sendTimes[key] ?? null, updated_at: new Date().toISOString() },
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

  // Qualquer horário HH:MM: os crons rodam de 5 em 5 (ou 10 em 10) min e cada função
  // manda pra empresa quando o horário dela chega (automation_due_companies).
  const setSendTimeFor = async (key: string, time: string) => {
    if (!/^\d{2}:\d{2}$/.test(time)) return;
    if (key === "resumo_diario") return setSendTime(time);
    setSaving(`${key}_time`);
    const prev = sendTimes[key];
    setSendTimes((v) => ({ ...v, [key]: time }));
    const { error } = await (supabase as any)
      .from("company_automation_settings")
      .upsert(
        { company_id: companyId, automation_key: key, enabled: isOn(key), variant: variants[key] ?? null, instance_name: instances[key] ?? null, send_time: time, updated_at: new Date().toISOString() },
        { onConflict: "company_id,automation_key" },
      );
    if (error) {
      setSendTimes((v) => ({ ...v, [key]: prev }));
      toast.error("Não foi possível salvar o horário. Tente de novo.");
    } else {
      toast.success(`Passa a sair às ${time} (Brasília) a partir do próximo envio.`);
    }
    setSaving(null);
  };
  // < 14h fala do dia anterior (seg–sáb); >= 14h fala do dia atual (seg–sex).
  const regimeOf = (t: string) => (Number(t.split(":")[0]) < 14
    ? "Fala do dia anterior · seg–sáb"
    : "Fala do dia atual · seg–sex");

  const setSendTime = async (time: string) => {
    setSaving("resumo_diario_time");
    const prevT = sendTimes["resumo_diario"];
    const prevV = variants["resumo_diario"];
    const variant = Number(time.split(":")[0]) < 14 ? "matinal" : null;
    setSendTimes((v) => ({ ...v, resumo_diario: time }));
    setVariants((v) => ({ ...v, resumo_diario: variant }));
    const { error } = await (supabase as any)
      .from("company_automation_settings")
      .upsert(
        { company_id: companyId, automation_key: "resumo_diario", enabled: isOn("resumo_diario"), variant, send_time: time, instance_name: instances["resumo_diario"] ?? null, updated_at: new Date().toISOString() },
        { onConflict: "company_id,automation_key" },
      );
    if (error) {
      setSendTimes((v) => ({ ...v, resumo_diario: prevT }));
      setVariants((v) => ({ ...v, resumo_diario: prevV }));
      toast.error("Não foi possível salvar o horário. Tente de novo.");
    } else {
      toast.success(`Resumo passa a sair às ${time} (Brasília). ${regimeOf(time)}.`);
    }
    setSaving(null);
  };

  const setInstance = async (key: string, name: string) => {
    setSaving(`${key}_inst`);
    const prev = instances[key];
    const value = name === "__default__" ? null : name;
    setInstances((m) => ({ ...m, [key]: value }));
    const { error } = await (supabase as any)
      .from("company_automation_settings")
      .upsert(
        { company_id: companyId, automation_key: key, enabled: isOn(key), variant: variants[key] ?? null, instance_name: value, send_time: sendTimes[key] ?? null, updated_at: new Date().toISOString() },
        { onConflict: "company_id,automation_key" },
      );
    if (error) {
      setInstances((m) => ({ ...m, [key]: prev }));
      toast.error("Não foi possível salvar a instância. Tente de novo.");
    } else {
      toast.success(value ? `Envio pelo número "${value}" a partir do próximo disparo.` : "Envio volta pro número padrão.");
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
        {AUTOMATIONS.filter((a) => !a.onlyUnvAds || hasUnvAds).map((a) => {
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
                  {on && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Número:</span>
                      <Select
                        value={instances[a.key] || "__default__"}
                        onValueChange={(v) => setInstance(a.key, v)}
                        disabled={saving === `${a.key}_inst`}
                      >
                        <SelectTrigger className="h-8 w-auto min-w-[220px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__default__">Padrão ({a.sender})</SelectItem>
                          {availableInstances.map((i) => (
                            <SelectItem key={i.name} value={i.name} disabled={!i.connected}>
                              {i.name}{i.connected ? "" : " (desconectada)"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {a.defaultTime && on && (() => {
                    const t = sendTimes[a.key] || a.defaultTime;
                    return (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted-foreground">Horário (Brasília):</span>
                        <Input
                          type="time"
                          value={t}
                          onChange={(e) => setSendTimeFor(a.key, e.target.value)}
                          disabled={saving === `${a.key}_time` || saving === "resumo_diario_time"}
                          className="h-8 w-[110px] text-xs"
                        />
                        {sendTimes[a.key] && sendTimes[a.key] !== a.defaultTime && (
                          <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setSendTimeFor(a.key, a.defaultTime!)}>
                            voltar ao padrão ({a.defaultTime})
                          </button>
                        )}
                        {a.key === "resumo_diario" && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{regimeOf(t)}</Badge>}
                        {a.timeNote && <span className="text-[11px] text-muted-foreground">{a.timeNote}</span>}
                      </div>
                    );
                  })()}
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
