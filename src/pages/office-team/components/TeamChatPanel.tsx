// Chat de texto do escritório — todos os usuários online no canal.
import { useState, useRef, useEffect, useCallback } from 'react'
import { useTeamStore } from '../store/useTeamStore'
import type { TeamRealtime } from '../lib/realtime'

export default function TeamChatPanel({ realtime }: { realtime: TeamRealtime }) {
  const chatOpen = useTeamStore((s) => s.chatOpen)
  const toggleChat = useTeamStore((s) => s.toggleChat)
  const messages = useTeamStore((s) => s.chatMessages)
  const me = useTeamStore((s) => s.me)
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null!)
  const inputRef = useRef<HTMLInputElement>(null!)

  useEffect(() => {
    if (chatOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [chatOpen])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatOpen])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && chatOpen) toggleChat()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [chatOpen, toggleChat])

  const sendMessage = useCallback(() => {
    const text = input.trim()
    if (!text) return
    setInput('')
    void realtime.sendChat(text)
  }, [input, realtime])

  if (!chatOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: '360px',
        height: '100vh',
        background: 'rgba(10, 10, 20, 0.97)',
        backdropFilter: 'blur(20px)',
        borderLeft: '2px solid rgba(255, 215, 0, 0.35)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        boxShadow: '-8px 0 40px rgba(0,0,0,0.4)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        animation: 'team-chat-slide 0.2s ease-out',
      }}
    >
      <style>{`
        @keyframes team-chat-slide {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>

      {/* Header */}
      <div
        style={{
          padding: '18px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.12)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div style={{ fontSize: '22px' }}>💬</div>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: '15px' }}>Chat do Escritório</div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginTop: '2px' }}>
            Visível para todos que estão online
          </div>
        </div>
        <button
          onClick={toggleChat}
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: '#888',
            width: '30px',
            height: '30px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '15px',
          }}
        >
          ✕
        </button>
      </div>

      {/* Mensagens */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>
            Nenhuma mensagem ainda. Diga oi pro time!
          </div>
        )}

        {messages.map((msg) => {
          const isMine = msg.userId === me?.id
          return (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
              <div
                style={{
                  maxWidth: '85%',
                  padding: '8px 12px',
                  borderRadius: isMine ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                  background: isMine ? 'rgba(255, 215, 0, 0.14)' : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${isMine ? 'rgba(255,215,0,0.3)' : 'rgba(255,255,255,0.1)'}`,
                  fontSize: '13px',
                  lineHeight: 1.45,
                  color: '#f0f0f0',
                }}
              >
                {!isMine && (
                  <div style={{ fontSize: '11px', fontWeight: 700, color: msg.color, marginBottom: '3px' }}>
                    {msg.name}
                  </div>
                )}
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.content}</div>
                <div style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.3)', marginTop: '3px', textAlign: 'right' }}>
                  {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '14px', borderTop: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)' }}>
        <div
          style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: '12px',
            padding: '8px 12px',
          }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            placeholder="Mensagem para o time..."
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              color: '#f0f0f0',
              fontSize: '13px',
              fontFamily: 'inherit',
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            style={{
              background: input.trim() ? '#B8860B' : 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '8px',
              width: '30px',
              height: '30px',
              cursor: input.trim() ? 'pointer' : 'not-allowed',
              color: '#fff',
              fontSize: '13px',
            }}
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  )
}
