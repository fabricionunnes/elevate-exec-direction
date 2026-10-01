// Painel lateral do editor: configura o bloco selecionado (ou o gatilho e os filtros do fluxo).
import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/crm/traffic/SearchableSelect";
import { Plus, X, Trash2, AlertTriangle } from "lucide-react";
import {
  CATALOGO, TRIGGERS, CAMPOS, CAMPOS_GRAVAVEIS, TRANSFORMS, ACTIVITY_TYPES, WHO, WHO_TASK, WHO_OWNER, CHANNELS, SEND_MODES,
  DIAS_SEMANA, VARS_LEAD, VARS_GATILHO, opsDe, type NodeType, type Listas, type Opcao,
} from "./catalogo";

export interface FluxoMeta { name: string; description: string; trigger_type: string; trigger_config: Record<string, any>; filters: Record<string, any> }
interface Props {
  node: { id: string; type: NodeType; data: Record<string, any> } | null;
  listas: Listas;
  meta: FluxoMeta;
  readOnly: boolean;
  onMeta: (patch: Partial<FluxoMeta>) => void;
  onData: (patch: Record<string, any>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

const Campo = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-xs">{label}</Label>
    {children}
    {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
  </div>
);
const Chave = ({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) => (
  <label className="flex items-start gap-2 text-xs cursor-pointer text-foreground"><Switch checked={checked} onCheckedChange={onChange} className="mt-0.5" /> <span>{children}</span></label>
);
const num = (v: string, min = 0) => Math.max(min, parseInt(v, 10) || 0);
const comQualquer = (rotulo: string, lista: Opcao[]) => [{ value: "", label: rotulo }, ...lista];

function PeoplePicker({ staff, ids, onChange }: { staff: { id: string; name: string }[]; ids: string[]; onChange: (v: string[]) => void }) {
  const livres = staff.filter((s) => !ids.includes(s.id));
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1">
        {ids.map((id) => (
          <Badge key={id} variant="secondary" className="gap-1 font-normal">{staff.find((s) => s.id === id)?.name || "Pessoa inativa"}
            <button type="button" onClick={() => onChange(ids.filter((x) => x !== id))}><X className="h-3 w-3" /></button>
          </Badge>
        ))}
      </div>
      <SearchableSelect value="" onChange={(v) => { if (v) onChange([...ids, v]); }} options={livres.map((s) => ({ value: s.id, label: s.name }))} placeholder="Adicionar pessoa" />
    </div>
  );
}

// Textarea/Input com as variáveis clicáveis embaixo (insere onde o cursor está)
function TextoComVariaveis({ value, onChange, rows, placeholder, vars }: { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string; vars: string[] }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const inserir = (v: string) => {
    const el = ref.current;
    const ini = el?.selectionStart ?? value.length; const fim = el?.selectionEnd ?? value.length;
    onChange(value.slice(0, ini) + v + value.slice(fim));
    setTimeout(() => { el?.focus(); el?.setSelectionRange(ini + v.length, ini + v.length); }, 0);
  };
  return (
    <div className="space-y-1.5">
      <Textarea ref={ref} rows={rows ?? 4} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      <div className="flex flex-wrap gap-1">
        {vars.map((v) => (
          <button key={v} type="button" onClick={() => inserir(v)} className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:border-primary/60">{v}</button>
        ))}
      </div>
    </div>
  );
}

function ValorRegra({ regra, listas, onChange }: { regra: Record<string, any>; listas: Listas; onChange: (v: string) => void }) {
  const campo = CAMPOS.find((c) => c.value === regra.field) || (String(regra.field || "").startsWith("ctx.") ? CAMPOS.find((c) => c.value === "ctx.") : undefined);
  if (["is_empty", "not_empty", "is_true", "is_false"].includes(regra.op)) return null;
  if (regra.field === "has_tag") return <SearchableSelect value={regra.value || ""} onChange={onChange} options={listas.tags} placeholder="Etiqueta" />;
  if (regra.field === "in_cadence") return <SearchableSelect value={regra.value || ""} onChange={onChange} options={comQualquer("Qualquer cadência", listas.cadences)} placeholder="Qualquer cadência" />;
  if (regra.field === "replied_since") return <Input inputMode="numeric" value={regra.value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder="Horas (ex.: 24)" />;
  if (campo?.tipo === "etapa") return <SearchableSelect value={regra.value || ""} onChange={onChange} options={listas.stages} placeholder="Etapa" />;
  if (campo?.tipo === "funil") return <SearchableSelect value={regra.value || ""} onChange={onChange} options={listas.pipelines} placeholder="Funil" />;
  if (campo?.tipo === "origem") return <SearchableSelect value={regra.value || ""} onChange={onChange} options={listas.origins} placeholder="Origem" />;
  if (campo?.tipo === "dono") return <SearchableSelect value={regra.value || ""} onChange={onChange} options={listas.staff.map((s) => ({ value: s.id, label: s.name }))} placeholder="Pessoa" />;
  if (campo?.tipo === "hora") return <Input type="time" value={regra.value || "08:00"} onChange={(e) => onChange(e.target.value)} />;
  if (campo?.tipo === "semana" && regra.op !== "in") return <SearchableSelect value={String(regra.value ?? "")} onChange={onChange} options={DIAS_SEMANA} placeholder="Dia" />;
  if (campo?.tipo === "semana") return <Input value={regra.value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder="1,2,3,4,5 (0 = domingo)" />;
  return <Input value={regra.value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={campo?.tipo === "numero" ? "Número" : "Valor"} />;
}

function Regras({ rules, logic, listas, onChange }: { rules: Record<string, any>[]; logic: string; listas: Listas; onChange: (rules: Record<string, any>[], logic: string) => void }) {
  const set = (i: number, patch: Record<string, any>) => onChange(rules.map((r, j) => (j === i ? { ...r, ...patch } : r)), logic);
  return (
    <div className="space-y-2">
      {rules.length > 1 && (
        <SearchableSelect value={logic || "and"} onChange={(v) => onChange(rules, v)} options={[{ value: "and", label: "Todas as regras precisam valer" }, { value: "or", label: "Basta uma regra valer" }]} />
      )}
      {rules.map((r, i) => {
        const isCtx = String(r.field || "").startsWith("ctx.");
        const ops = opsDe(isCtx ? "ctx." : r.field);
        return (
          <div key={i} className="rounded-lg border border-border p-2 space-y-1.5 bg-muted/30">
            <div className="flex items-center gap-1">
              <div className="flex-1 min-w-0">
                <SearchableSelect value={isCtx ? "ctx." : r.field || ""} onChange={(v) => set(i, { field: v, op: opsDe(v)[0].value, value: v === "now_time" ? "08:00" : "" })} options={CAMPOS.map((c) => ({ value: c.value, label: c.label }))} placeholder="Campo" />
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => onChange(rules.filter((_, j) => j !== i), logic)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
            {isCtx && <Input value={String(r.field).slice(4)} onChange={(e) => set(i, { field: "ctx." + e.target.value.replace(/[^a-zA-Z0-9_]/g, "") })} placeholder="nome_da_variavel" />}
            <SearchableSelect value={ops.some((o) => o.value === r.op) ? r.op : ops[0].value} onChange={(v) => set(i, { op: v })} options={ops} />
            <ValorRegra regra={r} listas={listas} onChange={(v) => set(i, { value: v })} />
          </div>
        );
      })}
      <Button variant="outline" size="sm" className="gap-1 w-full" onClick={() => onChange([...rules, { field: "opportunity_value", op: "gte", value: "" }], logic)}><Plus className="h-3.5 w-3.5" /> Regra</Button>
    </div>
  );
}

function ListaPares({ itens, onChange, k, v, kLabel, vLabel }: { itens: Record<string, string>[]; onChange: (v: Record<string, string>[]) => void; k: string; v: string; kLabel: string; vLabel: string }) {
  return (
    <div className="space-y-1.5">
      {itens.map((h, i) => (
        <div key={i} className="flex gap-1">
          <Input className="h-8 text-xs" value={h[k] || ""} onChange={(e) => onChange(itens.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))} placeholder={kLabel} />
          <Input className="h-8 text-xs" value={h[v] || ""} onChange={(e) => onChange(itens.map((x, j) => (j === i ? { ...x, [v]: e.target.value } : x)))} placeholder={vLabel} />
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => onChange(itens.filter((_, j) => j !== i))}><X className="h-3.5 w-3.5" /></Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="gap-1" onClick={() => onChange([...itens, {}])}><Plus className="h-3.5 w-3.5" /> Adicionar</Button>
    </div>
  );
}

function PainelGatilho({ meta, listas, onMeta }: { meta: FluxoMeta; listas: Listas; onMeta: (p: Partial<FluxoMeta>) => void }) {
  const trig = TRIGGERS.find((t) => t.value === meta.trigger_type);
  const tc = meta.trigger_config || {}; const f = meta.filters || {};
  const setTc = (p: Record<string, any>) => onMeta({ trigger_config: { ...tc, ...p } });
  const setF = (p: Record<string, any>) => onMeta({ filters: { ...f, ...p } });
  const pessoas = listas.staff.map((s) => ({ value: s.id, label: s.name }));
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-foreground">Gatilho e entrada</p>
        <p className="text-[11px] text-muted-foreground">Quando o fluxo começa e quais leads podem entrar.</p>
      </div>
      <Campo label="Nome do fluxo"><Input value={meta.name} onChange={(e) => onMeta({ name: e.target.value })} /></Campo>
      <Campo label="Descrição"><Textarea rows={2} value={meta.description || ""} onChange={(e) => onMeta({ description: e.target.value })} placeholder="Pra que serve esse fluxo" /></Campo>
      <Campo label="Quando começa" hint={trig?.hint}>
        <SearchableSelect value={meta.trigger_type} onChange={(v) => onMeta({ trigger_type: v, trigger_config: TRIGGERS.find((t) => t.value === v)?.tempo ? { only_new: true } : {} })} options={TRIGGERS.map((t) => ({ value: t.value, label: t.label }))} />
      </Campo>

      {meta.trigger_type === "stage_changed" && (<>
        <Campo label="Ao entrar na etapa"><SearchableSelect value={tc.stage_id || ""} onChange={(v) => setTc({ stage_id: v })} options={comQualquer("Qualquer etapa", listas.stages)} /></Campo>
        <Campo label="Vindo da etapa (opcional)"><SearchableSelect value={tc.from_stage_id || ""} onChange={(v) => setTc({ from_stage_id: v })} options={comQualquer("Qualquer etapa", listas.stages)} /></Campo>
      </>)}
      {meta.trigger_type === "tag_added" && <Campo label="Só a etiqueta"><SearchableSelect value={tc.tag_id || ""} onChange={(v) => setTc({ tag_id: v })} options={comQualquer("Qualquer etiqueta", listas.tags)} /></Campo>}
      {trig?.massa && (
        <Chave checked={!!tc.include_bulk} onChange={(v) => setTc({ include_bulk: v })}>
          Incluir importação e ação em massa. Desligado, mais de 20 leads num comando só (ou mais de 30 no mesmo minuto) não disparam o fluxo.
        </Chave>
      )}
      {meta.trigger_type === "lead_idle" && (<>
        <Campo label="Parado há quantos dias"><Input inputMode="numeric" value={tc.days ?? 3} onChange={(e) => setTc({ days: num(e.target.value, 1) })} /></Campo>
        <Campo label="Só na etapa"><SearchableSelect value={tc.stage_id || ""} onChange={(v) => setTc({ stage_id: v })} options={comQualquer("Qualquer etapa aberta", listas.stages)} /></Campo>
      </>)}
      {meta.trigger_type === "activity_overdue" && (<>
        <Campo label="Atrasada há quantas horas"><Input inputMode="numeric" value={tc.hours ?? 1} onChange={(e) => setTc({ hours: num(e.target.value) })} /></Campo>
        <Campo label="Tipo de tarefa"><SearchableSelect value={tc.activity_type || ""} onChange={(v) => setTc({ activity_type: v })} options={comQualquer("Qualquer tipo", ACTIVITY_TYPES)} /></Campo>
      </>)}
      {meta.trigger_type === "no_reply" && (<>
        <Campo label="Sem resposta há quantos minutos"><Input inputMode="numeric" value={tc.minutes ?? 15} onChange={(e) => setTc({ minutes: num(e.target.value, 1) })} /></Campo>
        <Chave checked={!!tc.business_hours} onChange={(v) => setTc({ business_hours: v })}>Contar só minutos dentro do horário de trabalho (mensagem das 22h não estoura o SLA de madrugada)</Chave>
        <Campo label="Só no número"><SearchableSelect value={tc.instance_id || ""} onChange={(v) => setTc({ instance_id: v.replace(/^(evolution|official):/, "") })} options={comQualquer("Qualquer número", listas.sendInstances.map((o) => ({ value: o.value.replace(/^(evolution|official):/, ""), label: o.label })))} /></Campo>
      </>)}
      {meta.trigger_type === "lead_no_reply" && <Campo label="Lead sem responder há quantos dias" hint="Conta a partir da nossa última mensagem na conversa."><Input inputMode="numeric" value={tc.days ?? 2} onChange={(e) => setTc({ days: num(e.target.value, 1) })} /></Campo>}
      {trig?.tempo && (
        <div className="space-y-1.5">
          <Chave checked={tc.only_new !== false} onChange={(v) => setTc({ only_new: v })}>Só daqui pra frente: vale pra casos que acontecerem depois de o fluxo ser ativado</Chave>
          {tc.only_new === false && (
            <p className="flex gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] text-foreground">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600" />
              Vai pegar também o que já estava assim antes de ativar, 50 por varredura. Se o fluxo manda WhatsApp, isso é disparo em massa pra lead antigo: risco de bloqueio do número.
            </p>
          )}
        </div>
      )}

      <div className="rounded-lg border border-border p-3 space-y-3">
        <p className="text-xs font-semibold text-foreground">Filtros de entrada (opcional)</p>
        <Campo label="Funil"><SearchableSelect value={f.pipeline_id || ""} onChange={(v) => setF({ pipeline_id: v })} options={comQualquer("Todos", listas.pipelines)} /></Campo>
        <Campo label="Etapa"><SearchableSelect value={f.stage_id || ""} onChange={(v) => setF({ stage_id: v })} options={comQualquer("Todas", listas.stages)} /></Campo>
        <Campo label="Origem"><SearchableSelect value={f.origin_id || ""} onChange={(v) => setF({ origin_id: v })} options={comQualquer("Todas", listas.origins)} /></Campo>
        <Campo label="Responsável"><SearchableSelect value={f.owner_staff_id || ""} onChange={(v) => setF({ owner_staff_id: v })} options={comQualquer("Qualquer um", pessoas)} /></Campo>
        <Campo label="Tem a etiqueta"><SearchableSelect value={f.tag_id || ""} onChange={(v) => setF({ tag_id: v })} options={comQualquer("Qualquer", listas.tags)} /></Campo>
        <Campo label="Valor mínimo (R$)"><Input inputMode="numeric" value={f.min_value ?? ""} onChange={(e) => setF({ min_value: e.target.value })} /></Campo>
      </div>
    </div>
  );
}

export function PainelBloco({ node, listas, meta, readOnly, onMeta, onData, onDelete, onDuplicate }: Props) {
  const [verCorpo, setVerCorpo] = useState(false);
  const vars = [...VARS_LEAD, ...(VARS_GATILHO[meta.trigger_type] || [])];

  if (!node || node.type === "trigger") {
    return <fieldset disabled={readOnly} className="min-w-0"><PainelGatilho meta={meta} listas={listas} onMeta={onMeta} /></fieldset>;
  }

  const def = CATALOGO[node.type]; const d = node.data || {};
  const Icon = def.icon;
  const pessoas = listas.staff;
  const envio = d.instance_id ? `${d.instance_kind === "official" ? "official" : "evolution"}:${d.instance_id}` : "";
  return (
    <fieldset disabled={readOnly} className="space-y-4 min-w-0">
      <div className="flex items-start gap-2">
        <span className="rounded-md p-1.5 text-white" style={{ background: def.cor }}><Icon className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{def.label}</p>
          <p className="text-[11px] text-muted-foreground">{def.desc}</p>
        </div>
      </div>
      <Campo label="Rótulo no canvas (opcional)"><Input value={d.label || ""} onChange={(e) => onData({ label: e.target.value })} placeholder={def.label} /></Campo>

      {node.type === "note" && <Campo label="Anotação" hint="Fica só no canvas, pra explicar o fluxo pra quem abrir depois."><Textarea rows={6} value={d.text || ""} onChange={(e) => onData({ text: e.target.value })} /></Campo>}

      {node.type === "condition" && <Regras rules={d.rules || []} logic={d.logic || "and"} listas={listas} onChange={(rules, logic) => onData({ rules, logic })} />}

      {node.type === "split" && (
        <Campo label="Percentual que vai pra A" hint={`O resto (${100 - (d.percent_a ?? 50)}%) vai pra B. Bom pra testar duas mensagens.`}>
          <Input inputMode="numeric" value={d.percent_a ?? 50} onChange={(e) => onData({ percent_a: Math.min(100, num(e.target.value)) })} />
        </Campo>
      )}

      {node.type === "wait" && (<>
        <SearchableSelect value={d.mode || "duration"} onChange={(v) => onData({ mode: v, until_time: v === "time" ? d.until_time || "09:00" : "" })}
          options={[{ value: "duration", label: "Esperar um tempo" }, { value: "business", label: "Esperar até o horário de trabalho" }, { value: "time", label: "Esperar até um horário" }]} />
        {(d.mode || "duration") === "duration" && (
          <div className="grid grid-cols-2 gap-2">
            <Campo label="Quanto"><Input inputMode="numeric" value={d.value ?? 1} onChange={(e) => onData({ value: num(e.target.value) })} /></Campo>
            <Campo label="Unidade"><SearchableSelect value={d.unit || "hours"} onChange={(v) => onData({ unit: v })} options={[{ value: "minutes", label: "Minutos" }, { value: "hours", label: "Horas" }, { value: "days", label: "Dias" }]} /></Campo>
          </div>
        )}
        {d.mode === "time" && <Campo label="Horário (Brasília)" hint="Se já passou hoje, segue amanhã nesse horário."><Input type="time" value={d.until_time || "09:00"} onChange={(e) => onData({ until_time: e.target.value })} /></Campo>}
        {d.mode === "business" && <p className="text-[11px] text-muted-foreground">Se já estiver dentro do expediente, segue direto. Fora dele, espera abrir (Configurações do CRM, Horário de Trabalho; feriado conta como fechado).</p>}
        {d.mode !== "business" && <Chave checked={!!d.respect_window} onChange={(v) => onData({ respect_window: v })}>Se cair fora do horário de trabalho, esperar o expediente abrir</Chave>}
      </>)}

      {node.type === "wait_reply" && <Campo label="Esperar até quantas horas" hint="Respondeu antes: segue por Respondeu. Estourou o prazo: segue por Não respondeu."><Input inputMode="numeric" value={d.hours ?? 24} onChange={(e) => onData({ hours: num(e.target.value, 1) })} /></Campo>}

      {node.type === "send_whatsapp" && (<>
        <Campo label="Mensagem"><TextoComVariaveis value={d.message || ""} onChange={(v) => onData({ message: v })} rows={5} placeholder="Oi {primeiro_nome}, tudo bem?" vars={vars} /></Campo>
        <Campo label="Por qual número sai" hint={d.instance_mode === "owner" ? "Usa o número padrão do responsável. Se ele não tiver um definido, o envio falha e aparece nas Execuções." : d.instance_mode === "fixed" ? undefined : "Se o lead ainda não conversou por nenhum número, usa o do responsável ou a reserva abaixo."}>
          <SearchableSelect value={d.instance_mode || "conversation"} onChange={(v) => onData({ instance_mode: v })} options={SEND_MODES} />
        </Campo>
        <Campo label={d.instance_mode === "fixed" ? "Número" : "Número reserva (opcional)"}>
          <SearchableSelect value={envio} onChange={(v) => { const [kind, id] = v.split(":"); onData({ instance_kind: id ? kind : "evolution", instance_id: id || "" }); }}
            options={d.instance_mode === "fixed" ? listas.sendInstances : comQualquer("Nenhum", listas.sendInstances)} placeholder="Escolha o número" />
        </Campo>
        {d.instance_kind === "official" && d.instance_id && <p className="text-[11px] text-muted-foreground">API oficial: texto livre só sai se o lead falou com esse número nas últimas 24 h. Fora disso a Meta recusa e o erro aparece nas Execuções.</p>}
        <Chave checked={d.respect_window !== false} onChange={(v) => onData({ respect_window: v })}>Só enviar em horário de trabalho (fora dele, segura até o expediente abrir)</Chave>
      </>)}

      {node.type === "create_task" && (<>
        <Campo label="Título"><TextoComVariaveis value={d.title || ""} onChange={(v) => onData({ title: v })} rows={2} placeholder="Ligar pra {primeiro_nome}" vars={vars} /></Campo>
        <Campo label="Descrição"><Textarea rows={2} value={d.description || ""} onChange={(e) => onData({ description: e.target.value })} /></Campo>
        <Campo label="Tipo"><SearchableSelect value={d.activity_type || "followup"} onChange={(v) => onData({ activity_type: v })} options={ACTIVITY_TYPES} /></Campo>
        <div className="grid grid-cols-2 gap-2">
          <Campo label="Em dias"><Input inputMode="numeric" value={d.days ?? 0} onChange={(e) => onData({ days: num(e.target.value) })} /></Campo>
          <Campo label="Mais horas"><Input inputMode="numeric" value={d.hours ?? 0} onChange={(e) => onData({ hours: num(e.target.value) })} /></Campo>
        </div>
        <Campo label="Responsável"><SearchableSelect value={d.assignee_mode || "owner"} onChange={(v) => onData({ assignee_mode: v })} options={WHO_TASK} /></Campo>
        {["fixed", "round_robin"].includes(d.assignee_mode) && <PeoplePicker staff={pessoas} ids={d.staff_ids || []} onChange={(v) => onData({ staff_ids: v })} />}
        <Chave checked={d.notify !== false} onChange={(v) => onData({ notify: v })}>Avisar a pessoa no sino do CRM</Chave>
      </>)}

      {node.type === "notify" && (<>
        <Campo label="Mensagem"><TextoComVariaveis value={d.message || ""} onChange={(v) => onData({ message: v })} rows={3} placeholder="{nome} está sem resposta desde {esperando_desde}" vars={vars} /></Campo>
        <Campo label="Pra quem"><SearchableSelect value={d.to || "owner"} onChange={(v) => onData({ to: v })} options={WHO} /></Campo>
        {d.to === "fixed" && <PeoplePicker staff={pessoas} ids={d.staff_ids || []} onChange={(v) => onData({ staff_ids: v })} />}
        <Campo label="Por onde"><SearchableSelect value={d.channel || "app"} onChange={(v) => onData({ channel: v })} options={CHANNELS} /></Campo>
        {["whatsapp", "both"].includes(d.channel) && (
          <Campo label="Número que manda o aviso" hint="Vazio usa o número de avisos do CRM (Configurações, Notificações). A pessoa precisa ter telefone no cadastro.">
            <SearchableSelect value={d.instance_id || ""} onChange={(v) => onData({ instance_id: v })} options={comQualquer("Número de avisos do CRM", listas.instances)} />
          </Campo>
        )}
      </>)}

      {node.type === "move_stage" && <Campo label="Etapa de destino" hint="As travas da etapa valem aqui também: mover pra Ganho sem valor, por exemplo, falha e aparece nas Execuções."><SearchableSelect value={d.stage_id || ""} onChange={(v) => onData({ stage_id: v })} options={listas.stages} placeholder="Escolha" /></Campo>}
      {(node.type === "add_tag" || node.type === "remove_tag") && <Campo label="Etiqueta"><SearchableSelect value={d.tag_id || ""} onChange={(v) => onData({ tag_id: v })} options={listas.tags} placeholder="Escolha" /></Campo>}

      {node.type === "assign_owner" && (<>
        <Campo label="Como escolher"><SearchableSelect value={d.assignee_mode || "round_robin"} onChange={(v) => onData({ assignee_mode: v })} options={WHO_OWNER} /></Campo>
        <PeoplePicker staff={pessoas} ids={d.staff_ids || []} onChange={(v) => onData({ staff_ids: v })} />
      </>)}

      {node.type === "enroll_cadence" && <Campo label="Cadência" hint="Quem já está nela é ignorado."><SearchableSelect value={d.cadence_id || ""} onChange={(v) => onData({ cadence_id: v })} options={listas.cadences} placeholder="Escolha" /></Campo>}
      {node.type === "stop_cadence" && <Campo label="Qual cadência"><SearchableSelect value={d.cadence_id || ""} onChange={(v) => onData({ cadence_id: v })} options={comQualquer("Todas as cadências do lead", listas.cadences)} /></Campo>}
      {node.type === "start_flow" && <Campo label="Fluxo" hint="O outro fluxo começa do gatilho dele com o mesmo lead e as variáveis deste. Até 3 níveis de encadeamento."><SearchableSelect value={d.flow_id || ""} onChange={(v) => onData({ flow_id: v })} options={listas.flows} placeholder="Escolha" /></Campo>}

      {node.type === "webhook" && (<>
        <Campo label="URL"><Input value={d.url || ""} onChange={(e) => onData({ url: e.target.value.trim() })} placeholder="https://" /></Campo>
        <Campo label="Método"><SearchableSelect value={d.method || "POST"} onChange={(v) => onData({ method: v })} options={["POST", "GET", "PUT", "PATCH", "DELETE"].map((m) => ({ value: m, label: m }))} /></Campo>
        <Campo label="Cabeçalhos"><ListaPares itens={d.headers || []} onChange={(v) => onData({ headers: v })} k="key" v="value" kLabel="Nome" vLabel="Valor" /></Campo>
        <Campo label="O que vai no corpo">
          <SearchableSelect value={d.body_mode || "lead"} onChange={(v) => onData({ body_mode: v })}
            options={[{ value: "lead", label: "O lead completo (padrão)" }, { value: "fields", label: "Mapeamento de campos" }, { value: "raw", label: "JSON escrito à mão" }]} />
        </Campo>
        {d.body_mode === "fields" && (
          <Campo label="Campos enviados" hint={`Nome do campo lá e o valor daqui. Variáveis: ${vars.slice(0, 6).join(" ")} e as outras do fluxo.`}>
            <ListaPares itens={d.fields || []} onChange={(v) => onData({ fields: v })} k="key" v="value" kLabel="campo_no_destino" vLabel="{nome}" />
          </Campo>
        )}
        {d.body_mode === "raw" && <Campo label="Corpo (JSON)" hint="As variáveis entram já escapadas pra não quebrar o JSON."><Textarea rows={5} className="font-mono text-xs" value={d.body || ""} onChange={(e) => onData({ body: e.target.value })} placeholder={'{"nome": "{nome}", "telefone": "{telefone}"}'} /></Campo>}
        {(d.body_mode || "lead") === "lead" && (
          <button type="button" className="text-[11px] text-primary hover:underline" onClick={() => setVerCorpo((v) => !v)}>{verCorpo ? "Esconder" : "Ver"} o formato enviado</button>
        )}
        {(d.body_mode || "lead") === "lead" && verCorpo && (
          <pre className="rounded border border-border bg-muted/40 p-2 text-[10px] text-muted-foreground whitespace-pre-wrap">{`{\n  "event": "gatilho", "flow": "nome do fluxo", "sent_at": "...",\n  "lead": { "id", "name", "phone", "email", "company", "value", "pipeline", "stage" },\n  "vars": { variáveis do fluxo }\n}`}</pre>
        )}
        <Chave checked={!!d.wait_response} onChange={(v) => onData({ wait_response: v })}>Esperar a resposta e ler campos dela (até 1 h; sem resposta, segue)</Chave>
        {d.wait_response && (
          <Campo label="Mapear a resposta" hint="Caminho no JSON de resposta (ex.: data.score) e onde gravar: ctx.score vira a variável {{score}}; ou um campo do lead (name, email, phone, company, city, state, segment, notes, opportunity_value). O código HTTP fica em {{webhook_status}}.">
            <ListaPares itens={d.map || []} onChange={(v) => onData({ map: v })} k="from" v="to" kLabel="caminho.na.resposta" vLabel="ctx.variavel" />
          </Campo>
        )}
      </>)}

      {node.type === "set_field" && (<>
        <Campo label="Campo"><SearchableSelect value={String(d.field || "").startsWith("ctx.") ? "ctx." : d.field || ""} onChange={(v) => onData({ field: v })} options={CAMPOS_GRAVAVEIS} /></Campo>
        {String(d.field || "").startsWith("ctx.") && <Campo label="Nome da variável"><Input value={String(d.field).slice(4)} onChange={(e) => onData({ field: "ctx." + e.target.value.replace(/[^a-zA-Z0-9_]/g, "") })} placeholder="ex.: saudacao" /></Campo>}
        <Campo label="Valor" hint="Texto fixo, variáveis ou os dois. Pra só formatar o próprio campo, use a variável dele (ex.: {telefone})."><TextoComVariaveis value={d.value || ""} onChange={(v) => onData({ value: v })} rows={2} vars={vars} /></Campo>
        <Campo label="Formatação"><SearchableSelect value={d.transform || "none"} onChange={(v) => onData({ transform: v })} options={TRANSFORMS} /></Campo>
      </>)}

      {node.type === "formula" && (<>
        <div className="grid grid-cols-[1fr_84px_1fr] gap-1.5 items-end">
          <Campo label="A"><Input value={d.a || ""} onChange={(e) => onData({ a: e.target.value })} placeholder="{valor}" /></Campo>
          <Campo label="Conta"><SearchableSelect value={d.op || "+"} onChange={(v) => onData({ op: v })} options={[{ value: "+", label: "+" }, { value: "-", label: "-" }, { value: "*", label: "×" }, { value: "/", label: "÷" }, { value: "%", label: "% de" }]} /></Campo>
          <Campo label="B"><Input value={d.b || ""} onChange={(e) => onData({ b: e.target.value })} placeholder="1,1" /></Campo>
        </div>
        <Campo label="Guardar em" hint="Variável do fluxo (use depois com {{nome}}) ou direto no valor do negócio.">
          <SearchableSelect value={String(d.result || "ctx.").startsWith("ctx.") ? "ctx." : d.result} onChange={(v) => onData({ result: v === "ctx." ? "ctx.resultado" : v })} options={[{ value: "ctx.", label: "Variável do fluxo" }, { value: "opportunity_value", label: "Valor do negócio" }]} />
        </Campo>
        {String(d.result || "ctx.").startsWith("ctx.") && <Input value={String(d.result || "ctx.resultado").slice(4)} onChange={(e) => onData({ result: "ctx." + e.target.value.replace(/[^a-zA-Z0-9_]/g, "") })} placeholder="resultado" />}
      </>)}

      {!readOnly && (
        <div className="flex gap-2 pt-2 border-t border-border">
          <Button variant="outline" size="sm" className="flex-1" onClick={onDuplicate}>Duplicar bloco</Button>
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={onDelete}><Trash2 className="h-3.5 w-3.5 mr-1" /> Remover</Button>
        </div>
      )}
    </fieldset>
  );
}
