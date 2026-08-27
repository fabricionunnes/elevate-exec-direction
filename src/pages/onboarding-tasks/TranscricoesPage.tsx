// Transcrições: sobe áudio ou vídeo (ou cola um link) e o sistema devolve o
// texto separado por falante, com resumo, assuntos e o que ficou combinado.
// O arquivo vai pro bucket privado "transcricoes"; quem processa é a edge
// function transcribe-media (AssemblyAI + IA pro resumo).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Upload, Loader2, FileAudio, FileVideo, Search, Trash2,
  Link2, AudioLines, AlertTriangle, CheckCircle2, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface Transcricao {
  id: string; title: string; file_name: string | null; file_path: string | null;
  source_url: string | null; media_kind: string | null; duration_seconds: number | null;
  status: "queued" | "processing" | "done" | "error";
  error_message: string | null; text: string | null;
  utterances: { speaker: string; start: number; end: number; text: string }[] | null;
  summary: string | null; topics: string[] | null;
  action_items: { title: string; owner?: string }[] | null;
  created_at: string;
}

const MAX_GB = 5;   // limite do bucket; acima disso o servidor recusa

export const duracao = (s?: number | null) => {
  if (!s) return "";
  const seg = Math.round(s > 10000 ? s / 1000 : s); // a API devolve segundos; áudio longo pode vir em ms
  const m = Math.floor(seg / 60), r = seg % 60;
  return m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
};

