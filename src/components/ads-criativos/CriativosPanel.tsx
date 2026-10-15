// Criativos dos clientes UNV Ads: monta o criativo, envia pro grupo do cliente do número de
// quem enviou, o cliente aprova no grupo (resposta/reação), quem enviou é avisado, o consultor
// marca que subiu e vincula os anúncios do Meta pra acompanhar as métricas.
// Backend: tabela ads_criativos + função ads-criativos + gatilho ads_criativo_avaliar_msg.
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { toast } from "sonner";
import {
  CheckCircle2, Clock, Image as ImageIcon, Loader2, MessageSquareWarning, Pencil, Plus, RefreshCw, Rocket,
  Send, Trash2, Undo2, Upload, Video, X, Smartphone, BarChart3, Search,
} from "lucide-react";

type Midia = { url: string; path: string; tipo: "image" | "video"; mime?: string; nome?: string; tamanho?: number };
type Status = "rascunho" | "enviado" | "ajuste" | "aprovado" | "reprovado";
type Metricas = {
  gasto: number; impressoes: number; alcance: number; cliques: number; cliques_link: number; leads: number; conversas: number;
  compras: number; valor_compras: number; ctr: number; cpc: number; cpm: number; frequencia: number; resultados: number;
  custo_resultado: number | null; roas: number | null; ultimos_7d?: { gasto: number; resultados: number };
  anuncios: { id: string; nome: string; status: string | null; gasto: number; resultados?: number; leads: number; conversas: number; compras: number }[];
};
type Criativo = {
  id: string; project_id: string; titulo: string; legenda: string | null; mensagem: string | null; formato: string;
  midias: Midia[]; status: Status; grupo_jid: string | null; grupo_nome: string | null; enviado_por: string | null;
  enviado_em: string | null; envios: number; aprovado_em: string | null; aprovado_por_nome: string | null;
  resposta_cliente: string | null; aprovacao_origem: string | null; ajuste_texto: string | null; ajuste_em: string | null;
  no_ar: boolean; no_ar_em: string | null; meta_ad_ids: string[]; metricas: Metricas | null; metricas_em: string | null;
  created_at: string;
  enviado: { name: string } | null;
};
type Evento = { id: string; tipo: string; texto: string | null; autor_nome: string | null; created_at: string };
type Grupo = { jid: string; nome: string; vinculado: boolean; sugerido: boolean };
type MetaAd = { id: string; nome: string; status: string; criado: string; campanha: string | null; conjunto: string | null; thumb: string | null };

const db = supabase as any;
const brl = (v: number | null | undefined) => v == null ? "-" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const num = (v: number | null | undefined, d = 0) => v == null ? "-" : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: d, minimumFractionDigits: d }).format(v);
const quando = (iso: string | null) => iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

