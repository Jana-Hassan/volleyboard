import { useEffect } from 'react'

interface ToastProps {
  message: string
  onDone: () => void
}

const Toast = ({ message, onDone }: ToastProps) => {
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(onDone, 4000)
    return () => clearTimeout(timer)
  }, [message, onDone])

  if (!message) return null

  return (
    <div className="fixed bottom-20 md:bottom-6 inset-x-4 md:inset-x-auto md:right-6 z-50 flex justify-center pointer-events-none">
      <div role="status" className="number-tick bg-card border border-opp text-white text-xs px-4 py-3 rounded max-w-sm pointer-events-auto">
        {message}
      </div>
    </div>
  )
}

export default Toast
