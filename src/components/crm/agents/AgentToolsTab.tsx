import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCRMContext } from "@/pages/crm/CRMLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SearchableSelect } from "@/components/crm/traffic/SearchableSelect";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Loader2, Wrench, Plug, Plus, Pencil, Trash2, PlugZap, CheckCircle2, AlertCircle, History, ShieldCheck,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Ferramentas internas. As chaves são os nomes que a edge crm-agent-respond usa.
// "nova: true" = desligada por padrão. Sem nada salvo (enabled_tools nulo) o
// agente se comporta como sempre: as antigas ligadas, as novas desligadas.
// ---------------------------------------------------------------------------
type Requisito = "agenda" | "etapa";
interface ToolDef {
  key: string;
  label: string;
  desc: string;
  nova?: boolean;
  requer?: Requisito;
  dependeDe?: string;
}

const FERRAMENTAS: ToolDef[] = [
  {
    key: "consultar_horarios", label: "Consultar horários", requer: "agenda",
    desc: "Olha a agenda do closer e devolve os horários livres do dia, dentro da janela configurada na aba Agenda.",
  },
  {
    key: "agendar_reuniao", label: "Agendar reunião", requer: "agenda", dependeDe: "consultar_horarios",
    desc: "Marca a reunião na agenda do closer, cria a atividade no lead e avisa o responsável. Só funciona junto com Consultar horários.",
  },
  {
    key: "salvar_dados_lead", label: "Salvar dados do lead",
    desc: "Grava nicho, empresa, Instagram e faturamento no cadastro assim que o lead informa. Não sobrescreve o que já está preenchido.",
  },
  {
    key: "marcar_perdido", label: "Marcar como perdido",
    desc: "Quando o lead recusa, marca o negócio como perdido e encerra o atendimento. A recusa clara que o sistema detecta sozinho (\"não tenho interesse\") continua encerrando mesmo com esta ferramenta desligada.",
  },
  {
    key: "marcar_fora_do_perfil", label: "Marcar fora do perfil", requer: "etapa",
    desc: "Move o negócio pra etapa Fora do ICP, registra o motivo e para os follow-ups quando o lead não é do perfil atendido.",
  },
  {
    key: "mover_etapa", label: "Mover de etapa", requer: "etapa",
    desc: "Move o negócio pra outra etapa do funil conforme a conversa avança.",
  },
  {
    key: "web_search", label: "Busca na web",
    desc: "Pesquisa a pessoa ou a empresa na internet pra abordar sob medida. Só é usada em conversa do Instagram.",
  },
  {
    key: "consultar_produtos", label: "Consultar produtos", nova: true,
    desc: "Lê o catálogo de serviços e o valor cadastrado nos produtos do CRM. O agente só cita valor que estiver cadastrado. Sem valor, ele diz que o investimento é apresentado na reunião.",
  },
  {
    key: "consultar_historico_lead", label: "Consultar histórico do lead", nova: true,
    desc: "Traz o resumo do percurso do lead: origem, etapa atual, mudanças de etapa, atividades, reuniões e etiquetas. Serve de contexto interno, o agente não comenta com o lead.",
  },
  {
    key: "criar_tarefa_para_vendedor", label: "Criar tarefa pro vendedor", nova: true,
    desc: "Cria uma tarefa no lead pro responsável (ligar, mandar proposta, retomar contato em tal dia). Limite de 3 tarefas por lead a cada 24 horas.",
  },
  {
    key: "aplicar_etiqueta", label: "Aplicar etiqueta", nova: true,
    desc: "Aplica no lead uma etiqueta que já existe. Não cria etiqueta nova. Atenção: automação com gatilho de etiqueta dispara normalmente.",
  },
  {
    key: "transferir_para_humano", label: "Transferir pra humano", nova: true,
    desc: "Desliga o agente na conversa e avisa o responsável pelo lead na hora, por notificação no sistema e por WhatsApp. Quem religa o agente é a pessoa, no Atendimento.",
  },
];

const padraoDe = (t: ToolDef) => !t.nova;
const PADRAO: Record<string, boolean> = Object.fromEntries(FERRAMENTAS.map((t) => [t.key, padraoDe(t)]));

