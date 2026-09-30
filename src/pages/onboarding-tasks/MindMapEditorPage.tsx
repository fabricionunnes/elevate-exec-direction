// Editor de mapa mental (estilo MindMeister). Árvore em JSON na tabela mindmaps;
// React Flow desenha e cuida de zoom/pan/minimapa; o layout radial é nosso.
// Teclado: Tab = filho · Enter = irmão · Delete = apagar · F2/duplo clique = editar
//          Espaço = colapsar/expandir · Ctrl+Z / Ctrl+Shift+Z = desfazer/refazer
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ReactFlow, Background, Controls, MiniMap, Handle, Position,
  type Node, type Edge, type NodeProps, useReactFlow, ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, Save, Plus, Trash2, Undo2, Redo2, ChevronsUpDown, Palette, Download, LayoutTemplate, Maximize2 } from "lucide-react";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─────────────────────────── modelo ───────────────────────────
export interface MMNode {
  id: string;
  text: string;
  children: MMNode[];
  collapsed?: boolean;
  color?: string;
  note?: string;
  /** largura escolhida na mão (px). Sem isso, a caixa se mede pelo texto. */
  w?: number;
  /** altura escolhida na mão (px). Nunca menor que o texto precisa. */
  h?: number;
}
type LayoutKind = "radial" | "right" | "tree";
interface MMData { root: MMNode; layout?: LayoutKind; theme?: string }

// temas de cor prontos (a cor de um ramo pode ser trocada por cima)
const THEMES: Record<string, { name: string; root: string; palette: string[] }> = {
  unv:     { name: "UNV",       root: "#0D2B5E", palette: ["#0D2B5E", "#CC1B1B", "#1B7F4B", "#B7791F", "#7C3AED", "#0E7490", "#BE185D", "#4B5563"] },
  vivid:   { name: "Vibrante",  root: "#111827", palette: ["#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316"] },
  pastel:  { name: "Pastel",    root: "#475569", palette: ["#F87171", "#FBBF24", "#34D399", "#60A5FA", "#A78BFA", "#F472B6", "#2DD4BF", "#FB923C"] },
  mono:    { name: "Monocromo", root: "#111827", palette: ["#1F2937", "#374151", "#4B5563", "#6B7280", "#9CA3AF", "#374151", "#4B5563", "#6B7280"] },
  gold:    { name: "Mansão",    root: "#0A0A0A", palette: ["#C9A84C", "#E8D5A3", "#8B7332", "#C9A84C", "#E8D5A3", "#8B7332", "#C9A84C", "#E8D5A3"] },
};

const PALETTE = THEMES.unv.palette;
const uid = () => Math.random().toString(36).slice(2, 10);

function clone<T>(x: T): T { return JSON.parse(JSON.stringify(x)); }

function findNode(root: MMNode, id: string, parent: MMNode | null = null): { node: MMNode; parent: MMNode | null } | null {
  if (root.id === id) return { node: root, parent };
  for (const c of root.children) {
    const r = findNode(c, id, root);
    if (r) return r;
  }
  return null;
}

// ─────────────────────────── layout radial (dois lados) ───────────────────────────
// O nó cresce com o texto. Antes a caixa era fixa em 180px com truncate: frase
// longa virava "Quando o potencial cli…" e o mapa não servia pra ler nada.
// GAP_Y era 14: com caixas de alturas diferentes, as bordas ficavam a 14px uma
// da outra e, no zoom que um mapa grande exige, isso lê como retângulo colado
// no outro. GAP_X desconta os 8px que o botão de colapsar invade do vão.
const NODE_MIN_W = 130, NODE_MAX_W = 270, NODE_H = 40, GAP_X = 88, GAP_Y = 26;
const ROOT_MIN_W = 220, ROOT_MAX_W = 340, ROOT_H = 52;
// box-sizing: border-box — a largura do style já inclui padding E borda, então
// a conta precisa dos dois. Com 26 sobrava 2px e frase que cabia numa linha
// quebrava em duas sem precisar.
const PAD_X = 28;  // px-3 (12+12) + borda 2px de cada lado
const PAD_Y = 20;  // py-2 (8+8) + borda 2px de cada lado
const LINE_H = 18, ROOT_LINE_H = 21;
const FONTE = '13px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
const FONTE_ROOT = '600 15px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';

// Medir texto de verdade (canvas) em vez de chutar por número de caracteres:
// "Iiii" e "MMMM" têm o mesmo tamanho no chute e larguras bem diferentes na tela.
let _ctx: CanvasRenderingContext2D | null | undefined;
const _larguras = new Map<string, number>();
function larguraTexto(txt: string, fonte: string): number {
  const k = `${fonte}|${txt}`;
  const cache = _larguras.get(k);
  if (cache !== undefined) return cache;
  if (_ctx === undefined) _ctx = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
  // sem canvas (SSR, navegador antigo): estimativa grosseira, melhor que quebrar
  const w = _ctx ? (_ctx.font = fonte, _ctx.measureText(txt).width) : txt.length * 7;
  if (_larguras.size > 4000) _larguras.clear();
  _larguras.set(k, w);
  return w;
}

/** quantas linhas UM parágrafo ocupa quebrando em palavras dentro de maxW */
function contarLinhas(txt: string, maxW: number, fonte: string): number {
  const palavras = txt.split(/\s+/).filter(Boolean);
  if (!palavras.length) return 1;
  let linhas = 1, atual = "";
  for (const p of palavras) {
    const teste = atual ? `${atual} ${p}` : p;
    if (larguraTexto(teste, fonte) <= maxW) { atual = teste; continue; }
    // não coube nesta linha, mas cabe sozinha na próxima
    if (larguraTexto(p, fonte) <= maxW) { linhas++; atual = p; continue; }
    // palavra maior que a caixa inteira: o CSS quebra DENTRO dela (break-words),
    // caractere a caractere. Dividir largura/maxW errava pra menos e a caixa
    // saía baixa demais.
    if (atual) { linhas++; atual = ""; }
    for (const ch of p) {
      const t2 = atual + ch;
      if (larguraTexto(t2, fonte) <= maxW) atual = t2;
      else { linhas++; atual = ch; }
    }
  }
  return linhas;
}

