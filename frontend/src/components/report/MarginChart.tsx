import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

interface Point {
  rally: number
  us: number
  them: number
}

interface MarginChartProps {
  progression: Point[]
  teamName: string
  opponentName: string
}

const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

const MarginTooltip = ({ active, payload }: { active?: boolean; payload?: readonly { payload?: unknown }[] }) => {
  const p = active ? (payload?.[0]?.payload as (Point & { margin: number }) | undefined) : undefined
  if (!p) return null
  return (
    <div className="bg-card border border-line rounded px-2.5 py-1.5 text-xs">
      <p className="text-muted">Rally {p.rally}</p>
      <p className="text-white tabular-nums font-semibold">{p.us}–{p.them}</p>
    </div>
  )
}

const MarginChart = ({ progression, teamName, opponentName }: MarginChartProps) => {
  const data = progression.map(p => {
    const margin = p.us - p.them
    return { ...p, margin, ahead: margin >= 0 ? margin : null, behind: margin <= 0 ? margin : null }
  })
  const reach = Math.max(3, ...data.map(d => Math.abs(d.margin)))
  const us = token('--color-us')
  const opp = token('--color-opp-soft')
  const line = token('--color-line')
  const muted = token('--color-muted')

  return (
    <div className="relative flex-1 min-h-0" role="img" aria-label={`Score margin by rally, ${teamName} versus ${opponentName}`}>
      <span className="absolute left-10 top-1 text-[10px] uppercase tracking-widest text-muted pointer-events-none">{teamName.split(' ')[0]} ahead</span>
      <span className="absolute left-10 bottom-9 text-[10px] uppercase tracking-widest text-muted pointer-events-none">{opponentName} ahead</span>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 16, right: 8, bottom: 4, left: 0 }}>
          <XAxis dataKey="rally" tick={{ fill: muted, fontSize: 10 }} tickLine={false} axisLine={{ stroke: line }} minTickGap={24} />
          <YAxis domain={[-reach, reach]} allowDecimals={false} tick={{ fill: muted, fontSize: 10 }} tickLine={false} axisLine={false} width={32} />
          <ReferenceLine y={0} stroke={line} strokeWidth={1} />
          <Tooltip content={props => <MarginTooltip active={props.active} payload={props.payload} />} cursor={{ stroke: muted, strokeWidth: 1 }} isAnimationActive={false} />
          <Area type="stepAfter" dataKey="ahead" stroke={us} strokeWidth={2} fill={us} fillOpacity={0.25} isAnimationActive={false} activeDot={{ r: 4, fill: us }} />
          <Area type="stepAfter" dataKey="behind" stroke={opp} strokeWidth={2} fill={opp} fillOpacity={0.25} isAnimationActive={false} activeDot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export default MarginChart
