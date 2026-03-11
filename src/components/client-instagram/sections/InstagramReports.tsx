import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Download, Share2, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import type { InstagramReport } from "../types";

interface InstagramReportsProps {
  accountId: string;
  projectId: string;
}

export const InstagramReports = ({ accountId, projectId }: InstagramReportsProps) => {
  const [reports, setReports] = useState<InstagramReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchReports = async () => {
    const { data } = await supabase
      .from("instagram_reports")
      .select("*")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false });
    setReports((data || []) as InstagramReport[]);
    setLoading(false);
  };

  useEffect(() => { fetchReports(); }, [accountId]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { error } = await supabase.functions.invoke("instagram-project-oauth", {
        body: { action: "generate_report", accountId, projectId },
      });
      if (error) throw error;
      toast.success("Relatório gerado!");
      fetchReports();
    } catch {
      toast.error("Erro ao gerar relatório");
    } finally {
      setGenerating(false);
    }
  };

  const handleShare = async (shareToken: string) => {
    const url = `${window.location.origin}/#/instagram-report/${shareToken}`;
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado para a área de transferência!");
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" /> Relatórios
        </h3>
        <Button onClick={handleGenerate} disabled={generating} className="gap-2">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Gerar Relatório
        </Button>
      </div>

      {reports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">Nenhum relatório gerado ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{r.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(r.period_start).toLocaleDateString("pt-BR")} — {new Date(r.period_end).toLocaleDateString("pt-BR")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Gerado em {new Date(r.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="flex gap-2">
                  {r.pdf_url && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={r.pdf_url} target="_blank" rel="noopener noreferrer">
                        <Download className="h-4 w-4 mr-1" /> PDF
                      </a>
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => handleShare(r.share_token)}>
                    <Share2 className="h-4 w-4 mr-1" /> Compartilhar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