// Limites do tamanho na mão: largura livre dentro do razoável; a altura o
// usuário só aumenta, porque diminuir abaixo do texto voltaria a cortar frase,
// que é exatamente o problema que a medida automática resolve.
const MANUAL_MIN_W = 80, MANUAL_MAX_W = 900, MANUAL_MAX_H = 2000;

const _medidas = new Map<string, { w: number; h: number }>();
/** largura e altura que a caixa precisa ter pro texto caber inteiro */
function medida(n: MMNode, isRoot = false): { w: number; h: number } {
  const txt = n.text || "vazio";
  // tamanho na mão: a largura manda, e a altura é o maior entre o pedido e o
  // que o texto precisa nessa largura
  if (n.w || n.h) {
    const fonte = isRoot ? FONTE_ROOT : FONTE;
    const lineH = isRoot ? ROOT_LINE_H : LINE_H;
    const alturaMin = isRoot ? ROOT_H : NODE_H;
    const w = n.w ? Math.min(MANUAL_MAX_W, Math.max(MANUAL_MIN_W, Math.round(n.w))) : medida({ ...n, w: undefined, h: undefined }, isRoot).w;
    const linhas = txt.split("\n").reduce((soma, par) => soma + contarLinhas(par, w - PAD_X, fonte), 0);
    const precisa = Math.max(alturaMin, linhas * lineH + PAD_Y);
    const h = n.h ? Math.min(MANUAL_MAX_H, Math.max(precisa, Math.round(n.h))) : precisa;
    return { w, h };
  }
  const k = `${isRoot ? "r" : "n"}|${txt}`;
  const cache = _medidas.get(k);
  if (cache) return cache;
  const fonte = isRoot ? FONTE_ROOT : FONTE;
  const minW = isRoot ? ROOT_MIN_W : NODE_MIN_W;
  const maxW = isRoot ? ROOT_MAX_W : NODE_MAX_W;
  const lineH = isRoot ? ROOT_LINE_H : LINE_H;
  const alturaMin = isRoot ? ROOT_H : NODE_H;
  // O texto pode ter quebra de linha própria (listas com traço, por exemplo) e
  // o CSS preserva ela (whitespace-pre-wrap). Medir tudo como um parágrafo só
  // contava linhas a menos: a caixa saía baixa, o texto era cortado embaixo e o
  // nó vizinho subia por cima. Cada parágrafo conta o seu wrap separado.
  const paragrafos = txt.split("\n");
  const maiorLinha = Math.max(...paragrafos.map((p) => larguraTexto(p, fonte)));
  const larguraIdeal = maiorLinha + PAD_X;
  const w = Math.min(maxW, Math.max(minW, Math.ceil(larguraIdeal)));
  const linhas = paragrafos.length === 1 && larguraIdeal <= maxW
    ? 1
    : paragrafos.reduce((soma, par) => soma + contarLinhas(par, w - PAD_X, fonte), 0);
  const m = { w, h: Math.max(alturaMin, linhas * lineH + PAD_Y) };
  if (_medidas.size > 4000) _medidas.clear();
  _medidas.set(k, m);
  return m;
}

/** altura total de um ramo (respeitando colapso) */
function subtreeHeight(n: MMNode): number {
  const propria = medida(n).h;
  if (n.collapsed || n.children.length === 0) return propria;
  const h = n.children.reduce((s, c) => s + subtreeHeight(c), 0) + GAP_Y * (n.children.length - 1);
  return Math.max(propria, h);
}

