import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CirclePostCard } from "@/components/circle/CirclePostCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Bookmark } from "lucide-react";
import { useCircleCurrentProfile } from "@/hooks/useCircleCurrentProfile";

interface SavedPost {
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

export default function CircleSavedPostsPage() {
  const queryClient = useQueryClient();
  const { data: currentProfile } = useCircleCurrentProfile();

  // Fetch saved posts
  const { data: savedPosts, isLoading } = useQuery({
    queryKey: ["circle-saved-posts", currentProfile?.id],
    queryFn: async () => {
      if (!currentProfile?.id) return [];

      const { data, error } = await supabase
        .from("circle_saved_posts")
        .select(`
          post:circle_posts(
            id,
            profile_id,
            content,
            media_urls,
            media_type,
            post_type,
            likes_count,
            comments_count,
            shares_count,
            created_at,
            profile:circle_profiles!circle_posts_profile_id_fkey(
              id,
              display_name,
              avatar_url,
              company_name,
              role_title,
              current_level,
              level_name
            )
          )
        `)
        .eq("profile_id", currentProfile.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data
        .map((item: any) => item.post)
        .filter((post: any) => post !== null) as SavedPost[];
    },
    enabled: !!currentProfile?.id,
  });

  // Fetch user's likes
  const { data: userLikes } = useQuery({
    queryKey: ["circle-user-likes", currentProfile?.id],
    queryFn: async () => {
      if (!currentProfile?.id) return [];

      const { data, error } = await supabase
        .from("circle_likes")
        .select("target_id")
        .eq("profile_id", currentProfile.id)
        .eq("target_type", "post");

      if (error) throw error;
      return data.map((l) => l.target_id);
    },
    enabled: !!currentProfile?.id,
  });

  // Like mutation
  const likeMutation = useMutation({
    mutationFn: async ({ postId, isLiked }: { postId: string; isLiked: boolean }) => {
      if (!currentProfile?.id) throw new Error("Not authenticated");

      if (isLiked) {
        await supabase
          .from("circle_likes")
          .delete()
          .eq("profile_id", currentProfile.id)
          .eq("target_type", "post")
          .eq("target_id", postId);
      } else {
        await supabase.from("circle_likes").insert({
          profile_id: currentProfile.id,
          target_type: "post",
          target_id: postId,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["circle-saved-posts"] });
      queryClient.invalidateQueries({ queryKey: ["circle-user-likes"] });
    },
  });

  const handleLike = (postId: string) => {
    const isLiked = userLikes?.includes(postId) || false;
    likeMutation.mutate({ postId, isLiked });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Bookmark className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Posts Salvos</h1>
          <p className="text-sm text-muted-foreground">
            {savedPosts?.length || 0} posts salvos
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card rounded-xl p-4 space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-20 w-full" />
            </div>
          ))}
        </div>
      ) : savedPosts && savedPosts.length > 0 ? (
        <div className="space-y-4">
          {savedPosts.map((post) => (
            <CirclePostCard
              key={post.id}
              post={post}
              isLiked={userLikes?.includes(post.id) || false}
              onLike={() => handleLike(post.id)}
              currentProfileId={currentProfile?.id}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <Bookmark className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum post salvo ainda.</p>
          <p className="text-sm mt-1">
            Salve posts clicando no ícone de bookmark!
          </p>
        </div>
      )}
    </div>
  );
}
