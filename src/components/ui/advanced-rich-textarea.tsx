import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  Bold, 
  Italic, 
  Underline, 
  List, 
  ListOrdered, 
  Heading2, 
  Quote, 
  Minus,
  Palette,
  Type
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface AdvancedRichTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  disabled?: boolean;
}

const TEXT_COLORS = [
  { name: "Padrão", value: "", class: "text-foreground" },
  { name: "Vermelho", value: "red", class: "bg-red-500" },
  { name: "Laranja", value: "orange", class: "bg-orange-500" },
  { name: "Amarelo", value: "yellow", class: "bg-yellow-500" },
  { name: "Verde", value: "green", class: "bg-green-500" },
  { name: "Azul", value: "blue", class: "bg-blue-500" },
  { name: "Roxo", value: "purple", class: "bg-purple-500" },
  { name: "Rosa", value: "pink", class: "bg-pink-500" },
];

const FONT_SIZES = [
  { name: "Pequeno", value: "small" },
  { name: "Normal", value: "normal" },
  { name: "Grande", value: "large" },
  { name: "Muito Grande", value: "xlarge" },
];

const AdvancedRichTextarea = React.forwardRef<HTMLDivElement, AdvancedRichTextareaProps>(
  ({ value, onChange, placeholder, className, minHeight = "200px", disabled }, ref) => {
    const editorRef = React.useRef<HTMLDivElement>(null);
    const [showColorPicker, setShowColorPicker] = React.useState(false);
    const [showFontSizePicker, setShowFontSizePicker] = React.useState(false);

    // Sync content from value prop
    React.useEffect(() => {
      if (editorRef.current && editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value || "";
      }
    }, [value]);

    const handleInput = () => {
      if (editorRef.current) {
        onChange(editorRef.current.innerHTML);
      }
    };

    const execCommand = (command: string, value?: string) => {
      document.execCommand(command, false, value);
      editorRef.current?.focus();
      handleInput();
    };

    const applyColor = (color: string) => {
      if (color) {
        execCommand("foreColor", color);
      } else {
        execCommand("removeFormat");
        // Re-apply basic formatting
      }
      setShowColorPicker(false);
    };

    const applyFontSize = (size: string) => {
      const sizeMap: Record<string, string> = {
        small: "2",
        normal: "3",
        large: "5",
        xlarge: "7",
      };
      execCommand("fontSize", sizeMap[size] || "3");
      setShowFontSizePicker(false);
    };

    const formatButtons = [
      {
        icon: Bold,
        label: "Negrito",
        action: () => execCommand("bold"),
        shortcut: "Ctrl+B"
      },
      {
        icon: Italic,
        label: "Itálico",
        action: () => execCommand("italic"),
        shortcut: "Ctrl+I"
      },
      {
        icon: Underline,
        label: "Sublinhado",
        action: () => execCommand("underline"),
        shortcut: "Ctrl+U"
      },
      {
        icon: Heading2,
        label: "Título",
        action: () => execCommand("formatBlock", "h2"),
        shortcut: ""
      },
      {
        icon: List,
        label: "Lista",
        action: () => execCommand("insertUnorderedList"),
        shortcut: ""
      },
      {
        icon: ListOrdered,
        label: "Lista numerada",
        action: () => execCommand("insertOrderedList"),
        shortcut: ""
      },
      {
        icon: Quote,
        label: "Citação",
        action: () => execCommand("formatBlock", "blockquote"),
        shortcut: ""
      },
      {
        icon: Minus,
        label: "Separador",
        action: () => execCommand("insertHorizontalRule"),
        shortcut: ""
      },
    ];

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'b':
            e.preventDefault();
            execCommand("bold");
            break;
          case 'i':
            e.preventDefault();
            execCommand("italic");
            break;
          case 'u':
            e.preventDefault();
            execCommand("underline");
            break;
        }
      }
    };

    return (
      <div ref={ref} className={cn("space-y-2", className)}>
        {/* Toolbar */}
        <div className="flex items-center gap-1 p-1.5 border rounded-lg bg-muted/50 flex-wrap">
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
                    disabled={disabled}
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

            {/* Separator */}
            <div className="w-px h-6 bg-border mx-1" />

            {/* Color Picker */}
            <Popover open={showColorPicker} onOpenChange={setShowColorPicker}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={disabled}
                >
                  <Palette className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="start">
                <div className="grid grid-cols-4 gap-1">
                  {TEXT_COLORS.map((color) => (
                    <Tooltip key={color.value || "default"}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            "w-6 h-6 rounded-md border border-border transition-transform hover:scale-110",
                            color.value ? color.class : "bg-background"
                          )}
                          onClick={() => applyColor(color.value)}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">
                        {color.name}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Font Size Picker */}
            <Popover open={showFontSizePicker} onOpenChange={setShowFontSizePicker}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={disabled}
                >
                  <Type className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="start">
                <div className="flex flex-col gap-1">
                  {FONT_SIZES.map((size) => (
                    <Button
                      key={size.value}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="justify-start"
                      onClick={() => applyFontSize(size.value)}
                    >
                      {size.name}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </TooltipProvider>
        </div>

        {/* Editor */}
        <div
          ref={editorRef}
          contentEditable={!disabled}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          className={cn(
            "p-3 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 overflow-auto prose prose-sm max-w-none",
            "dark:prose-invert",
            "[&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2",
            "[&_blockquote]:border-l-4 [&_blockquote]:border-muted-foreground [&_blockquote]:pl-4 [&_blockquote]:italic",
            "[&_ul]:list-disc [&_ul]:ml-4",
            "[&_ol]:list-decimal [&_ol]:ml-4",
            "[&_hr]:my-4 [&_hr]:border-t [&_hr]:border-border",
            disabled && "opacity-50 cursor-not-allowed",
            className
          )}
          style={{ minHeight }}
          data-placeholder={placeholder}
          suppressContentEditableWarning
        />

        <style>{`
          [data-placeholder]:empty:before {
            content: attr(data-placeholder);
            color: hsl(var(--muted-foreground));
            pointer-events: none;
          }
        `}</style>
      </div>
    );
  }
);

AdvancedRichTextarea.displayName = "AdvancedRichTextarea";

export { AdvancedRichTextarea };
