// Recados na mesa: texto ou áudio deixado pra outro usuário.
// Tabela office_desk_notes + bucket privado office-notes (áudio).
// O destinatário fica com banner/badge até marcar como lido.
import { supabase } from '@/integrations/supabase/client'
import { useTeamStore, DeskNote } from '../store/useTeamStore'

export async function fetchUnreadNotes(myId: string): Promise<void> {
  const { data } = await supabase
    .from('office_desk_notes' as never)
    .select('id, from_user, from_name, kind, content, audio_path, created_at')
    .eq('to_user', myId)
    .is('read_at', null)
    .order('created_at', { ascending: true })
  useTeamStore.getState().setUnreadNotes((data as unknown as DeskNote[]) ?? [])
}

export async function sendTextNote(toUser: string, text: string): Promise<boolean> {
  const me = useTeamStore.getState().me
  if (!me) return false
  const { error } = await supabase.from('office_desk_notes' as never).insert({
    to_user: toUser,
    from_user: me.id,
    from_name: me.name,
    kind: 'text',
    content: text,
  } as never)
  return !error
}

export async function sendAudioNote(toUser: string, blob: Blob): Promise<boolean> {
  const me = useTeamStore.getState().me
  if (!me) return false
  const path = `${toUser}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.webm`
  const { error: upErr } = await supabase.storage
    .from('office-notes')
    .upload(path, blob, { contentType: 'audio/webm' })
  if (upErr) return false
  const { error } = await supabase.from('office_desk_notes' as never).insert({
    to_user: toUser,
    from_user: me.id,
    from_name: me.name,
    kind: 'audio',
    audio_path: path,
  } as never)
  return !error
}

export async function markNoteRead(noteId: string): Promise<void> {
  await supabase
    .from('office_desk_notes' as never)
    .update({ read_at: new Date().toISOString() } as never)
    .eq('id', noteId)
  const st = useTeamStore.getState()
  st.setUnreadNotes(st.unreadNotes.filter((n) => n.id !== noteId))
}

/** Baixa o áudio do recado (RLS: só remetente/destinatário) → object URL. */
export async function noteAudioUrl(audioPath: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('office-notes').download(audioPath)
  if (error || !data) return null
  return URL.createObjectURL(data)
}
