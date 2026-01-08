import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Copy, Search, Building2, TrendingUp } from "lucide-react";

interface CompanyNPSData {
  companyId: string;
  companyName: string;
  projectId: string;
  productName: string;
  lastScore: number | null;
  averageScore: number | null;
  lastResponseDate: string | null;
  totalResponses: number;
  // CSAT data
  csatAverageScore: number | null;
  csatTotalResponses: number;
}

interface NPSGlobalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NPSGlobalDialog({ open, onOpenChange }: NPSGlobalDialogProps) {
  const [data, setData] = useState<CompanyNPSData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showOnlyNoResponse, setShowOnlyNoResponse] = useState(false);

  useEffect(() => {
    if (open) {
      fetchNPSData();
    }
  }, [open]);

  const fetchNPSData = async () => {
    setLoading(true);
    try {
      // Get all projects with their companies
      const { data: projects } = await supabase
        .from("onboarding_projects")
        .select(`
          id,
          product_name,
          onboarding_company_id,
          onboarding_companies!inner (
            id,
            name
          )
        `)
        .eq("status", "active");

      if (!projects) {
        setData([]);
        setLoading(false);
        return;
      }

      // Get all NPS responses
      const { data: npsResponses } = await supabase
        .from("onboarding_nps_responses")
        .select("project_id, score, created_at")
        .order("created_at", { ascending: false });

      // Get all CSAT responses
      const { data: csatResponses } = await supabase
        .from("csat_responses")
        .select("project_id, score, created_at")
        .order("created_at", { ascending: false });

      const responsesByProject = new Map<string, { scores: number[]; lastDate: string | null }>();
      
      (npsResponses || []).forEach((r) => {
        const existing = responsesByProject.get(r.project_id) || { scores: [], lastDate: null };
        existing.scores.push(r.score);
        if (!existing.lastDate) {
          existing.lastDate = r.created_at;
        }
        responsesByProject.set(r.project_id, existing);
      });

      const csatByProject = new Map<string, { scores: number[] }>();
      
      (csatResponses || []).forEach((r) => {
        const existing = csatByProject.get(r.project_id) || { scores: [] };
        existing.scores.push(r.score);
        csatByProject.set(r.project_id, existing);
      });

      const companiesData: CompanyNPSData[] = projects.map((project) => {
        const company = project.onboarding_companies as { id: string; name: string };
        const npsData = responsesByProject.get(project.id);
        const csatData = csatByProject.get(project.id);
        
        return {
          companyId: company.id,
          companyName: company.name,
          projectId: project.id,
          productName: project.product_name,
          lastScore: npsData?.scores[0] ?? null,
          averageScore: npsData?.scores.length 
            ? npsData.scores.reduce((a, b) => a + b, 0) / npsData.scores.length 
            : null,
          lastResponseDate: npsData?.lastDate ?? null,
          totalResponses: npsData?.scores.length ?? 0,
          csatAverageScore: csatData?.scores.length 
            ? csatData.scores.reduce((a, b) => a + b, 0) / csatData.scores.length 
            : null,
          csatTotalResponses: csatData?.scores.length ?? 0,
        };
      });

      // Sort by oldest response first (never responded at top, then oldest response date)
      companiesData.sort((a, b) => {
        // Never responded goes first
        if (!a.lastResponseDate && !b.lastResponseDate) {
          return a.companyName.localeCompare(b.companyName);
        }
        if (!a.lastResponseDate) return -1;
        if (!b.lastResponseDate) return 1;
        // Oldest response date first
        return new Date(a.lastResponseDate).getTime() - new Date(b.lastResponseDate).getTime();
      });
      
      setData(companiesData);
    } catch (error) {
      console.error("Error fetching NPS data:", error);
      toast.error("Erro ao carregar dados NPS");
    } finally {
      setLoading(false);
    }
  };

  const getNPSLink = (projectId: string) => {
    return `${window.location.origin}/nps?project=${projectId}`;
  };

  const copyLink = (projectId: string) => {
    navigator.clipboard.writeText(getNPSLink(projectId));
    toast.success("Link NPS copiado!");
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return "bg-muted text-muted-foreground";
    if (score <= 6) return "bg-destructive text-destructive-foreground";
    if (score <= 8) return "bg-yellow-500 text-white";
    return "bg-green-500 text-white";
  };

  const getScoreLabel = (score: number | null) => {
    if (score === null) return "—";
    if (score <= 6) return "Detrator";
    if (score <= 8) return "Neutro";
    return "Promotor";
  };

  const filteredData = data
    .filter((item) =>
      item.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.productName.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .filter((item) => !showOnlyNoResponse || item.totalResponses === 0);

  const noResponseCount = data.filter((item) => item.totalResponses === 0).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Painel NPS - Todas as Empresas
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar empresa ou serviço..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="noResponse"
              checked={showOnlyNoResponse}
              onCheckedChange={(checked) => setShowOnlyNoResponse(checked === true)}
            />
            <label
              htmlFor="noResponse"
              className="text-sm cursor-pointer select-none"
            >
              Mostrar apenas sem resposta ({noResponseCount})
            </label>
          </div>
        </div>

        <ScrollArea className="h-[55vh] pr-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : filteredData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma empresa encontrada</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredData.map((item) => (
                <div
                  key={`${item.companyId}-${item.projectId}`}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="grid grid-cols-[1fr_auto] gap-3 items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1 min-w-0">
                        <h4 className="font-medium truncate min-w-0 flex-1">{item.companyName}</h4>
                        <Badge variant="outline" className="text-xs shrink-0 max-w-[280px] truncate">
                          {item.productName}
                        </Badge>
                        {item.totalResponses === 0 && (
                          <Badge variant="destructive" className="text-xs shrink-0">
                            Sem resposta
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        {/* Last Score */}
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Última nota:</span>
                          <span className={`px-2 py-0.5 rounded font-medium ${getScoreColor(item.lastScore)}`}>
                            {item.lastScore ?? "—"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({getScoreLabel(item.lastScore)})
                          </span>
                        </div>

                        {/* NPS Average */}
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Média NPS:</span>
                          <span className="font-medium">
                            {item.averageScore?.toFixed(1) ?? "—"}
                          </span>
                        </div>

                        {/* CSAT Average */}
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Média CSAT:</span>
                          <span className={`font-medium ${
                            item.csatAverageScore !== null 
                              ? item.csatAverageScore >= 4 
                                ? "text-green-600" 
                                : item.csatAverageScore >= 3 
                                  ? "text-yellow-600" 
                                  : "text-destructive"
                              : ""
                          }`}>
                            {item.csatAverageScore?.toFixed(1) ?? "—"}
                          </span>
                          {item.csatTotalResponses > 0 && (
                            <span className="text-xs text-muted-foreground">
                              ({item.csatTotalResponses})
                            </span>
                          )}
                        </div>

                        {/* Total NPS Responses */}
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Respostas NPS:</span>
                          <span className="font-medium">{item.totalResponses}</span>
                        </div>

                        {/* Last Response Date */}
                        {item.lastResponseDate && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Última resposta:</span>
                            <span className="text-xs">
                              {format(new Date(item.lastResponseDate), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="mt-2 flex items-center gap-2 min-w-0">
                        <span className="text-xs text-muted-foreground shrink-0">Link:</span>
                        <a
                          href={getNPSLink(item.projectId)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs underline underline-offset-2 truncate"
                          title={getNPSLink(item.projectId)}
                        >
                          {getNPSLink(item.projectId)}
                        </a>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 shrink-0"
                      onClick={() => copyLink(item.projectId)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copiar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}