function layout(root: MMNode, kind: LayoutKind = "radial", theme = "unv") {
  const pal = (THEMES[theme] || THEMES.unv).palette;
  const rootColor = (THEMES[theme] || THEMES.unv).root;
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const kids = root.collapsed ? [] : root.children;

  if (kind === "tree") {
    // organograma: raiz em cima, filhos abaixo, ramos descem
    const GY = 88;
    const W = (n: MMNode) => medida(n).w + 24;
    const width = (n: MMNode): number => (n.collapsed || !n.children.length) ? W(n)
      : Math.max(W(n), n.children.reduce((s, c) => s + width(c), 0));
    const mr = medida(root, true);
    nodes.push({ id: root.id, type: "mm", position: { x: -mr.w / 2, y: 0 }, data: { node: root, isRoot: true, depth: 0, side: 0, rootColor, w: mr.w, h: mr.h } });
    // o nível de baixo começa depois da altura REAL do pai: com caixa de três
    // linhas, a distância fixa fazia a linha do ramo entrar por cima do texto
    const place = (children: MMNode[], parent: MMNode, cx: number, py: number, parentH: number, depth: number, color?: string, idx = 0) => {
      const total = children.reduce((s, c) => s + width(c), 0);
      let x = cx - total / 2;
      children.forEach((c, i) => {
        const w = width(c);
        const ncx = x + w / 2;
        const m = medida(c);
        const ny = py + parentH + GY;
        const col = c.color || color || pal[(depth === 1 ? i : idx) % pal.length];
        nodes.push({ id: c.id, type: "mm", position: { x: ncx - m.w / 2, y: ny }, data: { node: c, isRoot: false, depth, side: 0, color: col, rootColor, w: m.w, h: m.h } });
        edges.push({ id: `${parent.id}-${c.id}`, source: parent.id, target: c.id, sourceHandle: "b", targetHandle: "t",
          type: "smoothstep", style: { stroke: col, strokeWidth: Math.max(1.5, 3.5 - depth * 0.7) } });
        if (!c.collapsed) place(c.children, c, ncx, ny, m.h, depth + 1, col, depth === 1 ? i : idx);
        x += w;
      });
    };
    place(kids, root, 0, 0, mr.h, 1);
    return { nodes, edges };
  }

  // radial (dois lados) ou direita (um lado só)
  const cx = 0, cy = 0;
  const mr = medida(root, true);
  nodes.push({ id: root.id, type: "mm", position: { x: cx - mr.w / 2, y: cy - mr.h / 2 },
    data: { node: root, isRoot: true, depth: 0, side: 0, rootColor, w: mr.w, h: mr.h } });
  const right = kind === "right" ? kids : kids.filter((_, i) => i % 2 === 0);
  const left = kind === "right" ? [] : kids.filter((_, i) => i % 2 === 1);

  // px é a BORDA do pai (direita no lado direito, esquerda no esquerdo), não o
  // centro: com caixa de largura variável, medir pelo centro empurrava nó largo
  // por cima do vizinho. Assim os irmãos começam todos na mesma coluna.
  const place = (children: MMNode[], side: 1 | -1, parent: MMNode, px: number, py: number, depth: number, color?: string, baseIdx = 0) => {
    if (!children.length) return;
    const total = children.reduce((s, c) => s + subtreeHeight(c), 0) + GAP_Y * (children.length - 1);
    let y = py - total / 2;
    children.forEach((c, i) => {
      const h = subtreeHeight(c);
      const ny = y + h / 2;
      const m = medida(c);
      const nx = side === 1 ? px + GAP_X : px - GAP_X - m.w;
      const col = c.color || color || pal[(baseIdx + i) % pal.length];
      nodes.push({ id: c.id, type: "mm", position: { x: nx, y: ny - m.h / 2 },
        data: { node: c, isRoot: false, depth, side, color: col, rootColor, w: m.w, h: m.h } });
      edges.push({ id: `${parent.id}-${c.id}`, source: parent.id, target: c.id,
        sourceHandle: side === 1 ? "r" : "l", targetHandle: side === 1 ? "l" : "r",
        type: "smoothstep", style: { stroke: col, strokeWidth: Math.max(1.5, 3.5 - depth * 0.7) } });
      if (!c.collapsed) place(c.children, side, c, side === 1 ? nx + m.w : nx, ny, depth + 1, col, baseIdx + i);
      y += h + GAP_Y;
    });
  };
  place(right, 1, root, cx + mr.w / 2, cy, 1, undefined, 0);
  place(left, -1, root, cx - mr.w / 2, cy, 1, undefined, right.length);
  return { nodes, edges };
}

// ─────────────────────────── PDF vetorial ───────────────────────────
// As fontes padrão do PDF (Helvetica) só conhecem Latin-1: acento e cedilha
// entram, mas seta, emoji e travessão viram lixo. Troca o que dá e tira o resto.
function limparTexto(s: string): string {
  return (s || "")
    .replace(/[→➡➔]/g, "->").replace(/[←]/g, "<-")
    .replace(/[–—−]/g, "-").replace(/[‘’‚]/g, "'")
    .replace(/[“”„]/g, '"').replace(/[•●▪‣]/g, "-")
    .replace(/[✓✔✅]/g, "v").replace(/[✖❌]/g, "x")
    .replace(/…/g, "...").replace(/ /g, " ")
    .replace(/[^\u0000-ÿ]/g, "");
}

/** clone do mapa com todos os ramos abertos: o PDF é o mapa inteiro */
function expandirTudo(n: MMNode): MMNode {
  return { ...n, collapsed: false, children: n.children.map(expandirTudo) };
}

const PDF_MAX_PAGE = 14000; // limite do formato PDF é 14400pt por lado

