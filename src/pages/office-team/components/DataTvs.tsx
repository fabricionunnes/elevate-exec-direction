// TVs das salas de setor com dados REAIS (views do banco, refresh 5min):
// Comercial = dashboard do CRM · Produto = clientes/NPS/churn ·
// Financeiro = tela apagada de propósito (dados sigilosos).
// + Placa de agenda do dia na parede da Reunião Principal.
import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { useTeamStore } from '../store/useTeamStore'
import { fetchTvComercial, fetchTvProduto, formatBRL, TvComercial, TvProduto } from '../lib/tvdata'
import type { AgendaItem } from '../lib/agenda'

const REFRESH_MS = 5 * 60_000
const NAVY = '#0D2B5E'
const RED = '#CC1B1B'

// Renderiza em 2x (retina) — o canvas físico dobra, as coordenadas de
// desenho continuam lógicas. Texto nítido mesmo com a TV grande.
const DPR = 2

function makeCanvas(w: number, h: number) {
  const canvas = document.createElement('canvas')
  canvas.width = w * DPR
  canvas.height = h * DPR
  const ctx = canvas.getContext('2d')!
  ctx.scale(DPR, DPR)
  return { canvas, ctx, w, h }
}

function drawHeader(ctx: CanvasRenderingContext2D, w: number, h: number, title: string) {
  ctx.fillStyle = '#0a1424'
  ctx.fillRect(0, 0, w, h)
  const grad = ctx.createLinearGradient(0, 0, w, 0)
  grad.addColorStop(0, NAVY)
  grad.addColorStop(1, '#13294a')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, 58)
  ctx.fillStyle = RED
  ctx.fillRect(0, 58, w, 4)
  ctx.fillStyle = '#ffffff'
  ctx.font = '700 30px -apple-system, "Segoe UI", sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(title, 22, 41)
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = '600 16px -apple-system, "Segoe UI", sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText('UNV · ao vivo', w - 20, 38)
  ctx.textAlign = 'left'
}

function drawKpi(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, label: string, value: string, color: string) {
  ctx.fillStyle = 'rgba(255,255,255,0.05)'
  ctx.beginPath()
  ctx.roundRect(x, y, w, 102, 10)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = '600 17px -apple-system, "Segoe UI", sans-serif'
  ctx.fillText(label.toUpperCase(), x + 16, y + 32)
  ctx.fillStyle = color
  ctx.font = '800 46px -apple-system, "Segoe UI", sans-serif'
  ctx.fillText(value, x + 16, y + 82)
}

function drawComercial(ctx: CanvasRenderingContext2D, w: number, h: number, d: TvComercial | null) {
  drawHeader(ctx, w, h, 'COMERCIAL — CRM')
  if (!d) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.font = '600 22px sans-serif'
    ctx.fillText('Carregando dados...', 22, 140)
    return
  }
  const colW = (w - 66) / 2
  drawKpi(ctx, 22, 86, colW, 'Vendas no mês', String(d.vendas_mes), '#4CAF50')
  drawKpi(ctx, 44 + colW, 86, colW, 'Receita no mês', formatBRL(d.receita_mes), '#FFD700')
  drawKpi(ctx, 22, 204, colW, 'Deals abertos (90d)', String(d.deals_abertos), '#81D4FA')
  drawKpi(ctx, 44 + colW, 204, colW, 'Pipeline (90d)', formatBRL(d.pipeline_valor), '#CE93D8')
}

function drawProduto(ctx: CanvasRenderingContext2D, w: number, h: number, d: TvProduto | null) {
  drawHeader(ctx, w, h, 'PRODUTO — CLIENTES')
  if (!d) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.font = '600 22px sans-serif'
    ctx.fillText('Carregando dados...', 22, 140)
    return
  }
  const colW = (w - 66) / 2
  const health = d.health_medio
  const healthColor = health == null ? '#9aa3ad' : health >= 70 ? '#4CAF50' : health >= 50 ? '#FFD700' : '#FF8A65'
  drawKpi(ctx, 22, 86, colW, 'Clientes ativos', String(d.clientes_ativos), '#4CAF50')
  drawKpi(ctx, 44 + colW, 86, colW, 'Health médio (0-100)', health == null ? '—' : String(health), healthColor)
  drawKpi(ctx, 22, 204, colW, 'Clientes em risco', d.em_risco == null ? '—' : String(d.em_risco), (d.em_risco ?? 0) > 0 ? '#FF8A65' : '#4CAF50')
  drawKpi(ctx, 44 + colW, 204, colW, 'Reuniões no mês', String(d.reunioes_mes), '#81D4FA')
}

