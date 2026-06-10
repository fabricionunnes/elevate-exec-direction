import { useRef } from 'react'
import * as THREE from 'three'
import { COLLISION_WALLS, DOORS } from '../config/office'

// Reusable box component
function Box({
  position,
  size,
  color,
  receiveShadow = true,
  castShadow = false,
  roughness = 0.8,
  metalness = 0,
}: {
  position: [number, number, number]
  size: [number, number, number]
  color: string
  receiveShadow?: boolean
  castShadow?: boolean
  roughness?: number
  metalness?: number
}) {
  return (
    <mesh position={position} receiveShadow={receiveShadow} castShadow={castShadow}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />
    </mesh>
  )
}

// Desk component
function Desk({
  position,
  rotation = 0,
  color,
}: {
  position: [number, number, number]
  rotation?: number
  color: string
}) {
  const [x, y, z] = position
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Desk top */}
      <Box position={[0, 0.75, 0]} size={[1.6, 0.08, 0.8]} color={color} castShadow roughness={0.5} />
      {/* Desk legs */}
      <Box position={[-0.7, 0.35, 0.35]} size={[0.06, 0.7, 0.06]} color="#333" castShadow />
      <Box position={[0.7, 0.35, 0.35]} size={[0.06, 0.7, 0.06]} color="#333" castShadow />
      <Box position={[-0.7, 0.35, -0.35]} size={[0.06, 0.7, 0.06]} color="#333" castShadow />
      <Box position={[0.7, 0.35, -0.35]} size={[0.06, 0.7, 0.06]} color="#333" castShadow />
      {/* Monitor */}
      <Box position={[0, 1.2, -0.2]} size={[0.8, 0.5, 0.04]} color="#111" castShadow roughness={0.2} metalness={0.5} />
      <Box position={[0, 0.85, -0.2]} size={[0.06, 0.3, 0.06]} color="#222" castShadow />
      <Box position={[0, 0.79, -0.2]} size={[0.25, 0.04, 0.15]} color="#222" castShadow />
      {/* Monitor glow */}
      <mesh position={[0, 1.2, -0.18]}>
        <boxGeometry args={[0.74, 0.44, 0.01]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} roughness={0.1} />
      </mesh>
      {/* Keyboard */}
      <Box position={[0, 0.8, 0.1]} size={[0.5, 0.02, 0.2]} color="#2a2a2a" roughness={0.9} />
    </group>
  )
}

// Chair component
function Chair({
  position,
  rotation = 0,
  color,
}: {
  position: [number, number, number]
  rotation?: number
  color: string
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Seat */}
      <Box position={[0, 0.45, 0]} size={[0.5, 0.06, 0.5]} color={color} castShadow roughness={0.7} />
      {/* Back */}
      <Box position={[0, 0.75, -0.22]} size={[0.5, 0.55, 0.06]} color={color} castShadow roughness={0.7} />
      {/* Legs */}
      <Box position={[-0.2, 0.2, 0.2]} size={[0.05, 0.4, 0.05]} color="#444" castShadow />
      <Box position={[0.2, 0.2, 0.2]} size={[0.05, 0.4, 0.05]} color="#444" castShadow />
      <Box position={[-0.2, 0.2, -0.2]} size={[0.05, 0.4, 0.05]} color="#444" castShadow />
      <Box position={[0.2, 0.2, -0.2]} size={[0.05, 0.4, 0.05]} color="#444" castShadow />
    </group>
  )
}

// Plant component
function Plant({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Pot */}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.15, 0.12, 0.3, 8]} />
        <meshStandardMaterial color="#8B5A2B" roughness={0.9} />
      </mesh>
      {/* Soil */}
      <mesh position={[0, 0.36, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.04, 8]} />
        <meshStandardMaterial color="#3d2b1f" roughness={1} />
      </mesh>
      {/* Leaves */}
      <mesh position={[0, 0.7, 0]}>
        <sphereGeometry args={[0.3, 8, 6]} />
        <meshStandardMaterial color="#2d7a3a" roughness={0.8} />
      </mesh>
      <mesh position={[0.15, 0.55, 0.1]}>
        <sphereGeometry args={[0.2, 8, 6]} />
        <meshStandardMaterial color="#3a8f47" roughness={0.8} />
      </mesh>
      <mesh position={[-0.12, 0.6, -0.08]}>
        <sphereGeometry args={[0.18, 8, 6]} />
        <meshStandardMaterial color="#257033" roughness={0.8} />
      </mesh>
    </group>
  )
}

// Wall label
function RoomLabel({
  position,
  text,
  color,
}: {
  position: [number, number, number]
  text: string
  color: string
}) {
  return (
    <group position={position}>
      <Box position={[0, 0, 0]} size={[2, 0.4, 0.05]} color={color} roughness={0.5} metalness={0.3} />
    </group>
  )
}

