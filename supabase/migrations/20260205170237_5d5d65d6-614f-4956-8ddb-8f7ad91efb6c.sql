-- Add contact_id to approval links to track who approved
ALTER TABLE public.social_approval_links
ADD COLUMN contact_id UUID REFERENCES public.social_approval_contacts(id) ON DELETE SET NULL;

-- Add approval_count to cards to track how many approvals received
ALTER TABLE public.social_content_cards
ADD COLUMN approval_count INTEGER NOT NULL DEFAULT 0;