function drawAgenda(ctx: CanvasRenderingContext2D, w: number, h: number, items: AgendaItem[]) {
  drawHeader(ctx, w, h, 'AGENDA DE HOJE')
  if (items.length === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.45)'
    ctx.font = '600 20px -apple-system, "Segoe UI", sans-serif'
    ctx.fillText('Sem reuniões agendadas pra hoje.', 22, 140)
    return
  }
  const now = Date.now()
  let y = 96
  for (const m of items.slice(0, 7)) {
    const start = new Date(m.meeting_date).getTime()
    const live = now >= start && now <= start + 60 * 60_000
    const past = now > start + 60 * 60_000
    const hh = new Date(m.meeting_date).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    })
    ctx.globalAlpha = past ? 0.38 : 1
    if (live) {
      ctx.fillStyle = 'rgba(76,175,80,0.14)'
      ctx.beginPath()
      ctx.roundRect(14, y - 26, w - 28, 38, 8)
      ctx.fill()
    }
    ctx.fillStyle = live ? '#4CAF50' : '#FFD700'
    ctx.font = '800 19px -apple-system, "Segoe UI", sans-serif'
    ctx.fillText(hh, 24, y)
    ctx.fillStyle = '#ffffff'
    ctx.font = '600 19px -apple-system, "Segoe UI", sans-serif'
    const title = (m.meeting_title ?? 'Reunião').slice(0, 38)
    ctx.fillText(live ? `● ${title}` : title, 94, y)
    if (m.calendar_owner_name) {
      ctx.fillStyle = 'rgba(255,255,255,0.45)'
      ctx.font = '500 14px -apple-system, "Segoe UI", sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(m.calendar_owner_name.split(' ')[0], w - 22, y)
      ctx.textAlign = 'left'
    }
    ctx.globalAlpha = 1
    y += 44
  }
}

const MESES = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO']

