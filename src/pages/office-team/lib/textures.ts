// Texturas procedurais geradas em canvas (zero assets externos):
// madeira, porcelanato, carpete, arte abstrata e o selo UNV do piso.
// Cacheadas em módulo — cada uma é criada uma única vez.
import * as THREE from 'three'

function canvasTex(
  w: number,
  h: number,
  draw: (g: CanvasRenderingContext2D, w: number, h: number) => void
): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  draw(g, w, h)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = THREE.RepeatWrapping
  t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

// rng determinístico simples
function mulberry(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let z = s
    z = Math.imul(z ^ (z >>> 15), z | 1)
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61)
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296
  }
}

let _wood: THREE.CanvasTexture | null = null
export function woodTexture(): THREE.CanvasTexture {
  if (_wood) return _wood
  _wood = canvasTex(256, 256, (g, w, h) => {
    const rnd = mulberry(7)
    g.fillStyle = '#a87c4f'
    g.fillRect(0, 0, w, h)
    // Veios ondulados
    for (let i = 0; i < 28; i++) {
      const x0 = rnd() * w
      const tone = 0.75 + rnd() * 0.5
      g.strokeStyle = `rgba(${Math.round(120 * tone)}, ${Math.round(82 * tone)}, ${Math.round(48 * tone)}, 0.35)`
      g.lineWidth = 1 + rnd() * 3
      g.beginPath()
      for (let y = 0; y <= h; y += 8) {
        const x = x0 + Math.sin(y * 0.05 + i) * 4 + (rnd() - 0.5) * 3
        if (y === 0) g.moveTo(x, y)
        else g.lineTo(x, y)
      }
      g.stroke()
    }
    // Nós
    for (let i = 0; i < 3; i++) {
      const x = rnd() * w
      const y = rnd() * h
      g.fillStyle = 'rgba(90, 60, 32, 0.45)'
      g.beginPath()
      g.ellipse(x, y, 4 + rnd() * 4, 2.5 + rnd() * 2.5, rnd(), 0, Math.PI * 2)
      g.fill()
    }
  })
  return _wood
}

let _floor: THREE.CanvasTexture | null = null
export function floorTexture(): THREE.CanvasTexture {
  if (_floor) return _floor
  _floor = canvasTex(512, 512, (g, w, h) => {
    const rnd = mulberry(11)
    const tile = 128
    for (let ty = 0; ty < h / tile; ty++) {
      for (let tx = 0; tx < w / tile; tx++) {
        const v = 0.96 + rnd() * 0.07
        g.fillStyle = `rgb(${Math.round(221 * v)}, ${Math.round(214 * v)}, ${Math.round(201 * v)})`
        g.fillRect(tx * tile, ty * tile, tile, tile)
        // mármore sutil
        for (let i = 0; i < 5; i++) {
          g.strokeStyle = `rgba(160, 152, 138, ${0.06 + rnd() * 0.08})`
          g.lineWidth = 0.8
          g.beginPath()
          const x0 = tx * tile + rnd() * tile
          const y0 = ty * tile + rnd() * tile
          g.moveTo(x0, y0)
          g.quadraticCurveTo(x0 + (rnd() - 0.5) * 60, y0 + (rnd() - 0.5) * 60, x0 + (rnd() - 0.5) * 90, y0 + (rnd() - 0.5) * 90)
          g.stroke()
        }
      }
    }
    // Rejunte
    g.strokeStyle = 'rgba(150, 142, 128, 0.85)'
    g.lineWidth = 2
    for (let x = 0; x <= w; x += tile) {
      g.beginPath()
      g.moveTo(x, 0)
      g.lineTo(x, h)
      g.stroke()
    }
    for (let y = 0; y <= h; y += tile) {
      g.beginPath()
      g.moveTo(0, y)
      g.lineTo(w, y)
      g.stroke()
    }
  })
  return _floor
}

