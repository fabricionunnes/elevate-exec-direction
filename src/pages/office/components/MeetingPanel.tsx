// Painel "Sala de Reunião — ao vivo": mostra o bate-papo entre os agentes
// durante reuniões (alimentado por realtime em office_meeting_messages).
import { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useGameStore } from '../store/useGameStore'
import { AGENTS } from '../config/agents'

const AGENT_LABELS: Record<string, { name: string; color: string }> = {
  max: { name: 'MAX · CEO', color: '#5B7FD4' },
  noah: { name: 'Noah · Financeiro', color: '#2FA35D' },
  sophia: { name: 'Sophia · CRM', color: '#3E7BD6' },
  melissa: { name: 'Melissa · Projetos', color: '#9B59D0' },
  luna: { name: 'Luna · Marketing', color: '#E08A2E' },
  cris: { name: 'Cris · Gerente', color: '#1FA8A8' },
  mika: { name: 'Mika · Social', color: '#E04E8A' },
  system: { name: 'Sistema', color: '#888888' },
}

function labelFor(agent: string) {
  if (AGENT_LABELS[agent]) return AGENT_LABELS[agent]
  const cfg = AGENTS.find((a) => a.id === agent || a.apiType === agent)
  return cfg ? { name: `${cfg.name} · ${cfg.role}`, color: cfg.color } : { name: agent, color: '#aaaaaa' }
}

export default function MeetingPanel() {
  const { meetingMessages, meetingTriggered, meetingPanelVisible, setMeetingPanelVisible } = useGameStore()
  const endRef = useRef<HTMLDivElement>(null!)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [meetingMessages])

  if (!meetingPanelVisible || meetingMessages.length === 0) return null

  const live = meetingTriggered

  return (
    <div
      style={{
        position: 'fixed',
        top: '86px',
        left: '16px',
        width: '400px',
        maxHeight: 'calc(100vh - 102px)',
        background: 'rgba(10, 10, 20, 0.96)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(139, 69, 19, 0.5)',
        borderRadius: '14px',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 90,
        boxShadow: '0 8px 40px rgba(0, 0, 0, 0.45)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <style>{`
        .meeting-md p { margin: 0 0 6px; }
        .meeting-md p:last-child { margin-bottom: 0; }
        .meeting-md ul, .meeting-md ol { margin: 4px 0; padding-left: 18px; }
        .meeting-md strong { color: #fff; }
        @keyframes meeting-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
      `}</style>

      {/* Header */}
      <div
        style={{
          padding: '14px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <div style={{ fontSize: '18px' }}>📊</div>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: '14px' }}>Sala de Reunião</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
            <div
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: live ? '#e53935' : '#777',
                animation: live ? 'meeting-pulse 1.2s infinite' : undefined,
              }}
            />
            <span style={{ color: live ? '#ef9a9a' : '#999', fontSize: '11px', fontWeight: 600 }}>
              {live ? 'AO VIVO' : 'Encerrada'}
            </span>
          </div>
        </div>
        <button
          onClick={() => setMeetingPanelVisible(false)}
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: '#888',
            width: '28px',
            height: '28px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {meetingMessages.map((m) => {
          const who = labelFor(m.agent)
          return (
            <div key={m.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <div
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '6px',
                    background: who.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#fff',
                    flexShrink: 0,
                  }}
                >
                  {who.name[0]}
                </div>
                <span style={{ color: who.color, fontSize: '12px', fontWeight: 700 }}>{who.name}</span>
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', marginLeft: 'auto' }}>
                  {new Date(m.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div
                className="meeting-md"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${who.color}33`,
                  borderRadius: '10px',
                  padding: '10px 12px',
                  color: 'rgba(255,255,255,0.88)',
                  fontSize: '12.5px',
                  lineHeight: 1.5,
                  whiteSpace: 'normal',
                  wordBreak: 'break-word',
                }}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>
    </div>
  )
}
