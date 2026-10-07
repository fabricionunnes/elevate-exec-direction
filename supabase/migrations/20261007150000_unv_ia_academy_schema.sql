-- =====================================================================
-- UNV IA ACADEMY — schema
-- Produto: assinatura (anual R$ 2.497 / mensal R$ 297) que dá acesso às
-- trilhas de IA aplicada (Método CRESCER) dentro do módulo Academy do Nexus,
-- com 1 hotseat mensal ao vivo em grupo com o Fabrício, 1 sessão individual
-- de planejamento na entrada, entregável por aula, laboratório de agentes
-- prontos e tutor IA.
--
-- Estende as tabelas academy_* existentes (migration 20260123170243).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Colunas novas nas tabelas existentes
-- ---------------------------------------------------------------------

-- Trilhas: a que programa pertencem e se a trilha é a isca gratuita (Trilha 0)
ALTER TABLE public.academy_tracks
  ADD COLUMN IF NOT EXISTS program TEXT NOT NULL DEFAULT 'geral',          -- geral | ia_academy
  ADD COLUMN IF NOT EXISTS is_free_preview BOOLEAN NOT NULL DEFAULT false,  -- Trilha 0 aberta
  ADD COLUMN IF NOT EXISTS crescer_phase TEXT;                              -- cenario | resultado_ideal | estrutura | captacao | conversao | escala | revisao

CREATE INDEX IF NOT EXISTS idx_academy_tracks_program ON public.academy_tracks(program);

-- Aulas: tipo, roteiro/material em markdown e o entregável pedido ao aluno
ALTER TABLE public.academy_lessons
  ADD COLUMN IF NOT EXISTS lesson_kind TEXT NOT NULL DEFAULT 'video',       -- video | live_recording | implementation
  ADD COLUMN IF NOT EXISTS content_md TEXT,                                 -- roteiro / resumo da aula (markdown)
  ADD COLUMN IF NOT EXISTS deliverable_prompt TEXT,                         -- o que o aluno precisa entregar ao final
  ADD COLUMN IF NOT EXISTS deliverable_points INT NOT NULL DEFAULT 30;      -- pontos ao ter o entregável aprovado

-- ---------------------------------------------------------------------
-- 2. Assinaturas do UNV IA Academy
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ia_academy_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- comprador
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  whatsapp TEXT,
  cpf TEXT,
  company_name TEXT,
  segment TEXT,
  -- plano
  plan TEXT NOT NULL CHECK (plan IN ('monthly', 'annual')),
  amount_cents INT NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'pix',                               -- pix | credit_card
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'past_due', 'cancelled', 'refunded')),
  -- Asaas
  asaas_customer_id TEXT,
  asaas_subscription_id TEXT,
  asaas_payment_id TEXT,                                                    -- 1ª cobrança
  asaas_invoice_url TEXT,
  pix_payload TEXT,
  pix_qr_code_base64 TEXT,
  current_period_end DATE,
  paid_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  -- vínculos criados ao ativar
  user_id UUID,                                                             -- auth.users
  onboarding_company_id UUID REFERENCES public.onboarding_companies(id) ON DELETE SET NULL,
  onboarding_project_id UUID REFERENCES public.onboarding_projects(id) ON DELETE SET NULL,
  onboarding_user_id UUID REFERENCES public.onboarding_users(id) ON DELETE SET NULL,
  crm_lead_id UUID,
  -- sessão individual de planejamento (1ª aula ao vivo, 1:1 com o Fabrício)
  onboarding_call_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (onboarding_call_status IN ('pending', 'requested', 'scheduled', 'done', 'skipped')),
  onboarding_call_requested_at TIMESTAMPTZ,
  onboarding_call_preferences TEXT,                                         -- horários preferidos informados pelo aluno
  onboarding_call_at TIMESTAMPTZ,
  onboarding_call_meeting_url TEXT,
  onboarding_call_notes TEXT,                                               -- anotações internas
  onboarding_call_plan_md TEXT,                                             -- plano de IA entregue ao aluno (markdown)
  -- rastreio
  fbclid TEXT,
  utm JSONB NOT NULL DEFAULT '{}'::jsonb,
  access_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ia_academy_subs_email ON public.ia_academy_subscriptions(lower(email));
CREATE INDEX IF NOT EXISTS idx_ia_academy_subs_status ON public.ia_academy_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_ia_academy_subs_asaas_sub ON public.ia_academy_subscriptions(asaas_subscription_id);
CREATE INDEX IF NOT EXISTS idx_ia_academy_subs_asaas_pay ON public.ia_academy_subscriptions(asaas_payment_id);
CREATE INDEX IF NOT EXISTS idx_ia_academy_subs_user ON public.ia_academy_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_ia_academy_subs_onb_user ON public.ia_academy_subscriptions(onboarding_user_id);

