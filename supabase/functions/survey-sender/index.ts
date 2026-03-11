import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PUBLIC_DOMAIN = "https://elevate-exec-direction.lovable.app";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));
    const surveyType = body.type || "all"; // "nps", "csat", or "all"
    const isManual = body.manual === true;
    const isTest = body.test === true;
    const testCompanyId = body.test_company_id || null;

    let totalSent = 0;

    // Process NPS
    if (surveyType === "nps" || surveyType === "all") {
      totalSent += await processNPS(supabase, isManual, isTest, testCompanyId);
    }

    // Process CSAT
    if (surveyType === "csat" || surveyType === "all") {
      totalSent += await processCSAT(supabase, isManual, isTest, testCompanyId);
    }

    return new Response(JSON.stringify({ success: true, sent: totalSent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Survey sender error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processNPS(supabase: any, _isManual: boolean, isTest: boolean = false, testCompanyId: string | null = null): Promise<number> {
  // Get NPS config
  const { data: config } = await supabase
    .from("survey_send_configs")
    .select("*")
    .eq("survey_type", "nps")
    .eq("is_active", true)
    .single();

  if (!config) return 0;

  // Get NPS rules sorted by day_offset
  const { data: rules } = await supabase
    .from("survey_send_rules")
    .select("*")
    .eq("config_id", config.id)
    .eq("is_active", true)
    .order("sort_order");

  if (!rules || rules.length === 0) return 0;

  // Get projects with company info and phone
  let projectsQuery = supabase
    .from("onboarding_projects")
    .select(`
      id, product_name, status,
      onboarding_companies!inner(id, name, phone, status)
    `);

  // In test mode, allow any project status; in normal mode only active projects
  if (!isTest) {
    projectsQuery = projectsQuery.eq("status", "active");
  }

  const { data: projects, error: projectsError } = await projectsQuery;

  if (projectsError) {
    console.error("Error fetching projects:", projectsError);
    return 0;
  }

  if (projectsError) {
    console.error("Error fetching projects:", projectsError);
    return 0;
  }

  if (!projects || projects.length === 0) {
    console.log("No projects found" + (isTest ? ` for company ${testCompanyId}` : ""));
    return 0;
  }

  const frequencyDays = config.nps_frequency_days || 30;
  const maxFollowUps = config.max_follow_ups || 5;
  const now = new Date();
  let sent = 0;

  // Group projects by company to avoid sending multiple NPS to the same company
  const companyMap = new Map<string, { companyId: string; companyName: string; phone: string; projectId: string }>();
  for (const project of projects) {
    const company = (project as any).onboarding_companies;
    if (!company) continue;
    // Skip inactive companies only in non-test mode
    if (!isTest && company.status !== "active") continue;
    // In test mode, only include the selected company
    if (isTest && testCompanyId && company.id !== testCompanyId) continue;
    const phone = cleanPhone(company.phone);
    if (!phone) {
      console.log(`Company ${company.name} (${company.id}) has no valid phone: ${company.phone}`);
      continue;
    }
    // Keep only the first project per company
    if (!companyMap.has(company.id)) {
      companyMap.set(company.id, {
        companyId: company.id,
        companyName: company.name,
        phone,
        projectId: project.id,
      });
    }
  }

  console.log(`CompanyMap has ${companyMap.size} entries` + (isTest ? " (test mode)" : ""));

  for (const entry of companyMap.values()) {
    const { companyId, companyName, phone, projectId } = entry;

    // In test mode, skip all eligibility checks and always use the first rule
    let ruleToSend: any = null;
    let attemptNumber = 1;

    if (isTest) {
      ruleToSend = rules[0];
    } else {
      // Check last NPS response for this company (any project)
      const { data: lastResponse } = await supabase
        .from("onboarding_nps_responses")
        .select("created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // If responded recently, skip
      if (lastResponse) {
        const daysSinceResponse = daysBetween(new Date(lastResponse.created_at), now);
        if (daysSinceResponse < frequencyDays) continue;
      }

      // Check last send log for this company
      const { data: lastLogs } = await supabase
        .from("survey_send_log")
        .select("*")
        .eq("company_id", companyId)
        .eq("survey_type", "nps")
        .in("status", ["sent", "pending"])
        .order("created_at", { ascending: false })
        .limit(1);

      const lastLog = lastLogs?.[0];

      if (!lastLog) {
        ruleToSend = rules[0];
        attemptNumber = 1;
      } else {
        const daysSinceLastSend = daysBetween(new Date(lastLog.sent_at || lastLog.created_at), now);
        attemptNumber = (lastLog.attempt_number || 0) + 1;

        if (attemptNumber > maxFollowUps) continue;

        const ruleIndex = attemptNumber - 1;
        if (ruleIndex < rules.length) {
          const currentRule = rules[ruleIndex];
          const prevRule = ruleIndex > 0 ? rules[ruleIndex - 1] : null;
          const daysNeeded = prevRule ? currentRule.day_offset - prevRule.day_offset : currentRule.day_offset;
          if (daysSinceLastSend < daysNeeded) {
            ruleToSend = null;
          } else {
            ruleToSend = currentRule;
          }
        }
      }
    }

    if (!ruleToSend) continue;

    // Generate NPS link using hash route format for WhatsApp compatibility
    const npsLink = `${PUBLIC_DOMAIN}/#/nps?project=${encodeURIComponent(projectId)}`;

    // Replace template variables
    const message = ruleToSend.message_template
      .replace(/\{nome\}/g, companyName || "")
      .replace(/\{empresa\}/g, companyName || "")
      .replace(/\{link\}/g, npsLink);

    // Send via WhatsApp
    const instanceName = await getInstanceName(supabase, config.whatsapp_instance_name);
    console.log(`Sending to ${phone} via instance ${instanceName}`);
    const sendResult = await sendWhatsApp(supabase, instanceName, phone, message);
    console.log(`Send result:`, JSON.stringify(sendResult));

    // Log the send
    await supabase.from("survey_send_log").insert({
      config_id: config.id,
      rule_id: ruleToSend.id,
      project_id: projectId,
      company_id: companyId,
      survey_type: "nps",
      phone,
      contact_name: companyName,
      survey_link: npsLink,
      status: sendResult.success ? "sent" : "failed",
      attempt_number: attemptNumber,
      sent_at: sendResult.success ? new Date().toISOString() : null,
      error_message: sendResult.error || null,
    });

    if (sendResult.success) sent++;

    // Delay between sends to avoid rate limiting
    await new Promise((r) => setTimeout(r, 2000));
  }

  return sent;
}

async function processCSAT(supabase: any, _isManual: boolean, isTest: boolean = false, testCompanyId: string | null = null): Promise<number> {
  // Get CSAT config
  const { data: config } = await supabase
    .from("survey_send_configs")
    .select("*")
    .eq("survey_type", "csat")
    .eq("is_active", true)
    .single();

  if (!config) return 0;

  // Get CSAT rules sorted by sort_order
  const { data: rules } = await supabase
    .from("survey_send_rules")
    .select("*")
    .eq("config_id", config.id)
    .eq("is_active", true)
    .order("sort_order");

  if (!rules || rules.length === 0) return 0;

  const maxFollowUps = config.max_follow_ups || 3;
  const now = new Date();

  // TEST MODE: Find the latest finalized meeting for the company and use its real CSAT link
  if (isTest && testCompanyId) {
    // Get company info
    const { data: company } = await supabase
      .from("onboarding_companies")
      .select("id, name, phone")
      .eq("id", testCompanyId)
      .single();

    if (!company) { console.log("Test CSAT: company not found"); return 0; }
    const phone = cleanPhone(company.phone);
    if (!phone) { console.log(`Test CSAT: no valid phone for ${company.name}`); return 0; }

    // Get projects for this company (try both foreign keys)
    let { data: projects } = await supabase
      .from("onboarding_projects")
      .select("id")
      .eq("onboarding_company_id", testCompanyId);

    if (!projects || projects.length === 0) {
      const res = await supabase
        .from("onboarding_projects")
        .select("id")
        .eq("company_id", testCompanyId);
      projects = res.data;
    }

    if (!projects || projects.length === 0) {
      console.log(`Test CSAT: no projects found for company ${company.name}`);
      return 0;
    }

    const projectIds = projects.map((p: any) => p.id);

    // Find the latest finalized meeting for any of this company's projects
    const { data: latestMeeting } = await supabase
      .from("onboarding_meeting_notes")
      .select("id, subject, meeting_title, meeting_date, project_id, is_finalized")
      .in("project_id", projectIds)
      .eq("is_finalized", true)
      .order("meeting_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    let csatLink: string;
    let meetingSubject = "Reunião de Teste";
    let meetingDate = new Date().toLocaleDateString("pt-BR");
    let meetingId: string | null = null;
    let csatSurveyId: string | null = null;
    const projectId = latestMeeting?.project_id || projectIds[0];

    if (latestMeeting) {
      meetingSubject = latestMeeting.subject || latestMeeting.meeting_title || "Reunião";
      meetingDate = latestMeeting.meeting_date
        ? formatDateBR(latestMeeting.meeting_date)
        : meetingDate;
      meetingId = latestMeeting.id;

      // Check if a csat_survey already exists for this meeting
      const { data: existingSurvey } = await supabase
        .from("csat_surveys")
        .select("id, access_token")
        .eq("meeting_id", latestMeeting.id)
        .maybeSingle();

      if (existingSurvey) {
        csatLink = `${PUBLIC_DOMAIN}/#/csat?token=${existingSurvey.access_token}`;
        csatSurveyId = existingSurvey.id;
      } else {
        // Create a csat_survey for this meeting
        const { data: newSurvey } = await supabase
          .from("csat_surveys")
          .insert({ project_id: projectId, meeting_id: latestMeeting.id })
          .select("id, access_token")
          .single();

        if (newSurvey) {
          csatLink = `${PUBLIC_DOMAIN}/#/csat?token=${newSurvey.access_token}`;
          csatSurveyId = newSurvey.id;
        } else {
          csatLink = `${PUBLIC_DOMAIN}/#/csat?test=true`;
        }
      }
    } else {
      // No finalized meeting found, use placeholder
      console.log(`Test CSAT: no finalized meetings for company ${company.name}, using placeholder`);
      csatLink = `${PUBLIC_DOMAIN}/#/csat?test=true`;
    }

    const ruleToSend = rules[0];
    const message = ruleToSend.message_template
      .replace(/\{nome\}/g, company.name || "")
      .replace(/\{empresa\}/g, company.name || "")
      .replace(/\{link\}/g, csatLink)
      .replace(/\{assunto_reuniao\}/g, meetingSubject)
      .replace(/\{data_reuniao\}/g, meetingDate);

    const instanceName = await getInstanceName(supabase, config.whatsapp_instance_name);
    console.log(`Test CSAT: Sending to ${phone} via instance ${instanceName}, link: ${csatLink}`);
    const sendResult = await sendWhatsApp(supabase, instanceName, phone, message);
    console.log(`Test CSAT result:`, JSON.stringify(sendResult));

    await supabase.from("survey_send_log").insert({
      config_id: config.id,
      rule_id: ruleToSend.id,
      project_id: projectId,
      company_id: company.id,
      survey_type: "csat",
      phone,
      contact_name: company.name,
      survey_link: csatLink,
      meeting_id: meetingId,
      meeting_subject: meetingSubject,
      csat_survey_id: csatSurveyId,
      status: sendResult.success ? "sent" : "failed",
      attempt_number: 1,
      sent_at: sendResult.success ? new Date().toISOString() : null,
      error_message: sendResult.error || null,
    });

    return sendResult.success ? 1 : 0;
  }

  // NORMAL MODE: Find finalized meetings that need CSAT sends
  const { data: surveys } = await supabase
    .from("csat_surveys")
    .select(`
      id, access_token, status, meeting_id, project_id, created_at,
      onboarding_meeting_notes!inner(id, subject, meeting_title, meeting_date, is_finalized)
    `)
    .eq("status", "pending")
    .not("meeting_id", "is", null);

  if (!surveys || surveys.length === 0) return 0;

  let sent = 0;

  for (const survey of surveys) {
    const meeting = (survey as any).onboarding_meeting_notes;
    if (!meeting?.is_finalized) continue;

    const { data: project } = await supabase
      .from("onboarding_projects")
      .select("id, onboarding_companies(id, name, phone)")
      .eq("id", survey.project_id)
      .single();

    if (!project) continue;
    const company = (project as any).onboarding_companies;
    if (!company) continue;

    const phone = cleanPhone(company.phone);
    if (!phone) continue;

    const { data: existingLogs } = await supabase
      .from("survey_send_log")
      .select("*")
      .eq("csat_survey_id", survey.id)
      .eq("survey_type", "csat")
      .order("attempt_number", { ascending: false })
      .limit(1);

    const lastLog = existingLogs?.[0];
    let attemptNumber = 1;

    if (lastLog) {
      attemptNumber = (lastLog.attempt_number || 0) + 1;
      if (attemptNumber > maxFollowUps) continue;

      const ruleIndex = attemptNumber - 1;
      if (ruleIndex >= rules.length) continue;

      const currentRule = rules[ruleIndex];
      const prevRule = ruleIndex > 0 ? rules[ruleIndex - 1] : null;
      const daysNeeded = prevRule ? currentRule.day_offset - prevRule.day_offset : currentRule.day_offset;
      const daysSinceLastSend = daysBetween(new Date(lastLog.sent_at || lastLog.created_at), now);
      if (daysSinceLastSend < daysNeeded) continue;
    }

    const ruleIndex = attemptNumber - 1;
    if (ruleIndex >= rules.length) continue;
    const ruleToSend = rules[ruleIndex];

    const csatLink = `${PUBLIC_DOMAIN}/#/csat?token=${survey.access_token}`;
    const meetingSubject = meeting.subject || meeting.meeting_title || "Reunião";
    const meetingDate = meeting.meeting_date
      ? formatDateBR(meeting.meeting_date)
      : "";

    const message = ruleToSend.message_template
      .replace(/\{nome\}/g, company.name || "")
      .replace(/\{empresa\}/g, company.name || "")
      .replace(/\{link\}/g, csatLink)
      .replace(/\{assunto_reuniao\}/g, meetingSubject)
      .replace(/\{data_reuniao\}/g, meetingDate);

    const instanceName = await getInstanceName(supabase, config.whatsapp_instance_name);
    const sendResult = await sendWhatsApp(supabase, instanceName, phone, message);

    await supabase.from("survey_send_log").insert({
      config_id: config.id,
      rule_id: ruleToSend.id,
      project_id: survey.project_id,
      company_id: company.id,
      survey_type: "csat",
      phone,
      contact_name: company.name,
      survey_link: csatLink,
      meeting_id: survey.meeting_id,
      meeting_subject: meetingSubject,
      csat_survey_id: survey.id,
      status: sendResult.success ? "sent" : "failed",
      attempt_number: attemptNumber,
      sent_at: sendResult.success ? new Date().toISOString() : null,
      error_message: sendResult.error || null,
    });

    if (sendResult.success) sent++;
    await new Promise((r) => setTimeout(r, 1500));
  }

  return sent;
}

async function getInstanceName(supabase: any, configInstance: string | null): Promise<string> {
  if (configInstance) return configInstance;
  const { data } = await supabase
    .from("whatsapp_default_config")
    .select("setting_value")
    .eq("setting_key", "default_instance")
    .maybeSingle();
  return data?.setting_value || "fabricionunnes";
}

async function sendWhatsApp(
  supabase: any,
  instanceName: string,
  phone: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get instance info including api_url and api_key
    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("id, instance_name, api_url, api_key")
      .eq("instance_name", instanceName)
      .eq("status", "connected")
      .single();

    if (!instance) return { success: false, error: "Instância não encontrada ou desconectada" };

    // Get Evolution API credentials
    // Use instance api_url if available (instance may be on a different server), fallback to env
    const EVOLUTION_API_URL = instance.api_url || Deno.env.get("EVOLUTION_API_URL");
    // Use instance api_key if available (each server has its own Global API Key), fallback to env
    const EVOLUTION_API_KEY = instance.api_key || Deno.env.get("EVOLUTION_API_KEY");

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      return { success: false, error: "Evolution API credentials not configured" };
    }

    const baseUrl = EVOLUTION_API_URL.replace(/\/manager\/?$/i, "").replace(/\/+$/g, "");

    // Call Evolution API directly to send text message
    const sendUrl = `${baseUrl}/message/sendText/${instance.instance_name}`;
    const response = await fetch(sendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_API_KEY,
        Authorization: `Bearer ${EVOLUTION_API_KEY}`,
      },
      body: JSON.stringify({
        number: phone,
        text: message,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${errText.substring(0, 200)}` };
    }

    await response.text(); // consume body
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

function cleanPhone(phone: string | null): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

function daysBetween(d1: Date, d2: Date): number {
  const diff = d2.getTime() - d1.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function formatDateBR(dateStr: string): string {
  // Parse date string (YYYY-MM-DD or ISO) and format as DD/MM/YYYY
  const parts = dateStr.substring(0, 10).split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}
