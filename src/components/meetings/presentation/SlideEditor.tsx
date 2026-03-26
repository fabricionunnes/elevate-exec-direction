import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Save, X, Plus, Trash2, ImagePlus, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { PresentationSlide, SlideContent, SlideMediaItem } from "./types";
import { DraggableMediaItem } from "./DraggableMediaItem";

interface SlideEditorProps {
  slide: PresentationSlide;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (slideId: string, updates: { title?: string; subtitle?: string; content: SlideContent }) => Promise<void>;
  saving?: boolean;
}

export function SlideEditor({ slide, open, onOpenChange, onSave, saving = false }: SlideEditorProps) {
  const [title, setTitle] = useState(slide.title || "");
  const [subtitle, setSubtitle] = useState(slide.subtitle || "");
  const [bullets, setBullets] = useState<string[]>(slide.content?.bullets || []);
  const [text, setText] = useState(slide.content?.text || "");
  const [question, setQuestion] = useState(slide.content?.question || "");
  const [options, setOptions] = useState<string[]>(slide.content?.options || []);
  const [highlight, setHighlight] = useState(slide.content?.highlight || "");
  const [metricValue, setMetricValue] = useState(slide.content?.metric_value || "");
  const [metricLabel, setMetricLabel] = useState(slide.content?.metric_label || "");
  const [mediaItems, setMediaItems] = useState<SlideMediaItem[]>(slide.content?.media_items || []);
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload file to storage
  const uploadFile = useCallback(async (file: File): Promise<string | null> => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `slides/${slide.version_id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("slide-media").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("slide-media").getPublicUrl(path);
      return urlData.publicUrl;
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Erro ao fazer upload do arquivo");
      return null;
    } finally {
      setUploading(false);
    }
  }, [slide.version_id]);

  // Add media from file
  const addMediaFromFile = useCallback(async (file: File) => {
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isImage && !isVideo) {
      toast.error("Formato não suportado. Use imagens ou vídeos.");
      return;
    }
    const url = await uploadFile(file);
    if (!url) return;

    const newItem: SlideMediaItem = {
      id: crypto.randomUUID(),
      type: isVideo ? "video" : "image",
      url,
      x: 10,
      y: 10,
      width: 30,
      height: 30,
    };
    setMediaItems((prev) => [...prev, newItem]);
    setSelectedMediaId(newItem.id);
  }, [uploadFile]);

  // Handle paste
  useEffect(() => {
    if (!open) return;

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/") || item.type.startsWith("video/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) await addMediaFromFile(file);
          return;
        }
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [open, addMediaFromFile]);

  // Handle file input change
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      await addMediaFromFile(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Update media item
  const updateMediaItem = useCallback((id: string, updates: Partial<SlideMediaItem>) => {
    setMediaItems((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)));
  }, []);

  // Remove media item
  const removeMediaItem = useCallback((id: string) => {
    setMediaItems((prev) => prev.filter((m) => m.id !== id));
    if (selectedMediaId === id) setSelectedMediaId(null);
  }, [selectedMediaId]);

  const handleSave = async () => {
    const content: SlideContent = {
      bullets: bullets.filter((b) => b.trim()),
      text: text || undefined,
      question: question || undefined,
      options: options.filter((o) => o.trim()),
      highlight: highlight || undefined,
      metric_value: metricValue || undefined,
      metric_label: metricLabel || undefined,
      media_items: mediaItems.length > 0 ? mediaItems : undefined,
    };
    await onSave(slide.id, { title: title || undefined, subtitle: subtitle || undefined, content });
    onOpenChange(false);
  };

  const addBullet = () => setBullets([...bullets, ""]);
  const removeBullet = (i: number) => setBullets(bullets.filter((_, idx) => idx !== i));
  const updateBullet = (i: number, v: string) => { const u = [...bullets]; u[i] = v; setBullets(u); };

  const addOption = () => setOptions([...options, ""]);
  const removeOption = (i: number) => setOptions(options.filter((_, idx) => idx !== i));
  const updateOption = (i: number, v: string) => { const u = [...options]; u[i] = v; setOptions(u); };

  const isInteractive = slide.is_interactive;
  const isCover = slide.slide_type === "cover";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Editar Slide {slide.slide_number}
            <span className="text-sm font-normal text-muted-foreground">({slide.slide_type})</span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 py-4">
          {/* Left: Media Canvas */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Mídia do Slide</Label>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus className="h-4 w-4 mr-1" />
                  {uploading ? "Enviando..." : "Adicionar"}
                </Button>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />

            {/* Canvas area */}
            <div
              ref={canvasRef}
              className="relative aspect-video bg-muted/50 border-2 border-dashed border-border rounded-lg overflow-hidden"
              onClick={() => setSelectedMediaId(null)}
            >
              {mediaItems.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground text-xs gap-1">
                  <ImagePlus className="h-8 w-8 opacity-40" />
                  <span>Clique em "Adicionar" ou cole (Ctrl+V) uma imagem/vídeo</span>
                </div>
              )}

              {mediaItems.map((item) => (
                <DraggableMediaItem
                  key={item.id}
                  item={item}
                  containerRef={canvasRef as React.RefObject<HTMLDivElement>}
                  onUpdate={updateMediaItem}
                  onRemove={removeMediaItem}
                  selected={selectedMediaId === item.id}
                  onSelect={() => setSelectedMediaId(item.id)}
                />
              ))}
            </div>

            {mediaItems.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Arraste para mover • Canto inferior direito para redimensionar • X para remover
              </p>
            )}
          </div>

          {/* Right: Text fields */}
          <div className="space-y-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="slide-title">Título</Label>
              <Input id="slide-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título do slide" />
            </div>

            {/* Subtitle */}
            {!isCover && (
              <div className="space-y-2">
                <Label htmlFor="slide-subtitle">Subtítulo</Label>
                <Input id="slide-subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Subtítulo (opcional)" />
              </div>
            )}

            {isInteractive ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="slide-question">Pergunta / Reflexão</Label>
                  <Textarea id="slide-question" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Pergunta estratégica" rows={2} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slide-highlight">Destaque</Label>
                  <Input id="slide-highlight" value={highlight} onChange={(e) => setHighlight(e.target.value)} placeholder="Frase ou número em destaque" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Valor da Métrica</Label>
                    <Input value={metricValue} onChange={(e) => setMetricValue(e.target.value)} placeholder="Ex: R$ 1.2M" />
                  </div>
                  <div className="space-y-2">
                    <Label>Legenda da Métrica</Label>
                    <Input value={metricLabel} onChange={(e) => setMetricLabel(e.target.value)} placeholder="Ex: Faturamento" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Opções</Label>
                    <Button type="button" variant="ghost" size="sm" onClick={addOption}><Plus className="h-4 w-4 mr-1" />Adicionar</Button>
                  </div>
                  {options.map((opt, i) => (
                    <div key={i} className="flex gap-2">
                      <Input value={opt} onChange={(e) => updateOption(i, e.target.value)} placeholder={`Opção ${i + 1}`} />
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeOption(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Tópicos</Label>
                    <Button type="button" variant="ghost" size="sm" onClick={addBullet}><Plus className="h-4 w-4 mr-1" />Adicionar</Button>
                  </div>
                  {bullets.map((bullet, i) => (
                    <div key={i} className="flex gap-2">
                      <div className="flex items-center justify-center w-6 h-9 text-sm font-medium text-muted-foreground">{i + 1}.</div>
                      <Input value={bullet} onChange={(e) => updateBullet(i, e.target.value)} placeholder={`Tópico ${i + 1}`} />
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeBullet(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slide-text">Texto Adicional</Label>
                  <Textarea id="slide-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Texto adicional (opcional)" rows={3} />
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}><X className="h-4 w-4 mr-2" />Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || uploading}><Save className="h-4 w-4 mr-2" />{saving ? "Salvando..." : "Salvar Alterações"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
