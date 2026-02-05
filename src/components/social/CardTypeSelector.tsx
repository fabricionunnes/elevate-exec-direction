import { Button } from "@/components/ui/button";
import { FileText, ListChecks, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export type SocialCardType = "content" | "task" | "info";

interface CardTypeSelectorProps {
  value: SocialCardType;
  onChange: (type: SocialCardType) => void;
  disabled?: boolean;
}

const cardTypes = [
  {
    type: "content" as const,
    label: "Conteúdo",
    description: "Post completo com mídia",
    icon: FileText,
  },
  {
    type: "task" as const,
    label: "Tarefa",
    description: "Checklist e anexos",
    icon: ListChecks,
  },
  {
    type: "info" as const,
    label: "Informação",
    description: "Armazenamento de dados",
    icon: Info,
  },
];

export const CardTypeSelector = ({
  value,
  onChange,
  disabled,
}: CardTypeSelectorProps) => {
  return (
    <div className="grid grid-cols-3 gap-2">
      {cardTypes.map((cardType) => {
        const Icon = cardType.icon;
        const isSelected = value === cardType.type;

        return (
          <Button
            key={cardType.type}
            type="button"
            variant="outline"
            className={cn(
              "h-auto flex-col gap-1 py-3 px-2",
              isSelected && "border-primary bg-primary/5 ring-1 ring-primary"
            )}
            onClick={() => onChange(cardType.type)}
            disabled={disabled}
          >
            <Icon className={cn("h-5 w-5", isSelected && "text-primary")} />
            <span className="text-xs font-medium">{cardType.label}</span>
          </Button>
        );
      })}
    </div>
  );
};
