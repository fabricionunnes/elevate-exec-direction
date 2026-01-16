import * as React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Bold, Italic, List, ListOrdered, Heading2, Quote, Minus } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface RichTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

const RichTextarea = React.forwardRef<HTMLTextAreaElement, RichTextareaProps>(
  ({ className, value, onChange, ...props }, ref) => {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    // Merge refs
    React.useImperativeHandle(ref, () => textareaRef.current!);

    const insertFormat = (prefix: string, suffix: string = "") => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = value.substring(start, end);
      
      let newText: string;
      let cursorPosition: number;

      if (selectedText) {
        // Wrap selected text
        newText = value.substring(0, start) + prefix + selectedText + suffix + value.substring(end);
        cursorPosition = start + prefix.length + selectedText.length + suffix.length;
      } else {
        // Insert at cursor
        newText = value.substring(0, start) + prefix + suffix + value.substring(end);
        cursorPosition = start + prefix.length;
      }

      // Create synthetic event
      const syntheticEvent = {
        target: { value: newText },
      } as React.ChangeEvent<HTMLTextAreaElement>;
      
      onChange(syntheticEvent);

      // Restore focus and cursor position after state update
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(cursorPosition, cursorPosition);
      }, 0);
    };

    const insertLinePrefix = (prefix: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      
      // Find the start of the current line
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const lineEnd = value.indexOf('\n', end);
      const actualLineEnd = lineEnd === -1 ? value.length : lineEnd;
      
      // Get selected lines
      const selectedText = value.substring(lineStart, actualLineEnd);
      const lines = selectedText.split('\n');
      
      // Add prefix to each line
      const newLines = lines.map(line => prefix + line);
      const newText = value.substring(0, lineStart) + newLines.join('\n') + value.substring(actualLineEnd);
      
      const syntheticEvent = {
        target: { value: newText },
      } as React.ChangeEvent<HTMLTextAreaElement>;
      
      onChange(syntheticEvent);

      setTimeout(() => {
        textarea.focus();
      }, 0);
    };

    const formatButtons = [
      {
        icon: Bold,
        label: "Negrito",
        action: () => insertFormat("**", "**"),
        shortcut: "Ctrl+B"
      },
      {
        icon: Italic,
        label: "Itálico",
        action: () => insertFormat("*", "*"),
        shortcut: "Ctrl+I"
      },
      {
        icon: Heading2,
        label: "Título",
        action: () => insertLinePrefix("## "),
        shortcut: "Ctrl+H"
      },
      {
        icon: List,
        label: "Lista",
        action: () => insertLinePrefix("- "),
        shortcut: "Ctrl+L"
      },
      {
        icon: ListOrdered,
        label: "Lista numerada",
        action: () => insertLinePrefix("1. "),
        shortcut: "Ctrl+O"
      },
      {
        icon: Quote,
        label: "Citação",
        action: () => insertLinePrefix("> "),
        shortcut: "Ctrl+Q"
      },
      {
        icon: Minus,
        label: "Separador",
        action: () => insertFormat("\n---\n"),
        shortcut: ""
      },
    ];

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'b':
            e.preventDefault();
            insertFormat("**", "**");
            break;
          case 'i':
            e.preventDefault();
            insertFormat("*", "*");
            break;
          case 'h':
            e.preventDefault();
            insertLinePrefix("## ");
            break;
          case 'l':
            e.preventDefault();
            insertLinePrefix("- ");
            break;
        }
      }
    };

    return (
      <div className="space-y-2">
        {/* Toolbar */}
        <div className="flex items-center gap-1 p-1 border rounded-lg bg-muted/50 flex-wrap">
          <TooltipProvider delayDuration={300}>
            {formatButtons.map((btn, index) => (
              <Tooltip key={index}>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={btn.action}
                  >
                    <btn.icon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  <p>{btn.label}</p>
                  {btn.shortcut && (
                    <p className="text-muted-foreground">{btn.shortcut}</p>
                  )}
                </TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
          
          <span className="text-xs text-muted-foreground ml-auto px-2">
            Suporta Markdown
          </span>
        </div>

        {/* Textarea */}
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={onChange}
          onKeyDown={handleKeyDown}
          className={cn("resize-none font-mono text-sm", className)}
          {...props}
        />
      </div>
    );
  }
);

RichTextarea.displayName = "RichTextarea";

export { RichTextarea };
