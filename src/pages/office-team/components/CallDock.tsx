// Dock de chamada (áudio/vídeo) + tiles de vídeo dos participantes.
// ÁUDIO ESPACIAL: você só ouve quem está na MESMA SALA; em área aberta
// (corredores), o volume cai com a distância; salas diferentes = silêncio.
import { useEffect, useRef, useState } from 'react'
import { useTeamStore, RemotePlayerState } from '../store/useTeamStore'
import { roomAt, OfficeRoom } from '../lib/rooms'
import { MeetingRecorder, saveRecording } from '../lib/recording'
import { useStaffPermissions } from '@/hooks/useStaffPermissions'
import { preloadCameraFx } from '../lib/cameraFx'
import type { CameraBg } from '../lib/cameraFx'
import type { CallManager } from '../lib/webrtc'
import type { TeamRealtime } from '../lib/realtime'

// Fundos prontos gerados localmente (gradientes — sem asset externo)
function gradientDataUrl(stops: [number, string][]): string {
  const c = document.createElement('canvas')
  c.width = 640
  c.height = 480
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 640, 480)
  for (const [o, col] of stops) grad.addColorStop(o, col)
  g.fillStyle = grad
  g.fillRect(0, 0, 640, 480)
  return c.toDataURL('image/png')
}

/** Painel de escolha de fundo da câmera (nenhum / desfoque / imagem / upload). */
function BackgroundPicker({
  current,
  onPick,
  onClose,
}: {
  current: CameraBg['kind']
  onPick: (mode: CameraBg) => void
  onClose: () => void
}) {
  const presets = useRef<{ label: string; url: string }[]>([])
  if (presets.current.length === 0) {
    presets.current = [
      { label: 'UNV Navy', url: gradientDataUrl([[0, '#0D2B5E'], [1, '#13294a']]) },
      { label: 'Grafite', url: gradientDataUrl([[0, '#2a2d33'], [1, '#0c0d10']]) },
      { label: 'Quente', url: gradientDataUrl([[0, '#3a2a1a'], [1, '#7a5c3e']]) },
    ]
  }
  const fileRef = useRef<HTMLInputElement>(null!)
  const onFile = (f: File | undefined) => {
    if (!f) return
    onPick({ kind: 'image', url: URL.createObjectURL(f) })
  }
  const opt: React.CSSProperties = {
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.2)',
    cursor: 'pointer',
    fontSize: '12px',
    color: '#fff',
    padding: '8px 10px',
    background: 'rgba(255,255,255,0.08)',
  }
  return (
    <div
      style={{
        background: 'rgba(10,10,20,0.95)',
        backdropFilter: 'blur(14px)',
        border: '1px solid rgba(255,255,255,0.16)',
        borderRadius: '14px',
        padding: '12px',
        marginBottom: '4px',
        width: '300px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#fff' }}>🪄 Fundo da câmera</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '14px' }}>✕</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <button onClick={() => onPick({ kind: 'none' })} style={{ ...opt, outline: current === 'none' ? '2px solid #FFD700' : 'none' }}>
          Nenhum
        </button>
        <button onClick={() => onPick({ kind: 'blur' })} style={{ ...opt, outline: current === 'blur' ? '2px solid #FFD700' : 'none' }}>
          🌫 Desfoque
        </button>
        {presets.current.map((p) => (
          <button
            key={p.label}
            onClick={() => onPick({ kind: 'image', url: p.url })}
            style={{
              ...opt,
              backgroundImage: `url(${p.url})`,
              backgroundSize: 'cover',
              textShadow: '0 1px 3px rgba(0,0,0,0.8)',
              height: '44px',
            }}
          >
            {p.label}
          </button>
        ))}
        <button onClick={() => fileRef.current?.click()} style={opt}>
          🖼 Enviar imagem
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '8px' }}>
        Primeira aplicação pode levar uns segundos (carrega o modelo).
      </div>
    </div>
  )
}

const HEAR_NEAR = 2.5 // até aqui, volume 1 em área aberta
const HEAR_FAR = 11 // a partir daqui, silêncio em área aberta

// Chave de "sala" pra área aberta/corredor (gravação e indicador por sala)
const OFFICE_KEY = '__office__'

/** Chave da sala em que um ponto está (corredor/lounge conta como escritório aberto). */
function roomKeyAt(x: number, z: number, rooms: OfficeRoom[]): string {
  const r = roomAt(x, z, rooms)
  return r ? r.id : OFFICE_KEY
}

/** Streams dos peers em call que estão DENTRO da sala gravada — a gravação
 * captura só a sala, nunca as conversas das outras salas do escritório. */
function streamsInRoom(roomKey: string): Record<string, MediaStream> {
  const st = useTeamStore.getState()
  const out: Record<string, MediaStream> = {}
  for (const p of Object.values(st.remotePlayers)) {
    if (!p.inCall) continue
    if (roomKeyAt(p.position[0], p.position[2], st.rooms) !== roomKey) continue
    const s = st.call.remoteStreams[p.id]
    if (s) out[p.id] = s
  }
  return out
}

