import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Loader2,
  ArrowLeft,
  FileText,
  Download,
  Sparkles,
  CheckCircle2,
  Library,
  FilePlus2,
} from "lucide-react";
import { format } from "date-fns";
import {
  BOARD_DELIVERABLE_TYPES,
  BOARD_DELIVERABLE_TYPE_KEYS,
  BoardDeliverableType,
  boardDeliverableLabel,
} from "@/components/board/boardDeliverableConfig";
import { generateBoardDeliverablePDF } from "@/components/board/generateBoardDeliverablePDF";
import { BoardDeliverable, BoardMember } from "@/components/board/boardTypes";

const NAVY = "#0D2B5E";

type Step = "list" | "form" | "preview";

export default function BoardDeliverablePage() {
  const { memberId } = useParams<{ memberId: string }>();
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [member, setMember] = useState<BoardMember | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [deliverables, setDeliverables] = useState<BoardDeliverable[]>([]);

  const [step, setStep] = useState<Step>("list");
  const [selectedType, setSelectedType] = useState<BoardDeliverableType | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<{
    deliverable_id: string;
    version: number;
    content_md: string;
    type: BoardDeliverableType;
  } | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchDeliverables = useCallback(async () => {
    if (!memberId) return;
    const { data, error } = await (supabase as any)
      .from("unv_board_deliverables")
      .select("*")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false });
    if (!error) setDeliverables((data || []) as BoardDeliverable[]);
  }, [memberId]);

  useEffect(() => {
    const init = async () => {
      if (!memberId) {
        setAccessError("Link inválido.");
        setLoading(false);
        return;
      }
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setAccessError("Você precisa estar logado no portal pra acessar a Biblioteca Comercial.");
          setLoading(false);
          return;
        }

        const { data: memberData, error: memberErr } = await (supabase as any)
          .from("unv_board_members")
          .select("*")
          .eq("id", memberId)
          .maybeSingle();
        if (memberErr || !memberData) {
          setAccessError("Não encontramos o seu cadastro no UNV Board.");
          setLoading(false);
          return;
        }
        setMember(memberData as BoardMember);

        const { data: company } = await supabase
          .from("onboarding_companies")
          .select("name")
          .eq("id", memberData.company_id)
          .maybeSingle();
        setCompanyName(company?.name || "Sua empresa");

        await fetchDeliverables();
      } catch (err) {
        console.error("Erro ao carregar a Biblioteca Comercial:", err);
        setAccessError("Erro ao carregar a página. Tente novamente.");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [memberId, fetchDeliverables]);

  const openForm = (type: BoardDeliverableType) => {
    setSelectedType(type);
    setFormValues({});
    setStep("form");
  };

  const buildFormData = (type: BoardDeliverableType): Record<string, unknown> => {
    const config = BOARD_DELIVERABLE_TYPES[type];
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
    if (!selectedType || !member) return;
    const config = BOARD_DELIVERABLE_TYPES[selectedType];
    const formData = buildFormData(selectedType);
    if (Object.keys(formData).length === 0) {
      toast.error("Preencha pelo menos um campo do formulário");
      return;
    }
    setGenerating(true);
    try {
      const customTitle =
        selectedType === "outro" ? (formValues["titulo_documento"] || "").trim() : "";
      const { data, error } = await supabase.functions.invoke("board-engine", {
        body: {
          action: "generate_deliverable",
          member_id: member.id,
          type: selectedType,
          form_data: formData,
          ...(customTitle ? { title: `${customTitle} — ${companyName}` } : {}),
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setPreview({
        deliverable_id: data.deliverable_id,
        version: data.version || 1,
        content_md: data.content_md,
        type: selectedType,
      });
      setStep("preview");
      fetchDeliverables();
      toast.success(`${config.label} gerado — revise e emita o PDF oficial`);
    } catch (err: any) {
      console.error("Erro ao gerar documento:", err);
      toast.error(err?.message || "Erro ao gerar o documento");
    } finally {
      setGenerating(false);
    }
  };

  const uploadAndDownload = async (deliverable: {
    id: string;
    type: string;
    title: string;
    version: number;
    content_md: string;
    created_at?: string;
  }) => {
    if (!member) return;
    const doc = await generateBoardDeliverablePDF({
      title: deliverable.title,
      companyName,
      contentMd: deliverable.content_md,
      version: deliverable.version,
      date: deliverable.created_at || new Date().toISOString(),
    });
    const blob = doc.output("blob");
    const path = `${member.id}/${deliverable.type}-v${deliverable.version}.pdf`;

    const { error: uploadErr } = await supabase.storage
      .from("board-deliverables")
      .upload(path, blob, { contentType: "application/pdf", upsert: true });
    if (uploadErr) {
      // Falha no upload não impede o download local
      console.error("Erro no upload do PDF:", uploadErr);
      toast.error("PDF gerado, mas não foi possível salvar na biblioteca");
    } else {
      const { error: updateErr } = await (supabase as any)
        .from("unv_board_deliverables")
        .update({ pdf_path: path, status: "final" })
        .eq("id", deliverable.id);
      if (updateErr) console.error("Erro ao atualizar entregável:", updateErr);
    }

    doc.save(`${deliverable.title.replace(/[^a-zA-Z0-9]+/g, "_")}_v${deliverable.version}.pdf`);
  };

  const finalizePDF = async () => {
    if (!preview || !member) return;
    setFinalizing(true);
    try {
      const config = BOARD_DELIVERABLE_TYPES[preview.type];
      const row = deliverables.find((d) => d.id === preview.deliverable_id);
      await uploadAndDownload({
        id: preview.deliverable_id,
        type: preview.type,
        title: row?.title || `${config.label} — ${companyName}`,
        version: preview.version,
        content_md: preview.content_md,
        created_at: row?.created_at,
      });
      toast.success("Documento oficial emitido");
      setStep("list");
      setPreview(null);
      setSelectedType(null);
      fetchDeliverables();
    } catch (err) {
      console.error("Erro ao emitir PDF:", err);
      toast.error("Erro ao emitir o PDF");
    } finally {
      setFinalizing(false);
    }
  };

  const downloadExisting = async (d: BoardDeliverable) => {
    setDownloadingId(d.id);
    try {
      if (d.pdf_path) {
        const { data, error } = await supabase.storage
          .from("board-deliverables")
          .createSignedUrl(d.pdf_path, 60);
        if (!error && data?.signedUrl) {
          window.open(data.signedUrl, "_blank");
          return;
        }
      }
      // sem pdf_path (ou link falhou): regenera do content_md
      if (!d.content_md) {
        toast.error("Este documento não tem conteúdo pra gerar o PDF");
        return;
      }
      await uploadAndDownload({
        id: d.id,
        type: d.type,
        title: d.title,
        version: d.version,
        content_md: d.content_md,
        created_at: d.created_at,
      });
      fetchDeliverables();
    } catch (err) {
      console.error("Erro ao baixar documento:", err);
      toast.error("Erro ao baixar o documento");
    } finally {
      setDownloadingId(null);
    }
  };

  // ============ RENDER ============

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-background">
        <div className="h-28" style={{ backgroundColor: NAVY }} />
        <div className="container mx-auto px-4 py-8 max-w-5xl space-y-4">
          <Skeleton className="h-8 w-72" />
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
          </div>
        </div>
      </div>
    );
  }

  if (accessError) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Library className="h-5 w-5" style={{ color: NAVY }} />
              UNV Board — Biblioteca Comercial
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{accessError}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedConfig = selectedType ? BOARD_DELIVERABLE_TYPES[selectedType] : null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background">
      {/* Header premium navy */}
      <div style={{ backgroundColor: NAVY }} className="text-white">
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          <div className="flex items-center gap-3">
            <Library className="h-8 w-8 opacity-90" />
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/60">UNV Board</p>
              <h1 className="text-2xl font-bold">Biblioteca Comercial</h1>
            </div>
          </div>
          <p className="mt-3 text-white/80 text-sm">{companyName}</p>
          <div className="mt-4 h-1 w-16 bg-[#CC1B1B] rounded-full" />
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-10">
        {/* ============ CRIAR DOCUMENTO ============ */}
        <section>
          <div className="flex items-center gap-2 mb-1">
            <FilePlus2 className="h-5 w-5" style={{ color: NAVY }} />
            <h2 className="text-lg font-semibold">Criar documento</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-5">
            Responda o formulário guiado e a UNV redige o documento oficial da sua operação
            comercial.
          </p>

          {step === "list" && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {BOARD_DELIVERABLE_TYPE_KEYS.map((type) => {
                const config = BOARD_DELIVERABLE_TYPES[type];
                return (
                  <Card
                    key={type}
                    className="cursor-pointer transition-all hover:shadow-md hover:border-[#0D2B5E]/40 group"
                    onClick={() => openForm(type)}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText
                          className="h-4 w-4 shrink-0 group-hover:scale-110 transition-transform"
                          style={{ color: NAVY }}
                        />
                        {config.label}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-sm">{config.description}</CardDescription>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {step === "form" && selectedConfig && selectedType && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{selectedConfig.label}</CardTitle>
                    <CardDescription className="mt-1">
                      Responda com as suas palavras — não precisa ser bonito, precisa ser real.
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setStep("list")}
                    disabled={generating}
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Voltar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {selectedConfig.fields.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label className="font-medium">{field.label}</Label>
                    {field.type === "text" ? (
                      <Input
                        value={formValues[field.key] || ""}
                        placeholder={field.placeholder}
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
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Redigindo o documento com base nas suas respostas — isso pode levar até um
                    minuto. Não feche a página.
                  </div>
                )}

                <div className="flex justify-end">
                  <Button
                    onClick={submitForm}
                    disabled={generating}
                    className="bg-[#0D2B5E] hover:bg-[#0D2B5E]/90"
                  >
                    {generating ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    Gerar documento
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === "preview" && preview && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      {boardDeliverableLabel(preview.type)} — pronto pra revisão
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Versão {preview.version}. Leia o conteúdo e emita o PDF oficial.
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStep("list");
                      setPreview(null);
                    }}
                    disabled={finalizing}
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Voltar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="whitespace-pre-wrap text-sm leading-relaxed bg-muted/40 rounded-md p-5 max-h-[480px] overflow-y-auto border">
                  {preview.content_md}
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    onClick={finalizePDF}
                    disabled={finalizing}
                    className="bg-[#0D2B5E] hover:bg-[#0D2B5E]/90"
                  >
                    {finalizing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Gerar PDF oficial
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </section>

        {/* ============ MEUS DOCUMENTOS ============ */}
        <section>
          <div className="flex items-center gap-2 mb-1">
            <Library className="h-5 w-5" style={{ color: NAVY }} />
            <h2 className="text-lg font-semibold">Meus documentos</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-5">
            Todos os documentos oficiais construídos no seu ano de Board.
          </p>

          {deliverables.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p>Nenhum documento ainda — crie o primeiro acima.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {deliverables.map((d) => (
                <Card key={d.id}>
                  <CardContent className="py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="h-5 w-5 shrink-0" style={{ color: NAVY }} />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{d.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {boardDeliverableLabel(d.type)} · v{d.version} ·{" "}
                          {d.created_at ? format(new Date(d.created_at), "dd/MM/yyyy") : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {d.status === "final" ? (
                        <Badge variant="outline" className="border-green-500 text-green-600">
                          Oficial
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                          Rascunho
                        </Badge>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={downloadingId === d.id}
                        onClick={() => downloadExisting(d)}
                      >
                        {downloadingId === d.id ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4 mr-1" />
                        )}
                        Baixar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <footer className="py-6 text-center text-xs text-muted-foreground border-t">
          Universidade Nacional de Vendas · UNV Board
        </footer>
      </div>
    </div>
  );
}
