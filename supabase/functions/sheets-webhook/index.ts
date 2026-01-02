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
  "core": { id: "core", name: "UNV Core" },
  "unv core": { id: "core", name: "UNV Core" },
  "control": { id: "control", name: "UNV Control" },
  "unv control": { id: "control", name: "UNV Control" },
  "growth room": { id: "growth-room", name: "UNV Growth Room" },
  "growth-room": { id: "growth-room", name: "UNV Growth Room" },
  "growthroom": { id: "growth-room", name: "UNV Growth Room" },
  "unv growth room": { id: "growth-room", name: "UNV Growth Room" },
  "sales ops": { id: "sales-ops", name: "UNV Sales Ops" },
  "sales-ops": { id: "sales-ops", name: "UNV Sales Ops" },
  "salesops": { id: "sales-ops", name: "UNV Sales Ops" },
  "unv sales ops": { id: "sales-ops", name: "UNV Sales Ops" },
  "partners": { id: "partners", name: "UNV Partners" },
  "parceiros": { id: "partners", name: "UNV Partners" },
  "unv partners": { id: "partners", name: "UNV Partners" },
  "mastermind": { id: "mastermind", name: "UNV Mastermind" },
  "unv mastermind": { id: "mastermind", name: "UNV Mastermind" },
  "fractional cro": { id: "fractional-cro", name: "UNV Fractional CRO" },
  "fractional-cro": { id: "fractional-cro", name: "UNV Fractional CRO" },
  "cro": { id: "fractional-cro", name: "UNV Fractional CRO" },
  "unv fractional cro": { id: "fractional-cro", name: "UNV Fractional CRO" },
  "unv cro": { id: "fractional-cro", name: "UNV Fractional CRO" },
  "execution partnership": { id: "execution-partnership", name: "UNV Execution Partnership" },
  "execution-partnership": { id: "execution-partnership", name: "UNV Execution Partnership" },
  "execução": { id: "execution-partnership", name: "UNV Execution Partnership" },
  "unv execution partnership": { id: "execution-partnership", name: "UNV Execution Partnership" },
  "ai sales system": { id: "ai-sales-system", name: "UNV AI Sales System" },
  "ai-sales-system": { id: "ai-sales-system", name: "UNV AI Sales System" },
  "ai": { id: "ai-sales-system", name: "UNV AI Sales System" },
  "unv ai sales system": { id: "ai-sales-system", name: "UNV AI Sales System" },
  "unv ai": { id: "ai-sales-system", name: "UNV AI Sales System" },
  "sales force": { id: "sales-force", name: "UNV Sales Force" },
  "sales-force": { id: "sales-force", name: "UNV Sales Force" },
  "salesforce": { id: "sales-force", name: "UNV Sales Force" },
  "unv sales force": { id: "sales-force", name: "UNV Sales Force" },
  "sales acceleration": { id: "sales-acceleration", name: "UNV Sales Acceleration" },
  "sales-acceleration": { id: "sales-acceleration", name: "UNV Sales Acceleration" },
  "unv sales acceleration": { id: "sales-acceleration", name: "UNV Sales Acceleration" },
  "aceleração": { id: "sales-acceleration", name: "UNV Sales Acceleration" },
  "finance": { id: "finance", name: "UNV Finance" },
  "finanças": { id: "finance", name: "UNV Finance" },
  "financeiro": { id: "finance", name: "UNV Finance" },
  "unv finance": { id: "finance", name: "UNV Finance" },
  "leadership": { id: "leadership", name: "UNV Leadership" },
  "liderança": { id: "leadership", name: "UNV Leadership" },
  "unv leadership": { id: "leadership", name: "UNV Leadership" },
  "people": { id: "people", name: "UNV People" },
  "pessoas": { id: "people", name: "UNV People" },
  "rh": { id: "people", name: "UNV People" },
  "unv people": { id: "people", name: "UNV People" },
  "social": { id: "social", name: "UNV Social" },
  "unv social": { id: "social", name: "UNV Social" },
  "ads": { id: "ads", name: "UNV Ads" },
  "tráfego": { id: "ads", name: "UNV Ads" },
  "unv ads": { id: "ads", name: "UNV Ads" },
  "safe": { id: "safe", name: "UNV Safe" },
  "segurança": { id: "safe", name: "UNV Safe" },
  "unv safe": { id: "safe", name: "UNV Safe" },
  "le desir": { id: "le-desir", name: "UNV Le Désir" },
  "le désir": { id: "le-desir", name: "UNV Le Désir" },
  "unv le desir": { id: "le-desir", name: "UNV Le Désir" },
  "unv le désir": { id: "le-desir", name: "UNV Le Désir" },
};