function spatialVolume(
  myPos: [number, number, number],
  myRoomId: string | null,
  peer: RemotePlayerState,
  rooms: OfficeRoom[]
): number {
  // Lounge é área aberta: conta como corredor (voz por proximidade)
  const myRoom = myRoomId ? rooms.find((r) => r.id === myRoomId) ?? null : null
  const myEffId = myRoom && myRoom.roomType !== 'lounge' ? myRoom.id : null
  const peerRoom = roomAt(peer.position[0], peer.position[2], rooms)
  const peerRoomId = peerRoom && peerRoom.roomType !== 'lounge' ? peerRoom.id : null
  if (myEffId || peerRoomId) {
    return myEffId === peerRoomId ? 1 : 0
  }
  const dx = peer.position[0] - myPos[0]
  const dz = peer.position[2] - myPos[2]
  const d = Math.sqrt(dx * dx + dz * dz)
  if (d <= HEAR_NEAR) return 1
  if (d >= HEAR_FAR) return 0
  return 1 - (d - HEAR_NEAR) / (HEAR_FAR - HEAR_NEAR)
}

function MediaAudio({ stream, volume }: { stream: MediaStream; volume: number }) {
  const ref = useRef<HTMLAudioElement>(null!)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (el.srcObject !== stream) el.srcObject = stream
    // Autoplay pode ser bloqueado sem interação — destrava no próximo clique
    el.play().catch(() => {
      const unlock = () => {
        el.play().catch(() => undefined)
        document.removeEventListener('click', unlock)
      }
      document.addEventListener('click', unlock)
    })
  }, [stream])
  useEffect(() => {
    if (ref.current) ref.current.volume = volume
  }, [volume])
  return <audio ref={ref} autoPlay />
}

function VideoTile({ stream, label, muted, mirrored }: { stream: MediaStream; label: string; muted: boolean; mirrored?: boolean }) {
  // Callback ref: reconecta o stream sempre que o elemento (re)monta —
  // useEffect([stream]) perde a remontagem quando a referência não muda
  const setVideoEl = (el: HTMLVideoElement | null) => {
    if (el && el.srcObject !== stream) {
      el.srcObject = stream
      void el.play().catch(() => undefined)
    }
  }
  return (
    <div
      style={{
        position: 'relative',
        width: '176px',
        height: '120px',
        borderRadius: '12px',
        overflow: 'hidden',
        background: '#000',
        border: '1px solid rgba(255,255,255,0.2)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        flexShrink: 0,
      }}
    >
      <video
        ref={setVideoEl}
        autoPlay
        playsInline
        muted={muted}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: mirrored ? 'scaleX(-1)' : undefined,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: '4px 8px',
          fontSize: '11px',
          fontWeight: 600,
          color: '#fff',
          background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {label}
      </div>
    </div>
  )
}

function GridTile({
  stream,
  name,
  camOn,
  muted,
  mirrored,
  color,
  micOn,
  handRaised,
  onClick,
  fill,
  fit,
}: {
  stream: MediaStream | null
  name: string
  camOn: boolean
  muted: boolean
  mirrored?: boolean
  color: string
  micOn: boolean
  handRaised?: boolean
  onClick?: () => void
  /** ocupa todo o espaço do container (modo destaque) */
  fill?: boolean
  fit?: 'cover' | 'contain'
}) {
  // Callback ref: o <video> desmonta quando a câmera desliga (vira avatar) e
  // REMONTA quando liga de novo — um useEffect([stream]) não re-roda nesse
  // caso (mesma referência de stream) e o elemento ficava sem srcObject.
  const setVideoEl = (el: HTMLVideoElement | null) => {
    if (el && stream && el.srcObject !== stream) {
      el.srcObject = stream
      void el.play().catch(() => undefined)
    }
  }
  return (
    <div
      onClick={onClick}
      title={onClick ? 'Clique para destacar / voltar' : undefined}
      style={{
        position: 'relative',
        width: '100%',
        ...(fill ? { height: '100%' } : { aspectRatio: '16 / 10' }),
        borderRadius: '14px',
        overflow: 'hidden',
        background: '#101218',
        border: '1px solid rgba(255,255,255,0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {camOn && stream ? (
        <video
          ref={setVideoEl}
          autoPlay
          playsInline
          muted={muted}
          style={{
            width: '100%',
            height: '100%',
            objectFit: fit ?? 'cover',
            transform: mirrored ? 'scaleX(-1)' : undefined,
          }}
        />
      ) : (
        <div
          style={{
            width: '84px',
            height: '84px',
            borderRadius: '50%',
            background: color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '34px',
            fontWeight: 800,
            color: '#fff',
          }}
        >
          {name.charAt(0).toUpperCase()}
        </div>
      )}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: '8px 12px',
          fontSize: '13px',
          fontWeight: 600,
          color: '#fff',
          background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
        <span style={{ fontSize: '13px' }}>{micOn ? '🎙️' : '🔇'}</span>
        {handRaised && <span style={{ fontSize: '13px', marginLeft: 'auto' }} title="Mão levantada">✋</span>}
      </div>
      {handRaised && (
        <div
          title="Pediu pra falar"
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: '#F5C518',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.45)',
            animation: 'handRaisePulse 1.4s ease-in-out infinite',
          }}
        >
          ✋
        </div>
      )}
    </div>
  )
}

