import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Plus, 
  Search, 
  MessageCircle,
  ExternalLink,
  Eye,
  Heart,
  Star,
  Package,
  Briefcase,
  GraduationCap,
  Handshake,
  Sparkles,
  Filter,
  Phone
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { NavLink } from "react-router-dom";

const categoryConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  servicos: { label: "Serviços", icon: Briefcase, color: "text-blue-500" },
  produtos: { label: "Produtos", icon: Package, color: "text-green-500" },
  cursos: { label: "Cursos", icon: GraduationCap, color: "text-purple-500" },
  parcerias: { label: "Parcerias", icon: Handshake, color: "text-orange-500" },
  oportunidades: { label: "Oportunidades", icon: Sparkles, color: "text-yellow-500" },
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

interface MarketplaceListing {
  id: string;
  profile_id: string;
  title: string;
  description: string;
  category: string;
  offer_type: string;
  price: number | null;
  price_type: string;
  whatsapp: string;
  whatsapp_message: string | null;
  views_count: number;
  contacts_count: number;
  status: string;
  is_featured: boolean;
  created_at: string;
  profile: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    company_name: string | null;
    current_level: number;
    level_name: string;
  };
  images: {
    id: string;
    image_url: string;
    sort_order: number;
  }[];
}

export default function CircleMarketplacePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedOfferType, setSelectedOfferType] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState<MarketplaceListing | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("servicos");
  const [offerType, setOfferType] = useState("servico");
  const [price, setPrice] = useState("");
  const [priceType, setPriceType] = useState("negotiable");
  const [whatsapp, setWhatsapp] = useState("");
  const [whatsappMessage, setWhatsappMessage] = useState("Olá, vi seu anúncio no UNV Circle e quero saber mais!");

  // Fetch current profile
  const { data: currentProfile } = useQuery({
    queryKey: ["circle-profile-current"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("circle_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  // Fetch listings
  const { data: listings, isLoading } = useQuery({
    queryKey: ["circle-marketplace-listings", searchQuery, selectedCategory, selectedOfferType],
    queryFn: async () => {
      let query = supabase
        .from("circle_marketplace_listings")
        .select(`
          *,
          profile:circle_profiles!circle_marketplace_listings_profile_id_fkey(
            id,
            display_name,
            avatar_url,
            company_name,
            current_level,
            level_name
          ),
          images:circle_marketplace_images(
            id,
            image_url,
            sort_order
          )
        `)
        .eq("status", "active")
        .order("is_featured", { ascending: false })
        .order("created_at", { ascending: false });

      if (searchQuery) {
        query = query.ilike("title", `%${searchQuery}%`);
      }

      if (selectedCategory) {
        query = query.eq("category", selectedCategory);
      }

      if (selectedOfferType) {
        query = query.eq("offer_type", selectedOfferType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as MarketplaceListing[];
    },
  });

  // Fetch user's favorites
  const { data: userFavorites } = useQuery({
    queryKey: ["circle-user-favorites", currentProfile?.id],
    queryFn: async () => {
      if (!currentProfile?.id) return [];

      const { data, error } = await supabase
        .from("circle_marketplace_favorites")
        .select("listing_id")
        .eq("profile_id", currentProfile.id);

      if (error) throw error;
      return data.map(f => f.listing_id);
    },
    enabled: !!currentProfile?.id,
  });

  // Create listing mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!currentProfile?.id) throw new Error("Not authenticated");

      const { error } = await supabase.from("circle_marketplace_listings").insert({
        profile_id: currentProfile.id,
        title,
        description,
        category,
        offer_type: offerType,
        price: price ? parseFloat(price) : null,
        price_type: priceType,
        whatsapp: whatsapp.replace(/\D/g, ""),
        whatsapp_message: whatsappMessage || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Anúncio criado com sucesso!" });
      setCreateDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["circle-marketplace-listings"] });
    },
    onError: () => {
      toast({ title: "Erro ao criar anúncio", variant: "destructive" });
    },
  });

  // Toggle favorite mutation
  const favoriteMutation = useMutation({
    mutationFn: async ({ listingId, isFavorite }: { listingId: string; isFavorite: boolean }) => {
      if (!currentProfile?.id) throw new Error("Not authenticated");

      if (isFavorite) {
        await supabase
          .from("circle_marketplace_favorites")
          .delete()
          .eq("profile_id", currentProfile.id)
          .eq("listing_id", listingId);
      } else {
        await supabase.from("circle_marketplace_favorites").insert({
          profile_id: currentProfile.id,
          listing_id: listingId,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["circle-user-favorites"] });
    },
  });

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setCategory("servicos");
    setOfferType("servico");
    setPrice("");
    setPriceType("negotiable");
    setWhatsapp("");
    setWhatsappMessage("Olá, vi seu anúncio no UNV Circle e quero saber mais!");
  };

  const handleContactWhatsApp = (listing: MarketplaceListing) => {
    const phone = listing.whatsapp.replace(/\D/g, "");
    const message = encodeURIComponent(listing.whatsapp_message || `Olá! Vi seu anúncio "${listing.title}" no UNV Circle e gostaria de saber mais.`);
    window.open(`https://wa.me/55${phone}?text=${message}`, "_blank");

    // Update contacts count
    supabase
      .from("circle_marketplace_listings")
      .update({ contacts_count: listing.contacts_count + 1 })
      .eq("id", listing.id)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["circle-marketplace-listings"] });
      });
  };

  const handleViewListing = (listing: MarketplaceListing) => {
    setSelectedListing(listing);
    setDetailDialogOpen(true);

    // Update views count
    supabase
      .from("circle_marketplace_listings")
      .update({ views_count: listing.views_count + 1 })
      .eq("id", listing.id)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["circle-marketplace-listings"] });
      });
  };

  const formatPrice = (price: number | null, priceType: string) => {
    if (priceType === "free") return "Gratuito";
    if (priceType === "contact") return "Consultar";
    if (price === null) return priceTypeLabels[priceType];
    return `R$ ${price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}${priceType === "negotiable" ? " (Negociável)" : ""}`;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Marketplace</h1>
          <p className="text-muted-foreground">
            Produtos, serviços e oportunidades do ecossistema UNV
          </p>
        </div>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Criar Anúncio
            </Button>
          </DialogTrigger>
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
                          <div className="flex items-center gap-2">
                            <config.icon className={cn("h-4 w-4", config.color)} />
                            {config.label}
                          </div>
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
                disabled={!title.trim() || !description.trim() || !whatsapp.trim() || createMutation.isPending}
                className="w-full"
              >
                {createMutation.isPending ? "Criando..." : "Publicar Anúncio"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar anúncios..."
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedCategory === null ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(null)}
          >
            Todas Categorias
          </Button>
          {Object.entries(categoryConfig).map(([key, config]) => (
            <Button
              key={key}
              variant={selectedCategory === key ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(key)}
            >
              <config.icon className={cn("h-4 w-4 mr-1", selectedCategory !== key && config.color)} />
              {config.label}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedOfferType === null ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setSelectedOfferType(null)}
          >
            Todos os Tipos
          </Button>
          {Object.entries(offerTypeLabels).map(([key, label]) => (
            <Button
              key={key}
              variant={selectedOfferType === key ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setSelectedOfferType(key)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Listings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {listings?.map((listing) => {
          const config = categoryConfig[listing.category] || categoryConfig.servicos;
          const CategoryIcon = config.icon;
          const isFavorite = userFavorites?.includes(listing.id);

          return (
            <Card 
              key={listing.id} 
              className={cn(
                "overflow-hidden hover:shadow-md transition-shadow cursor-pointer",
                listing.is_featured && "ring-2 ring-yellow-400"
              )}
              onClick={() => handleViewListing(listing)}
            >
              {/* Image or Placeholder */}
              <div className="aspect-video bg-gradient-to-br from-muted to-muted/50 relative">
                {listing.images && listing.images.length > 0 ? (
                  <img
                    src={listing.images[0].image_url}
                    alt={listing.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <CategoryIcon className={cn("h-12 w-12 opacity-30", config.color)} />
                  </div>
                )}

                {listing.is_featured && (
                  <Badge className="absolute top-2 left-2 bg-yellow-500">
                    <Star className="h-3 w-3 mr-1" />
                    Destaque
                  </Badge>
                )}

                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "absolute top-2 right-2 bg-background/80 hover:bg-background",
                    isFavorite && "text-red-500"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    favoriteMutation.mutate({ listingId: listing.id, isFavorite: !!isFavorite });
                  }}
                >
                  <Heart className={cn("h-4 w-4", isFavorite && "fill-current")} />
                </Button>
              </div>

              <CardContent className="p-4 space-y-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary" className="text-xs">
                      <CategoryIcon className={cn("h-3 w-3 mr-1", config.color)} />
                      {config.label}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {offerTypeLabels[listing.offer_type]}
                    </Badge>
                  </div>
                  <h3 className="font-semibold line-clamp-1">{listing.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                    {listing.description}
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-bold text-primary">
                    {formatPrice(listing.price, listing.price_type)}
                  </span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Eye className="h-3 w-3" />
                    {listing.views_count}
                  </div>
                </div>

                {/* Seller Info */}
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={listing.profile.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {listing.profile.display_name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{listing.profile.display_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {listing.profile.company_name || listing.profile.level_name}
                    </p>
                  </div>
                </div>

                <Button 
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleContactWhatsApp(listing);
                  }}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Falar no WhatsApp
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {listings?.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum anúncio encontrado.</p>
          <p className="text-sm mt-1">Seja o primeiro a anunciar!</p>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedListing && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedListing.title}</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* Image */}
                {selectedListing.images && selectedListing.images.length > 0 ? (
                  <div className="aspect-video rounded-lg overflow-hidden">
                    <img
                      src={selectedListing.images[0].image_url}
                      alt={selectedListing.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                    {(() => {
                      const config = categoryConfig[selectedListing.category];
                      const Icon = config?.icon || Package;
                      return <Icon className="h-16 w-16 text-muted-foreground/30" />;
                    })()}
                  </div>
                )}

                {/* Badges */}
                <div className="flex flex-wrap gap-2">
                  <Badge>
                    {categoryConfig[selectedListing.category]?.label || selectedListing.category}
                  </Badge>
                  <Badge variant="outline">
                    {offerTypeLabels[selectedListing.offer_type]}
                  </Badge>
                  <Badge variant="secondary">
                    {formatPrice(selectedListing.price, selectedListing.price_type)}
                  </Badge>
                </div>

                {/* Description */}
                <div>
                  <h4 className="font-medium mb-2">Descrição</h4>
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {selectedListing.description}
                  </p>
                </div>

                {/* Seller */}
                <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={selectedListing.profile.avatar_url || undefined} />
                    <AvatarFallback>
                      {selectedListing.profile.display_name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{selectedListing.profile.display_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedListing.profile.company_name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        <Star className="h-3 w-3 mr-1" />
                        Nível {selectedListing.profile.current_level} - {selectedListing.profile.level_name}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Eye className="h-4 w-4" />
                    {selectedListing.views_count} visualizações
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle className="h-4 w-4" />
                    {selectedListing.contacts_count} contatos
                  </span>
                  <span>
                    {formatDistanceToNow(new Date(selectedListing.created_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </span>
                </div>

                {/* CTA */}
                <Button 
                  className="w-full bg-green-600 hover:bg-green-700"
                  size="lg"
                  onClick={() => handleContactWhatsApp(selectedListing)}
                >
                  <MessageCircle className="h-5 w-5 mr-2" />
                  Falar no WhatsApp
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