/** erro de function vem no corpo; sem isso o toast mostra "non-2xx" */
async function chamar(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("ads-criativos", { body });
  if (error) {
    let msg = error.message;
    try { const j = await (error as any).context?.json?.(); if (j?.error) msg = j.error; } catch { /* sem corpo */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

const FILTROS: { id: string; label: string; ok: (c: Criativo) => boolean }[] = [
  { id: "todos", label: "Todos", ok: () => true },
  { id: "producao", label: "Em produção", ok: (c) => c.status === "rascunho" },
  { id: "aguardando", label: "Aguardando cliente", ok: (c) => c.status === "enviado" },
  { id: "ajuste", label: "Ajuste pedido", ok: (c) => c.status === "ajuste" },
  { id: "aprovados", label: "Aprovados", ok: (c) => c.status === "aprovado" && !c.no_ar },
  { id: "no_ar", label: "No ar", ok: (c) => c.no_ar },
];

function StatusBadge({ c }: { c: Criativo }) {
  if (c.no_ar) return <Badge className="bg-blue-600 hover:bg-blue-600 text-white">No ar</Badge>;
  const m: Record<Status, [string, string]> = {
    rascunho: ["Em produção", "bg-muted text-muted-foreground hover:bg-muted"],
    enviado: ["Aguardando cliente", "bg-amber-500 hover:bg-amber-500 text-white"],
    ajuste: ["Ajuste pedido", "bg-orange-600 hover:bg-orange-600 text-white"],
    aprovado: ["Aprovado", "bg-green-600 hover:bg-green-600 text-white"],
    reprovado: ["Reprovado", "bg-red-600 hover:bg-red-600 text-white"],
  };
  const [t, cls] = m[c.status];
  return <Badge className={cls}>{t}</Badge>;
}

function Capa({ m, className = "" }: { m?: Midia; className?: string }) {
  if (!m) return <div className={`flex items-center justify-center bg-muted text-muted-foreground ${className}`}><ImageIcon className="h-8 w-8" /></div>;
  return m.tipo === "video"
    ? <video src={`${m.url}#t=0.5`} preload="metadata" muted playsInline className={`object-cover bg-black ${className}`} />
    : <img src={m.url} alt="" loading="lazy" className={`object-cover bg-muted ${className}`} />;
}

export function CriativosPanel({ projectId, companyId }: { projectId: string; companyId?: string | null }) {
  const { currentStaff } = useStaffPermissions();
  const [lista, setLista] = useState<Criativo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState("todos");
  const [remetente, setRemetente] = useState<{ numero?: string; motivo?: string } | null>(null);
  const [editando, setEditando] = useState<Criativo | "novo" | null>(null);
  const [enviando, setEnviando] = useState<Criativo | null>(null);
  const [vinculando, setVinculando] = useState<Criativo | null>(null);
  const [detalhe, setDetalhe] = useState<Criativo | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const { data, error } = await db.from("ads_criativos")
      .select("*, enviado:onboarding_staff!ads_criativos_enviado_por_fkey(name)")
      .eq("project_id", projectId).order("created_at", { ascending: false });
    if (error) toast.error(`Não consegui carregar os criativos: ${error.message}`);
    setLista((data || []) as Criativo[]);
    setCarregando(false);
  }, [projectId]);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => {
    chamar({ action: "remetente" }).then((d) => setRemetente(d.instancia ? { numero: d.numero } : { motivo: d.motivo })).catch(() => setRemetente(null));
  }, []);
  // aprovação chega pelo grupo a qualquer momento: atualiza sozinho
  useEffect(() => {
    const ch = supabase.channel(`ads-criativos-${projectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "ads_criativos", filter: `project_id=eq.${projectId}` }, () => carregar())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [projectId, carregar]);

  const contagem = useMemo(() => Object.fromEntries(FILTROS.map((f) => [f.id, lista.filter(f.ok).length])), [lista]);
  const visiveis = lista.filter(FILTROS.find((f) => f.id === filtro)!.ok);

  const evento = (criativo_id: string, tipo: string, texto: string) =>
    db.from("ads_criativos_eventos").insert({ criativo_id, tipo, texto, staff_id: currentStaff?.id, autor_nome: currentStaff?.name });

  const aprovarManual = async (c: Criativo) => {
    setOcupado(c.id);
    const { error } = await db.from("ads_criativos").update({
      status: "aprovado", aprovado_em: new Date().toISOString(), aprovado_por_nome: `${currentStaff?.name || "Time"} (marcado no sistema)`,
      aprovacao_origem: "manual", resposta_cliente: null,
    }).eq("id", c.id);
    if (error) toast.error(error.message);
    else { await evento(c.id, "aprovado", "Aprovação marcada manualmente no sistema"); toast.success("Marcado como aprovado"); }
    setOcupado(null); carregar();
  };

  const desfazer = async (c: Criativo) => {
    setOcupado(c.id);
    const volta = c.no_ar ? { no_ar: false, no_ar_em: null, no_ar_por: null } : { status: c.enviado_em ? "enviado" : "rascunho", aprovado_em: null, aprovado_por_nome: null, aprovacao_origem: null };
    const { error } = await db.from("ads_criativos").update(volta).eq("id", c.id);
    if (error) toast.error(error.message);
    else await evento(c.id, "desfeito", c.no_ar ? "Desmarcado como no ar" : "Aprovação desfeita");
    setOcupado(null); carregar();
  };

  const excluir = async (c: Criativo) => {
    if (!confirm(`Excluir o criativo "${c.titulo}"?`)) return;
    const paths = (c.midias || []).map((m) => m.path).filter(Boolean);
    if (paths.length) await supabase.storage.from("ads-criativos").remove(paths);
    const { error } = await db.from("ads_criativos").delete().eq("id", c.id);
    if (error) toast.error(error.message); else toast.success("Criativo excluído");
    carregar();
  };

  const atualizarMetricas = async (c: Criativo) => {
    setOcupado(c.id);
    try { await chamar({ action: "metricas", criativo_id: c.id }); toast.success("Métricas atualizadas"); }
    catch (e) { toast.error((e as Error).message); }
    setOcupado(null); carregar();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Criativos</h2>
          <p className="text-sm text-muted-foreground">Monte, mande pro cliente aprovar no grupo e acompanhe o resultado depois que subir.</p>
        </div>
        <Button onClick={() => setEditando("novo")} className="gap-2 shrink-0"><Plus className="h-4 w-4" />Novo criativo</Button>
      </div>

      {remetente && (
        <div className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${remetente.numero ? "bg-muted/40" : "border-amber-500/50 bg-amber-500/10"}`}>
          <Smartphone className="h-4 w-4 mt-0.5 shrink-0" />
          {remetente.numero
            ? <span>Seus envios saem do seu número: <b>{remetente.numero}</b>. A aprovação do cliente chega pra você no sistema e no WhatsApp.</span>
            : <span>{remetente.motivo}</span>}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {FILTROS.map((f) => (
          <Button key={f.id} size="sm" variant={filtro === f.id ? "default" : "outline"} className="h-8 gap-1.5" onClick={() => setFiltro(f.id)}>
            {f.label}<span className={`text-xs ${filtro === f.id ? "opacity-80" : "text-muted-foreground"}`}>{contagem[f.id] || 0}</span>
          </Button>
        ))}
      </div>

      {carregando ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : visiveis.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          {lista.length === 0 ? "Nenhum criativo ainda. Clique em Novo criativo pra montar o primeiro." : "Nenhum criativo nesse filtro."}
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visiveis.map((c) => (
            <Card key={c.id} className="overflow-hidden flex flex-col">
              <button type="button" className="relative block aspect-square w-full overflow-hidden" onClick={() => setDetalhe(c)}>
                <Capa m={c.midias?.[0]} className="h-full w-full" />
                <div className="absolute left-2 top-2"><StatusBadge c={c} /></div>
                {c.midias?.length > 1 && <Badge variant="secondary" className="absolute right-2 top-2">{c.midias.length} peças</Badge>}
                {c.midias?.[0]?.tipo === "video" && <Video className="absolute bottom-2 right-2 h-5 w-5 text-white drop-shadow" />}
              </button>
              <CardContent className="flex flex-1 flex-col gap-2 p-3">
                <button type="button" className="text-left font-medium leading-tight hover:underline" onClick={() => setDetalhe(c)}>{c.titulo}</button>
                <Linha c={c} />
                {c.status === "ajuste" && c.ajuste_texto && (
                  <div className="rounded border border-orange-500/40 bg-orange-500/10 px-2 py-1.5 text-xs">
                    <MessageSquareWarning className="mr-1 inline h-3.5 w-3.5" />"{c.ajuste_texto}"
                  </div>
                )}
                {c.no_ar && <MetricasResumo c={c} />}
                <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                  {(c.status === "rascunho" || c.status === "ajuste") && <>
                    <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setEditando(c)}><Pencil className="h-3.5 w-3.5" />Editar</Button>
                    <Button size="sm" className="h-8 gap-1" onClick={() => setEnviando(c)}><Send className="h-3.5 w-3.5" />{c.status === "ajuste" ? "Reenviar" : "Enviar pro cliente"}</Button>
                  </>}
                  {c.status === "enviado" && <>
                    <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setEnviando(c)}><Send className="h-3.5 w-3.5" />Reenviar</Button>
                    <Button size="sm" variant="outline" className="h-8 gap-1" disabled={ocupado === c.id} onClick={() => aprovarManual(c)}><CheckCircle2 className="h-3.5 w-3.5" />Marcar aprovado</Button>
                  </>}
                  {c.status === "aprovado" && !c.no_ar && <>
                    <Button size="sm" className="h-8 gap-1" onClick={() => setVinculando(c)}><Rocket className="h-3.5 w-3.5" />Marcar que subiu</Button>
                    <Button size="sm" variant="ghost" className="h-8 gap-1" disabled={ocupado === c.id} onClick={() => desfazer(c)}><Undo2 className="h-3.5 w-3.5" />Desfazer</Button>
                  </>}
                  {c.no_ar && <>
                    <Button size="sm" variant="outline" className="h-8 gap-1" disabled={ocupado === c.id || !c.meta_ad_ids?.length} onClick={() => atualizarMetricas(c)}>
                      {ocupado === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}Métricas
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setVinculando(c)}><BarChart3 className="h-3.5 w-3.5" />Anúncios</Button>
                  </>}
                  {c.status === "rascunho" && <Button size="sm" variant="ghost" className="h-8 text-destructive" onClick={() => excluir(c)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editando && <Editor projectId={projectId} companyId={companyId} criativo={editando === "novo" ? null : editando} staffId={currentStaff?.id} staffNome={currentStaff?.name}
        onClose={(salvo) => { setEditando(null); if (salvo) carregar(); }} />}
      {enviando && <Enviar criativo={enviando} projectId={projectId} remetente={remetente} onClose={(ok) => { setEnviando(null); if (ok) carregar(); }} />}
      {vinculando && <Vincular criativo={vinculando} projectId={projectId} staffId={currentStaff?.id} staffNome={currentStaff?.name}
        onClose={(ok) => { setVinculando(null); if (ok) carregar(); }} />}
      {detalhe && <Detalhe criativo={lista.find((x) => x.id === detalhe.id) || detalhe} onClose={() => setDetalhe(null)} />}
    </div>
  );
}

function Linha({ c }: { c: Criativo }) {
  const t = c.no_ar ? `No ar desde ${quando(c.no_ar_em)}`
    : c.status === "aprovado" ? `Aprovado por ${c.aprovado_por_nome || "cliente"} em ${quando(c.aprovado_em)}`
    : c.status === "ajuste" ? `Ajuste pedido em ${quando(c.ajuste_em)}`
    : c.status === "enviado" ? `Enviado por ${c.enviado?.name?.split(" ")[0] || "-"} em ${quando(c.enviado_em)}${c.grupo_nome ? ` · ${c.grupo_nome}` : ""}`
    : `Criado em ${quando(c.created_at)}`;
  return <p className="flex items-start gap-1 text-xs text-muted-foreground"><Clock className="mt-0.5 h-3 w-3 shrink-0" /><span>{t}</span></p>;
}

function MetricasResumo({ c }: { c: Criativo }) {
  const m = c.metricas;
  if (!c.meta_ad_ids?.length) return <p className="text-xs text-amber-600">Vincule o anúncio do Meta pra ver as métricas.</p>;
  if (!m) return <p className="text-xs text-muted-foreground">Métricas ainda não buscadas. Clique em Métricas.</p>;
  const itens: [string, string][] = [
    ["Gasto", brl(m.gasto)], ["Resultados", num(m.resultados)], ["Custo/result.", brl(m.custo_resultado)],
    ["CTR", `${num(m.ctr, 2)}%`], ["CPC", brl(m.cpc)], ["Impressões", num(m.impressoes)],
  ];
  return (
    <div className="rounded-md border bg-muted/30 p-2">
      <div className="grid grid-cols-3 gap-x-2 gap-y-1.5">
        {itens.map(([k, v]) => <div key={k}><div className="text-[10px] uppercase text-muted-foreground">{k}</div><div className="text-sm font-semibold tabular-nums">{v}</div></div>)}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground">Desde o início · atualizado {quando(c.metricas_em)}</p>
    </div>
  );
}

function Editor({ projectId, companyId, criativo, staffId, staffNome, onClose }: {
  projectId: string; companyId?: string | null; criativo: Criativo | null; staffId?: string; staffNome?: string; onClose: (salvo: boolean) => void;
}) {
  const [titulo, setTitulo] = useState(criativo?.titulo || "");
  const [legenda, setLegenda] = useState(criativo?.legenda || "");
  const [mensagem, setMensagem] = useState(criativo?.mensagem || "");
  const [midias, setMidias] = useState<Midia[]>(criativo?.midias || []);
  const [subindo, setSubindo] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const adicionar = async (files: FileList | null) => {
    if (!files?.length) return;
    setSubindo(true);
    const novas: Midia[] = [];
    for (const f of Array.from(files)) {
      const tipo = f.type.startsWith("video/") ? "video" : f.type.startsWith("image/") ? "image" : null;
      if (!tipo) { toast.error(`${f.name}: só imagem ou vídeo`); continue; }
      if (f.size > 100 * 1024 * 1024) { toast.error(`${f.name}: acima de 100 MB`); continue; }
      if (tipo === "video" && f.size > 16 * 1024 * 1024) toast.warning(`${f.name} tem ${Math.round(f.size / 1048576)} MB. Vídeo acima de 16 MB pode demorar ou não chegar no WhatsApp.`);
      const ext = (f.name.split(".").pop() || (tipo === "video" ? "mp4" : "jpg")).toLowerCase();
      const path = `${projectId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("ads-criativos").upload(path, f, { contentType: f.type, upsert: false });
      if (error) { toast.error(`${f.name}: ${error.message}`); continue; }
      const { data } = supabase.storage.from("ads-criativos").getPublicUrl(path);
      novas.push({ url: data.publicUrl, path, tipo, mime: f.type, nome: f.name, tamanho: f.size });
    }
    setMidias((m) => [...m, ...novas]);
    setSubindo(false);
  };

  const remover = (i: number) => setMidias((m) => m.filter((_, k) => k !== i));
  const mover = (i: number, d: -1 | 1) => setMidias((m) => {
    const n = [...m]; const j = i + d; if (j < 0 || j >= n.length) return m; [n[i], n[j]] = [n[j], n[i]]; return n;
  });

  const salvar = async () => {
    if (!titulo.trim()) { toast.error("Dê um nome pro criativo"); return; }
    if (!midias.length) { toast.error("Coloque ao menos uma imagem ou vídeo"); return; }
    setSalvando(true);
    const formato = midias.length > 1 ? "carrossel" : midias[0].tipo === "video" ? "video" : "imagem";
    const dados = { titulo: titulo.trim(), legenda: legenda.trim() || null, mensagem: mensagem.trim() || null, midias, formato };
    const { data, error } = criativo
      ? await db.from("ads_criativos").update(dados).eq("id", criativo.id).select("id").single()
      : await db.from("ads_criativos").insert({ ...dados, project_id: projectId, company_id: companyId || null, criado_por: staffId || null }).select("id").single();
    setSalvando(false);
    if (error) { toast.error(error.message); return; }
    if (!criativo) await db.from("ads_criativos_eventos").insert({ criativo_id: data.id, tipo: "criado", staff_id: staffId, autor_nome: staffNome });
    toast.success(criativo ? "Criativo salvo" : "Criativo criado");
    onClose(true);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{criativo ? "Editar criativo" : "Novo criativo"}</DialogTitle>
          <DialogDescription>Imagem, vídeo ou carrossel, com a legenda do anúncio.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome do criativo</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Promo outubro, depoimento cliente" />
          </div>
          <div className="space-y-1.5">
            <Label>Peças</Label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {midias.map((m, i) => (
                <div key={m.path || m.url} className="group relative aspect-square overflow-hidden rounded-md border">
                  <Capa m={m} className="h-full w-full" />
                  <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] text-white">{i + 1}</span>
                  <div className="absolute inset-x-1 bottom-1 flex justify-between opacity-0 transition group-hover:opacity-100">
                    <div className="flex gap-1">
                      {i > 0 && <Button size="icon" variant="secondary" className="h-6 w-6" onClick={() => mover(i, -1)}>‹</Button>}
                      {i < midias.length - 1 && <Button size="icon" variant="secondary" className="h-6 w-6" onClick={() => mover(i, 1)}>›</Button>}
                    </div>
                    <Button size="icon" variant="destructive" className="h-6 w-6" onClick={() => remover(i)}><X className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ))}
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed text-xs text-muted-foreground hover:bg-muted/50">
                {subindo ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                {subindo ? "Subindo..." : "Adicionar"}
                <input type="file" accept="image/*,video/mp4,video/quicktime,video/webm" multiple className="hidden" disabled={subindo}
                  onChange={(e) => { adicionar(e.target.files); e.target.value = ""; }} />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">Mais de uma peça vira carrossel, enviado na ordem acima.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Legenda do anúncio (copy)</Label>
            <Textarea value={legenda} onChange={(e) => setLegenda(e.target.value)} rows={5} placeholder="Texto que vai no anúncio" />
          </div>
          <div className="space-y-1.5">
            <Label>Recado pro cliente (opcional)</Label>
            <Textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} rows={2} placeholder="Ex.: Fulano, esse é o criativo da campanha de outubro." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando || subindo}>{salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Enviar({ criativo, projectId, remetente, onClose }: {
  criativo: Criativo; projectId: string; remetente: { numero?: string; motivo?: string } | null; onClose: (ok: boolean) => void;
}) {
  const [grupos, setGrupos] = useState<Grupo[] | null>(null);
  const [jid, setJid] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    chamar({ action: "grupos", project_id: projectId })
      .then((d) => { setGrupos(d.grupos || []); setJid(criativo.grupo_jid || d.padrao || ""); })
      .catch((e) => { toast.error((e as Error).message); setGrupos([]); });
  }, [projectId, criativo.grupo_jid]);

  const opcoes = (grupos || []).map((g) => ({ value: g.jid, label: g.nome, hint: g.vinculado ? "vinculado ao projeto" : g.sugerido ? "sugerido" : undefined }));
  const grupo = grupos?.find((g) => g.jid === jid);

  const enviar = async () => {
    setEnviando(true);
    try {
      const d = await chamar({ action: "enviar", criativo_id: criativo.id, grupo_jid: jid, grupo_nome: grupo?.nome || "" });
      toast.success(`Enviado pro grupo do número ${d.numero}`);
      onClose(true);
    } catch (e) { toast.error((e as Error).message); }
    setEnviando(false);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar pro cliente aprovar</DialogTitle>
          <DialogDescription>{criativo.titulo}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Grupo do cliente</Label>
            {grupos === null
              ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Buscando grupos...</div>
              : <SearchableSelect value={jid} onValueChange={setJid} options={opcoes} placeholder="Escolha o grupo" emptyMessage="Nenhum grupo encontrado" />}
            <p className="text-xs text-muted-foreground">O grupo fica lembrado pros próximos envios deste cliente.</p>
          </div>
          <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-2">
            <p className="text-xs font-medium uppercase text-muted-foreground">Vai assim</p>
            <p><b>{criativo.midias.length > 1 ? `${criativo.midias.length} peças` : criativo.midias[0]?.tipo === "video" ? "Vídeo" : "Imagem"}</b> com "Criativo pra aprovação: {criativo.titulo}"</p>
            {criativo.mensagem && <p className="whitespace-pre-wrap">{criativo.mensagem}</p>}
            {criativo.legenda && <p className="whitespace-pre-wrap"><b>Legenda do anúncio:</b>{"\n"}{criativo.legenda}</p>}
            <p>Responda esta mensagem com <b>APROVADO</b> ou diga o que ajustar.</p>
          </div>
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {remetente?.numero ? <>Sai do seu número ({remetente.numero}). O número precisa estar no grupo.</> : remetente?.motivo || "Conferindo seu número..."}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(false)}>Cancelar</Button>
          <Button onClick={enviar} disabled={enviando || !jid || !remetente?.numero} className="gap-2">
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Vincular({ criativo, projectId, staffId, staffNome, onClose }: {
  criativo: Criativo; projectId: string; staffId?: string; staffNome?: string; onClose: (ok: boolean) => void;
}) {
  const [ads, setAds] = useState<MetaAd[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set(criativo.meta_ad_ids || []));
  const [busca, setBusca] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    chamar({ action: "meta_ads", project_id: projectId }).then((d) => setAds(d.ads || [])).catch((e) => { setErro((e as Error).message); setAds([]); });
  }, [projectId]);

  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const filtrados = (ads || []).filter((a) => !busca || norm(`${a.nome} ${a.campanha || ""} ${a.conjunto || ""}`).includes(norm(busca)));
  const alternar = (id: string) => setMarcados((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const salvar = async () => {
    setSalvando(true);
    const ids = [...marcados];
    const { error } = await db.from("ads_criativos").update({
      no_ar: true, ...(criativo.no_ar ? {} : { no_ar_em: new Date().toISOString(), no_ar_por: staffId || null }), meta_ad_ids: ids,
    }).eq("id", criativo.id);
    if (error) { toast.error(error.message); setSalvando(false); return; }
    await db.from("ads_criativos_eventos").insert({ criativo_id: criativo.id, tipo: "no_ar", staff_id: staffId, autor_nome: staffNome,
      texto: ids.length ? `${ids.length} anúncio(s) do Meta vinculado(s)` : "Marcado como no ar sem anúncio vinculado" });
    if (ids.length) {
      try { await chamar({ action: "metricas", criativo_id: criativo.id }); }
      catch (e) { toast.warning(`Salvo, mas as métricas não vieram: ${(e as Error).message}`); }
    }
    toast.success(criativo.no_ar ? "Anúncios atualizados" : "Criativo marcado como no ar");
    setSalvando(false);
    onClose(true);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{criativo.no_ar ? "Anúncios vinculados" : "Marcar que subiu"}</DialogTitle>
          <DialogDescription>Escolha os anúncios do Meta deste criativo. As métricas somam todos os marcados e atualizam todo dia.</DialogDescription>
        </DialogHeader>
        {erro && <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm">{erro} Dá pra marcar como no ar mesmo assim e vincular depois.</div>}
        {!erro && (
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por anúncio, campanha ou conjunto" className="pl-8" />
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto space-y-1">
          {ads === null ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            : filtrados.length === 0 && !erro ? <p className="py-6 text-center text-sm text-muted-foreground">Nenhum anúncio encontrado.</p>
            : filtrados.map((a) => (
              <label key={a.id} className={`flex cursor-pointer items-center gap-3 rounded-md border p-2 hover:bg-muted/40 ${marcados.has(a.id) ? "border-primary bg-primary/5" : ""}`}>
                <Checkbox checked={marcados.has(a.id)} onCheckedChange={() => alternar(a.id)} />
                {a.thumb ? <img src={a.thumb} alt="" className="h-12 w-12 shrink-0 rounded object-cover" /> : <div className="h-12 w-12 shrink-0 rounded bg-muted" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{a.nome}</div>
                  <div className="truncate text-xs text-muted-foreground">{[a.campanha, a.conjunto].filter(Boolean).join(" · ")}</div>
                </div>
                <div className="shrink-0 text-right">
                  <Badge variant={a.status === "ACTIVE" ? "default" : "secondary"} className="text-[10px]">{a.status === "ACTIVE" ? "Ativo" : a.status === "PAUSED" ? "Pausado" : a.status}</Badge>
                  <div className="mt-1 text-[10px] text-muted-foreground">{new Date(a.criado).toLocaleDateString("pt-BR")}</div>
                </div>
              </label>
            ))}
        </div>
        <DialogFooter className="items-center">
          <span className="mr-auto text-xs text-muted-foreground">{marcados.size} selecionado(s)</span>
          <Button variant="outline" onClick={() => onClose(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando} className="gap-2">{salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Detalhe({ criativo: c, onClose }: { criativo: Criativo; onClose: () => void }) {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [i, setI] = useState(0);
  useEffect(() => {
    db.from("ads_criativos_eventos").select("*").eq("criativo_id", c.id).order("created_at", { ascending: false })
      .then(({ data }: { data: Evento[] | null }) => setEventos(data || []));
  }, [c.id, c.status, c.no_ar]);
  const m = c.midias?.[i];
  const nomeEvento: Record<string, string> = { criado: "Criado", enviado: "Enviado", aprovado: "Aprovado", ajuste: "Ajuste pedido", comentario: "Comentário do cliente", no_ar: "No ar", desfeito: "Desfeito" };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">{c.titulo} <StatusBadge c={c} /></DialogTitle>
          <DialogDescription>{c.formato === "carrossel" ? `Carrossel com ${c.midias.length} peças` : c.formato === "video" ? "Vídeo" : "Imagem"}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            {m && (m.tipo === "video"
              ? <video src={m.url} controls playsInline className="w-full rounded-md bg-black" />
              : <img src={m.url} alt="" className="w-full rounded-md" />)}
            {c.midias.length > 1 && (
              <div className="flex gap-1.5 overflow-x-auto">
                {c.midias.map((x, k) => (
                  <button key={k} type="button" onClick={() => setI(k)} className={`h-14 w-14 shrink-0 overflow-hidden rounded border-2 ${k === i ? "border-primary" : "border-transparent"}`}>
                    <Capa m={x} className="h-full w-full" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-3 text-sm">
            {c.legenda && <div><p className="text-xs font-medium uppercase text-muted-foreground">Legenda</p><p className="whitespace-pre-wrap">{c.legenda}</p></div>}
            {c.status === "aprovado" && c.resposta_cliente && <div><p className="text-xs font-medium uppercase text-muted-foreground">Resposta do cliente</p><p>{c.aprovado_por_nome}: {c.resposta_cliente}</p></div>}
            {c.no_ar && c.metricas && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase text-muted-foreground">Métricas</p>
                <MetricasResumo c={c} />
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Leads</span><div className="font-semibold">{num(c.metricas.leads)}</div></div>
                  <div><span className="text-muted-foreground">Conversas</span><div className="font-semibold">{num(c.metricas.conversas)}</div></div>
                  <div><span className="text-muted-foreground">Compras</span><div className="font-semibold">{num(c.metricas.compras)}</div></div>
                  <div><span className="text-muted-foreground">Alcance</span><div className="font-semibold">{num(c.metricas.alcance)}</div></div>
                  <div><span className="text-muted-foreground">Frequência</span><div className="font-semibold">{num(c.metricas.frequencia, 2)}</div></div>
                  <div><span className="text-muted-foreground">ROAS</span><div className="font-semibold">{c.metricas.roas ? `${num(c.metricas.roas, 2)}x` : "-"}</div></div>
                  {c.metricas.ultimos_7d && <div className="col-span-3"><span className="text-muted-foreground">Últimos 7 dias: </span>{brl(c.metricas.ultimos_7d.gasto)} de gasto, {num(c.metricas.ultimos_7d.resultados)} resultados</div>}
                </div>
                {c.metricas.anuncios?.length > 1 && (
                  <div className="space-y-1">
                    {c.metricas.anuncios.map((a) => (
                      <div key={a.id} className="flex justify-between gap-2 text-xs"><span className="truncate">{a.nome}</span><span className="shrink-0 tabular-nums">{brl(a.gasto)}</span></div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">Histórico</p>
              <div className="mt-1 space-y-1.5">
                {eventos.map((e) => (
                  <div key={e.id} className="text-xs">
                    <span className="font-medium">{nomeEvento[e.tipo] || e.tipo}</span>
                    <span className="text-muted-foreground"> · {quando(e.created_at)}{e.autor_nome ? ` · ${e.autor_nome}` : ""}</span>
                    {e.texto && <p className="text-muted-foreground">{e.texto}</p>}
                  </div>
                ))}
                {!eventos.length && <p className="text-xs text-muted-foreground">Sem eventos.</p>}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
