import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { recordingId, companies } = await req.json();

    if (!recordingId || !companies || !Array.isArray(companies) || companies.length === 0) {
      return new Response(JSON.stringify({ error: "recordingId and companies array required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get recording info
    const { data: recording, error: recError } = await supabase
      .from("hotseat_recordings")
      .select("id, summary, recording_date")
      .eq("id", recordingId)
      .single();

    if (recError || !recording) {
      return new Response(JSON.stringify({ error: "Recording not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get staff id of the current user
    const { data: staff } = await supabase
      .from("onboarding_staff")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    const staffId = staff?.id || null;

    // Fetch all hotseat responses with linked projects to cross-reference
    const { data: hotseatResponses } = await supabase
      .from("hotseat_responses")
      .select("respondent_name, company_name, linked_company_id, linked_project_id")
      .not("linked_project_id", "is", null);

    // For each company, find the matching project and generate tasks
    const results: { company: string; projectId: string | null; tasksCreated: number; error?: string }[] = [];

    for (const company of companies) {
      const companyName = company.name;
      const actionItems = company.action_items || [];
      const recommendations = company.recommendations || [];
      const challenges = company.challenges || [];

      if (!companyName) continue;

      let projectId: string | null = null;
      let responsibleStaffId: string | null = null;

      // Strategy 1: Match via hotseat_responses (most reliable)
      if (hotseatResponses?.length) {
        const companyLower = companyName.toLowerCase();
        const match = hotseatResponses.find(r => {
          const respCompany = (r.company_name || "").toLowerCase();
          const respName = (r.respondent_name || "").toLowerCase();
          // Check if response company name is in the AI company name or vice versa
          return companyLower.includes(respCompany) || respCompany.includes(companyLower.split("(")[0].trim()) ||
            // Check respondent name match (e.g. "Dr. Webbson Kennedy (Clínica)" matches respondent "Webbson Kennedy")
            companyLower.includes(respName.split(" ").slice(0, 2).join(" ").toLowerCase()) ||
            // Check name in parentheses
            (companyName.includes("(") && respCompany.includes(companyName.match(/\(([^)]+)\)/)?.[1]?.toLowerCase() || "___"));
        });

        if (match?.linked_project_id) {
          projectId = match.linked_project_id;

          // Get consultant/cs from the company
          if (match.linked_company_id) {
            const { data: comp } = await supabase
              .from("onboarding_companies")
              .select("consultant_id, cs_id")
              .eq("id", match.linked_company_id)
              .maybeSingle();
            responsibleStaffId = comp?.consultant_id || comp?.cs_id || null;
          }
        }
      }

      // Strategy 2: Fallback to name search in onboarding_companies
      if (!projectId) {
        const { data: matchedCompanies } = await supabase
          .from("onboarding_companies")
          .select("id, name, consultant_id, cs_id")
          .ilike("name", `%${companyName.split("(")[0].trim().split(" ").slice(0, 2).join(" ")}%`)
          .eq("status", "active")
          .limit(5);

        let matchedCompany = matchedCompanies?.[0] || null;

        if (!matchedCompany && companyName.includes("(")) {
          const nameInParens = companyName.match(/\(([^)]+)\)/)?.[1];
          if (nameInParens) {
            const { data: fallback } = await supabase
              .from("onboarding_companies")
              .select("id, name, consultant_id, cs_id")
              .ilike("name", `%${nameInParens.trim()}%`)
              .eq("status", "active")
              .limit(3);
            matchedCompany = fallback?.[0] || null;
          }
        }

        if (matchedCompany) {
          responsibleStaffId = matchedCompany.consultant_id || matchedCompany.cs_id || null;
          const { data: projects } = await supabase
            .from("onboarding_projects")
            .select("id")
            .eq("onboarding_company_id", matchedCompany.id)
            .eq("status", "active")
            .limit(1);
          projectId = projects?.[0]?.id || null;
        }
      }

      if (!projectId) {
        results.push({ company: companyName, projectId: null, tasksCreated: 0, error: "Empresa não encontrada" });
        continue;
      }

      // Use AI to generate structured tasks from the action_items + recommendations
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      
      const taskItems = [...actionItems, ...recommendations.filter((r: string) => !actionItems.some((a: string) => a.toLowerCase().includes(r.toLowerCase().substring(0, 20))))];

      if (taskItems.length === 0) {
        results.push({ company: companyName, projectId, tasksCreated: 0, error: "Sem ações identificadas" });
        continue;
      }

      let tasks: { title: string; description: string; priority: string }[] = [];

      if (LOVABLE_API_KEY) {
        try {
          const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                {
                  role: "system",
                  content: `Você é um assistente que transforma itens de ação de reuniões em tarefas estruturadas para um sistema de gestão de projetos.
Retorne APENAS um JSON array com objetos contendo: title (max 80 chars, direto e acionável), description (contexto e detalhes), priority (high/medium/low).
Agrupe ações similares quando fizer sentido. Cada tarefa deve ser concreta e executável.
NÃO inclua explicações, apenas o JSON array.`
                },
                {
                  role: "user",
                  content: `Empresa: ${companyName}\n\nDesafios identificados:\n${challenges.join("\n")}\n\nAções e recomendações:\n${taskItems.join("\n")}\n\nTransforme em tarefas acionáveis.`
                }
              ],
              temperature: 0.3,
            }),
          });

          if (aiRes.ok) {
            const aiData = await aiRes.json();
            const content = aiData.choices?.[0]?.message?.content || "";
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              tasks = JSON.parse(jsonMatch[0]);
            }
          }
        } catch (e) {
          console.error("AI task generation failed, falling back:", e);
        }
      }

      // Fallback: create tasks directly from action_items
      if (tasks.length === 0) {
        tasks = actionItems.map((item: string) => ({
          title: item.length > 80 ? item.substring(0, 77) + "..." : item,
          description: `Ação identificada no Hotseat para ${companyName}.\n\nDesafios: ${challenges.join("; ")}`,
          priority: "high",
        }));
      }

      // Use responsible staff found earlier, or fallback to current user
      const finalStaffId = responsibleStaffId || staffId;

      // Calculate due date (5 business days from now)
      const { data: dueDateResult } = await supabase.rpc("get_next_business_day", {
        start_date: new Date().toISOString().split("T")[0],
        days_to_add: 5,
      });

      const dueDate = dueDateResult || new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

      // Insert tasks
      const tasksToInsert = tasks.map((task, idx) => ({
        project_id: projectId,
        title: `[Hotseat] ${task.title}`,
        description: task.description || `Tarefa gerada a partir do Hotseat`,
        status: "pending",
        priority: task.priority || "high",
        responsible_staff_id: finalStaffId,
        due_date: dueDate,
        sort_order: idx,
        tags: ["hotseat"],
      }));

      const { error: insertError } = await supabase
        .from("onboarding_tasks")
        .insert(tasksToInsert);

      if (insertError) {
        console.error("Error inserting tasks:", insertError);
        results.push({ company: companyName, projectId, tasksCreated: 0, error: insertError.message });
      } else {
        results.push({ company: companyName, projectId, tasksCreated: tasksToInsert.length });
      }
    }

    const totalTasks = results.reduce((sum, r) => sum + r.tasksCreated, 0);

    return new Response(JSON.stringify({ success: true, totalTasks, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-hotseat-tasks:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