function DockButton({
  onClick,
  active,
  danger,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  danger?: boolean
  title: string
  children: React.ReactNode
}) {
  // Tooltip próprio (o title nativo demora ~1s pra aparecer)
  const [hover, setHover] = useState(false)
  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      {hover && (
        <div
          style={{
            position: 'absolute',
            bottom: '54px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(10,10,20,0.95)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            padding: '6px 10px',
            color: '#fff',
            fontSize: '11.5px',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            boxShadow: '0 4px 16px rgba(0,0,0,0.45)',
            zIndex: 5,
          }}
        >
          {title}
        </div>
      )}
      <button
        onClick={onClick}
        aria-label={title}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          width: '46px',
          height: '46px',
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.2)',
          background: danger ? '#c62828' : active ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.12)',
          color: danger ? '#fff' : active ? '#111' : '#fff',
          fontSize: '18px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s',
        }}
      >
        {children}
      </button>
    </div>
  )
}

// AudioContext persistente do sino — criado/resumido em interações do usuário
// (autoplay policy: contexto criado fora de um gesto nasce 'suspended' e não toca)
let ringCtx: AudioContext | null = null
function ensureRingCtx() {
  try {
    if (!ringCtx) {
      const Ctx =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      ringCtx = new Ctx()
    }
    if (ringCtx.state === 'suspended') void ringCtx.resume()
  } catch {
    // sem áudio disponível
  }
}

// Toca um "ding-dong" via WebAudio (sem asset; funciona em aba background)
async function playRingSound() {
  ensureRingCtx()
  const ctx = ringCtx
  if (!ctx) return
  try {
    if (ctx.state === 'suspended') await ctx.resume()
  } catch {
    return
  }
  if (ctx.state !== 'running') return
  const ding = (freq: number, t0: number) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    osc.connect(gain)
    gain.connect(ctx.destination)
    gain.gain.setValueAtTime(0.0001, ctx.currentTime + t0)
    gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + t0 + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t0 + 0.8)
    osc.start(ctx.currentTime + t0)
    osc.stop(ctx.currentTime + t0 + 0.85)
  }
  ding(880, 0)
  ding(660, 0.45)
  ding(880, 1.3)
  ding(660, 1.75)
}

