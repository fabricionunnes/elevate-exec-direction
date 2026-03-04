
CREATE TABLE public.company_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read segments"
  ON public.company_segments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage segments"
  ON public.company_segments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.company_segments (name) VALUES
  ('Academia'), ('Advocacia'), ('Agência'), ('Agropecuária e Agrícola'),
  ('Atacado e Varejo'), ('Autoescola'), ('Automóveis e Autopeças'), ('Clínica'),
  ('Consultoria e Mentoria'), ('Corretora'), ('Cursos e Treinamentos'), ('Distribuidora'),
  ('Drogaria'), ('Energia Solar'), ('Escola'), ('Fábrica'),
  ('Imobiliária e Construtora'), ('Ótica'), ('Prestação de Serviços'), ('Produtora Musical'),
  ('Rastreamento Veicular'), ('Salão de Beleza (Atacado e Varejo)'), ('Saúde e Segurança'),
  ('Serviços Gráficos'), ('Serviços Gráficos e Papelaria'), ('Soluções em IA'),
  ('Telefonia e Internet'), ('Varejo'), ('Viagens e Turismo')
ON CONFLICT (name) DO NOTHING;
