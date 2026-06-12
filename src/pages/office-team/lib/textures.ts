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
