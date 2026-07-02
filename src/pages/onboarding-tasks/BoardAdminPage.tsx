import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, Crown, Users, DoorOpen, FileText, CalendarClock, Gauge } from "lucide-react";
import { NexusHeader } from "@/components/onboarding-tasks/NexusHeader";
import { BoardMembersTab } from "@/components/board/BoardMembersTab";
import { BoardRoomsTab } from "@/components/board/BoardRoomsTab";
import { BoardDeliverablesTab } from "@/components/board/BoardDeliverablesTab";
import { BoardSessionsTab } from "@/components/board/BoardSessionsTab";
import { BoardNpsTab } from "@/components/board/BoardNpsTab";

export default function BoardAdminPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("membros");
  const [deliverablesCompanyFilter, setDeliverablesCompanyFilter] = useState<string | null>(null);

  useEffect(() => {
    checkAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkAccess = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigate("/onboarding-tasks/login");
        return;
      }

      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("id, role")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (!staff || !["master", "admin", "cs"].includes(staff.role)) {
        toast.error("Acesso não autorizado");
        navigate("/onboarding-tasks");
        return;
      }

      setLoading(false);
    } catch (error) {
      console.error("Erro ao verificar acesso:", error);
      navigate("/onboarding-tasks/login");
    }
  };

  const openDeliverablesForCompany = (companyId: string) => {
    setDeliverablesCompanyFilter(companyId);
    setActiveTab("entregaveis");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6">
          <Skeleton className="h-10 w-64 mb-6" />
          <Skeleton className="h-10 w-full mb-4" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <NexusHeader showTitle={false} />
            <div>
              <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
                <Crown className="h-6 w-6 text-[#0D2B5E] dark:text-blue-300" />
                UNV Board
              </h1>
              <p className="text-sm text-muted-foreground hidden md:block">
                Mentoria anual — membros, salas, planos, entregáveis, sessões e NPS
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 flex-wrap h-auto">
            <TabsTrigger value="membros" className="gap-1.5">
              <Users className="h-4 w-4" />
              Membros
            </TabsTrigger>
            <TabsTrigger value="salas" className="gap-1.5">
              <DoorOpen className="h-4 w-4" />
              Salas
            </TabsTrigger>
            <TabsTrigger value="entregaveis" className="gap-1.5">
              <FileText className="h-4 w-4" />
              Entregáveis
            </TabsTrigger>
            <TabsTrigger value="sessoes" className="gap-1.5">
              <CalendarClock className="h-4 w-4" />
              Sessões
            </TabsTrigger>
            <TabsTrigger value="nps" className="gap-1.5">
              <Gauge className="h-4 w-4" />
              NPS
            </TabsTrigger>
          </TabsList>

          <TabsContent value="membros">
            <BoardMembersTab onOpenDeliverables={openDeliverablesForCompany} />
          </TabsContent>
          <TabsContent value="salas">
            <BoardRoomsTab />
          </TabsContent>
          <TabsContent value="entregaveis">
            <BoardDeliverablesTab initialCompanyId={deliverablesCompanyFilter} />
          </TabsContent>
          <TabsContent value="sessoes">
            <BoardSessionsTab />
          </TabsContent>
          <TabsContent value="nps">
            <BoardNpsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
