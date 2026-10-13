// Crachá do avatar (nome + cargo, fundo navy arredondado, "foto" com as
// iniciais) e indicador de fala: ondas acima do crachá que pulsam com o
// nível de voz do microfone (ou piscam quando o mic está aberto e não dá
// pra medir). Um plano com textura por pessoa = 1 draw call, sem Text SDF.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { badgeTexture } from '../lib/textures'
import { voiceLevel } from '../lib/voiceLevel'

export default function NameBadge({
  name,
  role,
  accent = '#FFD700',
  y = 2.12,
  micOn = false,
  stream = null,
}: {
  name: string
  role?: string
  /** cor da borda/cargo (dourado = jogador local, branco = outros) */
  accent?: string
  y?: number
  /** microfone aberto: habilita o indicador de fala */
  micOn?: boolean
  /** stream de áudio dessa pessoa (local ou remoto) pra medir o nível */
  stream?: MediaStream | null
}) {
  const tex = useMemo(() => badgeTexture(name, role ?? '', accent), [name, role, accent])
  const w = 1.5
  const h = w * (160 / 512)
  const wavesRef = useRef<THREE.Group>(null!)
  const levelRef = useRef(0)
  const arcRefs = useRef<(THREE.Mesh | null)[]>([])

  useFrame(({ clock }) => {
    const g = wavesRef.current
    if (!g) return
    if (!micOn) {
      g.visible = false
      levelRef.current = 0
      return
    }
    const raw = stream ? voiceLevel(stream) : 0
    // Sem stream mensurável: pulso suave só pra sinalizar "mic aberto"
    const target = stream ? raw : 0.25 + Math.sin(clock.getElapsedTime() * 3) * 0.15
    levelRef.current += (target - levelRef.current) * (target > levelRef.current ? 0.5 : 0.12)
    const lv = levelRef.current
    g.visible = lv > 0.04
    const t = clock.getElapsedTime()
    arcRefs.current.forEach((mesh, i) => {
      if (!mesh) return
      const s = 0.7 + lv * 0.6 + Math.sin(t * 9 + i * 1.3) * lv * 0.12
      mesh.scale.setScalar(s)
      const mat = mesh.material as THREE.MeshBasicMaterial
      mat.opacity = Math.min(1, 0.25 + lv * 1.2 - i * 0.15)
    })
  })

  return (
    <Billboard position={[0, y, 0]} follow={true}>
      <mesh renderOrder={5}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      {/* Ondas de voz: três arcos concêntricos que crescem com o nível */}
      <group ref={wavesRef} position={[0, h / 2 + 0.2, 0]} visible={false}>
        {[0.1, 0.17, 0.24].map((r, i) => (
          <mesh
            key={r}
            ref={(el) => {
              arcRefs.current[i] = el
            }}
            renderOrder={6}
          >
            <ringGeometry args={[r, r + 0.035, 20, 1, Math.PI * 0.2, Math.PI * 0.6]} />
            <meshBasicMaterial color="#4CAF50" transparent opacity={0.6} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
          </mesh>
        ))}
        <mesh position={[0, -0.02, 0]} renderOrder={6}>
          <circleGeometry args={[0.045, 12]} />
          <meshBasicMaterial color="#4CAF50" toneMapped={false} depthWrite={false} />
        </mesh>
      </group>
    </Billboard>
  )
}