function montarPdf(data: MMData, titulo: string): jsPDF {
  const root = expandirTudo(data.root);
  const kind = data.layout || "radial";
  const themeKey = data.theme || "unv";
  const { nodes, edges } = layout(root, kind, themeKey);
  const porId = new Map(nodes.map((n) => [n.id, n]));

  // limites do mapa
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    const d = n.data as any;
    minX = Math.min(minX, n.position.x); minY = Math.min(minY, n.position.y);
    maxX = Math.max(maxX, n.position.x + d.w); maxY = Math.max(maxY, n.position.y + d.h);
  }
  const M = 40, HEADER = 44;
  const mapaW = maxX - minX, mapaH = maxY - minY;
  // mapa gigante: encolhe pra caber no limite do PDF (continua vetorial, o zoom
  // não perde nada)
  const s = Math.min(1, (PDF_MAX_PAGE - 2 * M) / mapaW, (PDF_MAX_PAGE - 2 * M - HEADER) / mapaH);
  const pageW = Math.max(595, mapaW * s + 2 * M);
  const pageH = Math.max(420, mapaH * s + 2 * M + HEADER);
  const ox = M + (pageW - 2 * M - mapaW * s) / 2 - minX * s;
  const oy = M + HEADER + (pageH - 2 * M - HEADER - mapaH * s) / 2 - minY * s;
  const X = (x: number) => ox + x * s, Y = (y: number) => oy + y * s;

  const pdf = new jsPDF({ orientation: pageW >= pageH ? "landscape" : "portrait", unit: "pt", format: [pageW, pageH], compress: true });
  const dataStr = new Date().toLocaleDateString("pt-BR");

  // cabeçalho da página do mapa
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(16); pdf.setTextColor(13, 43, 94);
  pdf.text(limparTexto(titulo), M, M + 6);
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(120);
  pdf.text(`UNV Nexus  ·  ${dataStr}  ·  mapa completo (dê zoom); descritivo nas páginas seguintes`, M, M + 20);

  // linhas primeiro, caixas por cima
  for (const e of edges) {
    const a = porId.get(e.source), b = porId.get(e.target);
    if (!a || !b) continue;
    const da = a.data as any, db = b.data as any;
    const st = (e.style || {}) as any;
    pdf.setDrawColor(st.stroke || "#94A3B8");
    pdf.setLineWidth(Math.max(0.8, (st.strokeWidth || 2) * s));
    let x1: number, y1: number, x2: number, y2: number;
    if (kind === "tree") {
      x1 = X(a.position.x + da.w / 2); y1 = Y(a.position.y + da.h);
      x2 = X(b.position.x + db.w / 2); y2 = Y(b.position.y);
      const my = (y1 + y2) / 2;
      pdf.moveTo(x1, y1); pdf.curveTo(x1, my, x2, my, x2, y2); pdf.stroke();
    } else {
      const paraDireita = b.position.x >= a.position.x + da.w / 2;
      x1 = X(paraDireita ? a.position.x + da.w : a.position.x); y1 = Y(a.position.y + da.h / 2);
      x2 = X(paraDireita ? b.position.x : b.position.x + db.w); y2 = Y(b.position.y + db.h / 2);
      const mx = (x1 + x2) / 2;
      pdf.moveTo(x1, y1); pdf.curveTo(mx, y1, mx, y2, x2, y2); pdf.stroke();
    }
  }

  for (const n of nodes) {
    const d = n.data as any;
    const mm: MMNode = d.node;
    const cor: string = d.isRoot ? (d.rootColor || "#0D2B5E") : (d.color || "#0D2B5E");
    const x = X(n.position.x), y = Y(n.position.y), w = d.w * s, h = d.h * s;
    pdf.setDrawColor(cor); pdf.setLineWidth(2 * s);
    if (d.isRoot) { pdf.setFillColor(cor); pdf.roundedRect(x, y, w, h, 10 * s, 10 * s, "FD"); }
    else { pdf.setFillColor(255, 255, 255); pdf.roundedRect(x, y, w, h, 10 * s, 10 * s, "FD"); }

    // texto: quebra em palavras dentro da caixa; se a Helvetica precisar de mais
    // linhas que a caixa tem (fonte da tela é outra), reduz um pouco a fonte
    const texto = limparTexto(mm.text || "vazio");
    const larguraUtil = (d.w - PAD_X + 6) * s;
    let fs = (d.isRoot ? 15 : 13) * s;
    let lineH = (d.isRoot ? ROOT_LINE_H : LINE_H) * s;
    pdf.setFont("helvetica", d.isRoot ? "bold" : "normal");
    let linhas: string[] = [];
    for (let tent = 0; tent < 6; tent++) {
      pdf.setFontSize(fs);
      linhas = texto.split("\n").flatMap((p) => (pdf.splitTextToSize(p || " ", larguraUtil) as string[]));
      if (linhas.length * lineH <= h - 4 * s || fs <= 7 * s) break;
      fs *= 0.9; lineH *= 0.9;
    }
    pdf.setTextColor(d.isRoot ? "#FFFFFF" : "#111827");
    const total = linhas.length * lineH;
    let ty = y + (h - total) / 2 + lineH * 0.72;
    const tx = x + (PAD_X / 2 - 2) * s;
    for (const l of linhas) { pdf.text(l, tx, ty); ty += lineH; }
  }

  // ── descritivo por escrito (A4) ──
  pdf.addPage("a4", "portrait");
  const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
  const m = 48, mBottom = 56;
  let y = m;
  const cabecalho = () => {
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(10); pdf.setTextColor(13, 43, 94);
    pdf.text(limparTexto(titulo), m, m - 18);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.setTextColor(140);
    pdf.text("Descritivo", pw - m, m - 18, { align: "right" });
    pdf.setDrawColor("#E5E7EB"); pdf.setLineWidth(0.6); pdf.line(m, m - 12, pw - m, m - 12);
    y = m;
  };
  const garantir = (alt: number) => { if (y + alt > ph - mBottom) { pdf.addPage("a4", "portrait"); cabecalho(); } };
  cabecalho();

  pdf.setFont("helvetica", "bold"); pdf.setFontSize(20); pdf.setTextColor(13, 43, 94);
  const tit = pdf.splitTextToSize(limparTexto(titulo), pw - 2 * m) as string[];
  pdf.text(tit, m, y + 16); y += 16 + tit.length * 24;
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(10); pdf.setTextColor(100);
  const contar = (n: MMNode): number => 1 + n.children.reduce((sum, c) => sum + contar(c), 0);
  pdf.text(`${root.children.length} ramos principais  ·  ${contar(root) - 1} itens no total  ·  gerado em ${dataStr}`, m, y); y += 26;

  const pal = (THEMES[themeKey] || THEMES.unv).palette;
  const escrever = (n: MMNode, numero: string, depth: number, cor: string) => {
    const indent = m + Math.min(depth - 1, 5) * 18;
    const largura = pw - m - indent - 30;
    const fs = depth === 1 ? 13 : depth === 2 ? 11 : 10;
    const lh = fs * 1.35;
    pdf.setFont("helvetica", depth <= 2 ? "bold" : "normal"); pdf.setFontSize(fs);
    const linhas = limparTexto(n.text || "vazio").split("\n").flatMap((p) => pdf.splitTextToSize(p || " ", largura) as string[]);
    const nota = n.note ? limparTexto(n.note).split("\n").flatMap((p) => pdf.splitTextToSize(p || " ", largura - 10) as string[]) : [];
    const alt = (depth === 1 ? 14 : 4) + linhas.length * lh + (nota.length ? nota.length * 12 + 6 : 0);
    garantir(alt);
    if (depth === 1) {
      y += 10;
      pdf.setFillColor(cor); pdf.rect(m - 10, y - fs + 2, 4, linhas.length * lh, "F");
    }
    pdf.setTextColor(depth === 1 ? cor : "#111827");
    pdf.text(numero, indent, y);
    const numW = pdf.getTextWidth(numero) + 6;
    pdf.text(linhas, indent + numW, y);
    y += linhas.length * lh;
    if (nota.length) {
      pdf.setFont("helvetica", "italic"); pdf.setFontSize(9); pdf.setTextColor(90);
      pdf.text(nota, indent + numW + 4, y); y += nota.length * 12 + 6;
    }
    y += depth === 1 ? 4 : 2;
    n.children.forEach((c, i) => escrever(c, `${numero}${i + 1}.`, depth + 1, cor));
  };
  root.children.forEach((c, i) => escrever(c, `${i + 1}.`, 1, c.color || pal[i % pal.length]));

  // numeração das páginas do descritivo
  const total = pdf.internal.getNumberOfPages();
  for (let p = 2; p <= total; p++) {
    pdf.setPage(p);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.setTextColor(150);
    pdf.text(`UNV Nexus  ·  página ${p - 1} de ${total - 1}`, pw / 2, ph - 28, { align: "center" });
  }
  return pdf;
}

