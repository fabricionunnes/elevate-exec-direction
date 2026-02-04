import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Save, 
  Loader2, 
  CheckCircle2,
  Building2,
  Target,
  Users,
  MessageSquare,
  Palette,
  Megaphone,
  Camera,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  projectId: string;
  onComplete?: () => void;
}

interface BriefingForm {
  // Basic Info
  business_description: string;
  target_audience: string;
  main_products_services: string;
  brand_differentials: string;
  
  // Digital Presence
  instagram_handle: string;
  instagram_followers: string;
  current_posting_frequency: string;
  content_types_used: string[];
  
  // Objectives
  primary_objective: string;
  secondary_objectives: string[];
  growth_goals: string;
  sales_goals: string;
  
  // Brand & Communication
  brand_personality: string[];
  tone_of_voice: string;
  words_to_use: string;
  words_to_avoid: string;
  visual_references: string;
  
  // Competition
  main_competitors: string;
  competitor_strengths: string;
  competitor_weaknesses: string;
  
  // Audience
  audience_age_range: string;
  audience_gender: string;
  audience_location: string;
  audience_interests: string;
  audience_pain_points: string;
  audience_objections: string;
  
  // Content
  content_pillars: string;
  topics_to_cover: string;
  topics_to_avoid: string;
  cta_preferences: string;
  
  // Resources
  has_product_photos: boolean;
  has_team_photos: boolean;
  has_behind_scenes_access: boolean;
  preferred_content_formats: string[];
}

const defaultForm: BriefingForm = {
  business_description: "",
  target_audience: "",
  main_products_services: "",
  brand_differentials: "",
  instagram_handle: "",
  instagram_followers: "",
  current_posting_frequency: "",
  content_types_used: [],
  primary_objective: "",
  secondary_objectives: [],
  growth_goals: "",
  sales_goals: "",
  brand_personality: [],
  tone_of_voice: "",
  words_to_use: "",
  words_to_avoid: "",
  visual_references: "",
  main_competitors: "",
  competitor_strengths: "",
  competitor_weaknesses: "",
  audience_age_range: "",
  audience_gender: "",
  audience_location: "",
  audience_interests: "",
  audience_pain_points: "",
  audience_objections: "",
  content_pillars: "",
  topics_to_cover: "",
  topics_to_avoid: "",
  cta_preferences: "",
  has_product_photos: false,
  has_team_photos: false,
  has_behind_scenes_access: false,
  preferred_content_formats: [],
};

const contentTypes = [
  "Fotos de produtos",
  "Reels educativos",
  "Carrosséis",
  "Stories interativos",
  "Lives",
  "Depoimentos",
  "Bastidores",
  "Memes/humor",
];

const personalities = [
  "Profissional",
  "Descontraído",
  "Inspirador",
  "Educativo",
  "Humorístico",
  "Luxuoso",
  "Acessível",
  "Inovador",
  "Tradicional",
  "Jovem",
];

const objectives = [
  "Aumentar seguidores",
  "Gerar leads",
  "Aumentar vendas",
  "Construir autoridade",
  "Engajar comunidade",
  "Lançar produto",
  "Fortalecer marca",
  "Educar público",
];

const contentFormats = [
  "Feed estático",
  "Carrossel",
  "Reels",
  "Stories",
  "Lives",
  "IGTV",
];

