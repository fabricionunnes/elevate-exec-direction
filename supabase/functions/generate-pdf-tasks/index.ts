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

    // Mode: create - just insert pre-selected tasks
    if (mode === 'create' && selectedTasksJson && projectId) {
      console.log(`Creating selected tasks for project ${projectId}`);
      
      const selectedTasks = JSON.parse(selectedTasksJson);
      
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Get current max sort_order
      const { data: existingTasks } = await supabase
        .from('onboarding_tasks')
        .select('sort_order')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: false })
        .limit(1);

      let sortOrder = (existingTasks?.[0]?.sort_order || 0) + 1;

      // Insert tasks
      const tasksToInsert = selectedTasks.map((task: any, index: number) => ({
        project_id: projectId,
        title: task.title?.substring(0, 255) || `Ação ${index + 1}`,
        description: task.description || null,
        tags: [task.phase || 'Plano de Ação', String(index + 1)],
        priority: ['high', 'medium', 'low'].includes(task.priority) ? task.priority : 'medium',
        sort_order: sortOrder + index,
        status: 'pending',
        is_internal: false,
      }));

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
        tasksCreated: tasksToInsert.length,
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

Para cada ação identificada, extraia:
- title: Título curto e objetivo da ação (máximo 80 caracteres)
- description: Descrição detalhada da ação
- phase: Fase ou categoria da ação (ex: "Estratégia Comercial", "Marketing", "Processos", "Pessoas", etc.)
- priority: Prioridade (high, medium, low) - baseada na urgência indicada no documento
- estimated_days: Estimativa de dias para execução (número inteiro)

IMPORTANTE:
- Extraia TODAS as ações mencionadas, mesmo que pareçam pequenas
- Mantenha a linguagem original do documento
- Se uma ação tiver subtarefas, liste cada uma separadamente
- Agrupe por fases lógicas baseadas no conteúdo do documento

Retorne APENAS um JSON válido no formato:
{
  "tasks": [
    {
      "title": "string",
      "description": "string", 
      "phase": "string",
      "priority": "high" | "medium" | "low",
      "estimated_days": number
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
                text: `Analise este documento de planejamento estratégico${companyName ? ` da empresa "${companyName}"` : ''} e extraia todas as ações propostas em formato JSON.`
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
    try {
      parsedTasks = JSON.parse(jsonContent);
    } catch (parseError) {
      console.error('JSON parse error:', parseError, 'Content:', jsonContent);
      throw new Error('Erro ao processar resposta da IA. O formato do PDF pode não ser suportado.');
    }

    const tasks = parsedTasks.tasks || [];
    const summary = parsedTasks.summary || '';

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
        estimated_days: t.estimated_days,
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
