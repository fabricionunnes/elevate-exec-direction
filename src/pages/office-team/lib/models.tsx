// Modelos 3D reais da mobília (Kenney Furniture Kit 2.0, CC0), servidos de
// public/office/models/kenney/*.glb. Aqui ficam: a lista de modelos, o
// preload do andar, o hook de carregamento, o ajuste de escala/offset
// (fitTo) e dois componentes de render: <Model> (clone por peça) e
// <InstancedModel> (uma InstancedMesh por primitiva pra repetição em massa).
//
// Unidade dos GLB: ~1 unidade = meio metro (cadeira 0.46, mesa 0.38 de
// altura; conferido lendo accessors[].min/max de cada arquivo). Origem na
// base, mas NÃO centrada no footprint (x de 0 a w, z de -d a 0 na maioria;
// plantas, TV, cabideiro e lixeira são centrados; tableCoffee e tableRound
// têm origem deslocada): fitTo devolve o offset que centra o modelo no x/z
// e põe a base no chão, pra posicionar igual à mobília procedural.
// Convenção do kit: a FRENTE do móvel é +z (gaveta da mesa, tela do
// monitor, assento do sofá); o encosto das cadeiras fica em -z.
//
// Medidas em unidades do glb (largura x altura x profundidade) dos que usamos:
//   desk 0.734 x 0.384 x 0.392        chairDesk 0.335 x 0.608 x 0.314 (assento 0.233)
//   chairCushion 0.20 x 0.46 x 0.20 (assento 0.24)   stoolBar 0.265 x 0.435 x 0.23
//   computerScreen 0.393 x 0.294 x 0.104   computerKeyboard 0.282 x 0.028 x 0.118
//   computerMouse 0.05 x 0.024 x 0.085     laptop 0.264 x 0.162 x 0.24
//   loungeSofa 0.98 x 0.46 x 0.41 (assento 0.23)   loungeDesignSofa 1.12 x 0.40 x 0.41
//   loungeChair 0.49 x 0.46 x 0.41    tableCoffee(Glass) 0.661 x 0.23 x 0.40
//   tableCross 0.852 x 0.347 x 0.447  tableRound 0.693 x 0.367 x 0.80 (base em y -0.27)
//   bookcaseOpen 0.40 x 0.88 x 0.25   bookcaseClosed 0.40 x 0.85 x 0.25
//   pottedPlant 0.212 x 0.654 x 0.241 plantSmall1/2/3 ~0.095 x 0.14 x 0.095
//   lampRoundFloor 0.152 x 0.86 x 0.176   lampSquareTable 0.12 x 0.29 x 0.12
//   televisionModern 0.685 x 0.455 x 0.128 (tela: x -0.334..0.334, y 0.078..0.446, z 0.021)
//   cabinetTelevision 0.80 x 0.31 x 0.25  trashcan 0.208 x 0.428 x 0.234
//   rugRound 0.92 x 0.01 x 0.92       rugRectangle 1.57 x 0.01 x 0.92
//   kitchenBar 0.43 x 0.42 x 0.21     kitchenBarEnd 0.102 x 0.42 x 0.21 (ponta redonda em -x)
//   kitchenCoffeeMachine 0.19 x 0.177 x 0.24   kitchenFridgeSmall 0.43 x 0.60 x 0.292
//   speaker 0.148 x 0.636 x 0.148     coatRackStanding 0.273 x 0.77 x 0.273
import { Component, Suspense, useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from 'react'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'

export const MODEL_BASE = '/office/models/kenney'

export const KENNEY_NAMES = [
  'desk', 'deskCorner', 'chairDesk', 'chairModernCushion', 'chairModernFrameCushion', 'chairCushion', 'chair', 'chairRounded',
  'computerScreen', 'computerKeyboard', 'computerMouse', 'laptop',
  'loungeSofa', 'loungeSofaLong', 'loungeSofaCorner', 'loungeChair', 'loungeChairRelax', 'loungeDesignSofa', 'loungeDesignChair',
  'tableCoffee', 'tableCoffeeGlass', 'tableRound', 'table', 'tableCross', 'tableGlass',
  'bookcaseOpen', 'bookcaseClosed', 'bookcaseClosedWide',
  'pottedPlant', 'plantSmall1', 'plantSmall2', 'plantSmall3',
  'lampRoundFloor', 'lampSquareCeiling', 'lampSquareTable', 'lampRoundTable',
  'televisionModern', 'trashcan', 'rugRectangle', 'rugRound', 'stoolBar',
  'kitchenBar', 'kitchenBarEnd', 'kitchenCoffeeMachine', 'kitchenFridgeSmall',
  'sideTable', 'speaker', 'speakerSmall', 'coatRackStanding', 'benchCushion', 'pillow', 'cabinetTelevision',
] as const
export type KenneyName = (typeof KENNEY_NAMES)[number]

export const MODEL_URLS = Object.fromEntries(KENNEY_NAMES.map((n) => [n, `${MODEL_BASE}/${n}.glb`])) as Record<KenneyName, string>

/** Layer das sombras de contato do ModernOffice: todo mesh de modelo entra
 * nela ao nascer (a varredura do ModernOffice roda antes do glb chegar). */
export const FURNITURE_LAYER = 2

/** Escala padrão (meio metro por unidade → metros). */
export const KENNEY_SCALE = 2

/** Modelos que a mobília do andar usa (preload ao entrar no escritório). */
export const FLOOR_MODELS: KenneyName[] = [
  'desk', 'chairDesk', 'chairCushion', 'computerScreen', 'computerKeyboard', 'computerMouse', 'laptop',
  'loungeSofa', 'loungeDesignSofa', 'loungeChair', 'tableCoffee', 'tableCoffeeGlass', 'tableCross', 'tableRound',
  'bookcaseOpen', 'bookcaseClosed', 'pottedPlant', 'plantSmall1', 'plantSmall2', 'plantSmall3',
  'lampRoundFloor', 'lampSquareTable', 'televisionModern', 'trashcan', 'rugRectangle', 'rugRound',
  'stoolBar', 'kitchenBar', 'kitchenBarEnd', 'kitchenCoffeeMachine', 'kitchenFridgeSmall', 'speaker', 'coatRackStanding',
  'cabinetTelevision',
]

let _preloaded = false
/** Dispara o download de todos os modelos do andar (uma vez por sessão). */
export function preloadFloorModels(): void {
  if (_preloaded) return
  _preloaded = true
  for (const n of FLOOR_MODELS) useGLTF.preload(MODEL_URLS[n], false)
}

/** Cena do glb (cacheada pelo drei; NUNCA renderizar direto, sempre clonar). */
export function useKenney(name: KenneyName): THREE.Group {
  const gltf = useGLTF(MODEL_URLS[name], false) as unknown as { scene: THREE.Group }
  return gltf.scene
}

// ── Bounding box e ajuste de escala ──────────────────────────────────────
const _boxes = new WeakMap<THREE.Object3D, THREE.Box3>()
/** Box3 do modelo em unidades do glb (calculado uma vez por cena). */
export function modelBox(scene: THREE.Object3D): THREE.Box3 {
  let b = _boxes.get(scene)
  if (!b) {
    scene.updateMatrixWorld(true)
    b = new THREE.Box3().setFromObject(scene)
    _boxes.set(scene, b)
  }
  return b
}

export type Fit = { w?: number; h?: number; d?: number }
export type Scale3 = [number, number, number]
export interface FitOptions {
  /** footprint alvo em metros: a escala é UNIFORME, a menor razão entre as dimensões dadas */
  fit?: Fit
  /** tamanho alvo em metros POR EIXO (escala não uniforme); eixo omitido usa KENNEY_SCALE */
  size?: Fit
  /** escala explícita (número = uniforme); ignora `fit` */
  scale?: number | Scale3
  /** multiplicador extra por eixo (ex.: esticar a mesa de reunião só na largura) */
  stretch?: Scale3
}
export interface FitResult {
  scale: Scale3
  /** translação que centra o modelo no x/z e põe a base (min y) no chão */
  offset: [number, number, number]
  /** tamanho final em metros */
  size: [number, number, number]
}

/** Escala + offset pro modelo caber no footprint pedido com a base no chão. */
export function fitTo(scene: THREE.Object3D, opts: FitOptions = {}): FitResult {
  const box = modelBox(scene)
  const size = new THREE.Vector3()
  box.getSize(size)
  let s: Scale3
  if (opts.scale != null) {
    s = typeof opts.scale === 'number' ? [opts.scale, opts.scale, opts.scale] : [...opts.scale]
  } else if (opts.size) {
    s = [
      opts.size.w && size.x > 0 ? opts.size.w / size.x : KENNEY_SCALE,
      opts.size.h && size.y > 0 ? opts.size.h / size.y : KENNEY_SCALE,
      opts.size.d && size.z > 0 ? opts.size.d / size.z : KENNEY_SCALE,
    ]
  } else if (opts.fit) {
    const ratios: number[] = []
    if (opts.fit.w && size.x > 0) ratios.push(opts.fit.w / size.x)
    if (opts.fit.h && size.y > 0) ratios.push(opts.fit.h / size.y)
    if (opts.fit.d && size.z > 0) ratios.push(opts.fit.d / size.z)
    const u = ratios.length ? Math.min(...ratios) : KENNEY_SCALE
    s = [u, u, u]
  } else {
    s = [KENNEY_SCALE, KENNEY_SCALE, KENNEY_SCALE]
  }
  if (opts.stretch) s = [s[0] * opts.stretch[0], s[1] * opts.stretch[1], s[2] * opts.stretch[2]]
  const cx = (box.min.x + box.max.x) / 2
  const cz = (box.min.z + box.max.z) / 2
  return {
    scale: s,
    offset: [-cx * s[0], -box.min.y * s[1], -cz * s[2]],
    size: [size.x * s[0], size.y * s[1], size.z * s[2]],
  }
}

// ── Materiais: tint por nome + override ──────────────────────────────────
// Nomes de material do kit (iguais em todos os glb): wood, woodDark, metal,
// metalDark, metalMedium, metalLight, carpet, carpetDarker, carpetBlue,
// carpetWhite, plant, lamp, glass. Tecido = carpet* (almofada, estofado,
// tapete): é o que recebe a cor da sala.
const TINT_RE = /^carpet/i
const DARKER_RE = /darker/i
const _tinted = new Map<string, THREE.Material>()
function tintedMaterial(base: THREE.Material, color: string): THREE.Material {
  const key = `${base.uuid}|${color}`
  let m = _tinted.get(key)
  if (!m) {
    m = base.clone()
    const std = m as THREE.MeshStandardMaterial
    if (std.color) {
      std.color.set(color)
      // segunda cor do tapete (desenho) fica um tom mais escuro que a base
      if (DARKER_RE.test(base.name)) std.color.multiplyScalar(0.72)
    }
    _tinted.set(key, m)
  }
  return m
}

/** Troca material por NOME do material do glb. Passe um objeto estável
 * (constante de módulo ou useMemo): a identidade entra nas dependências. */
export type MaterialOverrides = Partial<Record<string, THREE.Material>>
function resolveMaterial(mat: THREE.Material, tint?: string, overrides?: MaterialOverrides): THREE.Material {
  const o = overrides?.[mat.name]
  if (o) return o
  if (tint && TINT_RE.test(mat.name)) return tintedMaterial(mat, tint)
  return mat
}

// ── Painel de tela (monitor, notebook, TV) ───────────────────────────────
// O painel é a primitiva de material "metal" (2 triângulos). As UVs do kit
// são em escala de mundo (não servem pra textura): geramos UV 0..1 a partir
// do retângulo do painel, pra um override com `map` (tela de CRM) encaixar.
const SCREEN_PANEL: Partial<Record<KenneyName, string>> = {
  computerScreen: 'metal',
  laptop: 'metal',
  televisionModern: 'metal',
}
const _screenGeos = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>()
function screenGeometry(src: THREE.BufferGeometry): THREE.BufferGeometry {
  let g = _screenGeos.get(src)
  if (g) return g
  g = src.clone()
  const pos = g.getAttribute('position')
  const index = g.getIndex()
  const used: number[] = []
  if (index) for (let i = 0; i < index.count; i++) used.push(index.getX(i))
  else for (let i = 0; i < pos.count; i++) used.push(i)
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const i of used) {
    minX = Math.min(minX, pos.getX(i))
    maxX = Math.max(maxX, pos.getX(i))
    minY = Math.min(minY, pos.getY(i))
    maxY = Math.max(maxY, pos.getY(i))
  }
  const uv = new Float32Array(pos.count * 2)
  const w = maxX - minX || 1
  const h = maxY - minY || 1
  for (const i of used) {
    uv[i * 2] = (pos.getX(i) - minX) / w
    uv[i * 2 + 1] = (pos.getY(i) - minY) / h
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  _screenGeos.set(src, g)
  return g
}

// ── Corte: tira o que fica abaixo de uma altura (ex.: o pé da TV) ────────
const _cuts = new Map<string, THREE.BufferGeometry>()
/** Mesma geometria sem os triângulos que têm algum vértice abaixo de `minY`
 * (unidades do glb). TV de parede = televisionModern sem o pé de mesa. */
function cutGeometry(src: THREE.BufferGeometry, minY: number): THREE.BufferGeometry {
  const key = `${src.uuid}|${minY}`
  const hit = _cuts.get(key)
  if (hit) return hit
  const pos = src.getAttribute('position')
  const index = src.getIndex()
  let out = src
  if (index) {
    const keep: number[] = []
    for (let i = 0; i + 2 < index.count; i += 3) {
      const a = index.getX(i)
      const b = index.getX(i + 1)
      const c = index.getX(i + 2)
      if (pos.getY(a) < minY || pos.getY(b) < minY || pos.getY(c) < minY) continue
      keep.push(a, b, c)
    }
    if (keep.length < index.count) {
      out = src.clone()
      out.setIndex(keep)
      out.boundingBox = null
      out.boundingSphere = null
    }
  }
  _cuts.set(key, out)
  return out
}

interface Prim {
  geometry: THREE.BufferGeometry
  material: THREE.Material
  /** matriz do mesh dentro da cena do glb */
  local: THREE.Matrix4
}

/** Geometria + material finais de um mesh do glb (tint, override, UV de tela e corte). */
function resolvePrim(name: KenneyName, mesh: THREE.Mesh, tint?: string, overrides?: MaterialOverrides, cutBelow?: number) {
  const base = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.Material
  let geometry = SCREEN_PANEL[name] === base.name ? screenGeometry(mesh.geometry) : mesh.geometry
  if (cutBelow != null) geometry = cutGeometry(geometry, cutBelow)
  return { geometry, material: resolveMaterial(base, tint, overrides) }
}

// ── <Model>: clone posicionado de um glb ─────────────────────────────────
type GroupProps = JSX.IntrinsicElements['group']
export interface ModelProps extends Omit<GroupProps, 'scale' | 'rotation' | 'position' | 'children'>, FitOptions {
  name: KenneyName
  position?: [number, number, number]
  /** yaw em radianos (em volta de y) ou euler completo */
  rotation?: number | [number, number, number]
  /** cor pros materiais de tecido (almofada/estofado/tapete) */
  tint?: string
  /** troca material por nome (ex.: { lamp: materialEmissivo }) */
  materials?: MaterialOverrides
  castShadow?: boolean
  receiveShadow?: boolean
  /** false = sem centrar no x/z nem assentar no chão (usa a origem do glb) */
  center?: boolean
  /** descarta os triângulos com vértice abaixo desta altura (unidades do glb;
   * só vale pra modelo de um mesh só sem transformação, como a TV) */
  cutBelow?: number
  /** filhos renderizados no espaço LOCAL do modelo (unidades do glb, antes da escala) */
  children?: ReactNode
}

/** Uma peça de mobília: clona a cena (SkeletonUtils.clone), aplica tint/override
 * de material, sombras e a layer das sombras de contato; `fit`/`size`/`scale`/
 * `stretch` dimensionam e o offset centra no x/z com a base no chão. Eventos
 * (onClick, onPointerOver...) vão no grupo de fora, como num <group> comum. */
export function Model({
  name,
  position = [0, 0, 0],
  rotation = 0,
  fit,
  size,
  scale,
  stretch,
  tint,
  materials,
  castShadow = true,
  receiveShadow = false,
  center = true,
  cutBelow,
  children,
  ...rest
}: ModelProps) {
  const scene = useKenney(name)
  const sx = Array.isArray(scale) ? scale[0] : scale
  const sy = Array.isArray(scale) ? scale[1] : scale
  const sz = Array.isArray(scale) ? scale[2] : scale
  const fitRes = useMemo(
    () => fitTo(scene, { fit, size, scale, stretch }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scene, fit?.w, fit?.h, fit?.d, size?.w, size?.h, size?.d, sx, sy, sz, stretch?.[0], stretch?.[1], stretch?.[2]]
  )
  const obj = useMemo(() => {
    const c = skeletonClone(scene) as THREE.Group
    c.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      const r = resolvePrim(name, mesh, tint, materials, cutBelow)
      mesh.geometry = r.geometry
      mesh.material = r.material
      mesh.castShadow = castShadow
      mesh.receiveShadow = receiveShadow
      mesh.layers.enable(FURNITURE_LAYER)
    })
    return c
  }, [scene, name, tint, materials, castShadow, receiveShadow, cutBelow])
  const rot: [number, number, number] = typeof rotation === 'number' ? [0, rotation, 0] : rotation
  return (
    <group position={position} rotation={rot} {...rest}>
      <group position={center ? fitRes.offset : [0, 0, 0]} scale={fitRes.scale}>
        <primitive object={obj} />
        {children}
      </group>
    </group>
  )
}

