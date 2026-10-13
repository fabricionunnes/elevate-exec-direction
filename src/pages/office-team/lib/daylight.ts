// Hora real do dia → paleta de céu, sol, névoa e "janelas acesas" da vista.
// Keyframes por hora local, interpolados de forma cíclica. Usado pelo céu
// (Skyline), pelas luzes da cena (SceneLights) e pela névoa.
import * as THREE from 'three'

export interface Daylight {
  skyTop: THREE.Color
  skyHorizon: THREE.Color
  ground: THREE.Color
  fog: THREE.Color
  sun: THREE.Color
  sunIntensity: number
  ambient: number
  hemiSky: THREE.Color
  hemiGround: THREE.Color
  /** 0 = dia (janelas apagadas), 1 = noite (janelas acesas) */
  windowsLit: number
  exposure: number
  /** nome da fase (pra debug/HUD): manhã, dia, tarde, noite */
  phase: 'manhã' | 'dia' | 'tarde' | 'noite'
}

interface Key {
  h: number
  skyTop: string
  skyHorizon: string
  ground: string
  fog: string
  sun: string
  sunIntensity: number
  ambient: number
  hemiSky: string
  hemiGround: string
  windowsLit: number
  exposure: number
}

const KEYS: Key[] = [
  { h: 0, skyTop: '#070b1c', skyHorizon: '#1c2440', ground: '#0f1118', fog: '#1a2033', sun: '#7a8cc4', sunIntensity: 0.35, ambient: 0.55, hemiSky: '#3a4670', hemiGround: '#15161c', windowsLit: 1, exposure: 1.0 },
  { h: 5, skyTop: '#0c1430', skyHorizon: '#3a3a5c', ground: '#15171f', fog: '#2a2d44', sun: '#9aa6d0', sunIntensity: 0.45, ambient: 0.6, hemiSky: '#4a5280', hemiGround: '#1a1b22', windowsLit: 0.9, exposure: 1.02 },
  { h: 6.5, skyTop: '#4674b8', skyHorizon: '#ffcf9e', ground: '#5a5a62', fog: '#d9c3ad', sun: '#ffd2a0', sunIntensity: 1.2, ambient: 0.8, hemiSky: '#ffe0c0', hemiGround: '#3a3630', windowsLit: 0.35, exposure: 1.08 },
  { h: 9, skyTop: '#3d8de0', skyHorizon: '#cfe4f7', ground: '#7d8288', fog: '#9fb0c2', sun: '#fff3dd', sunIntensity: 1.9, ambient: 0.9, hemiSky: '#ffeed8', hemiGround: '#2a2e3a', windowsLit: 0, exposure: 1.12 },
  { h: 14, skyTop: '#3485dc', skyHorizon: '#d6e8f8', ground: '#80858b', fog: '#a4b4c5', sun: '#fff6e6', sunIntensity: 2.0, ambient: 0.92, hemiSky: '#fff2e0', hemiGround: '#2a2e3a', windowsLit: 0, exposure: 1.12 },
  { h: 17, skyTop: '#4a74b8', skyHorizon: '#ffb783', ground: '#6e6a66', fog: '#c9a890', sun: '#ffc48a', sunIntensity: 1.4, ambient: 0.8, hemiSky: '#ffd9b8', hemiGround: '#2e2a28', windowsLit: 0.3, exposure: 1.08 },
  { h: 18.5, skyTop: '#232c5c', skyHorizon: '#ff7d55', ground: '#3a3236', fog: '#6b4a55', sun: '#ff9a5c', sunIntensity: 0.8, ambient: 0.7, hemiSky: '#9a6c80', hemiGround: '#1f1b22', windowsLit: 0.7, exposure: 1.04 },
  { h: 20, skyTop: '#090e26', skyHorizon: '#243054', ground: '#121420', fog: '#1e2438', sun: '#7a8cc4', sunIntensity: 0.4, ambient: 0.58, hemiSky: '#3a4670', hemiGround: '#15161c', windowsLit: 1, exposure: 1.0 },
  { h: 24, skyTop: '#070b1c', skyHorizon: '#1c2440', ground: '#0f1118', fog: '#1a2033', sun: '#7a8cc4', sunIntensity: 0.35, ambient: 0.55, hemiSky: '#3a4670', hemiGround: '#15161c', windowsLit: 1, exposure: 1.0 },
]

const c = (hex: string) => new THREE.Color(hex)
const mixC = (a: string, b: string, t: number) => c(a).lerp(c(b), t)
const mixN = (a: number, b: number, t: number) => a + (b - a) * t

/** Paleta pra uma hora decimal (0..24). */
export function daylightAt(hour: number): Daylight {
  const h = ((hour % 24) + 24) % 24
  let i = 0
  while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++
  const a = KEYS[i]
  const b = KEYS[i + 1]
  const span = b.h - a.h
  // Suaviza a transição (ease in/out) pra não ter "degrau" de cor
  const raw = span > 0 ? (h - a.h) / span : 0
  const t = raw * raw * (3 - 2 * raw)
  const phase: Daylight['phase'] = h < 5.5 || h >= 19.5 ? 'noite' : h < 10 ? 'manhã' : h < 16.5 ? 'dia' : 'tarde'
  return {
    skyTop: mixC(a.skyTop, b.skyTop, t),
    skyHorizon: mixC(a.skyHorizon, b.skyHorizon, t),
    ground: mixC(a.ground, b.ground, t),
    fog: mixC(a.fog, b.fog, t),
    sun: mixC(a.sun, b.sun, t),
    sunIntensity: mixN(a.sunIntensity, b.sunIntensity, t),
    ambient: mixN(a.ambient, b.ambient, t),
    hemiSky: mixC(a.hemiSky, b.hemiSky, t),
    hemiGround: mixC(a.hemiGround, b.hemiGround, t),
    windowsLit: mixN(a.windowsLit, b.windowsLit, t),
    exposure: mixN(a.exposure, b.exposure, t),
    phase,
  }
}

/** Hora local decimal agora (ex.: 14.5 = 14h30). */
export function currentHour(): number {
  const d = new Date()
  return d.getHours() + d.getMinutes() / 60
}
