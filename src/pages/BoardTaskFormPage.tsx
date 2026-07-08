// Formulário PÚBLICO de execução de tarefa do UNV Board.
// O cliente abre o link (token na URL), preenche o formulário guiado,
// a IA redige o documento oficial, a página gera o PDF, anexa na tarefa
// e a tarefa se conclui sozinha. Sem autenticação, sem layout staff.

import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import logoUnvBoard from "@/assets/logo-unv-board.png";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Loader2,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Download,
  FileText,
  ListChecks,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { format } from "date-fns";
import {
  BOARD_DELIVERABLE_TYPES,
  BoardDeliverableType,
  DeliverableFormField,
  DeliverableTypeConfig,
} from "@/components/board/boardDeliverableConfig";
import { generateBoardDeliverablePDF } from "@/components/board/generateBoardDeliverablePDF";

const NAVY = "#0D2B5E";

interface TaskFormInfo {
  form_type: string;
  status: "pending" | "submitted";
  submitted_at: string | null;
  deliverable_id: string | null;
  questions?: DeliverableFormField[] | null;
  task: {
    title: string;
    description: string | null;
    due_date: string | null;
    status: string | null;
  };
  company_name: string;
}

interface PreviewData {
  deliverable_id: string;
  version: number;
  content_md: string;
  doc_label: string;
}

interface EditableAction {
  title: string;
  description: string;
  metric: string;
  days: number;
}

/** Monta a seção "## Plano de Ação" no mesmo formato que o backend persiste no content_md. */
function buildPlanMd(actions: EditableAction[]): string {
  if (!actions.length) return "";
  return [
    "\n\n## Plano de Ação",
    ...actions.map((a, i) => {
      const due = new Date();
      due.setDate(due.getDate() + a.days);
      const dd = `${String(due.getDate()).padStart(2, "0")}/${String(due.getMonth() + 1).padStart(2, "0")}`;
      return `\n### ${i + 1}. ${a.title}\n- O que fazer: ${a.description || "—"}\n- Métrica de resultado: ${a.metric || "—"}\n- Prazo: ${dd}`;
    }),
  ].join("");
}

type Step = "form" | "preview" | "success";

/** Invoca o board-engine e extrai a mensagem de erro real do corpo, quando houver. */
async function invokeEngine(body: Record<string, unknown>): Promise<any> {
  const { data, error } = await supabase.functions.invoke("board-engine", { body });
  if (error) {
    let msg = "Não conseguimos falar com o servidor. Tente novamente em instantes.";
    const ctx = (error as any)?.context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const parsed = await ctx.json();
        if (parsed?.error) msg = parsed.error;
      } catch {
        // corpo não era JSON — mantém a mensagem genérica
      }
    }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(bin);
}

function sanitizeFileName(s: string): string {
  return s.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "documento";
}

/** Render leve do markdown do documento (#, ##, ###, listas e parágrafos). */
function MarkdownPreview({ content }: { content: string }) {
  const lines = (content || "").split("\n");
  return (
    <div className="text-sm leading-relaxed">
      {lines.map((raw, i) => {
        const line = raw.replace(/\*\*/g, "").trimEnd();
        const t = line.trim();
        if (!t) return <div key={i} className="h-2.5" />;
        if (t.startsWith("### ")) {
          return (
            <p key={i} className="font-semibold mt-3 mb-1 text-[#091C40] dark:text-blue-200">
              {t.slice(4)}
            </p>
          );
        }
        if (t.startsWith("## ")) {
          return (
            <p key={i} className="font-bold text-base mt-4 mb-1 text-[#0D2B5E] dark:text-blue-300">
              {t.slice(3)}
            </p>
          );
        }
        if (t.startsWith("# ")) {
          return (
            <p key={i} className="font-bold text-lg mt-2 mb-2 text-[#0D2B5E] dark:text-blue-300">
              {t.slice(2)}
            </p>
          );
        }
        if (/^[-*]\s+/.test(t)) {
          return (
            <p key={i} className="relative pl-4 mb-0.5">
              <span className="absolute left-0 text-[#CC1B1B]">•</span>
              {t.replace(/^[-*]\s+/, "")}
            </p>
          );
        }
        return (
          <p key={i} className="mb-1">
            {t}
          </p>
        );
      })}
    </div>
  );
}

