import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Image, Video, Smile, X, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AIQualityAssistant } from "./AIQualityAssistant";

interface CircleCreatePostProps {
  profile: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  };
  communityId?: string;
  onPostCreated?: () => void;
}

export function CircleCreatePost({ profile, communityId, onPostCreated }: CircleCreatePostProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [contentArea, setContentArea] = useState<string>("");
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Limit to 4 images
    const newFiles = files.slice(0, 4 - selectedImages.length);
    
    // Check file sizes
    const validFiles = newFiles.filter(file => {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: `${file.name} muito grande. Máximo 5MB.`, variant: "destructive" });
        return false;
      }
      return true;
    });

    if (validFiles.length > 0) {
      setSelectedImages(prev => [...prev, ...validFiles]);
      const newPreviews = validFiles.map(file => URL.createObjectURL(file));
      setImagePreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(imagePreviews[index]);
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    imagePreviews.forEach(url => URL.revokeObjectURL(url));
    setSelectedImages([]);
    setImagePreviews([]);
    setContent("");
    setContentArea("");
    setShowAIAssistant(false);
    setIsExpanded(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const createPostMutation = useMutation({
    mutationFn: async () => {
      setIsUploading(true);
      const mediaUrls: string[] = [];

      // Upload images
      for (const file of selectedImages) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${profile.id}/posts/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("circle-media")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: publicUrl } = supabase.storage
          .from("circle-media")
          .getPublicUrl(fileName);

        mediaUrls.push(publicUrl.publicUrl);
      }

      const { error } = await supabase.from("circle_posts").insert({
        profile_id: profile.id,
        content: content.trim() || null,
        media_urls: mediaUrls.length > 0 ? mediaUrls : null,
        media_type: mediaUrls.length > 0 ? "image" : null,
        community_id: communityId || null,
        post_type: "regular",
        content_area: contentArea || null,
      });

      if (error) throw error;

      // Add points for creating a post
      await supabase.rpc("circle_add_points", {
        p_profile_id: profile.id,
        p_action: "post_created",
        p_reference_type: "post",
        p_reference_id: null,
      });
    },
    onSuccess: () => {
      toast({ title: "Post publicado!" });
      clearAll();
      queryClient.invalidateQueries({ queryKey: ["circle-posts"] });
      onPostCreated?.();
    },
    onError: () => {
      toast({ title: "Erro ao publicar post", variant: "destructive" });
    },
    onSettled: () => {
      setIsUploading(false);
    },
  });

  const handleSubmit = () => {
    if (!content.trim() && selectedImages.length === 0) return;
    createPostMutation.mutate();
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={profile.avatar_url || undefined} />
            <AvatarFallback>
              {profile.display_name?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-3">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="O que você está pensando?"
              className="min-h-[60px] resize-none"
              onFocus={() => setIsExpanded(true)}
              rows={isExpanded ? 4 : 2}
            />

            {isExpanded && (
              <div className="space-y-3">
                {/* Image Previews */}
                {imagePreviews.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {imagePreviews.map((preview, index) => (
                      <div key={index} className="relative aspect-square rounded-lg overflow-hidden">
                        <img
                          src={preview}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() => removeImage(index)}
                          className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
                        >
                          <X className="h-3 w-3 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Content Area Selector */}
                <div className="flex items-center gap-2">
                  <Select value={contentArea} onValueChange={setContentArea}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Área (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vendas">Vendas</SelectItem>
                      <SelectItem value="gestao">Gestão</SelectItem>
                      <SelectItem value="marketing">Marketing</SelectItem>
                      <SelectItem value="rh">RH</SelectItem>
                      <SelectItem value="tech">Tech</SelectItem>
                      <SelectItem value="financeiro">Financeiro</SelectItem>
                      <SelectItem value="lideranca">Liderança</SelectItem>
                      <SelectItem value="atendimento">Atendimento</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAIAssistant(!showAIAssistant)}
                    className="gap-1"
                  >
                    <Sparkles className="h-4 w-4" />
                    IA
                  </Button>
                </div>

                {/* AI Quality Assistant */}
                {showAIAssistant && content.length >= 10 && (
                  <AIQualityAssistant 
                    content={content} 
                    onApplySuggestion={(tag) => setContent(content + " " + tag)}
                  />
                )}

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="flex gap-2 justify-center sm:justify-start">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-9 w-9"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={selectedImages.length >= 4}
                    >
                      <Image className="h-5 w-5 text-green-500" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9" disabled>
                      <Video className="h-5 w-5 text-red-500" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9" disabled>
                      <Smile className="h-5 w-5 text-yellow-500" />
                    </Button>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearAll}
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSubmit}
                      disabled={(!content.trim() && selectedImages.length === 0) || createPostMutation.isPending || isUploading}
                    >
                      {createPostMutation.isPending || isUploading ? "Publicando..." : "Publicar"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
