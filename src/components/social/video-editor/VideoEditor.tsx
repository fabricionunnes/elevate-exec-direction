import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Wand2, Play, Pause, Trash2, Plus, SmilePlus, Type, Pencil, Check, Download
} from "lucide-react";
import { useVideoRenderer } from "./useVideoRenderer";
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
  onVideoRendered?: (url: string) => void;
}

const OVERLAY_TYPE_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  headline: { label: "Headline", color: "bg-red-500/20 text-red-400 border-red-500/30", icon: "📢" },
  emoji: { label: "Emoji", color: "bg-amber-500/20 text-amber-400 border-amber-500/30", icon: "😀" },
  text_highlight: { label: "Destaque", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: "✨" },
  zoom_cue: { label: "Zoom", color: "bg-green-500/20 text-green-400 border-green-500/30", icon: "🔍" },
  broll_keyword: { label: "B-Roll", color: "bg-purple-500/20 text-purple-400 border-purple-500/30", icon: "🖼️" },
};

export const VideoEditor = ({ cardId, videoUrl, editorNotes, disabled, onVideoRendered }: VideoEditorProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [videoNaturalWidth, setVideoNaturalWidth] = useState(0);
  const [videoNaturalHeight, setVideoNaturalHeight] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [captions, setCaptions] = useState<VideoCaption[]>([]);
  const [overlays, setOverlays] = useState<VideoOverlay[]>([]);
  const [captionStyle, setCaptionStyle] = useState<CaptionStyleKey>("default");
  const [transcribing, setTranscribing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingCaptionId, setEditingCaptionId] = useState<string | null>(null);
  const [editingOverlayId, setEditingOverlayId] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const animFrame = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const { renderVideo, rendering, progress: renderProgress } = useVideoRenderer({
    cardId,
    onRendered: onVideoRendered,
  });

  // Calculate the rendered video rect inside the container (object-contain)
  const videoRect = useMemo(() => {
    if (!videoNaturalWidth || !videoNaturalHeight || !containerWidth || !containerHeight) {
      return { left: 0, top: 0, width: containerWidth || 0, height: containerHeight || 0 };
    }
    const videoAspect = videoNaturalWidth / videoNaturalHeight;
    const containerAspect = containerWidth / containerHeight;
    let renderW: number, renderH: number, offsetX: number, offsetY: number;
    if (videoAspect > containerAspect) {
      renderW = containerWidth;
      renderH = containerWidth / videoAspect;
      offsetX = 0;
      offsetY = (containerHeight - renderH) / 2;
    } else {
      renderH = containerHeight;
      renderW = containerHeight * videoAspect;
      offsetX = (containerWidth - renderW) / 2;
      offsetY = 0;
    }
    return { left: offsetX, top: offsetY, width: renderW, height: renderH };
  }, [videoNaturalWidth, videoNaturalHeight, containerWidth, containerHeight]);

  // Find headline overlay
  const headline = overlays.find((o) => o.overlay_type === "headline");

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
          `Edição concluída! ${data.captions_count} legendas e ${data.overlays_count} efeitos gerados.`
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

      toast.info("Transcrição iniciada. Processando vídeo e gerando edição rica...");
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

  const saveOverlay = async (overlay: VideoOverlay) => {
    setSaving(true);
    try {
      await supabase
        .from("social_video_overlays")
        .update({ content: overlay.content })
        .eq("id", overlay.id);
      setEditingOverlayId(null);
      toast.success("Overlay salvo");
    } catch {
      toast.error("Erro ao salvar overlay");
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

  // Group overlays by type for the panel
  const overlaysByType = useMemo(() => {
    const groups: Record<string, VideoOverlay[]> = {};
    for (const o of overlays) {
      const type = o.overlay_type || "emoji";
      if (!groups[type]) groups[type] = [];
      groups[type].push(o);
    }
    return groups;
  }, [overlays]);

  return (
    <div className="space-y-4">
      {/* Headline Editor */}
      {headline && (
        <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/5 space-y-2">
          <div className="flex items-center gap-2">
            <Type className="h-4 w-4 text-red-400" />
            <Label className="text-sm font-semibold text-red-400">Headline / Gancho</Label>
          </div>
          <div className="flex items-center gap-2">
            {editingOverlayId === headline.id ? (
              <>
                <Input
                  value={headline.content}
                  onChange={(e) =>
                    setOverlays((prev) =>
                      prev.map((o) => o.id === headline.id ? { ...o, content: e.target.value } : o)
                    )
                  }
                  className="flex-1 text-sm font-bold"
                  placeholder="Headline de impacto..."
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => saveOverlay(headline)}
                  disabled={saving}
                >
                  <Check className="h-4 w-4 text-green-500" />
                </Button>
              </>
            ) : (
              <>
                <p className="flex-1 text-sm font-bold text-foreground">{headline.content}</p>
                {!disabled && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => setEditingOverlayId(headline.id)}
                  >
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Video Player with Overlays */}
      <div
        ref={containerRef}
        className="relative bg-black rounded-lg overflow-hidden"
        style={{ maxHeight: 500 }}
      >
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full object-contain"
          style={{ maxHeight: 500 }}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              setDuration(videoRef.current.duration);
              setVideoNaturalWidth(videoRef.current.videoWidth);
              setVideoNaturalHeight(videoRef.current.videoHeight);
            }
            if (containerRef.current) {
              setContainerWidth(containerRef.current.clientWidth);
              setContainerHeight(containerRef.current.clientHeight);
            }
          }}
          onResize={() => {
            if (containerRef.current) {
              setContainerWidth(containerRef.current.clientWidth);
              setContainerHeight(containerRef.current.clientHeight);
            }
          }}
          onEnded={() => {
            setIsPlaying(false);
            cancelAnimationFrame(animFrame.current);
          }}
          onClick={togglePlay}
        />

        {/* Overlay zone clipped to the actual video rect */}
        <div
          className="absolute pointer-events-none"
          style={{
            position: "absolute",
            left: videoRect.left,
            top: videoRect.top,
            width: videoRect.width || "100%",
            height: videoRect.height || "100%",
            overflow: "hidden",
          }}
        >
          <div className="relative w-full h-full">
            <VideoCaptionOverlay captions={captions} currentTime={currentTime} styleOverride={captionStyle} />
            <VideoOverlayLayer overlays={overlays} currentTime={currentTime} />
          </div>
        </div>

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

        {/* Visual timeline with color-coded overlay markers */}
        <div className="relative h-8 bg-muted rounded-sm overflow-hidden">
          {/* Caption track */}
          {captions.map((c) => (
            <div
              key={c.id}
              className="absolute h-2 bg-primary/40 rounded-sm cursor-pointer hover:bg-primary/60 transition-colors"
              style={{
                top: 0,
                left: `${(c.start_time / duration) * 100}%`,
                width: `${((c.end_time - c.start_time) / duration) * 100}%`,
              }}
              onClick={() => seekTo(c.start_time)}
              title={c.text}
            />
          ))}
          {/* Overlay tracks by type */}
          {overlays.map((o) => {
            const typeInfo = OVERLAY_TYPE_LABELS[o.overlay_type] || OVERLAY_TYPE_LABELS.emoji;
            const trackY = o.overlay_type === "headline" ? 8 : o.overlay_type === "text_highlight" ? 12 : o.overlay_type === "zoom_cue" ? 16 : o.overlay_type === "broll_keyword" ? 20 : 24;
            const colors: Record<string, string> = {
              headline: "bg-red-400/60",
              text_highlight: "bg-blue-400/60",
              zoom_cue: "bg-green-400/60",
              broll_keyword: "bg-purple-400/60",
              emoji: "bg-amber-400/50",
            };
            return (
              <div
                key={o.id}
                className={cn("absolute h-2 rounded-sm cursor-pointer hover:opacity-80 transition-opacity", colors[o.overlay_type] || colors.emoji)}
                style={{
                  top: trackY,
                  left: `${(o.start_time / duration) * 100}%`,
                  width: `${Math.max(((o.end_time - o.start_time) / duration) * 100, 0.5)}%`,
                }}
                onClick={() => seekTo(o.start_time)}
                title={`${typeInfo.icon} ${o.content}`}
              />
            );
          })}
          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-primary z-10"
            style={{ left: `${(currentTime / duration) * 100}%` }}
          />
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
          <div className="flex items-center gap-1"><div className="w-3 h-2 bg-primary/40 rounded-sm" /> Legendas</div>
          <div className="flex items-center gap-1"><div className="w-3 h-2 bg-red-400/60 rounded-sm" /> Headline</div>
          <div className="flex items-center gap-1"><div className="w-3 h-2 bg-amber-400/50 rounded-sm" /> Emojis</div>
          <div className="flex items-center gap-1"><div className="w-3 h-2 bg-blue-400/60 rounded-sm" /> Destaques</div>
          <div className="flex items-center gap-1"><div className="w-3 h-2 bg-green-400/60 rounded-sm" /> Zoom</div>
          <div className="flex items-center gap-1"><div className="w-3 h-2 bg-purple-400/60 rounded-sm" /> B-Roll</div>
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
          <><Loader2 className="h-4 w-4 animate-spin" /> Transcrevendo e editando com IA...</>
        ) : captions.length > 0 ? (
          <><Wand2 className="h-4 w-4" /> Re-editar com IA</>
        ) : (
          <><Wand2 className="h-4 w-4" /> Editar vídeo com IA</>
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
          <ScrollArea className="max-h-[200px]">
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
                                  c.id === caption.id ? { ...c, start_time: Number(e.target.value) } : c
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
                                  c.id === caption.id ? { ...c, end_time: Number(e.target.value) } : c
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

      {/* Overlays by Type */}
      {overlays.length > 0 && (
        <div className="space-y-3">
          <Label className="text-sm">Efeitos e Overlays ({overlays.length})</Label>

          {Object.entries(overlaysByType).map(([type, items]) => {
            if (type === "headline") return null; // headline shown above
            const typeInfo = OVERLAY_TYPE_LABELS[type] || OVERLAY_TYPE_LABELS.emoji;
            return (
              <div key={type} className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{typeInfo.icon}</span>
                  <span className="text-xs font-medium text-muted-foreground">{typeInfo.label} ({items.length})</span>
                </div>
                <div className="space-y-1">
                  {items.map((overlay) => (
                    <div
                      key={overlay.id}
                      className={cn(
                        "flex items-center gap-2 p-1.5 rounded border text-xs cursor-pointer transition-colors",
                        currentTime >= overlay.start_time && currentTime <= overlay.end_time
                          ? cn("bg-muted/30", typeInfo.color)
                          : "border-border"
                      )}
                      onClick={() => seekTo(overlay.start_time)}
                    >
                      {type === "emoji" ? (
                        <span className="text-lg">{overlay.content}</span>
                      ) : (
                        <span className="text-xs font-medium truncate max-w-[120px]">{overlay.content}</span>
                      )}
                      <span className="text-muted-foreground flex-1 text-right">
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
              </div>
            );
          })}
        </div>
      )}

      {/* Emoji Quick Add */}
      <div className="space-y-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          disabled={disabled}
        >
          <SmilePlus className="h-3 w-3" /> Adicionar emoji manual
        </Button>

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
      </div>
    </div>
  );
};