let _carpet: THREE.CanvasTexture | null = null
export function carpetTexture(): THREE.CanvasTexture {
  if (_carpet) return _carpet
  _carpet = canvasTex(256, 256, (g, w, h) => {
    const rnd = mulberry(23)
    g.fillStyle = '#7d92a8'
    g.fillRect(0, 0, w, h)
    // Grão de carpete
    for (let i = 0; i < 9000; i++) {
      const v = rnd()
      g.fillStyle = v > 0.5 ? `rgba(255,255,255,${0.02 + rnd() * 0.05})` : `rgba(30,45,65,${0.03 + rnd() * 0.06})`
      g.fillRect(rnd() * w, rnd() * h, 1.5, 1.5)
    }
  })
  return _carpet
}

const _arts = new Map<number, THREE.CanvasTexture>()
export function artTexture(seed: number): THREE.CanvasTexture {
  const cached = _arts.get(seed)
  if (cached) return cached
  const palettes = [
    ['#0D2B5E', '#CC1B1B', '#e8d5a3', '#f4f1ea'],
    ['#1B6B3A', '#e8a33d', '#f4f1ea', '#0D2B5E'],
    ['#6B2FA0', '#e86a8a', '#f4f1ea', '#2a2e3a'],
    ['#B85C00', '#0D2B5E', '#f4f1ea', '#7d92a8'],
  ]
  const t = canvasTex(128, 96, (g, w, h) => {
    const rnd = mulberry(seed * 97 + 13)
    const pal = palettes[seed % palettes.length]
    g.fillStyle = pal[3]
    g.fillRect(0, 0, w, h)
    for (let i = 0; i < 5; i++) {
      g.fillStyle = pal[i % 3]
      if (rnd() > 0.5) {
        g.fillRect(rnd() * w * 0.6, rnd() * h * 0.6, 15 + rnd() * w * 0.4, 10 + rnd() * h * 0.35)
      } else {
        g.beginPath()
        g.arc(rnd() * w, rnd() * h, 8 + rnd() * 18, 0, Math.PI * 2)
        g.fill()
      }
    }
  })
  t.wrapS = THREE.ClampToEdgeWrapping
  t.wrapT = THREE.ClampToEdgeWrapping
  _arts.set(seed, t)
  return t
}

// Logomarca OFICIAL (PNG com a águia) com o fundo branco removido em
// código — vira "adesivo" pro piso do hall.
import logoUrl from '@/assets/logo-unv-oficial.png'

let _officialLogo: THREE.CanvasTexture | null = null
let _officialLoading: Promise<THREE.CanvasTexture> | null = null
export function officialLogoTexture(): Promise<THREE.CanvasTexture> {
  if (_officialLogo) return Promise.resolve(_officialLogo)
  if (_officialLoading) return _officialLoading
  _officialLoading = new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = img.width
      c.height = img.height
      const g = c.getContext('2d')!
      g.drawImage(img, 0, 0)
      // Chroma key: branco (e quase-branco) → transparente
      const data = g.getImageData(0, 0, c.width, c.height)
      const px = data.data
      for (let i = 0; i < px.length; i += 4) {
        const r = px[i]
        const gg = px[i + 1]
        const b = px[i + 2]
        if (r > 235 && gg > 235 && b > 235) {
          px[i + 3] = 0
        } else if (r > 215 && gg > 215 && b > 215) {
          px[i + 3] = Math.round(((235 - Math.min(r, gg, b)) / 20) * 255)
        }
      }
      g.putImageData(data, 0, 0)
      const t = new THREE.CanvasTexture(c)
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 4
      _officialLogo = t
      resolve(t)
    }
    img.onerror = reject
    img.src = logoUrl
  })
  return _officialLoading
}

let _logo: THREE.CanvasTexture | null = null
export function unvFloorLogo(): THREE.CanvasTexture {
  if (_logo) return _logo
  _logo = canvasTex(512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h)
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    // U navy + V vermelho (marca)
    g.font = 'bold 230px Helvetica, Arial, sans-serif'
    g.fillStyle = 'rgba(13, 43, 94, 0.85)'
    g.fillText('UN', w / 2 - 78, h / 2 - 20)
    g.fillStyle = 'rgba(204, 27, 27, 0.85)'
    g.fillText('V', w / 2 + 138, h / 2 - 20)
    g.font = 'bold 36px Helvetica, Arial, sans-serif'
    g.fillStyle = 'rgba(13, 43, 94, 0.7)'
    g.fillText('UNIVERSIDADE NACIONAL DE VENDAS', w / 2, h / 2 + 130)
  })
  _logo.wrapS = THREE.ClampToEdgeWrapping
  _logo.wrapT = THREE.ClampToEdgeWrapping
  return _logo
}

