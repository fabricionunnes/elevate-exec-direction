import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LeadData {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  document: string | null;
  opportunity_value: number | null;
  product_id: string | null;
  plan_id: string | null;
  city?: string | null;
  state?: string | null;
  segment?: string | null;
}

interface CreateProjectResult {
  success: boolean;
  projectId?: string;
  companyId?: string;
  error?: string;
}

/**
 * Função que busca os dados completos do lead incluindo campos customizados
 */
async function fetchLeadWithCustomFields(leadId: string): Promise<{
  lead: LeadData | null;
  paymentMethod: string | null;
  error: string | null;
}> {
  // Buscar dados do lead
  const { data: leadData, error: leadError } = await supabase
    .from("crm_leads")
    .select("id, name, company, phone, email, document, opportunity_value, product_id, plan_id, city, state, segment")
    .eq("id", leadId)
    .single();

  if (leadError || !leadData) {
    return { lead: null, paymentMethod: null, error: "Lead não encontrado" };
  }

  // Buscar campo customizado de forma de pagamento
  const { data: customFields } = await supabase
    .from("crm_custom_field_values")
    .select(`
      field_id,
      value,
      field:crm_custom_fields!inner(field_name)
    `)
    .eq("lead_id", leadId);

  let paymentMethod: string | null = null;
  if (customFields) {
    const paymentField = customFields.find(
      (cf: any) => cf.field?.field_name === "payment_method"
    );
    if (paymentField) {
      paymentMethod = paymentField.value;
    }
  }

  return { lead: leadData as LeadData, paymentMethod, error: null };
}

/**
 * Cria uma empresa e projeto automaticamente quando um lead é marcado como Ganho
 */