// Máscara de moeda BRL — dígitos entram como centavos: "100000" -> "R$ 1.000,00"
function maskCurrency(input: string): string {
  const digits = (input || "").replace(/\D/g, "");
  if (!digits) return "";
  return (parseInt(digits, 10) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function BoardTaskFormPage() {
  const { token } = useParams<{ token: string }>();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [info, setInfo] = useState<TaskFormInfo | null>(null);

  const [step, setStep] = useState<Step>("form");
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [redownloading, setRedownloading] = useState(false);
  const [smartActionsCreated, setSmartActionsCreated] = useState(0);

  // Plano de ação proposto pela IA — editável pelo cliente antes de finalizar
  const [hasPlan, setHasPlan] = useState(false);
  const [actions, setActions] = useState<EditableAction[]>([]);

  useEffect(() => {
    const init = async () => {
      if (!token) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      try {
        const data = await invokeEngine({ action: "get_task_form", token });
        setInfo(data as TaskFormInfo);
      } catch (err) {
        console.error("Erro ao carregar o formulário da tarefa:", err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [token]);

  // Diagnóstico usa as perguntas geradas por IA (específicas do assunto da tarefa);
  // se elas não vieram (falha da geração), cai no formulário de execução.
  const config: DeliverableTypeConfig | null = info
    ? info.form_type === "diagnostico"
      ? info.questions && info.questions.length > 0
        ? {
            label: "Diagnóstico",
            description:
              "Responda com a realidade de hoje — o diagnóstico vai constatar os problemas e propor o plano de ação.",
            fields: info.questions,
          }
        : BOARD_DELIVERABLE_TYPES.execucao
      : BOARD_DELIVERABLE_TYPES[info.form_type as BoardDeliverableType] ||
        BOARD_DELIVERABLE_TYPES.outro
    : null;

  const dueLabel = info?.task?.due_date
    ? format(new Date(`${info.task.due_date}T12:00:00`), "dd/MM")
    : null;

  // autosave local: restaura o que o cliente já tinha digitado (mesmo navegador)
  useEffect(() => {
    if (!token || !config) return;
    try {
      const cached = localStorage.getItem(`board_draft_${token}`);
      if (cached) setFormValues((v) => (Object.keys(v).length ? v : JSON.parse(cached)));
    } catch {
      /* ignora */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, config?.fields?.length]);

  // autosave local: guarda a cada mudança
  useEffect(() => {
    if (!token || !config || preview) return;
    try {
      if (Object.keys(formValues).length > 0) {
        localStorage.setItem(`board_draft_${token}`, JSON.stringify(formValues));
      }
    } catch {
      /* ignora */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formValues, token, preview]);

  const buildFormData = (): Record<string, unknown> => {
    if (!config) return {};
    const data: Record<string, unknown> = {};
    for (const field of config.fields) {
      const raw = (formValues[field.key] || "").trim();
      if (!raw) continue;
      data[field.label] =
        field.type === "list"
          ? raw
              .split("\n")
              .map((l) => l.trim())
              .filter(Boolean)
          : raw;
    }
    return data;
  };

  const submitForm = async () => {
    if (!token || !config) return;
    const formData = buildFormData();
    if (Object.keys(formData).length < 2) {
      toast.error("Preencha pelo menos dois campos pra gerar o documento");
      return;
    }
    setGenerating(true);
    try {
      const data = await invokeEngine({ action: "submit_task_form", token, form_data: formData });
      setPreview({
        deliverable_id: data.deliverable_id,
        version: data.version || 1,
        content_md: data.content_md,
        doc_label: data.doc_label || config.label,
      });
      const proposed: EditableAction[] = Array.isArray(data.proposed_actions)
        ? data.proposed_actions
            .filter((a: any) => a?.title)
            .map((a: any) => ({
              title: String(a.title),
              description: a.description ? String(a.description) : "",
              metric: a.metric ? String(a.metric) : "",
              days: Math.max(1, parseInt(a.days) || 14),
            }))
        : [];
      setHasPlan(proposed.length > 0);
      setActions(proposed);
      setStep("preview");
      window.scrollTo({ top: 0 });
    } catch (err: any) {
      console.error("Erro ao gerar o documento:", err);
      toast.error(err?.message || "Erro ao gerar o documento. Tente novamente.");
    } finally {
      setGenerating(false);
    }
  };

  // Ações válidas do plano (sem título são ignoradas no envio e no PDF)
  const validActions = () => actions.filter((a) => a.title.trim().length > 0);

  const buildPdf = async () => {
    if (!preview || !info) throw new Error("Documento não disponível");
    // O plano final aprovado entra no PDF (mesmo formato que o backend persiste)
    const planMd = hasPlan ? buildPlanMd(validActions()) : "";
    return generateBoardDeliverablePDF({
      title: `${preview.doc_label} — ${info.task.title}`,
      companyName: info.company_name || "Sua empresa",
      contentMd: preview.content_md + planMd,
      version: preview.version,
      date: new Date().toISOString(),
    });
  };

  const pdfFileName = () =>
    preview && info
      ? `${sanitizeFileName(`${preview.doc_label}_${info.task.title}`)}_v${preview.version}.pdf`
      : "documento.pdf";

  const finalize = async () => {
    if (!token || !preview || !info) return;
    setFinalizing(true);
    try {
      const doc = await buildPdf();
      const base64 = arrayBufferToBase64(doc.output("arraybuffer") as ArrayBuffer);
      const fileName = pdfFileName();
      const finalActions = validActions().map((a) => ({
        title: a.title.trim(),
        description: a.description.trim(),
        metric: a.metric.trim(),
        days: Math.max(1, Math.round(a.days) || 14),
      }));
      const attachRes = await invokeEngine({
        action: "attach_task_pdf",
        token,
        deliverable_id: preview.deliverable_id,
        pdf_base64: base64,
        file_name: fileName,
        ...(finalActions.length > 0 ? { actions: finalActions } : {}),
      });
      setSmartActionsCreated(attachRes?.smart_actions_created || 0);
      doc.save(fileName);
      try { localStorage.removeItem(`board_draft_${token}`); } catch { /* ignora */ }
      setStep("success");
      window.scrollTo({ top: 0 });
    } catch (err: any) {
      console.error("Erro ao finalizar o documento:", err);
      toast.error(err?.message || "Erro ao gerar o PDF oficial. Tente novamente.");
    } finally {
      setFinalizing(false);
    }
  };

  const downloadAgain = async () => {
    setRedownloading(true);
    try {
      const doc = await buildPdf();
      doc.save(pdfFileName());
    } catch (err) {
      console.error("Erro ao baixar o PDF:", err);
      toast.error("Erro ao baixar o PDF. Tente novamente.");
    } finally {
      setRedownloading(false);
    }
  };

  // ============ HEADER ============
  const header = (
    <div style={{ backgroundColor: NAVY }} className="text-white">
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <img src={logoUnvBoard} alt="UNV Board" className="h-20 md:h-24" />
        <h1 className="text-xl font-bold mt-2">
          {info?.company_name || "Formulário de Tarefa"}
        </h1>
        <div className="mt-3 h-1 w-14 bg-[#CC1B1B] rounded-full" />
      </div>
    </div>
  );

  const footer = (
    <footer className="py-6 text-center text-xs text-muted-foreground">
      Universidade Nacional de Vendas · UNV Board
    </footer>
  );

  // ============ LOADING ============
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-background">
        <div className="h-28" style={{ backgroundColor: NAVY }} />
        <div className="container mx-auto px-4 py-6 max-w-2xl space-y-4">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  // ============ NÃO ENCONTRADO ============
  if (notFound || !info || !config) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" style={{ color: NAVY }} />
              UNV Board
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Não encontramos este formulário. O link pode estar incompleto ou ter sido
              substituído. Confira o link recebido ou fale com o seu consultor UNV.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============ JÁ CONCLUÍDA ============
  if (info.status === "submitted" && step !== "success") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-background">
        {header}
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <Card>
            <CardContent className="py-10 text-center space-y-3">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-600" />
              <h2 className="text-lg font-semibold">Tarefa concluída</h2>
              <p className="text-sm text-muted-foreground">
                {info.task.title}
                {info.submitted_at
                  ? ` — concluída em ${format(new Date(info.submitted_at), "dd/MM/yyyy")}`
                  : ""}
                . O documento oficial já foi gerado e anexado ao seu projeto.
              </p>
            </CardContent>
          </Card>
          {footer}
        </div>
      </div>
    );
  }

  // ============ SUCESSO ============
  if (step === "success") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-background">
        {header}
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <Card>
            <CardContent className="py-10 text-center space-y-4">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-600" />
              <div>
                <h2 className="text-lg font-semibold">Documento gerado e tarefa concluída</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  O documento oficial foi anexado ao seu projeto e o download começou no seu
                  aparelho. Pode fechar esta página.
                </p>
                {smartActionsCreated > 0 && (
                  <p className="text-sm mt-3 text-foreground font-medium">
                    Com base neste documento, {smartActionsCreated}{" "}
                    {smartActionsCreated === 1 ? "nova ação foi criada" : "novas ações foram criadas"}{" "}
                    no seu plano — elas já têm prazo e você vai receber o link de cada uma pra
                    executar e reportar o resultado.
                  </p>
                )}
              </div>
              <Button variant="outline" onClick={downloadAgain} disabled={redownloading}>
                {redownloading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Baixar novamente
              </Button>
            </CardContent>
          </Card>
          {footer}
        </div>
      </div>
    );
  }

  // ============ PREVIEW ============
  if (step === "preview" && preview) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-background">
        {header}
        <div className="container mx-auto px-4 py-6 max-w-2xl space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                {preview.doc_label} — pronto pra revisão
              </CardTitle>
              <CardDescription>
                Revise antes de finalizar. Se algo não ficou certo, volte e ajuste as suas
                respostas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/40 rounded-md border p-4 max-h-[420px] overflow-y-auto">
                <MarkdownPreview content={preview.content_md} />
              </div>

              {hasPlan && (
                <div className="space-y-3">
                  <div>
                    <h3 className="text-base font-semibold flex items-center gap-2">
                      <ListChecks className="h-5 w-5 shrink-0" style={{ color: NAVY }} />
                      Plano de Ação — revise antes de finalizar
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Estas ações vão virar tarefas com prazo no seu projeto. Ajuste, remova ou
                      acrescente o que fizer sentido.
                    </p>
                  </div>
                  {actions.map((action, idx) => (
                    <Card key={idx} className="relative">
                      <CardContent className="pt-4 pb-4 space-y-3">
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Remover ação"
                          disabled={finalizing}
                          className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-red-600"
                          onClick={() =>
                            setActions((prev) => prev.filter((_, i) => i !== idx))
                          }
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <div className="space-y-1.5 pr-8">
                          <Label className="text-xs text-muted-foreground">Ação</Label>
                          <Input
                            value={action.title}
                            placeholder="O que precisa ser feito"
                            disabled={finalizing}
                            onChange={(e) =>
                              setActions((prev) =>
                                prev.map((a, i) =>
                                  i === idx ? { ...a, title: e.target.value } : a,
                                ),
                              )
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Descrição</Label>
                          <Textarea
                            rows={2}
                            value={action.description}
                            placeholder="Como fazer na prática"
                            disabled={finalizing}
                            onChange={(e) =>
                              setActions((prev) =>
                                prev.map((a, i) =>
                                  i === idx ? { ...a, description: e.target.value } : a,
                                ),
                              )
                            }
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_130px] gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">
                              Métrica de resultado
                            </Label>
                            <Input
                              value={action.metric}
                              placeholder="Como medir o resultado"
                              disabled={finalizing}
                              onChange={(e) =>
                                setActions((prev) =>
                                  prev.map((a, i) =>
                                    i === idx ? { ...a, metric: e.target.value } : a,
                                  ),
                                )
                              }
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">
                              Prazo (dias)
                            </Label>
                            <Input
                              type="number"
                              min={1}
                              value={String(action.days)}
                              disabled={finalizing}
                              onChange={(e) =>
                                setActions((prev) =>
                                  prev.map((a, i) =>
                                    i === idx
                                      ? { ...a, days: Math.max(1, parseInt(e.target.value) || 1) }
                                      : a,
                                  ),
                                )
                              }
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={finalizing}
                    onClick={() =>
                      setActions((prev) => [
                        ...prev,
                        { title: "", description: "", metric: "", days: 14 },
                      ])
                    }
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar ação
                  </Button>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                <Button
                  variant="outline"
                  onClick={() => setStep("form")}
                  disabled={finalizing}
                  className="w-full sm:w-auto"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar e ajustar respostas
                </Button>
                <Button
                  onClick={finalize}
                  disabled={finalizing}
                  className="w-full sm:w-auto bg-[#0D2B5E] hover:bg-[#0D2B5E]/90 text-white"
                >
                  {finalizing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  {validActions().length > 0
                    ? "Aprovar plano e gerar documento oficial"
                    : "Finalizar e gerar documento oficial"}
                </Button>
              </div>
              {finalizing && (
                <p className="text-xs text-muted-foreground text-center">
                  Gerando o PDF oficial e concluindo a tarefa — não feche a página.
                </p>
              )}
            </CardContent>
          </Card>
          {footer}
        </div>
      </div>
    );
  }

  // ============ FORMULÁRIO ============
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background">
      {header}
      <div className="container mx-auto px-4 py-6 max-w-2xl space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{info.task.title}</CardTitle>
            {dueLabel && (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" />
                Prazo: {dueLabel}
              </p>
            )}
            {info.task.description && (
              <CardDescription className="whitespace-pre-wrap pt-1">
                {info.task.description}
              </CardDescription>
            )}
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{config.label}</CardTitle>
            <CardDescription>
              {config.description.replace(/\.?\s*$/, ".")} Responda com as suas
              palavras — não precisa ser bonito, precisa ser real.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {config.fields.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label className="font-medium">{field.label}</Label>
                {field.type === "currency" ? (
                  <Input
                    inputMode="numeric"
                    value={formValues[field.key] || ""}
                    placeholder="R$ 0,00"
                    disabled={generating}
                    onChange={(e) =>
                      setFormValues((v) => ({ ...v, [field.key]: maskCurrency(e.target.value) }))
                    }
                  />
                ) : field.type === "text" ? (
                  <Input
                    value={formValues[field.key] || ""}
                    placeholder={field.placeholder}
                    disabled={generating}
                    onChange={(e) =>
                      setFormValues((v) => ({ ...v, [field.key]: e.target.value }))
                    }
                  />
                ) : (
                  <>
                    <Textarea
                      rows={field.type === "list" ? 4 : 3}
                      value={formValues[field.key] || ""}
                      placeholder={field.placeholder}
                      disabled={generating}
                      onChange={(e) =>
                        setFormValues((v) => ({ ...v, [field.key]: e.target.value }))
                      }
                    />
                    {field.type === "list" && (
                      <p className="text-xs text-muted-foreground">Um item por linha.</p>
                    )}
                  </>
                )}
              </div>
            ))}

            {generating && (
              <div className="rounded-md border border-blue-500/30 bg-blue-500/10 p-3 text-sm flex items-center gap-2 text-blue-700 dark:text-blue-300">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                Estruturando seu documento oficial — isso pode levar até 1 minuto. Não feche a
                página.
              </div>
            )}

            <Button
              onClick={submitForm}
              disabled={generating}
              className="w-full bg-[#0D2B5E] hover:bg-[#0D2B5E]/90 text-white"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Gerar documento
            </Button>
          </CardContent>
        </Card>
        {footer}
      </div>
    </div>
  );
}
