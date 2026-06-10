// Grid-based A* pathfinding over the office collision map.
// Agents use this to route through doorways instead of walking through walls.
import { COLLISION_WALLS, OFFICE_BOUNDS } from '../config/office'

const CELL = 0.5
// Walls are inflated by the agent body radius so paths keep clearance
const RADIUS = 0.4

const COLS = Math.round((OFFICE_BOUNDS.maxX - OFFICE_BOUNDS.minX) / CELL) + 1
const ROWS = Math.round((OFFICE_BOUNDS.maxZ - OFFICE_BOUNDS.minZ) / CELL) + 1

let blocked: Uint8Array | null = null

function pointBlocked(x: number, z: number): boolean {
  for (const w of COLLISION_WALLS) {
    if (
      x > w.minX - RADIUS && x < w.maxX + RADIUS &&
      z > w.minZ - RADIUS && z < w.maxZ + RADIUS
    ) {
      return true
    }
  }
  return false
}

function buildGrid(): Uint8Array {
  const grid = new Uint8Array(COLS * ROWS)
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = OFFICE_BOUNDS.minX + c * CELL
      const z = OFFICE_BOUNDS.minZ + r * CELL
      grid[r * COLS + c] = pointBlocked(x, z) ? 1 : 0
    }
  }
  return grid
}

function isFree(c: number, r: number): boolean {
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return false
  return blocked![r * COLS + c] === 0
}

function toCell(x: number, z: number): [number, number] {
  const c = Math.max(0, Math.min(COLS - 1, Math.round((x - OFFICE_BOUNDS.minX) / CELL)))
  const r = Math.max(0, Math.min(ROWS - 1, Math.round((z - OFFICE_BOUNDS.minZ) / CELL)))
  return [c, r]
}

function toWorld(c: number, r: number): [number, number] {
  return [OFFICE_BOUNDS.minX + c * CELL, OFFICE_BOUNDS.minZ + r * CELL]
}

// Spiral search for the closest walkable cell (start/end may sit inside furniture
// or hug a wall)
function nearestFree(c: number, r: number): [number, number] | null {
  if (isFree(c, r)) return [c, r]
  for (let radius = 1; radius <= 8; radius++) {
    for (let dc = -radius; dc <= radius; dc++) {
      for (let dr = -radius; dr <= radius; dr++) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== radius) continue
        if (isFree(c + dc, r + dr)) return [c + dc, r + dr]
      }
    }
  }
  return null
}

// Straight-line walkability check used for path smoothing
function lineOfSight(x0: number, z0: number, x1: number, z1: number): boolean {
  const dx = x1 - x0
  const dz = z1 - z0
  const dist = Math.sqrt(dx * dx + dz * dz)
  const steps = Math.max(1, Math.ceil(dist / 0.2))
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    if (pointBlocked(x0 + dx * t, z0 + dz * t)) return false
  }
  return true
}

/**
 * Returns a list of [x, z] waypoints from start to end routed through doorways.
 * Always returns at least [[endX, endZ]] (falls back to a straight line when
 * no route exists).
 */
export function findPath(
  start: [number, number],
  end: [number, number]
): [number, number][] {
  if (!blocked) blocked = buildGrid()

  const fallback: [number, number][] = [[end[0], end[1]]]

  // Direct line available - skip the grid entirely
  if (lineOfSight(start[0], start[1], end[0], end[1])) return fallback

  const startCell = nearestFree(...toCell(start[0], start[1]))
  const endCell = nearestFree(...toCell(end[0], end[1]))
  if (!startCell || !endCell) return fallback

  const size = COLS * ROWS
  const gScore = new Float64Array(size).fill(Infinity)
  const fScore = new Float64Array(size).fill(Infinity)
  const cameFrom = new Int32Array(size).fill(-1)
  const closed = new Uint8Array(size)

  const startIdx = startCell[1] * COLS + startCell[0]
  const endIdx = endCell[1] * COLS + endCell[0]

  const heuristic = (idx: number) => {
    const c = idx % COLS
    const r = Math.floor(idx / COLS)
    const dc = Math.abs(c - endCell[0])
    const dr = Math.abs(r - endCell[1])
    return Math.max(dc, dr) + 0.414 * Math.min(dc, dr)
  }

  gScore[startIdx] = 0
  fScore[startIdx] = heuristic(startIdx)
  const open: number[] = [startIdx]

  let found = false
  while (open.length > 0) {
    // Pop lowest fScore (grid is small enough for a linear scan)
    let best = 0
    for (let i = 1; i < open.length; i++) {
      if (fScore[open[i]] < fScore[open[best]]) best = i
    }
    const current = open.splice(best, 1)[0]
    if (current === endIdx) {
      found = true
      break
    }
    closed[current] = 1

    const c = current % COLS
    const r = Math.floor(current / COLS)

    for (let dc = -1; dc <= 1; dc++) {
      for (let dr = -1; dr <= 1; dr++) {
        if (dc === 0 && dr === 0) continue
        const nc = c + dc
        const nr = r + dr
        if (!isFree(nc, nr)) continue
        // No corner cutting on diagonals
        if (dc !== 0 && dr !== 0 && (!isFree(c + dc, r) || !isFree(c, r + dr))) continue

        const nIdx = nr * COLS + nc
        if (closed[nIdx]) continue

        const cost = dc !== 0 && dr !== 0 ? 1.414 : 1
        const tentative = gScore[current] + cost
        if (tentative < gScore[nIdx]) {
          cameFrom[nIdx] = current
          gScore[nIdx] = tentative
          fScore[nIdx] = tentative + heuristic(nIdx)
          if (!open.includes(nIdx)) open.push(nIdx)
        }
      }
    }
  }

  if (!found) return fallback

  // Reconstruct cell path
  const cells: number[] = []
  let cur = endIdx
  while (cur !== -1) {
    cells.push(cur)
    cur = cameFrom[cur]
  }
  cells.reverse()

  const points: [number, number][] = cells.map((idx) =>
    toWorld(idx % COLS, Math.floor(idx / COLS))
  )

  // Greedy line-of-sight smoothing: keep only the corners we actually need
  const smoothed: [number, number][] = []
  let anchor: [number, number] = [start[0], start[1]]
  let i = 0
  while (i < points.length) {
    let furthest = i
    for (let j = points.length - 1; j > i; j--) {
      if (lineOfSight(anchor[0], anchor[1], points[j][0], points[j][1])) {
        furthest = j
        break
      }
    }
    smoothed.push(points[furthest])
    anchor = points[furthest]
    i = furthest + 1
  }

  // Finish on the exact requested target when reachable from the last node
  const last = smoothed[smoothed.length - 1]
  if (lineOfSight(last[0], last[1], end[0], end[1])) {
    smoothed.push([end[0], end[1]])
  }

  return smoothed
}
