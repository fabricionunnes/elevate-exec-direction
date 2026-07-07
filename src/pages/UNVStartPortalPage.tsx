// Portal SELF-SERVICE do UNV Start (rota /start/:token).
// O cliente monta sozinho a estrutura comercial da empresa dele: 7 documentos
// gerados por IA, em sequência guiada, cada módulo destravando o próximo.
// Ao final, o "Book da Estrutura" consolida tudo. Acesso por link mágico (token).
//
// Reaproveita padrões do BoardTaskFormPage: invoke com extração de erro do corpo,
// arrayBufferToBase64, sanitizeFileName, MarkdownPreview, e o PDF oficial via
// generateBoardDeliverablePDF. NAVY #0D2B5E.

import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Loader2,
  ArrowLeft,
  CheckCircle2,
  Download,
  Lock,
  FileText,
  Sparkles,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  PartyPopper,
  ExternalLink,
} from "lucide-react";
import logoUnvBoard from "@/assets/logo-unv-board.png";
import { generateBoardDeliverablePDF } from "@/components/board/generateBoardDeliverablePDF";

const NAVY = "#0D2B5E";
const WA_UPSELL = "https://wa.me/5511927008490";

// ============ TIPOS LOCAIS (engine não está no types.ts) ============
interface ModuleQuestion {
  key: string;
  label: string;
  placeholder?: string;
  type: "text" | "textarea" | "list";
}

interface ModuleCard {
  step: number;
  type: string;
  label: string;
  done: boolean;
  unlocked: boolean;
  deliverable: { id: string; version: number } | null;
}

interface Member {
  name: string;
  company_name: string;
  current_step: number;
}

interface AccessData {
  member: Member;
  modules: ModuleCard[];
  all_done: boolean;
  has_password: boolean;
}

interface ModuleDetail {
  step: number;
  type: string;
  label: string;
  questions: ModuleQuestion[];
}

interface ExistingDeliverable {
  id: string;
  content_md: string;
  form_data: Record<string, unknown> | null;
  status: string;
  version: number;
}

interface Preview {
  deliverable_id: string;
  version: number;
  content_md: string;
  doc_label: string;
}

// view interna da página
type View = "central" | "module" | "book";

// ============ HELPERS (mesmo padrão do BoardTaskFormPage) ============
async function invokeEngine(body: Record<string, unknown>): Promise<any> {
  const { data, error } = await supabase.functions.invoke("unv-start-engine", { body });
  if (error) {
    let msg = "Não conseguimos falar com o servidor. Tente novamente em instantes.";
    const ctx = (error as any)?.context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const parsed = await ctx.json();
        if (parsed?.error) msg = parsed.error;
        if (parsed?.payment_pending) msg = "PAYMENT_PENDING";
      } catch {
        // corpo não era JSON — mantém a mensagem genérica
      }
    }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