// Coffee machine
function CoffeeMachine({ position }: { position: [number, number, number] }) {
  const [x, y, z] = position
  return (
    <group position={position}>
      {/* Body */}
      <Box position={[0, 0.5, 0]} size={[0.4, 0.8, 0.3]} color="#1a1a1a" castShadow roughness={0.3} metalness={0.7} />
      {/* Top */}
      <Box position={[0, 0.95, 0]} size={[0.38, 0.1, 0.28]} color="#222" castShadow roughness={0.2} metalness={0.8} />
      {/* Screen */}
      <mesh position={[0, 0.65, 0.16]}>
        <boxGeometry args={[0.2, 0.15, 0.01]} />
        <meshStandardMaterial color="#0066cc" emissive="#0066cc" emissiveIntensity={0.5} />
      </mesh>
      {/* Buttons */}
      <Box position={[-0.08, 0.45, 0.16]} size={[0.06, 0.06, 0.02]} color="#cc3300" roughness={0.3} />
      <Box position={[0.08, 0.45, 0.16]} size={[0.06, 0.06, 0.02]} color="#00aa44" roughness={0.3} />
      {/* Spout */}
      <Box position={[0, 0.35, 0.2]} size={[0.04, 0.1, 0.1]} color="#333" castShadow roughness={0.4} metalness={0.6} />
      {/* Cup */}
      <mesh position={[0, 0.13, 0.22]}>
        <cylinderGeometry args={[0.06, 0.05, 0.12, 8]} />
        <meshStandardMaterial color="#f5f5f5" roughness={0.8} />
      </mesh>
      {/* Counter */}
      <Box position={[0, 0.04, 0]} size={[0.8, 0.08, 0.5]} color="#5a3820" castShadow roughness={0.6} />
    </group>
  )
}

// Meeting table
function MeetingTable({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Table surface */}
      <Box position={[0, 0.75, 0]} size={[5, 0.1, 2]} color="#3a2510" castShadow roughness={0.4} metalness={0.1} />
      {/* Table legs */}
      <Box position={[-2.2, 0.35, 0.8]} size={[0.1, 0.7, 0.1]} color="#2a1a0a" castShadow />
      <Box position={[2.2, 0.35, 0.8]} size={[0.1, 0.7, 0.1]} color="#2a1a0a" castShadow />
      <Box position={[-2.2, 0.35, -0.8]} size={[0.1, 0.7, 0.1]} color="#2a1a0a" castShadow />
      <Box position={[2.2, 0.35, -0.8]} size={[0.1, 0.7, 0.1]} color="#2a1a0a" castShadow />
      {/* Center support */}
      <Box position={[0, 0.35, 0]} size={[0.15, 0.7, 0.15]} color="#2a1a0a" castShadow />
      {/* Meeting chairs */}
      {[-1.8, -0.6, 0.6, 1.8].map((xOff, i) => (
        <Chair
          key={`chair-top-${i}`}
          position={[xOff, 0, -1.4]}
          rotation={0}
          color="#6B2FA0"
        />
      ))}
      {[-1.8, -0.6, 0.6, 1.8].map((xOff, i) => (
        <Chair
          key={`chair-bot-${i}`}
          position={[xOff, 0, 1.4]}
          rotation={Math.PI}
          color="#6B2FA0"
        />
      ))}
      {/* Laptop on table */}
      <Box position={[0, 0.82, 0]} size={[0.6, 0.02, 0.4]} color="#222" roughness={0.3} metalness={0.5} />
      <Box position={[0, 0.95, -0.19]} size={[0.6, 0.25, 0.02]} color="#222" roughness={0.3} metalness={0.5} />
    </group>
  )
}

// Bookshelf
function Bookshelf({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  const bookColors = ['#cc2200', '#0044cc', '#228800', '#cc8800', '#8800cc', '#006688']
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Frame */}
      <Box position={[0, 0.75, 0]} size={[1.2, 1.5, 0.3]} color="#4a2a10" castShadow roughness={0.7} />
      {/* Shelves */}
      <Box position={[0, 0.3, 0]} size={[1.1, 0.04, 0.25]} color="#6a3a15" />
      <Box position={[0, 0.75, 0]} size={[1.1, 0.04, 0.25]} color="#6a3a15" />
      <Box position={[0, 1.2, 0]} size={[1.1, 0.04, 0.25]} color="#6a3a15" />
      {/* Books */}
      {bookColors.map((c, i) => (
        <Box
          key={i}
          position={[-0.45 + i * 0.18, 0.52, 0]}
          size={[0.12, 0.38, 0.22]}
          color={c}
          castShadow
          roughness={0.8}
        />
      ))}
      {bookColors.slice(0, 4).map((c, i) => (
        <Box
          key={`s2-${i}`}
          position={[-0.35 + i * 0.22, 0.97, 0]}
          size={[0.15, 0.4, 0.22]}
          color={c}
          castShadow
          roughness={0.8}
        />
      ))}
    </group>
  )
}