// ── Fase 3 (visual): texturas novas, todas em canvas ─────────────────────

/** Tela de CRM genérica (barra lateral, funil em colunas, cards). */
let _crm: THREE.CanvasTexture | null = null
export function crmScreenTexture(): THREE.CanvasTexture {
  if (_crm) return _crm
  _crm = canvasTex(256, 160, (g, w, h) => {
    const rnd = mulberry(41)
    g.fillStyle = '#f3f5f9'
    g.fillRect(0, 0, w, h)
    // Barra lateral navy
    g.fillStyle = '#0D2B5E'
    g.fillRect(0, 0, 34, h)
    for (let i = 0; i < 6; i++) {
      g.fillStyle = i === 1 ? '#CC1B1B' : 'rgba(255,255,255,0.35)'
      g.fillRect(8, 14 + i * 20, 18, 6)
    }
    // Cabeçalho
    g.fillStyle = '#ffffff'
    g.fillRect(34, 0, w - 34, 18)
    g.fillStyle = '#0D2B5E'
    g.fillRect(40, 6, 46, 6)
    g.fillStyle = '#CC1B1B'
    g.fillRect(w - 40, 5, 30, 8)
    // Funil: 5 colunas com cards
    const cols = 5
    const cw = (w - 34 - 12) / cols
    for (let c = 0; c < cols; c++) {
      const x = 34 + 6 + c * cw
      g.fillStyle = '#dfe5ee'
      g.fillRect(x + 2, 24, cw - 4, 6)
      const n = 2 + Math.floor(rnd() * 5)
      for (let k = 0; k < n; k++) {
        const y = 34 + k * 20
        if (y + 16 > h) break
        g.fillStyle = '#ffffff'
        g.fillRect(x + 2, y, cw - 4, 16)
        g.fillStyle = ['#0D2B5E', '#CC1B1B', '#1B6B3A', '#e8a33d'][Math.floor(rnd() * 4)]
        g.fillRect(x + 4, y + 3, 4, 10)
        g.fillStyle = '#c4cbd6'
        g.fillRect(x + 11, y + 4, cw - 18, 3)
        g.fillRect(x + 11, y + 9, (cw - 18) * (0.4 + rnd() * 0.5), 3)
      }
    }
  })
  _crm.wrapS = THREE.ClampToEdgeWrapping
  _crm.wrapT = THREE.ClampToEdgeWrapping
  return _crm
}

/** Quadro branco com escrita (funil, metas e setas). */
let _board: THREE.CanvasTexture | null = null
export function whiteboardTexture(): THREE.CanvasTexture {
  if (_board) return _board
  _board = canvasTex(256, 160, (g, w, h) => {
    g.fillStyle = '#fbfbf9'
    g.fillRect(0, 0, w, h)
    g.strokeStyle = 'rgba(0,0,0,0.06)'
    g.lineWidth = 1
    for (let y = 20; y < h; y += 20) {
      g.beginPath()
      g.moveTo(0, y)
      g.lineTo(w, y)
      g.stroke()
    }
    g.font = 'bold 16px Helvetica, Arial, sans-serif'
    g.fillStyle = '#0D2B5E'
    g.fillText('META DO MES', 14, 26)
    g.fillStyle = '#CC1B1B'
    g.font = 'bold 22px Helvetica, Arial, sans-serif'
    g.fillText('R$ 480k', 14, 52)
    // Funil desenhado a mão
    g.strokeStyle = '#1f3b73'
    g.lineWidth = 2.5
    const steps = [120, 96, 70, 46]
    for (let i = 0; i < steps.length; i++) {
      const y = 70 + i * 20
      g.beginPath()
      g.moveTo(140 - steps[i] / 2, y)
      g.lineTo(140 + steps[i] / 2, y)
      g.stroke()
    }
    g.font = '11px Helvetica, Arial, sans-serif'
    g.fillStyle = '#1f3b73'
    g.fillText('leads', 206, 74)
    g.fillText('reunioes', 206, 94)
    g.fillText('propostas', 206, 114)
    g.fillText('fechados', 206, 134)
    // Setas e circulado em vermelho
    g.strokeStyle = '#CC1B1B'
    g.lineWidth = 2
    g.beginPath()
    g.ellipse(80, 126, 28, 12, 0, 0, Math.PI * 2)
    g.stroke()
    g.font = 'bold 11px Helvetica, Arial, sans-serif'
    g.fillStyle = '#CC1B1B'
    g.fillText('conversao 32%', 44, 130)
    g.fillStyle = '#1B6B3A'
    g.fillText('follow-up D+1', 14, 150)
  })
  _board.wrapS = THREE.ClampToEdgeWrapping
  _board.wrapT = THREE.ClampToEdgeWrapping
  return _board
}

