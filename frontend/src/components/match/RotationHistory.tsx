import type { LiveSnapshot } from '../../lib/match/types'
import { rotationStints } from '../../lib/match/derive'
import { useFitCount } from '../../hooks/useFitCount'

const CHIP = 56

const RotationHistory = ({ view }: { view: LiveSnapshot }) => {
  const [ref, width] = useFitCount<HTMLDivElement>(1, 'width')
  const stints = rotationStints(view.events, view.activeSet?.currentRotation ?? 1)
  const shown = stints.slice(-Math.max(1, Math.floor(width / CHIP)))

  return (
    <section className="shrink-0">
      <p className="text-[10px] uppercase tracking-widest text-muted mb-1.5">
        Rotation history — set {view.activeSet?.setNumber}
      </p>
      <div ref={ref} className="flex gap-2 h-12 w-full">
        {shown.map((s, i) => (
          <div key={`${s.rotation}-${i}`} className="flex flex-col items-center gap-1 w-12 shrink-0">
            <span className={`w-10 h-7 flex items-center justify-center rounded border text-xs font-semibold transition-motion ${s.current ? 'bg-us border-us text-white' : 'border-line text-libero'}`}>
              R{s.rotation}
            </span>
            <span className="text-[9px] text-muted tabular-nums">{s.score ?? '—'}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

export default RotationHistory
