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
  "control": { id: "control", name: "UNV Control" },
  "unv control": { id: "control", name: "UNV Control" },
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

  // Aceita múltiplos serviços na mesma célula (ex: "ads, social" / "ads + social")
  const candidates = name
    .toLowerCase()
    .split(/[,;+\/]|\s+e\s+/g)
    .map((s) => s.trim())
    .filter(Boolean);

  // Primeiro tenta o valor inteiro (caso seja exatamente um dos mapeados)
  const direct = PRODUCT_MAPPING[name.toLowerCase().trim()];
  if (direct) return direct;

  for (const c of candidates) {
    const mapped = PRODUCT_MAPPING[c];
    if (mapped) return mapped;
  }

  return null;
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

    // Extrair dados com fallbacks para diferentes nomes de colunas (incluindo nomes da Clint)
    const companyName = String(
      data.empresa || 
      data["Nome fantasia da empresa"] || 
      data.nome_empresa || 
      data.company || 
      data.nome_cliente || 
      data["Nome do cliente"] ||
      "Empresa sem nome"
    );
    const clientName = String(
      data.nome_cliente || 
      data["Nome do cliente"] ||
      data.cliente || 
      data.nome || 
      data.name || 
      companyName
    );
    const email = data.email || data["E-mail do Cliente"] || data.email_cliente || data.e_mail 
      ? String(data.email || data["E-mail do Cliente"] || data.email_cliente || data.e_mail) 
      : null;
    const phone = data.telefone || data["Telefone do cliente"] || data.phone || data.celular || data.whatsapp 
      ? String(data.telefone || data["Telefone do cliente"] || data.phone || data.celular || data.whatsapp) 
      : null;
    
    // Nome do serviço - importante para identificar o produto
    const serviceNameRaw = 
      data.servico || 
      data.produto || 
      data["Serviço (s)"] ||  // Nome exato da coluna na Clint
      data["Servico (s)"] ||
      data["Serviço"] ||
      data["Servico"] ||
      data.service || 
      data.product;
    const serviceName = serviceNameRaw ? String(serviceNameRaw).trim() : null;
    
    // Valor do contrato
    const contractValueRaw = 
      data.valor || 
      data["Qual o valor total do contrato?"] ||
      data["Qual o valor total que o cliente já pagou?"] ||
      data.value || 
      data.valor_contrato;
    const contractValue = contractValueRaw ? parseContractValue(String(contractValueRaw)) : null;
    
    const segment = data.segmento || data.segment || data.nicho 
      ? String(data.segmento || data.segment || data.nicho) 
      : null;
    const cnpj = data.cnpj || data["CNPJ ou CPF"] 
      ? String(data.cnpj || data["CNPJ ou CPF"]) 
      : null;
    const website = data.website || data.site 
      ? String(data.website || data.site) 
      : null;
    const address = data.endereco || data["Endereço Completo"] || data.address 
      ? String(data.endereco || data["Endereço Completo"] || data.address) 
      : null;
    const notes = data.observacoes || data["Observações de pagamento"] || data.notes || data.obs 
      ? String(data.observacoes || data["Observações de pagamento"] || data.notes || data.obs) 
      : null;

    // Ignorar quando o Apps Script manda a linha de cabeçalho ou uma linha vazia
    const isHeaderRow =
      serviceName === "Serviço (s)" ||
      companyName === "Nome fantasia da empresa" ||
      email === "E-mail do Cliente";

    if (!serviceName || serviceName.length === 0 || isHeaderRow) {
      console.error("Payload inválido (linha vazia/cabeçalho)", { serviceName, companyName, email });
      return new Response(
        JSON.stringify({
          error: "Linha sem serviço (ou cabeçalho). Preencha a coluna 'Serviço (s)' na linha do cliente.",
          received: { service: serviceName, company: companyName, email },
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Identificar o produto
    const product = normalizeProductName(serviceName);

    if (!product) {
      console.error("Produto não identificado:", serviceName);
      return new Response(
        JSON.stringify({
          error: "Produto não identificado",
          received: serviceName,
          available_products: Object.keys(PRODUCT_MAPPING),
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
        .maybeSingle();
      existingCompany = byEmail;
    }
    
    if (!existingCompany) {
      const { data: byName } = await supabase
        .from("onboarding_companies")
        .select("id, name")
        .ilike("name", companyName)
        .maybeSingle();
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
      .maybeSingle();

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