const POSTER_LINES: [string, string][] = [
  ['Sistema bem estruturado escala.', 'Improviso não escala.'],
  ['Reunião sem métrica', 'é terapia em grupo.'],
  ['Venda é consequência,', 'não pressão.'],
  ['Vendedor que só bate meta', 'quando o dono entra é figurante.'],
]

/** Pôster UNV (navy ou vermelho) com uma frase da marca. */
const _posters = new Map<number, THREE.CanvasTexture>()
export function posterTexture(i: number): THREE.CanvasTexture {
  const idx = ((i % POSTER_LINES.length) + POSTER_LINES.length) % POSTER_LINES.length
  const cached = _posters.get(idx)
  if (cached) return cached
  const t = canvasTex(192, 256, (g, w, h) => {
    const red = idx % 2 === 1
    g.fillStyle = red ? '#CC1B1B' : '#0D2B5E'
    g.fillRect(0, 0, w, h)
    g.fillStyle = red ? '#0D2B5E' : '#CC1B1B'
    g.fillRect(0, h - 22, w, 22)
    g.fillStyle = '#ffffff'
    g.font = 'bold 30px Helvetica, Arial, sans-serif'
    g.fillText('UNV', 16, 44)
    g.fillStyle = 'rgba(255,255,255,0.55)'
    g.fillRect(16, 54, 40, 3)
    const [a, b] = POSTER_LINES[idx]
    g.fillStyle = '#ffffff'
    g.font = 'bold 15px Helvetica, Arial, sans-serif'
    const wrap = (text: string, y: number) => {
      const words = text.split(' ')
      let line = ''
      let yy = y
      for (const wd of words) {
        const test = line ? `${line} ${wd}` : wd
        if (g.measureText(test).width > w - 32 && line) {
          g.fillText(line, 16, yy)
          line = wd
          yy += 20
        } else line = test
      }
      g.fillText(line, 16, yy)
      return yy + 20
    }
    const y2 = wrap(a, 110)
    g.fillStyle = red ? '#ffe3e3' : '#ffd166'
    wrap(b, y2 + 6)
    g.fillStyle = '#ffffff'
    g.font = '9px Helvetica, Arial, sans-serif'
    g.fillText('UNIVERSIDADE NACIONAL DE VENDAS', 14, h - 8)
  })
  t.wrapS = THREE.ClampToEdgeWrapping
  t.wrapT = THREE.ClampToEdgeWrapping
  _posters.set(idx, t)
  return t
}