export default function CallDock({ callManager, realtime }: { callManager: CallManager; realtime: TeamRealtime }) {
  const call = useTeamStore((s) => s.call)
  const remotePlayers = useTeamStore((s) => s.remotePlayers)
  const me = useTeamStore((s) => s.me)
  const myRoomId = useTeamStore((s) => s.myRoomId)
  const rooms = useTeamStore((s) => s.rooms)
  const incomingRing = useTeamStore((s) => s.incomingRing)
  const setIncomingRing = useTeamStore((s) => s.setIncomingRing)
  const voiceBlocked = useTeamStore((s) => s.voiceBlocked)
  const recordings = useTeamStore((s) => s.recordings)
  const recStop = useTeamStore((s) => s.recStop)
  const { isMaster } = useStaffPermissions()
  const recorderRef = useRef<MeetingRecorder | null>(null)
  if (!recorderRef.current) recorderRef.current = new MeetingRecorder()
  // Sala da MINHA gravação ativa (a gravação pertence a uma sala)
  const myRecRoomKeyRef = useRef<string | null>(null)
  // Sala onde estou agora (pro botão/banner de gravação — atualizada por interval)
  const [myRoomKey, setMyRoomKey] = useState<string>(OFFICE_KEY)
  // Auto-gravação: sala onde EU estou gravando automaticamente + salas suprimidas
  const autoRecRoomRef = useRef<string | null>(null)
  const autoRecSuppressRef = useRef<Set<string>>(new Set())
  const autoStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [volumes, setVolumes] = useState<Record<string, number>>({})
  const [expanded, setExpanded] = useState(false)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [bgPanelOpen, setBgPanelOpen] = useState(false)
  const [bgKind, setBgKind] = useState(() => callManager.getCameraBackground().kind)
  // Área útil do palco do modo reunião (descontando header + dock + margens)
  const [stageSize, setStageSize] = useState({ w: 1200, h: 600 })
  useEffect(() => {
    const upd = () => setStageSize({ w: window.innerWidth - 48, h: window.innerHeight - 200 })
    upd()
    window.addEventListener('resize', upd)
    return () => window.removeEventListener('resize', upd)
  }, [])

  // Fechou o modo reunião → limpa o destaque
  useEffect(() => {
    if (!expanded && focusedId) setFocusedId(null)
  }, [expanded, focusedId])

  // Pré-carrega o modelo de segmentação quando a câmera liga (1ª troca de fundo rápida)
  useEffect(() => {
    if (call.camOn) preloadCameraFx()
  }, [call.camOn])

  // Deep-link de sala de reunião: ao conectar a voz, abre o modo reunião
  const meetingViewRequested = useTeamStore((s) => s.meetingViewRequested)
  const setMeetingViewRequested = useTeamStore((s) => s.setMeetingViewRequested)
  useEffect(() => {
    if (meetingViewRequested && call.joined) {
      setExpanded(true)
      setMeetingViewRequested(false)
    }
  }, [meetingViewRequested, call.joined, setMeetingViewRequested])

  // Destrava o áudio do sino e pede permissão de notificação de sistema
  // no primeiro gesto do usuário (autoplay/notification policies)
  useEffect(() => {
    const unlock = () => {
      ensureRingCtx()
      try {
        if ('Notification' in window && Notification.permission === 'default') {
          void Notification.requestPermission()
        }
      } catch {
        // sem suporte a Notification
      }
    }
    document.addEventListener('click', unlock)
    document.addEventListener('keydown', unlock)
    return () => {
      document.removeEventListener('click', unlock)
      document.removeEventListener('keydown', unlock)
    }
  }, [])

  // Campainha recebida: som + notificação de sistema (se em background)
  // + título da aba piscando + banner por 15s
  useEffect(() => {
    if (!incomingRing) return
    void playRingSound()
    try {
      if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
        new Notification('🔔 UNV Office', { body: `${incomingRing.fromName} está te chamando!` })
      }
    } catch {
      // sem suporte a Notification
    }
    const originalTitle = document.title
    let flip = false
    const flash = setInterval(() => {
      flip = !flip
      document.title = flip ? `🔔 ${incomingRing.fromName} está te chamando!` : originalTitle
    }, 900)
    const clear = setTimeout(() => setIncomingRing(null), 15000)
    return () => {
      clearInterval(flash)
      clearTimeout(clear)
      document.title = originalTitle
    }
  }, [incomingRing, setIncomingRing])

  // ── Gravação de reunião (POR SALA) ────────────────────────────────────
  // Mantém o áudio gravado = quem está NA sala: pluga quem entra, corta quem sai
  useEffect(() => {
    const rec = recorderRef.current
    if (!rec?.active || !myRecRoomKeyRef.current) return
    rec.syncStreams(streamsInRoom(myRecRoomKeyRef.current))
  }, [call.remoteStreams])

  const stopAndSaveRecording = async () => {
    const rec = recorderRef.current
    if (!rec?.active || !me) return
    const st = useTeamStore.getState()
    const recRoomKey = myRecRoomKeyRef.current ?? OFFICE_KEY
    myRecRoomKeyRef.current = null
    st.setRoomRecording(recRoomKey, null)
    realtime.sendRecording(false, recRoomKey)
    const result = await rec.stop()
    if (!result) return
    st.addToast('Gravação salva — processando transcrição...', 'in')
    const saved = await saveRecording(
      result.videoBlob,
      result.audioBlob,
      result.durationS,
      recRoomKey !== OFFICE_KEY ? st.rooms.find((r) => r.id === recRoomKey)?.name ?? null : null,
      me
    )
    if (saved.ok) {
      st.addToast(saved.transcribed ? 'Gravação e transcrição prontas (30 dias)' : 'Gravação salva (sem transcrição)', 'in')
    } else {
      st.addToast('Falha ao salvar a gravação', 'out')
    }
  }

  // Inicia a gravação DESTA sala neste cliente (manual ou automática)
  const startRecording = (roomKey: string) => {
    const rec = recorderRef.current
    if (!rec || !me || rec.active) return
    const getParticipants = () => {
      const st = useTeamStore.getState()
      const meNow = st.me
      const list = [
        {
          id: 'me',
          name: meNow?.name ?? 'Você',
          stream: st.call.localStream,
          camOn: st.call.camOn,
          color: meNow?.color ?? '#1A4A8A',
        },
      ]
      for (const p of Object.values(st.remotePlayers)) {
        if (!p.inCall) continue
        // grade do vídeo = só quem está na sala gravada
        if (roomKeyAt(p.position[0], p.position[2], st.rooms) !== roomKey) continue
        list.push({
          id: p.id,
          name: p.name,
          stream: st.call.remoteStreams[p.id] ?? null,
          camOn: p.camOn,
          color: p.color,
        })
      }
      return list
    }
    myRecRoomKeyRef.current = roomKey
    rec.start(call.localStream, streamsInRoom(roomKey), getParticipants)
    useTeamStore.getState().setRoomRecording(roomKey, { byId: me.id, byName: me.name })
    realtime.sendRecording(true, roomKey)
  }

  const toggleRecording = () => {
    const rec = recorderRef.current
    if (!rec || !me) return
    if (rec.active) {
      // Quem está gravando para e salva (+ suprime auto-gravação nesta sala)
      const r = roomAt(useTeamStore.getState().playerPosition[0], useTeamStore.getState().playerPosition[2], rooms)
      if (r) autoRecSuppressRef.current.add(r.id)
      autoRecRoomRef.current = null
      void stopAndSaveRecording()
      return
    }
    const st = useTeamStore.getState()
    const roomKey = roomKeyAt(st.playerPosition[0], st.playerPosition[2], st.rooms)
    if (st.recordings[roomKey]) {
      // Outra pessoa grava ESTA sala: master pode mandar parar
      if (isMaster) realtime.sendStopRecording(roomKey)
      return
    }
    startRecording(roomKey)
  }

  // Saiu da chamada/escritório gravando → para e salva
  useEffect(() => {
    if (!call.joined && recorderRef.current?.active) {
      void stopAndSaveRecording()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call.joined])

  // Master mandou parar (broadcast rec-stop) → quem grava AQUELA sala para e salva
  useEffect(() => {
    if (recStop.nonce > 0 && recorderRef.current?.active && myRecRoomKeyRef.current === recStop.room) {
      if (recStop.room !== OFFICE_KEY) autoRecSuppressRef.current.add(recStop.room) // não re-grava sozinho até esvaziar
      autoRecRoomRef.current = null
      void stopAndSaveRecording()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recStop])

  // ── GRAVAÇÃO AUTOMÁTICA ──────────────────────────────────────────────
  // Sala de reunião/setor com 2+ pessoas na call → grava sozinho. Um único
  // gravador por sala (menor user_id de staff presente). Para quando cai pra
  // <2 ou quando o master manda parar.
  useEffect(() => {
    if (!call.joined || !me || me.isGuest) return
    const tick = () => {
      const st = useTeamStore.getState()
      const meNow = st.me
      if (!meNow) return
      const [px, , pz] = st.playerPosition
      const myRoom = roomAt(px, pz, st.rooms)
      const auto = !!myRoom && (myRoom.roomType === 'meeting' || myRoom.roomType === 'sector')

      // Quem está na MINHA sala, na call
      let present = 0
      const staff: string[] = []
      if (auto) {
        present++ // eu
        if (!meNow.isGuest) staff.push(meNow.id)
        for (const p of Object.values(st.remotePlayers)) {
          if (!p.inCall) continue
          const pr = roomAt(p.position[0], p.position[2], st.rooms)
          if (pr?.id === myRoom!.id) {
            present++
            if (p.role !== 'Visitante') staff.push(p.id)
          }
        }
      }

      // Esvaziou → libera a supressão (próxima reunião pode auto-gravar)
      if (myRoom && present < 2) autoRecSuppressRef.current.delete(myRoom.id)

      const rec = recorderRef.current

      // Auto-parada: eu estava auto-gravando e a sala caiu pra <2 (ou saí dela)
      if (rec?.active && autoRecRoomRef.current && (!auto || myRoom!.id !== autoRecRoomRef.current || present < 2)) {
        autoRecRoomRef.current = null
        if (autoStartTimerRef.current) {
          clearTimeout(autoStartTimerRef.current)
          autoStartTimerRef.current = null
        }
        void stopAndSaveRecording()
        return
      }

      // Gravação em andamento: mantém o áudio/vídeo = quem está NA sala
      if (rec?.active && myRecRoomKeyRef.current) {
        rec.syncStreams(streamsInRoom(myRecRoomKeyRef.current))
      }

      // Eleição: menor id de staff presente é o gravador. A trava de
      // "já tem gravação" é POR SALA — outras salas gravam em paralelo.
      const recorder = staff.length ? [...staff].sort()[0] : null
      const shouldStart =
        auto &&
        present >= 2 &&
        recorder === meNow.id &&
        !st.recordings[myRoom!.id] &&
        !rec?.active &&
        !autoRecSuppressRef.current.has(myRoom!.id)

      if (shouldStart && !autoStartTimerRef.current) {
        // estabiliza 6s (evita gravar quem só passou pela sala)
        const roomKey = myRoom!.id
        autoStartTimerRef.current = setTimeout(() => {
          autoStartTimerRef.current = null
          const s2 = useTeamStore.getState()
          if (s2.recordings[roomKey] || recorderRef.current?.active) return
          // confere que ainda estou na mesma sala antes de gravar
          if (roomKeyAt(s2.playerPosition[0], s2.playerPosition[2], s2.rooms) !== roomKey) return
          autoRecRoomRef.current = roomKey
          startRecording(roomKey)
          s2.addToast('🔴 Gravação automática iniciada', 'in')
        }, 6000)
      } else if (!shouldStart && autoStartTimerRef.current) {
        clearTimeout(autoStartTimerRef.current)
        autoStartTimerRef.current = null
      }
    }
    const iv = setInterval(tick, 2500)
    tick()
    return () => {
      clearInterval(iv)
      if (autoStartTimerRef.current) {
        clearTimeout(autoStartTimerRef.current)
        autoStartTimerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call.joined, me])

  // Aceitar o chamado: anda automaticamente até quem chamou
  const goToCaller = () => {
    if (!incomingRing) return
    const st = useTeamStore.getState()
    // usa a posição ATUAL de quem chamou, se ainda estiver online
    const caller = st.remotePlayers[incomingRing.fromId]
    const target = caller
      ? { x: caller.position[0], z: caller.position[2] }
      : { x: incomingRing.x, z: incomingRing.z }
    st.setPendingWalkTo(target)
    setIncomingRing(null)
  }

  // Esc fecha o modo reunião; saiu da chamada → fecha também
  useEffect(() => {
    if (!call.joined && expanded) setExpanded(false)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [call.joined, expanded])

  // Sala atual (pro indicador de gravação por sala) — 1s é suficiente
  useEffect(() => {
    const tick = () => {
      const st = useTeamStore.getState()
      setMyRoomKey(roomKeyAt(st.playerPosition[0], st.playerPosition[2], st.rooms))
    }
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [])

  // Recalcula volumes espaciais a cada 250ms
  useEffect(() => {
    if (!call.joined) return
    const tick = () => {
      const state = useTeamStore.getState()
      const next: Record<string, number> = {}
      for (const peer of Object.values(state.remotePlayers)) {
        if (!peer.inCall) continue
        next[peer.id] = spatialVolume(state.playerPosition, state.myRoomId, peer, state.rooms)
      }
      setVolumes((prev) => {
        const keys = new Set([...Object.keys(prev), ...Object.keys(next)])
        for (const k of keys) {
          if (Math.abs((prev[k] ?? -1) - (next[k] ?? -1)) > 0.02) return next
        }
        return prev
      })
    }
    tick()
    const interval = setInterval(tick, 250)
    return () => clearInterval(interval)
  }, [call.joined])

  const myRoomName = myRoomId ? rooms.find((r) => r.id === myRoomId)?.name ?? null : null
  // Gravação da MINHA sala atual (indicador/botão são por sala)
  const roomRec = recordings[myRoomKey] ?? null
  const roomRecName = myRoomKey !== OFFICE_KEY ? rooms.find((r) => r.id === myRoomKey)?.name ?? null : null

  const run = async (fn: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(
        msg.includes('Permission denied') || msg.includes('NotAllowed')
          ? 'Permita o acesso ao microfone/câmera no navegador.'
          : 'Não foi possível acessar o dispositivo.'
      )
    } finally {
      setBusy(false)
    }
  }

  const audible = (id: string) => (volumes[id] ?? 0) > 0.04

  const remoteTiles = Object.values(remotePlayers).filter(
    (p) => p.inCall && p.camOn && call.remoteStreams[p.id] && audible(p.id)
  )

  // Participantes da "reunião" (audíveis pra mim, com ou sem câmera)
  const meetingPeers = Object.values(remotePlayers).filter((p) => p.inCall && audible(p.id))

  return (
    <>
      <style>{`@keyframes handRaisePulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.15); } }`}</style>
      {/* Áudio dos peers com volume espacial */}
      {call.joined &&
        Object.entries(call.remoteStreams).map(([id, stream]) => (
          <MediaAudio key={id} stream={stream} volume={volumes[id] ?? 0} />
        ))}

      {/* Modo reunião: grid grande com todos os participantes audíveis */}
      {call.joined && expanded && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(8, 8, 14, 0.93)',
            zIndex: 105,
            display: 'flex',
            flexDirection: 'column',
            padding: '20px 24px 100px 24px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: '14px' }}>
              {myRoomName ? `Reunião — ${myRoomName}` : 'Reunião'}
              <span style={{ color: 'rgba(255,255,255,0.45)', fontWeight: 400, marginLeft: '10px', fontSize: '12px' }}>
                {meetingPeers.length + 1} participantes
              </span>
            </div>
            <button
              onClick={() => setExpanded(false)}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Voltar ao escritório (Esc)
            </button>
          </div>
          {(() => {
            // Lista unificada de participantes (eu + audíveis)
            const participants = [
              {
                id: 'me',
                name: `${me?.name ?? 'Você'} (você)`,
                stream: call.localStream,
                camOn: call.camOn,
                mirrored: !call.screenOn, // tela compartilhada não espelha
                color: me?.color ?? '#1A4A8A',
                micOn: call.micOn,
                handRaised: call.handRaised,
              },
              ...meetingPeers.map((p) => ({
                id: p.id,
                name: p.name,
                stream: call.remoteStreams[p.id] ?? null,
                camOn: p.camOn,
                mirrored: false,
                color: p.color,
                micOn: p.micOn,
                handRaised: p.handRaised,
              })),
            ]
            const focused = focusedId ? participants.find((p) => p.id === focusedId) : null

            if (focused) {
              const others = participants.filter((p) => p.id !== focused.id)
              return (
                // Destaque ocupa o máximo; miniaturas na coluna lateral direita
                <div style={{ flex: 1, display: 'flex', flexDirection: 'row', gap: '12px', minHeight: 0 }}>
                  <div style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
                    <GridTile {...focused} muted fill fit="contain" onClick={() => setFocusedId(null)} />
                  </div>
                  {others.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        flexShrink: 0,
                        width: '210px',
                        overflowY: 'auto',
                      }}
                    >
                      {others.map((p) => (
                        <div key={p.id} style={{ flexShrink: 0 }}>
                          <GridTile {...p} muted onClick={() => setFocusedId(p.id)} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            }

            // Galeria estilo Meet: calcula colunas/linhas que MAXIMIZAM o
            // tamanho de cada tile no espaço disponível (4 = 2x2, 6 = 3x2...)
            const GAP = 14
            const n = participants.length
            const availW = stageSize.w - 4
            const availH = stageSize.h - 4
            let bestCols = 1
            let bestTileW = 0
            for (let cols = 1; cols <= n; cols++) {
              const rows = Math.ceil(n / cols)
              const tw = Math.min(
                (availW - GAP * (cols - 1)) / cols,
                ((availH - GAP * (rows - 1)) / rows) * (16 / 9)
              )
              if (tw > bestTileW) {
                bestTileW = tw
                bestCols = cols
              }
            }
            const tileW = Math.max(160, Math.floor(bestTileW))
            void bestCols
            return (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: `${GAP}px`,
                  alignContent: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  minHeight: 0,
                }}
              >
                {participants.map((p) => (
                  <div key={p.id} style={{ width: tileW, flexShrink: 0 }}>
                    <GridTile {...p} muted onClick={() => setFocusedId(p.id)} />
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      )}

      {/* Tiles de vídeo — topo central (só quem está audível) */}
      {call.joined && !expanded && (remoteTiles.length > 0 || (call.camOn && call.localStream)) && (
        <div
          style={{
            position: 'fixed',
            top: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '10px',
            zIndex: 90,
            maxWidth: 'calc(100vw - 460px)',
            overflowX: 'auto',
            padding: '4px',
          }}
        >
          {call.camOn && call.localStream && (
            <VideoTile
              stream={call.localStream}
              label={`${me?.name ?? 'Você'} (você)`}
              muted
              mirrored={!call.screenOn}
            />
          )}
          {remoteTiles.map((p) => (
            <VideoTile key={p.id} stream={call.remoteStreams[p.id]} label={p.name} muted={false} />
          ))}
        </div>
      )}

      {/* Painel de fundo da câmera — ancorado acima do dock */}
      {bgPanelOpen && call.camOn && (
        <div
          style={{
            position: 'fixed',
            bottom: '92px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 112,
          }}
        >
          <BackgroundPicker
            current={bgKind}
            onPick={(mode) => {
              setBgKind(mode.kind)
              void callManager.setCameraBackground(mode)
            }}
            onClose={() => setBgPanelOpen(false)}
          />
        </div>
      )}

      {/* Dock — base central */}
      <div
        style={{
          position: 'fixed',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          zIndex: 110,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        {error && (
          <div
            style={{
              background: 'rgba(198, 40, 40, 0.92)',
              color: '#fff',
              fontSize: '12px',
              padding: '6px 12px',
              borderRadius: '8px',
            }}
          >
            {error}
          </div>
        )}

        {call.joined && (
          <div
            style={{
              background: 'rgba(10,10,20,0.75)',
              color: 'rgba(255,255,255,0.6)',
              fontSize: '11px',
              padding: '4px 12px',
              borderRadius: '999px',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            {myRoomName ? `Voz na sala: ${myRoomName}` : 'Voz por proximidade (corredor)'}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(10, 10, 20, 0.85)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '999px',
            padding: '8px 14px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}
        >
          {!call.joined ? (
            // Voz conecta sozinha ao entrar; isso aqui é só o fallback
            // quando a permissão do microfone foi negada/falhou
            <button
              onClick={() => run(() => callManager.joinCall())}
              disabled={busy}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: voiceBlocked ? '#c62828' : '#2e7d32',
                border: 'none',
                borderRadius: '999px',
                padding: '10px 18px',
                color: '#fff',
                fontWeight: 700,
                fontSize: '13px',
                cursor: busy ? 'wait' : 'pointer',
              }}
            >
              {voiceBlocked ? '🎙️ Liberar microfone' : '🎙️ Conectando voz...'}
            </button>
          ) : (
            <>
              {meetingPeers.length > 0 && (
                <DockButton
                  onClick={() => setExpanded((v) => !v)}
                  active={expanded}
                  title={expanded ? 'Voltar ao escritório' : 'Ampliar vídeos (modo reunião)'}
                >
                  ⛶
                </DockButton>
              )}
              <DockButton
                onClick={() => callManager.toggleMic()}
                active={call.micOn}
                title={call.micOn ? 'Microfone — clique para desativar' : 'Microfone — clique para ativar'}
              >
                {call.micOn ? '🎙️' : '🔇'}
              </DockButton>
              <DockButton
                onClick={() => callManager.toggleHandRaise()}
                active={call.handRaised}
                title={call.handRaised ? 'Baixar a mão' : 'Levantar a mão (pedir pra falar)'}
              >
                ✋
              </DockButton>
              <DockButton
                onClick={() => run(() => callManager.toggleCam())}
                active={call.camOn && !call.screenOn}
                title={
                  call.screenOn
                    ? 'Câmera — pare o compartilhamento de tela primeiro'
                    : call.camOn
                      ? 'Câmera — clique para desligar'
                      : 'Câmera — clique para ligar'
                }
              >
                <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  📹
                  {!call.camOn && (
                    <span
                      style={{
                        position: 'absolute',
                        width: '26px',
                        height: '3px',
                        background: '#e53935',
                        transform: 'rotate(-45deg)',
                        borderRadius: '2px',
                        boxShadow: '0 0 2px rgba(0,0,0,0.6)',
                      }}
                    />
                  )}
                </span>
              </DockButton>
              {call.camOn && !call.screenOn && (
                <DockButton
                  onClick={() => setBgPanelOpen((v) => !v)}
                  active={bgPanelOpen}
                  title="Fundo da câmera — desfocar ou trocar por uma imagem"
                >
                  🪄
                </DockButton>
              )}
              <DockButton
                onClick={() => run(() => callManager.toggleScreenShare())}
                active={call.screenOn}
                title={call.screenOn ? 'Compartilhar tela — clique para parar' : 'Compartilhar tela — mostrar sua tela pra sala'}
              >
                🖥️
              </DockButton>
              <DockButton
                onClick={toggleRecording}
                danger={!!roomRec}
                title={
                  roomRec
                    ? roomRec.byId === me?.id
                      ? 'Gravando esta sala — clique para parar'
                      : isMaster
                        ? `Gravando esta sala (${roomRec.byName}) — clique para parar`
                        : `Gravação em andamento nesta sala por ${roomRec.byName}`
                    : 'Gravar reunião desta sala — vídeo + transcrição e ata (30 dias). Reuniões com 2+ gravam sozinhas'
                }
              >
                ⏺
              </DockButton>
            </>
          )}
        </div>
      </div>

      {/* Indicador de gravação — só pra quem está NA sala sendo gravada */}
      {roomRec && (
        <div
          style={{
            position: 'fixed',
            top: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(150, 20, 20, 0.92)',
            border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: '999px',
            padding: '6px 16px',
            color: '#fff',
            fontSize: '12px',
            fontWeight: 700,
            zIndex: 118,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}
        >
          <span
            style={{
              width: '9px',
              height: '9px',
              borderRadius: '50%',
              background: '#ff5252',
              animation: 'npc-pulse-rec 1.2s infinite',
            }}
          />
          <style>{`@keyframes npc-pulse-rec { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }`}</style>
          Gravando{roomRecName ? ` — ${roomRecName}` : ''} · {roomRec.byName}
        </div>
      )}

      {/* Banner de campainha */}
      {incomingRing && (
        <div
          style={{
            position: 'fixed',
            top: '70px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(10,10,20,0.95)',
            border: '1px solid rgba(255,215,0,0.5)',
            borderRadius: '14px',
            padding: '14px 22px',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 700,
            zIndex: 120,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            animation: 'ring-shake 0.6s ease-in-out 3',
          }}
        >
          <style>{`
            @keyframes ring-shake {
              0%, 100% { transform: translateX(-50%) rotate(0); }
              25% { transform: translateX(-50%) rotate(-1.5deg); }
              75% { transform: translateX(-50%) rotate(1.5deg); }
            }
          `}</style>
          <span style={{ fontSize: '22px' }}>🔔</span>
          {incomingRing.fromName} está te chamando!
          <button
            onClick={goToCaller}
            style={{
              background: '#2e7d32',
              border: 'none',
              color: '#fff',
              borderRadius: '8px',
              padding: '7px 14px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 700,
            }}
          >
            🚶 Ir até {incomingRing.fromName.split(' ')[0]}
          </button>
          <button
            onClick={() => setIncomingRing(null)}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#ccc',
              borderRadius: '8px',
              padding: '7px 12px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Agora não
          </button>
        </div>
      )}
    </>
  )
}
