// Projeta a tela compartilhada no telão 3D da sala onde o apresentador está
// (salas de reunião e de setor). Quem está na sala vê a apresentação "na
// parede"; pra ler detalhe fino continua existindo o modo reunião ampliado.
import { useEffect, useMemo, useState } from 'react'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import { useTeamStore } from '../store/useTeamStore'
import { roomAt, OfficeRoom } from '../lib/rooms'

const TV_W = 3.6
const TV_H = 1.76
const TV_Y = 1.85

function VideoScreen({ room, stream, presenterName }: { room: OfficeRoom; stream: MediaStream; presenterName: string }) {
  const [texture, setTexture] = useState<THREE.VideoTexture | null>(null)

  useEffect(() => {
    const video = document.createElement('video')
    video.srcObject = stream
    video.muted = true
    video.playsInline = true
    video.autoplay = true
    void video.play().catch(() => undefined)
    const tex = new THREE.VideoTexture(video)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.minFilter = THREE.LinearFilter
    setTexture(tex)
    return () => {
      tex.dispose()
      video.srcObject = null
      setTexture(null)
    }
  }, [stream])

  if (!texture) return null

  const z = room.z - room.depth / 2 + 0.42 // à frente do telão de dados (cobre)
  return (
    <group position={[room.x, TV_Y, z]}>
      {/* Moldura "modo apresentação" */}
      <mesh position={[0, 0, -0.03]}>
        <boxGeometry args={[TV_W + 0.18, TV_H + 0.18, 0.06]} />
        <meshStandardMaterial color="#0d0f13" metalness={0.4} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0, 0.003]}>
        <planeGeometry args={[TV_W, TV_H]} />
        <meshStandardMaterial map={texture} emissiveMap={texture} emissive="#ffffff" emissiveIntensity={0.7} toneMapped={false} />
      </mesh>
      <Billboard position={[0, -TV_H / 2 - 0.28, 0.1]} follow>
        <Text fontSize={0.14} color="#FFD700" outlineWidth={0.012} outlineColor="#000000" anchorX="center">
          🖥️ {presenterName} está apresentando
        </Text>
      </Billboard>
    </group>
  )
}

export default function ScreenShareTvs() {
  const rooms = useTeamStore((s) => s.rooms)
  const remotePlayers = useTeamStore((s) => s.remotePlayers)
  const me = useTeamStore((s) => s.me)
  const call = useTeamStore((s) => s.call)
  const remoteStreams = useTeamStore((s) => s.call.remoteStreams)
  const playerPosition = useTeamStore((s) => s.playerPosition)

  // Um apresentador por sala (meeting/sector): eu (preview local) ou um remoto
  const byRoom = useMemo(() => {
    const out = new Map<string, { room: OfficeRoom; stream: MediaStream; name: string }>()
    const tryAdd = (x: number, z: number, stream: MediaStream | null, name: string) => {
      if (!stream) return
      const room = roomAt(x, z, rooms)
      if (!room || (room.roomType !== 'meeting' && room.roomType !== 'sector')) return
      if (!out.has(room.id)) out.set(room.id, { room, stream, name })
    }
    if (me && call.screenOn) tryAdd(playerPosition[0], playerPosition[2], call.localStream, me.name)
    for (const p of Object.values(remotePlayers)) {
      if (p.screenOn) tryAdd(p.position[0], p.position[2], remoteStreams[p.id] ?? null, p.name)
    }
    return out
  }, [rooms, remotePlayers, me, call.screenOn, call.localStream, remoteStreams, playerPosition])

  return (
    <>
      {[...byRoom.values()].map(({ room, stream, name }) => (
        <VideoScreen key={room.id} room={room} stream={stream} presenterName={name} />
      ))}
    </>
  )
}
