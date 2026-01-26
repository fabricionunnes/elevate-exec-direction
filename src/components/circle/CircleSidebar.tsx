import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  Users, 
  Store, 
  Star,
  UserPlus,
  Trophy
} from "lucide-react";
import { NavLink } from "react-router-dom";

interface CircleSidebarProps {
  currentProfileId?: string;
}

export function CircleSidebar({ currentProfileId }: CircleSidebarProps) {
  // Fetch trending communities
  const { data: trendingCommunities } = useQuery({
    queryKey: ["circle-trending-communities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circle_communities")
        .select("id, name, slug, members_count, avatar_url, category")
        .eq("is_active", true)
        .order("members_count", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
  });

  // Fetch featured listings
  const { data: featuredListings } = useQuery({
    queryKey: ["circle-featured-listings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circle_marketplace_listings")
        .select(`
          id,
          title,
          price,
          price_type,
          category,
          profile:circle_profiles!circle_marketplace_listings_profile_id_fkey(
            display_name
          )
        `)
        .eq("status", "active")
        .order("views_count", { ascending: false })
        .limit(3);

      if (error) throw error;
      return data;
    },
  });

  // Fetch suggested profiles
  const { data: suggestedProfiles } = useQuery({
    queryKey: ["circle-suggested-profiles", currentProfileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circle_profiles")
        .select("id, display_name, avatar_url, company_name, current_level, level_name")
        .eq("is_active", true)
        .neq("id", currentProfileId || "")
        .order("total_points", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
  });

  // Fetch top ranking
  const { data: topRanking } = useQuery({
    queryKey: ["circle-top-ranking"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circle_profiles")
        .select("id, display_name, avatar_url, total_points, current_level")
        .eq("is_active", true)
        .order("total_points", { ascending: false })
        .limit(3);

      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-4 sticky top-20">
      {/* Top Ranking */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Trophy className="h-4 w-4 text-yellow-500" />
            Top Ranking
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {topRanking?.map((profile, index) => (
            <NavLink
              key={profile.id}
              to={`/circle/profile/${profile.id}`}
              className="flex items-center gap-3 hover:bg-muted rounded-lg p-2 -mx-2 transition-colors"
            >
              <span className="font-bold text-muted-foreground w-4">
                {index + 1}
              </span>
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {profile.display_name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{profile.display_name}</p>
                <p className="text-xs text-muted-foreground">
                  {profile.total_points?.toLocaleString()} pts
                </p>
              </div>
            </NavLink>
          ))}
          <NavLink to="/circle/ranking">
            <Button variant="ghost" size="sm" className="w-full">
              Ver ranking completo
            </Button>
          </NavLink>
        </CardContent>
      </Card>

      {/* Trending Communities */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            Comunidades em alta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {trendingCommunities?.map((community) => (
            <NavLink
              key={community.id}
              to={`/circle/community/${community.slug}`}
              className="flex items-center gap-3 hover:bg-muted rounded-lg p-2 -mx-2 transition-colors"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={community.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {community.name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{community.name}</p>
                <p className="text-xs text-muted-foreground">
                  <Users className="h-3 w-3 inline mr-1" />
                  {community.members_count}
                </p>
              </div>
            </NavLink>
          ))}
          <NavLink to="/circle/communities">
            <Button variant="ghost" size="sm" className="w-full">
              Ver todas
            </Button>
          </NavLink>
        </CardContent>
      </Card>

      {/* Featured Listings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Store className="h-4 w-4 text-blue-500" />
            Destaques do Marketplace
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {featuredListings?.map((listing: any) => (
            <NavLink
              key={listing.id}
              to="/circle/marketplace"
              className="block hover:bg-muted rounded-lg p-2 -mx-2 transition-colors"
            >
              <p className="text-sm font-medium truncate">{listing.title}</p>
              <p className="text-xs text-muted-foreground">
                por {listing.profile?.display_name}
              </p>
              {listing.price && (
                <p className="text-sm font-bold text-primary mt-1">
                  R$ {listing.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              )}
            </NavLink>
          ))}
          <NavLink to="/circle/marketplace">
            <Button variant="ghost" size="sm" className="w-full">
              Ver marketplace
            </Button>
          </NavLink>
        </CardContent>
      </Card>

      {/* Suggested Profiles */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-purple-500" />
            Sugestões para seguir
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {suggestedProfiles?.slice(0, 3).map((profile) => (
            <NavLink
              key={profile.id}
              to={`/circle/profile/${profile.id}`}
              className="flex items-center gap-3 hover:bg-muted rounded-lg p-2 -mx-2 transition-colors"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {profile.display_name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{profile.display_name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {profile.company_name || profile.level_name}
                </p>
              </div>
              <Badge variant="secondary" className="text-xs">
                <Star className="h-3 w-3 mr-1" />
                {profile.current_level}
              </Badge>
            </NavLink>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
