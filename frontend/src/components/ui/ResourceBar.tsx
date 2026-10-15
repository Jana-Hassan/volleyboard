interface ResourceBarProps {
  label: string
  used: number
  total: number
}

const ResourceBar = ({ label, used, total }: ResourceBarProps) => (
  <div>
    <div className="flex justify-between text-[9px] uppercase tracking-widest mb-0.5">
      <span className="text-muted">{label}</span>
      <span className="text-white tabular-nums">{used}/{total}</span>
    </div>
    <div className="h-1 bg-line rounded overflow-hidden">
      <div
        className="h-full bg-us transition-motion"
        style={{ width: `${total > 0 ? (used / total) * 100 : 0}%` }}
      />
    </div>
  </div>
)

export default ResourceBar
