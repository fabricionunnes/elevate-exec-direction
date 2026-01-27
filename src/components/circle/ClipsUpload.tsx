import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Video, X, Upload, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ClipsUploadProps {
  profileId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClipsUpload({ profileId, open, onOpenChange }: ClipsUploadProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 100MB)
    if (file.size > 100 * 1024 * 1024) {
      toast({ title: "Vídeo muito grande. Máximo 100MB.", variant: "destructive" });
      return;
    }

    // Check if it's a video
    if (!file.type.startsWith("video/")) {
      toast({ title: "Selecione um arquivo de vídeo.", variant: "destructive" });
      return;
    }

    setSelectedVideo(file);
    setVideoPreview(URL.createObjectURL(file));
  };

  const clearVideo = () => {
    if (videoPreview) {
      URL.revokeObjectURL(videoPreview);
    }
    setSelectedVideo(null);
    setVideoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const resetForm = () => {
    clearVideo();
    setContent("");
    setUploadProgress(0);
  };

  const createClipMutation = useMutation({
    mutationFn: async () => {
      if (!selectedVideo) throw new Error("No video selected");
      
      setIsUploading(true);
      setUploadProgress(10);

      // Upload video
      const fileExt = selectedVideo.name.split(".").pop();
      const fileName = `${profileId}/clips/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

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

      setUploadProgress(90);

      // Create post with clip type
      const { error: postError } = await supabase.from("circle_posts").insert({
        profile_id: profileId,
        content: content.trim() || null,
        media_urls: [publicUrl.publicUrl],
        media_type: "clip",
        post_type: "clip",
      });

      if (postError) throw postError;

      setUploadProgress(100);

      // Add points for creating a clip
      await supabase.rpc("circle_add_points", {
        p_profile_id: profileId,
        p_action: "clip_created",
        p_reference_type: "post",
        p_reference_id: null,
      });
    },
    onSuccess: () => {
      toast({ title: "Clip publicado!" });
      resetForm();
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["circle-posts"] });
    },
    onError: (error) => {
      console.error("Error creating clip:", error);
      toast({ title: "Erro ao publicar clip", variant: "destructive" });
    },
    onSettled: () => {
      setIsUploading(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={(value) => {
      if (!isUploading) {
        onOpenChange(value);
        if (!value) resetForm();
      }
    }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-5 w-5 text-primary" />
            Criar Clip
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Video Upload Area */}
          {!videoPreview ? (
            <div
              className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Video className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">
                Clique para selecionar um vídeo
              </p>
              <p className="text-xs text-muted-foreground">
                MP4, MOV, WebM • Máximo 100MB
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleVideoSelect}
                className="hidden"
              />
            </div>
          ) : (
            <div className="relative rounded-xl overflow-hidden bg-black aspect-[9/16] max-h-[400px]">
              <video
                src={videoPreview}
                className="w-full h-full object-contain"
                controls
                autoPlay
                muted
                loop
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8"
                onClick={clearVideo}
                disabled={isUploading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Caption */}
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Adicione uma legenda..."
            rows={3}
            disabled={isUploading}
          />

          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Enviando clip...</span>
                <span className="font-medium">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
              disabled={isUploading}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={() => createClipMutation.mutate()}
              disabled={!selectedVideo || isUploading}
            >
              {isUploading ? (
                <>
                  <Upload className="h-4 w-4 mr-2 animate-pulse" />
                  Enviando...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Publicar Clip
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
