import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Brazilian holidays (2024-2028)
const BRAZILIAN_HOLIDAYS: Record<number, string[]> = {
  2024: ["2024-01-01","2024-02-12","2024-02-13","2024-03-29","2024-04-21","2024-05-01","2024-05-30","2024-09-07","2024-10-12","2024-11-02","2024-11-15","2024-11-20","2024-12-25"],
  2025: ["2025-01-01","2025-03-03","2025-03-04","2025-04-18","2025-04-21","2025-05-01","2025-06-19","2025-09-07","2025-10-12","2025-11-02","2025-11-15","2025-11-20","2025-12-25"],
  2026: ["2026-01-01","2026-02-16","2026-02-17","2026-04-03","2026-04-21","2026-05-01","2026-06-04","2026-09-07","2026-10-12","2026-11-02","2026-11-15","2026-11-20","2026-12-25"],
  2027: ["2027-01-01","2027-02-08","2027-02-09","2027-03-26","2027-04-21","2027-05-01","2027-05-27","2027-09-07","2027-10-12","2027-11-02","2027-11-15","2027-11-20","2027-12-25"],
  2028: ["2028-01-01","2028-02-28","2028-02-29","2028-04-14","2028-04-21","2028-05-01","2028-06-15","2028-09-07","2028-10-12","2028-11-02","2028-11-15","2028-11-20","2028-12-25"],
};

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function isHoliday(date: Date): boolean {
  const year = date.getFullYear();
  const dateStr = date.toISOString().split("T")[0];
  const holidays = BRAZILIAN_HOLIDAYS[year] || [];
  return holidays.includes(dateStr);
}

function isBusinessDay(date: Date): boolean {
  return !isWeekend(date) && !isHoliday(date);
}

function ensureBusinessDay(date: Date): Date {
  const result = new Date(date);
  while (!isBusinessDay(result)) {
    result.setDate(result.getDate() + 1);
  }
  return result;
}

function addBusinessDays(startDate: Date, days: number): Date {
  let currentDate = new Date(startDate);
  let addedDays = 0;
  while (addedDays < days) {
    currentDate.setDate(currentDate.getDate() + 1);
    if (isBusinessDay(currentDate)) {
      addedDays++;
    }
  }
  return currentDate;
}

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
          // Calculate due date (day 5) and ensure it's a business day
          const rawDueDate = new Date(currentYear, today.getMonth(), 5);
          const dueDate = ensureBusinessDay(rawDueDate);
          
          const { error: taskError } = await supabase
            .from("onboarding_tasks")
            .insert({
              project_id: project.id,
              title: taskTitle,
              description: `Definir a meta de vendas do mês de ${getMonthName(currentMonth)} para ${companyName}. Acesse a aba "Metas" para registrar o valor.`,
              due_date: dueDate.toISOString().split('T')[0],
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
          // Calculate due date (day 3 of next month) and ensure it's a business day
          const rawDueDate = new Date(currentYear, today.getMonth() + 1, 3);
          const dueDate = ensureBusinessDay(rawDueDate);
          
          const { error: taskError } = await supabase
            .from("onboarding_tasks")
            .insert({
              project_id: project.id,
              title: taskTitle,
              description: `Registrar o resultado de vendas do mês de ${getMonthName(currentMonth)} para ${companyName}. Acesse a aba "Metas" para registrar o valor alcançado.`,
              due_date: dueDate.toISOString().split('T')[0],
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
