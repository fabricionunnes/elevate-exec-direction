import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { 
  Loader2, Sparkles, Wand2, Image as ImageIcon, Plus, 
  Download, Copy, CheckCircle, RefreshCw, FileText, Video,
  LayoutGrid, Send, Lightbulb, Palette, Upload, X, Link2
} from "lucide-react";
import { toast } from "sonner";

interface SocialAITabProps {
  projectId: string;
  boardId: string;
}

interface Suggestion {
  format: string;
  title: string;
  theme: string;
  objective: string;
  description: string;
  copy: string;
  visual_description: string;
  cta: string;
}

interface GeneratedImage {
  url: string;
  prompt: string;
  format: string;
  carouselImages?: string[];
}

const FORMAT_ICONS: Record<string, typeof FileText> = {
  feed_post: FileText,
  carousel: LayoutGrid,
  reel: Video,
  story: FileText,
};

const FORMAT_LABELS: Record<string, string> = {
  feed_post: "Feed Post",
  carousel: "Carrossel",
  reel: "Reels",
  story: "Stories",
};

export const SocialAITab = ({ projectId, boardId }: SocialAITabProps) => {
  const [activeTab, setActiveTab] = useState("suggestions");
  
  // Suggestions state
  const [contentType, setContentType] = useState("all");
  const [quantity, setQuantity] = useState("5");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  
  // Image generation state
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageFormat, setImageFormat] = useState("feed_post");
  const [includeLogo, setIncludeLogo] = useState(true);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [loadingImage, setLoadingImage] = useState(false);
  
  // Carousel options
  const [carouselCount, setCarouselCount] = useState("3");
  const [carouselConnected, setCarouselConnected] = useState(false);
  
  // Reference image upload
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [uploadingReference, setUploadingReference] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Card creation state
  const [creatingCard, setCreatingCard] = useState<string | null>(null);

  const handleReferenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx 5MB)");
      return;
    }

    setUploadingReference(true);
    try {
      // Sanitize filename: remove accents, special chars, and spaces
      const sanitizedName = file.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove accents
        .replace(/[^a-zA-Z0-9.-]/g, "_"); // Replace special chars with underscore
      const fileName = `${projectId}/reference/${Date.now()}-${sanitizedName}`;
      const { error: uploadError } = await supabase.storage
        .from("social-briefing")
        .upload(fileName, file, {
          contentType: file.type,
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("social-briefing")
        .getPublicUrl(fileName);

      setReferenceImage(publicUrl);
      toast.success("Imagem de referência carregada!");
    } catch (error) {
      console.error("Error uploading reference:", error);
      toast.error("Erro ao carregar imagem");
    } finally {
      setUploadingReference(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeReferenceImage = () => {
    setReferenceImage(null);
  };

  const handleGenerateSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const { data, error } = await supabase.functions.invoke("social-ai-suggestions", {
        body: { 
          projectId, 
          contentType: contentType === "all" ? "all" : contentType,
          quantity: parseInt(quantity)
        }
      });

      if (error) throw error;
      
      if (data.error) {
        toast.error(data.error, {
          description: data.details || undefined,
          duration: 5000
        });
        return;
      }

      setSuggestions(data.suggestions || []);
      toast.success(`${data.suggestions?.length || 0} sugestões geradas!`);
    } catch (error) {
      console.error("Error generating suggestions:", error);
      toast.error("Erro ao gerar sugestões");
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) {
      toast.error("Digite uma descrição para a imagem");
      return;
    }

    setLoadingImage(true);
    try {
      const isCarousel = imageFormat === "carousel";
      const imagesCount = isCarousel ? parseInt(carouselCount) : 1;
      
      const { data, error } = await supabase.functions.invoke("social-ai-generate-image", {
        body: { 
          projectId, 
          prompt: imagePrompt,
          format: imageFormat,
          includeLogoPref: includeLogo,
          carouselCount: isCarousel ? imagesCount : undefined,
          carouselConnected: isCarousel ? carouselConnected : undefined,
          referenceImageUrl: referenceImage || undefined
        }
      });

      if (error) throw error;
      
      if (data.error) {
        toast.error(data.error);
        return;
      }

      if (data.images && data.images.length > 0) {
        setGeneratedImages(prev => [{
          url: data.images[0],
          prompt: imagePrompt,
          format: imageFormat,
          carouselImages: data.images
        }, ...prev]);
        toast.success(`${data.images.length} imagens do carrossel geradas!`);
        setImagePrompt("");
        setReferenceImage(null);
      } else if (data.image_url) {
        setGeneratedImages(prev => [{
          url: data.image_url,
          prompt: imagePrompt,
          format: imageFormat
        }, ...prev]);
        toast.success("Imagem gerada com sucesso!");
        setImagePrompt("");
        setReferenceImage(null);
      }
    } catch (error) {
      console.error("Error generating image:", error);
      toast.error("Erro ao gerar imagem", {
        description: "Tente novamente ou reformule o prompt"
      });
    } finally {
      setLoadingImage(false);
    }
  };

  const handleCreateCardFromSuggestion = async (suggestion: Suggestion) => {
    setCreatingCard(suggestion.title);
    try {
      // Get first stage of the board
      const { data: stages, error: stagesError } = await supabase
        .from("social_content_stages")
        .select("id")
        .eq("board_id", boardId)
        .eq("is_active", true)
        .order("sort_order")
        .limit(1);

      if (stagesError) throw stagesError;
      
      if (!stages || stages.length === 0) {
        toast.error("Nenhuma etapa encontrada no pipeline");
        return;
      }

      const stageId = stages[0].id;

      // Create card with proper typing
      const cardData = {
        board_id: boardId,
        stage_id: stageId,
        content_type: (suggestion.format === "reel" ? "reels" : suggestion.format === "story" ? "stories" : "feed") as "feed" | "reels" | "stories",
        theme: suggestion.theme,
        copy_text: suggestion.copy,
        final_caption: suggestion.copy,
        cta: suggestion.cta,
      };
      
      const { error: cardError } = await supabase
        .from("social_content_cards")
        .insert([cardData]);

      if (cardError) throw cardError;

      toast.success("Card criado no pipeline!");
    } catch (error) {
      console.error("Error creating card:", error);
      toast.error("Erro ao criar card");
    } finally {
      setCreatingCard(null);
    }
  };

  const handleCopySuggestion = (suggestion: Suggestion) => {
    const text = `**${suggestion.title}**

📌 Formato: ${FORMAT_LABELS[suggestion.format] || suggestion.format}
🎯 Objetivo: ${suggestion.objective}
📝 Tema: ${suggestion.theme}

${suggestion.description}

---
COPY:
${suggestion.copy}

---
VISUAL:
${suggestion.visual_description}

CTA: ${suggestion.cta}`;

    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência!");
  };

  const handleGenerateImageFromSuggestion = (visualDescription: string) => {
    setActiveTab("images");
    setImagePrompt(visualDescription);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b bg-gradient-to-r from-primary/10 via-accent/10 to-secondary/10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-primary to-accent rounded-xl">
            <Sparkles className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-bold">IA Criativa</h2>
            <p className="text-sm text-muted-foreground">
              Geração de ideias e imagens com inteligência artificial
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="border-b px-6">
          <TabsList className="h-12 bg-transparent">
            <TabsTrigger value="suggestions" className="gap-2 data-[state=active]:bg-primary/10">
              <Lightbulb className="h-4 w-4" />
              Sugestões de Conteúdo
            </TabsTrigger>
            <TabsTrigger value="images" className="gap-2 data-[state=active]:bg-primary/10">
              <Palette className="h-4 w-4" />
              Gerador de Imagens
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-hidden">
          {/* Suggestions Tab */}
          <TabsContent value="suggestions" className="h-full m-0">
            <div className="p-6 space-y-6 h-full overflow-auto">
              {/* Generator Form */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-end gap-4">
                    <div className="flex-1 min-w-[200px] space-y-2">
                      <Label>Tipo de Conteúdo</Label>
                      <Select value={contentType} onValueChange={setContentType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os formatos</SelectItem>
                          <SelectItem value="feed_post">Feed Posts</SelectItem>
                          <SelectItem value="carousel">Carrosséis</SelectItem>
                          <SelectItem value="reel">Reels</SelectItem>
                          <SelectItem value="story">Stories</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-32 space-y-2">
                      <Label>Quantidade</Label>
                      <Select value={quantity} onValueChange={setQuantity}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="3">3 ideias</SelectItem>
                          <SelectItem value="5">5 ideias</SelectItem>
                          <SelectItem value="10">10 ideias</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button 
                      onClick={handleGenerateSuggestions}
                      disabled={loadingSuggestions}
                      className="gap-2"
                    >
                      {loadingSuggestions ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Wand2 className="h-4 w-4" />
                      )}
                      Gerar Sugestões
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Suggestions List */}
              {suggestions.length === 0 ? (
                <Card className="border-dashed border-2">
                  <CardContent className="p-12 text-center">
                    <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <h4 className="font-medium mb-1">Nenhuma sugestão ainda</h4>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      Clique em "Gerar Sugestões" para que a IA analise o briefing e perfil da empresa
                      e crie ideias de conteúdo personalizadas.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {suggestions.map((suggestion, index) => {
                    const FormatIcon = FORMAT_ICONS[suggestion.format] || FileText;
                    return (
                      <Card key={index} className="overflow-hidden">
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-md bg-primary/10">
                                <FormatIcon className="h-4 w-4 text-primary" />
                              </div>
                              <Badge variant="secondary" className="text-xs">
                                {FORMAT_LABELS[suggestion.format] || suggestion.format}
                              </Badge>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {suggestion.theme}
                            </Badge>
                          </div>
                          <CardTitle className="text-base mt-2">{suggestion.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <p className="text-sm text-muted-foreground">{suggestion.description}</p>
                          
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">🎯 Objetivo</Label>
                            <p className="text-sm">{suggestion.objective}</p>
                          </div>

                          <Separator />

                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">📝 Copy</Label>
                            <p className="text-sm whitespace-pre-wrap bg-muted/50 p-2 rounded-md max-h-24 overflow-auto">
                              {suggestion.copy}
                            </p>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">🎨 Visual</Label>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {suggestion.visual_description}
                            </p>
                          </div>

                          <Separator />

                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 flex-1"
                              onClick={() => handleCopySuggestion(suggestion)}
                            >
                              <Copy className="h-3 w-3" />
                              Copiar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 flex-1"
                              onClick={() => handleGenerateImageFromSuggestion(suggestion.visual_description)}
                            >
                              <ImageIcon className="h-3 w-3" />
                              Gerar Imagem
                            </Button>
                            <Button
                              size="sm"
                              className="gap-1.5 flex-1"
                              disabled={creatingCard === suggestion.title}
                              onClick={() => handleCreateCardFromSuggestion(suggestion)}
                            >
                              {creatingCard === suggestion.title ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Plus className="h-3 w-3" />
                              )}
                              Criar Card
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Image Generation Tab */}
          <TabsContent value="images" className="h-full m-0">
            <div className="p-6 space-y-6 h-full overflow-auto">
              {/* Generator Form */}
              <Card>
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <Label>Descrição da Imagem</Label>
                    <Textarea
                      placeholder="Descreva a imagem que você quer gerar. Ex: Uma foto profissional de um café artesanal com grãos torrados, em ambiente aconchegante com iluminação quente..."
                      value={imagePrompt}
                      onChange={(e) => setImagePrompt(e.target.value)}
                      rows={3}
                    />
                  </div>

                  {/* Reference Image Upload */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      Imagem de Referência (opcional)
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Envie uma foto de produto, pessoa ou elemento que deve aparecer na imagem gerada.
                    </p>
                    
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleReferenceUpload}
                    />
                    
                    {referenceImage ? (
                      <div className="flex items-center gap-3 p-2 bg-muted rounded-lg">
                        <img 
                          src={referenceImage} 
                          alt="Referência" 
                          className="h-16 w-16 object-cover rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">Imagem carregada</p>
                          <p className="text-xs text-muted-foreground">Esta imagem será incorporada na geração</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={removeReferenceImage}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full gap-2"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingReference}
                      >
                        {uploadingReference ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                        {uploadingReference ? "Enviando..." : "Enviar imagem de referência"}
                      </Button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-end gap-4">
                    <div className="flex-1 min-w-[200px] space-y-2">
                      <Label>Formato</Label>
                      <Select value={imageFormat} onValueChange={setImageFormat}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="feed_post">Feed Post (4:5)</SelectItem>
                          <SelectItem value="carousel">Carrossel (4:5)</SelectItem>
                          <SelectItem value="story">Stories / Reels (9:16)</SelectItem>
                          <SelectItem value="cover">Capa / Banner (16:9)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {imageFormat === "carousel" && (
                      <>
                        <div className="w-32 space-y-2">
                          <Label>Qtd. Imagens</Label>
                          <Select value={carouselCount} onValueChange={setCarouselCount}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="2">2 imagens</SelectItem>
                              <SelectItem value="3">3 imagens</SelectItem>
                              <SelectItem value="4">4 imagens</SelectItem>
                              <SelectItem value="5">5 imagens</SelectItem>
                              <SelectItem value="6">6 imagens</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="flex items-center gap-2 pb-1">
                          <Switch 
                            id="carousel-connected" 
                            checked={carouselConnected}
                            onCheckedChange={setCarouselConnected}
                          />
                          <Label htmlFor="carousel-connected" className="text-sm cursor-pointer flex items-center gap-1.5">
                            <Link2 className="h-4 w-4" />
                            Conectado
                          </Label>
                        </div>
                      </>
                    )}
                    
                    <div className="flex items-center gap-2">
                      <Switch 
                        id="include-logo" 
                        checked={includeLogo}
                        onCheckedChange={setIncludeLogo}
                      />
                      <Label htmlFor="include-logo" className="text-sm cursor-pointer">
                        Incluir logo
                      </Label>
                    </div>

                    <Button 
                      onClick={handleGenerateImage}
                      disabled={loadingImage || !imagePrompt.trim()}
                      className="gap-2"
                    >
                      {loadingImage ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Wand2 className="h-4 w-4" />
                      )}
                      {imageFormat === "carousel" ? `Gerar ${carouselCount} Imagens` : "Gerar Imagem"}
                    </Button>
                  </div>

                  {imageFormat === "carousel" && carouselConnected && (
                    <div className="p-3 bg-primary/10 rounded-lg text-sm">
                      <strong>Carrossel Conectado:</strong> A IA vai gerar uma imagem panorâmica que será dividida em {carouselCount} partes, 
                      criando um efeito de continuidade ao deslizar no Instagram.
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Generated Images */}
              {generatedImages.length === 0 ? (
                <Card className="border-dashed border-2">
                  <CardContent className="p-12 text-center">
                    <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <h4 className="font-medium mb-1">Nenhuma imagem gerada</h4>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      Descreva a imagem que você quer criar e a IA vai gerar uma imagem 
                      alinhada com a identidade visual da marca.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {generatedImages.map((image, index) => (
                    <Card key={index} className="overflow-hidden group">
                      {image.carouselImages && image.carouselImages.length > 1 ? (
                        <div className="relative">
                          <div className="flex overflow-x-auto snap-x snap-mandatory">
                            {image.carouselImages.map((imgUrl, imgIndex) => (
                              <div 
                                key={imgIndex} 
                                className="flex-shrink-0 w-full aspect-[4/5] snap-center relative bg-muted"
                              >
                                <img 
                                  src={imgUrl} 
                                  alt={`${image.prompt} - ${imgIndex + 1}`}
                                  className="w-full h-full object-contain"
                                />
                                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                                  {imgIndex + 1}/{image.carouselImages!.length}
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 pointer-events-none group-hover:pointer-events-auto">
                            {image.carouselImages.map((imgUrl, imgIndex) => (
                              <Button key={imgIndex} size="icon" variant="secondary" asChild>
                                <a href={imgUrl} target="_blank" rel="noopener noreferrer" download>
                                  <Download className="h-4 w-4" />
                                </a>
                              </Button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="aspect-[4/5] relative bg-muted">
                          <img 
                            src={image.url} 
                            alt={image.prompt}
                            className="w-full h-full object-contain"
                          />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <Button size="icon" variant="secondary" asChild>
                              <a href={image.url} target="_blank" rel="noopener noreferrer" download>
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                          </div>
                        </div>
                      )}
                      <CardContent className="p-3">
                        <Badge variant="secondary" className="mb-2 text-xs">
                          {image.format === "carousel" 
                            ? `Carrossel (${image.carouselImages?.length || 1}x)` 
                            : image.format === "feed_post" 
                              ? "4:5" 
                              : image.format === "story" 
                                ? "9:16" 
                                : "16:9"
                          }
                        </Badge>
                        <p className="text-sm text-muted-foreground line-clamp-2">{image.prompt}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};
