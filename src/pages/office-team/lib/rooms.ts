// Salas dinâmicas do escritório — carregadas do banco (office_team_rooms).
// Gera paredes/colisão/portas a partir das salas; sala trancada fecha a porta
// para quem está fora (lock só vale enquanto quem trancou estiver online).
import { supabase } from '@/integrations/supabase/client'
import { ELEVATOR, ELEVATOR_ZONE, ELEVATOR_FRONT, RECEPTION_DESK } from './floors'

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
  /** música lofi tocando na sala (todo mundo dentro ouve) */
  musicOn: boolean
  musicVideoId: string
  /** andar do prédio (0 = térreo). Todos os andares têm a mesma planta. */
  floor: number
}

export interface Wall {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

// Limites do prédio (perímetro com colisão) — laje do TÉRREO.
export const BUILDING = { minX: -30, maxX: 30, minZ: -20, maxZ: 29 }

export interface Bounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

const FLOOR_PAD = 3.5 // corredor em volta das salas nos andares de cima
const FLOOR_MIN_W = 24
const FLOOR_MIN_D = 22

/**
 * Laje do andar, proporcional ao conteúdo. Térreo = BUILDING (portaria,
 * estacionamento, ala pessoal). Andares de cima = retângulo que envolve as
 * salas do andar + o elevador (caixa e zona da frente) + margem de corredor,
 * nunca menor que 24 x 22 e sempre com espaço ao sul do elevador (o jogador
 * chega em ELEVATOR_FRONT).
 */
export function floorBounds(floor: number, roomsOnFloor: OfficeRoom[]): Bounds {
  if (floor === 0) return BUILDING
  let minX = Math.min(ELEVATOR.minX, ELEVATOR_ZONE.minX)
  let maxX = Math.max(ELEVATOR.maxX, ELEVATOR_ZONE.maxX)
  let minZ = Math.min(ELEVATOR.minZ, ELEVATOR_ZONE.minZ)
  let maxZ = Math.max(ELEVATOR.maxZ, ELEVATOR_ZONE.maxZ)
  for (const r of roomsOnFloor) {
    if (r.floor !== floor) continue
    minX = Math.min(minX, r.x - r.width / 2)
    maxX = Math.max(maxX, r.x + r.width / 2)
    minZ = Math.min(minZ, r.z - r.depth / 2)
    maxZ = Math.max(maxZ, r.z + r.depth / 2)
  }
  minX -= FLOOR_PAD
  maxX += FLOOR_PAD
  minZ -= FLOOR_PAD
  maxZ += FLOOR_PAD
  maxZ = Math.max(maxZ, ELEVATOR_FRONT.z + 4)
  // Mínimo 24 x 22 (expande dos dois lados em volta do centro)
  if (maxX - minX < FLOOR_MIN_W) {
    const c = (minX + maxX) / 2
    minX = c - FLOOR_MIN_W / 2
    maxX = c + FLOOR_MIN_W / 2
  }
  if (maxZ - minZ < FLOOR_MIN_D) {
    const extra = FLOOR_MIN_D - (maxZ - minZ)
    minZ -= extra / 2
    maxZ += extra / 2
  }
  const round = (v: number) => Math.round(v * 10) / 10
  return { minX: round(minX), maxX: round(maxX), minZ: round(minZ), maxZ: round(maxZ) }
}

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
    musicOn: Boolean(row.music_on),
    musicVideoId: (row.music_video_id as string) || 'X4VbdwhkE10',
    floor: Number(row.floor ?? 0),
  }
}

/** Salas de um andar (a planta é a mesma; o que muda é o conjunto). */
export function roomsOnFloor(rooms: OfficeRoom[], floor: number): OfficeRoom[] {
  return rooms.filter((r) => r.floor === floor)
}

