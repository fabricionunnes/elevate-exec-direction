import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { NavLink } from "react-router-dom";
import { StoryViewer } from "./StoryViewer";

interface CircleStoriesBarProps {
  currentProfileId?: string;
}

interface Story {
  id: string;
  profile_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  background_color: string | null;
  views_count: number;
  expires_at: string;
  created_at: string;
  profile: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  };
}

interface StoryGroup {
  profile: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  };
  stories: Story[];
  hasUnviewed: boolean;
}

export function CircleStoriesBar({ currentProfileId }: CircleStoriesBarProps) {
  const queryClient = useQueryClient();
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);

  // Fetch active stories with full data for the viewer
  const { data: stories } = useQuery({
    queryKey: ["circle-stories-bar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circle_stories")
        .select(`
          id,
          profile_id,
          content,
          media_url,
          media_type,
          background_color,
          views_count,
          expires_at,
          created_at,
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
      return data as Story[];
    },
  });

  // Group stories by profile for display
  const storyGroups = useMemo(() => {
    if (!stories) return [];
    
    const groups: Record<string, StoryGroup> = {};
    stories.forEach((story) => {
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
  }, [stories]);

  // All stories flattened for the viewer
  const allStories = useMemo(() => stories || [], [stories]);

  const handleOpenStory = (profileId: string) => {
    // Find the first story from this profile in the flat list
    const index = allStories.findIndex(s => s.profile_id === profileId);
    setViewerInitialIndex(index >= 0 ? index : 0);
    setViewerOpen(true);
  };

  const handleRecordView = (story: Story) => {
    // Record view
    if (currentProfileId && story.profile_id !== currentProfileId) {
      supabase
        .from("circle_story_views")
        .insert({
          story_id: story.id,
          viewer_profile_id: currentProfileId,
        })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["circle-stories-bar"] });
        });
    }
  };

  if (!storyGroups || storyGroups.length === 0) {
    return null;
  }

  return (
    <>
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-3 sm:gap-4 pb-3 sm:pb-4">
          {/* Add Story Button */}
          <NavLink
            to="/circle/stories"
            className="flex flex-col items-center gap-1"
          >
            <div className="relative">
              <Avatar className="h-14 w-14 sm:h-16 sm:w-16 border-2 border-dashed border-muted-foreground/30">
                <AvatarFallback className="bg-muted">
                  <Plus className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
            </div>
            <span className="text-[10px] sm:text-xs text-muted-foreground">Criar</span>
          </NavLink>

          {/* Story Avatars - Click to open viewer */}
          {storyGroups.map((group) => (
            <button
              key={group.profile.id}
              onClick={() => handleOpenStory(group.profile.id)}
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
                <Avatar className="h-14 w-14 sm:h-16 sm:w-16 border-2 border-background">
                  <AvatarImage src={group.profile.avatar_url || undefined} />
                  <AvatarFallback className="text-sm sm:text-base">
                    {group.profile.display_name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
              <span className="text-[10px] sm:text-xs truncate max-w-[60px] sm:max-w-[70px]">
                {group.profile.id === currentProfileId
                  ? "Seu story"
                  : group.profile.display_name?.split(" ")[0]}
              </span>
            </button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Instagram-style Story Viewer */}
      <StoryViewer
        stories={allStories}
        initialIndex={viewerInitialIndex}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        onView={handleRecordView}
        currentProfileId={currentProfileId}
      />
    </>
  );
}
