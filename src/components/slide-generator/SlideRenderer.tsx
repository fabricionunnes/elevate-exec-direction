import { 
  Target, Lightbulb, BookOpen, HelpCircle, Award, CheckCircle, 
  ArrowRight, Zap, Star, MessageCircle, BarChart3, Users 
} from "lucide-react";

interface SlideItem {
  slide_type: string;
  title: string | null;
  subtitle: string | null;
  content: any;
  layout_type: string | null;
}

interface Props {
  slide: SlideItem;
  scale: number;
}

const ICON_MAP: Record<string, any> = {
  target: Target,
  lightbulb: Lightbulb,
  book: BookOpen,
  question: HelpCircle,
  award: Award,
  check: CheckCircle,
  arrow: ArrowRight,
  zap: Zap,
  star: Star,
  message: MessageCircle,
  chart: BarChart3,
  users: Users,
};

function getSlideColors(type: string) {
  const navy = "#0A1931";
  const red = "#C81E1E";
  const white = "#FFFFFF";
  const lightGray = "#F1F5F9";

  switch (type) {
    case "cover":
      return { bg: navy, text: white, accent: red };
    case "closing":
      return { bg: navy, text: white, accent: red };
    case "highlight":
      return { bg: red, text: white, accent: navy };
    case "question":
      return { bg: `linear-gradient(135deg, ${navy} 0%, #1a3a5c 100%)`, text: white, accent: "#FFD700" };
    case "exercise":
      return { bg: `linear-gradient(135deg, #1a3a5c 0%, ${navy} 100%)`, text: white, accent: "#4ADE80" };
    case "framework":
      return { bg: white, text: navy, accent: red };
    case "quote":
      return { bg: lightGray, text: navy, accent: red };
    case "data":
      return { bg: white, text: navy, accent: "#3B82F6" };
    default:
      return { bg: white, text: navy, accent: red };
  }
}

