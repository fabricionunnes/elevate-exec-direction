import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface AudioPlayerProps {
  src: string;
  onError?: () => void;
  /** id da crm_whatsapp_messages: permite baixar a mídia pela API quando a URL do CDN do WhatsApp não toca */
  messageId?: string;
}

// URL do CDN do WhatsApp é criptografada — o navegador não consegue tocar.
const isUnplayable = (u: string) => !u || u.includes("whatsapp.net") || u.endsWith(".enc");

const SPEED_OPTIONS = [1, 1.5, 2] as const;
type SpeedOption = typeof SPEED_OPTIONS[number];

export function AudioPlayer({ src, onError, messageId }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState<SpeedOption>(1);
  const [hasError, setHasError] = useState(false);
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const triedResolve = useRef(false);

  const effectiveSrc = resolvedSrc || src;

  const tryResolve = async () => {
    if (!messageId || triedResolve.current) { setHasError(true); return; }
    triedResolve.current = true;
    setResolving(true);
    try {
      const { data } = await supabase.functions.invoke("wa-media-fetch", { body: { message_id: messageId } });
      if (data?.ok && data.url) {
        setHasError(false);
        setResolvedSrc(data.url);
      } else {
        setHasError(true);
      }
    } catch {
      setHasError(true);
    } finally {
      setResolving(false);
    }
  };

  // URL sabidamente não tocável: já tenta resolver pela API sem esperar o erro do <audio>.
  useEffect(() => {
    if (isUnplayable(src) && messageId && !triedResolve.current) tryResolve();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, messageId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);
    const handleError = () => {
      if (messageId && !triedResolve.current) { tryResolve(); return; }
      setHasError(true);
      onError?.();
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onError, resolvedSrc, resolving, hasError]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  }, [speed]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      await audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSliderChange = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value[0];
    setCurrentTime(value[0]);
  };

  const cycleSpeed = () => {
    const currentIndex = SPEED_OPTIONS.indexOf(speed);
    const nextIndex = (currentIndex + 1) % SPEED_OPTIONS.length;
    setSpeed(SPEED_OPTIONS[nextIndex]);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  if (resolving) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando áudio...
      </div>
    );
  }

  if (hasError || (isUnplayable(effectiveSrc) && !resolving)) {
    return (
      <div className="text-sm text-muted-foreground italic">
        🎤 Áudio não disponível
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 min-w-[200px]">
      <audio ref={audioRef} src={effectiveSrc} preload="metadata" />
      
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={togglePlay}
      >
        {isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </Button>

      <div className="flex-1 flex items-center gap-2">
        <Slider
          value={[currentTime]}
          max={duration || 100}
          step={0.1}
          onValueChange={handleSliderChange}
          className="flex-1"
        />
        <span className="text-xs text-muted-foreground w-10 text-right shrink-0">
          {formatTime(currentTime)}
        </span>
      </div>

      <Button
        variant="outline"
        size="sm"
        className={cn(
          "h-6 w-10 text-xs font-medium shrink-0 px-1",
          speed !== 1 && "bg-primary/10 border-primary/30"
        )}
        onClick={cycleSpeed}
      >
        {speed}x
      </Button>
    </div>
  );
}