function normalizeProductName(name: string): { id: string; name: string } | null {
  if (!name) return null;

  const raw = name.toLowerCase().trim();

  // Primeiro tenta o valor inteiro (caso seja exatamente um dos mapeados)
  const direct = PRODUCT_MAPPING[raw];
  if (direct) return direct;

  // Aceita múltiplos serviços na mesma célula (ex: "ads, social" / "ads + social")
  const candidates = raw
    .split(/[,;+\/]|\s+e\s+/g)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const c of candidates) {
    const mapped = PRODUCT_MAPPING[c];
    if (mapped) return mapped;
  }

  // Fallback: match por "contém" (ex: "UNV Fractional CRO (novo)")
  // Escolhe o match mais específico (maior chave).
  let bestKey: string | null = null;
  for (const key of Object.keys(PRODUCT_MAPPING)) {
    if (raw.includes(key)) {
      if (!bestKey || key.length > bestKey.length) bestKey = key;
    }
  }
  if (bestKey) return PRODUCT_MAPPING[bestKey];

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
      data["Razão social do cliente"] ||
      data["Razao social do cliente"] ||
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
      ? String(data.segmento || data.segment || data.nicho).trim() 
      : null;

    const cnpjRaw = data.cnpj || data["CNPJ ou CPF"]; 
    const cnpj = cnpjRaw ? String(cnpjRaw).trim() || null : null;

    const website = data.website || data.site 
      ? String(data.website || data.site).trim() 
      : null;
    const address = data.endereco || data["Endereço Completo"] || data.address 
      ? String(data.endereco || data["Endereço Completo"] || data.address).trim() 
      : null;
    const notes = data.observacoes || data["Observações de pagamento"] || data.notes || data.obs 
      ? String(data.observacoes || data["Observações de pagamento"] || data.notes || data.obs).trim() 
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

    // Verificar se empresa já existe pelo CNPJ, email ou nome (nesta ordem de prioridade)
    let existingCompany = null;
    
    // Prioridade 1: CNPJ (mais confiável)
    if (cnpj && cnpj.length > 0) {
      const { data: byCnpj } = await supabase
        .from("onboarding_companies")
        .select("id, name")
        .eq("cnpj", cnpj)
        .maybeSingle();
      existingCompany = byCnpj;
      if (existingCompany) {
        console.log("Empresa encontrada pelo CNPJ:", existingCompany.name);
      }
    }
    
    // Prioridade 2: Email
    if (!existingCompany && email) {
      const { data: byEmail } = await supabase
        .from("onboarding_companies")
        .select("id, name")
        .eq("email", email)
        .maybeSingle();
      existingCompany = byEmail;
      if (existingCompany) {
        console.log("Empresa encontrada pelo email:", existingCompany.name);
      }
    }
    
    // Prioridade 3: Nome
    if (!existingCompany) {
      const { data: byName } = await supabase
        .from("onboarding_companies")
        .select("id, name")
        .ilike("name", companyName)
        .maybeSingle();
      existingCompany = byName;
      if (existingCompany) {
        console.log("Empresa encontrada pelo nome:", existingCompany.name);
      }
    }

    let companyId: string;
    let isNewCompany = false;

    if (existingCompany) {
      companyId = existingCompany.id;
      console.log("Empresa já existe:", existingCompany.name);

      // Se a venda veio com um novo nome (ex: nome fantasia atualizado), atualiza os dados básicos
      if (companyName && companyName !== "Empresa sem nome" && companyName.trim().length > 0 && companyName !== existingCompany.name) {
        const { error: updateCompanyError } = await supabase
          .from("onboarding_companies")
          .update({
            name: companyName,
            email: email ?? undefined,
            phone: phone ?? undefined,
            segment: segment ?? undefined,
            website: website ?? undefined,
            address: address ?? undefined,
            // mantém CNPJ se já existe; se vier preenchido e antes estava vazio, preenche
            cnpj: cnpj ?? undefined,
            // mantém notes existentes, só complementa quando vier algo
            notes: notes ? `Origem: Clint/Google Sheets\n${notes}` : undefined,
            contract_value: contractValue ?? undefined,
          })
          .eq("id", companyId);

        if (updateCompanyError) {
          console.warn("Não foi possível atualizar dados da empresa existente:", updateCompanyError);
        } else {
          console.log("Empresa atualizada com novo nome/dados:", companyName);
        }
      }
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

    // Sempre criar um novo projeto (a mesma empresa pode comprar o mesmo serviço mais de uma vez)
    const { count: existingProjectsCount, error: existingProjectsCountError } = await supabase
      .from("onboarding_projects")
      .select("id", { count: "exact", head: true })
      .eq("onboarding_company_id", companyId)
      .eq("product_id", product.id);

    if (existingProjectsCountError) {
      console.warn("Não foi possível contar projetos existentes:", existingProjectsCountError);
    }

    const nextProjectNumber = (existingProjectsCount ?? 0) + 1;
    const projectName = (existingProjectsCount ?? 0) > 0 ? `${product.name} #${nextProjectNumber}` : product.name;

    // Criar projeto
    const { data: newProject, error: projectError } = await supabase
      .from("onboarding_projects")
      .insert({
        onboarding_company_id: companyId,
        product_id: product.id,
        product_name: projectName,
        status: "active",
      })
      .select("id")
      .single();

    if (projectError) {
      console.error("Erro ao criar projeto:", projectError);
      throw projectError;
    }

    console.log("Novo projeto criado:", newProject.id);

    // Buscar projeto modelo (o que tem mais tarefas para este produto)
    try {
      const today = new Date();

      const copyTasksFromTemplates = async () => {
        const { data: templates, error: templatesError } = await supabase
          .from("onboarding_task_templates")
          .select("id, title, description, priority, sort_order, default_days_offset, duration_days")
          .eq("product_id", product.id)
          .order("sort_order", { ascending: true });

        if (templatesError) {
          console.error("Erro ao buscar templates de tarefas:", templatesError);
          return;
        }

        if (!templates || templates.length === 0) {
          console.log(`Nenhum template de tarefa encontrado para o produto: ${product.id}`);
          return;
        }

        console.log(`Copiando ${templates.length} tarefas a partir de templates do produto ${product.id}`);

        const tasksToInsert = templates.map((tpl, idx) => {
          let dueDate: string | null = null;
          const offset = (tpl.default_days_offset ?? 0) + (tpl.duration_days ?? 0);
          if (offset > 0) {
            const due = new Date(today);
            due.setDate(due.getDate() + offset);
            dueDate = due.toISOString().split("T")[0];
          }

          return {
            project_id: newProject.id,
            template_id: tpl.id,
            title: tpl.title,
            description: tpl.description,
            priority: tpl.priority || "medium",
            status: "pending",
            due_date: dueDate,
            start_date: null,
            sort_order: tpl.sort_order ?? idx,
            recurrence: null,
            tags: null,
            estimated_hours: null,
          };
        });

        const { error: insertError } = await supabase.from("onboarding_tasks").insert(tasksToInsert);

        if (insertError) {
          console.error("Erro ao inserir tarefas (templates):", insertError);
        } else {
          console.log(`${tasksToInsert.length} tarefas criadas com sucesso (templates)`);
        }
      };

      // Primeiro, tenta encontrar um projeto modelo existente (excluindo o recém-criado)
      const { data: templateProjects, error: templateProjectError } = await supabase
        .from("onboarding_projects")
        .select(
          `
          id,
          product_id,
          onboarding_company_id
        `
        )
        .eq("product_id", product.id)
        .neq("id", newProject.id);

      if (templateProjectError) {
        console.error("Erro ao buscar projetos modelo:", templateProjectError);
        // fallback
        await copyTasksFromTemplates();
      } else if (templateProjects && templateProjects.length > 0) {
        // Busca a contagem de tarefas de cada projeto para encontrar o modelo
        let bestTemplateProjectId: string | null = null;
        let maxTasks = 0;

        for (const proj of templateProjects) {
          const { count } = await supabase
            .from("onboarding_tasks")
            .select("*", { count: "exact", head: true })
            .eq("project_id", proj.id);

          if (count && count > maxTasks) {
            maxTasks = count;
            bestTemplateProjectId = proj.id;
          }
        }

        if (bestTemplateProjectId && maxTasks > 0) {
          console.log(`Projeto modelo encontrado: ${bestTemplateProjectId} com ${maxTasks} tarefas`);

          // Busca todas as tarefas do projeto modelo
          const { data: templateTasks, error: tasksError } = await supabase
            .from("onboarding_tasks")
            .select("*")
            .eq("project_id", bestTemplateProjectId)
            .order("sort_order", { ascending: true });

          if (tasksError) {
            console.error("Erro ao buscar tarefas do modelo:", tasksError);
            await copyTasksFromTemplates();
          } else if (templateTasks && templateTasks.length > 0) {
            console.log(`Copiando ${templateTasks.length} tarefas do projeto modelo`);

            const tasksToInsert = templateTasks.map((task, index) => {
              // Calcula nova data de vencimento baseada na data original relativa
              let dueDate: string | null = null;
              if (task.due_date) {
                const originalDue = new Date(task.due_date);
                const daysDiff = Math.floor(
                  (originalDue.getTime() - new Date(task.created_at).getTime()) / (1000 * 60 * 60 * 24)
                );
                const newDue = new Date(today);
                newDue.setDate(newDue.getDate() + Math.max(0, daysDiff));
                dueDate = newDue.toISOString().split("T")[0];
              }

              return {
                project_id: newProject.id,
                template_id: task.template_id,
                title: task.title,
                description: task.description,
                priority: task.priority || "medium",
                status: "pending",
                due_date: dueDate,
                start_date: null,
                sort_order: index,
                recurrence: task.recurrence,
                tags: task.tags,
                estimated_hours: task.estimated_hours,
              };
            });

            const { error: insertError } = await supabase.from("onboarding_tasks").insert(tasksToInsert);

            if (insertError) {
              console.error("Erro ao inserir tarefas:", insertError);
              await copyTasksFromTemplates();
            } else {
              console.log(`${tasksToInsert.length} tarefas copiadas com sucesso do projeto modelo`);
            }
          } else {
            console.log(`Projeto modelo ${bestTemplateProjectId} não tem tarefas; usando templates.`);
            await copyTasksFromTemplates();
          }
        } else {
          console.log(`Nenhum projeto modelo com tarefas encontrado para: ${product.id}; usando templates.`);
          await copyTasksFromTemplates();
        }
      } else {
        console.log(`Nenhum projeto modelo encontrado para o produto: ${product.id}`);
        await copyTasksFromTemplates();
      }
    } catch (taskErr) {
      console.error("Erro ao copiar tarefas do projeto modelo:", taskErr);
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
