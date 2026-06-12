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

function makeCanvas(w: number, h: number) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  return canvas
}

function drawHeader(ctx: CanvasRenderingContext2D, w: number, title: string) {
  ctx.fillStyle = '#0a1424'
  ctx.fillRect(0, 0, w, ctx.canvas.height)
  const grad = ctx.createLinearGradient(0, 0, w, 0)
  grad.addColorStop(0, NAVY)
  grad.addColorStop(1, '#13294a')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, 54)
  ctx.fillStyle = RED
  ctx.fillRect(0, 54, w, 4)
  ctx.fillStyle = '#ffffff'
  ctx.font = '700 26px -apple-system, "Segoe UI", sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(title, 22, 37)
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = '600 15px -apple-system, "Segoe UI", sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText('UNV · ao vivo', w - 20, 35)
  ctx.textAlign = 'left'
}

function drawKpi(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, label: string, value: string, color: string) {
  ctx.fillStyle = 'rgba(255,255,255,0.05)'
  ctx.beginPath()
  ctx.roundRect(x, y, w, 100, 10)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '600 15px -apple-system, "Segoe UI", sans-serif'
  ctx.fillText(label.toUpperCase(), x + 14, y + 30)
  ctx.fillStyle = color
  ctx.font = '800 36px -apple-system, "Segoe UI", sans-serif'
  ctx.fillText(value, x + 14, y + 76)
}

function drawComercial(canvas: HTMLCanvasElement, d: TvComercial | null) {
  const ctx = canvas.getContext('2d')!
  const w = canvas.width
  drawHeader(ctx, w, 'COMERCIAL — CRM')
  if (!d) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.font = '600 20px sans-serif'
    ctx.fillText('Carregando dados...', 22, 140)
    return
  }
  const colW = (w - 66) / 2
  drawKpi(ctx, 22, 80, colW, 'Vendas no mês', String(d.vendas_mes), '#4CAF50')
  drawKpi(ctx, 44 + colW, 80, colW, 'Receita no mês', formatBRL(d.receita_mes), '#FFD700')
  drawKpi(ctx, 22, 196, colW, 'Deals abertos (90d)', String(d.deals_abertos), '#81D4FA')
  drawKpi(ctx, 44 + colW, 196, colW, 'Pipeline (90d)', formatBRL(d.pipeline_valor), '#CE93D8')
}

function drawProduto(canvas: HTMLCanvasElement, d: TvProduto | null) {
  const ctx = canvas.getContext('2d')!
  const w = canvas.width
  drawHeader(ctx, w, 'PRODUTO — CLIENTES')
  if (!d) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.font = '600 20px sans-serif'
    ctx.fillText('Carregando dados...', 22, 140)
    return
  }
  const colW = (w - 66) / 2
  drawKpi(ctx, 22, 80, colW, 'Clientes ativos', String(d.clientes_ativos), '#4CAF50')
  drawKpi(ctx, 44 + colW, 80, colW, 'NPS (90 dias)', d.nps_90d == null ? '—' : String(d.nps_90d), '#FFD700')
  drawKpi(ctx, 22, 196, colW, 'Novos (30 dias)', `+${d.novos_30d}`, '#81D4FA')
  drawKpi(ctx, 44 + colW, 196, colW, 'Saídas no mês', String(d.saidas_mes), d.saidas_mes > 0 ? '#FF8A65' : '#4CAF50')
}

function drawAgenda(canvas: HTMLCanvasElement, items: AgendaItem[]) {
  const ctx = canvas.getContext('2d')!
  const w = canvas.width
  drawHeader(ctx, w, 'AGENDA DE HOJE')
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

/** Tela plana posicionada sobre a TV existente da sala. */
function Screen({ x, y, z, w, h, texture }: { x: number; y: number; z: number; w: number; h: number; texture: THREE.CanvasTexture }) {
  return (
    <mesh position={[x, y, z]}>
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial map={texture} emissiveMap={texture} emissive="#ffffff" emissiveIntensity={0.62} toneMapped={false} />
    </mesh>
  )
}

export default function DataTvs({ agendaToday }: { agendaToday: AgendaItem[] }) {
  const rooms = useTeamStore((s) => s.rooms)
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
    const canvas = makeCanvas(640, 312)
    drawComercial(canvas, comercial)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [comercial])

  const produtoTex = useMemo(() => {
    const canvas = makeCanvas(640, 312)
    drawProduto(canvas, produto)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [produto])

  const agendaTex = useMemo(() => {
    const canvas = makeCanvas(560, 420)
    drawAgenda(canvas, agendaToday)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [agendaToday])

  const comercialRoom = rooms.find((r) => r.roomType === 'sector' && r.sector === 'comercial')
  const produtoRoom = rooms.find((r) => r.roomType === 'sector' && r.sector === 'produto')
  const financeiroRoom = rooms.find((r) => r.roomType === 'sector' && r.sector === 'financeiro')
  const mainMeeting = rooms.find((r) => r.roomType === 'meeting' && /principal/i.test(r.name))

  return (
    <>
      {comercialRoom && (
        <Screen
          x={comercialRoom.x}
          y={1.7}
          z={comercialRoom.z - comercialRoom.depth / 2 + 0.302}
          w={2.05}
          h={1.0}
          texture={comercialTex}
        />
      )}
      {produtoRoom && (
        <Screen
          x={produtoRoom.x}
          y={1.7}
          z={produtoRoom.z - produtoRoom.depth / 2 + 0.302}
          w={2.05}
          h={1.0}
          texture={produtoTex}
        />
      )}
      {/* Financeiro: tela desligada — números sigilosos não vão pro telão */}
      {financeiroRoom && (
        <mesh position={[financeiroRoom.x, 1.7, financeiroRoom.z - financeiroRoom.depth / 2 + 0.302]}>
          <planeGeometry args={[2.05, 1.0]} />
          <meshStandardMaterial color="#06080c" roughness={0.25} />
        </mesh>
      )}
      {/* Placa da agenda do dia, na parede externa da Reunião Principal (lado do corredor) */}
      {mainMeeting && (
        <group
          position={[mainMeeting.x + 3.4, 1.62, mainMeeting.z - mainMeeting.depth / 2 - 0.06]}
          rotation={[0, Math.PI, 0]}
        >
          <mesh position={[0, 0, -0.015]}>
            <boxGeometry args={[1.62, 1.24, 0.03]} />
            <meshStandardMaterial color="#1a1d24" metalness={0.5} roughness={0.4} />
          </mesh>
          <mesh>
            <planeGeometry args={[1.5, 1.125]} />
            <meshStandardMaterial map={agendaTex} emissiveMap={agendaTex} emissive="#ffffff" emissiveIntensity={0.55} toneMapped={false} />
          </mesh>
        </group>
      )}
    </>
  )
}
