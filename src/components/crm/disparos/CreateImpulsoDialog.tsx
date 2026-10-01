// Novo impulso (benchmark Datacrazy, 30/09/2026): uma lista de leads recebe UMA ação em
// lotes, no ritmo escolhido. Portado do UNV Sales e adaptado ao Nexus.
// De onde vêm os itens: seleção do kanban, todos do filtro atual do kanban, um funil
// (com etapa, responsável e etiqueta opcionais), uma etiqueta ou uma lista de telefones.
// Ações: WhatsApp pelo número conectado, template da API oficial, mover de etapa,
// etiqueta, responsável e cadência.
// Fluxo em dois passos: configurar, depois conferir a contagem (crm_impulso_preview) e só
// então criar (crm_impulso_criar). Quem envia de verdade é a edge crm-impulso-tick.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, ArrowLeft, Loader2, Zap } from "lucide-react";

export type ImpulsoAction = "whatsapp_text" | "official_template" | "move_stage" | "add_tag" | "assign_owner" | "cadence";
type SourceType = "selected" | "filtered" | "filter" | "tag" | "phones";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** leads marcados no kanban */
  leadIds?: string[];
  /** todos os leads do filtro atual do kanban (opcional) */
  filteredLeadIds?: string[];
  onCreated?: (id: string) => void;
}

interface TemplateComponent { type: string; text?: string }
interface Template { id: string; name: string; language: string; status: string; category: string; components: TemplateComponent[] }
interface Preview {
  total: number; elegiveis: number; sem_telefone: number; opt_out: number; repetidos: number; sem_lead: number;
  amostra: { name: string | null; phone: string | null; company: string | null }[];
}

export const ACTION_LABEL: Record<ImpulsoAction, string> = {
  whatsapp_text: "Mensagem de WhatsApp (número conectado)",
  official_template: "Template da API oficial",
  move_stage: "Mover de etapa",
  add_tag: "Aplicar etiqueta",
  assign_owner: "Atribuir responsável",
  cadence: "Inscrever em cadência",
};
const MAX_LOTE: Record<ImpulsoAction, number> = { whatsapp_text: 30, official_template: 100, move_stage: 500, add_tag: 500, assign_owner: 500, cadence: 500 };
const LOTE_PADRAO: Record<ImpulsoAction, string> = { whatsapp_text: "10", official_template: "20", move_stage: "100", add_tag: "100", assign_owner: "100", cadence: "50" };
const DIAS = [
  { v: 0, l: "Dom" }, { v: 1, l: "Seg" }, { v: 2, l: "Ter" }, { v: 3, l: "Qua" }, { v: 4, l: "Qui" }, { v: 5, l: "Sex" }, { v: 6, l: "Sáb" },
];
const isMsg = (a: ImpulsoAction) => a === "whatsapp_text" || a === "official_template";
const num = (v: number) => Number(v || 0).toLocaleString("pt-BR");
const firstName = (name: string | null | undefined) => {
  const f = String(name || "").trim().split(/\s+/)[0] || "";
  if (!f) return "";
  return f === f.toUpperCase() ? f.charAt(0) + f.slice(1).toLowerCase() : f;
};

/** Uma linha por contato: "telefone" ou "telefone;nome" (aceita ; , ou tab, em qualquer ordem). */
function parsePhones(text: string): { phone: string; name?: string }[] {
  const out: { phone: string; name?: string }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(/[;,\t]/).map((p) => p.trim()).filter(Boolean);
    const idx = parts.findIndex((p) => p.replace(/\D/g, "").length >= 8);
    if (idx < 0) continue;
    const name = parts.filter((_, i) => i !== idx).join(" ").trim();
    out.push({ phone: parts[idx], ...(name ? { name } : {}) });
  }
  return out;
}

function duracaoTexto(seg: number) {
  if (seg < 90) return `${Math.round(seg)} segundos`;
  if (seg < 5400) return `${Math.round(seg / 60)} min`;
  if (seg < 86400 * 2) return `${(seg / 3600).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`;
  return `${(seg / 86400).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dias`;
}

