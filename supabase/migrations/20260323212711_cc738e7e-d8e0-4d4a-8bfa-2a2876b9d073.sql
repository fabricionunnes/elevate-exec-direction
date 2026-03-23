
CREATE OR REPLACE FUNCTION public.merge_crm_leads(p_primary_lead_id uuid, p_secondary_lead_ids uuid[])
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_primary RECORD;
  v_secondary RECORD;
  v_sid uuid;
  v_merged_count int := 0;
BEGIN
  -- Get primary lead
  SELECT * INTO v_primary FROM crm_leads WHERE id = p_primary_lead_id;
  IF v_primary IS NULL THEN
    RETURN json_build_object('error', 'Lead principal não encontrado');
  END IF;

  FOREACH v_sid IN ARRAY p_secondary_lead_ids LOOP
    IF v_sid = p_primary_lead_id THEN
      CONTINUE;
    END IF;

    SELECT * INTO v_secondary FROM crm_leads WHERE id = v_sid;
    IF v_secondary IS NULL THEN
      CONTINUE;
    END IF;

    -- Fill missing fields on primary from secondary
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
    WHERE crm_leads.id = p_primary_lead_id;

    -- Move tags from secondary to primary (ignore duplicates)
    INSERT INTO crm_lead_tags (lead_id, tag_id)
    SELECT p_primary_lead_id, tag_id FROM crm_lead_tags WHERE lead_id = v_sid
    ON CONFLICT DO NOTHING;

    -- Move activities/events referencing the secondary lead
    UPDATE crm_lead_activities SET lead_id = p_primary_lead_id WHERE lead_id = v_sid;

    -- Move meeting events
    UPDATE crm_meeting_events SET lead_id = p_primary_lead_id WHERE lead_id = v_sid;

    -- Move form responses
    UPDATE crm_lead_form_responses SET lead_id = p_primary_lead_id WHERE lead_id = v_sid;

    -- Delete secondary lead tags first, then the lead
    DELETE FROM crm_lead_tags WHERE lead_id = v_sid;
    DELETE FROM crm_leads WHERE id = v_sid;

    v_merged_count := v_merged_count + 1;
  END LOOP;

  RETURN json_build_object('success', true, 'merged_count', v_merged_count);
END;
$$;
