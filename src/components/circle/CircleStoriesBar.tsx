import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { NavLink } from "react-router-dom";

interface CircleStoriesBarProps {
  currentProfileId?: string;
}

interface StoryGroup {
  profile: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  };
  stories: {
    id: string;
    background_color: string | null;
  }[];
  hasUnviewed: boolean;
}

export function CircleStoriesBar({ currentProfileId }: CircleStoriesBarProps) {
  // Fetch active stories grouped by profile
  const { data: storyGroups } = useQuery({
    queryKey: ["circle-stories-bar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circle_stories")
        .select(`
          id,
          profile_id,
          background_color,
          profile:circle_profiles!circle_stories_profile_id_fkey(
            id,
            display_name,
            avatar_url
          )
        `)
        .eq("is_active", true)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Group by profile
      const groups: Record<string, StoryGroup> = {};
      data.forEach((story: any) => {
        const profileId = story.profile_id;
        if (!groups[profileId]) {
          groups[profileId] = {
            profile: story.profile,
            stories: [],
            hasUnviewed: true, // TODO: Check if user has viewed
          };
        }
        groups[profileId].stories.push(story);
      });

      return Object.values(groups);
    },
  });

  if (!storyGroups || storyGroups.length === 0) {
    return null;
  }

  return (
    <ScrollArea className="w-full whitespace-nowrap">
      <div className="flex gap-4 pb-4">
        {/* Add Story Button */}
        <NavLink
          to="/circle/stories"
          className="flex flex-col items-center gap-1"
        >
          <div className="relative">
            <Avatar className="h-16 w-16 border-2 border-dashed border-muted-foreground/30">
              <AvatarFallback className="bg-muted">
                <Plus className="h-6 w-6 text-muted-foreground" />
              </AvatarFallback>
            </Avatar>
          </div>
          <span className="text-xs text-muted-foreground">Criar</span>
        </NavLink>

        {/* Story Avatars */}
        {storyGroups.map((group) => (
          <NavLink
            key={group.profile.id}
            to="/circle/stories"
            className="flex flex-col items-center gap-1"
          >
            <div
              className={cn(
                "p-0.5 rounded-full",
                group.hasUnviewed
                  ? "bg-gradient-to-br from-violet-500 to-pink-500"
                  : "bg-muted"
              )}
            >
              <Avatar className="h-16 w-16 border-2 border-background">
                <AvatarImage src={group.profile.avatar_url || undefined} />
                <AvatarFallback>
                  {group.profile.display_name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
            <span className="text-xs truncate max-w-[70px]">
              {group.profile.id === currentProfileId
                ? "Seu story"
                : group.profile.display_name?.split(" ")[0]}
            </span>
          </NavLink>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
