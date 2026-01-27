import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Send, ThumbsUp, HelpCircle, Lightbulb, AlertTriangle } from "lucide-react";

interface StructuredCommentInputProps {
  onSubmit: (content: string, commentType: string) => void;
  isLoading?: boolean;
  placeholder?: string;
}

const commentTypes = [
  { 
    value: "agree", 
    label: "Concordo", 
    icon: ThumbsUp, 
    color: "text-green-500 hover:bg-green-500/10 data-[active=true]:bg-green-500/20 data-[active=true]:text-green-600",
    emoji: "👍"
  },
  { 
    value: "question", 
    label: "Dúvida", 
    icon: HelpCircle, 
    color: "text-blue-500 hover:bg-blue-500/10 data-[active=true]:bg-blue-500/20 data-[active=true]:text-blue-600",
    emoji: "🤔"
  },
  { 
    value: "complement", 
    label: "Complemento", 
    icon: Lightbulb, 
    color: "text-yellow-500 hover:bg-yellow-500/10 data-[active=true]:bg-yellow-500/20 data-[active=true]:text-yellow-600",
    emoji: "🧠"
  },
  { 
    value: "disagree", 
    label: "Discordo", 
    icon: AlertTriangle, 
    color: "text-red-500 hover:bg-red-500/10 data-[active=true]:bg-red-500/20 data-[active=true]:text-red-600",
    emoji: "⚠️"
  },
];

export function StructuredCommentInput({ 
  onSubmit, 
  isLoading, 
  placeholder = "Escreva um comentário..." 
}: StructuredCommentInputProps) {
  const [content, setContent] = useState("");
  const [selectedType, setSelectedType] = useState<string>("normal");
  const [showDisagreeWarning, setShowDisagreeWarning] = useState(false);

  const handleTypeSelect = (type: string) => {
    if (selectedType === type) {
      setSelectedType("normal");
      setShowDisagreeWarning(false);
    } else {
      setSelectedType(type);
      setShowDisagreeWarning(type === "disagree");
    }
  };

  const handleSubmit = () => {
    if (!content.trim()) return;
    
    // Para "discordo", exigir justificativa mínima
    if (selectedType === "disagree" && content.trim().length < 20) {
      return;
    }
    
    onSubmit(content.trim(), selectedType);
    setContent("");
    setSelectedType("normal");
    setShowDisagreeWarning(false);
  };

  const isDisagreeValid = selectedType !== "disagree" || content.trim().length >= 20;

  return (
    <div className="space-y-3">
      {/* Comment Type Selector */}
      <div className="flex flex-wrap gap-2">
        {commentTypes.map((type) => {
          const Icon = type.icon;
          const isActive = selectedType === type.value;
          
          return (
            <Button
              key={type.value}
              type="button"
              variant="ghost"
              size="sm"
              data-active={isActive}
              className={cn(
                "h-8 px-3 text-xs border",
                type.color,
                isActive && "border-current"
              )}
              onClick={() => handleTypeSelect(type.value)}
            >
              <span className="mr-1">{type.emoji}</span>
              {type.label}
            </Button>
          );
        })}
      </div>

      {/* Disagree Warning */}
      {showDisagreeWarning && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-600">
          <p className="font-medium">Ao discordar, justifique sua posição</p>
          <p className="text-xs mt-1">
            Comentários de discordância devem ter pelo menos 20 caracteres explicando seu ponto de vista.
          </p>
        </div>
      )}

      {/* Input Area */}
      <div className="flex gap-2">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={
            selectedType === "disagree" 
              ? "Explique por que você discorda (mínimo 20 caracteres)..." 
              : placeholder
          }
          className="min-h-[60px] resize-none flex-1"
          rows={2}
        />
        <Button
          type="button"
          size="icon"
          onClick={handleSubmit}
          disabled={!content.trim() || isLoading || !isDisagreeValid}
          className="shrink-0 self-end"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {/* Character count for disagree */}
      {selectedType === "disagree" && (
        <div className="text-xs text-muted-foreground text-right">
          {content.length}/20 caracteres mínimos
        </div>
      )}
    </div>
  );
}
