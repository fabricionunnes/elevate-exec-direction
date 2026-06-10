// Painel de conversa com o Marcelo Almeida (agente IA) — chama o branch
// webchat do marcelo-webhook com o token de sessão do Nexus.
import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { supabase } from '@/integrations/supabase/client'
import { useTeamStore } from '../store/useTeamStore'

const MARCELO_URL = 'https://kktocqnwlmmxjzgmnxgs.supabase.co/functions/v1/marcelo-webhook?webchat=1'
const ACCENT = '#7fd4ff'

interface NpcMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export default function MarceloChatPanel() {
  const open = useTeamStore((s) => s.npcChatOpen)
  const setOpen = useTeamStore((s) => s.setNpcChatOpen)
  const me = useTeamStore((s) => s.me)
  const [messages, setMessages] = useState<NpcMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null!)
  const inputRef = useRef<HTMLInputElement>(null!)

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return
    const userMsg: NpcMessage = { id: crypto.randomUUID(), role: 'user', content: text, timestamp: Date.now() }
    const history = [...messages, userMsg]
    setMessages(history)
    setInput('')
    setLoading(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) throw new Error('sem sessão')
      const res = await fetch(MARCELO_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
          senderName: me?.name,
        }),
      })
      const data = await res.json()
      const reply =
        data?.reply || (data?.ok === false ? `Não consegui responder agora (${data.error}).` : 'Não consegui responder agora.')
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: reply, timestamp: Date.now() },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Caiu a conexão aqui. Tenta de novo em instantes.',
          timestamp: Date.now(),
        },
      ])
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, me])

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: '380px',
        height: '100vh',
        background: 'rgba(10, 10, 20, 0.97)',
        backdropFilter: 'blur(20px)',
        borderLeft: `2px solid rgba(127, 212, 255, 0.45)`,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 102,
        boxShadow: '-8px 0 40px rgba(13, 43, 94, 0.3)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <style>{`
        @keyframes npc-pulse {
          0%, 80%, 100% { transform: scale(0); opacity: 0.5; }
          40% { transform: scale(1); opacity: 1; }
        }
        .npc-dot { animation: npc-pulse 1.4s infinite ease-in-out both; }
        .npc-dot:nth-child(1) { animation-delay: -0.32s; }
        .npc-dot:nth-child(2) { animation-delay: -0.16s; }
        .npc-md > *:first-child { margin-top: 0; }
        .npc-md > *:last-child { margin-bottom: 0; }
        .npc-md p { margin: 0 0 10px 0; }
        .npc-md strong { color: #fff; }
        .npc-md ul, .npc-md ol { margin: 0 0 10px 0; padding-left: 18px; }
        .npc-md li { margin: 0 0 5px 0; }
      `}</style>

      {/* Header */}
      <div
        style={{
          padding: '18px 20px',
          borderBottom: '1px solid rgba(127, 212, 255, 0.25)',
          background: 'linear-gradient(135deg, rgba(13,43,94,0.4) 0%, rgba(10,10,20,0) 100%)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
        }}
      >
        <div
          style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: '#0D2B5E',
            border: `1px solid ${ACCENT}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '19px',
            fontWeight: 800,
            color: '#fff',
            flexShrink: 0,
          }}
        >
          M
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: '15px' }}>Marcelo Almeida</div>
          <div style={{ color: ACCENT, fontSize: '11.5px', marginTop: '2px' }}>Consultor Comercial · IA</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#4CAF50', boxShadow: '0 0 6px #4CAF50' }} />
            <span style={{ color: '#4CAF50', fontSize: '11px' }}>Sempre disponível</span>
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
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
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(255,255,255,0.35)', fontSize: '13px' }}>
            <div style={{ fontSize: '34px', marginBottom: '10px' }}>💼</div>
            Fala com o Marcelo — vendas, metas, KPIs, tarefas e estratégia comercial.
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} style={{ display: 'flex', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', gap: '8px', alignItems: 'flex-end' }}>
            <div
              style={{
                maxWidth: '82%',
                padding: '10px 13px',
                borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                fontSize: '13px',
                lineHeight: 1.5,
                color: '#f0f0f0',
                background: msg.role === 'user' ? 'rgba(127,212,255,0.16)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${msg.role === 'user' ? 'rgba(127,212,255,0.35)' : 'rgba(255,255,255,0.1)'}`,
              }}
            >
              {msg.role === 'assistant' ? (
                <div className="npc-md">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center', padding: '10px 13px' }}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="npc-dot" style={{ width: '7px', height: '7px', borderRadius: '50%', background: ACCENT }} />
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '14px', borderTop: '1px solid rgba(127,212,255,0.2)', background: 'rgba(0,0,0,0.3)' }}>
        <div
          style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(127,212,255,0.3)',
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
                void sendMessage()
              }
            }}
            placeholder="Falar com o Marcelo..."
            disabled={loading}
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#f0f0f0', fontSize: '13px', fontFamily: 'inherit' }}
          />
          <button
            onClick={() => void sendMessage()}
            disabled={loading || !input.trim()}
            style={{
              background: input.trim() && !loading ? '#0D2B5E' : 'rgba(255,255,255,0.1)',
              border: `1px solid ${input.trim() && !loading ? ACCENT : 'transparent'}`,
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
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
