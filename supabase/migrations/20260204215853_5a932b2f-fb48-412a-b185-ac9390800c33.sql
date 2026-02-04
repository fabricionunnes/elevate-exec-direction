-- =====================================================
-- UNV SOCIAL - ESTRATÉGIA E INTELIGÊNCIA DE SOCIAL MEDIA
-- =====================================================

-- 1) BRIEFING DE SOCIAL MEDIA
CREATE TABLE public.social_briefing_forms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  
  -- Informações Básicas
  business_description TEXT,
  target_audience TEXT,
  main_products_services TEXT,
  brand_differentials TEXT,
  
  -- Presença Digital Atual
  instagram_handle TEXT,
  instagram_followers INTEGER,
  other_social_channels JSONB DEFAULT '[]',
  current_posting_frequency TEXT,
  content_types_used TEXT[],
  
  -- Objetivos
  primary_objective TEXT,
  secondary_objectives TEXT[],
  growth_goals TEXT,
  sales_goals TEXT,
  
  -- Marca e Comunicação
  brand_personality TEXT[],
  tone_of_voice TEXT,
  words_to_use TEXT[],
  words_to_avoid TEXT[],
  visual_references TEXT,
  
  -- Concorrência
  main_competitors JSONB DEFAULT '[]',
  competitor_strengths TEXT,
  competitor_weaknesses TEXT,
  
  -- Público-Alvo Detalhado
  audience_age_range TEXT,
  audience_gender TEXT,
  audience_location TEXT,
  audience_interests TEXT[],
  audience_pain_points TEXT[],
  audience_objections TEXT[],
  
  -- Conteúdo
  content_pillars TEXT[],
  topics_to_cover TEXT[],
  topics_to_avoid TEXT[],
  cta_preferences TEXT[],
  
  -- Recursos
  has_product_photos BOOLEAN DEFAULT false,
  has_team_photos BOOLEAN DEFAULT false,
  has_behind_scenes_access BOOLEAN DEFAULT false,
  preferred_content_formats TEXT[],
  
  -- Status
  is_complete BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID REFERENCES public.onboarding_staff(id),
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2) ANÁLISE ESTRATÉGICA (SWOT + POSICIONAMENTO)
CREATE TABLE public.social_strategy_analysis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  briefing_id UUID REFERENCES public.social_briefing_forms(id) ON DELETE SET NULL,
  
  -- Análise de Concorrência
  competitor_analysis JSONB DEFAULT '{}',
  market_opportunities TEXT[],
  market_threats TEXT[],
  
  -- Posicionamento
  positioning_statement TEXT,
  unique_value_proposition TEXT,
  communication_guidelines TEXT,
  differentiation_strategy TEXT,
  where_not_to_compete TEXT,
  
  -- SWOT
  swot_strengths TEXT[],
  swot_weaknesses TEXT[],
  swot_opportunities TEXT[],
  swot_threats TEXT[],
  
  -- Briefing Consolidado
  consolidated_briefing TEXT,
  
  -- Metadata
  generated_by TEXT DEFAULT 'ai',
  model_used TEXT,
  generation_prompt TEXT,
  
  is_approved BOOLEAN DEFAULT false,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES public.onboarding_staff(id),
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3) PERSONAS
CREATE TABLE public.social_personas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  briefing_id UUID REFERENCES public.social_briefing_forms(id) ON DELETE SET NULL,
  
  -- Dados Demográficos
  name TEXT NOT NULL,
  age INTEGER,
  gender TEXT,
  profession TEXT,
  location TEXT,
  income_level TEXT,
  education TEXT,
  
  -- Rotina e Estilo de Vida
  daily_routine TEXT,
  hobbies TEXT[],
  values TEXT[],
  lifestyle TEXT,
  
  -- Psicográfico
  goals TEXT[],
  pain_points TEXT[],
  fears TEXT[],
  desires TEXT[],
  objections TEXT[],
  motivations TEXT[],
  
  -- Comportamento Digital
  preferred_platforms TEXT[],
  content_consumption_habits TEXT,
  ideal_content_types TEXT[],
  ideal_language TEXT,
  peak_activity_times TEXT[],
  
  -- Metadata
  avatar_url TEXT,
  is_primary BOOLEAN DEFAULT false,
  generated_by TEXT DEFAULT 'ai',
  
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4) DIRECIONAMENTO DE STORIES
CREATE TABLE public.social_stories_guidelines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  briefing_id UUID REFERENCES public.social_briefing_forms(id) ON DELETE SET NULL,
  
  -- Estratégia de Stories
  stories_objective TEXT,
  ideal_frequency TEXT,
  best_posting_times TEXT[],
  
  -- Tipos de Stories
  story_types JSONB DEFAULT '[]',
  -- Format: [{type: "bastidores", description: "", examples: [], percentage: 20}]
  
  -- Linguagem e Tom
  ideal_language TEXT,
  engagement_techniques TEXT[],
  suggested_ctas TEXT[],
  
  -- Exemplos Práticos
  practical_examples JSONB DEFAULT '[]',
  
  -- Regras
  do_list TEXT[],
  dont_list TEXT[],
  
  -- Metadata
  generated_by TEXT DEFAULT 'ai',
  is_approved BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5) SUGESTÕES DE CONTEÚDO
