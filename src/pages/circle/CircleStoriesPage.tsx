import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Plus, Image, Type, Upload, X, Video, Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useCircleCurrentProfile } from "@/hooks/useCircleCurrentProfile";
import { StoryViewer } from "@/components/circle/StoryViewer";
import { StoryCameraRecorder } from "@/components/circle/StoryCameraRecorder";

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
  const [storyType, setStoryType] = useState<"text" | "image" | "video" | "record">("text");
  const [content, setContent] = useState("");
  const [selectedBg, setSelectedBg] = useState(backgroundColors[0]);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showRecorder, setShowRecorder] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

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

  // Handle image selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "Imagem muito grande. Máximo 5MB.", variant: "destructive" });
        return;
      }
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle video selection
  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        toast({ title: "Vídeo muito grande. Máximo 50MB.", variant: "destructive" });
        return;
      }
      if (!file.type.startsWith("video/")) {
        toast({ title: "Selecione um arquivo de vídeo.", variant: "destructive" });
        return;
      }
      setSelectedVideo(file);
      setVideoPreview(URL.createObjectURL(file));
    }
  };

  const clearVideo = () => {
    if (videoPreview) {
      URL.revokeObjectURL(videoPreview);
    }
    setSelectedVideo(null);
    setVideoPreview(null);
    if (videoInputRef.current) {
      videoInputRef.current.value = "";
    }
  };

  // Create story mutation
  const createStoryMutation = useMutation({
    mutationFn: async () => {
      if (!currentProfile?.id) throw new Error("Not authenticated");

      setIsUploading(true);
      setUploadProgress(10);
      let mediaUrl: string | null = null;

      // Upload image if selected
      if (storyType === "image" && selectedImage) {
        const fileExt = selectedImage.name.split(".").pop();
        const fileName = `${currentProfile.id}/stories/${Date.now()}.${fileExt}`;

        setUploadProgress(30);
        const { error: uploadError } = await supabase.storage
          .from("circle-media")
          .upload(fileName, selectedImage);

        if (uploadError) throw uploadError;

        setUploadProgress(70);
        const { data: publicUrl } = supabase.storage
          .from("circle-media")
          .getPublicUrl(fileName);

        mediaUrl = publicUrl.publicUrl;
      }

      // Upload video if selected
      if (storyType === "video" && selectedVideo) {
        const fileExt = selectedVideo.name.split(".").pop();
        const fileName = `${currentProfile.id}/stories/${Date.now()}.${fileExt}`;

        setUploadProgress(30);
        const { error: uploadError } = await supabase.storage
          .from("circle-media")
          .upload(fileName, selectedVideo, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) throw uploadError;

        setUploadProgress(70);
        const { data: publicUrl } = supabase.storage
          .from("circle-media")
          .getPublicUrl(fileName);

        mediaUrl = publicUrl.publicUrl;
      }

      setUploadProgress(90);
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const { error } = await supabase.from("circle_stories").insert({
        profile_id: currentProfile.id,
        content: storyType === "text" ? content : null,
        media_url: mediaUrl,
        media_type: storyType,
        background_color: storyType === "text" ? selectedBg : null,
        expires_at: expiresAt.toISOString(),
      });

      if (error) throw error;
      setUploadProgress(100);
    },
    onSuccess: () => {
      toast({ title: "Story publicado!" });
      setCreateDialogOpen(false);
      setContent("");
      clearImage();
      clearVideo();
      setStoryType("text");
      setUploadProgress(0);
      queryClient.invalidateQueries({ queryKey: ["circle-stories"] });
      queryClient.invalidateQueries({ queryKey: ["circle-stories-bar"] });
    },
    onError: () => {
      toast({ title: "Erro ao publicar story", variant: "destructive" });
    },
    onSettled: () => {
      setIsUploading(false);
      setUploadProgress(0);
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
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={storyType === "text" ? "default" : "outline"}
                  onClick={() => setStoryType("text")}
                  size="sm"
                >
                  <Type className="h-4 w-4 mr-1" />
                  Texto
                </Button>
                <Button
                  variant={storyType === "image" ? "default" : "outline"}
                  onClick={() => setStoryType("image")}
                  size="sm"
                >
                  <Image className="h-4 w-4 mr-1" />
                  Imagem
                </Button>
                <Button
                  variant={storyType === "record" ? "default" : "outline"}
                  onClick={() => {
                    setStoryType("record");
                    setShowRecorder(true);
                  }}
                  size="sm"
                  className="bg-gradient-to-r from-pink-500/20 to-violet-500/20 border-pink-500/30 hover:border-pink-500/50"
                >
                  <Camera className="h-4 w-4 mr-1 text-pink-500" />
                  <span className="text-pink-600 dark:text-pink-400">Gravar</span>
                </Button>
                <Button
                  variant={storyType === "video" ? "default" : "outline"}
                  onClick={() => setStoryType("video")}
                  size="sm"
                >
                  <Video className="h-4 w-4 mr-1" />
                  Enviar
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

              {storyType === "image" && (
                <div className="space-y-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />

                  {!imagePreview ? (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-[9/14] sm:aspect-[9/16] w-full rounded-xl border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 flex flex-col items-center justify-center gap-3 transition-colors"
                    >
                      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                        <Upload className="h-8 w-8 text-primary" />
                      </div>
                      <span className="text-sm text-muted-foreground">
                        Clique para selecionar uma imagem
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Máximo 5MB
                      </span>
                    </button>
                  ) : (
                    <div className="relative aspect-[9/14] sm:aspect-[9/16] rounded-xl overflow-hidden">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={clearImage}
                        className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
                      >
                        <X className="h-4 w-4 text-white" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {storyType === "record" && (
                <StoryCameraRecorder
                  onVideoRecorded={(file, preview) => {
                    setSelectedVideo(file);
                    setVideoPreview(preview);
                    setStoryType("video");
                    setShowRecorder(false);
                  }}
                  onCancel={() => {
                    setStoryType("text");
                    setShowRecorder(false);
                  }}
                />
              )}

              {storyType === "video" && (
                <div className="space-y-4">
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*"
                    onChange={handleVideoSelect}
                    className="hidden"
                  />

                  {!videoPreview ? (
                    <button
                      onClick={() => videoInputRef.current?.click()}
                      className="aspect-[9/14] sm:aspect-[9/16] w-full rounded-xl border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 flex flex-col items-center justify-center gap-3 transition-colors"
                    >
                      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                        <Video className="h-8 w-8 text-primary" />
                      </div>
                      <span className="text-sm text-muted-foreground">
                        Clique para selecionar um vídeo
                      </span>
                      <span className="text-xs text-muted-foreground">
                        MP4, MOV, WebM • Máximo 50MB
                      </span>
                    </button>
                  ) : (
                    <div className="relative aspect-[9/14] sm:aspect-[9/16] rounded-xl overflow-hidden bg-black">
                      <video
                        src={videoPreview}
                        className="w-full h-full object-contain"
                        controls
                        autoPlay
                        muted
                        loop
                      />
                      <button
                        onClick={clearVideo}
                        disabled={isUploading}
                        className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
                      >
                        <X className="h-4 w-4 text-white" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Upload Progress */}
              {isUploading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Enviando...</span>
                    <span className="font-medium">{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} />
                </div>
              )}

              {storyType !== "record" && (
                <Button
                  onClick={() => createStoryMutation.mutate()}
                  disabled={
                    (storyType === "text" && !content.trim()) ||
                    (storyType === "image" && !selectedImage) ||
                    (storyType === "video" && !selectedVideo) ||
                    createStoryMutation.isPending ||
                    isUploading
                  }
                  className="w-full sticky bottom-0"
                >
                  {createStoryMutation.isPending || isUploading ? "Publicando..." : "Publicar Story"}
                </Button>
              )}
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
            {/* Background - Image, Video or Color */}
            {group.stories[0].media_url && group.stories[0].media_type === "video" ? (
              <>
                <video
                  src={group.stories[0].media_url}
                  className="absolute inset-0 w-full h-full object-cover"
                  muted
                  playsInline
                />
                {/* Video indicator */}
                <div className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full z-10">
                  <Video className="h-3 w-3" />
                </div>
              </>
            ) : group.stories[0].media_url ? (
              <img
                src={group.stories[0].media_url}
                alt="Story"
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
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
            )}

            {/* Profile Avatar */}
            <div className="absolute top-2 left-2 z-10">
              <Avatar className="h-8 w-8 ring-2 ring-primary">
                <AvatarImage src={group.profile.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {group.profile.display_name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* Story Count */}
            {group.stories.length > 1 && (
              <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full z-10">
                {group.stories.length}
              </div>
            )}

            {/* Name */}
            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent z-10">
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
        currentProfileId={currentProfile?.id}
      />
    </div>
  );
}
