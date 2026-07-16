import { supabase } from "@/integrations/supabase/client";
import { productDetails } from "@/data/productDetails";
import { generateProposalPDF, type ProposalContent } from "./generateProposalPDF";

interface BuildArgs {
  leadId: string;
  leadName: string;
  companyName?: string | null;
  transcription: string;
  transcriptionId?: string | null;
}

// Resolve o serviço selecionado no Negócio → nome + entregas (productDetails por slug)
async function resolveService(productId: string | null): Promise<{ name: string; deliverables: string[] } | null> {
  if (!productId) return null;
  const { data: svc } = await supabase
    .from("onboarding_services")
    .select("slug,name")
    .eq("id", productId)
    .maybeSingle();
  if (!svc) return null;
  const pd = svc.slug ? productDetails[svc.slug] : undefined;
  return {
    name: pd?.name || svc.name || "",
    deliverables: pd?.deliverables || [],
  };
}

/**
 * Gera a proposta personalizada (IA + PDF), salva no storage e registra em crm_lead_proposals.
 * Retorna a linha criada. Lança erro em falha (o chamador decide como tratar).
 */
export async function buildAndStoreProposal({
  leadId,
  leadName,
  companyName,
  transcription,
  transcriptionId,
}: BuildArgs) {
  // 1. serviço selecionado no lead + valor/forma de pagamento já preenchidos no Negócio
  const { data: lead } = await supabase
    .from("crm_leads")
    .select("product_id, opportunity_value, payment_method")
    .eq("id", leadId)
    .maybeSingle();
  const productId = (lead as any)?.product_id || null;
  const dealValue = Number((lead as any)?.opportunity_value || 0);
  let paymentName = "";
  const pmId = (lead as any)?.payment_method;
  if (pmId) {
    const { data: pm } = await supabase.from("crm_payment_method_options").select("name").eq("id", pmId).maybeSingle();
    paymentName = (pm as any)?.name || "";
  }
  const svc = await resolveService(productId);

  // 2. conteúdo via IA (valores/forma de pagamento saem da transcrição)
  const { data, error } = await supabase.functions.invoke("generate-proposal", {
    body: {
      transcription,
      serviceName: svc?.name || "",
      deliverables: svc?.deliverables || [],
      leadName,
      companyName,
    },
  });
  if (error) throw new Error(error.message || "Falha ao gerar a proposta");
  const proposal: ProposalContent | undefined = (data as any)?.proposal;
  if (!proposal) throw new Error("Proposta não retornada pela IA");

  // 2b. Fallback: se a IA não achou o valor/forma na transcrição ("A combinar"),
  // usa o que já está preenchido no Negócio (fonte de verdade do lead).
  const vago = (s?: string) => !s || !s.trim() || /a\s*combinar/i.test(s.trim());
  if (vago(proposal.investimento) && dealValue > 0) {
    proposal.investimento = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(dealValue);
  }
  if (vago(proposal.forma_pagamento) && paymentName) {
    proposal.forma_pagamento = paymentName;
  }

  // 3. PDF
  const blob = await generateProposalPDF({
    proposal,
    leadName,
    companyName,
    serviceName: svc?.name,
  });

  // 4. upload no bucket crm-files
  const stamp = Date.now();
  const path = `proposals/${leadId}/${stamp}.pdf`;
  const { error: upErr } = await supabase.storage
    .from("crm-files")
    .upload(path, blob, { contentType: "application/pdf", upsert: true });
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from("crm-files").getPublicUrl(path);

  // 5. registra
  const { data: row, error: insErr } = await (supabase as any)
    .from("crm_lead_proposals")
    .insert({
      lead_id: leadId,
      transcription_id: transcriptionId || null,
      product_id: productId,
      service_name: svc?.name || proposal.servico || null,
      title: proposal.titulo || `Proposta — ${companyName || leadName}`,
      file_url: pub.publicUrl,
      file_path: path,
      content: proposal as any,
      status: "generated",
    })
    .select("*")
    .single();
  if (insErr) throw insErr;
  return row;
}

interface ReviseArgs {
  leadId: string;
  leadName: string;
  companyName?: string | null;
  /** mudanças ditadas pelo vendedor (valor, nome, entregas, qualquer detalhe) */
  instructions: string;
  /** proposta base; se omitida, usa a mais recente do lead */
  baseProposalId?: string | null;
}

/**
 * Gera uma NOVA proposta aplicando as mudanças que o vendedor digitou em cima
 * da proposta mais recente (ou da indicada). IA aplica só o que foi pedido;
 * o resto permanece igual. Salva PDF novo e registra nova linha.
 */
export async function reviseAndStoreProposal({
  leadId,
  leadName,
  companyName,
  instructions,
  baseProposalId,
}: ReviseArgs) {
  // 1. proposta base (conteúdo JSON persistido)
  let q = (supabase as any)
    .from("crm_lead_proposals")
    .select("id, content, product_id, service_name")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (baseProposalId) {
    q = (supabase as any)
      .from("crm_lead_proposals")
      .select("id, content, product_id, service_name")
      .eq("id", baseProposalId)
      .limit(1);
  }
  const { data: baseRows } = await q;
  const base = baseRows?.[0];
  if (!base?.content) throw new Error("Nenhuma proposta anterior encontrada para revisar");

  // 2. IA aplica as mudanças
  const { data, error } = await supabase.functions.invoke("generate-proposal", {
    body: {
      baseProposal: base.content,
      instructions,
      leadName,
      companyName,
      serviceName: base.service_name || "",
    },
  });
  if (error) throw new Error(error.message || "Falha ao revisar a proposta");
  const proposal: ProposalContent | undefined = (data as any)?.proposal;
  if (!proposal) throw new Error("Proposta revisada não retornada pela IA");

  // 3. PDF novo
  const blob = await generateProposalPDF({
    proposal,
    leadName,
    companyName,
    serviceName: base.service_name || undefined,
  });

  // 4. upload
  const stamp = Date.now();
  const path = `proposals/${leadId}/${stamp}.pdf`;
  const { error: upErr } = await supabase.storage
    .from("crm-files")
    .upload(path, blob, { contentType: "application/pdf", upsert: true });
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from("crm-files").getPublicUrl(path);

  // 5. registra como nova versão
  const { data: row, error: insErr } = await (supabase as any)
    .from("crm_lead_proposals")
    .insert({
      lead_id: leadId,
      product_id: base.product_id || null,
      service_name: base.service_name || null,
      title: `Proposta (revisada) — ${companyName || leadName}`,
      file_url: pub.publicUrl,
      file_path: path,
      content: proposal as any,
      status: "revised",
    })
    .select("*")
    .single();
  if (insErr) throw insErr;
  return row;
}