CREATE TABLE public.social_content_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  briefing_id UUID REFERENCES public.social_briefing_forms(id) ON DELETE SET NULL,
  
  -- Conteúdo
  title TEXT NOT NULL,
  content_format TEXT NOT NULL, -- feed, reels, stories, carousel
  objective TEXT NOT NULL, -- engajamento, autoridade, conversão, relacionamento
  
  -- Detalhes
  theme TEXT,
  creative_idea TEXT,
  copy_idea TEXT,
  suggested_cta TEXT,
  hashtag_suggestions TEXT[],
  
  -- Referências
  based_on_persona_id UUID REFERENCES public.social_personas(id),
  based_on_pillar TEXT,
  
  -- Status
  status TEXT DEFAULT 'pending', -- pending, approved, converted, rejected
  converted_to_card_id UUID REFERENCES public.social_content_cards(id),
  
  -- Metadata
  generated_by TEXT DEFAULT 'ai',
  ai_confidence_score NUMERIC(3,2),
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6) IMAGENS GERADAS POR IA
CREATE TABLE public.social_generated_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  
  -- Prompt e Resultado
  prompt TEXT NOT NULL,
  negative_prompt TEXT,
  image_url TEXT NOT NULL,
  
  -- Configurações
  image_style TEXT, -- institucional, lifestyle, promocional, conceitual
  aspect_ratio TEXT DEFAULT '1:1',
  model_used TEXT,
  
  -- Contexto de Marca
  brand_colors TEXT[],
  brand_elements TEXT[],
  emotion TEXT,
  scenario TEXT,
  
  -- Uso
  used_in_card_id UUID REFERENCES public.social_content_cards(id),
  is_favorite BOOLEAN DEFAULT false,
  
  -- Metadata
  generated_by UUID REFERENCES public.onboarding_staff(id),
  generation_time_ms INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 7) AUDIT LOG PARA ESTRATÉGIA
CREATE TABLE public.social_strategy_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  
  -- Ação
  action TEXT NOT NULL, -- created, updated, regenerated, approved, rejected
  entity_type TEXT NOT NULL, -- briefing, strategy, persona, stories_guide, suggestion
  entity_id UUID NOT NULL,
  
  -- Detalhes
  changes JSONB,
  previous_values JSONB,
  new_values JSONB,
  
  -- Autor
  performed_by UUID REFERENCES public.onboarding_staff(id),
  performed_by_name TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 8) PESQUISAS E INSPIRAÇÕES
CREATE TABLE public.social_research_inspirations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  
  -- Conteúdo
  title TEXT NOT NULL,
  type TEXT NOT NULL, -- reference, competitor, trend, inspiration
  source_url TEXT,
  source_platform TEXT,
  
  -- Mídia
  thumbnail_url TEXT,
  media_urls TEXT[],
  
  -- Análise
  notes TEXT,
  tags TEXT[],
  what_works TEXT,
  what_to_adapt TEXT,
  
  -- Metadata
  added_by UUID REFERENCES public.onboarding_staff(id),
  is_favorite BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.social_briefing_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_strategy_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_stories_guidelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_content_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_generated_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_strategy_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_research_inspirations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for authenticated users (staff)
CREATE POLICY "Staff can manage social briefing forms" ON public.social_briefing_forms
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff s
      WHERE s.user_id = auth.uid() AND s.is_active = true
    )
  );

CREATE POLICY "Staff can manage social strategy analysis" ON public.social_strategy_analysis
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff s
      WHERE s.user_id = auth.uid() AND s.is_active = true
    )
  );

CREATE POLICY "Staff can manage social personas" ON public.social_personas
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff s
      WHERE s.user_id = auth.uid() AND s.is_active = true
    )
  );

CREATE POLICY "Staff can manage social stories guidelines" ON public.social_stories_guidelines
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff s
      WHERE s.user_id = auth.uid() AND s.is_active = true
    )
  );

CREATE POLICY "Staff can manage social content suggestions" ON public.social_content_suggestions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff s
      WHERE s.user_id = auth.uid() AND s.is_active = true
    )
  );

CREATE POLICY "Staff can manage social generated images" ON public.social_generated_images
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff s
      WHERE s.user_id = auth.uid() AND s.is_active = true
    )
  );

CREATE POLICY "Staff can view social strategy audit log" ON public.social_strategy_audit_log
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff s
      WHERE s.user_id = auth.uid() AND s.is_active = true
    )
  );

CREATE POLICY "Staff can manage social research inspirations" ON public.social_research_inspirations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff s
      WHERE s.user_id = auth.uid() AND s.is_active = true
    )
  );

-- Create update triggers for updated_at
CREATE TRIGGER update_social_briefing_forms_updated_at
  BEFORE UPDATE ON public.social_briefing_forms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_social_strategy_analysis_updated_at
  BEFORE UPDATE ON public.social_strategy_analysis
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_social_personas_updated_at
  BEFORE UPDATE ON public.social_personas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_social_stories_guidelines_updated_at
  BEFORE UPDATE ON public.social_stories_guidelines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_social_briefing_forms_project ON public.social_briefing_forms(project_id);
CREATE INDEX idx_social_strategy_analysis_project ON public.social_strategy_analysis(project_id);
CREATE INDEX idx_social_personas_project ON public.social_personas(project_id);
CREATE INDEX idx_social_stories_guidelines_project ON public.social_stories_guidelines(project_id);
CREATE INDEX idx_social_content_suggestions_project ON public.social_content_suggestions(project_id);
CREATE INDEX idx_social_generated_images_project ON public.social_generated_images(project_id);
CREATE INDEX idx_social_strategy_audit_log_project ON public.social_strategy_audit_log(project_id);
CREATE INDEX idx_social_research_inspirations_project ON public.social_research_inspirations(project_id);