// Máscara de moeda BRL — dígitos entram como centavos: "100000" -> "R$ 1.000,00"
function maskCurrency(input: string): string {
  const digits = (input || "").replace(/\D/g, "");
  if (!digits) return "";
  const cents = parseInt(digits, 10);
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
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

export default function UNVStartPortalPage() {
  const { token } = useParams<{ token: string }>();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [paymentPending, setPaymentPending] = useState(false);
  const [access, setAccess] = useState<AccessData | null>(null);

  const [view, setView] = useState<View>("central");

  // ----- criação de senha (topo da central) -----
  const [pwd, setPwd] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  // ----- módulo em edição -----
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [moduleDetail, setModuleDetail] = useState<ModuleDetail | null>(null);
  const [loadingModule, setLoadingModule] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [finalizing, setFinalizing] = useState(false);

  // ----- book -----
  const [bookLoading, setBookLoading] = useState(false);
  const [bookPreview, setBookPreview] = useState<Preview | null>(null);
  const [bookFinalizing, setBookFinalizing] = useState(false);
  const [bookDone, setBookDone] = useState(false);

  // ----- download de módulo concluído -----
  const [opening, setOpening] = useState<number | null>(null);

  const loadAccess = useCallback(async () => {
    if (!token) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    try {
      const data = await invokeEngine({ action: "access", token });
      setAccess(data as AccessData);
    } catch (err: any) {
      if (err?.message === "PAYMENT_PENDING") {
        setPaymentPending(true);
      } else {
        console.error("Erro ao carregar o UNV Start:", err);
        setNotFound(true);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadAccess();
  }, [loadAccess]);

  const totalModules = access?.modules.length || 7;
  const doneCount = access?.modules.filter((m) => m.done).length || 0;
  const progressPct = totalModules > 0 ? Math.round((doneCount / totalModules) * 100) : 0;

  // ============ AÇÕES ============
  const savePassword = async () => {
    if (!token) return;
    if (pwd.length < 6) {
      toast.error("Use pelo menos 6 caracteres");
      return;
    }
    setSavingPwd(true);
    try {
      await invokeEngine({ action: "set_password", token, password: pwd });
      toast.success("Senha criada. Agora você pode voltar quando quiser.");
      setPwd("");
      setAccess((a) => (a ? { ...a, has_password: true } : a));
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível salvar a senha.");
    } finally {
      setSavingPwd(false);
    }
  };

  // autosave local: guarda o que o cliente digita pra não perder se sair no meio (mesmo navegador)
  useEffect(() => {
    if (view !== "module" || activeStep == null || !token || preview) return;
    try {
      if (Object.keys(formValues).length > 0) {
        localStorage.setItem(`unvstart_draft_${token}_${activeStep}`, JSON.stringify(formValues));
      }
    } catch {
      /* ignora storage cheio/indisponível */
    }
  }, [formValues, view, activeStep, token, preview]);

  const openModule = async (step: number) => {
    if (!token) return;
    setActiveStep(step);
    setModuleDetail(null);
    setPreview(null);
    setFormValues({});
    setView("module");
    setLoadingModule(true);
    window.scrollTo({ top: 0 });
    try {
      const data = await invokeEngine({ action: "get_module", token, step });
      const mod = data.module as ModuleDetail;
      setModuleDetail(mod);
      // pré-preenche a partir do que já foi respondido (form_data)
      const existing = data.existing as ExistingDeliverable | null;
      if (existing?.form_data && typeof existing.form_data === "object") {
        const seed: Record<string, string> = {};
        for (const q of mod.questions) {
          const v = (existing.form_data as Record<string, unknown>)[q.key];
          if (Array.isArray(v)) seed[q.key] = v.map((x) => String(x)).join("\n");
          else if (v != null) seed[q.key] = q.type === "currency" ? maskCurrency(String(v)) : String(v);
        }
        setFormValues(seed);
      } else {
        // sem rascunho no servidor — tenta recuperar o que ele digitou antes de sair (mesmo navegador)
        try {
          const cached = localStorage.getItem(`unvstart_draft_${token}_${step}`);
          if (cached) setFormValues(JSON.parse(cached));
        } catch {
          /* ignora */
        }
      }
    } catch (err: any) {
      console.error("Erro ao carregar o módulo:", err);
      toast.error(err?.message || "Não foi possível abrir este módulo.");
      setView("central");
    } finally {
      setLoadingModule(false);
    }
  };

  const buildFormData = (): Record<string, unknown> => {
    if (!moduleDetail) return {};
    const out: Record<string, unknown> = {};
    for (const q of moduleDetail.questions) {
      const raw = (formValues[q.key] || "").trim();
      if (!raw) continue;
      out[q.key] =
        q.type === "list"
          ? raw
              .split("\n")
              .map((l) => l.trim())
              .filter(Boolean)
          : raw;
    }
    return out;
  };

  const generateModule = async () => {
    if (!token || !moduleDetail || activeStep == null) return;
    const formData = buildFormData();
    // validação leve: pelo menos metade dos campos preenchidos
    const minFilled = Math.max(1, Math.ceil(moduleDetail.questions.length / 2));
    if (Object.keys(formData).length < minFilled) {
      toast.error(`Responda pelo menos ${minFilled} campos pra gerar o documento`);
      return;
    }
    setGenerating(true);
    try {
      const data = await invokeEngine({
        action: "submit_module",
        token,
        step: activeStep,
        form_data: formData,
      });
      setPreview({
        deliverable_id: data.deliverable_id,
        version: data.version || 1,
        content_md: data.content_md,
        doc_label: data.doc_label || moduleDetail.label,
      });
      window.scrollTo({ top: 0 });
    } catch (err: any) {
      console.error("Erro ao gerar o documento:", err);
      toast.error(err?.message || "Erro ao gerar o documento. Tente novamente.");
    } finally {
      setGenerating(false);
    }
  };

  const finalizeModule = async () => {
    if (!token || !preview || !access) return;
    setFinalizing(true);
    try {
      const doc = await generateBoardDeliverablePDF({
        title: preview.doc_label,
        companyName: access.member.company_name || "Sua empresa",
        contentMd: preview.content_md,
        version: preview.version,
        date: new Date().toISOString(),
      });
      const base64 = arrayBufferToBase64(doc.output("arraybuffer") as ArrayBuffer);
      const fileName = `${sanitizeFileName(preview.doc_label)}_v${preview.version}.pdf`;
      await invokeEngine({
        action: "finalize_module",
        token,
        deliverable_id: preview.deliverable_id,
        pdf_base64: base64,
        file_name: fileName,
      });
      doc.save(fileName);
      toast.success("Documento finalizado. Próximo módulo liberado.");
      // limpa o rascunho local desse documento (já foi finalizado)
      try {
        localStorage.removeItem(`unvstart_draft_${token}_${activeStep}`);
      } catch {
        /* ignora */
      }
      // recarrega estado (destrava o próximo) e volta pra central
      setPreview(null);
      setModuleDetail(null);
      setActiveStep(null);
      setView("central");
      window.scrollTo({ top: 0 });
      await loadAccess();
    } catch (err: any) {
      console.error("Erro ao finalizar o documento:", err);
      toast.error(err?.message || "Erro ao gerar o PDF oficial. Tente novamente.");
    } finally {
      setFinalizing(false);
    }
  };

  const viewOrDownload = async (mod: ModuleCard) => {
    if (!token || !mod.deliverable) return;
    setOpening(mod.step);
    try {
      const data = await invokeEngine({
        action: "download_url",
        token,
        deliverable_id: mod.deliverable.id,
      });
      if (data?.url) window.open(data.url, "_blank");
      else toast.error("Documento indisponível no momento.");
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível abrir o documento.");
    } finally {
      setOpening(null);
    }
  };

  // ----- BOOK -----
  const startBook = async () => {
    if (!token) return;
    setView("book");
    setBookPreview(null);
    setBookDone(false);
    setBookLoading(true);
    window.scrollTo({ top: 0 });
    try {
      const data = await invokeEngine({ action: "generate_book", token });
      setBookPreview({
        deliverable_id: data.deliverable_id,
        version: data.version || 1,
        content_md: data.content_md,
        doc_label: data.doc_label || "Book da Estrutura Comercial",
      });
    } catch (err: any) {
      console.error("Erro ao gerar o book:", err);
      toast.error(err?.message || "Erro ao montar o book. Tente novamente.");
      setView("central");
    } finally {
      setBookLoading(false);
    }
  };

  const downloadBook = async () => {
    if (!bookPreview || !access) return;
    setBookFinalizing(true);
    try {
      const doc = await generateBoardDeliverablePDF({
        title: bookPreview.doc_label,
        companyName: access.member.company_name || "Sua empresa",
        contentMd: bookPreview.content_md,
        version: bookPreview.version,
        date: new Date().toISOString(),
      });
      const fileName = `${sanitizeFileName(bookPreview.doc_label)}.pdf`;
      doc.save(fileName);
      setBookDone(true);
      window.scrollTo({ top: 0 });
    } catch (err: any) {
      console.error("Erro ao baixar o book:", err);
      toast.error(err?.message || "Erro ao gerar o PDF do book.");
    } finally {
      setBookFinalizing(false);
    }
  };

  // ============ HEADER ============
  const header = (
    <div style={{ backgroundColor: NAVY }} className="text-white">
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <img src={logoUnvBoard} alt="UNV Start" className="h-14 md:h-16" />
        <h1 className="text-lg md:text-xl font-bold mt-2">
          {access?.member.company_name || "UNV Start"}
        </h1>
        {access?.member.name && (
          <p className="text-sm text-blue-100/80">Bem-vindo, {access.member.name}.</p>
        )}
        <div className="mt-3 h-1 w-14 bg-[#CC1B1B] rounded-full" />
      </div>
    </div>
  );

  const footer = (
    <footer className="py-6 text-center text-xs text-muted-foreground">
      Universidade Nacional de Vendas · UNV Start
    </footer>
  );

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-slate-50 dark:bg-background">
      {header}
      <div className="container mx-auto px-4 py-6 max-w-2xl space-y-4">{children}</div>
      {footer}
    </div>
  );

  // ============ LOADING ============
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-background">
        <div className="h-28" style={{ backgroundColor: NAVY }} />
        <div className="container mx-auto px-4 py-6 max-w-2xl space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );
  }

  // ============ PAGAMENTO PENDENTE ============
  if (paymentPending) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2" style={{ color: NAVY }}>
              <FileText className="h-5 w-5" />
              UNV Start
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground">
              Ainda não confirmamos o pagamento desta compra. Assim que ele for
              aprovado, seu acesso é liberado automaticamente — pode levar alguns
              minutos. Se já pagou, atualize esta página em instantes.
            </p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Atualizar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============ NÃO ENCONTRADO ============
  if (notFound || !access) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2" style={{ color: NAVY }}>
              <FileText className="h-5 w-5" />
              UNV Start
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Não encontramos este acesso. O link pode estar incompleto ou ter
              expirado. Confira o link que você recebeu por e-mail/WhatsApp ou entre
              pela página de login.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============ VIEW: MÓDULO ============
  if (view === "module") {
    // loading do detalhe do módulo
    if (loadingModule || !moduleDetail) {
      return shell(
        <Card>
          <CardContent className="py-6 space-y-4">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </CardContent>
        </Card>,
      );
    }

    // preview (revisão antes de finalizar)
    if (preview) {
      return shell(
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              {preview.doc_label}
            </CardTitle>
            <CardDescription>
              Revise antes de finalizar. Se algo não ficou certo, volte e ajuste as
              suas respostas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/40 rounded-md border p-4 max-h-[440px] overflow-y-auto">
              <MarkdownPreview content={preview.content_md} />
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
              <Button
                variant="outline"
                onClick={() => setPreview(null)}
                disabled={finalizing}
                className="w-full sm:w-auto"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar e ajustar
              </Button>
              <Button
                onClick={finalizeModule}
                disabled={finalizing}
                className="w-full sm:w-auto bg-[#0D2B5E] hover:bg-[#0D2B5E]/90 text-white"
              >
                {finalizing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Finalizar e baixar PDF
              </Button>
            </div>
            {finalizing && (
              <p className="text-xs text-muted-foreground text-center">
                Gerando o PDF oficial e liberando o próximo módulo — não feche a página.
              </p>
            )}
          </CardContent>
        </Card>,
      );
    }

    // formulário guiado
    const stepIndex = access.modules.findIndex((m) => m.step === activeStep);
    return shell(
      <>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setView("central")}
          disabled={generating}
          className="text-muted-foreground -ml-2"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar aos módulos
        </Button>

        <Card>
          <CardHeader className="pb-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#CC1B1B]">
              Documento {stepIndex >= 0 ? stepIndex + 1 : activeStep} de {totalModules}
            </p>
            <CardTitle className="text-lg">{moduleDetail.label}</CardTitle>
            <CardDescription>
              Responda com a realidade da sua empresa — não precisa ser bonito,
              precisa ser real. A IA transforma isso num documento oficial.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {moduleDetail.questions.map((q) => (
              <div key={q.key} className="space-y-2">
                <Label className="font-medium">{q.label}</Label>
                {q.type === "currency" ? (
                  <Input
                    inputMode="numeric"
                    value={formValues[q.key] || ""}
                    placeholder="R$ 0,00"
                    disabled={generating}
                    onChange={(e) =>
                      setFormValues((v) => ({
                        ...v,
                        [q.key]: maskCurrency(e.target.value),
                      }))
                    }
                  />
                ) : q.type === "text" ? (
                  <Input
                    value={formValues[q.key] || ""}
                    placeholder={q.placeholder}
                    disabled={generating}
                    onChange={(e) =>
                      setFormValues((v) => ({ ...v, [q.key]: e.target.value }))
                    }
                  />
                ) : (
                  <>
                    <Textarea
                      rows={q.type === "list" ? 4 : 3}
                      value={formValues[q.key] || ""}
                      placeholder={q.placeholder}
                      disabled={generating}
                      onChange={(e) =>
                        setFormValues((v) => ({ ...v, [q.key]: e.target.value }))
                      }
                    />
                    {q.type === "list" && (
                      <p className="text-xs text-muted-foreground">Um item por linha.</p>
                    )}
                  </>
                )}
              </div>
            ))}

            {generating && (
              <div className="rounded-md border border-blue-500/30 bg-blue-500/10 p-3 text-sm flex items-center gap-2 text-blue-700 dark:text-blue-300">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                Montando seu documento — isso pode levar até 1 minuto. Não feche a página.
              </div>
            )}

            <Button
              onClick={generateModule}
              disabled={generating}
              className="w-full h-11 bg-[#0D2B5E] hover:bg-[#0D2B5E]/90 text-white"
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
      </>,
    );
  }

  // ============ VIEW: BOOK ============
  if (view === "book") {
    if (bookDone) {
      return shell(
        <Card className="border-[#0D2B5E]/30">
          <CardContent className="py-10 text-center space-y-5">
            <PartyPopper className="h-12 w-12 mx-auto text-[#CC1B1B]" />
            <div>
              <h2 className="text-xl font-bold" style={{ color: NAVY }}>
                Sua estrutura comercial está pronta
              </h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                Você construiu, do zero, os 7 documentos que formam a base comercial
                da sua empresa — reunidos agora no seu Book da Estrutura. O download
                começou no seu aparelho.
              </p>
            </div>

            <div className="rounded-lg border bg-muted/40 p-5 text-left max-w-md mx-auto space-y-3">
              <p className="font-semibold text-[#0D2B5E] dark:text-blue-300">
                Agora que você tem o mapa
              </p>
              <p className="text-sm text-muted-foreground">
                A UNV tem programas pra colocar essa estrutura pra rodar com o seu
                time — do processo à gestão que faz bater meta todo mês.
              </p>
              <Button
                asChild
                variant="outline"
                className="w-full border-[#0D2B5E] text-[#0D2B5E] hover:bg-[#0D2B5E] hover:text-white"
              >
                <a href={WA_UPSELL} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Quero saber mais
                </a>
              </Button>
            </div>

            <Button variant="ghost" onClick={() => setView("central")}>
              Voltar aos meus documentos
            </Button>
          </CardContent>
        </Card>,
      );
    }

    if (bookLoading || !bookPreview) {
      return shell(
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <Loader2 className="h-10 w-10 mx-auto animate-spin text-[#0D2B5E]" />
            <div>
              <h2 className="text-lg font-semibold" style={{ color: NAVY }}>
                Montando o seu Book da Estrutura
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Consolidando os 7 documentos num único material — isso pode levar até
                1 minuto. Não feche a página.
              </p>
            </div>
          </CardContent>
        </Card>,
      );
    }

    return shell(
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-[#0D2B5E] shrink-0" />
            {bookPreview.doc_label}
          </CardTitle>
          <CardDescription>
            Este é o material que reúne toda a sua estrutura comercial. Revise e baixe
            o PDF final.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/40 rounded-md border p-4 max-h-[440px] overflow-y-auto">
            <MarkdownPreview content={bookPreview.content_md} />
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setView("central")}
              disabled={bookFinalizing}
              className="w-full sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <Button
              onClick={downloadBook}
              disabled={bookFinalizing}
              className="w-full sm:w-auto bg-[#0D2B5E] hover:bg-[#0D2B5E]/90 text-white"
            >
              {bookFinalizing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Baixar Book em PDF
            </Button>
          </div>
        </CardContent>
      </Card>,
    );
  }

  // ============ VIEW: CENTRAL (home do portal) ============
  return shell(
    <>
      {/* aviso de senha (discreto) */}
      {!access.has_password && (
        <Card className="border-[#0D2B5E]/25 bg-[#0D2B5E]/[0.03]">
          <CardContent className="py-4 space-y-3">
            <div className="flex items-start gap-2">
              <ShieldCheck className="h-5 w-5 text-[#0D2B5E] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-[#0D2B5E] dark:text-blue-300">
                  Crie uma senha pra voltar quando quiser
                </p>
                <p className="text-xs text-muted-foreground">
                  Assim você acessa pela página de login sem depender do link.
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                type="password"
                value={pwd}
                placeholder="Crie uma senha (mín. 6 caracteres)"
                disabled={savingPwd}
                onChange={(e) => setPwd(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && savePassword()}
                className="bg-background"
              />
              <Button
                onClick={savePassword}
                disabled={savingPwd}
                className="bg-[#0D2B5E] hover:bg-[#0D2B5E]/90 text-white shrink-0"
              >
                {savingPwd ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar senha"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* progresso */}
      <Card>
        <CardContent className="py-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold" style={{ color: NAVY }}>
                Sua estrutura comercial
              </p>
              <p className="text-xs text-muted-foreground">
                {doneCount} de {totalModules} documentos concluídos
              </p>
            </div>
            <span className="text-2xl font-bold" style={{ color: NAVY }}>
              {progressPct}%
            </span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </CardContent>
      </Card>

      {/* módulos */}
      <div className="space-y-3">
        {access.modules.map((mod, idx) => {
          const num = idx + 1;
          if (mod.done) {
            return (
              <Card key={mod.step} className="border-green-600/30">
                <CardContent className="py-4 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-green-600/10 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">Documento {num}</p>
                    <p className="font-semibold truncate">{mod.label}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={opening === mod.step}
                    onClick={() => viewOrDownload(mod)}
                    className="shrink-0"
                  >
                    {opening === mod.step ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Download className="h-4 w-4 sm:mr-1.5" />
                        <span className="hidden sm:inline">Ver / Baixar</span>
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          }

          if (mod.unlocked) {
            const started = !!mod.deliverable;
            return (
              <Card key={mod.step} className="border-[#0D2B5E]/40 shadow-sm">
                <CardContent className="py-4 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-[#0D2B5E]/10 flex items-center justify-center shrink-0 font-bold text-[#0D2B5E]">
                    {num}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">Documento {num}</p>
                    <p className="font-semibold truncate">{mod.label}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => openModule(mod.step)}
                    className="shrink-0 bg-[#0D2B5E] hover:bg-[#0D2B5E]/90 text-white"
                  >
                    {started ? "Continuar" : "Começar"}
                    <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Button>
                </CardContent>
              </Card>
            );
          }

          // travado
          return (
            <Card key={mod.step} className="opacity-60">
              <CardContent className="py-4 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">Documento {num}</p>
                  <p className="font-semibold truncate text-muted-foreground">
                    {mod.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Conclua o anterior pra liberar
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* BOOK — largura total, destacado */}
      <Card
        className={
          access.all_done
            ? "border-2 border-[#0D2B5E] bg-[#0D2B5E]/[0.04] shadow-md"
            : "opacity-70"
        }
      >
        <CardContent className="py-5 space-y-3">
          <div className="flex items-start gap-3">
            <div
              className={
                "h-10 w-10 rounded-full flex items-center justify-center shrink-0 " +
                (access.all_done ? "bg-[#0D2B5E] text-white" : "bg-muted text-muted-foreground")
              }
            >
              {access.all_done ? <BookOpen className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
            </div>
            <div className="flex-1">
              <p className="font-bold text-[#0D2B5E] dark:text-blue-300">
                Book da Estrutura Comercial
              </p>
              <p className="text-sm text-muted-foreground">
                {access.all_done
                  ? "Tudo pronto. Gere o material final que reúne os 7 documentos da sua estrutura."
                  : "Conclua os 7 documentos pra liberar o seu book completo."}
              </p>
            </div>
          </div>
          <Button
            onClick={startBook}
            disabled={!access.all_done}
            className="w-full h-11 bg-[#0D2B5E] hover:bg-[#0D2B5E]/90 text-white disabled:opacity-50"
          >
            <BookOpen className="h-4 w-4 mr-2" />
            {access.all_done ? "Gerar meu Book da Estrutura" : "Book bloqueado"}
          </Button>
        </CardContent>
      </Card>
    </>,
  );
}
