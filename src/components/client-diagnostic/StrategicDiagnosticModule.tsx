import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StrategicDiagnosticForm } from "./StrategicDiagnosticForm";
import { StrategicDiagnosticHistory } from "./StrategicDiagnosticHistory";
import { StrategicDiagnosticSummary } from "./StrategicDiagnosticSummary";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft } from "lucide-react";
import { differenceInMonths } from "date-fns";

interface Props {
  projectId: string;
}

export type DiagnosticRecord = {
  id: string;
  empresa: string;
  consultor_unv: string | null;
  data_checkpoint: string;
  nivel_urgencia: string | null;
  produtos_oferecer: string[] | null;
  principais_dores: string | null;
  proximo_passo: string | null;
  created_at: string;
  [key: string]: any;
};

export interface ProjectContext {
  empresa: string;
  responsavel: string;
  consultor_unv: string;
  tempo_cliente: string;
  segmento: string;
}

function computeTempoCliente(createdAt: string): string {
  const months = differenceInMonths(new Date(), new Date(createdAt));
  if (months < 3) return "Menos de 3 meses";
  if (months < 6) return "3 a 6 meses";
  if (months < 12) return "6 a 12 meses";
  return "Mais de 12 meses";
}

type ViewMode = "list" | "form" | "summary";

export function StrategicDiagnosticModule({ projectId }: Props) {
  const [view, setView] = useState<ViewMode>("list");
  const [records, setRecords] = useState<DiagnosticRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<DiagnosticRecord | null>(null);
  const [projectContext, setProjectContext] = useState<ProjectContext | null>(null);

  const fetchRecords = async () => {
    setLoading(true);
    const { data } = await (supabase
      .from("client_strategic_diagnostics" as any)
      .select("*")
      .eq("project_id", projectId)
      .order("data_checkpoint", { ascending: false }) as any);
    setRecords((data || []) as DiagnosticRecord[]);
    setLoading(false);
  };

  const fetchProjectContext = async () => {
    const { data: project } = await supabase
      .from("onboarding_projects")
      .select("onboarding_company_id, consultant_id, created_at")
      .eq("id", projectId)
      .maybeSingle();

    if (!project) return;

    const [companyRes, consultantRes, usersRes] = await Promise.all([
      project.onboarding_company_id
        ? supabase.from("onboarding_companies").select("name, segment").eq("id", project.onboarding_company_id).maybeSingle()
        : Promise.resolve({ data: null }),
      project.consultant_id
        ? supabase.from("onboarding_staff").select("name").eq("id", project.consultant_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("onboarding_users").select("name").eq("project_id", projectId).eq("role", "client").limit(1),
    ]);

    setProjectContext({
      empresa: companyRes.data?.name || "",
      responsavel: usersRes.data?.[0]?.name || "",
      consultor_unv: consultantRes.data?.name || "",
      tempo_cliente: computeTempoCliente(project.created_at),
      segmento: companyRes.data?.segment || "",
    });
  };

  useEffect(() => {
    fetchRecords();
    fetchProjectContext();
  }, [projectId]);

  const handleSaved = (record: DiagnosticRecord) => {
    setSelectedRecord(record);
    setView("summary");
    fetchRecords();
  };

  const handleViewRecord = (record: DiagnosticRecord) => {
    setSelectedRecord(record);
    setView("summary");
  };

  if (view === "form") {
    return (
      <div>
        <Button variant="ghost" size="sm" className="mb-4 gap-2" onClick={() => setView("list")}>
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <StrategicDiagnosticForm projectId={projectId} onSaved={handleSaved} projectContext={projectContext} />
      </div>
    );
  }

  if (view === "summary" && selectedRecord) {
    return (
      <div>
        <Button variant="ghost" size="sm" className="mb-4 gap-2" onClick={() => { setView("list"); setSelectedRecord(null); }}>
          <ArrowLeft className="h-4 w-4" /> Voltar ao histórico
        </Button>
        <StrategicDiagnosticSummary record={selectedRecord} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Check-point Estratégico — UNV</h2>
          <p className="text-sm text-muted-foreground">Diagnósticos realizados com o cliente</p>
        </div>
        <Button onClick={() => setView("form")} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Diagnóstico
        </Button>
      </div>
      <StrategicDiagnosticHistory records={records} loading={loading} onView={handleViewRecord} />
    </div>
  );
}
