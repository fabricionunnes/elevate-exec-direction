// Imagem do ranking pra mandar no grupo: pódio das 3 ruas campeãs, lista até a 10ª,
// condomínios campeões, prêmio do sorteio e o link. Desenhada no canvas (1080 de largura).

export interface RankRow { name: string; orders: number }

const C = { creme: "#fbf3ea", vinho: "#b0123a", vinhoD: "#7d0c29", rosa: "#ec4879", rosaCl: "#fce4ec", choco: "#4a2c20", chocoD: "#2b1810", choco2: "#785442", ouro: "#f2b632", ouroD: "#c98a0c", prata: "#cfd5de", prataD: "#8e98a6", bronze: "#e9a26b", bronzeD: "#b5672e" };
const W = 1080;

function rnd(seed: number) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

function wrap(g: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number) {
  const words = text.split(/\s+/); const lines: string[] = []; let cur = "";
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (g.measureText(t).width <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) { const keep = lines.slice(0, maxLines); let last = keep[maxLines - 1]; while (g.measureText(`${last}…`).width > maxW && last.length > 2) last = last.slice(0, -1); keep[maxLines - 1] = `${last}…`; return keep; }
  return lines;
}

function fitFont(g: CanvasRenderingContext2D, text: string, weight: string, family: string, start: number, maxW: number, min = 18) {
  let s = start;
  while (s > min) { g.font = `${weight} ${s}px ${family}`; if (g.measureText(text).width <= maxW) break; s -= 2; }
  return s;
}

function heart(g: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  g.save(); g.translate(x, y); g.scale(s / 32, s / 32); g.fillStyle = color; g.beginPath();
  g.moveTo(0, 10); g.bezierCurveTo(0, 4, -8, -4, -16, 2); g.bezierCurveTo(-24, 8, -18, 20, 0, 30); g.bezierCurveTo(18, 20, 24, 8, 16, 2); g.bezierCurveTo(8, -4, 0, 4, 0, 10);
  g.fill(); g.restore();
}

function star(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  g.save(); g.fillStyle = color; g.beginPath();
  for (let i = 0; i < 8; i++) { const a = (Math.PI / 4) * i - Math.PI / 2; const rr = i % 2 ? r * 0.28 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); g.fill(); g.restore();
}

function crown(g: CanvasRenderingContext2D, cx: number, y: number, w: number) {
  const h = w * 0.62;
  const grad = g.createLinearGradient(0, y, 0, y + h); grad.addColorStop(0, "#ffe08a"); grad.addColorStop(1, C.ouroD);
  g.save(); g.fillStyle = grad; g.strokeStyle = "#a86d00"; g.lineWidth = 3; g.beginPath();
  g.moveTo(cx - w / 2, y + h); g.lineTo(cx - w / 2, y + h * 0.3); g.lineTo(cx - w / 4, y + h * 0.62); g.lineTo(cx, y); g.lineTo(cx + w / 4, y + h * 0.62); g.lineTo(cx + w / 2, y + h * 0.3); g.lineTo(cx + w / 2, y + h); g.closePath();
  g.fill(); g.stroke();
  for (const [px, py] of [[cx - w / 2, y + h * 0.3], [cx, y], [cx + w / 2, y + h * 0.3]]) { g.beginPath(); g.arc(px, py, w * 0.07, 0, Math.PI * 2); g.fillStyle = C.rosa; g.fill(); }
  g.restore();
}

