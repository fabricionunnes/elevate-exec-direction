import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MediaUpload } from "./MediaUpload";

interface MediaFile {
  url: string;
  type: "image" | "video";
}

interface CommunityPostFormProps {
  communityId: string;
  communitySlug: string;
  currentProfile: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  };
}

export function CommunityPostForm({ communityId, communitySlug, currentProfile }: CommunityPostFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [media, setMedia] = useState<MediaFile[]>([]);

  const createPostMutation = useMutation({
    mutationFn: async () => {
      if (!currentProfile?.id || !communityId) throw new Error("Not authenticated");

      const mediaUrls = media.map(m => m.url);
      const mediaType = media.length > 0 
        ? (media.some(m => m.type === "video") ? "video" : "image")
        : null;

      const { error } = await supabase.from("circle_posts").insert({
        community_id: communityId,
        profile_id: currentProfile.id,
        content: content.trim() || null,
        media_urls: mediaUrls.length > 0 ? mediaUrls : null,
        media_type: mediaType,
        post_type: "text",
      });

      if (error) throw error;

      // Update posts count manually
      const { data: communityData } = await supabase
        .from("circle_communities")
        .select("posts_count")
        .eq("id", communityId)
        .single();

      if (communityData) {
        await supabase
          .from("circle_communities")
          .update({ posts_count: (communityData.posts_count || 0) + 1 })
          .eq("id", communityId);
      }
    },
    onSuccess: () => {
      toast({ title: "Post publicado!" });
      setContent("");
      setMedia([]);
      queryClient.invalidateQueries({ queryKey: ["circle-community-posts"] });
      queryClient.invalidateQueries({ queryKey: ["circle-community", communitySlug] });
    },
    onError: (error) => {
      console.error("Error creating post:", error);
      toast({ title: "Erro ao publicar", description: "Tente novamente", variant: "destructive" });
    },
  });

  const canSubmit = (content.trim().length > 0 || media.length > 0) && !createPostMutation.isPending;

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={currentProfile?.avatar_url || undefined} />
            <AvatarFallback>
              {currentProfile?.display_name?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-3">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Compartilhe algo com a comunidade..."
              className="min-h-[80px]"
            />
            
            <MediaUpload
              media={media}
              onMediaChange={setMedia}
              maxFiles={4}
              folder={`community-posts/${communityId}`}
              disabled={createPostMutation.isPending}
            />
            
            <div className="flex justify-end">
              <Button
                onClick={() => createPostMutation.mutate()}
                disabled={!canSubmit}
                size="sm"
              >
                {createPostMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Publicando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Publicar
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
