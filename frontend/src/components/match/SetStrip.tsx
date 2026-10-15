import type { LiveSnapshot } from '../../lib/match/types'

const SetStrip = ({ view }: { view: LiveSnapshot }) => {
  if (view.sets.length === 0) return null
  return (
    <div className="flex gap-1.5" aria-label="Set scores">
      {view.sets.map(s => {
        const won = s.status === 'finished' && s.ourScore > s.opponentScore
        const lost = s.status === 'finished' && s.opponentScore > s.ourScore
        return (
          <div
            key={s.id}
            className={`px-2 py-0.5 rounded border text-[10px] tabular-nums transition-motion ${
              s.status === 'active' ? 'border-us text-white' : won ? 'border-line text-us' : lost ? 'border-line text-opp' : 'border-line text-muted'
            }`}
          >
            <span className="text-muted mr-1">S{s.setNumber}</span>
            {s.ourScore}–{s.opponentScore}
          </div>
        )
      })}
    </div>
  )
}

export default SetStrip
