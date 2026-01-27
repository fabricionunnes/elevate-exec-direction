import { useState } from "react";
import { useParams, NavLink, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, 
  MessageSquare, 
  Lock, 
  Globe,
  ArrowLeft,
  Heart,
  Send,
  TrendingUp,
  Briefcase,
  Code,
  DollarSign,
  Megaphone,
  UserCheck,
  MoreHorizontal,
  Calendar
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useCircleCurrentProfile } from "@/hooks/useCircleCurrentProfile";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import unvCircleLogo from "@/assets/unv-circle-logo.png";

const categoryConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  vendas: { label: "Vendas", icon: TrendingUp, color: "text-green-500" },
  gestao: { label: "Gestão", icon: Briefcase, color: "text-blue-500" },
  rh: { label: "RH", icon: UserCheck, color: "text-purple-500" },
  tech: { label: "Tech", icon: Code, color: "text-cyan-500" },
  lifestyle: { label: "Lifestyle", icon: Heart, color: "text-pink-500" },
  marketing: { label: "Marketing", icon: Megaphone, color: "text-orange-500" },
  financeiro: { label: "Financeiro", icon: DollarSign, color: "text-yellow-500" },
  outros: { label: "Outros", icon: MoreHorizontal, color: "text-gray-500" },
};

interface CommunityPost {
  id: string;
  content: string;
  media_urls: string[] | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
  profile: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    level_name: string;
  };
}

interface CommunityMember {
  id: string;
  role: string;
  joined_at: string;
  profile: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    company_name: string | null;
    level_name: string;
  };
}

