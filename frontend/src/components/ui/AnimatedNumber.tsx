import { useState } from 'react'

interface AnimatedNumberProps {
  value: number
  className?: string
}

const AnimatedNumber = ({ value, className = '' }: AnimatedNumberProps) => {
  const [shown, setShown] = useState(value)
  const [ticks, setTicks] = useState(0)

  if (value !== shown) {
    setShown(value)
    setTicks(t => t + 1)
  }

  return (
    <span className={`inline-block tabular-nums ${className}`}>
      <span key={ticks} className={`inline-block ${ticks > 0 ? 'number-tick' : ''}`}>{value}</span>
    </span>
  )
}

export default AnimatedNumber
