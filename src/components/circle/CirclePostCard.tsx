import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  Heart, 
  MessageSquare, 
  Share2, 
  Bookmark, 
  MoreHorizontal,
  Star
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { NavLink } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CircleCommentsSection } from "./CircleCommentsSection";
import { useToast } from "@/hooks/use-toast";

interface CirclePostCardProps {
  post: {
    id: string;
    content: string | null;
    media_urls: string[] | null;
    media_type: string | null;
    post_type: string;
    likes_count: number;
    comments_count: number;
    shares_count: number;
    created_at: string;
    profile: {
      id: string;
      display_name: string;
      avatar_url: string | null;
      company_name: string | null;
      role_title: string | null;
      current_level: number;
      level_name: string;
    };
  };
  isLiked: boolean;
  onLike: () => void;
  currentProfileId?: string;
}

export function CirclePostCard({ post, isLiked, onLike, currentProfileId }: CirclePostCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showComments, setShowComments] = useState(false);
  const [localLikesCount, setLocalLikesCount] = useState(post.likes_count);
  const [localIsLiked, setLocalIsLiked] = useState(isLiked);

  // Check if post is saved
  const { data: isSaved } = useQuery({
    queryKey: ["circle-post-saved", post.id, currentProfileId],
    queryFn: async () => {
      if (!currentProfileId) return false;
      const { data } = await supabase
        .from("circle_saved_posts")
        .select("id")
        .eq("profile_id", currentProfileId)
        .eq("post_id", post.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!currentProfileId,
  });

  const handleLike = () => {
    setLocalIsLiked(!localIsLiked);
    setLocalLikesCount(prev => localIsLiked ? prev - 1 : prev + 1);
    onLike();
  };

  // Save/unsave mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentProfileId) throw new Error("Not authenticated");

      if (isSaved) {
        await supabase
          .from("circle_saved_posts")
          .delete()
          .eq("profile_id", currentProfileId)
          .eq("post_id", post.id);
      } else {
        await supabase.from("circle_saved_posts").insert({
          profile_id: currentProfileId,
          post_id: post.id,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["circle-post-saved", post.id] });
      toast({
        title: isSaved ? "Removido dos salvos" : "Post salvo!",
      });
    },
  });

  // Share function
  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/circle/post/${post.id}`;
    try {
      await navigator.share({
        title: `Post de ${post.profile.display_name}`,
        text: post.content || "Confira este post no UNV Circle",
        url: shareUrl,
      });
    } catch {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(shareUrl);
      toast({ title: "Link copiado!" });
    }
  };

  const isOwnPost = currentProfileId === post.profile.id;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <NavLink 
            to={`/circle/profile/${post.profile.id}`}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <Avatar className="h-10 w-10">
              <AvatarImage src={post.profile.avatar_url || undefined} />
              <AvatarFallback>
                {post.profile.display_name?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm">{post.profile.display_name}</p>
                <Badge variant="secondary" className="text-xs py-0">
                  <Star className="h-3 w-3 mr-1" />
                  {post.profile.current_level}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {post.profile.role_title && post.profile.company_name
                  ? `${post.profile.role_title} • ${post.profile.company_name}`
                  : post.profile.company_name || post.profile.level_name}
                {" • "}
                {formatDistanceToNow(new Date(post.created_at), {
                  addSuffix: true,
                  locale: ptBR,
                })}
              </p>
            </div>
          </NavLink>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => saveMutation.mutate()}>
                <Bookmark className={cn("h-4 w-4 mr-2", isSaved && "fill-current")} />
                {isSaved ? "Remover dos salvos" : "Salvar"}
              </DropdownMenuItem>
              {isOwnPost ? (
                <>
                  <DropdownMenuItem>Editar</DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive">Excluir</DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem className="text-destructive">Denunciar</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Content */}
        {post.content && (
          <p className="text-sm whitespace-pre-wrap mb-3">{post.content}</p>
        )}

        {/* Media */}
        {post.media_urls && post.media_urls.length > 0 && (
          <div className={cn(
            "grid gap-2 mb-3 rounded-lg overflow-hidden",
            post.media_urls.length === 1 && "grid-cols-1",
            post.media_urls.length === 2 && "grid-cols-2",
            post.media_urls.length >= 3 && "grid-cols-2"
          )}>
            {post.media_urls.slice(0, 4).map((url, index) => (
              <div
                key={index}
                className={cn(
                  "relative aspect-square bg-muted",
                  post.media_urls!.length === 1 && "aspect-video",
                  post.media_urls!.length === 3 && index === 0 && "row-span-2 aspect-auto"
                )}
              >
                {post.media_type === "video" ? (
                  <video
                    src={url}
                    className="w-full h-full object-cover"
                    controls
                  />
                ) : (
                  <img
                    src={url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                )}
                {post.media_urls!.length > 4 && index === 3 && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="text-white text-2xl font-bold">
                      +{post.media_urls!.length - 4}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Achievement Badge */}
        {post.post_type === "achievement" && (
          <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-lg p-3 mb-3">
            <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
              🏆 Conquista desbloqueada!
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "gap-2",
                localIsLiked && "text-red-500"
              )}
              onClick={handleLike}
            >
              <Heart className={cn("h-4 w-4", localIsLiked && "fill-current")} />
              <span>{localLikesCount}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={() => setShowComments(!showComments)}
            >
              <MessageSquare className="h-4 w-4" />
              <span>{post.comments_count}</span>
            </Button>

            <Button 
              variant="ghost" 
              size="sm" 
              className="gap-2"
              onClick={handleShare}
            >
              <Share2 className="h-4 w-4" />
              <span>{post.shares_count}</span>
            </Button>
          </div>

          <Button 
            variant="ghost" 
            size="icon" 
            className={cn("h-8 w-8", isSaved && "text-primary")}
            onClick={() => saveMutation.mutate()}
          >
            <Bookmark className={cn("h-4 w-4", isSaved && "fill-current")} />
          </Button>
        </div>

        {/* Comments Section */}
        {showComments && (
          <CircleCommentsSection
            postId={post.id}
            currentProfileId={currentProfileId}
          />
        )}
      </CardContent>
    </Card>
  );
}
