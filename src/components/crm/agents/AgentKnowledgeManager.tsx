import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, FileText, Link2, Type, Trash2, Upload, CheckCircle2, AlertCircle, Clock } from "lucide-react";

interface Knowledge {
  id: string;
  kind: string;
  title: string | null;
  content: string | null;
  source_url: string | null;
  file_path: string | null;
  status: string;
  error: string | null;
  char_count: number | null;
  created_at: string;
}

const BUCKET = "crm-files";
// Tipos que dá pra ler como texto direto no navegador
const TEXT_EXT = ["txt", "md", "markdown", "csv", "json", "html", "htm"];

export function AgentKnowledgeManager({ agentId, staffId }: { agentId: string; staffId: string | null }) {
  const [items, setItems] = useState<Knowledge[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"text" | "link" | null>(null);
  const [textTitle, setTextTitle] = useState("");
  const [textBody, setTextBody] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("crm_ai_agent_knowledge")
      .select("*")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false });
    setItems((data || []) as Knowledge[]);
    setLoading(false);
  }, [agentId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const addText = async () => {
    if (!textBody.trim()) { toast.error("Cole o texto"); return; }
    setBusy(true);
    const content = textBody.trim();
    const { error } = await supabase.from("crm_ai_agent_knowledge").insert({
      agent_id: agentId, kind: "text", title: textTitle.trim() || "Texto",
      content, char_count: content.length, status: "ready", created_by: staffId,
    });
    setBusy(false);
    if (error) { toast.error("Erro ao salvar texto"); return; }
    setTextTitle(""); setTextBody(""); setMode(null);
    toast.success("Texto adicionado");
    fetchItems();
  };

  const addLink = async () => {
    const url = linkUrl.trim();
    if (!/^https?:\/\//i.test(url)) { toast.error("Informe uma URL válida (http/https)"); return; }
    setBusy(true);
    const { data, error } = await supabase.from("crm_ai_agent_knowledge").insert({
      agent_id: agentId, kind: "link", title: linkTitle.trim() || url,
      source_url: url, status: "pending", created_by: staffId,
    }).select("id").single();
    if (error || !data) { setBusy(false); toast.error("Erro ao salvar link"); return; }
    // dispara extração server-side (CORS)
    try {
      await supabase.functions.invoke("crm-agent-knowledge", { body: { action: "ingest_link", knowledge_id: data.id, url } });
    } catch { /* status fica em pending/error e aparece na lista */ }
    setBusy(false);
    setLinkTitle(""); setLinkUrl(""); setMode(null);
    toast.success("Link enviado. Extraindo conteúdo...");
    setTimeout(fetchItems, 1500);
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { toast.error("Arquivo acima de 15MB"); return; }
    setBusy(true);
    try {
      const ext = (file.name.split(".").pop() || "").toLowerCase();
      const path = `agent-knowledge/${agentId}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);

      let content: string | null = null;
      let status = "stored";
      if (TEXT_EXT.includes(ext)) {
        content = await file.text();
        if (content.length > 60000) content = content.slice(0, 60000);
        status = "ready";
      }
      const { error } = await supabase.from("crm_ai_agent_knowledge").insert({
        agent_id: agentId, kind: "document", title: file.name,
        source_url: pub.publicUrl, file_path: path,
        content, char_count: content?.length ?? null,
        status, created_by: staffId,
      });
      if (error) throw error;
      toast.success(status === "ready" ? "Documento lido e adicionado" : "Documento anexado (leitura no motor de resposta)");
      fetchItems();
    } catch (err: any) {
      toast.error(err.message || "Erro ao subir documento");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const remove = async (id: string, path: string | null) => {
    await supabase.from("crm_ai_agent_knowledge").delete().eq("id", id);
    if (path) await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
    fetchItems();
  };

  const kindIcon = (k: string) => k === "link" ? <Link2 className="h-3.5 w-3.5" /> : k === "document" ? <FileText className="h-3.5 w-3.5" /> : <Type className="h-3.5 w-3.5" />;
  const statusBadge = (s: string) => {
    if (s === "ready") return <Badge variant="outline" className="text-[10px] gap-1"><CheckCircle2 className="h-3 w-3 text-green-600" /> Pronto</Badge>;
    if (s === "error") return <Badge variant="outline" className="text-[10px] gap-1"><AlertCircle className="h-3 w-3 text-destructive" /> Erro</Badge>;
    if (s === "stored") return <Badge variant="outline" className="text-[10px] gap-1"><Clock className="h-3 w-3" /> Anexado</Badge>;
    return <Badge variant="outline" className="text-[10px] gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Processando</Badge>;
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={mode === "text" ? "default" : "outline"} className="gap-1.5" onClick={() => setMode(mode === "text" ? null : "text")}>
          <Type className="h-3.5 w-3.5" /> Texto
        </Button>
        <Button size="sm" variant={mode === "link" ? "default" : "outline"} className="gap-1.5" onClick={() => setMode(mode === "link" ? null : "link")}>
          <Link2 className="h-3.5 w-3.5" /> Link
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => fileRef.current?.click()} disabled={busy}>
          <Upload className="h-3.5 w-3.5" /> Documento
        </Button>
        <input ref={fileRef} type="file" className="hidden" onChange={onPickFile}
          accept=".txt,.md,.csv,.json,.html,.pdf,.doc,.docx" />
      </div>

      {mode === "text" && (
        <div className="rounded-md border p-3 space-y-2">
          <div className="grid gap-1.5"><Label className="text-xs">Título</Label>
            <Input value={textTitle} onChange={(e) => setTextTitle(e.target.value)} placeholder="Ex: Tabela de preços" /></div>
          <div className="grid gap-1.5"><Label className="text-xs">Conteúdo</Label>
            <Textarea rows={5} value={textBody} onChange={(e) => setTextBody(e.target.value)} placeholder="Cole aqui o conhecimento (script, FAQ, preços, objeções...)" /></div>
          <div className="flex justify-end"><Button size="sm" onClick={addText} disabled={busy}>{busy && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}Adicionar</Button></div>
        </div>
      )}

      {mode === "link" && (
        <div className="rounded-md border p-3 space-y-2">
          <div className="grid gap-1.5"><Label className="text-xs">Título</Label>
            <Input value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} placeholder="Ex: Página de vendas" /></div>
          <div className="grid gap-1.5"><Label className="text-xs">URL</Label>
            <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." /></div>
          <div className="flex justify-end"><Button size="sm" onClick={addLink} disabled={busy}>{busy && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}Adicionar</Button></div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma fonte de conhecimento ainda. Adicione textos, links ou documentos.</p>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.id} className="flex items-start justify-between rounded-md border p-2.5 gap-2">
              <div className="flex items-start gap-2 min-w-0">
                <span className="mt-0.5 text-muted-foreground">{kindIcon(it.kind)}</span>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{it.title || "(sem título)"}</div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {statusBadge(it.status)}
                    {it.char_count != null && <span className="text-[11px] text-muted-foreground">{it.char_count.toLocaleString("pt-BR")} caracteres</span>}
                    {it.source_url && it.kind === "link" && <a href={it.source_url} target="_blank" rel="noreferrer" className="text-[11px] text-primary truncate max-w-[180px]">{it.source_url}</a>}
                  </div>
                  {it.error && <div className="text-[11px] text-destructive mt-0.5">{it.error}</div>}
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => remove(it.id, it.file_path)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