function lerConfig(raw: unknown): Record<string, boolean> {
  const out = { ...PADRAO };
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const t of FERRAMENTAS) {
      const v = (raw as Record<string, unknown>)[t.key];
      if (typeof v === "boolean") out[t.key] = v;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Servidores MCP (ferramentas externas)
// ---------------------------------------------------------------------------
interface McpTool { name: string; description?: string; schema_simplificado?: boolean }
interface McpServer {
  id: string;
  agent_id: string | null;
  name: string;
  url: string;
  auth_type: "none" | "bearer" | "header";
  auth_header_name: string | null;
  has_secret: boolean;
  allowed_tools: string[];
  tools_cache: McpTool[] | null;
  is_active: boolean;
  timeout_ms: number;
  last_probe_at: string | null;
  last_probe_ok: boolean | null;
  last_probe_error: string | null;
}

const AUTH_OPCOES = [
  { value: "none", label: "Sem autenticação" },
  { value: "bearer", label: "Token (Authorization: Bearer)" },
  { value: "header", label: "Cabeçalho personalizado" },
];
const ESCOPO_OPCOES = [
  { value: "agente", label: "Só este agente" },
  { value: "todos", label: "Todos os agentes" },
];

const formVazio = {
  id: null as string | null,
  name: "",
  url: "",
  escopo: "agente",
  auth_type: "none",
  auth_header_name: "X-API-Key",
  secret: "",
  timeout_s: "8",
  has_secret: false,
};

interface RunRow { id: string; created_at: string; channel: string | null; outcome: string | null; tool_calls: string[] | null }

const dataHora = (iso: string) => format(new Date(iso), "dd/MM HH:mm", { locale: ptBR });
const hostDe = (url: string) => { try { return new URL(url).host; } catch { return url; } };

interface Props {
  agentId: string;
  staffId: string | null;
  tenantId: string | null;
  schedulingEnabled: boolean;
  canMoveStage: boolean;
  onSaved: () => void;
}

export function AgentToolsTab({ agentId, staffId, tenantId, schedulingEnabled, canMoveStage, onSaved }: Props) {
  const { staffRole } = useCRMContext();
  const podeGerenciarMcp = staffRole === "master" || staffRole === "admin";

  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<Record<string, boolean>>({ ...PADRAO });
  const [salvo, setSalvo] = useState<Record<string, boolean>>({ ...PADRAO });
  const [saving, setSaving] = useState(false);

  const [servers, setServers] = useState<McpServer[]>([]);
  const [form, setForm] = useState<typeof formVazio | null>(null);
  const [savingServer, setSavingServer] = useState(false);
  const [probing, setProbing] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [runs, setRuns] = useState<RunRow[]>([]);

  const loadServers = useCallback(async () => {
    const { data, error } = await supabase
      .from("crm_agent_mcp_servers_view" as any)
      .select("*")
      .or(`agent_id.eq.${agentId},agent_id.is.null`)
      .order("created_at", { ascending: true });
    if (!error) setServers(((data || []) as unknown) as McpServer[]);
  }, [agentId]);

  const loadRuns = useCallback(async () => {
    const { data } = await supabase
      .from("crm_ai_agent_runs" as any)
      .select("id, created_at, channel, outcome, tool_calls")
      .eq("agent_id", agentId)
      .not("tool_calls", "is", null)
      .order("created_at", { ascending: false })
      .limit(15);
    setRuns(((data || []) as unknown) as RunRow[]);
  }, [agentId]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("crm_ai_agents" as any)
        .select("enabled_tools")
        .eq("id", agentId)
        .maybeSingle();
      if (!vivo) return;
      const cfg = lerConfig((data as any)?.enabled_tools);
      setConfig(cfg);
      setSalvo(cfg);
      await Promise.all([loadServers(), loadRuns()]);
      if (vivo) setLoading(false);
    })();
    return () => { vivo = false; };
  }, [agentId, loadServers, loadRuns]);

  // agendar_reuniao só existe com consultar_horarios
  const ligada = (t: ToolDef) => !!config[t.key] && (!t.dependeDe || !!config[t.dependeDe]);
  const mudou = useMemo(() => FERRAMENTAS.some((t) => config[t.key] !== salvo[t.key]), [config, salvo]);
  const noPadrao = useMemo(() => FERRAMENTAS.every((t) => config[t.key] === PADRAO[t.key]), [config]);

  const salvarFerramentas = async (cfg: Record<string, boolean>) => {
    setSaving(true);
    const igualPadrao = FERRAMENTAS.every((t) => cfg[t.key] === PADRAO[t.key]);
    // tudo no padrão = nulo no banco (o agente segue exatamente como sempre foi)
    const valor = igualPadrao ? null : Object.fromEntries(FERRAMENTAS.map((t) => [t.key, !!cfg[t.key]]));
    const { error } = await supabase
      .from("crm_ai_agents" as any)
      .update({ enabled_tools: valor, updated_at: new Date().toISOString() })
      .eq("id", agentId);
    setSaving(false);
    if (error) { toast.error(error.message || "Erro ao salvar as ferramentas"); return; }
    setConfig(cfg);
    setSalvo(cfg);
    toast.success(igualPadrao ? "Ferramentas no padrão" : "Ferramentas salvas");
    onSaved();
  };

  const avisoRequisito = (t: ToolDef) => {
    if (t.requer === "agenda" && !schedulingEnabled) return "Só entra em uso com o agendamento ligado na aba Agenda.";
    if (t.requer === "etapa" && !canMoveStage) return "Só entra em uso com \"Mover lead de etapa\" ligado na aba Agenda.";
    if (t.dependeDe && !config[t.dependeDe]) return "Desligada porque Consultar horários está desligada.";
    return null;
  };

  // ------------------------------ MCP ------------------------------
  const abrirNovo = () => setForm({ ...formVazio });
  const abrirEdicao = (s: McpServer) => setForm({
    id: s.id,
    name: s.name,
    url: s.url,
    escopo: s.agent_id ? "agente" : "todos",
    auth_type: s.auth_type,
    auth_header_name: s.auth_header_name || "X-API-Key",
    secret: "",
    timeout_s: String(Math.round((s.timeout_ms || 8000) / 1000)),
    has_secret: s.has_secret,
  });

  const salvarServidor = async () => {
    if (!form) return;
    const name = form.name.trim();
    const url = form.url.trim();
    if (name.length < 2) { toast.error("Dê um nome ao servidor"); return; }
    let host = "";
    try {
      const u = new URL(url);
      if (u.protocol !== "https:") throw new Error("https");
      host = u.hostname;
    } catch {
      toast.error("O endereço precisa ser https, completo. Ex: https://mcp.suaempresa.com.br/mcp");
      return;
    }
    if (!host.includes(".")) { toast.error("Use o domínio público do servidor"); return; }
    if (form.auth_type === "header" && !/^[A-Za-z0-9-]{1,64}$/.test(form.auth_header_name.trim())) {
      toast.error("Nome do cabeçalho inválido. Use só letras, números e hífen.");
      return;
    }
    const semSegredoNovo = !form.secret.trim();
    if (form.auth_type !== "none" && semSegredoNovo && !form.has_secret) {
      toast.error("Informe o segredo (token ou chave) desse servidor");
      return;
    }
    const timeout = Math.min(20, Math.max(1, parseInt(form.timeout_s, 10) || 8)) * 1000;
    const payload: Record<string, unknown> = {
      agent_id: form.escopo === "todos" ? null : agentId,
      name,
      url,
      auth_type: form.auth_type,
      auth_header_name: form.auth_type === "header" ? form.auth_header_name.trim() : null,
      timeout_ms: timeout,
    };
    // o segredo só vai quando foi digitado. Ele não volta do banco pra tela.
    if (form.auth_type === "none") payload.secret = null;
    else if (!semSegredoNovo) payload.secret = form.secret.trim();

    setSavingServer(true);
    let error: { message?: string } | null = null;
    if (form.id) {
      ({ error } = await supabase.from("crm_agent_mcp_servers" as any).update(payload).eq("id", form.id));
    } else {
      ({ error } = await supabase.from("crm_agent_mcp_servers" as any).insert({
        ...payload,
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        created_by: staffId,
      }));
    }
    setSavingServer(false);
    if (error) { toast.error(error.message || "Erro ao salvar o servidor"); return; }
    toast.success(form.id ? "Servidor atualizado" : "Servidor cadastrado. Agora teste a conexão pra ver as ferramentas.");
    setForm(null);
    loadServers();
  };

  const testarConexao = async (s: McpServer) => {
    setProbing(s.id);
    const { data, error } = await supabase.functions.invoke("crm-agent-mcp-probe", { body: { server_id: s.id } });
    setProbing(null);
    let motivo: string | null = null;
    if (error) {
      // resposta fora de 2xx: o motivo vem no corpo
      try { motivo = (await (error as any).context?.json())?.error || null; } catch { /* sem corpo */ }
      motivo = motivo || error.message || "falha ao testar";
    } else if (!data?.ok) {
      motivo = data?.error || "o servidor não respondeu";
    }
    await loadServers();
    if (motivo) { toast.error(`Não conectou: ${motivo}`); return; }
    const n = (data.tools || []).length;
    toast.success(n ? `Conectou. O servidor oferece ${n} ferramenta(s). Marque as que o agente pode usar.` : "Conectou, mas o servidor não oferece nenhuma ferramenta.");
  };

  const alternarFerramentaExterna = async (s: McpServer, nome: string, liberar: boolean) => {
    const atual = new Set(s.allowed_tools || []);
    if (liberar) atual.add(nome); else atual.delete(nome);
    const lista = Array.from(atual);
    setServers((prev) => prev.map((x) => x.id === s.id ? { ...x, allowed_tools: lista } : x));
    const { error } = await supabase.from("crm_agent_mcp_servers" as any).update({ allowed_tools: lista }).eq("id", s.id);
    if (error) { toast.error(error.message || "Erro ao salvar"); loadServers(); }
  };

  const alternarAtivo = async (s: McpServer, ativo: boolean) => {
    setServers((prev) => prev.map((x) => x.id === s.id ? { ...x, is_active: ativo } : x));
    const { error } = await supabase.from("crm_agent_mcp_servers" as any).update({ is_active: ativo }).eq("id", s.id);
    if (error) { toast.error(error.message || "Erro ao salvar"); loadServers(); }
  };

  const excluirServidor = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("crm_agent_mcp_servers" as any).delete().eq("id", deleteId);
    setDeleteId(null);
    if (error) { toast.error(error.message || "Erro ao excluir"); return; }
    toast.success("Servidor excluído");
    loadServers();
  };

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* ------------------------- FERRAMENTAS INTERNAS ------------------------- */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-1.5 text-foreground"><Wrench className="h-4 w-4" /> Ferramentas do agente</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            O que o agente consegue fazer sozinho durante a conversa. Ferramenta desligada não é oferecida à IA e não roda.
            {noPadrao ? " Está tudo no padrão." : ""}
          </p>
        </div>
        <div className="rounded-md border border-border divide-y divide-border">
          {FERRAMENTAS.map((t) => {
            const aviso = avisoRequisito(t);
            const travada = !!t.dependeDe && !config[t.dependeDe];
            return (
              <div key={t.key} className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">{t.label}</span>
                    {t.nova && <Badge variant="outline" className="text-[10px]">Nova</Badge>}
                    <code className="text-[10px] text-muted-foreground">{t.key}</code>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
                  {aviso && <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3 shrink-0" /> {aviso}</p>}
                </div>
                <Switch
                  checked={ligada(t)}
                  disabled={travada}
                  onCheckedChange={(v) => setConfig((c) => ({ ...c, [t.key]: v }))}
                />
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-end gap-2">
          {!noPadrao && (
            <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => salvarFerramentas({ ...PADRAO })}>
              Voltar ao padrão
            </Button>
          )}
          <Button type="button" size="sm" disabled={saving || !mudou} onClick={() => salvarFerramentas(config)}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar ferramentas
          </Button>
        </div>
      </section>

      {/* ------------------------- FERRAMENTAS EXTERNAS (MCP) ------------------------- */}
      <section className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-1.5 text-foreground"><Plug className="h-4 w-4" /> Ferramentas externas (MCP)</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Conecte um servidor MCP por HTTPS pra o agente consultar um sistema de fora (ERP, estoque, base de pedidos).
              Só entra em uso o que você liberar, uma por uma.
            </p>
          </div>
          {podeGerenciarMcp && !form && (
            <Button type="button" size="sm" variant="outline" className="shrink-0 gap-1.5" onClick={abrirNovo}>
              <Plus className="h-3.5 w-3.5" /> Servidor
            </Button>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground flex items-start gap-1.5 rounded-md bg-muted px-2.5 py-2">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-px" />
          <span>
            O que a ferramenta externa devolve entra na conversa como dado, nunca como instrução. No máximo 3 chamadas externas por resposta.
            Se o servidor cair, o agente responde sem ele. O segredo fica guardado no banco e não volta pra esta tela.
          </span>
        </p>

        {!podeGerenciarMcp && (
          <p className="text-xs text-muted-foreground">Só master ou admin cadastra servidor e libera ferramenta externa.</p>
        )}

        {form && (
          <div className="rounded-md border border-border p-3 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Nome</Label>
                <Input value={form.name} maxLength={60} autoComplete="off" onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: ERP da loja" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Vale pra</Label>
                <SearchableSelect value={form.escopo} onChange={(v) => setForm({ ...form, escopo: v })} options={ESCOPO_OPCOES} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Endereço do servidor (https)</Label>
              <Input value={form.url} maxLength={500} autoComplete="off" spellCheck={false} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://mcp.suaempresa.com.br/mcp" />
              {form.id && <p className="text-[11px] text-muted-foreground">Trocar o endereço zera as ferramentas liberadas. Depois é só testar a conexão de novo.</p>}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Autenticação</Label>
                <SearchableSelect value={form.auth_type} onChange={(v) => setForm({ ...form, auth_type: v })} options={AUTH_OPCOES} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Tempo máximo de resposta (segundos)</Label>
                <Input type="number" min={1} max={20} value={form.timeout_s} onChange={(e) => setForm({ ...form, timeout_s: e.target.value })} />
              </div>
            </div>
            {form.auth_type !== "none" && (
              <div className="grid sm:grid-cols-2 gap-3">
                {form.auth_type === "header" && (
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Nome do cabeçalho</Label>
                    <Input value={form.auth_header_name} maxLength={64} autoComplete="off" spellCheck={false} onChange={(e) => setForm({ ...form, auth_header_name: e.target.value })} placeholder="X-API-Key" />
                  </div>
                )}
                <div className="grid gap-1.5">
                  <Label className="text-xs">{form.auth_type === "bearer" ? "Token" : "Valor do cabeçalho"}</Label>
                  {/* campo de texto mascarado (não é type=password) pra o navegador não oferecer nem preencher senha salva */}
                  <Input
                    type="text"
                    value={form.secret}
                    autoComplete="off"
                    spellCheck={false}
                    data-1p-ignore
                    data-lpignore="true"
                    style={{ WebkitTextSecurity: "disc" } as CSSProperties}
                    onChange={(e) => setForm({ ...form, secret: e.target.value })}
                    placeholder={form.has_secret ? "Já tem um segredo salvo. Em branco mantém." : "Cole o token ou a chave"}
                  />
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setForm(null)} disabled={savingServer}>Cancelar</Button>
              <Button type="button" size="sm" onClick={salvarServidor} disabled={savingServer}>
                {savingServer && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {form.id ? "Salvar servidor" : "Cadastrar servidor"}
              </Button>
            </div>
          </div>
        )}

        {servers.length === 0 && !form ? (
          <p className="text-sm text-muted-foreground py-6 text-center rounded-md border border-dashed border-border">
            Nenhum servidor externo conectado.
          </p>
        ) : (
          servers.map((s) => {
            const ferramentas = Array.isArray(s.tools_cache) ? s.tools_cache : [];
            const liberadas = new Set(s.allowed_tools || []);
            return (
              <div key={s.id} className="rounded-md border border-border">
                <div className="flex items-start justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground truncate">{s.name}</span>
                      <Badge variant="outline" className="text-[10px]">{s.agent_id ? "Só este agente" : "Todos os agentes"}</Badge>
                      {s.auth_type !== "none" && <Badge variant="outline" className="text-[10px]">{s.has_secret ? "Com segredo" : "Sem segredo"}</Badge>}
                      {!s.is_active && <Badge variant="secondary" className="text-[10px]">Desligado</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{hostDe(s.url)}</p>
                    <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                      {s.last_probe_at == null ? (
                        <>Ainda não testado. Teste a conexão pra ver as ferramentas.</>
                      ) : s.last_probe_ok ? (
                        <><CheckCircle2 className="h-3 w-3 shrink-0 text-green-600" /> Conectou em {dataHora(s.last_probe_at)}</>
                      ) : (
                        <><AlertCircle className="h-3 w-3 shrink-0 text-destructive" /> <span className="text-destructive">Falhou em {dataHora(s.last_probe_at)}: {s.last_probe_error || "sem detalhe"}</span></>
                      )}
                    </p>
                  </div>
                  {podeGerenciarMcp && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Switch checked={s.is_active} onCheckedChange={(v) => alternarAtivo(s, v)} />
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="Editar" onClick={() => abrirEdicao(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="Excluir" onClick={() => setDeleteId(s.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </div>
                  )}
                </div>

                <div className="border-t border-border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {ferramentas.length
                        ? `${liberadas.size} de ${ferramentas.length} ferramenta(s) liberada(s)`
                        : "Nenhuma ferramenta listada ainda"}
                    </span>
                    {podeGerenciarMcp && (
                      <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5" disabled={probing === s.id} onClick={() => testarConexao(s)}>
                        {probing === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5" />}
                        Testar conexão
                      </Button>
                    )}
                  </div>
                  {ferramentas.map((f) => (
                    <label key={f.name} className={`flex items-start gap-2 rounded px-1.5 py-1 ${podeGerenciarMcp ? "cursor-pointer hover:bg-muted/50" : ""}`}>
                      <Checkbox
                        className="mt-0.5"
                        checked={liberadas.has(f.name)}
                        disabled={!podeGerenciarMcp}
                        onCheckedChange={(v) => alternarFerramentaExterna(s, f.name, v === true)}
                      />
                      <span className="min-w-0">
                        <span className="text-xs font-medium text-foreground break-all">{f.name}</span>
                        {f.description && <span className="block text-[11px] text-muted-foreground">{f.description}</span>}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* ------------------------- HISTÓRICO ------------------------- */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold flex items-center gap-1.5 text-foreground"><History className="h-4 w-4" /> Últimas chamadas de ferramenta</h3>
        {runs.length === 0 ? (
          <p className="text-xs text-muted-foreground">Este agente ainda não usou nenhuma ferramenta.</p>
        ) : (
          <div className="rounded-md border border-border divide-y divide-border max-h-72 overflow-y-auto">
            {runs.map((r) => (
              <div key={r.id} className="p-2.5 space-y-1">
                <div className="text-[11px] text-muted-foreground">
                  {dataHora(r.created_at)}
                  {r.channel ? ` · ${r.channel === "instagram" ? "Instagram" : "WhatsApp"}` : ""}
                </div>
                {(Array.isArray(r.tool_calls) ? r.tool_calls : []).map((linha, i) => {
                  const texto = String(linha);
                  const corte = texto.indexOf("(");
                  const nome = corte > 0 ? texto.slice(0, corte) : texto;
                  const seta = texto.indexOf(") -> ");
                  const resultado = seta > 0 ? texto.slice(seta + 5) : "";
                  return (
                    <div key={i} className="text-xs">
                      <Badge variant={nome.startsWith("mcp_") ? "default" : "secondary"} className="text-[10px] mr-1.5 align-middle">{nome}</Badge>
                      <span className="text-muted-foreground break-words">{resultado.replace(/\s+/g, " ")}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </section>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir servidor externo?</AlertDialogTitle>
            <AlertDialogDescription>
              O agente para de usar as ferramentas desse servidor na hora e o segredo salvo é apagado. Não dá pra desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={excluirServidor} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
