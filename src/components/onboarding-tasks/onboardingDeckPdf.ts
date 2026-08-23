// Deck de onboarding em PDF, com o branding UNV (navy + vermelho + logo).
// Desenhado direto no jsPDF (texto vetorial), não é captura de tela: sai leve,
// nítido em qualquer zoom e não depende do CSS da página — foi por isso que a
// exportação anterior, feita com html-to-image, morria em silêncio.
import jsPDF from "jspdf";

const NAVY: [number, number, number] = [13, 43, 94]; // #0D2B5E
const RED: [number, number, number] = [204, 27, 27]; // #CC1B1B
const INK: [number, number, number] = [28, 32, 40];
const GRAY: [number, number, number] = [110, 120, 135];
const LIGHT: [number, number, number] = [244, 246, 250];

// 16:9 em mm (padrão de apresentação)
const W = 338.7;
const H = 190.5;

export interface DeckPhase {
  title: string; period: string; objective: string;
  deliverables: string[]; client_actions: string[]; outcome: string;
}
export interface DeckData {
  title: string;
  subtitle?: string | null;
  intro?: string | null;
  phases: DeckPhase[];
  expectations?: { unv?: string[]; cliente?: string[] };
  success_metrics?: { label: string; target: string }[];
  clientName?: string;
}

async function loadLogo(src = "/images/unv-logo.png"): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
    const c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext("2d")!.drawImage(img, 0, 0);
    return { data: c.toDataURL("image/png"), w: img.naturalWidth, h: img.naturalHeight };
  } catch { return null; }
}

