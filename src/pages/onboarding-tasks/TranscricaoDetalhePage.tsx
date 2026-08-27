// Leitura de uma transcrição: player da gravação, texto separado por falante
// com o tempo de cada fala (clicar pula o áudio pra ali), resumo, assuntos e
// o que ficou combinado.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, Loader2, Copy, Download, Search, Sparkles, Target, ListChecks, User,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { duracao, type Transcricao } from "./TranscricoesPage";

const CORES = ["text-sky-600", "text-emerald-600", "text-amber-600", "text-violet-600", "text-rose-600", "text-teal-600"];
const tempo = (ms: number) => {
  const s = Math.round(ms / 1000), m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
};

export default function TranscricaoDetalhePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [t, setT] = useState<Transcricao | null>(null);
  const [loading, setLoading] = useState(true);
  const [midia, setMidia] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [resumindo, setResumindo] = useState(false);
  const playerRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);

  const carregar = useCallback(async () => {
    const { data } = await (supabase as any).from("media_transcriptions").select("*").eq("id", id).maybeSingle();
    setT(data as Transcricao);
    if (data?.file_path) {
      const { data: signed } = await supabase.storage.from("transcricoes").createSignedUrl(data.file_path, 60 * 60 * 3);
      setMidia(signed?.signedUrl || null);
    } else if (data?.source_url) setMidia(data.source_url);
    setLoading(false);
  }, [id]);
  useEffect(() => { carregar(); }, [carregar]);

  const irPara = (ms: number) => {
    if (playerRef.current) {
      playerRef.current.currentTime = ms / 1000;
      playerRef.current.play().catch(() => {});
    }
  };

  const falantes = useMemo(() => {
    const set = new Set((t?.utterances || []).map((u) => u.speaker));
    return [...set];
  }, [t]);

  const falas = useMemo(() => {
    const lista = t?.utterances || [];
    const q = busca.trim().toLowerCase();
    return q ? lista.filter((u) => u.text.toLowerCase().includes(q)) : lista;
  }, [t, busca]);

  const copiar = () => {
    const txt = (t?.utterances?.length
      ? t.utterances.map((u) => `[${tempo(u.start)}] Falante ${u.speaker}: ${u.text}`).join("\n")
      : t?.text) || "";
    navigator.clipboard.writeText(txt);
    toast.success("Transcrição copiada");
  };

  const baixar = () => {
    const txt = [
      t?.title, "",
      t?.summary ? `RESUMO\n${t.summary}\n` : "",
      t?.action_items?.length ? "COMBINADO\n" + t.action_items.map((a) => `- ${a.title}${a.owner ? ` (${a.owner})` : ""}`).join("\n") + "\n" : "",
      "TRANSCRIÇÃO",
      t?.utterances?.length
        ? t.utterances.map((u) => `[${tempo(u.start)}] Falante ${u.speaker}: ${u.text}`).join("\n")
        : t?.text || "",
    ].join("\n");
    const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(t?.title || "transcricao").replace(/[^\w]+/g, "-").toLowerCase()}.txt`;
    a.click();
  };

  const gerarResumo = async () => {
    setResumindo(true);
    try {
      const { error } = await supabase.functions.invoke("transcribe-media", {
        body: { action: "summarize", transcription_id: id },
      });
      if (error) throw error;
      await carregar();
      toast.success("Resumo atualizado");
    } catch (e: any) {
      toast.error(e?.message || "Não consegui gerar o resumo");
    } finally { setResumindo(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!t) return <div className="container max-w-3xl mx-auto py-16 text-center text-muted-foreground">Transcrição não encontrada.</div>;

  return (
    <div className="container max-w-5xl mx-auto py-6 space-y-5">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks/transcricoes")}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">{t.title}</h1>
          <p className="text-sm text-muted-foreground">
            {duracao(t.duration_seconds) && `${duracao(t.duration_seconds)} · `}
            {format(new Date(t.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            {falantes.length > 1 ? ` · ${falantes.length} falantes` : ""}
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={copiar}><Copy className="h-3.5 w-3.5" /> Copiar</Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={baixar}><Download className="h-3.5 w-3.5" /> Baixar</Button>
      </div>

      {midia && (
        <Card><CardContent className="p-3">
          {t.media_kind === "video" ? (
            <video ref={playerRef as any} src={midia} controls className="w-full rounded-lg max-h-[420px] bg-black" />
          ) : (
            <audio ref={playerRef as any} src={midia} controls className="w-full" />
          )}
        </CardContent></Card>
      )}

      {(t.summary || t.action_items?.length || t.topics?.length) ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Resumo
            </CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm leading-relaxed">{t.summary}</p>
              {!!t.topics?.length && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {t.topics.map((a, i) => <Badge key={i} variant="outline" className="text-[11px] gap-1"><Target className="h-3 w-3" />{a}</Badge>)}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-primary" /> O que ficou combinado
            </CardTitle></CardHeader>
            <CardContent>
              {t.action_items?.length ? (
                <ul className="space-y-2">
                  {t.action_items.map((a, i) => (
                    <li key={i} className="text-sm flex gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{a.title}{a.owner ? <span className="text-muted-foreground"> — {a.owner}</span> : null}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted-foreground">Nada combinado nesta conversa.</p>}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card><CardContent className="py-6 text-center">
          <Button variant="outline" className="gap-2" onClick={gerarResumo} disabled={resumindo}>
            {resumindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Gerar resumo e ações
          </Button>
        </CardContent></Card>
      )}

      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar dentro da conversa..." value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-4 space-y-3 max-h-[65vh] overflow-y-auto">
          {t.utterances?.length ? (
            falas.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma fala com esse termo.</p>
            ) : falas.map((u, i) => {
              const cor = CORES[falantes.indexOf(u.speaker) % CORES.length];
              return (
                <div key={i} className="flex gap-3">
                  <button className="text-xs text-muted-foreground tabular-nums shrink-0 hover:text-primary pt-0.5"
                    onClick={() => irPara(u.start)} title="Ouvir a partir daqui">
                    {tempo(u.start)}
                  </button>
                  <div className="min-w-0">
                    <span className={`text-xs font-bold ${cor} flex items-center gap-1`}>
                      <User className="h-3 w-3" /> Falante {u.speaker}
                    </span>
                    <p className="text-sm leading-relaxed">{u.text}</p>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{t.text || "Sem texto."}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
