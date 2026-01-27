import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TestimonialCardProps {
  testimonial: {
    id: string;
    content: string;
    image_url?: string | null;
    created_at: string;
    author_profile_id: string;
    recipient_profile_id: string;
    author?: {
      id: string;
      display_name: string;
      avatar_url: string | null;
      company_name: string | null;
    };
  };
  currentProfileId?: string;
  isOwnProfile?: boolean;
}

export function TestimonialCard({ testimonial, currentProfileId, isOwnProfile }: TestimonialCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // User can delete if they are the author OR the recipient (profile owner)
  const canDelete = currentProfileId && (
    currentProfileId === testimonial.author_profile_id ||
    currentProfileId === testimonial.recipient_profile_id
  );

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("circle_testimonials")
        .delete()
        .eq("id", testimonial.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Depoimento excluído" });
      queryClient.invalidateQueries({ queryKey: ["circle-profile-testimonials"] });
      setDeleteDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Erro ao excluir depoimento", variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar>
            <AvatarImage src={testimonial.author?.avatar_url || undefined} />
            <AvatarFallback>
              {testimonial.author?.display_name?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{testimonial.author?.display_name}</p>
                <p className="text-sm text-muted-foreground">
                  {testimonial.author?.company_name}
                </p>
              </div>
              {canDelete && (
                <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir depoimento?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação não pode ser desfeita. O depoimento será removido permanentemente.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate()}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
            <p className="mt-2">{testimonial.content}</p>
            {testimonial.image_url && (
              <img 
                src={testimonial.image_url} 
                alt="Testimonial" 
                className="mt-3 rounded-lg max-h-48 object-cover"
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
      </CardContent>
    </Card>
  );
}
