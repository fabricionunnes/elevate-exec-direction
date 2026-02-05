import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Plus } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface CardTag {
  id: string;
  tag_type: string;
  tag_value: string;
}

interface CardTagSelectorProps {
  cardId: string;
  disabled?: boolean;
}

const STATUS_TAGS = [
  { value: "copy", label: "Copy", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  { value: "arte", label: "Arte", color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" },
  { value: "captacao_video", label: "Captação", color: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
  { value: "edicao_video", label: "Edição", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
];

export const CardTagSelector = ({ cardId, disabled }: CardTagSelectorProps) => {
  const [tags, setTags] = useState<CardTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [popoverOpen, setPopoverOpen] = useState(false);

  useEffect(() => {
    loadTags();
  }, [cardId]);

  const loadTags = async () => {
    try {
      const { data } = await supabase
        .from("social_card_tags")
        .select("*")
        .eq("card_id", cardId);
      setTags(data || []);
    } catch (error) {
      console.error("Error loading tags:", error);
    } finally {
      setLoading(false);
    }
  };

  const addTag = async (tagValue: string) => {
    if (tags.some((t) => t.tag_value === tagValue)) return;

    try {
      const { data, error } = await supabase
        .from("social_card_tags")
        .insert({
          card_id: cardId,
          tag_type: "status",
          tag_value: tagValue,
        })
        .select()
        .single();

      if (error) throw error;
      setTags([...tags, data]);
    } catch (error) {
      console.error("Error adding tag:", error);
    }
  };

  const removeTag = async (tagId: string) => {
    try {
      const { error } = await supabase
        .from("social_card_tags")
        .delete()
        .eq("id", tagId);

      if (error) throw error;
      setTags(tags.filter((t) => t.id !== tagId));
    } catch (error) {
      console.error("Error removing tag:", error);
    }
  };

  const existingTagValues = tags.map((t) => t.tag_value);
  const availableTags = STATUS_TAGS.filter((t) => !existingTagValues.includes(t.value));

  if (loading) return null;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {tags.map((tag) => {
        const tagDef = STATUS_TAGS.find((t) => t.value === tag.tag_value);
        return (
          <Badge
            key={tag.id}
            className={cn(
              "text-xs gap-1 pr-1",
              tagDef?.color || "bg-muted text-muted-foreground"
            )}
          >
            {tagDef?.label || tag.tag_value}
            {!disabled && (
              <button
                onClick={() => removeTag(tag.id)}
                className="ml-1 hover:bg-black/10 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        );
      })}

      {!disabled && availableTags.length > 0 && (
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 rounded-full"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <div className="flex flex-col gap-1">
              {availableTags.map((tag) => (
                <button
                  key={tag.value}
                  onClick={() => {
                    addTag(tag.value);
                    setPopoverOpen(false);
                  }}
                  className="text-left px-3 py-1.5 text-sm rounded hover:bg-muted transition-colors"
                >
                  <Badge className={cn("text-xs", tag.color)}>{tag.label}</Badge>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
};

// Simpler inline version for Kanban cards (read-only)
export const CardTagsDisplay = ({ cardId }: { cardId: string }) => {
  const [tags, setTags] = useState<CardTag[]>([]);

  useEffect(() => {
    const loadTags = async () => {
      const { data } = await supabase
        .from("social_card_tags")
        .select("*")
        .eq("card_id", cardId);
      setTags(data || []);
    };
    loadTags();
  }, [cardId]);

  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {tags.map((tag) => {
        const tagDef = STATUS_TAGS.find((t) => t.value === tag.tag_value);
        return (
          <Badge
            key={tag.id}
            className={cn(
              "text-[10px] px-1.5 py-0",
              tagDef?.color || "bg-muted text-muted-foreground"
            )}
          >
            {tagDef?.label || tag.tag_value}
          </Badge>
        );
      })}
    </div>
  );
};
