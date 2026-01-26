import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Image, Video, Smile, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CircleCreatePostProps {
  profile: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  };
  communityId?: string;
  onPostCreated?: () => void;
}

export function CircleCreatePost({ profile, communityId, onPostCreated }: CircleCreatePostProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  const createPostMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("circle_posts").insert({
        profile_id: profile.id,
        content,
        community_id: communityId || null,
        post_type: "regular",
      });

      if (error) throw error;

      // Add points for creating a post
      await supabase.rpc("circle_add_points", {
        p_profile_id: profile.id,
        p_action: "post_created",
        p_reference_type: "post",
        p_reference_id: null,
      });
    },
    onSuccess: () => {
      toast({ title: "Post publicado!" });
      setContent("");
      setIsExpanded(false);
      queryClient.invalidateQueries({ queryKey: ["circle-posts"] });
      onPostCreated?.();
    },
    onError: () => {
      toast({ title: "Erro ao publicar post", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!content.trim()) return;
    createPostMutation.mutate();
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={profile.avatar_url || undefined} />
            <AvatarFallback>
              {profile.display_name?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-3">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="O que você está pensando?"
              className="min-h-[60px] resize-none"
              onFocus={() => setIsExpanded(true)}
              rows={isExpanded ? 4 : 2}
            />

            {isExpanded && (
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" className="h-9 w-9" disabled>
                    <Image className="h-5 w-5 text-green-500" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9" disabled>
                    <Video className="h-5 w-5 text-red-500" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9" disabled>
                    <Smile className="h-5 w-5 text-yellow-500" />
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setIsExpanded(false);
                      setContent("");
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={!content.trim() || createPostMutation.isPending}
                  >
                    {createPostMutation.isPending ? "Publicando..." : "Publicar"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
