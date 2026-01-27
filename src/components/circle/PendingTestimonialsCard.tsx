import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Award, Check, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { NavLink } from "react-router-dom";

interface PendingTestimonial {
  id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  author: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    company_name: string | null;
  } | null;
}

interface PendingTestimonialsCardProps {
  profileId: string;
}

export function PendingTestimonialsCard({ profileId }: PendingTestimonialsCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pendingTestimonials, isLoading } = useQuery({
    queryKey: ["circle-pending-testimonials", profileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circle_testimonials")
        .select(`
          id,
          content,
          image_url,
          created_at,
          author:circle_profiles!circle_testimonials_author_profile_id_fkey(
            id,
            display_name,
            avatar_url,
            company_name
          )
        `)
        .eq("recipient_profile_id", profileId)
        .eq("is_approved", false)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as PendingTestimonial[];
    },
    enabled: !!profileId,
  });

  const approveMutation = useMutation({
    mutationFn: async (testimonialId: string) => {
      const { error } = await supabase
        .from("circle_testimonials")
        .update({ is_approved: true })
        .eq("id", testimonialId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Depoimento aprovado!" });
      queryClient.invalidateQueries({ queryKey: ["circle-pending-testimonials"] });
      queryClient.invalidateQueries({ queryKey: ["circle-profile-testimonials"] });
    },
    onError: () => {
      toast({ title: "Erro ao aprovar depoimento", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (testimonialId: string) => {
      const { error } = await supabase
        .from("circle_testimonials")
        .update({ is_active: false })
        .eq("id", testimonialId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Depoimento rejeitado" });
      queryClient.invalidateQueries({ queryKey: ["circle-pending-testimonials"] });
    },
    onError: () => {
      toast({ title: "Erro ao rejeitar depoimento", variant: "destructive" });
    },
  });

  if (isLoading || !pendingTestimonials || pendingTestimonials.length === 0) {
    return null;
  }

  return (
    <Card className="border-orange-500/30 bg-orange-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Award className="h-5 w-5 text-orange-500" />
          Depoimentos Pendentes ({pendingTestimonials.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {pendingTestimonials.map((testimonial) => (
          <div key={testimonial.id} className="bg-background rounded-lg p-4 border">
            <div className="flex items-start gap-3">
              <NavLink to={`/circle/profile/${testimonial.author?.id}`}>
                <Avatar>
                  <AvatarImage src={testimonial.author?.avatar_url || undefined} />
                  <AvatarFallback>
                    {testimonial.author?.display_name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </NavLink>
              <div className="flex-1 min-w-0">
                <NavLink 
                  to={`/circle/profile/${testimonial.author?.id}`}
                  className="font-medium hover:underline"
                >
                  {testimonial.author?.display_name}
                </NavLink>
                {testimonial.author?.company_name && (
                  <p className="text-sm text-muted-foreground">
                    {testimonial.author.company_name}
                  </p>
                )}
                <p className="mt-2 text-sm">{testimonial.content}</p>
                {testimonial.image_url && (
                  <img
                    src={testimonial.image_url}
                    alt="Testimonial"
                    className="mt-2 rounded-lg max-h-40 object-cover"
                  />
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  {formatDistanceToNow(new Date(testimonial.created_at), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-3 justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => rejectMutation.mutate(testimonial.id)}
                disabled={rejectMutation.isPending || approveMutation.isPending}
              >
                <X className="h-4 w-4 mr-1" />
                Rejeitar
              </Button>
              <Button
                size="sm"
                onClick={() => approveMutation.mutate(testimonial.id)}
                disabled={approveMutation.isPending || rejectMutation.isPending}
              >
                <Check className="h-4 w-4 mr-1" />
                Aprovar
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
