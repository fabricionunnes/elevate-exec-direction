import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Image, Type } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useCircleCurrentProfile } from "@/hooks/useCircleCurrentProfile";
import { StoryViewer } from "@/components/circle/StoryViewer";

const backgroundColors = [
  "bg-gradient-to-br from-violet-500 to-pink-500",
  "bg-gradient-to-br from-blue-500 to-cyan-500",
  "bg-gradient-to-br from-green-500 to-teal-500",
  "bg-gradient-to-br from-orange-500 to-red-500",
  "bg-gradient-to-br from-purple-500 to-indigo-500",
  "bg-gradient-to-br from-pink-500 to-rose-500",
];

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

export default function CircleStoriesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
  const [storyType, setStoryType] = useState<"text" | "image">("text");
  const [content, setContent] = useState("");
  const [selectedBg, setSelectedBg] = useState(backgroundColors[0]);

  // Fetch (and ensure) current profile
  const { data: currentProfile } = useCircleCurrentProfile();

  // Fetch stories
  const { data: stories, isLoading } = useQuery({
    queryKey: ["circle-stories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circle_stories")
        .select(`
          *,
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

  // Flatten all stories for the viewer
  const allStories = useMemo(() => stories || [], [stories]);

  // Group stories by profile for display
  const groupedStories = useMemo(() => {
    return stories?.reduce((acc, story) => {
      const profileId = story.profile_id;
      if (!acc[profileId]) {
        acc[profileId] = {
          profile: story.profile,
          stories: [],
        };
      }
      acc[profileId].stories.push(story);
      return acc;
    }, {} as Record<string, { profile: Story["profile"]; stories: Story[] }>);
  }, [stories]);

  // Create story mutation
  const createStoryMutation = useMutation({
    mutationFn: async () => {
      if (!currentProfile?.id) throw new Error("Not authenticated");

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const { error } = await supabase.from("circle_stories").insert({
        profile_id: currentProfile.id,
        content: storyType === "text" ? content : null,
        media_type: storyType,
        background_color: storyType === "text" ? selectedBg : null,
        expires_at: expiresAt.toISOString(),
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Story publicado!" });
      setCreateDialogOpen(false);
      setContent("");
      queryClient.invalidateQueries({ queryKey: ["circle-stories"] });
    },
    onError: () => {
      toast({ title: "Erro ao publicar story", variant: "destructive" });
    },
  });

  const handleViewStory = (story: Story) => {
    // Find the index in the flat list
    const index = allStories.findIndex(s => s.id === story.id);
    setViewerInitialIndex(index >= 0 ? index : 0);
    setViewerOpen(true);
  };

  const handleRecordView = (story: Story) => {
    // Record view
    if (currentProfile?.id && story.profile_id !== currentProfile.id) {
      supabase
        .from("circle_story_views")
        .insert({
          story_id: story.id,
          viewer_profile_id: currentProfile.id,
        })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["circle-stories"] });
        });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Stories</h1>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Criar Story
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Criar Story</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 pb-4">
              {/* Story Type */}
              <div className="flex gap-2">
                <Button
                  variant={storyType === "text" ? "default" : "outline"}
                  onClick={() => setStoryType("text")}
                  className="flex-1"
                >
                  <Type className="h-4 w-4 mr-2" />
                  Texto
                </Button>
                <Button
                  variant={storyType === "image" ? "default" : "outline"}
                  onClick={() => setStoryType("image")}
                  className="flex-1"
                  disabled
                >
                  <Image className="h-4 w-4 mr-2" />
                  Imagem
                </Button>
              </div>

              {storyType === "text" && (
                <>
                  {/* Background Color */}
                  <div className="space-y-2">
                    <Label>Cor de fundo</Label>
                    <div className="flex flex-wrap gap-2">
                      {backgroundColors.map((bg) => (
                        <button
                          key={bg}
                          onClick={() => setSelectedBg(bg)}
                          className={cn(
                            "h-8 w-8 rounded-full flex-shrink-0",
                            bg,
                            selectedBg === bg && "ring-2 ring-offset-2 ring-primary"
                          )}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Preview - Smaller height on mobile */}
                  <div
                    className={cn(
                      "aspect-[9/14] sm:aspect-[9/16] rounded-xl flex items-center justify-center p-4",
                      selectedBg
                    )}
                  >
                    <Textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Digite seu texto..."
                      className="bg-transparent border-none text-white text-center text-lg placeholder:text-white/70 resize-none focus-visible:ring-0"
                      rows={4}
                    />
                  </div>
                </>
              )}

              <Button
                onClick={() => createStoryMutation.mutate()}
                disabled={!content.trim() || createStoryMutation.isPending}
                className="w-full sticky bottom-0"
              >
                {createStoryMutation.isPending ? "Publicando..." : "Publicar Story"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stories Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {/* Create Story Card */}
        <button
          onClick={() => setCreateDialogOpen(true)}
          className="aspect-[9/16] rounded-xl border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 flex flex-col items-center justify-center gap-2 transition-colors"
        >
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Plus className="h-6 w-6 text-primary" />
          </div>
          <span className="text-sm font-medium">Criar Story</span>
        </button>

        {/* Story Cards */}
        {groupedStories && Object.entries(groupedStories).map(([profileId, group]) => (
          <button
            key={profileId}
            onClick={() => handleViewStory(group.stories[0])}
            className="aspect-[9/16] rounded-xl overflow-hidden relative group"
          >
            <div
              className={cn(
                "absolute inset-0 flex items-center justify-center p-3",
                group.stories[0].background_color || "bg-gradient-to-br from-gray-700 to-gray-900"
              )}
            >
              {group.stories[0].content && (
                <p className="text-white text-sm text-center line-clamp-4">
                  {group.stories[0].content}
                </p>
              )}
            </div>

            {/* Profile Avatar */}
            <div className="absolute top-2 left-2">
              <Avatar className="h-8 w-8 ring-2 ring-primary">
                <AvatarImage src={group.profile.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {group.profile.display_name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* Story Count */}
            {group.stories.length > 1 && (
              <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
                {group.stories.length}
              </div>
            )}

            {/* Name */}
            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent">
              <p className="text-white text-xs font-medium truncate">
                {group.profile.display_name}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Story Viewer - Instagram style */}
      <StoryViewer
        stories={allStories}
        initialIndex={viewerInitialIndex}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        onView={handleRecordView}
      />
    </div>
  );
}
