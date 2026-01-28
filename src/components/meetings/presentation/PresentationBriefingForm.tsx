import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Loader2, Save } from "lucide-react";
import type {
  PresentationBriefing,
  MeetingObjective,
  MeetingAudience,
  MeetingDepthLevel,
  PresentationTone,
  MeetingPresentation,
} from "./types";
import {
  OBJECTIVE_LABELS,
  AUDIENCE_LABELS,
  DEPTH_LABELS,
  TONE_LABELS,
} from "./types";

interface PresentationBriefingFormProps {
  presentation: MeetingPresentation | null;
  onGenerate: (briefing: PresentationBriefing) => Promise<void>;
  onSave: (briefing: PresentationBriefing) => Promise<string | null>;
  generating: boolean;
  saving: boolean;
}

export function PresentationBriefingForm({
  presentation,
  onGenerate,
  onSave,
  generating,
  saving,
}: PresentationBriefingFormProps) {
  const [subject, setSubject] = useState("");
  const [centralTheme, setCentralTheme] = useState("");
  const [objective, setObjective] = useState<MeetingObjective>("alinhamento");
  const [audience, setAudience] = useState<MeetingAudience>("empresario");
  const [depthLevel, setDepthLevel] = useState<MeetingDepthLevel>("estrategico");
  const [duration, setDuration] = useState(60);
  const [keyMetrics, setKeyMetrics] = useState("");
  const [mustInclude, setMustInclude] = useState("");
  const [tone, setTone] = useState<PresentationTone>("consultivo");

  // Load existing data
  useEffect(() => {
    if (presentation) {
      setSubject(presentation.subject || "");
      setCentralTheme(presentation.central_theme || "");
      setObjective(presentation.objective || "alinhamento");
      setAudience(presentation.audience || "empresario");
      setDepthLevel(presentation.depth_level || "estrategico");
      setDuration(presentation.estimated_duration_minutes || 60);
      setKeyMetrics(presentation.key_metrics || "");
      setMustInclude(presentation.must_include_points || "");
      setTone(presentation.tone || "consultivo");
    }
  }, [presentation]);

  const getBriefing = (): PresentationBriefing => ({
    subject,
    central_theme: centralTheme,
    objective,
    audience,
    depth_level: depthLevel,
    estimated_duration_minutes: duration,
    key_metrics: keyMetrics || undefined,
    must_include_points: mustInclude || undefined,
    tone,
  });

  const handleGenerate = () => {
    if (!subject.trim() || !centralTheme.trim()) {
      return;
    }
    onGenerate(getBriefing());
  };

  const handleSave = () => {
    if (!subject.trim() || !centralTheme.trim()) {
      return;
    }
    onSave(getBriefing());
  };

  const isValid = subject.trim() && centralTheme.trim();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Required fields */}
        <div className="space-y-2">
          <Label htmlFor="subject">Assunto da Reunião *</Label>
          <Input
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Ex: Revisão de Metas Q1"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="theme">Tema Central *</Label>
          <Input
            id="theme"
            value={centralTheme}
            onChange={(e) => setCentralTheme(e.target.value)}
            placeholder="Ex: Estratégia de Vendas"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="objective">Objetivo da Reunião</Label>
          <Select value={objective} onValueChange={(v) => setObjective(v as MeetingObjective)}>
            <SelectTrigger id="objective">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(OBJECTIVE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="audience">Público</Label>
          <Select value={audience} onValueChange={(v) => setAudience(v as MeetingAudience)}>
            <SelectTrigger id="audience">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(AUDIENCE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="depth">Nível de Profundidade</Label>
          <Select value={depthLevel} onValueChange={(v) => setDepthLevel(v as MeetingDepthLevel)}>
            <SelectTrigger id="depth">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(DEPTH_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="duration">Duração (minutos)</Label>
          <Input
            id="duration"
            type="number"
            min={15}
            max={180}
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value) || 60)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tone">Tom da Apresentação</Label>
          <Select value={tone} onValueChange={(v) => setTone(v as PresentationTone)}>
            <SelectTrigger id="tone">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TONE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Optional fields */}
      <div className="space-y-2">
        <Label htmlFor="metrics">Dados ou Métricas Importantes (opcional)</Label>
        <Textarea
          id="metrics"
          value={keyMetrics}
          onChange={(e) => setKeyMetrics(e.target.value)}
          placeholder="Ex: Faturamento cresceu 20%, CAC diminuiu 15%..."
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="mustInclude">Pontos Obrigatórios (opcional)</Label>
        <Textarea
          id="mustInclude"
          value={mustInclude}
          onChange={(e) => setMustInclude(e.target.value)}
          placeholder="Ex: Mencionar novo produto, Apresentar cronograma..."
          rows={2}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <Button
          onClick={handleGenerate}
          disabled={!isValid || generating || saving}
          className="flex-1"
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Gerando...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Gerar Apresentação com IA
            </>
          )}
        </Button>

        <Button
          variant="outline"
          onClick={handleSave}
          disabled={!isValid || generating || saving}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
