// HUD do escritório multiplayer: voltar, quem está online, dicas e botão de chat.
import { useNavigate } from 'react-router-dom'
import { useTeamStore } from '../store/useTeamStore'

export default function TeamHUD() {
  const navigate = useNavigate()
  const me = useTeamStore((s) => s.me)
  const remotePlayers = useTeamStore((s) => s.remotePlayers)
  const toggleChat = useTeamStore((s) => s.toggleChat)
  const chatOpen = useTeamStore((s) => s.chatOpen)
  const unreadCount = useTeamStore((s) => s.unreadCount)

  const others = Object.values(remotePlayers)
  const onlineCount = others.length + 1

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
            No escritório
          </div>
          {me && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: me.color, flexShrink: 0 }} />
              <span style={{ fontSize: '12px', color: '#FFD700', fontWeight: 600 }}>{me.name} (você)</span>
            </div>
          )}
          {others.map((p) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: p.color, flexShrink: 0 }} />
              <span style={{ fontSize: '12px', color: '#eee', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {p.name}
              </span>
              {p.inCall && <span style={{ fontSize: '11px' }}>{p.micOn ? '🎙️' : '🔇'}</span>}
            </div>
          ))}
          {others.length === 0 && (
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>Só você por enquanto</div>
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
        WASD / setas ou duplo clique para andar · X = ir pra minha sala · Scroll para zoom · Botão direito move a câmera
      </div>
    </>
  )
}
