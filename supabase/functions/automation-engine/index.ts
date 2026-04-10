import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { trigger_type, trigger_data } = body;

    if (!trigger_type) {
      return new Response(
        JSON.stringify({ error: "trigger_type is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[automation-engine] Processing trigger: ${trigger_type}`, JSON.stringify(trigger_data));

    // Fetch active rules matching this trigger
    const { data: rules, error: rulesError } = await supabase
      .from("automation_rules")
      .select("*")
      .eq("trigger_type", trigger_type)
      .eq("is_active", true);

    if (rulesError) {
      throw new Error(`Error fetching rules: ${rulesError.message}`);
    }

    if (!rules || rules.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active rules for this trigger", executed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let executedCount = 0;

    for (const rule of rules) {
      try {
        // Check conditions
        const conditionsMet = evaluateConditions(rule.conditions, trigger_data);
        if (!conditionsMet) continue;

        // Execute action
        const result = await executeAction(supabase, rule, trigger_data);

        // Log success
        await supabase.from("automation_executions").insert({
          rule_id: rule.id,
          status: "success",
          trigger_data,
          action_result: result,
        });

        executedCount++;
      } catch (actionError: any) {
        console.error(`[automation-engine] Action error for rule ${rule.id}:`, actionError);
        // Log error
        await supabase.from("automation_executions").insert({
          rule_id: rule.id,
          status: "error",
          trigger_data,
          error_message: actionError.message || "Unknown error",
        });
      }
    }

    return new Response(
      JSON.stringify({ message: "OK", executed: executedCount, total_rules: rules.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Automation engine error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function evaluateConditions(conditions: any[], data: any): boolean {
  if (!conditions || conditions.length === 0) return true;

  return conditions.every((condition: any) => {
    const { field, operator, value } = condition;
    const actual = data?.[field];

    // Skip empty condition values (optional filters)
    if (value === undefined || value === null || value === "") return true;
    // Treat "any" / "todos" / "all" as wildcard — always matches
    if (typeof value === "string" && ["any", "todos", "all", "*"].includes(value.toLowerCase())) return true;
    if (actual === undefined || actual === null) return false;

    switch (operator) {
      case "eq":
        return String(actual).toLowerCase() === String(value).toLowerCase();
      case "neq":
        return actual != value;
      case "gt":
        return Number(actual) > Number(value);
      case "gte":
        return Number(actual) >= Number(value);
      case "lt":
        return Number(actual) < Number(value);
      case "lte":
        return Number(actual) <= Number(value);
      case "contains":
        return String(actual).toLowerCase().includes(String(value).toLowerCase());
      default:
        return true;
    }
  });
}

async function executeAction(supabase: any, rule: any, triggerData: any) {
  const { action_type, action_config } = rule;

  // Replace template variables in config
  const config = replaceVariables(action_config, triggerData);

  switch (action_type) {
    case "send_notification":
      return await executeSendNotification(supabase, config, triggerData);
    case "create_task":
      return await executeCreateTask(supabase, config, triggerData);
    case "move_lead_stage":
      return await executeMoveLeadStage(supabase, config, triggerData);
    case "create_crm_activity":
      return await executeCreateCrmActivity(supabase, config, triggerData);
    case "send_whatsapp":
      return await executeSendWhatsApp(supabase, config, triggerData);
    default:
      return { action: action_type, status: "not_implemented" };
  }
}

function replaceVariables(config: any, data: any): any {
  const str = JSON.stringify(config);
  const replaced = str.replace(/\{(\w+)\}/g, (_, key) => data?.[key] ?? `{${key}}`);
  return JSON.parse(replaced);
}

async function executeSendNotification(supabase: any, config: any, data: any) {
  const staffIds: string[] = [];

  if (config.target === "cs_responsible" && data.cs_id) {
    staffIds.push(data.cs_id);
  } else if (config.target === "consultant_responsible" && data.consultant_id) {
    staffIds.push(data.consultant_id);
  } else if (config.target === "both_responsible") {
    if (data.cs_id) staffIds.push(data.cs_id);
    if (data.consultant_id) staffIds.push(data.consultant_id);
  } else if (config.target === "specific_staff" && config.staff_id) {
    staffIds.push(config.staff_id);
  }

  if (staffIds.length === 0) {
    return { action: "send_notification", status: "no_target" };
  }

  const notifications = staffIds.map((staffId) => ({
    staff_id: staffId,
    project_id: data.project_id || null,
    type: "automation",
    title: config.title || "Automação executada",
    message: config.message || "Uma automação foi disparada.",
    reference_id: data.reference_id || null,
    reference_type: "automation",
  }));

  const { error } = await supabase
    .from("onboarding_notifications")
    .insert(notifications);

  if (error) throw new Error(`Notification error: ${error.message}`);
  return { action: "send_notification", sent_to: staffIds.length };
}

async function executeCreateTask(supabase: any, config: any, data: any) {
  if (!data.project_id) {
    return { action: "create_task", status: "no_project_id" };
  }

  const { error } = await supabase.from("onboarding_tasks").insert({
    project_id: data.project_id,
    title: config.title || "Tarefa automática",
    description: config.description || null,
    status: "pending",
    is_automated: true,
  });

  if (error) throw new Error(`Create task error: ${error.message}`);
  return { action: "create_task", status: "created" };
}

async function executeMoveLeadStage(supabase: any, config: any, data: any) {
  if (!data.lead_id || !config.target_stage_name) {
    return { action: "move_lead_stage", status: "missing_data" };
  }

  // Find stage by name
  const { data: stages } = await supabase
    .from("crm_stages")
    .select("id")
    .eq("name", config.target_stage_name)
    .limit(1);

  if (!stages || stages.length === 0) {
    return { action: "move_lead_stage", status: "stage_not_found" };
  }

  const { error } = await supabase
    .from("crm_leads")
    .update({ stage_id: stages[0].id })
    .eq("id", data.lead_id);

  if (error) throw new Error(`Move lead error: ${error.message}`);
  return { action: "move_lead_stage", status: "moved", stage: config.target_stage_name };
}

async function executeCreateCrmActivity(supabase: any, config: any, data: any) {
  if (!data.lead_id) {
    return { action: "create_crm_activity", status: "no_lead_id" };
  }

  const { error } = await supabase.from("crm_activities").insert({
    lead_id: data.lead_id,
    type: config.activity_type || "task",
    title: config.title || "Atividade automática",
    description: config.description || null,
    status: "pending",
    responsible_staff_id: data.staff_id || null,
  });

  if (error) throw new Error(`Create activity error: ${error.message}`);
  return { action: "create_crm_activity", status: "created" };
}

async function executeSendWhatsApp(supabase: any, config: any, data: any) {
  const message = config.message;
  if (!message) {
    return { action: "send_whatsapp", status: "no_message" };
  }

  // Determine recipient
  let targetNumber = "";
  const targetType = config.target_type || config.target || "phone";

  if (targetType === "phone" || targetType === "group") {
    targetNumber = config.target_phone || "";
  } else if (targetType === "lead_phone" && data.lead_phone) {
    targetNumber = data.lead_phone;
  } else if (targetType === "cs_responsible" && data.cs_phone) {
    targetNumber = data.cs_phone;
  } else if (targetType === "consultant_responsible" && data.consultant_phone) {
    targetNumber = data.consultant_phone;
  } else if (targetType === "client_phone" && data.client_phone) {
    targetNumber = data.client_phone;
  }

  if (!targetNumber) {
    return { action: "send_whatsapp", status: "no_target_number" };
  }

  // Find the WhatsApp instance
  const instanceName = config.instance_name || "";
  if (!instanceName) {
    return { action: "send_whatsapp", status: "no_instance_name" };
  }

  // Lookup instance from DB
  const { data: instances } = await supabase
    .from("whatsapp_instances")
    .select("id, instance_name, api_url, api_key")
    .ilike("instance_name", `%${instanceName}%`)
    .eq("status", "connected")
    .limit(1);

  if (!instances || instances.length === 0) {
    console.error(`[automation-engine] WhatsApp instance not found: ${instanceName}`);
    return { action: "send_whatsapp", status: "instance_not_found", instance: instanceName };
  }

  const instance = instances[0];

  // Determine if it's a group (JID ends with @g.us)
  const isGroup = targetNumber.includes("@g.us");
  const formattedNumber = isGroup
    ? targetNumber
    : targetNumber.replace(/\D/g, "");

  console.log(`[automation-engine] Sending WhatsApp via ${instance.instance_name} to ${formattedNumber}`);

  try {
    const sendUrl = `${instance.api_url}/message/sendText/${instance.instance_name}`;
    const response = await fetch(sendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: instance.api_key,
      },
      body: JSON.stringify({
        number: formattedNumber,
        text: message,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[automation-engine] WhatsApp send error [${response.status}]:`, errText);
      // Treat 504 as accepted (server timeout but message likely sent)
      if (response.status === 504) {
        return { action: "send_whatsapp", status: "accepted_timeout", target: formattedNumber };
      }
      throw new Error(`WhatsApp send failed [${response.status}]: ${errText}`);
    }

    const result = await response.json();
    return { action: "send_whatsapp", status: "sent", target: formattedNumber, result };
  } catch (err: any) {
    throw new Error(`WhatsApp send error: ${err.message}`);
  }
}
