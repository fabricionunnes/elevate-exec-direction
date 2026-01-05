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
  const [staffId, setStaffId] = useState<string | null>(null);

  // Get current staff id
  useEffect(() => {
    const getStaffId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();

      if (staff) {
        setStaffId(staff.id);
      }
    };

    getStaffId();
  }, []);

  // Subscribe to NPS responses with score 10
  useEffect(() => {
    if (!staffId) return;

    const channel = supabase
      .channel('nps-celebration')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'onboarding_nps_responses',
        },
        async (payload) => {
          const newResponse = payload.new as any;
          
          // Only celebrate score 10
          if (newResponse.score !== 10) return;

          // Fetch project details with consultant name
          const { data: project } = await supabase
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

          if (!project) return;

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
      .subscribe();

    return () => {
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
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader className="text-center">
          <div className="flex justify-center gap-2 mb-4">
            <div className="h-16 w-16 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
              <Trophy className="h-10 w-10 text-yellow-500" />
            </div>
          </div>
          
          <AlertDialogTitle className="text-2xl flex items-center justify-center gap-2">
            <PartyPopper className="h-6 w-6 text-primary" />
            <span>NPS 10!</span>
            <PartyPopper className="h-6 w-6 text-primary" />
          </AlertDialogTitle>
          
          <AlertDialogDescription asChild>
            <div className="space-y-4 text-center">
              <p className="text-lg">
                <span className="font-bold text-primary">{celebration.consultantName}</span> acabou de receber uma nota 10!
              </p>
              
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
                <div className="flex justify-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                
                <p className="text-sm text-muted-foreground">
                  Cliente: <span className="font-semibold text-foreground">{celebration.companyName}</span>
                </p>
                
                {celebration.wouldRecommendWhy && (
                  <div className="pt-2 border-t border-border/50">
                    <p className="text-sm font-medium text-foreground mb-1">Motivo da nota:</p>
                    <p className="text-sm text-muted-foreground italic">
                      "{celebration.wouldRecommendWhy}"
                    </p>
                  </div>
                )}
                
                {celebration.feedback && (
                  <div className="pt-2 border-t border-border/50">
                    <p className="text-sm font-medium text-foreground mb-1">Comentário adicional:</p>
                    <p className="text-sm text-muted-foreground italic">
                      "{celebration.feedback}"
                    </p>
                  </div>
                )}
              </div>
              
              <p className="text-sm text-muted-foreground">
                🎉 Parabéns pelo excelente trabalho!
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <AlertDialogFooter className="justify-center sm:justify-center">
          <AlertDialogAction onClick={handleClose} className="px-8">
            Celebrar! 🎊
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