// Wall divider
function Wall({
  position,
  size,
  color = '#dedad2',
}: {
  position: [number, number, number]
  size: [number, number, number]
  color?: string
}) {
  return (
    <Box position={position} size={size} color={color} receiveShadow castShadow roughness={0.9} />
  )
}

export default function OfficeLayout() {
  return (
    <group>
      {/* === FLOOR === */}
      {/* Main floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[42, 36]} />
        <meshStandardMaterial color="#d6cfc4" roughness={0.9} />
      </mesh>

      {/* Room floors with different colors */}
      {/* CEO Office */}
      <Box position={[-12, 0.001, -8]} size={[10, 0.02, 8]} color="#dde3ee" receiveShadow />
      {/* Finance */}
      <Box position={[4, 0.001, -8]} size={[8, 0.02, 8]} color="#d8eedf" receiveShadow />
      {/* CRM */}
      <Box position={[-12, 0.001, 0]} size={[8, 0.02, 8]} color="#d8e4f0" receiveShadow />
      {/* Projects */}
      <Box position={[5, 0.001, 0]} size={[12, 0.02, 8]} color="#ecdaf5" receiveShadow />
      {/* Meeting */}
      <Box position={[-3, 0.001, 6]} size={[18, 0.02, 6]} color="#f0e8d8" receiveShadow />
      {/* Coffee */}
      <Box position={[-12, 0.001, 12]} size={[6, 0.02, 8]} color="#f5ead8" receiveShadow />
      {/* Marketing */}
      <Box position={[-4, 0.001, 12]} size={[8, 0.02, 8]} color="#f5e0cc" receiveShadow />
      {/* Creative */}
      <Box position={[6, 0.001, 12]} size={[8, 0.02, 8]} color="#f5d8e8" receiveShadow />

      {/* === WALLS === */}
      {/* Rendered straight from COLLISION_WALLS so the visible walls always
          match the physical ones - every collision gap shows as a real doorway */}
      {COLLISION_WALLS.map((w, i) => (
        <Wall
          key={`wall-${i}`}
          position={[(w.minX + w.maxX) / 2, 1.5, (w.minZ + w.maxZ) / 2]}
          size={[w.maxX - w.minX, 3, w.maxZ - w.minZ]}
          color={i < 4 ? '#e8e4dc' : '#dedad2'}
        />
      ))}

      {/* Door lintels (header above each opening) so gaps read as doorways */}
      {DOORS.map((d, i) => (
        <group key={`door-${i}`}>
          <Wall
            position={[d.x, 2.6, d.z]}
            size={
              d.orientation === 'v'
                ? [0.34, 0.8, d.width]
                : [d.width, 0.8, 0.34]
            }
            color="#c9c2b4"
          />
          {/* Door frame posts */}
          <Wall
            position={
              d.orientation === 'v'
                ? [d.x, 1.1, d.z - d.width / 2 + 0.05]
                : [d.x - d.width / 2 + 0.05, 1.1, d.z]
            }
            size={d.orientation === 'v' ? [0.36, 2.2, 0.1] : [0.1, 2.2, 0.36]}
            color="#c9c2b4"
          />
          <Wall
            position={
              d.orientation === 'v'
                ? [d.x, 1.1, d.z + d.width / 2 - 0.05]
                : [d.x + d.width / 2 - 0.05, 1.1, d.z]
            }
            size={d.orientation === 'v' ? [0.36, 2.2, 0.1] : [0.1, 2.2, 0.36]}
            color="#c9c2b4"
          />
        </group>
      ))}

      {/* Accent strips on floor (room borders) */}
      <Box position={[-12, 0.01, -4]} size={[10, 0.02, 0.1]} color="#1B2951" />
      <Box position={[-4, 0.01, -4]} size={[0.1, 0.02, 8]} color="#1B2951" />

      {/* === CEO OFFICE FURNITURE === */}
      <Desk position={[-14, 0, -8]} rotation={0} color="#1B2951" />
      <Chair position={[-14, 0, -7]} rotation={Math.PI} color="#0e1a36" />
      <Bookshelf position={[-16.5, 0, -10]} rotation={Math.PI / 2} />
      <Plant position={[-16.5, 0, -5.5]} />
      <Plant position={[-10, 0, -11]} />
      {/* CEO accent wall */}
      <Box position={[-17.5, 1.5, -8]} size={[0.1, 2, 6]} color="#1B2951" roughness={0.5} metalness={0.3} />

      {/* === FINANCE ROOM FURNITURE === */}
      <Desk position={[4, 0, -8]} rotation={Math.PI} color="#1B6B3A" />
      <Chair position={[4, 0, -9]} rotation={0} color="#0f3d21" />
      <Bookshelf position={[6.5, 0, -11.5]} rotation={0} />
      <Plant position={[1.5, 0, -11.5]} />

      {/* === CRM ROOM FURNITURE === */}
      <Desk position={[-14, 0, 0]} rotation={Math.PI / 2} color="#1A4A8A" />
      <Chair position={[-15.5, 0, 0]} rotation={-Math.PI / 2} color="#0e2d57" />
      <Plant position={[-16.5, 0, 2.5]} />
      <Bookshelf position={[-16.5, 0, -2]} rotation={Math.PI / 2} />

      {/* === PROJECTS ROOM FURNITURE === */}
      <Desk position={[4, 0, 0]} rotation={Math.PI} color="#6B2FA0" />
      <Chair position={[4, 0, 1]} rotation={0} color="#3d1a5c" />
      <Desk position={[9, 0, 0]} rotation={Math.PI} color="#006B6B" />
      <Chair position={[9, 0, 1]} rotation={0} color="#003d3d" />
      <Plant position={[12, 0, -3]} />

      {/* === MEETING ROOM === */}
      <MeetingTable position={[-3, 0, 6.5]} />
      {/* Whiteboard */}
      <Box position={[5.5, 1.2, 4.2]} size={[3, 1.5, 0.08]} color="#f0f0f0" roughness={0.2} />
      <Box position={[5.5, 0.3, 4.2]} size={[3, 0.06, 0.08]} color="#888" roughness={0.5} />

      {/* === COFFEE AREA === */}
      <CoffeeMachine position={[-13, 0, 12]} />
      {/* Small round table */}
      <mesh position={[-11, 0.45, 13]}>
        <cylinderGeometry args={[0.5, 0.5, 0.06, 12]} />
        <meshStandardMaterial color="#5a3820" roughness={0.6} />
      </mesh>
      <mesh position={[-11, 0.22, 13]}>
        <cylinderGeometry args={[0.04, 0.04, 0.44, 8]} />
        <meshStandardMaterial color="#333" roughness={0.5} />
      </mesh>
      {/* Stools */}
      <Chair position={[-10.3, 0, 13]} rotation={-Math.PI / 4} color="#8B6914" />
      <Chair position={[-11.7, 0, 13.5]} rotation={Math.PI / 4} color="#8B6914" />
      <Plant position={[-16, 0, 13.5]} />
      <Plant position={[-16, 0, 10]} />

      {/* === MARKETING ROOM === */}
      <Desk position={[-6, 0, 10]} rotation={-Math.PI / 2} color="#B85C00" />
      <Chair position={[-4.5, 0, 10]} rotation={Math.PI / 2} color="#6b3500" />
      <Plant position={[-7, 0, 13.5]} />
      <Bookshelf position={[-6.5, 0, 14.5]} rotation={0} />

      {/* === CREATIVE ROOM === */}
      <Desk position={[6, 0, 10]} rotation={-Math.PI / 2} color="#C2185B" />
      <Chair position={[7.5, 0, 10]} rotation={Math.PI / 2} color="#7a0f39" />
      <Plant position={[9, 0, 13.5]} />

      {/* === DECORATIVE ELEMENTS === */}
      {/* Logo wall art (CEO office) */}
      <mesh position={[-17.6, 2, -10]}>
        <boxGeometry args={[0.05, 1.5, 2]} />
        <meshStandardMaterial color="#1B2951" emissive="#1B2951" emissiveIntensity={0.2} metalness={0.5} />
      </mesh>

      {/* Open space plants */}
      <Plant position={[14, 0, -2]} />
      <Plant position={[17, 0, 1]} />

      {/* Ceiling lights (decorative panels) */}
      {[[-12, -8], [4, -8], [-12, 0], [4, 0], [10, 0], [-3, 6], [-12, 12], [-4, 12], [6, 12]].map(
        ([lx, lz], i) => (
          <mesh key={`light-${i}`} position={[lx, 2.98, lz]}>
            <boxGeometry args={[1.5, 0.05, 0.8]} />
            <meshStandardMaterial
              color="#fffaee"
              emissive="#fffaee"
              emissiveIntensity={0.3}
              roughness={0.1}
            />
          </mesh>
        )
      )}

    </group>
  )
}
