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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const body = await req.json();
    const { 
      email, 
      password, 
      name, 
      project_id, 
      role,
      is_signup,
      is_password_reset,
      company_name,
      selected_products,
      selected_companies
    } = body;

    // Validate required fields
    if (!email || !password || !name || !role) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For non-signup (admin creating users), project_id is required
    if (!is_signup && !project_id) {
      return new Response(
        JSON.stringify({ error: "Missing project_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user already exists in auth
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    let userId: string;

    // Handle password reset by admin
    if (is_password_reset) {
      if (!existingUser) {
        return new Response(
          JSON.stringify({ error: "Usuário não encontrado" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update password for existing user
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, { 
        password 
      });

      if (updateError) {
        console.error("Error updating password:", updateError);
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update temp_password in onboarding_users and mark as not changed
      await supabaseAdmin
        .from("onboarding_users")
        .update({ 
          temp_password: password,
          password_changed: false 
        })
        .eq("email", email)
        .eq("project_id", project_id);

      console.log(`Password reset by admin for: ${email}`);

      return new Response(
        JSON.stringify({ success: true, message: "Senha alterada com sucesso" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (existingUser) {
      // For signup, check if user already has account
      if (is_signup) {
        return new Response(
          JSON.stringify({ error: "Este email já está cadastrado. Faça login." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      userId = existingUser.id;
      // Update password for existing user
      await supabaseAdmin.auth.admin.updateUserById(userId, { password });
    } else {
      // Create new auth user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (createError) {
        console.error("Error creating auth user:", createError);
        return new Response(
          JSON.stringify({ error: createError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userId = newUser.user.id;
    }

    // Handle signup flow
    if (is_signup) {
      if (role === "client") {
        // Client signup: create company, projects for each product, and tasks
        if (!company_name || !selected_products || selected_products.length === 0) {
          return new Response(
            JSON.stringify({ error: "Cliente precisa informar empresa e produtos" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Create company in portal_companies
        const { data: company, error: companyError } = await supabaseAdmin
          .from("portal_companies")
          .insert({ name: company_name })
          .select()
          .single();

        if (companyError) {
          console.error("Error creating company:", companyError);
          return new Response(
            JSON.stringify({ error: "Erro ao criar empresa" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Create portal_user to link auth user with company
        const { error: portalUserError } = await supabaseAdmin
          .from("portal_users")
          .insert({
            user_id: userId,
            company_id: company.id,
            role: "admin_company",
            name,
            email,
          });

        if (portalUserError) {
          console.error("Error creating portal user:", portalUserError);
        }

        // Create project and tasks for each selected product
        for (const productId of selected_products) {
          // Get product name
          const productNames: Record<string, string> = {
            "core": "UNV Core",
            "control": "UNV Control",
            "sales-acceleration": "UNV Sales Acceleration",
            "growth-room": "UNV Growth Room",
            "partners": "UNV Partners",
            "sales-ops": "UNV Sales Ops",
            "ads": "UNV Ads",
            "social": "UNV Social",
            "finance": "UNV Finance",
            "people": "UNV People",
            "leadership": "UNV Leadership",
            "safe": "UNV Safe",
            "fractional-cro": "Diretor Comercial Fracionado",
            "execution-partnership": "Execution Partnership",
            "ai-sales-system": "AI Sales System",
            "mastermind": "Mastermind",
          };

          const productName = productNames[productId] || productId;

          // Create onboarding project
          const { data: project, error: projectError } = await supabaseAdmin
            .from("onboarding_projects")
            .insert({
              company_id: company.id,
              product_id: productId,
              product_name: productName,
              status: "active",
            })
            .select()
            .single();

          if (projectError) {
            console.error("Error creating project:", projectError);
            continue;
          }

          // Create onboarding user for this project
          const { error: onboardingUserError } = await supabaseAdmin
            .from("onboarding_users")
            .insert({
              user_id: userId,
              email,
              name,
              project_id: project.id,
              role: "client",
              password_changed: true, // They set their own password
            });

          if (onboardingUserError) {
            console.error("Error creating onboarding user:", onboardingUserError);
          }

          // Buscar templates específicos do produto
          const { data: templates } = await supabaseAdmin
            .from("onboarding_task_templates")
            .select("*")
            .eq("product_id", productId)
            .order("phase_order")
            .order("sort_order");

          if (templates && templates.length > 0) {
            // Create tasks from templates - incluindo fase e recurrence
            const tasks = templates.map((template, index) => ({
              project_id: project.id,
              template_id: template.id,
              title: template.title,
              description: template.description,
              priority: template.priority || "medium",
              sort_order: template.sort_order || index,
              status: "pending" as const,
              tags: template.phase ? [template.phase] : null,
              recurrence: template.recurrence || null,
              due_date: template.default_days_offset 
                ? new Date(Date.now() + ((template.default_days_offset || 0) + (template.duration_days || 0)) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                : null,
            }));

            const { error: tasksError } = await supabaseAdmin
              .from("onboarding_tasks")
              .insert(tasks);

            if (tasksError) {
              console.error("Error creating tasks:", tasksError);
            }
          }
        }

        console.log(`Client signup complete: ${email}, company: ${company_name}, products: ${selected_products.join(", ")}`);

      } else if (role === "admin" || role === "cs" || role === "consultant") {
        // Admin/CS/Consultant signup: link to existing company projects
        if (!selected_companies || selected_companies.length === 0) {
          return new Response(
            JSON.stringify({ error: "Admin/CS/Consultor precisa selecionar empresas" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get all projects for selected companies
        const { data: projects, error: projectsError } = await supabaseAdmin
          .from("onboarding_projects")
          .select("id, company_id")
          .in("company_id", selected_companies);

        if (projectsError) {
          console.error("Error fetching projects:", projectsError);
          return new Response(
            JSON.stringify({ error: "Erro ao buscar projetos" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Create onboarding user for each project
        for (const project of projects || []) {
          const { error: onboardingUserError } = await supabaseAdmin
            .from("onboarding_users")
            .insert({
              user_id: userId,
              email,
              name,
              project_id: project.id,
              role,
              password_changed: true,
            });

          if (onboardingUserError) {
            console.error("Error creating onboarding user:", onboardingUserError);
          }
        }

        // Also create portal_user with admin_unv role for internal users
        const { error: portalUserError } = await supabaseAdmin
          .from("portal_users")
          .insert({
            user_id: userId,
            role: "admin_unv",
            name,
            email,
          });

        if (portalUserError) {
          console.error("Error creating portal user:", portalUserError);
        }

        console.log(`Staff signup complete: ${email}, role: ${role}, companies: ${selected_companies.join(", ")}`);
      }

      return new Response(
        JSON.stringify({ success: true, user_id: userId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Original flow for admin-created users
    // Check if user already exists in onboarding_users for this project
    const { data: existingOnboardingUser } = await supabaseAdmin
      .from("onboarding_users")
      .select("id")
      .eq("email", email)
      .eq("project_id", project_id)
      .single();

    if (existingOnboardingUser) {
      // Update existing onboarding user
      const { error: updateError } = await supabaseAdmin
        .from("onboarding_users")
        .update({
          user_id: userId,
          name,
          role,
          temp_password: password,
          password_changed: false,
        })
        .eq("id", existingOnboardingUser.id);

      if (updateError) {
        console.error("Error updating onboarding user:", updateError);
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // Create new onboarding user
      const { error: insertError } = await supabaseAdmin
        .from("onboarding_users")
        .insert({
          user_id: userId,
          email,
          name,
          project_id,
          role,
          temp_password: password,
          password_changed: false,
        });

      if (insertError) {
        console.error("Error inserting onboarding user:", insertError);
        return new Response(
          JSON.stringify({ error: insertError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: true, user_id: userId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
