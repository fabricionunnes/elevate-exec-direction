import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useGameStore, Message } from '../store/useGameStore'
import { AGENTS } from '../config/agents'
import { AGENT_API_URL, getAgentAuthToken } from '../lib/supabase'

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '100, 100, 100'
}

export default function ChatPanel() {
  const { chat, closeChat, addMessage, setLoading } = useGameStore()
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null!)
  const inputRef = useRef<HTMLInputElement>(null!)

  const agent = AGENTS.find((a) => a.id === chat.activeAgentId)
  const messages = chat.activeAgentId ? chat.messages[chat.activeAgentId] || [] : []

  useEffect(() => {
    if (chat.isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [chat.isOpen])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && chat.isOpen) closeChat()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [chat.isOpen, closeChat])

  const sendMessage = useCallback(async () => {
    if (!input.trim() || !agent || chat.isLoading) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    }
    addMessage(agent.id, userMsg)
    const sentInput = input.trim()
    setInput('')
    setLoading(true)

    try {
      const token = await getAgentAuthToken()
      if (!token) throw new Error('Sessão expirada — faça login novamente.')

      const response = await fetch(`${AGENT_API_URL}?agent=${agent.apiType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: sentInput,
          agent: agent.apiType,
          history: messages.slice(-12).map((m) => ({ role: m.role, content: m.content })),
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      const replyContent =
        data.reply ||
        data.message ||
        data.content ||
        data.response ||
        (typeof data === 'string' ? data : 'Entendido! Posso te ajudar com mais alguma coisa?')

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: replyContent,
        timestamp: Date.now(),
      }
      addMessage(agent.id, assistantMsg)
    } catch (err) {
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Desculpe, não consegui conectar agora. Tente novamente em instantes.`,
        timestamp: Date.now(),
      }
      addMessage(agent.id, errMsg)
    } finally {
      setLoading(false)
    }
  }, [input, agent, chat.isLoading, messages, addMessage, setLoading])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (!chat.isOpen || !agent) return null

  const agentRgb = hexToRgb(agent.color)

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
        borderLeft: `2px solid rgba(${agentRgb}, 0.5)`,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        boxShadow: `-8px 0 40px rgba(${agentRgb}, 0.15)`,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        animation: 'slideIn 0.2s ease-out',
      }}
    >
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes pulse {
          0%, 80%, 100% { transform: scale(0); opacity: 0.5; }
          40% { transform: scale(1); opacity: 1; }
        }
        .dot { animation: pulse 1.4s infinite ease-in-out both; }
        .dot:nth-child(1) { animation-delay: -0.32s; }
        .dot:nth-child(2) { animation-delay: -0.16s; }
        .msg-user { background: rgba(${agentRgb}, 0.25); border: 1px solid rgba(${agentRgb}, 0.4); }
        .msg-assistant { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); }
        .md-body > *:first-child { margin-top: 0; }
        .md-body > *:last-child { margin-bottom: 0; }
        .md-body p { margin: 0 0 10px 0; }
        .md-body strong { color: #fff; font-weight: 700; }
        .md-body em { color: rgba(${agentRgb}, 0.95); font-style: normal; }
        .md-body ul, .md-body ol { margin: 0 0 10px 0; padding-left: 18px; }
        .md-body li { margin: 0 0 6px 0; }
        .md-body li > p { margin: 0 0 4px 0; }
        .md-body h1, .md-body h2, .md-body h3, .md-body h4 {
          margin: 14px 0 8px 0; color: #fff; line-height: 1.3;
        }
        .md-body h1 { font-size: 15px; }
        .md-body h2 { font-size: 14px; }
        .md-body h3, .md-body h4 { font-size: 13px; color: rgba(${agentRgb}, 0.95); }
        .md-body hr { border: none; border-top: 1px solid rgba(255,255,255,0.15); margin: 12px 0; }
        .md-body code {
          background: rgba(255,255,255,0.1); padding: 1px 5px; border-radius: 4px;
          font-size: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        }
        .md-body pre {
          background: rgba(0,0,0,0.4); padding: 10px; border-radius: 8px;
          overflow-x: auto; margin: 0 0 10px 0;
        }
        .md-body pre code { background: none; padding: 0; }
        .md-body blockquote {
          margin: 0 0 10px 0; padding: 4px 0 4px 10px;
          border-left: 3px solid rgba(${agentRgb}, 0.6); color: rgba(255,255,255,0.75);
        }
        .md-body table {
          border-collapse: collapse; margin: 0 0 10px 0; width: 100%;
          font-size: 11.5px; display: block; overflow-x: auto;
        }
        .md-body th, .md-body td {
          border: 1px solid rgba(255,255,255,0.18); padding: 5px 8px; text-align: left;
        }
        .md-body th { background: rgba(${agentRgb}, 0.18); color: #fff; font-weight: 700; }
        .md-body a { color: rgba(${agentRgb}, 1); }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); }
        ::-webkit-scrollbar-thumb { background: rgba(${agentRgb}, 0.4); border-radius: 2px; }
        input::placeholder { color: rgba(255,255,255,0.3); }
      `}</style>

      {/* Header */}
      <div
        style={{
          padding: '20px',
          borderBottom: `1px solid rgba(${agentRgb}, 0.3)`,
          background: `linear-gradient(135deg, rgba(${agentRgb}, 0.15) 0%, rgba(10,10,20,0) 100%)`,
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
        }}
      >
        {/* Avatar */}
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '10px',
            background: agent.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            fontWeight: 'bold',
            color: '#fff',
            flexShrink: 0,
            boxShadow: `0 0 20px rgba(${agentRgb}, 0.5)`,
          }}
        >
          {agent.name[0]}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ color: '#fff', fontWeight: '700', fontSize: '16px' }}>{agent.name}</div>
          <div style={{ color: `rgba(${agentRgb}, 0.9)`, fontSize: '12px', marginTop: '2px' }}>
            {agent.role} · {agent.room}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
            <div
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: '#4CAF50',
                boxShadow: '0 0 6px #4CAF50',
              }}
            />
            <span style={{ color: '#4CAF50', fontSize: '11px' }}>Online</span>
          </div>
        </div>

        <button
          onClick={closeChat}
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: '#888',
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            ;(e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.15)'
            ;(e.target as HTMLButtonElement).style.color = '#fff'
          }}
          onMouseLeave={(e) => {
            ;(e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)'
            ;(e.target as HTMLButtonElement).style.color = '#888'
          }}
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: 'rgba(255,255,255,0.3)',
            }}
          >
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>💬</div>
            <div style={{ fontSize: '14px' }}>
              Inicie uma conversa com <strong style={{ color: `rgba(${agentRgb}, 0.9)` }}>{agent.name}</strong>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
              gap: '8px',
              alignItems: 'flex-end',
            }}
          >
            {msg.role === 'assistant' && (
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  background: agent.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: '#fff',
                  flexShrink: 0,
                }}
              >
                {agent.name[0]}
              </div>
            )}
            <div
              className={msg.role === 'user' ? 'msg-user' : 'msg-assistant'}
              style={{
                maxWidth: '80%',
                padding: '10px 13px',
                borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                fontSize: '13px',
                lineHeight: '1.5',
                color: '#f0f0f0',
              }}
            >
              {msg.role === 'assistant' ? (
                <div className="md-body">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
              )}
              <div
                style={{
                  fontSize: '10px',
                  color: 'rgba(255,255,255,0.3)',
                  marginTop: '4px',
                  textAlign: 'right',
                }}
              >
                {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {chat.isLoading && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                background: agent.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 'bold',
                color: '#fff',
                flexShrink: 0,
              }}
            >
              {agent.name[0]}
            </div>
            <div
              className="msg-assistant"
              style={{
                padding: '12px 16px',
                borderRadius: '14px 14px 14px 4px',
                display: 'flex',
                gap: '5px',
                alignItems: 'center',
              }}
            >
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="dot"
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: `rgba(${agentRgb}, 0.8)`,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        style={{
          padding: '16px',
          borderTop: `1px solid rgba(${agentRgb}, 0.2)`,
          background: 'rgba(0,0,0,0.3)',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            background: 'rgba(255,255,255,0.06)',
            border: `1px solid rgba(${agentRgb}, 0.3)`,
            borderRadius: '12px',
            padding: '8px 12px',
            transition: 'border-color 0.2s',
          }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={`Falar com ${agent.name}...`}
            disabled={chat.isLoading}
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
            disabled={chat.isLoading || !input.trim()}
            style={{
              background: input.trim() && !chat.isLoading ? agent.color : 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              cursor: input.trim() && !chat.isLoading ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              transition: 'all 0.2s',
              flexShrink: 0,
              color: '#fff',
            }}
          >
            ➤
          </button>
        </div>
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', marginTop: '8px', textAlign: 'center' }}>
          Enter para enviar · Esc para fechar
        </div>
      </div>
    </div>
  )
}
