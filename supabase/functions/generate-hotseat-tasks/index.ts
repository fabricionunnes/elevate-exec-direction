import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Brazilian holidays 2024-2028
const BRAZILIAN_HOLIDAYS: Record<string, string[]> = {
  "2024": ["2024-01-01","2024-02-12","2024-02-13","2024-03-29","2024-04-21","2024-05-01","2024-05-30","2024-09-07","2024-10-12","2024-11-02","2024-11-15","2024-11-20","2024-12-25"],
  "2025": ["2025-01-01","2025-03-03","2025-03-04","2025-04-18","2025-04-21","2025-05-01","2025-06-19","2025-09-07","2025-10-12","2025-11-02","2025-11-15","2025-11-20","2025-12-25"],
  "2026": ["2026-01-01","2026-02-16","2026-02-17","2026-04-03","2026-04-21","2026-05-01","2026-06-04","2026-09-07","2026-10-12","2026-11-02","2026-11-15","2026-11-20","2026-12-25"],
  "2027": ["2027-01-01","2027-02-08","2027-02-09","2027-03-26","2027-04-21","2027-05-01","2027-05-27","2027-09-07","2027-10-12","2027-11-02","2027-11-15","2027-11-20","2027-12-25"],
  "2028": ["2028-01-01","2028-02-28","2028-02-29","2028-04-14","2028-04-21","2028-05-01","2028-06-08","2028-09-07","2028-10-12","2028-11-02","2028-11-15","2028-11-20","2028-12-25"],
};

function isBusinessDay(date: Date): boolean {
  const day = date.getDay();
  if (day === 0 || day === 6) return false;
  const dateStr = date.toISOString().split("T")[0];
  const year = String(date.getFullYear());
  const holidays = BRAZILIAN_HOLIDAYS[year] || [];
  return !holidays.includes(dateStr);
}

function addBusinessDays(startDate: Date, days: number): Date {
  const result = new Date(startDate);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    if (isBusinessDay(result)) added++;
  }
  return result;
}

function getNextBusinessDay(date: Date): Date {
  const result = new Date(date);
  while (!isBusinessDay(result)) {
    result.setDate(result.getDate() + 1);
  }
  return result;
}

