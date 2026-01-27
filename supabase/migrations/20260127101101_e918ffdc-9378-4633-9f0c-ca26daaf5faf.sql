-- Add RLS policy to allow authors and recipients to delete testimonials
CREATE POLICY "Authors can delete own testimonials"
  ON public.circle_testimonials FOR DELETE
  USING (author_profile_id = public.get_circle_profile_id_safe());

CREATE POLICY "Recipients can delete received testimonials"
  ON public.circle_testimonials FOR DELETE
  USING (recipient_profile_id = public.get_circle_profile_id_safe());