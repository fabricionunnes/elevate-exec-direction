import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Play, Images } from "lucide-react";
import { cn } from "@/lib/utils";
import { CirclePhotoModal } from "./CirclePhotoModal";
import { useToast } from "@/hooks/use-toast";

interface CirclePost {
  id: string;
  profile_id: string;
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
}

interface CircleFeedGridProps {
  posts: CirclePost[];
  userLikes: string[];
  currentProfileId?: string;
  onLike: (postId: string) => void;
}

export function CircleFeedGrid({ posts, userLikes, currentProfileId, onLike }: CircleFeedGridProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPost, setSelectedPost] = useState<CirclePost | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Filter posts with media only
  const postsWithMedia = posts.filter(post => post.media_urls && post.media_urls.length > 0);

  // Check if selected post is saved
  const { data: isSaved } = useQuery({
    queryKey: ["circle-post-saved", selectedPost?.id, currentProfileId],
    queryFn: async () => {
      if (!currentProfileId || !selectedPost) return false;
      const { data } = await supabase
        .from("circle_saved_posts")
        .select("id")
        .eq("profile_id", currentProfileId)
        .eq("post_id", selectedPost.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!currentProfileId && !!selectedPost,
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentProfileId || !selectedPost) throw new Error("Not authenticated");

      if (isSaved) {
        await supabase
          .from("circle_saved_posts")
          .delete()
          .eq("profile_id", currentProfileId)
          .eq("post_id", selectedPost.id);
      } else {
        await supabase.from("circle_saved_posts").insert({
          profile_id: currentProfileId,
          post_id: selectedPost.id,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["circle-post-saved", selectedPost?.id] });
      toast({
        title: isSaved ? "Removido dos salvos" : "Post salvo!",
      });
    },
  });

  const handleShare = async () => {
    if (!selectedPost) return;
    const shareUrl = `${window.location.origin}/circle/post/${selectedPost.id}`;
    try {
      await navigator.share({
        title: `Post de ${selectedPost.profile.display_name}`,
        text: selectedPost.content || "Confira este post no UNV Circle",
        url: shareUrl,
      });
    } catch {
      navigator.clipboard.writeText(shareUrl);
      toast({ title: "Link copiado!" });
    }
  };

  const openPost = (post: CirclePost, imageIndex: number = 0) => {
    setSelectedPost(post);
    setSelectedImageIndex(imageIndex);
  };

  return (
    <>
      <div className="grid grid-cols-3 gap-1">
        {postsWithMedia.map((post) => (
          <button
            key={post.id}
            onClick={() => openPost(post)}
            className="relative group cursor-pointer overflow-hidden bg-muted"
          >
            <AspectRatio ratio={1}>
              {post.media_type === "video" ? (
                <>
                  <video
                    src={post.media_urls![0]}
                    className="w-full h-full object-cover"
                    muted
                  />
                  <div className="absolute top-2 right-2">
                    <Play className="h-5 w-5 text-white drop-shadow-lg fill-white" />
                  </div>
                </>
              ) : (
                <>
                  <img
                    src={post.media_urls![0]}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  {post.media_urls!.length > 1 && (
                    <div className="absolute top-2 right-2">
                      <Images className="h-5 w-5 text-white drop-shadow-lg" />
                    </div>
                  )}
                </>
              )}
            </AspectRatio>

            {/* Hover Overlay */}
            <div className={cn(
              "absolute inset-0 bg-black/50 flex items-center justify-center gap-4",
              "opacity-0 group-hover:opacity-100 transition-opacity"
            )}>
              <div className="flex items-center gap-1 text-white font-semibold">
                <span>❤️</span>
                <span>{post.likes_count}</span>
              </div>
              <div className="flex items-center gap-1 text-white font-semibold">
                <span>💬</span>
                <span>{post.comments_count}</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {selectedPost && (
        <CirclePhotoModal
          open={!!selectedPost}
          onOpenChange={(open) => !open && setSelectedPost(null)}
          post={selectedPost}
          selectedImageIndex={selectedImageIndex}
          isLiked={userLikes.includes(selectedPost.id)}
          isSaved={isSaved || false}
          onLike={() => onLike(selectedPost.id)}
          onSave={() => saveMutation.mutate()}
          onShare={handleShare}
          onComment={() => {
            setSelectedPost(null);
            // Could navigate to post detail or open comments
          }}
        />
      )}
    </>
  );
}