// ─────────────────────────── nó visual ───────────────────────────
function MMNodeView({ id, data, selected }: NodeProps) {
  const d = data as any;
  const n: MMNode = d.node;
  const color: string = d.isRoot ? (d.rootColor || "#0D2B5E") : d.color;
  const editing = d.editingId === id;
  const [txt, setTxt] = useState(n.text);
  useEffect(() => setTxt(n.text), [n.text]);
  // se a edição começou por uma tecla (digitou em cima do nó), começa por ela
  useEffect(() => { if (editing && d.seed !== undefined) setTxt(d.seed === null ? n.text : d.seed); }, [editing]); // eslint-disable-line
  const hasKids = n.children.length > 0;

  return (
    <div
      className={cn(
        "relative rounded-xl border-2 shadow-sm px-3 flex items-center transition-shadow",
        d.isRoot ? "text-white font-semibold text-[15px]" : "bg-white text-[13px]",
        selected && "ring-2 ring-offset-2 ring-primary/60 shadow-md",
      )}
      style={{
        width: d.w ?? (d.isRoot ? ROOT_MIN_W : NODE_MIN_W),
        minHeight: d.h ?? (d.isRoot ? ROOT_H : NODE_H),
        borderColor: color, background: d.isRoot ? color : "#fff",
      }}
      onDoubleClick={(e) => { e.stopPropagation(); d.startEdit(id); }}
    >
      <Handle type="target" position={Position.Left} id="l" className="!opacity-0 !w-2 !h-2" />
      <Handle type="target" position={Position.Right} id="r" className="!opacity-0 !w-2 !h-2" />
      <Handle type="source" position={Position.Left} id="l" className="!opacity-0 !w-2 !h-2" />
      <Handle type="source" position={Position.Right} id="r" className="!opacity-0 !w-2 !h-2" />
      <Handle type="target" position={Position.Top} id="t" className="!opacity-0 !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} id="b" className="!opacity-0 !w-2 !h-2" />
      {editing ? (
        // textarea e não input: em texto de três linhas o input mostrava só um
        // pedaço enquanto a pessoa digitava. Enter continua criando irmão.
        <textarea
          autoFocus
          rows={1}
          className="nodrag nopan w-full bg-transparent outline-none py-2 resize-none overflow-hidden"
          style={{ lineHeight: `${d.isRoot ? ROOT_LINE_H : LINE_H}px` }}
          value={txt}
          ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; } }}
          onFocus={(e) => { const v = e.target.value; e.target.setSelectionRange(v.length, v.length); }}
          onChange={(e) => { setTxt(e.target.value); e.target.style.height = "auto"; e.target.style.height = `${e.target.scrollHeight}px`; }}
          onBlur={() => d.commitEdit(id, txt)}
          onMouseDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            // o campo é dono do teclado enquanto edita — nada sobe pro canvas
            e.stopPropagation();
            if (e.key === "Enter") { e.preventDefault(); d.commitEdit(id, txt); d.addSibling(id); }
            else if (e.key === "Tab") { e.preventDefault(); d.commitEdit(id, txt); d.addChild(id); }
            else if (e.key === "Escape") { e.preventDefault(); d.commitEdit(id, n.text); }
          }}
        />
      ) : (
        <span className="py-2 w-full whitespace-pre-wrap break-words"
          style={{ lineHeight: `${d.isRoot ? ROOT_LINE_H : LINE_H}px` }}>
          {n.text || <span className="opacity-50">vazio</span>}
        </span>
      )}
      {/* puxador pra ajustar o tamanho na mão. Aparece com o nó selecionado.
          Duplo clique volta pro tamanho automático (medido pelo texto). */}
      {selected && d.canEdit && (
        <div
          // por dentro da borda, senão encosta no botão de colapsar (que fica
          // fora, em -12) e rouba o clique dele em nó de uma linha
          className="nodrag nopan absolute bottom-0.5 right-0.5 h-3 w-3 rounded-sm border-2 bg-white z-20"
          style={{ borderColor: color, cursor: "nwse-resize" }}
          title={n.w || n.h ? "Arraste pra ajustar · duplo clique volta ao automático" : "Arraste pra ajustar o tamanho"}
          onDoubleClick={(e) => { e.stopPropagation(); d.resetSize(id); }}
          onMouseDown={(e) => {
            e.stopPropagation(); e.preventDefault();
            const zoom = d.getZoom?.() || 1;
            const x0 = e.clientX, y0 = e.clientY;
            const w0 = d.w, h0 = d.h;
            const mover = (ev: MouseEvent) => {
              d.resize(id, w0 + (ev.clientX - x0) / zoom, h0 + (ev.clientY - y0) / zoom, false);
            };
            const soltar = (ev: MouseEvent) => {
              window.removeEventListener("mousemove", mover);
              window.removeEventListener("mouseup", soltar);
              // só aqui entra no histórico: arrastar vira UM passo de desfazer,
              // não um por pixel
              d.resize(id, w0 + (ev.clientX - x0) / zoom, h0 + (ev.clientY - y0) / zoom, true);
            };
            window.addEventListener("mousemove", mover);
            window.addEventListener("mouseup", soltar);
          }}
        />
      )}
      {hasKids && !d.isRoot && (
        <button
          className="nodrag absolute top-1/2 -translate-y-1/2 h-5 w-5 rounded-full border bg-white text-[10px] font-bold flex items-center justify-center shadow z-10"
          style={{ borderColor: color, color,
            ...(d.side === 0 ? { left: "50%", top: "auto", bottom: -12, transform: "translateX(-50%)" }
              : d.side === -1 ? { left: -12 } : { right: -12 }) }}
          onClick={(e) => { e.stopPropagation(); d.toggle(id); }}
          title={n.collapsed ? "Expandir" : "Colapsar"}
        >
          {n.collapsed ? n.children.length : "–"}
        </button>
      )}
    </div>
  );
}
const nodeTypes = { mm: MMNodeView };