const SITUACAO: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  queued: { label: "Na fila", cls: "bg-slate-500/10 text-slate-600 border-slate-500/30", icon: <Clock className="h-3 w-3" /> },
  processing: { label: "Transcrevendo", cls: "bg-amber-500/10 text-amber-600 border-amber-500/30", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  done: { label: "Pronta", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30", icon: <CheckCircle2 className="h-3 w-3" /> },
  error: { label: "Falhou", cls: "bg-destructive/10 text-destructive border-destructive/30", icon: <AlertTriangle className="h-3 w-3" /> },
};

export default function TranscricoesPage() {
  const navigate = useNavigate();
  const [itens, setItens] = useState<Transcricao[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState("");
  const [linkTitulo, setLinkTitulo] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);

  const carregar = useCallback(async () => {
    const { data } = await (supabase as any).from("media_transcriptions")
      .select("*").order("created_at", { ascending: false }).limit(200);
    setItens((data as Transcricao[]) || []);
    setLoading(false);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  // status muda sozinho na tela enquanto a transcrição roda
  useEffect(() => {
    const ch = supabase.channel("transcricoes-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "media_transcriptions" }, () => carregar())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [carregar]);

  const disparar = async (id: string) => {
    const { error } = await supabase.functions.invoke("transcribe-media", {
      body: { action: "start", transcription_id: id },
    });
    if (error) toast.error("Enviei o arquivo, mas a transcrição não começou. Tente 'Reprocessar'.");
  };

  const enviarArquivo = async (file: File) => {
    if (file.size > MAX_GB * 1024 * 1024 * 1024) {
      toast.error(`Arquivo de ${(file.size / 1073741824).toFixed(1)} GB — o limite é ${MAX_GB} GB. Envie só o áudio da gravação.`);
      return;
    }
    setEnviando(true); setProgresso(1);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: staff } = await (supabase as any).from("onboarding_staff")
        .select("id").eq("user_id", session?.user?.id).maybeSingle();
      if (!staff?.id) throw new Error("Seu usuário não tem cadastro de staff");

      const ext = file.name.split(".").pop() || "bin";
      const caminho = `${staff.id}/${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`;

      // upload retomável (protocolo TUS): manda em pedaços de 6 MB, aguenta
      // gravação de 1-2 GB e continua de onde parou se a internet oscilar
      const { Upload } = await import("tus-js-client");
      await new Promise<void>((resolve, reject) => {
        const up = new Upload(file, {
          endpoint: `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/upload/resumable`,
          retryDelays: [0, 3000, 6000, 12000, 24000],
          headers: {
            authorization: `Bearer ${session?.access_token}`,
            "x-upsert": "true",
          },
          uploadDataDuringCreation: true,
          removeFingerprintOnSuccess: true,
          metadata: {
            bucketName: "transcricoes",
            objectName: caminho,
            contentType: file.type || "application/octet-stream",
            cacheControl: "3600",
          },
          chunkSize: 6 * 1024 * 1024, // exigido pelo Supabase Storage
          onError: reject,
          onProgress: (enviado, total) => setProgresso(Math.round((enviado / total) * 92)),
          onSuccess: () => resolve(),
        });
        up.findPreviousUploads().then((anteriores) => {
          if (anteriores.length) up.resumeFromPreviousUpload(anteriores[0]);
          up.start();
        });
      });

      const { data: linha, error: insErr } = await (supabase as any).from("media_transcriptions").insert({
        title: file.name.replace(/\.[^.]+$/, ""),
        file_path: caminho, file_name: file.name, file_size: file.size,
        media_kind: file.type.startsWith("video") ? "video" : "audio",
        language: "pt", status: "queued", created_by: staff.id,
      }).select("id").single();
      if (insErr) throw insErr;

      setProgresso(97);
      await disparar(linha.id);
      setProgresso(100);
      toast.success("Gravação enviada — a transcrição já começou");
      carregar();
    } catch (e: any) {
      toast.error(e?.message || "Não consegui enviar o arquivo");
    } finally {
      setEnviando(false); setProgresso(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const enviarLink = async () => {
    if (!/^https?:\/\//i.test(link)) { toast.error("Cole um link que comece com http"); return; }
    setEnviando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: staff } = await (supabase as any).from("onboarding_staff")
        .select("id").eq("user_id", user?.id).maybeSingle();
      const { data: linha, error } = await (supabase as any).from("media_transcriptions").insert({
        title: linkTitulo.trim() || "Gravação por link",
        source_url: link.trim(), media_kind: "audio", language: "pt",
        status: "queued", created_by: staff?.id ?? null,
      }).select("id").single();
      if (error) throw error;
      await disparar(linha.id);
      toast.success("Link enviado — a transcrição já começou");
      setLinkOpen(false); setLink(""); setLinkTitulo(""); carregar();
    } catch (e: any) {
      toast.error(e?.message || "Não consegui usar esse link");
    } finally { setEnviando(false); }
  };

  const reprocessar = async (t: Transcricao) => {
    await (supabase as any).from("media_transcriptions")
      .update({ status: "queued", error_message: null, provider_job_id: null }).eq("id", t.id);
    await disparar(t.id);
    toast.success("Reenviado para transcrição");
    carregar();
  };

  const apagar = async (t: Transcricao) => {
    if (!confirm(`Apagar "${t.title}"? A gravação também sai do sistema.`)) return;
    if (t.file_path) await supabase.storage.from("transcricoes").remove([t.file_path]);
    const { error } = await (supabase as any).from("media_transcriptions").delete().eq("id", t.id);
    if (error) { toast.error("Só quem enviou (ou um admin) pode apagar"); return; }
    toast.success("Transcrição apagada");
    carregar();
  };

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return itens;
    return itens.filter((t) =>
      t.title.toLowerCase().includes(q) ||
      (t.summary || "").toLowerCase().includes(q) ||
      (t.text || "").toLowerCase().includes(q));
  }, [itens, busca]);

  return (
    <div className="container max-w-5xl mx-auto py-6 space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks")}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AudioLines className="h-6 w-6 text-primary" /> Transcrições
          </h1>
          <p className="text-sm text-muted-foreground">
            Suba a gravação de uma call ou reunião e receba o texto por falante, com resumo e o que ficou combinado.
            A gravação é apagada do servidor assim que a transcrição fica pronta — o texto continua aqui.
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => setLinkOpen(true)}>
          <Link2 className="h-4 w-4" /> Usar link
        </Button>
      </div>

      {/* área de envio */}
      <Card
        className={`border-2 border-dashed transition-colors ${arrastando ? "border-primary bg-primary/5" : "border-border"}`}
        onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault(); setArrastando(false);
          const f = e.dataTransfer.files?.[0];
          if (f) enviarArquivo(f);
        }}
      >
        <CardContent className="py-10 text-center">
          {enviando ? (
            <div className="max-w-sm mx-auto space-y-3">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <Progress value={progresso} />
              <p className="text-sm text-muted-foreground">Enviando a gravação... {progresso}%</p>
              <p className="text-xs text-muted-foreground">Arquivo grande pode levar alguns minutos. Se a internet cair, o envio continua de onde parou.</p>
            </div>
          ) : (
            <>
              <Upload className="h-10 w-10 mx-auto mb-3 text-primary/40" />
              <p className="font-medium">Arraste o áudio ou vídeo aqui</p>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                MP3, M4A, WAV, MP4, MOV — até {MAX_GB} GB
              </p>
              <Button onClick={() => inputRef.current?.click()} className="gap-2">
                <Upload className="h-4 w-4" /> Escolher arquivo
              </Button>
              <input ref={inputRef} type="file" accept="audio/*,video/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) enviarArquivo(f); }} />
            </>
          )}
        </CardContent>
      </Card>

      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por título, resumo ou dentro do texto..."
          value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtrados.length === 0 ? (
        <Card><CardContent className="py-14 text-center text-muted-foreground">
          <AudioLines className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>{busca ? "Nada encontrado com esse termo." : "Nenhuma gravação enviada ainda."}</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtrados.map((t) => {
            const s = SITUACAO[t.status] || SITUACAO.queued;
            return (
              <Card key={t.id} className="hover:border-primary/40 transition cursor-pointer"
                onClick={() => t.status === "done" && navigate(`/onboarding-tasks/transcricoes/${t.id}`)}>
                <CardContent className="py-3 px-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    {t.media_kind === "video" ? <FileVideo className="h-4 w-4 text-primary" /> : <FileAudio className="h-4 w-4 text-primary" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{t.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {duracao(t.duration_seconds) && `${duracao(t.duration_seconds)} · `}
                      enviado {formatDistanceToNow(new Date(t.created_at), { addSuffix: true, locale: ptBR })}
                      {t.status === "error" && t.error_message ? ` · ${t.error_message.slice(0, 60)}` : ""}
                      {t.status === "done" && t.summary ? ` · ${t.summary.slice(0, 70)}...` : ""}
                    </p>
                  </div>
                  <Badge variant="outline" className={`gap-1 text-[10px] shrink-0 ${s.cls}`}>{s.icon}{s.label}</Badge>
                  {t.status === "error" && (
                    <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); reprocessar(t); }}>
                      Reprocessar
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0"
                    onClick={(e) => { e.stopPropagation(); apagar(t); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Transcrever a partir de um link</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nome da gravação" value={linkTitulo} onChange={(e) => setLinkTitulo(e.target.value)} />
            <Input placeholder="https://... (link direto do arquivo)" value={link} onChange={(e) => setLink(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              Precisa ser um link direto do arquivo, aberto para download. Link de página do Drive ou do YouTube não funciona.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkOpen(false)}>Cancelar</Button>
            <Button onClick={enviarLink} disabled={enviando}>
              {enviando && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />} Transcrever
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
