// A* sobre as paredes dinâmicas do escritório — usado pelo auto-walk
// ("ir andando até minha sala"). Grid de 0.5u com suavização por
// linha-de-visão, mesma abordagem do escritório de agentes.
import { BUILDING, Wall, checkWallCollision } from './rooms'

const CELL = 0.5
const RADIUS = 0.36

const COLS = Math.round((BUILDING.maxX - BUILDING.minX) / CELL)
const ROWS = Math.round((BUILDING.maxZ - BUILDING.minZ) / CELL)

function toCell(x: number, z: number): [number, number] {
  return [
    Math.min(COLS - 1, Math.max(0, Math.round((x - BUILDING.minX) / CELL))),
    Math.min(ROWS - 1, Math.max(0, Math.round((z - BUILDING.minZ) / CELL))),
  ]
}

function toWorld(cx: number, cz: number): [number, number] {
  return [BUILDING.minX + cx * CELL, BUILDING.minZ + cz * CELL]
}

function buildBlockedGrid(walls: Wall[]): Uint8Array {
  const grid = new Uint8Array(COLS * ROWS)
  for (let cz = 0; cz < ROWS; cz++) {
    for (let cx = 0; cx < COLS; cx++) {
      const [wx, wz] = toWorld(cx, cz)
      if (
        wx < BUILDING.minX + RADIUS ||
        wx > BUILDING.maxX - RADIUS ||
        wz < BUILDING.minZ + RADIUS ||
        wz > BUILDING.maxZ - RADIUS ||
        checkWallCollision(wx, wz, RADIUS, walls)
      ) {
        grid[cz * COLS + cx] = 1
      }
    }
  }
  return grid
}

function nearestFree(grid: Uint8Array, cx: number, cz: number): [number, number] | null {
  if (!grid[cz * COLS + cx]) return [cx, cz]
  for (let r = 1; r <= 8; r++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue
        const nx = cx + dx
        const nz = cz + dz
        if (nx < 0 || nz < 0 || nx >= COLS || nz >= ROWS) continue
        if (!grid[nz * COLS + nx]) return [nx, nz]
      }
    }
  }
  return null
}

function lineOfSight(ax: number, az: number, bx: number, bz: number, walls: Wall[]): boolean {
  const dist = Math.hypot(bx - ax, bz - az)
  const steps = Math.max(2, Math.ceil(dist / 0.25))
  for (let i = 1; i < steps; i++) {
    const t = i / steps
    if (checkWallCollision(ax + (bx - ax) * t, az + (bz - az) * t, RADIUS, walls)) return false
  }
  return true
}

/**
 * Caminho de (sx,sz) até (ex,ez) desviando das paredes.
 * Retorna waypoints [x,z][] (sem o ponto inicial) ou null se não há rota.
 */
export function findPath(
  sx: number,
  sz: number,
  ex: number,
  ez: number,
  walls: Wall[]
): [number, number][] | null {
  const grid = buildBlockedGrid(walls)
  const startCell = nearestFree(grid, ...toCell(sx, sz))
  const endCell = nearestFree(grid, ...toCell(ex, ez))
  if (!startCell || !endCell) return null

  const [scx, scz] = startCell
  const [ecx, ecz] = endCell
  const startIdx = scz * COLS + scx
  const endIdx = ecz * COLS + ecx
  if (startIdx === endIdx) return [[ex, ez]]

  const gScore = new Float32Array(COLS * ROWS).fill(Infinity)
  const cameFrom = new Int32Array(COLS * ROWS).fill(-1)
  const open: number[] = [startIdx]
  const fScore = new Float32Array(COLS * ROWS).fill(Infinity)
  gScore[startIdx] = 0
  fScore[startIdx] = Math.hypot(ecx - scx, ecz - scz)
  const inOpen = new Uint8Array(COLS * ROWS)
  inOpen[startIdx] = 1

  const DIRS = [
    [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
    [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414],
  ]

  let found = false
  let guard = 0
  while (open.length > 0 && guard++ < 60000) {
    // menor fScore (busca linear — grid pequeno)
    let bi = 0
    for (let i = 1; i < open.length; i++) {
      if (fScore[open[i]] < fScore[open[bi]]) bi = i
    }
    const current = open[bi]
    if (current === endIdx) {
      found = true
      break
    }
    open[bi] = open[open.length - 1]
    open.pop()
    inOpen[current] = 0

    const ccx = current % COLS
    const ccz = Math.floor(current / COLS)

    for (const [dx, dz, cost] of DIRS) {
      const nx = ccx + dx
      const nz = ccz + dz
      if (nx < 0 || nz < 0 || nx >= COLS || nz >= ROWS) continue
      const ni = nz * COLS + nx
      if (grid[ni]) continue
      // diagonal só se os dois ortogonais estão livres (não corta quina)
      if (dx !== 0 && dz !== 0 && (grid[ccz * COLS + nx] || grid[nz * COLS + ccx])) continue
      const tentative = gScore[current] + cost
      if (tentative < gScore[ni]) {
        gScore[ni] = tentative
        fScore[ni] = tentative + Math.hypot(ecx - nx, ecz - nz)
        cameFrom[ni] = current
        if (!inOpen[ni]) {
          open.push(ni)
          inOpen[ni] = 1
        }
      }
    }
  }

  if (!found) return null

  // Reconstrói e converte pra mundo
  const cells: [number, number][] = []
  let cur = endIdx
  while (cur !== -1 && cur !== startIdx) {
    cells.push(toWorld(cur % COLS, Math.floor(cur / COLS)))
    cur = cameFrom[cur]
  }
  cells.reverse()
  // destino exato no final
  cells[cells.length - 1] = [ex, ez]

  // Suavização: pula waypoints com linha de visão direta
  const smooth: [number, number][] = []
  let anchor: [number, number] = [sx, sz]
  let i = 0
  while (i < cells.length) {
    let j = cells.length - 1
    while (j > i && !lineOfSight(anchor[0], anchor[1], cells[j][0], cells[j][1], walls)) j--
    smooth.push(cells[j])
    anchor = cells[j]
    i = j + 1
  }
  return smooth
}
