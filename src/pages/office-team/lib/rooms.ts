// Salas dinâmicas do escritório — carregadas do banco (office_team_rooms).
// Gera paredes/colisão/portas a partir das salas; sala trancada fecha a porta
// para quem está fora (lock só vale enquanto quem trancou estiver online).
import { supabase } from '@/integrations/supabase/client'

export type RoomType = 'sector' | 'meeting' | 'personal' | 'lounge'

export interface OfficeRoom {
  id: string
  name: string
  sector: string | null
  roomType: RoomType
  x: number
  z: number
  width: number
  depth: number
  color: string
  doorSide: 'N' | 'S'
  ownerUserId: string | null
  isLocked: boolean
  lockedBy: string | null
}

export interface Wall {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

// Limites do prédio (perímetro com colisão)
export const BUILDING = { minX: -30, maxX: 30, minZ: -20, maxZ: 29 }

const WALL_T = 0.32 // espessura
const DOOR_W = 2.6 // vão da porta

// Slots disponíveis por tipo, para criação de novas salas.
// Fileira norte = setores; fileira sul = reuniões/lounge; ala sul = pessoais.
const SLOTS: Record<RoomType, { x: number; z: number; w: number; d: number; door: 'N' | 'S' }[]> = {
  sector: [
    { x: -23, z: -7, w: 12, d: 9, door: 'S' },
    { x: -11, z: -7, w: 12, d: 9, door: 'S' },
    { x: 1, z: -7, w: 12, d: 9, door: 'S' },
    { x: 13, z: -7, w: 12, d: 9, door: 'S' },
    { x: 24, z: -7, w: 10, d: 9, door: 'S' },
    { x: -23, z: -16, w: 12, d: 7, door: 'S' },
    { x: -11, z: -16, w: 12, d: 7, door: 'S' },
    { x: 1, z: -16, w: 12, d: 7, door: 'S' },
    { x: 13, z: -16, w: 12, d: 7, door: 'S' },
    { x: 24, z: -16, w: 10, d: 7, door: 'S' },
  ],
  meeting: [
    { x: -21, z: 7, w: 16, d: 9, door: 'N' },
    { x: -6, z: 7, w: 8, d: 9, door: 'N' },
    { x: 2, z: 7, w: 8, d: 9, door: 'N' },
    { x: 24, z: 7, w: 10, d: 9, door: 'N' },
  ],
  lounge: [
    { x: 14, z: 7, w: 10, d: 9, door: 'N' },
    { x: 24, z: 7, w: 10, d: 9, door: 'N' },
  ],
  // Ala privada: duas fileiras de 8 salas com vão central de passagem
  // (x -5.1..5.1 livre) e corredor entre fileiras em z 20.4–22
  personal: Array.from({ length: 16 }, (_, i) => {
    const col = i % 8
    return {
      x: col < 4 ? -25.8 + col * 6 : 7.8 + (col - 4) * 6,
      z: i < 8 ? 17.4 : 25,
      w: 5.4,
      d: 6,
      door: 'N' as const,
    }
  }),
}

function mapRow(row: Record<string, unknown>): OfficeRoom {
  return {
    id: row.id as string,
    name: row.name as string,
    sector: (row.sector as string) ?? null,
    roomType: row.room_type as RoomType,
    x: Number(row.x),
    z: Number(row.z),
    width: Number(row.width),
    depth: Number(row.depth),
    color: row.color as string,
    doorSide: row.door_side as 'N' | 'S',
    ownerUserId: (row.owner_user_id as string) ?? null,
    isLocked: Boolean(row.is_locked),
    lockedBy: (row.locked_by as string) ?? null,
  }
}

export async function fetchRooms(): Promise<OfficeRoom[]> {
  const { data, error } = await supabase
    .from('office_team_rooms' as never)
    .select('*')
    .order('created_at', { ascending: true })
  if (error || !data) return []
  return (data as unknown as Record<string, unknown>[]).map(mapRow)
}

/** Paredes de uma sala, com vão de porta no lado indicado (ou fechado se trancada). */
export function roomWalls(room: OfficeRoom, doorOpen: boolean): Wall[] {
  const hw = room.width / 2
  const hd = room.depth / 2
  const ht = WALL_T / 2
  const walls: Wall[] = []
  const doorHalf = DOOR_W / 2

  // Parede norte (z menor)
  if (room.doorSide === 'N' && doorOpen) {
    walls.push(
      { minX: room.x - hw, maxX: room.x - doorHalf, minZ: room.z - hd - ht, maxZ: room.z - hd + ht },
      { minX: room.x + doorHalf, maxX: room.x + hw, minZ: room.z - hd - ht, maxZ: room.z - hd + ht }
    )
  } else {
    walls.push({ minX: room.x - hw, maxX: room.x + hw, minZ: room.z - hd - ht, maxZ: room.z - hd + ht })
  }

  // Parede sul (z maior)
  if (room.doorSide === 'S' && doorOpen) {
    walls.push(
      { minX: room.x - hw, maxX: room.x - doorHalf, minZ: room.z + hd - ht, maxZ: room.z + hd + ht },
      { minX: room.x + doorHalf, maxX: room.x + hw, minZ: room.z + hd - ht, maxZ: room.z + hd + ht }
    )
  } else {
    walls.push({ minX: room.x - hw, maxX: room.x + hw, minZ: room.z + hd - ht, maxZ: room.z + hd + ht })
  }

  // Laterais (sempre fechadas)
  walls.push(
    { minX: room.x - hw - ht, maxX: room.x - hw + ht, minZ: room.z - hd, maxZ: room.z + hd },
    { minX: room.x + hw - ht, maxX: room.x + hw + ht, minZ: room.z - hd, maxZ: room.z + hd }
  )
  return walls
}

export function pointInRoom(x: number, z: number, room: OfficeRoom): boolean {
  return (
    x > room.x - room.width / 2 &&
    x < room.x + room.width / 2 &&
    z > room.z - room.depth / 2 &&
    z < room.z + room.depth / 2
  )
}

export function roomAt(x: number, z: number, rooms: OfficeRoom[]): OfficeRoom | null {
  for (const room of rooms) {
    if (pointInRoom(x, z, room)) return room
  }
  return null
}

/**
 * Trava efetiva: lock só vale se quem trancou ainda está online
 * (evita sala trancada "órfã" quando a pessoa cai/sai).
 */
export function isEffectivelyLocked(room: OfficeRoom, onlineUserIds: Set<string>): boolean {
  return room.isLocked && !!room.lockedBy && onlineUserIds.has(room.lockedBy)
}

/**
 * Colisão do mundo: perímetro + paredes de todas as salas.
 * Sala trancada (com locker online) fecha a porta — exceto para quem está
 * dentro dela ou para quem trancou (pode voltar pra própria sala trancada).
 */
export function buildCollisionWalls(
  rooms: OfficeRoom[],
  onlineUserIds: Set<string>,
  insideRoomId: string | null,
  meId?: string
): Wall[] {
  const walls: Wall[] = [
    { minX: BUILDING.minX - 1, maxX: BUILDING.minX, minZ: BUILDING.minZ - 1, maxZ: BUILDING.maxZ + 1 },
    { minX: BUILDING.maxX, maxX: BUILDING.maxX + 1, minZ: BUILDING.minZ - 1, maxZ: BUILDING.maxZ + 1 },
    { minX: BUILDING.minX - 1, maxX: BUILDING.maxX + 1, minZ: BUILDING.minZ - 1, maxZ: BUILDING.minZ },
    { minX: BUILDING.minX - 1, maxX: BUILDING.maxX + 1, minZ: BUILDING.maxZ, maxZ: BUILDING.maxZ + 1 },
  ]
  for (const room of rooms) {
    const locked = isEffectivelyLocked(room, onlineUserIds)
    const doorOpen = !locked || insideRoomId === room.id || (!!meId && room.lockedBy === meId)
    walls.push(...roomWalls(room, doorOpen))
  }
  return walls
}

export function checkWallCollision(x: number, z: number, radius: number, walls: Wall[]): boolean {
  for (const wall of walls) {
    if (x + radius > wall.minX && x - radius < wall.maxX && z + radius > wall.minZ && z - radius < wall.maxZ) {
      return true
    }
  }
  return false
}

/** Acha o próximo slot livre para uma sala nova do tipo dado. */
export function findFreeSlot(
  type: RoomType,
  rooms: OfficeRoom[]
): { x: number; z: number; w: number; d: number; door: 'N' | 'S' } | null {
  for (const slot of SLOTS[type]) {
    const overlapping = rooms.some(
      (r) =>
        Math.abs(r.x - slot.x) < (r.width + slot.w) / 2 - 0.1 &&
        Math.abs(r.z - slot.z) < (r.depth + slot.d) / 2 - 0.1
    )
    if (!overlapping) return slot
  }
  return null
}

export type CreateRoomResult = { ok: true; room: OfficeRoom } | { ok: false; reason: 'no_slot' | 'db_error' }

export async function createRoom(opts: {
  name: string
  type: RoomType
  sector?: string | null
  color: string
  ownerUserId?: string | null
  createdBy: string
  rooms: OfficeRoom[]
}): Promise<CreateRoomResult> {
  const slot = findFreeSlot(opts.type, opts.rooms)
  if (!slot) return { ok: false, reason: 'no_slot' }
  const { data, error } = await supabase
    .from('office_team_rooms' as never)
    .insert({
      name: opts.name,
      sector: opts.sector ?? null,
      room_type: opts.type,
      x: slot.x,
      z: slot.z,
      width: slot.w,
      depth: slot.d,
      color: opts.color,
      door_side: slot.door,
      owner_user_id: opts.ownerUserId ?? null,
      created_by: opts.createdBy,
    } as never)
    .select('*')
    .single()
  if (error || !data) {
    console.error('[office] createRoom falhou:', error)
    return { ok: false, reason: 'db_error' }
  }
  return { ok: true, room: mapRow(data as unknown as Record<string, unknown>) }
}

export async function setRoomLock(roomId: string, locked: boolean, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('office_team_rooms' as never)
    .update({ is_locked: locked, locked_by: locked ? userId : null } as never)
    .eq('id', roomId)
  return !error
}

/** Garante a sala pessoal do usuário (cria na ala privada se não existir). */
export async function ensurePersonalRoom(
  userId: string,
  userName: string,
  color: string,
  rooms: OfficeRoom[]
): Promise<OfficeRoom | null> {
  const existing = rooms.find((r) => r.roomType === 'personal' && r.ownerUserId === userId)
  if (existing) return existing
  const firstName = userName.split(' ')[0]
  const result = await createRoom({
    name: `Sala ${firstName}`,
    type: 'personal',
    color,
    ownerUserId: userId,
    createdBy: userId,
    rooms,
  })
  return result.ok ? result.room : null
}
