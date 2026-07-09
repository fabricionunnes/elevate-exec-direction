-- UNV Profile / Recrutamento: perguntas de entrevista geradas pela IA por candidato.
-- Array de { pergunta, objetivo } gerado junto da análise (profile-candidate-analyze).

alter table public.profile_candidates
  add column if not exists ai_interview_questions jsonb;
