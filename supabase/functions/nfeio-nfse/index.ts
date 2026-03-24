import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NFEIO_BASE = "https://api.nfe.io/v1";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function nfeioRequest(path: string, method = "GET", body?: any) {
  const apiKey = Deno.env.get("NFEIO_API_KEY");
  if (!apiKey) throw new Error("NFEIO_API_KEY not configured");

  const opts: RequestInit = {
    method,
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${NFEIO_BASE}${path}`, opts);

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`NFE.io API error: ${res.status} - ${errorText}`);
    throw new Error(`NFE.io API error: ${res.status} - ${errorText}`);
  }

  return res.json();
}

function normalizeStringParam(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || normalized === "undefined" || normalized === "null") {
    return null;
  }
  return normalized;
}

function normalizeUuidParam(
  value: unknown,
  options: { required?: boolean; fieldName?: string } = {},
): string | null {
  const { required = false, fieldName = "id" } = options;
  const normalized = normalizeStringParam(value);

  if (!normalized) {
    if (required) {
      throw new Error(`${fieldName} é obrigatório`);
    }
    return null;
  }

  if (!UUID_PATTERN.test(normalized)) {
    throw new Error(`${fieldName} inválido`);
  }

  return normalized;
}

async function requireAuthenticatedUser(req: Request, supabase: ReturnType<typeof createClient>) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return data.user;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    await requireAuthenticatedUser(req, supabase);

    const { action, ...params } = await req.json();

    switch (action) {
      case "list-companies": {
        const data = await nfeioRequest("/companies");
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "emit": {
        const {
          companyId,
          nfeioCompanyId,
          invoiceId,
          serviceDescription,
          amountCents,
          tomadorName,
          tomadorDocument,
          tomadorEmail,
          tomadorStreet,
          tomadorNumber,
          tomadorComplement,
          tomadorNeighborhood,
          tomadorCity,
          tomadorState,
          tomadorPostalCode,
          cityServiceCode,
          nbsCode,
        } = params;

        const normalizedCompanyId = normalizeUuidParam(companyId, {
          required: true,
          fieldName: "company_id",
        });
        const normalizedInvoiceId = normalizeUuidParam(invoiceId, {
          fieldName: "invoice_id",
        });
        const normalizedNfeioCompanyId = normalizeStringParam(nfeioCompanyId) ?? "";

        if (!normalizedNfeioCompanyId) {
          throw new Error("nfeioCompanyId é obrigatório para emitir a NFS-e");
        }

        const amountInReais = typeof amountCents === "number" ? amountCents : parseFloat(String(amountCents)) || 0;
        const normalizedNbsCode = typeof nbsCode === "string" ? nbsCode.replace(/\D/g, "").trim() : "";
        const validNbsCode = /^\d{9}$/.test(normalizedNbsCode) ? normalizedNbsCode : "";
        const issuerCompany = await nfeioRequest(`/companies/${normalizedNfeioCompanyId}`);
        const shouldZeroIssRate = issuerCompany?.taxRegime === "SimplesNacional" && issuerCompany?.municipalTaxDetermination === "SimplesNacional";

        const borrower: any = {
          name: tomadorName,
          federalTaxNumber: tomadorDocument?.replace(/\D/g, "") || undefined,
          email: tomadorEmail || undefined,
        };

        const cleanPostalCode = (tomadorPostalCode || "").replace(/\D/g, "");
        
        // Try to enrich address data via ViaCEP if we have a postal code
        let enrichedCity = (tomadorCity && String(tomadorCity).trim()) || undefined;
        let enrichedState = (tomadorState && String(tomadorState).trim()) || undefined;
        let enrichedDistrict = (tomadorNeighborhood && String(tomadorNeighborhood).trim()) || undefined;
        let enrichedStreet = (tomadorStreet && String(tomadorStreet).trim()) || undefined;
        let ibgeCityCode: string | undefined;
        
        if (cleanPostalCode && cleanPostalCode.length === 8) {
          try {
            const viaCepRes = await fetch(`https://viacep.com.br/ws/${cleanPostalCode}/json/`);
            if (viaCepRes.ok) {
              const viaCepData = await viaCepRes.json();
              console.info("ViaCEP raw response:", JSON.stringify(viaCepData));
              if (!viaCepData.erro) {
                if (viaCepData.localidade) enrichedCity = viaCepData.localidade;
                if (viaCepData.uf) enrichedState = viaCepData.uf;
                if (viaCepData.bairro && !enrichedDistrict) enrichedDistrict = viaCepData.bairro;
                if (viaCepData.logradouro && !enrichedStreet) enrichedStreet = viaCepData.logradouro;
                ibgeCityCode = viaCepData.ibge;
                console.info("ViaCEP enrichment applied:", JSON.stringify({ city: enrichedCity, state: enrichedState, ibge: ibgeCityCode }));
              } else {
                console.warn("ViaCEP returned erro:true for CEP:", cleanPostalCode);
              }
            } else {
              console.warn("ViaCEP HTTP error:", viaCepRes.status);
            }
          } catch (e) {
            console.warn("ViaCEP lookup failed:", e);
          }
        }
        
        // If state is still empty, try to derive from CEP prefix (SP fallback for 01xxx-19xxx)
        if (!enrichedState && cleanPostalCode) {
          const cepPrefix = parseInt(cleanPostalCode.substring(0, 2), 10);
          const cepStateMap: Record<string, [number, number][]> = {
            SP: [[1, 19]],
            RJ: [[20, 28]],
            ES: [[29, 29]],
            MG: [[30, 39]],
            BA: [[40, 48]],
            SE: [[49, 49]],
            PE: [[50, 56]],
            AL: [[57, 57]],
            PB: [[58, 58]],
            RN: [[59, 59]],
            CE: [[60, 63]],
            PI: [[64, 64]],
            MA: [[65, 65]],
            PA: [[66, 68]],
            AP: [[68, 68]],
            AM: [[69, 69]],
            RR: [[69, 69]],
            DF: [[70, 73]],
            GO: [[74, 76]],
            TO: [[77, 77]],
            MT: [[78, 78]],
            MS: [[79, 79]],
            PR: [[80, 87]],
            SC: [[88, 89]],
            RS: [[90, 99]],
          };
          for (const [uf, ranges] of Object.entries(cepStateMap)) {
            for (const [min, max] of ranges) {
              if (cepPrefix >= min && cepPrefix <= max) {
                enrichedState = uf;
                console.info("State derived from CEP prefix:", uf);
                break;
              }
            }
            if (enrichedState) break;
          }
        }
        
        // If we still don't have an IBGE code but have city+state, look it up via IBGE API
        if (!ibgeCityCode && enrichedCity && enrichedState) {
          try {
            const ibgeRes = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${enrichedState}/municipios`);
            if (ibgeRes.ok) {
              const municipios = await ibgeRes.json();
              const normalizedCity = enrichedCity.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
              const found = municipios.find((m: any) => {
                const mName = m.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                return mName === normalizedCity;
              });
              if (found) {
                ibgeCityCode = String(found.id);
                console.info("IBGE code found via API:", ibgeCityCode, "for city:", enrichedCity);
              } else {
                console.warn("City not found in IBGE API for state:", enrichedState, "city:", enrichedCity);
              }
            }
          } catch (e) {
            console.warn("IBGE API lookup failed:", e);
          }
        }
        
        console.info("Final enriched address:", JSON.stringify({ street: enrichedStreet, city: enrichedCity, state: enrichedState, district: enrichedDistrict, ibge: ibgeCityCode }));

        if (enrichedStreet || cleanPostalCode || enrichedCity) {
          const cityObj: any = {};
          if (enrichedCity) cityObj.name = enrichedCity;
          if (ibgeCityCode) cityObj.code = ibgeCityCode;

          borrower.address = {
            country: "BRA",
            postalCode: cleanPostalCode || undefined,
            street: enrichedStreet || undefined,
            number: tomadorNumber || undefined,
            additionalInformation: tomadorComplement || undefined,
            district: enrichedDistrict || undefined,
            city: Object.keys(cityObj).length > 0 ? cityObj : undefined,
            state: enrichedState || undefined,
          };
        }

        console.info("Borrower address being sent:", JSON.stringify(borrower.address || {}));

        const nfsePayload: any = {
          cityServiceCode: cityServiceCode || "170601",
          ...(validNbsCode ? { nbsCode: validNbsCode } : {}),
          ...(shouldZeroIssRate ? { issRate: 0 } : {}),
          description: serviceDescription,
          servicesAmount: amountInReais,
          borrower,
        };

        if (normalizedNbsCode && !validNbsCode) {
          console.warn("Ignoring invalid NBS code for NFS-e payload", normalizedNbsCode);
        }

        if (shouldZeroIssRate) {
          console.info("Applying Simples Nacional ISS handling with issRate=0");
        }

        console.info("NFS-e emit payload (minimal)", JSON.stringify(nfsePayload));

        const result = await nfeioRequest(
          `/companies/${normalizedNfeioCompanyId}/serviceinvoices`,
          "POST",
          nfsePayload,
        );

        const { data: record, error: dbError } = await supabase
          .from("nfse_records")
          .insert({
            company_id: normalizedCompanyId,
            invoice_id: normalizedInvoiceId,
            nfeio_id: result.id,
            number: result.number?.toString() || null,
            status: mapNfeioStatus(result.status),
            amount_cents: Math.round(amountInReais * 100),
            service_description: serviceDescription,
            tomador_name: tomadorName,
            tomador_document: tomadorDocument,
            tomador_email: tomadorEmail,
            city_service_code: cityServiceCode || "170601",
            error_message: result.flowStatus === "IssueFailed" ? result.flowMessage || null : null,
            pdf_url: result.pdfUrl || null,
            xml_url: result.xmlUrl || null,
            rps_number: result.rpsNumber?.toString() || null,
            rps_serie: result.rpsSerie || null,
            environment: result.environment || "Production",
            issued_at: result.issuedOn || null,
          })
          .select()
          .single();

        if (dbError) {
          console.error("DB insert error:", dbError);
        }

        return new Response(JSON.stringify({ success: true, nfse: result, record }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "list": {
        const normalizedCompanyId = normalizeUuidParam(params.companyId, {
          fieldName: "company_id",
        });

        let query = supabase
          .from("nfse_records")
          .select("*")
          .order("created_at", { ascending: false });

        if (normalizedCompanyId) {
          query = query.eq("company_id", normalizedCompanyId);
        }

        const { data, error } = await query;

        if (error) throw error;

        return new Response(JSON.stringify({ records: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "status": {
        const normalizedRecordId = normalizeUuidParam(params.recordId, {
          fieldName: "record_id",
        });
        const normalizedNfeioCompanyId = normalizeStringParam(params.nfeioCompanyId) ?? "";
        const normalizedNfeioId = normalizeStringParam(params.nfeioId) ?? "";

        if (!normalizedNfeioCompanyId || !normalizedNfeioId) {
          throw new Error("Parâmetros obrigatórios ausentes para consultar o status da NFS-e");
        }

        const result = await nfeioRequest(
          `/companies/${normalizedNfeioCompanyId}/serviceinvoices/${normalizedNfeioId}`,
        );

        const updateData: any = {
          status: mapNfeioStatus(result.status),
          error_message: result.flowStatus === "IssueFailed" ? result.flowMessage || null : null,
          number: result.number?.toString() || null,
          pdf_url: result.pdfUrl || null,
          xml_url: result.xmlUrl || null,
          issued_at: result.issuedOn || null,
        };

        if (result.status === "Cancelled") {
          updateData.cancelled_at = new Date().toISOString();
        }

        if (normalizedRecordId) {
          await supabase
            .from("nfse_records")
            .update(updateData)
            .eq("id", normalizedRecordId);
        }

        return new Response(JSON.stringify({ success: true, nfse: result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "cancel": {
        const normalizedRecordId = normalizeUuidParam(params.recordId, {
          fieldName: "record_id",
        });
        const normalizedNfeioCompanyId = normalizeStringParam(params.nfeioCompanyId) ?? "";
        const normalizedNfeioId = normalizeStringParam(params.nfeioId) ?? "";

        if (!normalizedNfeioCompanyId || !normalizedNfeioId) {
          throw new Error("Parâmetros obrigatórios ausentes para cancelar a NFS-e");
        }

        await nfeioRequest(
          `/companies/${normalizedNfeioCompanyId}/serviceinvoices/${normalizedNfeioId}`,
          "DELETE",
        );

        if (normalizedRecordId) {
          await supabase
            .from("nfse_records")
            .update({
              status: "cancelled",
              cancelled_at: new Date().toISOString(),
            })
            .eq("id", normalizedRecordId);
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "download-pdf": {
        const normalizedNfeioCompanyId = normalizeStringParam(params.nfeioCompanyId) ?? "";
        const normalizedNfeioId = normalizeStringParam(params.nfeioId) ?? "";
        const apiKey = Deno.env.get("NFEIO_API_KEY");
        if (!apiKey) throw new Error("NFEIO_API_KEY not configured");

        if (!normalizedNfeioCompanyId || !normalizedNfeioId) {
          throw new Error("Parâmetros obrigatórios ausentes para baixar o PDF da NFS-e");
        }

        const pdfRes = await fetch(
          `${NFEIO_BASE}/companies/${normalizedNfeioCompanyId}/serviceinvoices/${normalizedNfeioId}/pdf`,
          {
            headers: {
              Authorization: apiKey,
              Accept: "application/pdf",
            },
          },
        );

        if (!pdfRes.ok) {
          const errText = await pdfRes.text();
          throw new Error(`PDF download failed: ${pdfRes.status} - ${errText}`);
        }

        const pdfBuffer = await pdfRes.arrayBuffer();
        return new Response(pdfBuffer, {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="nfse-${normalizedNfeioId}.pdf"`,
          },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error: any) {
    if (error instanceof Response) {
      return error;
    }

    console.error("nfeio-nfse error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

function mapNfeioStatus(status: string): string {
  const map: Record<string, string> = {
    Created: "pending",
    Issued: "authorized",
    Cancelled: "cancelled",
    Error: "error",
    None: "pending",
    WaitingCalculateTaxes: "processing",
    WaitingDefineRpsNumber: "processing",
    WaitingSend: "processing",
    WaitingSendCancel: "cancelling",
    WaitingReturn: "processing",
    WaitingDownload: "processing",
  };
  return map[status] || "pending";
}
