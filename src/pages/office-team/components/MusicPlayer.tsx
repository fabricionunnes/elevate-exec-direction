// Música lofi por sala (YouTube IFrame API).
// A sala guarda music_on/music_video_id no banco; quem está DENTRO dela
// (inclusive visitas) toca o player localmente. O dono liga/desliga pra
// todos (broadcast 'rooms'); o volume é de cada ouvinte (localStorage).
import { useEffect, useRef, useState } from 'react'
import { useTeamStore } from '../store/useTeamStore'
import { roomAt, setRoomMusic } from '../lib/rooms'
import type { TeamRealtime } from '../lib/realtime'

const VOL_KEY = 'office-music-volume'

// ── Tipos mínimos da IFrame API ──
interface YTPlayer {
  destroy: () => void
  playVideo: () => void
  setVolume: (v: number) => void
  getPlayerState: () => number
}
interface YTNamespace {
  Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer
  PlayerState: { PLAYING: number }
}
declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

let ytPromise: Promise<YTNamespace> | null = null
function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (!ytPromise) {
    ytPromise = new Promise((resolve) => {
      const prev = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => {
        prev?.()
        if (window.YT) resolve(window.YT)
      }
      const s = document.createElement('script')
      s.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(s)
    })
  }
  return ytPromise
}

export default function MusicPlayer({ realtime }: { realtime: TeamRealtime }) {
  const me = useTeamStore((s) => s.me)
  const rooms = useTeamStore((s) => s.rooms)
  const playerPosition = useTeamStore((s) => s.playerPosition)

  // Sala em que estou agora (pela posição — mesma regra do áudio espacial)
  const currentRoom = roomAt(playerPosition[0], playerPosition[2], rooms) ?? null
  const isOwner = !!currentRoom && !!me && currentRoom.ownerUserId === me.id
  const playingRoom = currentRoom && currentRoom.musicOn ? currentRoom : null

  const [volume, setVolume] = useState<number>(() => {
    const saved = Number(localStorage.getItem(VOL_KEY))
    return Number.isFinite(saved) && saved > 0 ? saved : 35
  })
  const [needsClick, setNeedsClick] = useState(false)
  const [busy, setBusy] = useState(false)
  const holderRef = useRef<HTMLDivElement | null>(null)
  const playerRef = useRef<YTPlayer | null>(null)
  const volumeRef = useRef(volume)
  volumeRef.current = volume

  // Chave que define quando montar/desmontar o player
  const playKey = playingRoom ? `${playingRoom.id}:${playingRoom.musicVideoId}` : null

  useEffect(() => {
    if (!playKey || !playingRoom) return
    let cancelled = false
    let checkTimer: ReturnType<typeof setTimeout> | null = null

    void loadYouTubeApi().then((YT) => {
      if (cancelled || !holderRef.current) return
      const el = document.createElement('div')
      holderRef.current.appendChild(el)
      const player = new YT.Player(el, {
        width: '208',
        height: '117',
        videoId: playingRoom.musicVideoId,
        playerVars: { autoplay: 1, controls: 0, disablekb: 1, rel: 0, playsinline: 1 },
        events: {
          onReady: () => {
            if (cancelled) return
            player.setVolume(volumeRef.current)
            player.playVideo()
            // Autoplay bloqueado pelo navegador? Mostra o botão ▶
            checkTimer = setTimeout(() => {
              if (!cancelled && player.getPlayerState() !== 1) setNeedsClick(true)
            }, 1800)
          },
          onStateChange: (e: { data: number }) => {
            if (e.data === 1) setNeedsClick(false)
          },
        },
      })
      playerRef.current = player
    })

    return () => {
      cancelled = true
      if (checkTimer) clearTimeout(checkTimer)
      playerRef.current?.destroy()
      playerRef.current = null
      setNeedsClick(false)
      if (holderRef.current) holderRef.current.innerHTML = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playKey])

  useEffect(() => {
    localStorage.setItem(VOL_KEY, String(volume))
    playerRef.current?.setVolume(volume)
  }, [volume])

  const toggleMusic = async (on: boolean) => {
    if (!currentRoom || busy) return
    setBusy(true)
    const ok = await setRoomMusic(currentRoom.id, on)
    if (ok) realtime.announceRoomsChanged()
    setBusy(false)
  }

  // Nada a mostrar: fora de sala, ou sala sem música e eu não sou o dono
  if (!currentRoom || (!playingRoom && !isOwner)) return null

  const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '64px',
        left: '16px',
        zIndex: 96,
        background: 'rgba(10,10,20,0.88)',
        backdropFilter: 'blur(14px)',
        border: '1px solid rgba(255,255,255,0.14)',
        borderRadius: '14px',
        padding: '10px',
        width: '228px',
        fontFamily: font,
        color: '#fff',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: playingRoom ? '8px' : 0 }}>
        <span style={{ fontSize: '15px' }}>🎵</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Lofi · {currentRoom.name}
          </div>
          {playingRoom && (
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>tocando pra quem está na sala</div>
          )}
        </div>
        {isOwner && (
          <button
            onClick={() => void toggleMusic(!currentRoom.musicOn)}
            disabled={busy}
            title={currentRoom.musicOn ? 'Desligar a música da sala' : 'Ligar a música da sala'}
            style={{
              background: currentRoom.musicOn ? '#2e7d32' : 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: '999px',
              padding: '5px 10px',
              color: '#fff',
              fontSize: '11px',
              fontWeight: 700,
              cursor: busy ? 'wait' : 'pointer',
              flexShrink: 0,
            }}
          >
            {currentRoom.musicOn ? 'ON' : 'OFF'}
          </button>
        )}
      </div>

      {playingRoom && (
        <>
          <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', background: '#000' }}>
            <div ref={holderRef} />
            {needsClick && (
              <button
                onClick={() => {
                  playerRef.current?.playVideo()
                  setNeedsClick(false)
                }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0,0,0,0.55)',
                  border: 'none',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ▶ Tocar música
              </button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
            <span style={{ fontSize: '12px' }}>🔊</span>
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              style={{ flex: 1, accentColor: '#FFD700' }}
            />
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', width: '28px', textAlign: 'right' }}>
              {volume}
            </span>
          </div>
        </>
      )}
    </div>
  )
}
