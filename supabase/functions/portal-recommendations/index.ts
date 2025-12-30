import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface KeyResult {
  id: string;
  title: string;
  status: string;
  objective_id: string;
  current_value: number | null;
  target: number;
  portal_objectives: {
    id: string;
    title: string;
    plan_id: string;
    portal_plans: {
      id: string;
      company_id: string;
    };
  };
}

interface CheckinWithImpediment {
  id: string;
  key_result_id: string;
  impediments: string;
  portal_key_results: {
    id: string;
    title: string;
    portal_objectives: {
      plan_id: string;
      portal_plans: {
        company_id: string;
      };
    };
  };
}

interface Product {
  id: string;
  name: string;
  short_description: string | null;
  category: string | null;
  tags: string[];
}

// Mapping of problem keywords to product recommendations
const PROBLEM_PRODUCT_MAP: Record<string, string[]> = {
  // Sales related
  "vendas": ["UNV Sales Acceleration", "UNV Sales Ops", "UNV Fractional CRO"],
  "conversão": ["UNV Sales Acceleration", "UNV AI Sales System"],
  "leads": ["UNV Ads", "UNV Sales Acceleration"],
  "prospecção": ["UNV Sales Force", "UNV Sales Acceleration"],
  "fechamento": ["UNV Sales Acceleration", "UNV Fractional CRO"],
  "time comercial": ["UNV Sales Force", "UNV People", "UNV Leadership"],
  "crm": ["UNV Sales Ops", "UNV AI Sales System"],
  "processo comercial": ["UNV Sales Ops", "UNV Control"],
  
  // Marketing related
  "tráfego": ["UNV Ads"],
  "marketing": ["UNV Social", "UNV Ads"],
  "redes sociais": ["UNV Social"],
  "conteúdo": ["UNV Social"],
  "marca": ["UNV Social", "UNV Le Désir"],
  
  // Management related
  "gestão": ["UNV Control", "UNV Leadership"],
  "equipe": ["UNV Leadership", "UNV People"],
  "contratação": ["UNV People", "UNV Sales Force"],
  "liderança": ["UNV Leadership", "UNV Mastermind"],
  "estratégia": ["UNV Growth Room", "UNV Mastermind", "UNV Execution Partnership"],
  
  // Financial related
  "financeiro": ["UNV Finance", "UNV Safe"],
  "caixa": ["UNV Finance", "UNV Safe"],
  "margem": ["UNV Finance", "UNV Control"],
  
  // General
  "escala": ["UNV Sales Acceleration", "UNV Execution Partnership"],
  "crescimento": ["UNV Growth Room", "UNV Execution Partnership"],
  "processos": ["UNV Control", "UNV Sales Ops"],
};

function analyzeTextForProducts(text: string): string[] {
  const lowerText = text.toLowerCase();
  const recommendedProducts = new Set<string>();

  for (const [keyword, products] of Object.entries(PROBLEM_PRODUCT_MAP)) {
    if (lowerText.includes(keyword)) {
      products.forEach(p => recommendedProducts.add(p));
    }
  }

  return Array.from(recommendedProducts);
}