export default function CircleCommunityDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newPostContent, setNewPostContent] = useState("");

  const { data: currentProfile } = useCircleCurrentProfile();

  // Fetch community details
  const { data: community, isLoading: loadingCommunity } = useQuery({
    queryKey: ["circle-community", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circle_communities")
        .select("*")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  // Check membership
  const { data: membership } = useQuery({
    queryKey: ["circle-community-membership", community?.id, currentProfile?.id],
    queryFn: async () => {
      if (!community?.id || !currentProfile?.id) return null;

      const { data, error } = await supabase
        .from("circle_community_members")
        .select("*")
        .eq("community_id", community.id)
        .eq("profile_id", currentProfile.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!community?.id && !!currentProfile?.id,
  });

  // Fetch posts from circle_posts table with community_id
  const { data: posts } = useQuery({
    queryKey: ["circle-community-posts", community?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circle_posts")
        .select(`
          id,
          content,
          media_urls,
          likes_count,
          comments_count,
          created_at,
          profile:circle_profiles!circle_posts_profile_id_fkey(
            id,
            display_name,
            avatar_url,
            level_name
          )
        `)
        .eq("community_id", community!.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as CommunityPost[];
    },
    enabled: !!community?.id,
  });

  // Fetch members
  const { data: members } = useQuery({
    queryKey: ["circle-community-members", community?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circle_community_members")
        .select(`
          *,
          profile:circle_profiles!circle_community_members_profile_id_fkey(
            id,
            display_name,
            avatar_url,
            company_name,
            level_name
          )
        `)
        .eq("community_id", community!.id)
        .order("joined_at", { ascending: true })
        .limit(100);

      if (error) throw error;
      return data as CommunityMember[];
    },
    enabled: !!community?.id,
  });

  // Join community
  const joinMutation = useMutation({
    mutationFn: async () => {
      if (!currentProfile?.id || !community?.id) throw new Error("Not authenticated");

      const { error } = await supabase.from("circle_community_members").insert({
        community_id: community.id,
        profile_id: currentProfile.id,
        role: "member",
      });

      if (error) throw error;

      // Update members count
      await supabase
        .from("circle_communities")
        .update({ members_count: (community.members_count || 0) + 1 })
        .eq("id", community.id);
    },
    onSuccess: () => {
      toast({ title: "Você entrou na comunidade!" });
      queryClient.invalidateQueries({ queryKey: ["circle-community-membership"] });
      queryClient.invalidateQueries({ queryKey: ["circle-community-members"] });
      queryClient.invalidateQueries({ queryKey: ["circle-community", slug] });
    },
    onError: () => {
      toast({ title: "Erro ao entrar na comunidade", variant: "destructive" });
    },
  });

  // Create post in circle_posts table
  const createPostMutation = useMutation({
    mutationFn: async () => {
      if (!currentProfile?.id || !community?.id) throw new Error("Not authenticated");

      const { error } = await supabase.from("circle_posts").insert({
        community_id: community.id,
        profile_id: currentProfile.id,
        content: newPostContent,
        post_type: "text",
      });

      if (error) throw error;

      // Update posts count
      await supabase
        .from("circle_communities")
        .update({ posts_count: (community.posts_count || 0) + 1 })
        .eq("id", community.id);
    },
    onSuccess: () => {
      toast({ title: "Post publicado!" });
      setNewPostContent("");
      queryClient.invalidateQueries({ queryKey: ["circle-community-posts"] });
      queryClient.invalidateQueries({ queryKey: ["circle-community", slug] });
    },
    onError: () => {
      toast({ title: "Erro ao publicar", variant: "destructive" });
    },
  });

  const isMember = !!membership;

  if (loadingCommunity) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!community) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <img src={unvCircleLogo} alt="UNV Circle" className="h-16 w-16 mx-auto mb-4 opacity-50" />
        <h2 className="text-xl font-semibold mb-2">Comunidade não encontrada</h2>
        <p className="text-muted-foreground mb-4">Esta comunidade não existe ou foi removida.</p>
        <Button onClick={() => navigate("/circle/communities")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para Comunidades
        </Button>
      </div>
    );
  }

  const config = categoryConfig[community.category] || categoryConfig.outros;
  const CategoryIcon = config.icon;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back button */}
      <Button variant="ghost" onClick={() => navigate("/circle/communities")} className="mb-2">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Voltar
      </Button>

      {/* Header */}
      <Card>
        <div className="h-32 sm:h-48 bg-gradient-to-br from-primary/20 to-primary/5 relative">
          {community.cover_url && (
            <img
              src={community.cover_url}
              alt={community.name}
              className="w-full h-full object-cover"
            />
          )}
        </div>
        <CardContent className="pt-0">
          <div className="flex flex-col sm:flex-row items-start gap-4 -mt-10 sm:-mt-12">
            <Avatar className="h-20 w-20 sm:h-24 sm:w-24 border-4 border-background">
              <AvatarImage src={community.avatar_url || unvCircleLogo} />
              <AvatarFallback className="text-2xl">
                {community.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 pt-2 sm:pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <h1 className="text-2xl font-bold">{community.name}</h1>
                <div className="flex gap-2">
                  <Badge variant="secondary">
                    <CategoryIcon className={cn("h-3 w-3 mr-1", config.color)} />
                    {config.label}
                  </Badge>
                  <Badge variant="outline">
                    {community.is_private ? (
                      <><Lock className="h-3 w-3 mr-1" /> Privada</>
                    ) : (
                      <><Globe className="h-3 w-3 mr-1" /> Pública</>
                    )}
                  </Badge>
                </div>
              </div>

              <p className="text-muted-foreground mt-2">{community.description}</p>

              <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {community.members_count} membros
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-4 w-4" />
                  {community.posts_count} posts
                </span>
              </div>
            </div>

            <div className="w-full sm:w-auto">
              {!isMember ? (
                <Button onClick={() => joinMutation.mutate()} disabled={joinMutation.isPending}>
                  {joinMutation.isPending ? "Entrando..." : "Entrar na Comunidade"}
                </Button>
              ) : (
                <Badge variant="secondary" className="py-2 px-4">
                  <UserCheck className="h-4 w-4 mr-2" />
                  Membro
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="posts" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="posts">
            <MessageSquare className="h-4 w-4 mr-2" />
            Posts
          </TabsTrigger>
          <TabsTrigger value="members">
            <Users className="h-4 w-4 mr-2" />
            Membros
          </TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="space-y-4 mt-4">
          {/* Create post (only for members) */}
          {isMember && (
            <Card>
              <CardContent className="pt-4">
                <div className="flex gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={currentProfile?.avatar_url || undefined} />
                    <AvatarFallback>
                      {currentProfile?.display_name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-2">
                    <Textarea
                      value={newPostContent}
                      onChange={(e) => setNewPostContent(e.target.value)}
                      placeholder="Compartilhe algo com a comunidade..."
                      className="min-h-[80px]"
                    />
                    <div className="flex justify-end">
                      <Button
                        onClick={() => createPostMutation.mutate()}
                        disabled={!newPostContent.trim() || createPostMutation.isPending}
                        size="sm"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {createPostMutation.isPending ? "Publicando..." : "Publicar"}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Posts list */}
          {posts?.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum post ainda.</p>
                {isMember && <p className="text-sm mt-1">Seja o primeiro a publicar!</p>}
              </CardContent>
            </Card>
          ) : (
            posts?.map((post) => (
              <Card key={post.id}>
                <CardContent className="pt-4">
                  <div className="flex gap-3">
                    <NavLink to={`/circle/profile/${post.profile.id}`}>
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={post.profile.avatar_url || undefined} />
                        <AvatarFallback>
                          {post.profile.display_name?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </NavLink>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <NavLink
                          to={`/circle/profile/${post.profile.id}`}
                          className="font-medium hover:underline"
                        >
                          {post.profile.display_name}
                        </NavLink>
                        <Badge variant="secondary" className="text-xs">
                          {post.profile.level_name}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(post.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap">{post.content}</p>
                      {post.media_urls && post.media_urls.length > 0 && (
                        <img
                          src={post.media_urls[0]}
                          alt="Post image"
                          className="mt-3 rounded-lg max-h-96 object-cover"
                        />
                      )}
                      <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                        <button className="flex items-center gap-1 hover:text-primary transition-colors">
                          <Heart className="h-4 w-4" />
                          {post.likes_count}
                        </button>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-4 w-4" />
                          {post.comments_count}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="members" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Membros ({members?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {members?.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhum membro ainda.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {members?.map((member) => (
                    <NavLink
                      key={member.id}
                      to={`/circle/profile/${member.profile.id}`}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                    >
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={member.profile.avatar_url || undefined} />
                        <AvatarFallback>
                          {member.profile.display_name?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{member.profile.display_name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {member.profile.company_name || member.profile.level_name}
                        </p>
                      </div>
                      {member.role === "owner" && (
                        <Badge>Criador</Badge>
                      )}
                      {member.role === "admin" && (
                        <Badge variant="secondary">Admin</Badge>
                      )}
                    </NavLink>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