export async function createProjectFromWonLead(leadId: string): Promise<CreateProjectResult> {
  try {
    // Buscar dados do lead e campos customizados
    const { lead, paymentMethod, error: fetchError } = await fetchLeadWithCustomFields(leadId);
    
    if (fetchError || !lead) {
      console.error("Erro ao buscar lead:", fetchError);
      return { success: false, error: fetchError || "Lead não encontrado" };
    }

    // Validar campos obrigatórios
    if (!lead.company) {
      console.warn("Lead sem empresa definida, pulando criação de projeto");
      return { success: false, error: "Lead não tem empresa definida" };
    }

    if (!lead.product_id) {
      console.warn("Lead sem produto/serviço definido, pulando criação de projeto");
      return { success: false, error: "Lead não tem produto/serviço definido" };
    }

    // Buscar serviço diretamente de onboarding_services (product_id agora referencia onboarding_services)
    const { data: serviceData } = await supabase
      .from("onboarding_services")
      .select("id, name, slug")
      .eq("id", lead.product_id)
      .single();

    if (!serviceData) {
      console.warn("Serviço não encontrado:", lead.product_id);
      return { success: false, error: "Serviço/Produto não encontrado" };
    }

    // Buscar nome do plano
    let planName: string | null = null;
    if (lead.plan_id) {
      const { data: planData } = await supabase
        .from("crm_plans")
        .select("name")
        .eq("id", lead.plan_id)
        .single();
      
      if (planData) {
        planName = planData.name;
      }
    }

    // Verificar se já existe uma empresa com esse CNPJ (documento)
    let existingCompany = null;
    if (lead.document && lead.document.trim()) {
      const { data: companyByDoc } = await supabase
        .from("onboarding_companies")
        .select("id, tags")
        .eq("cnpj", lead.document.trim())
        .maybeSingle();
      existingCompany = companyByDoc;
    }

    let companyId: string;

    if (existingCompany) {
      // Usar empresa existente e marcar como "Empresa Nova" para ir ao topo
      companyId = existingCompany.id;
      console.log("Usando empresa existente (por CNPJ):", companyId);
      
      // Atualizar a empresa com a tag "Empresa Nova" e atualizar dados
      const currentTags = existingCompany.tags || [];
      const newTags = currentTags.includes("Empresa Nova") 
        ? currentTags 
        : ["Empresa Nova", ...currentTags];
      
      await supabase
        .from("onboarding_companies")
        .update({
          name: lead.company, // Atualizar nome caso tenha mudado
          phone: lead.phone,
          email: lead.email,
          segment: lead.segment,
          contract_value: lead.opportunity_value,
          payment_method: paymentMethod,
          status: "active",
          contract_start_date: new Date().toISOString().split("T")[0],
          tags: newTags,
        })
        .eq("id", companyId);
    } else {
      // Criar nova empresa com tag "Empresa Nova"
      const { data: newCompany, error: companyError } = await supabase
        .from("onboarding_companies")
        .insert({
          name: lead.company,
          phone: lead.phone,
          email: lead.email,
          cnpj: lead.document,
          segment: lead.segment,
          contract_value: lead.opportunity_value,
          payment_method: paymentMethod,
          status: "active",
          contract_start_date: new Date().toISOString().split("T")[0],
          tags: ["Empresa Nova"],
        })
        .select("id")
        .single();

      if (companyError || !newCompany) {
        console.error("Erro ao criar empresa:", companyError);
        return { success: false, error: "Erro ao criar empresa" };
      }

      companyId = newCompany.id;
      console.log("Empresa criada:", companyId);
    }

    // Calcular data de término do contrato baseado no plano
    let contractEndDate: string | null = null;
    const startDate = new Date();
    
    if (planName) {
      const planLower = planName.toLowerCase();
      if (planLower.includes("mensal")) {
        startDate.setMonth(startDate.getMonth() + 1);
      } else if (planLower.includes("trimestral")) {
        startDate.setMonth(startDate.getMonth() + 3);
      } else if (planLower.includes("semestral")) {
        startDate.setMonth(startDate.getMonth() + 6);
      } else if (planLower.includes("anual")) {
        startDate.setFullYear(startDate.getFullYear() + 1);
      }
      contractEndDate = startDate.toISOString().split("T")[0];
    }

    // Atualizar empresa com data de término se calculada
    if (contractEndDate) {
      await supabase
        .from("onboarding_companies")
        .update({ contract_end_date: contractEndDate })
        .eq("id", companyId);
    }

    // Criar projeto
    const { data: project, error: projectError } = await supabase
      .from("onboarding_projects")
      .insert({
        product_id: serviceData.slug || serviceData.id,
        product_name: serviceData.name,
        onboarding_company_id: companyId,
        status: "active",
      })
      .select("id")
      .single();

    if (projectError || !project) {
      console.error("Erro ao criar projeto:", projectError);
      return { success: false, error: "Erro ao criar projeto" };
    }

    console.log("Projeto criado:", project.id);

    // Buscar templates específicos do produto selecionado
    const { data: templates, error: templatesError } = await supabase
      .from("onboarding_task_templates")
      .select(
        "id, title, description, priority, sort_order, default_days_offset, duration_days, phase, recurrence, phase_order, is_internal"
      )
      .eq("product_id", serviceData.slug || serviceData.id)
      .order("phase_order", { ascending: true })
      .order("sort_order", { ascending: true });

    if (templatesError) {
      console.error("Erro ao buscar templates:", templatesError);
    }

    if (templates && templates.length > 0) {
      const today = new Date();
      const tasksToInsert = templates.map((tpl, idx) => {
        let dueDate: string | null = null;
        const offset = (tpl.default_days_offset ?? 0) + (tpl.duration_days ?? 0);
        if (offset > 0) {
          const due = new Date(today);
          due.setDate(due.getDate() + offset);
          dueDate = due.toISOString().split("T")[0];
        }

        return {
          project_id: project.id,
          template_id: tpl.id,
          title: tpl.title,
          description: tpl.description,
          priority: tpl.priority || "medium",
          status: "pending" as const,
          due_date: dueDate,
          sort_order: tpl.sort_order ?? idx,
          tags: tpl.phase ? [tpl.phase] : null,
          recurrence: tpl.recurrence ?? null,
          is_internal: tpl.is_internal ?? false,
        };
      });

      const { error: insertError } = await supabase
        .from("onboarding_tasks")
        .insert(tasksToInsert);
      
      if (insertError) {
        console.error("Erro ao inserir tarefas:", insertError);
      } else {
        console.log(`${templates.length} tarefas criadas a partir dos templates`);
      }
    }

    // Atualizar o lead com referência ao projeto criado
    await supabase
      .from("crm_lead_history")
      .insert({
        lead_id: leadId,
        action: "project_created",
        notes: `Projeto "${serviceData.name}" criado automaticamente para empresa "${lead.company}"`,
        new_value: project.id,
      });

    return {
      success: true,
      projectId: project.id,
      companyId: companyId,
    };
  } catch (error) {
    console.error("Erro ao criar projeto do lead ganho:", error);
    return { success: false, error: "Erro inesperado ao criar projeto" };
  }
}

/**
 * Hook para criar projeto quando lead é marcado como ganho
 */
export function useCreateProjectOnWon() {
  const createProject = async (leadId: string): Promise<CreateProjectResult> => {
    const result = await createProjectFromWonLead(leadId);
    
    if (result.success) {
      toast.success("🎉 Projeto criado automaticamente!");
    } else if (result.error && !result.error.includes("não tem")) {
      // Só mostra erro se não for falta de dados opcionais
      toast.error(`Erro ao criar projeto: ${result.error}`);
    }
    
    return result;
  };

  return { createProject };
}
