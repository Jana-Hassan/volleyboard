import type { ButtonHTMLAttributes } from 'react'

interface PillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean
  tone?: 'us' | 'opp' | 'plain'
}

const SELECTED = {
  us: 'bg-us text-white border-us',
  opp: 'bg-opp text-white border-opp',
  plain: 'bg-line text-white border-line'
}

const Pill = ({ selected = false, tone = 'us', className = '', type = 'button', ...rest }: PillProps) => (
  <button
    type={type}
    className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-widest transition-motion-fast pointer-coarse:min-h-11 ${
      selected ? SELECTED[tone] : 'border-line text-muted hover:text-white'
    } ${className}`}
    {...rest}
  />
)

export default Pill
