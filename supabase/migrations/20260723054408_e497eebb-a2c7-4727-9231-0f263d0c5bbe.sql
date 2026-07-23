
-- Enums
CREATE TYPE public.cota_type AS ENUM ('ampla', 'pcd', 'pne');
CREATE TYPE public.intent_status AS ENUM ('pendente', 'sim', 'nao', 'talvez');

-- comarcas
CREATE TABLE public.comarcas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  vagas_total int NOT NULL CHECK (vagas_total >= 0),
  vagas_ocupadas int NOT NULL DEFAULT 0 CHECK (vagas_ocupadas >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.comarcas TO service_role;
ALTER TABLE public.comarcas ENABLE ROW LEVEL SECURITY;

-- candidates
CREATE TABLE public.candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classificacao int,
  ordem_nomeacao int NOT NULL UNIQUE,
  nome text NOT NULL,
  cota public.cota_type NOT NULL DEFAULT 'ampla',
  notas jsonb NOT NULL DEFAULT '{}'::jsonb,
  situacao_original text,
  pretende_original text,
  preferencia_original text,
  status public.intent_status NOT NULL DEFAULT 'pendente',
  comarca_id uuid REFERENCES public.comarcas(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX candidates_ordem_idx ON public.candidates(ordem_nomeacao);
CREATE INDEX candidates_status_idx ON public.candidates(status);
GRANT ALL ON public.candidates TO service_role;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

-- settings (single row)
CREATE TABLE public.settings (
  id int PRIMARY KEY CHECK (id = 1),
  fase int NOT NULL DEFAULT 0 CHECK (fase IN (0, 1, 2)),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
INSERT INTO public.settings (id, fase) VALUES (1, 0);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER comarcas_set_updated_at BEFORE UPDATE ON public.comarcas
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER candidates_set_updated_at BEFORE UPDATE ON public.candidates
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER settings_set_updated_at BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Atomic comarca choice (prevents race conditions)
CREATE OR REPLACE FUNCTION public.choose_comarca(_candidate_id uuid, _comarca_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _c RECORD;
  _cand RECORD;
BEGIN
  SELECT * INTO _cand FROM public.candidates WHERE id = _candidate_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'candidato_nao_encontrado');
  END IF;
  IF _cand.comarca_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ja_escolheu');
  END IF;

  SELECT * INTO _c FROM public.comarcas WHERE id = _comarca_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'comarca_nao_encontrada');
  END IF;
  IF _c.vagas_ocupadas >= _c.vagas_total THEN
    RETURN jsonb_build_object('ok', false, 'error', 'sem_vagas');
  END IF;

  UPDATE public.comarcas SET vagas_ocupadas = vagas_ocupadas + 1 WHERE id = _comarca_id;
  UPDATE public.candidates SET comarca_id = _comarca_id, status = 'sim' WHERE id = _candidate_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;
