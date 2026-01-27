import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CirclePostCard } from "@/components/circle/CirclePostCard";
import { CircleCreatePost } from "@/components/circle/CircleCreatePost";
import { CircleStoriesBar } from "@/components/circle/CircleStoriesBar";
import { CircleSidebar } from "@/components/circle/CircleSidebar";
import { CircleFeedGrid } from "@/components/circle/CircleFeedGrid";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LayoutGrid, List } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCircleCurrentProfile } from "@/hooks/useCircleCurrentProfile";

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

export default function CircleFeedPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  // Fetch (and ensure) current user's profile
  const { data: currentProfile } = useCircleCurrentProfile();

  // Fetch posts
  const { data: posts, isLoading: postsLoading } = useQuery({
    queryKey: ["circle-posts", activeTab],
    queryFn: async () => {
      let query = supabase
        .from("circle_posts")
        .select(`
          *,
          profile:circle_profiles!circle_posts_profile_id_fkey(
            id,
            display_name,
            avatar_url,
            company_name,
            role_title,
            current_level,
            level_name
          )
        `)
        .eq("is_active", true)
        .is("community_id", null)
        .order("created_at", { ascending: false })
        .limit(50);

      if (activeTab === "following" && currentProfile?.id) {
        // Get following IDs first
        const { data: following } = await supabase
          .from("circle_follows")
          .select("following_profile_id")
          .eq("follower_profile_id", currentProfile.id);
        
        const followingIds = following?.map(f => f.following_profile_id) || [];
        if (followingIds.length > 0) {
          query = query.in("profile_id", followingIds);
        } else {
          return [];
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CirclePost[];
    },
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
      return data.map(l => l.target_id);
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
        await supabase
          .from("circle_likes")
          .insert({
            profile_id: currentProfile.id,
            target_type: "post",
            target_id: postId,
          });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["circle-posts"] });
      queryClient.invalidateQueries({ queryKey: ["circle-user-likes"] });
    },
  });

  const handleLike = (postId: string) => {
    const isLiked = userLikes?.includes(postId) || false;
    likeMutation.mutate({ postId, isLiked });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Main Feed */}
      <div className="lg:col-span-8 space-y-6">
        {/* Stories Bar */}
        <CircleStoriesBar currentProfileId={currentProfile?.id} />

        {/* Create Post */}
        {currentProfile && (
          <CircleCreatePost 
            profile={currentProfile} 
            onPostCreated={() => queryClient.invalidateQueries({ queryKey: ["circle-posts"] })}
          />
        )}

        {/* Feed Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center gap-2">
            <TabsList className="flex-1">
              <TabsTrigger value="all" className="flex-1">Para Você</TabsTrigger>
              <TabsTrigger value="following" className="flex-1">Seguindo</TabsTrigger>
            </TabsList>
            <div className="flex gap-1 bg-muted rounded-lg p-1">
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <TabsContent value={activeTab} className="space-y-4 mt-4">
            {postsLoading ? (
              <>
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
                    <div className="flex gap-4">
                      <Skeleton className="h-8 w-16" />
                      <Skeleton className="h-8 w-16" />
                      <Skeleton className="h-8 w-16" />
                    </div>
                  </div>
                ))}
              </>
            ) : posts && posts.length > 0 ? (
              viewMode === "grid" ? (
                <CircleFeedGrid
                  posts={posts}
                  userLikes={userLikes || []}
                  currentProfileId={currentProfile?.id}
                  onLike={handleLike}
                />
              ) : (
                posts.map((post) => (
                  <CirclePostCard
                    key={post.id}
                    post={post}
                    isLiked={userLikes?.includes(post.id) || false}
                    onLike={() => handleLike(post.id)}
                    currentProfileId={currentProfile?.id}
                  />
                ))
              )
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>Nenhum post encontrado.</p>
                <p className="text-sm mt-1">Seja o primeiro a compartilhar algo!</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Sidebar - Hidden on mobile */}
      <div className="hidden lg:block lg:col-span-4">
        <CircleSidebar currentProfileId={currentProfile?.id} />
      </div>
    </div>
  );
}
