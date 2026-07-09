// Editor de aparência do avatar — pele, cabelo, camisa, calça.
// Salva em office_team_avatars e atualiza o presence na hora.
import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useTeamStore, AvatarConfig } from '../store/useTeamStore'
import type { TeamRealtime } from '../lib/realtime'

const SKINS = ['#ffdbac', '#f2c89b', '#e0ac69', '#c68642', '#8d5524', '#5c3a21']
const HAIR_COLORS = ['#1a1208', '#2d2017', '#5a3825', '#8a5a2b', '#b8862d', '#d8d8d8', '#9e2b2b']
const SHIRTS = ['#1A4A8A', '#CC1B1B', '#1B6B3A', '#6B2FA0', '#B85C00', '#C2185B', '#0D2B5E', '#37474F', '#ffffff', '#16181d']
const PANTS = ['#2b3445', '#16181d', '#4a3526', '#3d4f5c', '#6b7280', '#1f2a44']
const HAIR_STYLES: { id: AvatarConfig['hairStyle']; label: string }[] = [
  { id: 'short', label: 'Curto' },
  { id: 'buzz', label: 'Raspado' },
  { id: 'curly', label: 'Cacheado' },
  { id: 'long', label: 'Comprido' },
  { id: 'ponytail', label: 'Rabo de cavalo' },
  { id: 'bun', label: 'Coque' },
  { id: 'bald', label: 'Sem cabelo' },
]
const FACIAL_STYLES: { id: NonNullable<AvatarConfig['facialHair']>; label: string }[] = [
  { id: 'none', label: 'Sem barba' },
  { id: 'stubble', label: 'Por fazer' },
  { id: 'beard', label: 'Barba cheia' },
  { id: 'mustache', label: 'Bigode' },
]

function SwatchRow({
  title,
  colors,
  value,
  onPick,
}: {
  title: string
  colors: string[]
  value: string
  onPick: (c: string) => void
}) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
        {title}
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {colors.map((c) => (
          <button
            key={c}
            onClick={() => onPick(c)}
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              background: c,
              border: value === c ? '2.5px solid #FFD700' : '2px solid rgba(255,255,255,0.2)',
              cursor: 'pointer',
            }}
          />
        ))}
      </div>
    </div>
  )
}

export default function AvatarEditor({ realtime }: { realtime: TeamRealtime }) {
  const open = useTeamStore((s) => s.avatarEditorOpen)
  const setOpen = useTeamStore((s) => s.setAvatarEditorOpen)
  const me = useTeamStore((s) => s.me)
  const setAvatar = useTeamStore((s) => s.setAvatar)
  const [saving, setSaving] = useState(false)

  if (!open || !me) return null
  const avatar = me.avatar

  const update = (patch: Partial<AvatarConfig>) => {
    const next = { ...avatar, ...patch }
    setAvatar(next) // preview imediato no próprio boneco
    void realtime.updateAvatar(next)
  }

  const save = async () => {
    setSaving(true)
    await supabase.from('office_team_avatars' as never).upsert({
      user_id: me.id,
      skin_color: avatar.skin,
      hair_style: avatar.hairStyle,
      hair_color: avatar.hairColor,
      shirt_color: avatar.shirt,
      pants_color: avatar.pants,
      facial_hair: avatar.facialHair ?? 'none',
      updated_at: new Date().toISOString(),
    } as never)
    setSaving(false)
    setOpen(false)
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '340px',
        background: 'rgba(10, 10, 20, 0.96)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,215,0,0.3)',
        borderRadius: '16px',
        padding: '20px',
        zIndex: 120,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        color: '#fff',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ fontWeight: 800, fontSize: '15px' }}>Personalizar avatar</div>
        <button
          onClick={() => setOpen(false)}
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: '#888',
            width: '28px',
            height: '28px',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>

      <SwatchRow title="Tom de pele" colors={SKINS} value={avatar.skin} onPick={(c) => update({ skin: c })} />

      <div style={{ marginBottom: '14px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
          Cabelo
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {HAIR_STYLES.map((h) => (
            <button
              key={h.id}
              onClick={() => update({ hairStyle: h.id })}
              style={{
                padding: '6px 10px',
                borderRadius: '8px',
                fontSize: '12px',
                background: avatar.hairStyle === h.id ? 'rgba(255,215,0,0.2)' : 'rgba(255,255,255,0.07)',
                border: avatar.hairStyle === h.id ? '1px solid rgba(255,215,0,0.6)' : '1px solid rgba(255,255,255,0.15)',
                color: '#eee',
                cursor: 'pointer',
              }}
            >
              {h.label}
            </button>
          ))}
        </div>
      </div>

      {avatar.hairStyle !== 'bald' && (
        <SwatchRow title="Cor do cabelo" colors={HAIR_COLORS} value={avatar.hairColor} onPick={(c) => update({ hairColor: c })} />
      )}

      <div style={{ marginBottom: '14px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
          Barba
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {FACIAL_STYLES.map((f) => (
            <button
              key={f.id}
              onClick={() => update({ facialHair: f.id })}
              style={{
                padding: '6px 10px',
                borderRadius: '8px',
                fontSize: '12px',
                background: (avatar.facialHair ?? 'none') === f.id ? 'rgba(255,215,0,0.2)' : 'rgba(255,255,255,0.07)',
                border: (avatar.facialHair ?? 'none') === f.id ? '1px solid rgba(255,215,0,0.6)' : '1px solid rgba(255,255,255,0.15)',
                color: '#eee',
                cursor: 'pointer',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <SwatchRow title="Camisa" colors={SHIRTS} value={avatar.shirt} onPick={(c) => update({ shirt: c })} />
      <SwatchRow title="Calça" colors={PANTS} value={avatar.pants} onPick={(c) => update({ pants: c })} />

      <button
        onClick={save}
        disabled={saving}
        style={{
          width: '100%',
          marginTop: '6px',
          padding: '11px',
          borderRadius: '10px',
          border: 'none',
          background: '#B8860B',
          color: '#fff',
          fontWeight: 700,
          fontSize: '13px',
          cursor: saving ? 'wait' : 'pointer',
        }}
      >
        {saving ? 'Salvando...' : 'Salvar aparência'}
      </button>
    </div>
  )
}