/** Folha com alpha (pra plantas: vários planos com esta textura). */
let _leaf: THREE.CanvasTexture | null = null
export function leafTexture(): THREE.CanvasTexture {
  if (_leaf) return _leaf
  _leaf = canvasTex(64, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h)
    const grad = g.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, '#5fae63')
    grad.addColorStop(1, '#2d6b3a')
    g.fillStyle = grad
    g.beginPath()
    g.moveTo(w / 2, 2)
    g.bezierCurveTo(w - 2, h * 0.3, w - 4, h * 0.75, w / 2, h - 2)
    g.bezierCurveTo(4, h * 0.75, 2, h * 0.3, w / 2, 2)
    g.fill()
    g.strokeStyle = 'rgba(20,60,30,0.5)'
    g.lineWidth = 1.5
    g.beginPath()
    g.moveTo(w / 2, 4)
    g.lineTo(w / 2, h - 4)
    g.stroke()
    for (let i = 0; i < 6; i++) {
      const y = 20 + i * 16
      g.beginPath()
      g.moveTo(w / 2, y)
      g.lineTo(w / 2 + 18, y + 10)
      g.moveTo(w / 2, y)
      g.lineTo(w / 2 - 18, y + 10)
      g.stroke()
    }
  })
  _leaf.wrapS = THREE.ClampToEdgeWrapping
  _leaf.wrapT = THREE.ClampToEdgeWrapping
  return _leaf
}

/** Aço escovado (riscos horizontais finos). */
let _brushed: THREE.CanvasTexture | null = null
export function brushedMetalTexture(): THREE.CanvasTexture {
  if (_brushed) return _brushed
  _brushed = canvasTex(256, 256, (g, w, h) => {
    const rnd = mulberry(77)
    g.fillStyle = '#b8bdc5'
    g.fillRect(0, 0, w, h)
    for (let i = 0; i < 1400; i++) {
      const y = rnd() * h
      const x = rnd() * w
      const len = 20 + rnd() * 120
      const v = rnd()
      g.strokeStyle = v > 0.5 ? `rgba(255,255,255,${0.04 + rnd() * 0.1})` : `rgba(40,45,55,${0.04 + rnd() * 0.1})`
      g.lineWidth = 1
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(x + len, y)
      g.stroke()
    }
  })
  return _brushed
}

/** Cortina pregueada (listras verticais com sombra). */
let _curtain: THREE.CanvasTexture | null = null
export function curtainTexture(): THREE.CanvasTexture {
  if (_curtain) return _curtain
  _curtain = canvasTex(256, 64, (g, w, h) => {
    const pleat = 16
    for (let x = 0; x < w; x += pleat) {
      const grad = g.createLinearGradient(x, 0, x + pleat, 0)
      grad.addColorStop(0, '#4a0f14')
      grad.addColorStop(0.45, '#8c1d24')
      grad.addColorStop(0.6, '#a3262e')
      grad.addColorStop(1, '#3d0c10')
      g.fillStyle = grad
      g.fillRect(x, 0, pleat, h)
    }
  })
  _curtain.repeat.set(6, 1)
  return _curtain
}

/** Fachada de prédio da vista: grade de janelas. A mesma textura serve de
 * emissiveMap (janelas acesas à noite): color = cinza, emissive = âmbar. */
let _facade: { map: THREE.CanvasTexture; emissive: THREE.CanvasTexture } | null = null
export function cityFacadeTextures(): { map: THREE.CanvasTexture; emissive: THREE.CanvasTexture } {
  if (_facade) return _facade
  const rnd = mulberry(5)
  const lit: boolean[] = []
  const cols = 8
  const rows = 16
  for (let i = 0; i < cols * rows; i++) lit.push(rnd() > 0.55)
  const map = canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#8a929c'
    g.fillRect(0, 0, w, h)
    const cw = w / cols
    const rh = h / rows
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        g.fillStyle = lit[r * cols + c] ? '#b9c6d2' : '#5c6670'
        g.fillRect(c * cw + 3, r * rh + 3, cw - 6, rh - 6)
      }
    }
  })
  const emissive = canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#000000'
    g.fillRect(0, 0, w, h)
    const cw = w / cols
    const rh = h / rows
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!lit[r * cols + c]) continue
        g.fillStyle = rnd() > 0.3 ? '#ffd37a' : '#cfe3ff'
        g.fillRect(c * cw + 3, r * rh + 3, cw - 6, rh - 6)
      }
    }
  })
  _facade = { map, emissive }
  return _facade
}

/** Crachá do avatar: fundo navy arredondado, círculo com iniciais, nome e
 * cargo. Uma textura por nome+cargo (cache por chave). */