export function CreateImpulsoDialog({ open, onOpenChange, leadIds, filteredLeadIds, onCreated }: Props) {
  const navigate = useNavigate();
  const nSel = leadIds?.length || 0;
  const nFiltro = filteredLeadIds?.length || 0;
  const doKanban = nSel > 0 || nFiltro > 0;

  const [step, setStep] = useState<"config" | "confirm">("config");
  const [name, setName] = useState("");
  const [sourceType, setSourceType] = useState<SourceType>("filter");
  const [action, setAction] = useState<ImpulsoAction>("whatsapp_text");

  // listas
  const [pipelines, setPipelines] = useState<{ id: string; name: string }[]>([]);
  const [stages, setStages] = useState<{ id: string; name: string; pipeline_id: string }[]>([]);
  const [owners, setOwners] = useState<{ id: string; name: string }[]>([]);
  const [tags, setTags] = useState<{ id: string; name: string }[]>([]);
  const [cadences, setCadences] = useState<{ id: string; name: string }[]>([]);
  const [instances, setInstances] = useState<{ id: string; label: string; connected: boolean }[]>([]);
  const [officialInstances, setOfficialInstances] = useState<{ id: string; label: string }[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);

  // fonte
  const [srcPipeline, setSrcPipeline] = useState("");
  const [srcStage, setSrcStage] = useState("none");
  const [srcOwner, setSrcOwner] = useState("none");
  const [srcTag, setSrcTag] = useState("none");
  const [tagOnly, setTagOnly] = useState("");
  const [phonesText, setPhonesText] = useState("");

  // ação
  const [message, setMessage] = useState("");
  const [instanceId, setInstanceId] = useState("");
  const [officialInstanceId, setOfficialInstanceId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [values, setValues] = useState<string[]>([]);
  const [moveMode, setMoveMode] = useState("none");
  const [dstPipeline, setDstPipeline] = useState("");
  const [dstStage, setDstStage] = useState("");
  const [dstTag, setDstTag] = useState("");
  const [dstOwner, setDstOwner] = useState("");
  const [cadenceId, setCadenceId] = useState("");

  // ritmo e travas
  const [batchSize, setBatchSize] = useState("10");
  const [intervalSec, setIntervalSec] = useState("60");
  const [useWindow, setUseWindow] = useState(true);
  const [winStart, setWinStart] = useState("09:00");
  const [winEnd, setWinEnd] = useState("18:00");
  const [winDays, setWinDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [dailyCap, setDailyCap] = useState("200");
  const [startNow, setStartNow] = useState(true);

  const [preview, setPreview] = useState<Preview | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep("config");
    setPreview(null);
    setName(`Impulso ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`);
    setSourceType(nSel > 0 ? "selected" : nFiltro > 0 ? "filtered" : "filter");
    const sb = supabase as any;
    (async () => {
      const [pp, st, ow, tg, cd, ev, of] = await Promise.all([
        sb.from("crm_pipelines").select("id, name").eq("is_active", true).order("sort_order"),
        sb.from("crm_stages").select("id, name, pipeline_id, sort_order").order("sort_order"),
        sb.from("onboarding_staff").select("id, name, role").eq("is_active", true).order("name"),
        sb.from("crm_tags").select("id, name").eq("is_active", true).order("name"),
        sb.from("crm_cadences").select("id, name").eq("is_active", true).order("name"),
        sb.from("whatsapp_instances").select("id, instance_name, display_name, phone_number, status").order("display_name"),
        sb.from("whatsapp_official_instances").select("id, display_name, phone_number, status").eq("status", "connected"),
      ]);
      setPipelines(pp.data || []);
      setStages(st.data || []);
      setOwners((ow.data || []).filter((s: any) => ["master", "admin", "head_comercial", "closer", "sdr"].includes(s.role)));
      setTags(tg.data || []);
      setCadences(cd.data || []);
      setInstances((ev.data || []).map((i: any) => ({
        id: i.id, connected: i.status === "connected",
        label: `${i.display_name || i.instance_name}${i.phone_number ? ` · ${i.phone_number}` : ""}${i.status === "connected" ? "" : " (desconectado)"}`,
      })));
      const ofs = (of.data || []).map((i: any) => ({ id: i.id, label: `${i.display_name || "API oficial"}${i.phone_number ? ` · ${i.phone_number}` : ""}` }));
      setOfficialInstances(ofs);
      if (ofs.length) setOfficialInstanceId((cur) => cur || ofs[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // lista de telefones só serve pra mensagem
  useEffect(() => {
    if (sourceType === "phones" && !isMsg(action)) setAction("whatsapp_text");
  }, [sourceType, action]);

  // padrões por ação
  useEffect(() => {
    setBatchSize(LOTE_PADRAO[action]);
    setUseWindow(isMsg(action));
    setPreview(null);
  }, [action]);

  // templates aprovados do número oficial
  useEffect(() => {
    if (!open || action !== "official_template" || !officialInstanceId) return;
    (async () => {
      const { data, error } = await supabase.functions.invoke("whatsapp-official-api", { body: { action: "getTemplates", instanceId: officialInstanceId } });
      if (error || data?.error) { toast.error("Não consegui carregar os templates da Meta"); return; }
      setTemplates(((data?.templates || []) as Template[]).filter((t) => t.status === "APPROVED"));
    })();
  }, [open, action, officialInstanceId]);

  const template = useMemo(() => templates.find((t) => t.name === templateName) || null, [templates, templateName]);
  const templateBody = template?.components.find((c) => c.type === "BODY")?.text || "";
  const varCount = useMemo(() => new Set(templateBody.match(/\{\{\d+\}\}/g) || []).size, [templateBody]);
  useEffect(() => {
    setValues((prev) => {
      const next = [...prev].slice(0, varCount);
      while (next.length < varCount) next.push("");
      if (varCount >= 1 && !next[0]) next[0] = "{primeiro_nome}";
      return next;
    });
  }, [templateName, varCount]);

  const phones = useMemo(() => parsePhones(phonesText), [phonesText]);
  const lote = Math.max(1, parseInt(batchSize, 10) || 1);
  const intervalo = Math.max(1, parseInt(intervalSec, 10) || 1);
  const teto = dailyCap.trim() ? parseInt(dailyCap, 10) || 0 : null;
  const nomeDe = (list: { id: string; name: string }[], id: string) => list.find((x) => x.id === id)?.name || "";

  const buildSource = (): Record<string, unknown> | null => {
    if (sourceType === "selected") return { type: "leads", lead_ids: leadIds || [], label: "Seleção do kanban" };
    if (sourceType === "filtered") return { type: "leads", lead_ids: filteredLeadIds || [], label: "Todos do filtro atual do kanban" };
    if (sourceType === "filter") {
      if (!srcPipeline) { toast.error("Escolha o funil"); return null; }
      const partes = [`Funil ${nomeDe(pipelines, srcPipeline)}`];
      if (srcStage !== "none") partes.push(`etapa ${nomeDe(stages, srcStage)}`);
      if (srcOwner !== "none") partes.push(`responsável ${nomeDe(owners, srcOwner)}`);
      if (srcTag !== "none") partes.push(`etiqueta ${nomeDe(tags, srcTag)}`);
      return {
        type: "filter", pipeline_id: srcPipeline, stage_id: srcStage === "none" ? "" : srcStage,
        owner_id: srcOwner === "none" ? "" : srcOwner, tag_id: srcTag === "none" ? "" : srcTag, label: partes.join(" · "),
      };
    }
    if (sourceType === "tag") {
      if (!tagOnly) { toast.error("Escolha a etiqueta"); return null; }
      return { type: "tag", tag_id: tagOnly, label: `Etiqueta ${nomeDe(tags, tagOnly)}` };
    }
    if (!phones.length) { toast.error("Cole pelo menos um telefone, um por linha"); return null; }
    return { type: "phones", phones, label: `Lista colada (${phones.length} telefones)` };
  };

  const buildConfig = (): Record<string, unknown> | null => {
    if (action === "whatsapp_text") {
      if (!message.trim()) { toast.error("Escreva a mensagem"); return null; }
      if (!instanceId) { toast.error("Escolha o número que envia"); return null; }
      if (!instances.find((i) => i.id === instanceId)?.connected) { toast.error("Esse número está desconectado. Escolha um número conectado."); return null; }
      return { message, instance_id: instanceId, instance_label: instances.find((i) => i.id === instanceId)?.label };
    }
    if (action === "official_template") {
      if (!officialInstanceId || !template) { toast.error("Escolha o número oficial e o template"); return null; }
      if (values.some((v) => !v.trim())) { toast.error("Preencha todas as variáveis do template"); return null; }
      return {
        official_instance_id: officialInstanceId, template_name: template.name, template_language: template.language,
        template_category: template.category, template_body: templateBody,
        body_preview: templateBody.replace(/\{\{(\d+)\}\}/g, (_, k) => values[Number(k) - 1] || ""),
        variables: values, move_mode: moveMode,
      };
    }
    if (action === "move_stage") {
      if (!dstStage) { toast.error("Escolha a etapa de destino"); return null; }
      return { stage_id: dstStage, stage_name: nomeDe(stages, dstStage), pipeline_name: nomeDe(pipelines, dstPipeline) };
    }
    if (action === "add_tag") {
      if (!dstTag) { toast.error("Escolha a etiqueta"); return null; }
      return { tag_id: dstTag, tag_name: nomeDe(tags, dstTag) };
    }
    if (action === "assign_owner") {
      if (!dstOwner) { toast.error("Escolha o responsável"); return null; }
      return { owner_id: dstOwner, owner_name: nomeDe(owners, dstOwner) };
    }
    if (!cadenceId) { toast.error("Escolha a cadência"); return null; }
    return { cadence_id: cadenceId, cadence_name: nomeDe(cadences, cadenceId) };
  };

  const validarRitmo = () => {
    if (lote > MAX_LOTE[action]) { toast.error(`Pra essa ação o lote vai até ${MAX_LOTE[action]} itens`); return false; }
    if (intervalo < 60) { toast.error("O intervalo mínimo entre lotes é de 60 segundos"); return false; }
    if (useWindow) {
      if (!winStart || !winEnd || winStart >= winEnd) { toast.error("A janela precisa terminar depois de começar"); return false; }
      if (!winDays.length) { toast.error("Marque pelo menos um dia da semana"); return false; }
    }
    if (teto !== null && teto < 1) { toast.error("O teto diário precisa ser pelo menos 1, ou deixe em branco"); return false; }
    return true;
  };

  const conferir = async () => {
    const source = buildSource();
    if (!source) return;
    if (!buildConfig() || !validarRitmo()) return;
    setChecking(true);
    const { data, error } = await (supabase as any).rpc("crm_impulso_preview", { p_source: source, p_action: action });
    setChecking(false);
    if (error) { toast.error(error.message || "Não consegui contar os itens"); return; }
    setPreview(data as Preview);
    setStep("confirm");
  };

  const criar = async () => {
    const source = buildSource();
    const config = buildConfig();
    if (!source || !config || !validarRitmo() || saving) return;
    setSaving(true);
    const { data, error } = await (supabase as any).rpc("crm_impulso_criar", {
      p_name: name.trim(), p_action: action, p_config: config, p_source: source,
      p_batch_size: lote, p_interval_seconds: intervalo,
      p_window: useWindow ? { start: winStart, end: winEnd, weekdays: winDays } : null,
      p_daily_cap: isMsg(action) ? teto : null, p_start: startNow,
    });
    setSaving(false);
    if (error) { toast.error(error.message || "Erro ao criar o impulso"); return; }
    toast.success(startNow ? "Impulso criado. O primeiro lote sai em até 1 minuto." : "Impulso salvo como rascunho. Inicie quando quiser na aba Impulsos.");
    window.dispatchEvent(new CustomEvent("crm-impulso-criado", { detail: { id: data } }));
    onOpenChange(false);
    onCreated?.(data as string);
    navigate("/crm/disparos?aba=impulsos");
  };

  // estimativa (passo de conferência, já com a contagem real)
  const eleg = preview?.elegiveis || 0;
  const lotes = Math.ceil(eleg / lote);
  const segundos = Math.max(0, lotes - 1) * intervalo;
  const diasPeloTeto = isMsg(action) && teto ? Math.ceil(eleg / teto) : 1;
  const amostra = preview?.amostra?.[0];
  const exemploTexto = action === "whatsapp_text"
    ? message.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => k === "nome" ? (amostra?.name || "") : k === "primeiro_nome" ? firstName(amostra?.name) : k === "empresa" ? (amostra?.company || "") : "")
    : action === "official_template"
      ? templateBody.replace(/\{\{(\d+)\}\}/g, (_m, k) => (values[Number(k) - 1] || "")
          .replace(/\{primeiro_nome\}/gi, firstName(amostra?.name) || "tudo bem").replace(/\{nome\}/gi, amostra?.name || "").replace(/\{sdr\}/gi, "você"))
      : "";

  const sourceOptions = [
    ...(nSel > 0 ? [{ value: "selected", label: `Os ${num(nSel)} leads selecionados no kanban` }] : []),
    ...(nFiltro > 0 ? [{ value: "filtered", label: `Todos os ${num(nFiltro)} leads do filtro atual` }] : []),
    { value: "filter", label: "Leads de um funil (com filtros)" },
    { value: "tag", label: "Leads com uma etiqueta" },
    { value: "phones", label: "Colar lista de telefones" },
  ];
  const actionOptions = (Object.keys(ACTION_LABEL) as ImpulsoAction[])
    .filter((a) => sourceType !== "phones" || isMsg(a))
    .map((a) => ({ value: a, label: ACTION_LABEL[a] }));

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-amber-500" /> {step === "config" ? "Novo impulso" : "Conferir antes de começar"}</DialogTitle>
          <DialogDescription>
            {step === "config"
              ? "Execução em massa por lotes, no ritmo que você escolher. Cada lead vira um item com status próprio."
              : "Confira a contagem. Depois de iniciado, dá pra pausar, retomar ou cancelar na aba Impulsos."}
          </DialogDescription>
        </DialogHeader>

        {step === "config" ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="rounded-lg border border-border p-3 space-y-3">
              <p className="text-sm font-medium">Quem entra</p>
              <SearchableSelect value={sourceType} onValueChange={(v) => { setSourceType(v as SourceType); setPreview(null); }} options={sourceOptions} />
              {!doKanban && sourceType === "filter" && (
                <p className="text-[11px] text-muted-foreground">Pra mandar só pra alguns leads, marque no kanban e use "Criar impulso" na barra de ações.</p>
              )}
              {sourceType === "filter" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Funil</Label>
                    <SearchableSelect value={srcPipeline} onValueChange={(v) => { setSrcPipeline(v); setSrcStage("none"); }}
                      options={pipelines.map((p) => ({ value: p.id, label: p.name }))} placeholder="Escolha o funil" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Etapa</Label>
                    <SearchableSelect value={srcStage} onValueChange={setSrcStage} allowNone noneLabel="Todas as etapas"
                      options={stages.filter((s) => s.pipeline_id === srcPipeline).map((s) => ({ value: s.id, label: s.name }))} disabled={!srcPipeline} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Responsável</Label>
                    <SearchableSelect value={srcOwner} onValueChange={setSrcOwner} allowNone noneLabel="Qualquer responsável"
                      options={owners.map((o) => ({ value: o.id, label: o.name }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Etiqueta</Label>
                    <SearchableSelect value={srcTag} onValueChange={setSrcTag} allowNone noneLabel="Com ou sem etiqueta"
                      options={tags.map((t) => ({ value: t.id, label: t.name }))} />
                  </div>
                </div>
              )}
              {sourceType === "tag" && (
                <div className="space-y-1.5">
                  <Label>Etiqueta</Label>
                  <SearchableSelect value={tagOnly} onValueChange={setTagOnly} options={tags.map((t) => ({ value: t.id, label: t.name }))} placeholder="Escolha a etiqueta" />
                </div>
              )}
              {sourceType === "phones" && (
                <div className="space-y-1.5">
                  <Label>Telefones, um por linha</Label>
                  <Textarea rows={5} value={phonesText} onChange={(e) => setPhonesText(e.target.value)}
                    placeholder={"31999990000\n(11) 98888-7777; Maria Silva\n5521977776666; João"} />
                  <p className="text-[11px] text-muted-foreground">
                    {phones.length ? `${num(phones.length)} telefone(s) lidos. ` : ""}
                    Dá pra pôr o nome depois de ponto e vírgula. Número que já é lead no CRM entra ligado ao lead.
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border p-3 space-y-3">
              <p className="text-sm font-medium">O que fazer com cada um</p>
              <SearchableSelect value={action} onValueChange={(v) => setAction(v as ImpulsoAction)} options={actionOptions} />

              {action === "whatsapp_text" && (
                <>
                  <div className="space-y-1.5">
                    <Label>Número que envia</Label>
                    <SearchableSelect value={instanceId} onValueChange={setInstanceId} options={instances.map((i) => ({ value: i.id, label: i.label }))} placeholder="Escolha o número" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Mensagem</Label>
                    <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Oi {{primeiro_nome}}, tudo bem?" />
                    <p className="text-[11px] text-muted-foreground">Variáveis: {"{{nome}}"}, {"{{primeiro_nome}}"} e {"{{empresa}}"}. Sem valor, a variável some da mensagem.</p>
                  </div>
                </>
              )}

              {action === "official_template" && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Número oficial</Label>
                      <SearchableSelect value={officialInstanceId} onValueChange={setOfficialInstanceId} options={officialInstances.map((i) => ({ value: i.id, label: i.label }))}
                        placeholder={officialInstances.length ? "Escolha" : "Nenhum número oficial conectado"} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Template aprovado</Label>
                      <SearchableSelect value={templateName} onValueChange={setTemplateName}
                        options={templates.map((t) => ({ value: t.name, label: t.name, hint: t.category.toLowerCase() }))}
                        placeholder={templates.length ? "Escolha" : "Nenhum aprovado"} />
                    </div>
                  </div>
                  {template && varCount > 0 && (
                    <div className="space-y-2">
                      <Label>Variáveis <span className="font-normal text-muted-foreground">(use {"{primeiro_nome}"}, {"{nome}"} ou {"{sdr}"} pra preencher por lead)</span></Label>
                      {Array.from({ length: varCount }).map((_, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="w-10 shrink-0 text-xs text-muted-foreground">{`{{${i + 1}}}`}</span>
                          <Input value={values[i] || ""} onChange={(e) => setValues((v) => { const n = [...v]; n[i] = e.target.value; return n; })} placeholder={`Valor da variável ${i + 1}`} />
                        </div>
                      ))}
                    </div>
                  )}
                  {template && (
                    <>
                      <div className="rounded-md bg-muted/50 p-3 text-sm whitespace-pre-wrap">{templateBody.replace(/\{\{(\d+)\}\}/g, (_m, k) => values[Number(k) - 1] || `{{${k}}}`)}</div>
                      <div className="space-y-1.5">
                        <Label>Depois de enviar</Label>
                        <SearchableSelect value={moveMode} onValueChange={setMoveMode}
                          options={[{ value: "none", label: "Não mover o lead" }, { value: "next", label: "Mover pra próxima etapa do funil" }]} />
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        O impulso vira um disparo da API oficial, alimentado lote a lote (aparece na aba Disparos, com entregue, lido e resposta). A Meta cobra por template entregue.
                      </p>
                    </>
                  )}
                </>
              )}

              {action === "move_stage" && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Funil de destino</Label>
                      <SearchableSelect value={dstPipeline} onValueChange={(v) => { setDstPipeline(v); setDstStage(""); }} options={pipelines.map((p) => ({ value: p.id, label: p.name }))} placeholder="Escolha o funil" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Etapa de destino</Label>
                      <SearchableSelect value={dstStage} onValueChange={setDstStage} disabled={!dstPipeline}
                        options={stages.filter((s) => s.pipeline_id === dstPipeline).map((s) => ({ value: s.id, label: s.name }))} placeholder="Escolha a etapa" />
                    </div>
                  </div>
                  <p className="flex gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    As automações da etapa (cadência, agente de IA, avisos) disparam pra cada lead, no ritmo do impulso. A trava de etapa (atividade obrigatória e campo exigido) não é conferida aqui; etapa de ganho sem valor falha e fica com o motivo no item.
                  </p>
                </>
              )}

              {action === "add_tag" && (
                <div className="space-y-1.5">
                  <Label>Etiqueta</Label>
                  <SearchableSelect value={dstTag} onValueChange={setDstTag} options={tags.map((t) => ({ value: t.id, label: t.name }))} placeholder="Escolha a etiqueta" />
                </div>
              )}

              {action === "assign_owner" && (
                <div className="space-y-1.5">
                  <Label>Novo responsável</Label>
                  <SearchableSelect value={dstOwner} onValueChange={setDstOwner} options={owners.map((o) => ({ value: o.id, label: o.name }))} placeholder="Escolha a pessoa" />
                </div>
              )}

              {action === "cadence" && (
                <div className="space-y-1.5">
                  <Label>Cadência</Label>
                  <SearchableSelect value={cadenceId} onValueChange={setCadenceId} options={cadences.map((c) => ({ value: c.id, label: c.name }))}
                    placeholder={cadences.length ? "Escolha" : "Nenhuma cadência ativa"} />
                  <p className="text-[11px] text-muted-foreground">Quem já está na cadência é pulado. Os passos seguem o ritmo da própria cadência.</p>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border p-3 space-y-3">
              <p className="text-sm font-medium">Ritmo e travas</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Itens por lote</Label>
                  <Input inputMode="numeric" value={batchSize} onChange={(e) => setBatchSize(e.target.value.replace(/\D/g, ""))} />
                  <p className="text-[11px] text-muted-foreground">Até {MAX_LOTE[action]} pra essa ação.</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Segundos entre lotes</Label>
                  <Input inputMode="numeric" value={intervalSec} onChange={(e) => setIntervalSec(e.target.value.replace(/\D/g, ""))} />
                  <p className="text-[11px] text-muted-foreground">Mínimo 60 (o motor roda a cada minuto).</p>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Switch checked={useWindow} onCheckedChange={setUseWindow} />
                Só rodar dentro de uma janela de horário
              </label>
              {useWindow && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Das</span>
                    <Input type="time" className="h-9 w-[120px]" value={winStart} onChange={(e) => setWinStart(e.target.value)} />
                    <span className="text-muted-foreground">às</span>
                    <Input type="time" className="h-9 w-[120px]" value={winEnd} onChange={(e) => setWinEnd(e.target.value)} />
                    <span className="text-[11px] text-muted-foreground">horário de Brasília</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {DIAS.map((d) => (
                      <Button key={d.v} type="button" size="sm" variant={winDays.includes(d.v) ? "default" : "outline"} className="h-8 px-2.5 text-xs"
                        onClick={() => setWinDays((prev) => (prev.includes(d.v) ? prev.filter((x) => x !== d.v) : [...prev, d.v].sort()))}>
                        {d.l}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {isMsg(action) && (
                <div className="space-y-1.5">
                  <Label>Teto diário do número</Label>
                  <Input inputMode="numeric" className="w-[160px]" value={dailyCap} onChange={(e) => setDailyCap(e.target.value.replace(/\D/g, ""))} placeholder="Sem teto" />
                  <p className="text-[11px] text-muted-foreground">
                    {action === "official_template"
                      ? "Conta todos os templates que esse número oficial mandou no dia, por impulso ou não. Bateu o teto, o impulso continua no dia seguinte."
                      : "Conta as mensagens que esse número mandou por impulso no dia. Bateu o teto, o impulso continua no dia seguinte."}
                  </p>
                </div>
              )}

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Switch checked={startNow} onCheckedChange={setStartNow} />
                Começar assim que eu confirmar (desligado = salvar como rascunho)
              </label>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-lg border border-border p-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Vão rodar</div>
                <div className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{num(eleg)}</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Na lista</div>
                <div className="text-2xl font-bold tabular-nums">{num(preview?.total || 0)}</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Pulados</div>
                <div className="text-2xl font-bold tabular-nums text-muted-foreground">{num((preview?.total || 0) - eleg)}</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Lotes</div>
                <div className="text-2xl font-bold tabular-nums">{num(lotes)}</div>
              </div>
            </div>

            {(preview?.total || 0) - eleg > 0 && (
              <p className="text-xs text-muted-foreground">
                Pulados:
                {preview!.sem_telefone > 0 && ` ${num(preview!.sem_telefone)} sem telefone válido.`}
                {preview!.opt_out > 0 && ` ${num(preview!.opt_out)} pediram pra não receber (etiqueta Opt-out).`}
                {preview!.repetidos > 0 && ` ${num(preview!.repetidos)} com telefone repetido na lista.`}
                {preview!.sem_lead > 0 && ` ${num(preview!.sem_lead)} sem lead no CRM.`}
                {" "}Eles aparecem na lista de itens com o motivo.
              </p>
            )}

            <div className="rounded-lg border border-border p-3 text-sm space-y-1.5">
              <div><span className="text-muted-foreground">Ação:</span> <b>{ACTION_LABEL[action]}</b></div>
              <div>
                <span className="text-muted-foreground">Ritmo:</span> {num(lote)} por lote a cada {num(intervalo)} segundos.
                {eleg > 0 && <> Do primeiro ao último lote: cerca de <b>{duracaoTexto(segundos)}</b>{useWindow ? ", contando só o tempo dentro da janela" : ""}.</>}
              </div>
              <div>
                <span className="text-muted-foreground">Janela:</span>{" "}
                {useWindow ? `das ${winStart} às ${winEnd}, ${DIAS.filter((d) => winDays.includes(d.v)).map((d) => d.l).join(", ")}` : "qualquer dia e horário"}
              </div>
              {isMsg(action) && (
                <div>
                  <span className="text-muted-foreground">Teto diário do número:</span> {teto ? num(teto) : "sem teto"}
                  {teto && diasPeloTeto > 1 ? <b> (com esse teto, leva pelo menos {diasPeloTeto} dias)</b> : null}
                </div>
              )}
              <div><span className="text-muted-foreground">Início:</span> {startNow ? "agora, o primeiro lote sai em até 1 minuto" : "fica como rascunho até você iniciar"}</div>
            </div>

            {exemploTexto && (
              <div className="rounded-md bg-muted/50 p-3 text-sm whitespace-pre-wrap">
                <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Exemplo{amostra?.name ? ` · ${amostra.name}` : ""}</div>
                {exemploTexto}
              </div>
            )}

            {eleg === 0 && (
              <div className="rounded-md border border-red-500/40 bg-red-500/10 p-2.5 text-xs">Ninguém elegível nessa lista. Volte e ajuste quem entra.</div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "config" ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={conferir} disabled={checking} className="gap-1.5">
                {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Conferir contagem
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("config")} disabled={saving} className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
              <Button onClick={criar} disabled={saving || eleg === 0} className="gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                {startNow ? `Iniciar impulso pra ${num(eleg)}` : `Salvar rascunho com ${num(eleg)}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
