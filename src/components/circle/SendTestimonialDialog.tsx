import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, Camera, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCircleCurrentProfile } from "@/hooks/useCircleCurrentProfile";

interface SendTestimonialDialogProps {
  recipientProfile: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    company_name?: string | null;
  };
  trigger?: React.ReactNode;
}

export function SendTestimonialDialog({ recipientProfile, trigger }: SendTestimonialDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: currentProfile } = useCircleCurrentProfile();
  
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "Imagem muito grande", description: "Máximo 5MB", variant: "destructive" });
        return;
      }
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
  };

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!currentProfile?.id) throw new Error("Not authenticated");
      if (!content.trim()) throw new Error("Content required");

      let imageUrl: string | null = null;

      // Upload image if selected
      if (selectedImage) {
        const fileExt = selectedImage.name.split(".").pop();
        const fileName = `${currentProfile.id}-${Date.now()}.${fileExt}`;
        const filePath = `testimonials/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("circle-media")
          .upload(filePath, selectedImage);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("circle-media")
          .getPublicUrl(filePath);

        imageUrl = urlData.publicUrl;
      }

      // Insert testimonial
      const { error } = await supabase.from("circle_testimonials").insert({
        author_profile_id: currentProfile.id,
        recipient_profile_id: recipientProfile.id,
        content: content.trim(),
        image_url: imageUrl,
        is_public: true,
        is_approved: false, // Requires approval from recipient
        is_active: true,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ 
        title: "Depoimento enviado!", 
        description: "O usuário precisa aprovar para que apareça no perfil." 
      });
      setOpen(false);
      setContent("");
      removeImage();
      queryClient.invalidateQueries({ queryKey: ["circle-profile-testimonials"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao enviar depoimento", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  // Don't show if viewing own profile
  if (currentProfile?.id === recipientProfile.id) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <Heart className="h-4 w-4 mr-2" />
            Enviar Depoimento
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enviar Depoimento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Recipient info */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <Avatar>
              <AvatarImage src={recipientProfile.avatar_url || undefined} />
              <AvatarFallback>
                {recipientProfile.display_name?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{recipientProfile.display_name}</p>
              {recipientProfile.company_name && (
                <p className="text-sm text-muted-foreground">
                  {recipientProfile.company_name}
                </p>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="space-y-2">
            <Label>Seu depoimento</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Compartilhe sua experiência trabalhando com essa pessoa..."
              rows={4}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">
              {content.length}/500
            </p>
          </div>

          {/* Image upload */}
          <div className="space-y-2">
            <Label>Adicionar foto (opcional)</Label>
            {imagePreview ? (
              <div className="relative">
                <img 
                  src={imagePreview} 
                  alt="Preview" 
                  className="w-full h-48 object-cover rounded-lg"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8"
                  onClick={removeImage}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-muted-foreground/30 rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                <Camera className="h-8 w-8 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">
                  Clique para adicionar uma foto
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Info */}
          <p className="text-xs text-muted-foreground">
            O depoimento será enviado para aprovação. Após aprovado, aparecerá no perfil do usuário.
          </p>

          {/* Submit */}
          <Button 
            onClick={() => sendMutation.mutate()}
            disabled={!content.trim() || sendMutation.isPending}
            className="w-full"
          >
            {sendMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Heart className="h-4 w-4 mr-2" />
                Enviar Depoimento
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
