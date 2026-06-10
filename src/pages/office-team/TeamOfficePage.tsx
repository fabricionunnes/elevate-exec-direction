// Escritório UNV multiplayer — usuários reais do Nexus num escritório 3D,
// com presença em tempo real, chat de texto e chamada de áudio/vídeo (WebRTC).
// Mesma engine visual do escritório de agentes (/office).
import { Suspense, useEffect, useState, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { supabase } from '@/integrations/supabase/client'
import OfficeLayout from '../office/components/OfficeLayout'
import LocalPlayer from './components/LocalPlayer'
import RemotePlayer from './components/RemotePlayer'
import TeamChatPanel from './components/TeamChatPanel'
import CallDock from './components/CallDock'
import TeamHUD from './components/TeamHUD'
import { useTeamStore, avatarColorsFor, TeamProfile } from './store/useTeamStore'
import { TeamRealtime } from './lib/realtime'
import { CallManager } from './lib/webrtc'

function SceneLights() {
  return (
    <>
      <ambientLight intensity={1.4} color="#ffffff" />
      <directionalLight
        position={[0, 15, 5]}
        intensity={1.8}
        color="#fff8e8"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-bias={-0.001}
      />
      <directionalLight position={[-5, 10, -5]} intensity={0.8} color="#f0f4ff" />
      <pointLight position={[-12, 4, -8]} intensity={0.9} color="#1B2951" distance={12} />
      <pointLight position={[4, 4, -8]} intensity={0.9} color="#1B6B3A" distance={10} />
      <pointLight position={[-12, 4, 0]} intensity={0.9} color="#1A4A8A" distance={10} />
      <pointLight position={[5, 4, 0]} intensity={0.9} color="#6B2FA0" distance={12} />
      <pointLight position={[-3, 4, 6]} intensity={0.7} color="#c8a870" distance={14} />
      <pointLight position={[-12, 4, 12]} intensity={1.2} color="#ffcc66" distance={10} />
      <pointLight position={[-4, 4, 12]} intensity={0.9} color="#B85C00" distance={10} />
      <pointLight position={[6, 4, 12]} intensity={0.9} color="#C2185B" distance={10} />
      <hemisphereLight args={['#fff3e0', '#1a1a2e', 0.4]} />
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
  return (
    <>
      {Object.values(remotePlayers).map((p) => (
        <RemotePlayer key={p.id} player={p} />
      ))}
    </>
  )
}

/** Resolve o perfil exibido no escritório: staff → office_user_avatars → metadata/email. */
async function loadProfile(): Promise<TeamProfile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  let name: string | null = null
  let role = ''

  const { data: staff } = await supabase
    .from('onboarding_staff')
    .select('name, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()
  if (staff) {
    name = (staff as { name: string | null }).name
    role = ((staff as { role: string | null }).role ?? '') as string
  }

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
  return { id: user.id, name, role, ...colors }
}

export default function TeamOfficePage() {
  const me = useTeamStore((s) => s.me)
  const setMe = useTeamStore((s) => s.setMe)
  const [authError, setAuthError] = useState(false)

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

  if (authError) {
    return <LoadingScreen label="Faça login no Nexus para entrar no escritório." />
  }
  if (!me || !managers) {
    return <LoadingScreen label="Identificando você..." />
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#c8d4e8', zIndex: 50 }}>
      <Suspense fallback={<LoadingScreen />}>
        <Canvas
          shadows
          camera={{ position: [0, 16, 18], fov: 60, near: 0.1, far: 300 }}
          gl={{
            antialias: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.1,
          }}
          style={{ width: '100%', height: '100%' }}
        >
          <SceneLights />
          <fog attach="fog" args={['#c8d4e8', 45, 120]} />
          <OfficeLayout />
          <LocalPlayer realtime={managers.realtime} />
          <RemotePlayers />
        </Canvas>
      </Suspense>

      {/* Overlays */}
      <TeamHUD />
      <TeamChatPanel realtime={managers.realtime} />
      <CallDock callManager={managers.callManager} />
    </div>
  )
}