const _badges = new Map<string, THREE.CanvasTexture>()
export function badgeTexture(name: string, role: string, accent = '#FFD700'): THREE.CanvasTexture {
  const key = `${name}|${role}|${accent}`
  const cached = _badges.get(key)
  if (cached) return cached
  const t = canvasTex(512, 160, (g, w, h) => {
    g.clearRect(0, 0, w, h)
    const r = 34
    g.fillStyle = 'rgba(13,43,94,0.94)'
    g.beginPath()
    g.moveTo(r, 0)
    g.lineTo(w - r, 0)
    g.quadraticCurveTo(w, 0, w, r)
    g.lineTo(w, h - r)
    g.quadraticCurveTo(w, h, w - r, h)
    g.lineTo(r, h)
    g.quadraticCurveTo(0, h, 0, h - r)
    g.lineTo(0, r)
    g.quadraticCurveTo(0, 0, r, 0)
    g.closePath()
    g.fill()
    g.strokeStyle = accent
    g.lineWidth = 6
    g.stroke()
    // Foto genérica: círculo com iniciais
    const initials = name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('')
    g.fillStyle = '#CC1B1B'
    g.beginPath()
    g.arc(78, h / 2, 50, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#ffffff'
    g.font = 'bold 44px Helvetica, Arial, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(initials || '?', 78, h / 2 + 2)
    g.textAlign = 'left'
    g.fillStyle = '#ffffff'
    g.font = 'bold 46px Helvetica, Arial, sans-serif'
    let nm = name
    while (g.measureText(nm).width > w - 170 && nm.length > 3) nm = nm.slice(0, -2) + '…'
    g.fillText(nm, 146, role ? h / 2 - 22 : h / 2)
    if (role) {
      g.fillStyle = accent
      g.font = '28px Helvetica, Arial, sans-serif'
      let rl = role
      while (g.measureText(rl).width > w - 170 && rl.length > 3) rl = rl.slice(0, -2) + '…'
      g.fillText(rl, 146, h / 2 + 30)
    }
  })
  t.wrapS = THREE.ClampToEdgeWrapping
  t.wrapT = THREE.ClampToEdgeWrapping
  t.anisotropy = 8
  if (_badges.size > 200) _badges.clear()
  _badges.set(key, t)
  return t
}

/** Forro do teto: placas 60x60 com luminárias embutidas e grelhas de ar. */
let _ceiling: THREE.CanvasTexture | null = null
export function ceilingTexture(): THREE.CanvasTexture {
  if (_ceiling) return _ceiling
  _ceiling = canvasTex(256, 256, (g, w, h) => {
    const tile = 64
    g.fillStyle = '#e9e6df'
    g.fillRect(0, 0, w, h)
    g.strokeStyle = 'rgba(120,118,110,0.6)'
    g.lineWidth = 2
    for (let x = 0; x <= w; x += tile) {
      g.beginPath()
      g.moveTo(x, 0)
      g.lineTo(x, h)
      g.stroke()
    }
    for (let y = 0; y <= h; y += tile) {
      g.beginPath()
      g.moveTo(0, y)
      g.lineTo(w, y)
      g.stroke()
    }
    // Luminárias embutidas (placas brancas brilhantes)
    for (const [tx, ty] of [[0, 1], [2, 1], [1, 3], [3, 3]]) {
      g.fillStyle = '#fffaf0'
      g.fillRect(tx * tile + 6, ty * tile + 6, tile - 12, tile - 12)
      g.fillStyle = 'rgba(255,255,255,0.9)'
      g.fillRect(tx * tile + 10, ty * tile + 10, tile - 20, tile - 20)
    }
    // Grelhas de ar (listras)
    for (const [tx, ty] of [[3, 0], [0, 3]]) {
      g.fillStyle = '#c9c6bf'
      g.fillRect(tx * tile + 8, ty * tile + 8, tile - 16, tile - 16)
      g.strokeStyle = '#8e8b84'
      g.lineWidth = 1.5
      for (let i = 12; i < tile - 12; i += 6) {
        g.beginPath()
        g.moveTo(tx * tile + 8, ty * tile + i)
        g.lineTo(tx * tile + tile - 8, ty * tile + i)
        g.stroke()
      }
    }
  })
  return _ceiling
}
