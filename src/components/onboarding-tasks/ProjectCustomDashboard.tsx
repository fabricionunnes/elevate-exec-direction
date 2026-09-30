import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface PainelRow {
  title: string | null;
  html: string;
  source: string | null;
  updated_at: string;
}

/**
 * Painel próprio de um projeto. O HTML vem pronto da tabela project_custom_dashboards
 * (gerado fora do Nexus, por exemplo a partir da planilha do cliente) e roda isolado
 * num iframe sem acesso à sessão do Nexus.
 */
export function ProjectCustomDashboard({ projectId }: { projectId: string }) {
  const [row, setRow] = useState<PainelRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = async () => {
    setLoading(true);
    setErro(null);
    const { data, error } = await (supabase as any)
      .from("project_custom_dashboards")
      .select("title, html, source, updated_at")
      .eq("project_id", projectId)
      .maybeSingle();
    if (error) setErro(error.message);
    setRow((data as PainelRow) || null);
    setLoading(false);
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando painel
      </div>
    );
  }
  if (erro) return <p className="py-12 text-center text-sm text-destructive">Não foi possível carregar o painel: {erro}</p>;
  if (!row) return <p className="py-12 text-center text-sm text-muted-foreground">Este projeto ainda não tem painel próprio.</p>;

  const atualizado = new Date(row.updated_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Atualizado em {atualizado}
          {row.source ? ` · fonte: ${row.source}` : ""}
        </span>
        <Button variant="outline" size="sm" onClick={carregar}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Recarregar
        </Button>
      </div>
      <iframe
        title={row.title || "Painel de controle"}
        srcDoc={row.html}
        sandbox="allow-scripts"
        className="w-full rounded-lg border border-border bg-background"
        style={{ height: "calc(100vh - 210px)", minHeight: 720 }}
      />
    </div>
  );
}
