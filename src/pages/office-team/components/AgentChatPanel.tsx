// Chat com os agentes IA da UNV (agente-unv, branch web com memória).
// Acesso: master sempre pode; os demais só se o master liberar — a checagem
// vale aqui (UX) e no servidor (segurança). O master gerencia as permissões
// no próprio painel do agente.
import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { supabase } from '@/integrations/supabase/client'
import { useTeamStore } from '../store/useTeamStore'
import { agentByKey, fetchAgentPermissions, fetchMyAgentKeys, grantAgentPermission, revokeAgentPermission } from '../lib/agents'
import { bistroTablesFor, bistroSeatsFor } from './CoffeeChat'
import { personalVisitorSeat, roomAt } from '../lib/rooms'
import type { TeamRealtime } from '../lib/realtime'

const AGENT_URL = 'https://xrncvhzxjmddqluxoosu.supabase.co/functions/v1/agente-unv'
/** user_ids master (Fabrício) — mesmos com poder de delete nas gravações */
export const MASTER_IDS = ['98f3de7f-6d6f-4f3c-b2da-b9e479ce96e3', '61688e2e-00f7-4d11-a59d-eb3617ae44f5']

interface AgentMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface TeamMember {
  user_id: string
  name: string
  title: string | null
}

function PermissionsEditor({ agentKey, accent }: { agentKey: string; accent: string }) {
  const [directory, setDirectory] = useState<TeamMember[]>([])
  const [allowed, setAllowed] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [{ data }, perms] = await Promise.all([
        supabase.from('office_team_directory' as never).select('*'),
        fetchAgentPermissions(agentKey),
      ])
      if (cancelled) return
      if (data) setDirectory((data as unknown as TeamMember[]).filter((m) => !MASTER_IDS.includes(m.user_id)))
      setAllowed(new Set(perms))
    })()
    return () => {
      cancelled = true
    }
  }, [agentKey])

  const toggle = async (userId: string) => {
    if (busy) return
    setBusy(userId)
    const has = allowed.has(userId)
    const ok = has ? await revokeAgentPermission(agentKey, userId) : await grantAgentPermission(agentKey, userId)
    if (ok) {
      setAllowed((prev) => {
        const next = new Set(prev)
        if (has) next.delete(userId)
        else next.add(userId)
        return next
      })
    }
    setBusy(null)
  }

  return (
    <div style={{ padding: '12px 16px', borderBottom: `1px solid ${accent}33`, background: 'rgba(0,0,0,0.35)', maxHeight: '38vh', overflowY: 'auto' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
        Quem pode falar com este agente
      </div>
      {directory.length === 0 && (
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>Carregando equipe...</div>
      )}
      {directory.map((m) => {
        const has = allowed.has(m.user_id)
        return (
          <label
            key={m.user_id}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '5px 0', cursor: busy ? 'wait' : 'pointer', opacity: busy === m.user_id ? 0.5 : 1 }}
          >
            <input type="checkbox" checked={has} onChange={() => void toggle(m.user_id)} disabled={!!busy} style={{ accentColor: accent }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '13px', color: '#eee' }}>{m.name}</div>
              {m.title && <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{m.title}</div>}
            </div>
            <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: 700, color: has ? '#4CAF50' : 'rgba(255,255,255,0.3)' }}>
              {has ? 'LIBERADO' : '—'}
            </span>
          </label>
        )
      })}
    </div>
  )
}