export const SocialBriefingTab = ({ projectId, onComplete }: Props) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<BriefingForm>(defaultForm);
  const [briefingId, setBriefingId] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    loadBriefing();
  }, [projectId]);

  const loadBriefing = async () => {
    try {
      const { data, error } = await supabase
        .from("social_briefing_forms")
        .select("*")
        .eq("project_id", projectId)
        .single();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        setBriefingId(data.id);
        setIsComplete(data.is_complete || false);
        setForm({
          business_description: data.business_description || "",
          target_audience: data.target_audience || "",
          main_products_services: data.main_products_services || "",
          brand_differentials: data.brand_differentials || "",
          instagram_handle: data.instagram_handle || "",
          instagram_followers: data.instagram_followers?.toString() || "",
          current_posting_frequency: data.current_posting_frequency || "",
          content_types_used: data.content_types_used || [],
          primary_objective: data.primary_objective || "",
          secondary_objectives: data.secondary_objectives || [],
          growth_goals: data.growth_goals || "",
          sales_goals: data.sales_goals || "",
          brand_personality: data.brand_personality || [],
          tone_of_voice: data.tone_of_voice || "",
          words_to_use: (data.words_to_use || []).join(", "),
          words_to_avoid: (data.words_to_avoid || []).join(", "),
          visual_references: data.visual_references || "",
          main_competitors: JSON.stringify(data.main_competitors || []),
          competitor_strengths: data.competitor_strengths || "",
          competitor_weaknesses: data.competitor_weaknesses || "",
          audience_age_range: data.audience_age_range || "",
          audience_gender: data.audience_gender || "",
          audience_location: data.audience_location || "",
          audience_interests: (data.audience_interests || []).join(", "),
          audience_pain_points: (data.audience_pain_points || []).join("\n"),
          audience_objections: (data.audience_objections || []).join("\n"),
          content_pillars: (data.content_pillars || []).join(", "),
          topics_to_cover: (data.topics_to_cover || []).join(", "),
          topics_to_avoid: (data.topics_to_avoid || []).join(", "),
          cta_preferences: (data.cta_preferences || []).join(", "),
          has_product_photos: data.has_product_photos || false,
          has_team_photos: data.has_team_photos || false,
          has_behind_scenes_access: data.has_behind_scenes_access || false,
          preferred_content_formats: data.preferred_content_formats || [],
        });
      }
    } catch (error) {
      console.error("Error loading briefing:", error);
      toast.error("Erro ao carregar briefing");
    } finally {
      setLoading(false);
    }
  };

  const calculateProgress = (): number => {
    const requiredFields = [
      form.business_description,
      form.target_audience,
      form.primary_objective,
      form.brand_personality.length > 0,
      form.tone_of_voice,
      form.audience_pain_points,
    ];
    const filled = requiredFields.filter(Boolean).length;
    return Math.round((filled / requiredFields.length) * 100);
  };

  const handleSave = async (markComplete = false) => {
    setSaving(true);
    try {
      const payload = {
        project_id: projectId,
        business_description: form.business_description || null,
        target_audience: form.target_audience || null,
        main_products_services: form.main_products_services || null,
        brand_differentials: form.brand_differentials || null,
        instagram_handle: form.instagram_handle || null,
        instagram_followers: form.instagram_followers ? parseInt(form.instagram_followers) : null,
        current_posting_frequency: form.current_posting_frequency || null,
        content_types_used: form.content_types_used.length > 0 ? form.content_types_used : null,
        primary_objective: form.primary_objective || null,
        secondary_objectives: form.secondary_objectives.length > 0 ? form.secondary_objectives : null,
        growth_goals: form.growth_goals || null,
        sales_goals: form.sales_goals || null,
        brand_personality: form.brand_personality.length > 0 ? form.brand_personality : null,
        tone_of_voice: form.tone_of_voice || null,
        words_to_use: form.words_to_use ? form.words_to_use.split(",").map(w => w.trim()).filter(Boolean) : null,
        words_to_avoid: form.words_to_avoid ? form.words_to_avoid.split(",").map(w => w.trim()).filter(Boolean) : null,
        visual_references: form.visual_references || null,
        main_competitors: form.main_competitors ? JSON.parse(form.main_competitors || "[]") : null,
        competitor_strengths: form.competitor_strengths || null,
        competitor_weaknesses: form.competitor_weaknesses || null,
        audience_age_range: form.audience_age_range || null,
        audience_gender: form.audience_gender || null,
        audience_location: form.audience_location || null,
        audience_interests: form.audience_interests ? form.audience_interests.split(",").map(i => i.trim()).filter(Boolean) : null,
        audience_pain_points: form.audience_pain_points ? form.audience_pain_points.split("\n").map(p => p.trim()).filter(Boolean) : null,
        audience_objections: form.audience_objections ? form.audience_objections.split("\n").map(o => o.trim()).filter(Boolean) : null,
        content_pillars: form.content_pillars ? form.content_pillars.split(",").map(c => c.trim()).filter(Boolean) : null,
        topics_to_cover: form.topics_to_cover ? form.topics_to_cover.split(",").map(t => t.trim()).filter(Boolean) : null,
        topics_to_avoid: form.topics_to_avoid ? form.topics_to_avoid.split(",").map(t => t.trim()).filter(Boolean) : null,
        cta_preferences: form.cta_preferences ? form.cta_preferences.split(",").map(c => c.trim()).filter(Boolean) : null,
        has_product_photos: form.has_product_photos,
        has_team_photos: form.has_team_photos,
        has_behind_scenes_access: form.has_behind_scenes_access,
        preferred_content_formats: form.preferred_content_formats.length > 0 ? form.preferred_content_formats : null,
        is_complete: markComplete,
        completed_at: markComplete ? new Date().toISOString() : null,
      };

      if (briefingId) {
        const { error } = await supabase
          .from("social_briefing_forms")
          .update(payload)
          .eq("id", briefingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("social_briefing_forms")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        setBriefingId(data.id);
      }

      if (markComplete) {
        setIsComplete(true);
        onComplete?.();
        toast.success("Briefing finalizado! Agora você pode gerar análises estratégicas.");
      } else {
        toast.success("Briefing salvo!");
      }
    } catch (error) {
      console.error("Error saving briefing:", error);
      toast.error("Erro ao salvar briefing");
    } finally {
      setSaving(false);
    }
  };

  const updateForm = (key: keyof BriefingForm, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const toggleArrayItem = (key: keyof BriefingForm, item: string) => {
    const current = form[key] as string[];
    const updated = current.includes(item) 
      ? current.filter(i => i !== item)
      : [...current, item];
    updateForm(key, updated);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const progress = calculateProgress();

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            Briefing | Social Media
            {isComplete && <CheckCircle2 className="h-6 w-6 text-green-500" />}
          </h2>
          <p className="text-muted-foreground">
            Preencha todas as informações para gerar análises estratégicas com IA
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Progresso</p>
            <p className="text-2xl font-bold">{progress}%</p>
          </div>
          <Progress value={progress} className="w-32" />
        </div>
      </div>

      {/* Form Sections */}
      <Accordion type="multiple" defaultValue={["business"]} className="space-y-4">
        {/* Business Info */}
        <AccordionItem value="business" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Informações do Negócio</p>
                <p className="text-sm text-muted-foreground">Descrição, produtos e diferenciais</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4 space-y-4">
            <div className="space-y-2">
              <Label>Descrição do Negócio *</Label>
              <Textarea
                placeholder="Descreva o negócio, o que faz, como funciona..."
                value={form.business_description}
                onChange={(e) => updateForm("business_description", e.target.value)}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Principais Produtos/Serviços</Label>
              <Textarea
                placeholder="Liste os principais produtos ou serviços oferecidos..."
                value={form.main_products_services}
                onChange={(e) => updateForm("main_products_services", e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Diferenciais da Marca</Label>
              <Textarea
                placeholder="O que diferencia essa marca da concorrência..."
                value={form.brand_differentials}
                onChange={(e) => updateForm("brand_differentials", e.target.value)}
                rows={3}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Target Audience */}
        <AccordionItem value="audience" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Público-Alvo</p>
                <p className="text-sm text-muted-foreground">Quem são os clientes ideais</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4 space-y-4">
            <div className="space-y-2">
              <Label>Descrição Geral do Público *</Label>
              <Textarea
                placeholder="Descreva quem é o público-alvo ideal..."
                value={form.target_audience}
                onChange={(e) => updateForm("target_audience", e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Faixa Etária</Label>
                <Input
                  placeholder="Ex: 25-45 anos"
                  value={form.audience_age_range}
                  onChange={(e) => updateForm("audience_age_range", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Gênero Predominante</Label>
                <Select value={form.audience_gender} onValueChange={(v) => updateForm("audience_gender", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="maioria_feminino">Maioria Feminino</SelectItem>
                    <SelectItem value="maioria_masculino">Maioria Masculino</SelectItem>
                    <SelectItem value="equilibrado">Equilibrado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Localização</Label>
                <Input
                  placeholder="Ex: Brasil todo, São Paulo"
                  value={form.audience_location}
                  onChange={(e) => updateForm("audience_location", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Interesses (separados por vírgula)</Label>
              <Input
                placeholder="Ex: empreendedorismo, marketing, vendas"
                value={form.audience_interests}
                onChange={(e) => updateForm("audience_interests", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Principais Dores (uma por linha) *</Label>
              <Textarea
                placeholder="Quais problemas o público enfrenta que a marca resolve?"
                value={form.audience_pain_points}
                onChange={(e) => updateForm("audience_pain_points", e.target.value)}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Objeções Comuns (uma por linha)</Label>
              <Textarea
                placeholder="Quais dúvidas ou resistências o público tem?"
                value={form.audience_objections}
                onChange={(e) => updateForm("audience_objections", e.target.value)}
                rows={3}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Objectives */}
        <AccordionItem value="objectives" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Target className="h-5 w-5 text-green-500" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Objetivos</p>
                <p className="text-sm text-muted-foreground">Metas e resultados esperados</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4 space-y-4">
            <div className="space-y-2">
              <Label>Objetivo Principal *</Label>
              <Select value={form.primary_objective} onValueChange={(v) => updateForm("primary_objective", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o objetivo principal" />
                </SelectTrigger>
                <SelectContent>
                  {objectives.map(obj => (
                    <SelectItem key={obj} value={obj}>{obj}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Objetivos Secundários</Label>
              <div className="flex flex-wrap gap-2">
                {objectives.filter(o => o !== form.primary_objective).map(obj => (
                  <Badge
                    key={obj}
                    variant={form.secondary_objectives.includes(obj) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleArrayItem("secondary_objectives", obj)}
                  >
                    {obj}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Meta de Crescimento</Label>
                <Input
                  placeholder="Ex: 10k seguidores em 6 meses"
                  value={form.growth_goals}
                  onChange={(e) => updateForm("growth_goals", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Meta de Vendas</Label>
                <Input
                  placeholder="Ex: 50 leads por mês"
                  value={form.sales_goals}
                  onChange={(e) => updateForm("sales_goals", e.target.value)}
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Brand & Communication */}
        <AccordionItem value="brand" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Palette className="h-5 w-5 text-purple-500" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Marca e Comunicação</p>
                <p className="text-sm text-muted-foreground">Tom de voz e personalidade</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4 space-y-4">
            <div className="space-y-2">
              <Label>Personalidade da Marca *</Label>
              <div className="flex flex-wrap gap-2">
                {personalities.map(p => (
                  <Badge
                    key={p}
                    variant={form.brand_personality.includes(p) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleArrayItem("brand_personality", p)}
                  >
                    {p}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tom de Voz *</Label>
              <Select value={form.tone_of_voice} onValueChange={(v) => updateForm("tone_of_voice", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Como a marca se comunica?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="formal">Formal e Profissional</SelectItem>
                  <SelectItem value="informal">Informal e Descontraído</SelectItem>
                  <SelectItem value="inspirador">Inspirador e Motivacional</SelectItem>
                  <SelectItem value="educativo">Educativo e Didático</SelectItem>
                  <SelectItem value="provocador">Provocador e Ousado</SelectItem>
                  <SelectItem value="amigavel">Amigável e Próximo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Palavras para Usar</Label>
                <Input
                  placeholder="Separadas por vírgula"
                  value={form.words_to_use}
                  onChange={(e) => updateForm("words_to_use", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Palavras para Evitar</Label>
                <Input
                  placeholder="Separadas por vírgula"
                  value={form.words_to_avoid}
                  onChange={(e) => updateForm("words_to_avoid", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Referências Visuais</Label>
              <Textarea
                placeholder="Descreva o estilo visual, cores, referências de outras marcas..."
                value={form.visual_references}
                onChange={(e) => updateForm("visual_references", e.target.value)}
                rows={3}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Competition */}
        <AccordionItem value="competition" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <Megaphone className="h-5 w-5 text-red-500" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Concorrência</p>
                <p className="text-sm text-muted-foreground">Análise de concorrentes</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4 space-y-4">
            <div className="space-y-2">
              <Label>Principais Concorrentes (@ do Instagram, um por linha)</Label>
              <Textarea
                placeholder="@concorrente1&#10;@concorrente2&#10;@concorrente3"
                value={form.main_competitors}
                onChange={(e) => updateForm("main_competitors", JSON.stringify(e.target.value.split("\n").filter(Boolean)))}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Pontos Fortes dos Concorrentes</Label>
              <Textarea
                placeholder="O que eles fazem bem..."
                value={form.competitor_strengths}
                onChange={(e) => updateForm("competitor_strengths", e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Pontos Fracos dos Concorrentes</Label>
              <Textarea
                placeholder="Onde eles deixam a desejar..."
                value={form.competitor_weaknesses}
                onChange={(e) => updateForm("competitor_weaknesses", e.target.value)}
                rows={3}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Content */}
        <AccordionItem value="content" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-orange-500" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Conteúdo</p>
                <p className="text-sm text-muted-foreground">Pilares e preferências</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4 space-y-4">
            <div className="space-y-2">
              <Label>Pilares de Conteúdo (separados por vírgula)</Label>
              <Input
                placeholder="Ex: Educação, Bastidores, Vendas, Autoridade"
                value={form.content_pillars}
                onChange={(e) => updateForm("content_pillars", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Temas para Abordar</Label>
              <Input
                placeholder="Separados por vírgula"
                value={form.topics_to_cover}
                onChange={(e) => updateForm("topics_to_cover", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Temas para Evitar</Label>
              <Input
                placeholder="Separados por vírgula"
                value={form.topics_to_avoid}
                onChange={(e) => updateForm("topics_to_avoid", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>CTAs Preferidos</Label>
              <Input
                placeholder="Ex: Comente, Salve, Link na bio"
                value={form.cta_preferences}
                onChange={(e) => updateForm("cta_preferences", e.target.value)}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Resources */}
        <AccordionItem value="resources" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                <Camera className="h-5 w-5 text-cyan-500" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Recursos Disponíveis</p>
                <p className="text-sm text-muted-foreground">Materiais e formatos</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4 space-y-4">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="product_photos"
                  checked={form.has_product_photos}
                  onCheckedChange={(c) => updateForm("has_product_photos", c)}
                />
                <Label htmlFor="product_photos">Possui fotos profissionais de produtos</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="team_photos"
                  checked={form.has_team_photos}
                  onCheckedChange={(c) => updateForm("has_team_photos", c)}
                />
                <Label htmlFor="team_photos">Possui fotos da equipe / fundadores</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="behind_scenes"
                  checked={form.has_behind_scenes_access}
                  onCheckedChange={(c) => updateForm("has_behind_scenes_access", c)}
                />
                <Label htmlFor="behind_scenes">Pode gravar bastidores / rotina</Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Formatos de Conteúdo Preferidos</Label>
              <div className="flex flex-wrap gap-2">
                {contentFormats.map(format => (
                  <Badge
                    key={format}
                    variant={form.preferred_content_formats.includes(format) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleArrayItem("preferred_content_formats", format)}
                  >
                    {format}
                  </Badge>
                ))}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Actions */}
      <div className="flex items-center justify-between pt-6 border-t">
        <p className="text-sm text-muted-foreground">
          {isComplete ? "Briefing finalizado" : "Preencha pelo menos os campos obrigatórios (*) para finalizar"}
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar Rascunho
          </Button>
          {!isComplete && (
            <Button onClick={() => handleSave(true)} disabled={saving || progress < 100} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Finalizar e Gerar Estratégia
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
