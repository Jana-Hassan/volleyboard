import type { ReactElement } from 'react'

export type MobileTab = 'code' | 'court' | 'stats' | 'info'

const ICONS: Record<MobileTab, ReactElement> = {
  code: <path d="M4 7h16M4 12h16M4 17h10" strokeWidth="2" strokeLinecap="round" />,
  court: <><rect x="4" y="5" width="16" height="14" rx="1" strokeWidth="2" /><path d="M4 12h16" strokeWidth="2" /></>,
  stats: <path d="M6 19V11M12 19V5M18 19v-6" strokeWidth="2.5" strokeLinecap="round" />,
  info: <><circle cx="12" cy="12" r="8" strokeWidth="2" /><path d="M12 11v5M12 8h.01" strokeWidth="2" strokeLinecap="round" /></>
}

const LABELS: Record<MobileTab, string> = { code: 'Code', court: 'Court', stats: 'Stats', info: 'Info' }

interface MobileTabBarProps {
  tabs: MobileTab[]
  active: MobileTab
  onChange: (tab: MobileTab) => void
}

const MobileTabBar = ({ tabs, active, onChange }: MobileTabBarProps) => (
  <nav className="shrink-0 grid border-t border-line bg-surface" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
    {tabs.map(tab => (
      <button
        key={tab}
        type="button"
        aria-label={LABELS[tab]}
        aria-current={active === tab}
        onClick={() => onChange(tab)}
        className={`h-14 flex flex-col items-center justify-center gap-0.5 transition-motion-fast ${active === tab ? 'text-us' : 'text-muted'}`}
      >
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor">{ICONS[tab]}</svg>
        <span className="text-[9px] uppercase tracking-widest">{LABELS[tab]}</span>
      </button>
    ))}
  </nav>
)

export default MobileTabBar
