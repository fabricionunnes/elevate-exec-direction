import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LeadContractData {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  document: string | null;
  company: string | null;
  product_id: string | null;
  opportunity_value: number | null;
  payment_method: string | null;
  installments: string | null;
  due_day: number | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipcode: string | null;
}

interface MissingField {
  field: string;
  label: string;
}

interface SendContractResult {
  success: boolean;
  error?: string;
  missingFields?: MissingField[];
  documentToken?: string;
  documentUrl?: string;
}

const COMPANY_SIGNER_EMAIL = "fabricio@universidadevendas.com.br";
const COMPANY_SIGNER_NAME = "Universidade de Vendas";

export function useSendLeadContract() {
  const [isSending, setIsSending] = useState(false);

  const checkRequiredFields = (lead: LeadContractData): MissingField[] => {
    const missing: MissingField[] = [];

    if (!lead.name?.trim()) {
      missing.push({ field: "name", label: "Nome do Lead" });
    }
    if (!lead.email?.trim()) {
      missing.push({ field: "email", label: "E-mail" });
    }
    if (!lead.document?.trim()) {
      missing.push({ field: "document", label: "CPF/CNPJ" });
    }
    if (!lead.company?.trim()) {
      missing.push({ field: "company", label: "Empresa" });
    }
    if (!lead.product_id) {
      missing.push({ field: "product_id", label: "Produto/Serviço" });
    }
    if (!lead.opportunity_value || lead.opportunity_value <= 0) {
      missing.push({ field: "opportunity_value", label: "Valor" });
    }
    if (!lead.address?.trim()) {
      missing.push({ field: "address", label: "Endereço (Rua)" });
    }
    if (!lead.city?.trim()) {
      missing.push({ field: "city", label: "Cidade" });
    }
    if (!lead.state?.trim()) {
      missing.push({ field: "state", label: "Estado" });
    }

    return missing;
  };

  const sendContract = async (leadId: string): Promise<SendContractResult> => {
    setIsSending(true);

    try {
      // Fetch lead data
      const { data: lead, error: leadError } = await supabase
        .from("crm_leads")
        .select("id, name, email, phone, document, company, product_id, opportunity_value, payment_method, installments, due_day, address, city, state, zipcode")
        .eq("id", leadId)
        .single();

      if (leadError || !lead) {
        return { success: false, error: "Lead não encontrado" };
      }

      // Check required fields
      const missingFields = checkRequiredFields(lead as LeadContractData);
      if (missingFields.length > 0) {
        return { success: false, missingFields };
      }

      // Get product name
      let productName = "Serviço";
      if (lead.product_id) {
        const { data: product } = await supabase
          .from("onboarding_services")
          .select("name")
          .eq("id", lead.product_id)
          .single();
        if (product?.name) {
          productName = product.name;
        }
      }

      // Get payment method name and convert to contract format
      let contractPaymentMethod = "pix"; // default
      if (lead.payment_method) {
        // Check if it's a UUID (from crm_payment_method_options) or a direct value
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lead.payment_method);
        
        if (isUUID) {
          const { data: paymentMethodData } = await supabase
            .from("crm_payment_method_options")
            .select("name")
            .eq("id", lead.payment_method)
            .single();
          
          if (paymentMethodData?.name) {
            // Convert to contract format (pix, card, boleto)
            const methodName = paymentMethodData.name.toLowerCase();
            if (methodName.includes("pix")) {
              contractPaymentMethod = "pix";
            } else if (methodName.includes("cartão") || methodName.includes("cartao") || methodName.includes("crédito") || methodName.includes("credito") || methodName.includes("débito") || methodName.includes("debito")) {
              contractPaymentMethod = "card";
            } else if (methodName.includes("boleto")) {
              contractPaymentMethod = "boleto";
            } else {
              contractPaymentMethod = "pix"; // fallback
            }
          }
        } else {
          // It's already a direct value like "pix", "card", "boleto"
          contractPaymentMethod = lead.payment_method;
        }
      }

      // Build full address
      const fullAddress = [
        lead.address,
        lead.city,
        lead.state,
        lead.zipcode
      ].filter(Boolean).join(", ");

      // Check if there's already a contract for this lead
      const { data: existingContract } = await supabase
        .from("generated_contracts")
        .select("id, pdf_url, zapsign_document_token")
        .eq("client_document", lead.document)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let pdfUrl: string | null = null;
      let contractId: string | null = null;

      if (existingContract?.pdf_url) {
        // Use existing contract PDF
        pdfUrl = existingContract.pdf_url;
        contractId = existingContract.id;

        // If already sent to ZapSign, cancel old document
        if (existingContract.zapsign_document_token) {
          try {
            await supabase.functions.invoke("cancel-zapsign", {
              body: { documentToken: existingContract.zapsign_document_token }
            });
          } catch (e) {
            console.warn("Não foi possível cancelar documento antigo no ZapSign:", e);
          }
        }
      } else {
        // Create a new contract in the database and generate PDF
        // For now, we'll create a simple contract record
        // The PDF generation would require the full contract generator logic
        
        // Create minimal contract record
        const contractData = {
          client_name: lead.company || lead.name,
          client_document: lead.document,
          client_address: fullAddress,
          client_email: lead.email,
          client_phone: lead.phone,
          product_id: lead.product_id,
          product_name: productName,
          contract_value: lead.opportunity_value,
          payment_method: contractPaymentMethod,
          installments: lead.installments ? parseInt(lead.installments) : 1,
          is_recurring: false,
          start_date: new Date().toISOString().slice(0, 10),
          due_date: lead.due_day ? new Date(new Date().getFullYear(), new Date().getMonth(), lead.due_day).toISOString().slice(0, 10) : null,
        };

        const { data: newContract, error: insertError } = await supabase
          .from("generated_contracts")
          .insert(contractData)
          .select("id, pdf_url")
          .single();

        if (insertError) {
          console.error("Erro ao criar contrato:", insertError);
          return { 
            success: false, 
            error: "Não foi possível criar o contrato. Por favor, gere o contrato manualmente na página de Contratos." 
          };
        }

        contractId = newContract.id;
        
        // Since we don't have a PDF yet, redirect user to generate it
        return {
          success: false,
          error: `Contrato criado, mas o PDF precisa ser gerado. Acesse a página de Contratos para finalizar.`
        };
      }

      // Send to ZapSign
      const documentName = `Contrato - ${lead.company || lead.name} - ${productName}`;

      const { data: zapSignData, error: zapSignError } = await supabase.functions.invoke("send-to-zapsign", {
        body: {
          pdfUrl,
          documentName,
          signers: [
            {
              name: COMPANY_SIGNER_NAME,
              email: COMPANY_SIGNER_EMAIL,
            },
            {
              name: lead.name,
              email: lead.email,
              phone: lead.phone || "",
            },
          ],
          sendAutomatically: true,
        },
      });

      if (zapSignError) {
        console.error("Erro ao enviar para ZapSign:", zapSignError);
        return { success: false, error: "Erro ao enviar contrato para assinatura. Verifique a configuração da ZapSign." };
      }

      // Update contract with ZapSign info
      if (contractId) {
        await supabase
          .from("generated_contracts")
          .update({
            zapsign_document_token: zapSignData.documentToken,
            zapsign_document_url: zapSignData.documentUrl,
            zapsign_signers: zapSignData.signers,
            zapsign_sent_at: new Date().toISOString(),
          })
          .eq("id", contractId);
      }

      return {
        success: true,
        documentToken: zapSignData.documentToken,
        documentUrl: zapSignData.documentUrl,
      };

    } catch (error) {
      console.error("Erro ao enviar contrato:", error);
      return { success: false, error: "Erro inesperado ao enviar contrato" };
    } finally {
      setIsSending(false);
    }
  };

  return { sendContract, isSending };
}