/** Master move uma sala de andar (o slot x/z é o mesmo na planta de todos). */
export async function setRoomFloor(roomId: string, floor: number): Promise<boolean> {
  const { error } = await supabase
    .from('office_team_rooms' as never)
    .update({ floor } as never)
    .eq('id', roomId)
  return !error
}

/** Liga/desliga a música lofi da sala (só o dono usa — o front garante). */
export async function setRoomMusic(roomId: string, on: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('office_team_rooms' as never)
    .update({ music_on: on } as never)
    .eq('id', roomId)
  return !error
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
  // Lounge é área aberta: sem paredes, sem porta, sem colisão
  if (room.roomType === 'lounge') return []
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
  if (room.roomType === 'lounge') return false // área aberta não tranca
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
  meId?: string,
  floor = 0
): Wall[] {
  // Perímetro = laje do andar (térreo: BUILDING; cima: proporcional às salas)
  const b = floorBounds(floor, rooms)
  const walls: Wall[] = [
    { minX: b.minX - 1, maxX: b.minX, minZ: b.minZ - 1, maxZ: b.maxZ + 1 },
    { minX: b.maxX, maxX: b.maxX + 1, minZ: b.minZ - 1, maxZ: b.maxZ + 1 },
    { minX: b.minX - 1, maxX: b.maxX + 1, minZ: b.minZ - 1, maxZ: b.minZ },
    { minX: b.minX - 1, maxX: b.maxX + 1, minZ: b.maxZ, maxZ: b.maxZ + 1 },
    ...fixtureColliders(floor),
  ]
  for (const room of rooms) {
    const locked = isEffectivelyLocked(room, onlineUserIds)
    const doorOpen = !locked || insideRoomId === room.id || (!!meId && room.lockedBy === meId)
    walls.push(...roomWalls(room, doorOpen))
  }
  return walls
}

/** Mobiliário fixo da planta (não vem do banco): caixa do elevador em todos
 * os andares + balcão da recepção no térreo. Entra na colisão e no A*. */
export function fixtureColliders(floor: number): Wall[] {
  const out: Wall[] = [{ minX: ELEVATOR.minX, maxX: ELEVATOR.maxX, minZ: ELEVATOR.minZ, maxZ: ELEVATOR.maxZ }]
  if (floor === 0) {
    out.push({
      minX: RECEPTION_DESK.x - RECEPTION_DESK.w / 2,
      maxX: RECEPTION_DESK.x + RECEPTION_DESK.w / 2,
      minZ: RECEPTION_DESK.z - RECEPTION_DESK.d / 2,
      maxZ: RECEPTION_DESK.z + RECEPTION_DESK.d / 2,
    })
  }
  return out
}

export function checkWallCollision(x: number, z: number, radius: number, walls: Wall[]): boolean {
  for (const wall of walls) {
    if (x + radius > wall.minX && x - radius < wall.maxX && z + radius > wall.minZ && z - radius < wall.maxZ) {
      return true
    }
  }
  return false
}

/** Acha o próximo slot livre para uma sala nova do tipo dado NUM andar
 * (um slot ocupado no 1º continua livre no 2º). */