export function SlideRenderer({ slide, scale }: Props) {
  const colors = getSlideColors(slide.slide_type);
  const content = slide.content || {};
  const IconComponent = ICON_MAP[content.icon] || null;

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

  const renderCover = () => (
    <div style={containerStyle}>
      {/* Red accent top */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 8, background: colors.accent }} />
      {/* Geometric decoration */}
      <div style={{ position: "absolute", right: -100, top: -100, width: 500, height: 500, borderRadius: "50%", background: "rgba(200,30,30,0.15)" }} />
      <div style={{ position: "absolute", right: 50, bottom: -50, width: 300, height: 300, borderRadius: "50%", background: "rgba(200,30,30,0.1)" }} />
      
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%", padding: "0 120px" }}>
        <div style={{ fontSize: 18, letterSpacing: 6, textTransform: "uppercase", color: colors.accent, marginBottom: 32, fontWeight: 700 }}>
          Universidade Nacional de Vendas
        </div>
        <h1 style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.1, marginBottom: 24, maxWidth: 1200 }}>
          {slide.title}
        </h1>
        {slide.subtitle && (
          <p style={{ fontSize: 28, opacity: 0.8, maxWidth: 900, lineHeight: 1.4 }}>{slide.subtitle}</p>
        )}
        {/* Bottom bar */}
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
        <h1 style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.2, marginBottom: 32 }}>
          {content.highlight || slide.title}
        </h1>
        {content.text && (
          <p style={{ fontSize: 24, opacity: 0.85, maxWidth: 900 }}>{content.text}</p>
        )}
        <div style={{ width: 80, height: 4, background: "rgba(255,255,255,0.5)", marginTop: 48 }} />
      </div>
      {/* UNV watermark */}
      <div style={{ position: "absolute", bottom: 30, right: 40, fontSize: 12, opacity: 0.3 }}>UNV</div>
    </div>
  );

  const renderQuestion = () => (
    <div style={containerStyle}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "100%", padding: "0 160px", textAlign: "center" }}>
        <HelpCircle size={80} color={colors.accent} style={{ marginBottom: 40 }} />
        <h1 style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.3, marginBottom: 32 }}>
          {content.question || slide.title}
        </h1>
        {content.text && (
          <p style={{ fontSize: 22, opacity: 0.7, maxWidth: 800 }}>{content.text}</p>
        )}
      </div>
      <div style={{ position: "absolute", bottom: 30, left: 40, fontSize: 12, opacity: 0.4, color: colors.accent }}>
        Momento de Reflexão
      </div>
    </div>
  );

  const renderFramework = () => (
    <div style={containerStyle}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 6, background: colors.accent }} />
      <div style={{ padding: "80px 120px" }}>
        <div style={{ fontSize: 14, letterSpacing: 4, textTransform: "uppercase", color: colors.accent, marginBottom: 16, fontWeight: 700 }}>Framework</div>
        <h1 style={{ fontSize: 48, fontWeight: 800, marginBottom: 48, color: colors.text }}>
          {content.framework_name || slide.title}
        </h1>
        {content.framework_steps?.length ? (
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            {content.framework_steps.map((step: string, i: number) => (
              <div key={i} style={{
                flex: "1 1 200px",
                padding: 32,
                background: i % 2 === 0 ? "#F1F5F9" : "#EEF2FF",
                borderRadius: 16,
                borderLeft: `4px solid ${colors.accent}`,
                minWidth: 200,
              }}>
                <div style={{ fontSize: 36, fontWeight: 800, color: colors.accent, marginBottom: 12 }}>
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div style={{ fontSize: 20, fontWeight: 600, color: colors.text }}>{step}</div>
              </div>
            ))}
          </div>
        ) : content.bullets?.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {content.bullets.map((b: string, i: number) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: colors.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18, flexShrink: 0 }}>
                  {i + 1}
                </div>
                <span style={{ fontSize: 22, color: colors.text }}>{b}</span>
              </div>
            ))}
          </div>
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
        <h1 style={{ fontSize: 48, fontWeight: 800, marginBottom: 32 }}>
          {content.exercise_title || slide.title}
        </h1>
        {content.exercise_instructions && (
          <p style={{ fontSize: 24, opacity: 0.85, maxWidth: 1200, lineHeight: 1.6, marginBottom: 32 }}>
            {content.exercise_instructions}
          </p>
        )}
        {content.bullets?.length && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {content.bullets.map((b: string, i: number) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <CheckCircle size={22} color={colors.accent} style={{ flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: 20 }}>{b}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderContent = () => (
    <div style={containerStyle}>
      {/* Top accent line */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 6, background: colors.accent }} />
      <div style={{ padding: "80px 120px", height: "100%", display: "flex", flexDirection: "column" }}>
        {slide.subtitle && (
          <div style={{ fontSize: 14, letterSpacing: 3, textTransform: "uppercase", color: colors.accent, marginBottom: 12, fontWeight: 600 }}>
            {slide.subtitle}
          </div>
        )}
        <h1 style={{ fontSize: 48, fontWeight: 800, marginBottom: 48, color: colors.text }}>
          {slide.title}
        </h1>
        
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {content.bullets?.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {content.bullets.map((bullet: string, i: number) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: colors.accent, marginTop: 10, flexShrink: 0 }} />
                  <span style={{ fontSize: 26, lineHeight: 1.4, color: colors.text }}>{bullet}</span>
                </div>
              ))}
            </div>
          ) : content.text ? (
            <p style={{ fontSize: 26, lineHeight: 1.6, maxWidth: 1400, color: colors.text }}>{content.text}</p>
          ) : null}
        </div>

        {/* Bottom branding */}
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
        <h1 style={{ fontSize: 56, fontWeight: 800, marginBottom: 24 }}>
          {slide.title || "Obrigado!"}
        </h1>
        {content.text && (
          <p style={{ fontSize: 24, opacity: 0.8, maxWidth: 800, marginBottom: 40 }}>{content.text}</p>
        )}
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
        <p style={{ fontSize: 36, fontWeight: 600, lineHeight: 1.5, fontStyle: "italic", marginBottom: 32, color: colors.text }}>
          {content.highlight || content.text || slide.title}
        </p>
        {slide.subtitle && (
          <p style={{ fontSize: 18, color: colors.accent, fontWeight: 600 }}>— {slide.subtitle}</p>
        )}
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
