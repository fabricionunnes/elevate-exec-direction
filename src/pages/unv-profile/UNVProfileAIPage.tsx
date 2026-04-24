import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Brain, Target, AlertTriangle, MessageSquare, TrendingUp, Loader2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

type ToolKey = "candidate_analysis" | "pdi_suggestion" | "promotion_suggestion" | "turnover_risk" | "feedback_generation" | "strategic_crossing";

const TOOLS: { key: ToolKey; icon: any; title: string; desc: string; needsContext: boolean; placeholder?: string }[] = [
  { key: "candidate_analysis", icon: Brain, title: "Análise de candidatos", desc: "Avalia currículo e perfil para gerar score de aderência à vaga.", needsContext: true, placeholder: "Cole aqui dados do candidato (currículo, perfil DISC, respostas) e a vaga." },
  { key: "pdi_suggestion", icon: Target, title: "Sugestão de PDI", desc: "Cruza perfil DISC + desempenho + cargo para recomendar plano de desenvolvimento.", needsContext: true, placeholder: "Informe nome do colaborador, cargo, perfil DISC e principais desafios." },
  { key: "promotion_suggestion", icon: TrendingUp, title: "Sugestão de promoções", desc: "Identifica colaboradores prontos para o próximo nível.", needsContext: false },
  { key: "turnover_risk", icon: AlertTriangle, title: "Risco de turnover", desc: "Detecta colaboradores em risco com base em clima, performance e engajamento.", needsContext: false },
  { key: "feedback_generation", icon: MessageSquare, title: "Geração de feedbacks", desc: "Sugere feedbacks estruturados (modelo SCI).", needsContext: true, placeholder: "Descreva a situação, comportamento observado e o colaborador." },
  { key: "strategic_crossing", icon: Sparkles, title: "Cruzamento estratégico", desc: "Análises preditivas de performance × comportamento × cultura.", needsContext: false },
];

export default function UNVProfileAIPage() {
  const [activeTool, setActiveTool] = useState<typeof TOOLS[number] | null>(null);
  const [contextInput, setContextInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>("");

  const open = (tool: typeof TOOLS[number]) => {
    setActiveTool(tool);
    setContextInput("");
    setResult("");
  };

  const run = async () => {
    if (!activeTool) return;
    if (activeTool.needsContext && !contextInput.trim()) {
      toast.error("Preencha o contexto para a IA analisar");
      return;
    }
    setLoading(true);
    setResult("");
    try {
      const { data, error } = await supabase.functions.invoke("profile-ai", {
        body: {
          tool: activeTool.key,
          context: activeTool.needsContext ? contextInput : undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data?.result || "Sem resposta da IA.");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao consultar IA");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result);
      toast.success("Copiado!");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Sparkles className="w-6 h-6 text-primary" /> UNV IA</h1>
        <p className="text-sm text-muted-foreground">Inteligência artificial aplicada à gestão de pessoas</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {TOOLS.map((t) => (
          <Card key={t.key} className="hover:shadow-md transition border-primary/10">
            <CardHeader>
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                <t.icon className="w-5 h-5 text-primary" />
              </div>
              <CardTitle className="text-base">{t.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">{t.desc}</p>
              <Button size="sm" className="w-full" onClick={() => open(t)}>
                <Sparkles className="w-3 h-3 mr-1" /> Usar IA
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!activeTool} onOpenChange={(o) => !o && setActiveTool(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {activeTool && <activeTool.icon className="w-5 h-5 text-primary" />}
              {activeTool?.title}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 overflow-y-auto flex-1">
            {activeTool?.needsContext && (
              <div className="space-y-1">
                <Label>Contexto / Dados</Label>
                <Textarea
                  rows={6}
                  placeholder={activeTool.placeholder}
                  value={contextInput}
                  onChange={(e) => setContextInput(e.target.value)}
                />
              </div>
            )}
            {!activeTool?.needsContext && !result && !loading && (
              <p className="text-sm text-muted-foreground">A IA usará automaticamente os dados de colaboradores, DISC, feedbacks e clima da empresa.</p>
            )}

            {loading && (
              <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Analisando com IA…
              </div>
            )}

            {result && (
              <div className="border rounded-lg p-4 bg-muted/30 prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{result}</ReactMarkdown>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            {result && (
              <Button variant="outline" size="sm" onClick={copy}>
                <Copy className="w-3 h-3 mr-1" /> Copiar
              </Button>
            )}
            <Button onClick={run} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}
              {result ? "Gerar novamente" : "Gerar análise"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
