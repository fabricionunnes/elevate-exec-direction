// Dock de chamada (áudio/vídeo) + tiles de vídeo dos participantes.
// Áudio dos peers toca em <audio> ocultos; vídeo aparece quando camOn.
import { useEffect, useRef, useState } from 'react'
import { useTeamStore } from '../store/useTeamStore'
import type { CallManager } from '../lib/webrtc'

function MediaAudio({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement>(null!)
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) {
      ref.current.srcObject = stream
    }
  }, [stream])
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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inCallCount = Object.values(remotePlayers).filter((p) => p.inCall).length + (call.joined ? 1 : 0)

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

  const remoteTiles = Object.values(remotePlayers).filter(
    (p) => p.inCall && p.camOn && call.remoteStreams[p.id]
  )

  return (
    <>
      {/* Áudio dos peers (sempre que houver stream) */}
      {call.joined &&
        Object.entries(call.remoteStreams).map(([id, stream]) => <MediaAudio key={id} stream={stream} />)}

      {/* Tiles de vídeo — topo central */}
      {call.joined && (remoteTiles.length > 0 || (call.camOn && call.localStream)) && (
        <div
          style={{
            position: 'fixed',
            top: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '10px',
            zIndex: 90,
            maxWidth: 'calc(100vw - 420px)',
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
          zIndex: 95,
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
              📞 Entrar na chamada
              {inCallCount > 0 && (
                <span
                  style={{
                    background: 'rgba(255,255,255,0.25)',
                    borderRadius: '999px',
                    padding: '1px 8px',
                    fontSize: '11px',
                  }}
                >
                  {inCallCount} na chamada
                </span>
              )}
            </button>
          ) : (
            <>
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
                {call.camOn ? '📹' : '🚫'}
              </DockButton>
              <DockButton onClick={() => run(() => callManager.leaveCall())} danger title="Sair da chamada">
                ✕
              </DockButton>
            </>
          )}
        </div>
      </div>
    </>
  )
}
