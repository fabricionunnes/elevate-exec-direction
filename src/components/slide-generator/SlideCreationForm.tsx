import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles, Loader2, Presentation, Users, Clock, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  onCreated: (presentationId: string) => void;
  defaultTopic?: string;
}

const SUGGESTED_TOPICS = [
  "Gestão Comercial",
  "Treinamento de Vendedores",
  "Funil de Vendas",
  "Negociação Avançada",
  "Liderança Comercial",
  "Atendimento ao Cliente",
  "Estratégia Comercial",
  "Prospecção e Qualificação",
  "Técnicas de Fechamento",
  "Gestão de Equipes de Vendas",
];

export function SlideCreationForm({ onCreated, defaultTopic }: Props) {
  const [topic, setTopic] = useState(defaultTopic || "");
  const [audience, setAudience] = useState("Profissionais de vendas");
  const [duration, setDuration] = useState(30);
  const [level, setLevel] = useState("intermediario");
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast.error("Informe o tema da apresentação");
      return;
    }

    setGenerating(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        toast.error("Você precisa estar logado");
        return;
      }

      toast.info("Gerando apresentação com IA... Isso pode levar alguns segundos.");

      const { data, error } = await supabase.functions.invoke("generate-slide-presentation", {
        body: { topic, audience, duration_minutes: duration, content_level: level },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const { title, description, slides } = data;

      // Get staff_id for the current user
      const { data: staffData } = await supabase
        .from("onboarding_staff")
        .select("id")
        .eq("user_id", user.user.id)
        .eq("is_active", true)
        .maybeSingle();

      // Save presentation
      const { data: presentation, error: presError } = await supabase
        .from("slide_presentations")
        .insert({
          title: title || topic,
          description: description || "",
          topic,
          audience,
          duration_minutes: duration,
          content_level: level,
          created_by: user.user.id,
          staff_id: staffData?.id || null,
          slide_count: slides.length,
          status: "draft",
        } as any)
        .select()
        .single();

      if (presError) throw presError;

      const presId = (presentation as any).id;

      // Save slides
      if (slides?.length) {
        const slideRows = slides.map((s: any, i: number) => ({
          presentation_id: presId,
          slide_number: s.slide_number || i + 1,
          slide_type: s.slide_type || "content",
          title: s.title || "",
          subtitle: s.subtitle || null,
          content: s.content || {},
          speaker_notes: s.speaker_notes || null,
          layout_type: s.layout_type || "default",
          sort_order: i,
        }));

        const { error: slidesError } = await supabase
          .from("slide_items")
          .insert(slideRows as any);

        if (slidesError) throw slidesError;
      }

      toast.success(`Apresentação "${title}" criada com ${slides.length} slides!`);
      onCreated(presId);
    } catch (err: any) {
      console.error("Generation error:", err);
      if (err.message?.includes("Rate limit")) {
        toast.error("Limite de requisições atingido. Tente novamente em instantes.");
      } else if (err.message?.includes("credits")) {
        toast.error("Créditos de IA esgotados.");
      } else {
        toast.error("Erro ao gerar apresentação. Tente novamente.");
      }
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Nova Apresentação com IA
          </CardTitle>
          <CardDescription>
            Informe o tema e a IA criará automaticamente uma apresentação profissional completa
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Topic */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Presentation className="h-4 w-4" />
              Tema da Apresentação *
            </Label>
            <Textarea
              placeholder="Ex: Técnicas avançadas de negociação para vendas B2B"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={2}
              className="resize-none"
            />
            {/* Suggestions */}
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_TOPICS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTopic(t)}
                  className="text-xs px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Audience */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Público-Alvo
              </Label>
              <Input
                placeholder="Ex: Gerentes comerciais"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
              />
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Duração (minutos)
              </Label>
              <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="45">45 min</SelectItem>
                  <SelectItem value="60">60 min</SelectItem>
                  <SelectItem value="90">90 min</SelectItem>
                  <SelectItem value="120">120 min</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Level */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Nível do Conteúdo
              </Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="iniciante">Iniciante</SelectItem>
                  <SelectItem value="intermediario">Intermediário</SelectItem>
                  <SelectItem value="avancado">Avançado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={generating || !topic.trim()}
            size="lg"
            className="w-full gap-2"
          >
            {generating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Gerando Apresentação...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                Gerar Slides com IA
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
