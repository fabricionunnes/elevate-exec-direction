import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, MessageCircle, Bookmark, Share2, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface StoryInteractionsProps {
  storyId: string;
  storyOwnerId: string;
  currentProfileId: string | undefined;
  onPause: () => void;
  onResume: () => void;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  profile: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  };
}

export function StoryInteractions({
  storyId,
  storyOwnerId,
  currentProfileId,
  onPause,
  onResume,
}: StoryInteractionsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");

  // Check if liked
  const { data: isLiked } = useQuery({
    queryKey: ["circle-story-liked", storyId, currentProfileId],
    queryFn: async () => {
      if (!currentProfileId) return false;
      const { data } = await supabase
        .from("circle_likes")
        .select("id")
        .eq("profile_id", currentProfileId)
        .eq("target_type", "story")
        .eq("target_id", storyId)
        .maybeSingle();
      return !!data;
    },
    enabled: !!currentProfileId,
  });

  // Check if saved
  const { data: isSaved } = useQuery({
    queryKey: ["circle-story-saved", storyId, currentProfileId],
    queryFn: async () => {
      if (!currentProfileId) return false;
      const { data } = await supabase
        .from("circle_saved_stories")
        .select("id")
        .eq("profile_id", currentProfileId)
        .eq("story_id", storyId)
        .maybeSingle();
      return !!data;
    },
    enabled: !!currentProfileId,
  });

  // Fetch comments
  const { data: comments } = useQuery({
    queryKey: ["circle-story-comments", storyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circle_story_comments")
        .select(`
          id,
          content,
          created_at,
          profile:circle_profiles!circle_story_comments_profile_id_fkey(
            id,
            display_name,
            avatar_url
          )
        `)
        .eq("story_id", storyId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as Comment[];
    },
    enabled: showComments,
  });

  // Like mutation
  const likeMutation = useMutation({
    mutationFn: async () => {
      if (!currentProfileId) throw new Error("Not authenticated");

      if (isLiked) {
        await supabase
          .from("circle_likes")
          .delete()
          .eq("profile_id", currentProfileId)
          .eq("target_type", "story")
          .eq("target_id", storyId);
      } else {
        await supabase.from("circle_likes").insert({
          profile_id: currentProfileId,
          target_type: "story",
          target_id: storyId,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["circle-story-liked", storyId] });
    },
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentProfileId) throw new Error("Not authenticated");

      if (isSaved) {
        await supabase
          .from("circle_saved_stories")
          .delete()
          .eq("profile_id", currentProfileId)
          .eq("story_id", storyId);
      } else {
        await supabase.from("circle_saved_stories").insert({
          profile_id: currentProfileId,
          story_id: storyId,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["circle-story-saved", storyId] });
      toast({
        title: isSaved ? "Story removido dos salvos" : "Story salvo!",
      });
    },
  });

  // Comment mutation
  const commentMutation = useMutation({
    mutationFn: async () => {
      if (!currentProfileId) throw new Error("Not authenticated");

      const { error } = await supabase.from("circle_story_comments").insert({
        story_id: storyId,
        profile_id: currentProfileId,
        content: newComment,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      setNewComment("");
      queryClient.invalidateQueries({ queryKey: ["circle-story-comments", storyId] });
      toast({ title: "Comentário enviado!" });
    },
  });

  // Share function
  const handleShare = async () => {
    try {
      await navigator.share({
        title: "Story do UNV Circle",
        url: window.location.href,
      });
    } catch {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      toast({ title: "Link copiado!" });
    }
  };

  const handleToggleComments = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!showComments) {
      onPause();
      setShowComments(true);
    } else {
      setShowComments(false);
      onResume();
    }
  };

  return (
    <>
      {/* Interaction buttons */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-3 z-20">
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "rounded-full bg-black/30 text-white hover:bg-black/50",
            isLiked && "text-red-500"
          )}
          onClick={(e) => {
            e.stopPropagation();
            likeMutation.mutate();
          }}
        >
          <Heart className={cn("h-6 w-6", isLiked && "fill-current")} />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="rounded-full bg-black/30 text-white hover:bg-black/50"
          onClick={handleToggleComments}
        >
          <MessageCircle className="h-6 w-6" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="rounded-full bg-black/30 text-white hover:bg-black/50"
          onClick={(e) => {
            e.stopPropagation();
            handleShare();
          }}
        >
          <Share2 className="h-6 w-6" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "rounded-full bg-black/30 text-white hover:bg-black/50",
            isSaved && "text-yellow-500"
          )}
          onClick={(e) => {
            e.stopPropagation();
            saveMutation.mutate();
          }}
        >
          <Bookmark className={cn("h-6 w-6", isSaved && "fill-current")} />
        </Button>
      </div>

      {/* Comments panel */}
      {showComments && (
        <div
          className="absolute inset-0 bg-black/80 z-30 flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-white/20">
            <h3 className="text-white font-medium">Comentários</h3>
            <Button
              variant="ghost"
              size="icon"
              className="text-white"
              onClick={handleToggleComments}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {comments?.length === 0 ? (
              <p className="text-white/70 text-center py-8">Nenhum comentário ainda</p>
            ) : (
              comments?.map((comment) => (
                <div key={comment.id} className="flex gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={comment.profile.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {comment.profile.display_name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-white text-sm">
                      <span className="font-medium">{comment.profile.display_name}</span>{" "}
                      {comment.content}
                    </p>
                    <p className="text-white/50 text-xs mt-1">
                      {formatDistanceToNow(new Date(comment.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {currentProfileId && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newComment.trim()) {
                  commentMutation.mutate();
                }
              }}
              className="p-4 border-t border-white/20 flex gap-2"
            >
              <Input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Adicionar comentário..."
                className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/50"
              />
              <Button type="submit" size="icon" disabled={!newComment.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          )}
        </div>
      )}
    </>
  );
}
