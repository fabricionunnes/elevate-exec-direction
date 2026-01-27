import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  Bell, 
  Heart, 
  MessageSquare, 
  Store, 
  Users, 
  AtSign,
  AlertCircle
} from "lucide-react";

interface NotificationFiltersProps {
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
}

const categories = [
  { value: null, label: "Todas", icon: Bell },
  { value: "engagement", label: "Curtidas", icon: Heart },
  { value: "comments", label: "Comentários", icon: MessageSquare },
  { value: "marketplace", label: "Marketplace", icon: Store },
  { value: "community", label: "Comunidades", icon: Users },
  { value: "mention", label: "Menções", icon: AtSign },
  { value: "report", label: "Denúncias", icon: AlertCircle },
];

export function NotificationFilters({ 
  selectedCategory, 
  onCategoryChange 
}: NotificationFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((cat) => {
        const Icon = cat.icon;
        const isActive = selectedCategory === cat.value;
        
        return (
          <Button
            key={cat.value ?? "all"}
            variant={isActive ? "default" : "outline"}
            size="sm"
            onClick={() => onCategoryChange(cat.value)}
            className={cn(
              "h-8",
              !isActive && "text-muted-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5 mr-1.5" />
            {cat.label}
          </Button>
        );
      })}
    </div>
  );
}
