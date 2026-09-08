export interface CourtPlayer {
  playerId: string
  name: string
  number: string
  isLibero: boolean
  position: number
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

const TOKEN_R = 22
const LINE = 'rgba(255,255,255,0.85)'
const SELECT_COLOR = '#ffffff'

const Court = ({
  players,
  mode = 'edit',
  selectedPosition = null,
  selectedPlayerId = null,
  servingPosition = null,
  onPositionClick,
  onPlayerClick,
  showRotationLabel,
  className = ''
}: CourtProps) => {

  const playerAt = (position: number) => players.find(p => p.position === position)
  const isEditable = mode === 'edit' && Boolean(onPositionClick)
  const isSelectable = mode === 'live' && Boolean(onPlayerClick)

  return (
    <div className={`bg-[#050d0f] border border-[#0f2d30] rounded overflow-hidden ${className}`}>
      <svg viewBox={`0 0 ${VB.w} ${VB.h}`} className="w-full block" role="img" aria-label="Volleyball court">

        {/* net mesh pattern */}
        <defs>
          <pattern id="netMesh" width="5" height="5" patternUnits="userSpaceOnUse">
            <path d="M 5 0 L 0 0 0 5" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.6" />
          </pattern>
        </defs>

        {/* free zone */}
        <rect x="0" y="0" width={VB.w} height={VB.h} fill="#0d3028" />

        {/* court surface */}
        <rect x={COURT.x} y={COURT.y} width={COURT.w} height={COURT.h} fill="#B85C38" />

        {/* front zone slightly lighter */}
        <rect
          x={COURT.x} y={COURT.y}
          width={COURT.w} height={ATTACK_LINE_Y - COURT.y}
          fill="rgba(0,0,0,0.06)"
        />

        {/* court boundary */}
        <rect
          x={COURT.x} y={COURT.y}
          width={COURT.w} height={COURT.h}
          fill="none" stroke={LINE} strokeWidth="2"
        />

        {/* attack line */}
        <line
          x1={COURT.x} y1={ATTACK_LINE_Y}
          x2={COURT.x + COURT.w} y2={ATTACK_LINE_Y}
          stroke={LINE} strokeWidth="1.8"
        />

        {/* dashed attack-line extensions into free zone */}
        <line
          x1={COURT.x - 16} y1={ATTACK_LINE_Y} x2={COURT.x} y2={ATTACK_LINE_Y}
          stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" strokeDasharray="4 4"
        />
        <line
          x1={COURT.x + COURT.w} y1={ATTACK_LINE_Y} x2={COURT.x + COURT.w + 16} y2={ATTACK_LINE_Y}
          stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" strokeDasharray="4 4"
        />

        {/* net band across the top */}
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

        {/* net antennae */}
        <line
          x1={COURT.x} y1={COURT.y - 20} x2={COURT.x} y2={COURT.y + 2}
          stroke="rgba(255,255,255,0.75)" strokeWidth="1.6"
        />
        <line
          x1={COURT.x + COURT.w} y1={COURT.y - 20} x2={COURT.x + COURT.w} y2={COURT.y + 2}
          stroke="rgba(255,255,255,0.75)" strokeWidth="1.6"
        />

        {/* sideline extension ticks */}
        <line
          x1={COURT.x} y1={COURT.y + COURT.h} x2={COURT.x} y2={COURT.y + COURT.h + 14}
          stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeDasharray="3 3"
        />
        <line
          x1={COURT.x + COURT.w} y1={COURT.y + COURT.h}
          x2={COURT.x + COURT.w} y2={COURT.y + COURT.h + 14}
          stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeDasharray="3 3"
        />

        {/* labels */}
        <text x={COURT.x - 20} y={ATTACK_LINE_Y - 4} fontSize="6.5" fill="rgba(255,255,255,0.4)" textAnchor="end">
          3m
        </text>
        <text
          x={COURT.x + COURT.w} y={COURT.y + COURT.h + 24}
          fontSize="6.5" fill="rgba(255,255,255,0.3)" textAnchor="end" letterSpacing="1.5"
        >
          SERVICE ZONE
        </text>

        {/* players */}
        {[4, 3, 2, 5, 6, 1].map(position => {
          const coord = POSITION_COORDS[position]
          const player = playerAt(position)
          const isSelected = selectedPosition === position
          const isPlayerSelected = player && selectedPlayerId === player.playerId
          const isServer = servingPosition === position

          const ringColor = isPlayerSelected
            ? '#ffffff'
            : player
              ? player.isLibero ? '#8BBB92' : '#2A835F'
              : isSelected ? SELECT_COLOR : 'rgba(255,255,255,0.35)'

          const handleClick = () => {
            if (isEditable) onPositionClick!(position)
            else if (isSelectable && player) onPlayerClick!(player.playerId)
          }

          return (
            <g
              key={position}
              onClick={handleClick}
              className={(isEditable || (isSelectable && player)) ? 'cursor-pointer' : ''}
            >
              {isServer && (
                <circle cx={coord.x} cy={coord.y} r={TOKEN_R + 5} fill="none" stroke="#2A835F" strokeWidth="1.2">
                  <animate attributeName="r" values={`${TOKEN_R + 3};${TOKEN_R + 9};${TOKEN_R + 3}`} dur="1.8s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.6;0.1;0.6" dur="1.8s" repeatCount="indefinite" />
                </circle>
              )}

              <circle
                cx={coord.x} cy={coord.y} r={TOKEN_R}
                fill={isPlayerSelected ? 'rgba(255,255,255,0.2)' : isSelected ? 'rgba(255,255,255,0.15)' : player ? '#0d1f18' : 'rgba(0,0,0,0.3)'}
                stroke={ringColor}
                strokeWidth={isPlayerSelected ? 3 : player ? 2.2 : 1.5}
                strokeDasharray={player ? undefined : '4 3'}
                style={{ transition: 'stroke 200ms ease, fill 200ms ease, stroke-width 200ms ease' }}
              />

              <text
                x={coord.x} y={coord.y + 5}
                fontSize={player ? 15 : 11}
                fontWeight={player ? 700 : 400}
                fill={player ? '#ffffff' : 'rgba(255,255,255,0.6)'}
                textAnchor="middle"
                style={{ pointerEvents: 'none' }}
              >
                {player ? player.number : position}
              </text>

              <text
                x={coord.x} y={coord.y + TOKEN_R + 11}
                fontSize="7.5"
                fill={player?.isLibero ? '#8BBB92' : isSelected ? '#ffffff' : 'rgba(255,255,255,0.6)'}
                textAnchor="middle"
                style={{ pointerEvents: 'none' }}
              >
                {player
                  ? player.name.length > 13 ? player.name.slice(0, 12) + '…' : player.name
                  : isSelected ? 'pick player' : `pos ${position}`}
              </text>

              {player?.isLibero && (
                <text
                  x={coord.x} y={coord.y + TOKEN_R + 19}
                  fontSize="5.5" fill="#8BBB92" textAnchor="middle" letterSpacing="1"
                  style={{ pointerEvents: 'none' }}
                >
                  LIBERO
                </text>
              )}
            </g>
          )
        })}
      </svg>

      <div className="flex justify-between px-3 py-1.5 border-t border-[#0f2d30] text-[9px] uppercase tracking-widest text-[#4a6b6b]">
        <span>{showRotationLabel ? `Rotation ${showRotationLabel}` : 'Pos 1 serves'}</span>
        <span>{players.length}/6 on court</span>
      </div>
    </div>
  )
}

export default Court