/** Termômetro de meta: receita do mês vs Meta/Super/Hiper lançadas no CRM. */
function drawTermometro(ctx: CanvasRenderingContext2D, w: number, h: number, d: TvComercial | null) {
  ctx.fillStyle = '#0a1424'
  ctx.fillRect(0, 0, w, h)
  const grad = ctx.createLinearGradient(0, 0, w, 0)
  grad.addColorStop(0, NAVY)
  grad.addColorStop(1, '#13294a')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, 54)
  ctx.fillStyle = RED
  ctx.fillRect(0, 54, w, 4)
  ctx.fillStyle = '#ffffff'
  ctx.font = '700 27px -apple-system, "Segoe UI", sans-serif'
  ctx.fillText(`🎯 META DE ${MESES[new Date().getMonth()]}`, 22, 38)

  if (!d) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.font = '600 20px sans-serif'
    ctx.fillText('Carregando...', 22, 130)
    return
  }
  if (d.meta_mes <= 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.font = '600 21px -apple-system, "Segoe UI", sans-serif'
    ctx.fillText('Meta do mês ainda não lançada.', 22, 125)
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.font = '500 17px -apple-system, "Segoe UI", sans-serif'
    ctx.fillText('Lance as metas de Vendas no CRM Comercial', 22, 158)
    ctx.fillText('(Configurações → Metas) e o termômetro liga sozinho.', 22, 184)
    return
  }

  const cur = d.receita_mes
  const marks = [
    { v: d.meta_mes, label: 'META', color: '#FFD700' },
    { v: d.super_meta_mes, label: 'SUPER', color: '#FF8A65' },
    { v: d.hiper_meta_mes, label: 'HIPER', color: '#CE93D8' },
  ].filter((m) => m.v > 0)
  const maxV = Math.max(...marks.map((m) => m.v)) * 1.06
  const bx = 28
  const bw = w - 56
  const by = 132
  const bh = 56

  // % da meta em destaque
  const pctMeta = Math.round((cur / d.meta_mes) * 100)
  ctx.fillStyle = pctMeta >= 100 ? '#4CAF50' : '#FFD700'
  ctx.font = '800 44px -apple-system, "Segoe UI", sans-serif'
  ctx.fillText(`${pctMeta}%`, bx, 112)
  ctx.fillStyle = 'rgba(255,255,255,0.65)'
  ctx.font = '600 19px -apple-system, "Segoe UI", sans-serif'
  ctx.fillText(`${formatBRL(cur)} de ${formatBRL(d.meta_mes)}`, bx + 130, 105)

  // Trilho
  ctx.fillStyle = 'rgba(255,255,255,0.1)'
  ctx.beginPath()
  ctx.roundRect(bx, by, bw, bh, 12)
  ctx.fill()
  // Preenchimento
  const fillW = Math.max(10, Math.min(1, cur / maxV) * bw)
  const fillGrad = ctx.createLinearGradient(bx, 0, bx + bw, 0)
  fillGrad.addColorStop(0, '#CC1B1B')
  fillGrad.addColorStop(0.55, '#FFD700')
  fillGrad.addColorStop(1, '#4CAF50')
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(bx, by, fillW, bh, 12)
  ctx.clip()
  ctx.fillStyle = fillGrad
  ctx.fillRect(bx, by, bw, bh)
  ctx.restore()

  // Marcos Meta/Super/Hiper
  for (const m of marks) {
    const mx = bx + Math.min(1, m.v / maxV) * bw
    ctx.strokeStyle = m.color
    ctx.lineWidth = 3
    ctx.setLineDash([6, 4])
    ctx.beginPath()
    ctx.moveTo(mx, by - 10)
    ctx.lineTo(mx, by + bh + 10)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = m.color
    ctx.font = '700 14px -apple-system, "Segoe UI", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(m.label, mx, by + bh + 30)
    ctx.font = '600 13px -apple-system, "Segoe UI", sans-serif'
    ctx.fillText(formatBRL(m.v), mx, by + bh + 48)
    ctx.textAlign = 'left'
  }
}

/** Telão de parede: moldura fina + tela grande (cobre a TV pequena original). */
function BigTv({ x, y, z, w, h, texture }: { x: number; y: number; z: number; w: number; h: number; texture?: THREE.CanvasTexture }) {
  return (
    <group position={[x, y, z]}>
      {/* Moldura profunda: encosta na parede e engole a TV antiga atrás */}
      <mesh position={[0, 0, -0.15]} castShadow>
        <boxGeometry args={[w + 0.18, h + 0.18, 0.3]} />
        <meshStandardMaterial color="#0d0f13" metalness={0.4} roughness={0.35} />
      </mesh>
      {/* Barra de apoio na parede */}
      <mesh position={[0, -h / 2 - 0.14, -0.2]}>
        <boxGeometry args={[w * 0.5, 0.06, 0.12]} />
        <meshStandardMaterial color="#23262c" metalness={0.5} roughness={0.4} />
      </mesh>
      {texture ? (
        <mesh position={[0, 0, 0.003]}>
          <planeGeometry args={[w, h]} />
          <meshStandardMaterial map={texture} emissiveMap={texture} emissive="#ffffff" emissiveIntensity={0.62} toneMapped={false} />
        </mesh>
      ) : (
        // Tela apagada (Financeiro — sigilo)
        <mesh position={[0, 0, 0.003]}>
          <planeGeometry args={[w, h]} />
          <meshStandardMaterial color="#06080c" roughness={0.25} />
        </mesh>
      )}
    </group>
  )
}

// TV de dados: 3.6m de tela (antes 2.05m) — legível do meio da sala
const TV_W = 3.6
const TV_H = 1.76
const TV_Y = 1.85

