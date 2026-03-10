import { useState, useRef, useCallback } from "react";
import { 
  Target, Lightbulb, BookOpen, HelpCircle, Award, CheckCircle, 
  ArrowRight, Zap, Star, MessageCircle, BarChart3, Users 
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
  placeholder = "Clique para editar..."
}: { 
  value: string; 
  onChange: (val: string) => void; 
  editable?: boolean; 
  style: React.CSSProperties; 
  tag?: string;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  
  const handleBlur = useCallback(() => {
    if (ref.current) {
      const newText = ref.current.innerText.trim();
      if (newText !== value) {
        onChange(newText);
      }
    }
  }, [value, onChange]);

  const editableStyle: React.CSSProperties = editable ? {
    ...style,
    cursor: "text",
    outline: "none",
    borderRadius: 4,
    transition: "box-shadow 0.2s",
    minWidth: 100,
    minHeight: "1em",
  } : style;

  return (
    <div
      ref={ref}
      contentEditable={editable}
      suppressContentEditableWarning
      onBlur={handleBlur}
      onFocus={(e) => {
        if (editable) {
          (e.target as HTMLElement).style.boxShadow = "0 0 0 2px rgba(200,30,30,0.5)";
        }
      }}
      onMouseOut={() => {}}
      onBlurCapture={(e) => {
        (e.target as HTMLElement).style.boxShadow = "none";
      }}
      style={editableStyle}
      data-placeholder={!value ? placeholder : undefined}
    >
      {value || (editable ? placeholder : "")}
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
}: {
  bullets: string[];
  onChange: (bullets: string[]) => void;
  editable?: boolean;
  colors: any;
  fontSize?: number;
  bulletStyle?: "dot" | "number" | "check";
}) {
  const handleBulletChange = (index: number, newVal: string) => {
    const updated = [...bullets];
    updated[index] = newVal;
    onChange(updated);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: bulletStyle === "dot" ? 24 : 20 }}>
      {bullets.map((bullet, i) => (
        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: bulletStyle === "dot" ? 16 : 12 }}>
          {bulletStyle === "dot" && (
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: colors.accent, marginTop: 10, flexShrink: 0 }} />
          )}
          {bulletStyle === "number" && (
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: colors.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18, flexShrink: 0 }}>
              {i + 1}
            </div>
          )}
          {bulletStyle === "check" && (
            <CheckCircle size={22} color={colors.accent} style={{ flexShrink: 0, marginTop: 2 }} />
          )}
          <EditableText
            value={bullet}
            onChange={(val) => handleBulletChange(i, val)}
            editable={editable}
            style={{ fontSize, lineHeight: 1.4, color: colors.text }}
          />
        </div>
      ))}
    </div>
  );
}

