import type { LiveSnapshot } from '../../../lib/match/types'
import type { MatchLive } from '../../../hooks/useMatchLive'
import type { Breakpoint } from '../../../hooks/useBreakpoint'

export type OpenSheet = { kind: 'sub' } | { kind: 'timeout' } | { kind: 'challenge' } | { kind: 'libero'; liberoId: string } | { kind: 'opponentRoster' }

export interface ViewProps {
  view: LiveSnapshot
  live: MatchLive
  bp: Breakpoint
  canCode: boolean
  canResources: boolean
  selectedPlayerId: string | null
  onSelectPlayer: (playerId: string | null) => void
  openSheet: (sheet: OpenSheet) => void
}
