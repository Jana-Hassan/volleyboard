import type { ReactNode } from 'react'
import Navbar from './Navbar'

interface PageShellProps {
  breadcrumbs?: { label: string; path?: string }[]
  children: ReactNode
  maxWidth?: string
}

const PageShell = ({ breadcrumbs, children, maxWidth = 'max-w-5xl' }: PageShellProps) => {
  return (
    <div className="h-dvh bg-surface text-white flex flex-col overflow-hidden">
      <Navbar breadcrumbs={breadcrumbs} />
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className={`${maxWidth} mx-auto px-4 md:px-6 py-4 md:py-5 h-full flex flex-col`}>
          {children}
        </div>
      </div>
    </div>
  )
}

export default PageShell
