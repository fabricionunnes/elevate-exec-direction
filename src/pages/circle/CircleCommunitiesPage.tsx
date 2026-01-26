import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Plus, 
  Search, 
  Users, 
  MessageSquare, 
  Lock, 
  Globe,
  TrendingUp,
  Briefcase,
  Code,
  Heart,
  DollarSign,
  Megaphone,
  UserCheck,
  MoreHorizontal
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { NavLink } from "react-router-dom";

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

interface Community {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  cover_url: string | null;
  avatar_url: string | null;
  category: string;
  is_private: boolean;
  members_count: number;
  posts_count: number;
  owner_profile_id: string;
  created_at: string;
}

export default function CircleCommunitiesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  
  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("vendas");
  const [isPrivate, setIsPrivate] = useState(false);

  // Fetch current profile
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

  // Fetch communities
  const { data: communities, isLoading } = useQuery({
    queryKey: ["circle-communities", searchQuery, selectedCategory],
    queryFn: async () => {
      let query = supabase
        .from("circle_communities")
        .select("*")
        .eq("is_active", true)
        .order("members_count", { ascending: false });

      if (searchQuery) {
        query = query.ilike("name", `%${searchQuery}%`);
      }

      if (selectedCategory) {
        query = query.eq("category", selectedCategory);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Community[];
    },
  });

  // Fetch user's memberships
  const { data: userMemberships } = useQuery({
    queryKey: ["circle-user-memberships", currentProfile?.id],
    queryFn: async () => {
      if (!currentProfile?.id) return [];

      const { data, error } = await supabase
        .from("circle_community_members")
        .select("community_id")
        .eq("profile_id", currentProfile.id);

      if (error) throw error;
      return data.map(m => m.community_id);
    },
    enabled: !!currentProfile?.id,
  });

  // Create community mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!currentProfile?.id) throw new Error("Not authenticated");

      const slug = name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      const { data, error } = await supabase
        .from("circle_communities")
        .insert({
          name,
          slug,
          description,
          category,
          is_private: isPrivate,
          owner_profile_id: currentProfile.id,
          members_count: 1,
        })
        .select()
        .single();

      if (error) throw error;

      // Add owner as member
      await supabase.from("circle_community_members").insert({
        community_id: data.id,
        profile_id: currentProfile.id,
        role: "owner",
      });

      return data;
    },
    onSuccess: () => {
      toast({ title: "Comunidade criada com sucesso!" });
      setCreateDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["circle-communities"] });
    },
    onError: () => {
      toast({ title: "Erro ao criar comunidade", variant: "destructive" });
    },
  });

  // Join community mutation
  const joinMutation = useMutation({
    mutationFn: async (communityId: string) => {
      if (!currentProfile?.id) throw new Error("Not authenticated");

      const { error } = await supabase.from("circle_community_members").insert({
        community_id: communityId,
        profile_id: currentProfile.id,
        role: "member",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Você entrou na comunidade!" });
      queryClient.invalidateQueries({ queryKey: ["circle-communities"] });
      queryClient.invalidateQueries({ queryKey: ["circle-user-memberships"] });
    },
  });

  // Leave community mutation
  const leaveMutation = useMutation({
    mutationFn: async (communityId: string) => {
      if (!currentProfile?.id) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("circle_community_members")
        .delete()
        .eq("community_id", communityId)
        .eq("profile_id", currentProfile.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Você saiu da comunidade" });
      queryClient.invalidateQueries({ queryKey: ["circle-communities"] });
      queryClient.invalidateQueries({ queryKey: ["circle-user-memberships"] });
    },
  });

  const resetForm = () => {
    setName("");
    setDescription("");
    setCategory("vendas");
    setIsPrivate(false);
  };

  const isMember = (communityId: string) => userMemberships?.includes(communityId);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Comunidades</h1>
          <p className="text-muted-foreground">
            Encontre e participe de comunidades do seu interesse
          </p>
        </div>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Criar Comunidade
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Comunidade</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome da comunidade"
                />
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Sobre o que é essa comunidade?"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoryConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <config.icon className={cn("h-4 w-4", config.color)} />
                          {config.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Comunidade privada</span>
                </div>
                <Button
                  variant={isPrivate ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsPrivate(!isPrivate)}
                >
                  {isPrivate ? "Sim" : "Não"}
                </Button>
              </div>

              <Button
                onClick={() => createMutation.mutate()}
                disabled={!name.trim() || createMutation.isPending}
                className="w-full"
              >
                {createMutation.isPending ? "Criando..." : "Criar Comunidade"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar comunidades..."
            className="pl-9"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          <Button
            variant={selectedCategory === null ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(null)}
          >
            Todas
          </Button>
          {Object.entries(categoryConfig).map(([key, config]) => (
            <Button
              key={key}
              variant={selectedCategory === key ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(key)}
            >
              <config.icon className={cn("h-4 w-4 mr-1", selectedCategory !== key && config.color)} />
              {config.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Communities Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {communities?.map((community) => {
          const config = categoryConfig[community.category] || categoryConfig.outros;
          const CategoryIcon = config.icon;

          return (
            <Card key={community.id} className="overflow-hidden hover:shadow-md transition-shadow">
              {/* Cover */}
              <div 
                className={cn(
                  "h-24 bg-gradient-to-br",
                  community.cover_url 
                    ? "" 
                    : "from-violet-500/20 to-pink-500/20"
                )}
                style={community.cover_url ? { backgroundImage: `url(${community.cover_url})`, backgroundSize: "cover" } : undefined}
              />

              <CardContent className="p-4 -mt-8">
                {/* Avatar */}
                <Avatar className="h-16 w-16 border-4 border-background">
                  <AvatarImage src={community.avatar_url || undefined} />
                  <AvatarFallback className="text-xl">
                    <CategoryIcon className={cn("h-8 w-8", config.color)} />
                  </AvatarFallback>
                </Avatar>

                <div className="mt-2 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold flex items-center gap-1">
                        {community.name}
                        {community.is_private && <Lock className="h-3 w-3 text-muted-foreground" />}
                      </h3>
                      <Badge variant="secondary" className="mt-1">
                        <CategoryIcon className={cn("h-3 w-3 mr-1", config.color)} />
                        {config.label}
                      </Badge>
                    </div>
                  </div>

                  {community.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {community.description}
                    </p>
                  )}

                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {community.members_count}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-4 w-4" />
                      {community.posts_count}
                    </span>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <NavLink to={`/circle/community/${community.slug}`} className="flex-1">
                      <Button variant="outline" className="w-full" size="sm">
                        Ver
                      </Button>
                    </NavLink>
                    {isMember(community.id) ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => leaveMutation.mutate(community.id)}
                        disabled={leaveMutation.isPending}
                      >
                        Sair
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => joinMutation.mutate(community.id)}
                        disabled={joinMutation.isPending}
                      >
                        Entrar
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {communities?.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhuma comunidade encontrada.</p>
          <p className="text-sm mt-1">Seja o primeiro a criar uma!</p>
        </div>
      )}
    </div>
  );
}
