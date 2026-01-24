-- Add UPDATE policy for generated_contracts
CREATE POLICY "Anyone can update contracts"
ON public.generated_contracts
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Add DELETE policy for generated_contracts (for admin deletion)
CREATE POLICY "Anyone can delete contracts"
ON public.generated_contracts
FOR DELETE
USING (true);