-- ---------------------------------------------------------------------
-- 3. Encontros ao vivo (hotseat mensal em grupo, aulas de implementação)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ia_academy_live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL DEFAULT 'hotseat' CHECK (kind IN ('hotseat', 'implementation', 'masterclass')),
  title TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 90,
  meeting_url TEXT,                                                         -- Zoom / Meet
  host_name TEXT NOT NULL DEFAULT 'Fabrício Nunnes',
  max_participants INT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'done', 'cancelled')),
  recording_url TEXT,
  recording_lesson_id UUID REFERENCES public.academy_lessons(id) ON DELETE SET NULL,  -- gravação publicada como aula
  track_id UUID REFERENCES public.academy_tracks(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.onboarding_staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ia_academy_live_sched ON public.ia_academy_live_sessions(scheduled_at);

CREATE TABLE IF NOT EXISTS public.ia_academy_live_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.ia_academy_live_sessions(id) ON DELETE CASCADE,
  onboarding_user_id UUID NOT NULL REFERENCES public.onboarding_users(id) ON DELETE CASCADE,
  question TEXT,                                                            -- dúvida/caso que o aluno quer levar pro hotseat
  topic TEXT,
  wants_hotseat BOOLEAN NOT NULL DEFAULT false,                             -- quer a cadeira quente (apresentar o caso)
  picked_for_hotseat BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'attended', 'missed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, onboarding_user_id)
);

CREATE INDEX IF NOT EXISTS idx_ia_academy_live_reg_user ON public.ia_academy_live_registrations(onboarding_user_id);

-- ---------------------------------------------------------------------
-- 4. Entregável por aula (prova de implementação)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.academy_lesson_deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.academy_lessons(id) ON DELETE CASCADE,
  onboarding_user_id UUID NOT NULL REFERENCES public.onboarding_users(id) ON DELETE CASCADE,
  proof_url TEXT,                                                           -- link do print / agente / documento
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved', 'changes_requested')),
  feedback TEXT,
  reviewer_staff_id UUID REFERENCES public.onboarding_staff(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  points_awarded INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lesson_id, onboarding_user_id)
);

CREATE INDEX IF NOT EXISTS idx_academy_deliv_status ON public.academy_lesson_deliverables(status);
CREATE INDEX IF NOT EXISTS idx_academy_deliv_user ON public.academy_lesson_deliverables(onboarding_user_id);

-- ---------------------------------------------------------------------
-- 5. Laboratório de agentes (prompts, fluxos N8N, templates prontos)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ia_academy_lab_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'prompt' CHECK (category IN ('prompt', 'agent', 'n8n_flow', 'template', 'checklist')),
  crescer_phase TEXT,
  description TEXT,
  prompt_text TEXT,                                                         -- prompt pronto pra copiar
  external_url TEXT,                                                        -- JSON do N8N, planilha, doc
  tools TEXT[] NOT NULL DEFAULT '{}',                                       -- ex.: {chatgpt, claude, n8n, whatsapp}
  track_id UUID REFERENCES public.academy_tracks(id) ON DELETE SET NULL,
  lesson_id UUID REFERENCES public.academy_lessons(id) ON DELETE SET NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 6. Tutor IA — histórico por aluno
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ia_academy_tutor_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_user_id UUID NOT NULL REFERENCES public.onboarding_users(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES public.academy_lessons(id) ON DELETE SET NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ia_academy_tutor_user_lesson
  ON public.ia_academy_tutor_messages(onboarding_user_id, lesson_id, created_at);

-- ---------------------------------------------------------------------
-- 7. updated_at
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_ia_academy_subs_updated ON public.ia_academy_subscriptions;
CREATE TRIGGER trg_ia_academy_subs_updated BEFORE UPDATE ON public.ia_academy_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_ia_academy_live_updated ON public.ia_academy_live_sessions;
CREATE TRIGGER trg_ia_academy_live_updated BEFORE UPDATE ON public.ia_academy_live_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_academy_deliv_updated ON public.academy_lesson_deliverables;
CREATE TRIGGER trg_academy_deliv_updated BEFORE UPDATE ON public.academy_lesson_deliverables
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_ia_academy_lab_updated ON public.ia_academy_lab_items;
CREATE TRIGGER trg_ia_academy_lab_updated BEFORE UPDATE ON public.ia_academy_lab_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------
-- 8. Funções auxiliares
-- ---------------------------------------------------------------------

-- Staff do Academy (mesmo critério do AcademyLayout)
CREATE OR REPLACE FUNCTION public.ia_academy_is_staff()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE user_id = auth.uid() AND is_active = true
      AND role IN ('master', 'admin', 'cs', 'consultant')
  );