export default function AgentChatPanel({ realtime }: { realtime: TeamRealtime }) {
  const agentKey = useTeamStore((s) => s.agentChatFor)
  const setAgentChatFor = useTeamStore((s) => s.setAgentChatFor)
  const me = useTeamStore((s) => s.me)
  const agent = agentByKey(agentKey)
  const isMaster = !!me && MASTER_IDS.includes(me.id)

  // Aceno: chama o agente até mim.
  //  · No café (banqueta do lounge): senta na mesa → papo informal.
  //  · Na MINHA sala privada: senta na cadeira de visita à frente da mesa →
  //    conversa de negócios / dia a dia.
  const summonAgent = async () => {
    if (!me || !agent) return
    const st = useTeamStore.getState()
    const [px, , pz] = st.playerPosition
    let seat: NonNullable<typeof st.agentSummon>['seat'] = null
    let context: 'cafe' | 'office' = 'office'

    // Minha sala pessoal? (dono e estou dentro dela)
    const myRoom = st.rooms.find((r) => r.roomType === 'personal' && r.ownerUserId === me.id)
    const inMyRoom = myRoom && roomAt(px, pz, st.rooms)?.id === myRoom.id

    if (st.seated) {
      const table = bistroTablesFor(st.rooms).find((t) => Math.hypot(px - t.x, pz - t.z) < 1.35)
      if (table) {
        const taken = (sx: number, sz: number) => {
          if (Math.hypot(px - sx, pz - sz) < 0.5) return true
          for (const p of Object.values(st.remotePlayers)) {
            if (p.sitting && Math.hypot(p.position[0] - sx, p.position[2] - sz) < 0.5) return true
          }
          return false
        }
        const free = bistroSeatsFor(st.rooms).find((s) => s.tableKey === table.key && !taken(s.x, s.z))
        if (free) {
          seat = { x: free.x, z: free.z, tableX: free.tableX, tableZ: free.tableZ, tableKey: free.tableKey }
          context = 'cafe'
        }
      }
    }
    // Na minha sala: cadeira de visita de frente pra mesa (negócios)
    if (!seat && inMyRoom && myRoom) {
      const v = personalVisitorSeat(myRoom)
      seat = { x: v.x, z: v.z, rot: v.rot, tableX: myRoom.x, tableZ: v.z + 1, tableKey: `room:${myRoom.id}` }
      context = 'office'
    }

    // Sem autorização = papo informal apenas (a prosa filtra os assuntos)
    let allowed = isMaster
    if (!allowed) {
      const keys = await fetchMyAgentKeys(me.id)
      allowed = keys.includes(agent.key)
    }
    realtime.sendAgentSummon({
      agentKey: agent.key,
      x: Number(px.toFixed(2)),
      z: Number(pz.toFixed(2)),
      seat,
      byId: me.id,
      byName: me.name,
      allowed,
      context,
      ts: Date.now(),
    })
    const msg =
      context === 'cafe'
        ? `👋 ${agent.name} está indo tomar um café com você`
        : seat
          ? `👋 ${agent.name} está vindo conversar na sua sala`
          : `👋 ${agent.name} está indo até você`
    st.addToast(msg, 'in')
    setAgentChatFor(null)
  }

  const [byAgent, setByAgent] = useState<Record<string, AgentMessage[]>>({})
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPerms, setShowPerms] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null!)
  const inputRef = useRef<HTMLInputElement>(null!)

  const messages = agentKey ? byAgent[agentKey] ?? [] : []

  useEffect(() => {
    setShowPerms(false)
    if (agentKey) setTimeout(() => inputRef.current?.focus(), 120)
  }, [agentKey])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && agentKey) setAgentChatFor(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [agentKey, setAgentChatFor])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || loading || !agent) return
    const key = agent.key
    setByAgent((prev) => ({
      ...prev,
      [key]: [...(prev[key] ?? []), { id: crypto.randomUUID(), role: 'user', content: text }],
    }))
    setInput('')
    setLoading(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) throw new Error('sem sessão')
      const res = await fetch(`${AGENT_URL}?agent=${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ message: text, agent: key }),
      })
      const data = await res.json()
      const reply =
        data?.reply || (data?.ok === false ? `Não consegui responder agora (${data.error}).` : 'Não consegui responder agora.')
      setByAgent((prev) => ({
        ...prev,
        [key]: [...(prev[key] ?? []), { id: crypto.randomUUID(), role: 'assistant', content: reply }],
      }))
    } catch {
      setByAgent((prev) => ({
        ...prev,
        [key]: [...(prev[key] ?? []), { id: crypto.randomUUID(), role: 'assistant', content: 'Caiu a conexão aqui. Tenta de novo em instantes.' }],
      }))
    } finally {
      setLoading(false)
    }
  }, [input, loading, agent])

  if (!agent) return null
  const ACCENT = agent.accent

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
        borderLeft: `2px solid ${ACCENT}66`,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 102,
        boxShadow: '-8px 0 40px rgba(13, 43, 94, 0.3)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <style>{`
        @keyframes agent-pulse {
          0%, 80%, 100% { transform: scale(0); opacity: 0.5; }
          40% { transform: scale(1); opacity: 1; }
        }
        .agent-dot { animation: agent-pulse 1.4s infinite ease-in-out both; }
        .agent-dot:nth-child(1) { animation-delay: -0.32s; }
        .agent-dot:nth-child(2) { animation-delay: -0.16s; }
        .agent-md > *:first-child { margin-top: 0; }
        .agent-md > *:last-child { margin-bottom: 0; }
        .agent-md p { margin: 0 0 10px 0; }
        .agent-md strong { color: #fff; }
        .agent-md ul, .agent-md ol { margin: 0 0 10px 0; padding-left: 18px; }
        .agent-md li { margin: 0 0 5px 0; }
      `}</style>

      {/* Header */}
      <div
        style={{
          padding: '16px 18px',
          borderBottom: `1px solid ${ACCENT}44`,
          background: `linear-gradient(135deg, ${agent.body}55 0%, rgba(10,10,20,0) 100%)`,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: agent.body,
            border: `1px solid ${ACCENT}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            fontWeight: 800,
            color: '#fff',
            flexShrink: 0,
          }}
        >
          {agent.name[0]}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: '15px' }}>🤖 {agent.name}</div>
          <div style={{ color: ACCENT, fontSize: '11px', marginTop: '2px' }}>{agent.title}</div>
        </div>
        <button
          onClick={() => void summonAgent()}
          title="O agente vem até você — sentado no café, ele senta junto"
          style={{
            background: 'rgba(255,215,0,0.12)',
            border: '1px solid rgba(255,215,0,0.4)',
            color: '#fff',
            padding: '6px 10px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          👋 Chamar
        </button>
        {isMaster && (
          <button
            onClick={() => setShowPerms((v) => !v)}
            title="Definir quem pode falar com este agente"
            style={{
              background: showPerms ? `${ACCENT}33` : 'rgba(255,255,255,0.08)',
              border: `1px solid ${showPerms ? ACCENT : 'rgba(255,255,255,0.15)'}`,
              color: '#fff',
              padding: '6px 10px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            🔑 Acesso
          </button>
        )}
        <button
          onClick={() => setAgentChatFor(null)}
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: '#888',
            width: '30px',
            height: '30px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '15px',
            flexShrink: 0,
          }}
        >
          ✕
        </button>
      </div>

      {/* Permissões (só master) */}
      {isMaster && showPerms && <PermissionsEditor agentKey={agent.key} accent={ACCENT} />}

      {/* Mensagens */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(255,255,255,0.35)', fontSize: '13px' }}>
            <div style={{ fontSize: '34px', marginBottom: '10px' }}>🤖</div>
            {agent.intro}
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
                background: msg.role === 'user' ? `${ACCENT}22` : 'rgba(255,255,255,0.05)',
                border: `1px solid ${msg.role === 'user' ? `${ACCENT}55` : 'rgba(255,255,255,0.1)'}`,
              }}
            >
              {msg.role === 'assistant' ? (
                <div className="agent-md">
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
              <div key={i} className="agent-dot" style={{ width: '7px', height: '7px', borderRadius: '50%', background: ACCENT }} />
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '14px', borderTop: `1px solid ${ACCENT}33`, background: 'rgba(0,0,0,0.3)' }}>
        <div
          style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            background: 'rgba(255,255,255,0.06)',
            border: `1px solid ${ACCENT}55`,
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
            placeholder={`Falar com ${agent.name}...`}
            disabled={loading}
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#f0f0f0', fontSize: '13px', fontFamily: 'inherit' }}
          />
          <button
            onClick={() => void sendMessage()}
            disabled={loading || !input.trim()}
            style={{
              background: input.trim() && !loading ? agent.body : 'rgba(255,255,255,0.1)',
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
