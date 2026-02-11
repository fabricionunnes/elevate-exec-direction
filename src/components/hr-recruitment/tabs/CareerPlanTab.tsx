import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, ClipboardList, Edit3, GitBranch, Award, Target, Play, History, Eye, Download } from "lucide-react";
import { useCareerPlan } from "../career-plan/useCareerPlan";
import { CareerOverviewSection } from "../career-plan/CareerOverviewSection";
import { CareerFormSection } from "../career-plan/CareerFormSection";
import { CareerEditorSection } from "../career-plan/CareerEditorSection";
import { CareerSimulationSection } from "../career-plan/CareerSimulationSection";
import { CareerVersionsSection } from "../career-plan/CareerVersionsSection";
import { CareerViewSection } from "../career-plan/CareerViewSection";
import { CareerPDFSection } from "../career-plan/CareerPDFSection";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { CareerPlanVersion } from "../career-plan/types";

interface CareerPlanTabProps {
  projectId: string;
  canEdit: boolean;
  isStaff: boolean;
}

export function CareerPlanTab({ projectId, canEdit, isStaff }: CareerPlanTabProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [generating, setGenerating] = useState(false);
  const { forms, versions, activeVersion, tracks, loading, refresh, fetchTracks, setActiveVersion } = useCareerPlan(projectId);

  // Client-only view
  if (!isStaff) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Plano de Carreira</h2>
        </div>
        <CareerViewSection tracks={tracks} readOnly />
      </div>
    );
  }

  const handleGenerateAI = async (formId: string) => {
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("generate-career-plan", {
        body: { projectId, formId },
      });

      if (res.error) throw res.error;
      toast.success("Plano de Carreira gerado com sucesso pela IA!");
      refresh();
    } catch (err: any) {
      toast.error("Erro ao gerar plano: " + (err.message || "Erro desconhecido"));
    }
    setGenerating(false);
  };

  const handleSelectVersion = async (v: CareerPlanVersion) => {
    setActiveVersion(v);
    await fetchTracks(v.id);
    setActiveTab("editor");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">Plano de Carreira</h2>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          <TabsTrigger value="overview" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Visão Geral</span>
          </TabsTrigger>
          <TabsTrigger value="form" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Formulário</span>
          </TabsTrigger>
          <TabsTrigger value="editor" className="gap-2">
            <Edit3 className="h-4 w-4" />
            <span className="hidden sm:inline">Editor</span>
          </TabsTrigger>
          <TabsTrigger value="simulation" className="gap-2">
            <Play className="h-4 w-4" />
            <span className="hidden sm:inline">Simulação</span>
          </TabsTrigger>
          <TabsTrigger value="versions" className="gap-2">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Versões</span>
          </TabsTrigger>
          <TabsTrigger value="view" className="gap-2">
            <Eye className="h-4 w-4" />
            <span className="hidden sm:inline">Visualização</span>
          </TabsTrigger>
          <TabsTrigger value="pdf" className="gap-2">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">PDF</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <CareerOverviewSection versions={versions} activeVersion={activeVersion} tracks={tracks} />
        </TabsContent>

        <TabsContent value="form" className="mt-6">
          <CareerFormSection
            projectId={projectId}
            canEdit={canEdit}
            forms={forms}
            onRefresh={refresh}
            onGenerateAI={handleGenerateAI}
            generating={generating}
          />
        </TabsContent>

        <TabsContent value="editor" className="mt-6">
          <CareerEditorSection
            activeVersion={activeVersion}
            tracks={tracks}
            canEdit={canEdit}
            onRefresh={refresh}
          />
        </TabsContent>

        <TabsContent value="simulation" className="mt-6">
          <CareerSimulationSection tracks={tracks} />
        </TabsContent>

        <TabsContent value="versions" className="mt-6">
          <CareerVersionsSection
            projectId={projectId}
            versions={versions}
            activeVersion={activeVersion}
            canEdit={canEdit}
            onRefresh={refresh}
            onSelectVersion={handleSelectVersion}
          />
        </TabsContent>

        <TabsContent value="view" className="mt-6">
          <CareerViewSection tracks={tracks} />
        </TabsContent>

        <TabsContent value="pdf" className="mt-6">
          <CareerPDFSection tracks={tracks} activeVersion={activeVersion} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
