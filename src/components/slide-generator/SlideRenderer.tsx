import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Target, Lightbulb, BookOpen, HelpCircle, Award, CheckCircle, 
  ArrowRight, Zap, Star, MessageCircle, BarChart3, Users,
  Plus, Minus, Trash2, Type, GripVertical, ImagePlus, X, Move, Play
} from "lucide-react";
import unvLogo from "@/assets/unv-logo-slides.png";

interface SlideItem {
  slide_type: string;
  title: string | null;
  subtitle: string | null;
  content: any;
  layout_type: string | null;
}

interface SlideUpdate {
  title?: string;
  subtitle?: string;
  content?: any;
}

interface Props {
  slide: SlideItem;
  scale: number;
  editable?: boolean;
  onUpdate?: (update: SlideUpdate) => void;
  visibleBullets?: number; // -1 or undefined = show all
}

const ICON_MAP: Record<string, any> = {
  target: Target, lightbulb: Lightbulb, book: BookOpen, question: HelpCircle,
  award: Award, check: CheckCircle, arrow: ArrowRight, zap: Zap,
  star: Star, message: MessageCircle, chart: BarChart3, users: Users,
};

function getSlideColors(type: string) {
  const navy = "#0A1931";
  const red = "#C81E1E";
  const white = "#FFFFFF";
  const lightGray = "#F1F5F9";

  switch (type) {
    case "cover": return { bg: navy, text: white, accent: red };
    case "closing": return { bg: navy, text: white, accent: red };
    case "highlight": return { bg: red, text: white, accent: navy };
    case "question": return { bg: `linear-gradient(135deg, ${navy} 0%, #1a3a5c 100%)`, text: white, accent: "#FFD700" };
    case "exercise": return { bg: `linear-gradient(135deg, #1a3a5c 0%, ${navy} 100%)`, text: white, accent: "#4ADE80" };
    case "framework": return { bg: white, text: navy, accent: red };
    case "quote": return { bg: lightGray, text: navy, accent: red };
    case "data": return { bg: white, text: navy, accent: "#3B82F6" };
    default: return { bg: white, text: navy, accent: red };
  }
}