export async function generateOnboardingDeck(plan: DeckData): Promise<void> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [W, H] });
  const logo = await loadLogo("/images/unv-logo.png");           // colorida, fundo transparente
  const logoW = await loadLogo("/images/unv-logo-white.png");     // branca, para os slides navy

  const logoAt = (x: number, y: number, maxW: number, branca = false) => {
    const l = branca ? (logoW || logo) : logo;
    if (!l) return;
    const h = (l.h * maxW) / l.w;
    doc.addImage(l.data, "PNG", x, y, maxW, h);
  };

  /** moldura padrão de todo slide de conteúdo */
  const frame = (n: number, total: number) => {
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, W, H, "F");
    // faixa lateral navy + fio vermelho
    doc.setFillColor(...NAVY); doc.rect(0, 0, 5, H, "F");
    doc.setFillColor(...RED); doc.rect(5, 0, 1.6, H, "F");
    // rodapé
    doc.setDrawColor(230, 233, 238); doc.setLineWidth(0.3);
    doc.line(18, H - 14, W - 18, H - 14);
    logoAt(W - 42, H - 11.5, 24);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...GRAY);
    doc.text(plan.clientName || "", 18, H - 8.5);
    doc.text(`${n}/${total}`, W / 2, H - 8.5, { align: "center" });
  };

  const total = plan.phases.length + 2 + ((plan.success_metrics?.length || plan.expectations?.unv?.length || plan.expectations?.cliente?.length) ? 1 : 0);
  let page = 0;

  // ── CAPA ───────────────────────────────────────────────────────────────
  doc.setFillColor(...NAVY); doc.rect(0, 0, W, H, "F");
  doc.setFillColor(...RED); doc.rect(0, H - 6, W, 6, "F");
  logoAt(24, 20, 44, true);
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(255, 210, 210);
  if (plan.subtitle) doc.text(plan.subtitle.toUpperCase(), 24, 84);
  doc.setFontSize(34); doc.setTextColor(255, 255, 255);
  const capa = doc.splitTextToSize(plan.title, W - 100);
  doc.text(capa, 24, 100);
  doc.setFont("helvetica", "normal"); doc.setFontSize(12); doc.setTextColor(205, 214, 230);
  doc.text("Plano de trabalho e caminho para o resultado", 24, 100 + capa.length * 13 + 6);

  // ── ABERTURA ───────────────────────────────────────────────────────────
  doc.addPage([W, H], "landscape"); page++;
  frame(page, total);
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...RED);
  doc.text("O QUE VAMOS CONSTRUIR JUNTOS", 18, 30);
  doc.setFontSize(24); doc.setTextColor(...NAVY);
  doc.text("O caminho", 18, 46);
  doc.setFont("helvetica", "normal"); doc.setFontSize(13); doc.setTextColor(...INK);
  doc.text(doc.splitTextToSize(plan.intro || "", W - 80), 18, 62, { lineHeightFactor: 1.5 });

  // trilha das fases no rodapé da abertura
  const trilhaY = H - 34;
  const step = (W - 46) / Math.max(plan.phases.length, 1);
  plan.phases.forEach((ph, i) => {
    const x = 23 + step * i;
    doc.setFillColor(...(i === 0 ? RED : NAVY));
    doc.circle(x + 3.2, trilhaY, 3.2, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(255, 255, 255);
    doc.text(String(i + 1), x + 3.2, trilhaY + 1.1, { align: "center" });
    if (i < plan.phases.length - 1) {
      doc.setDrawColor(210, 216, 226); doc.setLineWidth(0.6);
      doc.line(x + 7, trilhaY, x + step - 1, trilhaY);
    }
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...NAVY);
    doc.text(doc.splitTextToSize(ph.title, step - 6), x, trilhaY + 9);
  });

  // ── UMA FASE POR SLIDE ─────────────────────────────────────────────────
  plan.phases.forEach((ph, i) => {
    doc.addPage([W, H], "landscape"); page++;
    frame(page, total);

    // cabeçalho da fase
    doc.setFillColor(...RED); doc.circle(26, 27, 7, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(255, 255, 255);
    doc.text(String(i + 1), 26, 29.6, { align: "center" });
    doc.setFontSize(22); doc.setTextColor(...NAVY);
    doc.text(ph.title, 38, 26);
    if (ph.period) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...GRAY);
      doc.text(ph.period, 38, 33);
    }

    let y = 45;
    if (ph.objective) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(11.5); doc.setTextColor(...INK);
      const ob = doc.splitTextToSize(ph.objective, W - 40);
      doc.text(ob, 18, y, { lineHeightFactor: 1.45 });
      y += ob.length * 6.4 + 6;
    }

    // duas colunas: entrega x precisa de você
    const colW = (W - 46) / 2;
    const col = (x: number, titulo: string, cor: [number, number, number], itens: string[]) => {
      const lista = (itens || []).filter(Boolean);
      if (!lista.length) return;
      doc.setFillColor(...LIGHT);
      const alturas = lista.map((t) => doc.splitTextToSize(t, colW - 14).length);
      const boxH = 14 + alturas.reduce((a, b) => a + b * 5.4 + 3.4, 0);
      doc.roundedRect(x, y, colW, Math.min(boxH, H - y - 22), 3, 3, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...cor);
      doc.text(titulo.toUpperCase(), x + 7, y + 9);
      let yy = y + 17;
      lista.forEach((t) => {
        const linhas = doc.splitTextToSize(t, colW - 16);
        doc.setFillColor(...cor); doc.circle(x + 8.5, yy - 1.4, 0.9, "F");
        doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...INK);
        doc.text(linhas, x + 12, yy, { lineHeightFactor: 1.35 });
        yy += linhas.length * 5.4 + 3.4;
      });
    };
    col(18, "A UNV entrega", NAVY, ph.deliverables);
    col(18 + colW + 10, "O que precisamos de você", RED, ph.client_actions);

    // resultado da fase
    if (ph.outcome) {
      const oy = H - 30;
      doc.setFillColor(...NAVY);
      doc.roundedRect(18, oy - 8, W - 36, 15, 2.5, 2.5, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(255, 190, 190);
      doc.text("NO FIM DESTA FASE", 25, oy - 2.5);
      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(255, 255, 255);
      doc.text(doc.splitTextToSize(ph.outcome, W - 52)[0] || "", 25, oy + 3.5);
    }
  });

  // ── MÉTRICAS E COMBINADO ───────────────────────────────────────────────
  const temMetricas = !!plan.success_metrics?.length;
  const temCombinado = !!(plan.expectations?.unv?.length || plan.expectations?.cliente?.length);
  if (temMetricas || temCombinado) {
    doc.addPage([W, H], "landscape"); page++;
    frame(page, total);
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...RED);
    doc.text("COMO VAMOS MEDIR", 18, 26);
    doc.setFontSize(22); doc.setTextColor(...NAVY);
    doc.text("Sucesso e combinado", 18, 40);

    let y = 56;
    if (temMetricas) {
      plan.success_metrics!.forEach((m) => {
        doc.setDrawColor(232, 236, 242); doc.setLineWidth(0.3);
        doc.line(18, y + 2.5, 155, y + 2.5);
        doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(...INK);
        doc.text(m.label, 18, y);
        doc.setFont("helvetica", "bold"); doc.setTextColor(...RED);
        doc.text(m.target || "a definir no kick-off", 155, y, { align: "right" });
        y += 10;
      });
    }
    if (temCombinado) {
      let yy = 56;
      const bloco = (titulo: string, itens: string[] = []) => {
        const lista = itens.filter(Boolean);
        if (!lista.length) return;
        doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...NAVY);
        doc.text(titulo.toUpperCase(), 175, yy); yy += 7;
        lista.forEach((t) => {
          const linhas = doc.splitTextToSize(t, W - 200);
          doc.setFillColor(...RED); doc.circle(177, yy - 1.4, 0.9, "F");
          doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...INK);
          doc.text(linhas, 181, yy, { lineHeightFactor: 1.35 });
          yy += linhas.length * 5.4 + 3;
        });
        yy += 5;
      };
      bloco("Da UNV", plan.expectations?.unv);
      bloco("De você", plan.expectations?.cliente);
    }
  }

  // ── FECHAMENTO ─────────────────────────────────────────────────────────
  doc.addPage([W, H], "landscape");
  doc.setFillColor(...NAVY); doc.rect(0, 0, W, H, "F");
  doc.setFillColor(...RED); doc.rect(0, H - 6, W, 6, "F");
  logoAt(W / 2 - 22, H / 2 - 42, 44, true);
  doc.setFont("helvetica", "bold"); doc.setFontSize(26); doc.setTextColor(255, 255, 255);
  doc.text("Bora pra cima.", W / 2, H / 2 + 16, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(12); doc.setTextColor(205, 214, 230);
  doc.text("Universidade Nacional de Vendas", W / 2, H / 2 + 28, { align: "center" });

  const nome = (plan.clientName || plan.title || "onboarding").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").toLowerCase();
  doc.save(`onboarding-${nome}.pdf`);
}
