import { useEffect, useState } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { 
  Target, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Clock,
  Plus,
  ChevronDown,
  ChevronUp,
  Save,
  Loader2,
  Calendar,
  MessageSquare,
  Edit2,
  Trash2,
  Sparkles,
  ArrowRight,
  X
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PortalUser {
  id: string;
  company_id: string;
}

interface Plan {
  id: string;
  theme: string | null;
}

interface KeyResult {
  id: string;
  title: string;
  target: number;
  baseline: number;
  current_value: number;
  status: string;
  objective_title: string;
  objective_id: string;
}

interface Checkin {
  id: string;
  key_result_id: string;
  week_ref: string;
  current_value: number;
  previous_value: number;
  comment: string;
  impediments: string;
  next_action: string;
  status: string;
  created_at: string;
}

interface UNVRecommendation {
  service: string;
  reason: string;
  ctaUrl: string;
  priority: "high" | "medium" | "low";
}

// UNV Services recommendation logic
const UNV_SERVICES = {
  core: {
    name: "UNV Core",
    description: "Estruturação comercial para empresas iniciando",
    url: "/core",
    tags: ["estruturação", "processo", "início"]
  },
  control: {
    name: "UNV Control",
    description: "Gestão comercial avançada e disciplina operacional",
    url: "/control",
    tags: ["gestão", "disciplina", "controle"]
  },
  salesOps: {
    name: "UNV Sales Ops",
    description: "Treinamento contínuo para times de vendas",
    url: "/sales-ops",
    tags: ["treinamento", "time", "vendas"]
  },
  salesAcceleration: {
    name: "UNV Sales Acceleration",
    description: "Aceleração de resultados comerciais",
    url: "/sales-acceleration",
    tags: ["aceleração", "resultados", "escala"]
  },
  ads: {
    name: "UNV Ads",
    description: "Gestão de tráfego pago para geração de leads",
    url: "/ads",
    tags: ["tráfego", "leads", "marketing"]
  },
  social: {
    name: "UNV Social",
    description: "Gestão estratégica de redes sociais",
    url: "/social",
    tags: ["redes sociais", "conteúdo", "marca"]
  },
  finance: {
    name: "UNV Finance",
    description: "Controladoria e clareza financeira",
    url: "/finance",
    tags: ["financeiro", "margem", "fluxo"]
  },
  people: {
    name: "UNV People",
    description: "Gestão estratégica de pessoas e recrutamento",
    url: "/people",
    tags: ["pessoas", "contratação", "turnover"]
  },
  growthRoom: {
    name: "UNV Growth Room",
    description: "Imersão presencial de 3 dias",
    url: "/growth-room",
    tags: ["imersão", "estratégia", "networking"]
  },
  mastermind: {
    name: "UNV Mastermind",
    description: "Grupo exclusivo de empresários",
    url: "/mastermind",
    tags: ["networking", "mentoria", "empresários"]
  },
  fractionalCro: {
    name: "Fractional CRO",
    description: "Diretor comercial fracionado",
    url: "/fractional-cro",
    tags: ["diretor", "liderança", "comercial"]
  },
  salesForce: {
    name: "UNV Sales Force",
    description: "Força de vendas terceirizada (SDR/Closer)",
    url: "/sales-force",
    tags: ["sdr", "closer", "terceirização"]
  },
  executionPartnership: {
    name: "Execution Partnership",
    description: "Intervenção executiva direta com Fabrício Nunnes",
    url: "/execution-partnership",
    tags: ["executivo", "intervenção", "reestruturação"]
  }
};

const PortalExecutionPage = () => {
  const { user } = useOutletContext<{ user: PortalUser }>();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [keyResults, setKeyResults] = useState<KeyResult[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedKRs, setExpandedKRs] = useState<Set<string>>(new Set());
  
  // Check-in dialog
  const [checkinDialogOpen, setCheckinDialogOpen] = useState(false);
  const [selectedKR, setSelectedKR] = useState<KeyResult | null>(null);
  const [editingCheckin, setEditingCheckin] = useState<Checkin | null>(null);
  const [checkinForm, setCheckinForm] = useState({
    current_value: "",
    comment: "",
    impediments: "",
    next_action: "",
    status: "on_track",
  });
  const [savingCheckin, setSavingCheckin] = useState(false);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [checkinToDelete, setCheckinToDelete] = useState<Checkin | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Recommendations
  const [recommendations, setRecommendations] = useState<UNVRecommendation[]>([]);
  const [dismissedRecs, setDismissedRecs] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, [user?.company_id]);

  useEffect(() => {
    // Generate recommendations when data changes (always generate, even without KRs)
    generateRecommendations();
  }, [keyResults, checkins, plan]);

  const generateRecommendations = () => {
    const recs: UNVRecommendation[] = [];
    
    // Check for off-track KRs
    const offTrackKRs = keyResults.filter(kr => kr.status === "off_track");
    const attentionKRs = keyResults.filter(kr => kr.status === "attention");
    
    // Check for impediments in recent check-ins
    const recentCheckins = checkins.slice(0, 10);
    const impedimentsText = recentCheckins.map(c => c.impediments?.toLowerCase() || "").join(" ");
    
    // Calculate overall progress
    const avgProgress = keyResults.length > 0 
      ? keyResults.reduce((acc, kr) => {
          const progress = kr.target > 0 ? (kr.current_value / kr.target) * 100 : 0;
          return acc + progress;
        }, 0) / keyResults.length
      : 0;

    // ===== CONTEXTUAL RECOMMENDATIONS (based on data) =====

    // Rule: Many off-track KRs → Execution Partnership
    if (offTrackKRs.length >= 2 || (offTrackKRs.length >= 1 && avgProgress < 30)) {
      recs.push({
        service: UNV_SERVICES.executionPartnership.name,
        reason: `Você tem ${offTrackKRs.length} Key Result(s) off track. Uma intervenção executiva direta pode ajudar a reestruturar a operação e recuperar o ritmo.`,
        ctaUrl: UNV_SERVICES.executionPartnership.url,
        priority: "high"
      });
    }

    // Rule: Low progress + has team issues → Fractional CRO
    if (avgProgress < 40 && avgProgress > 0 && (impedimentsText.includes("time") || impedimentsText.includes("equipe") || impedimentsText.includes("liderança"))) {
      recs.push({
        service: UNV_SERVICES.fractionalCro.name,
        reason: "Identificamos desafios de liderança comercial. Um Diretor Comercial fracionado pode trazer a direção que seu time precisa.",
        ctaUrl: UNV_SERVICES.fractionalCro.url,
        priority: "high"
      });
    }

    // Rule: Lead/traffic impediments → UNV Ads
    if (impedimentsText.includes("lead") || impedimentsText.includes("tráfego") || impedimentsText.includes("demanda") || impedimentsText.includes("oportunidade")) {
      recs.push({
        service: UNV_SERVICES.ads.name,
        reason: "Parece que geração de leads é um gargalo. Nossa gestão de tráfego pago pode ajudar a aumentar a demanda qualificada.",
        ctaUrl: UNV_SERVICES.ads.url,
        priority: "medium"
      });
    }

    // Rule: Process/discipline issues → UNV Control
    if (impedimentsText.includes("processo") || impedimentsText.includes("disciplina") || impedimentsText.includes("rotina") || impedimentsText.includes("organização")) {
      recs.push({
        service: UNV_SERVICES.control.name,
        reason: "Falta de processo ou disciplina foi mencionado. O UNV Control traz a estrutura de gestão comercial que você precisa.",
        ctaUrl: UNV_SERVICES.control.url,
        priority: "medium"
      });
    }

    // Rule: Team training issues → Sales Ops
    if (impedimentsText.includes("treinamento") || impedimentsText.includes("capacitação") || impedimentsText.includes("vendedor") || impedimentsText.includes("closer")) {
      recs.push({
        service: UNV_SERVICES.salesOps.name,
        reason: "Seu time precisa de capacitação contínua. O Sales Ops oferece treinamentos quinzenais segmentados por nível.",
        ctaUrl: UNV_SERVICES.salesOps.url,
        priority: "medium"
      });
    }

    // Rule: Hiring/turnover issues → UNV People
    if (impedimentsText.includes("contratação") || impedimentsText.includes("turnover") || impedimentsText.includes("demissão") || impedimentsText.includes("rh")) {
      recs.push({
        service: UNV_SERVICES.people.name,
        reason: "Desafios com pessoas podem estar travando seus resultados. O UNV People ajuda com recrutamento e gestão de talentos.",
        ctaUrl: UNV_SERVICES.people.url,
        priority: "medium"
      });
    }

    // Rule: Financial issues → UNV Finance
    if (impedimentsText.includes("caixa") || impedimentsText.includes("financeiro") || impedimentsText.includes("margem") || impedimentsText.includes("investimento")) {
      recs.push({
        service: UNV_SERVICES.finance.name,
        reason: "Questões financeiras aparecem nos impedimentos. O UNV Finance traz clareza sobre onde seu dinheiro está sendo bem investido.",
        ctaUrl: UNV_SERVICES.finance.url,
        priority: "medium"
      });
    }

    // Rule: Attention KRs + no critical issues → Growth Room
    if (attentionKRs.length >= 1 && offTrackKRs.length === 0 && recs.length < 2) {
      recs.push({
        service: UNV_SERVICES.growthRoom.name,
        reason: "Seus KRs estão em atenção. Uma imersão de 3 dias pode dar a virada estratégica que você precisa.",
        ctaUrl: UNV_SERVICES.growthRoom.url,
        priority: "low"
      });
    }

    // Rule: Good progress but wants more → Mastermind
    if (avgProgress >= 60 && keyResults.length >= 3) {
      recs.push({
        service: UNV_SERVICES.mastermind.name,
        reason: "Você está performando bem! O Mastermind conecta você com outros empresários de alto nível para trocar experiências.",
        ctaUrl: UNV_SERVICES.mastermind.url,
        priority: "low"
      });
    }

    // ===== DEFAULT RECOMMENDATIONS (always show if no contextual ones) =====
    
    // If no KRs registered yet → suggest starting with structure
    if (keyResults.length === 0) {
      recs.push({
        service: UNV_SERVICES.core.name,
        reason: "Comece sua jornada com a estruturação comercial. O UNV Core ajuda a criar a base sólida que seu negócio precisa.",
        ctaUrl: UNV_SERVICES.core.url,
        priority: "medium"
      });
      recs.push({
        service: UNV_SERVICES.growthRoom.name,
        reason: "Quer acelerar sua estratégia? A imersão Growth Room de 3 dias pode transformar sua visão de negócio.",
        ctaUrl: UNV_SERVICES.growthRoom.url,
        priority: "low"
      });
    }

    // If few checkins → suggest discipline tools
    if (checkins.length < 3 && keyResults.length > 0) {
      const hasControl = recs.some(r => r.service === UNV_SERVICES.control.name);
      if (!hasControl) {
        recs.push({
          service: UNV_SERVICES.control.name,
          reason: "Poucos check-ins registrados. O UNV Control ajuda a criar a disciplina de acompanhamento semanal.",
          ctaUrl: UNV_SERVICES.control.url,
          priority: "medium"
        });
      }
    }

    // Always suggest at least one option if empty
    if (recs.length === 0) {
      recs.push({
        service: UNV_SERVICES.salesAcceleration.name,
        reason: "Pronto para acelerar? O Sales Acceleration é o caminho para escalar seus resultados comerciais.",
        ctaUrl: UNV_SERVICES.salesAcceleration.url,
        priority: "low"
      });
      recs.push({
        service: UNV_SERVICES.ads.name,
        reason: "Precisa de mais leads? Nossa gestão de tráfego pago gera demanda qualificada para seu time comercial.",
        ctaUrl: UNV_SERVICES.ads.url,
        priority: "low"
      });
    }

    // Limit to 3 recommendations max
    setRecommendations(recs.slice(0, 3));
  };

  const dismissRecommendation = (service: string) => {
    setDismissedRecs(prev => new Set([...prev, service]));
  };

  const loadData = async () => {
    if (!user?.company_id) return;

    try {
      // Load published plan
      const { data: planData } = await supabase
        .from("portal_plans")
        .select("id, theme")
        .eq("company_id", user.company_id)
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(1)
        .single();

      if (!planData) {
        setLoading(false);
        return;
      }

      setPlan(planData);

      // Load key results with objectives
      const { data: objectives } = await supabase
        .from("portal_objectives")
        .select("id, title, portal_key_results(*)")
        .eq("plan_id", planData.id)
        .order("priority");

      if (objectives) {
        const krs: KeyResult[] = [];
        objectives.forEach((obj) => {
          (obj.portal_key_results || []).forEach((kr: any) => {
            krs.push({
              id: kr.id,
              title: kr.title,
              target: kr.target || 0,
              baseline: kr.baseline || 0,
              current_value: kr.current_value || 0,
              status: kr.status,
              objective_title: obj.title,
              objective_id: obj.id,
            });
          });
        });
        setKeyResults(krs);

        // Load all checkins for these KRs
        if (krs.length > 0) {
          const { data: checkinsData } = await supabase
            .from("portal_checkins")
            .select("*")
            .in("key_result_id", krs.map(kr => kr.id))
            .order("week_ref", { ascending: false });

          if (checkinsData) {
            setCheckins(checkinsData as Checkin[]);
          }
        }
      }

    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "on_track": return "text-green-400 bg-green-500/10 border-green-500/20";
      case "attention": return "text-yellow-400 bg-yellow-500/10 border-yellow-500/20";
      case "off_track": return "text-red-400 bg-red-500/10 border-red-500/20";
      case "completed": return "text-blue-400 bg-blue-500/10 border-blue-500/20";
      default: return "text-slate-400 bg-slate-500/10 border-slate-500/20";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "on_track": return "On Track";
      case "attention": return "Atenção";
      case "off_track": return "Off Track";
      case "completed": return "Concluído";
      default: return status;
    }
  };

  const calculateProgress = (current: number, target: number) => {
    if (target === 0) return 0;
    return Math.min(100, Math.round((current / target) * 100));
  };

  const getCurrentWeek = () => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1);
    return startOfWeek.toISOString().split("T")[0];
  };

  const openCheckinDialog = (kr: KeyResult, existingCheckin?: Checkin) => {
    setSelectedKR(kr);
    if (existingCheckin) {
      setEditingCheckin(existingCheckin);
      setCheckinForm({
        current_value: existingCheckin.current_value?.toString() || "",
        comment: existingCheckin.comment || "",
        impediments: existingCheckin.impediments || "",
        next_action: existingCheckin.next_action || "",
        status: existingCheckin.status,
      });
    } else {
      setEditingCheckin(null);
      setCheckinForm({
        current_value: kr.current_value.toString(),
        comment: "",
        impediments: "",
        next_action: "",
        status: kr.status,
      });
    }
    setCheckinDialogOpen(true);
  };

  const saveCheckin = async () => {
    if (!selectedKR || !user) return;
    setSavingCheckin(true);

    try {
      const newValue = parseFloat(checkinForm.current_value) || 0;

      if (editingCheckin) {
        // Update existing check-in
        const { error: checkinError } = await supabase
          .from("portal_checkins")
          .update({
            current_value: newValue,
            comment: checkinForm.comment,
            impediments: checkinForm.impediments,
            next_action: checkinForm.next_action,
            status: checkinForm.status as "on_track" | "attention" | "off_track" | "completed",
          })
          .eq("id", editingCheckin.id);

        if (checkinError) throw checkinError;
        toast.success("Check-in atualizado com sucesso!");
      } else {
        // Create new check-in
        const weekRef = getCurrentWeek();
        const { error: checkinError } = await supabase
          .from("portal_checkins")
          .insert([{
            key_result_id: selectedKR.id,
            week_ref: weekRef,
            current_value: newValue,
            previous_value: selectedKR.current_value,
            comment: checkinForm.comment,
            impediments: checkinForm.impediments,
            next_action: checkinForm.next_action,
            status: checkinForm.status as "on_track" | "attention" | "off_track" | "completed",
            created_by: user.id,
          }]);

        if (checkinError) throw checkinError;
        toast.success("Check-in registrado com sucesso!");
      }

      // Update KR current value and status (use most recent value)
      const { error: krError } = await supabase
        .from("portal_key_results")
        .update({
          current_value: newValue,
          status: checkinForm.status as "on_track" | "attention" | "off_track" | "completed",
        })
        .eq("id", selectedKR.id);

      if (krError) throw krError;

      setCheckinDialogOpen(false);
      setEditingCheckin(null);
      loadData();

    } catch (error) {
      console.error("Error saving check-in:", error);
      toast.error("Erro ao salvar check-in");
    } finally {
      setSavingCheckin(false);
    }
  };

  const openDeleteDialog = (checkin: Checkin) => {
    setCheckinToDelete(checkin);
    setDeleteDialogOpen(true);
  };

  const deleteCheckin = async () => {
    if (!checkinToDelete) return;
    setDeleting(true);

    try {
      const krId = checkinToDelete.key_result_id;
      
      // Delete the check-in
      const { error } = await supabase
        .from("portal_checkins")
        .delete()
        .eq("id", checkinToDelete.id);

      if (error) throw error;

      // Get remaining check-ins for this KR
      const { data: remainingCheckins } = await supabase
        .from("portal_checkins")
        .select("*")
        .eq("key_result_id", krId)
        .order("week_ref", { ascending: false });

      // Find the KR to get its baseline
      const kr = keyResults.find(k => k.id === krId);
      
      if (remainingCheckins && remainingCheckins.length > 0) {
        // Use the most recent check-in value
        const mostRecent = remainingCheckins[0];
        await supabase
          .from("portal_key_results")
          .update({
            current_value: mostRecent.current_value,
            status: mostRecent.status as "on_track" | "attention" | "off_track" | "completed",
          })
          .eq("id", krId);
      } else {
        // No check-ins remaining, reset to baseline
        await supabase
          .from("portal_key_results")
          .update({
            current_value: kr?.baseline || 0,
            status: "on_track" as const,
          })
          .eq("id", krId);
      }

      toast.success("Check-in excluído com sucesso!");
      setDeleteDialogOpen(false);
      setCheckinToDelete(null);
      loadData();

    } catch (error) {
      console.error("Error deleting check-in:", error);
      toast.error("Erro ao excluir check-in");
    } finally {
      setDeleting(false);
    }
  };

  const toggleKRExpanded = (krId: string) => {
    const newExpanded = new Set(expandedKRs);
    if (newExpanded.has(krId)) {
      newExpanded.delete(krId);
    } else {
      newExpanded.add(krId);
    }
    setExpandedKRs(newExpanded);
  };

  const getKRCheckins = (krId: string) => {
    return checkins.filter(c => c.key_result_id === krId);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
    });
  };

  // Group KRs by objective
  const groupedKRs = keyResults.reduce((acc, kr) => {
    if (!acc[kr.objective_id]) {
      acc[kr.objective_id] = {
        title: kr.objective_title,
        krs: [],
      };
    }
    acc[kr.objective_id].krs.push(kr);
    return acc;
  }, {} as Record<string, { title: string; krs: KeyResult[] }>);

  const visibleRecommendations = recommendations.filter(r => !dismissedRecs.has(r.service));

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-slate-800 rounded" />
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-slate-800 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <Card className="bg-slate-900/50 border-slate-800 text-center py-12">
          <CardContent>
            <Calendar className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Nenhum plano publicado</h2>
            <p className="text-slate-400 mb-6">
              Publique seu planejamento 2026 para começar a fazer check-ins.
            </p>
            <Link to="/portal/app/planejamento">
              <Button className="bg-amber-500 hover:bg-amber-600 text-slate-950">
                Ir para Planejamento
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white mb-1">Execução</h1>
          <p className="text-slate-400">
            Check-ins semanais e acompanhamento • {plan.theme || "Planejamento 2026"}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Calendar className="w-4 h-4" />
          Semana de {formatDate(getCurrentWeek())}
        </div>
      </div>

      {/* UNV Recommendations */}
      {visibleRecommendations.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-white">Recomendações UNV para você</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {visibleRecommendations.map((rec) => (
              <Card 
                key={rec.service} 
                className={`relative border ${
                  rec.priority === "high" 
                    ? "bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/30" 
                    : rec.priority === "medium"
                    ? "bg-slate-900/50 border-slate-700"
                    : "bg-slate-900/30 border-slate-800"
                }`}
              >
                <button 
                  onClick={() => dismissRecommendation(rec.service)}
                  className="absolute top-2 right-2 p-1 rounded-full hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                <CardContent className="p-4 pt-6">
                  <div className="flex items-start gap-3 mb-3">
                    {rec.priority === "high" && (
                      <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                      </div>
                    )}
                    {rec.priority === "medium" && (
                      <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center shrink-0">
                        <Target className="w-4 h-4 text-blue-400" />
                      </div>
                    )}
                    {rec.priority === "low" && (
                      <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center shrink-0">
                        <TrendingUp className="w-4 h-4 text-green-400" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-white">{rec.service}</h3>
                      <p className="text-sm text-slate-400 mt-1">{rec.reason}</p>
                    </div>
                  </div>
                  <Link to={rec.ctaUrl}>
                    <Button 
                      size="sm" 
                      className={`w-full ${
                        rec.priority === "high"
                          ? "bg-amber-500 hover:bg-amber-600 text-slate-950"
                          : "bg-slate-700 hover:bg-slate-600 text-white"
                      }`}
                    >
                      Conhecer
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center">
                <Target className="w-5 h-5 text-slate-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{keyResults.length}</p>
                <p className="text-xs text-slate-400">Key Results</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {keyResults.filter(kr => kr.status === "on_track" || kr.status === "completed").length}
                </p>
                <p className="text-xs text-slate-400">On Track</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{checkins.length}</p>
                <p className="text-xs text-slate-400">Check-ins</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {keyResults.filter(kr => kr.status === "off_track").length}
                </p>
                <p className="text-xs text-slate-400">Off Track</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Key Results by Objective */}
      <div className="space-y-6">
        {Object.entries(groupedKRs).map(([objId, { title, krs }]) => (
          <Card key={objId} className="bg-slate-900/50 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <Target className="w-5 h-5 text-amber-400" />
                {title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {krs.map((kr) => {
                const progress = calculateProgress(kr.current_value, kr.target);
                const krCheckins = getKRCheckins(kr.id);
                const isExpanded = expandedKRs.has(kr.id);

                return (
                  <Collapsible key={kr.id} open={isExpanded} onOpenChange={() => toggleKRExpanded(kr.id)}>
                    <div className="bg-slate-800/50 rounded-lg p-4">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-white font-medium">{kr.title}</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getStatusColor(kr.status)}`}>
                              {getStatusLabel(kr.status)}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-slate-400">
                            <span>
                              {kr.current_value.toLocaleString("pt-BR")} / {kr.target.toLocaleString("pt-BR")}
                            </span>
                            <span>{progress}%</span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => openCheckinDialog(kr)}
                          className="bg-amber-500 hover:bg-amber-600 text-slate-950"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Check-in
                        </Button>
                      </div>

                      <Progress value={progress} className="h-2 bg-slate-700 mb-3" />

                      {krCheckins.length > 0 && (
                        <CollapsibleTrigger asChild>
                          <button className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-300 transition-colors">
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                            {krCheckins.length} check-in{krCheckins.length !== 1 ? "s" : ""} registrado{krCheckins.length !== 1 ? "s" : ""}
                          </button>
                        </CollapsibleTrigger>
                      )}

                      <CollapsibleContent className="mt-4 space-y-3">
                        {krCheckins.map((checkin) => (
                          <div key={checkin.id} className="bg-slate-900/50 rounded-lg p-3 border border-slate-700 group">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-slate-500" />
                                <span className="text-sm text-slate-400">{formatDate(checkin.week_ref)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(checkin.status)}`}>
                                  {getStatusLabel(checkin.status)}
                                </span>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-slate-400 hover:text-white"
                                    onClick={() => openCheckinDialog(kr, checkin)}
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-slate-400 hover:text-red-400"
                                    onClick={() => openDeleteDialog(checkin)}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 text-sm mb-2">
                              <span className="text-white">
                                Valor: {checkin.current_value?.toLocaleString("pt-BR") || "—"}
                              </span>
                              {checkin.previous_value !== checkin.current_value && (
                                <span className={`flex items-center gap-1 ${
                                  (checkin.current_value || 0) > (checkin.previous_value || 0) 
                                    ? "text-green-400" 
                                    : "text-red-400"
                                }`}>
                                  <TrendingUp className="w-3 h-3" />
                                  {((checkin.current_value || 0) - (checkin.previous_value || 0)).toLocaleString("pt-BR")}
                                </span>
                              )}
                            </div>
                            {checkin.comment && (
                              <p className="text-sm text-slate-300 mb-2">{checkin.comment}</p>
                            )}
                            {checkin.impediments && (
                              <p className="text-sm text-red-400 mb-2">
                                <strong>Impedimentos:</strong> {checkin.impediments}
                              </p>
                            )}
                            {checkin.next_action && (
                              <p className="text-sm text-green-400">
                                <strong>Próxima ação:</strong> {checkin.next_action}
                              </p>
                            )}
                          </div>
                        ))}
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </CardContent>
          </Card>
        ))}

        {keyResults.length === 0 && (
          <Card className="bg-slate-900/50 border-slate-800 text-center py-8">
            <CardContent>
              <p className="text-slate-400">Nenhum Key Result cadastrado ainda.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Check-in Dialog */}
      <Dialog open={checkinDialogOpen} onOpenChange={setCheckinDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingCheckin ? "Editar Check-in" : "Novo Check-in"}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {selectedKR?.title}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Valor Atual</Label>
              <Input
                type="number"
                value={checkinForm.current_value}
                onChange={(e) => setCheckinForm({ ...checkinForm, current_value: e.target.value })}
                className="bg-slate-800/50 border-slate-700 text-white"
                placeholder={`Meta: ${selectedKR?.target.toLocaleString("pt-BR")}`}
              />
              <p className="text-xs text-slate-500">
                Anterior: {selectedKR?.current_value.toLocaleString("pt-BR")} • Meta: {selectedKR?.target.toLocaleString("pt-BR")}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Status</Label>
              <Select 
                value={checkinForm.status} 
                onValueChange={(v) => setCheckinForm({ ...checkinForm, status: v })}
              >
                <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="on_track">✅ On Track</SelectItem>
                  <SelectItem value="attention">⚠️ Atenção</SelectItem>
                  <SelectItem value="off_track">🔴 Off Track</SelectItem>
                  <SelectItem value="completed">🏆 Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">O que foi feito esta semana?</Label>
              <Textarea
                value={checkinForm.comment}
                onChange={(e) => setCheckinForm({ ...checkinForm, comment: e.target.value })}
                className="bg-slate-800/50 border-slate-700 text-white"
                placeholder="Descreva o progresso..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Impedimentos</Label>
              <Textarea
                value={checkinForm.impediments}
                onChange={(e) => setCheckinForm({ ...checkinForm, impediments: e.target.value })}
                className="bg-slate-800/50 border-slate-700 text-white"
                placeholder="Algo está travando o progresso?"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Próxima Ação</Label>
              <Textarea
                value={checkinForm.next_action}
                onChange={(e) => setCheckinForm({ ...checkinForm, next_action: e.target.value })}
                className="bg-slate-800/50 border-slate-700 text-white"
                placeholder="Qual o próximo passo?"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setCheckinDialogOpen(false);
                setEditingCheckin(null);
              }}
              className="text-slate-400"
            >
              Cancelar
            </Button>
            <Button
              onClick={saveCheckin}
              disabled={savingCheckin}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950"
            >
              {savingCheckin ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {editingCheckin ? "Atualizar" : "Salvar"} Check-in
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-slate-900 border-slate-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Excluir Check-in?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Esta ação não pode ser desfeita. O check-in será permanentemente removido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteCheckin}
              disabled={deleting}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PortalExecutionPage;
