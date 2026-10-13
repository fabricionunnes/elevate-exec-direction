// Qualidade gráfica do UNV Office (fase 3, visual). Dois níveis:
//   alto  = sombra 2048, ContactShadows, todas as luminárias, vidro com reflexo
//   medio = sombra 1024, sem ContactShadows, metade das luminárias e das
//           luzes pontuais, sem reflexo no piso
// Escolha automática na primeira abertura (máquina fraca ou celular → médio),
// persistida em localStorage; o HUD tem o botão "Gráficos: alto/médio".
export type GraphicsLevel = 'alto' | 'medio'

const KEY = 'unv-office-graphics'

function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (navigator.maxTouchPoints ?? 0) > 2
}

/** Nível salvo; se não houver, decide pela máquina. */
export function initialGraphics(): GraphicsLevel {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'alto' || saved === 'medio') return saved
  } catch { /* storage bloqueado */ }
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency ?? 8 : 8
  return cores < 6 || isMobile() ? 'medio' : 'alto'
}

/** A pessoa já escolheu o nível à mão? (aí a queda automática não mexe) */
export function hasSavedGraphics(): boolean {
  try {
    const saved = localStorage.getItem(KEY)
    return saved === 'alto' || saved === 'medio'
  } catch {
    return false
  }
}

export function persistGraphics(level: GraphicsLevel): void {
  try {
    localStorage.setItem(KEY, level)
  } catch { /* storage bloqueado */ }
}

/** Parâmetros derivados do nível (uma fonte só pra cena inteira). */
export function graphicsParams(level: GraphicsLevel) {
  const high = level === 'alto'
  return {
    high,
    shadowMapSize: high ? 2048 : 1024,
    contactShadows: high,
    /** fração das luminárias de teto renderizadas (1 = todas) */
    lampFraction: high ? 1 : 0.5,
    /** máximo de pointLights por andar (além da direcional e dos spots do palco) */
    maxPointLights: high ? 6 : 3,
    /** reflexo do piso (roughness baixa + envMap) */
    floorRoughness: high ? 0.35 : 0.55,
    floorEnvIntensity: high ? 0.9 : 0.3,
    /** folhas por planta (planos com alpha) */
    leavesPerPlant: high ? 10 : 6,
  }
}

export const GRAPHICS_LABEL: Record<GraphicsLevel, string> = { alto: 'alto', medio: 'médio' }
