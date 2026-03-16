import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { VideoCaption } from "./VideoCaptionOverlay";
import { VideoOverlay } from "./VideoOverlayLayer";
import { CaptionStyleKey } from "./CaptionStylePicker";

// Map caption styles to canvas-compatible styles
const CANVAS_CAPTION_STYLES: Record<CaptionStyleKey, {
  font: string;
  color: string;
  bgColor: string;
  borderRadius: number;
}> = {
  default: { font: "bold 42px sans-serif", color: "#ffffff", bgColor: "rgba(0,0,0,0.6)", borderRadius: 12 },
  hormozi: { font: "900 54px sans-serif", color: "#facc15", bgColor: "rgba(0,0,0,0.8)", borderRadius: 6 },
  captions: { font: "bold 48px sans-serif", color: "#ffffff", bgColor: "rgba(147,51,234,0.8)", borderRadius: 16 },
  minimal: { font: "500 38px sans-serif", color: "#ffffff", bgColor: "transparent", borderRadius: 0 },
  bold: { font: "900 54px sans-serif", color: "#ffffff", bgColor: "rgba(220,38,38,0.9)", borderRadius: 4 },
  neon: { font: "bold 48px sans-serif", color: "#4ade80", bgColor: "rgba(0,0,0,0.7)", borderRadius: 12 },
};

const BROLL_EMOJI_MAP: Record<string, string> = {
  dinheiro: "💰", money: "💰", grana: "💰", lucro: "💰", faturamento: "💰", receita: "💰",
  crescimento: "📈", growth: "📈", aumento: "📈", subir: "📈",
  equipe: "👥", team: "👥", time: "👥", pessoas: "👥",
  cliente: "🤝", clientes: "🤝", venda: "🤝", vendas: "🤝",
  estratégia: "♟️", estrategia: "♟️", plano: "♟️",
  sucesso: "🏆", resultado: "🏆", meta: "🏆",
  erro: "❌", problema: "❌",
  ideia: "💡", inovação: "💡", solução: "💡",
  tempo: "⏰", prazo: "⏰",
  tecnologia: "💻", digital: "💻",
  energia: "⚡", força: "💪", motivação: "🔥",
  atenção: "👀", foco: "🎯",
};

