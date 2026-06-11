// Ata de reunião em PDF com o branding UNV (navy #0D2B5E / vermelho #CC1B1B)
// e a logomarca oficial. Conteúdo: resumo executivo, tópicos, decisões,
// próximas ações e a transcrição completa em anexo.
import { jsPDF } from 'jspdf'
import logoUrl from '@/assets/logo-unv-oficial.png'

export interface AtaData {
  resumo?: string
  topicos?: string[]
  decisoes?: string[]
  acoes?: string[]
}

export interface AtaMeta {
  title: string
  roomName: string | null
  createdAt: string
  byName: string | null
  durationS: number | null
}

const NAVY: [number, number, number] = [13, 43, 94]
const RED: [number, number, number] = [204, 27, 27]
const GRAY: [number, number, number] = [110, 115, 125]
const PAGE_W = 210
const PAGE_H = 297
const MARGIN = 18
const CONTENT_W = PAGE_W - MARGIN * 2

async function loadLogo(): Promise<{ dataUrl: string; ratio: number } | null> {
  try {
    const res = await fetch(logoUrl)
    const blob = await res.blob()
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result as string)
      r.onerror = reject
      r.readAsDataURL(blob)
    })
    const ratio = await new Promise<number>((resolve) => {
      const img = new Image()
      img.onload = () => resolve(img.height / img.width)
      img.onerror = () => resolve(1)
      img.src = dataUrl
    })
    return { dataUrl, ratio }
  } catch {
    return null
  }
}

function fmtDuration(s: number | null): string {
  if (!s) return '—'
  const m = Math.floor(s / 60)
  return `${m} min ${s % 60}s`
}

export async function generateAtaPdf(meta: AtaMeta, ata: AtaData, transcript: string | null) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const logo = await loadLogo()
  let y = 16

  // ── Cabeçalho com a marca ──────────────────────────────────────────────
  if (logo) {
    const lw = 34
    doc.addImage(logo.dataUrl, 'PNG', MARGIN, y - 4, lw, lw * logo.ratio)
  }
  doc.setTextColor(...NAVY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text('ATA DE REUNIÃO', PAGE_W - MARGIN, y + 8, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...GRAY)
  doc.text('UNV — Universidade Nacional de Vendas', PAGE_W - MARGIN, y + 15, { align: 'right' })
  y += (logo ? 34 * logo.ratio : 18) + 2

  // Linha da marca
  doc.setFillColor(...NAVY)
  doc.rect(MARGIN, y, CONTENT_W, 1.4, 'F')
  doc.setFillColor(...RED)
  doc.rect(MARGIN, y + 1.4, CONTENT_W * 0.35, 1.4, 'F')
  y += 9

  // ── Metadados ──────────────────────────────────────────────────────────
  doc.setFontSize(10.5)
  const metaPairs: [string, string][] = [
    ['Reunião', meta.title],
    ['Sala', meta.roomName ?? 'Escritório'],
    ['Data', new Date(meta.createdAt).toLocaleString('pt-BR')],
    ['Duração', fmtDuration(meta.durationS)],
    ['Gravada por', meta.byName ?? '—'],
  ]
  for (const [label, value] of metaPairs) {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...NAVY)
    doc.text(`${label}:`, MARGIN, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(40, 40, 40)
    const lines = doc.splitTextToSize(value, CONTENT_W - 34)
    doc.text(lines, MARGIN + 32, y)
    y += 6 * lines.length
  }
  y += 4

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_H - 22) {
      doc.addPage()
      y = 20
    }
  }

  const section = (title: string) => {
    ensureSpace(16)
    doc.setFillColor(...RED)
    doc.rect(MARGIN, y - 4, 1.8, 6, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...NAVY)
    doc.text(title, MARGIN + 5, y)
    y += 7
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10.5)
    doc.setTextColor(40, 40, 40)
  }

  const paragraph = (text: string) => {
    const lines = doc.splitTextToSize(text, CONTENT_W)
    for (const line of lines) {
      ensureSpace(6)
      doc.text(line, MARGIN, y)
      y += 5.4
    }
    y += 2
  }

  const bullets = (items: string[]) => {
    for (const item of items) {
      const lines = doc.splitTextToSize(item, CONTENT_W - 6)
      ensureSpace(6 * lines.length)
      doc.setTextColor(...RED)
      doc.text('•', MARGIN + 1, y)
      doc.setTextColor(40, 40, 40)
      doc.text(lines, MARGIN + 6, y)
      y += 5.4 * lines.length + 1
    }
    y += 2
  }

  // ── Conteúdo da ata ─────────────────────────────────────────────────────
  if (ata.resumo) {
    section('Resumo executivo')
    paragraph(ata.resumo)
  }
  if (ata.topicos && ata.topicos.length > 0) {
    section('Tópicos discutidos')
    bullets(ata.topicos)
  }
  if (ata.decisoes && ata.decisoes.length > 0) {
    section('Decisões')
    bullets(ata.decisoes)
  }
  if (ata.acoes && ata.acoes.length > 0) {
    section('Próximas ações')
    bullets(ata.acoes)
  }

  // ── Anexo: transcrição completa ─────────────────────────────────────────
  if (transcript) {
    doc.addPage()
    y = 20
    section('Anexo — Transcrição completa')
    doc.setFontSize(9)
    doc.setTextColor(70, 70, 70)
    const lines = doc.splitTextToSize(transcript, CONTENT_W)
    for (const line of lines) {
      if (y > PAGE_H - 22) {
        doc.addPage()
        y = 20
        doc.setFontSize(9)
        doc.setTextColor(70, 70, 70)
      }
      doc.text(line, MARGIN, y)
      y += 4.6
    }
  }

  // ── Rodapé em todas as páginas ──────────────────────────────────────────
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFillColor(...NAVY)
    doc.rect(MARGIN, PAGE_H - 14, CONTENT_W, 0.8, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...GRAY)
    doc.text('UNV — Universidade Nacional de Vendas · unvholdings.com.br', MARGIN, PAGE_H - 9)
    doc.text(`${i}/${pages}`, PAGE_W - MARGIN, PAGE_H - 9, { align: 'right' })
  }

  const safe = meta.title.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-').slice(0, 50)
  doc.save(`ata-${safe || 'reuniao'}-${meta.createdAt.slice(0, 10)}.pdf`)
}
