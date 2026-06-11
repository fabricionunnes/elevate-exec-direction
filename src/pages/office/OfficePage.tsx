// UNV Office 3D — escritório virtual dos agentes IA.
// Acesso restrito a staff com papel master (gate client-side aqui +
// validação server-side na edge function agente-unv).
import { Suspense, useEffect, useRef } from 'react'
import { Navigate } from 'react-router-dom'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { useStaffPermissions } from '@/hooks/useStaffPermissions'
import Player from './components/Player'
import AgentCharacter from './components/AgentCharacter'
import OfficeLayout from './components/OfficeLayout'
import ChatPanel from './components/ChatPanel'
import MeetingPanel from './components/MeetingPanel'
import HUD from './components/HUD'
import { AGENTS } from './config/agents'
import { useGameStore } from './store/useGameStore'
import { supabase } from './lib/supabase'

function SceneLights() {
  return (
    <>
      {/* Ambient */}
      <ambientLight intensity={1.4} color="#ffffff" />

      {/* Main overhead light */}
      <directionalLight
        position={[0, 15, 5]}
        intensity={1.8}
        color="#fff8e8"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-bias={-0.001}
      />

      {/* Second fill light */}
      <directionalLight position={[-5, 10, -5]} intensity={0.8} color="#f0f4ff" />

      {/* Room-specific colored fills */}
      <pointLight position={[-12, 4, -8]} intensity={0.9} color="#1B2951" distance={12} />
      <pointLight position={[4, 4, -8]} intensity={0.9} color="#1B6B3A" distance={10} />
      <pointLight position={[-12, 4, 0]} intensity={0.9} color="#1A4A8A" distance={10} />
      <pointLight position={[5, 4, 0]} intensity={0.9} color="#6B2FA0" distance={12} />
      <pointLight position={[-3, 4, 6]} intensity={0.7} color="#c8a870" distance={14} />
      <pointLight position={[-12, 4, 12]} intensity={1.2} color="#ffcc66" distance={10} />
      <pointLight position={[-4, 4, 12]} intensity={0.9} color="#B85C00" distance={10} />
      <pointLight position={[6, 4, 12]} intensity={0.9} color="#C2185B" distance={10} />

      {/* General warm fill */}
      <hemisphereLight args={['#fff3e0', '#1a1a2e', 0.4]} />
    </>
  )
}

function SupabaseRealtimeHandler() {
  const { triggerMeeting, endMeeting, addMeetingMessage, setMeetingMessages, setMeetingPanelVisible } = useGameStore()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reinicia o timer de segurança: encerra a reunião se nada chegar em 5 min
  const armFallbackTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => endMeeting(), 5 * 60 * 1000)
  }

  useEffect(() => {
    // Reunião em andamento? Carrega as falas dos últimos 15 minutos
    ;(async () => {
      const since = new Date(Date.now() - 15 * 60 * 1000).toISOString()
      const { data } = await supabase
        .from('office_meeting_messages')
        .select('id, agent, content, kind, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: true })
        .limit(100)
      if (data && data.length > 0) {
        setMeetingMessages(
          data.map((m: any) => ({
            id: m.id,
            agent: m.agent,
            content: m.content,
            kind: m.kind,
            timestamp: new Date(m.created_at).getTime(),
          }))
        )
        setMeetingPanelVisible(true)
        const last = data[data.length - 1]
        if (last.kind !== 'fim') {
          triggerMeeting()
          armFallbackTimer()
        }
      }
    })()

    // Falas da reunião em tempo real → agentes vão pra sala + papo no painel
    const meetingChannel = supabase
      .channel('office_meeting_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'office_meeting_messages' },
        (payload: any) => {
          const row = payload.new
          addMeetingMessage({
            id: row.id,
            agent: row.agent,
            content: row.content,
            kind: row.kind,
            timestamp: new Date(row.created_at).getTime(),
          })
          if (row.kind === 'fim') {
            // Max encerrou — agentes voltam pros postos depois de lerem a ata
            if (timerRef.current) clearTimeout(timerRef.current)
            timerRef.current = setTimeout(() => endMeeting(), 10 * 1000)
          } else {
            triggerMeeting()
            armFallbackTimer()
          }
        }
      )
      .subscribe()

    // Compatibilidade: briefing disparado pelo fluxo Telegram (tabela antiga)
    const legacyChannel = supabase
      .channel('agent_messages_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'agent_messages' },
        (payload: any) => {
          const row = payload.new
          if (
            row.role === 'assistant' &&
            row.agent === 'ceo' &&
            typeof row.content === 'string' &&
            row.content.includes('BRIEFING')
          ) {
            triggerMeeting()
            armFallbackTimer()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(meetingChannel)
      supabase.removeChannel(legacyChannel)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return null
}

function AgentsScene() {
  const { playerPosition, meetingTriggered, initAgentStates } = useGameStore()

  // Init all agent states on mount
  useEffect(() => {
    const initial = AGENTS.map((agent) => ({
      id: agent.id,
      state: 'IDLE' as const,
      position: [...agent.homePosition] as [number, number, number],
      targetPosition: null,
      waypointIndex: 0,
      stateTimer: Math.random() * 10, // stagger timers
      nextStateChange: 8 + Math.random() * 20,
    }))
    initAgentStates(initial)
  }, [])

  return (
    <>
      {AGENTS.map((agent) => (
        <AgentCharacter
          key={agent.id}
          agent={agent}
          playerPosition={playerPosition}
          meetingTriggered={meetingTriggered}
        />
      ))}
    </>
  )
}

function LoadingScreen({ label = 'Loading office...' }: { label?: string }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#0a0a14',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        color: '#fff',
        zIndex: 999,
      }}
    >
      <div style={{ fontSize: '48px' }}>🏢</div>
      <div style={{ fontSize: '24px', fontWeight: 800 }}>
        UNV <span style={{ color: '#FFD700' }}>Office</span> 3D
      </div>
      <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>{label}</div>
      <div
        style={{
          width: '200px',
          height: '3px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '2px',
          overflow: 'hidden',
          marginTop: '8px',
        }}
      >
        <div
          style={{
            width: '60%',
            height: '100%',
            background: '#1B2951',
            borderRadius: '2px',
            animation: 'office-load 1.5s ease-in-out infinite alternate',
          }}
        />
      </div>
      <style>{`
        @keyframes office-load {
          from { width: 20%; margin-left: 0; }
          to { width: 60%; margin-left: 40%; }
        }
      `}</style>
    </div>
  )
}

function OfficeApp() {
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#c8d4e8', zIndex: 50 }}>
      <Suspense fallback={<LoadingScreen />}>
        <Canvas
          shadows
          camera={{ position: [0, 16, 18], fov: 60, near: 0.1, far: 300 }}
          gl={{
            antialias: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.1,
          }}
          style={{ width: '100%', height: '100%' }}
        >
          <SceneLights />

          {/* Subtle fog */}
          <fog attach="fog" args={['#c8d4e8', 45, 120]} />

          {/* Office */}
          <OfficeLayout />

          {/* Player */}
          <Player />

          {/* Agents */}
          <AgentsScene />

          {/* Supabase realtime */}
          <SupabaseRealtimeHandler />
        </Canvas>
      </Suspense>

      {/* HTML Overlays */}
      <ChatPanel />
      <MeetingPanel />
      <HUD />
    </div>
  )
}

export default function OfficePage() {
  const { isMaster, loading } = useStaffPermissions()

  if (loading) return <LoadingScreen label="Verificando acesso..." />
  if (!isMaster) return <Navigate to="/" replace />

  return <OfficeApp />
}
