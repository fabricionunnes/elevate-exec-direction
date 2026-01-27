import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Bell, 
  Heart, 
  MessageSquare, 
  Award, 
  UserPlus,
  Store,
  Camera,
  Users,
  CheckCheck,
  AlertCircle,
  AtSign
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { NavLink } from "react-router-dom";
import { NotificationFilters } from "@/components/circle/NotificationFilters";
import { useCircleCurrentProfile } from "@/hooks/useCircleCurrentProfile";

const notificationIcons: Record<string, React.ElementType> = {
  like: Heart,
  comment: MessageSquare,
  testimonial: Award,
  story_reaction: Camera,
  listing_contact: Store,
  badge_earned: Award,
  community_invite: Users,
  mention: AtSign,
  follow: UserPlus,
  report: AlertCircle,
};

const categoryMapping: Record<string, string> = {
  like: "engagement",
  comment: "comments",
  testimonial: "engagement",
  story_reaction: "engagement",
  listing_contact: "marketplace",
  badge_earned: "engagement",
  community_invite: "community",
  mention: "mention",
  follow: "engagement",
  report: "report",
};

interface CircleNotification {
  id: string;
  profile_id: string;
  type: string;
  title: string;
  message: string | null;
  actor_profile_id: string | null;
  reference_type: string | null;
  reference_id: string | null;
  is_read: boolean;
  priority: string;
  category: string | null;
  action_url: string | null;
  created_at: string;
  actor?: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
}

export default function CircleNotificationsPage() {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: currentProfile } = useCircleCurrentProfile();

  // Fetch notifications
  const { data: notifications, isLoading } = useQuery({
    queryKey: ["circle-notifications", currentProfile?.id],
    queryFn: async () => {
      if (!currentProfile?.id) return [];

      const { data, error } = await supabase
        .from("circle_notifications")
        .select(`
          *,
          actor:circle_profiles!circle_notifications_actor_profile_id_fkey(
            id,
            display_name,
            avatar_url
          )
        `)
        .eq("profile_id", currentProfile.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as CircleNotification[];
    },
    enabled: !!currentProfile?.id,
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("circle_notifications")
        .update({ is_read: true })
        .eq("id", notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["circle-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["circle-notifications-unread"] });
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!currentProfile?.id) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("circle_notifications")
        .update({ is_read: true })
        .eq("profile_id", currentProfile.id)
        .eq("is_read", false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["circle-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["circle-notifications-unread"] });
    },
  });

  // Filter notifications
  const filteredNotifications = notifications?.filter((n) => {
    if (!selectedCategory) return true;
    const notifCategory = n.category || categoryMapping[n.type] || "engagement";
    return notifCategory === selectedCategory;
  });

  const unreadCount = notifications?.filter(n => !n.is_read).length || 0;
  const highPriorityCount = notifications?.filter(n => n.priority === "high" && !n.is_read).length || 0;

  const getNotificationLink = (notification: CircleNotification) => {
    if (notification.action_url) return notification.action_url;
    if (notification.reference_type === "post" && notification.reference_id) {
      return `/circle`;
    }
    if (notification.reference_type === "profile" && notification.actor_profile_id) {
      return `/circle/profile/${notification.actor_profile_id}`;
    }
    if (notification.reference_type === "community" && notification.reference_id) {
      return `/circle/communities`;
    }
    if (notification.reference_type === "listing" && notification.reference_id) {
      return `/circle/marketplace`;
    }
    return "#";
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Notificações</h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {unreadCount > 0 && (
              <span>{unreadCount} não lida{unreadCount > 1 ? "s" : ""}</span>
            )}
            {highPriorityCount > 0 && (
              <span className="text-red-500 font-medium">
                {highPriorityCount} prioritária{highPriorityCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllAsReadMutation.mutate()}
            disabled={markAllAsReadMutation.isPending}
          >
            <CheckCheck className="h-4 w-4 mr-2" />
            Marcar todas como lidas
          </Button>
        )}
      </div>

      {/* Filters */}
      <NotificationFilters
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
      />

      <Card>
        <CardContent className="p-0 divide-y">
          {filteredNotifications && filteredNotifications.length > 0 ? (
            filteredNotifications.map((notification) => {
              const Icon = notificationIcons[notification.type] || Bell;
              const isHighPriority = notification.priority === "high";

              return (
                <NavLink
                  key={notification.id}
                  to={getNotificationLink(notification)}
                  className={cn(
                    "flex items-start gap-3 p-4 hover:bg-muted transition-colors",
                    !notification.is_read && "bg-primary/5",
                    isHighPriority && !notification.is_read && "bg-red-500/5 border-l-2 border-red-500"
                  )}
                  onClick={() => {
                    if (!notification.is_read) {
                      markAsReadMutation.mutate(notification.id);
                    }
                  }}
                >
                  {/* Actor Avatar or Icon */}
                  {notification.actor ? (
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={notification.actor.avatar_url || undefined} />
                      <AvatarFallback>
                        {notification.actor.display_name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className={cn(
                      "h-10 w-10 rounded-full flex items-center justify-center",
                      isHighPriority ? "bg-red-500/10" : "bg-primary/10"
                    )}>
                      <Icon className={cn(
                        "h-5 w-5",
                        isHighPriority ? "text-red-500" : "text-primary"
                      )} />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm", !notification.is_read && "font-medium")}>
                      {notification.title}
                    </p>
                    {notification.message && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                        {notification.message}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(notification.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                  </div>

                  {!notification.is_read && (
                    <div className={cn(
                      "h-2 w-2 rounded-full",
                      isHighPriority ? "bg-red-500" : "bg-primary"
                    )} />
                  )}
                </NavLink>
              );
            })
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma notificação{selectedCategory ? " nesta categoria" : ""}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
