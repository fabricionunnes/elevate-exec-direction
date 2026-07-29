import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bold, Italic, Underline, Link2, Image as ImageIcon, Eraser, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Editor de texto rico pro disparador de e-mail: negrito, itálico, sublinhado,
// tamanho de fonte, cor, link e imagem (upload no bucket email-assets).
// Gera HTML simples (font/b/i/u/img) — o que cliente de e-mail entende.

interface Props {
  initialHtml?: string;
  placeholder?: string;
  minHeight?: number;
  onChange: (html: string, text: string) => void;
}

export const RichTextEditor = ({ initialHtml, placeholder, minHeight = 180, onChange }: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState(false);
  const [empty, setEmpty] = useState(!initialHtml);

  useEffect(() => {
    if (ref.current && initialHtml !== undefined && ref.current.innerHTML !== initialHtml) {
      ref.current.innerHTML = initialHtml || "";
      setEmpty(!ref.current.innerText.trim() && !ref.current.querySelector("img"));
    }
    // só na montagem / troca de conteúdo externo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialHtml]);

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    // imagens sempre responsivas no e-mail
    el.querySelectorAll("img").forEach(img => {
      if (!img.getAttribute("style")) img.setAttribute("style", "max-width:100%;height:auto;border-radius:8px");
    });
    setEmpty(!el.innerText.trim() && !el.querySelector("img"));
    onChange(el.innerHTML, el.innerText);
  };

  const cmd = (command: string, value?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, value);
    emit();
  };

  const addLink = () => {
    const url = prompt("Endereço do link (com https://):", "https://");
    if (url && /^https?:\/\//i.test(url)) cmd("createLink", url);
  };

  const addImage = async (file: File) => {
    setUploading(true);
    try {
      const path = `img/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error } = await supabase.storage.from("email-assets").upload(path, file);
      if (error) throw new Error(error.message);
      const { data } = supabase.storage.from("email-assets").getPublicUrl(path);
      cmd("insertImage", data.publicUrl);
      toast.success("Imagem inserida");
    } catch (e: any) { toast.error(e.message); }
    finally { setUploading(false); }
  };

  const ToolBtn = ({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) => (
    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title={title}
      onMouseDown={e => e.preventDefault()} onClick={onClick}>
      {children}
    </Button>
  );

  return (
    <div className="rounded-lg border border-input bg-background">
      <div className="flex items-center gap-0.5 flex-wrap border-b border-border px-2 py-1">
        <ToolBtn onClick={() => cmd("bold")} title="Negrito"><Bold className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn onClick={() => cmd("italic")} title="Itálico"><Italic className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn onClick={() => cmd("underline")} title="Sublinhado"><Underline className="h-3.5 w-3.5" /></ToolBtn>
        <div className="w-px h-5 bg-border mx-1" />
        <Select onValueChange={(v) => cmd("fontSize", v)}>
          <SelectTrigger className="h-7 w-[92px] text-xs border-0 bg-transparent px-2" onMouseDown={e => e.stopPropagation()}>
            <SelectValue placeholder="Tamanho" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2">Pequena</SelectItem>
            <SelectItem value="3">Normal</SelectItem>
            <SelectItem value="5">Grande</SelectItem>
            <SelectItem value="6">Título</SelectItem>
          </SelectContent>
        </Select>
        <label className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-muted cursor-pointer" title="Cor do texto">
          <span className="h-3.5 w-3.5 rounded-sm border border-border" style={{ background: "linear-gradient(135deg,#CC1B1B,#0D2B5E,#10b981)" }} />
          <input type="color" className="sr-only" onChange={e => cmd("foreColor", e.target.value)} />
        </label>
        <div className="w-px h-5 bg-border mx-1" />
        <ToolBtn onClick={addLink} title="Inserir link"><Link2 className="h-3.5 w-3.5" /></ToolBtn>
        <label className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-muted cursor-pointer" title="Inserir imagem">
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
          <input type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) addImage(f); e.target.value = ""; }} />
        </label>
        <ToolBtn onClick={() => cmd("removeFormat")} title="Limpar formatação"><Eraser className="h-3.5 w-3.5" /></ToolBtn>
      </div>
      <div className="relative">
        {empty && placeholder && (
          <div className="absolute inset-0 px-3 py-2 text-sm text-muted-foreground pointer-events-none whitespace-pre-line">{placeholder}</div>
        )}
        <div
          ref={ref}
          contentEditable
          className={cn("px-3 py-2 text-sm outline-none overflow-y-auto", "prose-sm max-w-none [&_a]:text-primary [&_a]:underline")}
          style={{ minHeight, maxHeight: 420 }}
          onInput={emit}
          onBlur={emit}
        />
      </div>
    </div>
  );
};
