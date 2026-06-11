import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../store/useGameStore'
import { AGENTS } from '../config/agents'
import { OFFICE_BOUNDS } from '../config/office'

const STATE_ICONS: Record<string, string> = {
  IDLE: '💼',
  WALKING: '🚶',
  COFFEE: '☕',
  MEETING: '📊',
  WORKING: '💻',
}

function Minimap() {
  const { agentStates, playerPosition } = useGameStore()

  const mapWidth = 180
  const mapHeight = 140
  const padding = 8

  const boundsW = OFFICE_BOUNDS.maxX - OFFICE_BOUNDS.minX
  const boundsH = OFFICE_BOUNDS.maxZ - OFFICE_BOUNDS.minZ

  const toMapX = (worldX: number) =>
    padding + ((worldX - OFFICE_BOUNDS.minX) / boundsW) * (mapWidth - padding * 2)
  const toMapZ = (worldZ: number) =>
    padding + ((worldZ - OFFICE_BOUNDS.minZ) / boundsH) * (mapHeight - padding * 2)

  return (
    <div
      style={{
        position: 'relative',
        width: `${mapWidth}px`,
        height: `${mapHeight}px`,
        background: 'rgba(10, 10, 20, 0.92)',
        borderRadius: '10px',
        border: '1px solid rgba(255,255,255,0.15)',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      }}
    >
      {/* Room backgrounds */}
      {[
        { label: 'CEO', x: 0, z: 0, w: 43, h: 31, color: 'rgba(27,41,81,0.35)' },
        { label: 'FIN', x: 55, z: 0, w: 30, h: 31, color: 'rgba(27,107,58,0.35)' },
        { label: 'CRM', x: 0, z: 31, w: 30, h: 31, color: 'rgba(26,74,138,0.35)' },
        { label: 'PRJ', x: 55, z: 31, w: 40, h: 31, color: 'rgba(107,47,160,0.35)' },
        { label: 'MTG', x: 15, z: 62, w: 60, h: 22, color: 'rgba(139,69,19,0.35)' },
        { label: 'CFE', x: 0, z: 84, w: 22, h: 28, color: 'rgba(139,105,20,0.35)' },
        { label: 'MKT', x: 28, z: 84, w: 30, h: 28, color: 'rgba(184,92,0,0.35)' },
        { label: 'CRE', x: 68, z: 84, w: 30, h: 28, color: 'rgba(194,24,91,0.35)' },
      ].map((room, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${room.x + padding}px`,
            top: `${room.z + padding}px`,
            width: `${room.w}px`,
            height: `${room.h}px`,
            background: room.color,
            borderRadius: '2px',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        />
      ))}

      {/* Agent dots */}
      {AGENTS.map((agent) => {
        const state = agentStates[agent.id]
        if (!state) return null
        const x = toMapX(state.position[0])
        const z = toMapZ(state.position[2])
        return (
          <div
            key={agent.id}
            title={`${agent.name} (${state.state})`}
            style={{
              position: 'absolute',
              left: `${x - 4}px`,
              top: `${z - 4}px`,
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: agent.color,
              border: '1px solid rgba(255,255,255,0.5)',
              boxShadow: `0 0 6px ${agent.color}`,
              transition: 'left 0.3s, top 0.3s',
            }}
          />
        )
      })}

      {/* Player dot */}
      <div
        style={{
          position: 'absolute',
          left: `${toMapX(playerPosition[0]) - 5}px`,
          top: `${toMapZ(playerPosition[2]) - 5}px`,
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: '#FFD700',
          border: '1.5px solid #fff',
          boxShadow: '0 0 8px #FFD700',
          transition: 'left 0.05s, top 0.05s',
          zIndex: 10,
        }}
      />

      {/* Label */}
      <div
        style={{
          position: 'absolute',
          bottom: '4px',
          left: '0',
          right: '0',
          textAlign: 'center',
          fontSize: '9px',
          color: 'rgba(255,255,255,0.35)',
          letterSpacing: '1px',
          textTransform: 'uppercase',
        }}
      >
        UNV Office
      </div>
    </div>
  )
}

function AgentStatusList() {
  const { agentStates } = useGameStore()

  return (
    <div
      style={{
        background: 'rgba(10,10,20,0.85)',
        borderRadius: '10px',
        border: '1px solid rgba(255,255,255,0.1)',
        padding: '10px',
        minWidth: '200px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      }}
    >
      <div
        style={{
          fontSize: '10px',
          color: 'rgba(255,255,255,0.4)',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          marginBottom: '8px',
          paddingBottom: '6px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        Team Status
      </div>
      {AGENTS.map((agent) => {
        const state = agentStates[agent.id]
        return (
          <div
            key={agent.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 0',
            }}
          >
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: agent.color,
                flexShrink: 0,
                boxShadow: `0 0 5px ${agent.color}`,
              }}
            />
            <div style={{ flex: 1, fontSize: '12px', color: '#ddd' }}>{agent.name}</div>
            <div style={{ fontSize: '11px' }}>{state ? STATE_ICONS[state.state] || '💼' : '💼'}</div>
            <div
              style={{
                fontSize: '10px',
                color: 'rgba(255,255,255,0.4)',
                minWidth: '50px',
                textAlign: 'right',
              }}
            >
              {state?.state || 'IDLE'}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ControlsHint() {
  const { chat } = useGameStore()

  if (chat.isOpen) return null

  return (
    <div
      style={{
        background: 'rgba(10,10,20,0.75)',
        borderRadius: '10px',
        border: '1px solid rgba(255,255,255,0.08)',
        padding: '10px 14px',
        fontSize: '11px',
        color: 'rgba(255,255,255,0.5)',
        lineHeight: '1.8',
      }}
    >
      <div style={{ color: 'rgba(255,255,255,0.7)', fontWeight: '600', marginBottom: '4px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
        Controls
      </div>
      <div>
        <span style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '4px', padding: '1px 6px', marginRight: '6px', fontFamily: 'monospace' }}>WASD</span>
        Move
      </div>
      <div>
        <span style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '4px', padding: '1px 6px', marginRight: '6px', fontFamily: 'monospace' }}>E</span>
        Talk to agent
      </div>
      <div>
        <span style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '4px', padding: '1px 6px', marginRight: '6px', fontFamily: 'monospace' }}>Esc</span>
        Close chat
      </div>
      <div>
        <span style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '4px', padding: '1px 6px', marginRight: '6px', fontFamily: 'monospace' }}>Scroll</span>
        Zoom in/out
      </div>
      <div>
        <span style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '4px', padding: '1px 6px', marginRight: '6px', fontFamily: 'monospace' }}>Right drag</span>
        Pan view
      </div>
    </div>
  )
}

function MeetingBanner() {
  const { meetingTriggered } = useGameStore()
  if (!meetingTriggered) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(139,69,19,0.95)',
        border: '2px solid #FFD700',
        borderRadius: '12px',
        padding: '10px 24px',
        color: '#FFD700',
        fontSize: '16px',
        fontWeight: '700',
        boxShadow: '0 4px 30px rgba(139,69,19,0.6)',
        zIndex: 200,
        letterSpacing: '0.5px',
        animation: 'pulse-banner 2s infinite',
      }}
    >
      📊 All-Hands Meeting — Agents heading to meeting room
      <style>{`
        @keyframes pulse-banner {
          0%, 100% { box-shadow: 0 4px 30px rgba(139,69,19,0.6); }
          50% { box-shadow: 0 4px 50px rgba(255,215,0,0.5); }
        }
      `}</style>
    </div>
  )
}

function Title() {
  const navigate = useNavigate()
  return (
    <div
      style={{
        position: 'fixed',
        top: '16px',
        left: '16px',
        background: 'rgba(10,10,20,0.85)',
        borderRadius: '12px',
        border: '1px solid rgba(27,41,81,0.6)',
        padding: '8px 14px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}
    >
      <img
        src="/unv-logo.png"
        alt="UNV"
        style={{ height: '36px', width: 'auto', objectFit: 'contain', background: '#fff', borderRadius: '8px', padding: '3px' }}
      />
      <div>
        <div style={{ fontSize: '13px', fontWeight: '800', color: '#fff', letterSpacing: '0.5px' }}>
          Office <span style={{ color: '#FFD700' }}>3D</span>
        </div>
        <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginTop: '1px', letterSpacing: '0.5px' }}>
          Virtual HQ
        </div>
      </div>
      <button
        onClick={() => navigate('/onboarding-tasks')}
        title="Voltar ao UNV Nexus"
        style={{
          marginLeft: '8px',
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.18)',
          color: 'rgba(255,255,255,0.85)',
          borderRadius: '8px',
          padding: '6px 10px',
          fontSize: '11px',
          fontWeight: 600,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => {
          ;(e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.18)'
        }}
        onMouseLeave={(e) => {
          ;(e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)'
        }}
      >
        ← Voltar ao Nexus
      </button>
    </div>
  )
}

export default function HUD() {
  return (
    <>
      <Title />
      <MeetingBanner />

      {/* Bottom-right minimap */}
      <div
        style={{
          position: 'fixed',
          bottom: '16px',
          right: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          alignItems: 'flex-end',
          zIndex: 50,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <Minimap />
      </div>

      {/* Top-right agent status */}
      <div
        style={{
          position: 'fixed',
          top: '16px',
          right: '16px',
          zIndex: 50,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <AgentStatusList />
      </div>

      {/* Bottom-left controls */}
      <div
        style={{
          position: 'fixed',
          bottom: '16px',
          left: '16px',
          zIndex: 50,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <ControlsHint />
      </div>
    </>
  )
}
