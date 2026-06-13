// Escritório UNV multiplayer — usuários reais do Nexus num escritório 3D
// moderno (salas por setor, reuniões, salas privadas), com presença em tempo
// real, chat de texto, áudio/vídeo espacial (WebRTC) e avatares humanos
// personalizáveis. Salas vêm do banco (office_team_rooms).
import { Suspense, useEffect, useRef, useState, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
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
import OfficeToasts from './components/OfficeToasts'
import DeskNotes from './components/DeskNotes'
import Parking from './components/Parking'
import AgentNpcs from './components/AgentNpc'
import AgentChatPanel from './components/AgentChatPanel'
import DataTvs from './components/DataTvs'
import SaleCelebration from './components/SaleCelebration'
import MusicPlayer from './components/MusicPlayer'
import CoffeeChat from './components/CoffeeChat'
import ScreenShareTvs from './components/ScreenShareTv'
import TourGuide from './components/TourGuide'
import { fetchInMeetingNow, fetchAgendaToday, AgendaItem } from './lib/agenda'
import { playMeetingPing } from './lib/sfx'
import {
  useTeamStore,
  avatarColorsFor,
  TeamProfile,
  AvatarConfig,
  DEFAULT_AVATAR,
} from './store/useTeamStore'
import { TeamRealtime } from './lib/realtime'
import { CallManager } from './lib/webrtc'
import { ensurePersonalRoom, personalOwnerSeat, roomAt, isEffectivelyLocked } from './lib/rooms'

function SceneLights() {
  return (
    <>
      <ambientLight intensity={0.9} color="#fff6ea" />
      {/* Ambiente procedural: dá reflexo real em metais, vidros e telas
          (gerado em código — nenhum asset externo) */}
      <Environment resolution={64} frames={1}>
        <Lightformer
          intensity={1.1}
          position={[0, 6, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[12, 12, 1]}
          color="#fff2dd"
        />
        <Lightformer intensity={0.55} position={[-8, 2, -2]} scale={[12, 3, 1]} color="#bcd8f0" />
        <Lightformer
          intensity={0.45}
          position={[10, 2, 1]}
          rotation={[0, -Math.PI / 2, 0]}
          scale={[12, 3, 1]}
          color="#ffffff"
        />
      </Environment>
      <directionalLight
        position={[8, 22, 10]}
        intensity={1.9}
        color="#fff3dd"
        castShadow
        // 1024 com PCFSoft fica visualmente quase igual a 2048 e corta 4x o
        // custo da passada de sombra (a cena inteira re-renderiza pra ela)
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-38}
        shadow-camera-right={38}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-bias={-0.001}
      />
      <directionalLight position={[-10, 14, -8]} intensity={0.75} color="#e8f0ff" />
      <hemisphereLight args={['#ffeed8', '#2a2e3a', 0.55]} />
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
  const cutscenes = useTeamStore((s) => s.cutscenes)
  // Quem está "chegando de carro" fica oculto até a cutscene terminar
  const arriving = new Set(cutscenes.filter((c) => c.kind === 'arrive').map((c) => c.userId))

  // Privacidade: quem está numa sala trancada só é visível pra quem está
  // DENTRO da mesma sala — com duas exceções: o DONO da sala e quem TRANCOU
  // sempre veem o que acontece nela (o áudio segue a mesma regra de sala)
  const onlineIds = new Set(Object.keys(remotePlayers))
  if (me) onlineIds.add(me.id)

  const visible = Object.values(remotePlayers).filter((p) => {
    if (arriving.has(p.id)) return false
    const room = roomAt(p.position[0], p.position[2], rooms)
    if (
      room &&
      room.id !== myRoomId &&
      room.ownerUserId !== me?.id &&
      room.lockedBy !== me?.id &&
      isEffectivelyLocked(room, onlineIds)
    ) {
      return false
    }
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

  // Visitante (login anônimo via convite): perfil reduzido, spawn na
  // Reunião Principal, sem sala pessoal e sem dados de negócio
  if ((user as { is_anonymous?: boolean }).is_anonymous) {
    const meta = user.user_metadata as Record<string, unknown> | null
    const gname = ((meta?.guest_name as string) || 'Visitante').slice(0, 32)
    const colors = avatarColorsFor(user.id)
    return {
      id: user.id,
      name: gname,
      role: 'Visitante',
      ...colors,
      avatar: { ...DEFAULT_AVATAR, shirt: colors.color, pants: colors.pantsColor },
      spawn: [-21, 8.6, 0], // Reunião Principal
      canHavePersonalRoom: false,
      isGuest: true,
    }
  }

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
      facial_hair: AvatarConfig['facialHair'] | null
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
      facialHair: s.facial_hair ?? 'none',
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

/** Entrada de visitante: valida o convite, pede o nome e entra anônimo. */
function GuestEntry({ token }: { token: string }) {
  const [name, setName] = useState('')
  const [state, setState] = useState<'checking' | 'ok' | 'invalid' | 'joining'>('checking')

  useEffect(() => {
    void supabase
      .rpc('office_validate_invite' as never, { p_token: token } as never)
      .then(({ data }) => setState(data ? 'ok' : 'invalid'))
  }, [token])

  const join = async () => {
    if (!name.trim() || state === 'joining') return
    setState('joining')
    const { error } = await supabase.auth.signInAnonymously({
      options: { data: { guest_name: name.trim(), invite_token: token } },
    })
    if (error) {
      setState('ok')
      return
    }
    window.location.reload()
  }

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
        gap: '14px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        color: '#fff',
        zIndex: 999,
        padding: '20px',
      }}
    >
      <div style={{ fontSize: '44px' }}>🏢</div>
      <div style={{ fontSize: '24px', fontWeight: 800 }}>
        UNV <span style={{ color: '#FFD700' }}>Office</span>
      </div>
      {state === 'checking' && <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>Validando convite...</div>}
      {state === 'invalid' && (
        <div style={{ fontSize: '13px', color: '#ff8a80', textAlign: 'center' }}>
          Convite inválido ou expirado.
          <br />
          Peça um link novo pra quem te convidou.
        </div>
      )}
      {(state === 'ok' || state === 'joining') && (
        <>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
            Você foi convidado pra uma reunião. Como quer ser chamado?
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void join()
            }}
            placeholder="Seu nome"
            maxLength={32}
            autoFocus
            style={{
              width: 'min(300px, 80vw)',
              padding: '12px 16px',
              borderRadius: '12px',
              border: '1px solid rgba(255,215,0,0.4)',
              background: 'rgba(255,255,255,0.06)',
              color: '#fff',
              fontSize: '15px',
              outline: 'none',
              textAlign: 'center',
              fontFamily: 'inherit',
            }}
          />
          <button
            onClick={() => void join()}
            disabled={!name.trim() || state === 'joining'}
            style={{
              width: 'min(300px, 80vw)',
              padding: '12px',
              borderRadius: '12px',
              border: '1px solid #FFD700',
              background: name.trim() ? '#0D2B5E' : 'rgba(255,255,255,0.06)',
              color: '#fff',
              fontWeight: 700,
              fontSize: '14px',
              cursor: name.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            {state === 'joining' ? 'Entrando...' : 'Entrar no escritório'}
          </button>
        </>
      )}
    </div>
  )
}

export default function TeamOfficePage() {
  const me = useTeamStore((s) => s.me)
  const setMe = useTeamStore((s) => s.setMe)
  const rooms = useTeamStore((s) => s.rooms)
  const [authError, setAuthError] = useState(false)
  const personalRoomChecked = useRef(false)
  const [agendaToday, setAgendaToday] = useState<AgendaItem[]>([])
  const notifiedMeetings = useRef<Set<string>>(new Set())

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

  // Tecla F: liga/desliga o modo foco (cutucadas silenciadas com auto-resposta)
  useEffect(() => {
    if (!managers) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyF') return
      const el = document.activeElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return
      const st = useTeamStore.getState()
      const next = !st.focused
      st.setFocused(next)
      void managers.realtime.updateFocus(next)
      st.addToast(
        next ? '🔕 Modo foco ligado — cutucadas serão respondidas sozinhas (F pra sair)' : '🔔 Modo foco desligado',
        next ? 'out' : 'in'
      )
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [managers])

  useEffect(() => {
    if (!managers) return
    managers.realtime.connect()
    // Voz sempre ativa: conecta o microfone automaticamente ao entrar.
    // Se a permissão for negada, o dock mostra o fallback manual.
    const voiceTimer = setTimeout(() => {
      managers.callManager.joinCall().catch(() => {
        useTeamStore.getState().setVoiceBlocked(true)
      })
    }, 600)
    return () => {
      clearTimeout(voiceTimer)
      managers.callManager.destroy()
      managers.realtime.disconnect()
      useTeamStore.getState().setRemotePlayers({})
    }
  }, [managers])

  // Garante a sala pessoal do usuário e já o coloca SENTADO na cadeira dele
  // (uma vez, depois que as salas carregam)
  useEffect(() => {
    if (!me || !managers || rooms.length === 0 || personalRoomChecked.current) return
    personalRoomChecked.current = true
    if (!me.canHavePersonalRoom) return
    void ensurePersonalRoom(me.id, me.name, me.color, rooms).then((room) => {
      if (!room) return
      if (!rooms.some((r) => r.id === room.id)) {
        managers.realtime.announceRoomsChanged()
      }
      // Spawn padrão: sentado na cadeira da própria sala, atrás da mesa
      const seat = personalOwnerSeat(room)
      const st = useTeamStore.getState()
      st.setPendingTeleport([seat.x, seat.z])
      st.setPendingSeat(seat)
    })
  }, [me, managers, rooms])

  // Agenda do time: status "Em reunião" (view de quem tem reunião AGORA) +
  // agenda de hoje (placa da sala) + cutucada quando a MINHA reunião começa
  useEffect(() => {
    if (!me) return
    let cancelled = false
    const poll = async () => {
      const [inMeeting, agenda] = await Promise.all([fetchInMeetingNow(), fetchAgendaToday()])
      if (cancelled) return
      const st = useTeamStore.getState()
      st.setInMeetingIds(inMeeting)
      setAgendaToday(agenda)

      // Reunião MINHA começando agora (janela de ±90s) → ping + toast
      const now = Date.now()
      for (const m of agenda) {
        if (m.owner_user_id !== me.id || notifiedMeetings.current.has(m.id)) continue
        const start = new Date(m.meeting_date).getTime()
        if (now >= start - 30_000 && now <= start + 90_000) {
          notifiedMeetings.current.add(m.id)
          playMeetingPing()
          st.addToast(`📅 Sua reunião "${m.meeting_title ?? 'Reunião'}" está começando`, 'in')
          try {
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('📅 Reunião começando', { body: m.meeting_title ?? 'Sua reunião está começando agora.' })
            }
          } catch { /* sem notificação de sistema */ }
        }
      }
    }
    void poll()
    const interval = setInterval(poll, 60_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [me])

  if (authError) {
    // HashRouter: a query do convite vive DENTRO do hash (#/rota?invite=x);
    // cobre também o formato de path normal por garantia
    const hashSearch = window.location.hash.split('?')[1] ?? ''
    const inviteToken =
      new URLSearchParams(hashSearch).get('invite') ?? new URLSearchParams(window.location.search).get('invite')
    if (inviteToken) return <GuestEntry token={inviteToken} />
    return <LoadingScreen label="Faça login no Nexus para entrar no escritório." />
  }
  if (!me || !managers) {
    return <LoadingScreen label="Identificando você..." />
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#9fb0c2', zIndex: 50 }}>
      <Suspense fallback={<LoadingScreen />}>
        <Canvas
          shadows
          // Telas retina renderizam a 2-3x de DPR nativo = 4-9x mais pixels
          // por frame. Cap em 1.5 mantém nitidez e devolve a fluidez no
          // zoom/movimento (o maior ganho de performance da cena).
          dpr={[1, 1.5]}
          camera={{ position: [0, 16, 18], fov: 60, near: 0.1, far: 320 }}
          gl={{
            antialias: true,
            powerPreference: 'high-performance',
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.12,
          }}
          onCreated={({ gl }) => {
            gl.shadowMap.type = THREE.PCFSoftShadowMap // sombras suaves
          }}
          style={{ width: '100%', height: '100%' }}
        >
          <SceneLights />
          <fog attach="fog" args={['#9fb0c2', 55, 140]} />
          <ModernOffice />
          <Parking />
          <LocalPlayer realtime={managers.realtime} />
          <RemotePlayers />
          <MarceloNpc />
          <AgentNpcs />
          <DataTvs agendaToday={agendaToday} />
          <ScreenShareTvs />
          <CoffeeChat />
        </Canvas>
      </Suspense>

      {/* Overlays (visitante tem UI reduzida: só voz, dock e avisos) */}
      <TeamHUD realtime={managers.realtime} />
      {!me.isGuest && <RoomControls realtime={managers.realtime} />}
      {!me.isGuest && <TeamChatPanel realtime={managers.realtime} />}
      <CallDock callManager={managers.callManager} realtime={managers.realtime} />
      <AvatarEditor realtime={managers.realtime} />
      {!me.isGuest && <MarceloChatPanel realtime={managers.realtime} />}
      {!me.isGuest && <AgentChatPanel realtime={managers.realtime} />}
      {!me.isGuest && <SaleCelebration />}
      <MusicPlayer realtime={managers.realtime} />
      <OfficeToasts />
      {!me.isGuest && <DeskNotes realtime={managers.realtime} />}
      <TourGuide />
    </div>
  )
}
