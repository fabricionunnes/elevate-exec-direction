import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Mail, Loader2, Eye, Send, RefreshCw, Play, Plus, Trash2, Paperclip, Users, Pencil, Repeat2 } from "lucide-react";
import { toast } from "sonner";

// Disparador de E-mail do CRM: disparo único (campanha) + cadências (sequência
// de e-mails com espera em dias, anexos e links) + tracking (aberturas, cliques,
// descadastros via webhook do Resend).

interface Campaign { id: string; name: string; status: string; total: number; sent: number; failed: number; created_at: string; }
interface Attachment { name: string; url: string; }
interface Step { id?: string; step_order: number; delay_days: number; subject: string; body_text: string; attachments: Attachment[]; }
interface Sequence { id: string; name: string; from_email: string; is_active: boolean; }
interface EvStats { opened: number; clicked: number; unsubscribe: number; }

const DEFAULT_FROM = "contato@universidadevendas.com.br";

export default function CRMEmailBlastPage() {
  const [pipelines, setPipelines] = useState<{ id: string; name: string }[]>([]);
  const [stages, setStages] = useState<{ id: string; name: string; pipeline_id: string }[]>([]);
  const [origins, setOrigins] = useState<{ id: string; name: string }[]>([]);
  const [pipelineId, setPipelineId] = useState("all");
  const [stageId, setStageId] = useState("all");
  const [originId, setOriginId] = useState("all");
  const [preview, setPreview] = useState<any>(null);
  const [previewing, setPreviewing] = useState(false);

  // disparo único
  const [fromEmail, setFromEmail] = useState(DEFAULT_FROM);
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<{ total: number; done: number } | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campStats, setCampStats] = useState<Record<string, EvStats>>({});

  // cadências
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [seqCounts, setSeqCounts] = useState<Record<string, { active: number; done: number; steps: number }>>({});
  const [seqStats, setSeqStats] = useState<Record<string, EvStats & { sent: number }>>({});
  const [editorOpen, setEditorOpen] = useState(false);
  const [editSeqId, setEditSeqId] = useState<string | null>(null);
  const [seqName, setSeqName] = useState("");
  const [seqFrom, setSeqFrom] = useState(DEFAULT_FROM);
  const [steps, setSteps] = useState<Step[]>([{ step_order: 1, delay_days: 0, subject: "", body_text: "", attachments: [] }]);
  const [savingSeq, setSavingSeq] = useState(false);
  const [enrollFor, setEnrollFor] = useState<Sequence | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    (async () => {
      const [p, s, o] = await Promise.all([
        supabase.from("crm_pipelines").select("id, name").eq("is_active", true).order("name"),
        supabase.from("crm_stages").select("id, name, pipeline_id").order("sort_order"),
        supabase.from("crm_origins").select("id, name").order("name"),
      ]);
      setPipelines(p.data || []); setStages(s.data || []); setOrigins(o.data || []);
      loadCampaigns(); loadSequences();
    })();
  }, []);

  const loadCampaigns = async () => {
    const { data } = await supabase.from("crm_email_campaigns")
      .select("id, name, status, total, sent, failed, created_at")
      .order("created_at", { ascending: false }).limit(20);
    setCampaigns((data as Campaign[]) || []);
    const { data: evs } = await supabase.from("crm_email_events")
      .select("campaign_id, event_type").not("campaign_id", "is", null);
    const agg: Record<string, EvStats> = {};
    (evs || []).forEach((e: any) => {
      const a = agg[e.campaign_id] || { opened: 0, clicked: 0, unsubscribe: 0 };
      if (e.event_type === "opened") a.opened++;
      if (e.event_type === "clicked") a.clicked++;
      if (e.event_type === "unsubscribe") a.unsubscribe++;
      agg[e.campaign_id] = a;
    });
    setCampStats(agg);
  };

  const loadSequences = async () => {
    const { data: seqs } = await supabase.from("crm_email_sequences")
      .select("id, name, from_email, is_active").order("created_at", { ascending: false });
    setSequences((seqs as Sequence[]) || []);
    const ids = (seqs || []).map((s: any) => s.id);
    if (!ids.length) return;
    const [{ data: enr }, { data: st }, { data: evs }] = await Promise.all([
      supabase.from("crm_email_enrollments").select("sequence_id, status").in("sequence_id", ids),
      supabase.from("crm_email_sequence_steps").select("sequence_id").in("sequence_id", ids),
      supabase.from("crm_email_events").select("sequence_id, event_type").in("sequence_id", ids),
    ]);
    const counts: Record<string, { active: number; done: number; steps: number }> = {};
    ids.forEach((id: string) => counts[id] = { active: 0, done: 0, steps: 0 });
    (enr || []).forEach((e: any) => { if (e.status === "active") counts[e.sequence_id].active++; if (e.status === "done") counts[e.sequence_id].done++; });
    (st || []).forEach((e: any) => counts[e.sequence_id].steps++);
    setSeqCounts(counts);
    const stats: Record<string, EvStats & { sent: number }> = {};
    ids.forEach((id: string) => stats[id] = { sent: 0, opened: 0, clicked: 0, unsubscribe: 0 });
    (evs || []).forEach((e: any) => {
      const a = stats[e.sequence_id]; if (!a) return;
      if (e.event_type === "sent") a.sent++;
      if (e.event_type === "opened") a.opened++;
      if (e.event_type === "clicked") a.clicked++;
    });
    setSeqStats(stats);
  };

  const filters = useMemo(() => ({
    pipeline_id: pipelineId !== "all" ? pipelineId : undefined,
    stage_id: stageId !== "all" ? stageId : undefined,
    origin_id: originId !== "all" ? originId : undefined,
  }), [pipelineId, stageId, originId]);

  const call = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("crm-email-blast", { body });
    if (error || data?.error) throw new Error(data?.error || error?.message);
    return data;
  };

  const doPreview = async () => {
    setPreviewing(true);
    try { setPreview(await call({ action: "preview", filters })); }
    catch (e: any) { toast.error(e.message); }
    finally { setPreviewing(false); }
  };

  const processLoop = async (campaignId: string, total: number, alreadyDone = 0) => {
    setSending(true); setProgress({ total, done: alreadyDone });
    try {
      let done = alreadyDone;
      for (let i = 0; i < 400; i++) {
        const r = await call({ action: "process", campaign_id: campaignId });
        done = total - (r.remaining || 0);
        setProgress({ total, done });
        if (r.done) break;
      }
      toast.success("Disparo concluído");
    } catch (e: any) {
      toast.error(`Envio interrompido: ${e.message} — use Retomar no histórico`);
    } finally { setSending(false); setProgress(null); loadCampaigns(); }
  };

  const doSend = async () => {
    if (!subject.trim() || !bodyText.trim()) { toast.error("Preencha assunto e corpo"); return; }
    const p = preview || await call({ action: "preview", filters });
    if (!confirm(`Enviar e-mail para ${p.enviaveis} lead(s)? Essa ação não tem volta.`)) return;
    setSending(true);
    try {
      const c = await call({ action: "create", name: subject, subject, body_text: bodyText, from_email: fromEmail, filters });
      toast.success(`Campanha criada — ${c.total} destinatário(s). Enviando...`);
      await processLoop(c.campaign_id, c.total);
    } catch (e: any) { toast.error(e.message); setSending(false); }
  };

  const sendTest = async () => {
    const to = prompt("Enviar teste pra qual e-mail?", "fabricio@universidadevendas.com.br");
    if (!to) return;
    try { await call({ action: "test", to, subject, body_text: bodyText, from_email: fromEmail }); toast.success(`Teste enviado pra ${to}`); }
    catch (e: any) { toast.error(e.message); }
  };

  // ── cadências ──
  const openEditor = async (seq?: Sequence) => {
    if (seq) {
      setEditSeqId(seq.id); setSeqName(seq.name); setSeqFrom(seq.from_email);
      const { data: st } = await supabase.from("crm_email_sequence_steps")
        .select("*").eq("sequence_id", seq.id).order("step_order");
      const loaded = (st || []).map((x: any) => ({ ...x, attachments: Array.isArray(x.attachments) ? x.attachments : [] }));
      setSteps(loaded.length ? loaded : [{ step_order: 1, delay_days: 0, subject: "", body_text: "", attachments: [] }]);
    } else {
      setEditSeqId(null); setSeqName(""); setSeqFrom(DEFAULT_FROM);
      setSteps([{ step_order: 1, delay_days: 0, subject: "", body_text: "", attachments: [] }]);
    }
    setEditorOpen(true);
  };

  const saveSequence = async () => {
    if (!seqName.trim()) { toast.error("Dê um nome à cadência"); return; }
    if (steps.some(s => !s.subject.trim() || !s.body_text.trim())) { toast.error("Todo passo precisa de assunto e corpo"); return; }
    setSavingSeq(true);
    try {
      let seqId = editSeqId;
      if (seqId) {
        await supabase.from("crm_email_sequences").update({ name: seqName, from_email: seqFrom }).eq("id", seqId);
        await supabase.from("crm_email_sequence_steps").delete().eq("sequence_id", seqId);
      } else {
        const { data: ns, error } = await supabase.from("crm_email_sequences")
          .insert({ name: seqName, from_email: seqFrom }).select("id").single();
        if (error || !ns) throw new Error(error?.message || "falha ao criar");
        seqId = ns.id;
      }
      const { error: stErr } = await supabase.from("crm_email_sequence_steps").insert(
        steps.map((s, i) => ({ sequence_id: seqId, step_order: i + 1, delay_days: s.delay_days, subject: s.subject, body_text: s.body_text, attachments: s.attachments })),
      );
      if (stErr) throw new Error(stErr.message);
      toast.success("Cadência salva");
      setEditorOpen(false); loadSequences();
    } catch (e: any) { toast.error(e.message); }
    finally { setSavingSeq(false); }
  };

  const uploadAttachment = async (stepIdx: number, file: File) => {
    setUploading(true);
    try {
      const path = `${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error } = await supabase.storage.from("email-assets").upload(path, file);
      if (error) throw new Error(error.message);
      const { data } = supabase.storage.from("email-assets").getPublicUrl(path);
      setSteps(prev => prev.map((s, i) => i === stepIdx ? { ...s, attachments: [...s.attachments, { name: file.name, url: data.publicUrl }] } : s));
      toast.success("Arquivo anexado");
    } catch (e: any) { toast.error(e.message); }
    finally { setUploading(false); }
  };

  const doEnroll = async () => {
    if (!enrollFor) return;
    setEnrolling(true);
    try {
      const p = await call({ action: "preview", filters });
      if (!confirm(`Inscrever ${p.enviaveis} lead(s) na cadência "${enrollFor.name}"?`)) { setEnrolling(false); return; }
      const r = await call({ action: "enroll", sequence_id: enrollFor.id, filters });
      toast.success(`${r.enrolled} lead(s) inscritos (${r.total_filtro - r.enrolled} já estavam)`);
      setEnrollFor(null); loadSequences();
    } catch (e: any) { toast.error(e.message); }
    finally { setEnrolling(false); }
  };

  const stagesOfPipeline = stages.filter(s => pipelineId !== "all" && s.pipeline_id === pipelineId);

  const FilterBar = (
    <div className="grid sm:grid-cols-3 gap-3">
      <div>
        <Label className="text-xs">Funil</Label>
        <Select value={pipelineId} onValueChange={(v) => { setPipelineId(v); setStageId("all"); setPreview(null); }}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos os funis</SelectItem>
            {pipelines.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Etapa</Label>
        <Select value={stageId} onValueChange={(v) => { setStageId(v); setPreview(null); }} disabled={pipelineId === "all"}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todas as etapas</SelectItem>
            {stagesOfPipeline.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Origem</Label>
        <Select value={originId} onValueChange={(v) => { setOriginId(v); setPreview(null); }}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todas as origens</SelectItem>
            {origins.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const PreviewBar = (
    <div className="flex items-center gap-3 flex-wrap">
      <Button variant="outline" size="sm" onClick={doPreview} disabled={previewing} className="gap-1.5">
        {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} Ver prévia
      </Button>
      {preview && (
        <>
          <Badge className="bg-emerald-500/15 text-emerald-600 border-0">{preview.enviaveis} enviáveis</Badge>
          <Badge variant="secondary">{preview.total_leads} leads no filtro</Badge>
          {preview.invalidos > 0 && <Badge variant="outline">{preview.invalidos} sem e-mail válido</Badge>}
          {preview.supressos > 0 && <Badge className="bg-rose-500/15 text-rose-500 border-0">{preview.supressos} descadastrados</Badge>}
        </>
      )}
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl">
      <div className="flex items-center gap-2">
        <Mail className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold">Disparador de E-mail</h1>
        <span className="text-xs text-muted-foreground">Resend · descadastro automático · tracking de abertura e clique</span>
      </div>

      <Tabs defaultValue="blast">
        <TabsList>
          <TabsTrigger value="blast" className="gap-1.5"><Send className="h-3.5 w-3.5" /> Disparo único</TabsTrigger>
          <TabsTrigger value="sequences" className="gap-1.5"><Repeat2 className="h-3.5 w-3.5" /> Cadências</TabsTrigger>
        </TabsList>

        {/* ── DISPARO ÚNICO ── */}
        <TabsContent value="blast" className="space-y-5 mt-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">1. Escolha os destinatários</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {FilterBar}
              {PreviewBar}
              {preview?.amostra?.length > 0 && (
                <p className="text-[11px] text-muted-foreground">Amostra: {preview.amostra.map((a: any) => `${a.nome} <${a.email}>`).join(" · ")}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">2. Escreva o e-mail</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Remetente</Label>
                  <Input className="mt-1" value={fromEmail} onChange={e => setFromEmail(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Assunto — pode usar {"{nome}"}</Label>
                  <Input className="mt-1" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Ex: {nome}, seu comercial está te custando caro" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Corpo — {"{nome}"} vira o primeiro nome. Links podem ir direto no texto. Rodapé com descadastro entra automático.</Label>
                <Textarea className="mt-1" rows={9} value={bodyText} onChange={e => setBodyText(e.target.value)}
                  placeholder={"Fala, {nome}.\n\nAqui é o Fabrício, da UNV..."} />
              </div>
              {progress && (
                <div className="space-y-1">
                  <Progress value={progress.total > 0 ? (progress.done / progress.total) * 100 : 0} />
                  <p className="text-xs text-muted-foreground text-center">{progress.done} de {progress.total} enviados…</p>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={sendTest} disabled={sending} className="gap-2"><Eye className="h-4 w-4" /> Enviar teste pra mim</Button>
                <Button onClick={doSend} disabled={sending} className="gap-2">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar disparo
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">Histórico e tracking
                <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto" onClick={loadCampaigns}><RefreshCw className="h-3.5 w-3.5" /></Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {campaigns.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum disparo ainda.</p> : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow className="text-xs">
                      <TableHead>Campanha</TableHead><TableHead className="text-center">Total</TableHead>
                      <TableHead className="text-center">Enviados</TableHead><TableHead className="text-center">Falhas</TableHead>
                      <TableHead className="text-center">Aberturas</TableHead><TableHead className="text-center">Cliques</TableHead>
                      <TableHead className="text-center">Descad.</TableHead>
                      <TableHead>Status</TableHead><TableHead>Data</TableHead><TableHead></TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {campaigns.map(c => {
                        const st = campStats[c.id] || { opened: 0, clicked: 0, unsubscribe: 0 };
                        return (
                          <TableRow key={c.id} className="text-sm">
                            <TableCell className="font-medium max-w-[220px] truncate">{c.name}</TableCell>
                            <TableCell className="text-center">{c.total}</TableCell>
                            <TableCell className="text-center text-emerald-600 font-semibold">{c.sent}</TableCell>
                            <TableCell className="text-center">{c.failed > 0 ? <span className="text-rose-500 font-semibold">{c.failed}</span> : 0}</TableCell>
                            <TableCell className="text-center">{st.opened}</TableCell>
                            <TableCell className="text-center">{st.clicked}</TableCell>
                            <TableCell className="text-center">{st.unsubscribe > 0 ? <span className="text-rose-500">{st.unsubscribe}</span> : 0}</TableCell>
                            <TableCell><Badge variant={c.status === "done" ? "default" : "secondary"} className="text-[10px]">{c.status === "done" ? "Concluída" : c.status === "sending" ? "Enviando" : c.status}</Badge></TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(c.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</TableCell>
                            <TableCell>
                              {c.status === "sending" && !sending && (
                                <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => processLoop(c.id, c.total, c.sent + c.failed)}>
                                  <Play className="h-3 w-3" /> Retomar
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground mt-2">Aberturas e cliques dependem do tracking ativado no Resend (Domains) e do webhook configurado. Respostas chegam direto na caixa do remetente.</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── CADÊNCIAS ── */}
        <TabsContent value="sequences" className="space-y-4 mt-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-muted-foreground">Sequência de e-mails com espera em dias entre os passos. O envio roda de hora em hora, automático.</p>
            <Button onClick={() => openEditor()} className="gap-2"><Plus className="h-4 w-4" /> Nova cadência</Button>
          </div>
          {sequences.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Nenhuma cadência ainda. Crie a primeira.</CardContent></Card>
          ) : sequences.map(sq => {
            const c = seqCounts[sq.id] || { active: 0, done: 0, steps: 0 };
            const st = seqStats[sq.id] || { sent: 0, opened: 0, clicked: 0 };
            return (
              <Card key={sq.id}>
                <CardContent className="py-4 flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{sq.name}</span>
                      <Badge variant="outline" className="text-[10px]">{c.steps} passo(s)</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      de {sq.from_email} · {c.active} em andamento · {c.done} concluídos · {st.sent} enviados · {st.opened} aberturas · {st.clicked} cliques
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">Ativa</span>
                    <Switch checked={sq.is_active} onCheckedChange={async (v) => {
                      await supabase.from("crm_email_sequences").update({ is_active: v }).eq("id", sq.id);
                      loadSequences();
                    }} />
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openEditor(sq)}><Pencil className="h-3.5 w-3.5" /> Editar</Button>
                    <Button size="sm" className="gap-1.5" onClick={() => { setEnrollFor(sq); setPreview(null); }}><Users className="h-3.5 w-3.5" /> Inscrever leads</Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>

      {/* editor de cadência */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editSeqId ? "Editar cadência" : "Nova cadência"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div><Label className="text-xs">Nome</Label><Input className="mt-1" value={seqName} onChange={e => setSeqName(e.target.value)} placeholder="Ex: Boas-vindas clientes" /></div>
              <div><Label className="text-xs">Remetente</Label><Input className="mt-1" value={seqFrom} onChange={e => setSeqFrom(e.target.value)} /></div>
            </div>
            {steps.map((s, i) => (
              <div key={i} className="rounded-xl border border-border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge>{`Passo ${i + 1}`}</Badge>
                  <Label className="text-xs">enviar</Label>
                  <Input type="number" min={0} className="w-16 h-8" value={s.delay_days}
                    onChange={e => setSteps(p => p.map((x, k) => k === i ? { ...x, delay_days: Math.max(0, Number(e.target.value) || 0) } : x))} />
                  <span className="text-xs text-muted-foreground">{i === 0 ? "dia(s) após inscrever" : "dia(s) após o passo anterior"}</span>
                  {steps.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 ml-auto text-rose-500" onClick={() => setSteps(p => p.filter((_, k) => k !== i))}><Trash2 className="h-4 w-4" /></Button>
                  )}
                </div>
                <Input placeholder="Assunto (pode usar {nome})" value={s.subject}
                  onChange={e => setSteps(p => p.map((x, k) => k === i ? { ...x, subject: e.target.value } : x))} />
                <Textarea rows={5} placeholder={"Corpo do e-mail — {nome}, links direto no texto..."} value={s.body_text}
                  onChange={e => setSteps(p => p.map((x, k) => k === i ? { ...x, body_text: e.target.value } : x))} />
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer text-primary">
                    <Paperclip className="h-3.5 w-3.5" /> {uploading ? "Enviando…" : "Anexar arquivo"}
                    <input type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadAttachment(i, f); e.target.value = ""; }} />
                  </label>
                  {s.attachments.map((a, k) => (
                    <Badge key={k} variant="secondary" className="gap-1 text-[10px]">
                      {a.name}
                      <button onClick={() => setSteps(p => p.map((x, kk) => kk === i ? { ...x, attachments: x.attachments.filter((_, jj) => jj !== k) } : x))}>×</button>
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" className="gap-1.5"
              onClick={() => setSteps(p => [...p, { step_order: p.length + 1, delay_days: 3, subject: "", body_text: "", attachments: [] }])}>
              <Plus className="h-4 w-4" /> Adicionar passo
            </Button>
            <Button onClick={saveSequence} disabled={savingSeq} className="w-full gap-2">
              {savingSeq ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Salvar cadência
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* inscrever leads */}
      <Dialog open={!!enrollFor} onOpenChange={(o) => !o && setEnrollFor(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Inscrever leads em “{enrollFor?.name}”</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {FilterBar}
            {PreviewBar}
            <Button onClick={doEnroll} disabled={enrolling} className="w-full gap-2">
              {enrolling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />} Inscrever na cadência
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
