import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, FileText, Plus, Download, Eye, Trash2, Loader2, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface DistratoRecord {
  id: string;
  company_name: string;
  company_cnpj: string | null;
  project_name: string | null;
  distrato_date: string;
  created_at: string;
  pdf_url: string | null;
}

export default function DistratoHistoryPage() {
  const navigate = useNavigate();
  const [distratos, setDistratos] = useState<DistratoRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDistratos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("distratos")
      .select("id, company_name, company_cnpj, project_name, distrato_date, created_at, pdf_url")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar histórico");
    } else {
      setDistratos(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchDistratos(); }, []);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("distratos").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir distrato");
    } else {
      toast.success("Distrato excluído");
      fetchDistratos();
    }
  };

  const handleView = (distrato: DistratoRecord) => {
    if (distrato.pdf_url) {
      window.open(distrato.pdf_url, "_blank");
    } else {
      navigate(`/distrato?distrato_id=${distrato.id}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/contratos")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <FileText className="h-5 w-5" /> Histórico de Distratos
              </h1>
              <p className="text-sm text-muted-foreground">Todos os distratos gerados</p>
            </div>
          </div>
          <Button onClick={() => navigate("/distrato")} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Distrato
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : distratos.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Nenhum distrato gerado ainda</p>
              <Button variant="outline" className="mt-4" onClick={() => navigate("/distrato")}>
                Gerar primeiro distrato
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {distratos.map((d) => (
              <Card key={d.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="flex items-center justify-between py-4">
                  <div className="space-y-1">
                    <p className="font-medium">{d.company_name}</p>
                    <div className="flex gap-3 text-sm text-muted-foreground">
                      {d.company_cnpj && <span>{d.company_cnpj}</span>}
                      {d.project_name && <span>• {d.project_name}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Distrato em {format(new Date(d.distrato_date), "dd/MM/yyyy")} • 
                      Gerado em {format(new Date(d.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleView(d)}
                      title="Visualizar / Imprimir"
                    >
                      <Printer className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir distrato?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Essa ação não pode ser desfeita. O registro do distrato de {d.company_name} será removido.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(d.id)}>Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
