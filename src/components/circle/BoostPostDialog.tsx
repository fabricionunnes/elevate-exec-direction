import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Rocket, AlertCircle, CheckCircle, Zap, Star, Crown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface BoostPostDialogProps {
  postId: string;
  profileId: string;
  trigger?: React.ReactNode;
}

const BOOST_TYPES = [
  {
    value: "visibility",
    label: "Visibilidade",
    description: "Seu post aparece mais no feed por 24h",
    icon: Zap,
    color: "text-blue-500",
  },
  {
    value: "highlight",
    label: "Destaque",
    description: "Post destacado com badge especial por 48h",
    icon: Star,
    color: "text-yellow-500",
  },
  {
    value: "featured",
    label: "Impulsionado",
    description: "Maior alcance + badge premium por 72h",
    icon: Crown,
    color: "text-purple-500",
  },
];

export function BoostPostDialog({ postId, profileId, trigger }: BoostPostDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState("visibility");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check if user can boost
  const { data: canBoostData, isLoading: checkingPermission } = useQuery({
    queryKey: ["circle-can-boost", profileId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("can_user_boost", {
        check_profile_id: profileId,
      });

      if (error) throw error;
      return data as { allowed: boolean; reason?: string; remaining?: number; required?: number; current?: number };
    },
    enabled: open && !!profileId,
  });

  // Get boost config
  const { data: boostConfig } = useQuery({
    queryKey: ["circle-boost-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circle_boost_config")
        .select("*")
        .limit(1)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Create boost mutation
  const boostMutation = useMutation({
    mutationFn: async () => {
      const durationHours = boostConfig?.boost_duration_hours || 48;
      const endAt = new Date();
      endAt.setHours(endAt.getHours() + durationHours);

      const { error } = await supabase.from("circle_boosts").insert({
        profile_id: profileId,
        post_id: postId,
        boost_type: selectedType,
        end_at: endAt.toISOString(),
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Post impulsionado com sucesso! 🚀" });
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["circle-posts"] });
      queryClient.invalidateQueries({ queryKey: ["circle-can-boost"] });
    },
    onError: (error) => {
      console.error("Boost error:", error);
      toast({ title: "Erro ao impulsionar post", variant: "destructive" });
    },
  });

  const getReasonMessage = (reason?: string) => {
    switch (reason) {
      case "trust_score":
        return `Seu Trust Score (${canBoostData?.current}) está abaixo do mínimo (${canBoostData?.required})`;
      case "limit_reached":
        return "Você atingiu o limite mensal de boosts";
      default:
        return "Você não pode impulsionar posts no momento";
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="gap-1">
            <Rocket className="h-4 w-4" />
            Impulsionar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5" />
            Impulsionar Post
          </DialogTitle>
          <DialogDescription>
            Aumente o alcance do seu post para mais pessoas verem
          </DialogDescription>
        </DialogHeader>

        {checkingPermission ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : !canBoostData?.allowed ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-destructive/10 rounded-lg">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Não disponível</p>
                <p className="text-sm text-muted-foreground">
                  {getReasonMessage(canBoostData?.reason)}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg">
              <CheckCircle className="h-5 w-5 text-primary" />
              <span className="text-sm">
                Você tem <strong>{canBoostData.remaining}</strong> boost(s) restante(s) este mês
              </span>
            </div>

            <RadioGroup value={selectedType} onValueChange={setSelectedType} className="space-y-3">
              {BOOST_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <div key={type.value}>
                    <RadioGroupItem
                      value={type.value}
                      id={type.value}
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor={type.value}
                      className={cn(
                        "flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all",
                        "hover:bg-muted/50",
                        selectedType === type.value
                          ? "border-primary bg-primary/5"
                          : "border-muted"
                      )}
                    >
                      <Icon className={cn("h-5 w-5 mt-0.5", type.color)} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{type.label}</span>
                          {type.value === "featured" && (
                            <Badge variant="secondary" className="text-xs">Popular</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{type.description}</p>
                      </div>
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">
                Cancelar
              </Button>
              <Button
                onClick={() => boostMutation.mutate()}
                disabled={boostMutation.isPending}
                className="flex-1"
              >
                {boostMutation.isPending ? "Impulsionando..." : "Impulsionar 🚀"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