export function findFreeSlot(
  type: RoomType,
  rooms: OfficeRoom[],
  floor = 0
): { x: number; z: number; w: number; d: number; door: 'N' | 'S' } | null {
  const sameFloor = roomsOnFloor(rooms, floor)
  for (const slot of SLOTS[type]) {
    const overlapping = sameFloor.some(
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
  /** andar da sala nova (padrão: térreo) */
  floor?: number
}): Promise<CreateRoomResult> {
  const floor = opts.floor ?? 0
  const slot = findFreeSlot(opts.type, opts.rooms, floor)
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
      floor,
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

/** Ilha de mesas da sala de setor: mesa dupla (duas cadeiras frente a
 * frente, uma ao norte e outra ao sul). */
export interface DeskIsland {
  x: number
  z: number
}

/**
 * Ilhas de mesas da sala de setor, proporcionais ao tamanho da sala:
 * uma mesa dupla a cada ~3.4 de largura, em até 2 fileiras se a profundidade
 * permitir, deixando 2 de corredor na frente da porta e 1 no fundo.
 * (Mesma fonte pro ModernOffice desenhar e pro collider da mobília.)
 */
export function sectorIslands(room: OfficeRoom): DeskIsland[] {
  const usableW = room.width - 2
  const cols = Math.max(1, Math.floor(usableW / 3.4))
  const pitch = usableW / cols
  const x0 = room.x - usableW / 2 + pitch / 2
  // Faixa útil em z: 2 na frente da porta, 1 no fundo
  const front = room.doorSide === 'S' ? room.z + room.depth / 2 - 2 : room.z - room.depth / 2 + 2
  const back = room.doorSide === 'S' ? room.z - room.depth / 2 + 1 : room.z + room.depth / 2 - 1
  const zStart = Math.min(front, back)
  const zLen = Math.abs(front - back)
  const rows = zLen >= 5.6 ? 2 : 1
  const out: DeskIsland[] = []
  for (let r = 0; r < rows; r++) {
    const z = zStart + (r + 0.5) * (zLen / rows)
    for (let c = 0; c < cols; c++) out.push({ x: x0 + c * pitch, z })
  }
  return out
}

/** Lounge largo (> 12): conjuntos extras de sofá + mesa de centro entre o
 * núcleo oeste e o central, e entre o central e as mesas bistrô. Devolve os
 * centros x dos conjuntos. Lounge de 10 (térreo) não ganha nenhum. */
export function loungeExtraSets(room: OfficeRoom): number[] {
  if (room.width <= 12) return []
  const left = room.x - room.width / 2
  const right = room.x + room.width / 2
  const out: number[] = []
  // Entre o núcleo oeste (até left + 5.3) e o central (a partir de x - 2.15)
  const westGapStart = left + 5.3
  const westGapEnd = room.x - 2.15
  const nWest = Math.floor((westGapEnd - westGapStart) / 4.2)
  for (let i = 0; i < nWest; i++) out.push(westGapStart + 2.1 + i * 4.2)
  // Entre o central (até x + 1.2) e os bistrôs (a partir de right - 6.15)
  const eastGapStart = room.x + 1.2
  const eastGapEnd = right - 6.15
  const nEast = Math.floor((eastGapEnd - eastGapStart) / 4.2)
  for (let i = 0; i < nEast; i++) out.push(eastGapStart + 2.1 + i * 4.2)
  return out
}

/**
 * Colliders aproximados (AABB) da mobília — espelham as posições renderizadas
 * no ModernOffice. Usados na colisão de movimento e no pathfinding pra
 * ninguém atravessar mesa/sofá/balcão. (Assentos ficam DENTRO de alguns
 * colliders: o LocalPlayer ignora mobília quando está indo sentar.)
 */
export function furnitureColliders(rooms: OfficeRoom[]): Wall[] {
  const out: Wall[] = []
  const box = (x: number, z: number, hw: number, hd: number) =>
    out.push({ minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd })
  for (const r of rooms) {
    if (r.roomType === 'personal') {
      const deskZ = r.z + r.depth / 2 - 1.3
      // Collider justo: precisa sobrar passagem entre a mesa e a parede
      // do fundo (onde fica a cadeira do dono)
      box(r.x, deskZ, 0.8, 0.28) // mesa
    } else if (r.roomType === 'meeting') {
      const len = Math.max(3, r.width - 4.5)
      box(r.x, r.z, len / 2, 0.8) // mesa de reunião
    } else if (r.roomType === 'sector') {
      // Ilhas de mesas duplas (as cadeiras ficam fora do collider)
      for (const isl of sectorIslands(r)) box(isl.x, isl.z, 0.85, 0.45)
    } else if (r.roomType === 'lounge') {
      const left = r.x - r.width / 2
      const right = r.x + r.width / 2
      const backZ = r.z - r.depth / 2
      box(right - 2.4, backZ + 1.1, 1.5, 0.4) // balcão de café
      box(left + 3.2, r.z - 1.7, 0.85, 0.4) // sofás/mesas dos núcleos
      box(left + 1.6, r.z - 0.2, 0.4, 0.85)
      box(r.x - 0.5, r.z + 2.5, 0.85, 0.4)
      box(r.x - 0.5, r.z + 0.3, 0.85, 0.4)
      box(right - 3, r.z + 0.6, 0.28, 0.28) // bistrôs
      box(right - 5.4, r.z + 2.2, 0.28, 0.28)
      box(right - 1.8, r.z + 2.8, 0.28, 0.28)
      for (const sx of loungeExtraSets(r)) {
        box(sx, r.z + 2.5, 0.85, 0.4) // conjuntos extras (lounge largo)
        box(sx, r.z + 0.3, 0.85, 0.4)
      }
    }
  }
  return out
}

/** Assento do dono na sala pessoal: cadeira atrás da mesa, olhando pra porta. */
export function personalOwnerSeat(room: OfficeRoom): { x: number; z: number; rot: number } {
  const deskZ = room.z + room.depth / 2 - 1.3
  return { x: room.x, z: deskZ + 0.7, rot: Math.PI }
}

/** Cadeira de visita na sala pessoal: à frente da mesa, de frente pro dono.
 * (mesma posição das cadeiras de visita no PersonalFurniture) */
export function personalVisitorSeat(room: OfficeRoom): { x: number; z: number; rot: number } {
  const deskZ = room.z + room.depth / 2 - 1.3
  return { x: room.x - 0.55, z: deskZ - 1.4, rot: 0 }
}

/** Garante a sala pessoal do usuário.
 * A ala privada já vem com os 16 slots criados (várias "Sala vazia" sem dono).
 * Um usuário novo REIVINDICA uma sala vazia existente — não adianta tentar
 * "criar" porque todos os slots já estão ocupados por linhas de sala e o
 * findFreeSlot nunca acha vaga (era por isso que o novato entrava sem sala). */
export async function ensurePersonalRoom(
  userId: string,
  userName: string,
  color: string,
  rooms: OfficeRoom[]
): Promise<OfficeRoom | null> {
  const existing = rooms.find((r) => r.roomType === 'personal' && r.ownerUserId === userId)
  if (existing) return existing
  const firstName = userName.split(' ')[0]

  // 1) Reivindica uma sala pessoal vazia (owner nulo). Só as placeholder "Sala vazia"
  //    são reivindicáveis — salas sem dono mas com nome próprio (ex.: "Marcelo Almeida",
  //    reservada do NPC) ficam de fora. O filtro is('owner_user_id', null) no UPDATE
  //    evita corrida: se outro novato pegou primeiro, esta linha volta vazia e tentamos a próxima.
  const emptyRooms = rooms.filter(
    (r) => r.roomType === 'personal' && !r.ownerUserId && r.name === 'Sala vazia'
  )
  for (const empty of emptyRooms) {
    const { data, error } = await supabase
      .from('office_team_rooms' as never)
      .update({ owner_user_id: userId, name: `Sala ${firstName}`, color } as never)
      .eq('id', empty.id)
      .is('owner_user_id', null)
      .select('*')
      .maybeSingle()
    if (!error && data) return mapRow(data as unknown as Record<string, unknown>)
  }

  // 2) Sem sala vazia disponível → cria nova num slot livre (raro).
  //    Salas pessoais ficam na ala do térreo.
  const result = await createRoom({
    name: `Sala ${firstName}`,
    type: 'personal',
    color,
    ownerUserId: userId,
    createdBy: userId,
    rooms,
    floor: 0,
  })
  return result.ok ? result.room : null
}
