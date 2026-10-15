interface CoachActionsProps {
  onTimeout: () => void
  onSub: () => void
  onChallenge: () => void
  disabled?: boolean
  size?: 'normal' | 'large'
}

const CoachActions = ({ onTimeout, onSub, onChallenge, disabled = false, size = 'large' }: CoachActionsProps) => {
  const cls = `border border-us bg-card text-white uppercase tracking-[0.2em] font-semibold rounded transition-motion-fast hover:bg-us disabled:opacity-30 ${
    size === 'large' ? 'h-14 text-sm' : 'h-12 text-[11px]'
  }`
  return (
    <div className="grid grid-cols-3 gap-3">
      <button type="button" className={cls} disabled={disabled} onClick={onTimeout}>Call timeout</button>
      <button type="button" className={cls} disabled={disabled} onClick={onSub}>Request sub</button>
      <button type="button" className={cls} disabled={disabled} onClick={onChallenge}>Call challenge</button>
    </div>
  )
}

export default CoachActions
