// Dock de chamada (áudio/vídeo) + tiles de vídeo dos participantes.
// ÁUDIO ESPACIAL: você só ouve quem está na MESMA SALA; em área aberta
// (corredores), o volume cai com a distância; salas diferentes = silêncio.
import { useEffect, useRef, useState } from 'react'
import { useTeamStore, RemotePlayerState } from '../store/useTeamStore'
import { roomAt, OfficeRoom } from '../lib/rooms'
import { MeetingRecorder, saveRecording } from '../lib/recording'
import type { CallManager } from '../lib/webrtc'
import type { TeamRealtime } from '../lib/realtime'

const HEAR_NEAR = 2.5 // até aqui, volume 1 em área aberta
const HEAR_FAR = 11 // a partir daqui, silêncio em área aberta

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
  const ref = useRef<HTMLVideoElement>(null!)
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) {
      ref.current.srcObject = stream
    }
  }, [stream])
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
        ref={ref}
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
  onClick?: () => void
  /** ocupa todo o espaço do container (modo destaque) */
  fill?: boolean
  fit?: 'cover' | 'contain'
}) {
  const ref = useRef<HTMLVideoElement>(null!)
  useEffect(() => {
    if (ref.current && stream && ref.current.srcObject !== stream) {
      ref.current.srcObject = stream
    }
  }, [stream])
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
          ref={ref}
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
      </div>
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
  const recording = useTeamStore((s) => s.recording)
  const recorderRef = useRef<MeetingRecorder | null>(null)
  if (!recorderRef.current) recorderRef.current = new MeetingRecorder()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [volumes, setVolumes] = useState<Record<string, number>>({})
  const [expanded, setExpanded] = useState(false)
  const [focusedId, setFocusedId] = useState<string | null>(null)

  // Fechou o modo reunião → limpa o destaque
  useEffect(() => {
    if (!expanded && focusedId) setFocusedId(null)
  }, [expanded, focusedId])

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

  // ── Gravação de reunião ───────────────────────────────────────────────
  // Peers que entram no meio da gravação têm o áudio plugado na hora
  useEffect(() => {
    const rec = recorderRef.current
    if (!rec?.active) return
    for (const [id, stream] of Object.entries(call.remoteStreams)) {
      rec.addStream(id, stream)
    }
  }, [call.remoteStreams])

  const stopAndSaveRecording = async () => {
    const rec = recorderRef.current
    if (!rec?.active || !me) return
    const st = useTeamStore.getState()
    st.setRecording({ on: false, byId: null, byName: null })
    realtime.sendRecording(false)
    const result = await rec.stop()
    if (!result) return
    st.addToast('Gravação salva — processando transcrição...', 'in')
    const saved = await saveRecording(
      result.videoBlob,
      result.audioBlob,
      result.durationS,
      myRoomId ? rooms.find((r) => r.id === myRoomId)?.name ?? null : null,
      me
    )
    if (saved.ok) {
      st.addToast(saved.transcribed ? 'Gravação e transcrição prontas (30 dias)' : 'Gravação salva (sem transcrição)', 'in')
    } else {
      st.addToast('Falha ao salvar a gravação', 'out')
    }
  }

  const toggleRecording = () => {
    const rec = recorderRef.current
    if (!rec || !me) return
    if (rec.active) {
      void stopAndSaveRecording()
      return
    }
    if (recording.on) return // outra pessoa já está gravando
    // Participantes pro vídeo composto (sempre o estado atual)
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
    rec.start(call.localStream, call.remoteStreams, getParticipants)
    useTeamStore.getState().setRecording({ on: true, byId: me.id, byName: me.name })
    realtime.sendRecording(true)
  }

  // Saiu da chamada/escritório gravando → para e salva
  useEffect(() => {
    if (!call.joined && recorderRef.current?.active) {
      void stopAndSaveRecording()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call.joined])

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
              },
              ...meetingPeers.map((p) => ({
                id: p.id,
                name: p.name,
                stream: call.remoteStreams[p.id] ?? null,
                camOn: p.camOn,
                mirrored: false,
                color: p.color,
                micOn: p.micOn,
              })),
            ]
            const focused = focusedId ? participants.find((p) => p.id === focusedId) : null

            if (focused) {
              const others = participants.filter((p) => p.id !== focused.id)
              return (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0 }}>
                  {/* Destaque: clique pra voltar ao grid */}
                  <div style={{ flex: 1, minHeight: 0 }}>
                    <GridTile {...focused} muted fill fit="contain" onClick={() => setFocusedId(null)} />
                  </div>
                  {others.length > 0 && (
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexShrink: 0 }}>
                      {others.map((p) => (
                        <div key={p.id} style={{ width: '176px' }}>
                          <GridTile {...p} muted onClick={() => setFocusedId(p.id)} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            }

            return (
              <div
                style={{
                  flex: 1,
                  display: 'grid',
                  gridTemplateColumns: `repeat(auto-fit, minmax(${meetingPeers.length >= 3 ? 320 : 420}px, 1fr))`,
                  gap: '14px',
                  alignContent: 'center',
                  overflowY: 'auto',
                }}
              >
                {participants.map((p) => (
                  <GridTile key={p.id} {...p} muted onClick={() => setFocusedId(p.id)} />
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
              <DockButton
                onClick={() => run(() => callManager.toggleScreenShare())}
                active={call.screenOn}
                title={call.screenOn ? 'Compartilhar tela — clique para parar' : 'Compartilhar tela — mostrar sua tela pra sala'}
              >
                🖥️
              </DockButton>
              <DockButton
                onClick={toggleRecording}
                danger={recording.on && recording.byId === me?.id}
                title={
                  recording.on
                    ? recording.byId === me?.id
                      ? 'Gravar reunião — clique para parar'
                      : `Gravação em andamento por ${recording.byName}`
                    : 'Gravar reunião — vídeo + transcrição e ata (30 dias, acesso admin)'
                }
              >
                ⏺
              </DockButton>
            </>
          )}
        </div>
      </div>

      {/* Indicador de gravação — visível pra TODOS */}
      {recording.on && (
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
          Gravando — {recording.byName}
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