// ── <InstancedModel>: N cópias em poucas draw calls ──────────────────────
export interface InstanceItem {
  x: number
  z: number
  y?: number
  /** yaw em radianos */
  rot?: number
  /** multiplicador uniforme de escala desta cópia (variação de tamanho) */
  s?: number
}
export interface InstancedModelProps extends FitOptions {
  name: KenneyName
  /** passe um array estável (useMemo): a identidade dispara o reposicionamento */
  items: InstanceItem[]
  tint?: string
  materials?: MaterialOverrides
  castShadow?: boolean
  receiveShadow?: boolean
  /** clique numa instância (índice em `items`) */
  onClickItem?: (index: number, e: ThreeEvent<MouseEvent>) => void
  /** cursor de mão ao passar por cima */
  pointer?: boolean
}

/** Uma InstancedMesh por primitiva do modelo (cadeira = 2 draw calls pra
 * 54 poltronas). Mesma convenção de fit/offset do <Model>: cada item é o
 * CENTRO do footprint no chão, com yaw em volta de y. */
export function InstancedModel({
  name,
  items,
  fit,
  size,
  scale,
  stretch,
  tint,
  materials,
  castShadow = true,
  receiveShadow = false,
  onClickItem,
  pointer = false,
}: InstancedModelProps) {
  const scene = useKenney(name)
  const sx = Array.isArray(scale) ? scale[0] : scale
  const sy = Array.isArray(scale) ? scale[1] : scale
  const sz = Array.isArray(scale) ? scale[2] : scale
  const fitRes = useMemo(
    () => fitTo(scene, { fit, size, scale, stretch }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scene, fit?.w, fit?.h, fit?.d, size?.w, size?.h, size?.d, sx, sy, sz, stretch?.[0], stretch?.[1], stretch?.[2]]
  )
  const prims = useMemo<Prim[]>(() => {
    scene.updateMatrixWorld(true)
    const out: Prim[] = []
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      out.push({ ...resolvePrim(name, mesh, tint, materials), local: mesh.matrixWorld.clone() })
    })
    return out
  }, [scene, name, tint, materials])
  const refs = useRef<(THREE.InstancedMesh | null)[]>([])
  const n = items.length

  useEffect(() => {
    const place = new THREE.Matrix4()
    const fitM = new THREE.Matrix4()
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const axis = new THREE.Vector3(0, 1, 0)
    const scl = new THREE.Vector3(1, 1, 1)
    const pos = new THREE.Vector3()
    fitM.compose(new THREE.Vector3(...fitRes.offset), new THREE.Quaternion(), new THREE.Vector3(...fitRes.scale))
    prims.forEach((p, pi) => {
      const mesh = refs.current[pi]
      if (!mesh) return
      items.forEach((it, i) => {
        q.setFromAxisAngle(axis, it.rot ?? 0)
        pos.set(it.x, it.y ?? 0, it.z)
        const s = it.s ?? 1
        scl.set(s, s, s)
        place.compose(pos, q, scl)
        m.copy(place).multiply(fitM).multiply(p.local)
        mesh.setMatrixAt(i, m)
      })
      mesh.count = n
      mesh.instanceMatrix.needsUpdate = true
      // esfera envolvente de todas as cópias: culling e raycast (clique) dependem dela
      mesh.computeBoundingBox()
      mesh.computeBoundingSphere()
      mesh.layers.enable(FURNITURE_LAYER)
    })
  }, [items, prims, fitRes, n])

  const onClick = onClickItem
    ? (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation()
        if (e.delta > 6) return
        if (e.instanceId == null) return
        onClickItem(e.instanceId, e)
      }
    : undefined
  const hover = pointer
    ? {
        onPointerOver: () => (document.body.style.cursor = 'pointer'),
        onPointerOut: () => (document.body.style.cursor = 'default'),
      }
    : {}
  if (n === 0) return null
  return (
    <group>
      {prims.map((p, i) => (
        <instancedMesh
          key={`${name}-${i}-${n}-${p.material.uuid}`}
          ref={(el) => {
            refs.current[i] = el
          }}
          args={[p.geometry, p.material, n]}
          castShadow={castShadow}
          receiveShadow={receiveShadow}
          onClick={onClick}
          {...hover}
        />
      ))}
    </group>
  )
}

