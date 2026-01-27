import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { NavLink } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, UserPlus } from "lucide-react";

interface FollowersFollowingModalProps {
  profileId: string;
  defaultTab?: "followers" | "following";
  followersCount: number;
  followingCount: number;
  children: React.ReactNode;
}

interface FollowProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  company_name: string | null;
  level_name: string;
}

interface FollowRecord {
  id: string;
  created_at: string | null;
  profile: FollowProfile;
}

export function FollowersFollowingModal({
  profileId,
  defaultTab = "followers",
  followersCount,
  followingCount,
  children,
}: FollowersFollowingModalProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(defaultTab);

  // Fetch followers (people who follow this profile)
  const { data: followers, isLoading: loadingFollowers } = useQuery({
    queryKey: ["circle-followers-list", profileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circle_follows")
        .select(`
          id,
          created_at,
          profile:circle_profiles!circle_follows_follower_profile_id_fkey(
            id,
            display_name,
            avatar_url,
            company_name,
            level_name
          )
        `)
        .eq("following_profile_id", profileId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as unknown as FollowRecord[];
    },
    enabled: open && activeTab === "followers",
  });

  // Fetch following (people this profile follows)
  const { data: following, isLoading: loadingFollowing } = useQuery({
    queryKey: ["circle-following-list", profileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circle_follows")
        .select(`
          id,
          created_at,
          profile:circle_profiles!circle_follows_following_profile_id_fkey(
            id,
            display_name,
            avatar_url,
            company_name,
            level_name
          )
        `)
        .eq("follower_profile_id", profileId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as unknown as FollowRecord[];
    },
    enabled: open && activeTab === "following",
  });

  const renderList = (data: FollowRecord[] | undefined, isLoading: boolean) => {
    if (isLoading) {
      return (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      );
    }

    if (!data || data.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>Nenhum usuário encontrado</p>
        </div>
      );
    }

    return (
      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-3">
          {data.map((item) => (
            <NavLink
              key={item.id}
              to={`/circle/profile/${item.profile.id}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
            >
              <Avatar className="h-12 w-12">
                <AvatarImage src={item.profile.avatar_url || undefined} />
                <AvatarFallback>
                  {item.profile.display_name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{item.profile.display_name}</p>
                {item.profile.company_name && (
                  <p className="text-sm text-muted-foreground truncate">
                    {item.profile.company_name}
                  </p>
                )}
              </div>
              <Badge variant="secondary" className="text-xs shrink-0">
                {item.profile.level_name}
              </Badge>
            </NavLink>
          ))}
        </div>
      </ScrollArea>
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Conexões</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "followers" | "following")}>
          <TabsList className="w-full">
            <TabsTrigger value="followers" className="flex-1 gap-2">
              <Users className="h-4 w-4" />
              Seguidores ({followersCount})
            </TabsTrigger>
            <TabsTrigger value="following" className="flex-1 gap-2">
              <UserPlus className="h-4 w-4" />
              Seguindo ({followingCount})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="followers" className="mt-4">
            {renderList(followers, loadingFollowers)}
          </TabsContent>

          <TabsContent value="following" className="mt-4">
            {renderList(following, loadingFollowing)}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