function drips(g: CanvasRenderingContext2D, base: number) {
  const r = rnd(7);
  g.fillStyle = C.choco; g.fillRect(0, 0, W, base);
  let x = -10;
  while (x < W + 20) {
    const dw = 40 + r() * 80, len = r() < 0.35 ? 8 + r() * 20 : 40 + r() * 120, cx = x + dw / 2;
    g.beginPath(); g.ellipse(cx, base - 4, dw * 0.62, 22, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.roundRect(cx - dw * 0.27, base - 10, dw * 0.54, len, dw * 0.27); g.fill();
    g.save(); g.fillStyle = "rgba(160,110,85,0.55)"; g.beginPath(); g.roundRect(cx - dw * 0.15, base + 4, dw * 0.08, len * 0.7, 4); g.fill(); g.restore();
    x += dw * (0.7 + r() * 0.35);
  }
}

function confetti(g: CanvasRenderingContext2D, H: number) {
  const r = rnd(42);
  const cols = [C.rosa, C.vinho, C.ouro, "#ffffff", "#f7b8cb"];
  for (let i = 0; i < 90; i++) {
    const x = r() * W, y = 180 + r() * (H - 220), c = cols[i % cols.length];
    g.save(); g.globalAlpha = 0.35 + r() * 0.35; g.translate(x, y); g.rotate(r() * Math.PI);
    if (i % 3 === 0) { g.fillStyle = c; g.beginPath(); g.arc(0, 0, 4 + r() * 6, 0, Math.PI * 2); g.fill(); }
    else if (i % 3 === 1) { g.fillStyle = c; g.fillRect(-6, -3, 12 + r() * 8, 6); }
    else heart(g, 0, 0, 14 + r() * 12, "#f6b3c7");
    g.restore();
  }
}

function shadowed(g: CanvasRenderingContext2D, fn: () => void, blur = 24, y = 10, color = "rgba(74,44,32,0.22)") {
  g.save(); g.shadowColor = color; g.shadowBlur = blur; g.shadowOffsetY = y; fn(); g.restore();
}

async function loadImg(src: string) {
  const im = new Image(); im.src = src;
  await new Promise((res) => { im.onload = res; im.onerror = res; });
  return im.naturalWidth ? im : null;
}

export async function rankingImage(opts: { period: string; ruas: RankRow[]; condos: RankRow[]; prize: string; site: string; business: string }) {
  const SCRIPT = '"Dancing Script", cursive', SANS = "Inter, system-ui, sans-serif";
  try { await Promise.all([document.fonts.load(`700 100px ${SCRIPT}`), document.fonts.load(`900 40px ${SANS}`), document.fonts.load(`700 40px ${SANS}`)]); } catch { /* sem fonte, segue */ }

  const top = opts.ruas.slice(0, 3);
  const rest = opts.ruas.slice(3, 10);
  const condos = opts.condos.slice(0, 3);
  // altura conforme o conteúdo
  const H = 830 + (top.length ? 470 : 0) + rest.length * 92 + (rest.length ? 40 : 0) + (condos.length ? 280 : 0) + 380;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d")!;

  // fundo
  const bg = g.createRadialGradient(W / 2, 420, 80, W / 2, 420, 900); bg.addColorStop(0, "#fff7f0"); bg.addColorStop(1, "#f8e6d8");
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  confetti(g, H);
  drips(g, 92);

  // logo num círculo com aro
  const logo = await loadImg("/logo.webp");
  shadowed(g, () => { g.fillStyle = "#fff"; g.beginPath(); g.arc(W / 2, 270, 128, 0, Math.PI * 2); g.fill(); });
  g.strokeStyle = C.rosa; g.lineWidth = 8; g.beginPath(); g.arc(W / 2, 270, 128, 0, Math.PI * 2); g.stroke();
  if (logo) g.drawImage(logo, W / 2 - 112, 158, 224, 224);
  star(g, W / 2 - 190, 210, 26, C.ouro); star(g, W / 2 + 196, 330, 20, C.ouro); star(g, W / 2 + 170, 180, 14, C.rosa);

  // título
  g.textAlign = "center"; g.fillStyle = C.vinho;
  g.font = `700 118px ${SCRIPT}`; g.fillText("Ranking das Ruas", W / 2, 528);
  // faixa do período
  g.font = `800 30px ${SANS}`;
  const per = `${opts.period.toUpperCase()}  ·  ${opts.business.toUpperCase()}`;
  const pw = g.measureText(per).width + 70;
  shadowed(g, () => { g.fillStyle = C.rosa; g.beginPath(); g.roundRect(W / 2 - pw / 2, 566, pw, 58, 29); g.fill(); }, 14, 6);
  g.fillStyle = "#fff"; g.fillText(per, W / 2, 606);
  g.fillStyle = C.choco2; g.font = `600 30px ${SANS}`; g.fillText("As ruas que mais pediram bolo da Yas", W / 2, 682);

  let y = 810;
  // pódio
  if (top.length) {
    const baseY = y + 450;
    const slots = [
      { i: 1, x: 200, h: 200, col: [C.prata, C.prataD], label: "2º" },
      { i: 0, x: 540, h: 270, col: [C.ouro, C.ouroD], label: "1º" },
      { i: 2, x: 880, h: 160, col: [C.bronze, C.bronzeD], label: "3º" },
    ];
    for (const s of slots) {
      const r = top[s.i]; if (!r) continue;
      const bw = 300, bx = s.x - bw / 2, by = baseY - s.h;
      // bloco
      shadowed(g, () => {
        const grad = g.createLinearGradient(0, by, 0, baseY); grad.addColorStop(0, s.col[0]); grad.addColorStop(1, s.col[1]);
        g.fillStyle = grad; g.beginPath(); g.roundRect(bx, by, bw, s.h, [26, 26, 0, 0]); g.fill();
      });
      g.fillStyle = "rgba(255,255,255,0.28)"; g.beginPath(); g.roundRect(bx + 18, by + 14, 26, s.h - 28, 13); g.fill();
      g.fillStyle = "#fff"; g.font = `900 ${s.i === 0 ? 110 : 84}px ${SANS}`; g.fillText(s.label, s.x, by + (s.i === 0 ? 150 : 116));
      // nome acima do bloco, num cartão
      g.font = `800 ${s.i === 0 ? 38 : 32}px ${SANS}`;
      const lines = wrap(g, r.name, 270, 2);
      const lh = s.i === 0 ? 44 : 38;
      const cardH = lines.length * lh + 36, cardY = by - cardH - 22;
      shadowed(g, () => { g.fillStyle = "#fff"; g.beginPath(); g.roundRect(bx + 6, cardY, bw - 12, cardH, 22); g.fill(); }, 18, 6);
      g.fillStyle = s.i === 0 ? C.vinho : C.chocoD;
      lines.forEach((l, k) => g.fillText(l, s.x, cardY + 18 + lh * (k + 0.78)));
      if (s.i === 0) { crown(g, s.x, cardY - 96, 120); star(g, s.x - 110, cardY - 40, 18, C.ouro); star(g, s.x + 112, cardY - 56, 14, C.rosa); }
    }
    // chão do pódio
    g.fillStyle = C.choco; g.beginPath(); g.roundRect(40, baseY, W - 80, 20, 10); g.fill();
    y = baseY + 60;
  }

  // 4º ao 10º
  if (rest.length) {
    rest.forEach((r, k) => {
      const ry = y + k * 92;
      shadowed(g, () => { g.fillStyle = "rgba(255,255,255,0.94)"; g.beginPath(); g.roundRect(70, ry, W - 140, 76, 38); g.fill(); }, 12, 4, "rgba(74,44,32,0.14)");
      g.fillStyle = C.rosaCl; g.beginPath(); g.arc(116, ry + 38, 28, 0, Math.PI * 2); g.fill();
      g.fillStyle = C.vinho; g.font = `900 26px ${SANS}`; g.textAlign = "center"; g.fillText(`${k + 4}º`, 116, ry + 47);
      g.textAlign = "left"; g.fillStyle = C.chocoD;
      const fs = fitFont(g, r.name, "700", SANS, 34, 700); g.font = `700 ${fs}px ${SANS}`; g.fillText(r.name, 164, ry + 50);
      heart(g, W - 118, ry + 24, 26, k % 2 ? "#f6b3c7" : C.rosa);
      g.textAlign = "center";
    });
    y += rest.length * 92 + 40;
  }

  // condomínios campeões
  if (condos.length) {
    g.fillStyle = C.choco; g.font = `700 64px ${SCRIPT}`; g.fillText("Condomínios campeões", W / 2, y + 50);
    const cw = (W - 140 - (condos.length - 1) * 20) / condos.length;
    condos.forEach((r, k) => {
      const cx = 70 + k * (cw + 20);
      const cols = [[C.ouro, C.ouroD], [C.prata, C.prataD], [C.bronze, C.bronzeD]][k];
      shadowed(g, () => { g.fillStyle = "#fff"; g.beginPath(); g.roundRect(cx, y + 80, cw, 160, 26); g.fill(); }, 14, 5);
      const gr = g.createLinearGradient(0, y + 80, 0, y + 240); gr.addColorStop(0, cols[0]); gr.addColorStop(1, cols[1]);
      g.fillStyle = gr; g.beginPath(); g.roundRect(cx, y + 80, cw, 12, [26, 26, 0, 0]); g.fill();
      g.fillStyle = cols[1]; g.font = `900 30px ${SANS}`; g.fillText(`${k + 1}º`, cx + cw / 2, y + 128);
      g.fillStyle = C.chocoD; g.font = `800 27px ${SANS}`;
      const nl = wrap(g, r.name, cw - 30, 2);
      nl.forEach((l, j) => g.fillText(l, cx + cw / 2, y + (nl.length === 1 ? 188 : 172) + j * 32));
    });
    y += 280;
  }

  // prêmio
  const py = H - 360;
  shadowed(g, () => {
    const gr = g.createLinearGradient(80, 0, W - 80, 0); gr.addColorStop(0, C.rosa); gr.addColorStop(1, C.vinho);
    g.fillStyle = gr; g.beginPath(); g.roundRect(80, py, W - 160, 190, 40); g.fill();
  }, 26, 12, "rgba(176,18,58,0.35)");
  // caixinha de presente
  const gx = 170, gy = py + 95;
  g.fillStyle = "#fff"; g.beginPath(); g.roundRect(gx - 44, gy - 24, 88, 66, 10); g.fill();
  g.fillStyle = C.ouro; g.fillRect(gx - 50, gy - 40, 100, 24); g.fillRect(gx - 9, gy - 40, 18, 82);
  g.strokeStyle = C.ouro; g.lineWidth = 8; g.beginPath(); g.ellipse(gx - 18, gy - 52, 18, 12, -0.5, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.ellipse(gx + 18, gy - 52, 18, 12, 0.5, 0, Math.PI * 2); g.stroke();
  g.textAlign = "left"; g.fillStyle = "#fff";
  if (opts.prize) {
    g.font = `800 30px ${SANS}`; g.fillText("A RUA CAMPEÃ CONCORRE A", 250, py + 74);
    g.font = `700 64px ${SCRIPT}`; const lines = wrap(g, opts.prize, W - 160 - 200, 1); g.fillText(lines[0], 250, py + 140);
  } else {
    g.font = `800 30px ${SANS}`; g.fillText("COLOQUE SUA RUA NO TOPO", 250, py + 80);
    g.font = `700 60px ${SCRIPT}`; g.fillText("Tem sorteio surpresa!", 250, py + 142);
  }
  g.textAlign = "center";
  heart(g, W - 140, py + 40, 34, "rgba(255,255,255,0.85)"); heart(g, W - 190, py + 120, 22, "rgba(255,255,255,0.6)");

  // rodapé
  g.fillStyle = C.chocoD; g.font = `700 32px ${SANS}`; g.fillText("Quanto mais pedidos, mais chances. Peça pelo link:", W / 2, H - 112);
  g.fillStyle = C.vinho; g.font = `900 38px ${SANS}`; g.fillText(opts.site.replace(/^https?:\/\//, ""), W / 2, H - 60);

  return new Promise<Blob>((res) => c.toBlob((b) => res(b!), "image/png"));
}
