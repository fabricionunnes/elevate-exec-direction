// Configurações do CRM → Integrações: formulários nativos do Meta (Lead Ads) caindo no CRM Comercial.
// Cada formulário ligado importa os leads a cada 5 min pro funil escolhido, com as respostas e o rastreio do anúncio.
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ClipboardList, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface FormRow { form_id: string; form_name: string | null; page_id: string; page_name: string | null; status: string | null; leads_count: number | null; is_active: boolean; pipeline_id: string | null; stage_id: string | null; origin_id: string | null; tag_ids: string[] | null; last_synced_at: string | null; imported_count: number; last_result: string | null }

export function CRMMetaLeadFormsCard() {
  const [rows, setRows] = useState<FormRow[]>([]);
  const [pipelines, setPipelines] = useState<{ id: string; name: string }[]>([]);
  const [stages, setStages] = useState<{ id: string; name: string; pipeline_id: string }[]>([]);
  const [origins, setOrigins] = useState<{ id: string; name: string; pipeline_id: string | null }[]>([]);
  const [tags, setTags] = useState<{ id: string; name: string; color: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busca, setBusca] = useState("");
  const [soAtivos, setSoAtivos] = useState(false);

  const load = useCallback(async () => {
    const sb = supabase as any;
    const [f, p, s, o, tg] = await Promise.all([
      sb.from("crm_meta_lead_forms").select("*").order("is_active", { ascending: false }).order("leads_count", { ascending: false }),
      sb.from("crm_pipelines").select("id, name").eq("is_active", true).order("name"),
      sb.from("crm_stages").select("id, name, pipeline_id, sort_order").order("sort_order"),
      sb.from("crm_origins").select("id, name, pipeline_id").order("name"),
      sb.from("crm_tags").select("id, name, color").order("name"),
    ]);
    setRows(f.data || []); setPipelines(p.data || []); setStages(s.data || []); setOrigins(o.data || []); setTags(tg.data || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const buscarFormularios = async () => {
    setRefreshing(true);
    const { data, error } = await supabase.functions.invoke("crm-meta-leadforms", { body: { action: "forms" } });
    setRefreshing(false);
    if (error || (data as any)?.error) { toast.error("Não consegui buscar os formulários: " + ((data as any)?.error || error?.message)); return; }
    toast.success(`${(data as any).formularios} formulário(s) encontrados em ${(data as any).paginas} página(s).`);
    load();
  };

  const salvar = async (id: string, patch: Partial<FormRow>) => {
    setRows((prev) => prev.map((r) => (r.form_id === id ? { ...r, ...patch } : r)));
    const { error } = await (supabase as any).from("crm_meta_lead_forms").update(patch).eq("form_id", id);
    if (error) { toast.error("Não consegui salvar: " + error.message); load(); }
  };

  const ligar = async (r: FormRow, v: boolean) => {
    if (v && !r.pipeline_id) { toast.error("Escolha o funil antes de ligar."); return; }
    await salvar(r.form_id, { is_active: v });
    toast.success(v ? "Ligado. Os leads que chegarem a partir de agora entram no funil em até 5 minutos." : "Desligado.");
  };

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return rows.filter((r) => (!soAtivos || r.is_active) && (!q || `${r.form_name} ${r.page_name}`.toLowerCase().includes(q)));
  }, [rows, busca, soAtivos]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><ClipboardList className="h-4 w-4 text-primary" />Formulários nativos do Meta (Lead Ads)</CardTitle>
            <CardDescription className="mt-1 max-w-2xl">
              Lead que preencher um formulário ligado entra sozinho no funil escolhido, com todas as respostas na aba Respostas e com campanha, conjunto e anúncio gravados.
              O rastreamento avançado continua valendo: reunião e venda desse lead voltam pra Meta.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={buscarFormularios} disabled={refreshing}>
            {refreshing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}Buscar formulários no Meta
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Input className="h-9 max-w-xs" placeholder="Buscar formulário ou página..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          <label className="flex items-center gap-2 text-sm cursor-pointer"><Switch checked={soAtivos} onCheckedChange={setSoAtivos} />Só os ligados</label>
        </div>
        {loading ? <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Carregando...</div> : visiveis.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Nenhum formulário. Clique em "Buscar formulários no Meta".</p>
        ) : (
          <div className="divide-y rounded-lg border">
            {visiveis.map((r) => (
              <div key={r.form_id} className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{r.form_name || r.form_id}
                      {r.status && r.status !== "ACTIVE" && <Badge variant="secondary" className="ml-2 text-[10px]">arquivado no Meta</Badge>}</p>
                    <p className="text-xs text-muted-foreground">Página {r.page_name} · {r.leads_count ?? 0} lead(s) no Meta
                      {r.imported_count > 0 && ` · ${r.imported_count} no CRM`}{r.last_synced_at && ` · conferido ${format(new Date(r.last_synced_at), "dd/MM HH:mm")}`}</p>
                    {r.last_result?.startsWith("erro") && <p className="text-xs text-destructive mt-0.5">{r.last_result}</p>}
                  </div>
                  <Switch checked={r.is_active} onCheckedChange={(v) => ligar(r, v)} />
                </div>
                <div className="grid sm:grid-cols-3 gap-2">
                  <SearchableSelect value={r.pipeline_id || ""} onValueChange={(v) => salvar(r.form_id, { pipeline_id: v, stage_id: null, origin_id: null })}
                    options={pipelines.map((p) => ({ value: p.id, label: p.name }))} placeholder="Funil de destino" emptyMessage="Nenhum funil." />
                  <SearchableSelect value={r.stage_id || "first"} onValueChange={(v) => salvar(r.form_id, { stage_id: v === "first" ? null : v })}
                    options={[{ value: "first", label: "Primeira etapa do funil" }, ...stages.filter((s) => s.pipeline_id === r.pipeline_id).map((s) => ({ value: s.id, label: s.name }))]} placeholder="Etapa" emptyMessage="Escolha o funil antes." />
                  <SearchableSelect value={r.origin_id || "none"} onValueChange={(v) => salvar(r.form_id, { origin_id: v === "none" ? null : v })}
                    options={[{ value: "none", label: "Sem origem" }, ...origins.filter((o) => !o.pipeline_id || o.pipeline_id === r.pipeline_id).map((o) => ({ value: o.id, label: o.name }))]} placeholder="Origem" emptyMessage="Nenhuma origem." />
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground mr-1">Etiquetas nos leads:</span>
                  {tags.map((t) => { const on = (r.tag_ids || []).includes(t.id); return (
                    <button type="button" key={t.id} onClick={() => salvar(r.form_id, { tag_ids: on ? (r.tag_ids || []).filter((x) => x !== t.id) : [...(r.tag_ids || []), t.id] })}
                      className={`text-[11px] rounded-full border px-2 py-0.5 transition-colors ${on ? "text-white border-transparent" : "text-muted-foreground hover:bg-muted"}`} style={on ? { backgroundColor: t.color || "#64748b" } : undefined}>{t.name}</button>
                  ); })}
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">Só entram os leads que chegarem depois de ligar o formulário. Se o telefone já existir no CRM, as respostas e o rastreio vão pro lead existente, sem duplicar. O responsável segue a aba Distribuição do funil.</p>
      </CardContent>
    </Card>
  );
}
