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
  Camera,
  Store,
  Users
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CirclePostCard } from "@/components/circle/CirclePostCard";

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

  // Fetch current user's profile
  const { data: currentProfile } = useQuery({
    queryKey: ["circle-profile-current"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("circle_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Profile Header */}
      <Card className="overflow-hidden">
        {/* Cover */}
        <div 
          className={cn(
            "h-48 relative",
            profile.cover_url 
              ? "" 
              : "bg-gradient-to-br from-violet-500 to-pink-500"
          )}
          style={profile.cover_url ? { backgroundImage: `url(${profile.cover_url})`, backgroundSize: "cover" } : undefined}
        >
          {isOwnProfile && (
            <Button
              variant="secondary"
              size="sm"
              className="absolute bottom-4 right-4"
            >
              <Camera className="h-4 w-4 mr-2" />
              Alterar capa
            </Button>
          )}
        </div>

        <CardContent className="relative pt-0 pb-6">
          {/* Avatar */}
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 -mt-16 sm:-mt-12">
            <Avatar className="h-32 w-32 ring-4 ring-background">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="text-4xl">
                {profile.display_name?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-2xl font-bold">{profile.display_name}</h1>
              <p className="text-muted-foreground">
                {profile.role_title && <span>{profile.role_title}</span>}
                {profile.role_title && profile.company_name && <span> • </span>}
                {profile.company_name && <span>{profile.company_name}</span>}
              </p>
              <div className="flex items-center justify-center sm:justify-start gap-2 mt-2">
                <Badge variant="secondary">
                  <Star className="h-3 w-3 mr-1" />
                  Nível {profile.current_level} - {profile.level_name}
                </Badge>
                <Badge variant="outline">
                  {profile.total_points?.toLocaleString()} pontos
                </Badge>
              </div>
            </div>

            <div className="flex gap-2">
              {isOwnProfile ? (
                <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Edit className="h-4 w-4 mr-2" />
                      Editar Perfil
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Editar Perfil</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
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

                      <div className="grid grid-cols-2 gap-4">
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
                        className="w-full"
                      >
                        {updateMutation.isPending ? "Salvando..." : "Salvar"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              ) : (
                <Button
                  onClick={() => followMutation.mutate()}
                  disabled={followMutation.isPending}
                  variant={isFollowing ? "outline" : "default"}
                >
                  {isFollowing ? (
                    <>
                      <UserMinus className="h-4 w-4 mr-2" />
                      Seguindo
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Seguir
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="mt-4 text-muted-foreground">{profile.bio}</p>
          )}

          {/* Stats */}
          <div className="flex items-center justify-center sm:justify-start gap-6 mt-6 pt-6 border-t">
            <div className="text-center">
              <p className="text-2xl font-bold">{stats?.posts || 0}</p>
              <p className="text-sm text-muted-foreground">Posts</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{stats?.followers || 0}</p>
              <p className="text-sm text-muted-foreground">Seguidores</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{stats?.following || 0}</p>
              <p className="text-sm text-muted-foreground">Seguindo</p>
            </div>
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
              <Card key={testimonial.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar>
                      <AvatarImage src={testimonial.author?.avatar_url || undefined} />
                      <AvatarFallback>
                        {testimonial.author?.display_name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium">{testimonial.author?.display_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {testimonial.author?.company_name}
                      </p>
                      <p className="mt-2">{testimonial.content}</p>
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
