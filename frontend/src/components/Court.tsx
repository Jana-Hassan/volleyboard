import { useState } from 'react'
import type { AnimationEvent } from 'react'
import { initialPresence, reconcilePresence, settlePresence } from '../lib/court/presence'
import type { PresenceItem } from '../lib/court/presence'

export interface CourtPlayer {
  playerId: string
  name: string
  number: string
  isLibero: boolean
  position: number
}

export interface ZoneShade {
  intensity: number
  label: string
  sub: string
}

export interface CourtCue {
  playerId: string
  tone: 'us' | 'opp'
  key: string
}

interface CourtProps {
  players: CourtPlayer[]
  mode?: 'edit' | 'live'
  selectedPosition?: number | null
  selectedPlayerId?: string | null
  servingPosition?: number | null
  onPositionClick?: (position: number) => void
  onPlayerClick?: (playerId: string) => void
  showRotationLabel?: number
  cue?: CourtCue | null
  fit?: 'width' | 'contain'
  zoneOverlay?: Record<number, ZoneShade>
  showFooter?: boolean
  className?: string
}

const VB = { w: 420, h: 230 }

const COURT = { x: 30, y: 26, w: 360, h: 168 }
const ATTACK_LINE_Y = COURT.y + COURT.h * 0.55

const POSITION_COORDS: Record<number, { x: number; y: number }> = {
  4: { x: COURT.x + COURT.w * 0.18, y: COURT.y + COURT.h * 0.27 },
  3: { x: COURT.x + COURT.w * 0.50, y: COURT.y + COURT.h * 0.27 },
  2: { x: COURT.x + COURT.w * 0.82, y: COURT.y + COURT.h * 0.27 },
  5: { x: COURT.x + COURT.w * 0.18, y: COURT.y + COURT.h * 0.78 },
  6: { x: COURT.x + COURT.w * 0.50, y: COURT.y + COURT.h * 0.78 },
  1: { x: COURT.x + COURT.w * 0.82, y: COURT.y + COURT.h * 0.78 }
}

const POSITIONS = [4, 3, 2, 5, 6, 1]
const TOKEN_R = 22
const HIT_R = TOKEN_R + 6
const LINE = 'rgba(255,255,255,0.85)'

const keyOf = (p: CourtPlayer) => p.playerId

const shortName = (name: string) => (name.length > 13 ? name.slice(0, 12) + '…' : name)

