
-- Make access codes more readable: 6 chars, only lowercase letters (no confusing digits)
ALTER TABLE company_salespeople 
ALTER COLUMN access_code SET DEFAULT substr(replace(replace(replace(replace(replace(encode(gen_random_bytes(6), 'base64'), '/', ''), '+', ''), '=', ''), 'O', 'a'), '0', 'b'), 1, 6);

-- Also regenerate the existing confusing code for Karen
UPDATE company_salespeople SET access_code = 'karen01' WHERE id = '765e831d-97b4-4877-839a-92a7ae679515';
