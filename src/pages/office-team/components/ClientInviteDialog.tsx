// Convite de cliente pra uma sala 'client' (fase 2 do prédio): escolhe a
// empresa (onboarding_companies ativas, lista pesquisável) OU um lead do CRM
// (opcional), data/hora da reunião, e gera o link ?invite=<token>. O convite
// RESERVA a sala (placa da porta + TV com o painel do cliente no dia).
// Sem SearchableSelect do shadcn aqui: o Popover dele abre num portal com
// z-index menor que os overlays do escritório e ficaria escondido.
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useTeamStore } from '../store/useTeamStore'
import { fetchClientReservationsToday } from '../lib/clientRooms'
import type { OfficeRoom } from '../lib/rooms'

const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(255,255,255,0.18)',
  borderRadius: '8px',
  padding: '8px 10px',
  color: '#fff',
  fontSize: '12px',
  outline: 'none',
  fontFamily: font,
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  color: 'rgba(255,255,255,0.45)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: '4px',
}

interface Option {
  id: string
  label: string
  hint?: string
}

/** Lista pesquisável por digitação (regra fixa do Nexus: todo seletor tem busca). */
function SearchList({
  options,
  value,
  onChange,
  placeholder,
  onQuery,
}: {
  options: Option[]
  value: string | null
  onChange: (id: string | null) => void
  placeholder: string
  /** busca remota opcional (leads): chamada a cada digitação */
  onQuery?: (q: string) => void
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.id === value) ?? null
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    const list = t ? options.filter((o) => o.label.toLowerCase().includes(t)) : options
    return list.slice(0, 40)
  }, [options, q])
  return (
    <div style={{ position: 'relative' }}>
      <input
        value={open ? q : selected?.label ?? ''}
        onChange={(e) => {
          setQ(e.target.value)
          onQuery?.(e.target.value)
        }}
        onFocus={() => {
          setOpen(true)
          setQ('')
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        style={inputStyle}
      />
      {selected && !open && (
        <button
          onClick={() => onChange(null)}
          title="Limpar"
          style={{ position: 'absolute', right: '6px', top: '6px', background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '13px' }}
        >
          ✕
        </button>
      )}
      {open && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '36px',
            maxHeight: '180px',
            overflowY: 'auto',
            background: 'rgba(16,16,28,0.98)',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: '8px',
            zIndex: 5,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }}
        >
          {filtered.length === 0 && (
            <div style={{ padding: '8px 10px', fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Nenhum resultado.</div>
          )}
          {filtered.map((o) => (
            <div
              key={o.id}
              onMouseDown={(e) => {
                e.preventDefault()
                onChange(o.id)
                setOpen(false)
              }}
              style={{
                padding: '7px 10px',
                fontSize: '12px',
                cursor: 'pointer',
                background: o.id === value ? 'rgba(255,215,0,0.14)' : 'transparent',
                display: 'flex',
                justifyContent: 'space-between',
                gap: '8px',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
              {o.hint && <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>{o.hint}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** "2026-10-13T14:30" no fuso local, pro input datetime-local. */
function nextHalfHourLocal(): string {
  const d = new Date()
  d.setSeconds(0, 0)
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function ClientInviteDialog({ room, onClose }: { room: OfficeRoom; onClose: () => void }) {
  const me = useTeamStore((s) => s.me)
  const [companies, setCompanies] = useState<Option[]>([])
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [leads, setLeads] = useState<Option[]>([])
  const [leadId, setLeadId] = useState<string | null>(null)
  const [guestCompany, setGuestCompany] = useState('')
  const [when, setWhen] = useState(nextHalfHourLocal())
  const [projects, setProjects] = useState<{ id: string; label: string; token: string | null }[]>([])
  const [projectId, setProjectId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [link, setLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Empresas ativas (clientes)
  useEffect(() => {
    let cancelled = false
    void supabase
      .from('onboarding_companies')
      .select('id, name, status')
      .eq('status', 'active')
      .order('name', { ascending: true })
      .limit(500)
      .then(({ data }) => {
        if (cancelled || !data) return
        setCompanies((data as Array<{ id: string; name: string }>).map((c) => ({ id: c.id, label: c.name })))
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Leads do CRM: busca remota por nome (opcional)
  const [leadQuery, setLeadQuery] = useState('')
  useEffect(() => {
    const t = leadQuery.trim()
    if (t.length < 2) return
    let cancelled = false
    const timer = setTimeout(() => {
      void supabase
        .from('crm_leads' as never)
        .select('id, name, company')
        .ilike('name', `%${t}%`)
        .order('created_at', { ascending: false })
        .limit(40)
        .then(({ data }) => {
          if (cancelled || !data) return
          setLeads(
            (data as unknown as Array<{ id: string; name: string; company: string | null }>).map((l) => ({
              id: l.id,
              label: l.name,
              hint: l.company ?? undefined,
            }))
          )
        })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [leadQuery])

  // Projetos da empresa escolhida + painel público (token) de cada um
  useEffect(() => {
    setProjects([])
    setProjectId(null)
    if (!companyId) return
    let cancelled = false
    const load = async () => {
      const { data: projs } = await supabase
        .from('onboarding_projects')
        .select('id, product_name, status')
        .eq('onboarding_company_id', companyId)
        .order('created_at', { ascending: false })
      if (cancelled) return
      const list = (projs ?? []) as Array<{ id: string; product_name: string; status: string }>
      const ids = list.map((p) => p.id)
      const tokens = new Map<string, string>()
      if (ids.length) {
        const { data: dash } = await supabase
          .from('project_custom_dashboards' as never)
          .select('project_id, public_token')
          .in('project_id', ids)
        for (const d of (dash ?? []) as unknown as Array<{ project_id: string; public_token: string | null }>) {
          if (d.public_token) tokens.set(d.project_id, d.public_token)
        }
      }
      if (cancelled) return
      const opts = list.map((p) => ({
        id: p.id,
        label: `${p.product_name}${p.status && p.status !== 'active' ? ` (${p.status})` : ''}`,
        token: tokens.get(p.id) ?? null,
      }))
      setProjects(opts)
      // Preferência: projeto ativo com painel público; senão o primeiro com painel; senão o primeiro
      const best =
        opts.find((o) => o.token && list.find((p) => p.id === o.id)?.status === 'active') ??
        opts.find((o) => o.token) ??
        opts[0]
      setProjectId(best?.id ?? null)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [companyId])

  const companyName = companies.find((c) => c.id === companyId)?.label ?? ''
  const leadLabel = leads.find((l) => l.id === leadId)
  const finalCompany = (companyName || leadLabel?.hint || guestCompany).trim()
  const canSubmit = !!me && !busy && !!when && (!!companyId || !!leadId || guestCompany.trim().length > 1)
  const project = projects.find((p) => p.id === projectId) ?? null

  const submit = async () => {
    if (!canSubmit || !me) return
    setBusy(true)
    setError(null)
    const scheduled = new Date(when)
    if (Number.isNaN(scheduled.getTime())) {
      setError('Data/hora inválida.')
      setBusy(false)
      return
    }
    // Convite vale 24h a partir de agora OU até 6h depois da reunião (o que for maior)
    const expires = new Date(Math.max(Date.now() + 24 * 3600_000, scheduled.getTime() + 6 * 3600_000))
    const { data, error: err } = await supabase
      .from('office_guest_invites' as never)
      .insert({
        created_by: me.id,
        room_id: room.id,
        company_id: companyId,
        lead_id: leadId,
        project_id: projectId,
        scheduled_at: scheduled.toISOString(),
        guest_company: finalCompany || null,
        guest_label: finalCompany || null,
        expires_at: expires.toISOString(),
      } as never)
      .select('token')
      .single()
    setBusy(false)
    const token = (data as { token?: string } | null)?.token
    if (err || !token) {
      setError('Não consegui gerar o convite. Tenta de novo.')
      return
    }
    const url = `${window.location.origin}/#/onboarding-tasks/unv-office?invite=${token}`
    setLink(url)
    try {
      await navigator.clipboard.writeText(url)
      useTeamStore.getState().addToast(`✉️ Convite de ${finalCompany || 'cliente'} copiado. Sala reservada.`, 'in')
    } catch {
      /* o link fica na tela pra copiar */
    }
    // Atualiza placa/TV de quem está no escritório (os outros pegam no poll de 60s)
    void fetchClientReservationsToday().then((list) => useTeamStore.getState().setClientReservations(list))
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 130,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: font,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(380px, 92vw)',
          background: 'rgba(12,12,22,0.98)',
          border: '1px solid rgba(255,215,0,0.4)',
          borderRadius: '14px',
          padding: '16px',
          color: '#fff',
          boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 800 }}>Convidar cliente</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>{room.name} · reserva a sala no horário</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '16px' }}>
            ✕
          </button>
        </div>

        {!link ? (
          <>
            <div>
              <div style={labelStyle}>Empresa (cliente ativo)</div>
              <SearchList options={companies} value={companyId} onChange={setCompanyId} placeholder="Digite pra buscar a empresa..." />
              {companyId && (
                <div style={{ fontSize: '10px', color: project?.token ? '#7fd4a0' : 'rgba(255,255,255,0.45)', marginTop: '4px' }}>
                  {projects.length === 0
                    ? 'Carregando projetos...'
                    : project?.token
                      ? `Painel vinculado: ${project.label}`
                      : 'Esse cliente não tem painel público. A TV mostra só a reserva.'}
                </div>
              )}
              {projects.length > 1 && (
                <div style={{ marginTop: '6px' }}>
                  <div style={labelStyle}>Projeto</div>
                  <SearchList
                    options={projects.map((p) => ({ id: p.id, label: p.label, hint: p.token ? 'painel' : undefined }))}
                    value={projectId}
                    onChange={setProjectId}
                    placeholder="Projeto"
                  />
                </div>
              )}
            </div>
            <div>
              <div style={labelStyle}>ou lead do CRM (opcional)</div>
              <SearchList options={leads} value={leadId} onChange={setLeadId} placeholder="Digite o nome do lead..." onQuery={setLeadQuery} />
            </div>
            {!companyId && !leadId && (
              <div>
                <div style={labelStyle}>ou nome da empresa convidada</div>
                <input value={guestCompany} onChange={(e) => setGuestCompany(e.target.value)} placeholder="Ex.: Padaria do João" style={inputStyle} maxLength={60} />
              </div>
            )}
            <div>
              <div style={labelStyle}>Data e hora da reunião</div>
              <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} style={{ ...inputStyle, colorScheme: 'dark' }} />
            </div>
            {error && <div style={{ fontSize: '11px', color: '#ff8a80' }}>{error}</div>}
            <button
              onClick={() => void submit()}
              disabled={!canSubmit}
              style={{
                padding: '10px',
                borderRadius: '8px',
                border: 'none',
                background: canSubmit ? '#CC1B1B' : 'rgba(255,255,255,0.08)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '13px',
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                fontFamily: font,
              }}
            >
              {busy ? 'Gerando...' : 'Gerar link e reservar a sala'}
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
              Link gerado pra <b style={{ color: '#fff' }}>{finalCompany || 'o convidado'}</b>. Ele entra direto nesta sala, no térreo, com o nome
              e a empresa no crachá.
            </div>
            <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} style={inputStyle} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => void navigator.clipboard.writeText(link).catch(() => undefined)}
                style={{ flex: 1, padding: '9px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: font }}
              >
                Copiar de novo
              </button>
              <button
                onClick={onClose}
                style={{ flex: 1, padding: '9px', borderRadius: '8px', border: 'none', background: '#0D2B5E', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: font }}
              >
                Fechar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