const Court = ({
  players,
  mode = 'edit',
  selectedPosition = null,
  selectedPlayerId = null,
  servingPosition = null,
  onPositionClick,
  onPlayerClick,
  showRotationLabel,
  cue = null,
  fit = 'width',
  zoneOverlay,
  showFooter = true,
  className = ''
}: CourtProps) => {
  const [shown, setShown] = useState<PresenceItem<CourtPlayer>[]>(() => initialPresence(players, keyOf))
  const [lastPlayers, setLastPlayers] = useState(players)

  if (players !== lastPlayers) {
    setLastPlayers(players)
    setShown(prev => reconcilePresence(prev, players, keyOf))
  }

  const isEditable = mode === 'edit' && Boolean(onPositionClick)
  const isSelectable = mode === 'live' && Boolean(onPlayerClick)
  const occupied = new Set(shown.filter(s => s.state !== 'exiting').map(s => s.item.position))

  const settle = (key: string) => (event: AnimationEvent<SVGGElement>) => {
    if (event.target !== event.currentTarget) return
    setShown(prev => settlePresence(prev, key))
  }

  const fitClasses = fit === 'contain'
    ? { root: 'flex flex-col h-full min-h-0 bg-freezone', svg: 'w-full flex-1 min-h-0' }
    : { root: 'bg-surface', svg: 'w-full' }

  return (
    <div className={`border border-line rounded overflow-hidden ${fitClasses.root} ${className}`}>
      <svg viewBox={`0 0 ${VB.w} ${VB.h}`} className={`block ${fitClasses.svg}`} role="img" aria-label="Volleyball court">

        <defs>
          <pattern id="netMesh" width="5" height="5" patternUnits="userSpaceOnUse">
            <path d="M 5 0 L 0 0 0 5" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.6" />
          </pattern>
        </defs>

        <rect x="0" y="0" width={VB.w} height={VB.h} className="fill-freezone" />

        <rect x={COURT.x} y={COURT.y} width={COURT.w} height={COURT.h} className="fill-court" />

        {zoneOverlay && [4, 3, 2, 5, 6, 1].map((zone, i) => {
          const shade = zoneOverlay[zone]
          const col = i % 3
          const front = i < 3
          const x = COURT.x + (COURT.w / 3) * col
          const y = front ? COURT.y : ATTACK_LINE_Y
          const h = front ? ATTACK_LINE_Y - COURT.y : COURT.y + COURT.h - ATTACK_LINE_Y
          return (
            <g key={`zone-${zone}`}>
              <rect x={x + 1} y={y + 1} width={COURT.w / 3 - 2} height={h - 2} className="fill-us transition-motion" fillOpacity={shade ? 0.12 + 0.68 * shade.intensity : 0} />
              <text x={x + 8} y={y + 12} fontSize="7" fill="rgba(255,255,255,0.55)" letterSpacing="1">Z{zone}</text>
              {shade && (
                <>
                  <text x={x + COURT.w / 6} y={y + h / 2 + 2} fontSize="16" fontWeight={700} textAnchor="middle" className="fill-select">{shade.label}</text>
                  <text x={x + COURT.w / 6} y={y + h / 2 + 15} fontSize="8" textAnchor="middle" fill="rgba(255,255,255,0.75)">{shade.sub}</text>
                </>
              )}
            </g>
          )
        })}

        <rect
          x={COURT.x} y={COURT.y}
          width={COURT.w} height={ATTACK_LINE_Y - COURT.y}
          fill="rgba(0,0,0,0.06)"
        />

        <rect
          x={COURT.x} y={COURT.y}
          width={COURT.w} height={COURT.h}
          fill="none" stroke={LINE} strokeWidth="2"
        />

        <line
          x1={COURT.x} y1={ATTACK_LINE_Y}
          x2={COURT.x + COURT.w} y2={ATTACK_LINE_Y}
          stroke={LINE} strokeWidth="1.8"
        />

        <line
          x1={COURT.x - 16} y1={ATTACK_LINE_Y} x2={COURT.x} y2={ATTACK_LINE_Y}
          stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" strokeDasharray="4 4"
        />
        <line
          x1={COURT.x + COURT.w} y1={ATTACK_LINE_Y} x2={COURT.x + COURT.w + 16} y2={ATTACK_LINE_Y}
          stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" strokeDasharray="4 4"
        />

        <rect
          x={COURT.x - 14} y={COURT.y - 12}
          width={COURT.w + 28} height="12"
          fill="url(#netMesh)"
        />
        <rect
          x={COURT.x - 14} y={COURT.y - 12}
          width={COURT.w + 28} height="12"
          fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2"
        />

        <line
          x1={COURT.x} y1={COURT.y - 20} x2={COURT.x} y2={COURT.y + 2}
          stroke="rgba(255,255,255,0.75)" strokeWidth="1.6"
        />
        <line
          x1={COURT.x + COURT.w} y1={COURT.y - 20} x2={COURT.x + COURT.w} y2={COURT.y + 2}
          stroke="rgba(255,255,255,0.75)" strokeWidth="1.6"
        />

        <line
          x1={COURT.x} y1={COURT.y + COURT.h} x2={COURT.x} y2={COURT.y + COURT.h + 14}
          stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeDasharray="3 3"
        />
        <line
          x1={COURT.x + COURT.w} y1={COURT.y + COURT.h}
          x2={COURT.x + COURT.w} y2={COURT.y + COURT.h + 14}
          stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeDasharray="3 3"
        />

        <text x={COURT.x - 20} y={ATTACK_LINE_Y - 4} fontSize="6.5" fill="rgba(255,255,255,0.4)" textAnchor="end">
          3m
        </text>
        <text
          x={COURT.x + COURT.w} y={COURT.y + COURT.h + 24}
          fontSize="6.5" fill="rgba(255,255,255,0.3)" textAnchor="end" letterSpacing="1.5"
        >
          SERVICE ZONE
        </text>

        {mode === 'edit' && POSITIONS.filter(position => !occupied.has(position)).map(position => {
          const { x, y } = POSITION_COORDS[position]
          const isSelected = selectedPosition === position
          return (
            <g
              key={`slot-${position}`}
              transform={`translate(${x} ${y})`}
              onClick={isEditable ? () => onPositionClick!(position) : undefined}
              className={isEditable ? 'cursor-pointer' : ''}
            >
              <circle r={HIT_R} fill="transparent" />
              <circle
                r={TOKEN_R}
                fill={isSelected ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.3)'}
                stroke={isSelected ? 'currentColor' : 'rgba(255,255,255,0.35)'}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                className={`transition-motion-fast ${isSelected ? 'text-select' : ''}`}
              />
              <text y={5} fontSize={11} fill="rgba(255,255,255,0.6)" textAnchor="middle" style={{ pointerEvents: 'none' }}>
                {position}
              </text>
              <text
                y={TOKEN_R + 11}
                fontSize="7.5"
                fill={isSelected ? undefined : 'rgba(255,255,255,0.6)'}
                className={isSelected ? 'fill-select' : ''}
                textAnchor="middle"
                style={{ pointerEvents: 'none' }}
              >
                {isSelected ? 'pick player' : `pos ${position}`}
              </text>
            </g>
          )
        })}

        {shown.map(({ key, item: player, state }) => {
          const { x, y } = POSITION_COORDS[player.position]
          const isPlayerSelected = selectedPlayerId === player.playerId
          const isServer = state !== 'exiting' && servingPosition === player.position
          const clickable = state !== 'exiting' && (isEditable || isSelectable)

          const handleClick = () => {
            if (!clickable) return
            if (isEditable) onPositionClick!(player.position)
            else onPlayerClick!(player.playerId)
          }

          const ringClass = isPlayerSelected ? 'stroke-select' : player.isLibero ? 'stroke-libero' : 'stroke-us'

          return (
            <g key={key} className="court-slot" style={{ transform: `translate(${x}px, ${y}px)` }}>
              <g
                className={state === 'entering' ? 'court-enter' : state === 'exiting' ? 'court-exit' : ''}
                onAnimationEnd={settle(key)}
                onClick={handleClick}
                style={clickable ? { cursor: 'pointer' } : undefined}
              >
                <circle r={HIT_R} fill="transparent" />

                {isServer && (
                  <circle r={TOKEN_R} fill="none" strokeWidth="1.2" className="court-serve-pulse stroke-us" />
                )}

                {cue && cue.playerId === player.playerId && state !== 'exiting' && (
                  <circle
                    key={cue.key}
                    r={TOKEN_R}
                    fill="none"
                    strokeWidth="3"
                    className={`court-cue ${cue.tone === 'us' ? 'stroke-us' : 'stroke-opp'}`}
                  />
                )}

                <circle
                  r={TOKEN_R}
                  fill={isPlayerSelected ? 'rgba(255,255,255,0.2)' : undefined}
                  strokeWidth={isPlayerSelected ? 3 : 2.2}
                  className={`transition-motion-fast ${ringClass} ${isPlayerSelected ? '' : 'fill-token'}`}
                />

                <text y={5} fontSize={15} fontWeight={700} className="fill-select" textAnchor="middle" style={{ pointerEvents: 'none' }}>
                  {player.number}
                </text>

                <text
                  y={TOKEN_R + 11}
                  fontSize="7.5"
                  fill={player.isLibero ? 'currentColor' : 'rgba(255,255,255,0.6)'}
                  className={player.isLibero ? 'text-libero' : ''}
                  textAnchor="middle"
                  style={{ pointerEvents: 'none' }}
                >
                  {shortName(player.name)}
                </text>

                {player.isLibero && (
                  <text
                    y={TOKEN_R + 19}
                    fontSize="5.5" textAnchor="middle" letterSpacing="1"
                    className="fill-libero"
                    style={{ pointerEvents: 'none' }}
                  >
                    LIBERO
                  </text>
                )}
              </g>
            </g>
          )
        })}
      </svg>

      {showFooter && (
        <div className="flex justify-between px-3 py-1.5 border-t border-line bg-surface text-[9px] uppercase tracking-widest text-muted shrink-0">
          <span>{showRotationLabel ? `Rotation ${showRotationLabel}` : 'Pos 1 serves'}</span>
          <span>{players.length}/6 on court</span>
        </div>
      )}
    </div>
  )
}

export default Court
