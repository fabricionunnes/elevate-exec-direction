-- Grant table-level privileges for Ponto de Encontro tables to authenticated users
-- RLS policies control row-level access; these grants allow the queries to reach RLS at all.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pe_tracks          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pe_lessons         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pe_track_companies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pe_lesson_companies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pe_student_companies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pe_progress        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pe_certificates    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pe_polls           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pe_poll_responses  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pe_quizzes         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pe_quiz_questions  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pe_quiz_responses  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pe_points_config   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pe_points_log      TO authenticated;
