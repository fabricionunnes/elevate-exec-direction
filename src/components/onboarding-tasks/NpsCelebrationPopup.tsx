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
  id: string;
  consultantName: string;
  companyName: string;
  feedback: string;
  wouldRecommendWhy: string;
}

export const NpsCelebrationPopup = () => {
  const [celebration, setCelebration] = useState<CelebrationData | null>(null);

  // Subscribe to NPS responses with score 10 immediately
  useEffect(() => {
    console.log('[NpsCelebration] Setting up realtime subscription');
    
    const channel = supabase
      .channel('nps-celebration-global')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'onboarding_nps_responses',
        },
        async (payload) => {
          console.log('[NpsCelebration] Received NPS response:', payload);
          const newResponse = payload.new as any;
          
          // Only celebrate score 10
          if (newResponse.score !== 10) {
            console.log('[NpsCelebration] Score is not 10, ignoring');
            return;
          }

          console.log('[NpsCelebration] Score is 10! Fetching project details...');

          // Fetch project details with consultant name
          const { data: project, error } = await supabase
            .from("onboarding_projects")
            .select(`
              id,
              consultant_id,
              cs_id,
              onboarding_company_id,
              onboarding_companies(name),
              consultant:onboarding_staff!onboarding_projects_consultant_id_fkey(name),
              cs:onboarding_staff!onboarding_projects_cs_id_fkey(name)
            `)
            .eq("id", newResponse.project_id)
            .single();

          if (error) {
            console.error('[NpsCelebration] Error fetching project:', error);
            return;
          }

          if (!project) {
            console.log('[NpsCelebration] Project not found');
            return;
          }

          console.log('[NpsCelebration] Project details:', project);

          const consultantName = (project.consultant as any)?.name || (project.cs as any)?.name || "Consultor";
          const companyName = (project.onboarding_companies as any)?.name || "Cliente";

          setCelebration({
            id: newResponse.id,
            consultantName,
            companyName,
            feedback: newResponse.feedback || "",
            wouldRecommendWhy: newResponse.would_recommend_why || "",
          });

          // Trigger confetti effect
          triggerConfetti();
        }
      )
      .subscribe((status) => {
        console.log('[NpsCelebration] Subscription status:', status);
      });

    return () => {
      console.log('[NpsCelebration] Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, []);

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

    fire(0.25, {
      spread: 26,
      startVelocity: 55,
    });
    fire(0.2, {
      spread: 60,
    });
    fire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 0.8,
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 1.2,
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 45,
    });
  };

  const handleClose = () => {
    setCelebration(null);
  };

  if (!celebration) return null;

  return (
    <AlertDialog open={!!celebration} onOpenChange={() => handleClose()}>
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
                  🏆 {celebration.consultantName} 🏆
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
                  Cliente: <span className="font-semibold text-foreground">{celebration.companyName}</span>
                </p>
                
                {celebration.wouldRecommendWhy && (
                  <div className="pt-3 border-t border-border/50">
                    <p className="text-xs font-medium text-foreground mb-1 uppercase tracking-wide">Motivo da nota:</p>
                    <p className="text-sm text-muted-foreground italic">
                      "{celebration.wouldRecommendWhy}"
                    </p>
                  </div>
                )}
                
                {celebration.feedback && celebration.feedback !== celebration.wouldRecommendWhy && (
                  <div className="pt-3 border-t border-border/50">
                    <p className="text-xs font-medium text-foreground mb-1 uppercase tracking-wide">Comentário adicional:</p>
                    <p className="text-sm text-muted-foreground italic">
                      "{celebration.feedback}"
                    </p>
                  </div>
                )}
              </div>
              
              <p className="text-base font-medium">
                🎉 Esse é o resultado de um trabalho incrível! 🎉
              </p>
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