// Editable text component
function EditableText({ 
  value, 
  onChange, 
  editable, 
  style, 
  tag = "span",
  placeholder = "Clique para editar...",
  onFontSizeChange,
  onRemove,
}: { 
  value: string; 
  onChange: (val: string) => void; 
  editable?: boolean; 
  style: React.CSSProperties; 
  tag?: string;
  placeholder?: string;
  onFontSizeChange?: (newSize: number) => void;
  onRemove?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isFocused = useRef(false);
  const [showControls, setShowControls] = useState(false);
  const currentFontSize = typeof style.fontSize === "number" ? style.fontSize : parseInt(String(style.fontSize) || "24", 10);
  
  useEffect(() => {
    if (ref.current && !isFocused.current) {
      ref.current.innerText = value || "";
    }
  }, [value]);
  
  const handleBlur = useCallback(() => {
    isFocused.current = false;
    if (ref.current) {
      ref.current.style.boxShadow = "none";
      const newText = ref.current.innerText.trim();
      if (newText !== value) {
        onChange(newText);
      }
    }
    setTimeout(() => setShowControls(false), 200);
  }, [value, onChange]);

  const changeFontSize = (delta: number) => {
    const newSize = Math.max(12, Math.min(120, currentFontSize + delta));
    onFontSizeChange?.(newSize);
  };

  const editableStyle: React.CSSProperties = editable ? {
    ...style,
    cursor: "text",
    outline: "none",
    borderRadius: 4,
    transition: "box-shadow 0.2s",
    minWidth: 100,
    minHeight: "1em",
  } : style;

  if (!editable) {
    return (
      <div style={style}>
        {value || ""}
      </div>
    );
  }

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      {showControls && (
        <div
          style={{
            position: "absolute",
            top: -36,
            right: 0,
            display: "flex",
            gap: 4,
            background: "rgba(10,25,49,0.9)",
            borderRadius: 6,
            padding: "3px 6px",
            zIndex: 50,
            alignItems: "center",
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {onFontSizeChange && (
            <>
              <button
                onMouseDown={(e) => { e.preventDefault(); changeFontSize(-2); }}
                style={{ color: "#fff", border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", padding: 2 }}
                title="Diminuir fonte"
              >
                <Minus size={14} />
              </button>
              <span style={{ color: "#fff", fontSize: 12, minWidth: 28, textAlign: "center", userSelect: "none" }}>
                {currentFontSize}
              </span>
              <button
                onMouseDown={(e) => { e.preventDefault(); changeFontSize(2); }}
                style={{ color: "#fff", border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", padding: 2 }}
                title="Aumentar fonte"
              >
                <Plus size={14} />
              </button>
            </>
          )}
          {onRemove && (
            <button
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(); }}
              style={{ color: "#ff4444", border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", padding: 2, marginLeft: 4 }}
              title="Remover elemento"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onBlur={handleBlur}
        onFocus={(e) => {
          isFocused.current = true;
          setShowControls(true);
          (e.target as HTMLElement).style.boxShadow = "0 0 0 2px rgba(200,30,30,0.5)";
        }}
        style={editableStyle}
        data-placeholder={!value ? placeholder : undefined}
      />
    </div>
  );
}

// Individual bullet item with hover controls
function BulletItem({
  index, bullet, total, isVisible, bulletStyle, colors, fontSize, editable,
  onChange, onRemove, onMove, onFontSizeChange,
}: {
  index: number; bullet: string; total: number; isVisible: boolean;
  bulletStyle: "dot" | "number" | "check"; colors: any; fontSize: number;
  editable?: boolean; onChange: (val: string) => void; onRemove: () => void;
  onMove: (dir: -1 | 1) => void; onFontSizeChange?: (s: number) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        display: "flex", alignItems: "flex-start",
        gap: bulletStyle === "dot" ? 16 : 12,
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(20px)",
        transition: "opacity 0.5s ease, transform 0.5s ease",
        position: "relative",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {bulletStyle === "dot" && (
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: colors.accent, marginTop: 10, flexShrink: 0 }} />
      )}
      {bulletStyle === "number" && (
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: colors.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18, flexShrink: 0 }}>
          {index + 1}
        </div>
      )}
      {bulletStyle === "check" && (
        <CheckCircle size={22} color={colors.accent} style={{ flexShrink: 0, marginTop: 2 }} />
      )}
      <EditableText
        value={bullet}
        onChange={onChange}
        editable={editable}
        style={{ fontSize, lineHeight: 1.4, color: colors.text, flex: 1 }}
        onFontSizeChange={onFontSizeChange}
      />
      {editable && hovered && (
        <div style={{ display: "flex", gap: 2, alignItems: "center", position: "absolute", right: -80, top: 0 }}>
          {index > 0 && (
            <button
              onClick={() => onMove(-1)}
              style={{ background: "rgba(10,25,49,0.8)", border: "none", borderRadius: 4, padding: 4, cursor: "pointer", display: "flex", color: "#fff" }}
              title="Mover para cima"
            >
              <ArrowRight size={14} style={{ transform: "rotate(-90deg)" }} />
            </button>
          )}
          {index < total - 1 && (
            <button
              onClick={() => onMove(1)}
              style={{ background: "rgba(10,25,49,0.8)", border: "none", borderRadius: 4, padding: 4, cursor: "pointer", display: "flex", color: "#fff" }}
              title="Mover para baixo"
            >
              <ArrowRight size={14} style={{ transform: "rotate(90deg)" }} />
            </button>
          )}
          <button
            onClick={onRemove}
            style={{ background: "rgba(200,30,30,0.9)", border: "none", borderRadius: 4, padding: 4, cursor: "pointer", display: "flex", color: "#fff" }}
            title="Remover tópico"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// Editable bullet list
function EditableBullets({
  bullets,
  onChange,
  editable,
  colors,
  fontSize = 26,
  bulletStyle = "dot",
  visibleCount,
  onFontSizeChange,
}: {
  bullets: string[];
  onChange: (bullets: string[]) => void;
  editable?: boolean;
  colors: any;
  fontSize?: number;
  bulletStyle?: "dot" | "number" | "check";
  visibleCount?: number;
  onFontSizeChange?: (newSize: number) => void;
}) {
  const handleBulletChange = (index: number, newVal: string) => {
    const updated = [...bullets];
    updated[index] = newVal;
    onChange(updated);
  };

  const removeBullet = (index: number) => {
    onChange(bullets.filter((_, i) => i !== index));
  };

  const moveBullet = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= bullets.length) return;
    const updated = [...bullets];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    onChange(updated);
  };

  const addBullet = () => {
    onChange([...bullets, "Novo tópico"]);
  };

  const showAll = visibleCount === undefined || visibleCount < 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: bulletStyle === "dot" ? 24 : 20 }}>
      {bullets.map((bullet, i) => (
          <BulletItem
            key={i}
            index={i}
            bullet={bullet}
            total={bullets.length}
            isVisible={showAll || i < (visibleCount ?? bullets.length)}
            bulletStyle={bulletStyle}
            colors={colors}
            fontSize={fontSize}
            editable={editable}
            onChange={(val) => handleBulletChange(i, val)}
            onRemove={() => removeBullet(i)}
            onMove={(dir) => moveBullet(i, dir)}
            onFontSizeChange={onFontSizeChange}
          />
        ))}
      {editable && (
        <button
          onClick={addBullet}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "none",
            border: "2px dashed rgba(0,0,0,0.15)",
            borderRadius: 8,
            padding: "12px 16px",
            cursor: "pointer",
            color: colors.accent,
            fontSize: 16,
            fontWeight: 600,
            opacity: 0.6,
            transition: "opacity 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.6")}
        >
          <Plus size={16} /> Adicionar tópico
        </button>
      )}
    </div>
  );
}

export function SlideRenderer({ slide, scale, editable, onUpdate, visibleBullets }: Props) {
  const colors = getSlideColors(slide.slide_type);
  const content = slide.content || {};
  const vb = visibleBullets;
  const fontSizes: Record<string, number> = content._fontSizes || {};
  const updateTitle = (title: string) => onUpdate?.({ title });
  const updateSubtitle = (subtitle: string) => onUpdate?.({ subtitle });
  const updateContent = (key: string, value: any) => {
    onUpdate?.({ content: { ...content, [key]: value } });
  };
  const setFontSize = (key: string, size: number) => {
    updateContent("_fontSizes", { ...fontSizes, [key]: size });
  };
  const fs = (key: string, defaultSize: number) => fontSizes[key] || defaultSize;

  const containerStyle: React.CSSProperties = {
    width: 1920,
    height: 1080,
    transform: `scale(${scale})`,
    transformOrigin: "top left",
    background: colors.bg,
    color: colors.text,
    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
    position: "relative",
    overflow: "hidden",
  };

  const wrapperStyle: React.CSSProperties = {
    width: 1920 * scale,
    height: 1080 * scale,
    overflow: "hidden",
    position: "relative",
  };

  const logoFooter = (position: "left" | "right" = "left") => (
    <img 
      src={unvLogo} 
      alt="UNV" 
      style={{ 
        position: "absolute", 
        bottom: 30, 
        [position]: 40, 
        height: 80, 
        objectFit: "contain",
        opacity: 0.7,
      }} 
    />
  );

  const renderCover = () => (
    <div style={containerStyle}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 10, background: colors.accent }} />
      <div style={{ position: "absolute", right: -100, top: -100, width: 500, height: 500, borderRadius: "50%", background: "rgba(200,30,30,0.15)" }} />
      <div style={{ position: "absolute", right: 50, bottom: -50, width: 300, height: 300, borderRadius: "50%", background: "rgba(200,30,30,0.1)" }} />
      
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%", padding: "0 120px" }}>
        <img src={unvLogo} alt="Universidade Nacional de Vendas" style={{ height: 120, objectFit: "contain", alignSelf: "flex-start", marginBottom: 40 }} />
        <EditableText
          value={slide.title || ""}
          onChange={updateTitle}
          editable={editable}
          style={{ fontSize: fs("cover_title", 84), fontWeight: 800, lineHeight: 1.1, marginBottom: 28, maxWidth: 1400 }}
          onFontSizeChange={(s) => setFontSize("cover_title", s)}
        />
        <EditableText
          value={slide.subtitle || ""}
          onChange={updateSubtitle}
          editable={editable}
          style={{ fontSize: fs("cover_subtitle", 36), opacity: 0.8, maxWidth: 1100, lineHeight: 1.4 }}
          placeholder="Subtítulo..."
          onFontSizeChange={(s) => setFontSize("cover_subtitle", s)}
        />
        <div style={{ position: "absolute", bottom: 60, left: 120, right: 120, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ width: 80, height: 4, background: colors.accent }} />
          <span style={{ fontSize: 18, opacity: 0.5 }}>unv.com.br</span>
        </div>
      </div>
    </div>
  );

  const renderHighlight = () => (
    <div style={containerStyle}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "100%", padding: "0 140px", textAlign: "center" }}>
        <div style={{ width: 80, height: 4, background: "rgba(255,255,255,0.5)", marginBottom: 48 }} />
        <EditableText
          value={content.highlight || slide.title || ""}
          onChange={(val) => updateContent("highlight", val)}
          editable={editable}
          style={{ fontSize: fs("highlight_title", 76), fontWeight: 800, lineHeight: 1.2, marginBottom: 36 }}
          onFontSizeChange={(s) => setFontSize("highlight_title", s)}
        />
        <EditableText
          value={content.text || ""}
          onChange={(val) => updateContent("text", val)}
          editable={editable}
          style={{ fontSize: fs("highlight_text", 32), opacity: 0.85, maxWidth: 1200 }}
          placeholder="Texto adicional..."
          onFontSizeChange={(s) => setFontSize("highlight_text", s)}
        />
        <div style={{ width: 80, height: 4, background: "rgba(255,255,255,0.5)", marginTop: 48 }} />
      </div>
      {logoFooter("right")}
    </div>
  );

  const renderQuestion = () => (
    <div style={containerStyle}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "100%", padding: "0 140px", textAlign: "center" }}>
        <HelpCircle size={96} color={colors.accent} style={{ marginBottom: 48 }} />
        <EditableText
          value={content.question || slide.title || ""}
          onChange={(val) => updateContent("question", val)}
          editable={editable}
          style={{ fontSize: fs("question_title", 68), fontWeight: 700, lineHeight: 1.3, marginBottom: 36 }}
          onFontSizeChange={(s) => setFontSize("question_title", s)}
        />
        <EditableText
          value={content.text || ""}
          onChange={(val) => updateContent("text", val)}
          editable={editable}
          style={{ fontSize: fs("question_text", 30), opacity: 0.7, maxWidth: 1000 }}
          placeholder="Texto complementar..."
          onFontSizeChange={(s) => setFontSize("question_text", s)}
        />
      </div>
      {logoFooter("left")}
    </div>
  );

  const renderFramework = () => (
    <div style={containerStyle}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 8, background: colors.accent }} />
      <div style={{ padding: "80px 120px" }}>
        <div style={{ fontSize: 20, letterSpacing: 4, textTransform: "uppercase", color: colors.accent, marginBottom: 16, fontWeight: 700 }}>Framework</div>
        <EditableText
          value={content.framework_name || slide.title || ""}
          onChange={(val) => updateContent("framework_name", val)}
          editable={editable}
          style={{ fontSize: fs("framework_title", 60), fontWeight: 800, marginBottom: 48, color: colors.text }}
          onFontSizeChange={(s) => setFontSize("framework_title", s)}
        />
        {content.framework_steps?.length ? (
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            {content.framework_steps.map((step: string, i: number) => {
              const isVisible = vb === undefined || vb < 0 || i < vb;
              return (
                <div key={i} style={{
                  flex: "1 1 250px", padding: 36,
                  background: i % 2 === 0 ? "#F1F5F9" : "#EEF2FF",
                  borderRadius: 16, borderLeft: `5px solid ${colors.accent}`, minWidth: 250,
                  opacity: isVisible ? 1 : 0,
                  transform: isVisible ? "translateY(0)" : "translateY(20px)",
                  transition: "opacity 0.5s ease, transform 0.5s ease",
                }}>
                  <div style={{ fontSize: 42, fontWeight: 800, color: colors.accent, marginBottom: 14 }}>
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <EditableText
                    value={step}
                    onChange={(val) => {
                      const updated = [...content.framework_steps];
                      updated[i] = val;
                      updateContent("framework_steps", updated);
                    }}
                    editable={editable}
                    style={{ fontSize: 28, fontWeight: 600, color: colors.text }}
                    onRemove={editable ? () => {
                      updateContent("framework_steps", content.framework_steps.filter((_: string, idx: number) => idx !== i));
                    } : undefined}
                  />
                </div>
              );
            })}
          </div>
        ) : content.bullets?.length ? (
          <EditableBullets
            bullets={content.bullets}
            onChange={(b) => updateContent("bullets", b)}
            editable={editable}
            colors={colors}
            fontSize={fs("framework_bullets", 30)}
            bulletStyle="number"
            visibleCount={vb}
            onFontSizeChange={(s) => setFontSize("framework_bullets", s)}
          />
        ) : null}
      </div>
      {logoFooter("right")}
    </div>
  );

  const renderExercise = () => (
    <div style={containerStyle}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%", padding: "0 120px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 36 }}>
          <div style={{ width: 64, height: 64, borderRadius: 14, background: colors.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BookOpen size={32} color="#fff" />
          </div>
          <div style={{ fontSize: 20, letterSpacing: 4, textTransform: "uppercase", color: colors.accent, fontWeight: 700 }}>Exercício Prático</div>
        </div>
        <EditableText
          value={content.exercise_title || slide.title || ""}
          onChange={(val) => updateContent("exercise_title", val)}
          editable={editable}
          style={{ fontSize: fs("exercise_title", 60), fontWeight: 800, marginBottom: 36 }}
          onFontSizeChange={(s) => setFontSize("exercise_title", s)}
        />
        <EditableText
          value={content.exercise_instructions || ""}
          onChange={(val) => updateContent("exercise_instructions", val)}
          editable={editable}
          style={{ fontSize: fs("exercise_text", 32), opacity: 0.85, maxWidth: 1400, lineHeight: 1.6, marginBottom: 36 }}
          placeholder="Instruções do exercício..."
          onFontSizeChange={(s) => setFontSize("exercise_text", s)}
        />
        {content.bullets?.length && (
          <EditableBullets
            bullets={content.bullets}
            onChange={(b) => updateContent("bullets", b)}
            editable={editable}
            colors={colors}
            fontSize={fs("exercise_bullets", 28)}
            bulletStyle="check"
            visibleCount={vb}
            onFontSizeChange={(s) => setFontSize("exercise_bullets", s)}
          />
        )}
      </div>
      {logoFooter("left")}
    </div>
  );

  const renderContent = () => (
    <div style={containerStyle}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 8, background: colors.accent }} />
      <div style={{ padding: "80px 120px", height: "100%", display: "flex", flexDirection: "column" }}>
        {slide.subtitle && (
          <EditableText
            value={slide.subtitle}
            onChange={updateSubtitle}
            editable={editable}
            style={{ fontSize: fs("content_subtitle", 20), letterSpacing: 3, textTransform: "uppercase", color: colors.accent, marginBottom: 14, fontWeight: 600 }}
            onFontSizeChange={(s) => setFontSize("content_subtitle", s)}
            onRemove={editable ? () => updateSubtitle("") : undefined}
          />
        )}
        <EditableText
          value={slide.title || ""}
          onChange={updateTitle}
          editable={editable}
          style={{ fontSize: fs("content_title", 60), fontWeight: 800, marginBottom: 48, color: colors.text }}
          onFontSizeChange={(s) => setFontSize("content_title", s)}
        />
        
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {content.bullets?.length ? (
            <EditableBullets
              bullets={content.bullets}
              onChange={(b) => updateContent("bullets", b)}
              editable={editable}
              colors={colors}
              fontSize={fs("content_bullets", 34)}
              bulletStyle="dot"
              visibleCount={vb}
              onFontSizeChange={(s) => setFontSize("content_bullets", s)}
            />
          ) : (
            <EditableText
              value={content.text || ""}
              onChange={(val) => updateContent("text", val)}
              editable={editable}
              style={{ fontSize: fs("content_text", 34), lineHeight: 1.6, maxWidth: 1500, color: colors.text }}
              placeholder="Conteúdo do slide..."
              onFontSizeChange={(s) => setFontSize("content_text", s)}
            />
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 24, borderTop: "1px solid rgba(0,0,0,0.08)" }}>
          <img src={unvLogo} alt="UNV" style={{ height: 56, objectFit: "contain" }} />
          <span style={{ fontSize: 16, opacity: 0.4 }}>universidadevendas.com.br</span>
        </div>
      </div>
    </div>
  );

  const renderClosing = () => (
    <div style={containerStyle}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 10, background: colors.accent }} />
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "100%", padding: "0 160px", textAlign: "center" }}>
        <img src={unvLogo} alt="UNV" style={{ height: 120, objectFit: "contain", marginBottom: 48 }} />
        <EditableText
          value={slide.title || "Obrigado!"}
          onChange={updateTitle}
          editable={editable}
          style={{ fontSize: fs("closing_title", 72), fontWeight: 800, marginBottom: 28 }}
          onFontSizeChange={(s) => setFontSize("closing_title", s)}
        />
        <EditableText
          value={content.text || ""}
          onChange={(val) => updateContent("text", val)}
          editable={editable}
          style={{ fontSize: fs("closing_text", 32), opacity: 0.8, maxWidth: 1000, marginBottom: 44 }}
          placeholder="Mensagem final..."
          onFontSizeChange={(s) => setFontSize("closing_text", s)}
        />
      </div>
    </div>
  );

  const renderQuote = () => (
    <div style={containerStyle}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "100%", padding: "0 180px", textAlign: "center" }}>
        <div style={{ fontSize: 140, color: colors.accent, lineHeight: 0.8, marginBottom: 36 }}>"</div>
        <EditableText
          value={content.highlight || content.text || slide.title || ""}
          onChange={(val) => updateContent("highlight", val)}
          editable={editable}
          style={{ fontSize: fs("quote_text", 48), fontWeight: 600, lineHeight: 1.5, fontStyle: "italic", marginBottom: 36, color: colors.text }}
          onFontSizeChange={(s) => setFontSize("quote_text", s)}
        />
        <EditableText
          value={slide.subtitle || ""}
          onChange={updateSubtitle}
          editable={editable}
          style={{ fontSize: fs("quote_author", 26), color: colors.accent, fontWeight: 600 }}
          placeholder="Autor..."
          onFontSizeChange={(s) => setFontSize("quote_author", s)}
        />
      </div>
      {logoFooter("right")}
    </div>
  );

  const renderSlide = () => {
    switch (slide.slide_type) {
      case "cover": return renderCover();
      case "highlight": return renderHighlight();
      case "question": return renderQuestion();
      case "framework": return renderFramework();
      case "exercise": return renderExercise();
      case "closing": return renderClosing();
      case "quote": return renderQuote();
      default: return renderContent();
    }
  };

  // Extra text blocks overlay
  const extraTexts: Array<{ id: string; text: string; x: number; y: number; fontSize: number }> = content._extraTexts || [];

  // Media items overlay
  const mediaItems: Array<{ id: string; type: "image" | "video"; url: string; x: number; y: number; width: number; height: number; isUploading?: boolean }> = content._mediaItems || [];
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const addExtraText = () => {
    const newBlock = {
      id: Date.now().toString(),
      text: "Novo texto",
      x: 200,
      y: 500,
      fontSize: 32,
    };
    updateContent("_extraTexts", [...extraTexts, newBlock]);
  };

  const updateExtraText = (id: string, updates: Partial<typeof extraTexts[0]>) => {
    updateContent("_extraTexts", extraTexts.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const removeExtraText = (id: string) => {
    updateContent("_extraTexts", extraTexts.filter(t => t.id !== id));
  };

  const replaceMediaItem = useCallback((id: string, nextItem: Partial<typeof mediaItems[0]>) => {
    updateContent(
      "_mediaItems",
      mediaItems.map((media) => (media.id === id ? { ...media, ...nextItem } : media))
    );
  }, [mediaItems, updateContent]);

  // Media functions
  const uploadMediaFile = useCallback(async (file: File) => {
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isImage && !isVideo) {
      toast.error("Formato não suportado. Use imagem ou vídeo.");
      return;
    }

    if (file.size > 1024 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 1GB.");
      return;
    }

    const tempId = Date.now().toString();
    const previewUrl = URL.createObjectURL(file);
    const tempItem = {
      id: tempId,
      type: isVideo ? "video" as const : "image" as const,
      url: previewUrl,
      x: 100,
      y: 100,
      width: isVideo ? 640 : 400,
      height: isVideo ? 360 : 300,
      isUploading: true,
    };

    updateContent("_mediaItems", [...mediaItems, tempItem]);
    setSelectedMedia(tempId);
    toast.info("Enviando arquivo...");

    try {
      const ext = file.name.split(".").pop() || (isVideo ? "mp4" : "png");
      const path = `slides/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      console.log("Uploading media:", path, file.type, file.size);

      const { error: uploadErr, data: uploadData } = await supabase.storage.from("slide-media").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });

      if (uploadErr) {
        console.error("Upload error:", uploadErr);
        updateContent("_mediaItems", mediaItems.filter((media) => media.id !== tempId));
        URL.revokeObjectURL(previewUrl);
        toast.error(`Erro no upload: ${uploadErr.message}`);
        return;
      }

      console.log("Upload success:", uploadData);
      const { data: { publicUrl } } = supabase.storage.from("slide-media").getPublicUrl(path);
      console.log("Public URL:", publicUrl);

      replaceMediaItem(tempId, {
        url: publicUrl,
        isUploading: false,
      });
      URL.revokeObjectURL(previewUrl);
      toast.success("Mídia adicionada!");
    } catch (err: any) {
      console.error("Media upload failed:", err);
      updateContent("_mediaItems", mediaItems.filter((media) => media.id !== tempId));
      URL.revokeObjectURL(previewUrl);
      toast.error(`Erro ao enviar arquivo: ${err?.message || "erro desconhecido"}`);
    }
  }, [mediaItems, replaceMediaItem, updateContent]);

  const updateMediaItem = useCallback((id: string, updates: Partial<typeof mediaItems[0]>) => {
    updateContent("_mediaItems", mediaItems.map(m => m.id === id ? { ...m, ...updates } : m));
  }, [mediaItems, updateContent]);

  const removeMediaItem = useCallback((id: string) => {
    const itemToRemove = mediaItems.find((media) => media.id === id);
    if (itemToRemove?.url?.startsWith("blob:")) {
      URL.revokeObjectURL(itemToRemove.url);
    }
    updateContent("_mediaItems", mediaItems.filter(m => m.id !== id));
    setSelectedMedia(null);
  }, [mediaItems, updateContent]);

  // Paste handler
  useEffect(() => {
    if (!editable) return;
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/") || item.type.startsWith("video/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) await uploadMediaFile(file);
          return;
        }
      }
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [editable, uploadMediaFile]);

  return (
    <div style={wrapperStyle} ref={wrapperRef} onClick={() => setSelectedMedia(null)}>
      {renderSlide()}

      {/* Media items overlay */}
      {mediaItems.map((item) => (
        <DraggableMedia
          key={item.id}
          item={item}
          scale={scale}
          editable={editable}
          selected={selectedMedia === item.id}
          onSelect={() => setSelectedMedia(item.id)}
          onUpdate={(updates) => updateMediaItem(item.id, updates)}
          onRemove={() => removeMediaItem(item.id)}
        />
      ))}

      {/* Extra text blocks overlay */}
      {extraTexts.map((block) => (
        <DraggableTextBlock
          key={block.id}
          block={block}
          scale={scale}
          editable={editable}
          colors={colors}
          onUpdate={(updates) => updateExtraText(block.id, updates)}
          onRemove={() => removeExtraText(block.id)}
        />
      ))}

      {/* Edit controls */}
      {editable && (
        <div
          style={{
            position: "absolute",
            bottom: 8,
            right: 8,
            display: "flex",
            gap: 4,
            zIndex: 20,
          }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: "rgba(10,25,49,0.85)",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "6px 10px",
              fontSize: 12,
              cursor: "pointer",
            }}
            title="Adicionar imagem/vídeo (ou cole com Ctrl+V)"
          >
            <ImagePlus size={14} />
            <span>Mídia</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadMediaFile(file);
              e.target.value = "";
            }}
          />
          <button
            onClick={(e) => { e.stopPropagation(); addExtraText(); }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: "rgba(10,25,49,0.85)",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "6px 10px",
              fontSize: 12,
              cursor: "pointer",
            }}
            title="Adicionar texto"
          >
            <Type size={14} />
            <span>Texto</span>
          </button>
        </div>
      )}
    </div>
  );
}

// Draggable text block component
function DraggableTextBlock({
  block,
  scale,
  editable,
  colors,
  onUpdate,
  onRemove,
}: {
  block: { id: string; text: string; x: number; y: number; fontSize: number };
  scale: number;
  editable?: boolean;
  colors: any;
  onUpdate: (updates: Partial<{ text: string; x: number; y: number; fontSize: number }>) => void;
  onRemove: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [focused, setFocused] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);
  const isFocusedText = useRef(false);

  useEffect(() => {
    if (textRef.current && !isFocusedText.current) {
      textRef.current.innerText = block.text || "";
    }
  }, [block.text]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).getAttribute("contenteditable") === "true") return;
    e.preventDefault();
    dragging.current = true;
    const rect = ref.current?.getBoundingClientRect();
    if (rect) {
      dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragging.current || !ref.current?.parentElement) return;
      const parent = ref.current.parentElement.getBoundingClientRect();
      const newX = (ev.clientX - parent.left - dragOffset.current.x) / scale;
      const newY = (ev.clientY - parent.top - dragOffset.current.y) / scale;
      onUpdate({ x: Math.max(0, Math.round(newX)), y: Math.max(0, Math.round(newY)) });
    };
    const handleMouseUp = () => {
      dragging.current = false;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div
      ref={ref}
      onMouseDown={editable ? handleMouseDown : undefined}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!ref.current?.contains(e.relatedTarget as Node)) setFocused(false);
      }}
      style={{
        position: "absolute",
        left: block.x * scale,
        top: block.y * scale,
        zIndex: 10,
        cursor: editable ? "move" : "default",
      }}
    >
      {/* Controls */}
      {editable && focused && (
        <div
          style={{
            position: "absolute",
            top: -30 * scale,
            left: 0,
            display: "flex",
            gap: 2,
            background: "rgba(10,25,49,0.9)",
            borderRadius: 4 * scale,
            padding: `${2 * scale}px ${4 * scale}px`,
            zIndex: 50,
            alignItems: "center",
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <button
            onMouseDown={(e) => { e.preventDefault(); onUpdate({ fontSize: Math.max(12, block.fontSize - 2) }); }}
            style={{ color: "#fff", border: "none", background: "transparent", cursor: "pointer", display: "flex", padding: 2 }}
          >
            <Minus size={12 * scale} />
          </button>
          <span style={{ color: "#fff", fontSize: 10 * scale, minWidth: 20 * scale, textAlign: "center" }}>{block.fontSize}</span>
          <button
            onMouseDown={(e) => { e.preventDefault(); onUpdate({ fontSize: Math.min(120, block.fontSize + 2) }); }}
            style={{ color: "#fff", border: "none", background: "transparent", cursor: "pointer", display: "flex", padding: 2 }}
          >
            <Plus size={12 * scale} />
          </button>
          <div style={{ width: 1, height: 14 * scale, background: "rgba(255,255,255,0.3)", margin: `0 ${2 * scale}px` }} />
          <button
            onMouseDown={(e) => { e.preventDefault(); onRemove(); }}
            style={{ color: "#ff6b6b", border: "none", background: "transparent", cursor: "pointer", display: "flex", padding: 2 }}
          >
            <Trash2 size={12 * scale} />
          </button>
        </div>
      )}
      <div
        ref={textRef}
        contentEditable={editable}
        suppressContentEditableWarning
        onFocus={() => { isFocusedText.current = true; setFocused(true); }}
        onBlur={() => {
          isFocusedText.current = false;
          if (textRef.current) {
            onUpdate({ text: textRef.current.innerText.trim() });
          }
        }}
        style={{
          fontSize: block.fontSize * scale,
          color: colors.text,
          fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
          outline: editable && focused ? `${2 * scale}px dashed rgba(200,30,30,0.5)` : "none",
          padding: `${4 * scale}px ${8 * scale}px`,
          minWidth: 60 * scale,
          minHeight: 20 * scale,
          cursor: editable ? "text" : "default",
          whiteSpace: "pre-wrap",
        }}
      />
    </div>
  );
}

// Draggable media item component
function DraggableMedia({
  item,
  scale,
  editable,
  selected,
  onSelect,
  onUpdate,
  onRemove,
}: {
  item: { id: string; type: "image" | "video"; url: string; x: number; y: number; width: number; height: number; isUploading?: boolean };
  scale: number;
  editable?: boolean;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<{ x: number; y: number; width: number; height: number; isUploading?: boolean }>) => void;
  onRemove: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const resizing = useRef(false);
  const startRef = useRef({ x: 0, y: 0, itemX: 0, itemY: 0, itemW: 0, itemH: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!editable || item.isUploading) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect();
    dragging.current = true;
    startRef.current = { x: e.clientX, y: e.clientY, itemX: item.x, itemY: item.y, itemW: item.width, itemH: item.height };

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const dx = (ev.clientX - startRef.current.x) / scale;
      const dy = (ev.clientY - startRef.current.y) / scale;
      onUpdate({
        x: Math.max(0, Math.round(startRef.current.itemX + dx)),
        y: Math.max(0, Math.round(startRef.current.itemY + dy)),
      });
    };
    const onUp = () => {
      dragging.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const handleResizeDown = (e: React.MouseEvent) => {
    if (item.isUploading) return;
    e.preventDefault();
    e.stopPropagation();
    resizing.current = true;
    startRef.current = { x: e.clientX, y: e.clientY, itemX: item.x, itemY: item.y, itemW: item.width, itemH: item.height };

    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return;
      const dx = (ev.clientX - startRef.current.x) / scale;
      const dy = (ev.clientY - startRef.current.y) / scale;
      onUpdate({
        width: Math.max(50, Math.round(startRef.current.itemW + dx)),
        height: Math.max(50, Math.round(startRef.current.itemH + dy)),
      });
    };
    const onUp = () => {
      resizing.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div
      ref={ref}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onMouseDown={handleMouseDown}
      style={{
        position: "absolute",
        left: item.x * scale,
        top: item.y * scale,
        width: item.width * scale,
        height: item.height * scale,
        zIndex: 10,
        cursor: editable && !item.isUploading ? "move" : "default",
        outline: selected && editable ? `${2 * scale}px solid #C81E1E` : "none",
        borderRadius: 4 * scale,
        overflow: "hidden",
        background: "rgba(10,25,49,0.08)",
      }}
    >
      {item.type === "image" ? (
        <img
          src={item.url}
          alt="Mídia do slide"
          draggable={false}
          style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none", userSelect: "none" }}
        />
      ) : (
        <video
          src={item.url}
          muted
          loop
          autoPlay
          playsInline
          preload="auto"
          controls={!editable && !item.isUploading}
          onLoadedData={() => console.log("Video rendered:", item.url)}
          onError={(event) => console.error("Video render error:", item.url, event.currentTarget.error)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            background: "#111827",
            display: "block",
            pointerEvents: editable ? "none" : "auto",
          }}
        />
      )}

      {item.isUploading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(10,25,49,0.45)",
            color: "#fff",
            fontSize: 18 * scale,
            fontWeight: 700,
            letterSpacing: 0.4,
          }}
        >
          Enviando mídia...
        </div>
      )}

      {/* Controls when selected */}
      {selected && editable && !item.isUploading && (
        <>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            style={{
              position: "absolute",
              top: -8 * scale,
              right: -8 * scale,
              width: 20 * scale,
              height: 20 * scale,
              borderRadius: "50%",
              background: "#DC2626",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 50,
            }}
          >
            <X size={12 * scale} />
          </button>

          <div style={{
            position: "absolute",
            top: -12 * scale,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#C81E1E",
            borderRadius: 999,
            padding: 2 * scale,
            display: "flex",
          }}>
            <Move size={10 * scale} color="#fff" />
          </div>

          <div
            onMouseDown={handleResizeDown}
            style={{
              position: "absolute",
              bottom: -4 * scale,
              right: -4 * scale,
              width: 14 * scale,
              height: 14 * scale,
              background: "#C81E1E",
              borderRadius: 2 * scale,
              cursor: "se-resize",
              zIndex: 50,
            }}
          />
        </>
      )}
    </div>
  );
}
