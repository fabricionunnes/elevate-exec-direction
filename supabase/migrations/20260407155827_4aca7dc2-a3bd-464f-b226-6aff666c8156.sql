
-- Data migration for existing records (safe to skip on fresh database)
DO $$
BEGIN
  -- Delete 6 duplicate Kelvin transactions (keep 3b2c27d9)
  DELETE FROM financial_bank_transactions WHERE id IN (
    'db73c711-48f9-4d52-b7e5-b72426c10a9c',
    'ad9686ed-65b9-4a54-8aac-584e987ae652',
    '13ef1194-b901-4dec-b024-a041f7d6f725',
    'ef2148e5-d685-476a-9075-9e2b2f85691d',
    '95840c22-5f47-4d54-a7b3-f3faaa07ac0b',
    '338c8967-a69b-40fb-b09f-c11b5b5a3b01'
  );

  -- Add fee transaction for the kept Kelvin payment
  INSERT INTO financial_bank_transactions (bank_id, type, amount_cents, description, reference_type, reference_id, fee_cents)
  VALUES (
    'cb223279-5087-47ec-bd02-2b7b412cf21a',
    'debit',
    298,
    'Taxa Asaas - Mansão Empreendedora Abril 2026 - Kelvin de Matos Milioni',
    'fee',
    '3b2c27d9-1ab4-4503-a74b-52cc88bd144e',
    0
  );

  -- Fix bank balance: subtract 6*99400 + 298 = 596698
  UPDATE financial_banks
  SET current_balance_cents = current_balance_cents - 596698
  WHERE id = 'cb223279-5087-47ec-bd02-2b7b412cf21a';
EXCEPTION WHEN OTHERS THEN
  -- Skip data migrations that reference records not present in this database
  NULL;
END $$;
