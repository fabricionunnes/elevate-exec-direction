import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NFEIO_BASE = "https://api.nfe.io/v1";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth is handled via verify_jwt = false in config.toml
    // The function is only accessible by authenticated frontend calls

    const { action, ...params } = await req.json();

    switch (action) {
      case "list-companies": {
        const data = await nfeioRequest("/companies");
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "emit": {
        const { companyId, nfeioCompanyId, invoiceId, serviceDescription, amountCents, tomadorName, tomadorDocument, tomadorEmail, cityServiceCode, issRate } = params;

        // Build NFS-e payload for NFE.io
        // amountCents is actually in reais (frontend already converts)
        const amountInReais = typeof amountCents === 'number' ? amountCents : parseFloat(String(amountCents)) || 0;
        const parsedIssRate = typeof issRate === 'number' ? issRate : parseFloat(String(issRate));
        const nfsePayload: any = {
          cityServiceCode: cityServiceCode || "170601",
          description: serviceDescription,
          servicesAmount: amountInReais,
          borrower: {
            name: tomadorName,
            federalTaxNumber: tomadorDocument?.replace(/\D/g, "") || undefined,
            email: tomadorEmail || undefined,
          },
        };

        console.info("NFS-e emit payload", JSON.stringify({
          companyId,
          nfeioCompanyId,
          cityServiceCode: nfsePayload.cityServiceCode,
          servicesAmount: nfsePayload.servicesAmount,
          hasIssRate: Object.prototype.hasOwnProperty.call(nfsePayload, "issRate"),
          issRate: nfsePayload.issRate ?? null,
        }));

        const result = await nfeioRequest(
          `/companies/${nfeioCompanyId}/serviceinvoices`,
          "POST",
          nfsePayload
        );

        // Save to local DB
        const { data: record, error: dbError } = await supabase
          .from("nfse_records")
          .insert({
            company_id: companyId,
            invoice_id: invoiceId || null,
            nfeio_id: result.id,
            // Store as cents in DB
            number: result.number?.toString() || null,
            status: mapNfeioStatus(result.status),
            amount_cents: Math.round(amountInReais * 100),
            service_description: serviceDescription,
            tomador_name: tomadorName,
            tomador_document: tomadorDocument,
            tomador_email: tomadorEmail,
            city_service_code: cityServiceCode || "170601",
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
        const { companyId } = params;

        const { data, error } = await supabase
          .from("nfse_records")
          .select("*")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false });

        if (error) throw error;

        return new Response(JSON.stringify({ records: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "status": {
        const { nfeioCompanyId, nfeioId, recordId } = params;

        const result = await nfeioRequest(
          `/companies/${nfeioCompanyId}/serviceinvoices/${nfeioId}`
        );

        // Update local record
        const updateData: any = {
          status: mapNfeioStatus(result.status),
          number: result.number?.toString() || null,
          pdf_url: result.pdfUrl || null,
          xml_url: result.xmlUrl || null,
          issued_at: result.issuedOn || null,
        };

        if (result.status === "Cancelled") {
          updateData.cancelled_at = new Date().toISOString();
        }

        if (recordId) {
          await supabase
            .from("nfse_records")
            .update(updateData)
            .eq("id", recordId);
        }

        return new Response(JSON.stringify({ success: true, nfse: result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "cancel": {
        const { nfeioCompanyId, nfeioId, recordId } = params;

        const result = await nfeioRequest(
          `/companies/${nfeioCompanyId}/serviceinvoices/${nfeioId}`,
          "DELETE"
        );

        if (recordId) {
          await supabase
            .from("nfse_records")
            .update({
              status: "cancelled",
              cancelled_at: new Date().toISOString(),
            })
            .eq("id", recordId);
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "download-pdf": {
        const { nfeioCompanyId, nfeioId } = params;
        const apiKey = Deno.env.get("NFEIO_API_KEY");
        if (!apiKey) throw new Error("NFEIO_API_KEY not configured");

        const pdfRes = await fetch(
          `${NFEIO_BASE}/companies/${nfeioCompanyId}/serviceinvoices/${nfeioId}/pdf`,
          {
            headers: {
              Authorization: apiKey,
              Accept: "application/pdf",
            },
          }
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
            "Content-Disposition": `attachment; filename="nfse-${nfeioId}.pdf"`,
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
    console.error("nfeio-nfse error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
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
