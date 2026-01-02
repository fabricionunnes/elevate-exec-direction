import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SheetData {
  // Campos esperados da planilha - ajuste conforme necessário
  nome_cliente?: string;
  empresa?: string;
  email?: string;
  telefone?: string;
  servico?: string;
  produto?: string;
  valor?: string | number;
  segmento?: string;
  cnpj?: string;
  website?: string;
  endereco?: string;
  observacoes?: string;
  // Campos genéricos para capturar qualquer dado
  [key: string]: unknown;
}

// Mapeamento de nomes de serviços da Clint para product_id do sistema
const PRODUCT_MAPPING: Record<string, { id: string; name: string }> = {
  // Adicione aqui os mapeamentos conforme os nomes usados na Clint
  "core": { id: "core", name: "Core" },
  "control": { id: "control", name: "Control" },
  "growth room": { id: "growth-room", name: "Growth Room" },
  "growth-room": { id: "growth-room", name: "Growth Room" },
  "growthroom": { id: "growth-room", name: "Growth Room" },
  "sales ops": { id: "sales-ops", name: "Sales Ops" },
  "sales-ops": { id: "sales-ops", name: "Sales Ops" },
  "salesops": { id: "sales-ops", name: "Sales Ops" },
  "partners": { id: "partners", name: "Partners" },
  "parceiros": { id: "partners", name: "Partners" },
  "mastermind": { id: "mastermind", name: "Mastermind" },
  "fractional cro": { id: "fractional-cro", name: "Fractional CRO" },
  "fractional-cro": { id: "fractional-cro", name: "Fractional CRO" },
  "cro": { id: "fractional-cro", name: "Fractional CRO" },
  "execution partnership": { id: "execution-partnership", name: "Execution Partnership" },
  "execution-partnership": { id: "execution-partnership", name: "Execution Partnership" },
  "execução": { id: "execution-partnership", name: "Execution Partnership" },
  "ai sales system": { id: "ai-sales-system", name: "AI Sales System" },
  "ai-sales-system": { id: "ai-sales-system", name: "AI Sales System" },
  "ai": { id: "ai-sales-system", name: "AI Sales System" },
  "sales force": { id: "sales-force", name: "Sales Force" },
  "sales-force": { id: "sales-force", name: "Sales Force" },
  "salesforce": { id: "sales-force", name: "Sales Force" },
  "sales acceleration": { id: "sales-acceleration", name: "Sales Acceleration" },
  "sales-acceleration": { id: "sales-acceleration", name: "Sales Acceleration" },
  "aceleração": { id: "sales-acceleration", name: "Sales Acceleration" },
  "finance": { id: "finance", name: "Finance" },
  "finanças": { id: "finance", name: "Finance" },
  "financeiro": { id: "finance", name: "Finance" },
  "leadership": { id: "leadership", name: "Leadership" },
  "liderança": { id: "leadership", name: "Leadership" },
  "people": { id: "people", name: "People" },
  "pessoas": { id: "people", name: "People" },
  "rh": { id: "people", name: "People" },
  "social": { id: "social", name: "Social" },
  "ads": { id: "ads", name: "Ads" },
  "tráfego": { id: "ads", name: "Ads" },
  "safe": { id: "safe", name: "Safe" },
  "segurança": { id: "safe", name: "Safe" },
};

function normalizeProductName(name: string): { id: string; name: string } | null {
  if (!name) return null;
  const normalized = name.toLowerCase().trim();
  return PRODUCT_MAPPING[normalized] || null;
}