// ── Fallback: Suspense + erro → mobília procedural ───────────────────────
let _warned = false
class ModelErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode; onError?: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    // um aviso só por sessão (cada peça tem a própria barreira)
    if (!_warned) {
      _warned = true
      console.warn('[office] modelo 3D indisponível, usando a mobília procedural:', error)
    }
    this.props.onError?.()
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/** Enquanto o glb carrega (Suspense) ou se falhar (404, rede, parse), renderiza
 * o fallback = a peça procedural. Nunca fica buraco e nunca trava a cena. */
export function Modeled({ fallback, children }: { fallback: ReactNode; children: ReactNode }) {
  return (
    <ModelErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </ModelErrorBoundary>
  )
}

// ── Prontidão: quando todos os modelos do andar resolveram (ok ou erro) ──
const _settled = new Set<KenneyName>()
const _subs = new Set<() => void>()
let _ready = false
let _readyTimer: ReturnType<typeof setTimeout> | null = null
function markSettled(name: KenneyName) {
  if (_settled.has(name)) return
  _settled.add(name)
  if (_settled.size >= FLOOR_MODELS.length && !_readyTimer && !_ready) {
    // folga pros <Model> que estavam suspensos montarem antes de quem depende
    // disso (sombras de contato estáticas) recalcular
    _readyTimer = setTimeout(() => {
      _ready = true
      _subs.forEach((f) => f())
    }, 400)
  }
}
function subscribe(cb: () => void) {
  _subs.add(cb)
  return () => {
    _subs.delete(cb)
  }
}
function snapshot(): boolean {
  return _ready
}
/** true quando todos os modelos do andar já resolveram (quem usa: as sombras
 * de contato estáticas, que precisam ser recalculadas com a mobília real). */
export function useModelsReady(): boolean {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}

function Probe({ name }: { name: KenneyName }) {
  useKenney(name)
  useEffect(() => markSettled(name), [name])
  return null
}

/** Dispara o preload e marca cada modelo como resolvido (sucesso ou erro).
 * Não renderiza nada. Monte UMA vez dentro do Canvas. */
export function ModelsProbe() {
  useEffect(() => preloadFloorModels(), [])
  return (
    <>
      {FLOOR_MODELS.map((n) => (
        <ModelErrorBoundary key={n} fallback={null} onError={() => markSettled(n)}>
          <Suspense fallback={null}>
            <Probe name={n} />
          </Suspense>
        </ModelErrorBoundary>
      ))}
    </>
  )
}
