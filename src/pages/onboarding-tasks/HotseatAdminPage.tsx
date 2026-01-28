import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  Flame, 
  Search, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  XCircle,
  Copy,
  RefreshCw,
  Building2,
  User,
  UserX
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { NexusHeader } from "@/components/onboarding-tasks/NexusHeader";
import { HotseatResponseDialog } from "@/components/hotseat/HotseatResponseDialog";
import { HotseatRecordingSection } from "@/components/hotseat/HotseatRecordingSection";
import { getPublicBaseUrl } from "@/lib/publicDomain";

interface HotseatResponse {
  id: string;
  respondent_name: string;
  company_name: string;
  subjects: string[];
  description: string | null;
  linked_company_id: string | null;
  linked_project_id: string | null;
  scheduled_at: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function HotseatAdminPage() {
  const navigate = useNavigate();
  const [responses, setResponses] = useState<HotseatResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedResponse, setSelectedResponse] = useState<HotseatResponse | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [currentStaffId, setCurrentStaffId] = useState<string | null>(null);

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
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

      setCurrentUserRole(staff.role);
      setCurrentStaffId(staff.id);
      fetchResponses();
    } catch (error) {
      console.error("Error checking access:", error);
      navigate("/onboarding-tasks/login");
    }
  };

  const fetchResponses = async () => {
    try {
      const { data, error } = await supabase
        .from("hotseat_responses")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setResponses(data || []);
    } catch (error) {
      console.error("Error fetching hotseat responses:", error);
      toast.error("Erro ao carregar respostas");
    } finally {
      setLoading(false);
    }
  };

  const getPublicLink = () => {
    return `${getPublicBaseUrl()}/?public=hotseat`;
  };

  const copyLink = () => {
    navigator.clipboard.writeText(getPublicLink());
    toast.success("Link copiado!");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="border-yellow-500 text-yellow-600"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case "scheduled":
        return <Badge variant="outline" className="border-blue-500 text-blue-600"><Calendar className="h-3 w-3 mr-1" />Agendado</Badge>;
      case "completed":
        return <Badge variant="outline" className="border-green-500 text-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Concluído</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="border-red-500 text-red-600"><XCircle className="h-3 w-3 mr-1" />Cancelado</Badge>;
      case "no_show":
        return <Badge variant="outline" className="border-orange-500 text-orange-600"><UserX className="h-3 w-3 mr-1" />Não Compareceu</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredResponses = responses
    .filter((r) =>
      r.respondent_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.company_name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      // Status priority: pending first, then scheduled, then others
      const statusOrder: Record<string, number> = {
        pending: 0,
        scheduled: 1,
        completed: 2,
        cancelled: 3,
        no_show: 4,
      };
      
      const aOrder = statusOrder[a.status] ?? 5;
      const bOrder = statusOrder[b.status] ?? 5;
      
      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }
      
      // For scheduled items, sort by scheduled_at (earliest first)
      if (a.status === "scheduled" && b.status === "scheduled") {
        if (a.scheduled_at && b.scheduled_at) {
          return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
        }
        if (a.scheduled_at) return -1;
        if (b.scheduled_at) return 1;
      }
      
      // For pending items, sort by created_at (oldest first - FIFO)
      if (a.status === "pending" && b.status === "pending") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      
      // For other statuses, sort by updated_at (most recent first)
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

  const pendingCount = responses.filter(r => r.status === "pending").length;
  const scheduledCount = responses.filter(r => r.status === "scheduled").length;
  const completedCount = responses.filter(r => r.status === "completed").length;

  const openResponseDialog = (response: HotseatResponse) => {
    setSelectedResponse(response);
    setIsDialogOpen(true);
  };

  const handleResponseUpdated = () => {
    fetchResponses();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="container mx-auto px-4 py-6">
          <Skeleton className="h-10 w-64 mb-6" />
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate("/onboarding-tasks")}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <NexusHeader showTitle={false} />
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2">
                  <Flame className="h-6 w-6 text-orange-500" />
                  Hotseat
                </h1>
                <p className="text-sm text-muted-foreground hidden md:block">
                  Gerenciar solicitações de Hotseat
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={copyLink}
                className="gap-2"
              >
                <Copy className="h-4 w-4" />
                <span className="hidden sm:inline">Copiar Link</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  setLoading(true);
                  fetchResponses();
                }}
                disabled={loading}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Atualizar</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        {/* Recording Section */}
        <div className="mb-6">
          <HotseatRecordingSection currentStaffId={currentStaffId} />
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{responses.length}</p>
                </div>
                <Flame className="h-8 w-8 text-orange-500 opacity-20" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pendentes</p>
                  <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500 opacity-20" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Agendados</p>
                  <p className="text-2xl font-bold text-blue-600">{scheduledCount}</p>
                </div>
                <Calendar className="h-8 w-8 text-blue-500 opacity-20" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Concluídos</p>
                  <p className="text-2xl font-bold text-green-600">{completedCount}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-500 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="mb-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou empresa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Responses List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Respostas do Hotseat</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredResponses.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Flame className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>Nenhuma resposta encontrada</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredResponses.map((response) => (
                  <div
                    key={response.id}
                    onClick={() => openResponseDialog(response)}
                    className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium truncate">{response.respondent_name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                          <Building2 className="h-4 w-4" />
                          <span className="truncate">{response.company_name}</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {response.subjects.map((subject, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {subject}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Recebido em {format(new Date(response.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {getStatusBadge(response.status)}
                        {response.scheduled_at && (
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(response.scheduled_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Response Dialog */}
      {selectedResponse && (
        <HotseatResponseDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          response={selectedResponse}
          onUpdated={handleResponseUpdated}
        />
      )}
    </div>
  );
}