export default function DataTvs({ agendaToday }: { agendaToday: AgendaItem[] }) {
  const rooms = useTeamStore((s) => s.rooms)
  // Visitante convidado: TVs apagadas (sem dados de negócio; o banco também bloqueia)
  const isGuest = useTeamStore((s) => s.me?.isGuest === true)
  const [comercial, setComercial] = useState<TvComercial | null>(null)
  const [produto, setProduto] = useState<TvProduto | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const [c, p] = await Promise.all([fetchTvComercial(), fetchTvProduto()])
      if (cancelled) return
      setComercial(c)
      setProduto(p)
    }
    void load()
    const interval = setInterval(load, REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  const comercialTex = useMemo(() => {
    const { canvas, ctx, w, h } = makeCanvas(660, 322)
    drawComercial(ctx, w, h, comercial)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [comercial])

  const produtoTex = useMemo(() => {
    const { canvas, ctx, w, h } = makeCanvas(660, 322)
    drawProduto(ctx, w, h, produto)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [produto])

  const agendaTex = useMemo(() => {
    const { canvas, ctx, w, h } = makeCanvas(560, 420)
    drawAgenda(ctx, w, h, agendaToday)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [agendaToday])

  const termTex = useMemo(() => {
    const { canvas, ctx, w, h } = makeCanvas(700, 300)
    drawTermometro(ctx, w, h, comercial)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [comercial])

  const comercialRoom = rooms.find((r) => r.roomType === 'sector' && r.sector === 'comercial')
  const produtoRoom = rooms.find((r) => r.roomType === 'sector' && r.sector === 'produto')
  const financeiroRoom = rooms.find((r) => r.roomType === 'sector' && r.sector === 'financeiro')
  const mainMeeting = rooms.find((r) => r.roomType === 'meeting' && /principal/i.test(r.name))

  return (
    <>
      {comercialRoom && (
        <BigTv
          x={comercialRoom.x}
          y={TV_Y}
          z={comercialRoom.z - comercialRoom.depth / 2 + 0.36}
          w={TV_W}
          h={TV_H}
          texture={isGuest ? undefined : comercialTex}
        />
      )}
      {produtoRoom && (
        <BigTv
          x={produtoRoom.x}
          y={TV_Y}
          z={produtoRoom.z - produtoRoom.depth / 2 + 0.36}
          w={TV_W}
          h={TV_H}
          texture={isGuest ? undefined : produtoTex}
        />
      )}
      {/* Termômetro de meta: parede leste da sala Comercial */}
      {comercialRoom && !isGuest && (
        <group
          position={[comercialRoom.x + comercialRoom.width / 2 - 0.36, 1.7, comercialRoom.z + 0.6]}
          rotation={[0, -Math.PI / 2, 0]}
        >
          <BigTv x={0} y={0} z={0} w={3.3} h={1.42} texture={termTex} />
        </group>
      )}
      {/* Financeiro: telão igual, mas desligado — números sigilosos não vão pra TV */}
      {financeiroRoom && (
        <BigTv
          x={financeiroRoom.x}
          y={TV_Y}
          z={financeiroRoom.z - financeiroRoom.depth / 2 + 0.36}
          w={TV_W}
          h={TV_H}
        />
      )}
      {/* Placa da agenda do dia, na parede externa da Reunião Principal (lado do corredor) */}
      {mainMeeting && !isGuest && (
        <group
          position={[mainMeeting.x + 3.4, 1.62, mainMeeting.z - mainMeeting.depth / 2 - 0.06]}
          rotation={[0, Math.PI, 0]}
        >
          <mesh position={[0, 0, -0.015]}>
            <boxGeometry args={[2.02, 1.55, 0.03]} />
            <meshStandardMaterial color="#1a1d24" metalness={0.5} roughness={0.4} />
          </mesh>
          <mesh>
            <planeGeometry args={[1.9, 1.425]} />
            <meshStandardMaterial map={agendaTex} emissiveMap={agendaTex} emissive="#ffffff" emissiveIntensity={0.55} toneMapped={false} />
          </mesh>
        </group>
      )}
    </>
  )
}
