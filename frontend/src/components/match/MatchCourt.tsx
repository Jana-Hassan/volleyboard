import { useMemo } from 'react'
import Court from '../Court'
import type { CourtPlayer } from '../Court'
import type { LiveSnapshot } from '../../lib/match/types'
import { scoringCue } from '../../lib/match/cue'

interface MatchCourtProps {
  view: LiveSnapshot
  selectedPlayerId?: string | null
  onPlayerClick?: (playerId: string) => void
  fit?: 'width' | 'contain'
  className?: string
}

const MatchCourt = ({ view, selectedPlayerId = null, onPlayerClick, fit = 'contain', className = '' }: MatchCourtProps) => {
  const positions = view.court?.currentPositions
  const players = useMemo<CourtPlayer[]>(
    () => positions
      ? Object.values(positions).map(p => ({
          playerId: p.playerId,
          name: p.playerName,
          number: view.players.find(pl => pl.id === p.playerId)?.number ?? '',
          isLibero: p.isLibero,
          position: p.rotationPosition
        }))
      : [],
    [positions, view.players]
  )
  const set = view.activeSet

  return (
    <Court
      players={players}
      mode="live"
      fit={fit}
      className={className}
      selectedPlayerId={selectedPlayerId}
      servingPosition={set?.status === 'active' && set.servingTeam === 'us' ? 1 : null}
      onPlayerClick={onPlayerClick}
      showRotationLabel={set?.currentRotation}
      cue={scoringCue(view.events)}
    />
  )
}

export default MatchCourt
