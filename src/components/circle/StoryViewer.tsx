import { useState, useEffect, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X, ChevronLeft, ChevronRight, Clock, Eye, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { StoryInteractions } from "./StoryInteractions";
import { StoryViewersModal } from "./StoryViewersModal";

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

interface StoryViewerProps {
  stories: Story[];
  initialIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onView?: (story: Story) => void;
  currentProfileId?: string;
}

export function StoryViewer({ 
  stories, 
  initialIndex, 
  open, 
  onOpenChange, 
  onView,
  currentProfileId 
}: StoryViewerProps) {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [viewersModalOpen, setViewersModalOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false); // Start with sound ON
  const videoRef = useRef<HTMLVideoElement>(null);

  const currentStory = stories[currentIndex];

  // Check if current story is a video
  const isVideoStory = currentStory?.media_type === "video";

  // Reset index when dialog opens
  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      setProgress(0);
      setIsPaused(false);
      setIsMuted(false); // Start with sound ON
    }
  }, [open, initialIndex]);

  // Auto-advance timer (only for non-video stories or when video ends)
  useEffect(() => {
    if (!open || isPaused || isVideoStory) return;

    const duration = 5000; // 5 seconds per story
    const interval = 50; // Update progress every 50ms
    const increment = (interval / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          // Move to next story
          if (currentIndex < stories.length - 1) {
            setCurrentIndex(currentIndex + 1);
            return 0;
          } else {
            // Close dialog at end
            onOpenChange(false);
            return 100;
          }
        }
        return prev + increment;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [open, currentIndex, stories.length, onOpenChange, isPaused, isVideoStory]);

  // Handle video progress
  const handleVideoTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      const video = videoRef.current;
      const progressPercent = (video.currentTime / video.duration) * 100;
      setProgress(progressPercent);
    }
  }, []);

  // Handle video end
  const handleVideoEnded = useCallback(() => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setProgress(0);
    } else {
      onOpenChange(false);
    }
  }, [currentIndex, stories.length, onOpenChange]);

  // Record view when story changes
  useEffect(() => {
    if (open && currentStory && onView) {
      onView(currentStory);
    }
  }, [open, currentStory?.id, onView]);

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setProgress(0);
    }
  }, [currentIndex]);

  const goToNext = useCallback(() => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setProgress(0);
    } else {
      onOpenChange(false);
    }
  }, [currentIndex, stories.length, onOpenChange]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "ArrowLeft") goToPrevious();
      if (e.key === "ArrowRight") goToNext();
      if (e.key === "Escape") onOpenChange(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, goToPrevious, goToNext, onOpenChange]);

  // Handle click navigation (left/right sides)
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPaused) return; // Don't navigate when paused (comments open)
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    
    if (x < width / 3) {
      goToPrevious();
    } else if (x > (width * 2) / 3) {
      goToNext();
    }
  };

  if (!currentStory) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 overflow-hidden bg-transparent border-none">
        <VisuallyHidden>
          <DialogTitle>Story de {currentStory.profile.display_name}</DialogTitle>
        </VisuallyHidden>
        <div
          className={cn(
            "aspect-[9/16] flex flex-col relative cursor-pointer select-none",
            currentStory.background_color || "bg-gradient-to-br from-gray-700 to-gray-900"
          )}
          onClick={handleClick}
        >
          {/* Progress bars */}
          <div className="absolute top-2 left-2 right-2 flex gap-1 z-10">
            {stories.map((_, index) => (
              <div 
                key={index} 
                className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden"
              >
                <div
                  className="h-full bg-white transition-all duration-100"
                  style={{
                    width: index < currentIndex 
                      ? "100%" 
                      : index === currentIndex 
                        ? `${progress}%` 
                        : "0%"
                  }}
                />
              </div>
            ))}
          </div>

          {/* Header */}
          <div className="flex items-center gap-3 p-4 pt-6 bg-gradient-to-b from-black/50 to-transparent">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenChange(false);
                navigate(`/circle/profile/${currentStory.profile.id}`);
              }}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <Avatar className="h-10 w-10 ring-2 ring-white">
                <AvatarImage src={currentStory.profile.avatar_url || undefined} />
                <AvatarFallback>
                  {currentStory.profile.display_name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="text-left">
                <p className="text-white font-medium text-sm">
                  {currentStory.profile.display_name}
                </p>
                <p className="text-white/70 text-xs flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(currentStory.created_at), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </p>
              </div>
            </button>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                onOpenChange(false);
              }}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation arrows (visible on hover) */}
          {currentIndex > 0 && (
            <button
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 text-white opacity-0 hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                goToPrevious();
              }}
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          {currentIndex < stories.length - 1 && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 text-white opacity-0 hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                goToNext();
              }}
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}

          {/* Content - full screen media container */}
          <div className="absolute inset-0 z-0 overflow-hidden">
            {currentStory.media_url && currentStory.media_type === "video" ? (
              <>
                <video 
                  ref={videoRef}
                  src={currentStory.media_url} 
                  className="absolute inset-0 min-w-full min-h-full w-auto h-auto"
                  style={{ 
                    objectFit: 'cover',
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)'
                  }}
                  autoPlay
                  muted={isMuted}
                  playsInline
                  onTimeUpdate={handleVideoTimeUpdate}
                  onEnded={handleVideoEnded}
                  onClick={(e) => e.stopPropagation()}
                />
                {/* Mute/Unmute button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMuted(!isMuted);
                  }}
                  className="absolute bottom-20 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors z-20"
                >
                  {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                </button>
              </>
            ) : currentStory.media_url ? (
              <img 
                src={currentStory.media_url} 
                alt="Story"
                className="absolute inset-0 min-w-full min-h-full w-auto h-auto"
                style={{ 
                  objectFit: 'cover',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)'
                }}
              />
            ) : currentStory.content ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-white text-xl text-center font-medium p-4">
                  {currentStory.content}
                </p>
              </div>
            ) : null}
          </div>
          
          {/* Spacer for content area */}
          <div className="flex-1" />

          {/* Footer */}
          <div className="p-4 bg-gradient-to-t from-black/50 to-transparent">
            {/* Only owner can see who viewed */}
            {currentStory.profile_id === currentProfileId ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPaused(true);
                  setViewersModalOpen(true);
                }}
                className="w-full flex items-center justify-center gap-2 text-white/70 hover:text-white text-sm transition-colors"
              >
                <Eye className="h-4 w-4" />
                <span>{currentStory.views_count} visualizações</span>
              </button>
            ) : (
              <div className="flex items-center justify-center gap-2 text-white/70 text-sm">
                <Eye className="h-4 w-4" />
                <span>{currentStory.views_count} visualizações</span>
              </div>
            )}
          </div>

          {/* Viewers Modal (only for story owner) */}
          {currentStory.profile_id === currentProfileId && (
            <StoryViewersModal
              storyId={currentStory.id}
              open={viewersModalOpen}
              onOpenChange={(open) => {
                setViewersModalOpen(open);
                if (!open) setIsPaused(false);
              }}
              onCloseParent={() => onOpenChange(false)}
            />
          )}

          {/* Story Interactions */}
          <StoryInteractions
            storyId={currentStory.id}
            storyOwnerId={currentStory.profile_id}
            currentProfileId={currentProfileId}
            onPause={() => setIsPaused(true)}
            onResume={() => setIsPaused(false)}
          />

          {/* Touch hint indicators */}
          <div className="absolute inset-y-0 left-0 w-1/3" />
          <div className="absolute inset-y-0 right-0 w-1/3" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
