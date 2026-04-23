import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Star, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PROFILE_PIPELINE_STAGES } from "./types";

export default function UNVProfileRecruitmentPipelinePage() {
  const { jobId } = useParams();
  const [job, setJob] = useState<any>(null);
  const [cands, setCands] = useState<any[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);

  const load = async () => {
    if (!jobId) return;
    const [j, c] = await Promise.all([
      supabase.from("profile_jobs").select("*").eq("id", jobId).maybeSingle(),
      supabase.from("profile_candidates").select("*").eq("job_id", jobId).order("created_at", { ascending: false }),
    ]);
    setJob(j.data);
    setCands(c.data || []);
  };

  useEffect(() => { load(); }, [jobId]);

  const moveTo = async (candId: string, stage: string) => {
    const { error } = await supabase.from("profile_candidates").update({ stage }).eq("id", candId);
    if (error) return toast.error(error.message);
    setCands(prev => prev.map(c => c.id === candId ? { ...c, stage } : c));
  };

  const toggleFav = async (cand: any) => {
    const next = !cand.is_favorite;
    await supabase.from("profile_candidates").update({ is_favorite: next }).eq("id", cand.id);
    setCands(prev => prev.map(c => c.id === cand.id ? { ...c, is_favorite: next } : c));
  };

  return (
    <div className="p-6 md:p-8 space-y-4">
      <Link to="/unv-profile/recruitment" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
        <ArrowLeft className="w-3 h-3" /> Vagas
      </Link>
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">{job?.title || "Pipeline"}</h1>
          <p className="text-sm text-muted-foreground">{cands.length} candidatos • Arraste entre colunas</p>
        </div>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {PROFILE_PIPELINE_STAGES.map(stage => {
          const list = cands.filter(c => c.stage === stage.key);
          return (
            <div
              key={stage.key}
              className="min-w-[280px] w-[280px]"
              onDragOver={e => e.preventDefault()}
              onDrop={() => { if (dragId) moveTo(dragId, stage.key); setDragId(null); }}
            >
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${stage.color}`} />
                  <p className="text-xs font-semibold uppercase tracking-wider">{stage.label}</p>
                </div>
                <Badge variant="secondary" className="text-[10px]">{list.length}</Badge>
              </div>
              <div className="space-y-2 min-h-[120px] bg-muted/30 rounded-lg p-2">
                {list.map(c => (
                  <Card
                    key={c.id}
                    draggable
                    onDragStart={() => setDragId(c.id)}
                    className="cursor-move hover:shadow-md transition"
                  >
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <Avatar className="h-8 w-8"><AvatarFallback className="text-xs">{c.full_name?.[0]}</AvatarFallback></Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{c.full_name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{c.email}</p>
                        </div>
                        <button onClick={() => toggleFav(c)}>
                          <Star className={`w-4 h-4 ${c.is_favorite ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                        </button>
                      </div>
                      {c.ai_score != null && (
                        <div className="flex items-center gap-1 text-[10px]">
                          <Sparkles className="w-3 h-3 text-primary" />
                          <span className="font-semibold">{c.ai_score}%</span> aderência IA
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {list.length === 0 && <p className="text-[10px] text-center text-muted-foreground py-4">Vazio</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
