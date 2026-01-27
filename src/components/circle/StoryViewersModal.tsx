import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface StoryViewer {
  id: string;
  created_at: string;
  viewer_profile: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  };
}

interface StoryViewersModalProps {
  storyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseParent?: () => void;
}

export function StoryViewersModal({
  storyId,
  open,
  onOpenChange,
  onCloseParent,
}: StoryViewersModalProps) {
  const navigate = useNavigate();

  const { data: viewers, isLoading } = useQuery({
    queryKey: ["circle-story-viewers", storyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circle_story_views")
        .select(`
          id,
          created_at,
          viewer_profile:circle_profiles!circle_story_views_viewer_profile_id_fkey(
            id,
            display_name,
            avatar_url
          )
        `)
        .eq("story_id", storyId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as StoryViewer[];
    },
    enabled: open && !!storyId,
  });

  const handleViewProfile = (profileId: string) => {
    onOpenChange(false);
    onCloseParent?.();
    navigate(`/circle/profile/${profileId}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Quem visualizou ({viewers?.length || 0})
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : viewers?.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Eye className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>Nenhuma visualização ainda</p>
            </div>
          ) : (
            <div className="space-y-1">
              {viewers?.map((view) => (
                <button
                  key={view.id}
                  onClick={() => handleViewProfile(view.viewer_profile.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={view.viewer_profile.avatar_url || undefined} />
                    <AvatarFallback>
                      {view.viewer_profile.display_name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {view.viewer_profile.display_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(view.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
