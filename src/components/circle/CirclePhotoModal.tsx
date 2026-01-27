import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Heart, MessageSquare, Share2, Bookmark, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { NavLink } from "react-router-dom";

interface CirclePhotoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: {
    id: string;
    content: string | null;
    media_urls: string[] | null;
    media_type: string | null;
    likes_count: number;
    comments_count: number;
    shares_count: number;
    created_at: string;
    profile: {
      id: string;
      display_name: string;
      avatar_url: string | null;
      company_name: string | null;
      role_title: string | null;
    };
  };
  selectedImageIndex?: number;
  isLiked: boolean;
  isSaved?: boolean;
  onLike: () => void;
  onSave?: () => void;
  onShare?: () => void;
  onComment?: () => void;
}

export function CirclePhotoModal({
  open,
  onOpenChange,
  post,
  selectedImageIndex = 0,
  isLiked,
  isSaved,
  onLike,
  onSave,
  onShare,
  onComment,
}: CirclePhotoModalProps) {
  const currentImage = post.media_urls?.[selectedImageIndex];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-background border-none gap-0">
        <VisuallyHidden>
          <DialogTitle>Post de {post.profile.display_name}</DialogTitle>
        </VisuallyHidden>
        
        <div className="flex flex-col md:flex-row max-h-[90vh]">
          {/* Image Section */}
          <div className="relative bg-black flex items-center justify-center md:w-2/3">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10 text-white hover:bg-white/20 md:hidden"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-5 w-5" />
            </Button>
            
            {currentImage && (
              post.media_type === "video" ? (
                <video
                  src={currentImage}
                  className="max-h-[60vh] md:max-h-[90vh] w-full object-contain"
                  controls
                  autoPlay
                />
              ) : (
                <img
                  src={currentImage}
                  alt=""
                  className="max-h-[60vh] md:max-h-[90vh] w-full object-contain"
                />
              )
            )}
          </div>

          {/* Content Section */}
          <div className="flex flex-col md:w-1/3 bg-card">
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b">
              <NavLink to={`/circle/profile/${post.profile.id}`}>
                <Avatar className="h-10 w-10">
                  <AvatarImage src={post.profile.avatar_url || undefined} />
                  <AvatarFallback>
                    {post.profile.display_name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </NavLink>
              <div className="flex-1">
                <NavLink 
                  to={`/circle/profile/${post.profile.id}`}
                  className="font-semibold text-sm hover:underline"
                >
                  {post.profile.display_name}
                </NavLink>
                <p className="text-xs text-muted-foreground">
                  {post.profile.role_title && post.profile.company_name
                    ? `${post.profile.role_title} • ${post.profile.company_name}`
                    : post.profile.company_name}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="hidden md:flex"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Caption */}
            <div className="flex-1 overflow-y-auto p-4">
              {post.content && (
                <div className="flex gap-3">
                  <NavLink to={`/circle/profile/${post.profile.id}`}>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={post.profile.avatar_url || undefined} />
                      <AvatarFallback>
                        {post.profile.display_name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </NavLink>
                  <div>
                    <p className="text-sm">
                      <NavLink 
                        to={`/circle/profile/${post.profile.id}`}
                        className="font-semibold hover:underline mr-2"
                      >
                        {post.profile.display_name}
                      </NavLink>
                      <span className="whitespace-pre-wrap">{post.content}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(post.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="border-t p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(isLiked && "text-red-500")}
                    onClick={onLike}
                  >
                    <Heart className={cn("h-6 w-6", isLiked && "fill-current")} />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={onComment}>
                    <MessageSquare className="h-6 w-6" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={onShare}>
                    <Share2 className="h-6 w-6" />
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(isSaved && "text-primary")}
                  onClick={onSave}
                >
                  <Bookmark className={cn("h-6 w-6", isSaved && "fill-current")} />
                </Button>
              </div>
              
              <p className="font-semibold text-sm">
                {post.likes_count} curtidas
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(post.created_at), {
                  addSuffix: true,
                  locale: ptBR,
                })}
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