export function SlideRenderer({ slide, scale, editable, onUpdate }: Props) {
  const colors = getSlideColors(slide.slide_type);
  const content = slide.content || {};

  const updateTitle = (title: string) => onUpdate?.({ title });
  const updateSubtitle = (subtitle: string) => onUpdate?.({ subtitle });
  const updateContent = (key: string, value: any) => {
    onUpdate?.({ content: { ...content, [key]: value } });
  };

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
        bottom: position === "left" ? 30 : 30, 
        [position]: 40, 
        height: 60, 
        objectFit: "contain",
        opacity: 0.7,
      }} 
    />
  );

  const renderCover = () => (
    <div style={containerStyle}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 8, background: colors.accent }} />
      <div style={{ position: "absolute", right: -100, top: -100, width: 500, height: 500, borderRadius: "50%", background: "rgba(200,30,30,0.15)" }} />
      <div style={{ position: "absolute", right: 50, bottom: -50, width: 300, height: 300, borderRadius: "50%", background: "rgba(200,30,30,0.1)" }} />
      
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%", padding: "0 120px" }}>
        <img src={unvLogo} alt="Universidade Nacional de Vendas" style={{ height: 100, objectFit: "contain", alignSelf: "flex-start", marginBottom: 32 }} />
        <EditableText
          value={slide.title || ""}
          onChange={updateTitle}
          editable={editable}
          style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.1, marginBottom: 24, maxWidth: 1200 }}
        />
        <EditableText
          value={slide.subtitle || ""}
          onChange={updateSubtitle}
          editable={editable}
          style={{ fontSize: 28, opacity: 0.8, maxWidth: 900, lineHeight: 1.4 }}
          placeholder="Subtítulo..."
        />
        <div style={{ position: "absolute", bottom: 60, left: 120, right: 120, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ width: 80, height: 4, background: colors.accent }} />
          <span style={{ fontSize: 14, opacity: 0.5 }}>unv.com.br</span>
        </div>
      </div>
    </div>
  );

  const renderHighlight = () => (
    <div style={containerStyle}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "100%", padding: "0 160px", textAlign: "center" }}>
        <div style={{ width: 80, height: 4, background: "rgba(255,255,255,0.5)", marginBottom: 48 }} />
        <EditableText
          value={content.highlight || slide.title || ""}
          onChange={(val) => updateContent("highlight", val)}
          editable={editable}
          style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.2, marginBottom: 32 }}
        />
        <EditableText
          value={content.text || ""}
          onChange={(val) => updateContent("text", val)}
          editable={editable}
          style={{ fontSize: 24, opacity: 0.85, maxWidth: 900 }}
          placeholder="Texto adicional..."
        />
        <div style={{ width: 80, height: 4, background: "rgba(255,255,255,0.5)", marginTop: 48 }} />
      </div>
      {logoFooter("right")}
    </div>
  );

  const renderQuestion = () => (
    <div style={containerStyle}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "100%", padding: "0 160px", textAlign: "center" }}>
        <HelpCircle size={80} color={colors.accent} style={{ marginBottom: 40 }} />
        <EditableText
          value={content.question || slide.title || ""}
          onChange={(val) => updateContent("question", val)}
          editable={editable}
          style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.3, marginBottom: 32 }}
        />
        <EditableText
          value={content.text || ""}
          onChange={(val) => updateContent("text", val)}
          editable={editable}
          style={{ fontSize: 22, opacity: 0.7, maxWidth: 800 }}
          placeholder="Texto complementar..."
        />
      </div>
      {logoFooter("left")}
    </div>
  );

  const renderFramework = () => (
    <div style={containerStyle}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 6, background: colors.accent }} />
      <div style={{ padding: "80px 120px" }}>
        <div style={{ fontSize: 14, letterSpacing: 4, textTransform: "uppercase", color: colors.accent, marginBottom: 16, fontWeight: 700 }}>Framework</div>
        <EditableText
          value={content.framework_name || slide.title || ""}
          onChange={(val) => updateContent("framework_name", val)}
          editable={editable}
          style={{ fontSize: 48, fontWeight: 800, marginBottom: 48, color: colors.text }}
        />
        {content.framework_steps?.length ? (
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            {content.framework_steps.map((step: string, i: number) => (
              <div key={i} style={{
                flex: "1 1 200px", padding: 32,
                background: i % 2 === 0 ? "#F1F5F9" : "#EEF2FF",
                borderRadius: 16, borderLeft: `4px solid ${colors.accent}`, minWidth: 200,
              }}>
                <div style={{ fontSize: 36, fontWeight: 800, color: colors.accent, marginBottom: 12 }}>
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
                  style={{ fontSize: 20, fontWeight: 600, color: colors.text }}
                />
              </div>
            ))}
          </div>
        ) : content.bullets?.length ? (
          <EditableBullets
            bullets={content.bullets}
            onChange={(b) => updateContent("bullets", b)}
            editable={editable}
            colors={colors}
            fontSize={22}
            bulletStyle="number"
          />
        ) : null}
      </div>
    </div>
  );

  const renderExercise = () => (
    <div style={containerStyle}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%", padding: "0 120px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, borderRadius: 12, background: colors.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BookOpen size={28} color="#fff" />
          </div>
          <div style={{ fontSize: 14, letterSpacing: 4, textTransform: "uppercase", color: colors.accent, fontWeight: 700 }}>Exercício Prático</div>
        </div>
        <EditableText
          value={content.exercise_title || slide.title || ""}
          onChange={(val) => updateContent("exercise_title", val)}
          editable={editable}
          style={{ fontSize: 48, fontWeight: 800, marginBottom: 32 }}
        />
        <EditableText
          value={content.exercise_instructions || ""}
          onChange={(val) => updateContent("exercise_instructions", val)}
          editable={editable}
          style={{ fontSize: 24, opacity: 0.85, maxWidth: 1200, lineHeight: 1.6, marginBottom: 32 }}
          placeholder="Instruções do exercício..."
        />
        {content.bullets?.length && (
          <EditableBullets
            bullets={content.bullets}
            onChange={(b) => updateContent("bullets", b)}
            editable={editable}
            colors={colors}
            fontSize={20}
            bulletStyle="check"
          />
        )}
      </div>
      {logoFooter("left")}
    </div>
  );

  const renderContent = () => (
    <div style={containerStyle}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 6, background: colors.accent }} />
      <div style={{ padding: "80px 120px", height: "100%", display: "flex", flexDirection: "column" }}>
        {slide.subtitle && (
          <EditableText
            value={slide.subtitle}
            onChange={updateSubtitle}
            editable={editable}
            style={{ fontSize: 14, letterSpacing: 3, textTransform: "uppercase", color: colors.accent, marginBottom: 12, fontWeight: 600 }}
          />
        )}
        <EditableText
          value={slide.title || ""}
          onChange={updateTitle}
          editable={editable}
          style={{ fontSize: 48, fontWeight: 800, marginBottom: 48, color: colors.text }}
        />
        
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {content.bullets?.length ? (
            <EditableBullets
              bullets={content.bullets}
              onChange={(b) => updateContent("bullets", b)}
              editable={editable}
              colors={colors}
              fontSize={26}
              bulletStyle="dot"
            />
          ) : (
            <EditableText
              value={content.text || ""}
              onChange={(val) => updateContent("text", val)}
              editable={editable}
              style={{ fontSize: 26, lineHeight: 1.6, maxWidth: 1400, color: colors.text }}
              placeholder="Conteúdo do slide..."
            />
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 24, borderTop: "1px solid rgba(0,0,0,0.08)" }}>
          <span style={{ fontSize: 12, color: colors.accent, fontWeight: 600, letterSpacing: 2 }}>UNV</span>
          <span style={{ fontSize: 12, opacity: 0.4 }}>universidadevendas.com.br</span>
        </div>
      </div>
    </div>
  );

  const renderClosing = () => (
    <div style={containerStyle}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 8, background: colors.accent }} />
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "100%", padding: "0 160px", textAlign: "center" }}>
        <Award size={64} color={colors.accent} style={{ marginBottom: 40 }} />
        <EditableText
          value={slide.title || "Obrigado!"}
          onChange={updateTitle}
          editable={editable}
          style={{ fontSize: 56, fontWeight: 800, marginBottom: 24 }}
        />
        <EditableText
          value={content.text || ""}
          onChange={(val) => updateContent("text", val)}
          editable={editable}
          style={{ fontSize: 24, opacity: 0.8, maxWidth: 800, marginBottom: 40 }}
          placeholder="Mensagem final..."
        />
        <div style={{ fontSize: 18, color: colors.accent, fontWeight: 700, letterSpacing: 4, textTransform: "uppercase" }}>
          Universidade Nacional de Vendas
        </div>
      </div>
    </div>
  );

  const renderQuote = () => (
    <div style={containerStyle}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "100%", padding: "0 200px", textAlign: "center" }}>
        <div style={{ fontSize: 120, color: colors.accent, lineHeight: 0.8, marginBottom: 32 }}>"</div>
        <EditableText
          value={content.highlight || content.text || slide.title || ""}
          onChange={(val) => updateContent("highlight", val)}
          editable={editable}
          style={{ fontSize: 36, fontWeight: 600, lineHeight: 1.5, fontStyle: "italic", marginBottom: 32, color: colors.text }}
        />
        <EditableText
          value={slide.subtitle || ""}
          onChange={updateSubtitle}
          editable={editable}
          style={{ fontSize: 18, color: colors.accent, fontWeight: 600 }}
          placeholder="Autor..."
        />
      </div>
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

  return (
    <div style={wrapperStyle}>
      {renderSlide()}
    </div>
  );
}
