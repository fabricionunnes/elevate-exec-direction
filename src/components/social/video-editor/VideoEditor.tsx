import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Wand2, Play, Pause, Trash2, Plus, GripVertical, SmilePlus
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { VideoCaptionOverlay, VideoCaption } from "./VideoCaptionOverlay";
import { VideoOverlayLayer, VideoOverlay } from "./VideoOverlayLayer";
import { CaptionStylePicker, CaptionStyleKey } from "./CaptionStylePicker";

interface VideoEditorProps {
  cardId: string;
  videoUrl: string;
  editorNotes: string;
  disabled?: boolean;
}

export const VideoEditor = ({ cardId, videoUrl, editorNotes, disabled }: VideoEditorProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [captions, setCaptions] = useState<VideoCaption[]>([]);
  const [overlays, setOverlays] = useState<VideoOverlay[]>([]);
  const [captionStyle, setCaptionStyle] = useState<CaptionStyleKey>("default");
  const [transcribing, setTranscribing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingCaptionId, setEditingCaptionId] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const animFrame = useRef<number>(0);

  // Load existing captions and overlays
  useEffect(() => {
    loadCaptions();
    loadOverlays();
  }, [cardId]);

  const loadCaptions = async () => {
    const { data } = await supabase
      .from("social_video_captions")
      .select("*")
      .eq("card_id", cardId)
      .order("sort_order");
    if (data) {
      setCaptions(data as VideoCaption[]);
      if (data.length > 0 && data[0].style_preset) {
        setCaptionStyle(data[0].style_preset as CaptionStyleKey);
      }
    }
  };

  const loadOverlays = async () => {
    const { data } = await supabase
      .from("social_video_overlays")
      .select("*")
      .eq("card_id", cardId)
      .order("start_time");
    if (data) setOverlays(data as VideoOverlay[]);
  };

  // Video time tracking
  const updateTime = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      if (!videoRef.current.paused) {
        animFrame.current = requestAnimationFrame(updateTime);
      }
    }
  }, []);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
      animFrame.current = requestAnimationFrame(updateTime);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      cancelAnimationFrame(animFrame.current);
    }
  };

  const seekTo = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // AI Transcription
  const pollTranscriptionStatus = async (transcriptId: string) => {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const { data, error } = await supabase.functions.invoke("social-transcribe-video", {
        body: { action: "status", cardId, transcriptId, editorNotes },
      });

      if (error) {
        const status = (error as any)?.status;
        if (status === 429) {
          toast.error("Limite de requisições excedido. Tente novamente em alguns segundos.");
          return;
        }
        if (status === 402) {
          toast.error("Créditos de IA insuficientes.");
          return;
        }
        throw error;
      }

      if (data?.status === "queued" || data?.status === "processing") {
        await new Promise((resolve) => setTimeout(resolve, 2500));
        continue;
      }

      if (data?.success && data?.status === "completed") {
        toast.success(
          `Transcrição concluída! ${data.captions_count} legendas e ${data.overlays_count} efeitos sugeridos.`
        );
        if (data.suggested_style) setCaptionStyle(data.suggested_style);
        await Promise.all([loadCaptions(), loadOverlays()]);
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }
    }

    toast.error("A transcrição está demorando mais do que o esperado. Tente novamente em instantes.");
  };

  const handleTranscribe = async () => {
    setTranscribing(true);
    try {
      const { data, error } = await supabase.functions.invoke("social-transcribe-video", {
        body: { action: "start", cardId, videoUrl, editorNotes },
      });

      if (error) {
        const status = (error as any)?.status;
        if (status === 429) {
          toast.error("Limite de requisições excedido. Tente novamente em alguns segundos.");
          return;
        }
        if (status === 402) {
          toast.error("Créditos de IA insuficientes.");
          return;
        }
        throw error;
      }

      if (!data?.transcriptId) {
        throw new Error("ID da transcrição não retornado");
      }

      toast.info("Transcrição iniciada. Processando vídeo...");
      await pollTranscriptionStatus(data.transcriptId);
    } catch (error) {
      console.error("Transcription error:", error);
      toast.error("Erro na transcrição do vídeo");
    } finally {
      setTranscribing(false);
    }
  };

  // Save caption changes
  const saveCaption = async (caption: VideoCaption) => {
    setSaving(true);
    try {
      await supabase
        .from("social_video_captions")
        .update({
          text: caption.text,
          start_time: caption.start_time,
          end_time: caption.end_time,
          style_preset: captionStyle,
        })
        .eq("id", caption.id);
      setEditingCaptionId(null);
    } catch (error) {
      toast.error("Erro ao salvar legenda");
    } finally {
      setSaving(false);
    }
  };

  const deleteCaption = async (id: string) => {
    await supabase.from("social_video_captions").delete().eq("id", id);
    setCaptions((prev) => prev.filter((c) => c.id !== id));
  };

  const deleteOverlay = async (id: string) => {
    await supabase.from("social_video_overlays").delete().eq("id", id);
    setOverlays((prev) => prev.filter((o) => o.id !== id));
  };

  const addManualCaption = async () => {
    const start = currentTime;
    const end = Math.min(currentTime + 3, duration);
    const { data } = await supabase
      .from("social_video_captions")
      .insert({
        card_id: cardId,
        text: "Nova legenda",
        start_time: start,
        end_time: end,
        style_preset: captionStyle,
        sort_order: captions.length,
      })
      .select()
      .single();
    if (data) {
      setCaptions((prev) => [...prev, data as VideoCaption]);
      setEditingCaptionId(data.id);
    }
  };

  const addEmojiOverlay = async (emoji: string) => {
    const start = currentTime;
    const end = Math.min(currentTime + 2, duration);
    const { data } = await supabase
      .from("social_video_overlays")
      .insert({
        card_id: cardId,
        overlay_type: "emoji",
        content: emoji,
        x: 50,
        y: 20,
        scale: 1.5,
        start_time: start,
        end_time: end,
      })
      .select()
      .single();
    if (data) {
      setOverlays((prev) => [...prev, data as VideoOverlay]);
      setShowEmojiPicker(false);
    }
  };

  // Update all caption styles
  const updateAllCaptionStyles = async (newStyle: CaptionStyleKey) => {
    setCaptionStyle(newStyle);
    setCaptions((prev) => prev.map((c) => ({ ...c, style_preset: newStyle })));
    await supabase
      .from("social_video_captions")
      .update({ style_preset: newStyle })
      .eq("card_id", cardId);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const commonEmojis = ["🔥", "💰", "⚡", "💡", "🎯", "🚀", "💪", "👆", "✅", "❌", "⬆️", "📈", "🏆", "💎", "👀", "🤯"];

  return (
    <div className="space-y-4">
      {/* Video Player with Overlays */}
      <div className="relative bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full max-h-[400px] object-contain"
          onLoadedMetadata={() => {
            if (videoRef.current) setDuration(videoRef.current.duration);
          }}
          onEnded={() => {
            setIsPlaying(false);
            cancelAnimationFrame(animFrame.current);
          }}
          onClick={togglePlay}
        />
        <VideoCaptionOverlay captions={captions} currentTime={currentTime} styleOverride={captionStyle} />
        <VideoOverlayLayer overlays={overlays} currentTime={currentTime} />

        {/* Play button overlay when paused */}
        {!isPlaying && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity hover:bg-black/30"
          >
            <Play className="h-12 w-12 text-white/80 fill-white/80" />
          </button>
        )}
      </div>

      {/* Timeline/Scrubber */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={togglePlay}>
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <input
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={currentTime}
            onChange={(e) => seekTo(Number(e.target.value))}
            className="flex-1 h-2 accent-primary"
          />
          <span className="text-xs text-muted-foreground w-20 text-right">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        {/* Visual timeline with caption/overlay markers */}
        <div className="relative h-6 bg-muted rounded-sm overflow-hidden">
          {captions.map((c) => (
            <div
              key={c.id}
              className="absolute top-0 h-3 bg-primary/40 rounded-sm cursor-pointer hover:bg-primary/60 transition-colors"
              style={{
                left: `${(c.start_time / duration) * 100}%`,
                width: `${((c.end_time - c.start_time) / duration) * 100}%`,
              }}
              onClick={() => seekTo(c.start_time)}
              title={c.text}
            />
          ))}
          {overlays.map((o) => (
            <div
              key={o.id}
              className="absolute bottom-0 h-3 bg-amber-400/50 rounded-sm cursor-pointer hover:bg-amber-400/70 transition-colors"
              style={{
                left: `${(o.start_time / duration) * 100}%`,
                width: `${Math.max(((o.end_time - o.start_time) / duration) * 100, 1)}%`,
              }}
              onClick={() => seekTo(o.start_time)}
              title={o.content}
            />
          ))}
          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-primary z-10"
            style={{ left: `${(currentTime / duration) * 100}%` }}
          />
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 bg-primary/40 rounded-sm" /> Legendas
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 bg-amber-400/50 rounded-sm" /> Emojis
          </div>
        </div>
      </div>

      {/* AI Transcribe Button */}
      <Button
        onClick={handleTranscribe}
        disabled={transcribing || disabled}
        className="w-full gap-2"
        variant={captions.length > 0 ? "outline" : "default"}
      >
        {transcribing ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Transcrevendo e analisando...</>
        ) : captions.length > 0 ? (
          <><Wand2 className="h-4 w-4" /> Re-transcrever com IA</>
        ) : (
          <><Wand2 className="h-4 w-4" /> Transcrever e editar com IA</>
        )}
      </Button>

      {/* Caption Style Picker */}
      {captions.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm">Estilo das Legendas</Label>
          <CaptionStylePicker
            value={captionStyle}
            onChange={updateAllCaptionStyles}
            disabled={disabled}
          />
        </div>
      )}

      {/* Caption List */}
      {captions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Legendas ({captions.length})</Label>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={addManualCaption} disabled={disabled}>
              <Plus className="h-3 w-3" /> Adicionar
            </Button>
          </div>
          <ScrollArea className="max-h-[250px]">
            <div className="space-y-1.5 pr-3">
              {captions.map((caption) => (
                <div
                  key={caption.id}
                  className={cn(
                    "flex items-start gap-2 p-2 rounded-md border text-sm transition-colors cursor-pointer",
                    currentTime >= caption.start_time && currentTime <= caption.end_time
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  )}
                  onClick={() => seekTo(caption.start_time)}
                >
                  <div className="flex-1 min-w-0">
                    {editingCaptionId === caption.id ? (
                      <div className="space-y-1.5">
                        <Textarea
                          value={caption.text}
                          onChange={(e) =>
                            setCaptions((prev) =>
                              prev.map((c) =>
                                c.id === caption.id ? { ...c, text: e.target.value } : c
                              )
                            )
                          }
                          rows={2}
                          className="text-xs min-h-0"
                        />
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            step={0.1}
                            value={caption.start_time}
                            onChange={(e) =>
                              setCaptions((prev) =>
                                prev.map((c) =>
                                  c.id === caption.id
                                    ? { ...c, start_time: Number(e.target.value) }
                                    : c
                                )
                              )
                            }
                            className="h-7 text-xs w-20"
                            placeholder="Início"
                          />
                          <Input
                            type="number"
                            step={0.1}
                            value={caption.end_time}
                            onChange={(e) =>
                              setCaptions((prev) =>
                                prev.map((c) =>
                                  c.id === caption.id
                                    ? { ...c, end_time: Number(e.target.value) }
                                    : c
                                )
                              )
                            }
                            className="h-7 text-xs w-20"
                            placeholder="Fim"
                          />
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => saveCaption(caption)}
                            disabled={saving}
                          >
                            Salvar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="space-y-0.5"
                        onDoubleClick={() => !disabled && setEditingCaptionId(caption.id)}
                      >
                        <p className="text-xs truncate">{caption.text}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatTime(caption.start_time)} → {formatTime(caption.end_time)}
                        </p>
                      </div>
                    )}
                  </div>
                  {!disabled && editingCaptionId !== caption.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteCaption(caption.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Emoji Overlays */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm">Emojis / Efeitos ({overlays.length})</Label>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            disabled={disabled}
          >
            <SmilePlus className="h-3 w-3" /> Adicionar
          </Button>
        </div>

        {showEmojiPicker && (
          <div className="flex flex-wrap gap-1.5 p-2 border rounded-lg bg-muted/30">
            {commonEmojis.map((emoji) => (
              <button
                key={emoji}
                className="text-xl hover:scale-125 transition-transform p-1"
                onClick={() => addEmojiOverlay(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {overlays.length > 0 && (
          <div className="space-y-1">
            {overlays.map((overlay) => (
              <div
                key={overlay.id}
                className={cn(
                  "flex items-center gap-2 p-1.5 rounded border text-xs cursor-pointer transition-colors",
                  currentTime >= overlay.start_time && currentTime <= overlay.end_time
                    ? "border-amber-400 bg-amber-50/10"
                    : "border-border"
                )}
                onClick={() => seekTo(overlay.start_time)}
              >
                <span className="text-lg">{overlay.content}</span>
                <span className="text-muted-foreground flex-1">
                  {formatTime(overlay.start_time)} → {formatTime(overlay.end_time)}
                </span>
                {!disabled && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteOverlay(overlay.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3 text-muted-foreground" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