// ─────────────────────────── editor ───────────────────────────
function Editor() {
  const { id: mapId } = useParams();
  const navigate = useNavigate();
  const rf = useReactFlow();
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("Novo mapa");
  const [data, setData] = useState<MMData>({ root: { id: "root", text: "Ideia central", children: [] } });
  const [selectedId, setSelectedId] = useState<string>("root");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSeed, setEditSeed] = useState<string | null>(null); // 1ª letra digitada em cima do nó
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [canEdit, setCanEdit] = useState(true);
  const undo = useRef<MMData[]>([]);
  const redo = useRef<MMData[]>([]);
  // estado de antes do arraste do puxador de tamanho
  const baseResize = useRef<MMData | null>(null);
  const staffIdRef = useRef<string | null>(null);

  // carga
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: staff } = await (supabase as any).from("onboarding_staff")
        .select("id").eq("user_id", user?.id).maybeSingle();
      staffIdRef.current = staff?.id || null;
      if (mapId && mapId !== "novo") {
        const { data: row, error } = await (supabase as any).from("mindmaps")
          .select("id, title, data, owner_staff_id").eq("id", mapId).maybeSingle();
        if (error || !row) { toast.error("Mapa não encontrado ou sem acesso"); navigate("/onboarding-tasks/mapas"); return; }
        setTitle(row.title); setData(row.data as MMData);
        setCanEdit(row.owner_staff_id === staff?.id);
      }
      setLoading(false);
    })();
  }, [mapId, navigate]);

  const push = useCallback((next: MMData) => {
    undo.current.push(clone(data)); if (undo.current.length > 80) undo.current.shift();
    redo.current = [];
    setData(next); setDirty(true);
  }, [data]);

  const mutate = useCallback((fn: (root: MMNode) => void) => {
    if (!canEdit) return;
    const next = clone(data); fn(next.root); push(next);
  }, [data, push, canEdit]);

  // Redimensionar na mão. Enquanto arrasta, mexe no estado direto (sem empilhar
  // desfazer a cada pixel); no fim do arraste (comHistorico) grava um passo só.
  const resize = useCallback((id: string, w: number, h: number, comHistorico: boolean) => {
    if (!canEdit) return;
    const aplicar = (base: MMData) => {
      const next = clone(base);
      const f = findNode(next.root, id);
      if (!f) return null;
      // guarda já dentro dos limites: arrastar pra fora da tela gravava número
      // negativo no JSON do mapa
      f.node.w = Math.min(MANUAL_MAX_W, Math.max(MANUAL_MIN_W, Math.round(w)));
      f.node.h = Math.min(MANUAL_MAX_H, Math.max(NODE_H, Math.round(h)));
      return next;
    };
    if (comHistorico) {
      // push() empilharia o estado ATUAL, que já é o último quadro do arraste —
      // desfazer voltaria um pixel. Empilha o estado de ANTES do arraste.
      const antes = baseResize.current || clone(data);
      baseResize.current = null;
      const next = aplicar(data);
      if (!next) return;
      undo.current.push(antes);
      if (undo.current.length > 80) undo.current.shift();
      redo.current = [];
      setData(next); setDirty(true);
      return;
    }
    if (!baseResize.current) baseResize.current = clone(data);
    const next = aplicar(data);
    if (next) { setData(next); setDirty(true); }
  }, [data, canEdit]);

  const resetSize = useCallback((id: string) => {
    if (!canEdit) return;
    const next = clone(data);
    const f = findNode(next.root, id); if (!f) return;
    delete f.node.w; delete f.node.h;
    push(next);
  }, [data, push, canEdit]);

  const addChild = useCallback((pid: string) => {
    const nid = uid();
    mutate((root) => {
      const f = findNode(root, pid); if (!f) return;
      f.node.collapsed = false;
      f.node.children.push({ id: nid, text: "", children: [] });
    });
    setSelectedId(nid); setEditSeed(""); setEditingId(nid);
  }, [mutate]);

  const addSibling = useCallback((id: string) => {
    if (id === "root") { addChild("root"); return; }
    const nid = uid();
    mutate((root) => {
      const f = findNode(root, id); if (!f?.parent) return;
      const i = f.parent.children.findIndex((c) => c.id === id);
      f.parent.children.splice(i + 1, 0, { id: nid, text: "", children: [] });
    });
    setSelectedId(nid); setEditSeed(""); setEditingId(nid);
  }, [mutate, addChild]);

  const removeNode = useCallback((id: string) => {
    if (id === "root") return;
    let nextSel = "root";
    mutate((root) => {
      const f = findNode(root, id); if (!f?.parent) return;
      const i = f.parent.children.findIndex((c) => c.id === id);
      f.parent.children.splice(i, 1);
      nextSel = f.parent.children[Math.max(0, i - 1)]?.id || f.parent.id;
    });
    setSelectedId(nextSel);
  }, [mutate]);

  const commitEdit = useCallback((id: string, text: string) => {
    setEditingId(null); setEditSeed(null);
    mutate((root) => { const f = findNode(root, id); if (f) f.node.text = text.trim(); });
  }, [mutate]);

  const toggle = useCallback((id: string) => {
    mutate((root) => { const f = findNode(root, id); if (f) f.node.collapsed = !f.node.collapsed; });
  }, [mutate]);

  const setColor = useCallback((id: string, color: string) => {
    mutate((root) => { const f = findNode(root, id); if (!f) return; if (color) f.node.color = color; else delete f.node.color; });
  }, [mutate]);

  const setLayoutKind = (kind: LayoutKind) => { if (!canEdit) return; push({ ...clone(data), layout: kind }); setTimeout(() => rf.fitView({ padding: 0.3, duration: 300 }), 30); };
  const setTheme = (theme: string) => { if (!canEdit) return; push({ ...clone(data), theme }); };

  // ─────────────────────────── exportação ───────────────────────────
  // PDF vetorial: o mapa é desenhado direto no PDF a partir do layout (caixas,
  // linhas e texto), numa página do tamanho do mapa inteiro. Fotografar a tela
  // cortava o que estava fora do viewport e virava imagem borrada no zoom.
  // Depois do mapa vêm páginas A4 com o descritivo por escrito (hierarquia +
  // anotações de cada nó). O PNG continua sendo foto da tela.
  const canvasRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const exportImage = async (format: "png" | "pdf") => {
    const wrap = canvasRef.current;
    setExporting(true);
    try {
      const fname = (title || "mapa").replace(/[^\w\-]+/g, "_");
      if (format === "pdf") {
        const pdf = montarPdf(data, title || "Mapa mental");
        pdf.save(`${fname}.pdf`);
        return;
      }
      const el = wrap?.querySelector(".react-flow__viewport") as HTMLElement | null;
      if (!el || !wrap) return;
      // enquadra tudo antes de fotografar
      await rf.fitView({ padding: 0.15, duration: 0 });
      await new Promise((r) => setTimeout(r, 120));
      const dataUrl = await toPng(wrap, {
        backgroundColor: "#ffffff", pixelRatio: 2,
        filter: (n) => !(n as HTMLElement).classList?.contains("react-flow__minimap")
                    && !(n as HTMLElement).classList?.contains("react-flow__controls"),
      });
      const a = document.createElement("a"); a.href = dataUrl; a.download = `${fname}.png`; a.click();
    } catch (e: any) {
      toast.error("Não consegui exportar: " + (e?.message || e));
    } finally {
      setExporting(false);
    }
  };

  const doUndo = () => { const p = undo.current.pop(); if (!p) return; redo.current.push(clone(data)); setData(p); setDirty(true); };
  const doRedo = () => { const p = redo.current.pop(); if (!p) return; undo.current.push(clone(data)); setData(p); setDirty(true); };

  // teclado global
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (editingId) return; // o input do nó é dono do teclado
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === "Tab") { e.preventDefault(); addChild(selectedId); }
      else if (e.key === "Enter") { e.preventDefault(); addSibling(selectedId); }
      else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeNode(selectedId); }
      else if (e.key === "F2") { e.preventDefault(); setEditSeed(null); setEditingId(selectedId); }
      else if (e.key === " ") { e.preventDefault(); toggle(selectedId); }
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); }
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); }
      else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // começou a digitar em cima de um nó: entra em edição já com a letra
        e.preventDefault();
        setEditSeed(e.key);
        setEditingId(selectedId);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, editingId, addChild, addSibling, removeNode, toggle, data]);

  const save = useCallback(async () => {
    if (!canEdit || !staffIdRef.current) return;
    setSaving(true);
    try {
      if (mapId && mapId !== "novo") {
        const { error } = await (supabase as any).from("mindmaps")
          .update({ title, data, updated_at: new Date().toISOString() }).eq("id", mapId);
        if (error) throw error;
      } else {
        const { data: row, error } = await (supabase as any).from("mindmaps")
          .insert({ title, data, owner_staff_id: staffIdRef.current }).select("id").single();
        if (error) throw error;
        navigate(`/onboarding-tasks/mapas/${row.id}`, { replace: true });
      }
      setDirty(false);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }, [canEdit, mapId, title, data, navigate]);

  // autosave 2s após parar de mexer
  useEffect(() => {
    if (!dirty || !mapId || mapId === "novo") return;
    const t = setTimeout(save, 2000);
    return () => clearTimeout(t);
  }, [dirty, data, title, mapId, save]);

  const { nodes, edges } = useMemo(() => {
    const l = layout(data.root, data.layout || "radial", data.theme || "unv");
    return {
      nodes: l.nodes.map((n) => ({
        ...n, selected: n.id === selectedId,
        data: { ...n.data, editingId, seed: n.id === editingId ? editSeed : undefined,
          startEdit: (id: string) => { if (!canEdit) return; setEditSeed(null); setEditingId(id); },
          commitEdit, addChild, addSibling, toggle, resize, resetSize, canEdit,
          getZoom: () => rf.getZoom() },
      })),
      edges: l.edges,
    };
  }, [data, selectedId, editingId, editSeed, commitEdit, addChild, addSibling, toggle, canEdit, resize, resetSize, rf]);

  useEffect(() => { if (!loading) setTimeout(() => rf.fitView({ padding: 0.3, duration: 300 }), 50); }, [loading]); // eslint-disable-line

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const sel = findNode(data.root, selectedId)?.node;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* barra */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-background">
        <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks/mapas")}><ArrowLeft className="h-4 w-4" /></Button>
        <Input value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} disabled={!canEdit}
          className="max-w-xs h-8 font-semibold" />
        <div className="flex items-center gap-1 ml-2">
          <Button size="sm" variant="outline" className="gap-1" onClick={() => addChild(selectedId)} disabled={!canEdit} title="Tab"><Plus className="h-3.5 w-3.5" /> Filho</Button>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => addSibling(selectedId)} disabled={!canEdit || selectedId === "root"} title="Enter"><Plus className="h-3.5 w-3.5" /> Irmão</Button>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => removeNode(selectedId)} disabled={!canEdit || selectedId === "root"} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant="outline" onClick={() => toggle(selectedId)} disabled={!sel?.children.length} title="Espaço"><ChevronsUpDown className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant="ghost" onClick={doUndo} disabled={!canEdit} title="Ctrl+Z"><Undo2 className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant="ghost" onClick={doRedo} disabled={!canEdit} title="Ctrl+Shift+Z"><Redo2 className="h-3.5 w-3.5" /></Button>
          {sel && selectedId !== "root" && canEdit && (
            <div className="flex items-center gap-1 ml-2 pl-2 border-l">
              <Palette className="h-3.5 w-3.5 text-muted-foreground" />
              {(THEMES[data.theme || "unv"] || THEMES.unv).palette.slice(0, 8).map((c) => (
                <button key={c} className={cn("h-4 w-4 rounded-full border", sel.color === c && "ring-2 ring-offset-1 ring-primary")}
                  style={{ background: c }} onClick={() => setColor(selectedId, c)} title={c} />
              ))}
              {/* cor livre: qualquer cor, não só a paleta */}
              <label className="h-5 w-5 rounded-full border-2 border-dashed border-muted-foreground/50 cursor-pointer overflow-hidden relative" title="Cor personalizada">
                <input type="color" value={sel.color || "#0D2B5E"} onChange={(e) => setColor(selectedId, e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer" />
                <span className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground">+</span>
              </label>
              {sel.color && (
                <button className="text-[10px] text-muted-foreground hover:text-foreground ml-1" onClick={() => setColor(selectedId, "")}>limpar</button>
              )}
            </div>
          )}
          {/* o puxador do nó também resolve, mas quem ajustou sem querer precisa
              de um caminho óbvio pra desfazer */}
          {sel && canEdit && (sel.w || sel.h) && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 ml-1"
              onClick={() => resetSize(selectedId)}
              title="Volta a caixa a se medir pelo texto">
              <Maximize2 className="h-3.5 w-3.5" /> Tamanho automático
            </Button>
          )}
          <div className="flex items-center gap-1 ml-2 pl-2 border-l">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1.5" disabled={!canEdit}><LayoutTemplate className="h-3.5 w-3.5" /> {({ radial: "Radial", right: "Direita", tree: "Organograma" } as any)[data.layout || "radial"]}</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Tipo de mapa</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setLayoutKind("radial")}>Radial — ramos dos dois lados</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLayoutKind("right")}>Direita — todos os ramos à direita</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLayoutKind("tree")}>Organograma — de cima pra baixo</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Tema de cores</DropdownMenuLabel>
                {Object.entries(THEMES).map(([k, t]) => (
                  <DropdownMenuItem key={k} onClick={() => setTheme(k)} className="gap-2">
                    <span className="flex gap-0.5">{t.palette.slice(0, 5).map((c) => <span key={c} className="h-3 w-3 rounded-full" style={{ background: c }} />)}</span>
                    {t.name}{(data.theme || "unv") === k ? " ✓" : ""}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1.5" disabled={exporting}>
                  {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => exportImage("pdf")}>Baixar PDF (mapa completo + descritivo)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportImage("png")}>Baixar imagem (PNG)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          {!canEdit && <span className="text-amber-600">somente leitura — mapa de outra pessoa</span>}
          {canEdit && (dirty ? "alterações não salvas" : "salvo")}
          {canEdit && (
            <Button size="sm" onClick={save} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salvar
            </Button>
          )}
        </div>
      </div>

      {/* canvas */}
      <div className="flex-1" ref={canvasRef}>
        <ReactFlow
          nodes={nodes} edges={edges} nodeTypes={nodeTypes}
          nodesDraggable={false} nodesConnectable={false} elementsSelectable
          onNodeClick={(_, n) => setSelectedId(n.id)}
          onNodeDoubleClick={(_, n) => { if (canEdit) { setSelectedId(n.id); setEditSeed(null); setEditingId(n.id); } }}
          onPaneClick={() => { setEditingId(null); }}
          zoomOnDoubleClick={false}
          fitView minZoom={0.2} maxZoom={2.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={24} size={1} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable nodeColor={(n) => (n.data as any)?.isRoot ? "#0D2B5E" : ((n.data as any)?.color || "#94a3b8")} />
        </ReactFlow>
      </div>
      <div className="px-3 py-1.5 border-t text-[11px] text-muted-foreground bg-background">
        <b>Duplo clique</b> edita o texto · <b>Tab</b> filho · <b>Enter</b> irmão · <b>Delete</b> apagar · <b>Espaço</b> colapsar · <b>Ctrl+Z</b> desfazer · <b>canto do nó</b> ajusta o tamanho (duplo clique volta ao automático)
      </div>
    </div>
  );
}

export default function MindMapEditorPage() {
  return <ReactFlowProvider><Editor /></ReactFlowProvider>;
}
