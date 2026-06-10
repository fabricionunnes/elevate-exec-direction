// Escritório UNV multiplayer — usuários reais do Nexus num escritório 3D
// moderno (salas por setor, reuniões, salas privadas), com presença em tempo
// real, chat de texto, áudio/vídeo espacial (WebRTC) e avatares humanos
// personalizáveis. Salas vêm do banco (office_team_rooms).
import { Suspense, useEffect, useRef, useState, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { supabase } from '@/integrations/supabase/client'
import ModernOffice from './components/ModernOffice'
import LocalPlayer from './components/LocalPlayer'
import RemotePlayer from './components/RemotePlayer'
import TeamChatPanel from './components/TeamChatPanel'
import CallDock from './components/CallDock'
import TeamHUD from './components/TeamHUD'
import RoomControls from './components/RoomControls'
import AvatarEditor from './components/AvatarEditor'
import MarceloNpc from './components/MarceloNpc'
import MarceloChatPanel from './components/MarceloChatPanel'
import {
  useTeamStore,
  avatarColorsFor,
  TeamProfile,
  AvatarConfig,
  DEFAULT_AVATAR,
} from './store/useTeamStore'
import { TeamRealtime } from './lib/realtime'
import { CallManager } from './lib/webrtc'
import { ensurePersonalRoom, roomAt, isEffectivelyLocked } from './lib/rooms'

function SceneLights() {
  return (
    <>
      <ambientLight intensity={1.35} color="#ffffff" />
      <directionalLight
        position={[8, 22, 10]}
        intensity={1.7}
        color="#fff8e8"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-38}
        shadow-camera-right={38}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-bias={-0.001}
      />
      <directionalLight position={[-10, 14, -8]} intensity={0.7} color="#f0f4ff" />
      <hemisphereLight args={['#fff3e0', '#202434', 0.45]} />
    </>
  )
}

function LoadingScreen({ label = 'Carregando escritório...' }: { label?: string }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#0a0a14',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        color: '#fff',
        zIndex: 999,
      }}
    >
      <div style={{ fontSize: '48px' }}>🏢</div>
      <div style={{ fontSize: '24px', fontWeight: 800 }}>
        UNV <span style={{ color: '#FFD700' }}>Office</span>
      </div>
      <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>{label}</div>
    </div>
  )
}

function RemotePlayers() {
  const remotePlayers = useTeamStore((s) => s.remotePlayers)
  const rooms = useTeamStore((s) => s.rooms)
  const myRoomId = useTeamStore((s) => s.myRoomId)
  const me = useTeamStore((s) => s.me)

  // Privacidade: quem está numa sala trancada só é visível pra quem
  // está DENTRO da mesma sala (o áudio já segue a mesma regra)
  const onlineIds = new Set(Object.keys(remotePlayers))
  if (me) onlineIds.add(me.id)

  const visible = Object.values(remotePlayers).filter((p) => {
    const room = roomAt(p.position[0], p.position[2], rooms)
    if (room && room.id !== myRoomId && isEffectivelyLocked(room, onlineIds)) return false
    return true
  })

  return (
    <>
      {visible.map((p) => (
        <RemotePlayer key={p.id} player={p} />
      ))}
    </>
  )
}

