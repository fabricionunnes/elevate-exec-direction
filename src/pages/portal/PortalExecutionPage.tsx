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
  MessageSquare
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
  const [checkinForm, setCheckinForm] = useState({
    current_value: "",
    comment: "",
    impediments: "",
    next_action: "",
    status: "on_track",
  });
  const [savingCheckin, setSavingCheckin] = useState(false);

  useEffect(() => {
    loadData();
  }, [user?.company_id]);

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

  const openCheckinDialog = (kr: KeyResult) => {
    setSelectedKR(kr);
    setCheckinForm({
      current_value: kr.current_value.toString(),
      comment: "",
      impediments: "",
      next_action: "",
      status: kr.status,
    });
    setCheckinDialogOpen(true);
  };

  const saveCheckin = async () => {
    if (!selectedKR || !user) return;
    setSavingCheckin(true);

    try {
      const weekRef = getCurrentWeek();
      const newValue = parseFloat(checkinForm.current_value) || 0;

      // Create check-in
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

      // Update KR current value and status
      const { error: krError } = await supabase
        .from("portal_key_results")
        .update({
          current_value: newValue,
          status: checkinForm.status as "on_track" | "attention" | "off_track" | "completed",
        })
        .eq("id", selectedKR.id);

      if (krError) throw krError;

      toast.success("Check-in registrado com sucesso!");
      setCheckinDialogOpen(false);
      loadData();

    } catch (error) {
      console.error("Error saving check-in:", error);
      toast.error("Erro ao salvar check-in");
    } finally {
      setSavingCheckin(false);
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
                          <div key={checkin.id} className="bg-slate-900/50 rounded-lg p-3 border border-slate-700">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-slate-500" />
                                <span className="text-sm text-slate-400">{formatDate(checkin.week_ref)}</span>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(checkin.status)}`}>
                                {getStatusLabel(checkin.status)}
                              </span>
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
            <DialogTitle className="text-white">Novo Check-in</DialogTitle>
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
              onClick={() => setCheckinDialogOpen(false)}
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
                  Salvar Check-in
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PortalExecutionPage;