$$;

-- Ids de onboarding_users que pertencem ao usuário logado
CREATE OR REPLACE FUNCTION public.ia_academy_my_onboarding_user_ids()
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.onboarding_users WHERE user_id = auth.uid();
$$;

-- Usado pelo checkout (service role) pra reaproveitar conta existente pelo e-mail
CREATE OR REPLACE FUNCTION public.ia_academy_find_user_by_email(p_email TEXT)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.ia_academy_find_user_by_email(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ia_academy_find_user_by_email(TEXT) TO service_role;

-- Aprovar entregável: marca, pontua (ledger → trigger de nível) e devolve feedback
CREATE OR REPLACE FUNCTION public.ia_academy_review_deliverable(
  p_deliverable_id UUID,
  p_status TEXT,
  p_feedback TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_staff_id UUID;
  v_row public.academy_lesson_deliverables%ROWTYPE;
  v_points INT;
  v_lesson_title TEXT;
BEGIN
  IF NOT public.ia_academy_is_staff() THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  IF p_status NOT IN ('approved', 'changes_requested') THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;

  SELECT id INTO v_staff_id FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true LIMIT 1;
  SELECT * INTO v_row FROM public.academy_lesson_deliverables WHERE id = p_deliverable_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Entregável não encontrado';
  END IF;

  SELECT deliverable_points, title INTO v_points, v_lesson_title FROM public.academy_lessons WHERE id = v_row.lesson_id;

  UPDATE public.academy_lesson_deliverables
  SET status = p_status,
      feedback = p_feedback,
      reviewer_staff_id = v_staff_id,
      reviewed_at = now(),
      points_awarded = CASE WHEN p_status = 'approved' AND points_awarded = 0 THEN COALESCE(v_points, 0) ELSE points_awarded END
  WHERE id = p_deliverable_id;

  -- pontua uma única vez
  IF p_status = 'approved' AND v_row.points_awarded = 0 AND COALESCE(v_points, 0) > 0 THEN
    INSERT INTO public.academy_points_ledger (onboarding_user_id, points, action_type, description, reference_id, reference_type)
    VALUES (v_row.onboarding_user_id, v_points, 'deliverable_approved',
            'Entregável aprovado: ' || COALESCE(v_lesson_title, 'aula'), v_row.lesson_id, 'lesson');
  END IF;
END;
$$;

-- ---------------------------------------------------------------------
-- 9. RLS
-- ---------------------------------------------------------------------
ALTER TABLE public.ia_academy_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_academy_live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_academy_live_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_lesson_deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_academy_lab_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_academy_tutor_messages ENABLE ROW LEVEL SECURITY;

-- Assinaturas: staff gerencia; o próprio assinante enxerga e pode pedir a sessão 1:1
DROP POLICY IF EXISTS "Staff manage ia_academy_subscriptions" ON public.ia_academy_subscriptions;
CREATE POLICY "Staff manage ia_academy_subscriptions" ON public.ia_academy_subscriptions
  FOR ALL USING (public.ia_academy_is_staff()) WITH CHECK (public.ia_academy_is_staff());

DROP POLICY IF EXISTS "Owner view ia_academy_subscription" ON public.ia_academy_subscriptions;
CREATE POLICY "Owner view ia_academy_subscription" ON public.ia_academy_subscriptions
  FOR SELECT USING (user_id = auth.uid() OR onboarding_user_id IN (SELECT public.ia_academy_my_onboarding_user_ids()));

DROP POLICY IF EXISTS "Owner request onboarding call" ON public.ia_academy_subscriptions;
CREATE POLICY "Owner request onboarding call" ON public.ia_academy_subscriptions
  FOR UPDATE USING (user_id = auth.uid() OR onboarding_user_id IN (SELECT public.ia_academy_my_onboarding_user_ids()))
  WITH CHECK (user_id = auth.uid() OR onboarding_user_id IN (SELECT public.ia_academy_my_onboarding_user_ids()));

-- Encontros: staff gerencia; qualquer aluno logado vê os não cancelados
DROP POLICY IF EXISTS "Staff manage live sessions" ON public.ia_academy_live_sessions;
CREATE POLICY "Staff manage live sessions" ON public.ia_academy_live_sessions
  FOR ALL USING (public.ia_academy_is_staff()) WITH CHECK (public.ia_academy_is_staff());

DROP POLICY IF EXISTS "Users view live sessions" ON public.ia_academy_live_sessions;
CREATE POLICY "Users view live sessions" ON public.ia_academy_live_sessions
  FOR SELECT USING (auth.uid() IS NOT NULL AND status <> 'cancelled');

-- Inscrições: staff gerencia; aluno gerencia as próprias
DROP POLICY IF EXISTS "Staff manage live registrations" ON public.ia_academy_live_registrations;
CREATE POLICY "Staff manage live registrations" ON public.ia_academy_live_registrations
  FOR ALL USING (public.ia_academy_is_staff()) WITH CHECK (public.ia_academy_is_staff());

DROP POLICY IF EXISTS "Users manage own live registrations" ON public.ia_academy_live_registrations;
CREATE POLICY "Users manage own live registrations" ON public.ia_academy_live_registrations
  FOR ALL USING (onboarding_user_id IN (SELECT public.ia_academy_my_onboarding_user_ids()))
  WITH CHECK (onboarding_user_id IN (SELECT public.ia_academy_my_onboarding_user_ids()));

-- Entregáveis: staff vê tudo (revisão via RPC); aluno cria/edita/vê os próprios
DROP POLICY IF EXISTS "Staff manage deliverables" ON public.academy_lesson_deliverables;
CREATE POLICY "Staff manage deliverables" ON public.academy_lesson_deliverables
  FOR ALL USING (public.ia_academy_is_staff()) WITH CHECK (public.ia_academy_is_staff());

DROP POLICY IF EXISTS "Users manage own deliverables" ON public.academy_lesson_deliverables;
CREATE POLICY "Users manage own deliverables" ON public.academy_lesson_deliverables
  FOR ALL USING (onboarding_user_id IN (SELECT public.ia_academy_my_onboarding_user_ids()))
  WITH CHECK (onboarding_user_id IN (SELECT public.ia_academy_my_onboarding_user_ids()));

-- Laboratório: staff gerencia; aluno logado vê ativos
DROP POLICY IF EXISTS "Staff manage lab items" ON public.ia_academy_lab_items;
CREATE POLICY "Staff manage lab items" ON public.ia_academy_lab_items
  FOR ALL USING (public.ia_academy_is_staff()) WITH CHECK (public.ia_academy_is_staff());

DROP POLICY IF EXISTS "Users view lab items" ON public.ia_academy_lab_items;
CREATE POLICY "Users view lab items" ON public.ia_academy_lab_items
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);

-- Tutor: aluno gerencia o próprio histórico; staff lê
DROP POLICY IF EXISTS "Users manage own tutor messages" ON public.ia_academy_tutor_messages;
CREATE POLICY "Users manage own tutor messages" ON public.ia_academy_tutor_messages
  FOR ALL USING (onboarding_user_id IN (SELECT public.ia_academy_my_onboarding_user_ids()))
  WITH CHECK (onboarding_user_id IN (SELECT public.ia_academy_my_onboarding_user_ids()));

DROP POLICY IF EXISTS "Staff view tutor messages" ON public.ia_academy_tutor_messages;
CREATE POLICY "Staff view tutor messages" ON public.ia_academy_tutor_messages
  FOR SELECT USING (public.ia_academy_is_staff());

-- Isolamento de tenant white-label (mesmo padrão das demais tabelas do Academy)
DO $$
DECLARE t TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_user_is_tenant') THEN
    FOREACH t IN ARRAY ARRAY[
      'ia_academy_subscriptions', 'ia_academy_live_sessions', 'ia_academy_live_registrations',
      'academy_lesson_deliverables', 'ia_academy_lab_items', 'ia_academy_tutor_messages'
    ] LOOP
      EXECUTE format('DROP POLICY IF EXISTS "Tenant total isolation block" ON public.%I', t);
      EXECUTE format(
        'CREATE POLICY "Tenant total isolation block" ON public.%I AS RESTRICTIVE FOR ALL USING (NOT public.current_user_is_tenant()) WITH CHECK (NOT public.current_user_is_tenant())',
        t
      );
    END LOOP;
  END IF;
END $$;

-- anon nunca lê essas tabelas (checkout e webhook usam service role)
REVOKE ALL ON public.ia_academy_subscriptions FROM anon;
REVOKE ALL ON public.ia_academy_live_sessions FROM anon;
REVOKE ALL ON public.ia_academy_live_registrations FROM anon;
REVOKE ALL ON public.academy_lesson_deliverables FROM anon;
REVOKE ALL ON public.ia_academy_lab_items FROM anon;
REVOKE ALL ON public.ia_academy_tutor_messages FROM anon;
