import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface PainelRow {
  title: string | null;
  html: string;
  source?: string | null;
  updated_at: string;
  public_token?: string | null;
}

const INTERVALO_MS = 60_000;

/**
 * Painel próprio de um projeto. O HTML vem pronto da tabela project_custom_dashboards
 * (gerado no servidor a partir da planilha do cliente) e roda isolado num iframe sem
 * acesso à sessão do Nexus. A cada minuto confere se saiu versão nova e troca sozinho.
 *
 * - com `projectId`: uso interno (equipe), na aba do projeto;
 * - com `publicToken`: link público de leitura, sem login.
 */
export function ProjectCustomDashboard({ projectId, publicToken, fullScreen }: { projectId?: string; publicToken?: string; fullScreen?: boolean }) {
  const [row, setRow] = useState<PainelRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const versao = useRef<string | null>(null);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) { setLoading(true); setErro(null); }
    let data: PainelRow | null = null;
    let msg: string | null = null;
    if (publicToken) {
      const r = await (supabase as any).rpc("project_dashboard_public", { p_token: publicToken });
      msg = r.error?.message || null;
      data = Array.isArray(r.data) ? r.data[0] || null : r.data || null;
    } else {
      const r = await (supabase as any).from("project_custom_dashboards")
        .select("title, html, source, updated_at, public_token").eq("project_id", projectId).maybeSingle();
      msg = r.error?.message || null;
      data = r.data || null;
    }
    if (msg) { if (!silencioso) setErro(msg); }
    else { versao.current = data?.updated_at || null; setRow(data); }
    if (!silencioso) setLoading(false);
  }, [projectId, publicToken]);

  useEffect(() => { carregar(); }, [carregar]);

  // confere de minuto em minuto se o painel foi regravado; só recarrega quando mudou
  useEffect(() => {
    const t = setInterval(async () => {
      if (document.hidden) return;
      let nova: string | null = null;
      if (publicToken) {
        const r = await (supabase as any).rpc("project_dashboard_public_version", { p_token: publicToken });
        nova = r.data || null;
      } else {
        const r = await (supabase as any).from("project_custom_dashboards").select("updated_at").eq("project_id", projectId).maybeSingle();
        nova = r.data?.updated_at || null;
      }
      if (nova && versao.current && new Date(nova).getTime() !== new Date(versao.current).getTime()) carregar(true);
    }, INTERVALO_MS);
    return () => clearInterval(t);
  }, [carregar, projectId, publicToken]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando painel
      </div>
    );
  }
  if (erro) return <p className="py-12 text-center text-sm text-destructive">Não foi possível carregar o painel: {erro}</p>;
  if (!row) return <p className="py-12 text-center text-sm text-muted-foreground">{publicToken ? "Painel não encontrado. Confira o link." : "Este projeto ainda não tem painel próprio."}</p>;

  const frame = (
    <iframe
      title={row.title || "Painel de controle"}
      srcDoc={row.html}
      sandbox="allow-scripts"
      className={fullScreen ? "block w-full border-0" : "w-full rounded-lg border border-border bg-background"}
      style={fullScreen ? { height: "100dvh" } : { height: "calc(100vh - 210px)", minHeight: 720 }}
    />
  );
  if (fullScreen) return frame;

  const atualizado = new Date(row.updated_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const linkPublico = row.public_token ? `${window.location.origin}/#/painel/${row.public_token}` : null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Atualizado em {atualizado}
          {row.source ? ` · fonte: ${row.source}` : ""}
        </span>
        <div className="flex items-center gap-2">
          {linkPublico && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigator.clipboard.writeText(linkPublico).then(() => toast.success("Link do painel copiado"), () => toast.error("Não foi possível copiar o link"))}
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar link do cliente
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => carregar()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Recarregar
          </Button>
        </div>
      </div>
      {frame}
    </div>
  );
}
