import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, X, Save, Star } from "lucide-react";
import { toast } from "sonner";

interface ScorecardCriteria {
  id: string;
  name: string;
  description: string | null;
  weight: number;
}

interface ScorecardScore {
  criteria_id: string;
  score: number;
  notes: string;
}

interface InterviewScorecardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  interviewId: string;
  projectId: string;
  onSuccess?: () => void;
}

export function InterviewScorecardDialog({
  open,
  onOpenChange,
  interviewId,
  projectId,
  onSuccess
}: InterviewScorecardDialogProps) {
  const [criteria, setCriteria] = useState<ScorecardCriteria[]>([]);
  const [scores, setScores] = useState<Record<string, ScorecardScore>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [jobOpeningId, setJobOpeningId] = useState<string | null>(null);
  
  // For adding new criteria
  const [showAddCriteria, setShowAddCriteria] = useState(false);
  const [newCriteriaName, setNewCriteriaName] = useState("");
  const [newCriteriaWeight, setNewCriteriaWeight] = useState(1);

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, interviewId, jobOpeningId, projectId]);

  const fetchData = async () => {
    setLoading(true);

    // First, get the interview to find the job_opening_id through the candidate
    const { data: interviewData } = await supabase
      .from("interviews")
      .select("candidate:candidates(job_opening_id)")
      .eq("id", interviewId)
      .single();

    const fetchedJobOpeningId = (interviewData?.candidate as any)?.job_opening_id || null;
    setJobOpeningId(fetchedJobOpeningId);

    // Fetch criteria for this job or project
    let query = supabase
      .from("interview_scorecard_criteria")
      .select("*");
    
    if (fetchedJobOpeningId) {
      query = query.or(`job_opening_id.eq.${fetchedJobOpeningId},and(job_opening_id.is.null,project_id.eq.${projectId})`);
    } else {
      query = query.eq("project_id", projectId).is("job_opening_id", null);
    }
    
    const { data: criteriaData } = await query.order("sort_order");
    
    setCriteria(criteriaData || []);

    // Fetch existing scores for this interview
    const { data: scoresData } = await supabase
      .from("interview_scorecard_scores")
      .select("*")
      .eq("interview_id", interviewId);

    const scoresMap: Record<string, ScorecardScore> = {};
    (scoresData || []).forEach(s => {
      scoresMap[s.criteria_id] = {
        criteria_id: s.criteria_id,
        score: s.score || 3,
        notes: s.notes || ""
      };
    });

    // Initialize scores for criteria without existing scores
    (criteriaData || []).forEach(c => {
      if (!scoresMap[c.id]) {
        scoresMap[c.id] = {
          criteria_id: c.id,
          score: 3,
          notes: ""
        };
      }
    });

    setScores(scoresMap);
    setLoading(false);
  };

  const handleAddCriteria = async () => {
    if (!newCriteriaName.trim()) return;

    const { data, error } = await supabase
      .from("interview_scorecard_criteria")
      .insert({
        project_id: projectId,
        job_opening_id: jobOpeningId,
        name: newCriteriaName.trim(),
        weight: newCriteriaWeight,
        sort_order: criteria.length
      })
      .select()
      .single();

    if (error) {
      toast.error("Erro ao adicionar critério");
    } else {
      setCriteria([...criteria, data]);
      setScores({
        ...scores,
        [data.id]: { criteria_id: data.id, score: 3, notes: "" }
      });
      setNewCriteriaName("");
      setNewCriteriaWeight(1);
      setShowAddCriteria(false);
      toast.success("Critério adicionado!");
    }
  };

  const handleScoreChange = (criteriaId: string, score: number) => {
    setScores({
      ...scores,
      [criteriaId]: { ...scores[criteriaId], score }
    });
  };

  const handleNotesChange = (criteriaId: string, notes: string) => {
    setScores({
      ...scores,
      [criteriaId]: { ...scores[criteriaId], notes }
    });
  };

  const handleSave = async () => {
    setSaving(true);

    // Delete existing scores and insert new ones
    await supabase
      .from("interview_scorecard_scores")
      .delete()
      .eq("interview_id", interviewId);

    const scoresToInsert = Object.values(scores).map(s => ({
      interview_id: interviewId,
      criteria_id: s.criteria_id,
      score: s.score,
      notes: s.notes || null
    }));

    const { error } = await supabase
      .from("interview_scorecard_scores")
      .insert(scoresToInsert);

    if (error) {
      toast.error("Erro ao salvar avaliação");
    } else {
      // Calculate and update overall interview score
      const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
      const weightedScore = criteria.reduce((sum, c) => {
        const score = scores[c.id]?.score || 0;
        return sum + (score * c.weight);
      }, 0);
      const averageScore = totalWeight > 0 ? Math.round((weightedScore / totalWeight) * 2) : 0;

      await supabase
        .from("interviews")
        .update({ score: averageScore })
        .eq("id", interviewId);

      toast.success("Avaliação salva com sucesso!");
      onSuccess?.();
      onOpenChange(false);
    }

    setSaving(false);
  };

  const calculateOverallScore = () => {
    const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
    if (totalWeight === 0) return 0;
    
    const weightedScore = criteria.reduce((sum, c) => {
      const score = scores[c.id]?.score || 0;
      return sum + (score * c.weight);
    }, 0);
    
    return (weightedScore / totalWeight).toFixed(1);
  };

  const getScoreColor = (score: number) => {
    if (score >= 4) return 'text-green-500';
    if (score >= 3) return 'text-yellow-500';
    return 'text-red-500';
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Scorecard da Entrevista</DialogTitle>
          </DialogHeader>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-muted rounded" />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Scorecard da Entrevista</span>
            <Badge variant="outline" className="text-lg">
              <Star className="h-4 w-4 mr-1 fill-yellow-500 text-yellow-500" />
              {calculateOverallScore()}/5
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {criteria.length === 0 && !showAddCriteria ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground mb-4">
                Nenhum critério de avaliação definido
              </p>
              <Button onClick={() => setShowAddCriteria(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Critério
              </Button>
            </Card>
          ) : (
            <>
              {criteria.map(c => (
                <Card key={c.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-medium">{c.name}</h4>
                        {c.description && (
                          <p className="text-sm text-muted-foreground">{c.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Peso: {c.weight}x</Badge>
                        <span className={`text-2xl font-bold ${getScoreColor(scores[c.id]?.score || 0)}`}>
                          {scores[c.id]?.score || 0}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground w-8">1</span>
                        <Slider
                          value={[scores[c.id]?.score || 3]}
                          onValueChange={([value]) => handleScoreChange(c.id, value)}
                          min={1}
                          max={5}
                          step={1}
                          className="flex-1"
                        />
                        <span className="text-sm text-muted-foreground w-8">5</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground px-8">
                        <span>Insuficiente</span>
                        <span>Abaixo</span>
                        <span>Esperado</span>
                        <span>Acima</span>
                        <span>Excelente</span>
                      </div>
                      <Textarea
                        placeholder="Observações sobre este critério..."
                        value={scores[c.id]?.notes || ""}
                        onChange={(e) => handleNotesChange(c.id, e.target.value)}
                        rows={2}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          )}

          {/* Add Criteria Form */}
          {showAddCriteria ? (
            <Card>
              <CardContent className="p-4 space-y-3">
                <h4 className="font-medium">Novo Critério</h4>
                <Input
                  placeholder="Nome do critério (ex: Comunicação, Conhecimento Técnico)"
                  value={newCriteriaName}
                  onChange={(e) => setNewCriteriaName(e.target.value)}
                />
                <div className="flex items-center gap-4">
                  <span className="text-sm">Peso:</span>
                  <Slider
                    value={[newCriteriaWeight]}
                    onValueChange={([value]) => setNewCriteriaWeight(value)}
                    min={1}
                    max={3}
                    step={1}
                    className="w-32"
                  />
                  <span className="text-sm font-medium">{newCriteriaWeight}x</span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddCriteria}>
                    Adicionar
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => {
                      setShowAddCriteria(false);
                      setNewCriteriaName("");
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => setShowAddCriteria(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Critério
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || criteria.length === 0}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Salvar Avaliação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