function getBrollEmoji(keyword: string): string {
  const lower = keyword.toLowerCase().trim();
  for (const [key, emoji] of Object.entries(BROLL_EMOJI_MAP)) {
    if (lower.includes(key)) return emoji;
  }
  return "🔹";
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

interface UseVideoRendererProps {
  cardId: string;
  onRendered?: (url: string) => void;
}

export function useVideoRenderer({ cardId, onRendered }: UseVideoRendererProps) {
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  const cancelRef = useRef(false);

  const renderVideo = useCallback(async (
    videoSrc: string,
    captions: VideoCaption[],
    overlays: VideoOverlay[],
    captionStyle: CaptionStyleKey,
  ) => {
    setRendering(true);
    setProgress(0);
    cancelRef.current = false;

    try {
      // Create offscreen video element
      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.muted = false;
      video.preload = "auto";
      video.src = videoSrc;

      await new Promise<void>((resolve, reject) => {
        video.onloadeddata = () => resolve();
        video.onerror = () => reject(new Error("Erro ao carregar vídeo"));
        setTimeout(() => reject(new Error("Timeout ao carregar vídeo")), 30000);
      });

      const w = video.videoWidth;
      const h = video.videoHeight;
      const dur = video.duration;

      if (!w || !h || !dur) throw new Error("Vídeo inválido");

      // Canvas for compositing
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;

      // Capture streams
      const canvasStream = canvas.captureStream(30);

      // Add audio track from the video
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaElementSource(video);
      const dest = audioCtx.createMediaStreamDestination();
      source.connect(dest);
      source.connect(audioCtx.destination); // also play locally so MediaRecorder captures it

      const audioTrack = dest.stream.getAudioTracks()[0];
      if (audioTrack) {
        canvasStream.addTrack(audioTrack);
      }

      // MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
        ? "video/webm;codecs=vp8,opus"
        : "video/webm";

      const recorder = new MediaRecorder(canvasStream, {
        mimeType,
        videoBitsPerSecond: 5_000_000,
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const recordingDone = new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          resolve(new Blob(chunks, { type: mimeType }));
        };
      });

      recorder.start(100);

      // Draw loop
      const drawFrame = () => {
        if (cancelRef.current) return;
        const t = video.currentTime;

        // Draw video frame
        ctx.drawImage(video, 0, 0, w, h);

        // Draw overlays
        drawOverlays(ctx, overlays, t, w, h, dur);

        // Draw captions
        drawCaptions(ctx, captions, t, w, h, captionStyle);

        setProgress(Math.min(100, Math.round((t / dur) * 100)));

        if (!video.ended && !video.paused) {
          requestAnimationFrame(drawFrame);
        }
      };

      video.onended = () => {
        recorder.stop();
        audioCtx.close();
      };

      video.currentTime = 0;
      await video.play();
      drawFrame();

      const blob = await recordingDone;

      if (cancelRef.current) {
        setRendering(false);
        return;
      }

      // Upload to storage
      setProgress(95);
      const fileName = `edited_${cardId}_${Date.now()}.webm`;
      const filePath = `social-creatives/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("social-creatives")
        .upload(filePath, blob, {
          contentType: "video/webm",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("social-creatives")
        .getPublicUrl(filePath);

      // Update the card's creative_url
      const { error: updateError } = await supabase
        .from("social_content_cards")
        .update({
          creative_url: publicUrl,
          creative_type: "video",
        })
        .eq("id", cardId);

      if (updateError) throw updateError;

      setProgress(100);
      toast.success("Vídeo renderizado e salvo com sucesso!");
      onRendered?.(publicUrl);
    } catch (err) {
      console.error("Video render error:", err);
      toast.error(err instanceof Error ? err.message : "Erro ao renderizar vídeo");
    } finally {
      setRendering(false);
    }
  }, [cardId, onRendered]);

  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  return { renderVideo, rendering, progress, cancel };
}

// --- Canvas drawing helpers ---

function drawOverlays(
  ctx: CanvasRenderingContext2D,
  overlays: VideoOverlay[],
  currentTime: number,
  w: number,
  h: number,
  duration: number,
) {
  const active = overlays.filter(
    (o) => currentTime >= o.start_time && currentTime <= o.end_time
  );

  for (const overlay of active) {
    const progress = Math.min(1, (currentTime - overlay.start_time) / Math.max(0.1, overlay.end_time - overlay.start_time));
    const opacity = progress < 0.1 ? progress / 0.1 : progress > 0.85 ? (1 - progress) / 0.15 : 1;

    ctx.save();
    ctx.globalAlpha = opacity;

    switch (overlay.overlay_type) {
      case "headline": {
        const text = overlay.content.toUpperCase();
        const fontSize = Math.round(w * 0.05);
        ctx.font = `900 ${fontSize}px sans-serif`;
        const textWidth = ctx.measureText(text).width;
        const padX = fontSize * 0.8;
        const padY = fontSize * 0.4;
        const boxW = textWidth + padX * 2;
        const boxH = fontSize + padY * 2;
        const x = (w - boxW) / 2;
        const y = (overlay.y / 100) * h;

        // Gradient bg
        const grad = ctx.createLinearGradient(x, y, x + boxW, y);
        grad.addColorStop(0, "rgba(220,38,38,0.95)");
        grad.addColorStop(1, "rgba(249,115,22,0.95)");
        drawRoundedRect(ctx, x, y, boxW, boxH, 10);
        ctx.fillStyle = grad;
        ctx.fill();

        // Shadow
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 12;

        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, w / 2, y + boxH / 2);
        ctx.shadowBlur = 0;
        break;
      }

      case "text_highlight": {
        const fontSize = Math.round(w * 0.035);
        ctx.font = `bold ${fontSize}px sans-serif`;
        const text = overlay.content;
        const textWidth = ctx.measureText(text).width;
        const padX = fontSize * 0.6;
        const padY = fontSize * 0.35;
        const boxW = textWidth + padX * 2;
        const boxH = fontSize + padY * 2;
        const x = (overlay.x / 100) * w - boxW / 2;
        const y = (overlay.y / 100) * h - boxH / 2;

        drawRoundedRect(ctx, x, y, boxW, boxH, 6);
        ctx.fillStyle = "rgba(0,0,0,0.8)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, (overlay.x / 100) * w, (overlay.y / 100) * h);
        break;
      }

      case "zoom_cue": {
        const scale = 1 + 0.08 * Math.sin(progress * Math.PI);
        // We can't truly zoom in a canvas draw, but we can simulate with a vignette + slight scale
        const vignetteAlpha = 0.08 * Math.sin(progress * Math.PI);
        const gradient = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.7);
        gradient.addColorStop(0, "rgba(255,255,255,0)");
        gradient.addColorStop(1, `rgba(255,255,255,${vignetteAlpha})`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
        break;
      }

      case "broll_keyword": {
        const emoji = getBrollEmoji(overlay.content);
        const emojiSize = Math.round(w * 0.06);
        const labelSize = Math.round(w * 0.022);
        const cx = (overlay.x / 100) * w;
        const cy = (overlay.y / 100) * h;
        const boxW = w * 0.2;
        const boxH = h * 0.12;
        const bx = cx - boxW / 2;
        const by = cy - boxH / 2;

        drawRoundedRect(ctx, bx, by, boxW, boxH, 14);
        ctx.fillStyle = "rgba(255,255,255,0.1)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = `${emojiSize}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(emoji, cx, cy - labelSize * 0.5);

        ctx.font = `600 ${labelSize}px sans-serif`;
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.fillText(overlay.content.toUpperCase(), cx, cy + emojiSize * 0.5);
        break;
      }

      default: {
        // emoji overlay
        const fontSize = Math.max(24, Math.round(32 * overlay.scale * (w / 400)));
        ctx.font = `${fontSize}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(overlay.content, (overlay.x / 100) * w, (overlay.y / 100) * h);
        break;
      }
    }

    ctx.restore();
  }
}

function drawCaptions(
  ctx: CanvasRenderingContext2D,
  captions: VideoCaption[],
  currentTime: number,
  w: number,
  h: number,
  styleKey: CaptionStyleKey,
) {
  const activeCaption = captions.find(
    (c) => currentTime >= c.start_time && currentTime <= c.end_time
  );
  if (!activeCaption) return;

  const style = CANVAS_CAPTION_STYLES[styleKey] || CANVAS_CAPTION_STYLES.default;
  const scaledFontSize = Math.round(w * 0.04);
  const font = style.font.replace(/\d+px/, `${scaledFontSize}px`);

  ctx.save();
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const maxTextWidth = w * 0.85;
  const lines = wrapText(ctx, activeCaption.text, maxTextWidth);
  const lineHeight = scaledFontSize * 1.3;
  const totalTextHeight = lines.length * lineHeight;
  const padX = scaledFontSize * 0.6;
  const padY = scaledFontSize * 0.35;

  const boxW = Math.min(maxTextWidth + padX * 2, w * 0.9);
  const boxH = totalTextHeight + padY * 2;
  const boxX = (w - boxW) / 2;
  const boxY = h * 0.88 - boxH;

  // Background
  if (style.bgColor !== "transparent") {
    drawRoundedRect(ctx, boxX, boxY, boxW, boxH, style.borderRadius);
    ctx.fillStyle = style.bgColor;
    ctx.fill();
  }

  // Text
  ctx.fillStyle = style.color;
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 4;

  lines.forEach((line, i) => {
    const y = boxY + padY + lineHeight * 0.5 + i * lineHeight;
    ctx.fillText(line, w / 2, y);
  });

  ctx.restore();
}
