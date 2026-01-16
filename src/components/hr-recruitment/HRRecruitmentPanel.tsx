import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Briefcase, 
  Users, 
  GitBranch, 
  ClipboardCheck, 
  MessageSquare, 
  FileText, 
  Settings,
  BarChart3,
  UserCheck
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { JobOpeningsTab } from "./tabs/JobOpeningsTab";
import { CandidatesTab } from "./tabs/CandidatesTab";
import { PipelineTab } from "./tabs/PipelineTab";
import { DISCEvaluationsTab } from "./tabs/DISCEvaluationsTab";
import { InterviewsTab } from "./tabs/InterviewsTab";
import { ResumesTab } from "./tabs/ResumesTab";
import { HRSettingsTab } from "./tabs/HRSettingsTab";
import { HRDashboardTab } from "./tabs/HRDashboardTab";
import { TalentPoolTab } from "./tabs/TalentPoolTab";

interface HRRecruitmentPanelProps {
  projectId: string;
  companyId?: string;
  isStaff: boolean;
  canEdit: boolean;
  userRole?: string;
}

export function HRRecruitmentPanel({ 
  projectId, 
  companyId, 
  isStaff, 
  canEdit,
  userRole = ''
}: HRRecruitmentPanelProps) {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [stats, setStats] = useState({
    openJobs: 0,
    activeCandidates: 0,
    pendingInterviews: 0,
  });

  useEffect(() => {
    fetchStats();
  }, [projectId]);

  const fetchStats = async () => {
    const [jobsRes, candidatesRes, interviewsRes] = await Promise.all([
      supabase
        .from("job_openings")
        .select("id", { count: "exact" })
        .eq("project_id", projectId)
        .eq("status", "open"),
      supabase
        .from("candidates")
        .select("id", { count: "exact" })
        .eq("project_id", projectId)
        .eq("status", "active"),
      supabase
        .from("interviews")
        .select("id, candidates!inner(project_id)", { count: "exact" })
        .eq("candidates.project_id", projectId)
        .eq("status", "scheduled"),
    ]);

    setStats({
      openJobs: jobsRes.count || 0,
      activeCandidates: candidatesRes.count || 0,
      pendingInterviews: interviewsRes.count || 0,
    });
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Briefcase className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.openJobs}</p>
              <p className="text-sm text-muted-foreground">Vagas Abertas</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.activeCandidates}</p>
              <p className="text-sm text-muted-foreground">Candidatos Ativos</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <MessageSquare className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.pendingInterviews}</p>
              <p className="text-sm text-muted-foreground">Entrevistas Agendadas</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          <TabsTrigger value="dashboard" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="jobs" className="gap-2">
            <Briefcase className="h-4 w-4" />
            <span className="hidden sm:inline">Vagas</span>
          </TabsTrigger>
          <TabsTrigger value="candidates" className="gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Candidatos</span>
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="gap-2">
            <GitBranch className="h-4 w-4" />
            <span className="hidden sm:inline">Pipeline</span>
          </TabsTrigger>
          <TabsTrigger value="disc" className="gap-2">
            <ClipboardCheck className="h-4 w-4" />
            <span className="hidden sm:inline">DISC</span>
          </TabsTrigger>
          <TabsTrigger value="interviews" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Entrevistas</span>
          </TabsTrigger>
          <TabsTrigger value="resumes" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Currículos</span>
          </TabsTrigger>
          <TabsTrigger value="talent-pool" className="gap-2">
            <UserCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Banco de Talentos</span>
          </TabsTrigger>
          {canEdit && (
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Config</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <HRDashboardTab projectId={projectId} />
        </TabsContent>

        <TabsContent value="jobs" className="mt-6">
          <JobOpeningsTab 
            projectId={projectId} 
            companyId={companyId} 
            canEdit={canEdit}
            onUpdate={fetchStats}
          />
        </TabsContent>

        <TabsContent value="candidates" className="mt-6">
          <CandidatesTab 
            projectId={projectId} 
            canEdit={canEdit}
            isStaff={isStaff}
            userRole={userRole}
            onUpdate={fetchStats}
          />
        </TabsContent>

        <TabsContent value="pipeline" className="mt-6">
          <PipelineTab 
            projectId={projectId} 
            canEdit={canEdit}
            onUpdate={fetchStats}
          />
        </TabsContent>

        <TabsContent value="disc" className="mt-6">
          <DISCEvaluationsTab 
            projectId={projectId} 
            canEdit={canEdit}
          />
        </TabsContent>

        <TabsContent value="interviews" className="mt-6">
          <InterviewsTab 
            projectId={projectId} 
            canEdit={canEdit}
          />
        </TabsContent>

        <TabsContent value="resumes" className="mt-6">
          <ResumesTab 
            projectId={projectId} 
            canEdit={canEdit}
            isStaff={isStaff}
          />
        </TabsContent>

        <TabsContent value="talent-pool" className="mt-6">
          <TalentPoolTab 
            projectId={projectId} 
            canEdit={canEdit}
          />
        </TabsContent>

        {canEdit && (
          <TabsContent value="settings" className="mt-6">
            <HRSettingsTab projectId={projectId} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
