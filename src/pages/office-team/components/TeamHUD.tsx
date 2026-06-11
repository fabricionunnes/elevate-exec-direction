// HUD do escritório multiplayer: voltar, equipe online/offline, dicas e chat.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { useTeamStore } from '../store/useTeamStore'
import type { TeamRealtime } from '../lib/realtime'

interface TeamMember {
  user_id: string
  name: string
  title: string | null
}

export default function TeamHUD({ realtime }: { realtime: TeamRealtime }) {
  const navigate = useNavigate()
  const me = useTeamStore((s) => s.me)
  const remotePlayers = useTeamStore((s) => s.remotePlayers)
  const toggleChat = useTeamStore((s) => s.toggleChat)
  const chatOpen = useTeamStore((s) => s.chatOpen)
  const unreadCount = useTeamStore((s) => s.unreadCount)
  const [directory, setDirectory] = useState<TeamMember[]>([])

  // Diretório do time (staff ativo) — pra mostrar também quem está offline
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { data } = await supabase.from('office_team_directory' as never).select('*')
      if (!cancelled && data) setDirectory(data as unknown as TeamMember[])
    }
    void load()
    const interval = setInterval(load, 120_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  const others = Object.values(remotePlayers)
  const onlineCount = others.length + 1
  const onlineIds = new Set([me?.id, ...others.map((p) => p.id)])
  const offline = directory.filter((m) => !onlineIds.has(m.user_id))

  const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

  return (
    <>
      {/* Topo esquerdo: voltar + título + online */}
      <div
        style={{
          position: 'fixed',
          top: '16px',
          left: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          zIndex: 95,
          fontFamily: font,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => navigate('/onboarding-tasks')}
            title="Voltar ao Nexus"
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(10,10,20,0.85)',
              color: '#fff',
              fontSize: '16px',
              cursor: 'pointer',
              backdropFilter: 'blur(12px)',
            }}
          >
            ←
          </button>
          <div
            style={{
              background: 'rgba(10,10,20,0.85)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '10px',
              padding: '8px 14px',
              color: '#fff',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '14px' }}>
              UNV <span style={{ color: '#FFD700' }}>Office</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#4CAF50', boxShadow: '0 0 6px #4CAF50' }} />
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>
                {onlineCount} online
              </span>
            </div>
          </div>
        </div>

        {/* Lista de quem está no escritório */}
        <div
          style={{
            background: 'rgba(10,10,20,0.8)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '10px',
            padding: '10px 12px',
            maxWidth: '230px',
            maxHeight: '40vh',
            overflowY: 'auto',
          }}
        >
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
            Equipe · {onlineCount} online
          </div>

          {/* Online */}
          {me && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4CAF50', boxShadow: '0 0 5px #4CAF50', flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '12px', color: '#FFD700', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {me.name} (você)
                </div>
                {me.role && <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)' }}>{me.role}</div>}
              </div>
            </div>
          )}
          {others.map((p) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4CAF50', boxShadow: '0 0 5px #4CAF50', flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '12px', color: '#eee', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p.name}
                </div>
                {p.role && <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)' }}>{p.role}</div>}
              </div>
              {p.inCall && <span style={{ fontSize: '11px' }}>{p.micOn ? '🎙️' : '🔇'}</span>}
              <button
                onClick={() => realtime.sendRing(p.id)}
                title={`Tocar a campainha de ${p.name}`}
                style={{
                  background: 'rgba(255,215,0,0.12)',
                  border: '1px solid rgba(255,215,0,0.35)',
                  borderRadius: '6px',
                  width: '24px',
                  height: '24px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  flexShrink: 0,
                  padding: 0,
                }}
              >
                🔔
              </button>
            </div>
          ))}

          {/* Marcelo — IA sempre disponível */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#7fd4ff', boxShadow: '0 0 5px #7fd4ff', flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '12px', color: '#7fd4ff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                🤖 Marcelo Almeida
              </div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)' }}>Consultor · IA · sempre on</div>
            </div>
          </div>

          {/* Offline */}
          {offline.length > 0 && (
            <>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '10px 0 6px' }}>
                Offline
              </div>
              {offline.map((m) => (
                <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px', opacity: 0.45 }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#9aa3ad', flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '12px', color: '#ccc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {m.name}
                    </div>
                    {m.title && <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>{m.title}</div>}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Botão de chat — canto inferior direito */}
      {!chatOpen && (
        <button
          onClick={toggleChat}
          title="Chat do escritório"
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            border: '1px solid rgba(255,215,0,0.4)',
            background: 'rgba(10,10,20,0.9)',
            color: '#fff',
            fontSize: '20px',
            cursor: 'pointer',
            zIndex: 95,
            backdropFilter: 'blur(12px)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          }}
        >
          💬
          {unreadCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                background: '#CC1B1B',
                color: '#fff',
                fontSize: '10px',
                fontWeight: 700,
                borderRadius: '999px',
                minWidth: '18px',
                height: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 4px',
                fontFamily: font,
              }}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Dica de controles — base esquerda */}
      <div
        style={{
          position: 'fixed',
          bottom: '20px',
          left: '16px',
          background: 'rgba(10,10,20,0.75)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '10px',
          padding: '8px 12px',
          color: 'rgba(255,255,255,0.55)',
          fontSize: '11px',
          zIndex: 90,
          fontFamily: font,
        }}
      >
        WASD / duplo clique = andar · Arrastar = olhar o escritório · X = minha sala · Z = trancar · Scroll = zoom
      </div>
    </>
  )
}
