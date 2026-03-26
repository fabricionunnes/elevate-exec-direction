import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, Loader2, Smartphone, Maximize, Minimize } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SlideRenderer } from "@/components/slide-generator/SlideRenderer";
import QRCodeLib from "qrcode";
import { toast } from "sonner";

interface SlideItem {
  id: string;
  slide_type: string;
  title: string | null;
  subtitle: string | null;
  content: any;
  speaker_notes: string | null;
  layout_type: string | null;
  sort_order: number;
}

export default function PublicPresentationPage() {
  const { token } = useParams<{ token: string }>();
  const [slides, setSlides] = useState<SlideItem[]>([]);
  const [presentationId, setPresentationId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scale, setScale] = useState(0.5);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchRef = useRef(0);

  // Fullscreen
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fullscreenRef = useRef<HTMLDivElement>(null);

  // Remote control
  const [remoteCode, setRemoteCode] = useState<string | null>(null);
  const [remoteQr, setRemoteQr] = useState<string | null>(null);
  const [showRemote, setShowRemote] = useState(false);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      try {
        const { data: pres, error: presErr } = await supabase
          .from("slide_presentations")
          .select("id, title")
          .eq("public_share_token", token)
          .eq("is_public", true)
          .maybeSingle();

        if (presErr || !pres) {
          setError("Apresentação não encontrada ou não está pública.");
          setLoading(false);
          return;
        }

        setTitle(pres.title);
        setPresentationId(pres.id);

        const { data: slideData } = await supabase
          .from("slide_items")
          .select("*")
          .eq("presentation_id", pres.id)
          .order("sort_order");

        setSlides((slideData as unknown as SlideItem[]) || []);
      } catch {
        setError("Erro ao carregar apresentação.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  // Calculate scale
  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        const w = containerRef.current.offsetWidth;
        const h = containerRef.current.offsetHeight;
        setScale(Math.min(w / 1920, h / 1080));
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [loading]);

  // Keyboard nav
  const goNext = useCallback(() => setCurrentIndex((i) => Math.min(i + 1, slides.length - 1)), [slides.length]);
  const goPrev = useCallback(() => setCurrentIndex((i) => Math.max(i - 1, 0)), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); goNext(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev]);

  // Start remote control
  const startRemote = async () => {
    if (!presentationId) return;
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      await supabase.from("slide_remote_sessions").insert({
        presentation_id: presentationId,
        session_code: code,
        current_slide: currentIndex,
      } as any);

      setRemoteCode(code);
      const url = `https://elevate-exec-direction.lovable.app/#/slide-remote/${code}`;
      const qr = await QRCodeLib.toDataURL(url, { width: 300, margin: 2 });
      setRemoteQr(qr);
      setShowRemote(true);
      toast.success("Controle remoto criado!");
    } catch {
      toast.error("Erro ao criar controle remoto");
    }
  };

  // Listen for remote commands
  useEffect(() => {
    if (!remoteCode) return;
    const channel = supabase
      .channel(`pub-remote-${remoteCode}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "slide_remote_sessions",
          filter: `session_code=eq.${remoteCode}`,
        },
        (payload: any) => {
          if (payload.new.current_slide !== undefined) {
            setCurrentIndex(payload.new.current_slide);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [remoteCode]);

  // Sync remote session when slide changes
  useEffect(() => {
    if (!remoteCode) return;
    supabase
      .from("slide_remote_sessions")
      .update({ current_slide: currentIndex, updated_at: new Date().toISOString() } as any)
      .eq("session_code", remoteCode)
      .then();
  }, [currentIndex, remoteCode]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A1931] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white/50" />
      </div>
    );
  }

  if (error || slides.length === 0) {
    return (
      <div className="min-h-screen bg-[#0A1931] flex items-center justify-center text-center px-4">
        <div>
          <Smartphone className="h-12 w-12 text-white/30 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Apresentação Indisponível</h1>
          <p className="text-white/60 text-sm">{error || "Nenhum slide encontrado."}</p>
        </div>
      </div>
    );
  }

  const currentSlide = slides[currentIndex];

  return (
    <div
      className="min-h-screen bg-[#0A1931] flex flex-col select-none"
      onTouchStart={(e) => { touchRef.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - touchRef.current;
        if (dx < -50) goNext();
        if (dx > 50) goPrev();
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-black/30">
        <h1 className="text-white/80 text-xs font-medium truncate flex-1">{title}</h1>
        <div className="flex items-center gap-1.5 ml-2">
          <span className="text-white/50 text-xs">{currentIndex + 1}/{slides.length}</span>
          <button
            onClick={startRemote}
            className="flex items-center gap-1 px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white/70 hover:text-white text-[10px] transition-colors"
            title="Controle Remoto"
          >
            <Smartphone className="h-3 w-3" />
            <span className="hidden sm:inline">Remoto</span>
          </button>
        </div>
      </div>

      {/* Remote control overlay */}
      {showRemote && remoteQr && remoteCode && (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={() => setShowRemote(false)}>
          <div className="bg-[#0A1931] border border-white/10 rounded-xl p-6 max-w-xs text-center" onClick={(e) => e.stopPropagation()}>
            <Smartphone className="h-6 w-6 text-[#C81E1E] mx-auto mb-2" />
            <p className="text-white text-sm font-semibold mb-1">Controle Remoto</p>
            <p className="text-white/50 text-xs mb-3">Escaneie o QR Code no celular</p>
            <div className="bg-white rounded-lg p-2 inline-block mb-3">
              <img src={remoteQr} alt="QR" className="w-40 h-40" />
            </div>
            <div className="bg-white/10 rounded-lg px-3 py-2 mb-3">
              <span className="text-lg font-mono font-bold text-white tracking-widest">{remoteCode}</span>
            </div>
            <button
              onClick={() => {
                const url = `https://elevate-exec-direction.lovable.app/#/slide-remote/${remoteCode}`;
                navigator.clipboard.writeText(url);
                toast.success("Link copiado!");
              }}
              className="text-xs text-[#C81E1E] hover:underline"
            >
              Copiar link
            </button>
          </div>
        </div>
      )}

      {/* Slide */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center relative overflow-hidden"
        onClick={goNext}
      >
        {currentIndex > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-2 z-10 text-white/40 hover:text-white hover:bg-white/10 h-12 w-12"
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
        )}
        {currentIndex < slides.length - 1 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 z-10 text-white/40 hover:text-white hover:bg-white/10 h-12 w-12"
            onClick={(e) => { e.stopPropagation(); goNext(); }}
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        )}

        {currentSlide && (
          <div className="rounded-lg overflow-hidden shadow-2xl">
            <SlideRenderer slide={currentSlide} scale={scale} />
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-white/10">
        <div
          className="h-full bg-[#C81E1E] transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / slides.length) * 100}%` }}
        />
      </div>
    </div>
  );
}
