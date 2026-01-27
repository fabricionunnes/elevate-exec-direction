import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Plus, Phone, Loader2, X, Video, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MediaFile {
  url: string;
  type: "image" | "video";
}

const categoryConfig: Record<string, { label: string }> = {
  servicos: { label: "Serviços" },
  produtos: { label: "Produtos" },
  cursos: { label: "Cursos" },
  parcerias: { label: "Parcerias" },
  oportunidades: { label: "Oportunidades" },
};

const offerTypeLabels: Record<string, string> = {
  venda: "Venda",
  servico: "Serviço",
  parceria: "Parceria",
};

const priceTypeLabels: Record<string, string> = {
  fixed: "Preço fixo",
  negotiable: "Negociável",
  free: "Gratuito",
  contact: "Consultar",
};

interface MarketplaceCreateAdProps {
  currentProfileId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MarketplaceCreateAd({ currentProfileId, open, onOpenChange }: MarketplaceCreateAdProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("servicos");
  const [offerType, setOfferType] = useState("servico");
  const [price, setPrice] = useState("");
  const [priceType, setPriceType] = useState("negotiable");
  const [whatsapp, setWhatsapp] = useState("");
  const [whatsappMessage, setWhatsappMessage] = useState("Olá, vi seu anúncio no UNV Circle e quero saber mais!");
  const [media, setMedia] = useState<MediaFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setCategory("servicos");
    setOfferType("servico");
    setPrice("");
    setPriceType("negotiable");
    setWhatsapp("");
    setWhatsappMessage("Olá, vi seu anúncio no UNV Circle e quero saber mais!");
    setMedia([]);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const maxFiles = 6;
    const remainingSlots = maxFiles - media.length;
    if (remainingSlots <= 0) {
      toast({ title: `Máximo de ${maxFiles} arquivos permitidos`, variant: "destructive" });
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    setUploading(true);

    try {
      const newMedia: MediaFile[] = [];

      for (const file of filesToProcess) {
        const isVideo = file.type.startsWith("video/");
        const isImage = file.type.startsWith("image/");

        if (!isVideo && !isImage) {
          toast({ title: "Formato não suportado. Use imagens ou vídeos.", variant: "destructive" });
          continue;
        }

        const maxSize = isVideo ? 50 : 10;
        if (file.size > maxSize * 1024 * 1024) {
          toast({ 
            title: `${isVideo ? "Vídeo" : "Imagem"} deve ter no máximo ${maxSize}MB`, 
            variant: "destructive" 
          });
          continue;
        }

        const fileExt = file.name.split(".").pop();
        const fileName = `marketplace/${currentProfileId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("circle-media")
          .upload(fileName, file, { upsert: true });

        if (uploadError) {
          console.error("Upload error:", uploadError);
          toast({ title: "Erro ao fazer upload", variant: "destructive" });
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from("circle-media")
          .getPublicUrl(fileName);

        newMedia.push({
          url: publicUrl,
          type: isVideo ? "video" : "image",
        });
      }

      if (newMedia.length > 0) {
        setMedia([...media, ...newMedia]);
      }
    } catch (error) {
      console.error("Media upload error:", error);
      toast({ title: "Erro ao fazer upload", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeMedia = (index: number) => {
    const newMedia = [...media];
    newMedia.splice(index, 1);
    setMedia(newMedia);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!currentProfileId) throw new Error("Not authenticated");

      // Create listing
      const { data: listing, error: listingError } = await supabase
        .from("circle_marketplace_listings")
        .insert({
          profile_id: currentProfileId,
          title,
          description,
          category,
          offer_type: offerType,
          price: price ? parseFloat(price) : null,
          price_type: priceType,
          whatsapp: whatsapp.replace(/\D/g, ""),
          whatsapp_message: whatsappMessage || null,
        })
        .select("id")
        .single();

      if (listingError) throw listingError;

      // Insert images/videos if any
      if (media.length > 0 && listing) {
        const mediaInserts = media.map((m, idx) => ({
          listing_id: listing.id,
          image_url: m.url,
          media_type: m.type,
          sort_order: idx,
        }));

        const { error: mediaError } = await supabase
          .from("circle_marketplace_images")
          .insert(mediaInserts);

        if (mediaError) {
          console.error("Error inserting media:", mediaError);
          // Don't throw - listing was created successfully
        }
      }
    },
    onSuccess: () => {
      toast({ title: "Anúncio criado com sucesso!" });
      onOpenChange(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["circle-marketplace-listings"] });
    },
    onError: (error) => {
      console.error("Error creating listing:", error);
      toast({ title: "Erro ao criar anúncio", variant: "destructive" });
    },
  });

  const canSubmit = title.trim() && description.trim() && whatsapp.trim() && !createMutation.isPending && !uploading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Anúncio</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Título *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Consultoria em Vendas B2B"
            />
          </div>

          <div className="space-y-2">
            <Label>Descrição *</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva seu produto, serviço ou oportunidade..."
              rows={4}
            />
          </div>

          {/* Media Upload Section */}
          <div className="space-y-2">
            <Label>Fotos e Vídeos</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              disabled={uploading}
            />
            
            {media.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {media.map((item, index) => (
                  <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                    {item.type === "image" ? (
                      <img
                        src={item.url}
                        alt={`Upload ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <video
                        src={item.url}
                        className="w-full h-full object-cover"
                        muted
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => removeMedia(index)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    {item.type === "video" && (
                      <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/50 text-white text-xs flex items-center gap-1">
                        <Video className="h-2.5 w-2.5" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {media.length < 6 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full"
                size="sm"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Adicionar Fotos/Vídeos ({media.length}/6)
                  </>
                )}
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              Máximo 6 arquivos. Imagens até 10MB, vídeos até 50MB.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Oferta</Label>
              <Select value={offerType} onValueChange={setOfferType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(offerTypeLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Preço</Label>
              <Input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0,00"
                disabled={priceType === "free" || priceType === "contact"}
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de Preço</Label>
              <Select value={priceType} onValueChange={setPriceType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(priceTypeLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>WhatsApp para Contato *</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="(11) 99999-9999"
                className="pl-9"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Este número será usado para contato via WhatsApp
            </p>
          </div>

          <div className="space-y-2">
            <Label>Mensagem Padrão</Label>
            <Textarea
              value={whatsappMessage}
              onChange={(e) => setWhatsappMessage(e.target.value)}
              placeholder="Mensagem que será enviada junto do contato"
              rows={2}
            />
          </div>

          <Button
            onClick={() => createMutation.mutate()}
            disabled={!canSubmit}
            className="w-full"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Criando...
              </>
            ) : (
              "Publicar Anúncio"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
