import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Mail, Loader2, Eye, Send, RefreshCw, Play } from "lucide-react";
import { toast } from "sonner";

// Disparador de e-mails do CRM: filtra leads (funil/etapa/origem), mostra prévia
// (enviáveis, inválidos, descadastrados), envia via Resend em lotes com barra de
// progresso e guarda histórico de campanhas.

interface Campaign { id: string; name: string; status: string; total: number; sent: number; failed: number; created_at: string; }

export default function CRMEmailBlastPage() {
  const [pipelines, setPipelines] = useState<{ id: string; name: string }[]>([]);
  const [stages, setStages] = useState<{ id: string; name: string; pipeline_id: string }[]>([]);
  const [origins, setOrigins] = useState<{ id: string; name: string }[]>([]);
  const [pipelineId, setPipelineId] = useState("all");
  const [stageId, setStageId] = useState("all");
  const [originId, setOriginId] = useState("all");
  const [fromEmail, setFromEmail] = useState("comercial@unvholdings.com.br");
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<{ total: number; done: number } | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  useEffect(() => {
    (async () => {
      const [p, s, o] = await Promise.all([
        supabase.from("crm_pipelines").select("id, name").eq("is_active", true).order("name"),
        supabase.from("crm_stages").select("id, name, pipeline_id").order("sort_order"),
        supabase.from("crm_origins").select("id, name").order("name"),
      ]);
      setPipelines(p.data || []); setStages(s.data || []); setOrigins(o.data || []);
      loadCampaigns();
    })();
  }, []);

  const loadCampaigns = async () => {
    const { data } = await supabase.from("crm_email_campaigns")
      .select("id, name, status, total, sent, failed, created_at")
      .order("created_at", { ascending: false }).limit(20);
    setCampaigns((data as Campaign[]) || []);
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
    setSending(true);
    setProgress({ total, done: alreadyDone });
    try {
      let done = alreadyDone;
      // loop de lotes até acabar — a edge envia ~60 por chamada
      for (let i = 0; i < 400; i++) {
        const r = await call({ action: "process", campaign_id: campaignId });
        done = total - (r.remaining || 0);
        setProgress({ total, done });
        if (r.done) break;
      }
      toast.success("Disparo concluído");
    } catch (e: any) {
      toast.error(`Envio interrompido: ${e.message} — use Retomar no histórico`);
    } finally {
      setSending(false); setProgress(null); loadCampaigns();
    }
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
    } catch (e: any) {
      toast.error(e.message); setSending(false);
    }
  };

  const resume = async (c: Campaign) => {
    await processLoop(c.id, c.total, c.sent + c.failed);
  };

  const stagesOfPipeline = stages.filter(s => pipelineId !== "all" && s.pipeline_id === pipelineId);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl">
      <div className="flex items-center gap-2">
        <Mail className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold">Disparador de E-mail</h1>
        <span className="text-xs text-muted-foreground">envia pros leads do CRM via Resend · descadastro automático no rodapé</span>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">1. Escolha os destinatários</CardTitle></CardHeader>
        <CardContent className="space-y-3">
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
              <Label className="text-xs">Remetente (@unvholdings.com.br)</Label>
              <Input className="mt-1" value={fromEmail} onChange={e => setFromEmail(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Assunto — pode usar {"{nome}"}</Label>
              <Input className="mt-1" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Ex: {nome}, seu comercial está te custando caro" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Corpo — texto simples, {"{nome}"} vira o primeiro nome do lead. O rodapé com descadastro entra automático.</Label>
            <Textarea className="mt-1" rows={9} value={bodyText} onChange={e => setBodyText(e.target.value)}
              placeholder={"Fala, {nome}.\n\nAqui é o Fabrício, da UNV..."} />
          </div>
          {progress && (
            <div className="space-y-1">
              <Progress value={progress.total > 0 ? (progress.done / progress.total) * 100 : 0} />
              <p className="text-xs text-muted-foreground text-center">{progress.done} de {progress.total} enviados…</p>
            </div>
          )}
          <Button onClick={doSend} disabled={sending} className="gap-2 w-full sm:w-auto">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar disparo
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">Histórico
            <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto" onClick={loadCampaigns}><RefreshCw className="h-3.5 w-3.5" /></Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum disparo ainda.</p> : (
            <Table>
              <TableHeader><TableRow className="text-xs">
                <TableHead>Campanha</TableHead><TableHead className="text-center">Total</TableHead>
                <TableHead className="text-center">Enviados</TableHead><TableHead className="text-center">Falhas</TableHead>
                <TableHead>Status</TableHead><TableHead>Data</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {campaigns.map(c => (
                  <TableRow key={c.id} className="text-sm">
                    <TableCell className="font-medium max-w-[260px] truncate">{c.name}</TableCell>
                    <TableCell className="text-center">{c.total}</TableCell>
                    <TableCell className="text-center text-emerald-600 font-semibold">{c.sent}</TableCell>
                    <TableCell className="text-center">{c.failed > 0 ? <span className="text-rose-500 font-semibold">{c.failed}</span> : 0}</TableCell>
                    <TableCell><Badge variant={c.status === "done" ? "default" : "secondary"} className="text-[10px]">{c.status === "done" ? "Concluída" : c.status === "sending" ? "Enviando" : c.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</TableCell>
                    <TableCell>
                      {c.status === "sending" && !sending && (
                        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => resume(c)}>
                          <Play className="h-3 w-3" /> Retomar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
