// Aviso de "Reunião agendada" no WhatsApp: qual número envia e quem recebe.
// Vale pra TODA reunião criada (CRM, agente de IA e projetos). Lido pela edge meeting-scheduled-notify.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { CalendarCheck, Loader2, X } from "lucide-react";
import { toast } from "sonner";

const KEYS = {
  enabled: "meeting_notify_enabled",
  instance: "meeting_notify_instance_name",
  responsible: "meeting_notify_include_responsible",
  scheduler: "meeting_notify_include_scheduler",
  extras: "meeting_notify_extra_staff_ids",
} as const;

interface Staff { id: string; name: string; role: string | null; phone: string | null }
interface Instance { instance_name: string; display_name: string | null; status: string | null }

export function MeetingNotificationSettings() {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [instanceName, setInstanceName] = useState("auto");
  const [incluirResponsavel, setIncluirResponsavel] = useState(true);
  const [incluirQuemAgendou, setIncluirQuemAgendou] = useState(true);
  const [extras, setExtras] = useState<string[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data: cfg }, { data: inst }, { data: st }] = await Promise.all([
        supabase.from("crm_settings").select("setting_key, setting_value").like("setting_key", "meeting_notify_%"),
        supabase.from("whatsapp_instances").select("instance_name, display_name, status").order("instance_name"),
        supabase.from("onboarding_staff").select("id, name, role, phone").eq("is_active", true).order("name"),
      ]);
      // setting_value é jsonb: pode vir string, boolean ou array
      for (const r of (cfg || []) as { setting_key: string; setting_value: unknown }[]) {
        const raw = r.setting_value;
        const v = raw == null ? "" : typeof raw === "string" ? raw : JSON.stringify(raw);
        if (r.setting_key === KEYS.enabled) setEnabled(v !== "false");
        if (r.setting_key === KEYS.instance) setInstanceName(v || "auto");
        if (r.setting_key === KEYS.responsible) setIncluirResponsavel(v !== "false");
        if (r.setting_key === KEYS.scheduler) setIncluirQuemAgendou(v !== "false");
        if (r.setting_key === KEYS.extras) { try { const a = Array.isArray(raw) ? raw : JSON.parse(v || "[]"); if (Array.isArray(a)) setExtras(a.map(String)); } catch { /* valor antigo inválido */ } }
      }
      setInstances((inst || []) as Instance[]);
      setStaff((st || []) as Staff[]);
      setLoading(false);
    })();
  }, []);

  const salvar = async (key: string, value: string | string[]) => {
    const { error } = await supabase.from("crm_settings").upsert({ setting_key: key, setting_value: value }, { onConflict: "setting_key" });
    if (error) { toast.error("Não consegui salvar: " + error.message); return false; }
    toast.success("Configuração salva");
    return true;
  };

  const toggleExtra = async (id: string) => {
    const novo = extras.includes(id) ? extras.filter((x) => x !== id) : [...extras, id];
    setExtras(novo);
    await salvar(KEYS.extras, novo);
  };

  const staffFiltrado = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return q ? staff.filter((s) => s.name.toLowerCase().includes(q)) : staff;
  }, [busca, staff]);

  const semDestinatario = !incluirResponsavel && !incluirQuemAgendou && extras.length === 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-primary" />
              Aviso de reunião agendada
            </CardTitle>
            <CardDescription className="mt-1">
              Mensagem no WhatsApp sempre que uma reunião é criada, por qualquer pessoa ou pelo agente de IA,
              com lead, data e hora, link da reunião e link do lead no CRM.
            </CardDescription>
          </div>
          <Switch
            checked={enabled}
            disabled={loading}
            onCheckedChange={async (v) => { setEnabled(v); await salvar(KEYS.enabled, String(v)); }}
          />
        </div>
      </CardHeader>

      {enabled && (
        <CardContent className="space-y-5">
          {loading ? (
            <div className="text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Carregando...</div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label className="text-sm">Número que envia</Label>
                <SearchableSelect
                  value={instanceName}
                  onValueChange={async (v) => { setInstanceName(v); await salvar(KEYS.instance, v === "auto" ? "" : v); }}
                  options={[
                    { value: "auto", label: "Automático (número de quem agendou ou da conversa do lead)" },
                    ...instances.map((i) => ({
                      value: i.instance_name,
                      label: i.display_name || i.instance_name,
                      hint: i.status === "connected" ? undefined : "desconectado",
                    })),
                  ]}
                  placeholder="Escolha o número"
                  emptyMessage="Nenhum número encontrado."
                />
                <p className="text-xs text-muted-foreground">
                  Se o número escolhido estiver desconectado na hora, o aviso sai pelo automático pra não se perder.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Quem recebe</Label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={incluirResponsavel}
                    onCheckedChange={async (v) => { const b = v === true; setIncluirResponsavel(b); await salvar(KEYS.responsible, String(b)); }}
                  />
                  Responsável pela reunião (closer ou consultor)
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={incluirQuemAgendou}
                    onCheckedChange={async (v) => { const b = v === true; setIncluirQuemAgendou(b); await salvar(KEYS.scheduler, String(b)); }}
                  />
                  Quem agendou
                </label>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Sempre avisar também</Label>
                {extras.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {extras.map((id) => {
                      const s = staff.find((x) => x.id === id);
                      return (
                        <Badge key={id} variant="secondary" className="gap-1 pr-1">
                          {s?.name || "Usuário removido"}
                          <button type="button" onClick={() => toggleExtra(id)} title="Tirar da lista">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}
                <Input placeholder="Buscar pessoa pelo nome..." value={busca} onChange={(e) => setBusca(e.target.value)} className="h-9" />
                <div className="max-h-48 overflow-y-auto rounded-md border divide-y">
                  {staffFiltrado.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted/50">
                      <Checkbox checked={extras.includes(s.id)} onCheckedChange={() => toggleExtra(s.id)} />
                      <span className="flex-1 truncate">{s.name}</span>
                      {!s.phone && <span className="text-[11px] text-amber-600">sem telefone</span>}
                      {s.role && <span className="text-[11px] text-muted-foreground">{s.role}</span>}
                    </label>
                  ))}
                  {staffFiltrado.length === 0 && <p className="px-3 py-3 text-sm text-muted-foreground">Ninguém com esse nome.</p>}
                </div>
                <p className="text-xs text-muted-foreground">
                  Essas pessoas recebem o aviso de todas as reuniões, mesmo sem participar delas. Quem está sem telefone no cadastro não recebe.
                </p>
              </div>

              {semDestinatario && (
                <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-300">
                  Do jeito que está, ninguém recebe o aviso. Marque uma opção ou escolha alguém na lista.
                  <Button variant="link" size="sm" className="h-auto p-0 ml-1 text-xs" onClick={async () => { setIncluirResponsavel(true); await salvar(KEYS.responsible, "true"); }}>
                    Voltar a avisar o responsável
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
