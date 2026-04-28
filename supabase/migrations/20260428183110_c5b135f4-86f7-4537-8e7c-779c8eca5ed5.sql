DO $$
DECLARE
  fk record;
BEGIN
  FOR fk IN
    SELECT
      c.oid,
      c.conrelid,
      c.conrelid::regclass AS child_table,
      c.conname,
      c.confrelid::regclass AS parent_table,
      c.conkey,
      c.confkey,
      c.condeferrable,
      c.condeferred,
      string_agg(format('%I', child_att.attname), ', ' ORDER BY k.ord) AS child_cols,
      string_agg(format('%I', parent_att.attname), ', ' ORDER BY k.ord) AS parent_cols,
      bool_and(NOT child_att.attnotnull) AS all_child_cols_nullable
    FROM pg_constraint c
    JOIN unnest(c.conkey, c.confkey) WITH ORDINALITY AS k(child_attnum, parent_attnum, ord) ON true
    JOIN pg_attribute child_att ON child_att.attrelid = c.conrelid AND child_att.attnum = k.child_attnum
    JOIN pg_attribute parent_att ON parent_att.attrelid = c.confrelid AND parent_att.attnum = k.parent_attnum
    WHERE c.contype = 'f'
      AND c.confrelid = 'public.onboarding_staff'::regclass
      AND c.confdeltype NOT IN ('n', 'c') -- not already SET NULL or CASCADE
    GROUP BY c.oid, c.conrelid, c.conname, c.confrelid, c.conkey, c.confkey, c.condeferrable, c.condeferred
  LOOP
    IF fk.all_child_cols_nullable THEN
      EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', fk.child_table, fk.conname);
      EXECUTE format(
        'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%s) REFERENCES %s (%s) ON DELETE SET NULL%s%s',
        fk.child_table,
        fk.conname,
        fk.child_cols,
        fk.parent_table,
        fk.parent_cols,
        CASE WHEN fk.condeferrable THEN ' DEFERRABLE' ELSE '' END,
        CASE WHEN fk.condeferred THEN ' INITIALLY DEFERRED' ELSE '' END
      );
    END IF;
  END LOOP;
END;
$$;