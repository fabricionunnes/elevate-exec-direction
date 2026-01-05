import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const formData = await req.formData();
    const pdfFile = formData.get('file') as File | null;
    const projectId = formData.get('projectId') as string | null;
    const companyName = formData.get('companyName') as string | null;
    const mode = formData.get('mode') as string | null; // 'preview' or 'create'
    const selectedTasksJson = formData.get('selectedTasks') as string | null;

    // Mode: create - insert pre-selected tasks + create completed planning task with PDF
    if (mode === 'create' && selectedTasksJson && projectId) {
      console.log(`Creating selected tasks for project ${projectId}`);
      
      const selectedTasks = JSON.parse(selectedTasksJson);
      const pdfFileForCreate = formData.get('file') as File | null;
      const summary = formData.get('summary') as string | null;
      
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Get project info for company_id
      const { data: projectData } = await supabase
        .from('onboarding_projects')
        .select('onboarding_company_id')
        .eq('id', projectId)
        .single();

      const companyId = projectData?.onboarding_company_id;

      // Get current max sort_order
      const { data: existingTasks } = await supabase
        .from('onboarding_tasks')
        .select('sort_order')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: false })
        .limit(1);

      let sortOrder = (existingTasks?.[0]?.sort_order || 0) + 1;

      // 1. Create the "Planejamento Estratégico" completed task FIRST
      const planningTaskData = {
        project_id: projectId,
        title: 'Planejamento Estratégico',
        description: summary || 'Documento de planejamento estratégico analisado e distribuído em ações.',
        tags: ['Planejamento'],
        priority: 'high',
        sort_order: sortOrder,
        status: 'done',
        is_internal: false,
        completed_at: new Date().toISOString(),
      };

      const { data: planningTask, error: planningError } = await supabase
        .from('onboarding_tasks')
        .insert(planningTaskData)
        .select('id')
        .single();

      if (planningError) {
        console.error('Error creating planning task:', planningError);
        throw new Error('Erro ao criar tarefa de planejamento');
      }

      console.log('Created planning task:', planningTask.id);

      // 2. Upload PDF to storage and link to the planning task
      if (pdfFileForCreate && companyId) {
        try {
          const arrayBuffer = await pdfFileForCreate.arrayBuffer();
          const fileBuffer = new Uint8Array(arrayBuffer);
          const fileName = `${Date.now()}-${pdfFileForCreate.name}`;
          const filePath = `${companyId}/${projectId}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('onboarding-documents')
            .upload(filePath, fileBuffer, {
              contentType: 'application/pdf',
              upsert: false,
            });

          if (uploadError) {
            console.error('Error uploading PDF:', uploadError);
          } else {
            // Create document record linked to the planning task
            const { error: docError } = await supabase
              .from('onboarding_documents')
              .insert({
                company_id: companyId,
                project_id: projectId,
                task_id: planningTask.id,
                file_name: pdfFileForCreate.name,
                file_path: filePath,
                file_size: pdfFileForCreate.size,
                file_type: 'application/pdf',
                category: 'Planejamento',
                description: 'Documento de Planejamento Estratégico',
              });

            if (docError) {
              console.error('Error creating document record:', docError);
            } else {
              console.log('PDF uploaded and linked to planning task');
            }
          }
        } catch (uploadErr) {
          console.error('Error in PDF upload process:', uploadErr);
        }
      }

      // 3. Insert action tasks with calculated due dates
      const today = new Date();
      const tasksToInsert = selectedTasks.map((task: any, index: number) => {
        const daysFromNow = task.days_from_now || 30;
        const dueDate = new Date(today);
        dueDate.setDate(dueDate.getDate() + daysFromNow);
        
        return {
          project_id: projectId,
          title: task.title?.substring(0, 255) || `Ação ${index + 1}`,
          description: task.description || null,
          tags: [task.phase || 'Plano de Ação'],
          priority: ['high', 'medium', 'low'].includes(task.priority) ? task.priority : 'medium',
          sort_order: sortOrder + 1 + index, // +1 because planning task is first
          status: 'pending',
          is_internal: false,
          due_date: dueDate.toISOString().split('T')[0],
          estimated_hours: task.estimated_hours || null,
        };
      });

      if (tasksToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('onboarding_tasks')
          .insert(tasksToInsert);

        if (insertError) {
          console.error('Error inserting tasks:', insertError);
          throw new Error('Erro ao salvar tarefas no banco de dados');
        }
      }

      return new Response(JSON.stringify({
        success: true,
        tasksCreated: tasksToInsert.length + 1, // +1 for planning task
        planningTaskId: planningTask.id,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mode: preview (default) - analyze PDF and return tasks for review
    if (!pdfFile || !projectId) {
      throw new Error('Missing required fields: file and projectId');
    }

    console.log(`Processing PDF for project ${projectId}, file: ${pdfFile.name}, size: ${pdfFile.size}`);

    // Read file as base64 using chunked approach to avoid stack overflow
    const arrayBuffer = await pdfFile.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Convert to base64 in chunks to avoid "Maximum call stack size exceeded"
    let binaryString = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize);
      binaryString += String.fromCharCode(...chunk);
    }
    const base64 = btoa(binaryString);

    // Use Gemini to extract tasks from the PDF
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Você é um especialista em planejamento estratégico e gestão de projetos. 
Sua tarefa é analisar documentos de planejamento estratégico e extrair TODAS as ações, tarefas e iniciativas propostas.

DISTRIBUIÇÃO TEMPORAL (CRÍTICO):
- Distribua TODAS as tarefas nos PRÓXIMOS 90 DIAS (3 meses)
- PRIORIZE as ações que geram resultados mais rápidos e impacto comercial imediato nas PRIMEIRAS SEMANAS
- Ações de vendas, captação de clientes e geração de receita = primeiros 30 dias
- Ações de estruturação, processos e treinamentos = dias 30-60
- Ações de consolidação, ajustes e melhorias contínuas = dias 60-90

Para cada ação identificada, extraia:
- title: Título curto e objetivo da ação (máximo 80 caracteres)
- description: Descrição detalhada da ação
- phase: Fase ou categoria da ação (ex: "Estratégia Comercial", "Marketing", "Processos", "Pessoas", etc.)
- priority: Prioridade (high, medium, low) - baseada no impacto nos resultados
- days_from_now: Em quantos dias a partir de hoje esta tarefa deve ser concluída (1 a 90)
- estimated_hours: Estimativa de horas para execução (número inteiro)

REGRAS DE PRIORIZAÇÃO:
1. HIGH (primeiros 30 dias): Ações de vendas diretas, campanhas, captação de leads, ativação de clientes
2. MEDIUM (30-60 dias): Treinamentos, criação de processos, playbooks, estruturação
3. LOW (60-90 dias): Documentação, ajustes finos, melhorias incrementais

IMPORTANTE:
- Extraia TODAS as ações mencionadas, mesmo que pareçam pequenas
- Mantenha a linguagem original do documento
- Se uma ação tiver subtarefas, liste cada uma separadamente
- Ordene as tarefas por days_from_now (mais urgentes primeiro)

Retorne APENAS um JSON válido no formato:
{
  "tasks": [
    {
      "title": "string",
      "description": "string", 
      "phase": "string",
      "priority": "high" | "medium" | "low",
      "days_from_now": number,
      "estimated_hours": number
    }
  ],
  "summary": "Resumo breve do plano estratégico"
}`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analise este documento de planejamento estratégico${companyName ? ` da empresa "${companyName}"` : ''} e extraia todas as ações propostas, distribuídas nos próximos 90 dias com foco em resultados imediatos primeiro. Retorne em formato JSON.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${base64}`
                }
              }
            ]
          }
        ],
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns minutos.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos insuficientes. Adicione créditos à sua conta.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content in AI response');
    }

    console.log('AI response received, parsing JSON...');

    // Parse JSON from the response (handle markdown code blocks)
    let jsonContent = content;
    if (content.includes('```json')) {
      jsonContent = content.split('```json')[1].split('```')[0].trim();
    } else if (content.includes('```')) {
      jsonContent = content.split('```')[1].split('```')[0].trim();
    }

    let parsedTasks;
    let tasks: any[] = [];
    let summary = '';

    try {
      parsedTasks = JSON.parse(jsonContent);
      tasks = parsedTasks.tasks || [];
      summary = parsedTasks.summary || '';
    } catch (parseError) {
      console.error('JSON parse error:', parseError, 'Attempting recovery...');
      
      // Try to recover partial JSON by extracting individual task objects
      try {
        // Find all task objects using regex
        const taskRegex = /\{\s*"title"\s*:\s*"[^"]*"[^}]*"estimated_days"\s*:\s*\d+\s*\}/g;
        const matches = jsonContent.match(taskRegex);
        
        if (matches && matches.length > 0) {
          console.log(`Recovered ${matches.length} tasks from partial JSON`);
          tasks = matches.map((match: string) => {
            try {
              return JSON.parse(match);
            } catch {
              return null;
            }
          }).filter((t: any) => t !== null);
        }
        
        // Try to extract summary
        const summaryMatch = jsonContent.match(/"summary"\s*:\s*"([^"]*)"/);
        if (summaryMatch) {
          summary = summaryMatch[1];
        }
      } catch (recoveryError) {
        console.error('Recovery also failed:', recoveryError);
      }
      
      if (tasks.length === 0) {
        throw new Error('Não foi possível extrair as ações do documento. Tente um PDF mais simples ou menor.');
      }
    }

    console.log(`Extracted ${tasks.length} tasks from PDF (preview mode)`);

    // Return tasks for preview - don't insert yet
    return new Response(JSON.stringify({
      success: true,
      mode: 'preview',
      tasks: tasks.map((t: any, index: number) => ({
        id: `temp-${index}`,
        title: t.title,
        description: t.description,
        phase: t.phase,
        priority: t.priority,
        days_from_now: t.days_from_now || 30,
        estimated_hours: t.estimated_hours || null,
      })),
      summary,
      totalTasks: tasks.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-pdf-tasks:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro desconhecido ao processar PDF' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
