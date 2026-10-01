// Central de Execuções do CRM (crm_executions): trabalhos em segundo plano com progresso.
// Quem roda um trabalho no navegador (importação) usa iniciar / progresso / concluir daqui.
// A exportação grande roda na edge crm-export-leads (exportarLeadsEmSegundoPlano).
// A tela fica em /crm/disparos, aba Execuções.
//
// Regra do cancelamento: o progresso só grava se a execução ainda está "running". Se o
// update não devolve linha, alguém cancelou pela Central e quem está rodando deve parar.
// Nada aqui pode derrubar o trabalho principal: falha ao registrar a execução só perde o
// acompanhamento, a importação segue.
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const EXEC_BUCKET = "crm-execucoes";
/** Até este volume o kanban exporta direto no navegador; acima vai pra segundo plano. */
export const LIMITE_EXPORT_DIRETO = 2000;
export const ROTA_EXECUCOES = "/crm/disparos?aba=execucoes";

export type ExecKind = "lead_import" | "lead_export" | "impulso" | "merge" | "automation_backfill";
export type ExecStatus = "queued" | "running" | "paused" | "done" | "failed" | "cancelled";

export interface Execucao {
  id: string;
  kind: ExecKind;
  title: string;
  status: ExecStatus;
  total: number;
  done: number;
  failed: number;
  skipped: number;
  params: Record<string, unknown> | null;
  result_path: string | null;
  result_name: string | null;
  errors_path: string | null;
  error: string | null;
  ref_id: string | null;
  started_by: string | null;
  started_by_name: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
}

const tabela = () => (supabase as any).from("crm_executions");

async function staffAtual(): Promise<{ id: string; name: string } | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("onboarding_staff").select("id, name").eq("user_id", user.id).eq("is_active", true).maybeSingle();
  return data ? { id: data.id, name: data.name } : null;
}

/** Registra a execução já rodando. Devolve null se não deu pra registrar (o trabalho segue sem acompanhamento). */
export async function iniciarExecucao(a: { kind: ExecKind; title: string; total: number; params?: Record<string, unknown> }):
  Promise<{ id: string; staffId: string } | null> {
  try {
    const staff = await staffAtual();
    if (!staff) return null;
    const { data, error } = await tabela().insert({
      kind: a.kind, title: a.title.slice(0, 160), status: "running", total: a.total, params: a.params || {},
      started_by: staff.id, started_by_name: staff.name, started_at: new Date().toISOString(),
    }).select("id").single();
    if (error || !data) { console.error("iniciarExecucao:", error); return null; }
    return { id: data.id as string, staffId: staff.id };
  } catch (e) {
    console.error("iniciarExecucao:", e);
    return null;
  }
}

/** Grava o progresso. false = a execução foi cancelada pela Central (quem chama deve parar). */
export async function progressoExecucao(id: string, p: { done: number; failed?: number; skipped?: number }): Promise<boolean> {
  try {
    const { data, error } = await tabela()
      .update({ done: p.done, failed: p.failed ?? 0, skipped: p.skipped ?? 0, updated_at: new Date().toISOString() })
      .eq("id", id).eq("status", "running").select("id");
    if (error) { console.error("progressoExecucao:", error); return true; } // erro de rede não é cancelamento
    return (data || []).length > 0;
  } catch (e) {
    console.error("progressoExecucao:", e);
    return true;
  }
}

/** CSV (separador ; e BOM, abre direto no Excel em pt-BR). */
export function montarCsv(linhas: (string | number | null | undefined)[][]): string {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
  return "﻿" + linhas.map((l) => l.map(esc).join(";")).join("\r\n");
}

/** Sobe um CSV no bucket das execuções e devolve o caminho (ou null se falhar). */
export async function subirCsvExecucao(staffId: string, execId: string, nome: string, linhas: (string | number | null | undefined)[][]): Promise<string | null> {
  try {
    const path = `${staffId}/${execId}/${nome}`;
    const { error } = await supabase.storage.from(EXEC_BUCKET)
      .upload(path, new Blob([montarCsv(linhas)], { type: "text/csv;charset=utf-8" }), { contentType: "text/csv;charset=utf-8" });
    if (error) { console.error("subirCsvExecucao:", error); return null; }
    return path;
  } catch (e) {
    console.error("subirCsvExecucao:", e);
    return null;
  }
}

/** Fecha a execução (só se ainda estava rodando: cancelada continua cancelada). */
export async function concluirExecucao(id: string, a: {
  status: "done" | "failed"; done: number; failed?: number; skipped?: number; error?: string | null; errorsPath?: string | null;
}): Promise<void> {
  try {
    const agora = new Date().toISOString();
    await tabela().update({
      status: a.status, done: a.done, failed: a.failed ?? 0, skipped: a.skipped ?? 0, error: a.error ?? null,
      errors_path: a.errorsPath ?? null, finished_at: agora, updated_at: agora,
    }).eq("id", id).eq("status", "running");
  } catch (e) {
    console.error("concluirExecucao:", e);
  }
}

/** Baixa um arquivo do bucket das execuções por link assinado. */
export async function baixarArquivoExecucao(path: string, nome?: string | null): Promise<void> {
  const { data, error } = await supabase.storage.from(EXEC_BUCKET).createSignedUrl(path, 120, { download: nome || true });
  if (error || !data?.signedUrl) { toast.error("Não consegui gerar o link do arquivo"); return; }
  const a = document.createElement("a");
  a.href = data.signedUrl;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Exportação de leads em segundo plano (edge crm-export-leads). O CSV sai com as mesmas
 * colunas do export do kanban e fica na Central de Execuções. Devolve true se iniciou.
 */
export async function exportarLeadsEmSegundoPlano(leadIds: string[], opts?: { title?: string; filename?: string }): Promise<boolean> {
  if (!leadIds.length) { toast.error("Nada para exportar com os filtros atuais"); return false; }
  const { data, error } = await supabase.functions.invoke("crm-export-leads", {
    body: { lead_ids: leadIds, title: opts?.title || `Exportação de ${leadIds.length.toLocaleString("pt-BR")} leads`, filename: opts?.filename || "leads" },
  });
  if (error || data?.error) {
    let motivo = data?.error as string | undefined;
    try { motivo = motivo || (await (error as any)?.context?.json?.())?.error; } catch { /* sem corpo */ }
    toast.error(motivo || "Não consegui iniciar a exportação");
    return false;
  }
  toast.success(`Exportando ${leadIds.length.toLocaleString("pt-BR")} leads em segundo plano`, {
    description: "Pode continuar usando o CRM. O arquivo aparece em Disparos, aba Execuções.",
    // o app usa HashRouter: a rota vive no hash
    action: { label: "Ver execuções", onClick: () => { window.location.hash = ROTA_EXECUCOES; } },
    duration: 10000,
  });
  return true;
}
