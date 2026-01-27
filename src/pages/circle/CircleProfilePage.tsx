import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Settings, 
  UserPlus, 
  UserMinus,
  MessageSquare,
  Heart,
  Award,
  Star,
  Calendar,
  Building,
  Briefcase,
  Edit,
  Store,
  Users
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CirclePostCard } from "@/components/circle/CirclePostCard";
import { useCircleCurrentProfile } from "@/hooks/useCircleCurrentProfile";
import { SendTestimonialDialog } from "@/components/circle/SendTestimonialDialog";
import { CircleAvatarUpload } from "@/components/circle/CircleAvatarUpload";
import { CircleCoverUpload } from "@/components/circle/CircleCoverUpload";
import { StartConversationButton } from "@/components/circle/StartConversationButton";
import { TrustScoreBadge } from "@/components/circle/TrustScoreBadge";
import { AreaReputationCard } from "@/components/circle/AreaReputationCard";
import { PendingTestimonialsCard } from "@/components/circle/PendingTestimonialsCard";
import { FollowersFollowingModal } from "@/components/circle/FollowersFollowingModal";
import { TestimonialCard } from "@/components/circle/TestimonialCard";

export default function CircleProfilePage() {
  const { profileId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Form state
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  // Fetch (and ensure) current user's profile
  const { data: currentProfile } = useCircleCurrentProfile();

  // Determine which profile to show
  const targetProfileId = profileId || currentProfile?.id;
  const isOwnProfile = !profileId || profileId === currentProfile?.id;

  // Fetch target profile
  const { data: profile, isLoading } = useQuery({
    queryKey: ["circle-profile", targetProfileId],
    queryFn: async () => {
      if (!targetProfileId) return null;

      const { data, error } = await supabase
        .from("circle_profiles")
        .select("*")
        .eq("id", targetProfileId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!targetProfileId,
  });

  // Fetch profile stats
  const { data: stats } = useQuery({
    queryKey: ["circle-profile-stats", targetProfileId],
    queryFn: async () => {
      if (!targetProfileId) return null;

      const [posts, followers, following, badges] = await Promise.all([
        supabase
          .from("circle_posts")
          .select("id", { count: "exact", head: true })
          .eq("profile_id", targetProfileId)
          .eq("is_active", true),
        supabase
          .from("circle_follows")
          .select("id", { count: "exact", head: true })
          .eq("following_profile_id", targetProfileId),
        supabase
          .from("circle_follows")
          .select("id", { count: "exact", head: true })
          .eq("follower_profile_id", targetProfileId),
        supabase
          .from("circle_user_badges")
          .select("*, badge:circle_badges(*)")
          .eq("profile_id", targetProfileId),
      ]);

      return {
        posts: posts.count || 0,
        followers: followers.count || 0,
        following: following.count || 0,
        badges: badges.data || [],
      };
    },
    enabled: !!targetProfileId,
  });

  // Check if following
  const { data: isFollowing } = useQuery({
    queryKey: ["circle-is-following", currentProfile?.id, targetProfileId],
    queryFn: async () => {
      if (!currentProfile?.id || !targetProfileId || isOwnProfile) return false;

      const { data } = await supabase
        .from("circle_follows")
        .select("id")
        .eq("follower_profile_id", currentProfile.id)
        .eq("following_profile_id", targetProfileId)
        .maybeSingle();

      return !!data;
    },
    enabled: !!currentProfile?.id && !!targetProfileId && !isOwnProfile,
  });

  // Fetch user's posts
  const { data: posts } = useQuery({
    queryKey: ["circle-profile-posts", targetProfileId],
    queryFn: async () => {
      if (!targetProfileId) return [];

      const { data, error } = await supabase
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
        .eq("profile_id", targetProfileId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
    enabled: !!targetProfileId,
  });

  // Fetch testimonials
  const { data: testimonials } = useQuery({
    queryKey: ["circle-profile-testimonials", targetProfileId],
    queryFn: async () => {
      if (!targetProfileId) return [];

      const { data, error } = await supabase
        .from("circle_testimonials")
        .select(`
          *,
          author:circle_profiles!circle_testimonials_author_profile_id_fkey(
            id,
            display_name,
            avatar_url,
            company_name
          )
        `)
        .eq("recipient_profile_id", targetProfileId)
        .eq("is_public", true)
        .eq("is_approved", true)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!targetProfileId,
  });

  // Initialize form when profile loads
  useEffect(() => {
    if (profile && isOwnProfile) {
      setDisplayName(profile.display_name || "");
      setBio(profile.bio || "");
      setCompanyName(profile.company_name || "");
      setRoleTitle(profile.role_title || "");
      setWhatsapp(profile.whatsapp || "");
    }
  }, [profile, isOwnProfile]);

  // Follow mutation
  const followMutation = useMutation({
    mutationFn: async () => {
      if (!currentProfile?.id || !targetProfileId) throw new Error("Not authenticated");

      if (isFollowing) {
        await supabase
          .from("circle_follows")
          .delete()
          .eq("follower_profile_id", currentProfile.id)
          .eq("following_profile_id", targetProfileId);
      } else {
        await supabase.from("circle_follows").insert({
          follower_profile_id: currentProfile.id,
          following_profile_id: targetProfileId,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["circle-is-following"] });
      queryClient.invalidateQueries({ queryKey: ["circle-profile-stats"] });
      toast({ title: isFollowing ? "Deixou de seguir" : "Seguindo!" });
    },
  });

  // Update profile mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!currentProfile?.id) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("circle_profiles")
        .update({
          display_name: displayName,
          bio,
          company_name: companyName,
          role_title: roleTitle,
          whatsapp: whatsapp.replace(/\D/g, ""),
        })
        .eq("id", currentProfile.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Perfil atualizado!" });
      setEditDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["circle-profile"] });
      queryClient.invalidateQueries({ queryKey: ["circle-profile-current"] });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar perfil", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Perfil não encontrado</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 px-1 sm:px-0">
      {/* Profile Header */}
      <Card className="overflow-hidden">
        {/* Cover */}
        {isOwnProfile ? (
          <CircleCoverUpload
            profileId={profile.id}
            currentCoverUrl={profile.cover_url}
            onCoverChange={(url) => {
              queryClient.invalidateQueries({ queryKey: ["circle-profile", targetProfileId] });
            }}
          />
        ) : (
          <div 
            className={cn(
              "h-32 sm:h-48 relative",
              profile.cover_url 
                ? "" 
                : "bg-gradient-to-br from-violet-500 to-pink-500"
            )}
            style={profile.cover_url ? { backgroundImage: `url(${profile.cover_url})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
          />
        )}

        <CardContent className="relative pt-0 pb-4 sm:pb-6 px-3 sm:px-6">
          {/* Avatar */}
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-3 sm:gap-4 -mt-12 sm:-mt-12">
            {isOwnProfile ? (
              <div className="ring-4 ring-background rounded-full">
                <CircleAvatarUpload
                  profileId={profile.id}
                  currentAvatarUrl={profile.avatar_url}
                  displayName={profile.display_name || "U"}
                  size="xl"
                  onAvatarChange={(url) => {
                    queryClient.invalidateQueries({ queryKey: ["circle-profile", targetProfileId] });
                  }}
                />
              </div>
            ) : (
              <Avatar className="h-24 w-24 sm:h-32 sm:w-32 ring-4 ring-background">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="text-2xl sm:text-4xl">
                  {profile.display_name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}

            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-xl sm:text-2xl font-bold">{profile.display_name}</h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                {profile.role_title && <span>{profile.role_title}</span>}
                {profile.role_title && profile.company_name && <span> • </span>}
                {profile.company_name && <span>{profile.company_name}</span>}
              </p>
              <div className="flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 mt-2 flex-wrap">
                <TrustScoreBadge 
                  score={profile.trust_score ?? 50} 
                  isVerified={profile.is_verified ?? false}
                  size="sm"
                />
                <Badge variant="secondary" className="text-[10px] sm:text-xs">
                  <Star className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                  Nv {profile.current_level}
                </Badge>
                <Badge variant="outline" className="text-[10px] sm:text-xs">
                  {profile.total_points?.toLocaleString()} pts
                </Badge>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap justify-center sm:justify-end w-full sm:w-auto">
              {isOwnProfile ? (
                <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="text-xs sm:text-sm">
                      <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                      Editar
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto mx-2 sm:mx-auto">
                    <DialogHeader>
                      <DialogTitle>Editar Perfil</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 pb-4">
                      <div className="space-y-2">
                        <Label>Nome</Label>
                        <Input
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Bio</Label>
                        <Textarea
                          value={bio}
                          onChange={(e) => setBio(e.target.value)}
                          placeholder="Conte um pouco sobre você..."
                          rows={3}
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Empresa</Label>
                          <Input
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Cargo</Label>
                          <Input
                            value={roleTitle}
                            onChange={(e) => setRoleTitle(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>WhatsApp</Label>
                        <Input
                          value={whatsapp}
                          onChange={(e) => setWhatsapp(e.target.value)}
                          placeholder="(11) 99999-9999"
                        />
                      </div>

                      <Button
                        onClick={() => updateMutation.mutate()}
                        disabled={updateMutation.isPending}
                        className="w-full sticky bottom-0"
                      >
                        {updateMutation.isPending ? "Salvando..." : "Salvar"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              ) : (
                <div className="flex gap-2 flex-wrap justify-center">
                  <Button
                    onClick={() => followMutation.mutate()}
                    disabled={followMutation.isPending}
                    variant={isFollowing ? "outline" : "default"}
                    size="sm"
                    className="text-xs sm:text-sm"
                  >
                    {isFollowing ? (
                      <>
                        <UserMinus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                        Seguindo
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                        Seguir
                      </>
                    )}
                  </Button>
                  
                  {/* Message Button */}
                  {currentProfile?.id && (
                    <StartConversationButton
                      currentProfileId={currentProfile.id}
                      targetProfileId={profile.id}
                    />
                  )}

                  {/* Send Testimonial Button */}
                  <SendTestimonialDialog 
                    recipientProfile={{
                      id: profile.id,
                      display_name: profile.display_name,
                      avatar_url: profile.avatar_url,
                      company_name: profile.company_name,
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="mt-3 sm:mt-4 text-sm sm:text-base text-muted-foreground">{profile.bio}</p>
          )}

          {/* Stats */}
          <div className="flex items-center justify-center sm:justify-start gap-4 sm:gap-6 mt-4 sm:mt-6 pt-4 sm:pt-6 border-t">
            <div className="text-center">
              <p className="text-lg sm:text-2xl font-bold">{stats?.posts || 0}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Posts</p>
            </div>
            <FollowersFollowingModal
              profileId={targetProfileId!}
              defaultTab="followers"
              followersCount={stats?.followers || 0}
              followingCount={stats?.following || 0}
            >
              <button className="text-center hover:opacity-70 transition-opacity">
                <p className="text-lg sm:text-2xl font-bold">{stats?.followers || 0}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Seguidores</p>
              </button>
            </FollowersFollowingModal>
            <FollowersFollowingModal
              profileId={targetProfileId!}
              defaultTab="following"
              followersCount={stats?.followers || 0}
              followingCount={stats?.following || 0}
            >
              <button className="text-center hover:opacity-70 transition-opacity">
                <p className="text-lg sm:text-2xl font-bold">{stats?.following || 0}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Seguindo</p>
              </button>
            </FollowersFollowingModal>
          </div>
        </CardContent>
      </Card>

      {/* Badges */}
      {stats?.badges && stats.badges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Badges
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {stats.badges.map((ub: any) => (
                <Badge
                  key={ub.id}
                  variant="secondary"
                  className="py-2 px-4"
                >
                  <Award className={cn("h-4 w-4 mr-2", `text-${ub.badge?.color}-500`)} />
                  {ub.badge?.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Area Reputation */}
      {targetProfileId && (
        <AreaReputationCard profileId={targetProfileId} />
      )}

      {/* Pending Testimonials - only show on own profile */}
      {isOwnProfile && targetProfileId && (
        <PendingTestimonialsCard profileId={targetProfileId} />
      )}

      {/* Content Tabs */}
      <Tabs defaultValue="posts">
        <TabsList className="w-full">
          <TabsTrigger value="posts" className="flex-1">
            <MessageSquare className="h-4 w-4 mr-2" />
            Posts
          </TabsTrigger>
          <TabsTrigger value="testimonials" className="flex-1">
            <Heart className="h-4 w-4 mr-2" />
            Depoimentos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="space-y-4 mt-4">
          {posts && posts.length > 0 ? (
            posts.map((post: any) => (
              <CirclePostCard
                key={post.id}
                post={post}
                isLiked={false}
                onLike={() => {}}
                currentProfileId={currentProfile?.id}
              />
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum post ainda</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="testimonials" className="space-y-4 mt-4">
          {testimonials && testimonials.length > 0 ? (
            testimonials.map((testimonial: any) => (
              <TestimonialCard
                key={testimonial.id}
                testimonial={testimonial}
                currentProfileId={currentProfile?.id}
                isOwnProfile={isOwnProfile}
              />
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Heart className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum depoimento ainda</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
