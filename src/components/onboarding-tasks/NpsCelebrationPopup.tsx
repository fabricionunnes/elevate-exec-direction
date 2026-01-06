import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Star, PartyPopper, Trophy } from "lucide-react";
import confetti from "canvas-confetti";

interface CelebrationData {
  celebrationId: string;
  consultantName: string;
  companyName: string;
  feedback: string;
  wouldRecommendWhy: string;
}

export const NpsCelebrationPopup = () => {
  const [celebrations, setCelebrations] = useState<CelebrationData[]>([]);
  const [currentCelebration, setCurrentCelebration] = useState<CelebrationData | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);

  // Get current staff ID
  useEffect(() => {
    let isMounted = true;
    
    const getStaffId = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user || !isMounted) return;

        const { data: staff, error: staffError } = await supabase
          .from("onboarding_staff")
          .select("id")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .maybeSingle();

        if (staffError) {
          console.warn("Error fetching staff for NPS celebration:", staffError);
          return;
        }

        if (staff && isMounted) {
          setStaffId(staff.id);
        }
      } catch (error) {
        console.warn("Error in getStaffId for NPS:", error);
      }
    };

    getStaffId();
    
    return () => {
      isMounted = false;
    };
  }, []);

  // Load pending celebrations on mount
  useEffect(() => {
    if (!staffId) return;

    const loadPendingCelebrations = async () => {
      console.log('[NpsCelebration] Loading pending celebrations for staff:', staffId);
      
      const { data: pending, error } = await supabase
        .from("onboarding_nps_celebrations")
        .select(`
          id,
          nps_response_id,
          onboarding_nps_responses!inner(
            id,
            score,
            feedback,
            would_recommend_why,
            project_id
          )
        `)
        .eq("staff_id", staffId)
        .is("seen_at", null)
        .order("created_at", { ascending: true });

      if (error) {
        console.error('[NpsCelebration] Error loading pending:', error);
        return;
      }

      if (!pending || pending.length === 0) {
        console.log('[NpsCelebration] No pending celebrations');
        return;
      }

      console.log('[NpsCelebration] Found pending celebrations:', pending.length);

      // Fetch project details for each celebration
      const celebrationData: CelebrationData[] = [];
      
      for (const item of pending) {
        const npsResponse = item.onboarding_nps_responses as any;
        
        const { data: project } = await supabase
          .from("onboarding_projects")
          .select(`
            id,
            consultant_id,
            cs_id,
            onboarding_companies(name),
            consultant:onboarding_staff!onboarding_projects_consultant_id_fkey(name),
            cs:onboarding_staff!onboarding_projects_cs_id_fkey(name)
          `)
          .eq("id", npsResponse.project_id)
          .single();

        if (project) {
          const consultantName = (project.consultant as any)?.name || (project.cs as any)?.name || "Consultor";
          const companyName = (project.onboarding_companies as any)?.name || "Cliente";

          celebrationData.push({
            celebrationId: item.id,
            consultantName,
            companyName,
            feedback: npsResponse.feedback || "",
            wouldRecommendWhy: npsResponse.would_recommend_why || "",
          });
        }
      }

      if (celebrationData.length > 0) {
        setCelebrations(celebrationData);
        setCurrentCelebration(celebrationData[0]);
        triggerConfetti();
      }
    };

    loadPendingCelebrations();
  }, [staffId]);

  // Subscribe to new celebrations in realtime
  useEffect(() => {
    if (!staffId) return;

    console.log('[NpsCelebration] Setting up realtime subscription for staff:', staffId);
    
    const channel = supabase
      .channel('nps-celebration-' + staffId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'onboarding_nps_celebrations',
          filter: `staff_id=eq.${staffId}`,
        },
        async (payload) => {
          console.log('[NpsCelebration] New celebration received:', payload);
          const newCelebration = payload.new as any;

          // Fetch NPS response details
          const { data: npsResponse, error: npsError } = await supabase
            .from("onboarding_nps_responses")
            .select("id, score, feedback, would_recommend_why, project_id")
            .eq("id", newCelebration.nps_response_id)
            .single();

          if (npsError || !npsResponse) {
            console.error('[NpsCelebration] Error fetching NPS response:', npsError);
            return;
          }

          // Fetch project details
          const { data: project } = await supabase
            .from("onboarding_projects")
            .select(`
              id,
              consultant_id,
              cs_id,
              onboarding_companies(name),
              consultant:onboarding_staff!onboarding_projects_consultant_id_fkey(name),
              cs:onboarding_staff!onboarding_projects_cs_id_fkey(name)
            `)
            .eq("id", npsResponse.project_id)
            .single();

          if (!project) return;

          const consultantName = (project.consultant as any)?.name || (project.cs as any)?.name || "Consultor";
          const companyName = (project.onboarding_companies as any)?.name || "Cliente";

          const celebrationData: CelebrationData = {
            celebrationId: newCelebration.id,
            consultantName,
            companyName,
            feedback: npsResponse.feedback || "",
            wouldRecommendWhy: npsResponse.would_recommend_why || "",
          };

          setCelebrations(prev => {
            // Avoid duplicates
            if (prev.some(c => c.celebrationId === celebrationData.celebrationId)) {
              return prev;
            }
            return [...prev, celebrationData];
          });

          // If no current celebration showing, show this one
          setCurrentCelebration(prev => {
            if (!prev) {
              triggerConfetti();
              return celebrationData;
            }
            return prev;
          });
        }
      )
      .subscribe((status) => {
        console.log('[NpsCelebration] Subscription status:', status);
      });

    return () => {
      console.log('[NpsCelebration] Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [staffId]);

  const triggerConfetti = () => {
    const count = 200;
    const defaults = {
      origin: { y: 0.7 },
      zIndex: 9999,
    };

    function fire(particleRatio: number, opts: confetti.Options) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      });
    }

    fire(0.25, { spread: 26, startVelocity: 55 });
    fire(0.2, { spread: 60 });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    fire(0.1, { spread: 120, startVelocity: 45 });
  };

  const handleClose = async () => {
    if (!currentCelebration) return;

    // Mark as seen
    await supabase
      .from("onboarding_nps_celebrations")
      .update({ seen_at: new Date().toISOString() })
      .eq("id", currentCelebration.celebrationId);

    // Remove from queue and show next
    setCelebrations(prev => {
      const remaining = prev.filter(c => c.celebrationId !== currentCelebration.celebrationId);
      
      if (remaining.length > 0) {
        setCurrentCelebration(remaining[0]);
        triggerConfetti();
      } else {
        setCurrentCelebration(null);
      }
      
      return remaining;
    });
  };

  if (!currentCelebration) return null;

  return (
    <AlertDialog open={!!currentCelebration} onOpenChange={() => handleClose()}>
      <AlertDialogContent className="max-w-lg border-2 border-yellow-400/50">
        <AlertDialogHeader className="text-center">
          <div className="flex justify-center gap-2 mb-2">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-lg shadow-yellow-400/30 animate-pulse">
              <Trophy className="h-12 w-12 text-white" />
            </div>
          </div>
          
          <AlertDialogTitle className="text-3xl flex items-center justify-center gap-2 text-yellow-500">
            <PartyPopper className="h-7 w-7" />
            <span>NPS NOTA 10!</span>
            <PartyPopper className="h-7 w-7" />
          </AlertDialogTitle>
          
          <AlertDialogDescription asChild>
            <div className="space-y-4 text-center">
              {/* Destaque do consultor */}
              <div className="py-4 px-6 bg-gradient-to-r from-primary/10 via-primary/20 to-primary/10 rounded-xl border border-primary/30">
                <p className="text-sm text-muted-foreground mb-1">Parabéns ao consultor</p>
                <p className="text-2xl font-bold text-primary">
                  🏆 {currentCelebration.consultantName} 🏆
                </p>
                <p className="text-sm text-muted-foreground mt-1">pela excelência no atendimento!</p>
              </div>
              
              <div className="bg-muted/50 border border-border rounded-lg p-4 space-y-3">
                <div className="flex justify-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-6 w-6 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                
                <p className="text-sm text-muted-foreground">
                  Cliente: <span className="font-semibold text-foreground">{currentCelebration.companyName}</span>
                </p>
                
                {currentCelebration.wouldRecommendWhy && (
                  <div className="pt-3 border-t border-border/50">
                    <p className="text-xs font-medium text-foreground mb-1 uppercase tracking-wide">Motivo da nota:</p>
                    <p className="text-sm text-muted-foreground italic">
                      "{currentCelebration.wouldRecommendWhy}"
                    </p>
                  </div>
                )}
                
                {currentCelebration.feedback && currentCelebration.feedback !== currentCelebration.wouldRecommendWhy && (
                  <div className="pt-3 border-t border-border/50">
                    <p className="text-xs font-medium text-foreground mb-1 uppercase tracking-wide">Comentário adicional:</p>
                    <p className="text-sm text-muted-foreground italic">
                      "{currentCelebration.feedback}"
                    </p>
                  </div>
                )}
              </div>
              
              <p className="text-base font-medium">
                🎉 Esse é o resultado de um trabalho incrível! 🎉
              </p>
              
              {celebrations.length > 1 && (
                <p className="text-xs text-muted-foreground">
                  +{celebrations.length - 1} celebração(ões) pendente(s)
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <AlertDialogFooter className="justify-center sm:justify-center">
          <AlertDialogAction onClick={handleClose} className="px-8 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white font-semibold">
            Celebrar! 🎊
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