/** Distribute N tasks evenly across 1..maxBusinessDays business days */
function distributeBusinessDays(taskCount: number, maxBusinessDays: number): Date[] {
  if (taskCount <= 0) return [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = addBusinessDays(today, 1); // next business day

  if (taskCount === 1) return [startDate];

  const dates: Date[] = [];
  for (let i = 0; i < taskCount; i++) {
    // Spread from day 0 to maxBusinessDays-1
    const businessDayOffset = Math.round((i / (taskCount - 1)) * (maxBusinessDays - 1));
    const taskDate = businessDayOffset === 0 ? new Date(startDate) : addBusinessDays(today, 1 + businessDayOffset);
    dates.push(taskDate);
  }
  return dates;
}

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

    const { data: recording, error: recError } = await supabase
      .from("hotseat_recordings")
      .select("id, summary, recording_date")
      .eq("id", recordingId)
      .single();

    if (recError || !recording) {
      return new Response(JSON.stringify({ error: "Recording not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: staff } = await supabase
      .from("onboarding_staff")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    const staffId = staff?.id || null;

    const { data: hotseatResponses } = await supabase
      .from("hotseat_responses")
      .select("respondent_name, company_name, linked_company_id, linked_project_id")
      .not("linked_project_id", "is", null);

    const results: { company: string; projectId: string | null; tasksCreated: number; error?: string }[] = [];

    for (const company of companies) {
      const companyName = company.name;
      const actionItems = company.action_items || [];
      const recommendations = company.recommendations || [];
      const challenges = company.challenges || [];

      if (!companyName) continue;

      let projectId: string | null = null;
      let responsibleStaffId: string | null = null;

      // Strategy 0: Manual override from UI linking
      if (company.override_company_id) {
        const { data: overrideCompany } = await supabase
          .from("onboarding_companies")
          .select("id, name, consultant_id, cs_id")
          .eq("id", company.override_company_id)
          .maybeSingle();

        if (overrideCompany) {
          responsibleStaffId = overrideCompany.consultant_id || overrideCompany.cs_id || null;
          const { data: projects } = await supabase
            .from("onboarding_projects")
            .select("id")
            .eq("onboarding_company_id", overrideCompany.id)
            .eq("status", "active")
            .limit(1);
          projectId = projects?.[0]?.id || null;
        }
      }

      // Strategy 1: Match via hotseat_responses
      if (!projectId && hotseatResponses?.length) {
        const companyLower = companyName.toLowerCase();
        const match = hotseatResponses.find(r => {
          const respCompany = (r.company_name || "").toLowerCase();
          const respName = (r.respondent_name || "").toLowerCase();
          return companyLower.includes(respCompany) || respCompany.includes(companyLower.split("(")[0].trim()) ||
            companyLower.includes(respName.split(" ").slice(0, 2).join(" ").toLowerCase()) ||
            (companyName.includes("(") && respCompany.includes(companyName.match(/\(([^)]+)\)/)?.[1]?.toLowerCase() || "___"));
        });

        if (match?.linked_project_id) {
          projectId = match.linked_project_id;
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

      // Strategy 2: Fallback to name search
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

      // AI task generation
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      
      const taskItems = [...actionItems, ...recommendations.filter((r: string) => !actionItems.some((a: string) => a.toLowerCase().includes(r.toLowerCase().substring(0, 20))))];

      if (taskItems.length === 0) {
        results.push({ company: companyName, projectId, tasksCreated: 0, error: "Sem ações identificadas" });
        continue;
      }

      let tasks: { title: string; description: string; priority: string; suggested_date?: string }[] = [];

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
Retorne APENAS um JSON array com objetos contendo: title (max 80 chars, direto e acionável), description (contexto e detalhes), priority (high/medium/low), suggested_date (opcional, formato YYYY-MM-DD, apenas se uma data específica foi mencionada na reunião).
Agrupe ações similares quando fizer sentido. Cada tarefa deve ser concreta e executável.
NÃO inclua explicações, apenas o JSON array.`
                },
                {
                  role: "user",
                  content: `Empresa: ${companyName}\n\nDesafios identificados:\n${challenges.join("\n")}\n\nAções e recomendações:\n${taskItems.join("\n")}\n\nTransforme em tarefas acionáveis. Se alguma ação mencionar uma data específica, inclua no campo suggested_date.`
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

      // Fallback
      if (tasks.length === 0) {
        tasks = actionItems.map((item: string) => ({
          title: item.length > 80 ? item.substring(0, 77) + "..." : item,
          description: `Ação identificada no Hotseat para ${companyName}.\n\nDesafios: ${challenges.join("; ")}`,
          priority: "high",
        }));
      }

      const finalStaffId = responsibleStaffId || staffId;

      // Distribute dates: use suggested_date from AI if available, otherwise spread evenly across 15 business days
      const MAX_BUSINESS_DAYS = 15;
      const distributedDates = distributeBusinessDays(tasks.length, MAX_BUSINESS_DAYS);

      const tasksToInsert = tasks.map((task, idx) => {
        let dueDate: string;
        if (task.suggested_date && /^\d{4}-\d{2}-\d{2}$/.test(task.suggested_date)) {
          // Use AI-suggested date but ensure it's a business day
          const suggested = new Date(task.suggested_date + "T12:00:00");
          const adjusted = getNextBusinessDay(suggested);
          dueDate = adjusted.toISOString().split("T")[0];
        } else {
          dueDate = distributedDates[idx]?.toISOString().split("T")[0] || 
            addBusinessDays(new Date(), 5).toISOString().split("T")[0];
        }

        return {
          project_id: projectId,
          title: `[Hotseat] ${task.title}`,
          description: task.description || `Tarefa gerada a partir do Hotseat`,
          status: "pending",
          priority: task.priority || "high",
          responsible_staff_id: finalStaffId,
          due_date: dueDate,
          sort_order: idx,
          tags: ["hotseat"],
        };
      });

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
