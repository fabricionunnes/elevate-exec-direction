import { useState } from "react";
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
import { Save, X, Plus, Trash2 } from "lucide-react";
import type { PresentationSlide, SlideContent } from "./types";

interface SlideEditorProps {
  slide: PresentationSlide;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (slideId: string, updates: { title?: string; subtitle?: string; content: SlideContent }) => Promise<void>;
  saving?: boolean;
}

export function SlideEditor({
  slide,
  open,
  onOpenChange,
  onSave,
  saving = false,
}: SlideEditorProps) {
  const [title, setTitle] = useState(slide.title || "");
  const [subtitle, setSubtitle] = useState(slide.subtitle || "");
  const [bullets, setBullets] = useState<string[]>(slide.content?.bullets || []);
  const [text, setText] = useState(slide.content?.text || "");
  const [question, setQuestion] = useState(slide.content?.question || "");
  const [options, setOptions] = useState<string[]>(slide.content?.options || []);
  const [highlight, setHighlight] = useState(slide.content?.highlight || "");
  const [metricValue, setMetricValue] = useState(slide.content?.metric_value || "");
  const [metricLabel, setMetricLabel] = useState(slide.content?.metric_label || "");

  const handleSave = async () => {
    const content: SlideContent = {
      bullets: bullets.filter(b => b.trim()),
      text: text || undefined,
      question: question || undefined,
      options: options.filter(o => o.trim()),
      highlight: highlight || undefined,
      metric_value: metricValue || undefined,
      metric_label: metricLabel || undefined,
    };

    await onSave(slide.id, {
      title: title || undefined,
      subtitle: subtitle || undefined,
      content,
    });
    onOpenChange(false);
  };

  const addBullet = () => setBullets([...bullets, ""]);
  const removeBullet = (index: number) => setBullets(bullets.filter((_, i) => i !== index));
  const updateBullet = (index: number, value: string) => {
    const updated = [...bullets];
    updated[index] = value;
    setBullets(updated);
  };

  const addOption = () => setOptions([...options, ""]);
  const removeOption = (index: number) => setOptions(options.filter((_, i) => i !== index));
  const updateOption = (index: number, value: string) => {
    const updated = [...options];
    updated[index] = value;
    setOptions(updated);
  };

  const isInteractive = slide.is_interactive;
  const isCover = slide.slide_type === "cover";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Editar Slide {slide.slide_number}
            <span className="text-sm font-normal text-muted-foreground">
              ({slide.slide_type})
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="slide-title">Título</Label>
            <Input
              id="slide-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título do slide"
            />
          </div>

          {/* Subtitle */}
          {!isCover && (
            <div className="space-y-2">
              <Label htmlFor="slide-subtitle">Subtítulo</Label>
              <Input
                id="slide-subtitle"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Subtítulo (opcional)"
              />
            </div>
          )}

          {/* Content based on slide type */}
          {isInteractive ? (
            <>
              {/* Question for interactive slides */}
              <div className="space-y-2">
                <Label htmlFor="slide-question">Pergunta / Reflexão</Label>
                <Textarea
                  id="slide-question"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Pergunta estratégica ou ponto de reflexão"
                  rows={2}
                />
              </div>

              {/* Highlight */}
              <div className="space-y-2">
                <Label htmlFor="slide-highlight">Destaque</Label>
                <Input
                  id="slide-highlight"
                  value={highlight}
                  onChange={(e) => setHighlight(e.target.value)}
                  placeholder="Frase ou número em destaque"
                />
              </div>

              {/* Metric */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="slide-metric-value">Valor da Métrica</Label>
                  <Input
                    id="slide-metric-value"
                    value={metricValue}
                    onChange={(e) => setMetricValue(e.target.value)}
                    placeholder="Ex: R$ 1.2M"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slide-metric-label">Legenda da Métrica</Label>
                  <Input
                    id="slide-metric-label"
                    value={metricLabel}
                    onChange={(e) => setMetricLabel(e.target.value)}
                    placeholder="Ex: Faturamento Mensal"
                  />
                </div>
              </div>

              {/* Options */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Opções (para slides de decisão)</Label>
                  <Button type="button" variant="ghost" size="sm" onClick={addOption}>
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar
                  </Button>
                </div>
                <div className="space-y-2">
                  {options.map((option, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={option}
                        onChange={(e) => updateOption(index, e.target.value)}
                        placeholder={`Opção ${index + 1}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeOption(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Bullets for content slides */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Tópicos</Label>
                  <Button type="button" variant="ghost" size="sm" onClick={addBullet}>
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar
                  </Button>
                </div>
                <div className="space-y-2">
                  {bullets.map((bullet, index) => (
                    <div key={index} className="flex gap-2">
                      <div className="flex items-center justify-center w-6 h-9 text-sm font-medium text-muted-foreground">
                        {index + 1}.
                      </div>
                      <Input
                        value={bullet}
                        onChange={(e) => updateBullet(index, e.target.value)}
                        placeholder={`Tópico ${index + 1}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeBullet(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Additional text */}
              <div className="space-y-2">
                <Label htmlFor="slide-text">Texto Adicional</Label>
                <Textarea
                  id="slide-text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Texto adicional para o slide (opcional)"
                  rows={3}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
