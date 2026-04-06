
CREATE OR REPLACE FUNCTION public.bulk_merge_phone_duplicates(p_batch_size int DEFAULT 1000, p_offset int DEFAULT 0)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '300s'
SET search_path TO 'public'
AS $$
DECLARE
  v_group RECORD;
  v_secondary_id uuid;
  v_secondary RECORD;
  v_merged_count int := 0;
  v_groups_processed int := 0;
BEGIN
  FOR v_group IN
    WITH normalized AS (
      SELECT id, phone, created_at,
        right(regexp_replace(phone, '[^0-9]', '', 'g'), 8) AS phone_key
      FROM crm_leads
      WHERE phone IS NOT NULL 
        AND length(regexp_replace(phone, '[^0-9]', '', 'g')) >= 8
    ),
    grouped AS (
      SELECT phone_key, 
        array_agg(id ORDER BY created_at ASC) AS all_ids,
        count(*) AS cnt
      FROM normalized
      WHERE length(phone_key) = 8
      GROUP BY phone_key
      HAVING count(*) > 1
      ORDER BY phone_key
      LIMIT p_batch_size OFFSET p_offset
    )
    SELECT phone_key, all_ids[1] AS primary_id, all_ids[2:] AS secondary_ids, cnt
    FROM grouped
  LOOP
    v_groups_processed := v_groups_processed + 1;
    
    FOREACH v_secondary_id IN ARRAY v_group.secondary_ids LOOP
      SELECT * INTO v_secondary FROM crm_leads WHERE id = v_secondary_id;
      IF v_secondary IS NULL THEN CONTINUE; END IF;

      -- Fill missing fields on primary
      UPDATE crm_leads SET
        phone = COALESCE(crm_leads.phone, v_secondary.phone),
        email = COALESCE(crm_leads.email, v_secondary.email),
        company = COALESCE(crm_leads.company, v_secondary.company),
        document = COALESCE(crm_leads.document, v_secondary.document),
        city = COALESCE(crm_leads.city, v_secondary.city),
        state = COALESCE(crm_leads.state, v_secondary.state),
        segment = COALESCE(crm_leads.segment, v_secondary.segment),
        notes = CASE
          WHEN crm_leads.notes IS NULL AND v_secondary.notes IS NOT NULL THEN v_secondary.notes
          WHEN crm_leads.notes IS NOT NULL AND v_secondary.notes IS NOT NULL THEN crm_leads.notes || E'\n---\n' || v_secondary.notes
          ELSE crm_leads.notes
        END,
        opportunity_value = CASE
          WHEN COALESCE(crm_leads.opportunity_value, 0) < COALESCE(v_secondary.opportunity_value, 0)
          THEN v_secondary.opportunity_value
          ELSE crm_leads.opportunity_value
        END,
        updated_at = now()
      WHERE crm_leads.id = v_group.primary_id;

      -- Move related data
      INSERT INTO crm_lead_tags (lead_id, tag_id)
      SELECT v_group.primary_id, tag_id FROM crm_lead_tags WHERE lead_id = v_secondary_id
      ON CONFLICT DO NOTHING;

      UPDATE crm_lead_activities SET lead_id = v_group.primary_id WHERE lead_id = v_secondary_id;
      UPDATE crm_meeting_events SET lead_id = v_group.primary_id WHERE lead_id = v_secondary_id;
      UPDATE crm_lead_form_responses SET lead_id = v_group.primary_id WHERE lead_id = v_secondary_id;

      -- Delete secondary
      DELETE FROM crm_lead_tags WHERE lead_id = v_secondary_id;
      DELETE FROM crm_leads WHERE id = v_secondary_id;

      v_merged_count := v_merged_count + 1;
    END LOOP;
  END LOOP;

  RETURN json_build_object(
    'success', true, 
    'groups_processed', v_groups_processed,
    'leads_merged', v_merged_count
  );
END;
$$;