function generateReason(krTitle: string, status: string, impediment?: string): string {
  if (status === "off_track") {
    if (impediment) {
      return `Seu KR "${krTitle}" está fora da meta. Identificamos o impedimento: "${impediment.substring(0, 100)}..." e temos soluções que podem ajudar.`;
    }
    return `Seu KR "${krTitle}" está fora da meta. Esta solução pode acelerar seu progresso.`;
  }
  
  if (status === "attention") {
    return `Seu KR "${krTitle}" precisa de atenção. Esta solução pode ajudar a manter o ritmo.`;
  }

  return `Baseado no seu planejamento, esta solução pode potencializar seus resultados.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action } = await req.json();

    if (action !== "generate") {
      return new Response(
        JSON.stringify({ error: "Invalid action" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Starting recommendation generation...");

    // 1. Get all active products
    const { data: products, error: productsError } = await supabase
      .from("portal_product_catalog")
      .select("*")
      .eq("is_active", true);

    if (productsError) {
      console.error("Error fetching products:", productsError);
      throw productsError;
    }

    console.log(`Found ${products?.length || 0} active products`);

    // Create a map of product names to IDs
    const productMap = new Map<string, Product>();
    products?.forEach(p => {
      productMap.set(p.name.toLowerCase(), p);
    });

    // 2. Get all KRs that are off_track or attention
    const { data: problemKRs, error: krError } = await supabase
      .from("portal_key_results")
      .select(`
        id,
        title,
        status,
        objective_id,
        current_value,
        target,
        portal_objectives!inner(
          id,
          title,
          plan_id,
          portal_plans!inner(
            id,
            company_id
          )
        )
      `)
      .in("status", ["off_track", "attention"]);

    if (krError) {
      console.error("Error fetching KRs:", krError);
      throw krError;
    }

    console.log(`Found ${problemKRs?.length || 0} problematic KRs`);

    // 3. Get recent checkins with impediments
    const { data: checkins, error: checkinsError } = await supabase
      .from("portal_checkins")
      .select(`
        id,
        key_result_id,
        impediments,
        portal_key_results!inner(
          id,
          title,
          portal_objectives!inner(
            plan_id,
            portal_plans!inner(
              company_id
            )
          )
        )
      `)
      .not("impediments", "is", null)
      .neq("impediments", "")
      .order("created_at", { ascending: false })
      .limit(100);

    if (checkinsError) {
      console.error("Error fetching checkins:", checkinsError);
      throw checkinsError;
    }

    console.log(`Found ${checkins?.length || 0} checkins with impediments`);

    // 4. Generate recommendations
    const recommendations: Array<{
      company_id: string;
      plan_id: string;
      key_result_id: string;
      product_id: string;
      reason: string;
    }> = [];

    // Process KRs
    for (const kr of (problemKRs as unknown as KeyResult[]) || []) {
      const krText = kr.title;
      const suggestedProductNames = analyzeTextForProducts(krText);

      // Find matching checkin with impediment
      const relatedCheckin = (checkins as unknown as CheckinWithImpediment[])?.find(
        c => c.key_result_id === kr.id
      );

      if (relatedCheckin?.impediments) {
        const impedimentProducts = analyzeTextForProducts(relatedCheckin.impediments);
        impedimentProducts.forEach(p => {
          if (!suggestedProductNames.includes(p)) {
            suggestedProductNames.push(p);
          }
        });
      }

      // Default recommendations for off_track without specific keywords
      if (suggestedProductNames.length === 0 && kr.status === "off_track") {
        suggestedProductNames.push("UNV Growth Room", "UNV Control");
      }

      // Create recommendations (max 3 per KR)
      const selectedProducts = suggestedProductNames.slice(0, 3);
      
      for (const productName of selectedProducts) {
        const product = Array.from(productMap.values()).find(
          p => p.name.toLowerCase().includes(productName.toLowerCase().replace("unv ", ""))
        );

        if (product) {
          recommendations.push({
            company_id: kr.portal_objectives.portal_plans.company_id,
            plan_id: kr.portal_objectives.portal_plans.id,
            key_result_id: kr.id,
            product_id: product.id,
            reason: generateReason(kr.title, kr.status, relatedCheckin?.impediments)
          });
        }
      }
    }

    console.log(`Generated ${recommendations.length} recommendations`);

    // 5. Get existing recommendations to avoid duplicates
    const { data: existingRecs } = await supabase
      .from("portal_recommendations")
      .select("key_result_id, product_id")
      .is("dismissed_at", null);

    const existingSet = new Set(
      existingRecs?.map(r => `${r.key_result_id}-${r.product_id}`) || []
    );

    // Filter out duplicates
    const newRecommendations = recommendations.filter(
      r => !existingSet.has(`${r.key_result_id}-${r.product_id}`)
    );

    console.log(`${newRecommendations.length} new unique recommendations to insert`);

    // 6. Insert new recommendations
    if (newRecommendations.length > 0) {
      const { error: insertError } = await supabase
        .from("portal_recommendations")
        .insert(newRecommendations);

      if (insertError) {
        console.error("Error inserting recommendations:", insertError);
        throw insertError;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        created: newRecommendations.length,
        analyzed: {
          krs: problemKRs?.length || 0,
          checkins: checkins?.length || 0
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in portal-recommendations:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
