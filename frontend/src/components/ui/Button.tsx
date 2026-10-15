import type { ButtonHTMLAttributes } from 'react'

type Tone = 'primary' | 'danger' | 'outline' | 'neutral' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: Tone
  size?: Size
}

const TONES: Record<Tone, string> = {
  primary: 'bg-us text-white hover:bg-us-hover',
  danger: 'bg-opp text-white hover:bg-opp-hover',
  outline: 'border border-us text-white bg-card hover:bg-us',
  neutral: 'border border-line text-white hover:border-muted',
  ghost: 'text-muted hover:text-white'
}

const SIZES: Record<Size, string> = {
  sm: 'px-2.5 py-1.5 text-[10px]',
  md: 'px-4 py-2 text-xs',
  lg: 'px-5 py-3 text-sm'
}

const Button = ({ tone = 'neutral', size = 'md', className = '', type = 'button', ...rest }: ButtonProps) => (
  <button
    type={type}
    className={`rounded uppercase tracking-widest font-medium transition-motion-fast disabled:opacity-30 disabled:cursor-not-allowed pointer-coarse:min-h-11 ${TONES[tone]} ${SIZES[size]} ${className}`}
    {...rest}
  />
)

export default Button
