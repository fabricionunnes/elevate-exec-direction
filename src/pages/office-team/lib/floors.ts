// Andares do prédio UNV Office. Todos os andares usam a MESMA planta
// (mesmo BUILDING, mesmos SLOTS, mesmo elevador); o que muda é o conjunto
// de salas (office_team_rooms.floor). O térreo é a portaria: recepção,
// reuniões, café e as salas pessoais. Os setores ficam nos andares de cima.

export interface FloorInfo {
  n: number
  name: string
  sub?: string
}

export const FLOORS: FloorInfo[] = [
  { n: 0, name: 'Térreo', sub: 'Recepção, reuniões e convivência' },
  { n: 1, name: 'Comercial' },
  { n: 2, name: 'Entrega e CS' },
  { n: 3, name: 'Marketing e Conteúdo' },
  { n: 4, name: 'Financeiro e Admin' },
  { n: 5, name: 'Diretoria', sub: 'Cobertura' },
]

export function floorInfo(n: number): FloorInfo {
  return FLOORS.find((f) => f.n === n) ?? { n, name: `Andar ${n}` }
}

/** "Térreo" / "1º andar · Comercial" */
export function floorLabel(n: number): string {
  const f = floorInfo(n)
  if (f.n === 0) return f.name
  return `${f.n}º andar · ${f.name}`
}

/** Versão curta pra pílulas e listas: "Térreo" / "3º · Marketing e Conteúdo" */
export function floorShort(n: number): string {
  const f = floorInfo(n)
  if (f.n === 0) return f.name
  return `${f.n}º · ${f.name}`
}

// ── Elevador: mesmo lugar em todos os andares ───────────────────────────
// Vão central entre a fileira de reuniões (z até 11.5) e a ala pessoal
// (corredor começa em z 14.4; passagem central livre em x -5.1..5.1).
export const ELEVATOR = { minX: -2.2, maxX: 2.2, minZ: 13, maxZ: 15.4 }
/** Onde o jogador aparece ao chegar num andar (na frente da porta, lado sul). */
export const ELEVATOR_FRONT = { x: 0, z: 16.6 }
/** Zona na frente do elevador que abre o painel de andares ao entrar. */
export const ELEVATOR_ZONE = { minX: -2.0, maxX: 2.0, minZ: 15.4, maxZ: 17.2 }

// ── Recepção (só no térreo): balcão no vão central perto da entrada sul ──
// Fica no lado leste do vão (x 1.7..4.3) pra deixar o caminho porta → elevador livre.
export const RECEPTION_DESK = { x: 3.0, z: 25.2, w: 2.6, d: 0.7 }
