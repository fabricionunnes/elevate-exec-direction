import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Download, ExternalLink, Sparkles, Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { buildAndStoreProposal, reviseAndStoreProposal } from "./proposal/buildProposal";

interface Props {
  leadId: string;
  leadName: string;
  companyName: string | null;
}

interface Proposal {
  id: string;
  title: string | null;
  service_name: string | null;
  file_url: string | null;
  status: string | null;
  created_at: string;
}

export function LeadProposalTab({ leadId, leadName, companyName }: Props) {
  const [items, setItems] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [reviseText, setReviseText] = useState("");
  const [revising, setRevising] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("crm_lead_proposals")
      .select("id,title,service_name,file_url,status,created_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });
    setItems((data || []) as Proposal[]);
    setLoading(false);
  }, [leadId]);

  useEffect(() => { load(); }, [load]);

  const generateNow = async () => {
    setGenerating(true);
    try {
      // usa a transcrição mais recente do lead
      const { data: t } = await supabase
        .from("crm_transcriptions")
        .select("id,transcription_text")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!t?.transcription_text) {
        toast.error("Adicione uma transcrição da reunião primeiro (aba Transcrição).");
        return;
      }
      await buildAndStoreProposal({
        leadId,
        leadName,
        companyName,
        transcription: t.transcription_text,
        transcriptionId: t.id,
      });
      toast.success("Proposta gerada!");
      await load();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao gerar a proposta");
    } finally {
      setGenerating(false);
    }
  };

  const reviseNow = async () => {
    const instructions = reviseText.trim();
    if (!instructions) {
      toast.error("Descreva o que quer mudar na proposta.");
      return;
    }
    setRevising(true);
    try {
      await reviseAndStoreProposal({ leadId, leadName, companyName, instructions });
      toast.success("Nova proposta gerada com as suas mudanças!");
      setReviseText("");
      await load();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao revisar a proposta");
    } finally {
      setRevising(false);
    }
  };

  return (
    <div className="p-4 space-y-4 overflow-auto h-full">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-500" /> Propostas
          </h3>
          <p className="text-xs text-muted-foreground">
            Gerada automaticamente ao salvar a transcrição, com base no serviço do Negócio.
          </p>
        </div>
        <Button size="sm" onClick={generateNow} disabled={generating}>
          {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
          {generating ? "Gerando..." : "Gerar proposta"}
        </Button>
      </div>

      {!loading && items.length > 0 && (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <p className="text-xs font-medium flex items-center gap-1.5">
            <Wand2 className="h-3.5 w-3.5 text-violet-500" />
            Ajustar com IA — descreva o que quer mudar e gere uma nova versão
          </p>
          <Textarea
            value={reviseText}
            onChange={(e) => setReviseText(e.target.value)}
            placeholder={'Ex.: o valor correto é R$ 2.500/mês em 12x · o nome da empresa é "Padaria do João" · remover a entrega de tráfego pago · prazo de 6 meses'}
            rows={3}
            className="text-sm resize-none bg-background"
            disabled={revising}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={reviseNow} disabled={revising || !reviseText.trim()}>
              {revising ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
              {revising ? "Aplicando mudanças..." : "Gerar nova versão"}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            As mudanças são aplicadas em cima da proposta mais recente. A anterior continua na lista.
          </p>
        </div>
      )}

      {loading ? (
        <Skeleton className="h-28 w-full" />
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-3 opacity-40" />
            Nenhuma proposta ainda. Salve uma transcrição na aba <strong>Transcrição</strong> ou clique em
            <strong> Gerar proposta</strong>.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.title || "Proposta"}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.service_name ? `${p.service_name} · ` : ""}
                    {new Date(p.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {p.file_url && (
                  <div className="flex shrink-0 gap-2">
                    <Button asChild variant="outline" size="sm">
                      <a href={p.file_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-1.5" /> Abrir
                      </a>
                    </Button>
                    <Button asChild variant="ghost" size="icon">
                      <a href={p.file_url} download>
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