/** Resolve o perfil exibido: staff → office_user_avatars → metadata/email. */
async function loadProfile(): Promise<TeamProfile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  let name: string | null = null

  const { data: staff } = await supabase
    .from('onboarding_staff')
    .select('name, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()
  if (staff) {
    name = (staff as { name: string | null }).name
  }
  const isActiveStaff = !!staff

  if (!name) {
    const { data: avatar } = await supabase
      .from('office_user_avatars' as never)
      .select('display_name')
      .eq('user_id', user.id)
      .maybeSingle()
    name = (avatar as { display_name?: string } | null)?.display_name ?? null
  }

  if (!name) {
    const meta = user.user_metadata as Record<string, unknown> | null
    name =
      (meta?.full_name as string | undefined) ||
      (meta?.name as string | undefined) ||
      user.email?.split('@')[0] ||
      'Usuário'
  }

  const colors = avatarColorsFor(user.id)

  // Avatar personalizado + cargo + última posição salva (se existirem)
  let avatar: AvatarConfig = { ...DEFAULT_AVATAR, shirt: colors.color, pants: colors.pantsColor }
  let spawn: [number, number, number] | undefined
  let role = '' // cargo exibido embaixo do nome (office_team_avatars.title)
  let personalRoom = true
  const { data: saved } = await supabase
    .from('office_team_avatars' as never)
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()
  if (saved) {
    const s = saved as unknown as {
      skin_color: string
      hair_style: AvatarConfig['hairStyle']
      hair_color: string
      shirt_color: string
      pants_color: string
      last_x: number | string | null
      last_z: number | string | null
      last_rot: number | string | null
      title: string | null
      personal_room: boolean | null
    }
    avatar = {
      skin: s.skin_color,
      hairStyle: s.hair_style,
      hairColor: s.hair_color,
      shirt: s.shirt_color,
      pants: s.pants_color,
    }
    if (s.last_x != null && s.last_z != null) {
      spawn = [Number(s.last_x), Number(s.last_z), Number(s.last_rot ?? 0)]
    }
    role = s.title ?? ''
    personalRoom = s.personal_room !== false
  }

  return {
    id: user.id,
    name,
    role,
    ...colors,
    avatar,
    spawn,
    canHavePersonalRoom: isActiveStaff && personalRoom,
  }
}

export default function TeamOfficePage() {
  const me = useTeamStore((s) => s.me)
  const setMe = useTeamStore((s) => s.setMe)
  const rooms = useTeamStore((s) => s.rooms)
  const [authError, setAuthError] = useState(false)
  const personalRoomChecked = useRef(false)

  useEffect(() => {
    let cancelled = false
    loadProfile().then((profile) => {
      if (cancelled) return
      if (profile) setMe(profile)
      else setAuthError(true)
    })
    return () => {
      cancelled = true
    }
  }, [setMe])

  const managers = useMemo(() => {
    if (!me) return null
    const realtime = new TeamRealtime(me)
    const callManager = new CallManager(me.id, realtime)
    return { realtime, callManager }
  }, [me])

  useEffect(() => {
    if (!managers) return
    managers.realtime.connect()
    return () => {
      managers.callManager.destroy()
      managers.realtime.disconnect()
      useTeamStore.getState().setRemotePlayers({})
    }
  }, [managers])

  // Garante a sala pessoal do usuário (uma vez, depois que as salas carregam)
  useEffect(() => {
    if (!me || !managers || rooms.length === 0 || personalRoomChecked.current) return
    personalRoomChecked.current = true
    if (!me.canHavePersonalRoom) return
    void ensurePersonalRoom(me.id, me.name, me.color, rooms).then((room) => {
      if (room && !rooms.some((r) => r.id === room.id)) {
        managers.realtime.announceRoomsChanged()
      }
    })
  }, [me, managers, rooms])

  if (authError) {
    return <LoadingScreen label="Faça login no Nexus para entrar no escritório." />
  }
  if (!me || !managers) {
    return <LoadingScreen label="Identificando você..." />
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#aeb6c4', zIndex: 50 }}>
      <Suspense fallback={<LoadingScreen />}>
        <Canvas
          shadows
          camera={{ position: [0, 16, 18], fov: 60, near: 0.1, far: 320 }}
          gl={{
            antialias: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.1,
          }}
          style={{ width: '100%', height: '100%' }}
        >
          <SceneLights />
          <fog attach="fog" args={['#aeb6c4', 55, 140]} />
          <ModernOffice />
          <LocalPlayer realtime={managers.realtime} />
          <RemotePlayers />
          <MarceloNpc />
        </Canvas>
      </Suspense>

      {/* Overlays */}
      <TeamHUD />
      <RoomControls realtime={managers.realtime} />
      <TeamChatPanel realtime={managers.realtime} />
      <CallDock callManager={managers.callManager} />
      <AvatarEditor realtime={managers.realtime} />
      <MarceloChatPanel />
    </div>
  )
}
