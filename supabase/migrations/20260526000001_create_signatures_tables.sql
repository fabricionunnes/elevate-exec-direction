-- Assinatura Eletrônica — Parte 1: ENUMs e Tabelas
DO $$ BEGIN CREATE TYPE envelope_status AS ENUM ('draft','sent','partially_signed','completed','expired','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE signer_status AS ENUM ('pending','viewed','signed','declined'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE audit_event_type AS ENUM ('created','sent','email_delivered','viewed','signature_started','signed','completed','declined','expired','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.envelopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 255),
  status envelope_status NOT NULL DEFAULT 'draft',
  original_file_path TEXT, original_file_hash TEXT,
  final_file_path TEXT, final_file_hash TEXT,
  message TEXT, expires_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.signers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  envelope_id UUID NOT NULL REFERENCES public.envelopes(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 255),
  email TEXT NOT NULL CHECK (email ~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$'),
  cpf TEXT CHECK (cpf IS NULL OR cpf ~ '^\d{11}$'),
  order_index INTEGER NOT NULL DEFAULT 0,
  status signer_status NOT NULL DEFAULT 'pending',
  signed_at TIMESTAMPTZ, sign_ip TEXT, sign_user_agent TEXT,
  sign_geo_country TEXT, sign_geo_region TEXT, sign_geo_city TEXT,
  sign_latitude NUMERIC(9,6), sign_longitude NUMERIC(9,6),
  signature_image_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (envelope_id, email)
);

CREATE TABLE IF NOT EXISTS public.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  envelope_id UUID NOT NULL REFERENCES public.envelopes(id) ON DELETE RESTRICT,
  signer_id UUID REFERENCES public.signers(id) ON DELETE RESTRICT,
  event_type audit_event_type NOT NULL,
  ip TEXT, user_agent TEXT, geo_country TEXT, geo_region TEXT, geo_city TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.signing_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signer_id UUID NOT NULL REFERENCES public.signers(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Parte 2: Triggers, índices, RLS
CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS envelopes_updated_at ON public.envelopes;
CREATE TRIGGER envelopes_updated_at BEFORE UPDATE ON public.envelopes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS signers_updated_at ON public.signers;
CREATE TRIGGER signers_updated_at BEFORE UPDATE ON public.signers FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_envelopes_owner ON public.envelopes(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_envelopes_status ON public.envelopes(status);
CREATE INDEX IF NOT EXISTS idx_signers_envelope ON public.signers(envelope_id);
CREATE INDEX IF NOT EXISTS idx_signing_tokens_hash ON public.signing_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_audit_envelope ON public.audit_events(envelope_id);

ALTER TABLE public.envelopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signing_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "envelopes_owner_select" ON public.envelopes;
CREATE POLICY "envelopes_owner_select" ON public.envelopes FOR SELECT TO authenticated USING (owner_user_id = auth.uid());
DROP POLICY IF EXISTS "envelopes_owner_insert" ON public.envelopes;
CREATE POLICY "envelopes_owner_insert" ON public.envelopes FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid());
DROP POLICY IF EXISTS "envelopes_owner_update" ON public.envelopes;
CREATE POLICY "envelopes_owner_update" ON public.envelopes FOR UPDATE TO authenticated USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "signers_owner_select" ON public.signers;
CREATE POLICY "signers_owner_select" ON public.signers FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.envelopes e WHERE e.id = signers.envelope_id AND e.owner_user_id = auth.uid()));
DROP POLICY IF EXISTS "signers_owner_insert" ON public.signers;
CREATE POLICY "signers_owner_insert" ON public.signers FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.envelopes e WHERE e.id = signers.envelope_id AND e.owner_user_id = auth.uid()));
DROP POLICY IF EXISTS "signers_owner_update" ON public.signers;
CREATE POLICY "signers_owner_update" ON public.signers FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.envelopes e WHERE e.id = signers.envelope_id AND e.owner_user_id = auth.uid()));

DROP POLICY IF EXISTS "audit_owner_select" ON public.audit_events;
CREATE POLICY "audit_owner_select" ON public.audit_events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.envelopes e WHERE e.id = audit_events.envelope_id AND e.owner_user_id = auth.uid()));

-- Parte 3: View, função helper, storage
CREATE OR REPLACE VIEW public.envelope_summary AS
SELECT e.id, e.title, e.status, e.original_file_hash, e.final_file_hash, e.final_file_path, e.original_file_path, e.created_at, e.completed_at, e.expires_at, e.owner_user_id, e.message,
  COUNT(s.id) AS total_signers,
  COUNT(s.id) FILTER (WHERE s.status = 'signed') AS signed_count,
  COUNT(s.id) FILTER (WHERE s.status = 'pending') AS pending_count,
  COUNT(s.id) FILTER (WHERE s.status = 'viewed') AS viewed_count,
  COUNT(s.id) FILTER (WHERE s.status = 'declined') AS declined_count
FROM public.envelopes e LEFT JOIN public.signers s ON s.envelope_id = e.id GROUP BY e.id;

CREATE OR REPLACE FUNCTION public.is_admin_or_master() RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS (SELECT 1 FROM public.onboarding_staff s WHERE s.user_id = auth.uid() AND s.role IN ('master','admin') AND s.is_active = TRUE); $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('envelopes','envelopes',false,52428800,ARRAY['application/pdf','image/png','image/jpeg','image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "storage_envelopes_owner_select" ON storage.objects;
CREATE POLICY "storage_envelopes_owner_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'envelopes' AND EXISTS (SELECT 1 FROM public.envelopes e WHERE e.id::text = (string_to_array(name, '/'))[2] AND e.owner_user_id = auth.uid()));

DROP POLICY IF EXISTS "storage_envelopes_service_insert" ON storage.objects;
CREATE POLICY "storage_envelopes_service_insert" ON storage.objects FOR INSERT TO service_role WITH CHECK (bucket_id = 'envelopes');

-- Grants para service_role (necessário para edge functions usarem supabaseAdmin)
GRANT ALL ON public.envelopes, public.signers, public.audit_events, public.signing_tokens TO service_role;
GRANT ALL ON public.envelopes, public.signers, public.audit_events, public.signing_tokens TO authenticated;
GRANT SELECT ON public.envelopes, public.signers, public.audit_events, public.signing_tokens TO anon;