function parseContractValue(value: string | number | undefined): number | null {
  if (!value) return null;
  if (typeof value === "number") return value;
  // Remove R$, pontos de milhar e troca vírgula por ponto
  const cleaned = value.replace(/[R$\s.]/g, "").replace(",", ".");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const data: SheetData = await req.json();
    console.log("Dados recebidos do Google Sheets:", JSON.stringify(data, null, 2));

    // Extrair dados com fallbacks para diferentes nomes de colunas
    const companyName = String(data.empresa || data.nome_empresa || data.company || data.nome_cliente || "Empresa sem nome");
    const clientName = String(data.nome_cliente || data.cliente || data.nome || data.name || companyName);
    const email = data.email || data.email_cliente || data.e_mail ? String(data.email || data.email_cliente || data.e_mail) : null;
    const phone = data.telefone || data.phone || data.celular || data.whatsapp ? String(data.telefone || data.phone || data.celular || data.whatsapp) : null;
    const serviceNameRaw = data.servico || data.produto || data.service || data.product;
    const serviceName = serviceNameRaw ? String(serviceNameRaw) : null;
    const contractValueRaw = data.valor || data.value || data.valor_contrato;
    const contractValue = contractValueRaw ? parseContractValue(String(contractValueRaw)) : null;
    const segment = data.segmento || data.segment || data.nicho ? String(data.segmento || data.segment || data.nicho) : null;
    const cnpj = data.cnpj ? String(data.cnpj) : null;
    const website = data.website || data.site ? String(data.website || data.site) : null;
    const address = data.endereco || data.address ? String(data.endereco || data.address) : null;
    const notes = data.observacoes || data.notes || data.obs ? String(data.observacoes || data.notes || data.obs) : null;

    // Identificar o produto
    const product = serviceName ? normalizeProductName(serviceName) : null;
    
    if (!product) {
      console.error("Produto não identificado:", serviceName);
      return new Response(
        JSON.stringify({ 
          error: "Produto não identificado", 
          received: serviceName,
          available_products: Object.keys(PRODUCT_MAPPING)
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se empresa já existe pelo email ou nome
    let existingCompany = null;
    if (email) {
      const { data: byEmail } = await supabase
        .from("onboarding_companies")
        .select("id, name")
        .eq("email", email)
        .single();
      existingCompany = byEmail;
    }
    
    if (!existingCompany) {
      const { data: byName } = await supabase
        .from("onboarding_companies")
        .select("id, name")
        .ilike("name", companyName)
        .single();
      existingCompany = byName;
    }

    let companyId: string;
    let isNewCompany = false;

    if (existingCompany) {
      companyId = existingCompany.id;
      console.log("Empresa já existe:", existingCompany.name);
    } else {
      // Criar nova empresa
      const { data: newCompany, error: companyError } = await supabase
        .from("onboarding_companies")
        .insert({
          name: companyName,
          email,
          phone,
          segment,
          cnpj,
          website,
          address,
          contract_value: contractValue,
          notes: notes ? `Origem: Clint/Google Sheets\n${notes}` : "Origem: Clint/Google Sheets",
          status: "active",
        })
        .select("id")
        .single();

      if (companyError) {
        console.error("Erro ao criar empresa:", companyError);
        throw companyError;
      }

      companyId = newCompany.id;
      isNewCompany = true;
      console.log("Nova empresa criada:", companyId);
    }

    // Verificar se já existe projeto para este produto nesta empresa
    const { data: existingProject } = await supabase
      .from("onboarding_projects")
      .select("id")
      .eq("onboarding_company_id", companyId)
      .eq("product_id", product.id)
      .single();

    if (existingProject) {
      console.log("Projeto já existe para este produto");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Empresa já possui projeto para este produto",
          company_id: companyId,
          project_id: existingProject.id,
          is_new: false
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Criar projeto
    const { data: newProject, error: projectError } = await supabase
      .from("onboarding_projects")
      .insert({
        onboarding_company_id: companyId,
        product_id: product.id,
        product_name: product.name,
        status: "active",
      })
      .select("id")
      .single();

    if (projectError) {
      console.error("Erro ao criar projeto:", projectError);
      throw projectError;
    }

    console.log("Novo projeto criado:", newProject.id);

    // Gerar tarefas do playbook
    try {
      const { error: tasksError } = await supabase.functions.invoke("generate-playbook-tasks", {
        body: {
          project_id: newProject.id,
          product_id: product.id,
          product_name: product.name,
          company_name: companyName,
        },
      });

      if (tasksError) {
        console.error("Erro ao gerar tarefas:", tasksError);
      } else {
        console.log("Tarefas geradas com sucesso");
      }
    } catch (taskErr) {
      console.error("Erro ao invocar generate-playbook-tasks:", taskErr);
    }

    // Notificar administradores e CS
    const { data: staffToNotify } = await supabase
      .from("onboarding_staff")
      .select("id, role")
      .in("role", ["admin", "cs"])
      .eq("is_active", true);

    if (staffToNotify && staffToNotify.length > 0) {
      const notifications = staffToNotify.map((staff) => ({
        staff_id: staff.id,
        project_id: newProject.id,
        type: "new_client",
        title: `Novo cliente: ${companyName}`,
        message: `Cliente ${clientName} (${companyName}) chegou via Clint com o produto ${product.name}. Valor: ${contractValue ? `R$ ${contractValue.toLocaleString("pt-BR")}` : "Não informado"}`,
        reference_id: newProject.id,
        reference_type: "project",
      }));

      const { error: notifyError } = await supabase
        .from("onboarding_notifications")
        .insert(notifications);

      if (notifyError) {
        console.error("Erro ao criar notificações:", notifyError);
      } else {
        console.log(`${notifications.length} notificações criadas`);
      }
    }

    // Adicionar contato principal como stakeholder
    if (clientName && clientName !== companyName) {
      const stakeholders = [
        {
          name: clientName,
          email: email || "",
          phone: phone || "",
          role: "Contato Principal",
        },
      ];

      await supabase
        .from("onboarding_companies")
        .update({ stakeholders })
        .eq("id", companyId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Cliente criado com sucesso",
        company_id: companyId,
        company_name: companyName,
        project_id: newProject.id,
        product: product.name,
        is_new_company: isNewCompany,
        notifications_sent: staffToNotify?.length || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Erro no webhook:", error);
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
