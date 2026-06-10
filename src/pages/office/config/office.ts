// Office layout dimensions and room definitions
// Grid is centered at 0,0
// X axis: left (-) to right (+)
// Z axis: top (-) to bottom (+)

export interface Room {
  id: string
  name: string
  x: number
  z: number
  width: number
  depth: number
  wallColor: string
  floorColor: string
  accentColor: string
}

export const ROOMS: Room[] = [
  {
    id: 'ceo',
    name: 'CEO Office',
    x: -12,
    z: -8,
    width: 10,
    depth: 8,
    wallColor: '#1a2040',
    floorColor: '#2a2a3a',
    accentColor: '#1B2951',
  },
  {
    id: 'finance',
    name: 'Finance',
    x: 4,
    z: -8,
    width: 8,
    depth: 8,
    wallColor: '#1a3028',
    floorColor: '#2a3028',
    accentColor: '#1B6B3A',
  },
  {
    id: 'crm',
    name: 'CRM',
    x: -12,
    z: 0,
    width: 8,
    depth: 8,
    wallColor: '#1a2538',
    floorColor: '#252535',
    accentColor: '#1A4A8A',
  },
  {
    id: 'projects',
    name: 'Projects',
    x: 4,
    z: 0,
    width: 10,
    depth: 8,
    wallColor: '#251a38',
    floorColor: '#2a2535',
    accentColor: '#6B2FA0',
  },
  {
    id: 'openspace',
    name: 'Open Space',
    x: 14,
    z: 0,
    width: 6,
    depth: 8,
    wallColor: '#2a2a2a',
    floorColor: '#303030',
    accentColor: '#555555',
  },
  {
    id: 'meeting',
    name: 'Meeting Room',
    x: -4,
    z: 4,
    width: 18,
    depth: 6,
    wallColor: '#2a2020',
    floorColor: '#2a2525',
    accentColor: '#8B4513',
  },
  {
    id: 'coffee',
    name: 'Coffee Area',
    x: -12,
    z: 10,
    width: 6,
    depth: 6,
    wallColor: '#2a2218',
    floorColor: '#302820',
    accentColor: '#8B6914',
  },
  {
    id: 'marketing',
    name: 'Marketing',
    x: -4,
    z: 10,
    width: 8,
    depth: 6,
    wallColor: '#382015',
    floorColor: '#302520',
    accentColor: '#B85C00',
  },
  {
    id: 'creative',
    name: 'Creative',
    x: 6,
    z: 10,
    width: 8,
    depth: 6,
    wallColor: '#38152a',
    floorColor: '#302030',
    accentColor: '#C2185B',
  },
]

export const OFFICE_BOUNDS = {
  minX: -18,
  maxX: 20,
  minZ: -14,
  maxZ: 16,
}

export const COFFEE_MACHINE_POSITION: [number, number, number] = [-13, 0, 12]
export const MEETING_TABLE_POSITION: [number, number, number] = [-4, 0, 6]

export interface WallAABB {
  minX: number; maxX: number; minZ: number; maxZ: number
}

// Wall collision boxes - represent each wall segment
// Walls have door gaps so player can pass through doorways
export const COLLISION_WALLS: WallAABB[] = [
  // Outer walls
  { minX: -18.2, maxX: 20.2, minZ: -14.2, maxZ: -13.7 }, // North
  { minX: -18.2, maxX: 20.2, minZ: 15.7, maxZ: 16.2 },   // South
  { minX: -18.2, maxX: -17.7, minZ: -14.2, maxZ: 16.2 }, // West
  { minX: 19.7, maxX: 20.2, minZ: -14.2, maxZ: 16.2 },   // East

  // CEO / Finance separator (x=-1, gap door at z=-9 to z=-7)
  { minX: -1.15, maxX: -0.85, minZ: -14, maxZ: -9.2 },
  { minX: -1.15, maxX: -0.85, minZ: -6.8, maxZ: -4 },

  // Top row / middle row (z=-4.1) - gap door from x=-5 to x=0
  { minX: -18, maxX: -5.3, minZ: -4.25, maxZ: -3.95 },
  { minX: 0.3, maxX: 20, minZ: -4.25, maxZ: -3.95 },

  // CRM / Projects separator (x=-4, gap at z=-1 to z=1.5)
  { minX: -4.15, maxX: -3.85, minZ: -4, maxZ: -1.2 },
  { minX: -4.15, maxX: -3.85, minZ: 1.7, maxZ: 4 },

  // Projects / Open space (x=11, gap at z=-2 to z=0)
  { minX: 10.85, maxX: 11.15, minZ: -4, maxZ: -2.2 },
  { minX: 10.85, maxX: 11.15, minZ: 0.2, maxZ: 4 },

  // Middle row / Meeting (z=4.1) - gap door from x=-6 to x=-1
  { minX: -18, maxX: -6.3, minZ: 3.95, maxZ: 4.25 },
  { minX: -0.7, maxX: 20, minZ: 3.95, maxZ: 4.25 },

  // Meeting / Bottom row (z=9.1) - two door gaps: x=-12.5 to -9.5, x=-2 to x=2
  { minX: -18, maxX: -12.8, minZ: 8.95, maxZ: 9.25 },
  { minX: -9.2, maxX: -2.3, minZ: 8.95, maxZ: 9.25 },
  { minX: 2.3, maxX: 20, minZ: 8.95, maxZ: 9.25 },

  // Coffee / Marketing (x=-7, gap at z=11.5 to z=13)
  { minX: -7.15, maxX: -6.85, minZ: 9.2, maxZ: 11.3 },
  { minX: -7.15, maxX: -6.85, minZ: 13.2, maxZ: 16 },

  // Marketing / Creative (x=2, gap at z=11.5 to z=13)
  { minX: 1.85, maxX: 2.15, minZ: 9.2, maxZ: 11.3 },
  { minX: 1.85, maxX: 2.15, minZ: 13.2, maxZ: 16 },
]

// Doorways (gaps between COLLISION_WALLS segments) - used to render door
// frames/lintels so openings read as doors instead of missing wall chunks.
// orientation 'v' = wall runs along Z at fixed X; 'h' = wall runs along X at fixed Z
export interface Door {
  x: number
  z: number
  width: number
  orientation: 'h' | 'v'
}

export const DOORS: Door[] = [
  { x: -1, z: -8, width: 2.4, orientation: 'v' },     // CEO / Finance
  { x: -2.5, z: -4.1, width: 5.6, orientation: 'h' }, // Top row / middle row
  { x: -4, z: 0.25, width: 2.9, orientation: 'v' },   // CRM / Projects
  { x: 11, z: -1, width: 2.4, orientation: 'v' },     // Projects / Open space
  { x: -3.5, z: 4.1, width: 5.6, orientation: 'h' },  // Middle row / Meeting
  { x: -11, z: 9.1, width: 3.6, orientation: 'h' },   // Meeting / Coffee
  { x: 0, z: 9.1, width: 4.6, orientation: 'h' },     // Meeting / Marketing
  { x: -7, z: 12.25, width: 1.9, orientation: 'v' },  // Coffee / Marketing
  { x: 2, z: 12.25, width: 1.9, orientation: 'v' },   // Marketing / Creative
]
