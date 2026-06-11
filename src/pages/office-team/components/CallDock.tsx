// Dock de chamada (áudio/vídeo) + tiles de vídeo dos participantes.
// ÁUDIO ESPACIAL: você só ouve quem está na MESMA SALA; em área aberta
// (corredores), o volume cai com a distância; salas diferentes = silêncio.
import { useEffect, useRef, useState } from 'react'
import { useTeamStore, RemotePlayerState } from '../store/useTeamStore'
import { roomAt, OfficeRoom } from '../lib/rooms'
import type { CallManager } from '../lib/webrtc'

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
    if (ref.current && ref.current.srcObject !== stream) {
      ref.current.srcObject = stream
    }
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
}: {
  stream: MediaStream | null
  name: string
  camOn: boolean
  muted: boolean
  mirrored?: boolean
  color: string
  micOn: boolean
}) {
  const ref = useRef<HTMLVideoElement>(null!)
  useEffect(() => {
    if (ref.current && stream && ref.current.srcObject !== stream) {
      ref.current.srcObject = stream
    }
  }, [stream])
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16 / 10',
        borderRadius: '14px',
        overflow: 'hidden',
        background: '#101218',
        border: '1px solid rgba(255,255,255,0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
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
            objectFit: 'cover',
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
  return (
    <button
      onClick={onClick}
      title={title}
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
  )
}

export default function CallDock({ callManager }: { callManager: CallManager }) {
  const call = useTeamStore((s) => s.call)
  const remotePlayers = useTeamStore((s) => s.remotePlayers)
  const me = useTeamStore((s) => s.me)
  const myRoomId = useTeamStore((s) => s.myRoomId)
  const rooms = useTeamStore((s) => s.rooms)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [volumes, setVolumes] = useState<Record<string, number>>({})
  const [expanded, setExpanded] = useState(false)

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

  const inCallCount = Object.values(remotePlayers).filter((p) => p.inCall).length + (call.joined ? 1 : 0)
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
            <GridTile
              stream={call.localStream}
              name={`${me?.name ?? 'Você'} (você)`}
              camOn={call.camOn}
              muted
              mirrored
              color={me?.color ?? '#1A4A8A'}
              micOn={call.micOn}
            />
            {meetingPeers.map((p) => (
              <GridTile
                key={p.id}
                stream={call.remoteStreams[p.id] ?? null}
                name={p.name}
                camOn={p.camOn}
                muted
                color={p.color}
                micOn={p.micOn}
              />
            ))}
          </div>
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
            <VideoTile stream={call.localStream} label={`${me?.name ?? 'Você'} (você)`} muted mirrored />
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
            <button
              onClick={() => run(() => callManager.joinCall())}
              disabled={busy}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#2e7d32',
                border: 'none',
                borderRadius: '999px',
                padding: '10px 18px',
                color: '#fff',
                fontWeight: 700,
                fontSize: '13px',
                cursor: busy ? 'wait' : 'pointer',
              }}
            >
              🎙️ Ativar voz
              {inCallCount > 0 && (
                <span
                  style={{
                    background: 'rgba(255,255,255,0.25)',
                    borderRadius: '999px',
                    padding: '1px 8px',
                    fontSize: '11px',
                  }}
                >
                  {inCallCount} com voz ativa
                </span>
              )}
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
                title={call.micOn ? 'Desativar microfone' : 'Ativar microfone'}
              >
                {call.micOn ? '🎙️' : '🔇'}
              </DockButton>
              <DockButton
                onClick={() => run(() => callManager.toggleCam())}
                active={call.camOn}
                title={call.camOn ? 'Desligar câmera' : 'Ligar câmera'}
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
              <DockButton onClick={() => run(() => callManager.leaveCall())} danger title="Desativar voz">
                ✕
              </DockButton>
            </>
          )}
        </div>
      </div>
    </>
  )
}
