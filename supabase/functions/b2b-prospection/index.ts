import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SearchRequest {
  niches: string[];
  state?: string;
  city?: string;
  country?: string;
  limit?: number;
}

interface PlaceResult {
  place_id: string;
  name: string;
  formatted_address: string;
  rating?: number;
  types?: string[];
  geometry?: { location: { lat: number; lng: number } };
}

interface PlaceDetails {
  formatted_phone_number?: string;
  international_phone_number?: string;
  website?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const googleApiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limiting: max 10 searches per minute
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
    const { count } = await supabase
      .from("b2b_search_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", oneMinuteAgo);

    if ((count || 0) >= 10) {
      return new Response(
        JSON.stringify({ error: "Limite de buscas atingido. Aguarde 1 minuto." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!googleApiKey) {
      return new Response(
        JSON.stringify({ error: "Google Places API Key não configurada. Configure nas configurações do sistema." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: SearchRequest = await req.json();
    const { niches = [], state, city, country = "Brasil", limit = 20 } = body;

    if (!niches.length) {
      return new Response(
        JSON.stringify({ error: "Informe pelo menos um nicho/segmento" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const allResults: any[] = [];
    const seenPlaceIds = new Set<string>();

    for (const niche of niches) {
      let query = niche;
      if (city) query += ` em ${city}`;
      if (state) query += `, ${state}`;
      query += `, ${country}`;

      // Text Search
      const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${googleApiKey}&language=pt-BR`;
      
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();

      if (searchData.status !== "OK" && searchData.status !== "ZERO_RESULTS") {
        console.error("Google Places error:", searchData.status, searchData.error_message);
        continue;
      }

      const places: PlaceResult[] = searchData.results || [];

      // Get details for each place (phone, website)
      for (const place of places) {
        if (seenPlaceIds.has(place.place_id)) continue;
        if (allResults.length >= limit) break;

        seenPlaceIds.add(place.place_id);

        try {
          const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_phone_number,international_phone_number,website&key=${googleApiKey}&language=pt-BR`;
          const detailsRes = await fetch(detailsUrl);
          const detailsData = await detailsRes.json();
          const details: PlaceDetails = detailsData.result || {};

          // Parse address parts
          const addressParts = (place.formatted_address || "").split(",").map(s => s.trim());
          const parsedCity = addressParts.length >= 3 ? addressParts[addressParts.length - 3] : city || "";
          const stateMatch = (place.formatted_address || "").match(/\b([A-Z]{2})\b/);
          const parsedState = stateMatch ? stateMatch[1] : state || "";

          allResults.push({
            place_id: place.place_id,
            name: place.name,
            segment: niche,
            phone: details.formatted_phone_number || details.international_phone_number || null,
            address: place.formatted_address,
            city: parsedCity,
            state: parsedState,
            website: details.website || null,
            google_rating: place.rating || null,
          });
        } catch (e) {
          console.error("Error fetching place details:", e);
          allResults.push({
            place_id: place.place_id,
            name: place.name,
            segment: niche,
            phone: null,
            address: place.formatted_address,
            city: city || "",
            state: state || "",
            website: null,
            google_rating: place.rating || null,
          });
        }
      }

      if (allResults.length >= limit) break;
    }

    // Log the search
    await supabase.from("b2b_search_logs").insert({
      user_id: user.id,
      search_query: niches.join(", "),
      filters: { niches, state, city, country, limit },
      results_count: allResults.length,
    });

    // Save to search history
    await supabase.from("b2b_search_history").insert({
      user_id: user.id,
      niches,
      state: state || null,
      city: city || null,
      country,
      results_count: allResults.length,
    });

    return new Response(
      JSON.stringify({ results: allResults, total: allResults.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("B2B Prospection error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno ao buscar leads" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
