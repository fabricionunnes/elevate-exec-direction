import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Send, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { NavLink } from "react-router-dom";

interface Comment {
  id: string;
  content: string;
  likes_count: number;
  created_at: string;
  profile: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  };
}

interface CircleCommentsSectionProps {
  postId: string;
  currentProfileId?: string;
}

export function CircleCommentsSection({ postId, currentProfileId }: CircleCommentsSectionProps) {
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState("");

  // Fetch comments
  const { data: comments } = useQuery({
    queryKey: ["circle-comments", postId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circle_comments")
        .select(`
          id,
          content,
          likes_count,
          created_at,
          profile:circle_profiles!circle_comments_profile_id_fkey(
            id,
            display_name,
            avatar_url
          )
        `)
        .eq("post_id", postId)
        .eq("is_active", true)
        .is("parent_id", null)
        .order("created_at", { ascending: true })
        .limit(10);

      if (error) throw error;
      return data as Comment[];
    },
  });

  // Create comment mutation
  const createCommentMutation = useMutation({
    mutationFn: async () => {
      if (!currentProfileId) throw new Error("Not authenticated");

      const { error } = await supabase.from("circle_comments").insert({
        post_id: postId,
        profile_id: currentProfileId,
        content: newComment,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      setNewComment("");
      queryClient.invalidateQueries({ queryKey: ["circle-comments", postId] });
      queryClient.invalidateQueries({ queryKey: ["circle-posts"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    createCommentMutation.mutate();
  };

  return (
    <div className="mt-4 pt-4 border-t space-y-4">
      {/* Comments List */}
      <div className="space-y-3">
        {comments?.map((comment) => (
          <div key={comment.id} className="flex gap-2">
            <NavLink to={`/circle/profile/${comment.profile.id}`}>
              <Avatar className="h-8 w-8">
                <AvatarImage src={comment.profile.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {comment.profile.display_name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </NavLink>

            <div className="flex-1">
              <div className="bg-muted rounded-lg px-3 py-2">
                <NavLink 
                  to={`/circle/profile/${comment.profile.id}`}
                  className="font-medium text-sm hover:underline"
                >
                  {comment.profile.display_name}
                </NavLink>
                <p className="text-sm">{comment.content}</p>
              </div>

              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span>
                  {formatDistanceToNow(new Date(comment.created_at), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </span>
                <button className="hover:text-foreground">Curtir</button>
                <button className="hover:text-foreground">Responder</button>
                {comment.likes_count > 0 && (
                  <span className="flex items-center gap-1">
                    <Heart className="h-3 w-3 fill-red-500 text-red-500" />
                    {comment.likes_count}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* New Comment Form */}
      {currentProfileId && (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Escreva um comentário..."
            className="flex-1"
          />
          <Button 
            type="submit" 
            size="icon"
            disabled={!newComment.trim() || createCommentMutation.isPending}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      )}
    </div>
  );
}
