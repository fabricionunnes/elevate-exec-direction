UPDATE public.company_invoices
SET status = 'paid',
    paid_at = NOW(),
    paid_amount_cents = 238932
WHERE id = 'a6ff80a0-4680-4767-b17d-e415a7930eea';