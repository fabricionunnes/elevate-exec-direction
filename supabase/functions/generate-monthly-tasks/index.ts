import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date();
    const currentMonth = today.getMonth() + 1; // 1-12
    const currentYear = today.getFullYear();
    const dayOfMonth = today.getDate();
    const lastDayOfMonth = new Date(currentYear, today.getMonth() + 1, 0).getDate();

    console.log(`Running monthly task generation: Day ${dayOfMonth}, Month ${currentMonth}, Year ${currentYear}`);
    console.log(`Last day of month: ${lastDayOfMonth}`);

    // Get all active projects with their company info
    const { data: projects, error: projectsError } = await supabase
      .from("onboarding_projects")
      .select(`
        id,
        product_name,
        onboarding_company_id,
        onboarding_company:onboarding_companies(
          id,
          name,
          status,
          consultant_id
        )
      `)
      .eq("status", "active");

    if (projectsError) {
      console.error("Error fetching projects:", projectsError);
      throw projectsError;
    }

    console.log(`Found ${projects?.length || 0} active projects`);

    interface ProjectWithCompany {
      id: string;
      product_name: string;
      onboarding_company_id: string | null;
      onboarding_company: {
        id: string;
        name: string;
        status: string;
        consultant_id: string | null;
      } | null;
    }

    let tasksCreated = 0;
    let goalsCreated = 0;

    for (const project of (projects as unknown as ProjectWithCompany[]) || []) {
      // Skip if company is not active
      const company = project.onboarding_company;
      if (!company || company.status !== "active") {
        console.log(`Skipping project ${project.id} - company not active`);
        continue;
      }

      const companyName = company.name;
      const consultantId = company.consultant_id;

      // Ensure monthly goal record exists for this month
      const { data: existingGoal } = await supabase
        .from("onboarding_monthly_goals")
        .select("id")
        .eq("project_id", project.id)
        .eq("month", currentMonth)
        .eq("year", currentYear)
        .maybeSingle();

      if (!existingGoal) {
        const { error: goalError } = await supabase
          .from("onboarding_monthly_goals")
          .insert({
            project_id: project.id,
            month: currentMonth,
            year: currentYear,
          });

        if (!goalError) {
          goalsCreated++;
          console.log(`Created monthly goal record for project ${project.id}`);
        }
      }

      // First day of month: Create task to set monthly target
      if (dayOfMonth === 1) {
        // Check if task already exists for this month
        const taskTitle = `[Meta] Definir meta de vendas - ${getMonthName(currentMonth)}/${currentYear}`;
        
        const { data: existingTask } = await supabase
          .from("onboarding_tasks")
          .select("id")
          .eq("project_id", project.id)
          .eq("title", taskTitle)
          .maybeSingle();

        if (!existingTask) {
          const { error: taskError } = await supabase
            .from("onboarding_tasks")
            .insert({
              project_id: project.id,
              title: taskTitle,
              description: `Definir a meta de vendas do mês de ${getMonthName(currentMonth)} para ${companyName}. Acesse a aba "Metas" para registrar o valor.`,
              due_date: new Date(currentYear, today.getMonth(), 5).toISOString().split('T')[0], // Due on day 5
              priority: "high",
              tags: ["Gestão de Metas", "0"],
              responsible_staff_id: consultantId,
              status: "pending",
              sort_order: 0,
            });

          if (!taskError) {
            tasksCreated++;
            console.log(`Created target task for project ${project.id}`);
          }
        }
      }

      // Last day of month: Create task to record sales results
      if (dayOfMonth === lastDayOfMonth) {
        const taskTitle = `[Resultado] Registrar resultado de vendas - ${getMonthName(currentMonth)}/${currentYear}`;
        
        const { data: existingTask } = await supabase
          .from("onboarding_tasks")
          .select("id")
          .eq("project_id", project.id)
          .eq("title", taskTitle)
          .maybeSingle();

        if (!existingTask) {
          const { error: taskError } = await supabase
            .from("onboarding_tasks")
            .insert({
              project_id: project.id,
              title: taskTitle,
              description: `Registrar o resultado de vendas do mês de ${getMonthName(currentMonth)} para ${companyName}. Acesse a aba "Metas" para registrar o valor alcançado.`,
              due_date: new Date(currentYear, today.getMonth() + 1, 3).toISOString().split('T')[0], // Due on day 3 of next month
              priority: "high",
              tags: ["Gestão de Metas", "0"],
              responsible_staff_id: consultantId,
              status: "pending",
              sort_order: 0,
            });

          if (!taskError) {
            tasksCreated++;
            console.log(`Created result task for project ${project.id}`);
          }
        }
      }
    }

    console.log(`Generation complete: ${tasksCreated} tasks created, ${goalsCreated} goal records created`);

    return new Response(
      JSON.stringify({
        success: true,
        tasksCreated,
        goalsCreated,
        message: `Generated ${tasksCreated} tasks and ${goalsCreated} goal records`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    console.error("Error in generate-monthly-tasks:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

function getMonthName(month: number): string {
  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  return months[month - 1];
}
