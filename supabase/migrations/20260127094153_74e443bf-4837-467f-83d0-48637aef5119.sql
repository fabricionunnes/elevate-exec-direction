-- Fix RLS: ensure authenticated users can create circle conversations

DROP POLICY IF EXISTS "circle_conversations_insert" ON public.circle_conversations;

CREATE POLICY "circle_conversations_insert" 
ON public.circle_conversations
FOR INSERT
TO authenticated
WITH CHECK (true);