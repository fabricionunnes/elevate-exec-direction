import { useNavigate } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Code2, DollarSign, Target, Briefcase, MessageSquare, Video, BarChart3, LayoutGrid, Download, Loader2, Copy, Send } from "lucide-react";
import { FinancialApiDocs } from "@/components/financial-api/FinancialApiDocs";
import { CrmApiDocs } from "@/components/financial-api/CrmApiDocs";
import { ProductApiDocs } from "@/components/financial-api/ProductApiDocs";
import { ConversationsApiDocs } from "@/components/financial-api/ConversationsApiDocs";
import { ProjectMeetingsApiDocs } from "@/components/financial-api/ProjectMeetingsApiDocs";
import { CRMTrafficApiDocs } from "@/components/crm/traffic/CRMTrafficApiDocs";
import { WhatsAppSendApiDocs } from "@/components/financial-api/WhatsAppSendApiDocs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export default function ApiDocsPage() {
  const navigate = useNavigate();
  const allRef = useRef<HTMLDivElement>(null);
  const textUrlRef = useRef<string | null>(null);
  const [textUrl, setTextUrl] = useState<string | null>(null);
  const [textFilename, setTextFilename] = useState("");
  const [fullText, setFullText] = useState("");

  const extractText = useCallback(() => {
    const element = allRef.current;
    if (!element) return;

    // Clone to expand all hidden/collapsed nodes before extraction
    const clone = element.cloneNode(true) as HTMLDivElement;
    clone.style.position = "absolute";
    clone.style.left = "-99999px";
    clone.style.top = "0";

    clone.querySelectorAll<HTMLElement>("[hidden]").forEach((n) => {
      n.removeAttribute("hidden");
      n.style.display = "block";
    });
    clone.querySelectorAll<HTMLElement>('[data-state="inactive"], [data-state="closed"]').forEach((n) => {
      n.setAttribute("data-state", "open");
      n.style.display = "block";
      n.style.height = "auto";
      n.style.maxHeight = "none";
      n.style.overflow = "visible";
    });

    document.body.appendChild(clone);
    // Force layout so innerText respects line breaks
    void clone.offsetHeight;
    let text = (clone.innerText || clone.textContent || "").trim();
    clone.remove();

    // Normalize: collapse 3+ blank lines into 2
    text = text.replace(/\n{3,}/g, "\n\n");

    const header = `DOCUMENTAÇÃO COMPLETA DA API - UNV NEXUS\nGerado em: ${new Date().toLocaleString("pt-BR")}\n${"=".repeat(60)}\n\n`;
    const finalText = header + text;

    setFullText(finalText);

    if (textUrlRef.current) URL.revokeObjectURL(textUrlRef.current);
    const blob = new Blob([finalText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    textUrlRef.current = url;
    setTextUrl(url);
    const date = new Date().toISOString().split("T")[0];
    setTextFilename(`documentacao-api-unv-nexus-${date}.txt`);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      extractText();
    }, 400);
    return () => {
      window.clearTimeout(timer);
      if (textUrlRef.current) URL.revokeObjectURL(textUrlRef.current);
    };
  }, [extractText]);

  const handleCopy = async () => {
    if (!fullText) return;
    try {
      await navigator.clipboard.writeText(fullText);
      toast.success("Documentação copiada para a área de transferência");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate("/onboarding-tasks")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Nexus
          </Button>
          <div className="h-6 w-px bg-border" />
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Code2 className="h-5 w-5 text-primary" />
            Documentação da API
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="all" className="space-y-6">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <TabsList className="grid w-full max-w-5xl grid-cols-4 sm:grid-cols-7 h-auto">
              <TabsTrigger value="all" className="gap-2">
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline">Geral</span>
              </TabsTrigger>
              <TabsTrigger value="financial" className="gap-2">
                <DollarSign className="h-4 w-4" />
                <span className="hidden sm:inline">Financeiro</span>
              </TabsTrigger>
              <TabsTrigger value="crm" className="gap-2">
                <Target className="h-4 w-4" />
                <span className="hidden sm:inline">CRM Comercial</span>
              </TabsTrigger>
              <TabsTrigger value="traffic" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Tráfego Pago</span>
              </TabsTrigger>
              <TabsTrigger value="project_meetings" className="gap-2">
                <Video className="h-4 w-4" />
                <span className="hidden sm:inline">Reuniões</span>
              </TabsTrigger>
              <TabsTrigger value="product" className="gap-2">
                <Briefcase className="h-4 w-4" />
                <span className="hidden sm:inline">Produto</span>
              </TabsTrigger>
              <TabsTrigger value="conversations" className="gap-2">
                <MessageSquare className="h-4 w-4" />
                <span className="hidden sm:inline">Conversas</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="all" className="space-y-4">
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={handleCopy} disabled={!fullText}>
                <Copy className="h-4 w-4 mr-2" /> Copiar tudo
              </Button>
              {textUrl ? (
                <Button asChild size="sm">
                  <a href={textUrl} download={textFilename}>
                    <Download className="h-4 w-4 mr-2" /> Baixar (.txt)
                  </a>
                </Button>
              ) : (
                <Button disabled size="sm">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Preparando...
                </Button>
              )}
            </div>
            <div ref={allRef} className="space-y-12 bg-background p-4">
              <section><FinancialApiDocs /></section>
              <section><CrmApiDocs /></section>
              <section><CRMTrafficApiDocs /></section>
              <section><ProjectMeetingsApiDocs /></section>
              <section><ProductApiDocs /></section>
              <section><ConversationsApiDocs /></section>
            </div>
          </TabsContent>

          <TabsContent value="financial">
            <FinancialApiDocs />
          </TabsContent>

          <TabsContent value="crm">
            <CrmApiDocs />
          </TabsContent>

          <TabsContent value="product">
            <ProductApiDocs />
          </TabsContent>

          <TabsContent value="traffic">
            <CRMTrafficApiDocs />
          </TabsContent>

          <TabsContent value="project_meetings">
            <ProjectMeetingsApiDocs />
          </TabsContent>

          <TabsContent value="conversations">
            <ConversationsApiDocs />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
