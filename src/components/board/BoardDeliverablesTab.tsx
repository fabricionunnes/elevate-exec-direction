import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Eye, Download, CheckCircle2, FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { BoardDeliverable, fetchCompanyNameMap } from "./boardTypes";
import { boardDeliverableLabel } from "./boardDeliverableConfig";
import { generateBoardDeliverablePDF } from "./generateBoardDeliverablePDF";

interface BoardDeliverablesTabProps {
  /** Pré-filtra por empresa (vindo do botão "Entregáveis" da aba Membros) */
  initialCompanyId?: string | null;
}

export function BoardDeliverablesTab({ initialCompanyId }: BoardDeliverablesTabProps) {
  const [deliverables, setDeliverables] = useState<BoardDeliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyFilter, setCompanyFilter] = useState<string>(initialCompanyId || "all");
  const [viewing, setViewing] = useState<BoardDeliverable | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    if (initialCompanyId) setCompanyFilter(initialCompanyId);
  }, [initialCompanyId]);

  const fetchDeliverables = useCallback(async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("unv_board_deliverables")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data || []) as BoardDeliverable[];
      const nameMap = await fetchCompanyNameMap(supabase, rows.map((d) => d.company_id));
      setDeliverables(rows.map((d) => ({ ...d, company_name: nameMap[d.company_id] || "—" })));
    } catch (err) {
      console.error("Erro ao carregar entregáveis:", err);
      toast.error("Erro ao carregar entregáveis");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeliverables();
  }, [fetchDeliverables]);

  const companies = Array.from(
    new Map(deliverables.map((d) => [d.company_id, d.company_name || "—"])).entries(),
  ).sort((a, b) => (a[1] || "").localeCompare(b[1] || ""));

  const filtered =
    companyFilter === "all"
      ? deliverables
      : deliverables.filter((d) => d.company_id === companyFilter);

  const downloadPDF = async (deliverable: BoardDeliverable) => {
    if (!deliverable.content_md) {
      toast.error("Este entregável não tem conteúdo gerado");
      return;
    }
    setDownloadingId(deliverable.id);
    try {
      const doc = await generateBoardDeliverablePDF({
        title: deliverable.title,
        companyName: deliverable.company_name || "Empresa",
        contentMd: deliverable.content_md,
        version: deliverable.version,
        date: deliverable.created_at,
      });
      const fname = `${deliverable.title.replace(/[^a-zA-Z0-9]+/g, "_")}_v${deliverable.version}.pdf`;
      doc.save(fname);
      toast.success("PDF gerado");
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      toast.error("Erro ao gerar o PDF");
    } finally {
      setDownloadingId(null);
    }
  };

  const markFinal = async (deliverable: BoardDeliverable) => {
    try {
      const { error } = await (supabase as any)
        .from("unv_board_deliverables")
        .update({ status: "final" })
        .eq("id", deliverable.id);
      if (error) throw error;
      toast.success("Entregável marcado como final");
      fetchDeliverables();
    } catch (err) {
      console.error("Erro ao marcar como final:", err);
      toast.error("Erro ao atualizar o entregável");
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="Filtrar por empresa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as empresas</SelectItem>
            {companies.map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{filtered.length} documento(s)</span>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Nenhum entregável encontrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Versão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.company_name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{boardDeliverableLabel(d.type)}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[260px] truncate">{d.title}</TableCell>
                    <TableCell>v{d.version}</TableCell>
                    <TableCell>
                      {d.status === "final" ? (
                        <Badge variant="outline" className="border-green-500 text-green-600">
                          Final
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                          Rascunho
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {d.created_at ? format(new Date(d.created_at), "dd/MM/yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Ver conteúdo"
                          onClick={() => setViewing(d)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Baixar PDF"
                          disabled={downloadingId === d.id}
                          onClick={() => downloadPDF(d)}
                        >
                          {downloadingId === d.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                        </Button>
                        {d.status !== "final" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Marcar como final"
                            className="text-green-600 hover:text-green-600"
                            onClick={() => markFinal(d)}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewing?.title}</DialogTitle>
            <DialogDescription>
              {viewing && (
                <>
                  {viewing.company_name} · v{viewing.version} ·{" "}
                  {viewing.created_at ? format(new Date(viewing.created_at), "dd/MM/yyyy") : ""}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="whitespace-pre-wrap text-sm leading-relaxed font-mono bg-muted/40 rounded-md p-4">
            {viewing?.content_md || "Sem conteúdo."}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
