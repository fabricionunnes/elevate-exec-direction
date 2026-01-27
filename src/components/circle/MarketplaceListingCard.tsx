import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Eye, 
  Phone, 
  Flag, 
  MoreHorizontal,
  ExternalLink,
  Package,
  Briefcase,
  GraduationCap,
  Handshake,
  Sparkles,
  BarChart3
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { NavLink } from "react-router-dom";
import { TrustScoreBadge } from "./TrustScoreBadge";
import { ReportContentDialog } from "./ReportContentDialog";

const categoryConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  servicos: { label: "Serviços", icon: Briefcase, color: "text-blue-500" },
  produtos: { label: "Produtos", icon: Package, color: "text-green-500" },
  cursos: { label: "Cursos", icon: GraduationCap, color: "text-purple-500" },
  parcerias: { label: "Parcerias", icon: Handshake, color: "text-orange-500" },
  oportunidades: { label: "Oportunidades", icon: Sparkles, color: "text-yellow-500" },
};

const priceTypeLabels: Record<string, string> = {
  fixed: "Preço fixo",
  negotiable: "Negociável",
  free: "Gratuito",
  contact: "Consultar",
};

interface MarketplaceListingCardProps {
  listing: {
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
      trust_score?: number;
      is_verified?: boolean;
    };
    images: {
      id: string;
      image_url: string;
    }[];
    analytics?: {
      view_count: number;
      whatsapp_clicks: number;
    };
  };
  currentProfileId?: string;
  onContact: () => void;
  onView?: () => void;
  showAnalytics?: boolean;
}

export function MarketplaceListingCard({
  listing,
  currentProfileId,
  onContact,
  onView,
  showAnalytics = false,
}: MarketplaceListingCardProps) {
  const [reportOpen, setReportOpen] = useState(false);
  const categoryInfo = categoryConfig[listing.category] || categoryConfig.servicos;
  const CategoryIcon = categoryInfo.icon;

  const formatPrice = (price: number | null, priceType: string) => {
    if (priceType === "free") return "Gratuito";
    if (priceType === "contact") return "Consultar";
    if (price === null) return priceTypeLabels[priceType];
    return `R$ ${price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  };

  const isOwner = currentProfileId === listing.profile_id;
  const trustScore = listing.profile.trust_score ?? 50;
  const isVerified = listing.profile.is_verified ?? false;

  // Badges de reputação
  const getReputationBadges = () => {
    const badges: { label: string; color: string }[] = [];
    
    if (trustScore >= 80) {
      badges.push({ label: "Vendedor Confiável", color: "bg-green-500/10 text-green-600 border-green-500/20" });
    }
    if (listing.contacts_count >= 10) {
      badges.push({ label: "Top Marketplace", color: "bg-purple-500/10 text-purple-600 border-purple-500/20" });
    }
    if (isVerified) {
      badges.push({ label: "Verificado", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" });
    }
    
    return badges;
  };

  const reputationBadges = getReputationBadges();

  return (
    <>
      <Card className={cn(
        "overflow-hidden hover:shadow-lg transition-shadow",
        listing.is_featured && "ring-2 ring-yellow-500/50"
      )}>
        {/* Image */}
        {listing.images?.[0] && (
          <div className="aspect-video relative overflow-hidden bg-muted">
            <img
              src={listing.images[0].image_url}
              alt={listing.title}
              className="w-full h-full object-cover"
            />
            {listing.is_featured && (
              <Badge className="absolute top-2 left-2 bg-yellow-500 text-yellow-950">
                Destaque
              </Badge>
            )}
          </div>
        )}

        <CardContent className="p-4 space-y-3">
          {/* Category */}
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn("text-xs", categoryInfo.color)}>
              <CategoryIcon className="h-3 w-3 mr-1" />
              {categoryInfo.label}
            </Badge>
            {reputationBadges.map((badge, idx) => (
              <Badge key={idx} variant="outline" className={cn("text-xs", badge.color)}>
                {badge.label}
              </Badge>
            ))}
          </div>

          {/* Title & Price */}
          <div>
            <h3 className="font-semibold line-clamp-1">{listing.title}</h3>
            <p className="text-lg font-bold text-primary">
              {formatPrice(listing.price, listing.price_type)}
            </p>
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground line-clamp-2">
            {listing.description}
          </p>

          {/* Seller Info */}
          <div className="flex items-center gap-3 pt-2 border-t">
            <NavLink to={`/circle/profile/${listing.profile.id}`}>
              <Avatar className="h-8 w-8">
                <AvatarImage src={listing.profile.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {listing.profile.display_name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </NavLink>
            <div className="flex-1 min-w-0">
              <NavLink 
                to={`/circle/profile/${listing.profile.id}`}
                className="text-sm font-medium hover:underline line-clamp-1"
              >
                {listing.profile.display_name}
              </NavLink>
              {listing.profile.company_name && (
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {listing.profile.company_name}
                </p>
              )}
            </div>
            <TrustScoreBadge score={trustScore} isVerified={isVerified} size="sm" />
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {listing.views_count} visualizações
            </span>
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {listing.contacts_count} contatos
            </span>
          </div>

          {/* Analytics (for owner) */}
          {showAnalytics && isOwner && listing.analytics && (
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Analytics</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Visualizações</p>
                  <p className="font-bold">{listing.analytics.view_count}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Cliques WhatsApp</p>
                  <p className="font-bold">{listing.analytics.whatsapp_clicks}</p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <Button 
              className="flex-1" 
              size="sm"
              onClick={onContact}
            >
              <Phone className="h-4 w-4 mr-2" />
              Falar no WhatsApp
            </Button>
            
            {!isOwner && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="shrink-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setReportOpen(true)}>
                    <Flag className="h-4 w-4 mr-2" />
                    Denunciar anúncio
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Time */}
          <p className="text-xs text-muted-foreground text-center">
            {formatDistanceToNow(new Date(listing.created_at), {
              addSuffix: true,
              locale: ptBR,
            })}
          </p>
        </CardContent>
      </Card>

      <ReportContentDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        contentType="listing"
        contentId={listing.id}
        reportedProfileId={listing.profile_id}
      />
    </>
  );
}
