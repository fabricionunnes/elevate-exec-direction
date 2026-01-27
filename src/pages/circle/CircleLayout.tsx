import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { 
  Home, 
  Users, 
  Store, 
  Trophy, 
  Camera,
  Bell,
  User,
  Menu,
  X,
  MessageCircle,
  Settings,
  Bot
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useCircleCurrentProfile } from "@/hooks/useCircleCurrentProfile";
import { FloatingChatBubble } from "@/components/circle/FloatingChatBubble";
import unvCircleLogo from "@/assets/unv-circle-logo.png";

const navItems = [
  { path: "/circle", label: "Feed", icon: Home, exact: true },
  { path: "/circle/stories", label: "Stories", icon: Camera },
  { path: "/circle/communities", label: "Comunidades", icon: Users },
  { path: "/circle/marketplace", label: "Marketplace", icon: Store },
  { path: "/circle/ranking", label: "Ranking", icon: Trophy },
  { path: "/circle/messages", label: "Mensagens", icon: MessageCircle },
  { path: "/circle/mentor", label: "Mentor IA", icon: Bot },
];

export default function CircleLayout() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Fetch (and ensure) current user's circle profile
  const { data: profile, isLoading: profileLoading } = useCircleCurrentProfile();

  // Fetch unread notifications count
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["circle-notifications-unread"],
    queryFn: async () => {
      if (!profile?.id) return 0;

      const { count, error } = await supabase
        .from("circle_notifications")
        .select("*", { count: "exact", head: true })
        .eq("profile_id", profile.id)
        .eq("is_read", false);

      if (error) return 0;
      return count || 0;
    },
    enabled: !!profile?.id,
  });

  const isActive = (path: string, exact?: boolean) => {
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  const NavLinks = ({ mobile = false, onClose }: { mobile?: boolean; onClose?: () => void }) => (
    <nav className={cn("flex", mobile ? "flex-col gap-1" : "items-center gap-1")}>
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          onClick={onClose}
          className={({ isActive: active }) =>
            cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all font-medium text-sm",
              active || isActive(item.path, item.exact)
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )
          }
          end={item.exact}
        >
          <item.icon className="h-4 w-4" />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <NavLink to="/circle" className="flex items-center gap-2">
              <img src={unvCircleLogo} alt="UNV Circle" className="h-9 w-9" />
              <span className="font-bold text-lg bg-gradient-to-r from-violet-500 to-pink-500 bg-clip-text text-transparent">
                UNV Circle
              </span>
            </NavLink>

            {/* Desktop Navigation */}
            <div className="hidden md:flex">
              <NavLinks />
            </div>

            {/* Right side actions */}
            <div className="flex items-center gap-2">
              {/* Notifications */}
              <NavLink to="/circle/notifications">
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <Badge 
                      className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                      variant="destructive"
                    >
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </Badge>
                  )}
                </Button>
              </NavLink>

              {/* Profile */}
              <NavLink to="/circle/profile">
                <Button variant="ghost" size="icon">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={profile?.avatar_url || undefined} />
                    <AvatarFallback>
                      {profile?.display_name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </NavLink>

              {/* Back to Nexus */}
              <NavLink to="/" className="hidden sm:block">
                <Button variant="outline" size="sm">
                  Voltar ao Nexus
                </Button>
              </NavLink>

              {/* Mobile Menu */}
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild className="md:hidden">
                  <Button variant="ghost" size="icon">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-72">
                  <div className="flex flex-col gap-6 mt-6">
                    <NavLinks mobile onClose={() => setMobileMenuOpen(false)} />
                    
                    <div className="border-t pt-4">
                      <NavLink 
                        to="/circle/settings" 
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-muted-foreground hover:text-foreground"
                      >
                        <Settings className="h-4 w-4" />
                        <span>Configurações</span>
                      </NavLink>
                      <NavLink 
                        to="/" 
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                        <span>Voltar ao Nexus</span>
                      </NavLink>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {profileLoading ? (
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : !profile ? (
          <div className="max-w-md mx-auto text-center py-16 space-y-4">
            <h1 className="text-2xl font-bold">Entre para acessar o UNV Circle</h1>
            <p className="text-muted-foreground">
              Você precisa estar logado para criar posts, comunidades e anúncios.
            </p>
            <NavLink to="/onboarding-tasks/login">
              <Button>Fazer login</Button>
            </NavLink>
          </div>
        ) : (
          <Outlet />
        )}
      </main>

      {/* Floating Chat Bubble */}
      <FloatingChatBubble />
    </div>
  );
}
